#!/usr/bin/env node
import { runtimeCapabilityTruthSurface } from '../api/capability-truth.mjs';
import {
  FOUNDATION_RUNTIME_DEPLOYMENT_EVIDENCE_PROVIDERS,
  foundationRuntimeDeploymentEvidenceRegistrySnapshot,
} from '../src/foundation-runtime-deployment-evidence-registry.mjs';
import {
  FOUNDATION_DIRECT_IMPLEMENTATION_DOMAINS,
} from '../src/foundation-direct-capability-registry.mjs';

function fail(message, details = {}) {
  console.error(JSON.stringify({
    ok: false,
    status: 'RCL_FOUNDATION_RUNTIME_DEPLOYMENT_EVIDENCE_REGISTRY_FAILED',
    message,
    ...details,
  }, null, 2));
  process.exit(1);
}

function isSha256(value) {
  return typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value);
}

try {
  const surface = runtimeCapabilityTruthSurface();
  const registry = surface?.deploymentEvidenceRegistry;
  const expectedSnapshot = foundationRuntimeDeploymentEvidenceRegistrySnapshot();
  const expectedRegisteredDomains = FOUNDATION_RUNTIME_DEPLOYMENT_EVIDENCE_PROVIDERS.map(item => item.domain);
  const expectedMissing = FOUNDATION_DIRECT_IMPLEMENTATION_DOMAINS.filter(
    domain => !expectedRegisteredDomains.includes(domain),
  );

  if (surface?.ok !== true || surface?.status !== 'RCL_FOUNDATION_RUNTIME_CAPABILITY_TRUTH_VERIFIED') {
    fail('Runtime capability truth surface did not verify.', { surface });
  }
  if (!isSha256(registry?.registryRoot) || registry.registryRoot !== expectedSnapshot.registryRoot) {
    fail('Runtime deployment evidence registry root drifted from the executable registry.', {
      registry,
      expectedRegistryRoot: expectedSnapshot.registryRoot,
    });
  }
  if (JSON.stringify(registry?.providers) !== JSON.stringify(expectedSnapshot.providers)) {
    fail('Runtime deployment evidence provider descriptors drifted.', {
      providers: registry?.providers ?? null,
      expectedProviders: expectedSnapshot.providers,
    });
  }
  if (JSON.stringify(registry?.registeredDomains) !== JSON.stringify(expectedRegisteredDomains)) {
    fail('Runtime deployment evidence registered-domain list drifted.', {
      registeredDomains: registry?.registeredDomains ?? null,
      expectedRegisteredDomains,
    });
  }
  if (JSON.stringify(registry?.directImplementationDomains) !== JSON.stringify(FOUNDATION_DIRECT_IMPLEMENTATION_DOMAINS)) {
    fail('Runtime deployment evidence registry lost executable direct-domain identity.', {
      directImplementationDomains: registry?.directImplementationDomains ?? null,
      expected: FOUNDATION_DIRECT_IMPLEMENTATION_DOMAINS,
    });
  }
  if (JSON.stringify(registry?.missingDirectDeploymentEvidenceDomains) !== JSON.stringify(expectedMissing)) {
    fail('Runtime deployment evidence coverage gap was hidden or drifted.', {
      missing: registry?.missingDirectDeploymentEvidenceDomains ?? null,
      expectedMissing,
    });
  }
  if (registry?.completeDirectDeploymentCoverage !== false) {
    fail('Runtime deployment evidence registry overclaimed complete direct-domain deployment coverage.', { registry });
  }
  if (
    registry?.truthBoundary?.registeredEvidenceDoesNotImplyCompleteDirectCoverage !== true
    || registry?.truthBoundary?.unregisteredDirectDomainsAreReportedNotInvented !== true
    || registry?.truthBoundary?.providerBridgeMayCoexistWithDirectDeploymentEvidence !== true
    || registry?.truthBoundary?.completeDirectDeploymentCoverageClaimed !== false
  ) {
    fail('Runtime deployment evidence registry truth boundary drifted.', {
      truthBoundary: registry?.truthBoundary ?? null,
    });
  }

  const energy = surface?.deploymentEvidence?.energy;
  if (
    energy?.ok !== true
    || energy?.verified !== true
    || energy?.domain !== 'energy'
    || !isSha256(energy?.deploymentEvidenceRoot)
  ) {
    fail('Registered Energy deployment evidence is not verified/content-addressed.', { energy });
  }
  if (Object.keys(surface?.deploymentEvidence ?? {}).some(domain => !expectedRegisteredDomains.includes(domain))) {
    fail('Runtime capability truth exposed deployment evidence outside the canonical registry.', {
      deploymentEvidenceDomains: Object.keys(surface?.deploymentEvidence ?? {}),
      expectedRegisteredDomains,
    });
  }

  console.log(JSON.stringify({
    ok: true,
    status: 'RCL_FOUNDATION_RUNTIME_DEPLOYMENT_EVIDENCE_REGISTRY_VERIFIED',
    registryRoot: registry.registryRoot,
    registeredDomains: registry.registeredDomains,
    missingDirectDeploymentEvidenceDomains: registry.missingDirectDeploymentEvidenceDomains,
    energyDeploymentEvidenceRoot: energy.deploymentEvidenceRoot,
  }, null, 2));
} catch (error) {
  fail(error?.message ?? String(error), {
    code: error?.code ?? null,
    stack: error?.stack ?? null,
  });
}
