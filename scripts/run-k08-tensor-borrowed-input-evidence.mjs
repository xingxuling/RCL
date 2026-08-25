import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { evidenceRoot } from '../src/universal-program-stress.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CURRENT_BINARY = path.join(
  ROOT,
  'native',
  'tensor-engine',
  'target',
  'release',
  process.platform === 'win32' ? 'rcl-tensor-engine.exe' : 'rcl-tensor-engine',
);
const DEFAULT_PLAN = path.join(
  ROOT,
  'output',
  'k08-general-mlp-tensor-v0.1',
  'general-mlp-tensor.tensor-plan.json',
);
const DEFAULT_OUTPUT_DIR = path.join(ROOT, 'output', 'k08-tensor-borrowed-input-v0.1');
const ACCEPTED_EVIDENCE = path.join(
  ROOT,
  'examples',
  'native-ai',
  'evidence',
  'tensor-plan-borrowed-inputs-v0.1',
  'k08-f-tensor-borrowed-input-evidence.json',
);
const RSS_SAMPLER = path.join(ROOT, 'scripts', 'measure-process-peak-working-set.ps1');

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
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

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 300_000,
    maxBuffer: 96 * 1024 * 1024,
    ...options,
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `${command} exited ${result.status}`);
  }
  return result.stdout.trim();
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function median(values) {
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.floor(ordered.length / 2)];
}

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function planFileRequest(planPath) {
  return {
    format: 'rcl.tensor-execution-plan-file.v0.1',
    path: planPath,
    sha256: sha256(fs.readFileSync(planPath)),
  };
}

function execute(binary, request) {
  const started = performance.now();
  const stdout = run(binary, [], { input: `${JSON.stringify(request)}\n` });
  const runtimeMs = performance.now() - started;
  const result = JSON.parse(stdout);
  if (result.status !== 'ok') throw new Error(`RCL_K08_F_EXECUTION_FAILED:${binary}`);
  return { runtimeMs, result, outputRoot: evidenceRoot(result.outputs) };
}

function samplePeakWorkingSet(binary, requestFile) {
  const raw = run('powershell.exe', [
    '-NoProfile',
    '-NonInteractive',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    RSS_SAMPLER,
    '-Binary',
    binary,
    '-InputFile',
    requestFile,
  ]);
  const envelope = JSON.parse(raw);
  if (envelope.exitCode !== 0) {
    throw new Error(envelope.stderr || `RCL_K08_F_CHILD_EXIT_${envelope.exitCode}`);
  }
  const result = JSON.parse(envelope.stdout);
  if (result.status !== 'ok') throw new Error('RCL_K08_F_RSS_EXECUTION_FAILED');
  return {
    peakWorkingSetBytes: envelope.peakWorkingSetBytes,
    result,
    outputRoot: evidenceRoot(result.outputs),
  };
}

function cloneStressPlan(elementCount) {
  const left = Array.from({ length: elementCount }, (_, index) => (index % 17) - 8);
  const right = Array.from({ length: elementCount }, (_, index) => (index % 11) - 5);
  return {
    format: 'rcl.tensor-execution-plan.v0.1',
    bindings: { stress: 'K08-F borrowed input storage' },
    tensors: [
      {
        id: 'left', shape: [elementCount], dtype: 'f64', layout: 'row-major', device: 'cpu',
        gradientIdentity: 'constant:left', storageIdentity: 'storage:left',
      },
      {
        id: 'right', shape: [elementCount], dtype: 'f64', layout: 'row-major', device: 'cpu',
        gradientIdentity: 'constant:right', storageIdentity: 'storage:right',
      },
    ],
    storages: [
      { identity: 'storage:left', kind: 'cpu-dense', data: left },
      { identity: 'storage:right', kind: 'cpu-dense', data: right },
    ],
    nodes: [{
      id: 'add',
      operation: 'add',
      inputs: ['left', 'right'],
      output: {
        id: 'result', shape: [elementCount], dtype: 'f64', layout: 'row-major', device: 'cpu',
        gradientIdentity: 'derived:add',
      },
      attributes: {},
    }],
    outputs: ['result'],
  };
}

function alternatingSamples(baselineBinary, candidateBinary, rounds, sample) {
  const samples = { baseline: [], borrowed: [] };
  for (let round = 0; round < rounds; round += 1) {
    const order = round % 2 === 0
      ? [['baseline', baselineBinary], ['borrowed', candidateBinary]]
      : [['borrowed', candidateBinary], ['baseline', baselineBinary]];
    for (const [name, binary] of order) samples[name].push(sample(binary));
  }
  return samples;
}

function allSameOutput(samples) {
  return new Set([...samples.baseline, ...samples.borrowed].map((sample) => sample.outputRoot)).size === 1;
}

export function runTensorBorrowedInputEvidence(options) {
  if (process.platform !== 'win32') {
    throw new Error('RCL_K08_F_CONTROLLED_MEMORY_EVIDENCE_REQUIRES_WINDOWS');
  }
  const baselineBinary = path.resolve(options.baselineBinary);
  const baselineRepository = path.resolve(options.baselineRepository);
  const planPath = path.resolve(options.planPath ?? DEFAULT_PLAN);
  const outputDir = path.resolve(options.outputDir ?? DEFAULT_OUTPUT_DIR);
  const rounds = options.rounds ?? 7;
  const rssRounds = options.rssRounds ?? 5;
  if (!Number.isInteger(rounds) || rounds < 3 || rounds % 2 === 0) {
    throw new Error('RCL_K08_F_ROUNDS_MUST_BE_ODD_AND_AT_LEAST_3');
  }
  if (!Number.isInteger(rssRounds) || rssRounds < 3 || rssRounds % 2 === 0) {
    throw new Error('RCL_K08_F_RSS_ROUNDS_MUST_BE_ODD_AND_AT_LEAST_3');
  }
  for (const required of [baselineBinary, planPath, RSS_SAMPLER]) {
    if (!fs.statSync(required).isFile()) throw new Error('RCL_K08_F_REQUIRED_ARTIFACT_MISSING');
  }

  run('cargo', ['build', '--release', '--locked', '--manifest-path', 'native/tensor-engine/Cargo.toml']);
  const baselineCommit = run('git', ['-C', baselineRepository, 'rev-parse', 'HEAD']);
  const baselineStatus = run('git', ['-C', baselineRepository, 'status', '--porcelain']);
  if (baselineStatus !== '') throw new Error('RCL_K08_F_BASELINE_WORKTREE_DIRTY');

  fs.mkdirSync(outputDir, { recursive: true });
  const productionRequest = planFileRequest(planPath);
  const productionRequestPath = path.join(outputDir, 'production-plan-request.json');
  writeJson(productionRequestPath, productionRequest);
  const stressPlanPath = path.join(outputDir, 'clone-stress.tensor-plan.json');
  writeJson(stressPlanPath, cloneStressPlan(options.stressElements ?? 200_000));
  const stressRequest = planFileRequest(stressPlanPath);
  const stressRequestPath = path.join(outputDir, 'clone-stress-request.json');
  writeJson(stressRequestPath, stressRequest);

  execute(baselineBinary, productionRequest);
  execute(CURRENT_BINARY, productionRequest);
  const runtimeSamples = alternatingSamples(
    baselineBinary,
    CURRENT_BINARY,
    rounds,
    (binary) => execute(binary, productionRequest),
  );
  const productionRssSamples = alternatingSamples(
    baselineBinary,
    CURRENT_BINARY,
    rssRounds,
    (binary) => samplePeakWorkingSet(binary, productionRequestPath),
  );
  const stressRssSamples = alternatingSamples(
    baselineBinary,
    CURRENT_BINARY,
    rssRounds,
    (binary) => samplePeakWorkingSet(binary, stressRequestPath),
  );

  const candidateProduction = runtimeSamples.borrowed[0].result;
  const candidateStress = stressRssSamples.borrowed[0].result;
  const baselineRuntimeMedianMs = median(runtimeSamples.baseline.map((sample) => sample.runtimeMs));
  const borrowedRuntimeMedianMs = median(runtimeSamples.borrowed.map((sample) => sample.runtimeMs));
  const productionBaselineRss = productionRssSamples.baseline.map((sample) => sample.peakWorkingSetBytes);
  const productionBorrowedRss = productionRssSamples.borrowed.map((sample) => sample.peakWorkingSetBytes);
  const stressBaselineRss = stressRssSamples.baseline.map((sample) => sample.peakWorkingSetBytes);
  const stressBorrowedRss = stressRssSamples.borrowed.map((sample) => sample.peakWorkingSetBytes);
  const productionBaselineRssMedian = median(productionBaselineRss);
  const productionBorrowedRssMedian = median(productionBorrowedRss);
  const stressBaselineRssMedian = median(stressBaselineRss);
  const stressBorrowedRssMedian = median(stressBorrowedRss);
  const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
  const stressPlan = JSON.parse(fs.readFileSync(stressPlanPath, 'utf8'));

  const checks = {
    exactBaselineCommit: baselineCommit === options.expectedBaselineCommit,
    baselineClean: baselineStatus === '',
    productionPlanUnchanged: plan.nodes.length === 29_980 && plan.tensors.length === 40,
    productionSemanticParity: allSameOutput(runtimeSamples) && allSameOutput(productionRssSamples),
    stressSemanticParity: allSameOutput(stressRssSamples),
    borrowedBindingsAudited:
      candidateProduction.telemetry.inputBindingCount > 0
      && candidateProduction.telemetry.borrowedInputBindingCount
        === candidateProduction.telemetry.inputBindingCount,
    noPlanInputStorageClones:
      candidateProduction.telemetry.clonedInputElements === 0
      && candidateProduction.telemetry.clonedInputBytes === 0,
    historicalCloneTrafficAvoided:
      candidateProduction.telemetry.avoidedInputCloneElements > 0
      && candidateProduction.telemetry.avoidedInputCloneBytes
        === candidateProduction.telemetry.avoidedInputCloneElements * 8,
    stressCloneBoundary:
      candidateStress.telemetry.avoidedInputCloneElements === stressPlan.tensors[0].shape[0] * 2,
    peakWorkingSetMeasured:
      [...productionBaselineRss, ...productionBorrowedRss, ...stressBaselineRss, ...stressBorrowedRss]
        .every((value) => Number.isSafeInteger(value) && value > 0),
    stressPeakWorkingSetReduced: stressBorrowedRssMedian < stressBaselineRssMedian,
  };
  const passed = Object.values(checks).every(Boolean);
  const report = {
    format: 'rcl.k08-f.tensor-borrowed-input-evidence.v0.1',
    status: passed ? 'ENGINE_E1_TENSOR_BORROWED_INPUT_CANDIDATE' : 'FAIL_TENSOR_BORROWED_INPUT_CANDIDATE',
    generatedAt: new Date().toISOString(),
    semanticOwner: 'RCL Tensor Plan',
    executionOwner: 'rcl-tensor-cpu-rust-v0.1',
    implementationDecision: 'BORROW_PLAN_INPUTS_WITHOUT_STORAGE_OR_DESCRIPTOR_CLONES',
    sourceEvidence: { baselineCommit, baselineWorktreeClean: baselineStatus === '' },
    artifactHashes: {
      rustBackend: artifactHash([
        'native/tensor-engine/Cargo.toml',
        'native/tensor-engine/Cargo.lock',
        'native/tensor-engine/src/lib.rs',
        'native/tensor-engine/src/main.rs',
        'native/tensor-engine/src/rclvm_provider.rs',
      ]),
      evidenceOrgan: artifactHash([
        'scripts/run-k08-tensor-borrowed-input-evidence.mjs',
        'scripts/measure-process-peak-working-set.ps1',
      ]),
      baselineBinarySha256: sha256(fs.readFileSync(baselineBinary)),
      borrowedBinarySha256: sha256(fs.readFileSync(CURRENT_BINARY)),
    },
    productionWorkload: {
      planSha256: sha256(fs.readFileSync(planPath)),
      planBytes: fs.statSync(planPath).size,
      nodes: plan.nodes.length,
      initialTensors: plan.tensors.length,
      requestedOutputs: plan.outputs.length,
      inputBindingCount: candidateProduction.telemetry.inputBindingCount,
      avoidedInputCloneElements: candidateProduction.telemetry.avoidedInputCloneElements,
      avoidedInputCloneBytes: candidateProduction.telemetry.avoidedInputCloneBytes,
      clonedInputElements: candidateProduction.telemetry.clonedInputElements,
      clonedInputBytes: candidateProduction.telemetry.clonedInputBytes,
    },
    controlledPerformance: {
      boundary: 'Same Windows host and unchanged 29,980-node plan; warm release binaries; alternating child-process samples include plan hash/load, execution and response serialization.',
      rounds,
      baselineSamplesMs: runtimeSamples.baseline.map((sample) => sample.runtimeMs),
      borrowedSamplesMs: runtimeSamples.borrowed.map((sample) => sample.runtimeMs),
      baselineMedianMs: baselineRuntimeMedianMs,
      borrowedMedianMs: borrowedRuntimeMedianMs,
      speedup: baselineRuntimeMedianMs / borrowedRuntimeMedianMs,
      runtimeReductionPercent: (1 - borrowedRuntimeMedianMs / baselineRuntimeMedianMs) * 100,
      improvementObserved: borrowedRuntimeMedianMs < baselineRuntimeMedianMs,
    },
    processMemory: {
      metric: 'Windows Process.PeakWorkingSet64 for the exact child process',
      samplerRounds: rssRounds,
      production: {
        baselineSamplesBytes: productionBaselineRss,
        borrowedSamplesBytes: productionBorrowedRss,
        baselineMedianBytes: productionBaselineRssMedian,
        borrowedMedianBytes: productionBorrowedRssMedian,
        reductionBytes: productionBaselineRssMedian - productionBorrowedRssMedian,
        reductionPercent: (1 - productionBorrowedRssMedian / productionBaselineRssMedian) * 100,
      },
      cloneStress: {
        elementsPerInput: stressPlan.tensors[0].shape[0],
        historicalInputCloneBytes: candidateStress.telemetry.avoidedInputCloneBytes,
        baselineSamplesBytes: stressBaselineRss,
        borrowedSamplesBytes: stressBorrowedRss,
        baselineMedianBytes: stressBaselineRssMedian,
        borrowedMedianBytes: stressBorrowedRssMedian,
        reductionBytes: stressBaselineRssMedian - stressBorrowedRssMedian,
        reductionPercent: (1 - stressBorrowedRssMedian / stressBaselineRssMedian) * 100,
      },
      boundary: 'Peak process Working Set includes executable, allocator, JSON plan/input/output and all Rust process allocations; it is not the logical Tensor-store metric and is not portable RSS/VRAM evidence.',
    },
    outputRoots: {
      production: runtimeSamples.borrowed[0].outputRoot,
      cloneStress: stressRssSamples.borrowed[0].outputRoot,
    },
    checks,
    claimsNotGranted: [
      'GENERAL_TENSOR_MEMORY_REDUCTION',
      'PORTABLE_RSS_REDUCTION',
      'BUFFER_REUSE',
      'COMPACT_PLAN_LOWERING',
      'PERFORMANCE_PARITY_WITH_JAVASCRIPT',
      'NATIVE_AUTODIFF',
      'K400_PROMOTION_FROM_THIS_CANDIDATE',
    ],
    nextGap: 'Use liveness intervals for safe output-buffer reuse, then compact the 6.1 MB scalar-dispatch plan.',
    reportRoot: null,
  };
  report.reportRoot = evidenceRoot({ ...report, generatedAt: undefined, reportRoot: undefined });

  const outputPath = path.resolve(options.outputPath ?? path.join(outputDir, 'k08-f-tensor-borrowed-input-evidence.json'));
  writeJson(outputPath, report);
  if (options.acceptEvidence) writeJson(ACCEPTED_EVIDENCE, report);
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const baselineBinary = argumentValue('--baseline-binary') ?? process.env.RCL_K08_F_BASELINE_BINARY;
  const baselineRepository = argumentValue('--baseline-repository') ?? process.env.RCL_K08_F_BASELINE_REPOSITORY;
  if (!baselineBinary || !baselineRepository) {
    throw new Error('Pass --baseline-binary and --baseline-repository for the exact pre-borrowed-input worktree.');
  }
  const report = runTensorBorrowedInputEvidence({
    baselineBinary,
    baselineRepository,
    expectedBaselineCommit: argumentValue('--baseline-commit') ?? '9805956dfd24834d650534a8186ab53eb084f8b5',
    planPath: argumentValue('--plan') ?? DEFAULT_PLAN,
    rounds: Number(argumentValue('--rounds') ?? 7),
    rssRounds: Number(argumentValue('--rss-rounds') ?? 5),
    stressElements: Number(argumentValue('--stress-elements') ?? 200_000),
    outputDir: argumentValue('--output-dir') ?? DEFAULT_OUTPUT_DIR,
    outputPath: argumentValue('--output'),
    acceptEvidence: process.argv.includes('--accept-evidence'),
  });
  console.log(JSON.stringify({
    status: report.status,
    reportRoot: report.reportRoot,
    productionRuntimeSpeedup: report.controlledPerformance.speedup,
    productionPeakWorkingSetReductionPercent: report.processMemory.production.reductionPercent,
    stressPeakWorkingSetReductionPercent: report.processMemory.cloneStress.reductionPercent,
    checks: report.checks,
  }, null, 2));
  if (report.status.startsWith('FAIL')) process.exitCode = 1;
}
