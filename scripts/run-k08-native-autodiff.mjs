import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { runGeneralMlpOracle } from './run-k08-general-mlp.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST_PATH = path.join(ROOT, 'native', 'tensor-engine', 'Cargo.toml');
const ENGINE_PATH = path.join(
  ROOT,
  'native',
  'tensor-engine',
  'target',
  'release',
  process.platform === 'win32' ? 'rcl-tensor-engine.exe' : 'rcl-tensor-engine',
);
const CONTRACT_PATH = path.join(ROOT, 'examples', 'native-ai', 'general-mlp-contract.v0.1.json');
const GENERAL_MLP_SOURCE_PATH = path.join(ROOT, 'examples', 'native-ai', 'general-mlp.rcl');
const AUTODIFF_GENOME_PATH = path.join(ROOT, 'examples', 'native-ai', 'autodiff-genome.rcl');
const DEFAULT_EVIDENCE_PATH = path.join(
  ROOT,
  'examples',
  'native-ai',
  'evidence',
  'native-autodiff-v0.1',
  'k08-g-native-autodiff-evidence.json',
);

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

function canonicalJson(value) {
  return JSON.stringify(stable(value));
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function artifactHash(paths) {
  const hash = createHash('sha256');
  for (const artifactPath of [...paths].sort()) {
    hash.update(path.relative(ROOT, artifactPath).replaceAll('\\', '/'));
    hash.update('\0');
    hash.update(fs.readFileSync(artifactPath));
    hash.update('\0');
  }
  return hash.digest('hex');
}

function evidenceRoot(value) {
  return sha256(canonicalJson(value));
}

function maximumDifference(left, right) {
  if (left.length !== right.length) return Number.POSITIVE_INFINITY;
  return left.reduce((maximum, value, index) => Math.max(maximum, Math.abs(value - right[index])), 0);
}

function flattenModel(model) {
  return model.layers.flatMap((layer) => [...layer.weights, ...layer.biases]);
}

function exactF64Bits(values) {
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  return values.map((value) => {
    view.setFloat64(0, value, false);
    return view.getBigUint64(0, false).toString(16).padStart(16, '0');
  });
}

function buildEngine() {
  const run = spawnSync('cargo', ['build', '--release', '--locked', '--manifest-path', MANIFEST_PATH], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 180_000,
    maxBuffer: 32 * 1024 * 1024,
  });
  if (run.status !== 0) throw new Error(run.stderr || run.stdout || 'RCL_K08_G_CARGO_BUILD_FAILED');
}

function executeRequest(request, expectSuccess = true) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-k08-g-'));
  const requestPath = path.join(directory, 'request.json');
  fs.writeFileSync(requestPath, JSON.stringify(request));
  const run = spawnSync(ENGINE_PATH, ['execute', requestPath], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 180_000,
    maxBuffer: 64 * 1024 * 1024,
  });
  fs.rmSync(directory, { recursive: true, force: true });
  if (run.error) {
    throw new Error(`RCL_K08_G_EXECUTION_SPAWN: ${run.error.message}`);
  }
  if ((run.status === 0) !== expectSuccess) {
    throw new Error(run.stderr || run.stdout || 'RCL_K08_G_EXECUTION_STATUS');
  }
  const response = expectSuccess ? run.stdout : run.stderr;
  if (!response?.trim()) {
    throw new Error('RCL_K08_G_EXECUTION_EMPTY_RESPONSE');
  }
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
    this.graph.storages.push({ identity: storageIdentity, kind: 'cpu-dense', data });
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

function parameters(ids) {
  return ids.map((tensorId) => ({ tensorId, gradientIdentity: `parameter:${tensorId}` }));
}

function autodiffRequest(graph, loss, parameterIds, stopGradients = []) {
  return {
    format: 'rcl.tensor-autodiff-request.v0.1',
    graph,
    loss,
    parameters: parameters(parameterIds),
    stopGradients: stopGradients.map((tensorId) => ({ tensorId })),
  };
}

function gradientMap(result) {
  return new Map(result.gradients.map((gradient) => [gradient.parameter.tensorId, gradient.storage.data]));
}

function replaceTensorData(request, tensorId, data) {
  const clone = structuredClone(request);
  const tensor = clone.graph.tensors.find((item) => item.id === tensorId);
  const storage = clone.graph.storages.find((item) => item.identity === tensor.storageIdentity);
  storage.data = data;
  return clone;
}

function forwardLoss(request) {
  const plan = structuredClone(request.graph);
  plan.outputs = [request.loss];
  return executeRequest(plan).outputs[0].storage.data[0];
}

function finiteDifference(request, tensorId, epsilon = 1e-6) {
  const tensor = request.graph.tensors.find((item) => item.id === tensorId);
  const storage = request.graph.storages.find((item) => item.identity === tensor.storageIdentity);
  return storage.data.map((_, index) => {
    const plus = [...storage.data];
    const minus = [...storage.data];
    plus[index] += epsilon;
    minus[index] -= epsilon;
    return (forwardLoss(replaceTensorData(request, tensorId, plus))
      - forwardLoss(replaceTensorData(request, tensorId, minus))) / (2 * epsilon);
  });
}

function buildAnalyticFixture() {
  const builder = new GraphBuilder({ case: 'analytic-manual-finite-difference' });
  builder.tensor('x', [2], [-0.4, 0.7], 'parameter:x');
  builder.tensor('y', [2], [1.5, 2.0], 'parameter:y');
  builder.node('xy', 'mul', ['x', 'y'], [2]);
  builder.node('x_over_y', 'div', ['x', 'y'], [2]);
  builder.node('terms', 'add', ['xy', 'x_over_y'], [2]);
  builder.node('loss', 'sum', ['terms'], [], { axis: 0 });
  builder.graph.outputs = ['loss'];
  return autodiffRequest(builder.graph, 'loss', ['x', 'y']);
}

function buildPrimitiveFixture() {
  const builder = new GraphBuilder({ case: 'generic-primitives' });
  builder.tensor('x', [2, 2], [-0.4, 0.7, 0.2, -0.3], 'parameter:x');
  builder.tensor('w', [2, 2], [0.3, -0.2, 0.5, 0.4], 'parameter:w');
  builder.tensor('bias', [2], [0.1, -0.15], 'parameter:bias');
  builder.tensor('weights', [2, 2], [0.2, -0.5, 0.7, 0.3]);
  builder.node('w_t', 'transpose', ['w'], [2, 2], { permutation: [1, 0] });
  builder.node('projected', 'matmul', ['x', 'w_t'], [2, 2]);
  builder.node('bias_matrix', 'broadcast', ['bias'], [2, 2], { shape: [2, 2] });
  builder.node('biased', 'add', ['projected', 'bias_matrix'], [2, 2]);
  builder.node('activated', 'activation', ['biased'], [2, 2], { kind: 'softsign01' });
  builder.node('probabilities', 'softmax', ['activated'], [2, 2]);
  builder.node('weighted', 'mul', ['probabilities', 'weights'], [2, 2]);
  builder.node('rows', 'sum', ['weighted'], [2], { axis: 1 });
  builder.node('loss', 'mean', ['rows'], [], { axis: 0 });
  builder.graph.outputs = ['loss', 'probabilities'];
  return autodiffRequest(builder.graph, 'loss', ['x', 'w', 'bias'], ['weights']);
}

function buildUnaryFixture() {
  const builder = new GraphBuilder({ case: 'unary-reshape-reduction' });
  builder.tensor('x', [4], [-0.4, 0.7, 0.2, -0.3], 'parameter:x');
  builder.tensor('two', [], [2]);
  builder.tensor('ten', [], [10]);
  builder.node('absolute', 'abs', ['x'], [4]);
  builder.node('positive', 'add', ['absolute', 'two'], [4]);
  builder.node('logged', 'log', ['positive'], [4]);
  builder.node('rooted', 'sqrt', ['positive'], [4]);
  builder.node('scaled', 'div', ['x', 'ten'], [4]);
  builder.node('exponentiated', 'exp', ['scaled'], [4]);
  builder.node('difference', 'sub', ['rooted', 'logged'], [4]);
  builder.node('combined', 'add', ['difference', 'exponentiated'], [4]);
  builder.node('matrix', 'reshape', ['combined'], [2, 2], { shape: [2, 2] });
  builder.node('columns', 'sum', ['matrix'], [2], { axis: 0 });
  builder.node('loss', 'sum', ['columns'], [], { axis: 0 });
  builder.graph.outputs = ['loss'];
  return autodiffRequest(builder.graph, 'loss', ['x']);
}

function buildStopGradientFixture() {
  const builder = new GraphBuilder({ case: 'stop-gradient' });
  builder.tensor('x', [2], [0.25, -0.5], 'parameter:x');
  builder.node('stopped', 'stop-gradient', ['x'], [2]);
  builder.node('direct', 'mul', ['x', 'x'], [2]);
  builder.node('blocked', 'mul', ['stopped', 'x'], [2]);
  builder.node('combined', 'add', ['direct', 'blocked'], [2]);
  builder.node('loss', 'sum', ['combined'], [], { axis: 0 });
  builder.graph.outputs = ['loss'];
  return autodiffRequest(builder.graph, 'loss', ['x']);
}

function primitiveEvidence() {
  const analyticRequest = buildAnalyticFixture();
  const analytic = executeRequest(analyticRequest);
  const analyticGradients = gradientMap(analytic);
  const x = [-0.4, 0.7];
  const y = [1.5, 2.0];
  const manualX = y.map((value) => value + 1 / value);
  const manualY = y.map((value, index) => x[index] - x[index] / (value * value));
  const analyticDrift = Math.max(
    maximumDifference(analyticGradients.get('x'), manualX),
    maximumDifference(analyticGradients.get('y'), manualY),
  );
  const finiteDifferenceDrift = Math.max(
    maximumDifference(analyticGradients.get('x'), finiteDifference(analyticRequest, 'x')),
    maximumDifference(analyticGradients.get('y'), finiteDifference(analyticRequest, 'y')),
  );

  const fixtureResults = [buildPrimitiveFixture(), buildUnaryFixture()].map((request) => {
    const result = executeRequest(request);
    const gradients = gradientMap(result);
    const drifts = request.parameters.map((parameter) => maximumDifference(
      gradients.get(parameter.tensorId),
      finiteDifference(request, parameter.tensorId),
    ));
    return {
      case: request.graph.bindings.case,
      operations: [...new Set(request.graph.nodes.map((node) => node.operation))].sort(),
      maximumFiniteDifferenceDrift: Math.max(...drifts),
      backwardEdges: result.backwardEdges.length,
      accumulatorMerges: result.accumulator.mergeCount,
    };
  });
  const stop = executeRequest(buildStopGradientFixture());
  const stopGradient = gradientMap(stop).get('x');
  const stopExpected = [0.75, -1.5];
  const negative = executeRequest({
    ...buildAnalyticFixture(),
    parameters: [{ tensorId: 'missing', gradientIdentity: 'parameter:missing' }],
  }, false);
  const replays = Array.from({ length: 3 }, () => evidenceRoot(executeRequest(buildPrimitiveFixture()).gradients));
  return {
    analyticManualMaximumDrift: analyticDrift,
    finiteDifferenceMaximumDrift: Math.max(finiteDifferenceDrift, ...fixtureResults.map((item) => item.maximumFiniteDifferenceDrift)),
    externalOracle: 'independent-javascript-analytic-and-central-finite-difference',
    fixtures: fixtureResults,
    stopGradient: {
      gradient: stopGradient,
      expected: stopExpected,
      maximumDrift: maximumDifference(stopGradient, stopExpected),
    },
    negative: { code: negative.code, parameterMissingRejected: negative.code === 'RCL_AUTODIFF_PARAMETER_NOT_INITIAL' },
    deterministic: { replayRoots: replays, uniqueRoots: new Set(replays).size },
  };
}

function buildMlpGraph(task, model, bindings = {}) {
  const [inputSize, hiddenSize, outputSize] = task.architecture;
  const rows = task.dataset.length;
  const builder = new GraphBuilder({ ...bindings, task: task.id });
  builder.tensor('input', [rows, inputSize], task.dataset.flatMap((sample) => sample.input));
  builder.tensor('target', [rows, outputSize], task.dataset.flatMap((sample) => sample.target));
  builder.tensor('w1', [hiddenSize, inputSize], [...model.layers[0].weights], 'parameter:w1');
  builder.tensor('b1', [hiddenSize], [...model.layers[0].biases], 'parameter:b1');
  builder.tensor('w2', [outputSize, hiddenSize], [...model.layers[1].weights], 'parameter:w2');
  builder.tensor('b2', [outputSize], [...model.layers[1].biases], 'parameter:b2');
  builder.graph.exactStorageBits = {
    'storage:w1': exactF64Bits(model.layers[0].weights),
    'storage:b1': exactF64Bits(model.layers[0].biases),
    'storage:w2': exactF64Bits(model.layers[1].weights),
    'storage:b2': exactF64Bits(model.layers[1].biases),
  };
  builder.tensor('normalizer', [], [2 * rows * outputSize]);
  builder.node('w1_t', 'transpose', ['w1'], [inputSize, hiddenSize], { permutation: [1, 0] });
  builder.node('hidden_linear', 'matmul', ['input', 'w1_t'], [rows, hiddenSize]);
  builder.node('hidden_biased', 'add', ['hidden_linear', 'b1'], [rows, hiddenSize]);
  builder.node('hidden', 'activation', ['hidden_biased'], [rows, hiddenSize], { kind: 'softsign01' });
  builder.node('w2_t', 'transpose', ['w2'], [hiddenSize, outputSize], { permutation: [1, 0] });
  builder.node('output_linear', 'matmul', ['hidden', 'w2_t'], [rows, outputSize]);
  builder.node('output_biased', 'add', ['output_linear', 'b2'], [rows, outputSize]);
  builder.node('prediction', 'activation', ['output_biased'], [rows, outputSize], { kind: 'softsign01' });
  builder.node('error', 'sub', ['prediction', 'target'], [rows, outputSize]);
  builder.node('squared_error', 'mul', ['error', 'error'], [rows, outputSize]);
  builder.node('sample_error', 'sum', ['squared_error'], [rows], { axis: 1 });
  builder.node('total_error', 'sum', ['sample_error'], [], { axis: 0 });
  builder.node('loss', 'div', ['total_error', 'normalizer'], []);
  builder.graph.outputs = ['loss', 'prediction'];
  return autodiffRequest(builder.graph, 'loss', ['w1', 'b1', 'w2', 'b2'], ['input', 'target', 'normalizer']);
}

function modelFromTraining(result, task) {
  const map = new Map(result.parameters.map((value) => [value.tensor.id, value.storage.data]));
  const [inputSize, hiddenSize, outputSize] = task.architecture;
  return {
    layers: [
      { inputSize, outputSize: hiddenSize, activation: 'softsign01', weights: map.get('w1'), biases: map.get('b1') },
      { inputSize: hiddenSize, outputSize, activation: 'softsign01', weights: map.get('w2'), biases: map.get('b2') },
    ],
  };
}

function trainTask(task, model, steps, learningRate, phase, bindings = {}) {
  const autodiff = buildMlpGraph(task, model, { semanticOwner: 'RCL', ...bindings, phase });
  const request = {
    format: 'rcl.tensor-autodiff-sgd-training-request.v0.1',
    autodiff,
    steps,
    learningRate,
  };
  const started = performance.now();
  const result = executeRequest(request);
  return { result, model: modelFromTraining(result, task), wallMs: performance.now() - started, autodiff };
}

function evaluateTraining(result, task) {
  const prediction = result.outputs.find((output) => output.tensor.id === 'prediction').storage.data;
  const outputs = Array.from({ length: task.dataset.length }, (_, row) => prediction[row * task.architecture[2]]);
  const accuracy = outputs.filter((value, index) => (value >= 0.5 ? 1 : 0) === task.dataset[index].target[0]).length / outputs.length;
  return { outputs, loss: result.finalLoss, accuracy };
}

function generalMlpEvidence(contract) {
  const oracle = runGeneralMlpOracle(contract);
  const semanticBindings = {
    semanticOwner: 'RCL',
    modelSourceSha256: sha256(fs.readFileSync(GENERAL_MLP_SOURCE_PATH)),
    contractRoot: evidenceRoot(contract),
    autodiffGenomeSha256: sha256(fs.readFileSync(AUTODIFF_GENOME_PATH)),
    lowering: 'generic-tensor-autodiff-graph-v0.1',
  };
  const tasks = {};
  for (const task of contract.tasks) {
    const trained = trainTask(task, task.initialModel, task.epochs, contract.optimizer.learningRate, `train-${task.id}`, semanticBindings);
    const evaluation = evaluateTraining(trained.result, task);
    const oracleTask = oracle.tasks[task.id];
    tasks[task.id] = {
      architecture: task.architecture,
      initialLoss: trained.result.initialLoss,
      finalLoss: evaluation.loss,
      lossReduction: trained.result.initialLoss - evaluation.loss,
      accuracy: evaluation.accuracy,
      maximumParameterDriftVsManualOracle: maximumDifference(flattenModel(trained.model), flattenModel(oracleTask.finalModel)),
      maximumPredictionDriftVsManualOracle: maximumDifference(evaluation.outputs, oracleTask.final.outputs),
      trainingWallMs: trained.wallMs,
      nativeTrainingNanos: trained.result.telemetry.trainingNanos,
      parameterBytes: trained.result.telemetry.parameterBytes,
      optimizerSemantics: trained.result.telemetry.optimizerSemantics,
      operations: [...new Set(trained.autodiff.graph.nodes.map((node) => node.operation))].sort(),
      forbiddenModelSpecialOperations: trained.autodiff.graph.nodes.filter((node) => /xor|majority|mlp|transformer|attention/i.test(node.operation)),
    };
  }
  const checkpointTask = contract.tasks[0];
  const direct = trainTask(checkpointTask, checkpointTask.initialModel, 32, contract.optimizer.learningRate, 'checkpoint-direct-32', semanticBindings);
  const first = trainTask(checkpointTask, checkpointTask.initialModel, 16, contract.optimizer.learningRate, 'checkpoint-first-16', semanticBindings);
  const resumed = trainTask(checkpointTask, first.model, 16, contract.optimizer.learningRate, 'checkpoint-resumed-16', semanticBindings);
  return {
    semanticBindings,
    tasks,
    checkpoint: {
      directSteps: 32,
      splitSteps: [16, 16],
      exactResumeParity: canonicalJson(direct.model) === canonicalJson(resumed.model),
      maximumParameterDrift: maximumDifference(flattenModel(direct.model), flattenModel(resumed.model)),
      checkpointBytes: Buffer.byteLength(JSON.stringify(first.model)),
    },
    manualOracleRoot: oracle.root,
  };
}

export function runNativeAutodiffCampaign(options = {}) {
  buildEngine();
  const contract = JSON.parse(fs.readFileSync(CONTRACT_PATH, 'utf8'));
  const primitive = primitiveEvidence();
  const mlp = generalMlpEvidence(contract);
  const checks = {
    analyticManual: primitive.analyticManualMaximumDrift <= 1e-12,
    finiteDifference: primitive.finiteDifferenceMaximumDrift <= 2e-6,
    stopGradient: primitive.stopGradient.maximumDrift <= 1e-12,
    negative: primitive.negative.parameterMissingRejected,
    deterministic: primitive.deterministic.uniqueRoots === 1,
    xor: mlp.tasks.xor.accuracy === 1 && mlp.tasks.xor.finalLoss <= 0.03,
    majority3: mlp.tasks.majority3.accuracy === 1 && mlp.tasks.majority3.finalLoss <= 0.03,
    manualOracleDifferential: Object.values(mlp.tasks).every((task) => task.maximumParameterDriftVsManualOracle <= 1e-9 && task.maximumPredictionDriftVsManualOracle <= 1e-9),
    checkpoint: mlp.checkpoint.exactResumeParity && mlp.checkpoint.maximumParameterDrift === 0,
    noModelSpecialOperation: Object.values(mlp.tasks).every((task) => task.forbiddenModelSpecialOperations.length === 0),
  };
  const pass = Object.values(checks).every(Boolean);
  const report = {
    format: 'rcl.k08-g.native-autodiff-evidence.v0.1',
    status: pass ? 'ENGINE_E2_AUTODIFF_CANDIDATE' : 'FAIL_ENGINE_E2_AUTODIFF',
    generatedAt: new Date().toISOString(),
    semanticOwner: 'RCL Tensor and Autodiff Genome',
    executionOwner: 'rcl-tensor-autodiff-rust-v0.1',
    sourceCommit: options.sourceCommit ?? null,
    artifactHashes: {
      semanticSource: artifactHash([GENERAL_MLP_SOURCE_PATH, CONTRACT_PATH, AUTODIFF_GENOME_PATH]),
      rustExecutionOrgan: artifactHash([
        path.join(ROOT, 'native', 'tensor-engine', 'Cargo.toml'),
        path.join(ROOT, 'native', 'tensor-engine', 'Cargo.lock'),
        path.join(ROOT, 'native', 'tensor-engine', 'src', 'lib.rs'),
        path.join(ROOT, 'native', 'tensor-engine', 'src', 'autodiff.rs'),
      ]),
      loweringEvidenceOrgan: artifactHash([fileURLToPath(import.meta.url)]),
    },
    primitive,
    generalMlp: mlp,
    performance: {
      boundary: 'release Rust child process; trainingWallMs includes JSON file transport, process startup, forward, backward, Batch SGD updates and response serialization',
      compileTime: 'measured separately by CI/build logs; excluded from training samples',
      loweringTime: 'graph construction is in-process and included only in caller-side setup, not nativeTrainingNanos',
      peakRss: 'UNMEASURED_FOR_AUTODIFF_REQUEST',
      accelerator: 'CPU_ONLY',
    },
    checks,
    claimsNotGranted: ['ENGINE_E3_OPTIMIZER_GENOME', 'ADAM', 'ADAMW', 'TRANSFORMER', 'TINY_LM', 'GPU', 'GENERAL_PERFORMANCE_PARITY', 'K400_PROMOTION_FROM_THIS_CANDIDATE'],
    reportRoot: null,
  };
  report.reportRoot = evidenceRoot({ ...report, generatedAt: undefined, reportRoot: undefined });
  if (options.outputDir) {
    const outputPath = path.join(path.resolve(options.outputDir), 'k08-g-native-autodiff-evidence.json');
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  }
  if (options.acceptEvidence) {
    fs.mkdirSync(path.dirname(DEFAULT_EVIDENCE_PATH), { recursive: true });
    fs.writeFileSync(DEFAULT_EVIDENCE_PATH, `${JSON.stringify(report, null, 2)}\n`);
  }
  return report;
}

export {
  buildEngine,
  buildAnalyticFixture,
  buildMlpGraph,
  buildPrimitiveFixture,
  buildStopGradientFixture,
  buildUnaryFixture,
  executeRequest,
  finiteDifference,
  primitiveEvidence,
  trainTask,
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const outputDir = process.argv.slice(2).find((argument) => !argument.startsWith('--'));
  const report = runNativeAutodiffCampaign({
    acceptEvidence: process.argv.includes('--accept-evidence'),
    outputDir,
  });
  console.log(JSON.stringify({
    status: report.status,
    reportRoot: report.reportRoot,
    checks: report.checks,
    primitive: {
      analyticManualMaximumDrift: report.primitive.analyticManualMaximumDrift,
      finiteDifferenceMaximumDrift: report.primitive.finiteDifferenceMaximumDrift,
    },
    tasks: Object.fromEntries(Object.entries(report.generalMlp.tasks).map(([id, task]) => [id, {
      accuracy: task.accuracy,
      finalLoss: task.finalLoss,
      maximumParameterDriftVsManualOracle: task.maximumParameterDriftVsManualOracle,
      trainingWallMs: task.trainingWallMs,
    }])),
  }, null, 2));
  if (report.status.startsWith('FAIL')) process.exitCode = 1;
}
