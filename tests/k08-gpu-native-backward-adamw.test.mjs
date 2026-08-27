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
const GENOME = path.join(ROOT, 'examples', 'native-ai', 'gpu-native-backward-adamw-genome.rcl');
const CONTRACT = path.join(ROOT, 'examples', 'native-ai', 'gpu-native-backward-adamw-contract.v0.1.json');
const PARAMETER_IDS = ['w', 'b'];
const INITIAL_WEIGHTS = Object.freeze({ w: [0.7], b: [0.1] });
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
      { identity: 'storage:w', kind: 'cpu-dense', data: [...INITIAL_WEIGHTS.w] },
      { identity: 'storage:b', kind: 'cpu-dense', data: [...INITIAL_WEIGHTS.b] },
    ],
    exactF32StorageBits: {
      'storage:w': INITIAL_WEIGHTS.w.map(exactBits),
      'storage:b': INITIAL_WEIGHTS.b.map(exactBits),
    },
    nodes: [
      {
        id: 'project',
        operation: 'matmul',
        inputs: ['input', 'w'],
        output: output('projected', [4, 1], device),
        attributes: placement('matmul'),
      },
      {
        id: 'bias',
        operation: 'broadcast',
        inputs: ['b'],
        output: output('biasExpanded', [4, 1], device),
        attributes: { ...placement('broadcast'), shape: [4, 1] },
      },
      {
        id: 'addBias',
        operation: 'add',
        inputs: ['projected', 'biasExpanded'],
        output: output('prediction', [4, 1], device),
        attributes: placement('add'),
      },
      {
        id: 'error',
        operation: 'sub',
        inputs: ['prediction', 'target'],
        output: output('error', [4, 1], device),
        attributes: placement('sub'),
      },
      {
        id: 'square',
        operation: 'mul',
        inputs: ['error', 'error'],
        output: output('squaredError', [4, 1], device),
        attributes: placement('mul'),
      },
      {
        id: 'sampleMean',
        operation: 'mean',
        inputs: ['squaredError'],
        output: output('sampleLoss', [4], device),
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
    outputs: ['loss', 'prediction'],
  };
}

function requestFor({
  backend = 'opencl-amd-gpu-training',
  device = 'opencl-amd',
  hybrid = true,
  providerPath = PROVIDER,
  steps = 2,
} = {}) {
  return {
    format: 'rcl.bf16-autodiff-adamw-request.v0.2',
    backend,
    steps,
    autodiff: {
      format: 'rcl.tensor-autodiff-request.v0.1',
      graph: graphFor({ backend, device, hybrid, providerPath }),
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
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-k08-gpu-native-backward-'));
  const requestPath = path.join(directory, 'request.json');
  fs.writeFileSync(requestPath, JSON.stringify(request));
  const run = spawnSync(ENGINE, [requestPath], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 180_000,
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

test('K08 GPU-native backward and AdamW contract preserves RCL ownership', () => {
  assert.ok(compileRealityToBytecode(fs.readFileSync(GENOME, 'utf8')).length > 0);
  const contract = JSON.parse(fs.readFileSync(CONTRACT, 'utf8'));
  assert.equal(contract.canonicalOwner, 'RCL');
  assert.equal(contract.lowering.semanticOwner, 'RCL');
  assert.equal(contract.lowering.fallback, 'forbidden');
  assert.deepEqual(contract.lowering.gpuPrimitives, ['matmul-gradient-left', 'matmul-gradient-right', 'adamw-update']);
  assert.deepEqual(contract.lowering.requiredPlacements, {
    matmul: 'gpu',
    nonMatmul: 'cpu-reference-explicit',
  });
  assert.ok(contract.claimsNotGranted.includes('GPU_TRAINING'));
  assert.ok(contract.claimsNotGranted.includes('OPENCL_BF16_FULL_GRAPH'));
  const operations = new Set(graphFor().nodes.map((node) => node.operation));
  assert.deepEqual([...operations].filter((operation) => /model-special|adamw-special|backward-special/i.test(operation)), []);
});

test('K08 GPU-native backward and AdamW match CPU reference exactly', () => {
  const gpuRequest = requestFor();
  const gpu = execute(gpuRequest);
  if (gpu.status !== 0) {
    assert.equal(unavailable(gpu.value), true, JSON.stringify(gpu.value));
    return;
  }
  assert.equal(gpu.value.status, 'ok');
  assert.equal(gpu.value.gpuClaim, false);
  assert.equal(gpu.value.telemetry.executionBackend, 'rcl-tensor-bf16-autodiff-adamw-opencl-amd-gpu-training-v0.1');
  assert.equal(gpu.value.telemetry.gpuMatmulNodes, 1);
  assert.equal(gpu.value.telemetry.gpuBackwardMatmulNodes, 2);
  assert.equal(gpu.value.telemetry.gpuExecutionRoots.length, 1);
  assert.equal(gpu.value.telemetry.gpuBackwardExecutionRoots.length, 2);
  assert.equal(gpu.value.telemetry.gpuOptimizerElements, 4);
  assert.equal(gpu.value.telemetry.gpuOptimizerExecutionRoots.length, 4);
  assert.ok(gpu.value.telemetry.gpuExecutionRoots.every((root) => /^[0-9a-f]{64}$/.test(root)));
  assert.ok(gpu.value.telemetry.gpuBackwardExecutionRoots.every((root) => /^[0-9a-f]{64}$/.test(root)));
  assert.ok(gpu.value.telemetry.gpuOptimizerExecutionRoots.every((root) => /^[0-9a-f]{64}$/.test(root)));
  assert.ok(gpu.value.finalLoss < gpu.value.initialLoss, `${gpu.value.initialLoss} -> ${gpu.value.finalLoss}`);

  const cpu = execute(cpuEquivalent(gpuRequest));
  assert.equal(cpu.status, 0, JSON.stringify(cpu.value));
  assert.equal(gpu.value.initialLoss, cpu.value.initialLoss);
  assert.equal(gpu.value.finalLoss, cpu.value.finalLoss);
  assert.deepEqual(gpu.value.parameters, cpu.value.parameters);
  assert.deepEqual(gpu.value.optimizerStates, cpu.value.optimizerStates);
  assert.equal(gpu.value.checkpointRoot, cpu.value.checkpointRoot);
});

test('K08 GPU-native backward and AdamW resume plus backend boundaries fail closed', () => {
  const direct = execute(requestFor({ steps: 2 }));
  if (direct.status === 0) {
    const first = execute(requestFor({ steps: 1 }));
    const resumed = execute(applyCheckpoint(requestFor({ steps: 1 }), first.value));
    const replay = execute(requestFor({ steps: 2 }));
    assert.equal(first.status, 0, JSON.stringify(first.value));
    assert.equal(resumed.status, 0, JSON.stringify(resumed.value));
    assert.equal(replay.status, 0, JSON.stringify(replay.value));
    assert.deepEqual(resumed.value.parameters, direct.value.parameters);
    assert.deepEqual(resumed.value.optimizerStates, direct.value.optimizerStates);
    assert.equal(resumed.value.checkpointRoot, direct.value.checkpointRoot);
    assert.deepEqual(replay.value.parameters, direct.value.parameters);
    assert.deepEqual(replay.value.optimizerStates, direct.value.optimizerStates);
    assert.equal(replay.value.checkpointRoot, direct.value.checkpointRoot);
  } else {
    assert.equal(unavailable(direct.value), true, JSON.stringify(direct.value));
  }

  const missingPlacement = requestFor();
  delete missingPlacement.autodiff.graph.nodes[0].attributes.placement;
  assert.equal(execute(missingPlacement).value.code, 'RCL_ACCELERATOR_PLACEMENT_REQUIRED');

  const cpuMatmul = requestFor();
  cpuMatmul.autodiff.graph.nodes[0].attributes.placement = 'cpu-reference';
  assert.equal(execute(cpuMatmul).value.code, 'RCL_ACCELERATOR_GPU_PLACEMENT_REQUIRED');

  const missingProvider = requestFor({
    providerPath: path.join(ROOT, 'native', 'tensor-engine', 'missing-opencl-provider.py'),
  });
  assert.equal(execute(missingProvider).value.code, 'RCL_ACCELERATOR_PROVIDER_UNAVAILABLE');

  const missingProviderBinding = requestFor();
  delete missingProviderBinding.autodiff.graph.bindings.providerPath;
  assert.equal(execute(missingProviderBinding).value.code, 'RCL_ACCELERATOR_PROVIDER_REQUIRED');

  const mismatchedGraph = requestFor();
  mismatchedGraph.autodiff.graph.bindings.backend = 'opencl-amd-hybrid';
  assert.equal(execute(mismatchedGraph).value.code, 'RCL_ACCELERATOR_BACKEND_GRAPH_MISMATCH');
});
