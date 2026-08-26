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
const SOURCE = path.join(ROOT, 'examples', 'native-ai', 'bf16-multiblock-adamw-genome.rcl');
const CONTRACT = path.join(ROOT, 'examples', 'native-ai', 'bf16-multiblock-adamw-contract.v0.1.json');

const S = 4;
const V = 4;
const H = 4;
const PARAMETER_IDS = ['tokenEmbedding', 'block.0.weight', 'block.1.weight', 'lmHead'];
const TOKENS = [0, 1, 2, 3];
const TARGETS = [1, 2, 3, 0];
const CONFIG = Object.freeze({ learningRate: 0.04, beta1: 0.9, beta2: 0.999, epsilon: 1e-5, weightDecay: 0.001, gradientClip: 5 });
const view = new DataView(new ArrayBuffer(4));

function f32(value) { view.setFloat32(0, Math.fround(value), false); return view.getFloat32(0, false); }
function f32Bits(value) { view.setFloat32(0, f32(value), false); return view.getUint32(0, false); }
function exactBits(value) { return f32Bits(value).toString(16).padStart(8, '0'); }
function f32FromBits(bits) { view.setUint32(0, bits >>> 0, false); return view.getFloat32(0, false); }
function bf16Bits(value) {
  const bits = f32Bits(value);
  const lsb = (bits >>> 16) & 1;
  return ((bits + 0x7fff + lsb) >>> 16) & 0xffff;
}
function q(value) { return f32FromBits((bf16Bits(value) << 16) >>> 0); }

function buildEngine() {
  const run = spawnSync('cargo', ['build', '--release', '--locked', '--manifest-path', MANIFEST, '--bin', 'rcl-bf16-autodiff-adamw'], {
    cwd: ROOT, encoding: 'utf8', timeout: 180_000, maxBuffer: 32 * 1024 * 1024,
  });
  if (run.status !== 0) throw new Error(run.stderr || run.stdout || 'RCL_K08_S_MB_BUILD_FAILED');
}

function tensor(id, shape, storageIdentity, gradientIdentity = `derived:${id}`) {
  return { id, shape, dtype: 'bf16', layout: 'row-major', device: 'cpu', gradientIdentity, storageIdentity };
}

function output(id, shape) {
  return { id, shape, dtype: 'bf16', layout: 'row-major', device: 'cpu', gradientIdentity: `derived:${id}` };
}

function identity(scale, tilt) {
  return Array.from({ length: H * H }, (_, index) => {
    const row = Math.floor(index / H); const column = index % H;
    return row === column ? scale : (((index + tilt) % 5 === 0) ? 0.04 : 0);
  });
}

function initialWeights() {
  return {
    tokenEmbedding: [0.95, 0.02, 0, 0, 0, 0.94, 0.02, 0, 0, 0, 0.93, 0.02, 0, 0, 0, 0.92],
    'block.0.weight': identity(0.72, 1),
    'block.1.weight': identity(0.68, 2),
    lmHead: [0.02, 0.34, -0.04, 0, 0, 0.02, 0.33, -0.04, -0.04, 0, 0.02, 0.32, 0.31, -0.04, 0, 0.02],
  };
}

function oneHot(values, width) { return values.flatMap((value) => Array.from({ length: width }, (_, index) => Number(index === value))); }

function requestFor(steps = 4, weights = initialWeights(), optimizerStates = []) {
  const storages = [
    { identity: 'storage:input', kind: 'cpu-dense', data: oneHot(TOKENS, V) },
    { identity: 'storage:target', kind: 'cpu-dense', data: oneHot(TARGETS, V) },
    { identity: 'storage:negativeOne', kind: 'cpu-dense', data: [-1] },
    ...PARAMETER_IDS.map((id) => ({ identity: `storage:${id}`, kind: 'cpu-dense', data: [...weights[id]] })),
  ];
  const graph = {
    format: 'rcl.tensor-execution-plan.v0.1',
    bindings: { semanticOwner: 'RCL', precisionPolicy: 'bf16-rne-fp32-accumulation', campaign: 'K08-S-MULTIBLOCK' },
    tensors: [
      tensor('input', [S, V], 'storage:input'),
      tensor('target', [S, V], 'storage:target'),
      tensor('negativeOne', [], 'storage:negativeOne'),
      ...PARAMETER_IDS.map((id) => tensor(id, [V, H], `storage:${id}`, `parameter:${id}`)),
    ],
    storages,
    exactF32StorageBits: Object.fromEntries(PARAMETER_IDS.map((id) => [`storage:${id}`, weights[id].map(exactBits)])),
    nodes: [
      { id: 'embedding', operation: 'matmul', inputs: ['input', 'tokenEmbedding'], output: output('embedding', [S, H]), attributes: {} },
      { id: 'block0.pre', operation: 'matmul', inputs: ['embedding', 'block.0.weight'], output: output('block0.pre', [S, H]), attributes: {} },
      { id: 'block0.activation', operation: 'activation', inputs: ['block0.pre'], output: output('block0.activation', [S, H]), attributes: { kind: 'tanh' } },
      { id: 'block1.pre', operation: 'matmul', inputs: ['block0.activation', 'block.1.weight'], output: output('block1.pre', [S, H]), attributes: {} },
      { id: 'block1.activation', operation: 'activation', inputs: ['block1.pre'], output: output('block1.activation', [S, H]), attributes: { kind: 'tanh' } },
      { id: 'logits', operation: 'matmul', inputs: ['block1.activation', 'lmHead'], output: output('logits', [S, V]), attributes: {} },
      { id: 'probabilities', operation: 'softmax', inputs: ['logits'], output: output('probabilities', [S, V]), attributes: {} },
      { id: 'logProbabilities', operation: 'log', inputs: ['probabilities'], output: output('logProbabilities', [S, V]), attributes: {} },
      { id: 'selected', operation: 'mul', inputs: ['target', 'logProbabilities'], output: output('selected', [S, V]), attributes: {} },
      { id: 'tokenLoss', operation: 'sum', inputs: ['selected'], output: output('tokenLoss', [S]), attributes: { axis: 1 } },
      { id: 'meanLoss', operation: 'mean', inputs: ['tokenLoss'], output: output('meanLoss', []), attributes: { axis: 0 } },
      { id: 'loss', operation: 'mul', inputs: ['negativeOne', 'meanLoss'], output: output('loss', []), attributes: {} },
    ],
    outputs: ['embedding', 'block0.activation', 'block1.activation', 'loss'],
  };
  return {
    format: 'rcl.bf16-autodiff-adamw-request.v0.2', backend: 'cpu-reference', steps, autodiff: {
      format: 'rcl.tensor-autodiff-request.v0.1', graph, loss: 'loss', precision: 'bf16-rne-fp32-accumulation',
      parameters: PARAMETER_IDS.map((tensorId) => ({ tensorId, gradientIdentity: `parameter:${tensorId}` })), stopGradients: [],
    }, config: CONFIG, optimizerStates,
  };
}

function execute(request, expectSuccess = true) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-k08-s-mb-'));
  const requestPath = path.join(directory, 'request.json'); fs.writeFileSync(requestPath, JSON.stringify(request));
  const run = spawnSync(ENGINE, [requestPath], { cwd: ROOT, encoding: 'utf8', timeout: 180_000, maxBuffer: 64 * 1024 * 1024 });
  fs.rmSync(directory, { recursive: true, force: true });
  if (run.error) throw run.error;
  if ((run.status === 0) !== expectSuccess) throw new Error(run.stderr || run.stdout || 'RCL_K08_S_MB_EXECUTION_STATUS');
  return JSON.parse((expectSuccess ? run.stdout : run.stderr).trim());
}

function matmul(left, leftRows, shared, right, rightColumns) {
  return Array.from({ length: leftRows * rightColumns }, (_, index) => {
    const row = Math.floor(index / rightColumns); const column = index % rightColumns;
    let value = 0;
    for (let inner = 0; inner < shared; inner += 1) value = f32(value + f32(left[row * shared + inner] * right[inner * rightColumns + column]));
    return q(value);
  });
}

function independentLoss(weights) {
  const input = oneHot(TOKENS, V); const target = oneHot(TARGETS, V);
  const embedding = matmul(input, S, V, weights.tokenEmbedding, H);
  const block0 = matmul(embedding, S, H, weights['block.0.weight'], H).map((value) => q(Math.tanh(value)));
  const block1 = matmul(block0, S, H, weights['block.1.weight'], H).map((value) => q(Math.tanh(value)));
  const logits = matmul(block1, S, H, weights.lmHead, V);
  const selected = [];
  for (let row = 0; row < S; row += 1) {
    const start = row * V; const max = Math.max(...logits.slice(start, start + V));
    let denominator = 0; const exponentials = logits.slice(start, start + V).map((value) => { const result = Math.exp(value - max); denominator = f32(denominator + result); return result; });
    const probabilities = exponentials.map((value) => q(value / denominator));
    for (let column = 0; column < V; column += 1) selected.push(q(target[start + column] * q(Math.log(probabilities[column]))));
  }
  const tokenLoss = Array.from({ length: S }, (_, row) => q(selected.slice(row * V, row * V + V).reduce((sum, value) => f32(sum + value), 0)));
  return q(-q(tokenLoss.reduce((sum, value) => f32(sum + value), 0) / S));
}

function applyCheckpoint(request, result) {
  const next = structuredClone(request);
  for (const parameter of result.parameters) {
    const id = parameter.tensorId; const storage = next.autodiff.graph.storages.find((item) => item.identity === `storage:${id}`);
    storage.data = [...parameter.masterWeight.data];
    next.autodiff.graph.exactF32StorageBits[`storage:${id}`] = [...parameter.masterWeight.bitsHex];
  }
  next.optimizerStates = structuredClone(result.optimizerStates);
  return next;
}

let firstTraining;
test.before(() => buildEngine());

test('K08-S-MB genome self-hosts with byte parity and native semantic root', { timeout: 180_000 }, () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-k08-s-mb-source-')); const rbc = path.join(directory, 'bf16-multiblock.rbc');
  const compiled = runNativeCompiler('selfhost/compiler.rbc', SOURCE, rbc, { timeout: 120_000, maxBuffer: 64 * 1024 * 1024 });
  assert.equal(compiled.status, 'ok'); assert.equal(fs.readFileSync(rbc).equals(Buffer.from(compileRealityToBytecode(fs.readFileSync(SOURCE, 'utf8')))), true);
  const run = runNativeBytecode(rbc, { timeout: 120_000, maxBuffer: 64 * 1024 * 1024, requireNativeStateRoot: true });
  assert.equal(run.stateRootVerified, true); assert.equal(run.state['evaluation.two_block_valid'], true); assert.equal(run.state['evaluation.gpu_claim_closed'], true);
  fs.rmSync(directory, { recursive: true, force: true });
});

test('K08-S-MB two-block BF16 graph matches independent loss and decreases it', () => {
  const request = requestFor(8); const result = execute(request); firstTraining = result;
  assert.equal(result.status, 'ok'); assert.equal(result.parameters.length, PARAMETER_IDS.length);
  assert.equal(result.initialLoss, independentLoss(initialWeights())); assert.ok(result.finalLoss < result.initialLoss, `${result.initialLoss} -> ${result.finalLoss}`);
  assert.equal(result.telemetry.forwardComputeDtype, 'bf16'); assert.equal(result.telemetry.accumulationDtype, 'f32');
});

test('K08-S-MB every block and shared parameter updates with exact FP32 state', () => {
  const result = firstTraining ?? execute(requestFor(4));
  assert.deepEqual(result.parameterOrder, PARAMETER_IDS); assert.equal(result.optimizerStates.length, PARAMETER_IDS.length);
  assert.equal(result.parameters.every((item) => item.masterWeight.dtype === 'f32' && item.computeWeight.dtype === 'bf16'), true);
  assert.equal(result.parameters.every((item) => item.masterWeight.bitsHex.some((bits, index) => bits !== exactBits(initialWeights()[item.tensorId][index]))), true);
  assert.equal(result.optimizerStates.every((state) => state.step === 8 && state.exactFirstMomentBits.length > 0 && state.exactSecondMomentBits.length > 0), true);
});

test('K08-S-MB deterministic replay and direct checkpoint resume are exact', () => {
  const direct = execute(requestFor(6)); const first = execute(requestFor(3)); const resumed = execute(applyCheckpoint(requestFor(3), first));
  const replay = execute(requestFor(6));
  assert.deepEqual(replay.parameters, direct.parameters); assert.deepEqual(replay.optimizerStates, direct.optimizerStates); assert.equal(replay.checkpointRoot, direct.checkpointRoot);
  assert.deepEqual(resumed.parameters, direct.parameters); assert.deepEqual(resumed.optimizerStates, direct.optimizerStates); assert.equal(resumed.checkpointRoot, direct.checkpointRoot); assert.equal(resumed.finalLoss, direct.finalLoss);
});

test('K08-S-MB malformed optimizer order fails closed and model-special operations remain absent', () => {
  const first = execute(requestFor(1)); const invalid = requestFor(1); invalid.optimizerStates = [...first.optimizerStates].reverse();
  assert.equal(execute(invalid, false).code, 'RCL_BF16_AD_STATE_ORDER');
  const operations = new Set(requestFor(1).autodiff.graph.nodes.map((node) => node.operation));
  assert.deepEqual([...operations].filter((operation) => /model-special|multiblock-adamw|bf16-special/i.test(operation)), []);
});

test('K08-S-MB contract keeps GPU and scale claims closed', () => {
  const contract = JSON.parse(fs.readFileSync(CONTRACT, 'utf8'));
  assert.equal(contract.canonicalOwner, 'RCL'); assert.equal(contract.precisionPolicy.parameterComputeDtype, 'bf16');
  for (const claim of ['BF16_MULTI_BLOCK_TRAINING', 'BF16_MULTI_BLOCK_CHECKPOINT_RESUME', 'ALL_CANONICAL_PARAMETER_GROUPS_UPDATE']) assert.ok(contract.claimsGrantedOnAdmission.includes(claim));
  for (const claim of ['GPU', 'OPENCL_BF16', 'RCL_10M', 'RCL_1B', 'K400_PROMOTION']) assert.ok(contract.claimsNotGranted.includes(claim));
});
