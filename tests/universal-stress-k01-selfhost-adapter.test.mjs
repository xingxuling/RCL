import test from 'node:test';
import assert from 'node:assert/strict';

import { STRESS_STATUS } from '../src/universal-program-stress.mjs';
import { buildK01ClaimFromSelfhostSummary } from '../src/universal-stress-k01-selfhost-adapter.mjs';

function summary(overrides = {}) {
  return {
    format: 'rcl.selfhost.summary.v1',
    stages: [{ id: 'stage0', ok: true }, { id: 'stage40', ok: true }],
    boundary: {
      fullSelfHosting: false,
      rclOwnedRuleBytecodeLoweringComplete: false,
      rclOwnedRuntimeComplete: false,
      ...overrides.boundary,
    },
    generalCompilerFixedPoint: { ok: true, ...overrides.generalCompilerFixedPoint },
    ...overrides,
  };
}

test('K01 refuses to reinterpret native-core selfhosting as full selfhosting', () => {
  const claim = buildK01ClaimFromSelfhostSummary(summary());
  assert.equal(claim.gates.EXPRESS.status, STRESS_STATUS.FAIL);
  assert.equal(claim.gates.LOWER.status, STRESS_STATUS.FAIL);
  assert.equal(claim.gates.EXECUTE.status, STRESS_STATUS.FAIL);
  assert.equal(claim.status, STRESS_STATUS.FAIL);
});

test('even a complete selfhost core remains blocked until robustness, performance and AI-generation evidence exists', () => {
  const claim = buildK01ClaimFromSelfhostSummary(summary({
    boundary: {
      fullSelfHosting: true,
      rclOwnedRuleBytecodeLoweringComplete: true,
      rclOwnedRuntimeComplete: true,
    },
  }));

  assert.equal(claim.gates.EXPRESS.status, STRESS_STATUS.PASS);
  assert.equal(claim.gates.COMPILE.status, STRESS_STATUS.PASS);
  assert.equal(claim.gates.LOWER.status, STRESS_STATUS.PASS);
  assert.equal(claim.gates.EXECUTE.status, STRESS_STATUS.PASS);
  assert.equal(claim.gates.CORRECT.status, STRESS_STATUS.PASS);
  assert.equal(claim.gates.ROBUST.status, STRESS_STATUS.UNVERIFIED);
  assert.equal(claim.gates.PERFORMANCE.status, STRESS_STATUS.UNVERIFIED);
  assert.equal(claim.gates.AI_GENERATE.status, STRESS_STATUS.UNVERIFIED);
  assert.equal(claim.status, STRESS_STATUS.BLOCKED);
});

test('fixed-point failure is a compile/correctness failure', () => {
  const claim = buildK01ClaimFromSelfhostSummary(summary({ generalCompilerFixedPoint: { ok: false } }));
  assert.equal(claim.gates.COMPILE.status, STRESS_STATUS.FAIL);
  assert.equal(claim.gates.CORRECT.status, STRESS_STATUS.FAIL);
});
