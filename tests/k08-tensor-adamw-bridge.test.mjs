import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { compileRealityToBytecode } from '../src/bytecode.mjs';
import { runNativeBytecode, runNativeCompiler } from '../src/native-vm.mjs';
import { executeRequest } from '../scripts/run-k08-native-autodiff.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST = path.join(ROOT, 'native', 'tensor-engine', 'Cargo.toml');
const ADAMW = path.join(
  ROOT,
  'native',
  'tensor-engine',
  'target',
  'release',
  process.platform === 'win32' ? 'rcl-tensor-adamw.exe' : 'rcl-tensor-adamw',
);
const SOURCE = path.join(ROOT, 'examples', 'native-ai', 'tensor-adamw-bridge.rcl');
const CONTRACT = path.join(ROOT, 'examples', 'native-ai', 'tensor-adamw-bridge-contract.v0.1.json');

const STANDARD_CONFIG = Object.freeze({
  learningRate: 0.01,
  beta1: 0.9,
  beta2: 0.999,
  epsilon: 1e-8,
  weightDecay: 0.1,
  gradientClip: 1,
});

function buildEngine() {
  const run = spawnSync('cargo', ['build', '--release', '--locked', '--manifest-path', MANIFEST], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 180_000,
    maxBuffer: 32 * 1024 * 1024,
  });
  if (run.status !== 0) throw new Error(run.stderr || run.stdout || 'RCL_K08_K_CARGO_BUILD_FAILED');
}

function executeAdamW(request, expectSuccess = true) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-k08-k-adamw-'));
  const requestPath = path.join(directory, 'request.json');
  fs.writeFileSync(requestPath, JSON.stringify(request));
  const run = spawnSync(ADAMW, [requestPath], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 180_000,
    maxBuffer: 64 * 1024 * 1024,
  });
  fs.rmSync(directory, { recursive: true, force: true });
  if (run.error) throw new Error(`RCL_K08_K_EXECUTION_SPAWN: ${run.error.message}`);
  if ((run.status === 0) !== expectSuccess) {
    throw new Error(run.stderr || run.stdout || 'RCL_K08_K_EXECUTION_STATUS');
  }
  const response = expectSuccess ? run.stdout : run.stderr;
  if (!response?.trim()) throw new Error('RCL_K08_K_EXECUTION_EMPTY_RESPONSE');
  return JSON.parse(response.trim());
}

class GraphBuilder {
  constructor(bindings = {}) {
    this.graph = {
      format: 'rcl.tensor-execution-plan.v0.1',
      bindings,
      tensors: [],
      storages: [],
      exactStorageBits: {},
      nodes: [],
      outputs: [],
    };
  }

  tensor(id, shape, data, gradientIdentity = `constant:${id}`) {
    const storageIdentity = `storage:${id}`;
    this.graph.tensors.push({
      id,
      shape,
      dtype: 'f64',
      layout: 'row-major',
      device: 'cpu',
      gradientIdentity,
      storageIdentity,
    });
    this.graph.storages.push({ identity: storageIdentity, kind: 'cpu-dense', data: [...data] });
    return id;
  }

  node(id, operation, inputs, shape, attributes = {}) {
    this.graph.nodes.push({
      id: `node:${id}`,
      operation,
      inputs,
      output: {
        id,
        shape,
        dtype: 'f64',
        layout: 'row-major',
        device: 'cpu',
        gradientIdentity: `derived:${operation}:${id}`,
      },
      attributes,
    });
    return id;
  }
}

function autodiffRequest(graph, parameterIds, loss = 'loss') {
  return {
    format: 'rcl.tensor-autodiff-request.v0.1',
    graph,
    loss,
    parameters: parameterIds.map((tensorId) => ({ tensorId, gradientIdentity: `parameter:${tensorId}` })),
    stopGradients: [],
  };
}

function adamwRequest(graph, parameterIds, steps, config = STANDARD_CONFIG, optimizerStates = []) {
  return {
    format: 'rcl.tensor-autodiff-adamw-training-request.v0.1',
    autodiff: autodiffRequest(graph, parameterIds),
    steps,
    config,
    optimizerStates,
  };
}

function buildScalarFixture() {
  const builder = new GraphBuilder({ campaign: 'K08-K', fixture: 'scalar-reference-parity' });
  builder.tensor('p', [1], [1], 'parameter:p');
  builder.tensor('half', [1], [0.5]);
  builder.node('loss', 'mul', ['p', 'half'], [1]);
  builder.graph.outputs = ['loss'];
  return builder.graph;
}

function applyParameters(graph, parameters) {
  const copy = structuredClone(graph);
  for (const trained of parameters) {
    const tensor = copy.tensors.find((item) => item.id === trained.tensor.id);
    assert.ok(tensor, `missing parameter tensor ${trained.tensor.id}`);
    const storage = copy.storages.find((item) => item.identity === tensor.storageIdentity);
    assert.ok(storage, `missing parameter storage ${tensor.storageIdentity}`);
    const oldIdentity = storage.identity;
    storage.identity = trained.storage.identity;
    storage.data = [...trained.storage.data];
    tensor.storageIdentity = trained.storage.identity;
    delete copy.exactStorageBits[oldIdentity];
  }
  return copy;
}

function maximumDifference(left, right) {
  assert.equal(left.length, right.length);
  return left.reduce((maximum, value, index) => Math.max(maximum, Math.abs(value - right[index])), 0);
}

const VOCAB = 3;
const SEQUENCE = 6;
const HIDDEN = 3;
const FF = 4;
const EPSILON = 1e-5;
const TRAINING_TOKENS = [0, 1, 2, 0, 1, 2];
const TARGET_TOKENS = [1, 2, 0, 1, 2, 0];
const PARAMETER_IDS = ['tokenEmbedding', 'wq', 'wk', 'wv', 'wo', 'w1', 'w2', 'lmHead'];

const INITIAL = Object.freeze({
  tokenEmbedding: [
    1, 0, 0,
    0, 1, 0,
    0, 0, 1,
  ],
  wq: [
    0.10, 0.01, -0.01,
    0.00, 0.10, 0.02,
    0.01, -0.01, 0.10,
  ],
  wk: [
    0.09, -0.01, 0.01,
    0.02, 0.10, 0.00,
    -0.01, 0.01, 0.09,
  ],
  wv: [
    0.12, 0.01, 0.00,
    -0.01, 0.11, 0.01,
    0.00, -0.01, 0.10,
  ],
  wo: [
    0.08, 0.01, 0.00,
    0.00, 0.09, -0.01,
    0.01, 0.00, 0.08,
  ],
  w1: [
    0.10, -0.05, 0.02, 0.03,
    0.02, 0.10, -0.04, 0.01,
    -0.03, 0.04, 0.10, -0.02,
  ],
  w2: [
    0.05, 0.01, -0.02,
    -0.01, 0.06, 0.02,
    0.02, -0.03, 0.05,
    0.01, 0.02, 0.04,
  ],
  lmHead: [
    0.00, 0.60, 0.00,
    0.00, 0.00, 0.60,
    0.60, 0.00, 0.00,
  ],
});

function oneHot(tokens) {
  return tokens.flatMap((token) => Array.from({ length: VOCAB }, (_, index) => Number(index === token)));
}

function rmsNorm(builder, input, prefix) {
  const square = builder.node(`${prefix}.square`, 'mul', [input, input], [SEQUENCE, HIDDEN]);
  const mean = builder.node(`${prefix}.mean`, 'mean', [square], [SEQUENCE], { axis: 1 });
  const column = builder.node(`${prefix}.column`, 'reshape', [mean], [SEQUENCE, 1], { shape: [SEQUENCE, 1] });
  const shifted = builder.node(`${prefix}.shifted`, 'add', [column, 'epsilon'], [SEQUENCE, 1]);
  const root = builder.node(`${prefix}.root`, 'sqrt', [shifted], [SEQUENCE, 1]);
  const denominator = builder.node(`${prefix}.denominator`, 'broadcast', [root], [SEQUENCE, HIDDEN], { shape: [SEQUENCE, HIDDEN] });
  return builder.node(`${prefix}.normalized`, 'div', [input, denominator], [SEQUENCE, HIDDEN]);
}

function buildTinyLmGraph(tokens = TRAINING_TOKENS, targetTokens = TARGET_TOKENS) {
  const builder = new GraphBuilder({
    campaign: 'K08-K',
    architecture: 'tiny-decoder-lm-adamw-bridge',
    semanticOwner: 'RCL',
  });
  builder.tensor('inputOneHot', [SEQUENCE, VOCAB], oneHot(tokens));
  builder.tensor('targetOneHot', [SEQUENCE, VOCAB], oneHot(targetTokens));
  builder.tensor('positionEncoding', [SEQUENCE, HIDDEN], new Array(SEQUENCE * HIDDEN).fill(0));
  builder.tensor('epsilon', [1], [EPSILON]);
  builder.tensor('attentionScale', [1], [1 / Math.sqrt(HIDDEN)]);
  builder.tensor('negativeOne', [], [-1]);
  builder.tensor('causalMask', [SEQUENCE, SEQUENCE], Array.from({ length: SEQUENCE * SEQUENCE }, (_, index) => {
    const row = Math.floor(index / SEQUENCE);
    const column = index % SEQUENCE;
    return column <= row ? 0 : -20;
  }));

  for (const id of PARAMETER_IDS) {
    const shape = id === 'tokenEmbedding' || id === 'lmHead'
      ? [VOCAB, HIDDEN]
      : id === 'w1'
        ? [HIDDEN, FF]
        : id === 'w2'
          ? [FF, HIDDEN]
          : [HIDDEN, HIDDEN];
    builder.tensor(id, shape, INITIAL[id], `parameter:${id}`);
  }

  const tokenEmbedding = builder.node('embedding.token', 'matmul', ['inputOneHot', 'tokenEmbedding'], [SEQUENCE, HIDDEN]);
  const input = builder.node('embedding.withPosition', 'add', [tokenEmbedding, 'positionEncoding'], [SEQUENCE, HIDDEN]);
  const norm1 = rmsNorm(builder, input, 'norm1');
  const q = builder.node('q', 'matmul', [norm1, 'wq'], [SEQUENCE, HIDDEN]);
  const k = builder.node('k', 'matmul', [norm1, 'wk'], [SEQUENCE, HIDDEN]);
  const v = builder.node('v', 'matmul', [norm1, 'wv'], [SEQUENCE, HIDDEN]);
  const kt = builder.node('kt', 'transpose', [k], [HIDDEN, SEQUENCE], { permutation: [1, 0] });
  const rawScores = builder.node('attention.rawScores', 'matmul', [q, kt], [SEQUENCE, SEQUENCE]);
  const scaledScores = builder.node('attention.scaledScores', 'mul', [rawScores, 'attentionScale'], [SEQUENCE, SEQUENCE]);
  const maskedScores = builder.node('attention.maskedScores', 'add', [scaledScores, 'causalMask'], [SEQUENCE, SEQUENCE]);
  const attention = builder.node('attention.probabilities', 'softmax', [maskedScores], [SEQUENCE, SEQUENCE]);
  const context = builder.node('attention.context', 'matmul', [attention, v], [SEQUENCE, HIDDEN]);
  const projected = builder.node('attention.projected', 'matmul', [context, 'wo'], [SEQUENCE, HIDDEN]);
  const residual1 = builder.node('residual1', 'add', [input, projected], [SEQUENCE, HIDDEN]);
  const norm2 = rmsNorm(builder, residual1, 'norm2');
  const ffPre = builder.node('ff.pre', 'matmul', [norm2, 'w1'], [SEQUENCE, FF]);
  const ffGate = builder.node('ff.sigmoid', 'activation', [ffPre], [SEQUENCE, FF], { kind: 'sigmoid' });
  const ffSilu = builder.node('ff.silu', 'mul', [ffPre, ffGate], [SEQUENCE, FF]);
  const ffProjected = builder.node('ff.projected', 'matmul', [ffSilu, 'w2'], [SEQUENCE, HIDDEN]);
  const blockOutput = builder.node('block.output', 'add', [residual1, ffProjected], [SEQUENCE, HIDDEN]);
  const logits = builder.node('lm.logits', 'matmul', [blockOutput, 'lmHead'], [SEQUENCE, VOCAB]);
  const probabilities = builder.node('lm.probabilities', 'softmax', [logits], [SEQUENCE, VOCAB]);
  const logProbabilities = builder.node('lm.logProbabilities', 'log', [probabilities], [SEQUENCE, VOCAB]);
  const selected = builder.node('loss.selected', 'mul', ['targetOneHot', logProbabilities], [SEQUENCE, VOCAB]);
  const tokenLogProbability = builder.node('loss.tokenLogProbability', 'sum', [selected], [SEQUENCE], { axis: 1 });
  const meanLogProbability = builder.node('loss.meanLogProbability', 'mean', [tokenLogProbability], [], { axis: 0 });
  const loss = builder.node('loss', 'mul', ['negativeOne', meanLogProbability], []);
  builder.graph.outputs = [logits, probabilities, attention, loss];
  return builder.graph;
}

function outputMap(result) {
  return new Map(result.outputs.map((item) => [item.tensor.id, item.storage.data]));
}

function argmax(values) {
  let best = 0;
  for (let index = 1; index < values.length; index += 1) if (values[index] > values[best]) best = index;
  return best;
}

function setInputTokens(graph, tokens) {
  const copy = structuredClone(graph);
  const tensor = copy.tensors.find((item) => item.id === 'inputOneHot');
  const storage = copy.storages.find((item) => item.identity === tensor.storageIdentity);
  storage.data = oneHot(tokens);
  return copy;
}

function greedyGenerate(trainedGraph, seed, count) {
  const context = [...seed];
  const generated = [];
  for (let step = 0; step < count; step += 1) {
    const window = context.slice(-SEQUENCE);
    const run = executeRequest(setInputTokens(trainedGraph, window));
    const probabilities = outputMap(run).get('lm.probabilities');
    const last = probabilities.slice((SEQUENCE - 1) * VOCAB, SEQUENCE * VOCAB);
    const next = argmax(last);
    generated.push(next);
    context.push(next);
  }
  return generated;
}

let scalarDirect;
let tinyTraining;

test.before(() => {
  buildEngine();
  scalarDirect = executeAdamW(adamwRequest(buildScalarFixture(), ['p'], 2));
  tinyTraining = executeAdamW(adamwRequest(
    buildTinyLmGraph(),
    PARAMETER_IDS,
    80,
    { ...STANDARD_CONFIG, learningRate: 0.03, weightDecay: 0.01 },
  ));
});

test('K08-K Tensor AdamW bridge semantic genome self-hosts with byte-identical RBC and native semantic root', { timeout: 180_000 }, () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-k08-k-adamw-source-'));
  const rbcPath = path.join(directory, 'tensor-adamw-bridge.rbc');
  const compiled = runNativeCompiler('selfhost/compiler.rbc', SOURCE, rbcPath, {
    timeout: 120_000,
    maxBuffer: 64 * 1024 * 1024,
  });
  assert.equal(compiled.status, 'ok');
  const nativeRbc = fs.readFileSync(rbcPath);
  const bootstrapRbc = Buffer.from(compileRealityToBytecode(fs.readFileSync(SOURCE, 'utf8')));
  assert.equal(nativeRbc.equals(bootstrapRbc), true);
  const run = runNativeBytecode(rbcPath, {
    timeout: 120_000,
    maxBuffer: 64 * 1024 * 1024,
    requireNativeStateRoot: true,
  });
  assert.equal(run.stateRootVerified, true);
  assert.equal(run.state['evaluation.config_valid'], true);
  assert.equal(run.state['evaluation.state_shape_valid'], true);
  assert.equal(run.state['evaluation.state_shape_invalid_rejected'], true);
  fs.rmSync(directory, { recursive: true, force: true });
});

test('K08-K Tensor AdamW matches the frozen scalar Optimizer Genome fixture', () => {
  assert.equal(scalarDirect.status, 'ok');
  assert.equal(scalarDirect.telemetry.optimizerSemantics, 'rcl.adamw.v0.1');
  assert.ok(Math.abs(scalarDirect.parameters[0].storage.data[0] - 0.9780110003998002) <= 1e-12);
  assert.ok(Math.abs(scalarDirect.optimizerStates[0].firstMoment[0] - 0.09499999999999997) <= 1e-15);
  assert.ok(Math.abs(scalarDirect.optimizerStates[0].secondMoment[0] - 0.0004997500000000004) <= 1e-15);
  assert.equal(scalarDirect.optimizerStates[0].step, 2);
});

test('K08-K AdamW checkpoint/resume is exactly identical to uninterrupted Tensor training', () => {
  const first = executeAdamW(adamwRequest(buildScalarFixture(), ['p'], 1));
  const resumedGraph = applyParameters(buildScalarFixture(), first.parameters);
  const resumed = executeAdamW(adamwRequest(resumedGraph, ['p'], 1, STANDARD_CONFIG, first.optimizerStates));
  assert.deepEqual(resumed.parameters, scalarDirect.parameters);
  assert.deepEqual(resumed.optimizerStates, scalarDirect.optimizerStates);
  assert.equal(resumed.checkpointRoot, scalarDirect.checkpointRoot);
});

test('K08-K Tiny Decoder LM trains through Tensor AdamW and updates every parameter', { timeout: 180_000 }, () => {
  assert.equal(tinyTraining.status, 'ok');
  assert.equal(tinyTraining.parameters.length, PARAMETER_IDS.length);
  assert.equal(tinyTraining.optimizerStates.length, PARAMETER_IDS.length);
  assert.ok(tinyTraining.finalLoss < tinyTraining.initialLoss * 0.75, `loss did not fall enough: ${tinyTraining.initialLoss} -> ${tinyTraining.finalLoss}`);
  for (const parameter of tinyTraining.parameters) {
    const initial = INITIAL[parameter.tensor.id];
    assert.ok(initial, `unexpected trained parameter ${parameter.tensor.id}`);
    assert.ok(maximumDifference(parameter.storage.data, initial) > 0, `parameter did not update: ${parameter.tensor.id}`);
  }
  assert.equal(tinyTraining.optimizerStates.every((state) => state.step === 80), true);
  assert.equal(tinyTraining.optimizerStates.every((state) => state.firstMoment.every(Number.isFinite) && state.secondMoment.every(Number.isFinite)), true);
});

test('K08-K Tensor AdamW Tiny LM preserves autoregressive generation after training', { timeout: 180_000 }, () => {
  const trainedGraph = applyParameters(buildTinyLmGraph(), tinyTraining.parameters);
  const generated = greedyGenerate(trainedGraph, TRAINING_TOKENS, 6);
  assert.deepEqual(generated, [0, 1, 2, 0, 1, 2]);
});

test('K08-K Tensor AdamW replay is deterministic for the frozen CPU f64 profile', { timeout: 180_000 }, () => {
  const replay = executeAdamW(adamwRequest(
    buildTinyLmGraph(),
    PARAMETER_IDS,
    80,
    { ...STANDARD_CONFIG, learningRate: 0.03, weightDecay: 0.01 },
  ));
  assert.equal(replay.checkpointRoot, tinyTraining.checkpointRoot);
  assert.equal(replay.initialLoss, tinyTraining.initialLoss);
  assert.equal(replay.finalLoss, tinyTraining.finalLoss);
  assert.deepEqual(replay.parameters, tinyTraining.parameters);
  assert.deepEqual(replay.optimizerStates, tinyTraining.optimizerStates);
});

test('K08-K fails closed for invalid AdamW config and optimizer-state binding', () => {
  const invalidConfig = adamwRequest(buildScalarFixture(), ['p'], 1, { ...STANDARD_CONFIG, beta1: 1 });
  assert.equal(executeAdamW(invalidConfig, false).code, 'RCL_ADAMW_BETA1');

  const invalidState = adamwRequest(buildScalarFixture(), ['p'], 1, STANDARD_CONFIG, [{
    tensorId: 'p',
    step: 0,
    firstMoment: [],
    secondMoment: [0],
  }]);
  assert.equal(executeAdamW(invalidState, false).code, 'RCL_ADAMW_STATE_SHAPE');

  const contract = JSON.parse(fs.readFileSync(CONTRACT, 'utf8'));
  assert.equal(contract.format, 'rcl.k08-k.tensor-adamw-bridge-contract.v0.1');
  assert.equal(contract.canonicalOwner, 'RCL Optimizer Genome');
  assert.ok(contract.claimsGrantedOnAdmission.includes('TENSOR_ADAMW_BACKEND'));
  for (const claim of ['GENERAL_TOKENIZER', 'ROPE', 'MULTI_HEAD_ATTENTION', 'RCL_10M', 'GPU', 'RCL_1B_COMPLETE']) {
    assert.ok(contract.claimsNotGranted.includes(claim));
  }
});
