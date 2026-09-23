import assert from 'node:assert/strict';
import test from 'node:test';
import { foundationRuntimeCapabilityTruthAttestation } from '../api/capability-truth.mjs';
import { replayFoundationRuntimeCapabilityTruthFromSurface } from '../src/foundation-runtime-truth-replay.mjs';

const CROSS_DOMAIN = {
  ok: true,
  present: true,
  verified: true,
  deploymentEvidenceRoot: '6'.repeat(64),
  referenceHistoryRoot: '7'.repeat(64),
  nativeHistoryRoot: '7'.repeat(64),
  domains: ['physical', 'perception', 'neural'],
};

const KNOWLEDGE = {
  present: true,
  ok: true,
  verified: true,
  runtimeEvidenceRoot: '8'.repeat(64),
  attestationRoot: '9'.repeat(64),
  knowledgeReceiptRoot: 'a'.repeat(64),
  executionBinarySha256: 'b'.repeat(64),
  loweredLearnCount: 2,
  loweredClaimCount: 3,
  maxBoundaryPresent: true,
  maxBoundaryVerified: true,
  maxBoundaryAttestationRoot: 'c'.repeat(64),
  maxBoundaryKnowledgeReceiptRoot: 'd'.repeat(64),
  maxBoundaryExecutionBinarySha256: 'e'.repeat(64),
  maxBoundaryLoweredLearnCount: 2,
  maxBoundaryLoweredClaimCount: 8,
  maxBoundaryClaimPaths: [
    'mind.trusted', 'mind.score', 'mind.label', 'mind.rank',
    'context.ready', 'context.weight', 'context.zone', 'context.level',
  ],
  maxBoundaryFormedAtRoots: Array.from({ length: 8 }, (_, index) => ({
    path: `claim.${index}`,
    root: index.toString(16).repeat(64),
  })),
  truthBoundary: {
    maxBoundaryRuntimeTruthBound: true,
  },
};

const SURFACE = {
  truthRoot: '1'.repeat(64),
  direct: { registryRoot: '2'.repeat(64) },
  providerBridge: { registryRoot: '3'.repeat(64) },
  deploymentEvidenceRegistry: {
    registryRoot: '4'.repeat(64),
    evidenceSetRoot: '5'.repeat(64),
    directImplementationDomains: ['physical', 'perception', 'neural'],
    registeredDomains: ['physical', 'perception', 'neural'],
    completeDirectDeploymentCoverage: true,
  },
  crossDomainHistoryEvidence: CROSS_DOMAIN,
  knowledgeMultiLearnEvidence: KNOWLEDGE,
};

function direct(surface = SURFACE, overrides = {}) {
  return foundationRuntimeCapabilityTruthAttestation({
    capability: surface,
    deployment: surface.deploymentEvidenceRegistry,
    crossDomainHistory: surface.crossDomainHistoryEvidence,
    knowledgeMultiLearn: surface.knowledgeMultiLearnEvidence,
    ...overrides,
  });
}

test('runtime truth replay from surface preserves every currently bound evidence slot', () => {
  const expected = direct();
  const replayed = replayFoundationRuntimeCapabilityTruthFromSurface(SURFACE);
  assert.deepEqual(replayed, expected);
  assert.match(replayed.runtimeTruthRoot, /^[0-9a-f]{64}$/);
  assert.equal(replayed.crossDomainHistoryBound, true);
  assert.equal(replayed.knowledgeMultiLearnRuntimeBound, true);
  assert.equal(replayed.knowledgeMultiLearnMaxBoundaryRuntimeBound, true);
});

test('runtime truth replay fails closed by root divergence when Knowledge evidence is omitted', () => {
  const canonical = replayFoundationRuntimeCapabilityTruthFromSurface(SURFACE);
  const omitted = direct(SURFACE, { knowledgeMultiLearn: null });
  assert.notEqual(omitted.runtimeTruthRoot, canonical.runtimeTruthRoot);
  assert.equal(omitted.knowledgeMultiLearnRuntimeBound, false);
  assert.equal(omitted.knowledgeMultiLearnMaxBoundaryRuntimeBound, false);
});

test('runtime truth replay changes when max-boundary Knowledge evidence identity drifts', () => {
  const canonical = replayFoundationRuntimeCapabilityTruthFromSurface(SURFACE);
  const driftedKnowledge = {
    ...KNOWLEDGE,
    maxBoundaryAttestationRoot: 'f'.repeat(64),
  };
  const drifted = direct(SURFACE, { knowledgeMultiLearn: driftedKnowledge });
  assert.notEqual(drifted.runtimeTruthRoot, canonical.runtimeTruthRoot);
});

test('runtime truth replay changes when cross-domain history evidence is omitted', () => {
  const canonical = replayFoundationRuntimeCapabilityTruthFromSurface(SURFACE);
  const omitted = direct(SURFACE, { crossDomainHistory: null });
  assert.notEqual(omitted.runtimeTruthRoot, canonical.runtimeTruthRoot);
  assert.equal(omitted.crossDomainHistoryBound, false);
});
