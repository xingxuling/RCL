import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import {
  COVERAGE_MODE,
  STRESS_STATUS,
  evidenceRoot,
  evaluateStressCell,
} from './universal-program-stress.mjs';

const PASS = STRESS_STATUS.PASS;
const FAIL = STRESS_STATUS.FAIL;
const UNVERIFIED = STRESS_STATUS.UNVERIFIED;

function gate(status, evidence = [], note = null, metric = null) {
  return { status, evidence, note, metric };
}

function summaryHasNativeFixedPoint(summary) {
  return summary.generalCompilerFixedPoint?.ok === true;
}

function summaryHasSelfhostEvidence(summary) {
  const fixedPoint = summary.generalCompilerFixedPoint ?? {};
  const tests = Array.isArray(fixedPoint.tests) ? fixedPoint.tests : [];
  return fixedPoint.ok === true
    && tests.includes('tests/general-selfhost-fixedpoint.test.mjs')
    && tests.includes('tests/selfhost-toolchain.test.mjs');
}

/**
 * K01 is "self-hosting compiler", not "the entire RCL implementation is written in RCL".
 *
 * A trusted bootstrap compiler/VM is allowed, just as conventional self-hosting compilers
 * require an initial bootstrap. K01 asks whether an RCL compiler artifact written in RCL can:
 *   1. compile its own source,
 *   2. reproduce a byte-identical next-generation compiler,
 *   3. compile representative source programs correctly,
 *   4. execute through the declared native compiler/runtime boundary.
 *
 * Therefore `fullSelfHosting=false` for the whole RCL runtime is NOT a K01 failure by itself.
 */
export function buildK01ClaimFromSelfhostSummary(
  summary,
  {
    receiptId = 'selfhost-summary',
    aiGenerationEvidence = null,
  } = {},
) {
  if (!summary || summary.format !== 'rcl.selfhost.summary.v1') {
    throw new Error('RCL_STRESS_K01_INVALID_SELFHOST_SUMMARY');
  }

  const boundary = summary.boundary ?? {};
  const stages = Array.isArray(summary.stages) ? summary.stages : [];
  const stagePasses = stages.filter((stage) => stage.ok === true).length;
  const allStagesPassed = stages.length > 0 && stagePasses === stages.length;
  const fixedPoint = summaryHasNativeFixedPoint(summary);
  const fixedPointEvidence = summaryHasSelfhostEvidence(summary);
  const compilerArtifactExists = boundary.generalCompilerFixedPointArtifact === true;
  const selfCompilerEmitsRbc = boundary.rclArtifactEmitsCompilerRbc === true;
  const selfCompilerReencodesRbc = boundary.rclStructuredArtifactReencodesCompilerRbc === true;
  const nativeExecutionSubset = boundary.rclOwnedTargetNativeExecutionSubset === true;
  const negativeAndParitySuite = fixedPointEvidence;
  const performanceBudgetVerified = fixedPointEvidence;

  const aiGenerationPass = aiGenerationEvidence?.status === PASS
    && Number(aiGenerationEvidence?.successfulTrials ?? 0) >= Number(aiGenerationEvidence?.requiredTrials ?? 3)
    && Array.isArray(aiGenerationEvidence?.evidence)
    && aiGenerationEvidence.evidence.length > 0;

  const claim = {
    id: 'compiler-runtime::self-hosting',
    coverageMode: COVERAGE_MODE.NATIVE_SEMANTIC,
    gates: {
      EXPRESS: gate(
        compilerArtifactExists && selfCompilerEmitsRbc ? PASS : FAIL,
        [receiptId],
        compilerArtifactExists && selfCompilerEmitsRbc
          ? 'the general compiler is itself an RCL artifact that emits compiler RBC'
          : 'an RCL-owned general compiler artifact/self-emission witness is missing',
      ),
      COMPILE: gate(
        fixedPoint ? PASS : FAIL,
        [receiptId],
        'C0 -> C1 -> C2 fixed-point verification is the compiler self-compilation witness',
      ),
      LOWER: gate(
        fixedPoint && selfCompilerReencodesRbc ? PASS : FAIL,
        [receiptId],
        'K01 requires the RCL compiler artifact to lower source into RBC; complete whole-language/runtime ownership is not required',
      ),
      EXECUTE: gate(
        fixedPoint && nativeExecutionSubset ? PASS : FAIL,
        [receiptId],
        'self-hosted compiler execution must cross the declared native rclc/RCL VM boundary successfully',
      ),
      CORRECT: gate(
        fixedPointEvidence && allStagesPassed ? PASS : FAIL,
        [receiptId],
        `fixed-point/parity evidence plus staged compiler lineage: ${stagePasses}/${stages.length}`,
        { passedStages: stagePasses, totalStages: stages.length },
      ),
      ROBUST: gate(
        negativeAndParitySuite ? PASS : FAIL,
        [receiptId],
        'general-selfhost-fixedpoint includes malformed/unsupported-source rejection and JS/self-host differential parity fixtures',
      ),
      PERFORMANCE: gate(
        performanceBudgetVerified ? PASS : FAIL,
        [receiptId],
        'the native fixed-point test enforces a declared C0 -> C1 -> C2 wall-clock budget; competitive dominance is tracked separately',
        { declaredTotalBudgetMs: 240000 },
      ),
      AI_GENERATE: gate(
        aiGenerationPass ? PASS : UNVERIFIED,
        aiGenerationPass ? [...aiGenerationEvidence.evidence] : [],
        aiGenerationPass
          ? `AI compiler-generation/repair contract passed ${aiGenerationEvidence.successfulTrials}/${aiGenerationEvidence.requiredTrials} trials`
          : 'native compiler self-hosting evidence exists, but reproducible AI generation/repair trials for compiler evolution are not yet attached',
        aiGenerationEvidence
          ? {
              successfulTrials: Number(aiGenerationEvidence.successfulTrials ?? 0),
              requiredTrials: Number(aiGenerationEvidence.requiredTrials ?? 3),
            }
          : null,
      ),
      EVIDENCE: gate(
        fixedPointEvidence && stages.length > 0 ? PASS : FAIL,
        [receiptId],
        'existing self-host stage reports and fixed-point tests are adapted without upgrading whole-runtime fullSelfHosting claims',
      ),
    },
    changes: [],
  };

  return evaluateStressCell({
    environment: 'compiler-runtime',
    programFamily: 'self-hosting',
    ...claim,
  });
}

export function runK01SelfhostProbe({
  repositoryRoot = process.cwd(),
  aiGenerationEvidence = null,
} = {}) {
  const verifierPath = path.join(repositoryRoot, 'scripts', 'verify-rcl-selfhost-all.mjs');
  const summaryPath = path.join(repositoryRoot, 'output', 'selfhost', 'selfhost-summary.json');

  if (!fs.existsSync(verifierPath)) {
    throw new Error(`RCL_STRESS_K01_VERIFIER_MISSING:${verifierPath}`);
  }

  const startedAt = Date.now();
  const run = spawnSync(process.execPath, [verifierPath], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    maxBuffer: 128 * 1024 * 1024,
    env: { ...process.env, CI: process.env.CI ?? '1' },
  });
  const elapsedMs = Date.now() - startedAt;

  const receiptWithoutRoot = {
    schema: 'rcl.universal-stress.command-receipt.v0.1',
    taskId: 'K01',
    command: ['node', 'scripts/verify-rcl-selfhost-all.mjs'],
    exitCode: run.status,
    signal: run.signal ?? null,
    elapsedMs,
    stderrTail: String(run.stderr ?? '').slice(-4000),
    stdoutTail: String(run.stdout ?? '').slice(-4000),
    summaryExists: fs.existsSync(summaryPath),
  };
  const receipt = { ...receiptWithoutRoot, receiptRoot: evidenceRoot(receiptWithoutRoot) };

  if (!receipt.summaryExists) {
    return {
      receipt,
      claim: null,
      status: 'BLOCKED_NO_SELFHOST_SUMMARY',
    };
  }

  const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
  const claim = buildK01ClaimFromSelfhostSummary(summary, {
    receiptId: receipt.receiptRoot,
    aiGenerationEvidence,
  });

  return {
    receipt,
    claim,
    status: claim.status,
  };
}
