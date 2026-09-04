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
const GENOME = path.join(ROOT, 'examples', 'native-ai', 'gpu-native-reverse-adamw-session-arena-genome.rcl');
const CONTRACT = path.join(ROOT, 'examples', 'native-ai', 'gpu-native-reverse-adamw-session-arena-contract.v0.1.json');
const PARAMETER_IDS = ['w'];
const INITIAL_WEIGHTS = Object.freeze({ w: [0.7] });
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

function graphFor({ backend = 'opencl-amd-gpu-training', device = 'opencl-amd', hybrid = true, providerPath = PROVIDER } = {}) {
  const placement = (operation) => hybrid
    ? { placement: operation === 'matmul' ? 'gpu' : 'cpu-reference' }
    : {};
  return {
    format: 'rcl.tensor-execution-plan.v0.1',
    bindings: hybrid
      ? {
        semanticOwner: 'RCL',
        precisionPolicy: 'bf16-rne-fp32-accumulation',
        backend,
        placementPolicy: 'explicit-per-node',
        providerPath,
        gpuBufferAllocationMode: 'session-arena-v0.1',
      }
      : {
        semanticOwner: 'RCL',
        precisionPolicy: 'bf16-rne-fp32-accumulation',
      },
    tensors: [
      descriptor('input', [2, 1], 'storage:input', device),
      descriptor('target', [2, 1], 'storage:target', device),
      descriptor('w', [1, 1], 'storage:w', device, 'parameter:w'),
    ],
    storages: [
      { identity: 'storage:input', kind: 'cpu-dense', data: [0, 1] },
      { identity: 'storage:target', kind: 'cpu-dense', data: [0, 1] },
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
        output: output('projected', [2, 1], device),
        attributes: placement('matmul'),
      },
      {
        id: 'error',
        operation: 'sub',
        inputs: ['projected', 'target'],
        output: output('error', [2, 1], device),
        attributes: placement('sub'),
      },
      {
        id: 'square',
        operation: 'mul',
        inputs: ['error', 'error'],
        output: output('squaredError', [2, 1], device),
        attributes: placement('mul'),
      },
      {
        id: 'sampleMean',
        operation: 'mean',
        inputs: ['squaredError'],
        output: output('sampleLoss', [2], device),
        attributes: { ...placement('mean'), axis: 1 },
      },
      {
        id: 'loss',
        operation: 'mean',
        inputs: ['sampleLoss'],
        output: output('loss', [], device),
        attributes: { ...placement('mean'), axis: 0 },
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
} = {}) {
  const graph = graphFor({ backend, device, hybrid, providerPath });
  if (!arena && hybrid) delete graph.bindings.gpuBufferAllocationMode;
  return {
    format: 'rcl.bf16-autodiff-adamw-request.v0.2',
    backend,
    steps,
    autodiff: {
      format: 'rcl.tensor-autodiff-request.v0.1',
      graph,
      loss: 'loss',
      parameters: PARAMETER_IDS.map((tensorId) => ({ tensorId, gradientIdentity: `parameter:${tensorId}` })),
      stopGradients: [],
      precision: 'bf16-rne-fp32-accumulation',
    },
    config: CONFIG,
    optimizerStates: [],
  };
}

function execute(request) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-k19-gpu-reverse-adamw-'));
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

function applyCheckpoint(request, result) {
  const next = structuredClone(request);
  for (const parameter of result.parameters) {
    const storage = next.autodiff.graph.storages.find(
      (item) => item.identity === `storage:${parameter.tensorId}`,
    );
    storage.data = [...parameter.masterWeight.data];
    next.autodiff.graph.exactF32StorageBits[`storage:${parameter.tensorId}`] = [
      ...parameter.masterWeight.bitsHex,
    ];
  }
  next.optimizerStates = structuredClone(result.optimizerStates);
  return next;
}

test.before(() => buildEngine());

test('K19 session-arena contract preserves RCL ownership and closes GPU-training claims', () => {
  assert.ok(compileRealityToBytecode(fs.readFileSync(GENOME, 'utf8')).length > 0);
  const contract = JSON.parse(fs.readFileSync(CONTRACT, 'utf8'));
  assert.equal(contract.canonicalOwner, 'RCL');
  assert.equal(contract.semanticBoundary.fallback, 'forbidden');
  assert.equal(contract.transport.mode, 'session-arena-v0.1');
  assert.deepEqual(contract.lowering.gpuPrimitives, [
    'matmul', 'matmul-gradient-left', 'matmul-gradient-right', 'adamw-update',
  ]);
  assert.deepEqual(contract.lowering.requiredPlacements, {
    matmul: 'gpu',
    nonMatmul: 'cpu-reference-explicit',
  });
  assert.ok(contract.claimsNotGranted.includes('GPU_TRAINING'));
  assert.ok(contract.claimsNotGranted.includes('OPENCL_FULL_GRAPH_TRAINING_SEMANTICS'));
  const operations = new Set(graphFor().nodes.map((node) => node.operation));
  assert.deepEqual([...operations].filter((operation) => /model-special|adamw-special|backward-special/i.test(operation)), []);
});

test('K19 repeated GPU reverse/AdamW steps reuse a persistent arena and match CPU exactly', { timeout: 900_000 }, () => {
  const arenaRequest = requestFor({ steps: 2, arena: true });
  const arena = execute(arenaRequest);
  if (arena.status !== 0) {
    assert.equal(unavailable(arena.value), true, JSON.stringify(arena.value));
    return;
  }
  const perKernel = execute(requestFor({ steps: 2, arena: false }));
  assert.equal(perKernel.status, 0, JSON.stringify(perKernel.value));
  const cpu = execute(cpuEquivalent(arenaRequest));
  assert.equal(cpu.status, 0, JSON.stringify(cpu.value));

  assert.equal(arena.value.status, 'ok');
  assert.equal(arena.value.gpuClaim, false);
  assert.equal(arena.value.telemetry.steps, 2);
  assert.equal(arena.value.telemetry.gpuProviderTransport, 'persistent-session-v0.1');
  assert.equal(arena.value.telemetry.gpuProviderBufferAllocationMode, 'session-arena-v0.1');
  assert.ok(arena.value.telemetry.gpuProviderBufferAllocations > 0);
  assert.ok(arena.value.telemetry.gpuProviderBufferReuses > 0);
  assert.ok(
    arena.value.telemetry.gpuProviderBufferAllocations
      < perKernel.value.telemetry.gpuProviderBufferAllocations,
  );
  assert.equal(
    arena.value.telemetry.gpuProviderBufferAllocations
      + arena.value.telemetry.gpuProviderBufferReuses,
    perKernel.value.telemetry.gpuProviderBufferAllocations,
  );
  assert.equal(
    arena.value.telemetry.gpuProviderBufferReleases,
    arena.value.telemetry.gpuProviderBufferAllocations,
  );
  assert.equal(arena.value.telemetry.gpuProviderPooledBuffers, 0);
  assert.equal(arena.value.telemetry.gpuProviderPooledBytes, 0);
  assert.ok(arena.value.telemetry.gpuProviderPeakPooledBuffers > 0);
  assert.ok(arena.value.telemetry.gpuProviderPeakPooledBytes > 0);
  assert.equal(arena.value.telemetry.gpuProviderTensorValueResidency, false);
  assert.equal(arena.value.telemetry.gpuMatmulNodes, 1);
  assert.equal(arena.value.telemetry.gpuBackwardMatmulNodes, 2);
  assert.equal(arena.value.telemetry.gpuOptimizerElements, 2);
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

  const first = execute(requestFor({ steps: 1, arena: true }));
  const resumed = execute(applyCheckpoint(requestFor({ steps: 1, arena: true }), first.value));
  const replay = execute(requestFor({ steps: 2, arena: true }));
  assert.equal(first.status, 0, JSON.stringify(first.value));
  assert.equal(resumed.status, 0, JSON.stringify(resumed.value));
  assert.equal(replay.status, 0, JSON.stringify(replay.value));
  assert.deepEqual(resumed.value.parameters, arena.value.parameters);
  assert.deepEqual(resumed.value.optimizerStates, arena.value.optimizerStates);
  assert.equal(resumed.value.checkpointRoot, arena.value.checkpointRoot);
  assert.deepEqual(replay.value.parameters, arena.value.parameters);
  assert.deepEqual(replay.value.optimizerStates, arena.value.optimizerStates);
  assert.equal(replay.value.checkpointRoot, arena.value.checkpointRoot);

  if (process.env.RCL_K19_EVIDENCE === '1') {
    console.log(`K19_EVIDENCE ${JSON.stringify({
      arena: {
        steps: arena.value.telemetry.steps,
        initialLoss: arena.value.initialLoss,
        finalLoss: arena.value.finalLoss,
        checkpointRoot: arena.value.checkpointRoot,
        parameterCount: arena.value.parameters.length,
        optimizerStateCount: arena.value.optimizerStates.length,
        requests: arena.value.telemetry.gpuProviderRequests,
        dispatches: arena.value.telemetry.gpuProviderDispatches,
        allocations: arena.value.telemetry.gpuProviderBufferAllocations,
        allocationBytes: arena.value.telemetry.gpuProviderBufferAllocationBytes,
        reuses: arena.value.telemetry.gpuProviderBufferReuses,
        releases: arena.value.telemetry.gpuProviderBufferReleases,
        pooledBuffers: arena.value.telemetry.gpuProviderPooledBuffers,
        pooledBytes: arena.value.telemetry.gpuProviderPooledBytes,
        peakPooledBuffers: arena.value.telemetry.gpuProviderPeakPooledBuffers,
        peakPooledBytes: arena.value.telemetry.gpuProviderPeakPooledBytes,
        gpuMatmulNodes: arena.value.telemetry.gpuMatmulNodes,
        gpuBackwardMatmulNodes: arena.value.telemetry.gpuBackwardMatmulNodes,
        gpuOptimizerElements: arena.value.telemetry.gpuOptimizerElements,
        executionRoots: arena.value.telemetry.gpuExecutionRoots,
        backwardExecutionRoots: arena.value.telemetry.gpuBackwardExecutionRoots,
        optimizerExecutionRoots: arena.value.telemetry.gpuOptimizerExecutionRoots,
      },
      perKernel: {
        checkpointRoot: perKernel.value.checkpointRoot,
        allocations: perKernel.value.telemetry.gpuProviderBufferAllocations,
        allocationBytes: perKernel.value.telemetry.gpuProviderBufferAllocationBytes,
        reuses: perKernel.value.telemetry.gpuProviderBufferReuses,
        releases: perKernel.value.telemetry.gpuProviderBufferReleases,
      },
      exact: {
        cpuDifferential: true,
        deterministicReplay: true,
        checkpointResume: true,
      },
    })}`);
  }
});

test('K19 session-arena and placement boundaries fail closed', { timeout: 900_000 }, () => {
  const direct = execute(requestFor({ steps: 2, arena: true }));
  if (direct.status !== 0) assert.equal(unavailable(direct.value), true, JSON.stringify(direct.value));

  const unsupportedBufferMode = requestFor({ arena: true });
  unsupportedBufferMode.autodiff.graph.bindings.gpuBufferAllocationMode = 'session-arena-unbounded';
  assert.equal(execute(unsupportedBufferMode).value.code, 'RCL_ACCELERATOR_BUFFER_ALLOCATION_MODE_UNSUPPORTED');

  const unavailableBufferMode = cpuEquivalent(requestFor({ arena: true }));
  unavailableBufferMode.autodiff.graph.bindings.gpuBufferAllocationMode = 'session-arena-v0.1';
  assert.equal(execute(unavailableBufferMode).value.code, 'RCL_ACCELERATOR_BUFFER_ARENA_UNAVAILABLE');

  const missingPlacement = requestFor({ arena: true });
  delete missingPlacement.autodiff.graph.nodes[0].attributes.placement;
  assert.equal(execute(missingPlacement).value.code, 'RCL_ACCELERATOR_PLACEMENT_REQUIRED');

  const cpuMatmul = requestFor({ arena: true });
  cpuMatmul.autodiff.graph.nodes[0].attributes.placement = 'cpu-reference';
  assert.equal(execute(cpuMatmul).value.code, 'RCL_ACCELERATOR_GPU_PLACEMENT_REQUIRED');

  const missingProvider = requestFor({
    arena: true,
    providerPath: path.join(ROOT, 'native', 'tensor-engine', 'missing-opencl-provider.py'),
  });
  assert.equal(execute(missingProvider).value.code, 'RCL_ACCELERATOR_PROVIDER_UNAVAILABLE');

  const mismatchedGraph = requestFor({ arena: true });
  mismatchedGraph.autodiff.graph.bindings.backend = 'opencl-amd-hybrid';
  assert.equal(execute(mismatchedGraph).value.code, 'RCL_ACCELERATOR_BACKEND_GRAPH_MISMATCH');
});
