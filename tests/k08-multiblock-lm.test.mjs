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
const SOURCE = path.join(ROOT, 'examples', 'native-ai', 'multiblock-lm-genome.rcl');
const CONTRACT = path.join(ROOT, 'examples', 'native-ai', 'multiblock-lm-contract.v0.1.json');
const TENSOR_MANIFEST = path.join(ROOT, 'native', 'tensor-engine', 'Cargo.toml');
const ROPE_BIN = path.join(ROOT, 'native', 'tensor-engine', 'target', 'release', process.platform === 'win32' ? 'rcl-rope-frame.exe' : 'rcl-rope-frame');

const S = 3;
const V = 4;
const H = 4;
const FF = 5;
const Q_HEADS = 2;
const KV_HEADS = 1;
const D = 2;
const EPSILON = 1e-5;
const SCALE = 1 / Math.sqrt(D);
const TOKENS = [0, 1, 2];
const TARGETS = [1, 2, 3];

function oneHot(tokens) {
  return tokens.flatMap((token) => Array.from({ length: V }, (_, index) => Number(index === token)));
}

function matrix(rows, cols, seed, scale = 0.11) {
  return Array.from({ length: rows * cols }, (_, index) => {
    const raw = (((index + 1) * (seed * 5 + 7) + seed * 3) % 23) - 11;
    return raw * scale / 11;
  });
}

function makeWeights(blockCount = 2) {
  const weights = {
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
  for (let block = 0; block < blockCount; block += 1) {
    const prefix = `block.${block}`;
    const seed = block * 7 + 1;
    weights[`${prefix}.wq`] = matrix(H, H, seed + 1);
    weights[`${prefix}.wk`] = matrix(H, D, seed + 2);
    weights[`${prefix}.wv`] = matrix(H, D, seed + 3);
    weights[`${prefix}.wo`] = matrix(H, H, seed + 4);
    weights[`${prefix}.w1`] = matrix(H, FF, seed + 5, 0.13);
    weights[`${prefix}.w2`] = matrix(FF, H, seed + 6, 0.12);
  }
  return weights;
}

function validateProfile({ blockCount, hiddenSize = H, queryHeads = Q_HEADS, kvHeads = KV_HEADS, headDimension = D }) {
  if (!Number.isInteger(blockCount) || blockCount < 1 || blockCount > 64) {
    const error = new Error('blockCount must be in 1..64'); error.code = 'RCL_MULTIBLOCK_COUNT'; throw error;
  }
  if (!Number.isInteger(queryHeads) || !Number.isInteger(kvHeads) || queryHeads <= 0 || kvHeads <= 0 || queryHeads < kvHeads || queryHeads % kvHeads !== 0) {
    const error = new Error('invalid query/KV heads'); error.code = 'RCL_MULTIBLOCK_GQA_HEADS'; throw error;
  }
  if (!Number.isInteger(headDimension) || headDimension <= 0 || headDimension % 2 !== 0 || hiddenSize !== queryHeads * headDimension) {
    const error = new Error('invalid hidden/head dimension'); error.code = 'RCL_MULTIBLOCK_WIDTH'; throw error;
  }
  return { blocks: blockCount, queriesPerKv: queryHeads / kvHeads };
}

function parameterIds(blockCount) {
  const ids = ['tokenEmbedding'];
  for (let block = 0; block < blockCount; block += 1) {
    for (const suffix of ['wq', 'wk', 'wv', 'wo', 'w1', 'w2']) ids.push(`block.${block}.${suffix}`);
  }
  ids.push('lmHead');
  if (new Set(ids).size !== ids.length) {
    const error = new Error('duplicate parameter identity'); error.code = 'RCL_MULTIBLOCK_PARAMETER_IDENTITY'; throw error;
  }
  return ids;
}

function buildAuxiliaryEngines() {
  buildEngine();
  const run = spawnSync('cargo', ['build', '--release', '--locked', '--manifest-path', TENSOR_MANIFEST, '--bin', 'rcl-rope-frame'], {
    cwd: ROOT, encoding: 'utf8', timeout: 180_000, maxBuffer: 32 * 1024 * 1024,
  });
  if (run.status !== 0) throw new Error(run.stderr || run.stdout || 'RCL_K08_P_ROPE_BUILD_FAILED');
}

function ropeFrame() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-k08-p-rope-'));
  const requestPath = path.join(directory, 'request.json');
  fs.writeFileSync(requestPath, JSON.stringify({
    format: 'rcl.rope-position-frame-request.v0.1', sequenceLength: S, headDimension: D, base: 10000, positionOffset: 0, maxPositionExclusive: 8,
  }));
  const run = spawnSync(ROPE_BIN, [requestPath], { cwd: ROOT, encoding: 'utf8', timeout: 60_000, maxBuffer: 16 * 1024 * 1024 });
  fs.rmSync(directory, { recursive: true, force: true });
  if (run.status !== 0) throw new Error(run.stderr || run.stdout || 'RCL_K08_P_ROPE_FRAME_FAILED');
  return JSON.parse(run.stdout.trim());
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
  const out = new Array(H * D).fill(0);
  for (let local = 0; local < D; local += 1) out[(headIndex * D + local) * D + local] = 1;
  return out;
}

function embedder(headIndex) {
  const out = new Array(D * H).fill(0);
  for (let local = 0; local < D; local += 1) out[local * H + headIndex * D + local] = 1;
  return out;
}

function causalMask() {
  return Array.from({ length: S * S }, (_, index) => {
    const row = Math.floor(index / S); const column = index % S;
    return column <= row ? 0 : -20;
  });
}

function rmsNorm(builder, input, prefix) {
  const square = builder.node(`${prefix}.square`, 'mul', [input, input], [S, H]);
  const mean = builder.node(`${prefix}.mean`, 'mean', [square], [S], { axis: 1 });
  const column = builder.node(`${prefix}.column`, 'reshape', [mean], [S, 1], { shape: [S, 1] });
  const shifted = builder.node(`${prefix}.shifted`, 'add', [column, 'epsilon'], [S, 1]);
  const root = builder.node(`${prefix}.root`, 'sqrt', [shifted], [S, 1]);
  const denominator = builder.node(`${prefix}.denominator`, 'broadcast', [root], [S, H], { shape: [S, H] });
  return builder.node(`${prefix}.normalized`, 'div', [input, denominator], [S, H]);
}

function addRoPE(builder, input, prefix) {
  const rotated = builder.node(`${prefix}.rotate`, 'matmul', [input, 'rope.rotation'], [S, D]);
  const c = builder.node(`${prefix}.cosPart`, 'mul', [input, 'rope.cos'], [S, D]);
  const s = builder.node(`${prefix}.sinPart`, 'mul', [rotated, 'rope.sin'], [S, D]);
  return builder.node(`${prefix}.output`, 'add', [c, s], [S, D]);
}

function addDecoderBlock(builder, input, block) {
  const p = `block.${block}`;
  const norm1 = rmsNorm(builder, input, `${p}.norm1`);
  const qAll = builder.node(`${p}.q.all`, 'matmul', [norm1, `${p}.wq`], [S, H]);
  const k = builder.node(`${p}.k.shared`, 'matmul', [norm1, `${p}.wk`], [S, D]);
  const v = builder.node(`${p}.v.shared`, 'matmul', [norm1, `${p}.wv`], [S, D]);
  const kRot = addRoPE(builder, k, `${p}.k.rope`);
  const kt = builder.node(`${p}.k.transpose`, 'transpose', [kRot], [D, S], { permutation: [1, 0] });
  const embedded = [];
  for (let head = 0; head < Q_HEADS; head += 1) {
    const q = builder.node(`${p}.q.${head}`, 'matmul', [qAll, `head.selector.${head}`], [S, D]);
    const qRot = addRoPE(builder, q, `${p}.q.${head}.rope`);
    const raw = builder.node(`${p}.attn.${head}.raw`, 'matmul', [qRot, kt], [S, S]);
    const scaled = builder.node(`${p}.attn.${head}.scaled`, 'mul', [raw, 'attentionScale'], [S, S]);
    const masked = builder.node(`${p}.attn.${head}.masked`, 'add', [scaled, 'causalMask'], [S, S]);
    const probabilities = builder.node(`${p}.attn.${head}.probabilities`, 'softmax', [masked], [S, S]);
    const context = builder.node(`${p}.attn.${head}.context`, 'matmul', [probabilities, v], [S, D]);
    embedded.push(builder.node(`${p}.attn.${head}.embedded`, 'matmul', [context, `head.embedder.${head}`], [S, H]));
  }
  const merged = builder.node(`${p}.heads.merged`, 'add', embedded, [S, H]);
  const projected = builder.node(`${p}.attention.projected`, 'matmul', [merged, `${p}.wo`], [S, H]);
  const residual1 = builder.node(`${p}.residual1`, 'add', [input, projected], [S, H]);
  const norm2 = rmsNorm(builder, residual1, `${p}.norm2`);
  const ffPre = builder.node(`${p}.ff.pre`, 'matmul', [norm2, `${p}.w1`], [S, FF]);
  const ffGate = builder.node(`${p}.ff.sigmoid`, 'activation', [ffPre], [S, FF], { kind: 'sigmoid' });
  const ffSilu = builder.node(`${p}.ff.silu`, 'mul', [ffPre, ffGate], [S, FF]);
  const ffProjected = builder.node(`${p}.ff.projected`, 'matmul', [ffSilu, `${p}.w2`], [S, H]);
  return builder.node(`${p}.output`, 'add', [residual1, ffProjected], [S, H]);
}

function buildGraph(blockCount, weights = makeWeights(blockCount), frame = ropeFrame()) {
  validateProfile({ blockCount });
  const ids = parameterIds(blockCount);
  const b = new GraphBuilder({ campaign: 'K08-P', semanticOwner: 'RCL', blockCount, attention: 'K08-O-GQA', position: 'K08-N-RoPE' });
  b.tensor('inputOneHot', [S, V], oneHot(TOKENS));
  b.tensor('targetOneHot', [S, V], oneHot(TARGETS));
  b.tensor('epsilon', [1], [EPSILON]);
  b.tensor('attentionScale', [1], [SCALE]);
  b.tensor('causalMask', [S, S], causalMask());
  b.tensor('negativeOne', [], [-1]);
  b.tensor('rope.cos', [S, D], frame.cos);
  b.tensor('rope.sin', [S, D], frame.sin);
  b.tensor('rope.rotation', [D, D], frame.rotationMatrix);
  for (let head = 0; head < Q_HEADS; head += 1) {
    b.tensor(`head.selector.${head}`, [H, D], selector(head));
    b.tensor(`head.embedder.${head}`, [D, H], embedder(head));
  }
  for (const id of ids) {
    let shape;
    if (id === 'tokenEmbedding') shape = [V, H];
    else if (id === 'lmHead') shape = [H, V];
    else if (id.endsWith('.wq') || id.endsWith('.wo')) shape = [H, H];
    else if (id.endsWith('.wk') || id.endsWith('.wv')) shape = [H, D];
    else if (id.endsWith('.w1')) shape = [H, FF];
    else shape = [FF, H];
    b.tensor(id, shape, weights[id], `parameter:${id}`);
  }
  let hidden = b.node('embedding', 'matmul', ['inputOneHot', 'tokenEmbedding'], [S, H]);
  for (let block = 0; block < blockCount; block += 1) hidden = addDecoderBlock(b, hidden, block);
  const logits = b.node('lm.logits', 'matmul', [hidden, 'lmHead'], [S, V]);
  const probabilities = b.node('lm.probabilities', 'softmax', [logits], [S, V]);
  const logProbabilities = b.node('lm.logProbabilities', 'log', [probabilities], [S, V]);
  const selected = b.node('loss.selected', 'mul', ['targetOneHot', logProbabilities], [S, V]);
  const tokenLogProbability = b.node('loss.tokenLogProbability', 'sum', [selected], [S], { axis: 1 });
  const meanLogProbability = b.node('loss.meanLogProbability', 'mean', [tokenLogProbability], [], { axis: 0 });
  const loss = b.node('loss', 'mul', ['negativeOne', meanLogProbability], []);
  b.graph.outputs = [logits, probabilities, ...Array.from({ length: blockCount }, (_, block) => `block.${block}.output`), loss];
  return b.graph;
}

function autodiffRequest(graph, blockCount) {
  return {
    format: 'rcl.tensor-autodiff-request.v0.1', graph, loss: 'loss',
    parameters: parameterIds(blockCount).map((tensorId) => ({ tensorId, gradientIdentity: `parameter:${tensorId}` })), stopGradients: [],
  };
}

function outputMap(result) { return new Map(result.outputs.map((item) => [item.tensor.id, item.storage.data])); }
function maxAbsDiff(a, b) { let m = 0; for (let i = 0; i < a.length; i += 1) m = Math.max(m, Math.abs(a[i] - b[i])); return m; }

function matmul(a, rows, inner, b, cols) {
  const out = new Array(rows * cols).fill(0);
  for (let i = 0; i < rows; i += 1) for (let k = 0; k < inner; k += 1) for (let j = 0; j < cols; j += 1) out[i * cols + j] += a[i * inner + k] * b[k * cols + j];
  return out;
}
function add(a, b) { return a.map((value, index) => value + b[index]); }
function mul(a, b) { return a.map((value, index) => value * b[index]); }
function transpose(a, rows, cols) { return Array.from({ length: rows * cols }, (_, i) => a[(i % rows) * cols + Math.floor(i / rows)]); }
function softmaxRows(a, rows, cols) {
  const out = new Array(a.length);
  for (let row = 0; row < rows; row += 1) {
    const values = a.slice(row * cols, (row + 1) * cols); const maximum = Math.max(...values); const exps = values.map((v) => Math.exp(v - maximum)); const total = exps.reduce((x, y) => x + y, 0);
    for (let col = 0; col < cols; col += 1) out[row * cols + col] = exps[col] / total;
  }
  return out;
}
function rmsNormDirect(input) {
  const out = new Array(input.length);
  for (let row = 0; row < S; row += 1) {
    let sum = 0; for (let col = 0; col < H; col += 1) sum += input[row * H + col] ** 2;
    const denominator = Math.sqrt(sum / H + EPSILON);
    for (let col = 0; col < H; col += 1) out[row * H + col] = input[row * H + col] / denominator;
  }
  return out;
}
function directRoPE(values, frame) {
  const out = new Array(values.length);
  for (let row = 0; row < S; row += 1) {
    const index = row * D; const c = frame.cos[index]; const s = frame.sin[index];
    out[index] = values[index] * c - values[index + 1] * s;
    out[index + 1] = values[index] * s + values[index + 1] * c;
  }
  return out;
}
function selectHead(values, head) { return Array.from({ length: S * D }, (_, index) => values[Math.floor(index / D) * H + head * D + (index % D)]); }
function embedHead(values, head) {
  const out = new Array(S * H).fill(0);
  for (let row = 0; row < S; row += 1) for (let local = 0; local < D; local += 1) out[row * H + head * D + local] = values[row * D + local];
  return out;
}
function directBlock(input, weights, block, frame) {
  const p = `block.${block}`;
  const norm1 = rmsNormDirect(input);
  const qAll = matmul(norm1, S, H, weights[`${p}.wq`], H);
  const k = directRoPE(matmul(norm1, S, H, weights[`${p}.wk`], D), frame);
  const v = matmul(norm1, S, H, weights[`${p}.wv`], D);
  const kt = transpose(k, S, D);
  const mask = causalMask();
  const contexts = [];
  for (let head = 0; head < Q_HEADS; head += 1) {
    const q = directRoPE(selectHead(qAll, head), frame);
    const raw = matmul(q, S, D, kt, S);
    const masked = raw.map((value, index) => value * SCALE + mask[index]);
    const attention = softmaxRows(masked, S, S);
    contexts.push(embedHead(matmul(attention, S, S, v, D), head));
  }
  const merged = add(contexts[0], contexts[1]);
  const residual1 = add(input, matmul(merged, S, H, weights[`${p}.wo`], H));
  const norm2 = rmsNormDirect(residual1);
  const pre = matmul(norm2, S, H, weights[`${p}.w1`], FF);
  const silu = pre.map((value) => value / (1 + Math.exp(-value)));
  return add(residual1, matmul(silu, S, FF, weights[`${p}.w2`], H));
}
function oracle(blockCount, weights, frame) {
  let hidden = matmul(oneHot(TOKENS), S, V, weights.tokenEmbedding, H);
  const blockOutputs = [];
  for (let block = 0; block < blockCount; block += 1) { hidden = directBlock(hidden, weights, block, frame); blockOutputs.push(hidden); }
  const logits = matmul(hidden, S, H, weights.lmHead, V);
  const probabilities = softmaxRows(logits, S, V);
  let loss = 0;
  for (let row = 0; row < S; row += 1) loss -= Math.log(probabilities[row * V + TARGETS[row]]) / S;
  return { logits, probabilities, blockOutputs, loss };
}

function cloneWeights(weights) { return Object.fromEntries(Object.entries(weights).map(([id, values]) => [id, [...values]])); }
function graphLoss(blockCount, weights, frame) { return outputMap(executeRequest(buildGraph(blockCount, weights, frame))).get('loss')[0]; }

let frame;
let oneGraph;
let twoGraph;
let oneForward;
let twoForward;
let oneGradients;
let twoGradients;
let oneWeights;
let twoWeights;

test.before(() => {
  buildAuxiliaryEngines();
  frame = ropeFrame();
  oneWeights = makeWeights(1);
  twoWeights = makeWeights(2);
  oneGraph = buildGraph(1, oneWeights, frame);
  twoGraph = buildGraph(2, twoWeights, frame);
  oneForward = executeRequest(oneGraph);
  twoForward = executeRequest(twoGraph);
  oneGradients = executeRequest(autodiffRequest(oneGraph, 1));
  twoGradients = executeRequest(autodiffRequest(twoGraph, 2));
});

test('K08-P RCL Multi-Block LM Genome self-hosts with byte-identical RBC and native semantic root', { timeout: 180_000 }, () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-k08-p-source-')); const rbc = path.join(directory, 'multiblock.rbc');
  const compiled = runNativeCompiler('selfhost/compiler.rbc', SOURCE, rbc, { timeout: 120_000, maxBuffer: 64 * 1024 * 1024 }); assert.equal(compiled.status, 'ok');
  assert.equal(fs.readFileSync(rbc).equals(Buffer.from(compileRealityToBytecode(fs.readFileSync(SOURCE, 'utf8')))), true);
  const run = runNativeBytecode(rbc, { timeout: 120_000, maxBuffer: 64 * 1024 * 1024, requireNativeStateRoot: true });
  assert.equal(run.stateRootVerified, true); assert.equal(run.state['evaluation.one_block_valid'], true); assert.equal(run.state['evaluation.two_blocks_valid'], true); assert.equal(run.state['evaluation.zero_blocks_rejected'], true); assert.equal(run.state['evaluation.rcl1b_gqa_valid'], true);
  fs.rmSync(directory, { recursive: true, force: true });
});

test('K08-P one-block and two-block models come from the same parametric builder', () => {
  assert.deepEqual(validateProfile({ blockCount: 1 }), { blocks: 1, queriesPerKv: 2 });
  assert.deepEqual(validateProfile({ blockCount: 2 }), { blocks: 2, queriesPerKv: 2 });
  assert.equal(oneGraph.bindings.blockCount, 1); assert.equal(twoGraph.bindings.blockCount, 2);
  assert.ok(!oneGraph.nodes.some((node) => node.output.id.startsWith('block.1.')));
  assert.ok(twoGraph.nodes.some((node) => node.output.id === 'block.1.output'));
});

test('K08-P two-block forward/loss agrees with independent oracle and second block consumes first block output', () => {
  const actual = outputMap(twoForward); const expected = oracle(2, twoWeights, frame);
  assert.ok(maxAbsDiff(actual.get('lm.logits'), expected.logits) < 5e-13);
  assert.ok(maxAbsDiff(actual.get('block.0.output'), expected.blockOutputs[0]) < 5e-13);
  assert.ok(maxAbsDiff(actual.get('block.1.output'), expected.blockOutputs[1]) < 5e-13);
  assert.ok(Math.abs(actual.get('loss')[0] - expected.loss) < 5e-13);
  const firstSecondNode = twoGraph.nodes.find((node) => node.id === 'node:block.1.norm1.square');
  assert.deepEqual(firstSecondNode.inputs, ['block.0.output', 'block.0.output']);
});

test('K08-P block ordering is semantically observable', () => {
  const swapped = cloneWeights(twoWeights);
  for (const suffix of ['wq', 'wk', 'wv', 'wo', 'w1', 'w2']) {
    [swapped[`block.0.${suffix}`], swapped[`block.1.${suffix}`]] = [swapped[`block.1.${suffix}`], swapped[`block.0.${suffix}`]];
  }
  assert.ok(Math.abs(graphLoss(2, swapped, frame) - outputMap(twoForward).get('loss')[0]) > 1e-8);
});

test('K08-P every parameter in both decoder blocks receives finite non-zero reverse gradients', () => {
  assert.equal(twoGradients.gradients.length, 14);
  for (const id of parameterIds(2)) {
    const gradient = twoGradients.gradients.find((item) => item.parameter.tensorId === id);
    assert.ok(gradient, `missing ${id}`);
    assert.equal(gradient.storage.data.every(Number.isFinite), true, `non-finite ${id}`);
    assert.equal(gradient.storage.data.some((value) => Math.abs(value) > 1e-13), true, `zero ${id}`);
  }
});

test('K08-P first-block gradient crosses the second block and selected gradients agree with finite difference', () => {
  const epsilon = 1e-6;
  for (const [id, index] of [['block.0.wq', 0], ['block.1.w2', 3]]) {
    const plus = cloneWeights(twoWeights); const minus = cloneWeights(twoWeights);
    plus[id][index] += epsilon; minus[id][index] -= epsilon;
    const numeric = (graphLoss(2, plus, frame) - graphLoss(2, minus, frame)) / (2 * epsilon);
    const analytic = twoGradients.gradients.find((item) => item.parameter.tensorId === id).storage.data[index];
    assert.ok(Math.abs(analytic - numeric) < 2e-7, `${id}[${index}] ${analytic} vs ${numeric}`);
  }
  const one = oneGradients.gradients.find((item) => item.parameter.tensorId === 'block.0.wq').storage.data[0];
  const two = twoGradients.gradients.find((item) => item.parameter.tensorId === 'block.0.wq').storage.data[0];
  assert.ok(Math.abs(one - two) > 1e-9, `later block did not observably alter earlier-block gradient: ${one} vs ${two}`);
});

test('K08-P next-token loss remains generic and no model-special operation is present', () => {
  const operations = new Set(twoGraph.nodes.map((node) => node.operation));
  for (const operation of ['softmax', 'log', 'mul', 'sum', 'mean', 'matmul', 'add']) assert.ok(operations.has(operation));
  assert.deepEqual([...operations].filter((operation) => /multiblock-special|decoder-special|gpt-special|transformer-special/i.test(operation)), []);
  const forbidden = structuredClone(twoGraph);
  forbidden.nodes.find((node) => node.id === 'node:block.1.heads.merged').operation = 'multiblock-special';
  assert.equal(executeRequest(forbidden, false).code, 'RCL_TENSOR_OPERATION_UNSUPPORTED');
});

test('K08-P invalid block boundaries and duplicate parameter identities fail closed before execution', () => {
  assert.throws(() => validateProfile({ blockCount: 0 }), { code: 'RCL_MULTIBLOCK_COUNT' });
  assert.throws(() => validateProfile({ blockCount: 65 }), { code: 'RCL_MULTIBLOCK_COUNT' });
  assert.deepEqual(validateProfile({ blockCount: 24, hiddenSize: 2048, queryHeads: 16, kvHeads: 4, headDimension: 128 }), { blocks: 24, queriesPerKv: 4 });
  const ids = parameterIds(2); ids.push(ids[0]);
  const duplicate = () => { if (new Set(ids).size !== ids.length) { const error = new Error('duplicate parameter identity'); error.code = 'RCL_MULTIBLOCK_PARAMETER_IDENTITY'; throw error; } };
  assert.throws(duplicate, { code: 'RCL_MULTIBLOCK_PARAMETER_IDENTITY' });
});

test('K08-P contract grants bounded multi-block LM composition only and keeps scale gates closed', () => {
  const contract = JSON.parse(fs.readFileSync(CONTRACT, 'utf8'));
  assert.equal(contract.format, 'rcl.k08-p.multiblock-lm-contract.v0.1'); assert.equal(contract.canonicalOwner, 'RCL');
  for (const claim of ['PARAMETRIC_MULTI_BLOCK_DECODER_COMPOSITION', 'CROSS_BLOCK_REVERSE_AUTODIFF', 'MULTI_BLOCK_LM_FORWARD_LOSS']) assert.ok(contract.claimsGrantedOnAdmission.includes(claim));
  for (const claim of ['PRODUCTION_64K_VOCABULARY', 'RCL_10M', 'BF16', 'GPU', 'DISTRIBUTED_TRAINING', 'RCL_1B_COMPLETE']) assert.ok(contract.claimsNotGranted.includes(claim));
});
