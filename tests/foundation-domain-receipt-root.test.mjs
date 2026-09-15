import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FOUNDATION_DOMAIN_RECEIPT_ROOT_ALGORITHM,
  foundationDomainReceiptRoot,
  verifyFoundationDomainReceiptParity,
  verifyFoundationDirectNativeParity,
} from '../src/foundation-direct-native-parity.mjs';

const RULE = '__rcl_foundation_perception_vision_0';
const WITNESS = 'rcl:foundation:perception:vision';

function semanticValue(value) {
  if (value && typeof value === 'object' && value.kind === 'NumberValue') return value.value;
  return value;
}

function stateRoot(state) {
  const normalized = Object.fromEntries(Object.keys(state).sort().map(key => [key, semanticValue(state[key])]));
  return `root:${JSON.stringify(normalized)}`;
}

function lowering() {
  return {
    lowered: [{
      domain: 'perception', declaration: 'vision', directive: 'Observe', directiveIndex: 0,
      syntheticRule: RULE, stateTargets: ['vision.lux'], witness: WITNESS,
      observer: 'agent.eye', sourceReality: 'world.scene', authorityClass: 'observation',
    }],
    summary: { loweredCount: 1 },
  };
}

function referenceHistory(after = 10) {
  return [{
    kind: 'DomainTransition', domainKind: 'perceptual', name: 'vision', status: 'realized',
    observer: 'agent.eye', sourceReality: 'world.scene', authorityClass: 'observation',
    changes: [{ target: 'vision.lux', before: 0, after }],
  }];
}

function nativeHistory(after = 10) {
  return [{
    rule: RULE, status: 'realized', witnesses: [WITNESS],
    changes: [{ target: 'vision.lux', before: 0, after }],
  }];
}

test('domain receipt root is deterministic, algorithm-labelled and 256-bit hex', () => {
  const first = verifyFoundationDomainReceiptParity(lowering(), referenceHistory(), nativeHistory(), semanticValue);
  const second = verifyFoundationDomainReceiptParity(lowering(), referenceHistory(), nativeHistory(), semanticValue);
  assert.equal(first.rootAlgorithm, FOUNDATION_DOMAIN_RECEIPT_ROOT_ALGORITHM);
  assert.match(first.receiptRoot, /^[0-9a-f]{64}$/);
  assert.equal(first.receiptRoot, second.receiptRoot);
  assert.equal(first.receiptRoot, foundationDomainReceiptRoot(first));
});

test('domain receipt root changes when transition evidence changes', () => {
  const baseline = verifyFoundationDomainReceiptParity(lowering(), referenceHistory(), nativeHistory(), semanticValue);
  const divergent = verifyFoundationDomainReceiptParity(lowering(), referenceHistory(), nativeHistory(11), semanticValue);
  assert.notEqual(baseline.receiptRoot, divergent.receiptRoot);
  assert.equal(baseline.ok, true);
  assert.equal(divergent.ok, false);
});

test('native parity result exposes domain receipt root without upgrading its authority', async () => {
  const directLowering = lowering();
  const result = await verifyFoundationDirectNativeParity({ name: 'P' }, {
    compileProgram: value => value,
    compileDirectBytecode: async () => ({ ok: true, bytecode: new Uint8Array([82, 67, 76, 66]), foundationDirectLowering: directLowering }),
    runReference: async () => ({ state: { 'vision.lux': 10 }, history: referenceHistory() }),
    runNative: async () => ({
      state: { 'vision.lux': 10 }, semanticStateRoot: stateRoot({ 'vision.lux': 10 }), nativeStateRoot: 'native-root',
      stateRootVerified: true, stateRootParity: true, history: nativeHistory(),
    }),
    semanticStateRoot: stateRoot,
    semanticValue,
  });
  assert.equal(result.status, 'native-verified');
  assert.equal(result.roots.foundationDomainReceiptRoot, result.domainReceipt.receiptRoot);
  assert.equal(result.roots.foundationDomainReceiptRootAlgorithm, FOUNDATION_DOMAIN_RECEIPT_ROOT_ALGORITHM);
  assert.equal(result.truthBoundary.domainReceiptRootIsEvidenceBindingNotStandaloneProof, true);
});

test('receipt root binds negative evidence instead of erasing failed checks', () => {
  const failed = verifyFoundationDomainReceiptParity(lowering(), referenceHistory(), nativeHistory(11), semanticValue);
  const mutated = structuredClone(failed);
  mutated.entries[0].checks.transitionValuesEquivalent = true;
  mutated.entries[0].ok = true;
  mutated.ok = true;
  assert.equal(failed.ok, false);
  assert.notEqual(failed.receiptRoot, foundationDomainReceiptRoot(mutated));
});
