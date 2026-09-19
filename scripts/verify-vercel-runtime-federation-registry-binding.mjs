#!/usr/bin/env node
import { nativeVmDeploymentStatus } from '../api/health.mjs';
import {
  FOUNDATION_NATIVE_BRIDGE_SPECS,
  foundationNativeBridgeCapabilityRegistrySnapshot,
} from '../src/foundation-native-bridge-capability-registry.mjs';

function fail(message, details = {}) {
  console.error(JSON.stringify({
    ok: false,
    status: 'RCL_VERCEL_RUNTIME_FEDERATION_REGISTRY_BINDING_FAILED',
    message,
    ...details,
  }, null, 2));
  process.exit(1);
}

try {
  const status = nativeVmDeploymentStatus();
  const registry = foundationNativeBridgeCapabilityRegistrySnapshot();
  const federation = status.foundationNativeBridgeFederation;
  if (
    status.foundationNativeBridgeFederationBound !== true
    || status.foundationNativeBridgeBound !== true
    || status.extendedEvidenceBound !== true
  ) {
    fail('Runtime deployment health did not fail-closed bind the Native Provider federation.', { status });
  }
  if (
    federation?.providerBridgeRegistryRoot !== registry.registryRoot
    || federation?.providerBridgeSpecCount !== FOUNDATION_NATIVE_BRIDGE_SPECS.length
    || status.foundationNativeBridgeRegistryRoot !== registry.registryRoot
    || status.foundationNativeBridgeSpecCount !== FOUNDATION_NATIVE_BRIDGE_SPECS.length
  ) {
    fail('Runtime federation attestation identity diverged from the executable canonical Provider bridge registry.', {
      federation,
      runtimeRegistryRoot: status.foundationNativeBridgeRegistryRoot,
      runtimeSpecCount: status.foundationNativeBridgeSpecCount,
      canonicalRegistryRoot: registry.registryRoot,
      canonicalSpecCount: FOUNDATION_NATIVE_BRIDGE_SPECS.length,
    });
  }
  if (
    JSON.stringify(federation?.domains ?? [])
      !== JSON.stringify(FOUNDATION_NATIVE_BRIDGE_SPECS.map(spec => spec.domain))
  ) {
    fail('Runtime federation attestation domain topology diverged from the executable canonical Provider bridge registry.', {
      federationDomains: federation?.domains ?? null,
    });
  }

  console.log(JSON.stringify({
    ok: true,
    status: 'RCL_VERCEL_RUNTIME_FEDERATION_REGISTRY_BINDING_VERIFIED',
    providerBridgeRegistryRoot: registry.registryRoot,
    providerBridgeSpecCount: FOUNDATION_NATIVE_BRIDGE_SPECS.length,
    federationRoot: federation.federationRoot,
    domains: federation.domains,
    truthBoundary: {
      runtimeHealthFailsClosedOnFederationRegistryAttestationDrift: true,
      runtimeFederationSummaryExposesRegistryIdentity: true,
      registryBindingDoesNotClaimStatePathSemanticParity: true,
      providerBridgeDoesNotImplyDirectNativeExecution: true,
    },
  }, null, 2));
} catch (error) {
  fail(error?.message ?? String(error), {
    code: error?.code ?? null,
    details: error?.details ?? null,
    stack: error?.stack ?? null,
  });
}
