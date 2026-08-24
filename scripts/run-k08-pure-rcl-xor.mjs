#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { compileRealityToBytecode, decodeBytecode } from '../src/bytecode.mjs';
import {
  DEFAULT_NATIVE_COMPILER_PATH,
  DEFAULT_NATIVE_VM_PATH,
  runNativeBytecode,
  runNativeCompiler,
} from '../src/native-vm.mjs';
import { canonicalJson, evidenceRoot } from '../src/universal-program-stress.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DEFAULT_SOURCE_PATH = path.join(ROOT, 'examples', 'native-ai', 'pure-rcl-xor.rcl');
const DEFAULT_CONTRACT_PATH = path.join(ROOT, 'examples', 'native-ai', 'pure-rcl-xor-contract.v0.1.json');
const DEFAULT_COMPILER_RBC_PATH = path.join(ROOT, 'selfhost', 'compiler.rbc');
const DEFAULT_OUTPUT_DIR = path.join(ROOT, 'output', 'k08-pure-rcl-xor-v0.1');

function sha256Bytes(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function sha256File(filePath) {
  return sha256Bytes(fs.readFileSync(filePath));
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function maximumDifference(left, right) {
  if (left.length !== right.length) return Infinity;
  return left.reduce((maximum, value, index) => Math.max(maximum, Math.abs(Number(value) - Number(right[index]))), 0);
}

function activate(value) {
  return 0.5 + (0.5 * value) / (1 + Math.abs(value));
}

function activateDerivative(value) {
  const scale = 1 + Math.abs(value);
  return 0.5 / (scale * scale);
}

function referenceForward(parameters, input) {
  const [x1, x2] = input;
  const hiddenPre = [
    parameters[0] * x1 + parameters[1] * x2 + parameters[4],
    parameters[2] * x1 + parameters[3] * x2 + parameters[5],
  ];
  const hidden = hiddenPre.map(activate);
  const outputPre = parameters[6] * hidden[0] + parameters[7] * hidden[1] + parameters[8];
  return { hiddenPre, hidden, outputPre, output: activate(outputPre) };
}

function referenceEvaluate(parameters, dataset) {
  const predictions = dataset.map((sample) => {
    const output = referenceForward(parameters, sample.input).output;
    return {
      input: sample.input,
      target: sample.target,
      output,
      predicted: output >= 0.5 ? 1 : 0,
    };
  });
  const loss = predictions.reduce((sum, row) => sum + 0.5 * (row.output - row.target) ** 2, 0) / predictions.length;
  const accuracy = predictions.filter((row) => row.predicted === row.target).length / predictions.length;
  return { predictions, loss, accuracy };
}

function referenceUpdate(parameters, dataset, learningRate) {
  const gradient = Array(parameters.length).fill(0);
  for (const sample of dataset) {
    const [x1, x2] = sample.input;
    const forward = referenceForward(parameters, sample.input);
    const outputDelta = (forward.output - sample.target) * activateDerivative(forward.outputPre);
    const hiddenOneDelta = outputDelta * parameters[6] * activateDerivative(forward.hiddenPre[0]);
    const hiddenTwoDelta = outputDelta * parameters[7] * activateDerivative(forward.hiddenPre[1]);
    gradient[0] += hiddenOneDelta * x1;
    gradient[1] += hiddenOneDelta * x2;
    gradient[2] += hiddenTwoDelta * x1;
    gradient[3] += hiddenTwoDelta * x2;
    gradient[4] += hiddenOneDelta;
    gradient[5] += hiddenTwoDelta;
    gradient[6] += outputDelta * forward.hidden[0];
    gradient[7] += outputDelta * forward.hidden[1];
    gradient[8] += outputDelta;
  }
  return parameters.map((value, index) => value - learningRate * gradient[index] / dataset.length);
}

export function runReferenceOracle(contract) {
  const { dataset, training } = contract;
  let parameters = [...contract.initialization.parameters];
  const trace = [];
  for (let epoch = 0; epoch < training.epochs; epoch += 1) {
    if (epoch % training.traceEvery === 0) trace.push(epoch, referenceEvaluate(parameters, dataset).loss);
    parameters = referenceUpdate(parameters, dataset, training.learningRate);
  }
  const evaluation = referenceEvaluate(parameters, dataset);
  trace.push(training.epochs, evaluation.loss);
  return {
    role: 'REFERENCE_ORACLE_ONLY_NOT_PURE_EXECUTION',
    implementation: 'javascript_same_frozen_math',
    finalParameters: parameters,
    lossTrace: trace,
    ...evaluation,
    root: evidenceRoot({ parameters, trace, evaluation }),
  };
}

function auditPureSource(source, decoded) {
  const forbiddenPatterns = [
    'provider_call(',
    'python',
    'numpy',
    'pytorch',
    'tensorflow',
    'jax',
    'onnx',
    'fetch(',
  ];
  const lowered = source.toLowerCase();
  const forbiddenMatches = forbiddenPatterns.filter((pattern) => lowered.includes(pattern));
  const requiredSemantics = [
    'xor_dataset',
    'initial_parameters',
    'activate',
    'predict',
    'sample_loss',
    'sample_gradient',
    'output_delta',
    'hidden_one_delta',
    'hidden_two_delta',
    'update_parameters',
    'train',
    'dataset_accuracy',
    'loss_trace',
  ];
  const missingSemantics = requiredSemantics.filter((name) => !lowered.includes(`reckon ${name}`));
  const providerOpcodeCount = decoded.instructions.filter((instruction) => instruction.name === 'CALL_PROVIDER').length;
  return {
    ok: forbiddenMatches.length === 0 && missingSemantics.length === 0 && providerOpcodeCount === 0,
    forbiddenMatches,
    missingSemantics,
    providerOpcodeCount,
    requiredSemantics,
  };
}

function renderReadme(report) {
  return `# K08-A Pure RCL XOR evidence\n\n` +
    `Verdict: **${report.verdict}**\n\n` +
    `- Pipeline: \`.rcl -> native rclc/compiler.rbc -> RBC -> native rclvm\`\n` +
    `- Accuracy: ${report.evaluation.accuracy}\n` +
    `- Loss: ${report.evaluation.loss}\n` +
    `- Native replay roots identical: ${report.robustness.identicalSemanticStateRoots}\n` +
    `- Median native runtime: ${report.performance.medianRuntimeMs} ms\n` +
    `- AI_GENERATE: ${report.gates.AI_GENERATE.status}\n\n` +
    `The JavaScript implementation is a differential oracle only. It does not train parameters used by the native RCL execution.\n`;
}

export function runPureRclXorCampaign(options = {}) {
  const sourcePath = path.resolve(options.sourcePath ?? DEFAULT_SOURCE_PATH);
  const contractPath = path.resolve(options.contractPath ?? DEFAULT_CONTRACT_PATH);
  const compilerRbcPath = path.resolve(options.compilerRbcPath ?? DEFAULT_COMPILER_RBC_PATH);
  const outputDir = path.resolve(options.outputDir ?? DEFAULT_OUTPUT_DIR);
  const source = fs.readFileSync(sourcePath, 'utf8');
  const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
  if (contract.status !== 'FROZEN_BEFORE_NATIVE_RUN') throw new Error('RCL_K08_CONTRACT_NOT_FROZEN');
  if (!fs.existsSync(DEFAULT_NATIVE_COMPILER_PATH)) throw new Error(`RCL_K08_NATIVE_COMPILER_MISSING:${DEFAULT_NATIVE_COMPILER_PATH}`);
  if (!fs.existsSync(DEFAULT_NATIVE_VM_PATH)) throw new Error(`RCL_K08_NATIVE_VM_MISSING:${DEFAULT_NATIVE_VM_PATH}`);
  if (!fs.existsSync(compilerRbcPath)) throw new Error(`RCL_K08_COMPILER_RBC_MISSING:${compilerRbcPath}`);
  fs.mkdirSync(outputDir, { recursive: true });

  const rbcPath = path.join(outputDir, 'pure-rcl-xor.rbc');
  const compilerStarted = performance.now();
  const nativeCompile = runNativeCompiler(compilerRbcPath, sourcePath, rbcPath, {
    timeout: 120_000,
    maxBuffer: 64 * 1024 * 1024,
  });
  const compilerRuntimeMs = performance.now() - compilerStarted;
  const nativeRbc = fs.readFileSync(rbcPath);
  const referenceRbc = Buffer.from(compileRealityToBytecode(source));
  const bytecodeParity = nativeRbc.equals(referenceRbc);
  const decoded = decodeBytecode(nativeRbc);
  const dependencyAudit = auditPureSource(source, decoded);

  const replayCount = Number(contract.thresholds.requiredDeterministicNativeReplays);
  const replays = [];
  for (let index = 0; index < replayCount; index += 1) {
    const started = performance.now();
    const native = runNativeBytecode(rbcPath, { timeout: 120_000, maxBuffer: 64 * 1024 * 1024 });
    replays.push({
      index: index + 1,
      runtimeMs: performance.now() - started,
      semanticStateRoot: native.semanticStateRoot,
      nativeStateRoot: native.nativeStateRoot,
      stateRootVerified: native.stateRootVerified,
      metrics: native.metrics,
      state: native.state,
    });
  }

  const native = replays[0];
  const state = native.state;
  const oracleStarted = performance.now();
  const oracle = runReferenceOracle(contract);
  const oracleRuntimeMs = performance.now() - oracleStarted;
  const nativeParameters = state['training.final_parameters'];
  const nativePredictions = [
    state['inference.output_00'],
    state['inference.output_01'],
    state['inference.output_10'],
    state['inference.output_11'],
  ];
  const oraclePredictions = oracle.predictions.map((row) => row.output);
  const maximumParameterDrift = maximumDifference(nativeParameters, oracle.finalParameters);
  const maximumPredictionDrift = maximumDifference(nativePredictions, oraclePredictions);
  const maximumTraceDrift = maximumDifference(state['training.loss_trace'], oracle.lossTrace);
  const maximumAbsolutePredictionError = Math.max(...nativePredictions.map((value, index) => Math.abs(value - contract.dataset[index].target)));
  const semanticRoots = replays.map((replay) => replay.semanticStateRoot);
  const identicalSemanticStateRoots = new Set(semanticRoots).size === 1;
  const exactReplayStates = replays.every((replay) => canonicalJson(replay.state) === canonicalJson(state));

  const evaluation = {
    outputs: nativePredictions,
    predicted: nativePredictions.map((value) => value >= 0.5 ? 1 : 0),
    expected: contract.dataset.map((row) => row.target),
    accuracy: state['evaluation.accuracy'],
    loss: state['evaluation.loss'],
    xorCorrect: state['evaluation.xor_correct'],
    thresholdsPass: state['evaluation.thresholds_pass'],
    maximumAbsolutePredictionError,
    maximumParameterDrift,
    maximumPredictionDrift,
    maximumTraceDrift,
  };

  const checks = {
    express: dependencyAudit.ok,
    compile: nativeCompile.status === 'ok' && nativeCompile.bytes === nativeRbc.length,
    lower: bytecodeParity && decoded.instructions.length > 0,
    execute: replays.every((replay) => replay.metrics.instructions > 0 && replay.stateRootVerified === true),
    correct: evaluation.thresholdsPass === true
      && evaluation.accuracy >= contract.thresholds.minimumAccuracy
      && evaluation.loss <= contract.thresholds.maximumLoss
      && maximumAbsolutePredictionError <= contract.thresholds.maximumAbsolutePredictionError,
    robust: replays.length === replayCount && identicalSemanticStateRoots && exactReplayStates,
    performance: replays.every((replay) => replay.runtimeMs > 0),
    differential: maximumParameterDrift <= contract.thresholds.maximumOracleParameterDrift
      && maximumPredictionDrift <= contract.thresholds.maximumOracleParameterDrift
      && maximumTraceDrift <= contract.thresholds.maximumOracleParameterDrift,
  };

  const passEvidence = Object.values(checks).every(Boolean);
  const artifactRoots = {
    datasetRoot: evidenceRoot(contract.dataset),
    modelDefinitionRoot: evidenceRoot(contract.architecture),
    initialParameterRoot: evidenceRoot(contract.initialization),
    trainingConfigurationRoot: evidenceRoot(trainingProjection(contract)),
    trainingTraceRoot: evidenceRoot(state['training.loss_trace']),
    finalParameterRoot: evidenceRoot(nativeParameters),
    checkpointRoot: evidenceRoot({ epoch: contract.training.epochs, parameters: nativeParameters }),
    evaluationRoot: evidenceRoot(evaluation),
    sourceSha256: sha256File(sourcePath),
    compilerRbcSha256: sha256File(compilerRbcPath),
    targetRbcSha256: sha256Bytes(nativeRbc),
  };

  const evidenceRefs = [
    'examples/native-ai/pure-rcl-xor.rcl',
    'examples/native-ai/pure-rcl-xor-contract.v0.1.json',
    'examples/native-ai/evidence/k08-a-evidence.json',
    'tests/k08-pure-rcl-xor.test.mjs',
  ];
  const gates = Object.fromEntries(['EXPRESS', 'COMPILE', 'LOWER', 'EXECUTE', 'CORRECT', 'ROBUST', 'PERFORMANCE', 'EVIDENCE'].map((gate) => [gate, {
    status: passEvidence ? 'PASS' : 'FAIL',
    evidence: evidenceRefs,
  }]));
  gates.AI_GENERATE = {
    status: 'UNVERIFIED',
    evidence: [],
    note: 'K08-A native learning does not self-certify an independent AI generation receipt.',
  };

  const report = {
    format: 'rcl.k08-a-pure-rcl-xor-evidence.v0.1',
    generatedAt: new Date().toISOString(),
    verificationDate: String(contract.frozenAt).slice(0, 10),
    verdict: passEvidence
      ? 'RCL_NATIVE_LEARNING_PROVEN_AT_MINIMAL_MLP_SCALE_LOCAL_NATIVE_AI_GENERATE_UNVERIFIED'
      : 'FAIL_K08_A_PURE_RCL_XOR',
    nativeLearningMilestone: passEvidence ? 'PASS' : 'FAIL',
    k400Cell: {
      id: 'ai-runtime::machine-learning',
      campaignId: 'K233',
      killerTask: 'K08',
      status: passEvidence ? 'BLOCKED_AI_GENERATE' : 'FAIL',
    },
    evidenceBoundary: contract.evidenceBoundary,
    pureExecutionPath: {
      stages: ['RCL source', 'native rclc', 'selfhost/compiler.rbc', 'RBC', 'native rclvm', 'native state'],
      javascriptTrainerParticipated: false,
      referenceOracleParticipatedInNativeParameters: false,
      dependencyAudit,
    },
    contractRoot: evidenceRoot(contract),
    compiler: {
      path: path.relative(ROOT, DEFAULT_NATIVE_COMPILER_PATH).replaceAll('\\', '/'),
      compilerRbcPath: path.relative(ROOT, compilerRbcPath).replaceAll('\\', '/'),
      runtimeMs: compilerRuntimeMs,
      executedInstructions: nativeCompile.executedInstructions,
      targetBytes: nativeRbc.length,
      targetInstructions: decoded.instructions.length,
      bytecodeParityWithJsReferenceCompiler: bytecodeParity,
    },
    evaluation,
    robustness: {
      replayCount,
      semanticStateRoots: semanticRoots,
      identicalSemanticStateRoots,
      exactReplayStates,
    },
    performance: {
      classification: 'MEASURED_LOCAL_NATIVE_NOT_COMPETITIVE_PARITY',
      runtimesMs: replays.map((replay) => replay.runtimeMs),
      medianRuntimeMs: median(replays.map((replay) => replay.runtimeMs)),
      referenceOracleRuntimeMs: oracleRuntimeMs,
      nativeToOracleRuntimeRatio: median(replays.map((replay) => replay.runtimeMs)) / oracleRuntimeMs,
      executedInstructions: native.metrics.instructions,
      peakStackDepth: native.metrics.peakStackDepth,
      peakCallFrames: native.metrics.peakCallFrames,
      memoryComparison: 'UNMEASURED_NATIVE_VM_DOES_NOT_YET_EMIT_PEAK_RSS',
      unabsorbedAdvantage: 'JavaScript reference execution remains faster; the first K08-A gate proves native semantics, not competitive performance.',
    },
    oracle,
    checks,
    artifactRoots,
    gates,
    trainingTrace: state['training.loss_trace'],
    reportRoot: null,
  };
  report.reportRoot = evidenceRoot({ ...report, generatedAt: undefined, reportRoot: undefined });

  fs.writeFileSync(path.join(outputDir, 'native-run.json'), `${JSON.stringify(replays, null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(outputDir, 'reference-oracle.json'), `${JSON.stringify(oracle, null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(outputDir, 'k08-a-evidence.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(outputDir, 'README.md'), renderReadme(report), 'utf8');
  return report;
}

function trainingProjection(contract) {
  return {
    seed: contract.initialization.seed,
    initializationPolicy: contract.initialization.policy,
    ...contract.training,
    thresholds: contract.thresholds,
  };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const outputDir = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_OUTPUT_DIR;
  const report = runPureRclXorCampaign({ outputDir });
  console.log(JSON.stringify({
    verdict: report.verdict,
    outputDir,
    accuracy: report.evaluation.accuracy,
    loss: report.evaluation.loss,
    medianRuntimeMs: report.performance.medianRuntimeMs,
    reportRoot: report.reportRoot,
  }, null, 2));
  if (report.nativeLearningMilestone !== 'PASS') process.exitCode = 1;
}
