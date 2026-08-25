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
const FRAME_BIN = path.join(
  ROOT,
  'native',
  'tensor-engine',
  'target',
  'release',
  process.platform === 'win32' ? 'rcl-rope-frame.exe' : 'rcl-rope-frame',
);
const SOURCE = path.join(ROOT, 'examples', 'native-ai', 'rope-genome.rcl');
const CONTRACT = path.join(ROOT, 'examples', 'native-ai', 'rope-contract.v0.1.json');

const SEQUENCE = 3;
const DIMENSION = 4;
const BASE = 10_000;

function buildRoPEFrameEngine() {
  const run = spawnSync('cargo', ['build', '--release', '--locked', '--manifest-path', TENSOR_MANIFEST, '--bin', 'rcl-rope-frame'], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 180_000,
    maxBuffer: 32 * 1024 * 1024,
  });
  if (run.status !== 0) throw new Error(run.stderr || run.stdout || 'RCL_K08_N_FRAME_BUILD_FAILED');
}

function frameRequest(overrides = {}, expectSuccess = true) {
  const request = {
    format: 'rcl.rope-position-frame-request.v0.1',
    sequenceLength: SEQUENCE,
    headDimension: DIMENSION,
    base: BASE,
    positionOffset: 0,
    maxPositionExclusive: 8,
    ...overrides,
  };
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-k08-n-frame-'));
  const requestPath = path.join(directory, 'request.json');
  fs.writeFileSync(requestPath, JSON.stringify(request));
  const run = spawnSync(FRAME_BIN, [requestPath], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 60_000,
    maxBuffer: 16 * 1024 * 1024,
  });
  fs.rmSync(directory, { recursive: true, force: true });
  if (run.error) throw run.error;
  if ((run.status === 0) !== expectSuccess) throw new Error(run.stderr || run.stdout || 'RCL_K08_N_FRAME_STATUS');
  return JSON.parse((expectSuccess ? run.stdout : run.stderr).trim());
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

function addRoPE(builder, input, frame, prefix = 'rope') {
  const rotatedPair = builder.node(`${prefix}.pairRotate`, 'matmul', [input, `${prefix}.rotation`], [SEQUENCE, DIMENSION]);
  const cosinePart = builder.node(`${prefix}.cosPart`, 'mul', [input, `${prefix}.cos`], [SEQUENCE, DIMENSION]);
  const sinePart = builder.node(`${prefix}.sinPart`, 'mul', [rotatedPair, `${prefix}.sin`], [SEQUENCE, DIMENSION]);
  return builder.node(`${prefix}.output`, 'add', [cosinePart, sinePart], [SEQUENCE, DIMENSION]);
}

function makeRoPEGraph(values, frame, { lossWeights = null } = {}) {
  const builder = new GraphBuilder({ campaign: 'K08-N', semanticOwner: 'RCL', lowering: 'generic-tensor-rope' });
  builder.tensor('x', [SEQUENCE, DIMENSION], values, 'parameter:x');
  builder.tensor('rope.cos', [SEQUENCE, DIMENSION], frame.cos);
  builder.tensor('rope.sin', [SEQUENCE, DIMENSION], frame.sin);
  builder.tensor('rope.rotation', [DIMENSION, DIMENSION], frame.rotationMatrix);
  const output = addRoPE(builder, 'x', frame, 'rope');
  if (lossWeights) {
    builder.tensor('lossWeights', [SEQUENCE, DIMENSION], lossWeights);
    const weighted = builder.node('loss.weighted', 'mul', [output, 'lossWeights'], [SEQUENCE, DIMENSION]);
    const perRow = builder.node('loss.perRow', 'sum', [weighted], [SEQUENCE], { axis: 1 });
    const loss = builder.node('loss', 'sum', [perRow], [], { axis: 0 });
    builder.graph.outputs = [output, loss];
  } else {
    builder.graph.outputs = [output];
  }
  return builder.graph;
}

function autodiffRequest(graph) {
  return {
    format: 'rcl.tensor-autodiff-request.v0.1',
    graph,
    loss: 'loss',
    parameters: [{ tensorId: 'x', gradientIdentity: 'parameter:x' }],
    stopGradients: [],
  };
}

function outputMap(result) {
  return new Map(result.outputs.map((item) => [item.tensor.id, item.storage.data]));
}

function directRoPE(values, frame) {
  const output = new Array(values.length).fill(0);
  for (let row = 0; row < SEQUENCE; row += 1) {
    for (let pair = 0; pair < DIMENSION / 2; pair += 1) {
      const even = row * DIMENSION + pair * 2;
      const odd = even + 1;
      const c = frame.cos[even];
      const s = frame.sin[even];
      const x0 = values[even];
      const x1 = values[odd];
      output[even] = x0 * c - x1 * s;
      output[odd] = x0 * s + x1 * c;
    }
  }
  return output;
}

function directFrame(sequenceLength, headDimension, base, positionOffset = 0) {
  const cos = new Array(sequenceLength * headDimension).fill(0);
  const sin = new Array(sequenceLength * headDimension).fill(0);
  for (let row = 0; row < sequenceLength; row += 1) {
    const position = positionOffset + row;
    for (let pair = 0; pair < headDimension / 2; pair += 1) {
      const theta = position / (base ** ((2 * pair) / headDimension));
      const even = row * headDimension + pair * 2;
      cos[even] = Math.cos(theta);
      cos[even + 1] = Math.cos(theta);
      sin[even] = Math.sin(theta);
      sin[even + 1] = Math.sin(theta);
    }
  }
  return { cos, sin };
}

function maxAbsDiff(left, right) {
  assert.equal(left.length, right.length);
  let maximum = 0;
  for (let index = 0; index < left.length; index += 1) maximum = Math.max(maximum, Math.abs(left[index] - right[index]));
  return maximum;
}

function sumWeighted(values, weights) {
  return values.reduce((sum, value, index) => sum + value * weights[index], 0);
}

let frame;
const VALUES = [
  0.2, -0.4, 0.6, 0.8,
  -0.1, 0.3, 0.5, -0.7,
  0.9, 0.2, -0.3, 0.4,
];
const LOSS_WEIGHTS = [
  0.4, -0.2, 0.1, 0.3,
  -0.5, 0.7, 0.2, -0.4,
  0.6, -0.1, 0.8, 0.5,
];

test.before(() => {
  buildEngine();
  buildRoPEFrameEngine();
  frame = frameRequest();
});

test('K08-N RCL RoPE Genome self-hosts with byte-identical RBC and native semantic root', { timeout: 180_000 }, () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-k08-n-source-'));
  const rbcPath = path.join(directory, 'rope.rbc');
  const compiled = runNativeCompiler('selfhost/compiler.rbc', SOURCE, rbcPath, { timeout: 120_000, maxBuffer: 64 * 1024 * 1024 });
  assert.equal(compiled.status, 'ok');
  const nativeRbc = fs.readFileSync(rbcPath);
  const bootstrapRbc = Buffer.from(compileRealityToBytecode(fs.readFileSync(SOURCE, 'utf8')));
  assert.equal(nativeRbc.equals(bootstrapRbc), true);
  const run = runNativeBytecode(rbcPath, { timeout: 120_000, maxBuffer: 64 * 1024 * 1024, requireNativeStateRoot: true });
  assert.equal(run.stateRootVerified, true);
  assert.equal(run.state['evaluation.position_zero_identity'], true);
  assert.equal(run.state['evaluation.quarter_turn_fixture'], true);
  assert.equal(run.state['evaluation.norm_preserved_fixture'], true);
  fs.rmSync(directory, { recursive: true, force: true });
});

test('K08-N rooted position frame matches an independent JS angle oracle and position zero is identity', () => {
  const oracle = directFrame(SEQUENCE, DIMENSION, BASE, 0);
  assert.ok(maxAbsDiff(frame.cos, oracle.cos) <= 1e-15);
  assert.ok(maxAbsDiff(frame.sin, oracle.sin) <= 1e-15);
  assert.deepEqual(frame.cos.slice(0, DIMENSION), [1, 1, 1, 1]);
  assert.deepEqual(frame.sin.slice(0, DIMENSION), [0, 0, 0, 0]);
  assert.match(frame.frameRoot, /^sha256:[0-9a-f]{64}$/);
  assert.equal(frameRequest().frameRoot, frame.frameRoot);
});

test('K08-N generic Tensor matmul/mul/add lowering matches direct RoPE and preserves pair norms', () => {
  const graph = makeRoPEGraph(VALUES, frame);
  const result = executeRequest(graph);
  const actual = outputMap(result).get('rope.output');
  const expected = directRoPE(VALUES, frame);
  assert.ok(maxAbsDiff(actual, expected) <= 1e-15);

  for (let row = 0; row < SEQUENCE; row += 1) {
    for (let pair = 0; pair < DIMENSION / 2; pair += 1) {
      const even = row * DIMENSION + pair * 2;
      const before = VALUES[even] ** 2 + VALUES[even + 1] ** 2;
      const after = actual[even] ** 2 + actual[even + 1] ** 2;
      assert.ok(Math.abs(before - after) <= 1e-12);
    }
  }
  const operations = new Set(graph.nodes.map((node) => node.operation));
  assert.deepEqual([...operations].sort(), ['add', 'matmul', 'mul']);
});

test('K08-N reverse-mode gradient through RoPE agrees with finite difference', () => {
  const graph = makeRoPEGraph(VALUES, frame, { lossWeights: LOSS_WEIGHTS });
  const autodiff = executeRequest(autodiffRequest(graph));
  const analytic = autodiff.gradients.find((item) => item.parameter.tensorId === 'x').storage.data;
  const epsilon = 1e-6;
  const numeric = [];
  for (let index = 0; index < VALUES.length; index += 1) {
    const plus = [...VALUES];
    const minus = [...VALUES];
    plus[index] += epsilon;
    minus[index] -= epsilon;
    const plusOutput = directRoPE(plus, frame);
    const minusOutput = directRoPE(minus, frame);
    numeric.push((sumWeighted(plusOutput, LOSS_WEIGHTS) - sumWeighted(minusOutput, LOSS_WEIGHTS)) / (2 * epsilon));
  }
  assert.ok(maxAbsDiff(analytic, numeric) < 2e-9, `gradient drift ${maxAbsDiff(analytic, numeric)}`);
});

test('K08-N RoPE composes into Q/K attention scores with generic Tensor operations', () => {
  const builder = new GraphBuilder({ campaign: 'K08-N', integration: 'qk-attention' });
  const q = VALUES;
  const k = VALUES.map((value, index) => value * (index % 3 === 0 ? -0.7 : 0.55));
  builder.tensor('q', [SEQUENCE, DIMENSION], q);
  builder.tensor('k', [SEQUENCE, DIMENSION], k);
  for (const prefix of ['qrope', 'krope']) {
    builder.tensor(`${prefix}.cos`, [SEQUENCE, DIMENSION], frame.cos);
    builder.tensor(`${prefix}.sin`, [SEQUENCE, DIMENSION], frame.sin);
    builder.tensor(`${prefix}.rotation`, [DIMENSION, DIMENSION], frame.rotationMatrix);
  }
  const qRot = addRoPE(builder, 'q', frame, 'qrope');
  const kRot = addRoPE(builder, 'k', frame, 'krope');
  const kt = builder.node('attention.kt', 'transpose', [kRot], [DIMENSION, SEQUENCE], { permutation: [1, 0] });
  const scores = builder.node('attention.scores', 'matmul', [qRot, kt], [SEQUENCE, SEQUENCE]);
  builder.graph.outputs = [qRot, kRot, scores];
  const result = executeRequest(builder.graph);
  const outputs = outputMap(result);
  const expectedQ = directRoPE(q, frame);
  const expectedK = directRoPE(k, frame);
  assert.ok(maxAbsDiff(outputs.get(qRot), expectedQ) <= 1e-15);
  assert.ok(maxAbsDiff(outputs.get(kRot), expectedK) <= 1e-15);
  assert.equal(outputs.get(scores).length, SEQUENCE * SEQUENCE);
  assert.equal(outputs.get(qRot).slice(0, DIMENSION).every((value, index) => value === q[index]), true);
});

test('K08-N invalid frame boundaries and rope-special Tensor injection fail closed', () => {
  assert.equal(frameRequest({ headDimension: 3 }, false).code, 'RCL_ROPE_HEAD_DIMENSION');
  assert.equal(frameRequest({ sequenceLength: 0 }, false).code, 'RCL_ROPE_SEQUENCE_LENGTH');
  assert.equal(frameRequest({ base: 1 }, false).code, 'RCL_ROPE_BASE');
  assert.equal(frameRequest({ sequenceLength: 4, positionOffset: 6, maxPositionExclusive: 8 }, false).code, 'RCL_ROPE_POSITION_OVERFLOW');

  const forbidden = makeRoPEGraph(VALUES, frame);
  forbidden.nodes.find((node) => node.id === 'node:rope.output').operation = 'rope-special';
  assert.equal(executeRequest(forbidden, false).code, 'RCL_TENSOR_OPERATION_UNSUPPORTED');
});

test('K08-N contract grants RoPE positional semantics only and keeps later scale gates closed', () => {
  const contract = JSON.parse(fs.readFileSync(CONTRACT, 'utf8'));
  assert.equal(contract.format, 'rcl.k08-n.rope-contract.v0.1');
  assert.equal(contract.canonicalOwner, 'RCL');
  assert.ok(contract.claimsGrantedOnAdmission.includes('ROPE_POSITIONAL_SEMANTICS'));
  assert.ok(contract.claimsGrantedOnAdmission.includes('ROOTED_ROPE_POSITION_FRAME'));
  assert.ok(contract.claimsGrantedOnAdmission.includes('GENERIC_TENSOR_ROPE_LOWERING'));
  for (const claim of ['MULTI_HEAD_ATTENTION', 'GQA', 'MULTI_BLOCK_LM', 'RCL_10M', 'BF16', 'GPU', 'RCL_1B_COMPLETE']) {
    assert.ok(contract.claimsNotGranted.includes(claim));
  }
});
