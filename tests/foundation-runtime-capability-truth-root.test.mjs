import assert from 'node:assert/strict';
import test from 'node:test';
import { foundationRuntimeCapabilityTruthAttestation } from '../api/capability-truth.mjs';

const CAPABILITY = {
  truthRoot: '1'.repeat(64),
  direct: { registryRoot: '2'.repeat(64) },
  providerBridge: { registryRoot: '3'.repeat(64) },
};
const DEPLOYMENT = {
  registryRoot: '4'.repeat(64),
  evidenceSetRoot: '5'.repeat(64),
  directImplementationDomains: ['perception', 'physical'],
  registeredDomains: ['perception', 'physical'],
  completeDirectDeploymentCoverage: true,
};

test('runtime capability truth root is deterministic for the same capability and deployment evidence set', () => {
  const left = foundationRuntimeCapabilityTruthAttestation({ capability: CAPABILITY, deployment: DEPLOYMENT });
  const right = foundationRuntimeCapabilityTruthAttestation({ capability: CAPABILITY, deployment: DEPLOYMENT });
  assert.deepEqual(left, right);
  assert.match(left.runtimeTruthRoot, /^[0-9a-f]{64}$/);
});

test('runtime capability truth root changes when either canonical capability truth or deployment evidence set changes', () => {
  const baseline = foundationRuntimeCapabilityTruthAttestation({ capability: CAPABILITY, deployment: DEPLOYMENT });
  const capabilityMutation = foundationRuntimeCapabilityTruthAttestation({ capability: { ...CAPABILITY, truthRoot: '6'.repeat(64) }, deployment: DEPLOYMENT });
  const evidenceMutation = foundationRuntimeCapabilityTruthAttestation({ capability: CAPABILITY, deployment: { ...DEPLOYMENT, evidenceSetRoot: '7'.repeat(64) } });
  assert.notEqual(capabilityMutation.runtimeTruthRoot, baseline.runtimeTruthRoot);
  assert.notEqual(evidenceMutation.runtimeTruthRoot, baseline.runtimeTruthRoot);
});

test('runtime capability truth root preserves evidence coverage boundary without claiming full domain native coverage', () => {
  const attestation = foundationRuntimeCapabilityTruthAttestation({ capability: CAPABILITY, deployment: DEPLOYMENT });
  assert.equal(attestation.completeDirectDeploymentCoverage, true);
  assert.deepEqual(attestation.directImplementationDomains, DEPLOYMENT.directImplementationDomains);
  assert.deepEqual(attestation.registeredDeploymentEvidenceDomains, DEPLOYMENT.registeredDomains);
});
