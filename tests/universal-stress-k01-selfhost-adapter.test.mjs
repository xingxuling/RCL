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

test('K01 correctly distinguishes compiler self-hosting from whole-runtime full self-hosting', () => {
  const claim = buildK01ClaimFromSelfhostSummary(summary());

  assert.equal(claim.gates.EXPRESS.status, STRESS_STATUS.PASS);
  assert.equal(claim.gates.COMPILE.status, STRESS_STATUS.PASS);
  assert.equal(claim.gates.LOWER.status, STRESS_STATUS.PASS);
  assert.equal(claim.gates.EXECUTE.status, STRESS_STATUS.PASS);
  assert.equal(claim.gates.CORRECT.status, STRESS_STATUS.PASS);
  assert.equal(claim.gates.ROBUST.status, STRESS_STATUS.PASS);
  assert.equal(claim.gates.PERFORMANCE.status, STRESS_STATUS.PASS);
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

test('fixed-point failure is a compile/correctness/robustness/performance failure', () => {
  const claim = buildK01ClaimFromSelfhostSummary(summary({
    generalCompilerFixedPoint: { ok: false },
  }));
  assert.equal(claim.gates.COMPILE.status, STRESS_STATUS.FAIL);
  assert.equal(claim.gates.CORRECT.status, STRESS_STATUS.FAIL);
  assert.equal(claim.gates.ROBUST.status, STRESS_STATUS.FAIL);
  assert.equal(claim.gates.PERFORMANCE.status, STRESS_STATUS.FAIL);
});

test('missing native execution subset fails EXECUTE', () => {
  const claim = buildK01ClaimFromSelfhostSummary(summary({
    boundary: { rclOwnedTargetNativeExecutionSubset: false },
  }));
  assert.equal(claim.gates.EXECUTE.status, STRESS_STATUS.FAIL);
});

test('three evidence-bearing AI generation/repair trials close the last K01 gate', () => {
  const claim = buildK01ClaimFromSelfhostSummary(summary(), {
    aiGenerationEvidence: {
      status: STRESS_STATUS.PASS,
      successfulTrials: 3,
      requiredTrials: 3,
      evidence: ['ai-trial:1', 'ai-trial:2', 'ai-trial:3'],
    },
  });

  assert.equal(claim.gates.AI_GENERATE.status, STRESS_STATUS.PASS);
  assert.equal(claim.status, STRESS_STATUS.PASS);
});
