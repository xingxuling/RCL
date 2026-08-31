import test from 'node:test';
import assert from 'node:assert/strict';
import { realityRoot } from '../src/canonical.mjs';
import { assertCandidateEnvelope, verifyCandidateEnvelope } from '../src/candidate-verifier.mjs';
import { handle } from '../scripts/rcl-usce-candidate-verifier.mjs';

function fixture(overrides = {}) {
  const candidate = overrides.candidate ?? { format: 'fixture.candidate.v1', value: { x: 1 } };
  return {
    owner: 'dwac',
    expectedOwner: 'dwac',
    capabilityId: 'dwac.structural.preartifact.compile.v1',
    claimScope: 'CANDIDATE_STRUCTURE_ONLY',
    authorityDomain: 'artifact.structure',
    effectClass: 'CANDIDATE_CONTRACT',
    candidate,
    candidateRoot: realityRoot(candidate),
    evidenceRoots: ['a'.repeat(64), 'b'.repeat(64)],
    authorityAssertions: {
      authorityEscalationPerformed: false,
      canonicalPromotionPerformed: false,
      rclEvidenceCommitPerformed: false,
      worldFactPromoted: false,
      rncsRealityCommitPerformed: false,
      externalEffectPerformed: false,
    },
    ...overrides,
  };
}

test('candidate verifier accepts a root/owner/evidence bound non-authoritative envelope', () => {
  const report = verifyCandidateEnvelope(fixture());
  assert.equal(report.status, 'VERIFIED_CANDIDATE');
  assert.deepEqual(report.diagnostics, []);
  assert.equal(report.candidateRoot, fixture().candidateRoot);
  assert.equal(report.verificationBoundary.semanticTruthCertified, false);
  assert.equal(report.verificationBoundary.canonicalPromotionPerformed, false);
  assert.equal(report.verificationRoot.length, 64);
});

test('candidate verifier fails closed on candidate-root or owner drift', () => {
  const rootDrift = verifyCandidateEnvelope(fixture({ candidateRoot: 'c'.repeat(64) }));
  assert.equal(rootDrift.status, 'REJECTED');
  assert.ok(rootDrift.diagnostics.includes('RCL_CANDIDATE_ROOT_MISMATCH'));

  const ownerDrift = verifyCandidateEnvelope(fixture({ owner: 'unknown-organ' }));
  assert.equal(ownerDrift.status, 'REJECTED');
  assert.ok(ownerDrift.diagnostics.includes('RCL_CANDIDATE_OWNER_MISMATCH'));
});

test('candidate verifier rejects missing/invalid/duplicate evidence roots', () => {
  assert.ok(verifyCandidateEnvelope(fixture({ evidenceRoots: [] })).diagnostics.includes('RCL_CANDIDATE_EVIDENCE_ROOT_REQUIRED'));
  assert.ok(verifyCandidateEnvelope(fixture({ evidenceRoots: ['not-a-root'] })).diagnostics.includes('RCL_CANDIDATE_EVIDENCE_ROOT_INVALID'));
  assert.ok(verifyCandidateEnvelope(fixture({ evidenceRoots: ['a'.repeat(64), 'a'.repeat(64)] })).diagnostics.includes('RCL_CANDIDATE_EVIDENCE_ROOT_DUPLICATE'));
});

test('candidate verifier rejects authority or promotion claims without executing effects', () => {
  for (const key of [
    'authorityEscalationPerformed',
    'canonicalPromotionPerformed',
    'rclEvidenceCommitPerformed',
    'worldFactPromoted',
    'rncsRealityCommitPerformed',
    'externalEffectPerformed',
  ]) {
    const report = verifyCandidateEnvelope(fixture({ authorityAssertions: { [key]: true } }));
    assert.equal(report.status, 'REJECTED');
    assert.ok(report.diagnostics.includes(`RCL_CANDIDATE_FORBIDDEN_AUTHORITY_FLAG:${key}`));
  }
});

test('candidate verification is deterministic and assert helper rejects invalid envelopes', () => {
  const first = verifyCandidateEnvelope(fixture());
  const second = verifyCandidateEnvelope(fixture());
  assert.deepEqual(first, second);
  assert.throws(() => assertCandidateEnvelope(fixture({ candidateRoot: 'd'.repeat(64) })), /RCL_CANDIDATE_VERIFICATION_REJECTED/u);
});

test('USCE candidate-verification surface exposes only candidate.verify.v1', () => {
  const handshake = handle({ action: 'handshake' });
  assert.equal(handshake.organ_id, 'rcl');
  assert.equal(handshake.surface_id, 'candidate-verification');
  assert.deepEqual(handshake.capabilities, ['candidate.verify.v1']);
  assert.equal(handshake.rcl_evidence_commit_performed, false);

  const invoked = handle({ action: 'invoke', capability_id: 'candidate.verify.v1', payload: fixture() });
  assert.equal(invoked.status, 'VERIFIED_CANDIDATE');
  assert.throws(() => handle({ action: 'invoke', capability_id: 'evidence.commit', payload: fixture() }), /RCL_CANDIDATE_VERIFY_CAPABILITY_UNSUPPORTED/u);
});
