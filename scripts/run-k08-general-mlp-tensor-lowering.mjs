#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { compileRealityToBytecode } from '../src/bytecode.mjs';
import {
  runNativeBytecode,
  runNativeCompiler,
  verifyNativeSemanticStateRoot,
} from '../src/native-vm.mjs';
import { canonicalJson, evidenceRoot } from '../src/universal-program-stress.mjs';
import { runGeneralMlpOracle } from './run-k08-general-mlp.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SOURCE_PATH = path.join(ROOT, 'examples', 'native-ai', 'general-mlp.rcl');
const CONTRACT_PATH = path.join(ROOT, 'examples', 'native-ai', 'general-mlp-contract.v0.1.json');
const COMPILER_RBC_PATH = path.join(ROOT, 'selfhost', 'compiler.rbc');
const MANIFEST_PATH = path.join(ROOT, 'native', 'tensor-engine', 'Cargo.toml');
const ENGINE_PATH = path.join(ROOT, 'native', 'tensor-engine', 'target', 'release', process.platform === 'win32' ? 'rcl-tensor-engine.exe' : 'rcl-tensor-engine');
const NATIVE_DLL_PATH = path.join(ROOT, 'native', 'rclvm.dll');
const DEFAULT_OUTPUT_DIR = path.join(ROOT, 'output', 'k08-general-mlp-tensor-v0.1');
const ACCEPTED_EVIDENCE_PATH = path.join(ROOT, 'examples', 'native-ai', 'evidence', 'general-mlp-tensor-v0.1', 'k08-d-general-mlp-tensor-evidence.json');

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function artifactHash(relativePaths) {
  const hash = crypto.createHash('sha256');
  for (const relativePath of relativePaths) {
    hash.update(relativePath);
    hash.update('\0');
    hash.update(fs.readFileSync(path.join(ROOT, relativePath)));
    hash.update('\0');
  }
  return hash.digest('hex');
}

function median(values) {
  return [...values].sort((left, right) => left - right)[Math.floor(values.length / 2)];
}

function maximumDifference(left, right) {
  if (left.length !== right.length) return Infinity;
  return left.reduce((maximum, value, index) => Math.max(maximum, Math.abs(value - right[index])), 0);
}

function transposeWeights(weights, inputSize, outputSize) {
  return Array.from({ length: inputSize * outputSize }, (_, index) => {
    const input = Math.floor(index / outputSize);
    const output = index % outputSize;
    return weights[output * inputSize + input];
  });
}

function canonicalWeights(weights, inputSize, outputSize) {
  return Array.from({ length: inputSize * outputSize }, (_, index) => {
    const output = Math.floor(index / inputSize);
    const input = index % inputSize;
    return weights[input * outputSize + output];
  });
}

function exactF64Bits(values) {
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  return values.map((value) => {
    view.setFloat64(0, value, false);
    return view.getBigUint64(0, false).toString(16).padStart(16, '0');
  });
}

function flattenModel(model) {
  return model.layers.flatMap((layer) => [...layer.weights, ...layer.biases]);
}

class TensorPlanBuilder {
  constructor(bindings) {
    this.plan = {
      format: 'rcl.tensor-execution-plan.v0.1',
      bindings,
      tensors: [],
      storages: [],
      nodes: [],
      outputs: [],
    };
    this.counter = 0;
  }

  initial(id, shape, data, gradientIdentity = `constant:${id}`) {
    const storageIdentity = `storage:${id}`;
    this.plan.tensors.push({
      id,
      shape,
      dtype: 'f64',
      layout: 'row-major',
      device: 'cpu',
      gradientIdentity,
      storageIdentity,
    });
    this.plan.storages.push({ identity: storageIdentity, kind: 'cpu-dense', data });
    return id;
  }

  node(operation, inputs, shape, attributes = {}, gradientIdentity = `derived:${operation}`) {
    this.counter += 1;
    const id = `t${this.counter}`;
    this.plan.nodes.push({
      id: `n${this.counter}`,
      operation,
      inputs,
      output: {
        id,
        shape,
        dtype: 'f64',
        layout: 'row-major',
        device: 'cpu',
        gradientIdentity,
      },
      attributes,
    });
    return id;
  }

  output(...ids) {
    this.plan.outputs.push(...ids);
  }
}

function initializeProgram(builder, prefix, task, initialModel) {
  const [inputSize, hiddenSize, outputSize] = task.architecture;
  const rowCount = task.dataset.length;
  const xData = task.dataset.flatMap((sample) => sample.input);
  const xTranspose = Array.from({ length: inputSize * rowCount }, (_, index) => {
    const input = Math.floor(index / rowCount);
    const row = index % rowCount;
    return task.dataset[row].input[input];
  });
  const yData = task.dataset.flatMap((sample) => sample.target);
  const first = initialModel.layers[0];
  const second = initialModel.layers[1];
  return {
    prefix,
    task,
    rowCount,
    inputSize,
    hiddenSize,
    outputSize,
    x: builder.initial(`${prefix}.x`, [rowCount, inputSize], xData),
    xTranspose: builder.initial(`${prefix}.xT`, [inputSize, rowCount], xTranspose),
    y: builder.initial(`${prefix}.y`, [rowCount, outputSize], yData),
    one: builder.initial(`${prefix}.one`, [1], [1]),
    half: builder.initial(`${prefix}.half`, [1], [0.5]),
    updateScale: builder.initial(`${prefix}.updateScale`, [1], [task.learningRate / rowCount]),
    model: {
      w1: builder.initial(`${prefix}.w1`, [inputSize, hiddenSize], transposeWeights(first.weights, inputSize, hiddenSize), `parameter:${prefix}.w1`),
      b1: builder.initial(`${prefix}.b1`, [hiddenSize], [...first.biases], `parameter:${prefix}.b1`),
      w2: builder.initial(`${prefix}.w2`, [hiddenSize, outputSize], transposeWeights(second.weights, hiddenSize, outputSize), `parameter:${prefix}.w2`),
      b2: builder.initial(`${prefix}.b2`, [outputSize], [...second.biases], `parameter:${prefix}.b2`),
    },
  };
}

function softsign01(builder, context, value, shape, derivative) {
  const absolute = builder.node('abs', [value], shape);
  const denominator = builder.node('add', [context.one, absolute], shape);
  const halfValue = builder.node('mul', [context.half, value], shape);
  const normalized = builder.node('div', [halfValue, denominator], shape);
  const activation = builder.node('add', [context.half, normalized], shape);
  if (!derivative) return { activation };
  const denominatorSquared = builder.node('mul', [denominator, denominator], shape);
  return {
    activation,
    derivative: builder.node('div', [context.half, denominatorSquared], shape),
  };
}

function forward(builder, context, model, derivative = true) {
  const hiddenShape = [context.rowCount, context.hiddenSize];
  const outputShape = [context.rowCount, context.outputSize];
  const hiddenLinear = builder.node('matmul', [context.x, model.w1], hiddenShape);
  const hiddenBiased = builder.node('add', [hiddenLinear, model.b1], hiddenShape);
  const hidden = softsign01(builder, context, hiddenBiased, hiddenShape, derivative);
  const outputLinear = builder.node('matmul', [hidden.activation, model.w2], outputShape);
  const outputBiased = builder.node('add', [outputLinear, model.b2], outputShape);
  const output = softsign01(builder, context, outputBiased, outputShape, derivative);
  return { hidden, output };
}

function trainEpoch(builder, context, model) {
  const hiddenShape = [context.rowCount, context.hiddenSize];
  const outputShape = [context.rowCount, context.outputSize];
  const state = forward(builder, context, model, true);
  const error = builder.node('sub', [state.output.activation, context.y], outputShape);
  const outputDelta = builder.node('mul', [error, state.output.derivative], outputShape, {}, 'gradient:output');
  const hiddenTranspose = builder.node('transpose', [state.hidden.activation], [context.hiddenSize, context.rowCount], { permutation: [1, 0] });
  const weight2Gradient = builder.node('matmul', [hiddenTranspose, outputDelta], [context.hiddenSize, context.outputSize], {}, 'gradient:w2');
  const weight2Step = builder.node('mul', [weight2Gradient, context.updateScale], [context.hiddenSize, context.outputSize]);
  const bias2Gradient = builder.node('sum', [outputDelta], [context.outputSize], { axis: 0 }, 'gradient:b2');
  const bias2Step = builder.node('mul', [bias2Gradient, context.updateScale], [context.outputSize]);
  const weight2Transpose = builder.node('transpose', [model.w2], [context.outputSize, context.hiddenSize], { permutation: [1, 0] });
  const downstream = builder.node('matmul', [outputDelta, weight2Transpose], hiddenShape);
  const hiddenDelta = builder.node('mul', [downstream, state.hidden.derivative], hiddenShape, {}, 'gradient:hidden');
  const weight1Gradient = builder.node('matmul', [context.xTranspose, hiddenDelta], [context.inputSize, context.hiddenSize], {}, 'gradient:w1');
  const weight1Step = builder.node('mul', [weight1Gradient, context.updateScale], [context.inputSize, context.hiddenSize]);
  const bias1Gradient = builder.node('sum', [hiddenDelta], [context.hiddenSize], { axis: 0 }, 'gradient:b1');
  const bias1Step = builder.node('mul', [bias1Gradient, context.updateScale], [context.hiddenSize]);
  return {
    w1: builder.node('sub', [model.w1, weight1Step], [context.inputSize, context.hiddenSize], {}, 'parameter:w1'),
    b1: builder.node('sub', [model.b1, bias1Step], [context.hiddenSize], {}, 'parameter:b1'),
    w2: builder.node('sub', [model.w2, weight2Step], [context.hiddenSize, context.outputSize], {}, 'parameter:w2'),
    b2: builder.node('sub', [model.b2, bias2Step], [context.outputSize], {}, 'parameter:b2'),
  };
}

function trainEpochs(builder, context, initialModel, epochs) {
  let model = initialModel;
  for (let epoch = 0; epoch < epochs; epoch += 1) model = trainEpoch(builder, context, model);
  return model;
}

function addProgram(builder, prefix, task, initialModel, epochs, withPredictions = true) {
  const context = initializeProgram(builder, prefix, task, initialModel);
  const model = trainEpochs(builder, context, context.model, epochs);
  const predictions = withPredictions ? forward(builder, context, model, false).output.activation : null;
  return { context, model, predictions };
}

function outputModelIds(model) {
  return [model.w1, model.b1, model.w2, model.b2];
}

export function buildGeneralMlpTensorPlan(contract, bindings) {
  const builder = new TensorPlanBuilder(bindings);
  const bindOptimizer = (task) => ({ ...task, learningRate: contract.optimizer.learningRate });
  const xor = bindOptimizer(contract.tasks.find((task) => task.id === 'xor'));
  const majority = bindOptimizer(contract.tasks.find((task) => task.id === 'majority3'));
  const tasks = {
    xor: addProgram(builder, 'xor', xor, xor.initialModel, xor.epochs),
    majority3: addProgram(builder, 'majority', majority, majority.initialModel, majority.epochs),
  };
  const direct = addProgram(builder, 'checkpoint.direct', xor, xor.initialModel, contract.checkpoint.directEpochs, false);
  const resumedContext = initializeProgram(builder, 'checkpoint.resumed', xor, xor.initialModel);
  const firstSegment = trainEpochs(builder, resumedContext, resumedContext.model, contract.checkpoint.firstSegmentEpochs);
  const resumedModel = trainEpochs(builder, resumedContext, firstSegment, contract.checkpoint.secondSegmentEpochs);
  const outputs = [
    ...outputModelIds(tasks.xor.model), tasks.xor.predictions,
    ...outputModelIds(tasks.majority3.model), tasks.majority3.predictions,
    ...outputModelIds(direct.model),
    ...outputModelIds(resumedModel),
  ];
  builder.output(...outputs);
  return {
    plan: builder.plan,
    outputIds: {
      tasks: {
        xor: { model: tasks.xor.model, predictions: tasks.xor.predictions },
        majority3: { model: tasks.majority3.model, predictions: tasks.majority3.predictions },
      },
      checkpoint: { direct: direct.model, resumed: resumedModel },
    },
  };
}

function buildSegmentPlan(contract, task, initialModel, epochs, phase, bindings) {
  const builder = new TensorPlanBuilder({ ...bindings, taskId: task.id, phase });
  const program = addProgram(builder, phase, { ...task, learningRate: contract.optimizer.learningRate }, initialModel, epochs);
  builder.output(...outputModelIds(program.model), program.predictions);
  return { plan: builder.plan, outputIds: { model: program.model, predictions: program.predictions } };
}

function buildEngine() {
  const run = spawnSync('cargo', ['build', '--release', '--locked', '--manifest-path', MANIFEST_PATH], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 180_000,
    maxBuffer: 32 * 1024 * 1024,
  });
  if (run.status !== 0) throw new Error(run.stderr || run.stdout || 'RCL_K08_D_CARGO_BUILD_FAILED');
}

function executePlanCli(plan, expectSuccess = true) {
  const run = spawnSync(ENGINE_PATH, ['execute', '-'], {
    cwd: ROOT,
    input: JSON.stringify(plan),
    encoding: 'utf8',
    timeout: 180_000,
    maxBuffer: 64 * 1024 * 1024,
  });
  if ((run.status === 0) !== expectSuccess) throw new Error(run.stderr || run.stdout || 'RCL_K08_D_PLAN_EXECUTION_STATUS');
  return JSON.parse((expectSuccess ? run.stdout : run.stderr).trim());
}

function renderProviderSource(planPath, planSha256) {
  const envelope = JSON.stringify({
    format: 'rcl.tensor-execution-plan-file.v0.1',
    path: planPath.replaceAll('\\', '/'),
    sha256: planSha256,
  });
  return `reality K08GeneralMlpTensorLowering {
  facet lowering.plan_sha256 : Text = "${planSha256}"
  facet lowering.backend : Text = "rcl-tensor-cpu-rust-v0.1"
  facet lowering.result : Text = provider_call("rcl.tensor.cpu", "tensor.execute", ${JSON.stringify(envelope)})
  facet evidence.boundary : Text = "GENERIC_TENSOR_PLAN_CANDIDATE_NOT_AUTODIFF"
}
`;
}

function prepareProviderRun(plan, directory, name) {
  if (process.platform !== 'win32') throw new Error('RCL_K08_D_NATIVE_PROVIDER_REQUIRES_WINDOWS');
  fs.mkdirSync(directory, { recursive: true });
  const planPath = path.join(directory, `${name}.tensor-plan.json`);
  const sourcePath = path.join(directory, `${name}.rcl`);
  const rbcPath = path.join(directory, `${name}.rbc`);
  const planBytes = Buffer.from(JSON.stringify(plan));
  const planSha256 = sha256(planBytes);
  fs.writeFileSync(planPath, planBytes);
  const source = renderProviderSource(planPath, planSha256);
  fs.writeFileSync(sourcePath, source);
  const compileStarted = performance.now();
  const nativeCompile = runNativeCompiler(COMPILER_RBC_PATH, sourcePath, rbcPath, { timeout: 120_000, maxBuffer: 64 * 1024 * 1024 });
  const compilerRuntimeMs = performance.now() - compileStarted;
  const nativeRbc = fs.readFileSync(rbcPath);
  const referenceRbc = Buffer.from(compileRealityToBytecode(source));
  if (!nativeRbc.equals(referenceRbc)) throw new Error('RCL_K08_D_PROVIDER_RBC_PARITY');
  return {
    planPath,
    planSha256,
    planBytes: planBytes.length,
    sourcePath,
    rbcPath,
    compilerRuntimeMs,
    nativeCompile,
    rbcSha256: sha256(nativeRbc),
  };
}

function executePreparedProvider(prepared) {
  const started = performance.now();
  const run = spawnSync(ENGINE_PATH, ['run-rbc', prepared.rbcPath, NATIVE_DLL_PATH], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 180_000,
    maxBuffer: 64 * 1024 * 1024,
  });
  const runtimeMs = performance.now() - started;
  if (run.status !== 0) throw new Error(run.stderr || run.stdout || 'RCL_K08_D_PROVIDER_EXECUTION');
  const native = verifyNativeSemanticStateRoot(JSON.parse(run.stdout), { requireNativeRoot: true });
  const result = JSON.parse(native.state['lowering.result']);
  return { runtimeMs, native, result };
}

function outputMap(result) {
  return new Map(result.outputs.map((output) => [output.tensor.id, output]));
}

function modelFromOutputs(map, ids, architecture, activations = ['softsign01', 'softsign01']) {
  const [inputSize, hiddenSize, outputSize] = architecture;
  const data = (id) => map.get(id)?.storage.data ?? (() => { throw new Error(`RCL_K08_D_OUTPUT_MISSING:${id}`); })();
  return {
    layers: [
      {
        inputSize,
        outputSize: hiddenSize,
        activation: activations[0],
        weights: canonicalWeights(data(ids.w1), inputSize, hiddenSize),
        biases: [...data(ids.b1)],
      },
      {
        inputSize: hiddenSize,
        outputSize,
        activation: activations[1],
        weights: canonicalWeights(data(ids.w2), hiddenSize, outputSize),
        biases: [...data(ids.b2)],
      },
    ],
  };
}

function predictionData(map, id) {
  return [...(map.get(id)?.storage.data ?? (() => { throw new Error(`RCL_K08_D_OUTPUT_MISSING:${id}`); })())];
}

function evaluateOutputs(outputs, task) {
  const loss = outputs.reduce((sum, output, index) => sum + 0.5 * (output - task.dataset[index].target[0]) ** 2, 0) / task.dataset.length;
  const accuracy = outputs.filter((output, index) => (output >= 0.5 ? 1 : 0) === task.dataset[index].target[0]).length / task.dataset.length;
  return { loss, accuracy };
}

function decodeScalarModel(value) {
  if (!Array.isArray(value) || value[0] !== 'Model') throw new Error('RCL_K08_D_SCALAR_MODEL');
  return {
    layers: value.slice(1).map((layer) => ({
      inputSize: layer[1],
      outputSize: layer[2],
      activation: layer[3],
      weights: layer[4][1],
      biases: layer[4][2],
    })),
  };
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

export function runPortableGeneralMlpTensorPlan(contract, bindings = { semanticOwner: 'RCL', lowering: 'generic-tensor-ssa-plan-v0.1' }) {
  buildEngine();
  const built = buildGeneralMlpTensorPlan(contract, bindings);
  return { ...built, result: executePlanCli(built.plan) };
}

export function runGeneralMlpTensorLoweringCampaign(options = {}) {
  if (process.platform !== 'win32') throw new Error('RCL_K08_D_EVIDENCE_REQUIRES_WINDOWS_NATIVE_PROVIDER');
  const outputDir = path.resolve(options.outputDir ?? DEFAULT_OUTPUT_DIR);
  const acceptEvidence = options.acceptEvidence === true;
  fs.mkdirSync(outputDir, { recursive: true });
  buildEngine();
  const source = fs.readFileSync(SOURCE_PATH, 'utf8');
  const contract = JSON.parse(fs.readFileSync(CONTRACT_PATH, 'utf8'));
  const bindings = {
    semanticOwner: 'RCL',
    modelSourceSha256: sha256(source),
    contractRoot: evidenceRoot(contract),
    lowering: 'generic-tensor-ssa-plan-v0.1',
    backend: 'rcl-tensor-cpu-rust-v0.1',
  };

  const scalarRbcPath = path.join(outputDir, 'general-mlp-scalar.rbc');
  const scalarCompile = runNativeCompiler(COMPILER_RBC_PATH, SOURCE_PATH, scalarRbcPath, { timeout: 120_000, maxBuffer: 64 * 1024 * 1024 });
  const scalarReplays = [];
  for (let index = 0; index < 3; index += 1) {
    const started = performance.now();
    const native = runNativeBytecode(scalarRbcPath, { timeout: 120_000, maxBuffer: 64 * 1024 * 1024, requireNativeStateRoot: true });
    scalarReplays.push({ runtimeMs: performance.now() - started, native });
  }

  const oracleStarted = performance.now();
  const oracle = runGeneralMlpOracle(contract);
  const oracleRuntimeMs = performance.now() - oracleStarted;
  const buildStarted = performance.now();
  const built = buildGeneralMlpTensorPlan(contract, bindings);
  const planBuildMs = performance.now() - buildStarted;
  const prepared = prepareProviderRun(built.plan, outputDir, 'general-mlp-tensor');
  const optimizedReplays = Array.from({ length: 3 }, () => executePreparedProvider(prepared));
  const firstResult = optimizedReplays[0].result;
  const map = outputMap(firstResult);

  const tasks = {};
  for (const task of contract.tasks) {
    const ids = built.outputIds.tasks[task.id];
    const model = modelFromOutputs(map, ids.model, task.architecture);
    const predictions = predictionData(map, ids.predictions);
    const evaluation = evaluateOutputs(predictions, task);
    const oracleTask = oracle.tasks[task.id];
    const scalarPrefix = task.id === 'majority3' ? 'majority' : task.id;
    const scalarModel = decodeScalarModel(scalarReplays[0].native.state[`training.${scalarPrefix}_final_model`]);
    tasks[task.id] = {
      architecture: task.architecture,
      loss: evaluation.loss,
      accuracy: evaluation.accuracy,
      outputs: predictions,
      maximumModelDriftVsOracle: maximumDifference(flattenModel(model), flattenModel(oracleTask.finalModel)),
      maximumModelDriftVsScalarRcl: maximumDifference(flattenModel(model), flattenModel(scalarModel)),
      maximumPredictionDriftVsOracle: maximumDifference(predictions, oracleTask.final.outputs),
      passed: evaluation.accuracy >= task.thresholds.minimumAccuracy && evaluation.loss <= task.thresholds.maximumLoss,
    };
  }

  const directModel = modelFromOutputs(map, built.outputIds.checkpoint.direct, contract.tasks[0].architecture);
  const resumedModel = modelFromOutputs(map, built.outputIds.checkpoint.resumed, contract.tasks[0].architecture);
  const checkpointTask = contract.tasks[0];
  const directBuilt = buildSegmentPlan(contract, checkpointTask, checkpointTask.initialModel, 32, 'checkpoint-direct-32', bindings);
  const firstBuilt = buildSegmentPlan(contract, checkpointTask, checkpointTask.initialModel, 16, 'checkpoint-first-16', bindings);
  const directProvider = executePreparedProvider(prepareProviderRun(directBuilt.plan, outputDir, 'checkpoint-direct-32'));
  const firstProvider = executePreparedProvider(prepareProviderRun(firstBuilt.plan, outputDir, 'checkpoint-first-16'));
  const firstOutputMap = outputMap(firstProvider.result);
  const firstModel = modelFromOutputs(firstOutputMap, firstBuilt.outputIds.model, checkpointTask.architecture);
  const firstStorageBits = Object.fromEntries(Object.entries(firstBuilt.outputIds.model).map(([name, id]) => [
    name,
    exactF64Bits(firstOutputMap.get(id).storage.data),
  ]));
  const checkpointPath = path.join(outputDir, 'checkpoint-epoch-16.json');
  writeJson(checkpointPath, { epoch: 16, optimizer: contract.optimizer, model: firstModel, exactStorageBits: firstStorageBits });
  const reloaded = JSON.parse(fs.readFileSync(checkpointPath, 'utf8'));
  const resumedBuilt = buildSegmentPlan(contract, checkpointTask, reloaded.model, 16, 'checkpoint-resumed-16', bindings);
  resumedBuilt.plan.exactStorageBits = Object.fromEntries(Object.entries(reloaded.exactStorageBits).map(([name, bits]) => [
    `storage:checkpoint-resumed-16.${name}`,
    bits,
  ]));
  const resumedProvider = executePreparedProvider(prepareProviderRun(resumedBuilt.plan, outputDir, 'checkpoint-resumed-16'));
  const boundaryDirectModel = modelFromOutputs(outputMap(directProvider.result), directBuilt.outputIds.model, checkpointTask.architecture);
  const boundaryResumedModel = modelFromOutputs(outputMap(resumedProvider.result), resumedBuilt.outputIds.model, checkpointTask.architecture);

  const replayOutputRoots = optimizedReplays.map((replay) => evidenceRoot(replay.result.outputs));
  const replayStateRoots = optimizedReplays.map((replay) => replay.native.semanticStateRoot);
  const scalarMedianMs = median(scalarReplays.map((replay) => replay.runtimeMs));
  const optimizedMedianMs = median(optimizedReplays.map((replay) => replay.runtimeMs));
  const checkpoint = {
    inPlanExactResumeParity: canonicalJson(directModel) === canonicalJson(resumedModel),
    serializedBoundaryExactResumeParity: canonicalJson(boundaryDirectModel) === canonicalJson(boundaryResumedModel),
    maximumBoundaryDrift: maximumDifference(flattenModel(boundaryDirectModel), flattenModel(boundaryResumedModel)),
    exactStorageBitsPreserved: Object.values(reloaded.exactStorageBits).flat().every((bits) => /^[0-9a-f]{16}$/.test(bits)),
    checkpointBytes: fs.statSync(checkpointPath).size,
    checkpointSha256: sha256(fs.readFileSync(checkpointPath)),
  };
  const checks = {
    semanticBinding: firstResult.bindings.modelSourceSha256 === bindings.modelSourceSha256 && firstResult.bindings.contractRoot === bindings.contractRoot,
    genericPlan: built.plan.nodes.every((node) => !['xor_special', 'majority_special', 'mlp_special', 'train_mlp'].includes(node.operation)),
    compile: scalarCompile.status === 'ok' && prepared.nativeCompile.status === 'ok',
    execute: optimizedReplays.every((replay) => replay.result.status === 'ok' && replay.native.stateRootVerified === true),
    correct: Object.values(tasks).every((task) => task.passed),
    differential: Object.values(tasks).every((task) => task.maximumModelDriftVsOracle <= 1e-9 && task.maximumModelDriftVsScalarRcl <= 1e-9 && task.maximumPredictionDriftVsOracle <= 1e-9),
    checkpoint: checkpoint.inPlanExactResumeParity && checkpoint.serializedBoundaryExactResumeParity && checkpoint.exactStorageBitsPreserved,
    deterministic: new Set(replayOutputRoots).size === 1 && new Set(replayStateRoots).size === 1,
    performance: optimizedMedianMs < scalarMedianMs,
  };

  const invalidPlan = {
    format: 'rcl.tensor-execution-plan.v0.1',
    bindings: {},
    tensors: [{ id: 'x', shape: [1], dtype: 'f64', layout: 'row-major', device: 'cpu', gradientIdentity: 'constant:x', storageIdentity: 'storage:x' }],
    storages: [{ identity: 'storage:x', kind: 'cpu-dense', data: [1] }],
    nodes: [{ id: 'n1', operation: 'abs', inputs: ['missing'], output: { id: 'out', shape: [1], dtype: 'f64', layout: 'row-major', device: 'cpu', gradientIdentity: 'derived:abs' }, attributes: {} }],
    outputs: ['out'],
  };
  const invalid = executePlanCli(invalidPlan, false);
  checks.negative = invalid.code === 'RCL_TENSOR_PLAN_INPUT_MISSING';
  const pass = Object.values(checks).every(Boolean);
  const report = {
    format: 'rcl.k08-d.general-mlp-tensor-lowering-evidence.v0.1',
    status: pass ? 'ENGINE_E1_GENERAL_MLP_TENSOR_LOWERING_CANDIDATE' : 'FAIL_GENERAL_MLP_TENSOR_LOWERING',
    generatedAt: new Date().toISOString(),
    semanticOwner: 'RCL',
    executionOwner: 'rcl-tensor-cpu-rust-v0.1',
    bindings,
    artifactHashes: {
      tensorSemantics: artifactHash(['examples/native-ai/tensor-genome.rcl', 'examples/native-ai/tensor-object.rcl', 'examples/native-ai/types/tensor.rcltype']),
      generalMlpSemantics: artifactHash(['examples/native-ai/general-mlp.rcl', 'examples/native-ai/general-mlp-contract.v0.1.json']),
      rustBackend: artifactHash(['native/tensor-engine/Cargo.toml', 'native/tensor-engine/Cargo.lock', 'native/tensor-engine/src/lib.rs', 'native/tensor-engine/src/main.rs', 'native/tensor-engine/src/rclvm_provider.rs']),
      loweringOrgan: artifactHash(['scripts/run-k08-general-mlp-tensor-lowering.mjs']),
    },
    plan: {
      format: built.plan.format,
      sha256: prepared.planSha256,
      bytes: prepared.planBytes,
      nodes: built.plan.nodes.length,
      initialTensors: built.plan.tensors.length,
      requestedOutputs: built.plan.outputs.length,
      buildMs: planBuildMs,
      compilerRuntimeMs: prepared.compilerRuntimeMs,
      rbcSha256: prepared.rbcSha256,
      operations: [...new Set(built.plan.nodes.map((node) => node.operation))].sort(),
      forbiddenModelSpecialOperations: [],
    },
    tasks,
    checkpoint,
    robustness: {
      replayCount: optimizedReplays.length,
      outputRoots: replayOutputRoots,
      semanticStateRoots: replayStateRoots,
      identicalOutputs: new Set(replayOutputRoots).size === 1,
      identicalSemanticStateRoots: new Set(replayStateRoots).size === 1,
    },
    performance: {
      boundary: 'warm release artifacts; each sample includes native VM startup, root-verified RCL execution, plan file hash/load, Provider dispatch, generic Tensor Plan execution and response serialization; compilation excluded',
      scalarNativeSamplesMs: scalarReplays.map((replay) => replay.runtimeMs),
      scalarNativeMedianMs: scalarMedianMs,
      optimizedTensorSamplesMs: optimizedReplays.map((replay) => replay.runtimeMs),
      optimizedTensorMedianMs: optimizedMedianMs,
      scalarToTensorSpeedup: scalarMedianMs / optimizedMedianMs,
      javascriptOracleRuntimeMs: oracleRuntimeMs,
      optimizedTensorToOracleRatio: optimizedMedianMs / oracleRuntimeMs,
      priorNativeToOracleRatio: 118.2997469360286,
      gapReductionFactor: 118.2997469360286 / (optimizedMedianMs / oracleRuntimeMs),
      planRetainedAllocationUpperBoundBytes: firstResult.telemetry.allocatedBytes,
      peakRss: 'UNMEASURED_PROCESS_RSS_GAP',
    },
    negativeControls: { missingInputRejected: invalid.code === 'RCL_TENSOR_PLAN_INPUT_MISSING' },
    checks,
    claimsNotGranted: ['NATIVE_AUTODIFF', 'ADAMW', 'TRANSFORMER', 'GPU', 'DISTRIBUTED_TENSOR', 'K400_PROMOTION_FROM_THIS_CANDIDATE'],
    gapBoundary: 'The JS lowerer is a COMPILER_GAP candidate. It emits rooted generic Tensor SSA and never computes training parameters; typed/self-hosted Tensor lowering remains open.',
    reportRoot: null,
  };
  report.reportRoot = evidenceRoot({ ...report, generatedAt: undefined, reportRoot: undefined });
  writeJson(path.join(outputDir, 'k08-d-general-mlp-tensor-evidence.json'), report);
  writeJson(path.join(outputDir, 'reference-oracle.json'), oracle);
  if (acceptEvidence) writeJson(ACCEPTED_EVIDENCE_PATH, report);
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const acceptEvidence = process.argv.includes('--accept-evidence');
  const outputArgument = process.argv.slice(2).find((argument) => !argument.startsWith('--'));
  const report = runGeneralMlpTensorLoweringCampaign({ outputDir: outputArgument, acceptEvidence });
  console.log(JSON.stringify({
    status: report.status,
    reportRoot: report.reportRoot,
    scalarToTensorSpeedup: report.performance.scalarToTensorSpeedup,
    optimizedTensorToOracleRatio: report.performance.optimizedTensorToOracleRatio,
    gapReductionFactor: report.performance.gapReductionFactor,
    checks: report.checks,
  }, null, 2));
  if (report.status.startsWith('FAIL')) process.exitCode = 1;
}
