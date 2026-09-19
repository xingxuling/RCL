import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FOUNDATION_NATIVE_BRIDGE_BATCHES,
  FOUNDATION_NATIVE_BRIDGE_CAPABILITY_REGISTRY_ROOT,
  FOUNDATION_NATIVE_BRIDGE_DOMAINS,
  FOUNDATION_NATIVE_BRIDGE_SPECS,
  foundationNativeBridgeBatch,
  foundationNativeBridgeCapability,
  foundationNativeBridgeCapabilityRegistrySnapshot,
} from '../src/foundation-native-bridge-capability-registry.mjs';

test('provider bridge registry is derived into the complete five-batch sixteen-domain federation', () => {
  assert.deepEqual(
    FOUNDATION_NATIVE_BRIDGE_BATCHES.map(batch => [batch.batchId, batch.providerCallCount]),
    [['batch-a', 6], ['meta-batch-b', 3], ['batch-c', 2], ['batch-d', 3], ['batch-e', 2]],
  );
  assert.equal(FOUNDATION_NATIVE_BRIDGE_SPECS.length, 16);
  assert.equal(new Set(FOUNDATION_NATIVE_BRIDGE_DOMAINS).size, 16);
  assert.deepEqual(
    [...FOUNDATION_NATIVE_BRIDGE_DOMAINS],
    [
      'quantitative', 'knowledge', 'perception', 'natural-language-reality', 'understanding-reality', 'creative-reality',
      'meta-spacetime', 'meta-acceleration', 'meta-compression',
      'physical', 'embodiment',
      'energy', 'elemental', 'neural',
      'metacomputation', 'computation',
    ],
  );
});

test('provider and capability provenance stay attached to each domain', () => {
  assert.deepEqual(
    foundationNativeBridgeCapability('knowledge'),
    {
      batchId: 'batch-a',
      providerId: 'rcl.foundation.batch-a',
      providerCallCount: 6,
      domain: 'knowledge',
      capability: 'knowledge.resolve',
      statePath: 'bridge.knowledge',
    },
  );
  assert.deepEqual(
    foundationNativeBridgeBatch('batch-d'),
    {
      batchId: 'batch-d',
      providerId: 'rcl.foundation.batch-d',
      providerCallCount: 3,
      domains: ['energy', 'elemental', 'neural'],
    },
  );
  assert.equal(foundationNativeBridgeCapability('unknown-domain'), null);
  assert.equal(foundationNativeBridgeBatch('unknown-batch'), null);
});

test('provider bridge registry root is deterministic and content-addressed', () => {
  const a = foundationNativeBridgeCapabilityRegistrySnapshot();
  const b = foundationNativeBridgeCapabilityRegistrySnapshot();
  assert.deepEqual(a, b);
  assert.equal(a.registryRoot, FOUNDATION_NATIVE_BRIDGE_CAPABILITY_REGISTRY_ROOT);
  assert.match(a.registryRoot, /^[0-9a-f]{64}$/);
  assert.equal(a.capabilities.length, 16);
  assert.equal(a.batches.length, 5);
});

test('counterfactual omission changes the observable federation domain truth', () => {
  const withoutKnowledge = FOUNDATION_NATIVE_BRIDGE_DOMAINS.filter(domain => domain !== 'knowledge');
  assert.notDeepEqual(withoutKnowledge, FOUNDATION_NATIVE_BRIDGE_DOMAINS);
  assert.equal(withoutKnowledge.length, 15);
});
