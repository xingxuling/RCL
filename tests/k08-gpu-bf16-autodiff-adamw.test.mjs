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
const GENOME = path.join(ROOT, 'examples', 'native-ai', 'gpu-bf16-autodiff-adamw-genome.rcl');
const CONTRACT = path.join(ROOT, 'examples', 'native-ai', 'gpu-bf16-autodiff-adamw-contract.v0.1.json');

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

function descriptor(id, shape, storageIdentity, device, gradientIdentity = 'derived:' + id) {
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
    gradientIdentity: 'derived:' + id,
  };
}

function graphFor({ device = 'opencl-amd', hybrid = true, providerPath = PROVIDER } = {}) {
  const placement = (operation) => hybrid
    ? { placement: operation === 'matmul' ? 'gpu' : 'cpu-reference' }
    : {};
  return {
    format: 'rcl.tensor-execution-plan.v0.1',
    bindings: hybrid
      ? {
        semanticOwner: 'RCL',
        precisionPolicy: 'bf16-rne-fp32-accumulation',
        backend: 'opencl-amd-hybrid',
        placementPolicy: 'explicit-per-node',
        providerPath,
      }
      : {
        semanticOwner: 'RCL',
        precisionPolicy: 'bf16-rne-fp32-accumulation',
      },
    tensors: [
      descriptor('input', [4, 1], 'storage:input', device),
      descriptor('target', [4, 1], 'storage:target', device),
      descriptor('w', [1, 1], 'storage:w', device, 'parameter:w'),
      descriptor('b', [1], 'storage:b', device, 'parameter:b'),
    ],
    storages: [
      { identity: 'storage:input', kind: 'cpu-dense', data: [0, 1, 2, 3] },
      { identity: 'storage:target', kind: 'cpu-dense', data: [0, 1, 2, 3] },
      { identity: 'storage:w', kind: 'cpu-dense', data: [0] },
      { identity: 'storage:b', kind: 'cpu-dense', data: [0] },
    ],
    exactF32StorageBits: {
      'storage:w': [exactBits(0)],
      'storage:b': [exactBits(0)],
    },
    nodes: [
      { id: 'project', operation: 'matmul', inputs: ['input', 'w'], output: output('projected', [4, 1], device), attributes: placement('matmul') },
      { id: 'bias', operation: 'broadcast', inputs: ['b'], output: output('biasExpanded', [4, 1], device), attributes: { ...placement('broadcast'), shape: [4, 1] } },
      { id: 'addBias', operation: 'add', inputs: ['projected', 'biasExpanded'], output: output('prediction', [4, 1], device), attributes: placement('add') },
      { id: 'error', operation: 'sub', inputs: ['prediction', 'target'], output: output('error', [4, 1], device), attributes: placement('sub') },
      { id: 'square', operation: 'mul', inputs: ['error', 'error'], output: output('squaredError', [4, 1], device), attributes: placement('mul') },
      { id: 'sampleMean', operation: 'mean', inputs: ['squaredError'], output: output('sampleLoss', [4], device), attributes: { ...placement('mean'), axis: 1 } },
      { id: 'loss', operation: 'mean', inputs: ['sampleLoss'], output: output('loss', [], device), attributes: { ...placement('mean'), axis: 0 } },
    ],
    outputs: ['loss', 'prediction'],
  };
}

function requestFor({ backend = 'opencl-amd-hybrid', device = 'opencl-amd', hybrid = true, providerPath = PROVIDER, steps = 4 } = {}) {
  return {
    format: 'rcl.bf16-autodiff-adamw-request.v0.2',
    backend,
    steps,
    autodiff: {
      format: 'rcl.tensor-autodiff-request.v0.1',
      graph: graphFor({ device, hybrid, providerPath }),
      loss: 'loss',
      parameters: [
        { tensorId: 'w', gradientIdentity: 'parameter:w' },
        { tensorId: 'b', gradientIdentity: 'parameter:b' },
      ],
      stopGradients: [],
      precision: 'bf16-rne-fp32-accumulation',
    },
    config: {
      learningRate: 0.05,
      beta1: 0.9,
      beta2: 0.999,
      epsilon: 1e-5,
      weightDecay: 0.01,
      gradientClip: 10,
    },
    optimizerStates: [],
  };
}

function execute(request) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-k08-gpu-bf16-'));
  const requestPath = path.join(directory, 'request.json');
  fs.writeFileSync(requestPath, JSON.stringify(request));
  const run = spawnSync(ENGINE, [requestPath], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 120_000,
    maxBuffer: 32 * 1024 * 1024,
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

test('K08 GPU BF16 Autodiff+AdamW genome and contract preserve the RCL owner boundary', () => {
  assert.ok(compileRealityToBytecode(fs.readFileSync(GENOME, 'utf8')).length > 0);
  const contract = JSON.parse(fs.readFileSync(CONTRACT, 'utf8'));
  assert.equal(contract.canonicalOwner, 'RCL');
  assert.equal(contract.lowering.semanticOwner, 'RCL');
  assert.equal(contract.lowering.fallback, 'forbidden');
  assert.deepEqual(contract.lowering.requiredPlacements, {
    matmul: 'gpu',
    nonMatmul: 'cpu-reference-explicit',
  });
  assert.ok(contract.claimsNotGranted.includes('GPU_TRAINING'));
});

test('K08 GPU BF16 Autodiff+AdamW executes the generic graph through explicit AMD placement or fails closed', () => {
  const gpuRequest = requestFor();
  const gpu = execute(gpuRequest);
  if (gpu.status !== 0) {
    assert.equal(unavailable(gpu.value), true, JSON.stringify(gpu.value));
    return;
  }
  assert.equal(gpu.value.status, 'ok');
  assert.equal(gpu.value.gpuClaim, false);
  assert.equal(gpu.value.telemetry.backend, 'rcl-tensor-bf16-autodiff-adamw-opencl-amd-hybrid-v0.1');
  assert.equal(gpu.value.telemetry.executionBackend, 'rcl-tensor-bf16-autodiff-adamw-opencl-amd-hybrid-v0.1');
  assert.ok(gpu.value.telemetry.gpuMatmulNodes > 0);
  assert.ok(gpu.value.telemetry.hostCpuNodes > 0);
  assert.ok(gpu.value.telemetry.gpuExecutionRoots.every((root) => /^[0-9a-f]{64}$/.test(root)));
  assert.ok(gpu.value.finalLoss < gpu.value.initialLoss, String(gpu.value.initialLoss) + ' -> ' + String(gpu.value.finalLoss));

  const cpu = execute(cpuEquivalent(gpuRequest));
  assert.equal(cpu.status, 0, JSON.stringify(cpu.value));
  assert.equal(gpu.value.initialLoss, cpu.value.initialLoss);
  assert.equal(gpu.value.finalLoss, cpu.value.finalLoss);
  assert.deepEqual(gpu.value.parameters, cpu.value.parameters);
  assert.deepEqual(gpu.value.optimizerStates, cpu.value.optimizerStates);
  assert.equal(gpu.value.checkpointRoot, cpu.value.checkpointRoot);
});

test('K08 GPU BF16 placement and provider boundaries fail closed without CPU fallback', () => {
  const missingPlacement = requestFor();
  delete missingPlacement.autodiff.graph.nodes[0].attributes.placement;
  assert.equal(execute(missingPlacement).value.code, 'RCL_ACCELERATOR_PLACEMENT_REQUIRED');

  const cpuMatmul = requestFor();
  cpuMatmul.autodiff.graph.nodes[0].attributes.placement = 'cpu-reference';
  assert.equal(execute(cpuMatmul).value.code, 'RCL_ACCELERATOR_GPU_PLACEMENT_REQUIRED');

  const missingProvider = requestFor({ providerPath: path.join(ROOT, 'native', 'tensor-engine', 'missing-opencl-provider.py') });
  assert.equal(execute(missingProvider).value.code, 'RCL_ACCELERATOR_PROVIDER_UNAVAILABLE');

  const mismatchedGraph = requestFor();
  mismatchedGraph.autodiff.graph.bindings.backend = 'cpu-reference';
  assert.equal(execute(mismatchedGraph).value.code, 'RCL_ACCELERATOR_BACKEND_GRAPH_MISMATCH');
});
