import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { compileRealityToBytecode } from '../src/bytecode.mjs';
import { runNativeBytecode, runNativeCompiler } from '../src/native-vm.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST = path.join(ROOT, 'native', 'tensor-engine', 'Cargo.toml');
const ADAMW = path.join(ROOT, 'native', 'tensor-engine', 'target', 'release', process.platform === 'win32' ? 'rcl-tensor-adamw.exe' : 'rcl-tensor-adamw');
const ROPE = path.join(ROOT, 'native', 'tensor-engine', 'target', 'release', process.platform === 'win32' ? 'rcl-rope-frame.exe' : 'rcl-rope-frame');
const SOURCE = path.join(ROOT, 'examples', 'native-ai', 'multiblock-adamw-genome.rcl');
const CONTRACT = path.join(ROOT, 'examples', 'native-ai', 'multiblock-adamw-contract.v0.1.json');

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
const CONFIG = Object.freeze({ learningRate: 0.01, beta1: 0.9, beta2: 0.999, epsilon: 1e-8, weightDecay: 0.01, gradientClip: 1 });

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

function parameterIds(blockCount) {
  const ids = ['tokenEmbedding'];
  for (let block = 0; block < blockCount; block += 1) {
    for (const suffix of ['wq', 'wk', 'wv', 'wo', 'w1', 'w2']) ids.push(`block.${block}.${suffix}`);
  }
  ids.push('lmHead');
  if (new Set(ids).size !== ids.length) throw Object.assign(new Error('duplicate parameter identity'), { code: 'RCL_MULTIBLOCK_PARAMETER_IDENTITY' });
  return ids;
}

function buildEngines() {
  const run = spawnSync('cargo', ['build', '--release', '--locked', '--manifest-path', MANIFEST, '--bin', 'rcl-tensor-adamw', '--bin', 'rcl-rope-frame'], {
    cwd: ROOT, encoding: 'utf8', timeout: 180_000, maxBuffer: 32 * 1024 * 1024,
  });
  if (run.status !== 0) throw new Error(run.stderr || run.stdout || 'RCL_K08_R_BUILD_FAILED');
}

function ropeFrame() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-k08-r-rope-'));
  const requestPath = path.join(directory, 'request.json');
  fs.writeFileSync(requestPath, JSON.stringify({ format: 'rcl.rope-position-frame-request.v0.1', sequenceLength: S, headDimension: D, base: 10000, positionOffset: 0, maxPositionExclusive: 8 }));
  const run = spawnSync(ROPE, [requestPath], { cwd: ROOT, encoding: 'utf8', timeout: 60_000, maxBuffer: 16 * 1024 * 1024 });
  fs.rmSync(directory, { recursive: true, force: true });
  if (run.status !== 0) throw new Error(run.stderr || run.stdout || 'RCL_K08_R_ROPE_FAILED');
  return JSON.parse(run.stdout.trim());
}

function executeAdamW(request, expectSuccess = true) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-k08-r-adamw-'));
  const requestPath = path.join(directory, 'request.json');
  fs.writeFileSync(requestPath, JSON.stringify(request));
  const run = spawnSync(ADAMW, [requestPath], { cwd: ROOT, encoding: 'utf8', timeout: 180_000, maxBuffer: 64 * 1024 * 1024 });
  fs.rmSync(directory, { recursive: true, force: true });
  if (run.error) throw run.error;
  if ((run.status === 0) !== expectSuccess) throw new Error(run.stderr || run.stdout || 'RCL_K08_R_EXECUTION_STATUS');
  const response = expectSuccess ? run.stdout : run.stderr;
  if (!response?.trim()) throw new Error('RCL_K08_R_EMPTY_RESPONSE');
  return JSON.parse(response.trim());
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

function buildGraph(blockCount, weights, frame) {
  const ids = parameterIds(blockCount);
  const b = new GraphBuilder({ campaign: 'K08-R', semanticOwner: 'RCL', blockCount, optimizer: 'AdamW', attention: 'K08-O-GQA', position: 'K08-N-RoPE' });
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
  b.node('loss', 'mul', ['negativeOne', meanLogProbability], []);
  b.graph.outputs = ['lm.logits', 'lm.probabilities', 'block.0.output', 'block.1.output', 'loss'];
  return b.graph;
}

function autodiffRequest(graph, ids) {
  return { format: 'rcl.tensor-autodiff-request.v0.1', graph, loss: 'loss', parameters: ids.map((tensorId) => ({ tensorId, gradientIdentity: `parameter:${tensorId}` })), stopGradients: [] };
}

function adamwRequest(graph, ids, steps, optimizerStates = []) {
  return { format: 'rcl.tensor-autodiff-adamw-training-request.v0.1', autodiff: autodiffRequest(graph, ids), steps, config: CONFIG, optimizerStates };
}

function exactF64Bits(values) {
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  return values.map((value) => {
    view.setFloat64(0, value, false);
    return view.getBigUint64(0, false).toString(16).padStart(16, '0');
  });
}

function applyParameters(graph, parameters) {
  const copy = structuredClone(graph);
  for (const trained of parameters) {
    const tensor = copy.tensors.find((item) => item.id === trained.tensor.id);
    assert.ok(tensor, `missing parameter ${trained.tensor.id}`);
    const storage = copy.storages.find((item) => item.identity === tensor.storageIdentity);
    assert.ok(storage, `missing storage ${tensor.storageIdentity}`);
    const oldIdentity = storage.identity;
    storage.identity = trained.storage.identity;
    storage.data = [...trained.storage.data];
    tensor.storageIdentity = trained.storage.identity;
    delete copy.exactStorageBits[oldIdentity];
    copy.exactStorageBits[trained.storage.identity] = exactF64Bits(trained.storage.data);
  }
  return copy;
}

function maxDifference(left, right) {
  assert.equal(left.length, right.length);
  return left.reduce((maximum, value, index) => Math.max(maximum, Math.abs(value - right[index])), 0);
}

let frame;
let weights;
let graph;
let ids;
let training;

test.before(() => {
  buildEngines();
  frame = ropeFrame();
  weights = makeWeights(2);
  ids = parameterIds(2);
  graph = buildGraph(2, weights, frame);
  training = executeAdamW(adamwRequest(graph, ids, 20));
});

test('K08-R RCL Multi-Block AdamW Genome self-hosts with byte-identical RBC and native semantic root', { timeout: 180_000 }, () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-k08-r-source-')); const rbc = path.join(directory, 'multiblock-adamw.rbc');
  const compiled = runNativeCompiler('selfhost/compiler.rbc', SOURCE, rbc, { timeout: 120_000, maxBuffer: 64 * 1024 * 1024 }); assert.equal(compiled.status, 'ok');
  assert.equal(fs.readFileSync(rbc).equals(Buffer.from(compileRealityToBytecode(fs.readFileSync(SOURCE, 'utf8')))), true);
  const run = runNativeBytecode(rbc, { timeout: 120_000, maxBuffer: 64 * 1024 * 1024, requireNativeStateRoot: true });
  assert.equal(run.stateRootVerified, true); assert.equal(run.state['evaluation.two_block_groups'], true); assert.equal(run.state['evaluation.two_block_valid'], true); assert.equal(run.state['evaluation.wrong_group_count_rejected'], true); assert.equal(run.state['evaluation.rcl1b_groups'], true);
  fs.rmSync(directory, { recursive: true, force: true });
});

test('K08-R two-block graph exposes fourteen unique trainable identities', () => {
  assert.equal(ids.length, 14); assert.equal(new Set(ids).size, 14);
  assert.equal(graph.tensors.filter((tensor) => tensor.gradientIdentity.startsWith('parameter:')).length, 14);
  assert.equal(ids.filter((id) => id.startsWith('block.0.')).length, 6);
  assert.equal(ids.filter((id) => id.startsWith('block.1.')).length, 6);
});

test('K08-R Tensor AdamW lowers the two-block GQA+RoPE LM and reduces next-token loss', { timeout: 180_000 }, () => {
  assert.equal(training.status, 'ok');
  assert.equal(training.parameters.length, 14);
  assert.equal(training.optimizerStates.length, 14);
  assert.ok(Number.isFinite(training.initialLoss) && Number.isFinite(training.finalLoss));
  assert.ok(training.finalLoss < training.initialLoss, `loss did not decrease: ${training.initialLoss} -> ${training.finalLoss}`);
});

test('K08-R every model and block parameter updates and owns a finite AdamW state', () => {
  const states = new Map(training.optimizerStates.map((state) => [state.tensorId, state]));
  assert.equal(states.size, 14);
  for (const parameter of training.parameters) {
    const id = parameter.tensor.id;
    assert.ok(weights[id], `unexpected parameter ${id}`);
    assert.ok(maxDifference(parameter.storage.data, weights[id]) > 0, `parameter did not update: ${id}`);
    const state = states.get(id);
    assert.ok(state, `missing optimizer state ${id}`);
    assert.equal(state.step, 20);
    assert.equal(state.firstMoment.every(Number.isFinite), true);
    assert.equal(state.secondMoment.every(Number.isFinite), true);
    assert.equal(state.firstMoment.length, weights[id].length);
    assert.equal(state.secondMoment.length, weights[id].length);
  }
});

test('K08-R direct AdamW continuation equals checkpoint plus resume exactly', { timeout: 180_000 }, () => {
  const direct = executeAdamW(adamwRequest(graph, ids, 4));
  const first = executeAdamW(adamwRequest(graph, ids, 2));
  const resumedGraph = applyParameters(graph, first.parameters);
  const resumed = executeAdamW(adamwRequest(resumedGraph, ids, 2, first.optimizerStates));
  assert.deepEqual(resumed.parameters, direct.parameters);
  assert.deepEqual(resumed.optimizerStates, direct.optimizerStates);
  assert.equal(resumed.checkpointRoot, direct.checkpointRoot);
  assert.equal(resumed.finalLoss, direct.finalLoss);
});

test('K08-R frozen CPU-f64 multi-block AdamW replay is deterministic', { timeout: 180_000 }, () => {
  const first = executeAdamW(adamwRequest(graph, ids, 4));
  const second = executeAdamW(adamwRequest(graph, ids, 4));
  assert.equal(second.checkpointRoot, first.checkpointRoot);
  assert.equal(second.finalLoss, first.finalLoss);
  assert.deepEqual(second.parameters, first.parameters);
  assert.deepEqual(second.optimizerStates, first.optimizerStates);
});

test('K08-R malformed optimizer state fails closed instead of rebinding silently', () => {
  const invalid = ids.map((tensorId) => ({ tensorId, step: 0, firstMoment: new Array(weights[tensorId].length).fill(0), secondMoment: new Array(weights[tensorId].length).fill(0) }));
  invalid.find((state) => state.tensorId === 'tokenEmbedding').firstMoment = [];
  const result = executeAdamW(adamwRequest(graph, ids, 1, invalid), false);
  assert.equal(result.code, 'RCL_ADAMW_STATE_SHAPE');
});

test('K08-R training remains generic Tensor Autodiff plus AdamW with no model-special optimizer opcode', () => {
  const operations = new Set(graph.nodes.map((node) => node.operation));
  assert.deepEqual([...operations].filter((operation) => /adamw-special|multiblock-adamw|optimizer-model-special/i.test(operation)), []);
  const contract = JSON.parse(fs.readFileSync(CONTRACT, 'utf8'));
  assert.equal(contract.format, 'rcl.k08-r.multiblock-adamw-contract.v0.1');
  for (const claim of ['MULTI_BLOCK_ADAMW_TRAINING_REPLAY', 'MULTI_BLOCK_OPTIMIZER_STATE_BINDING', 'MULTI_BLOCK_CHECKPOINT_RESUME']) assert.ok(contract.claimsGrantedOnAdmission.includes(claim));
  for (const claim of ['BF16_AUTODIFF_TRAINING', 'MULTI_BLOCK_BF16_TRAINING', 'GPU', 'RCL_10M', 'DISTRIBUTED_TRAINING', 'RCL_1B_COMPLETE']) assert.ok(contract.claimsNotGranted.includes(claim));
});
