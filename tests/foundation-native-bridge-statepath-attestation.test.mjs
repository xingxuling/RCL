import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FOUNDATION_NATIVE_BRIDGE_SPECS,
  foundationNativeBridgeCapabilityRegistrySnapshot,
} from '../src/foundation-native-bridge-capability-registry.mjs';
import {
  createFoundationNativeBridgeStatePathAttestation,
  expectedFoundationBridgeSemanticResultPath,
  verifyFoundationNativeBridgeStatePathAttestation,
} from '../src/foundation-native-bridge-statepath-attestation.mjs';

function root(char) {
  return char.repeat(64);
}

function validEntries() {
  return FOUNDATION_NATIVE_BRIDGE_SPECS.map((spec, index) => ({
    batchId: spec.batchId,
    providerId: spec.providerId,
    providerCallCount: spec.providerCallCount,
    domain: spec.domain,
    capability: spec.capability,
    statePath: spec.statePath,
    semanticResultPath: expectedFoundationBridgeSemanticResultPath(spec.domain),
    sourceRoot: root(((index + 1) % 10).toString()),
    bytecodeRoot: root(((index + 2) % 10).toString()),
    deterministicReceiptRoot: root(((index + 3) % 10).toString()),
    beforeRoot: root(((index + 4) % 10).toString()),
    afterRoot: root(((index + 5) % 10).toString()),
    sequence: FOUNDATION_NATIVE_BRIDGE_SPECS
      .slice(0, index + 1)
      .filter(item => item.batchId === spec.batchId).length,
    replayVerified: true,
    semanticChangeVerified: true,
  }));
}

function errorCode(fn) {
  try {
    fn();
  } catch (error) {
    return error?.code ?? null;
  }
  return null;
}

test('creates and verifies a statePath semantic attestation bound to the canonical registry', () => {
  const registry = foundationNativeBridgeCapabilityRegistrySnapshot();
  const attestation = createFoundationNativeBridgeStatePathAttestation({ entries: validEntries() });
  const verification = verifyFoundationNativeBridgeStatePathAttestation({ attestation });
  assert.equal(verification.ok, true);
  assert.equal(verification.providerBridgeRegistryRoot, registry.registryRoot);
  assert.equal(verification.providerBridgeSpecCount, FOUNDATION_NATIVE_BRIDGE_SPECS.length);
  assert.equal(verification.domains.length, FOUNDATION_NATIVE_BRIDGE_SPECS.length);
});

test('fails closed when a canonical statePath drifts', () => {
  const attestation = structuredClone(createFoundationNativeBridgeStatePathAttestation({ entries: validEntries() }));
  attestation.entries[0].statePath = 'bridge.wrong_path';
  assert.equal(
    errorCode(() => verifyFoundationNativeBridgeStatePathAttestation({ attestation })),
    'RCL_FOUNDATION_BRIDGE_STATEPATH_SPEC_DRIFT',
  );
});

test('fails closed when the semantic result path drifts', () => {
  const attestation = structuredClone(createFoundationNativeBridgeStatePathAttestation({ entries: validEntries() }));
  attestation.entries[1].semanticResultPath = 'foundation.wrong.result';
  assert.equal(
    errorCode(() => verifyFoundationNativeBridgeStatePathAttestation({ attestation })),
    'RCL_FOUNDATION_BRIDGE_STATEPATH_SEMANTIC_PATH_DRIFT',
  );
});

test('fails closed when replay evidence is absent', () => {
  const attestation = structuredClone(createFoundationNativeBridgeStatePathAttestation({ entries: validEntries() }));
  attestation.entries[2].replayVerified = false;
  assert.equal(
    errorCode(() => verifyFoundationNativeBridgeStatePathAttestation({ attestation })),
    'RCL_FOUNDATION_BRIDGE_STATEPATH_SEMANTIC_EVIDENCE_INCOMPLETE',
  );
});

test('fails closed when a content-addressed attestation root is tampered', () => {
  const attestation = structuredClone(createFoundationNativeBridgeStatePathAttestation({ entries: validEntries() }));
  attestation.attestationRoot = root('f');
  assert.equal(
    errorCode(() => verifyFoundationNativeBridgeStatePathAttestation({ attestation })),
    'RCL_FOUNDATION_BRIDGE_STATEPATH_ROOT_DRIFT',
  );
});

test('fails closed when Provider batch replay sequence drifts', () => {
  const attestation = structuredClone(createFoundationNativeBridgeStatePathAttestation({ entries: validEntries() }));
  // Use a domain after the first entry in its batch so sequence != canonical position.
  const target = FOUNDATION_NATIVE_BRIDGE_SPECS.findIndex((spec, index) => (
    index > 0 && FOUNDATION_NATIVE_BRIDGE_SPECS[index - 1]?.batchId === spec.batchId
  ));
  attestation.entries[target].sequence = 99;
  assert.equal(
    errorCode(() => verifyFoundationNativeBridgeStatePathAttestation({ attestation })),
    'RCL_FOUNDATION_BRIDGE_STATEPATH_SEQUENCE_DRIFT',
  );
});

test('fails closed when truth boundary overclaim protection is removed', () => {
  const attestation = structuredClone(createFoundationNativeBridgeStatePathAttestation({ entries: validEntries() }));
  attestation.truthBoundary.statePathSemanticAttestationDoesNotImplyDirectNativeExecution = false;
  assert.equal(
    errorCode(() => verifyFoundationNativeBridgeStatePathAttestation({ attestation })),
    'RCL_FOUNDATION_BRIDGE_STATEPATH_TRUTH_BOUNDARY_DRIFT',
  );
});
