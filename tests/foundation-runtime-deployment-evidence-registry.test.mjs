import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FOUNDATION_RUNTIME_DEPLOYMENT_EVIDENCE_PROVIDERS,
  foundationRuntimeDeploymentEvidenceRegistrySnapshot,
  foundationRuntimeDeploymentEvidenceSurface,
} from '../src/foundation-runtime-deployment-evidence-registry.mjs';
import {
  FOUNDATION_DIRECT_IMPLEMENTATION_DOMAINS,
} from '../src/foundation-direct-capability-registry.mjs';

const REGISTERED = ['perception', 'physical', 'neural', 'genetic', 'life', 'energy'];

function verified(domain) {
  return {
    ok: true,
    verified: true,
    domain,
    status: 'deployment-bound',
    deploymentEvidenceRoot: domain.charCodeAt(0).toString(16).padStart(2, '0').repeat(32),
    errors: [],
  };
}

function builders() {
  return Object.fromEntries(REGISTERED.map(domain => [domain, () => verified(domain)]));
}

test('runtime deployment evidence registry is deterministic and registers only mature evidence providers', () => {
  const left = foundationRuntimeDeploymentEvidenceRegistrySnapshot();
  const right = foundationRuntimeDeploymentEvidenceRegistrySnapshot();
  assert.deepEqual(left, right);
  assert.match(left.registryRoot, /^[0-9a-f]{64}$/);
  assert.deepEqual(left.providers, FOUNDATION_RUNTIME_DEPLOYMENT_EVIDENCE_PROVIDERS);
  assert.deepEqual(left.providers.map(item => item.domain), REGISTERED);
});

test('runtime deployment evidence surface reports Quantitative as the remaining direct evidence gap', () => {
  const report = foundationRuntimeDeploymentEvidenceSurface({ builders: builders() });
  assert.equal(report.ok, true, JSON.stringify(report, null, 2));
  assert.equal(report.completeDirectDeploymentCoverage, false);
  assert.deepEqual(report.registeredDomains, REGISTERED);
  assert.deepEqual(report.missingDirectDeploymentEvidenceDomains, ['quantitative']);
  assert.deepEqual(
    report.missingDirectDeploymentEvidenceDomains,
    FOUNDATION_DIRECT_IMPLEMENTATION_DOMAINS.filter(domain => !REGISTERED.includes(domain)),
  );
  assert.equal(report.truthBoundary.registeredEvidenceDoesNotImplyCompleteDirectCoverage, true);
  assert.equal(report.truthBoundary.unregisteredDirectDomainsAreReportedNotInvented, true);
  assert.equal(report.truthBoundary.completeDirectDeploymentCoverageClaimed, false);
});

test('runtime deployment evidence surface fails closed when a registered provider evidence breaks', () => {
  const testBuilders = builders();
  testBuilders.genetic = () => ({ ...verified('genetic'), ok: false, verified: false });
  const report = foundationRuntimeDeploymentEvidenceSurface({ builders: testBuilders });
  assert.equal(report.ok, false);
  assert.ok(report.errors.some(error => error.code === 'RCL_RUNTIME_DEPLOYMENT_EVIDENCE_PROVIDER_FAILED'));
});

test('runtime deployment evidence registry rejects non-direct evidence providers', () => {
  const report = foundationRuntimeDeploymentEvidenceSurface({
    providers: [{
      domain: 'knowledge',
      evidenceModule: 'src/fake-knowledge-evidence.mjs',
      evidenceFunction: 'fakeKnowledgeEvidence',
    }],
    builders: {
      knowledge: () => verified('knowledge'),
    },
  });
  assert.equal(report.ok, false);
  assert.ok(report.errors.some(error => error.code === 'RCL_RUNTIME_DEPLOYMENT_EVIDENCE_REGISTRY_NON_DIRECT_DOMAIN'));
});

test('complete deployment coverage can be required explicitly and then fails closed while Quantitative evidence is absent', () => {
  const report = foundationRuntimeDeploymentEvidenceSurface({
    builders: builders(),
    requireCompleteDirectCoverage: true,
  });
  assert.equal(report.ok, false);
  assert.deepEqual(report.missingDirectDeploymentEvidenceDomains, ['quantitative']);
  assert.ok(report.errors.some(error => error.code === 'RCL_RUNTIME_DEPLOYMENT_EVIDENCE_COVERAGE_INCOMPLETE'));
});
