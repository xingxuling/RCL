import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FOUNDATION_CORE_DIRECT_RUNTIME_DOMAINS,
  FOUNDATION_DIRECT_CAPABILITIES,
  FOUNDATION_DIRECT_CAPABILITY_REGISTRY_ROOT,
  FOUNDATION_DIRECT_IMPLEMENTATION_DOMAINS,
  canonicalFoundationDirectDomainId,
  foundationDirectCapability,
  foundationDirectCapabilityRegistrySnapshot,
  foundationDirectImplementation,
} from '../src/foundation-direct-capability-registry.mjs';
import {
  FOUNDATION_DIRECT_IMPLEMENTATION_DOMAINS as CONFORMANCE_DIRECT_IMPLEMENTATION_DOMAINS,
  canonicalFoundationConformanceDomainId,
} from '../src/foundation-conformance-truth.mjs';
import { lowerDeclaredFoundationToCore } from '../src/foundation-direct-lowering.mjs';

function emptyFoundationProgram() {
  return {
    rules: [],
    directives: [],
    perceptions: [],
    physicals: [],
    neurals: [],
    genetics: [],
    livings: [],
  };
}

test('canonical direct capability registry owns the eight current implementation domains', () => {
  assert.deepEqual(
    [...FOUNDATION_DIRECT_IMPLEMENTATION_DOMAINS],
    ['perception', 'physical', 'neural', 'genetic', 'life', 'quantitative', 'energy', 'knowledge'],
  );
  assert.equal(new Set(FOUNDATION_DIRECT_IMPLEMENTATION_DOMAINS).size, FOUNDATION_DIRECT_CAPABILITIES.length);
  assert.equal(Object.isFrozen(FOUNDATION_DIRECT_CAPABILITIES), true);
  assert.equal(FOUNDATION_DIRECT_CAPABILITIES.every(Object.isFrozen), true);
});

test('conformance truth consumes the exact registry domain object instead of a shadow copy', () => {
  assert.strictEqual(CONFORMANCE_DIRECT_IMPLEMENTATION_DOMAINS, FOUNDATION_DIRECT_IMPLEMENTATION_DOMAINS);
  assert.equal(canonicalFoundationConformanceDomainId('living'), canonicalFoundationDirectDomainId('living'));
  assert.equal(canonicalFoundationConformanceDomainId('life'), canonicalFoundationDirectDomainId('life'));
});

test('registry preserves the runtime living to canonical life boundary explicitly', () => {
  assert.equal(canonicalFoundationDirectDomainId('living'), 'life');
  assert.equal(canonicalFoundationDirectDomainId('life'), 'life');
  assert.equal(foundationDirectCapability('living')?.runtimeDomain, 'living');
  assert.equal(foundationDirectCapability('life')?.canonicalDomain, 'life');
});

test('foundation core lowerer defaults remain fail-closed coherent with the registry', () => {
  const probe = lowerDeclaredFoundationToCore(emptyFoundationProgram());
  assert.deepEqual(
    [...(probe?.summary?.enabledDomains ?? [])].sort(),
    [...FOUNDATION_CORE_DIRECT_RUNTIME_DOMAINS].sort(),
  );
});

test('implementation provenance comes from the same capability registry', () => {
  assert.equal(
    foundationDirectImplementation('quantitative'),
    'src/foundation-quantitative-direct-lowering.mjs + src/foundation-direct-bytecode.mjs',
  );
  assert.equal(
    foundationDirectImplementation('energy'),
    'src/foundation-energy-direct-lowering.mjs + src/foundation-direct-bytecode.mjs',
  );
  assert.equal(
    foundationDirectImplementation('knowledge'),
    'src/foundation-knowledge-direct-lowering.mjs + src/foundation-direct-bytecode.mjs',
  );
  assert.equal(
    foundationDirectImplementation('living'),
    'src/foundation-direct-lowering.mjs + src/foundation-direct-bytecode.mjs',
  );
});

test('registry snapshot and root are deterministic and evidence-bearing', () => {
  const a = foundationDirectCapabilityRegistrySnapshot();
  const b = foundationDirectCapabilityRegistrySnapshot();
  assert.deepEqual(a, b);
  assert.equal(a.registryRoot, FOUNDATION_DIRECT_CAPABILITY_REGISTRY_ROOT);
  assert.match(a.registryRoot, /^[0-9a-f]{64}$/);
  assert.equal(a.capabilities.length, FOUNDATION_DIRECT_CAPABILITIES.length);
});

test('counterfactual Knowledge omission is observably different from canonical registry truth', () => {
  const canonical = [...FOUNDATION_DIRECT_IMPLEMENTATION_DOMAINS].sort();
  const missingKnowledge = canonical.filter(domain => domain !== 'knowledge');
  assert.notDeepEqual(missingKnowledge, canonical);
  assert.equal(missingKnowledge.includes('knowledge'), false);
});
