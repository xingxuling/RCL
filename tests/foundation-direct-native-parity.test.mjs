import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FOUNDATION_DIRECT_NATIVE_PARITY_FORMAT,
  verifyFoundationDirectNativeParity,
} from '../src/foundation-direct-native-parity.mjs';

function semanticValue(value) {
  if (value && typeof value === 'object' && value.kind === 'NumberValue') return value.value;
  return value;
}

function root(state) {
  const normalized = Object.fromEntries(Object.keys(state).sort().map(key => [key, semanticValue(state[key])]));
  return `root:${JSON.stringify(normalized)}`;
}

function deps({
  referenceState = { 'vision.lux': 10 },
  nativeState = { 'vision.lux': 10 },
  compileOk = true,
  nativeError = null,
  stateRootVerified = true,
  stateRootParity = true,
} = {}) {
  return {
    compileProgram: source => ({ name: String(source), perceptions: [], rules: [], directives: [] }),
    compileDirectBytecode: async () => compileOk ? {
      ok: true,
      diagnostics: [],
      bytecode: new Uint8Array([82, 67, 76, 66]),
      foundationDirectLowering: { summary: { loweredCount: 1 }, truthBoundary: { directDomains: ['perception'] } },
    } : {
      ok: false,
      diagnostics: [{ code: 'RCL_TEST_COMPILE_BLOCKED', message: 'blocked' }],
      bytecode: null,
      foundationDirectLowering: null,
    },
    runReference: async () => ({ state: referenceState, history: [{ kind: 'DomainRun' }] }),
    runNative: async () => {
      if (nativeError) throw nativeError;
      return {
        state: nativeState,
        semanticStateRoot: root(nativeState),
        nativeStateRoot: 'native-root',
        stateRootVerified,
        stateRootParity,
        history: [{ kind: 'CoreRule' }],
      };
    },
    semanticStateRoot: root,
    semanticValue,
  };
}

test('verified state and native root authority produce a bounded native-verified result', async () => {
  const result = await verifyFoundationDirectNativeParity({ name: 'P' }, deps());
  assert.equal(result.format, FOUNDATION_DIRECT_NATIVE_PARITY_FORMAT);
  assert.equal(result.status, 'native-verified');
  assert.equal(result.verified, true);
  assert.deepEqual(result.parity, {
    state: true,
    semanticStateRoot: true,
    nativeStateRootVerified: true,
    nativeStateRootParity: true,
  });
  assert.deepEqual(result.gaps, []);
});

test('state divergence fails closed even when the native root authenticates itself', async () => {
  const result = await verifyFoundationDirectNativeParity(
    { name: 'P' },
    deps({ nativeState: { 'vision.lux': 11 } }),
  );
  assert.equal(result.status, 'parity-failed');
  assert.equal(result.verified, false);
  assert.equal(result.parity.state, false);
  assert.equal(result.parity.semanticStateRoot, false);
});

test('semantic state comparison ignores native heap metadata through semanticValue', async () => {
  const richSemanticValue = value => {
    if (Array.isArray(value)) return value.map(richSemanticValue);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.entries(value)
      .filter(([key]) => !['__rclKind', '__rclObjectId'].includes(key))
      .map(([key, item]) => [key, richSemanticValue(item)]));
  };
  const injected = deps({
    referenceState: { payload: { value: 7 } },
    nativeState: { payload: { __rclKind: 'Record', __rclObjectId: 12, value: 7 } },
  });
  injected.semanticValue = richSemanticValue;
  injected.semanticStateRoot = state => `root:${JSON.stringify(richSemanticValue(state))}`;
  injected.runNative = async () => ({
    state: { payload: { __rclKind: 'Record', __rclObjectId: 12, value: 7 } },
    semanticStateRoot: `root:${JSON.stringify({ payload: { value: 7 } })}`,
    nativeStateRoot: 'native-root',
    stateRootVerified: true,
    stateRootParity: true,
  });
  const result = await verifyFoundationDirectNativeParity({ name: 'P' }, injected);
  assert.equal(result.status, 'native-verified');
  assert.equal(result.parity.state, true);
});

test('native state-root authority is non-compensatory', async () => {
  const result = await verifyFoundationDirectNativeParity(
    { name: 'P' },
    deps({ stateRootVerified: false, stateRootParity: false }),
  );
  assert.equal(result.status, 'parity-failed');
  assert.equal(result.parity.state, true);
  assert.equal(result.parity.nativeStateRootVerified, false);
  assert.equal(result.parity.nativeStateRootParity, false);
});

test('missing C Native VM becomes an explicit blocked result rather than a parity claim', async () => {
  const error = new Error('missing');
  error.code = 'RCL_NATIVE_VM_MISSING';
  const result = await verifyFoundationDirectNativeParity(
    { name: 'P' },
    deps({ nativeError: error }),
  );
  assert.equal(result.status, 'native-blocked');
  assert.equal(result.verified, false);
  assert.deepEqual(result.gaps, ['native-vm-missing']);
});

test('direct-bytecode compile failure blocks native execution', async () => {
  let nativeCalls = 0;
  const injected = deps({ compileOk: false });
  injected.runNative = async () => { nativeCalls += 1; throw new Error('should not run'); };
  const result = await verifyFoundationDirectNativeParity({ name: 'P' }, injected);
  assert.equal(result.status, 'compile-blocked');
  assert.equal(result.verified, false);
  assert.equal(nativeCalls, 0);
  assert.deepEqual(result.gaps, ['direct-bytecode-not-available']);
});

test('source text is compiled through the injected canonical compiler before parity work', async () => {
  let compiled = null;
  const injected = deps();
  injected.compileProgram = source => {
    compiled = source;
    return { name: 'compiled', perceptions: [], rules: [], directives: [] };
  };
  const result = await verifyFoundationDirectNativeParity('reality Example {}', injected);
  assert.equal(compiled, 'reality Example {}');
  assert.equal(result.status, 'native-verified');
});

test('receipt and history parity remain explicitly outside the claim boundary', async () => {
  const result = await verifyFoundationDirectNativeParity({ name: 'P' }, deps());
  assert.equal(result.truthBoundary.historyParityClaimed, false);
  assert.equal(result.truthBoundary.domainReceiptParityClaimed, false);
  assert.equal(result.truthBoundary.allFoundationDomainsNativeClaimed, false);
  assert.equal(result.truthBoundary.providerBridgeRemovedGlobally, false);
});
