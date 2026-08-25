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
const SOURCE = path.join(ROOT, 'examples', 'native-ai', 'transformer-block-genome.rcl');
const CONTRACT = path.join(ROOT, 'examples', 'native-ai', 'transformer-block-contract.v0.1.json');

const SEQUENCE = 3;
const HIDDEN = 2;
const FF = 3;
const EPSILON = 1e-5;

const FIXTURE = Object.freeze({
  x: [0.5, -0.2, 0.1, 0.4, -0.3, 0.2],
  target: [0.45, -0.1, 0.15, 0.35, -0.25, 0.25],
  wq: [0.2, -0.1, 0.05, 0.3],
  wk: [0.1, 0.25, -0.2, 0.15],
  wv: [0.3, -0.05, 0.1, 0.2],
  wo: [0.25, 0.05, -0.1, 0.3],
  w1: [0.1, -0.2, 0.3, 0.25, 0.15, -0.1],
  w2: [0.2, -0.1, 0.05, 0.3, -0.15, 0.25],
});

const PARAMETER_IDS = ['wq', 'wk', 'wv', 'wo', 'w1', 'w2'];

class GraphBuilder {
  constructor() {
    this.graph = {
      format: 'rcl.tensor-execution-plan.v0.1',
      bindings: {
        campaign: 'K08-I',
        architecture: 'decoder-transformer-block',
        semanticOwner: 'RCL',
      },
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

function buildTransformerGraph() {
  const builder = new GraphBuilder();
  builder.tensor('x', [SEQUENCE, HIDDEN], FIXTURE.x);
  builder.tensor('target', [SEQUENCE, HIDDEN], FIXTURE.target);
  builder.tensor('epsilon', [1], [EPSILON]);
  builder.tensor('attentionScale', [1], [1 / Math.sqrt(HIDDEN)]);
  builder.tensor('causalMask', [SEQUENCE, SEQUENCE], [
    0, -20, -20,
    0, 0, -20,
    0, 0, 0,
  ]);
  builder.tensor('wq', [HIDDEN, HIDDEN], FIXTURE.wq, 'parameter:wq');
  builder.tensor('wk', [HIDDEN, HIDDEN], FIXTURE.wk, 'parameter:wk');
  builder.tensor('wv', [HIDDEN, HIDDEN], FIXTURE.wv, 'parameter:wv');
  builder.tensor('wo', [HIDDEN, HIDDEN], FIXTURE.wo, 'parameter:wo');
  builder.tensor('w1', [HIDDEN, FF], FIXTURE.w1, 'parameter:w1');
  builder.tensor('w2', [FF, HIDDEN], FIXTURE.w2, 'parameter:w2');

  const norm1 = rmsNorm(builder, 'x', 'norm1');
  const q = builder.node('q', 'matmul', [norm1, 'wq'], [SEQUENCE, HIDDEN]);
  const k = builder.node('k', 'matmul', [norm1, 'wk'], [SEQUENCE, HIDDEN]);
  const v = builder.node('v', 'matmul', [norm1, 'wv'], [SEQUENCE, HIDDEN]);
  const kt = builder.node('kt', 'transpose', [k], [HIDDEN, SEQUENCE], { permutation: [1, 0] });
  const rawScores = builder.node('attention.rawScores', 'matmul', [q, kt], [SEQUENCE, SEQUENCE]);
  const scaledScores = builder.node('attention.scaledScores', 'mul', [rawScores, 'attentionScale'], [SEQUENCE, SEQUENCE]);
  const maskedScores = builder.node('attention.maskedScores', 'add', [scaledScores, 'causalMask'], [SEQUENCE, SEQUENCE]);
  const probabilities = builder.node('attention.probabilities', 'softmax', [maskedScores], [SEQUENCE, SEQUENCE]);
  const context = builder.node('attention.context', 'matmul', [probabilities, v], [SEQUENCE, HIDDEN]);
  const projected = builder.node('attention.projected', 'matmul', [context, 'wo'], [SEQUENCE, HIDDEN]);
  const residual1 = builder.node('residual1', 'add', ['x', projected], [SEQUENCE, HIDDEN]);

  const norm2 = rmsNorm(builder, residual1, 'norm2');
  const ffPre = builder.node('ff.pre', 'matmul', [norm2, 'w1'], [SEQUENCE, FF]);
  const ffGate = builder.node('ff.sigmoid', 'activation', [ffPre], [SEQUENCE, FF], { kind: 'sigmoid' });
  const ffSilu = builder.node('ff.silu', 'mul', [ffPre, ffGate], [SEQUENCE, FF]);
  const ffProjected = builder.node('ff.projected', 'matmul', [ffSilu, 'w2'], [SEQUENCE, HIDDEN]);
  const output = builder.node('block.output', 'add', [residual1, ffProjected], [SEQUENCE, HIDDEN]);

  const difference = builder.node('loss.difference', 'sub', [output, 'target'], [SEQUENCE, HIDDEN]);
  const squared = builder.node('loss.squared', 'mul', [difference, difference], [SEQUENCE, HIDDEN]);
  const rowMean = builder.node('loss.rowMean', 'mean', [squared], [SEQUENCE], { axis: 1 });
  const loss = builder.node('loss', 'mean', [rowMean], [], { axis: 0 });
  builder.graph.outputs = [output, probabilities, loss];
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

function matmul(left, leftRows, leftCols, right, rightCols) {
  const output = new Array(leftRows * rightCols).fill(0);
  for (let row = 0; row < leftRows; row += 1) {
    for (let inner = 0; inner < leftCols; inner += 1) {
      for (let column = 0; column < rightCols; column += 1) {
        output[row * rightCols + column] += left[row * leftCols + inner] * right[inner * rightCols + column];
      }
    }
  }
  return output;
}

function transpose2d(values, rows, columns) {
  const output = new Array(values.length);
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) output[column * rows + row] = values[row * columns + column];
  }
  return output;
}

function rmsNormOracle(values, rows, width) {
  const output = new Array(values.length);
  for (let row = 0; row < rows; row += 1) {
    let square = 0;
    for (let column = 0; column < width; column += 1) square += values[row * width + column] ** 2;
    const denominator = Math.sqrt(square / width + EPSILON);
    for (let column = 0; column < width; column += 1) output[row * width + column] = values[row * width + column] / denominator;
  }
  return output;
}

function add(left, right) {
  return left.map((value, index) => value + right[index]);
}

function softmaxRows(values, rows, width) {
  const output = new Array(values.length);
  for (let row = 0; row < rows; row += 1) {
    const start = row * width;
    const maximum = Math.max(...values.slice(start, start + width));
    const exponentials = values.slice(start, start + width).map((value) => Math.exp(value - maximum));
    const denominator = exponentials.reduce((sum, value) => sum + value, 0);
    for (let column = 0; column < width; column += 1) output[start + column] = exponentials[column] / denominator;
  }
  return output;
}

function forwardOracle(fixture = FIXTURE) {
  const norm1 = rmsNormOracle(fixture.x, SEQUENCE, HIDDEN);
  const q = matmul(norm1, SEQUENCE, HIDDEN, fixture.wq, HIDDEN);
  const k = matmul(norm1, SEQUENCE, HIDDEN, fixture.wk, HIDDEN);
  const v = matmul(norm1, SEQUENCE, HIDDEN, fixture.wv, HIDDEN);
  const scores = matmul(q, SEQUENCE, HIDDEN, transpose2d(k, SEQUENCE, HIDDEN), SEQUENCE)
    .map((value) => value / Math.sqrt(HIDDEN));
  const mask = [0, -20, -20, 0, 0, -20, 0, 0, 0];
  const probabilities = softmaxRows(add(scores, mask), SEQUENCE, SEQUENCE);
  const context = matmul(probabilities, SEQUENCE, SEQUENCE, v, HIDDEN);
  const projected = matmul(context, SEQUENCE, HIDDEN, fixture.wo, HIDDEN);
  const residual1 = add(fixture.x, projected);
  const norm2 = rmsNormOracle(residual1, SEQUENCE, HIDDEN);
  const ffPre = matmul(norm2, SEQUENCE, HIDDEN, fixture.w1, FF);
  const ffSilu = ffPre.map((value) => value * (1 / (1 + Math.exp(-value))));
  const ffProjected = matmul(ffSilu, SEQUENCE, FF, fixture.w2, HIDDEN);
  const output = add(residual1, ffProjected);
  const loss = output.reduce((sum, value, index) => sum + (value - fixture.target[index]) ** 2, 0) / output.length;
  return { output, probabilities, loss };
}

function outputMap(planResult) {
  return new Map(planResult.outputs.map((item) => [item.tensor.id, item.storage.data]));
}

function maxDifference(left, right) {
  assert.equal(left.length, right.length);
  return left.reduce((maximum, value, index) => Math.max(maximum, Math.abs(value - right[index])), 0);
}

function perturb(graph, tensorId, delta) {
  const copy = structuredClone(graph);
  const tensor = copy.tensors.find((item) => item.id === tensorId);
  const storage = copy.storages.find((item) => item.identity === tensor.storageIdentity);
  storage.data[0] += delta;
  return copy;
}

function lossFromGraph(graph) {
  const result = executeRequest(graph);
  return outputMap(result).get('loss')[0];
}

function deterministicRoot(result) {
  const payload = {
    loss: result.loss.storage.data,
    gradients: result.gradients.map((item) => ({
      tensorId: item.parameter.tensorId,
      data: item.storage.data,
    })),
  };
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

let graph;
let forward;
let backward;

test.before(() => {
  buildEngine();
  graph = buildTransformerGraph();
  forward = executeRequest(graph);
  backward = executeRequest(autodiffRequest(graph));
});

test('K08-I RCL Transformer Block Genome self-hosts with byte-identical RBC and native semantic root', { timeout: 180_000 }, () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-k08-i-transformer-'));
  const rbcPath = path.join(directory, 'transformer-block.rbc');
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
  assert.equal(run.state['evaluation.causal_future_blocked'], true);
  assert.equal(run.state['evaluation.head_width_valid'], true);
  fs.rmSync(directory, { recursive: true, force: true });
});

test('K08-I generic Tensor graph matches an independent decoder-block forward oracle', () => {
  const outputs = outputMap(forward);
  const oracle = forwardOracle();
  assert.ok(maxDifference(outputs.get('block.output'), oracle.output) <= 1e-12);
  assert.ok(maxDifference(outputs.get('attention.probabilities'), oracle.probabilities) <= 1e-12);
  assert.ok(Math.abs(outputs.get('loss')[0] - oracle.loss) <= 1e-12);
  for (let row = 0; row < SEQUENCE; row += 1) {
    const probabilities = outputs.get('attention.probabilities').slice(row * SEQUENCE, (row + 1) * SEQUENCE);
    assert.ok(Math.abs(probabilities.reduce((sum, value) => sum + value, 0) - 1) <= 1e-12);
    for (let future = row + 1; future < SEQUENCE; future += 1) assert.ok(probabilities[future] < 1e-7);
  }
});

test('K08-I reverse-mode Autodiff reaches every Transformer parameter and agrees with finite differences', { timeout: 180_000 }, () => {
  assert.equal(backward.gradients.length, PARAMETER_IDS.length);
  const gradients = new Map(backward.gradients.map((item) => [item.parameter.tensorId, item.storage.data]));
  const delta = 1e-6;
  for (const parameter of PARAMETER_IDS) {
    const analytic = gradients.get(parameter)[0];
    assert.equal(Number.isFinite(analytic), true);
    const finite = (lossFromGraph(perturb(graph, parameter, delta)) - lossFromGraph(perturb(graph, parameter, -delta))) / (2 * delta);
    assert.ok(Math.abs(analytic - finite) <= 2e-5, `${parameter} gradient drift: analytic=${analytic} finite=${finite}`);
  }
  assert.ok(backward.backwardEdges.length > 20);
  assert.ok(backward.accumulator.mergeCount > 0);
});

test('K08-I deterministic replay is stable and no model-special Tensor operation exists', { timeout: 180_000 }, () => {
  const roots = new Set([deterministicRoot(backward)]);
  roots.add(deterministicRoot(executeRequest(autodiffRequest(graph))));
  roots.add(deterministicRoot(executeRequest(autodiffRequest(graph))));
  assert.equal(roots.size, 1);
  const operations = new Set(graph.nodes.map((node) => node.operation));
  assert.deepEqual([...operations].filter((operation) => /transformer|gpt|attention-special|decoder-special/i.test(operation)), []);
  for (const operation of ['matmul', 'transpose', 'mul', 'add', 'softmax', 'mean', 'sqrt', 'broadcast', 'reshape', 'div', 'activation']) {
    assert.equal(operations.has(operation), true, `missing generic primitive ${operation}`);
  }
});

test('K08-I fails closed for an invalid causal-mask shape and a model-special operation', () => {
  const badMask = structuredClone(graph);
  const maskTensor = badMask.tensors.find((item) => item.id === 'causalMask');
  const maskStorage = badMask.storages.find((item) => item.identity === maskTensor.storageIdentity);
  maskTensor.shape = [2, 2];
  maskStorage.data = [0, -20, 0, 0];
  assert.equal(executeRequest(badMask, false).code, 'RCL_TENSOR_BROADCAST_INVALID');

  const forbidden = structuredClone(graph);
  forbidden.nodes.find((node) => node.id === 'node:q').operation = 'transformer-special';
  assert.equal(executeRequest(forbidden, false).code, 'RCL_TENSOR_OPERATION_UNSUPPORTED');
});

test('K08-I contract keeps Tiny LM, multi-head, Tensor AdamW and accelerator claims closed', () => {
  const contract = JSON.parse(fs.readFileSync(CONTRACT, 'utf8'));
  assert.equal(contract.format, 'rcl.k08-i.transformer-block-contract.v0.1');
  assert.equal(contract.canonicalOwner, 'RCL');
  assert.equal(contract.acceptance.modelSpecialOperationCount, 0);
  for (const claim of ['MULTI_HEAD_ATTENTION', 'TINY_LM', 'TENSOR_ADAMW_BACKEND', 'GPU', 'K400_PROMOTION']) {
    assert.ok(contract.claimsNotGranted.includes(claim));
  }
  const source = fs.readFileSync(SOURCE, 'utf8');
  assert.doesNotMatch(source, /transformer_special|gpt_special|attention_model_opcode/i);
});
