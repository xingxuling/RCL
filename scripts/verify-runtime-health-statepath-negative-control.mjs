#!/usr/bin/env node
import { runtimeHealthStatusWithStatePath } from '../api/runtime-health.mjs';

function fail(message, details = {}) {
  console.error(JSON.stringify({
    ok: false,
    status: 'RCL_RUNTIME_HEALTH_STATEPATH_NEGATIVE_CONTROL_FAILED',
    message,
    ...details,
  }, null, 2));
  process.exit(1);
}

try {
  const baseline = runtimeHealthStatusWithStatePath();
  if (baseline.ok !== true || baseline.providerBridgeStatePathHealthy !== true) {
    fail('Baseline runtime health must be verified before statePath negative controls run', { baseline });
  }

  const wrongRegistry = structuredClone(baseline.providerBridgeStatePathTruth);
  wrongRegistry.providerBridgeRegistryRoot = '0'.repeat(64);
  const registryDrift = runtimeHealthStatusWithStatePath({ bridgeStatePathSurface: wrongRegistry });
  if (registryDrift.ok !== false || registryDrift.providerBridgeStatePathHealthy !== false) {
    fail('Runtime health did not fail closed on Provider bridge statePath registry-root drift', { registryDrift });
  }

  const overclaim = structuredClone(baseline.providerBridgeStatePathTruth);
  overclaim.truthBoundary.statePathSemanticAttestationDoesNotImplyDirectNativeExecution = false;
  const overclaimDrift = runtimeHealthStatusWithStatePath({ bridgeStatePathSurface: overclaim });
  if (overclaimDrift.ok !== false || overclaimDrift.providerBridgeStatePathHealthy !== false) {
    fail('Runtime health did not fail closed when the statePath truth boundary overclaimed direct-native semantics', { overclaimDrift });
  }

  const missingRoot = structuredClone(baseline.providerBridgeStatePathTruth);
  missingRoot.attestationRoot = null;
  const missingRootDrift = runtimeHealthStatusWithStatePath({ bridgeStatePathSurface: missingRoot });
  if (missingRootDrift.ok !== false || missingRootDrift.providerBridgeStatePathHealthy !== false) {
    fail('Runtime health did not fail closed when the statePath attestation root was missing', { missingRootDrift });
  }

  console.log(JSON.stringify({
    ok: true,
    status: 'RCL_RUNTIME_HEALTH_STATEPATH_NEGATIVE_CONTROL_VERIFIED',
    baselineAttestationRoot: baseline.providerBridgeStatePathTruth.attestationRoot,
    registryRootDriftRejected: true,
    truthBoundaryOverclaimRejected: true,
    missingAttestationRootRejected: true,
  }, null, 2));
} catch (error) {
  fail(error?.message ?? String(error), {
    code: error?.code ?? null,
    stack: error?.stack ?? null,
  });
}
