#!/usr/bin/env node
import { nativeVmDeploymentStatus } from '../api/health.mjs';
import {
  FOUNDATION_NATIVE_BRIDGE_BATCHES,
  FOUNDATION_NATIVE_BRIDGE_DOMAINS,
  FOUNDATION_NATIVE_BRIDGE_SPECS,
  foundationNativeBridgeCapabilityRegistrySnapshot,
} from '../src/foundation-native-bridge-capability-registry.mjs';

function fail(message, details = {}) {
  console.error(JSON.stringify({
    ok: false,
    status: 'RCL_FOUNDATION_NATIVE_BRIDGE_CAPABILITY_REGISTRY_DRIFT',
    message,
    ...details,
  }, null, 2));
  process.exit(1);
}

const registry = foundationNativeBridgeCapabilityRegistrySnapshot();
const status = nativeVmDeploymentStatus();
const federation = status.foundationNativeBridgeFederation;

if (
  status.foundationNativeBridgeBound !== true
  || status.foundationNativeBridgeFederationBound !== true
  || federation?.verified !== true
  || federation?.status !== 'deployment-bound'
) {
  fail('Deployment health has not bound the complete Native Provider bridge federation before registry verification', {
    foundationNativeBridgeBound: status.foundationNativeBridgeBound,
    foundationNativeBridgeFederationBound: status.foundationNativeBridgeFederationBound,
    federationStatus: federation?.status ?? null,
    federationVerified: federation?.verified ?? false,
    registryRoot: registry.registryRoot,
  });
}

if (JSON.stringify(status.foundationNativeBridgeDomains) !== JSON.stringify(FOUNDATION_NATIVE_BRIDGE_DOMAINS)) {
  fail('Deployment health Provider bridge domain order/content drifted from the source-derived capability registry', {
    healthDomains: status.foundationNativeBridgeDomains,
    registryDomains: FOUNDATION_NATIVE_BRIDGE_DOMAINS,
    registryRoot: registry.registryRoot,
  });
}

if (JSON.stringify(federation?.domains) !== JSON.stringify(FOUNDATION_NATIVE_BRIDGE_DOMAINS)) {
  fail('Federation deployment evidence domain order/content drifted from the source-derived capability registry', {
    federationDomains: federation?.domains ?? null,
    registryDomains: FOUNDATION_NATIVE_BRIDGE_DOMAINS,
    registryRoot: registry.registryRoot,
  });
}

for (const spec of FOUNDATION_NATIVE_BRIDGE_SPECS) {
  const proof = status.foundationNativeBridgeProofs?.[spec.domain];
  if (
    proof?.verified !== true
    || proof?.status !== 'native-bridge-verified'
    || proof?.mode !== 'native-provider-bridge'
    || proof?.batchId !== spec.batchId
    || proof?.providerId !== spec.providerId
    || proof?.providerCallCount !== spec.providerCallCount
    || proof?.domain !== spec.domain
    || proof?.capability !== spec.capability
  ) {
    fail('Deployment Provider bridge proof drifted from canonical capability metadata', {
      domain: spec.domain,
      expected: spec,
      observed: proof ?? null,
      registryRoot: registry.registryRoot,
    });
  }
}

for (const batch of FOUNDATION_NATIVE_BRIDGE_BATCHES) {
  const observed = federation?.providerBatches?.[batch.batchId];
  if (
    observed?.providerId !== batch.providerId
    || observed?.providerCallCount !== batch.providerCallCount
    || JSON.stringify(observed?.domains) !== JSON.stringify(batch.domains)
  ) {
    fail('Deployment Provider batch evidence drifted from canonical registry batch metadata', {
      batchId: batch.batchId,
      expected: batch,
      observed: observed ?? null,
      registryRoot: registry.registryRoot,
    });
  }
}

console.log(JSON.stringify({
  ok: true,
  status: 'RCL_FOUNDATION_NATIVE_BRIDGE_CAPABILITY_REGISTRY_VERIFIED',
  registryRoot: registry.registryRoot,
  batchCount: FOUNDATION_NATIVE_BRIDGE_BATCHES.length,
  capabilityCount: FOUNDATION_NATIVE_BRIDGE_SPECS.length,
  domains: FOUNDATION_NATIVE_BRIDGE_DOMAINS,
  federationRoot: federation.federationRoot,
}, null, 2));
