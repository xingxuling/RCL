import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { compileRealityToBytecode } from '../src/bytecode.mjs';
import { runNativeBytecode, runNativeCompiler } from '../src/native-vm.mjs';
import { buildEngine, executeRequest } from '../scripts/run-k08-native-autodiff.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TENSOR_MANIFEST = path.join(ROOT, 'native', 'tensor-engine', 'Cargo.toml');
const ROPE_BIN = path.join(ROOT, 'native', 'tensor-engine', 'target', 'release', process.platform === 'win32' ? 'rcl-rope-frame.exe' : 'rcl-rope-frame');
const SOURCE = path.join(ROOT, 'examples', 'native-ai', 'gqa-genome.rcl');
const CONTRACT = path.join(ROOT, 'examples', 'native-ai', 'gqa-contract.v0.1.json');

const S = 3;
const H = 4;
const Q_HEADS = 2;
const KV_HEADS = 1;
const D = 2;
const SCALE = 1 / Math.sqrt(D);

const INPUT = [
  0.2, -0.1, 0.4, 0.3,
  -0.3, 0.5, 0.1, -0.2,
  0.6, 0.2, -0.4, 0.7,
];

const WEIGHTS = Object.freeze({
  wq: [
    0.20, 0.01, -0.03, 0.04,
    -0.02, 0.18, 0.05, 0.01,
    0.03, -0.04, 0.16, 0.02,
    0.01, 0.02, -0.05, 0.19,
  ],
  wk: [
    0.17, -0.02,
    0.03, 0.14,
    -0.04, 0.16,
    0.02, 0.05,
  ],
  wv: [
    0.13, 0.01,
    -0.02, 0.15,
    0.06, -0.03,
    0.04, 0.12,
  ],
  wo: [
    0.14, 0.01, -0.02, 0.03,
    -0.01, 0.16, 0.04, -0.02,
    0.02, -0.03, 0.15, 0.01,
    0.03, 0.02, -0.01, 0.13,
  ],
});

const LOSS_WEIGHTS = [
  0.5, -0.2, 0.1, 0.4,
  -0.3, 0.6, 0.2, -0.5,
  0.7, 0.1, -0.4, 0.3,
];

function buildAuxiliaryEngines() {
  buildEngine();
  const run = spawnSync('cargo', ['build', '--release', '--locked', '--manifest-path', TENSOR_MANIFEST, '--bin', 'rcl-rope-frame'], {
    cwd: ROOT, encoding: 'utf8', timeout: 180_000, maxBuffer: 32 * 1024 * 1024,
  });
  if (run.status !== 0) throw new Error(run.stderr || run.stdout || 'RCL_K08_O_ROPE_BUILD_FAILED');
}

function ropeFrame() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-k08-o-rope-'));
  const requestPath = path.join(directory, 'request.json');
  fs.writeFileSync(requestPath, JSON.stringify({
    format: 'rcl.rope-position-frame-request.v0.1', sequenceLength: S, headDimension: D, base: 10000, positionOffset: 0, maxPositionExclusive: 8,
  }));
  const run = spawnSync(ROPE_BIN, [requestPath], { cwd: ROOT, encoding: 'utf8', timeout: 60_000, maxBuffer: 16 * 1024 * 1024 });
  fs.rmSync(directory, { recursive: true, force: true });
  if (run.status !== 0) throw new Error(run.stderr || run.stdout || 'RCL_K08_O_ROPE_FRAME_FAILED');
  return JSON.parse(run.stdout.trim());
}

function validateProfile({ hiddenSize, queryHeads, kvHeads, headDimension }) {
  if (!Number.isInteger(queryHeads) || !Number.isInteger(kvHeads) || queryHeads <= 0 || kvHeads <= 0 || queryHeads < kvHeads || queryHeads % kvHeads !== 0) {
    const error = new Error('invalid queryHeads/kvHeads'); error.code = 'RCL_GQA_HEAD_COUNTS'; throw error;
  }
  if (!Number.isInteger(headDimension) || headDimension <= 0 || headDimension % 2 !== 0) {
    const error = new Error('headDimension must be positive even'); error.code = 'RCL_GQA_HEAD_DIMENSION'; throw error;
  }
  if (hiddenSize !== queryHeads * headDimension) {
    const error = new Error('hiddenSize mismatch'); error.code = 'RCL_GQA_HIDDEN_WIDTH'; throw error;
  }
  return { queriesPerKv: queryHeads / kvHeads, kvWidth: kvHeads * headDimension };
}

class GraphBuilder {
  constructor(bindings = {}) {
    this.graph = { format: 'rcl.tensor-execution-plan.v0.1', bindings, tensors: [], storages: [], exactStorageBits: {}, nodes: [], outputs: [] };
  }
  tensor(id, shape, data, gradientIdentity = `constant:${id}`) {
    const storageIdentity = `storage:${id}`;
    this.graph.tensors.push({ id, shape, dtype: 'f64', layout: 'row-major', device: 'cpu', gradientIdentity, storageIdentity });
    this.graph.storages.push({ identity: storageIdentity, kind: 'cpu-dense', data: [...data] });
    return id;
  }
  node(id, operation, inputs, shape, attributes = {}) {
    this.graph.nodes.push({ id: `node:${id}`, operation, inputs, output: { id, shape, dtype: 'f64', layout: 'row-major', device: 'cpu', gradientIdentity: `derived:${operation}:${id}` }, attributes });
    return id;
  }
}

function selector(headIndex) {
  const matrix = new Array(H * D).fill(0);
  for (let local = 0; local < D; local += 1) matrix[(headIndex * D + local) * D + local] = 1;
  return matrix;
}

function embedder(headIndex) {
  const matrix = new Array(D * H).fill(0);
  for (let local = 0; local < D; local += 1) matrix[local * H + headIndex * D + local] = 1;
  return matrix;
}

function causalMask() {
  return Array.from({ length: S * S }, (_, index) => {
    const row = Math.floor(index / S); const column = index % S;
    return column <= row ? 0 : -20;
  });
}

function addRoPE(builder, input, frame, prefix) {
  builder.tensor(`${prefix}.cos`, [S, D], frame.cos);
  builder.tensor(`${prefix}.sin`, [S, D], frame.sin);
  builder.tensor(`${prefix}.rotation`, [D, D], frame.rotationMatrix);
  const rotated = builder.node(`${prefix}.pairRotate`, 'matmul', [input, `${prefix}.rotation`], [S, D]);
  const c = builder.node(`${prefix}.cosPart`, 'mul', [input, `${prefix}.cos`], [S, D]);
  const s = builder.node(`${prefix}.sinPart`, 'mul', [rotated, `${prefix}.sin`], [S, D]);
  return builder.node(`${prefix}.output`, 'add', [c, s], [S, D]);
}

function buildGqaGraph(weights = WEIGHTS, frame = ropeFrame()) {
  validateProfile({ hiddenSize: H, queryHeads: Q_HEADS, kvHeads: KV_HEADS, headDimension: D });
  const b = new GraphBuilder({ campaign: 'K08-O', semanticOwner: 'RCL', profile: 'GQA-2Q-1KV' });
  b.tensor('input', [S, H], INPUT);
  b.tensor('wq', [H, H], weights.wq, 'parameter:wq');
  b.tensor('wk', [H, D], weights.wk, 'parameter:wk');
  b.tensor('wv', [H, D], weights.wv, 'parameter:wv');
  b.tensor('wo', [H, H], weights.wo, 'parameter:wo');
  b.tensor('scale', [1], [SCALE]);
  b.tensor('mask', [S, S], causalMask());
  b.tensor('lossWeights', [S, H], LOSS_WEIGHTS);
  for (let head = 0; head < Q_HEADS; head += 1) {
    b.tensor(`q.selector.${head}`, [H, D], selector(head));
    b.tensor(`head.embedder.${head}`, [D, H], embedder(head));
  }

  const qAll = b.node('q.all', 'matmul', ['input', 'wq'], [S, H]);
  const k0 = b.node('k.shared', 'matmul', ['input', 'wk'], [S, D]);
  const v0 = b.node('v.shared', 'matmul', ['input', 'wv'], [S, D]);
  const kRot = addRoPE(b, k0, frame, 'k0.rope');
  const kt = b.node('k0.transpose', 'transpose', [kRot], [D, S], { permutation: [1, 0] });

  const embeddedContexts = [];
  const attentionIds = [];
  for (let head = 0; head < Q_HEADS; head += 1) {
    const q = b.node(`q.head.${head}`, 'matmul', [qAll, `q.selector.${head}`], [S, D]);
    const qRot = addRoPE(b, q, frame, `q${head}.rope`);
    const raw = b.node(`attention.${head}.raw`, 'matmul', [qRot, kt], [S, S]);
    const scaled = b.node(`attention.${head}.scaled`, 'mul', [raw, 'scale'], [S, S]);
    const masked = b.node(`attention.${head}.masked`, 'add', [scaled, 'mask'], [S, S]);
    const probabilities = b.node(`attention.${head}.probabilities`, 'softmax', [masked], [S, S]);
    const context = b.node(`attention.${head}.context`, 'matmul', [probabilities, v0], [S, D]);
    embeddedContexts.push(b.node(`attention.${head}.embedded`, 'matmul', [context, `head.embedder.${head}`], [S, H]));
    attentionIds.push(probabilities);
  }
  const merged = b.node('heads.merged', 'add', embeddedContexts, [S, H]);
  const output = b.node('output', 'matmul', [merged, 'wo'], [S, H]);
  const weighted = b.node('loss.weighted', 'mul', [output, 'lossWeights'], [S, H]);
  const perRow = b.node('loss.perRow', 'sum', [weighted], [S], { axis: 1 });
  const loss = b.node('loss', 'sum', [perRow], [], { axis: 0 });
  b.graph.outputs = [output, merged, ...attentionIds, loss];
  return b.graph;
}

function autodiffRequest(graph) {
  return {
    format: 'rcl.tensor-autodiff-request.v0.1', graph, loss: 'loss',
    parameters: ['wq', 'wk', 'wv', 'wo'].map((tensorId) => ({ tensorId, gradientIdentity: `parameter:${tensorId}` })), stopGradients: [],
  };
}

function outputMap(result) { return new Map(result.outputs.map((item) => [item.tensor.id, item.storage.data])); }

function matmul(a, aRows, aCols, b, bCols) {
  const out = new Array(aRows * bCols).fill(0);
  for (let i = 0; i < aRows; i += 1) for (let k = 0; k < aCols; k += 1) for (let j = 0; j < bCols; j += 1) out[i * bCols + j] += a[i * aCols + k] * b[k * bCols + j];
  return out;
}

function transpose(a, rows, cols) { return Array.from({ length: rows * cols }, (_, i) => a[(i % rows) * cols + Math.floor(i / rows)]); }
function add(a, b) { return a.map((v, i) => v + b[i]); }
function mulScalar(a, scalar) { return a.map((v) => v * scalar); }
function softmaxRows(a, rows, cols) {
  const out = new Array(a.length);
  for (let r = 0; r < rows; r += 1) {
    const row = a.slice(r * cols, (r + 1) * cols); const max = Math.max(...row); const exps = row.map((v) => Math.exp(v - max)); const sum = exps.reduce((x, y) => x + y, 0);
    for (let c = 0; c < cols; c += 1) out[r * cols + c] = exps[c] / sum;
  }
  return out;
}

function directRoPE(values, frame) {
  const out = new Array(values.length);
  for (let r = 0; r < S; r += 1) {
    const i = r * D; const c = frame.cos[i]; const s = frame.sin[i];
    out[i] = values[i] * c - values[i + 1] * s;
    out[i + 1] = values[i] * s + values[i + 1] * c;
  }
  return out;
}

function selectHead(values, head) { return Array.from({ length: S * D }, (_, i) => values[Math.floor(i / D) * H + head * D + (i % D)]); }
function embedHead(values, head) {
  const out = new Array(S * H).fill(0);
  for (let r = 0; r < S; r += 1) for (let d = 0; d < D; d += 1) out[r * H + head * D + d] = values[r * D + d];
  return out;
}

function oracle(weights, frame) {
  const qAll = matmul(INPUT, S, H, weights.wq, H);
  const k = directRoPE(matmul(INPUT, S, H, weights.wk, D), frame);
  const v = matmul(INPUT, S, H, weights.wv, D);
  const kt = transpose(k, S, D);
  const mask = causalMask();
  const contexts = [];
  const attentions = [];
  for (let head = 0; head < Q_HEADS; head += 1) {
    const q = directRoPE(selectHead(qAll, head), frame);
    const raw = matmul(q, S, D, kt, S);
    const probs = softmaxRows(add(mulScalar(raw, SCALE), mask), S, S);
    attentions.push(probs);
    contexts.push(embedHead(matmul(probs, S, S, v, D), head));
  }
  const merged = add(contexts[0], contexts[1]);
  const output = matmul(merged, S, H, weights.wo, H);
  const loss = output.reduce((sum, value, index) => sum + value * LOSS_WEIGHTS[index], 0);
  return { output, merged, attentions, loss };
}

function maxAbsDiff(a, b) { let m = 0; for (let i = 0; i < a.length; i += 1) m = Math.max(m, Math.abs(a[i] - b[i])); return m; }

let frame;
let graph;
let forward;
let gradients;

test.before(() => {
  buildAuxiliaryEngines();
  frame = ropeFrame();
  graph = buildGqaGraph(WEIGHTS, frame);
  forward = executeRequest(graph);
  gradients = executeRequest(autodiffRequest(graph));
});

test('K08-O RCL GQA Genome self-hosts with byte-identical RBC and native semantic root', { timeout: 180_000 }, () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-k08-o-source-')); const rbc = path.join(directory, 'gqa.rbc');
  const compiled = runNativeCompiler('selfhost/compiler.rbc', SOURCE, rbc, { timeout: 120_000, maxBuffer: 64 * 1024 * 1024 }); assert.equal(compiled.status, 'ok');
  assert.equal(fs.readFileSync(rbc).equals(Buffer.from(compileRealityToBytecode(fs.readFileSync(SOURCE, 'utf8')))), true);
  const run = runNativeBytecode(rbc, { timeout: 120_000, maxBuffer: 64 * 1024 * 1024, requireNativeStateRoot: true });
  assert.equal(run.stateRootVerified, true); assert.equal(run.state['evaluation.gqa_2_1_valid'], true); assert.equal(run.state['evaluation.rcl1b_16_4_valid'], true); assert.equal(run.state['evaluation.invalid_3_2_rejected'], true);
  fs.rmSync(directory, { recursive: true, force: true });
});

test('K08-O GQA 2Q/1KV forward agrees with independent oracle and shares the KV head', () => {
  const actual = outputMap(forward); const expected = oracle(WEIGHTS, frame);
  assert.ok(maxAbsDiff(actual.get('output'), expected.output) < 2e-14);
  assert.ok(maxAbsDiff(actual.get('heads.merged'), expected.merged) < 2e-14);
  assert.ok(maxAbsDiff(actual.get('attention.0.probabilities'), expected.attentions[0]) < 2e-14);
  assert.ok(maxAbsDiff(actual.get('attention.1.probabilities'), expected.attentions[1]) < 2e-14);
  for (const head of [0, 1]) {
    const context = graph.nodes.find((node) => node.id === `node:attention.${head}.context`);
    assert.equal(context.inputs[1], 'v.shared');
  }
  const kTranspose = graph.nodes.filter((node) => node.inputs.includes('k0.transpose'));
  assert.equal(kTranspose.length >= 2, true);
});

test('K08-O RoPE is applied independently inside every Q head and the shared K head', () => {
  for (const id of ['q0.rope.output', 'q1.rope.output', 'k0.rope.output']) assert.ok(graph.nodes.some((node) => node.output.id === id));
  const operations = new Set(graph.nodes.map((node) => node.operation));
  assert.deepEqual([...operations].filter((operation) => /gqa-special|multihead-special|attention-model|rope-special/i.test(operation)), []);
});

test('K08-O all projection parameters receive finite reverse-mode gradients', () => {
  assert.equal(gradients.gradients.length, 4);
  for (const id of ['wq', 'wk', 'wv', 'wo']) {
    const item = gradients.gradients.find((gradient) => gradient.parameter.tensorId === id);
    assert.ok(item, `missing gradient ${id}`);
    assert.equal(item.storage.data.every(Number.isFinite), true, `non-finite gradient ${id}`);
    assert.equal(item.storage.data.some((value) => Math.abs(value) > 1e-12), true, `zero gradient ${id}`);
  }
});

test('K08-O selected GQA gradients agree with central finite difference', () => {
  const epsilon = 1e-6;
  for (const [id, index] of [['wq', 0], ['wk', 1], ['wv', 2], ['wo', 3]]) {
    const plus = Object.fromEntries(Object.entries(WEIGHTS).map(([key, values]) => [key, [...values]]));
    const minus = Object.fromEntries(Object.entries(WEIGHTS).map(([key, values]) => [key, [...values]]));
    plus[id][index] += epsilon; minus[id][index] -= epsilon;
    const numeric = (oracle(plus, frame).loss - oracle(minus, frame).loss) / (2 * epsilon);
    const analytic = gradients.gradients.find((gradient) => gradient.parameter.tensorId === id).storage.data[index];
    assert.ok(Math.abs(analytic - numeric) < 3e-9, `${id}[${index}] ${analytic} vs ${numeric}`);
  }
});

test('K08-O profile validation admits MHA/GQA/RCL-1B head geometry and rejects invalid boundaries', () => {
  assert.deepEqual(validateProfile({ hiddenSize: 4, queryHeads: 2, kvHeads: 2, headDimension: 2 }), { queriesPerKv: 1, kvWidth: 4 });
  assert.deepEqual(validateProfile({ hiddenSize: 2048, queryHeads: 16, kvHeads: 4, headDimension: 128 }), { queriesPerKv: 4, kvWidth: 512 });
  assert.throws(() => validateProfile({ hiddenSize: 6, queryHeads: 3, kvHeads: 2, headDimension: 2 }), { code: 'RCL_GQA_HEAD_COUNTS' });
  assert.throws(() => validateProfile({ hiddenSize: 6, queryHeads: 2, kvHeads: 1, headDimension: 3 }), { code: 'RCL_GQA_HEAD_DIMENSION' });
  assert.throws(() => validateProfile({ hiddenSize: 5, queryHeads: 2, kvHeads: 1, headDimension: 2 }), { code: 'RCL_GQA_HIDDEN_WIDTH' });
});

test('K08-O model-special Tensor injection fails closed', () => {
  const forbidden = structuredClone(graph);
  forbidden.nodes.find((node) => node.id === 'node:heads.merged').operation = 'gqa-special';
  assert.equal(executeRequest(forbidden, false).code, 'RCL_TENSOR_OPERATION_UNSUPPORTED');
});

test('K08-O contract grants multi-head/GQA composition only and keeps multi-block/scale claims closed', () => {
  const contract = JSON.parse(fs.readFileSync(CONTRACT, 'utf8'));
  assert.equal(contract.format, 'rcl.k08-o.gqa-contract.v0.1'); assert.equal(contract.canonicalOwner, 'RCL');
  for (const claim of ['MULTI_HEAD_ATTENTION', 'GQA_COMPOSITION', 'ROPE_PER_HEAD_INTEGRATION']) assert.ok(contract.claimsGrantedOnAdmission.includes(claim));
  for (const claim of ['MULTI_BLOCK_LM', 'RCL_10M', 'BF16', 'GPU', 'DISTRIBUTED_TRAINING', 'RCL_1B_COMPLETE']) assert.ok(contract.claimsNotGranted.includes(claim));
});
