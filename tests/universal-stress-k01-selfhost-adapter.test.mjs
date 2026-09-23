import test from 'node:test';
import assert from 'node:assert/strict';

import { STRESS_STATUS } from '../src/universal-program-stress.mjs';
import { buildK01ClaimFromSelfhostSummary } from '../src/universal-stress-k01-selfhost-adapter.mjs';

function summary(overrides = {}) {
  const base = {
    format: 'rcl.selfhost.summary.v1',
    stages: [{ id: 'stage0', ok: true }, { id: 'stage40', ok: true }],
    boundary: {
      fullSelfHosting: false,
      generalCompilerFixedPointArtifact: true,
      rclArtifactEmitsCompilerRbc: true,
      rclStructuredArtifactReencodesCompilerRbc: true,
      rclOwnedTargetNativeExecutionSubset: true,
      rclOwnedRuleBytecodeLoweringComplete: false,
      rclOwnedRuntimeComplete: false,
    },
    generalCompilerFixedPoint: {
      ok: true,
      tests: [
        'tests/general-selfhost-fixedpoint.test.mjs',
        'tests/selfhost-toolchain.test.mjs',
      ],
    },
  };

  return {
    ...base,
    ...overrides,
    boundary: { ...base.boundary, ...(overrides.boundary ?? {}) },
    generalCompilerFixedPoint: {
      ...base.generalCompilerFixedPoint,
      ...(overrides.generalCompilerFixedPoint ?? {}),
    },
  };
}

function passingPerformanceEvidence(overrides = {}) {
  return {
    status: STRESS_STATUS.PASS,
    evidence: ['performance:dedicated-host-receipt'],
    declaredTotalBudgetMs: 240000,
    measuredTotalElapsedMs: 120000,
    environment: 'dedicated-host',
    measuredAt: '2026-09-23T00:00:00.000Z',
    ...overrides,
  };
}

test('K01 correctly distinguishes compiler self-hosting from whole-runtime full self-hosting', () => {
  const claim = buildK01ClaimFromSelfhostSummary(summary());

  assert.equal(claim.gates.EXPRESS.status, STRESS_STATUS.PASS);
  assert.equal(claim.gates.COMPILE.status, STRESS_STATUS.PASS);
  assert.equal(claim.gates.LOWER.status, STRESS_STATUS.PASS);
  assert.equal(claim.gates.EXECUTE.status, STRESS_STATUS.PASS);
  assert.equal(claim.gates.CORRECT.status, STRESS_STATUS.PASS);
  assert.equal(claim.gates.ROBUST.status, STRESS_STATUS.PASS);
  assert.equal(claim.gates.PERFORMANCE.status, STRESS_STATUS.UNVERIFIED);
  assert.equal(claim.gates.AI_GENERATE.status, STRESS_STATUS.UNVERIFIED);
  assert.equal(claim.gates.EVIDENCE.status, STRESS_STATUS.PASS);
  assert.equal(claim.status, STRESS_STATUS.BLOCKED);
});

test('fullSelfHosting=false is not itself a K01 compiler-selfhosting failure', () => {
  const claim = buildK01ClaimFromSelfhostSummary(summary({
    boundary: {
      fullSelfHosting: false,
      rclOwnedRuntimeComplete: false,
      rclOwnedRuleBytecodeLoweringComplete: false,
    },
  }));

  assert.equal(claim.gates.EXPRESS.status, STRESS_STATUS.PASS);
  assert.equal(claim.gates.LOWER.status, STRESS_STATUS.PASS);
  assert.equal(claim.gates.EXECUTE.status, STRESS_STATUS.PASS);
});

test('missing RCL compiler artifact/self-emission witness fails EXPRESS', () => {
  const claim = buildK01ClaimFromSelfhostSummary(summary({
    boundary: {
      generalCompilerFixedPointArtifact: false,
      rclArtifactEmitsCompilerRbc: false,
    },
  }));
  assert.equal(claim.gates.EXPRESS.status, STRESS_STATUS.FAIL);
  assert.equal(claim.status, STRESS_STATUS.FAIL);
});

test('fixed-point failure is a compile/correctness/robustness failure but does not invent a performance verdict', () => {
  const claim = buildK01ClaimFromSelfhostSummary(summary({
    generalCompilerFixedPoint: { ok: false },
  }));
  assert.equal(claim.gates.COMPILE.status, STRESS_STATUS.FAIL);
  assert.equal(claim.gates.CORRECT.status, STRESS_STATUS.FAIL);
  assert.equal(claim.gates.ROBUST.status, STRESS_STATUS.FAIL);
  assert.equal(claim.gates.PERFORMANCE.status, STRESS_STATUS.UNVERIFIED);
});

test('missing native execution subset fails EXECUTE', () => {
  const claim = buildK01ClaimFromSelfhostSummary(summary({
    boundary: { rclOwnedTargetNativeExecutionSubset: false },
  }));
  assert.equal(claim.gates.EXECUTE.status, STRESS_STATUS.FAIL);
});

test('dedicated host-performance evidence closes PERFORMANCE independently from deterministic fixed-point truth', () => {
  const claim = buildK01ClaimFromSelfhostSummary(summary(), {
    performanceEvidence: passingPerformanceEvidence(),
  });

  assert.equal(claim.gates.PERFORMANCE.status, STRESS_STATUS.PASS);
  assert.deepEqual(claim.gates.PERFORMANCE.evidence, ['performance:dedicated-host-receipt']);
  assert.equal(claim.gates.PERFORMANCE.metric.declaredTotalBudgetMs, 240000);
  assert.equal(claim.gates.PERFORMANCE.metric.measuredTotalElapsedMs, 120000);
  assert.equal(claim.status, STRESS_STATUS.BLOCKED);
});

test('performance evidence fails closed when a PASS verdict contradicts its wall-clock measurement', () => {
  const claim = buildK01ClaimFromSelfhostSummary(summary(), {
    performanceEvidence: passingPerformanceEvidence({
      measuredTotalElapsedMs: 265000,
    }),
  });

  assert.equal(claim.gates.PERFORMANCE.status, STRESS_STATUS.UNVERIFIED);
  assert.equal(claim.status, STRESS_STATUS.BLOCKED);
});

test('explicit failing performance evidence fails the PERFORMANCE gate', () => {
  const claim = buildK01ClaimFromSelfhostSummary(summary(), {
    performanceEvidence: passingPerformanceEvidence({
      status: STRESS_STATUS.FAIL,
      measuredTotalElapsedMs: 265000,
    }),
  });

  assert.equal(claim.gates.PERFORMANCE.status, STRESS_STATUS.FAIL);
  assert.equal(claim.status, STRESS_STATUS.FAIL);
});

test('three evidence-bearing AI generation/repair trials close the last K01 gate only when performance evidence is also attached', () => {
  const claim = buildK01ClaimFromSelfhostSummary(summary(), {
    performanceEvidence: passingPerformanceEvidence(),
    aiGenerationEvidence: {
      status: STRESS_STATUS.PASS,
      successfulTrials: 3,
      requiredTrials: 3,
      evidence: ['ai-trial:1', 'ai-trial:2', 'ai-trial:3'],
    },
  });

  assert.equal(claim.gates.PERFORMANCE.status, STRESS_STATUS.PASS);
  assert.equal(claim.gates.AI_GENERATE.status, STRESS_STATUS.PASS);
  assert.equal(claim.status, STRESS_STATUS.PASS);
});
