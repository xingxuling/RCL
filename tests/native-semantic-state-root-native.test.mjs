import assert from 'node:assert/strict';
import test from 'node:test';
import {
  RCL_NATIVE_STATE_ROOT_ALGORITHM,
  runRealityNative,
  semanticStateRoot,
  verifyNativeParity,
} from '../src/native-vm.mjs';

test('current native VM emits and verifies rcl.semantic-state-root.v1', () => {
  const result = runRealityNative(`reality NativeSemanticAuthority {
    facet world.ready : Truth = true
    facet world.count : Number = 2
  }`, { requireNativeStateRoot: true });

  assert.equal(result.stateRootAlgorithm, RCL_NATIVE_STATE_ROOT_ALGORITHM);
  assert.equal(result.stateRootVerified, true);
  assert.equal(result.stateRootParity, true);
  assert.equal(result.nativeStateRoot, semanticStateRoot(result.state));
  assert.equal(result.semanticStateRoot, result.nativeStateRoot);
});

test('reference and native semantic state roots agree', async () => {
  const parity = await verifyNativeParity(`reality NativeSemanticParity {
    facet world.name : Text = "RCL"
    facet world.ready : Truth = true
    facet world.count : Number = 7
  }`, {
    nativeRuntime: { requireNativeStateRoot: true },
  });

  assert.equal(parity.ok, true);
  assert.equal(parity.parity.semanticStateRoot, true);
  assert.deepEqual(parity.nativeAuthority, {
    algorithm: RCL_NATIVE_STATE_ROOT_ALGORITHM,
    emittedByNative: true,
    verified: true,
    parity: true,
  });
});
