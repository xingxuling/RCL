import assert from 'node:assert/strict';
import test from 'node:test';
import {
  RBC13_ADMITTED_DOMAIN_OPERATION_KEYS,
  runAllRbc13DomainOperationDifferentials,
} from '../src/rbc13-domain-operation-differential.mjs';
import { buildAllRbc13DomainOrganCandidatePlans } from '../src/rbc13-domain-organ-candidate-plan.mjs';

test('each admitted DOMAIN_CALL operation clears an independent differential gate', async () => {
  const reports = await runAllRbc13DomainOperationDifferentials({ repeats: 2, timeoutMs: 2_000 });
  assert.equal(reports.length, RBC13_ADMITTED_DOMAIN_OPERATION_KEYS.length);
  for (const report of reports) {
    assert.equal(report.passed, true, report.operationKey);
    assert.equal(report.controlsPassed, true, report.operationKey);
    assert.equal(report.promotionEligible, true, `${report.operationKey} score=${report.evidenceScore}`);
    assert.ok(report.evidenceScore >= 0.8, report.operationKey);
    assert.match(report.differentialRoot, /^[a-f0-9]{64}$/);
    assert.equal(report.nativeVerificationClaimed, false);
  }
});

test('operation differential plans bind semantic evidence only to native-candidate organs', async () => {
  const plans = await buildAllRbc13DomainOrganCandidatePlans({ repeats: 2, timeoutMs: 2_000 });
  assert.equal(plans.length, 4);
  for (const plan of plans) {
    assert.equal(plan.differential.passed, true);
    assert.equal(plan.candidate.evidenceTier, 'native-candidate');
    assert.equal(plan.candidate.proof.differentialRoot, plan.differential.differentialRoot);
    assert.equal(plan.candidate.canonicalAdmission, false);
    assert.equal(plan.nativePromotionPending, true);
    assert.equal(plan.artifactBindingPending, true);
  }
});
