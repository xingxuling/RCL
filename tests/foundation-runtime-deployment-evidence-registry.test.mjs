import assert from 'node:assert/strict';
import test from 'node:test';
import { FOUNDATION_RUNTIME_DEPLOYMENT_EVIDENCE_PROVIDERS, foundationRuntimeDeploymentEvidenceRegistrySnapshot, foundationRuntimeDeploymentEvidenceSetSnapshot, foundationRuntimeDeploymentEvidenceSurface } from '../src/foundation-runtime-deployment-evidence-registry.mjs';
import { FOUNDATION_DIRECT_IMPLEMENTATION_DOMAINS } from '../src/foundation-direct-capability-registry.mjs';
const REGISTERED = [...FOUNDATION_DIRECT_IMPLEMENTATION_DOMAINS];
function verified(domain, root = null) { return { ok: true, verified: true, domain, status: 'deployment-bound', deploymentEvidenceRoot: root ?? domain.charCodeAt(0).toString(16).padStart(2, '0').repeat(32), errors: [] }; }
function builders() { return Object.fromEntries(REGISTERED.map(domain => [domain, () => verified(domain)])); }
test('runtime deployment evidence registry deterministically covers every executable direct implementation domain', () => {
  const left = foundationRuntimeDeploymentEvidenceRegistrySnapshot(); const right = foundationRuntimeDeploymentEvidenceRegistrySnapshot();
  assert.deepEqual(left, right); assert.match(left.registryRoot, /^[0-9a-f]{64}$/); assert.deepEqual(left.providers, FOUNDATION_RUNTIME_DEPLOYMENT_EVIDENCE_PROVIDERS); assert.deepEqual(left.providers.map(item => item.domain), REGISTERED);
});
test('runtime deployment evidence surface distinguishes complete evidence coverage from full-domain capability', () => {
  const report = foundationRuntimeDeploymentEvidenceSurface({ builders: builders(), requireCompleteDirectCoverage: true });
  assert.equal(report.ok, true, JSON.stringify(report, null, 2)); assert.equal(report.completeDirectDeploymentCoverage, true); assert.deepEqual(report.missingDirectDeploymentEvidenceDomains, []); assert.deepEqual(report.registeredDomains, REGISTERED); assert.match(report.evidenceSetRoot, /^[0-9a-f]{64}$/); assert.equal(report.evidenceSetVerified, true); assert.deepEqual(Object.keys(report.deploymentEvidenceRoots), REGISTERED); assert.equal(report.truthBoundary.completeDirectDeploymentCoverageClaimed, true); assert.equal(report.truthBoundary.completeDirectDeploymentCoverageMeansEvidenceCoverageNotFullDomainNativeCoverage, true); assert.equal(report.truthBoundary.registeredEvidenceDoesNotImplyCompleteDomainCapability, true); assert.equal(report.truthBoundary.evidenceSetRootBindsRegistryAndPerDomainDeploymentRoots, true);
});
test('runtime deployment evidence set root deterministically binds the registry and every per-domain evidence root', () => {
  const testBuilders = builders();
  const first = foundationRuntimeDeploymentEvidenceSurface({ builders: testBuilders, requireCompleteDirectCoverage: true });
  const second = foundationRuntimeDeploymentEvidenceSurface({ builders: testBuilders, requireCompleteDirectCoverage: true });
  assert.equal(first.evidenceSetRoot, second.evidenceSetRoot);
  const replay = foundationRuntimeDeploymentEvidenceSetSnapshot({ registryRoot: first.registryRoot, directImplementationDomains: first.directImplementationDomains, evidenceByDomain: first.evidenceByDomain });
  assert.equal(replay.evidenceSetRoot, first.evidenceSetRoot);
  const mutatedBuilders = builders();
  mutatedBuilders.energy = () => verified('energy', 'f'.repeat(64));
  const mutated = foundationRuntimeDeploymentEvidenceSurface({ builders: mutatedBuilders, requireCompleteDirectCoverage: true });
  assert.equal(mutated.registryRoot, first.registryRoot);
  assert.notEqual(mutated.deploymentEvidenceRoots.energy, first.deploymentEvidenceRoots.energy);
  assert.notEqual(mutated.evidenceSetRoot, first.evidenceSetRoot);
});
test('runtime deployment evidence surface fails closed when any registered provider evidence breaks', () => {
  const testBuilders = builders(); testBuilders.quantitative = () => ({ ...verified('quantitative'), ok: false, verified: false });
  const report = foundationRuntimeDeploymentEvidenceSurface({ builders: testBuilders }); assert.equal(report.ok, false); assert.equal(report.evidenceSetVerified, false); assert.ok(report.errors.some(error => error.code === 'RCL_RUNTIME_DEPLOYMENT_EVIDENCE_PROVIDER_FAILED'));
});
test('runtime deployment evidence registry rejects non-direct evidence providers', () => {
  const domain = 'natural-language-reality';
  assert.equal(FOUNDATION_DIRECT_IMPLEMENTATION_DOMAINS.includes(domain), false);
  const report = foundationRuntimeDeploymentEvidenceSurface({ providers: [{ domain, evidenceModule: 'src/fake.mjs', evidenceFunction: 'fake' }], builders: { [domain]: () => verified(domain) } });
  assert.equal(report.ok, false);
  assert.ok(report.errors.some(error => error.code === 'RCL_RUNTIME_DEPLOYMENT_EVIDENCE_REGISTRY_NON_DIRECT_DOMAIN'));
});
