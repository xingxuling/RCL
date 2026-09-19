import assert from 'node:assert/strict';
import test from 'node:test';
import { runtimeHealthStatus } from '../api/runtime-health.mjs';

const ROOT = 'a'.repeat(64);
const DIRECT = ['perception', 'physical', 'neural', 'genetic', 'life', 'quantitative', 'energy'];

function nativeHealthy() {
  return {
    bundled: true,
    executable: true,
    attestationBundled: true,
    replayEvidenceBound: true,
    evidenceBound: true,
    extendedEvidenceBound: true,
  };
}

function runtimeHealthy() {
  return {
    ok: true,
    status: 'RCL_FOUNDATION_RUNTIME_CAPABILITY_TRUTH_VERIFIED',
    truthRoot: '1'.repeat(64),
    runtimeTruthRoot: ROOT,
    runtimeTruth: { runtimeTruthRoot: ROOT },
    direct: { registryRoot: '2'.repeat(64) },
    providerBridge: { registryRoot: '3'.repeat(64) },
    deploymentEvidenceRegistry: {
      registryRoot: '4'.repeat(64),
      evidenceSetRoot: '5'.repeat(64),
      evidenceSetVerified: true,
      completeDirectDeploymentCoverage: true,
      missingDirectDeploymentEvidenceDomains: [],
      directImplementationDomains: DIRECT,
      registeredDomains: DIRECT,
    },
    truthBoundary: {
      runtimeTruthRootBindsVersionedCapabilityAndDeploymentEvidenceSet: true,
      deploymentEvidenceSetRootBindsPerDomainEvidenceRoots: true,
      completeDirectDeploymentEvidenceCoverageMeansEvidenceCoverageNotFullDomainNativeCoverage: true,
    },
  };
}

test('canonical runtime health verifies only when native deployment and aggregate runtime truth both verify', () => {
  const health = runtimeHealthStatus({ nativeStatus: nativeHealthy(), runtimeSurface: runtimeHealthy() });
  assert.equal(health.ok, true);
  assert.equal(health.status, 'RCL_RUNTIME_HEALTH_VERIFIED');
  assert.equal(health.runtimeCapabilityTruth.runtimeTruthRoot, ROOT);
  assert.deepEqual(health.runtimeCapabilityTruth.directImplementationDomains, DIRECT);
  assert.deepEqual(health.runtimeCapabilityTruth.registeredDeploymentEvidenceDomains, DIRECT);
  assert.equal(health.truthBoundary.healthFailsClosedOnRuntimeCapabilityTruthDrift, true);
});

test('canonical runtime health fails closed when aggregate runtime truth drifts', () => {
  const drifted = runtimeHealthy();
  drifted.ok = false;
  drifted.status = 'RCL_FOUNDATION_RUNTIME_CAPABILITY_TRUTH_DRIFT';
  const health = runtimeHealthStatus({ nativeStatus: nativeHealthy(), runtimeSurface: drifted });
  assert.equal(health.ok, false);
  assert.equal(health.runtimeTruthHealthy, false);
});

test('canonical runtime health fails closed when runtime truth root is malformed or does not match the attestation', () => {
  const malformed = runtimeHealthy();
  malformed.runtimeTruthRoot = 'not-a-root';
  let health = runtimeHealthStatus({ nativeStatus: nativeHealthy(), runtimeSurface: malformed });
  assert.equal(health.ok, false);
  const mismatch = runtimeHealthy();
  mismatch.runtimeTruth.runtimeTruthRoot = 'b'.repeat(64);
  health = runtimeHealthStatus({ nativeStatus: nativeHealthy(), runtimeSurface: mismatch });
  assert.equal(health.ok, false);
});

test('canonical runtime health fails closed when deployment evidence coverage is incomplete', () => {
  const partial = runtimeHealthy();
  partial.deploymentEvidenceRegistry.completeDirectDeploymentCoverage = false;
  partial.deploymentEvidenceRegistry.missingDirectDeploymentEvidenceDomains = ['energy'];
  partial.deploymentEvidenceRegistry.registeredDomains = DIRECT.filter(domain => domain !== 'energy');
  const health = runtimeHealthStatus({ nativeStatus: nativeHealthy(), runtimeSurface: partial });
  assert.equal(health.ok, false);
  assert.equal(health.runtimeTruthHealthy, false);
});

test('canonical runtime health fails closed when deployed native evidence is not healthy', () => {
  const native = nativeHealthy();
  native.extendedEvidenceBound = false;
  const health = runtimeHealthStatus({ nativeStatus: native, runtimeSurface: runtimeHealthy() });
  assert.equal(health.ok, false);
  assert.equal(health.nativeDeploymentHealthy, false);
});
