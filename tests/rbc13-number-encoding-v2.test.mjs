import assert from 'node:assert/strict';
import test from 'node:test';
import {
  RCL_CANONICAL_NUMBER_ENCODING_V2,
  RCLCanonicalNumberV2Error,
  canonicalNumberV2,
  canonicalNumberV2Bytes,
  canonicalNumberV2Record,
  decodeCanonicalNumberV2,
  numberFromRawBits,
} from '../src/canonical-number-v2.mjs';
import {
  RCL_NATIVE_STATE_ROOT_ALGORITHM_V2,
  semanticStateRootV2,
  verifySemanticStateRootV2,
} from '../src/semantic-state-root-v2.mjs';
import { migrateVerifiedV1ReceiptToV2 } from '../src/semantic-state-root-migration-v2.mjs';
import {
  RCL_NATIVE_STATE_ROOT_ALGORITHM,
  semanticStateRoot,
} from '../src/semantic-state-root.mjs';

test('Number v2 is a fixed-width binary64 token and canonicalizes negative zero', () => {
  assert.equal(RCL_CANONICAL_NUMBER_ENCODING_V2, 'rcl.canonical-number.v2');
  assert.equal(canonicalNumberV2(0), '0x0000000000000000');
  assert.equal(canonicalNumberV2(-0), '0x0000000000000000');
  assert.equal(canonicalNumberV2(Number.MAX_VALUE), '0x7fefffffffffffff');
  assert.equal(canonicalNumberV2(Number.MIN_VALUE), '0x0000000000000001');
  assert.equal(canonicalNumberV2(9007199254740991), '0x433fffffffffffff');
  assert.equal(canonicalNumberV2(9007199254740990), '0x433ffffffffffffe');
  assert.equal(canonicalNumberV2Bytes(0.1).length, 8);
});

test('Number v2 round-trips edge values and rejects non-finite values', () => {
  for (const value of [0, -0, 0.1, -0.1, Number.MIN_VALUE, Number.MAX_VALUE, 1e308, -1e-308]) {
    const token = canonicalNumberV2(value);
    const decoded = decodeCanonicalNumberV2(token);
    if (value === 0) assert.equal(decoded, 0);
    else assert.equal(Object.is(decoded, value), true);
  }
  for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    assert.throws(() => canonicalNumberV2(value), error => error instanceof RCLCanonicalNumberV2Error && error.code === 'RCL_CANONICAL_NUMBER_V2_NONFINITE');
  }
  assert.throws(() => decodeCanonicalNumberV2('0x8000000000000000'), error => error.code === 'RCL_CANONICAL_NUMBER_V2_NEGATIVE_ZERO');
  assert.throws(() => decodeCanonicalNumberV2('0x7ff0000000000000'), error => error.code === 'RCL_CANONICAL_NUMBER_V2_NONFINITE_TOKEN');
});

test('semantic root v2 is independent from v1 and order-stable', () => {
  const left = { world: { count: 9007199254740991, ready: true }, name: 'RCL' };
  const right = { name: 'RCL', world: { ready: true, count: 9007199254740991 } };
  assert.equal(semanticStateRootV2(left), semanticStateRootV2(right));
  assert.notEqual(semanticStateRootV2({ value: 9007199254740991 }), semanticStateRootV2({ value: 9007199254740990 }));
  assert.equal(semanticStateRootV2({ value: 0 }), semanticStateRootV2({ value: -0 }));
  assert.notEqual(semanticStateRootV2(left), semanticStateRoot(left));
  const verified = verifySemanticStateRootV2({
    state: left,
    stateRootAlgorithm: RCL_NATIVE_STATE_ROOT_ALGORITHM_V2,
    stateRoot: semanticStateRootV2(left),
  }, { requireNativeRoot: true });
  assert.equal(verified.stateRootVerified, true);
  assert.equal(verified.numberEncoding, RCL_CANONICAL_NUMBER_ENCODING_V2);
});

test('verified v1 receipt can be migrated without rewriting the v1 root', () => {
  const state = { world: { count: 7, ready: true } };
  const v1Root = semanticStateRoot(state);
  const migration = migrateVerifiedV1ReceiptToV2({
    state,
    stateRootAlgorithm: RCL_NATIVE_STATE_ROOT_ALGORITHM,
    stateRoot: v1Root,
  });
  assert.equal(migration.v1Root, v1Root);
  assert.equal(migration.v1Verified, true);
  assert.match(migration.v2Root, /^[a-f0-9]{64}$/);
  assert.equal(migration.v2Verified, false);
  assert.equal(migration.canonicalAdmission, false);
});

test('Number v2 record exposes raw and normalized bits for audit', () => {
  const record = canonicalNumberV2Record(-0);
  assert.equal(record.rawBits, '0x8000000000000000');
  assert.equal(record.bits, '0x0000000000000000');
  assert.equal(record.negativeZeroCanonicalized, true);
  assert.equal(numberFromRawBits(BigInt(record.rawBits)), -0);
});
