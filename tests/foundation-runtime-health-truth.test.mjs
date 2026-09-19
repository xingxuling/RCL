import assert from 'node:assert/strict';
import test from 'node:test';
import { runtimeHealthStatus } from '../api/runtime-health.mjs';

const ROOT = 'a'.repeat(64);
const DIRECT = ['perception', 'physical', 'neural', 'genetic', 'life', 'quantitative', 'energy'];
const BRIDGE_ROOT = '3'.repeat(64);
const BRIDGE_SPECS = [{
  batchId: 'batch-a',
  providerId: 'rcl.foundation.batch-a',
  providerCallCount: 1,
  domain: 'knowledge',
  capability: 'knowledge.resolve',
  statePath: 'world.knowledge',
}];
const BRIDGE_REGISTRY = { registryRoot: BRIDGE_ROOT };

function nativeHealthy() {
  return {
    bundled: true,
    executable: true,
    attestationBundled: true,
    replayEvidenceBound: true,
    evidenceBound: true,
    extendedEvidenceBound: true,
    foundationNativeBridgeDomains: ['knowledge'],
    foundationNativeBridgeProofs: {
      knowledge: {
        batchId: 'batch-a',
        domain: 'knowledge',
        capability: 'knowledge.resolve',
        providerId: 'rcl.foundation.batch-a',
        providerCallCount: 1,
        mode: 'native-provider-bridge',
        status: 'native-bridge-verified',
        verified: true,
      },
    },
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
    providerBridge: { registryRoot: BRIDGE_ROOT, domains: ['knowledge'] },
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

function healthStatus({ nativeStatus = nativeHealthy(), runtimeSurface = runtimeHealthy(), bridgeSpecs = BRIDGE_SPECS, bridgeRegistrySnapshot = BRIDGE_REGISTRY } = {}) {
  return runtimeHealthStatus({ nativeStatus, runtimeSurface, bridgeSpecs, bridgeRegistrySnapshot });
}

test('canonical runtime health verifies only when native deployment, aggregate runtime truth, and bridge topology all verify', () => {
  const health = healthStatus();
  assert.equal(health.ok, true);
  assert.equal(health.status, 'RCL_RUNTIME_HEALTH_VERIFIED');
  assert.equal(health.runtimeCapabilityTruth.runtimeTruthRoot, ROOT);
  assert.deepEqual(health.runtimeCapabilityTruth.directImplementationDomains, DIRECT);
  assert.deepEqual(health.runtimeCapabilityTruth.registeredDeploymentEvidenceDomains, DIRECT);
  assert.equal(health.providerBridgeTopologyHealthy, true);
  assert.deepEqual(health.providerBridgeTopology.domains, ['knowledge']);
  assert.equal(health.truthBoundary.healthFailsClosedOnRuntimeCapabilityTruthDrift, true);
  assert.equal(health.truthBoundary.healthFailsClosedOnProviderBridgeTopologyDrift, true);
});

test('canonical runtime health fails closed when aggregate runtime truth drifts', () => {
  const drifted = runtimeHealthy();
  drifted.ok = false;
  drifted.status = 'RCL_FOUNDATION_RUNTIME_CAPABILITY_TRUTH_DRIFT';
  const health = healthStatus({ runtimeSurface: drifted });
  assert.equal(health.ok, false);
  assert.equal(health.runtimeTruthHealthy, false);
});

test('canonical runtime health fails closed when runtime truth root is malformed or does not match the attestation', () => {
  const malformed = runtimeHealthy();
  malformed.runtimeTruthRoot = 'not-a-root';
  let health = healthStatus({ runtimeSurface: malformed });
  assert.equal(health.ok, false);
  const mismatch = runtimeHealthy();
  mismatch.runtimeTruth.runtimeTruthRoot = 'b'.repeat(64);
  health = healthStatus({ runtimeSurface: mismatch });
  assert.equal(health.ok, false);
});

test('canonical runtime health fails closed when deployment evidence coverage is incomplete', () => {
  const partial = runtimeHealthy();
  partial.deploymentEvidenceRegistry.completeDirectDeploymentCoverage = false;
  partial.deploymentEvidenceRegistry.missingDirectDeploymentEvidenceDomains = ['energy'];
  partial.deploymentEvidenceRegistry.registeredDomains = DIRECT.filter(domain => domain !== 'energy');
  const health = healthStatus({ runtimeSurface: partial });
  assert.equal(health.ok, false);
  assert.equal(health.runtimeTruthHealthy, false);
});

test('canonical runtime health fails closed when deployed native evidence is not healthy', () => {
  const native = nativeHealthy();
  native.extendedEvidenceBound = false;
  const health = healthStatus({ nativeStatus: native });
  assert.equal(health.ok, false);
  assert.equal(health.nativeDeploymentHealthy, false);
});

test('canonical runtime health fails closed when native bridge domain topology shadows a stale domain set', () => {
  const native = nativeHealthy();
  native.foundationNativeBridgeDomains = [];
  const health = healthStatus({ nativeStatus: native });
  assert.equal(health.ok, false);
  assert.equal(health.providerBridgeTopologyHealthy, false);
});

test('canonical runtime health fails closed when a native bridge proof diverges from canonical capability topology', () => {
  const native = nativeHealthy();
  native.foundationNativeBridgeProofs.knowledge.capability = 'knowledge.stale';
  const health = healthStatus({ nativeStatus: native });
  assert.equal(health.ok, false);
  assert.equal(health.providerBridgeTopologyHealthy, false);
});

test('canonical runtime health fails closed when runtime bridge registry root diverges from executable canonical registry', () => {
  const truth = runtimeHealthy();
  truth.providerBridge.registryRoot = '9'.repeat(64);
  const health = healthStatus({ runtimeSurface: truth });
  assert.equal(health.ok, false);
  assert.equal(health.providerBridgeTopologyHealthy, false);
});
