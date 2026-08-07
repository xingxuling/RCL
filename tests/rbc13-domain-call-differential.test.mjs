import assert from 'node:assert/strict';
import test from 'node:test';
import {
  RBC13_DOMAIN_CALL_DIFFERENTIAL_CASES,
  runRbc13DomainCallDifferential,
} from '../src/rbc13-domain-call-differential.mjs';

test('RBC 1.3 domain-call salvage reaches source-level differential parity without native promotion', async () => {
  const result = await runRbc13DomainCallDifferential({ repeats: 2 });

  assert.equal(RBC13_DOMAIN_CALL_DIFFERENTIAL_CASES.length, 6);
  assert.equal(result.status, 'PASS');
  assert.equal(result.migrationParityPassed, true);
  assert.equal(result.caseCount, 6);
  assert.equal(result.passedCaseCount, 6);
  assert.equal(result.controlsPassed, true);
  assert.equal(result.coverage.successObserved, true);
  assert.equal(result.coverage.errorObserved, true);
  assert.equal(result.nativePromotionAllowed, false);
  assert.equal(result.genericPromotionEligible, false);
  assert.equal(result.evidenceScore, 0.636364);
  assert.match(result.differentialRoot, /^[a-f0-9]{64}$/);

  assert.equal(result.report.independence.satisfied, true);
  assert.equal(result.report.independence.proofLevel, 'declared-separate-adapters');
  assert.equal(result.report.negativeControls.length, 1);
  assert.equal(result.report.negativeControls[0].detected, true);
});
