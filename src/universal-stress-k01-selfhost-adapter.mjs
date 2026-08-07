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

export function buildK01ClaimFromSelfhostSummary(summary, { receiptId = 'selfhost-summary' } = {}) {
  if (!summary || summary.format !== 'rcl.selfhost.summary.v1') {
    throw new Error('RCL_STRESS_K01_INVALID_SELFHOST_SUMMARY');
  }

  const boundary = summary.boundary ?? {};
  const stages = Array.isArray(summary.stages) ? summary.stages : [];
  const stagePasses = stages.filter((stage) => stage.ok === true).length;
  const allStagesPassed = stages.length > 0 && stagePasses === stages.length;
  const fixedPoint = summary.generalCompilerFixedPoint?.ok === true;

  const claim = {
    id: 'compiler-runtime::self-hosting',
    coverageMode: COVERAGE_MODE.NATIVE_SEMANTIC,
    gates: {
      EXPRESS: gate(
        boundary.fullSelfHosting === true ? PASS : FAIL,
        [receiptId],
        boundary.fullSelfHosting === true
          ? 'full self-hosting boundary is explicitly verified'
          : 'existing verifier explicitly reports fullSelfHosting=false',
      ),
      COMPILE: gate(
        fixedPoint ? PASS : FAIL,
        [receiptId],
        'general compiler fixed-point tests are the compile witness',
      ),
      LOWER: gate(
        boundary.rclOwnedRuleBytecodeLoweringComplete === true ? PASS : FAIL,
        [receiptId],
        'complete RCL-owned rule bytecode lowering is required for K01',
      ),
      EXECUTE: gate(
        boundary.rclOwnedRuntimeComplete === true ? PASS : FAIL,
        [receiptId],
        'complete RCL-owned runtime execution is required for K01',
      ),
      CORRECT: gate(
        fixedPoint && allStagesPassed ? PASS : FAIL,
        [receiptId],
        `selfhost stage verification: ${stagePasses}/${stages.length}`,
        { passedStages: stagePasses, totalStages: stages.length },
      ),
      ROBUST: gate(
        UNVERIFIED,
        [receiptId],
        'the existing selfhost summary is not by itself a cross-environment/adversarial robustness campaign',
      ),
      PERFORMANCE: gate(
        UNVERIFIED,
        [receiptId],
        'no competitive self-host compile/runtime performance baseline is attached',
      ),
      AI_GENERATE: gate(
        UNVERIFIED,
        [receiptId],
        'no reproducible intent-to-selfhost-compiler AI generation trial is attached',
      ),
      EVIDENCE: gate(
        stages.length > 0 ? PASS : FAIL,
        [receiptId],
        'existing stage reports and fixed-point receipts are adapted, not reinterpreted as full self-hosting',
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

export function runK01SelfhostProbe({ repositoryRoot = process.cwd() } = {}) {
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
  const claim = buildK01ClaimFromSelfhostSummary(summary, { receiptId: receipt.receiptRoot });

  return {
    receipt,
    claim,
    status: claim.status,
  };
}
