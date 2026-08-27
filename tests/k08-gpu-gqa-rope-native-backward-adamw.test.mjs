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
const GENOME = path.join(ROOT, 'examples', 'native-ai', 'gpu-gqa-rope-native-backward-adamw-genome.rcl');
const CONTRACT = path.join(ROOT, 'examples', 'native-ai', 'gpu-gqa-rope-native-backward-adamw-contract.v0.1.json');

const S = 3;
const V = 4;
const H = 4;
const FF = 5;
const Q_HEADS = 2;
const D = 2;
const EPSILON = 1e-5;
const SCALE = 1 / Math.sqrt(D);
const PARAMETER_IDS = [
  'tokenEmbedding',
  'block.0.wq', 'block.0.wk', 'block.0.wv', 'block.0.wo', 'block.0.w1', 'block.0.w2',
  'block.1.wq', 'block.1.wk', 'block.1.wv', 'block.1.wo', 'block.1.w1', 'block.1.w2',
  'lmHead',
];
const CONFIG = Object.freeze({
  learningRate: 0.01,
  beta1: 0.9,
  beta2: 0.999,
  epsilon: 1e-8,
  weightDecay: 0.01,
  gradientClip: 1,
});

const view = new DataView(new ArrayBuffer(4));
function f32(value) {
  view.setFloat32(0, Math.fround(value), false);
  return view.getFloat32(0, false);
}
function exactBits(value) {
  view.setFloat32(0, f32(value), false);
  return view.getUint32(0, false).toString(16).padStart(8, '0');
}
function matrix(rows, columns, seed, scale = 0.11) {
  return Array.from({ length: rows * columns }, (_, index) => (
    (((index + 1) * (seed * 5 + 7) + seed * 3) % 23 - 11) * scale / 11
  ));
}
function weights() {
  const result = {
    tokenEmbedding: [
      0.90, 0.02, -0.01, 0.03,
      0.01, 0.92, 0.02, -0.02,
      -0.02, 0.01, 0.91, 0.03,
      0.03, -0.01, 0.02, 0.89,
    ],
    lmHead: [
      0.05, 0.36, -0.08, 0.02,
      -0.02, 0.04, 0.34, -0.07,
      -0.06, -0.01, 0.03, 0.35,
      0.33, -0.05, 0.01, 0.04,
    ],
  };
  for (let block = 0; block < 2; block += 1) {
    const prefix = `block.${block}`;
    const seed = block * 7 + 1;
    result[`${prefix}.wq`] = matrix(H, H, seed + 1);
    result[`${prefix}.wk`] = matrix(H, D, seed + 2);
    result[`${prefix}.wv`] = matrix(H, D, seed + 3);
    result[`${prefix}.wo`] = matrix(H, H, seed + 4);
    result[`${prefix}.w1`] = matrix(H, FF, seed + 5, 0.13);
    result[`${prefix}.w2`] = matrix(FF, H, seed + 6, 0.12);
  }
  return result;
}

function selector(head) {
  const result = new Array(H * D).fill(0);
  for (let local = 0; local < D; local += 1) {
    result[(head * D + local) * D + local] = 1;
  }
  return result;
}
function embedder(head) {
  const result = new Array(D * H).fill(0);
  for (let local = 0; local < D; local += 1) {
    result[local * H + head * D + local] = 1;
  }
  return result;
}
function causalMask() {
  return Array.from({ length: S * S }, (_, index) => (
    Number(index % S <= Math.floor(index / S) ? 0 : -20)
  ));
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

class GraphBuilder {
  constructor({ backend, device, providerPath, hybrid }) {
    this.graph = {
      format: 'rcl.tensor-execution-plan.v0.1',
      bindings: hybrid
        ? {
          semanticOwner: 'RCL',
          campaign: 'K08-R-GPU-NATIVE-BACKWARD-ADAMW',
          precisionPolicy: 'bf16-rne-fp32-accumulation',
          backend,
          placementPolicy: 'explicit-per-node',
          providerPath,
        }
        : {
          semanticOwner: 'RCL',
          precisionPolicy: 'bf16-rne-fp32-accumulation',
        },
      tensors: [],
      storages: [],
      exactF32StorageBits: {},
      nodes: [],
      outputs: [],
    };
    this.device = device;
    this.hybrid = hybrid;
  }

  tensor(id, shape, data, parameter = false) {
    const storageIdentity = `storage:${id}`;
    this.graph.tensors.push(tensor(
      id,
      shape,
      storageIdentity,
      this.device,
      parameter ? `parameter:${id}` : `derived:${id}`,
    ));
    this.graph.storages.push({ identity: storageIdentity, kind: 'cpu-dense', data: [...data] });
    if (parameter) this.graph.exactF32StorageBits[storageIdentity] = data.map(exactBits);
    return id;
  }

  node(id, operation, inputs, shape, attributes = {}) {
    this.graph.nodes.push({
      id: `node:${id}`,
      operation,
      inputs,
      output: output(id, shape, this.device),
      attributes,
    });
    return id;
  }

  placement(operation) {
    return this.hybrid
      ? { placement: operation === 'matmul' ? 'gpu' : 'cpu-reference' }
      : {};
  }
}

function rmsNorm(builder, input, prefix) {
  const square = builder.node(`${prefix}.square`, 'mul', [input, input], [S, H], builder.placement('mul'));
  const mean = builder.node(`${prefix}.mean`, 'mean', [square], [S], { ...builder.placement('mean'), axis: 1 });
  const column = builder.node(
    `${prefix}.column`,
    'reshape',
    [mean],
    [S, 1],
    { ...builder.placement('reshape'), shape: [S, 1] },
  );
  const shifted = builder.node(
    `${prefix}.shifted`,
    'add',
    [column, 'epsilon'],
    [S, 1],
    builder.placement('add'),
  );
  const root = builder.node(`${prefix}.root`, 'sqrt', [shifted], [S, 1], builder.placement('sqrt'));
  const denominator = builder.node(
    `${prefix}.denominator`,
    'broadcast',
    [root],
    [S, H],
    { ...builder.placement('broadcast'), shape: [S, H] },
  );
  return builder.node(`${prefix}.normalized`, 'div', [input, denominator], [S, H], builder.placement('div'));
}

function addRoPE(builder, input, prefix) {
  const rotated = builder.node(
    `${prefix}.rotate`,
    'matmul',
    [input, 'rope.rotation'],
    [S, D],
    builder.placement('matmul'),
  );
  const cosine = builder.node(
    `${prefix}.cosPart`,
    'mul',
    [input, 'rope.cos'],
    [S, D],
    builder.placement('mul'),
  );
  const sine = builder.node(
    `${prefix}.sinPart`,
    'mul',
    [rotated, 'rope.sin'],
    [S, D],
    builder.placement('mul'),
  );
  return builder.node(
    `${prefix}.output`,
    'add',
    [cosine, sine],
    [S, D],
    builder.placement('add'),
  );
}

function addBlock(builder, input, block) {
  const prefix = `block.${block}`;
  const norm = rmsNorm(builder, input, `${prefix}.norm`);
  const qAll = builder.node(`${prefix}.q.all`, 'matmul', [norm, `${prefix}.wq`], [S, H], builder.placement('matmul'));
  const key = builder.node(`${prefix}.k`, 'matmul', [norm, `${prefix}.wk`], [S, D], builder.placement('matmul'));
  const value = builder.node(`${prefix}.v`, 'matmul', [norm, `${prefix}.wv`], [S, D], builder.placement('matmul'));
  const keyRotated = addRoPE(builder, key, `${prefix}.k.rope`);
  const keyTransposed = builder.node(
    `${prefix}.k.transpose`,
    'transpose',
    [keyRotated],
    [D, S],
    { ...builder.placement('transpose'), permutation: [1, 0] },
  );
  const heads = [];
  for (let head = 0; head < Q_HEADS; head += 1) {
    const qHead = builder.node(
      `${prefix}.q.${head}`,
      'matmul',
      [qAll, `head.selector.${head}`],
      [S, D],
      builder.placement('matmul'),
    );
    const qRotated = addRoPE(builder, qHead, `${prefix}.q.${head}.rope`);
    const raw = builder.node(
      `${prefix}.attn.${head}.raw`,
      'matmul',
      [qRotated, keyTransposed],
      [S, S],
      builder.placement('matmul'),
    );
    const scaled = builder.node(
      `${prefix}.attn.${head}.scaled`,
      'mul',
      [raw, 'attentionScale'],
      [S, S],
      builder.placement('mul'),
    );
    const masked = builder.node(
      `${prefix}.attn.${head}.masked`,
      'add',
      [scaled, 'causalMask'],
      [S, S],
      builder.placement('add'),
    );
    const probabilities = builder.node(
      `${prefix}.attn.${head}.probabilities`,
      'softmax',
      [masked],
      [S, S],
      builder.placement('softmax'),
    );
    const context = builder.node(
      `${prefix}.attn.${head}.context`,
      'matmul',
      [probabilities, value],
      [S, D],
      builder.placement('matmul'),
    );
    heads.push(builder.node(
      `${prefix}.attn.${head}.embedded`,
      'matmul',
      [context, `head.embedder.${head}`],
      [S, H],
      builder.placement('matmul'),
    ));
  }
  const merged = builder.node(`${prefix}.heads.merged`, 'add', heads, [S, H], builder.placement('add'));
  const projected = builder.node(
    `${prefix}.attention.projected`,
    'matmul',
    [merged, `${prefix}.wo`],
    [S, H],
    builder.placement('matmul'),
  );
  const residual = builder.node(`${prefix}.residual`, 'add', [input, projected], [S, H], builder.placement('add'));
  const ffNorm = rmsNorm(builder, residual, `${prefix}.ff.norm`);
  const ffPre = builder.node(
    `${prefix}.ff.pre`,
    'matmul',
    [ffNorm, `${prefix}.w1`],
    [S, FF],
    builder.placement('matmul'),
  );
  const gate = builder.node(
    `${prefix}.ff.sigmoid`,
    'activation',
    [ffPre],
    [S, FF],
    { ...builder.placement('activation'), kind: 'sigmoid' },
  );
  const silu = builder.node(`${prefix}.ff.silu`, 'mul', [ffPre, gate], [S, FF], builder.placement('mul'));
  const ffProjected = builder.node(
    `${prefix}.ff.projected`,
    'matmul',
    [silu, `${prefix}.w2`],
    [S, H],
    builder.placement('matmul'),
  );
  return builder.node(`${prefix}.output`, 'add', [residual, ffProjected], [S, H], builder.placement('add'));
}

function buildGraph(frame, {
  backend = 'opencl-amd-gpu-training',
  device = 'opencl-amd',
  hybrid = true,
  providerPath = PROVIDER,
  initial = weights(),
} = {}) {
  const builder = new GraphBuilder({ backend, device, providerPath, hybrid });
  builder.tensor('inputOneHot', [S, V], [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0]);
  builder.tensor('targetOneHot', [S, V], [0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  builder.tensor('epsilon', [1], [EPSILON]);
  builder.tensor('attentionScale', [1], [SCALE]);
  builder.tensor('causalMask', [S, S], causalMask());
  builder.tensor('negativeOne', [], [-1]);
  builder.tensor('rope.cos', [S, D], frame.cos);
  builder.tensor('rope.sin', [S, D], frame.sin);
  builder.tensor('rope.rotation', [D, D], frame.rotationMatrix);
  for (let head = 0; head < Q_HEADS; head += 1) {
    builder.tensor(`head.selector.${head}`, [H, D], selector(head));
    builder.tensor(`head.embedder.${head}`, [D, H], embedder(head));
  }
  for (const id of PARAMETER_IDS) {
    const shape = id === 'tokenEmbedding'
      ? [V, H]
      : id === 'lmHead'
        ? [H, V]
        : id.endsWith('.wq') || id.endsWith('.wo')
          ? [H, H]
          : id.endsWith('.wk') || id.endsWith('.wv')
            ? [H, D]
            : id.endsWith('.w1')
              ? [H, FF]
              : [FF, H];
    builder.tensor(id, shape, initial[id], true);
  }
  let hidden = builder.node('embedding', 'matmul', ['inputOneHot', 'tokenEmbedding'], [S, H], builder.placement('matmul'));
  hidden = addBlock(builder, hidden, 0);
  hidden = addBlock(builder, hidden, 1);
  const logits = builder.node('lm.logits', 'matmul', [hidden, 'lmHead'], [S, V], builder.placement('matmul'));
  const probabilities = builder.node('lm.probabilities', 'softmax', [logits], [S, V], builder.placement('softmax'));
  const logProbabilities = builder.node('lm.logProbabilities', 'log', [probabilities], [S, V], builder.placement('log'));
  const selected = builder.node('loss.selected', 'mul', ['targetOneHot', 'lm.logProbabilities'], [S, V], builder.placement('mul'));
  const tokenLoss = builder.node('loss.token', 'sum', [selected], [S], { ...builder.placement('sum'), axis: 1 });
  const meanLoss = builder.node('loss.mean', 'mean', [tokenLoss], [], { ...builder.placement('mean'), axis: 0 });
  builder.node('loss', 'mul', ['negativeOne', 'loss.mean'], [], builder.placement('mul'));
  builder.graph.outputs = ['block.0.output', 'block.1.output', 'lm.logits', 'loss'];
  return builder.graph;
}

function ropeFrame() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-k08-gpu-gqa-native-rope-'));
  const requestPath = path.join(directory, 'request.json');
  fs.writeFileSync(requestPath, JSON.stringify({
    format: 'rcl.rope-position-frame-request.v0.1',
    sequenceLength: S,
    headDimension: D,
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

function buildEngines() {
  const run = spawnSync('cargo', [
    'build', '--release', '--locked', '--manifest-path', MANIFEST,
    '--bin', 'rcl-bf16-autodiff-adamw', '--bin', 'rcl-rope-frame',
  ], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 180_000,
    maxBuffer: 32 * 1024 * 1024,
  });
  assert.equal(run.status, 0, run.stderr || run.stdout);
}

function requestFor(frame, {
  backend = 'opencl-amd-gpu-training',
  device = 'opencl-amd',
  hybrid = true,
  providerPath = PROVIDER,
  steps = 2,
  initial = weights(),
  optimizerStates = [],
} = {}) {
  return {
    format: 'rcl.bf16-autodiff-adamw-request.v0.2',
    backend,
    steps,
    autodiff: {
      format: 'rcl.tensor-autodiff-request.v0.1',
      graph: buildGraph(frame, { backend, device, hybrid, providerPath, initial }),
      loss: 'loss',
      parameters: PARAMETER_IDS.map((tensorId) => ({ tensorId, gradientIdentity: `parameter:${tensorId}` })),
      stopGradients: [],
      precision: 'bf16-rne-fp32-accumulation',
    },
    config: CONFIG,
    optimizerStates,
  };
}

function execute(request) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-k08-gpu-gqa-native-'));
  const requestPath = path.join(directory, 'request.json');
  fs.writeFileSync(requestPath, JSON.stringify(request));
  const run = spawnSync(ENGINE, [requestPath], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 900_000,
    maxBuffer: 128 * 1024 * 1024,
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
  for (const tensorValue of cpu.autodiff.graph.tensors) tensorValue.device = 'cpu';
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

test('K08 GPU-native multi-block GQA+RoPE contract remains RCL-owned and generic', () => {
  assert.ok(compileRealityToBytecode(fs.readFileSync(GENOME, 'utf8')).length > 0);
  const contract = JSON.parse(fs.readFileSync(CONTRACT, 'utf8'));
  assert.equal(contract.canonicalOwner, 'RCL');
  assert.equal(contract.lowering.semanticOwner, 'RCL');
  assert.equal(contract.lowering.fallback, 'forbidden');
  assert.deepEqual(contract.lowering.gpuPrimitives, [
    'matmul-gradient-left', 'matmul-gradient-right', 'adamw-update',
  ]);
  assert.deepEqual(contract.lowering.requiredPlacements, {
    matmul: 'gpu',
    nonMatmul: 'cpu-reference-explicit',
  });
  assert.ok(contract.claimsNotGranted.includes('GPU_TRAINING'));
  assert.ok(contract.claimsNotGranted.includes('RCL_10M'));
  const graph = buildGraph(frame);
  assert.equal(graph.nodes.filter((node) => node.operation === 'matmul').length, 36);
  assert.equal(graph.nodes.filter((node) => node.attributes.placement === 'gpu').length, 36);
  assert.ok(graph.nodes.filter((node) => node.attributes.placement === 'cpu-reference').length > 40);
  const operations = new Set(graph.nodes.map((node) => node.operation));
  assert.deepEqual([...operations].filter((operation) => /model-special|gqa-special|rope-special|adamw-special|backward-special/i.test(operation)), []);
  for (const block of [0, 1]) {
    const contexts = graph.nodes.filter((node) => node.id.includes(`block.${block}.attn.`) && node.id.endsWith('.context'));
    assert.deepEqual(contexts.map((node) => node.inputs[1]), [`block.${block}.v`, `block.${block}.v`]);
    assert.deepEqual(
      graph.nodes
        .filter((node) => node.id.includes(`block.${block}.attn.`) && node.id.endsWith('.raw'))
        .map((node) => node.inputs[1]),
      [`block.${block}.k.transpose`, `block.${block}.k.transpose`],
    );
  }
});

test('K08 GPU-native multi-block GQA+RoPE backward and AdamW match CPU reference exactly', { timeout: 1_200_000 }, () => {
  const gpuRequest = requestFor(frame, { steps: 1 });
  const gpu = execute(gpuRequest);
  if (gpu.status !== 0) {
    assert.equal(unavailable(gpu.value), true, JSON.stringify(gpu.value));
    return;
  }
  assert.equal(gpu.value.status, 'ok');
  assert.equal(gpu.value.gpuClaim, false);
  assert.equal(gpu.value.telemetry.executionBackend, 'rcl-tensor-bf16-autodiff-adamw-opencl-amd-gpu-training-v0.1');
  assert.equal(gpu.value.telemetry.gpuMatmulNodes, 36);
  assert.equal(gpu.value.telemetry.gpuBackwardMatmulNodes, 72);
  assert.equal(gpu.value.telemetry.gpuExecutionRoots.length, 36);
  assert.equal(gpu.value.telemetry.gpuBackwardExecutionRoots.length, 72);
  assert.equal(gpu.value.telemetry.gpuOptimizerElements, 208);
  assert.equal(gpu.value.telemetry.gpuOptimizerExecutionRoots.length, PARAMETER_IDS.length);
  assert.ok(gpu.value.telemetry.hostCpuNodes > 40);
  assert.ok(gpu.value.telemetry.gpuExecutionRoots.every((root) => /^[0-9a-f]{64}$/.test(root)));
  assert.ok(gpu.value.telemetry.gpuBackwardExecutionRoots.every((root) => /^[0-9a-f]{64}$/.test(root)));
  assert.ok(gpu.value.telemetry.gpuOptimizerExecutionRoots.every((root) => /^[0-9a-f]{64}$/.test(root)));
  assert.equal(gpu.value.parameters.length, PARAMETER_IDS.length);
  assert.deepEqual(gpu.value.parameterOrder, PARAMETER_IDS);
  assert.ok(gpu.value.finalLoss < gpu.value.initialLoss, `${gpu.value.initialLoss} -> ${gpu.value.finalLoss}`);

  const cpu = execute(cpuEquivalent(gpuRequest));
  assert.equal(cpu.status, 0, JSON.stringify(cpu.value));
  assert.equal(gpu.value.initialLoss, cpu.value.initialLoss);
  assert.equal(gpu.value.finalLoss, cpu.value.finalLoss);
  assert.deepEqual(gpu.value.parameters, cpu.value.parameters);
  assert.deepEqual(gpu.value.optimizerStates, cpu.value.optimizerStates);
  assert.equal(gpu.value.checkpointRoot, cpu.value.checkpointRoot);
});

test('K08 GPU-native multi-block GQA+RoPE resume, replay and backend boundaries fail closed', { timeout: 2_400_000 }, () => {
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
  delete missingPlacement.autodiff.graph.nodes.find(
    (node) => node.id === 'node:block.1.attn.1.raw',
  ).attributes.placement;
  assert.equal(execute(missingPlacement).value.code, 'RCL_ACCELERATOR_PLACEMENT_REQUIRED');

  const cpuMatmul = requestFor(frame);
  cpuMatmul.autodiff.graph.nodes.find(
    (node) => node.id === 'node:block.1.attn.1.raw',
  ).attributes.placement = 'cpu-reference';
  assert.equal(execute(cpuMatmul).value.code, 'RCL_ACCELERATOR_GPU_PLACEMENT_REQUIRED');

  const missingProvider = requestFor(frame, {
    providerPath: path.join(ROOT, 'native', 'tensor-engine', 'missing-opencl-provider.py'),
  });
  assert.equal(execute(missingProvider).value.code, 'RCL_ACCELERATOR_PROVIDER_UNAVAILABLE');

  const missingProviderBinding = requestFor(frame);
  delete missingProviderBinding.autodiff.graph.bindings.providerPath;
  assert.equal(execute(missingProviderBinding).value.code, 'RCL_ACCELERATOR_PROVIDER_REQUIRED');

  const mismatchedGraph = requestFor(frame);
  mismatchedGraph.autodiff.graph.bindings.backend = 'opencl-amd-hybrid';
  assert.equal(execute(mismatchedGraph).value.code, 'RCL_ACCELERATOR_BACKEND_GRAPH_MISMATCH');
});
