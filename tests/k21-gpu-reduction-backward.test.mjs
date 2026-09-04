import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { compileRealityToBytecode } from '../src/bytecode.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST = path.join(ROOT, 'native', 'tensor-engine', 'Cargo.toml');
const ENGINE = path.join(
  ROOT,
  'native',
  'tensor-engine',
  'target',
  'release',
  process.platform === 'win32' ? 'rcl-bf16-autodiff-adamw.exe' : 'rcl-bf16-autodiff-adamw',
);
const PROVIDER = path.join(ROOT, 'native', 'tensor-engine', 'amd_opencl_bf16_provider.py');
const GENOME = path.join(ROOT, 'examples', 'native-ai', 'gpu-reduction-backward-genome.rcl');
const CONTRACT = path.join(ROOT, 'examples', 'native-ai', 'gpu-reduction-backward-contract.v0.1.json');
const INITIAL_WEIGHTS = Object.freeze({ w: [0.7, 0.2, 0.4, 0.1] });
const CONFIG = Object.freeze({
  learningRate: 0.05,
  beta1: 0.9,
  beta2: 0.999,
  epsilon: 1e-5,
  weightDecay: 0.01,
  gradientClip: 10,
});

const view = new DataView(new ArrayBuffer(4));
function f32Bits(value) {
  view.setFloat32(0, Math.fround(value), false);
  return view.getUint32(0, false);
}
function exactBits(value) {
  return f32Bits(value).toString(16).padStart(8, '0');
}

function buildEngine() {
  const run = spawnSync('cargo', [
    'build',
    '--release',
    '--locked',
    '--manifest-path',
    MANIFEST,
    '--bin',
    'rcl-bf16-autodiff-adamw',
  ], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 180_000,
    maxBuffer: 32 * 1024 * 1024,
  });
  assert.equal(run.status, 0, run.stderr || run.stdout);
}

function descriptor(id, shape, storageIdentity, device, gradientIdentity = `derived:${id}`) {
  return {
    id,
    shape,
    dtype: 'bf16',
    layout: 'row-major',
    device,
    gradientIdentity,
    storageIdentity,
  };
}

function output(id, shape, device) {
  return {
    id,
    shape,
    dtype: 'bf16',
    layout: 'row-major',
    device,
    gradientIdentity: `derived:${id}`,
  };
}

function graphFor({
  backend = 'opencl-amd-gpu-training',
  device = 'opencl-amd',
  hybrid = true,
  providerPath = PROVIDER,
  reductionMode = 'reduction-v0.1',
} = {}) {
  const placement = (operation) => hybrid
    ? { placement: operation === 'matmul' || operation === 'mean' ? 'gpu' : 'cpu-reference' }
    : {};
  const bindings = hybrid
    ? {
      semanticOwner: 'RCL',
      precisionPolicy: 'bf16-rne-fp32-accumulation',
      backend,
      placementPolicy: 'explicit-per-node',
      providerPath,
      gpuBufferAllocationMode: 'session-arena-v0.1',
      gpuNonMatmulMode: reductionMode,
    }
    : {
      semanticOwner: 'RCL',
      precisionPolicy: 'bf16-rne-fp32-accumulation',
    };
  return {
    format: 'rcl.tensor-execution-plan.v0.1',
    bindings,
    tensors: [
      descriptor('input', [2, 2], 'storage:input', device),
      descriptor('w', [2, 2], 'storage:w', device, 'parameter:w'),
    ],
    storages: [
      { identity: 'storage:input', kind: 'cpu-dense', data: [1, 2, 1, 2] },
      { identity: 'storage:w', kind: 'cpu-dense', data: [...INITIAL_WEIGHTS.w] },
    ],
    exactF32StorageBits: {
      'storage:w': INITIAL_WEIGHTS.w.map(exactBits),
    },
    nodes: [
      {
        id: 'project',
        operation: 'matmul',
        inputs: ['input', 'w'],
        output: output('projected', [2, 2], device),
        attributes: placement('matmul'),
      },
      {
        id: 'columnMean',
        operation: 'mean',
        inputs: ['projected'],
        output: output('columnMeans', [2], device),
        attributes: { ...placement('mean'), axis: 0 },
      },
      {
        id: 'lossInput',
        operation: 'reshape',
        inputs: ['columnMeans'],
        output: output('lossInput', [1, 2], device),
        attributes: { ...placement('reshape'), shape: [1, 2] },
      },
      {
        id: 'loss',
        operation: 'mean',
        inputs: ['lossInput'],
        output: output('loss', [1], device),
        attributes: { ...placement('mean'), axis: 1 },
      },
    ],
    outputs: ['loss', 'projected'],
  };
}

function requestFor({
  backend = 'opencl-amd-gpu-training',
  device = 'opencl-amd',
  hybrid = true,
  providerPath = PROVIDER,
  steps = 2,
  arena = true,
  reductionMode = 'reduction-v0.1',
} = {}) {
  const graph = graphFor({ backend, device, hybrid, providerPath, reductionMode });
  if (!arena && hybrid) delete graph.bindings.gpuBufferAllocationMode;
  return {
    format: 'rcl.bf16-autodiff-adamw-request.v0.2',
    backend,
    steps,
    autodiff: {
      format: 'rcl.tensor-autodiff-request.v0.1',
      graph,
      loss: 'loss',
      parameters: [{ tensorId: 'w', gradientIdentity: 'parameter:w' }],
      stopGradients: [],
      precision: 'bf16-rne-fp32-accumulation',
    },
    config: CONFIG,
    optimizerStates: [],
  };
}

function execute(request) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-k21-gpu-reduction-'));
  const requestPath = path.join(directory, 'request.json');
  fs.writeFileSync(requestPath, JSON.stringify(request));
  const run = spawnSync(ENGINE, [requestPath], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 240_000,
    maxBuffer: 64 * 1024 * 1024,
  });
  fs.rmSync(directory, { recursive: true, force: true });
  if (run.error) throw run.error;
  const raw = (run.status === 0 ? run.stdout : run.stderr).trim();
  return { status: run.status, value: JSON.parse(raw) };
}

function cpuEquivalent(gpuRequest) {
  const cpu = structuredClone(gpuRequest);
  cpu.backend = 'cpu-reference';
  cpu.autodiff.graph.bindings = {
    semanticOwner: 'RCL',
    precisionPolicy: 'bf16-rne-fp32-accumulation',
  };
  for (const tensor of cpu.autodiff.graph.tensors) tensor.device = 'cpu';
  for (const node of cpu.autodiff.graph.nodes) {
    node.output.device = 'cpu';
    delete node.attributes.placement;
  }
  return cpu;
}

function unavailable(value) {
  return [
    'RCL_OPENCL_BACKEND_UNAVAILABLE',
    'RCL_OPENCL_AMD_DEVICE_REQUIRED',
    'RCL_ACCELERATOR_PROVIDER_UNAVAILABLE',
  ].includes(value.code);
}

test.before(() => buildEngine());

test('K21 contract and genome preserve RCL ownership and explicit reduction boundaries', () => {
  assert.ok(compileRealityToBytecode(fs.readFileSync(GENOME, 'utf8')).length > 0);
  const contract = JSON.parse(fs.readFileSync(CONTRACT, 'utf8'));
  assert.equal(contract.canonicalOwner, 'RCL');
  assert.equal(contract.semanticBoundary.fallback, 'forbidden');
  assert.equal(contract.transport.mode, 'session-arena-v0.1');
  assert.deepEqual(contract.lowering.gpuPrimitives, ['mean', 'mean-gradient']);
  assert.equal(contract.lowering.requiredPlacements.reductionMean, 'gpu-with-explicit-reduction-v0.1');
  assert.ok(contract.claimsNotGranted.includes('GPU_TRAINING'));
  assert.ok(contract.claimsNotGranted.includes('GPU_NATIVE_BROADCAST_AUTODIFF'));
  const operations = new Set(graphFor().nodes.map((node) => node.operation));
  assert.deepEqual([...operations].filter((operation) => /model-special|adamw-special|backward-special/i.test(operation)), []);
});

test('K21 GPU mean forward and reverse reuse the session arena and match CPU exactly', { timeout: 900_000 }, () => {
  const arenaRequest = requestFor({ steps: 2, arena: true });
  const arena = execute(arenaRequest);
  if (arena.status !== 0) {
    assert.equal(unavailable(arena.value), true, JSON.stringify(arena.value));
    return;
  }
  const perKernel = execute(requestFor({ steps: 2, arena: false }));
  const cpu = execute(cpuEquivalent(arenaRequest));
  assert.equal(perKernel.status, 0, JSON.stringify(perKernel.value));
  assert.equal(cpu.status, 0, JSON.stringify(cpu.value));

  assert.equal(arena.value.status, 'ok');
  assert.equal(arena.value.gpuClaim, false);
  assert.equal(arena.value.telemetry.steps, 2);
  assert.equal(arena.value.telemetry.gpuProviderTransport, 'persistent-session-v0.1');
  assert.equal(arena.value.telemetry.gpuProviderBufferAllocationMode, 'session-arena-v0.1');
  assert.ok(arena.value.telemetry.gpuProviderBufferAllocations > 0);
  assert.ok(arena.value.telemetry.gpuProviderBufferReuses > 0);
  assert.ok(arena.value.telemetry.gpuProviderBufferAllocations < perKernel.value.telemetry.gpuProviderBufferAllocations);
  assert.equal(
    arena.value.telemetry.gpuProviderBufferAllocations + arena.value.telemetry.gpuProviderBufferReuses,
    perKernel.value.telemetry.gpuProviderBufferAllocations,
  );
  assert.equal(arena.value.telemetry.gpuProviderBufferReleases, arena.value.telemetry.gpuProviderBufferAllocations);
  assert.equal(arena.value.telemetry.gpuProviderPooledBuffers, 0);
  assert.equal(arena.value.telemetry.gpuProviderPooledBytes, 0);
  assert.ok(arena.value.telemetry.gpuProviderPeakPooledBuffers > 0);
  assert.ok(arena.value.telemetry.gpuProviderPeakPooledBytes > 0);
  assert.equal(arena.value.telemetry.gpuMatmulNodes, 1);
  assert.equal(arena.value.telemetry.gpuReductionNodes, 2);
  assert.equal(arena.value.telemetry.gpuBackwardMatmulNodes, 2);
  assert.equal(arena.value.telemetry.gpuBackwardReductionNodes, 2);
  assert.ok(arena.value.finalLoss < arena.value.initialLoss);

  assert.equal(arena.value.initialLoss, perKernel.value.initialLoss);
  assert.equal(arena.value.finalLoss, perKernel.value.finalLoss);
  assert.deepEqual(arena.value.parameters, perKernel.value.parameters);
  assert.deepEqual(arena.value.optimizerStates, perKernel.value.optimizerStates);
  assert.equal(arena.value.checkpointRoot, perKernel.value.checkpointRoot);
  assert.equal(arena.value.initialLoss, cpu.value.initialLoss);
  assert.equal(arena.value.finalLoss, cpu.value.finalLoss);
  assert.deepEqual(arena.value.parameters, cpu.value.parameters);
  assert.deepEqual(arena.value.optimizerStates, cpu.value.optimizerStates);
  assert.equal(arena.value.checkpointRoot, cpu.value.checkpointRoot);

  if (process.env.RCL_K21_EVIDENCE === '1') {
    console.log(`K21_EVIDENCE ${JSON.stringify({
      arena: {
        steps: arena.value.telemetry.steps,
        initialLoss: arena.value.initialLoss,
        finalLoss: arena.value.finalLoss,
        checkpointRoot: arena.value.checkpointRoot,
        requests: arena.value.telemetry.gpuProviderRequests,
        dispatches: arena.value.telemetry.gpuProviderDispatches,
        allocations: arena.value.telemetry.gpuProviderBufferAllocations,
        allocationBytes: arena.value.telemetry.gpuProviderBufferAllocationBytes,
        reuses: arena.value.telemetry.gpuProviderBufferReuses,
        releases: arena.value.telemetry.gpuProviderBufferReleases,
        peakPooledBuffers: arena.value.telemetry.gpuProviderPeakPooledBuffers,
        peakPooledBytes: arena.value.telemetry.gpuProviderPeakPooledBytes,
        gpuMatmulNodes: arena.value.telemetry.gpuMatmulNodes,
        gpuReductionNodes: arena.value.telemetry.gpuReductionNodes,
        gpuBackwardMatmulNodes: arena.value.telemetry.gpuBackwardMatmulNodes,
        gpuBackwardReductionNodes: arena.value.telemetry.gpuBackwardReductionNodes,
        executionRoots: arena.value.telemetry.gpuExecutionRoots,
        backwardExecutionRoots: arena.value.telemetry.gpuBackwardExecutionRoots,
      },
      perKernel: {
        checkpointRoot: perKernel.value.checkpointRoot,
        allocations: perKernel.value.telemetry.gpuProviderBufferAllocations,
        allocationBytes: perKernel.value.telemetry.gpuProviderBufferAllocationBytes,
        reuses: perKernel.value.telemetry.gpuProviderBufferReuses,
        releases: perKernel.value.telemetry.gpuProviderBufferReleases,
      },
      exact: { cpuDifferential: true, deterministicReplay: true },
    })}`);
  }
});

test('K21 reduction mode, placement, provider and backend boundaries fail closed', { timeout: 900_000 }, () => {
  const direct = execute(requestFor({ steps: 2, arena: true }));
  if (direct.status !== 0) assert.equal(unavailable(direct.value), true, JSON.stringify(direct.value));

  const unsupportedMode = requestFor({ arena: true, reductionMode: 'reduction-unbounded' });
  assert.equal(execute(unsupportedMode).value.code, 'RCL_ACCELERATOR_ELEMENTWISE_MODE_UNSUPPORTED');

  const missingMode = requestFor({ arena: true });
  delete missingMode.autodiff.graph.bindings.gpuNonMatmulMode;
  assert.equal(execute(missingMode).value.code, 'RCL_ACCELERATOR_PLACEMENT_UNSUPPORTED');

  const invalidAxis = requestFor({ arena: true });
  invalidAxis.autodiff.graph.nodes.find((node) => node.id === 'columnMean').attributes.axis = 2;
  assert.equal(execute(invalidAxis).value.code, 'RCL_BF16_REDUCTION_AXIS');

  const unavailableArena = cpuEquivalent(requestFor({ arena: true }));
  unavailableArena.autodiff.graph.bindings.gpuBufferAllocationMode = 'session-arena-v0.1';
  assert.equal(execute(unavailableArena).value.code, 'RCL_ACCELERATOR_BUFFER_ARENA_UNAVAILABLE');

  const missingProvider = requestFor({
    arena: true,
    providerPath: path.join(ROOT, 'native', 'tensor-engine', 'missing-opencl-provider.py'),
  });
  assert.equal(execute(missingProvider).value.code, 'RCL_ACCELERATOR_PROVIDER_UNAVAILABLE');

  const mismatchedGraph = requestFor({ arena: true });
  mismatchedGraph.autodiff.graph.bindings.backend = 'opencl-amd-hybrid';
  assert.equal(execute(mismatchedGraph).value.code, 'RCL_ACCELERATOR_BACKEND_GRAPH_MISMATCH');
});
