import assert from 'node:assert/strict';
import test from 'node:test';
import {
  RCL_DOMAIN_ORGAN_FORMAT,
  createDomainOperationOrgan,
  createDomainOperationRegistry,
  promoteDifferentialToDomainOrganCandidate,
  admitNativeVerifiedDomainOrgan,
} from '../src/domain-operation-organ.mjs';

test('domain organ registry fails closed below required evidence tier', () => {
  const organ = createDomainOperationOrgan({ domain: 'core', operation: 'echo', evidenceTier: 'differential-verified' });
  assert.equal(organ.format, RCL_DOMAIN_ORGAN_FORMAT);
  const registry = createDomainOperationRegistry([organ]);
  assert.equal(registry.resolve('core', 'echo').root, organ.root);
  assert.throws(() => registry.assertInvocable('core', 'echo'), error => error.code === 'RCL_DOMAIN_ORGAN_EVIDENCE_TIER');
  assert.equal(registry.assertInvocable('core', 'echo', 'differential-verified').key, 'core.echo');
});

test('differential evidence promotes only to native-candidate', () => {
  const operation = createDomainOperationOrgan({ domain: 'quantity', operation: 'make' });
  const differential = {
    capability: 'rbc13_domain_call_reference_salvage',
    passed: true,
    promotionEligible: true,
    root: 'diff-root-1',
  };
  const { candidate, report } = promoteDifferentialToDomainOrganCandidate({ operation, differentialReport: differential });
  assert.equal(candidate.evidenceTier, 'native-candidate');
  assert.equal(candidate.canonicalAdmission, false);
  assert.equal(candidate.proof.differentialRoot, 'diff-root-1');
  assert.equal(report.nativePromotionRequired, true);
});

test('native verified admission requires a real native-promotion receipt', () => {
  const { candidate } = promoteDifferentialToDomainOrganCandidate({
    operation: { domain: 'core', operation: 'echo' },
    differentialReport: { passed: true, promotionEligible: true, root: 'diff-root', capability: 'domain.core.echo' },
  });
  assert.throws(() => admitNativeVerifiedDomainOrgan({ candidate, nativePromotionReport: { status: 'native-rejected', root: 'bad' } }), error => error.code === 'RCL_DOMAIN_ORGAN_NATIVE_PROMOTION_REQUIRED');
  const verified = admitNativeVerifiedDomainOrgan({
    candidate,
    nativePromotionReport: { status: 'native-verified', verified: true, root: 'native-root', implementationRoot: 'artifact-root' },
  });
  assert.equal(verified.evidenceTier, 'native-verified');
  assert.equal(verified.proof.nativePromotionRoot, 'native-root');
  assert.equal(verified.canonicalAdmission, false);
});
