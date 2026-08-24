#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
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
import { verifyGithubAuthorityBinding } from './verify-k233-ai-generation-receipt.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DEFAULT_SOURCE_PATH = path.join(ROOT, 'examples', 'native-ai', 'general-mlp.rcl');
const DEFAULT_CONTRACT_PATH = path.join(ROOT, 'examples', 'native-ai', 'general-mlp-contract.v0.1.json');
const DEFAULT_COMPILER_RBC_PATH = path.join(ROOT, 'selfhost', 'compiler.rbc');
const DEFAULT_OUTPUT_DIR = path.join(ROOT, 'output', 'k08-general-mlp-v0.1');

function sha256Bytes(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function sha256File(filePath) {
  return sha256Bytes(fs.readFileSync(filePath));
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
}

function maximumDifference(left, right) {
  if (left.length !== right.length) return Infinity;
  return left.reduce((maximum, value, index) => Math.max(maximum, Math.abs(Number(value) - Number(right[index]))), 0);
}

function flattenModel(model) {
  return model.layers.flatMap((layer) => [...layer.weights, ...layer.biases]);
}

function cloneModel(model) {
  return {
    layers: model.layers.map((layer) => ({
      inputSize: layer.inputSize,
      outputSize: layer.outputSize,
      activation: layer.activation,
      weights: [...layer.weights],
      biases: [...layer.biases],
    })),
  };
}

function activate(kind, value) {
  if (kind === 'linear') return value;
  return 0.5 + (0.5 * value) / (1 + Math.abs(value));
}

function activationDerivative(kind, value) {
  if (kind === 'linear') return 1;
  const scale = 1 + Math.abs(value);
  return 0.5 / (scale * scale);
}

function forward(model, input) {
  const activations = [[...input]];
  const preActivations = [];
  for (const layer of model.layers) {
    const previous = activations.at(-1);
    const pre = Array.from({ length: layer.outputSize }, (_, outputIndex) => {
      let value = layer.biases[outputIndex];
      for (let inputIndex = 0; inputIndex < layer.inputSize; inputIndex += 1) {
        value += layer.weights[outputIndex * layer.inputSize + inputIndex] * previous[inputIndex];
      }
      return value;
    });
    preActivations.push(pre);
    activations.push(pre.map((value) => activate(layer.activation, value)));
  }
  return { activations, preActivations, output: activations.at(-1) };
}

function trainStep(model, dataset, learningRate) {
  const gradients = model.layers.map((layer) => ({
    weights: Array(layer.weights.length).fill(0),
    biases: Array(layer.biases.length).fill(0),
  }));
  for (const sample of dataset) {
    const state = forward(model, sample.input);
    const deltas = Array(model.layers.length);
    const last = model.layers.length - 1;
    deltas[last] = state.output.map((output, unitIndex) =>
      (output - sample.target[unitIndex])
        * activationDerivative(model.layers[last].activation, state.preActivations[last][unitIndex]));
    for (let layerIndex = last - 1; layerIndex >= 0; layerIndex -= 1) {
      const layer = model.layers[layerIndex];
      const next = model.layers[layerIndex + 1];
      deltas[layerIndex] = Array.from({ length: layer.outputSize }, (_, unitIndex) => {
        let downstream = 0;
        for (let nextUnit = 0; nextUnit < next.outputSize; nextUnit += 1) {
          downstream += next.weights[nextUnit * next.inputSize + unitIndex] * deltas[layerIndex + 1][nextUnit];
        }
        return downstream * activationDerivative(layer.activation, state.preActivations[layerIndex][unitIndex]);
      });
    }
    for (let layerIndex = 0; layerIndex < model.layers.length; layerIndex += 1) {
      const layer = model.layers[layerIndex];
      const input = state.activations[layerIndex];
      for (let outputIndex = 0; outputIndex < layer.outputSize; outputIndex += 1) {
        gradients[layerIndex].biases[outputIndex] += deltas[layerIndex][outputIndex];
        for (let inputIndex = 0; inputIndex < layer.inputSize; inputIndex += 1) {
          gradients[layerIndex].weights[outputIndex * layer.inputSize + inputIndex]
            += deltas[layerIndex][outputIndex] * input[inputIndex];
        }
      }
    }
  }
  return {
    layers: model.layers.map((layer, layerIndex) => ({
      ...layer,
      weights: layer.weights.map((value, index) => value - learningRate * gradients[layerIndex].weights[index] / dataset.length),
      biases: layer.biases.map((value, index) => value - learningRate * gradients[layerIndex].biases[index] / dataset.length),
    })),
  };
}

function train(model, dataset, optimizer, epochs) {
  let current = cloneModel(model);
  for (let epoch = 0; epoch < epochs; epoch += 1) current = trainStep(current, dataset, optimizer.learningRate);
  return current;
}

function evaluate(model, dataset) {
  const predictions = dataset.map((sample) => {
    const output = forward(model, sample.input).output;
    return { input: sample.input, target: sample.target, output };
  });
  const loss = predictions.reduce((sum, row) => {
    const sampleLoss = row.output.reduce((inner, output, index) => inner + 0.5 * (output - row.target[index]) ** 2, 0) / row.output.length;
    return sum + sampleLoss;
  }, 0) / predictions.length;
  const accuracy = predictions.filter((row) => row.output.every((output, index) => (output >= 0.5 ? 1 : 0) === row.target[index])).length / predictions.length;
  return { predictions, outputs: predictions.map((row) => row.output[0]), loss, accuracy };
}

export function runGeneralMlpOracle(contract) {
  const tasks = Object.fromEntries(contract.tasks.map((task) => {
    const initialModel = cloneModel(task.initialModel);
    const initial = evaluate(initialModel, task.dataset);
    const finalModel = train(initialModel, task.dataset, contract.optimizer, task.epochs);
    const final = evaluate(finalModel, task.dataset);
    return [task.id, {
      role: 'REFERENCE_ORACLE_ONLY_NOT_NATIVE_EXECUTION',
      initial,
      final,
      finalModel,
      parameterCount: flattenModel(finalModel).length,
    }];
  }));
  const checkpointTask = contract.tasks[0];
  const direct = train(checkpointTask.initialModel, checkpointTask.dataset, contract.optimizer, contract.checkpoint.directEpochs);
  const first = train(checkpointTask.initialModel, checkpointTask.dataset, contract.optimizer, contract.checkpoint.firstSegmentEpochs);
  const resumed = train(first, checkpointTask.dataset, contract.optimizer, contract.checkpoint.secondSegmentEpochs);
  return {
    role: 'REFERENCE_ORACLE_ONLY_NOT_NATIVE_EXECUTION',
    implementation: 'javascript_generic_dense_backprop_sgd',
    tasks,
    checkpoint: {
      exactResumeParity: canonicalJson(direct) === canonicalJson(resumed),
      maximumParameterDrift: maximumDifference(flattenModel(direct), flattenModel(resumed)),
    },
    root: evidenceRoot({ tasks, checkpoint: { direct, resumed } }),
  };
}

function decodeNativeModel(value) {
  if (!Array.isArray(value) || value[0] !== 'Model' || value.length !== 3) throw new Error('RCL_K08_B_INVALID_NATIVE_MODEL');
  return {
    layers: value.slice(1).map((layer) => {
      if (!Array.isArray(layer) || layer[0] !== 'Layer' || !Array.isArray(layer[4]) || layer[4][0] !== 'Parameter') {
        throw new Error('RCL_K08_B_INVALID_NATIVE_LAYER');
      }
      return {
        inputSize: layer[1],
        outputSize: layer[2],
        activation: layer[3],
        weights: layer[4][1],
        biases: layer[4][2],
      };
    }),
  };
}

function auditGeneralSource(source, decoded) {
  const lowered = source.toLowerCase();
  const forbiddenPatterns = ['provider_call(', 'python', 'numpy', 'pytorch', 'tensorflow', 'jax', 'onnx', 'xor_special', 'majority_special', 'mlp_2_2_1_special'];
  const forbiddenMatches = forbiddenPatterns.filter((pattern) => lowered.includes(pattern));
  const requiredSemantics = [
    'make_parameter', 'make_layer', 'make_model', 'make_loss', 'make_optimizer', 'make_sample', 'make_dataset', 'make_checkpoint',
    'model_valid', 'dataset_valid_for_model', 'layer_forward', 'model_forward', 'dataset_loss', 'unit_delta', 'train_step', 'train_model',
    'train_checkpoint', 'resume_checkpoint',
  ];
  const missingSemantics = requiredSemantics.filter((name) => !lowered.includes(`reckon ${name}`));
  const providerOpcodeCount = decoded.instructions.filter((instruction) => instruction.name === 'CALL_PROVIDER').length;
  return {
    ok: forbiddenMatches.length === 0 && missingSemantics.length === 0 && providerOpcodeCount === 0,
    forbiddenMatches,
    missingSemantics,
    providerOpcodeCount,
    requiredSemantics,
    boundedProfile: 'TWO_CONFIGURABLE_DENSE_LAYERS',
  };
}

function renderReadme(report) {
  return `# K08-B General MLP evidence\n\n`
    + `Verdict: **${report.verdict}**\n\n`
    + `- Pipeline: \`.rcl -> native rclc/compiler.rbc -> RBC -> native rclvm\`\n`
    + `- XOR: accuracy=${report.tasks.xor.accuracy}, loss=${report.tasks.xor.loss}\n`
    + `- Majority-3: accuracy=${report.tasks.majority3.accuracy}, loss=${report.tasks.majority3.loss}\n`
    + `- Exact checkpoint resume parity: ${report.checkpoint.exactResumeParity}\n`
    + `- Deterministic native replays: ${report.robustness.identicalSemanticStateRoots}\n`
    + `- AI_GENERATE: ${report.gates.AI_GENERATE.status}\n\n`
    + `The JavaScript implementation is a differential oracle only and does not supply native parameters.\n`;
}

export function runGeneralMlpCampaign(options = {}) {
  const sourcePath = path.resolve(options.sourcePath ?? DEFAULT_SOURCE_PATH);
  const contractPath = path.resolve(options.contractPath ?? DEFAULT_CONTRACT_PATH);
  const compilerRbcPath = path.resolve(options.compilerRbcPath ?? DEFAULT_COMPILER_RBC_PATH);
  const outputDir = path.resolve(options.outputDir ?? DEFAULT_OUTPUT_DIR);
  const source = fs.readFileSync(sourcePath, 'utf8');
  const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
  if (!['FROZEN_BEFORE_EVIDENCE_RUN', 'REFROZEN_AFTER_FAILED_LOWERING_PROBE_BEFORE_ACCEPTED_EVIDENCE_RUN'].includes(contract.status)) {
    throw new Error('RCL_K08_B_CONTRACT_NOT_FROZEN');
  }
  if (!fs.existsSync(DEFAULT_NATIVE_COMPILER_PATH)) throw new Error(`RCL_K08_B_NATIVE_COMPILER_MISSING:${DEFAULT_NATIVE_COMPILER_PATH}`);
  if (!fs.existsSync(DEFAULT_NATIVE_VM_PATH)) throw new Error(`RCL_K08_B_NATIVE_VM_MISSING:${DEFAULT_NATIVE_VM_PATH}`);
  if (!fs.existsSync(compilerRbcPath)) throw new Error(`RCL_K08_B_COMPILER_RBC_MISSING:${compilerRbcPath}`);
  fs.mkdirSync(outputDir, { recursive: true });

  const rbcPath = path.join(outputDir, 'general-mlp.rbc');
  const compileStarted = performance.now();
  const nativeCompile = runNativeCompiler(compilerRbcPath, sourcePath, rbcPath, { timeout: 120_000, maxBuffer: 64 * 1024 * 1024 });
  const compilerRuntimeMs = performance.now() - compileStarted;
  const nativeRbc = fs.readFileSync(rbcPath);
  const referenceRbc = Buffer.from(compileRealityToBytecode(source));
  const decoded = decodeBytecode(nativeRbc);
  const bytecodeParity = nativeRbc.equals(referenceRbc);
  const dependencyAudit = auditGeneralSource(source, decoded);

  const replayCount = Number(contract.thresholds.requiredDeterministicNativeReplays);
  const replays = [];
  for (let index = 0; index < replayCount; index += 1) {
    const started = performance.now();
    const native = runNativeBytecode(rbcPath, { timeout: 120_000, maxBuffer: 64 * 1024 * 1024, requireNativeStateRoot: true });
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
  const state = replays[0].state;
  const oracleStarted = performance.now();
  const oracle = runGeneralMlpOracle(contract);
  const oracleRuntimeMs = performance.now() - oracleStarted;

  const tasks = {};
  for (const task of contract.tasks) {
    const statePrefix = task.id === 'majority3' ? 'majority' : task.id;
    const nativeModel = decodeNativeModel(state[`training.${statePrefix}_final_model`]);
    const nativeOutputs = state[`inference.${statePrefix}_outputs`];
    const nativeLoss = state[`evaluation.${statePrefix}_loss`];
    const nativeAccuracy = state[`evaluation.${statePrefix}_accuracy`];
    const initialLoss = state[`training.${statePrefix}_initial_loss`];
    const oracleTask = oracle.tasks[task.id];
    tasks[task.id] = {
      architecture: task.architecture,
      parameterCount: flattenModel(nativeModel).length,
      initialLoss,
      loss: nativeLoss,
      absoluteLossReduction: initialLoss - nativeLoss,
      accuracy: nativeAccuracy,
      outputs: nativeOutputs,
      expected: task.dataset.map((sample) => sample.target[0]),
      maximumParameterDrift: maximumDifference(flattenModel(nativeModel), flattenModel(oracleTask.finalModel)),
      maximumPredictionDrift: maximumDifference(nativeOutputs, oracleTask.final.outputs),
      passed: state[`evaluation.${statePrefix}_pass`] === true,
    };
  }

  const directCheckpoint = state['checkpoint.direct_32'];
  const resumedCheckpoint = state['checkpoint.resumed_16_plus_16'];
  const checkpoint = {
    directEpoch: directCheckpoint[1],
    resumedEpoch: resumedCheckpoint[1],
    exactResumeParity: canonicalJson(directCheckpoint) === canonicalJson(resumedCheckpoint),
    directRoot: evidenceRoot(directCheckpoint),
    resumedRoot: evidenceRoot(resumedCheckpoint),
    serializedBytes: Buffer.byteLength(JSON.stringify(state['training.xor_checkpoint']), 'utf8'),
  };
  const semanticRoots = replays.map((replay) => replay.semanticStateRoot);
  const identicalSemanticStateRoots = new Set(semanticRoots).size === 1;
  const exactReplayStates = replays.every((replay) => canonicalJson(replay.state) === canonicalJson(state));
  const medianRuntimeMs = median(replays.map((replay) => replay.runtimeMs));

  const checks = {
    express: dependencyAudit.ok && state['evaluation.models_valid'] === true && state['evaluation.datasets_valid'] === true,
    compile: nativeCompile.status === 'ok' && nativeCompile.bytes === nativeRbc.length,
    lower: bytecodeParity && decoded.instructions.length > 0,
    execute: replays.every((replay) => replay.metrics.instructions > 0 && replay.stateRootVerified === true),
    correct: contract.tasks.every((task) => {
      const result = tasks[task.id];
      return result.passed
        && result.accuracy >= task.thresholds.minimumAccuracy
        && result.loss <= task.thresholds.maximumLoss
        && result.absoluteLossReduction >= task.thresholds.minimumAbsoluteLossReduction;
    }),
    negative: state['evaluation.invalid_shape_rejected'] === true && state['evaluation.invalid_dataset_rejected'] === true,
    robust: identicalSemanticStateRoots && exactReplayStates && checkpoint.exactResumeParity,
    performance: medianRuntimeMs > 0 && medianRuntimeMs <= contract.thresholds.maximumMedianNativeRuntimeMs,
    differential: Object.values(tasks).every((task) =>
      task.maximumParameterDrift <= contract.thresholds.maximumOracleDrift
      && task.maximumPredictionDrift <= contract.thresholds.maximumOracleDrift),
  };
  const passEvidence = Object.values(checks).every(Boolean);
  const githubAuthority = verifyGithubAuthorityBinding();
  const evidenceRefs = [
    'examples/native-ai/general-mlp.rcl',
    'examples/native-ai/general-mlp-contract.v0.1.json',
    'examples/native-ai/evidence/k08-b-evidence.json',
    'tests/k08-general-mlp.test.mjs',
  ];
  const gates = Object.fromEntries(['EXPRESS', 'COMPILE', 'LOWER', 'EXECUTE', 'CORRECT', 'ROBUST', 'PERFORMANCE', 'EVIDENCE'].map((gate) => [gate, {
    status: passEvidence ? 'PASS' : 'FAIL',
    evidence: evidenceRefs,
  }]));
  gates.AI_GENERATE = {
    status: githubAuthority.admitted ? 'PASS' : 'UNVERIFIED',
    evidence: githubAuthority.admitted
      ? [
        'examples/native-ai/k233-ai-generation-contract.v0.1.json',
        'examples/native-ai/evidence/k233-ai-generate/receipt.json',
        'examples/native-ai/evidence/k233-ai-generate/github-replay.json',
      ]
      : ['examples/native-ai/k233-ai-generation-contract.v0.1.json'],
    note: githubAuthority.admitted
      ? 'Three independent repair receipts replayed successfully in the bound GitHub-hosted focused-verification job.'
      : 'The implementation session cannot self-sign an independent AI_GENERATE receipt.',
  };

  const artifactRoots = {
    contractRoot: evidenceRoot(contract),
    sourceSha256: sha256File(sourcePath),
    compilerRbcSha256: sha256File(compilerRbcPath),
    targetRbcSha256: sha256Bytes(nativeRbc),
    datasetRoots: Object.fromEntries(contract.tasks.map((task) => [task.id, evidenceRoot(task.dataset)])),
    modelDefinitionRoots: Object.fromEntries(contract.tasks.map((task) => [task.id, evidenceRoot({ architecture: task.architecture, initialModel: task.initialModel })])),
    checkpointRoot: evidenceRoot(checkpoint),
    evaluationRoot: evidenceRoot(tasks),
  };
  const report = {
    format: 'rcl.k08-b-general-mlp-evidence.v0.1',
    generatedAt: new Date().toISOString(),
    verificationDate: String(contract.frozenAt).slice(0, 10),
    verdict: passEvidence
      ? (githubAuthority.admitted ? 'RCL_NATIVE_GENERAL_MLP_AI_N2_VERIFIED' : 'RCL_NATIVE_GENERAL_MLP_AI_N2_VERIFIED_LOCAL_AI_GENERATE_UNVERIFIED')
      : 'FAIL_K08_B_GENERAL_MLP',
    maturity: passEvidence ? 'AI-N2' : 'AI-N1',
    k400Cell: {
      id: 'ai-runtime::machine-learning',
      campaignId: 'K233',
      killerTask: 'K08',
      status: passEvidence ? (githubAuthority.admitted ? 'PASS' : 'BLOCKED_AI_GENERATE') : 'FAIL',
    },
    evidenceBoundary: contract.evidenceBoundary,
    pureExecutionPath: {
      stages: ['RCL source', 'native rclc', 'selfhost/compiler.rbc', 'RBC', 'native rclvm', 'native state'],
      javascriptTrainerParticipated: false,
      referenceOracleParticipatedInNativeParameters: false,
      dependencyAudit,
    },
    compiler: {
      runtimeMs: compilerRuntimeMs,
      executedInstructions: nativeCompile.executedInstructions,
      targetBytes: nativeRbc.length,
      targetInstructions: decoded.instructions.length,
      bytecodeParityWithJsReferenceCompiler: bytecodeParity,
    },
    tasks,
    checkpoint,
    negativeControls: {
      invalidShapeRejected: state['evaluation.invalid_shape_rejected'],
      invalidDatasetRejected: state['evaluation.invalid_dataset_rejected'],
    },
    robustness: {
      replayCount,
      semanticStateRoots: semanticRoots,
      identicalSemanticStateRoots,
      exactReplayStates,
    },
    performance: {
      classification: 'MEASURED_LOCAL_NATIVE_NO_COMPETITIVE_PARITY_CLAIM',
      runtimesMs: replays.map((replay) => replay.runtimeMs),
      medianRuntimeMs,
      referenceOracleRuntimeMs: oracleRuntimeMs,
      nativeToOracleRuntimeRatio: medianRuntimeMs / oracleRuntimeMs,
      executedInstructions: replays[0].metrics.instructions,
      peakStackDepth: replays[0].metrics.peakStackDepth,
      peakCallFrames: replays[0].metrics.peakCallFrames,
      totalParameterCount: Object.values(tasks).reduce((sum, task) => sum + task.parameterCount, 0),
      checkpointBytes: checkpoint.serializedBytes,
      peakMemory: 'UNMEASURED_NATIVE_VM_TELEMETRY_GAP',
      unabsorbedAdvantage: 'The JavaScript oracle remains faster. RCL owns semantics while optimized CPU tensor execution remains a future backend organ.',
    },
    checks,
    githubAuthority,
    gates,
    artifactRoots,
    oracle,
    reportRoot: null,
  };
  report.reportRoot = evidenceRoot({ ...report, generatedAt: undefined, reportRoot: undefined });

  fs.writeFileSync(path.join(outputDir, 'native-run.json'), `${JSON.stringify(replays, null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(outputDir, 'reference-oracle.json'), `${JSON.stringify(oracle, null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(outputDir, 'k08-b-evidence.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(outputDir, 'README.md'), renderReadme(report), 'utf8');
  return report;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const outputDir = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_OUTPUT_DIR;
  const report = runGeneralMlpCampaign({ outputDir });
  console.log(JSON.stringify({
    verdict: report.verdict,
    outputDir,
    xor: report.tasks.xor,
    majority3: report.tasks.majority3,
    checkpoint: report.checkpoint,
    medianRuntimeMs: report.performance.medianRuntimeMs,
    reportRoot: report.reportRoot,
  }, null, 2));
  if (report.maturity !== 'AI-N2') process.exitCode = 1;
}
