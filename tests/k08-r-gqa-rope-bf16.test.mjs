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
const ENGINE = path.join(ROOT, 'native', 'tensor-engine', 'target', 'release', process.platform === 'win32' ? 'rcl-bf16-autodiff-adamw.exe' : 'rcl-bf16-autodiff-adamw');
const ROPE = path.join(ROOT, 'native', 'tensor-engine', 'target', 'release', process.platform === 'win32' ? 'rcl-rope-frame.exe' : 'rcl-rope-frame');
const SOURCE = path.join(ROOT, 'examples', 'native-ai', 'bf16-gqa-rope-multiblock-genome.rcl');
const CONTRACT = path.join(ROOT, 'examples', 'native-ai', 'bf16-gqa-rope-multiblock-contract.v0.1.json');

const S = 3; const V = 4; const H = 4; const FF = 5; const Q_HEADS = 2; const D = 2;
const EPSILON = 1e-5; const SCALE = 1 / Math.sqrt(D); const TOKENS = [0, 1, 2]; const TARGETS = [1, 2, 3];
const IDS = ['tokenEmbedding', 'block.0.wq', 'block.0.wk', 'block.0.wv', 'block.0.wo', 'block.0.w1', 'block.0.w2', 'block.1.wq', 'block.1.wk', 'block.1.wv', 'block.1.wo', 'block.1.w1', 'block.1.w2', 'lmHead'];
const CONFIG = Object.freeze({ learningRate: 0.01, beta1: 0.9, beta2: 0.999, epsilon: 1e-8, weightDecay: 0.01, gradientClip: 1 });
const view = new DataView(new ArrayBuffer(4));

function f32(value) { view.setFloat32(0, Math.fround(value), false); return view.getFloat32(0, false); }
function exactBits(value) { view.setFloat32(0, f32(value), false); return view.getUint32(0, false).toString(16).padStart(8, '0'); }
function bf16Bits(value) { const bits = view.getUint32(0, (view.setFloat32(0, f32(value), false), false)); return ((bits + 0x7fff + ((bits >>> 16) & 1)) >>> 16) & 0xffff; }
function q(value) { return view.getFloat32(0, (view.setUint32(0, (bf16Bits(value) << 16) >>> 0, false), false)); }

function matrix(rows, columns, seed, scale = 0.11) {
  return Array.from({ length: rows * columns }, (_, index) => ((((index + 1) * (seed * 5 + 7) + seed * 3) % 23) - 11) * scale / 11);
}

function weights() {
  const result = {
    tokenEmbedding: [0.90, 0.02, -0.01, 0.03, 0.01, 0.92, 0.02, -0.02, -0.02, 0.01, 0.91, 0.03, 0.03, -0.01, 0.02, 0.89],
    lmHead: [0.05, 0.36, -0.08, 0.02, -0.02, 0.04, 0.34, -0.07, -0.06, -0.01, 0.03, 0.35, 0.33, -0.05, 0.01, 0.04],
  };
  for (let block = 0; block < 2; block += 1) {
    const prefix = `block.${block}`; const seed = block * 7 + 1;
    result[`${prefix}.wq`] = matrix(H, H, seed + 1); result[`${prefix}.wk`] = matrix(H, D, seed + 2); result[`${prefix}.wv`] = matrix(H, D, seed + 3);
    result[`${prefix}.wo`] = matrix(H, H, seed + 4); result[`${prefix}.w1`] = matrix(H, FF, seed + 5, 0.13); result[`${prefix}.w2`] = matrix(FF, H, seed + 6, 0.12);
  }
  return result;
}

function selector(head) { const result = new Array(H * D).fill(0); for (let local = 0; local < D; local += 1) result[(head * D + local) * D + local] = 1; return result; }
function embedder(head) { const result = new Array(D * H).fill(0); for (let local = 0; local < D; local += 1) result[local * H + head * D + local] = 1; return result; }
function causalMask() { return Array.from({ length: S * S }, (_, index) => Number(index % S <= Math.floor(index / S) ? 0 : -20)); }
function tensor(id, shape, storageIdentity, gradientIdentity = `derived:${id}`) { return { id, shape, dtype: 'bf16', layout: 'row-major', device: 'cpu', gradientIdentity, storageIdentity }; }
function output(id, shape) { return { id, shape, dtype: 'bf16', layout: 'row-major', device: 'cpu', gradientIdentity: `derived:${id}` }; }

class GraphBuilder {
  constructor() { this.graph = { format: 'rcl.tensor-execution-plan.v0.1', bindings: { semanticOwner: 'RCL', campaign: 'K08-R-BF16', precisionPolicy: 'bf16-rne-fp32-accumulation' }, tensors: [], storages: [], exactF32StorageBits: {}, nodes: [], outputs: [] }; }
  tensor(id, shape, data, parameter = false) {
    const storageIdentity = `storage:${id}`; this.graph.tensors.push(tensor(id, shape, storageIdentity, parameter ? `parameter:${id}` : `derived:${id}`));
    this.graph.storages.push({ identity: storageIdentity, kind: 'cpu-dense', data: [...data] }); if (parameter) this.graph.exactF32StorageBits[storageIdentity] = data.map(exactBits); return id;
  }
  node(id, operation, inputs, shape, attributes = {}) { this.graph.nodes.push({ id: `node:${id}`, operation, inputs, output: output(id, shape), attributes }); return id; }
}

function rmsNorm(builder, input, prefix) {
  const square = builder.node(`${prefix}.square`, 'mul', [input, input], [S, H]); const mean = builder.node(`${prefix}.mean`, 'mean', [square], [S], { axis: 1 });
  const column = builder.node(`${prefix}.column`, 'reshape', [mean], [S, 1], { shape: [S, 1] }); const shifted = builder.node(`${prefix}.shifted`, 'add', [column, 'epsilon'], [S, 1]);
  const root = builder.node(`${prefix}.root`, 'sqrt', [shifted], [S, 1]); const denominator = builder.node(`${prefix}.denominator`, 'broadcast', [root], [S, H], { shape: [S, H] });
  return builder.node(`${prefix}.normalized`, 'div', [input, denominator], [S, H]);
}

function addRoPE(builder, input, prefix) {
  const rotated = builder.node(`${prefix}.rotate`, 'matmul', [input, 'rope.rotation'], [S, D]); const c = builder.node(`${prefix}.cosPart`, 'mul', [input, 'rope.cos'], [S, D]);
  const s = builder.node(`${prefix}.sinPart`, 'mul', [rotated, 'rope.sin'], [S, D]); return builder.node(`${prefix}.output`, 'add', [c, s], [S, D]);
}

function addBlock(builder, input, block) {
  const p = `block.${block}`; const norm = rmsNorm(builder, input, `${p}.norm`); const qAll = builder.node(`${p}.q.all`, 'matmul', [norm, `${p}.wq`], [S, H]);
  const key = builder.node(`${p}.k`, 'matmul', [norm, `${p}.wk`], [S, D]); const value = builder.node(`${p}.v`, 'matmul', [norm, `${p}.wv`], [S, D]);
  const kRot = addRoPE(builder, key, `${p}.k.rope`); const kt = builder.node(`${p}.k.transpose`, 'transpose', [kRot], [D, S], { permutation: [1, 0] }); const heads = [];
  for (let head = 0; head < Q_HEADS; head += 1) {
    const qHead = builder.node(`${p}.q.${head}`, 'matmul', [qAll, `head.selector.${head}`], [S, D]); const qRot = addRoPE(builder, qHead, `${p}.q.${head}.rope`);
    const raw = builder.node(`${p}.attn.${head}.raw`, 'matmul', [qRot, kt], [S, S]); const scaled = builder.node(`${p}.attn.${head}.scaled`, 'mul', [raw, 'attentionScale'], [S, S]);
    const masked = builder.node(`${p}.attn.${head}.masked`, 'add', [scaled, 'causalMask'], [S, S]); const probabilities = builder.node(`${p}.attn.${head}.probabilities`, 'softmax', [masked], [S, S]);
    const context = builder.node(`${p}.attn.${head}.context`, 'matmul', [probabilities, value], [S, D]); heads.push(builder.node(`${p}.attn.${head}.embedded`, 'matmul', [context, `head.embedder.${head}`], [S, H]));
  }
  const merged = builder.node(`${p}.heads.merged`, 'add', heads, [S, H]); const projected = builder.node(`${p}.attention.projected`, 'matmul', [merged, `${p}.wo`], [S, H]);
  const residual = builder.node(`${p}.residual`, 'add', [input, projected], [S, H]); const ffNorm = rmsNorm(builder, residual, `${p}.ff.norm`); const ffPre = builder.node(`${p}.ff.pre`, 'matmul', [ffNorm, `${p}.w1`], [S, FF]);
  const gate = builder.node(`${p}.ff.sigmoid`, 'activation', [ffPre], [S, FF], { kind: 'sigmoid' }); const silu = builder.node(`${p}.ff.silu`, 'mul', [ffPre, gate], [S, FF]);
  const ffProjected = builder.node(`${p}.ff.projected`, 'matmul', [silu, `${p}.w2`], [S, H]); return builder.node(`${p}.output`, 'add', [residual, ffProjected], [S, H]);
}

function buildGraph(frame, initial = weights()) {
  const builder = new GraphBuilder(); builder.tensor('inputOneHot', [S, V], [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0]); builder.tensor('targetOneHot', [S, V], [0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  builder.tensor('epsilon', [1], [EPSILON]); builder.tensor('attentionScale', [1], [SCALE]); builder.tensor('causalMask', [S, S], causalMask()); builder.tensor('negativeOne', [], [-1]);
  builder.tensor('rope.cos', [S, D], frame.cos); builder.tensor('rope.sin', [S, D], frame.sin); builder.tensor('rope.rotation', [D, D], frame.rotationMatrix);
  for (let head = 0; head < Q_HEADS; head += 1) { builder.tensor(`head.selector.${head}`, [H, D], selector(head)); builder.tensor(`head.embedder.${head}`, [D, H], embedder(head)); }
  for (const id of IDS) { const shape = id === 'tokenEmbedding' ? [V, H] : id === 'lmHead' ? [H, V] : id.endsWith('.wq') || id.endsWith('.wo') ? [H, H] : id.endsWith('.wk') || id.endsWith('.wv') ? [H, D] : id.endsWith('.w1') ? [H, FF] : [FF, H]; builder.tensor(id, shape, initial[id], true); }
  let hidden = builder.node('embedding', 'matmul', ['inputOneHot', 'tokenEmbedding'], [S, H]); hidden = addBlock(builder, hidden, 0); hidden = addBlock(builder, hidden, 1);
  const logits = builder.node('lm.logits', 'matmul', [hidden, 'lmHead'], [S, V]); const probabilities = builder.node('lm.probabilities', 'softmax', [logits], [S, V]);
  const logProbabilities = builder.node('lm.logProbabilities', 'log', [probabilities], [S, V]); const selected = builder.node('loss.selected', 'mul', ['targetOneHot', logProbabilities], [S, V]);
  const tokenLoss = builder.node('loss.token', 'sum', [selected], [S], { axis: 1 }); const meanLoss = builder.node('loss.mean', 'mean', [tokenLoss], [], { axis: 0 }); builder.node('loss', 'mul', ['negativeOne', meanLoss], []);
  builder.graph.outputs = ['block.0.output', 'block.1.output', 'lm.logits', 'loss']; return builder.graph;
}

function ropeFrame() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-k08-r-bf16-rope-')); const requestPath = path.join(directory, 'request.json');
  fs.writeFileSync(requestPath, JSON.stringify({ format: 'rcl.rope-position-frame-request.v0.1', sequenceLength: S, headDimension: D, base: 10000, positionOffset: 0, maxPositionExclusive: 8 }));
  const run = spawnSync(ROPE, [requestPath], { cwd: ROOT, encoding: 'utf8', timeout: 60_000, maxBuffer: 16 * 1024 * 1024 }); fs.rmSync(directory, { recursive: true, force: true });
  if (run.status !== 0) throw new Error(run.stderr || run.stdout || 'RCL_K08_R_BF16_ROPE_FAILED'); return JSON.parse(run.stdout.trim());
}

function buildEngines() { const run = spawnSync('cargo', ['build', '--release', '--locked', '--manifest-path', MANIFEST, '--bin', 'rcl-bf16-autodiff-adamw', '--bin', 'rcl-rope-frame'], { cwd: ROOT, encoding: 'utf8', timeout: 180_000, maxBuffer: 32 * 1024 * 1024 }); if (run.status !== 0) throw new Error(run.stderr || run.stdout || 'RCL_K08_R_BF16_BUILD_FAILED'); }
function requestFor(frame, steps = 4, initial = weights(), optimizerStates = []) { const graph = buildGraph(frame, initial); return { format: 'rcl.bf16-autodiff-adamw-request.v0.2', backend: 'cpu-reference', steps, autodiff: { format: 'rcl.tensor-autodiff-request.v0.1', graph, loss: 'loss', parameters: IDS.map((tensorId) => ({ tensorId, gradientIdentity: `parameter:${tensorId}` })), stopGradients: [], precision: 'bf16-rne-fp32-accumulation' }, config: CONFIG, optimizerStates }; }

function execute(request, expectSuccess = true) { const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-k08-r-bf16-')); const requestPath = path.join(directory, 'request.json'); fs.writeFileSync(requestPath, JSON.stringify(request)); const run = spawnSync(ENGINE, [requestPath], { cwd: ROOT, encoding: 'utf8', timeout: 180_000, maxBuffer: 64 * 1024 * 1024 }); fs.rmSync(directory, { recursive: true, force: true }); if (run.error) throw run.error; if ((run.status === 0) !== expectSuccess) throw new Error(run.stderr || run.stdout || 'RCL_K08_R_BF16_EXECUTION_STATUS'); return JSON.parse((expectSuccess ? run.stdout : run.stderr).trim()); }

function applyCheckpoint(request, result) { const next = structuredClone(request); for (const parameter of result.parameters) { const storage = next.autodiff.graph.storages.find((item) => item.identity === `storage:${parameter.tensorId}`); storage.data = [...parameter.masterWeight.data]; next.autodiff.graph.exactF32StorageBits[`storage:${parameter.tensorId}`] = [...parameter.masterWeight.bitsHex]; } next.optimizerStates = structuredClone(result.optimizerStates); return next; }

let frame; let campaign; const initial = weights();
test.before(() => { buildEngines(); frame = ropeFrame(); });

test('K08-R-BF16 genome self-hosts with byte parity and native semantic root', { timeout: 180_000 }, () => { const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-k08-r-bf16-source-')); const rbc = path.join(directory, 'bf16-gqa-rope-multiblock.rbc'); const compiled = runNativeCompiler('selfhost/compiler.rbc', SOURCE, rbc, { timeout: 120_000, maxBuffer: 64 * 1024 * 1024 }); assert.equal(compiled.status, 'ok'); assert.equal(fs.readFileSync(rbc).equals(Buffer.from(compileRealityToBytecode(fs.readFileSync(SOURCE, 'utf8')))), true); const run = runNativeBytecode(rbc, { timeout: 120_000, maxBuffer: 64 * 1024 * 1024, requireNativeStateRoot: true }); assert.equal(run.stateRootVerified, true); assert.equal(run.state['evaluation.two_block_gqa_rope_valid'], true); assert.equal(run.state['evaluation.gpu_claim_closed'], true); fs.rmSync(directory, { recursive: true, force: true }); });

test('K08-R-BF16 two-block GQA+RoPE graph trains through generic BF16 Autodiff AdamW', () => { campaign = execute(requestFor(frame, 8)); assert.equal(campaign.status, 'ok'); assert.equal(campaign.parameters.length, 14); assert.ok(campaign.finalLoss < campaign.initialLoss, `${campaign.initialLoss} -> ${campaign.finalLoss}`); assert.equal(campaign.telemetry.forwardComputeDtype, 'bf16'); assert.equal(campaign.telemetry.accumulationDtype, 'f32'); });

test('K08-R-BF16 all fourteen parameter groups update with exact FP32 masters and states', () => { const result = campaign ?? execute(requestFor(frame, 4)); assert.deepEqual(result.parameterOrder, IDS); assert.equal(result.optimizerStates.length, IDS.length); assert.equal(result.parameters.every((item) => item.masterWeight.dtype === 'f32' && item.computeWeight.dtype === 'bf16'), true); assert.equal(result.parameters.every((item) => item.masterWeight.bitsHex.some((bits, index) => bits !== exactBits(initial[item.tensorId][index]))), true); assert.equal(result.optimizerStates.every((state) => state.step === 8 && state.exactFirstMomentBits.length > 0 && state.exactSecondMomentBits.length > 0), true); });

test('K08-R-BF16 deterministic direct and checkpoint-resume replay are exact', () => { const direct = execute(requestFor(frame, 6)); const first = execute(requestFor(frame, 3)); const resumed = execute(applyCheckpoint(requestFor(frame, 3), first)); const replay = execute(requestFor(frame, 6)); assert.deepEqual(replay.parameters, direct.parameters); assert.deepEqual(replay.optimizerStates, direct.optimizerStates); assert.equal(replay.checkpointRoot, direct.checkpointRoot); assert.deepEqual(resumed.parameters, direct.parameters); assert.deepEqual(resumed.optimizerStates, direct.optimizerStates); assert.equal(resumed.checkpointRoot, direct.checkpointRoot); assert.equal(resumed.finalLoss, direct.finalLoss); });

test('K08-R-BF16 state order and model-special operation boundaries fail closed', () => { const first = execute(requestFor(frame, 1)); const invalid = requestFor(frame, 1); invalid.optimizerStates = [...first.optimizerStates].reverse(); assert.equal(execute(invalid, false).code, 'RCL_BF16_AD_STATE_ORDER'); const operations = new Set(buildGraph(frame).nodes.map((node) => node.operation)); assert.deepEqual([...operations].filter((operation) => /model-special|gqa-special|rope-special|multiblock-adamw/i.test(operation)), []); });

test('K08-R-BF16 contract grants bounded GQA+RoPE composition only', () => { const contract = JSON.parse(fs.readFileSync(CONTRACT, 'utf8')); assert.equal(contract.canonicalOwner, 'RCL'); for (const claim of ['BF16_GQA_ROPE_MULTI_BLOCK_TRAINING', 'BF16_GQA_ROPE_CHECKPOINT_RESUME']) assert.ok(contract.claimsGrantedOnAdmission.includes(claim)); for (const claim of ['GPU', 'OPENCL_BF16', 'RCL_10M', 'RCL_1B', 'K400_PROMOTION']) assert.ok(contract.claimsNotGranted.includes(claim)); });
