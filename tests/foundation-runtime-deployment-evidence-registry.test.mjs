import assert from 'node:assert/strict';
import test from 'node:test';
import { FOUNDATION_RUNTIME_DEPLOYMENT_EVIDENCE_PROVIDERS, foundationRuntimeDeploymentEvidenceRegistrySnapshot, foundationRuntimeDeploymentEvidenceSurface } from '../src/foundation-runtime-deployment-evidence-registry.mjs';
import { FOUNDATION_DIRECT_IMPLEMENTATION_DOMAINS } from '../src/foundation-direct-capability-registry.mjs';
const REGISTERED = [...FOUNDATION_DIRECT_IMPLEMENTATION_DOMAINS];
function verified(domain) { return { ok: true, verified: true, domain, status: 'deployment-bound', deploymentEvidenceRoot: domain.charCodeAt(0).toString(16).padStart(2, '0').repeat(32), errors: [] }; }
function builders() { return Object.fromEntries(REGISTERED.map(domain => [domain, () => verified(domain)])); }
test('runtime deployment evidence registry deterministically covers every executable direct implementation domain', () => {
  const left = foundationRuntimeDeploymentEvidenceRegistrySnapshot(); const right = foundationRuntimeDeploymentEvidenceRegistrySnapshot();
  assert.deepEqual(left, right); assert.match(left.registryRoot, /^[0-9a-f]{64}$/); assert.deepEqual(left.providers, FOUNDATION_RUNTIME_DEPLOYMENT_EVIDENCE_PROVIDERS); assert.deepEqual(left.providers.map(item => item.domain), REGISTERED);
});
test('runtime deployment evidence surface distinguishes complete evidence coverage from full-domain capability', () => {
  const report = foundationRuntimeDeploymentEvidenceSurface({ builders: builders(), requireCompleteDirectCoverage: true });
  assert.equal(report.ok, true, JSON.stringify(report, null, 2)); assert.equal(report.completeDirectDeploymentCoverage, true); assert.deepEqual(report.missingDirectDeploymentEvidenceDomains, []); assert.deepEqual(report.registeredDomains, REGISTERED); assert.equal(report.truthBoundary.completeDirectDeploymentCoverageClaimed, true); assert.equal(report.truthBoundary.completeDirectDeploymentCoverageMeansEvidenceCoverageNotFullDomainNativeCoverage, true); assert.equal(report.truthBoundary.registeredEvidenceDoesNotImplyCompleteDomainCapability, true);
});
test('runtime deployment evidence surface fails closed when any registered provider evidence breaks', () => {
  const testBuilders = builders(); testBuilders.quantitative = () => ({ ...verified('quantitative'), ok: false, verified: false });
  const report = foundationRuntimeDeploymentEvidenceSurface({ builders: testBuilders }); assert.equal(report.ok, false); assert.ok(report.errors.some(error => error.code === 'RCL_RUNTIME_DEPLOYMENT_EVIDENCE_PROVIDER_FAILED'));
});
test('runtime deployment evidence registry rejects non-direct evidence providers', () => {
  const report = foundationRuntimeDeploymentEvidenceSurface({ providers: [{ domain: 'knowledge', evidenceModule: 'src/fake.mjs', evidenceFunction: 'fake' }], builders: { knowledge: () => verified('knowledge') } }); assert.equal(report.ok, false); assert.ok(report.errors.some(error => error.code === 'RCL_RUNTIME_DEPLOYMENT_EVIDENCE_REGISTRY_NON_DIRECT_DOMAIN'));
});
