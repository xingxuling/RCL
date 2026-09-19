import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FoundationNativeFederationRegistryBindingError,
  verifyFoundationNativeFederationRegistryBinding,
} from '../src/foundation-native-federation-registry-binding.mjs';

const ROOT = 'a'.repeat(64);
const SPECS = [
  { batchId: 'batch-a', providerId: 'provider-a', providerCallCount: 2, domain: 'alpha', capability: 'alpha.run', statePath: 'bridge.alpha' },
  { batchId: 'batch-a', providerId: 'provider-a', providerCallCount: 2, domain: 'beta', capability: 'beta.run', statePath: 'bridge.beta' },
];
const REGISTRY = { registryRoot: ROOT };

function proof() {
  return {
    providerBridgeRegistryRoot: ROOT,
    providerBridgeSpecCount: 2,
    domains: ['alpha', 'beta'],
    providerBatches: {
      'batch-a': {
        providerId: 'provider-a',
        providerAbi: 1,
        providerCallCount: 2,
        domains: ['alpha', 'beta'],
      },
    },
  };
}

function verify(federationProof = proof()) {
  return verifyFoundationNativeFederationRegistryBinding({
    federationProof,
    bridgeSpecs: SPECS,
    registrySnapshot: REGISTRY,
  });
}

test('federation attestation is bound to the exact executable canonical bridge registry identity', () => {
  const result = verify();
  assert.equal(result.ok, true);
  assert.equal(result.providerBridgeRegistryRoot, ROOT);
  assert.equal(result.providerBridgeSpecCount, 2);
  assert.deepEqual(result.domains, ['alpha', 'beta']);
  assert.equal(result.truthBoundary.federationAttestationTopologyUsesExecutableCanonicalRegistry, true);
  assert.equal(result.truthBoundary.registryBindingDoesNotClaimStatePathSemanticParity, true);
});

test('federation attestation fails closed on registry-root drift', () => {
  const drifted = proof();
  drifted.providerBridgeRegistryRoot = 'b'.repeat(64);
  assert.throws(
    () => verify(drifted),
    error => error instanceof FoundationNativeFederationRegistryBindingError
      && error.code === 'RCL_FOUNDATION_FEDERATION_REGISTRY_DRIFT',
  );
});

test('federation attestation fails closed on canonical spec-count drift', () => {
  const drifted = proof();
  drifted.providerBridgeSpecCount = 1;
  assert.throws(
    () => verify(drifted),
    error => error instanceof FoundationNativeFederationRegistryBindingError
      && error.code === 'RCL_FOUNDATION_FEDERATION_REGISTRY_DRIFT',
  );
});

test('federation attestation fails closed on domain topology drift', () => {
  const drifted = proof();
  drifted.domains = ['beta', 'alpha'];
  assert.throws(
    () => verify(drifted),
    error => error instanceof FoundationNativeFederationRegistryBindingError
      && error.code === 'RCL_FOUNDATION_FEDERATION_DOMAIN_DRIFT',
  );
});

test('federation attestation fails closed on provider batch identity drift', () => {
  const drifted = proof();
  drifted.providerBatches['batch-a'].providerCallCount = 1;
  assert.throws(
    () => verify(drifted),
    error => error instanceof FoundationNativeFederationRegistryBindingError
      && error.code === 'RCL_FOUNDATION_FEDERATION_BATCH_DRIFT',
  );
});
