#!/usr/bin/env node
import { runtimeCapabilityTruthSurface } from '../api/capability-truth.mjs';
import { runtimeHealthStatus } from '../api/runtime-health.mjs';

function isSha256(value) {
  return typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value);
}

function fail(message, details = {}) {
  console.error(JSON.stringify({
    ok: false,
    status: 'RCL_VERCEL_RUNTIME_HEALTH_TRUTH_FAILED',
    message,
    ...details,
  }, null, 2));
  process.exit(1);
}

try {
  const health = runtimeHealthStatus();
  const truth = runtimeCapabilityTruthSurface();
  const healthTruth = health.runtimeCapabilityTruth;

  if (health.ok !== true || health.status !== 'RCL_RUNTIME_HEALTH_VERIFIED') {
    fail('Canonical /health surface is not fail-closed verified.', { health });
  }
  if (health.nativeDeploymentHealthy !== true || health.runtimeTruthHealthy !== true) {
    fail('Canonical /health surface did not bind both native deployment and runtime capability truth.', { health });
  }
  if (!isSha256(healthTruth?.runtimeTruthRoot) || healthTruth.runtimeTruthRoot !== truth.runtimeTruthRoot) {
    fail('Canonical /health runtime truth root diverged from /capability-truth.', { healthTruth, truthRoot: truth.runtimeTruthRoot });
  }
  if (
    healthTruth?.capabilityTruthRoot !== truth.truthRoot
    || healthTruth?.directRegistryRoot !== truth.direct.registryRoot
    || healthTruth?.providerBridgeRegistryRoot !== truth.providerBridge.registryRoot
    || healthTruth?.deploymentEvidenceRegistryRoot !== truth.deploymentEvidenceRegistry.registryRoot
    || healthTruth?.deploymentEvidenceSetRoot !== truth.deploymentEvidenceRegistry.evidenceSetRoot
  ) {
    fail('Canonical /health component roots diverged from the aggregate runtime capability truth.', { healthTruth, truth });
  }
  if (
    healthTruth?.evidenceSetVerified !== true
    || healthTruth?.completeDirectDeploymentCoverage !== true
    || JSON.stringify(healthTruth?.directImplementationDomains) !== JSON.stringify(truth.deploymentEvidenceRegistry.directImplementationDomains)
    || JSON.stringify(healthTruth?.registeredDeploymentEvidenceDomains) !== JSON.stringify(truth.deploymentEvidenceRegistry.registeredDomains)
  ) {
    fail('Canonical /health lost complete direct deployment evidence coverage identity.', { healthTruth, truth });
  }
  if (
    healthTruth?.truthBoundary?.runtimeTruthRootBindsVersionedCapabilityAndDeploymentEvidenceSet !== true
    || healthTruth?.truthBoundary?.deploymentEvidenceSetRootBindsPerDomainEvidenceRoots !== true
    || healthTruth?.truthBoundary?.completeEvidenceCoverageDoesNotClaimFullDomainNativeCoverage !== true
    || health?.truthBoundary?.healthFailsClosedOnRuntimeCapabilityTruthDrift !== true
    || health?.truthBoundary?.healthBindsCanonicalRuntimeTruthRoot !== true
  ) {
    fail('Canonical /health truth boundary drifted or overclaimed runtime capability.', { health });
  }

  console.log(JSON.stringify({
    ok: true,
    status: 'RCL_VERCEL_RUNTIME_HEALTH_TRUTH_VERIFIED',
    runtimeTruthRoot: healthTruth.runtimeTruthRoot,
    capabilityTruthRoot: healthTruth.capabilityTruthRoot,
    deploymentEvidenceRegistryRoot: healthTruth.deploymentEvidenceRegistryRoot,
    deploymentEvidenceSetRoot: healthTruth.deploymentEvidenceSetRoot,
    directImplementationDomains: healthTruth.directImplementationDomains,
    registeredDeploymentEvidenceDomains: healthTruth.registeredDeploymentEvidenceDomains,
  }, null, 2));
} catch (error) {
  fail(error?.message ?? String(error), {
    code: error?.code ?? null,
    stack: error?.stack ?? null,
  });
}
