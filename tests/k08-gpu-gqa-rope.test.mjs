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
const ROPE_ENGINE = path.join(
  ROOT,
  'native',
  'tensor-engine',
  'target',
  'release',
  process.platform === 'win32' ? 'rcl-rope-frame.exe' : 'rcl-rope-frame',
);
const PROVIDER = path.join(ROOT, 'native', 'tensor-engine', 'amd_opencl_bf16_provider.py');
const GENOME = path.join(ROOT, 'examples', 'native-ai', 'gpu-gqa-rope-genome.rcl');
const CONTRACT = path.join(ROOT, 'examples', 'native-ai', 'gpu-gqa-rope-contract.v0.1.json');
const PARAMETER_IDS = ['gqa.q0', 'gqa.q1', 'gqa.k', 'gqa.v'];
const INITIAL_WEIGHTS = Object.freeze({
  'gqa.q0': [0.12, 0.02, 0.01, 0.11, -0.04, 0.08, 0.07, -0.03],
  'gqa.q1': [0.08, -0.06, 0.05, 0.09, 0.02, 0.04, -0.07, 0.1],
  'gqa.k': [0.1, -0.05, 0.06, 0.04, 0.08, 0.03, -0.02, 0.09],
  'gqa.v': [0.15, 0.05, -0.03, 0.12, 0.06, 0.11, 0.1, -0.04],
});
const CONFIG = Object.freeze({
  learningRate: 0.02,
  beta1: 0.9,
  beta2: 0.999,
  epsilon: 1e-5,
  weightDecay: 0.01,
  gradientClip: 5,
});

const view = new DataView(new ArrayBuffer(4));
function f32Bits(value) {
  view.setFloat32(0, Math.fround(value), false);
  return view.getUint32(0, false);
}
function exactBits(value) {
  return f32Bits(value).toString(16).padStart(8, '0');
}

function buildEngines() {
  const run = spawnSync('cargo', [
    'build',
    '--release',
    '--locked',
    '--manifest-path',
    MANIFEST,
    '--bin',
    'rcl-bf16-autodiff-adamw',
    '--bin',
    'rcl-rope-frame',
  ], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 180_000,
    maxBuffer: 32 * 1024 * 1024,
  });
  assert.equal(run.status, 0, run.stderr || run.stdout);
}

function ropeFrame() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-k08-gpu-gqa-rope-frame-'));
  const requestPath = path.join(directory, 'request.json');
  fs.writeFileSync(requestPath, JSON.stringify({
    format: 'rcl.rope-position-frame-request.v0.1',
    sequenceLength: 2,
    headDimension: 2,
    base: 10000,
    positionOffset: 0,
    maxPositionExclusive: 8,
  }));
  const run = spawnSync(ROPE_ENGINE, [requestPath], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 60_000,
    maxBuffer: 16 * 1024 * 1024,
  });
  fs.rmSync(directory, { recursive: true, force: true });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  return JSON.parse(run.stdout.trim());
}

function tensor(id, shape, storageIdentity, device, gradientIdentity = `derived:${id}`) {
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

function graphFor(frame, { device = 'opencl-amd', hybrid = true, providerPath = PROVIDER } = {}) {
  const placement = (operation) => hybrid
    ? { placement: operation === 'matmul' ? 'gpu' : 'cpu-reference' }
    : {};
  const parameterShapes = {
    'gqa.q0': [4, 2],
    'gqa.q1': [4, 2],
    'gqa.k': [4, 2],
    'gqa.v': [4, 2],
  };
  const parameterTensors = PARAMETER_IDS.map((id) => tensor(
    id,
    parameterShapes[id],
    `storage:${id}`,
    device,
    `parameter:${id}`,
  ));
  const builder = {
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
      tensor('input', [2, 4], 'storage:input', device),
      tensor('target', [2, 2], 'storage:target', device),
      tensor('rope.cos', [2, 2], 'storage:rope.cos', device),
      tensor('rope.sin', [2, 2], 'storage:rope.sin', device),
      tensor('rope.rotation', [2, 2], 'storage:rope.rotation', device),
      tensor('attentionScale', [1], 'storage:attentionScale', device),
      tensor('causalMask', [2, 2], 'storage:causalMask', device),
      ...parameterTensors,
    ],
    storages: [
      { identity: 'storage:input', kind: 'cpu-dense', data: [0.9, 0.1, 0, 0, 0, 0.8, 0.2, 0.1] },
      { identity: 'storage:target', kind: 'cpu-dense', data: [0.2, 0.1, 0.1, 0.2] },
      { identity: 'storage:rope.cos', kind: 'cpu-dense', data: [...frame.cos] },
      { identity: 'storage:rope.sin', kind: 'cpu-dense', data: [...frame.sin] },
      { identity: 'storage:rope.rotation', kind: 'cpu-dense', data: [...frame.rotationMatrix] },
      { identity: 'storage:attentionScale', kind: 'cpu-dense', data: [1 / Math.sqrt(2)] },
      { identity: 'storage:causalMask', kind: 'cpu-dense', data: [0, -20, 0, 0] },
      ...PARAMETER_IDS.map((id) => ({
        identity: `storage:${id}`,
        kind: 'cpu-dense',
        data: [...INITIAL_WEIGHTS[id]],
      })),
    ],
    exactF32StorageBits: Object.fromEntries(
      PARAMETER_IDS.map((id) => [`storage:${id}`, INITIAL_WEIGHTS[id].map(exactBits)]),
    ),
    nodes: [],
    outputs: ['loss', 'gqa.mergedContext'],
  };
  const node = (id, operation, inputs, shape, attributes = {}) => {
    builder.nodes.push({
      id: `node:${id}`,
      operation,
      inputs,
      output: output(id, shape, device),
      attributes,
    });
    return id;
  };
  const addRoPE = (input, prefix) => {
    const rotated = node(`${prefix}.rotate`, 'matmul', [input, 'rope.rotation'], [2, 2], placement('matmul'));
    const cosine = node(`${prefix}.cos`, 'mul', [input, 'rope.cos'], [2, 2], placement('mul'));
    const sine = node(`${prefix}.sin`, 'mul', [rotated, 'rope.sin'], [2, 2], placement('mul'));
    return node(`${prefix}.output`, 'add', [cosine, sine], [2, 2], placement('add'));
  };

  node('gqa.q0.project', 'matmul', ['input', 'gqa.q0'], [2, 2], placement('matmul'));
  node('gqa.q1.project', 'matmul', ['input', 'gqa.q1'], [2, 2], placement('matmul'));
  node('gqa.k.project', 'matmul', ['input', 'gqa.k'], [2, 2], placement('matmul'));
  node('gqa.v.project', 'matmul', ['input', 'gqa.v'], [2, 2], placement('matmul'));
  const q0 = addRoPE('gqa.q0.project', 'gqa.q0.rope');
  const q1 = addRoPE('gqa.q1.project', 'gqa.q1.rope');
  const key = addRoPE('gqa.k.project', 'gqa.k.rope');
  const keyTransposed = node('gqa.k.transpose', 'transpose', [key], [2, 2], {
    ...placement('transpose'),
    permutation: [1, 0],
  });
  const attention = (head, query) => {
    const raw = node(`gqa.head${head}.scores`, 'matmul', [query, keyTransposed], [2, 2], placement('matmul'));
    const scaled = node(`gqa.head${head}.scaled`, 'mul', [raw, 'attentionScale'], [2, 2], placement('mul'));
    const masked = node(`gqa.head${head}.masked`, 'add', [scaled, 'causalMask'], [2, 2], placement('add'));
    const probabilities = node(`gqa.head${head}.probabilities`, 'softmax', [masked], [2, 2], placement('softmax'));
    return node(`gqa.head${head}.context`, 'matmul', [probabilities, 'gqa.v.project'], [2, 2], placement('matmul'));
  };
  const context0 = attention(0, q0);
  const context1 = attention(1, q1);
  const merged = node('gqa.mergedContext', 'add', [context0, context1], [2, 2], placement('add'));
  const error = node('loss.error', 'sub', [merged, 'target'], [2, 2], placement('sub'));
  const squared = node('loss.square', 'mul', [error, error], [2, 2], placement('mul'));
  const sampleMean = node('loss.sampleMean', 'mean', [squared], [2], { ...placement('mean'), axis: 1 });
  node('loss', 'mean', [sampleMean], [], { ...placement('mean'), axis: 0 });
  return builder;
}

function requestFor(frame, {
  backend = 'opencl-amd-hybrid',
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
      graph: graphFor(frame, { device, hybrid, providerPath }),
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
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-k08-gpu-gqa-rope-'));
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

function cpuEquivalent(hybridRequest) {
  const cpu = structuredClone(hybridRequest);
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

let frame;
test.before(() => {
  buildEngines();
  frame = ropeFrame();
});

test('K08 GPU GQA+RoPE contract is RCL-owned and uses generic shared-KV topology', () => {
  assert.ok(compileRealityToBytecode(fs.readFileSync(GENOME, 'utf8')).length > 0);
  const contract = JSON.parse(fs.readFileSync(CONTRACT, 'utf8'));
  assert.equal(contract.canonicalOwner, 'RCL');
  assert.equal(contract.lowering.semanticOwner, 'RCL');
  assert.equal(contract.lowering.fallback, 'forbidden');
  assert.equal(contract.graphPolicy.sharedKvAcrossQueryHeads, true);
  assert.deepEqual(contract.lowering.requiredPlacements, {
    matmul: 'gpu',
    nonMatmul: 'cpu-reference-explicit',
  });
  assert.ok(contract.claimsNotGranted.includes('GPU_TRAINING'));
  assert.ok(contract.claimsNotGranted.includes('OPENCL_BF16_BACKWARD_KERNELS'));
  const graph = graphFor(frame);
  const operations = new Set(graph.nodes.map((node) => node.operation));
  assert.deepEqual([...operations].filter((operation) => /model-special|gqa-special|rope-special/i.test(operation)), []);
  const contextNodes = graph.nodes.filter((node) => node.id.endsWith('.context'));
  assert.deepEqual(contextNodes.map((node) => node.inputs[1]), ['gqa.v.project', 'gqa.v.project']);
  assert.equal(graph.nodes.find((node) => node.id === 'node:gqa.head0.scores').inputs[1], 'gqa.k.transpose');
  assert.equal(graph.nodes.find((node) => node.id === 'node:gqa.head1.scores').inputs[1], 'gqa.k.transpose');
});

test('K08 GPU GQA+RoPE BF16 forward matmuls match CPU training exactly', () => {
  const hybridRequest = requestFor(frame);
  const hybrid = execute(hybridRequest);
  if (hybrid.status !== 0) {
    assert.equal(unavailable(hybrid.value), true, JSON.stringify(hybrid.value));
    return;
  }
  assert.equal(hybrid.value.status, 'ok');
  assert.equal(hybrid.value.gpuClaim, false);
  assert.equal(hybrid.value.telemetry.gpuMatmulNodes, 11);
  assert.ok(hybrid.value.telemetry.hostCpuNodes > 10);
  assert.equal(hybrid.value.telemetry.gpuExecutionRoots.length, 11);
  assert.ok(hybrid.value.telemetry.gpuExecutionRoots.every((root) => /^[0-9a-f]{64}$/.test(root)));
  assert.deepEqual(hybrid.value.parameterOrder, PARAMETER_IDS);
  assert.ok(hybrid.value.finalLoss < hybrid.value.initialLoss, `${hybrid.value.initialLoss} -> ${hybrid.value.finalLoss}`);
  assert.equal(hybrid.value.parameters.every((parameter) => parameter.masterWeight.bitsHex.some(
    (bits, index) => bits !== exactBits(INITIAL_WEIGHTS[parameter.tensorId][index]),
  )), true);

  const cpu = execute(cpuEquivalent(hybridRequest));
  assert.equal(cpu.status, 0, JSON.stringify(cpu.value));
  assert.equal(hybrid.value.initialLoss, cpu.value.initialLoss);
  assert.equal(hybrid.value.finalLoss, cpu.value.finalLoss);
  assert.deepEqual(hybrid.value.parameters, cpu.value.parameters);
  assert.deepEqual(hybrid.value.optimizerStates, cpu.value.optimizerStates);
  assert.equal(hybrid.value.checkpointRoot, cpu.value.checkpointRoot);
});

test('K08 GPU GQA+RoPE checkpoint replay and placement boundaries fail closed', () => {
  const direct = execute(requestFor(frame, { steps: 2 }));
  if (direct.status === 0) {
    const first = execute(requestFor(frame, { steps: 1 }));
    const resumed = execute(applyCheckpoint(requestFor(frame, { steps: 1 }), first.value));
    const replay = execute(requestFor(frame, { steps: 2 }));
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

  const missingPlacement = requestFor(frame);
  delete missingPlacement.autodiff.graph.nodes.find((node) => node.id === 'node:gqa.head1.scores').attributes.placement;
  assert.equal(execute(missingPlacement).value.code, 'RCL_ACCELERATOR_PLACEMENT_REQUIRED');

  const cpuMatmul = requestFor(frame);
  cpuMatmul.autodiff.graph.nodes.find((node) => node.id === 'node:gqa.head1.scores').attributes.placement = 'cpu-reference';
  assert.equal(execute(cpuMatmul).value.code, 'RCL_ACCELERATOR_GPU_PLACEMENT_REQUIRED');

  const missingProvider = requestFor(frame, {
    providerPath: path.join(ROOT, 'native', 'tensor-engine', 'missing-opencl-provider.py'),
  });
  assert.equal(execute(missingProvider).value.code, 'RCL_ACCELERATOR_PROVIDER_UNAVAILABLE');

  const mismatchedGraph = requestFor(frame);
  mismatchedGraph.autodiff.graph.bindings.backend = 'cpu-reference';
  assert.equal(execute(mismatchedGraph).value.code, 'RCL_ACCELERATOR_BACKEND_GRAPH_MISMATCH');
});
