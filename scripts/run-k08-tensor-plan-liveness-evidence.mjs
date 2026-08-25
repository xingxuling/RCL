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
const DEFAULT_PLAN = path.join(ROOT, 'output', 'k08-general-mlp-tensor-v0.1', 'general-mlp-tensor.tensor-plan.json');
const ACCEPTED_EVIDENCE = path.join(
  ROOT,
  'examples',
  'native-ai',
  'evidence',
  'tensor-plan-liveness-v0.1',
  'k08-e-tensor-plan-liveness-evidence.json',
);
const K08_D_EVIDENCE = path.join(
  ROOT,
  'examples',
  'native-ai',
  'evidence',
  'general-mlp-tensor-v0.1',
  'k08-d-general-mlp-tensor-evidence.json',
);

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
    timeout: 240_000,
    maxBuffer: 64 * 1024 * 1024,
    ...options,
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `${command} exited ${result.status}`);
  }
  return result.stdout.trim();
}

function execute(binary, request) {
  const started = performance.now();
  const stdout = run(binary, [], { input: `${JSON.stringify(request)}\n` });
  const runtimeMs = performance.now() - started;
  const result = JSON.parse(stdout);
  if (result.status !== 'ok') throw new Error(`RCL_K08_E_EXECUTION_FAILED:${binary}`);
  return { runtimeMs, result, outputRoot: evidenceRoot(result.outputs) };
}

function median(values) {
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.floor(ordered.length / 2)];
}

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

export function runTensorPlanLivenessEvidence(options) {
  if (process.platform !== 'win32') {
    throw new Error('RCL_K08_E_CONTROLLED_PERFORMANCE_EVIDENCE_REQUIRES_WINDOWS');
  }
  const baselineBinary = path.resolve(options.baselineBinary);
  const baselineRepository = path.resolve(options.baselineRepository);
  const planPath = path.resolve(options.planPath ?? DEFAULT_PLAN);
  const rounds = options.rounds ?? 7;
  if (!Number.isInteger(rounds) || rounds < 3 || rounds % 2 === 0) {
    throw new Error('RCL_K08_E_ROUNDS_MUST_BE_ODD_AND_AT_LEAST_3');
  }
  if (!fs.statSync(baselineBinary).isFile() || !fs.statSync(planPath).isFile()) {
    throw new Error('RCL_K08_E_REQUIRED_ARTIFACT_MISSING');
  }

  run('cargo', ['build', '--release', '--locked', '--manifest-path', 'native/tensor-engine/Cargo.toml']);
  const baselineCommit = run('git', ['-C', baselineRepository, 'rev-parse', 'HEAD']);
  const baselineStatus = run('git', ['-C', baselineRepository, 'status', '--porcelain']);
  if (baselineStatus !== '') throw new Error('RCL_K08_E_BASELINE_WORKTREE_DIRTY');

  const planBytes = fs.readFileSync(planPath);
  const planSha256 = sha256(planBytes);
  const plan = JSON.parse(planBytes);
  const request = {
    format: 'rcl.tensor-execution-plan-file.v0.1',
    path: planPath,
    sha256: planSha256,
  };

  execute(baselineBinary, request);
  execute(CURRENT_BINARY, request);
  const samples = { baseline: [], liveness: [] };
  for (let round = 0; round < rounds; round += 1) {
    const order = round % 2 === 0
      ? [['baseline', baselineBinary], ['liveness', CURRENT_BINARY]]
      : [['liveness', CURRENT_BINARY], ['baseline', baselineBinary]];
    for (const [name, binary] of order) samples[name].push(execute(binary, request));
  }

  const baselineFirst = samples.baseline[0].result;
  const currentFirst = samples.liveness[0].result;
  const baselineMedianMs = median(samples.baseline.map((sample) => sample.runtimeMs));
  const livenessMedianMs = median(samples.liveness.map((sample) => sample.runtimeMs));
  const outputRoots = [...samples.baseline, ...samples.liveness].map((sample) => sample.outputRoot);
  const telemetry = currentFirst.telemetry;
  const acceptedK08D = JSON.parse(fs.readFileSync(K08_D_EVIDENCE, 'utf8'));
  const checks = {
    exactBaselineCommit: baselineCommit === options.expectedBaselineCommit,
    baselineClean: baselineStatus === '',
    samePlan: plan.format === 'rcl.tensor-execution-plan.v0.1' && plan.nodes.length === 29_980,
    semanticParity: new Set(outputRoots).size === 1,
    deterministic: new Set(samples.liveness.map((sample) => sample.outputRoot)).size === 1,
    cumulativeAccountingPreserved:
      baselineFirst.telemetry.allocatedBytes === telemetry.cumulativeAllocatedBytes
      && telemetry.storedElements === telemetry.cumulativeAllocatedElements
      && telemetry.allocatedBytes === telemetry.cumulativeAllocatedBytes,
    livenessReclaimsDeadValues:
      telemetry.reclaimedTensorCount > 0
      && telemetry.reclaimedElements + telemetry.retainedOutputElements
        === telemetry.cumulativeAllocatedElements,
    requestedOutputsRetained:
      telemetry.liveElements === telemetry.retainedOutputElements
      && telemetry.liveBytes === telemetry.retainedOutputBytes,
    peakPlanStoreReduced: telemetry.peakLiveBytes < telemetry.cumulativeAllocatedBytes,
    controlledRuntimeImproved: livenessMedianMs < baselineMedianMs,
  };
  const passed = Object.values(checks).every(Boolean);
  const report = {
    format: 'rcl.k08-e.tensor-plan-liveness-evidence.v0.1',
    status: passed
      ? 'ENGINE_E1_TENSOR_PLAN_LIVENESS_CANDIDATE'
      : 'FAIL_TENSOR_PLAN_LIVENESS_CANDIDATE',
    generatedAt: new Date().toISOString(),
    semanticOwner: 'RCL Tensor Plan',
    executionOwner: 'rcl-tensor-cpu-rust-v0.1',
    sourceEvidence: {
      k08dReportRoot: acceptedK08D.reportRoot,
      baselineCommit,
      baselineWorktreeClean: baselineStatus === '',
    },
    artifactHashes: {
      rustBackend: artifactHash([
        'native/tensor-engine/Cargo.toml',
        'native/tensor-engine/Cargo.lock',
        'native/tensor-engine/src/lib.rs',
        'native/tensor-engine/src/main.rs',
        'native/tensor-engine/src/rclvm_provider.rs',
      ]),
      evidenceOrgan: artifactHash(['scripts/run-k08-tensor-plan-liveness-evidence.mjs']),
      loweringOrgan: artifactHash(['scripts/run-k08-general-mlp-tensor-lowering.mjs']),
      baselineBinarySha256: sha256(fs.readFileSync(baselineBinary)),
      livenessBinarySha256: sha256(fs.readFileSync(CURRENT_BINARY)),
    },
    workload: {
      planFormat: plan.format,
      planSha256,
      planBytes: planBytes.length,
      nodes: plan.nodes.length,
      initialTensors: plan.tensors.length,
      requestedOutputs: plan.outputs.length,
      operations: [...new Set(plan.nodes.map((node) => node.operation))].sort(),
    },
    planStore: {
      baselineRetainedElements: baselineFirst.telemetry.storedElements,
      baselineRetainedBytes: baselineFirst.telemetry.allocatedBytes,
      cumulativeAllocatedElements: telemetry.cumulativeAllocatedElements,
      cumulativeAllocatedBytes: telemetry.cumulativeAllocatedBytes,
      peakLiveElements: telemetry.peakLiveElements,
      peakLiveBytes: telemetry.peakLiveBytes,
      retainedOutputElements: telemetry.retainedOutputElements,
      retainedOutputBytes: telemetry.retainedOutputBytes,
      reclaimedTensorCount: telemetry.reclaimedTensorCount,
      reclaimedElements: telemetry.reclaimedElements,
      peakPlanStoreReductionFactor: baselineFirst.telemetry.allocatedBytes / telemetry.peakLiveBytes,
      boundary: 'Logical Tensor Plan value-store accounting only; allocator overhead, transient operand clones, serialization buffers and process peak RSS are excluded.',
    },
    controlledPerformance: {
      boundary: 'Same Windows host, same 6.1 MB plan, warm release binaries, alternating process-level samples; each sample includes plan hash/load, execution and response serialization.',
      rounds,
      baselineSamplesMs: samples.baseline.map((sample) => sample.runtimeMs),
      livenessSamplesMs: samples.liveness.map((sample) => sample.runtimeMs),
      baselineMedianMs,
      livenessMedianMs,
      speedup: baselineMedianMs / livenessMedianMs,
      runtimeReductionPercent: (1 - livenessMedianMs / baselineMedianMs) * 100,
    },
    outputRoot: outputRoots[0],
    checks,
    claimsNotGranted: [
      'PROCESS_RSS_REDUCTION',
      'GENERAL_TENSOR_WORKLOAD_SPEEDUP',
      'PERFORMANCE_PARITY_WITH_JAVASCRIPT',
      'BUFFER_REUSE',
      'NATIVE_AUTODIFF',
      'K400_PROMOTION_FROM_THIS_CANDIDATE',
    ],
    nextGap: 'Measure process RSS, eliminate per-node operand/storage clones, then evaluate compact lowering and typed self-host ownership.',
    reportRoot: null,
  };
  report.reportRoot = evidenceRoot({ ...report, generatedAt: undefined, reportRoot: undefined });

  const outputPath = path.resolve(options.outputPath);
  writeJson(outputPath, report);
  if (options.acceptEvidence) writeJson(ACCEPTED_EVIDENCE, report);
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const baselineBinary = argumentValue('--baseline-binary') ?? process.env.RCL_K08_E_BASELINE_BINARY;
  const baselineRepository = argumentValue('--baseline-repository') ?? process.env.RCL_K08_E_BASELINE_REPOSITORY;
  if (!baselineBinary || !baselineRepository) {
    throw new Error('Pass --baseline-binary and --baseline-repository for the exact pre-liveness worktree.');
  }
  const report = runTensorPlanLivenessEvidence({
    baselineBinary,
    baselineRepository,
    expectedBaselineCommit: argumentValue('--baseline-commit') ?? 'ccfab80217a76d8ad5ab923e891cb8e8fbd538d7',
    planPath: argumentValue('--plan') ?? DEFAULT_PLAN,
    rounds: Number(argumentValue('--rounds') ?? 7),
    outputPath: argumentValue('--output') ?? path.join(ROOT, 'output', 'k08-tensor-plan-liveness-v0.1', 'k08-e-tensor-plan-liveness-evidence.json'),
    acceptEvidence: process.argv.includes('--accept-evidence'),
  });
  console.log(JSON.stringify({
    status: report.status,
    reportRoot: report.reportRoot,
    peakPlanStoreReductionFactor: report.planStore.peakPlanStoreReductionFactor,
    controlledRuntimeSpeedup: report.controlledPerformance.speedup,
    checks: report.checks,
  }, null, 2));
  if (report.status.startsWith('FAIL')) process.exitCode = 1;
}
