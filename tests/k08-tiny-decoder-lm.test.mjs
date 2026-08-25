import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { compileRealityToBytecode } from '../src/bytecode.mjs';
import { runNativeBytecode, runNativeCompiler } from '../src/native-vm.mjs';
import { buildEngine, executeRequest } from '../scripts/run-k08-native-autodiff.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = path.join(ROOT, 'examples', 'native-ai', 'tiny-decoder-lm-genome.rcl');
const CONTRACT = path.join(ROOT, 'examples', 'native-ai', 'tiny-decoder-lm-contract.v0.1.json');

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

function rmsNorm(builder, input, prefix) {
  const square = builder.node(`${prefix}.square`, 'mul', [input, input], [SEQUENCE, HIDDEN]);
  const mean = builder.node(`${prefix}.mean`, 'mean', [square], [SEQUENCE], { axis: 1 });
  const column = builder.node(`${prefix}.column`, 'reshape', [mean], [SEQUENCE, 1], { shape: [SEQUENCE, 1] });
  const shifted = builder.node(`${prefix}.shifted`, 'add', [column, 'epsilon'], [SEQUENCE, 1]);
  const root = builder.node(`${prefix}.root`, 'sqrt', [shifted], [SEQUENCE, 1]);
  const denominator = builder.node(`${prefix}.denominator`, 'broadcast', [root], [SEQUENCE, HIDDEN], { shape: [SEQUENCE, HIDDEN] });
  return builder.node(`${prefix}.normalized`, 'div', [input, denominator], [SEQUENCE, HIDDEN]);
}

function buildLmGraph(tokens = TRAINING_TOKENS, targetTokens = TARGET_TOKENS) {
  const builder = new GraphBuilder({
    campaign: 'K08-J',
    architecture: 'tiny-decoder-language-model',
    semanticOwner: 'RCL',
    tokenizer: 'fixed-three-symbol-token-ids',
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
    // lmHead is HIDDEN x VOCAB; HIDDEN == VOCAB in this bounded profile.
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

function autodiffRequest(graph) {
  return {
    format: 'rcl.tensor-autodiff-request.v0.1',
    graph,
    loss: 'loss',
    parameters: PARAMETER_IDS.map((tensorId) => ({ tensorId, gradientIdentity: `parameter:${tensorId}` })),
    stopGradients: [],
  };
}

function trainingRequest(graph, steps = 80, learningRate = 0.08) {
  return {
    format: 'rcl.tensor-autodiff-sgd-training-request.v0.1',
    autodiff: autodiffRequest(graph),
    steps,
    learningRate,
  };
}

function outputMap(result) {
  return new Map(result.outputs.map((item) => [item.tensor.id, item.storage.data]));
}

function argmax(values) {
  let best = 0;
  for (let index = 1; index < values.length; index += 1) if (values[index] > values[best]) best = index;
  return best;
}

function applyTrainedParameters(graph, trainingResult) {
  const copy = structuredClone(graph);
  for (const trained of trainingResult.parameters) {
    const tensor = copy.tensors.find((item) => item.id === trained.tensor.id);
    assert.ok(tensor, `missing parameter tensor ${trained.tensor.id}`);
    const storage = copy.storages.find((item) => item.identity === tensor.storageIdentity);
    assert.ok(storage, `missing parameter storage ${tensor.storageIdentity}`);
    storage.data = [...trained.storage.data];
    storage.identity = trained.storage.identity;
    tensor.storageIdentity = trained.storage.identity;
  }
  return copy;
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

function trainingRoot(result) {
  const payload = {
    initialLoss: result.initialLoss,
    finalLoss: result.finalLoss,
    parameters: result.parameters.map((item) => ({ id: item.tensor.id, data: item.storage.data })),
  };
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

let graph;
let gradients;
let training;

test.before(() => {
  buildEngine();
  graph = buildLmGraph();
  gradients = executeRequest(autodiffRequest(graph));
  training = executeRequest(trainingRequest(graph));
});

test('K08-J RCL Tiny Decoder LM Genome self-hosts with byte-identical RBC and native semantic root', { timeout: 180_000 }, () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-k08-j-tiny-lm-'));
  const rbcPath = path.join(directory, 'tiny-decoder-lm.rbc');
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
  assert.equal(run.state['evaluation.dimensions_valid'], true);
  assert.equal(run.state['evaluation.token_three_rejected'], true);
  assert.equal(run.state['evaluation.cycle_c_to_a'], true);
  fs.rmSync(directory, { recursive: true, force: true });
});

test('K08-J cross-entropy LM graph uses only generic Tensor primitives and reaches every trainable parameter', () => {
  assert.equal(gradients.gradients.length, PARAMETER_IDS.length);
  const ids = new Set(gradients.gradients.map((item) => item.parameter.tensorId));
  for (const id of PARAMETER_IDS) {
    assert.equal(ids.has(id), true, `missing gradient for ${id}`);
    const gradient = gradients.gradients.find((item) => item.parameter.tensorId === id).storage.data;
    assert.equal(gradient.every(Number.isFinite), true, `non-finite gradient for ${id}`);
  }
  const operations = new Set(graph.nodes.map((node) => node.operation));
  for (const operation of ['matmul', 'add', 'mul', 'div', 'transpose', 'reshape', 'broadcast', 'mean', 'sum', 'sqrt', 'activation', 'softmax', 'log']) {
    assert.equal(operations.has(operation), true, `missing generic primitive ${operation}`);
  }
  assert.deepEqual([...operations].filter((operation) => /gpt|transformer-special|lm-special|attention-special/i.test(operation)), []);
});

test('K08-J bounded native training lowers next-token cross-entropy', { timeout: 180_000 }, () => {
  assert.equal(training.status, 'ok');
  assert.equal(training.telemetry.optimizerSemantics, 'rcl.batch-sgd.v0.1');
  assert.ok(training.initialLoss > 0);
  assert.ok(training.finalLoss < training.initialLoss * 0.75, `loss did not fall enough: ${training.initialLoss} -> ${training.finalLoss}`);
  assert.ok(training.finalLoss < 0.55, `final loss remains too high: ${training.finalLoss}`);
  assert.equal(training.parameters.length, PARAMETER_IDS.length);
});

test('K08-J trained model performs greedy autoregressive next-token generation', { timeout: 180_000 }, () => {
  const trainedGraph = applyTrainedParameters(graph, training);
  const generated = greedyGenerate(trainedGraph, TRAINING_TOKENS, 6);
  assert.deepEqual(generated, [0, 1, 2, 0, 1, 2]);
});

test('K08-J training is deterministic for the frozen CPU f64 profile', { timeout: 180_000 }, () => {
  const replay = executeRequest(trainingRequest(buildLmGraph()));
  assert.equal(trainingRoot(replay), trainingRoot(training));
  assert.equal(replay.initialLoss, training.initialLoss);
  assert.equal(replay.finalLoss, training.finalLoss);
});

test('K08-J fails closed for model-special Tensor injection and keeps large-scale claims closed', () => {
  const forbidden = buildLmGraph();
  forbidden.nodes.find((node) => node.id === 'node:lm.logits').operation = 'gpt-special';
  assert.equal(executeRequest(forbidden, false).code, 'RCL_TENSOR_OPERATION_UNSUPPORTED');

  const contract = JSON.parse(fs.readFileSync(CONTRACT, 'utf8'));
  assert.equal(contract.format, 'rcl.k08-j.tiny-decoder-lm-contract.v0.1');
  assert.equal(contract.canonicalOwner, 'RCL');
  for (const claim of ['GENERAL_TOKENIZER', 'MULTI_HEAD_ATTENTION', 'TENSOR_ADAMW_BACKEND', 'LARGE_MODEL_SCALE', 'GPU', 'DISTRIBUTED_TRAINING', 'K400_PROMOTION']) {
    assert.ok(contract.claimsNotGranted.includes(claim));
  }
  const source = fs.readFileSync(SOURCE, 'utf8');
  assert.doesNotMatch(source, /gpt_special|transformer_special|lm_special|attention_model_opcode/i);
});
