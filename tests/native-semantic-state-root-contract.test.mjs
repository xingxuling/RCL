import assert from 'node:assert/strict';
import test from 'node:test';
import {
  RCL_NATIVE_STATE_ROOT_ALGORITHM,
  RCLSemanticStateRootError,
  semanticStateRoot,
  semanticValue,
  verifyNativeSemanticStateRoot,
} from '../src/semantic-state-root.mjs';

test('semantic state root is stable across object field order', () => {
  const left = { world: { ready: true, count: 3 }, name: 'RCL' };
  const right = { name: 'RCL', world: { count: 3, ready: true } };
  assert.equal(semanticStateRoot(left), semanticStateRoot(right));
});

test('semantic state root strips native heap metadata but preserves semantic types', () => {
  const plain = { actor: { name: 'Aster', energy: 7 } };
  const native = {
    actor: {
      __rclKind: 'TypedRecord',
      __rclType: 'Actor',
      __rclObjectId: 42,
      __rclFieldOffsets: { name: 0, energy: 1 },
      name: 'Aster',
      energy: 7,
    },
  };
  assert.equal(semanticStateRoot(plain), semanticStateRoot(native));
  assert.notEqual(semanticStateRoot({ value: 1 }), semanticStateRoot({ value: '1' }));
});

test('Intent slot arrays normalize to semantic slot objects', () => {
  const nativeIntent = { kind: 'Intent', slots: ['target', 'world', 'priority', 5] };
  const referenceIntent = { kind: 'Intent', slots: { priority: 5, target: 'world' } };
  assert.deepEqual(semanticValue(nativeIntent), referenceIntent);
  assert.equal(semanticStateRoot(nativeIntent), semanticStateRoot(referenceIntent));
});

test('matching native semantic root is accepted and marked verified', () => {
  const state = { 'world.ready': true, 'world.count': 2 };
  const root = semanticStateRoot(state);
  const result = verifyNativeSemanticStateRoot({
    status: 'ok',
    state,
    stateRootAlgorithm: RCL_NATIVE_STATE_ROOT_ALGORITHM,
    stateRoot: root,
  }, { requireNativeRoot: true });

  assert.equal(result.nativeStateRoot, root);
  assert.equal(result.semanticStateRoot, root);
  assert.equal(result.stateRootVerified, true);
  assert.equal(result.stateRootParity, true);
});

test('missing native root is explicit during the compatibility phase', () => {
  const state = { 'world.ready': true };
  const result = verifyNativeSemanticStateRoot({ status: 'ok', state });
  assert.equal(result.nativeStateRoot, null);
  assert.equal(result.semanticStateRoot, semanticStateRoot(state));
  assert.equal(result.stateRootAlgorithm, RCL_NATIVE_STATE_ROOT_ALGORITHM);
  assert.equal(result.stateRootVerified, false);
  assert.equal(result.stateRootParity, false);
});

test('required native root rejects absent evidence', () => {
  assert.throws(
    () => verifyNativeSemanticStateRoot({ status: 'ok', state: {} }, { requireNativeRoot: true }),
    error => error instanceof RCLSemanticStateRootError && error.code === 'RCL_NATIVE_STATE_ROOT_MISSING',
  );
});

test('algorithm, root and paired-field tampering are rejected', () => {
  const state = { 'world.ready': true };
  const root = semanticStateRoot(state);

  assert.throws(
    () => verifyNativeSemanticStateRoot({ state, stateRoot: root }),
    error => error instanceof RCLSemanticStateRootError && error.code === 'RCL_NATIVE_STATE_ROOT_INCOMPLETE',
  );
  assert.throws(
    () => verifyNativeSemanticStateRoot({ state, stateRootAlgorithm: 'rcl.semantic-state-root.v0', stateRoot: root }),
    error => error instanceof RCLSemanticStateRootError && error.code === 'RCL_NATIVE_STATE_ROOT_ALGORITHM_MISMATCH',
  );
  assert.throws(
    () => verifyNativeSemanticStateRoot({ state, stateRootAlgorithm: RCL_NATIVE_STATE_ROOT_ALGORITHM, stateRoot: '0'.repeat(64) }),
    error => error instanceof RCLSemanticStateRootError && error.code === 'RCL_NATIVE_STATE_ROOT_MISMATCH',
  );
});
