import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FOUNDATION_DIRECT_NATIVE_PARITY_FORMAT,
  verifyFoundationDirectLoweringLineage,
  verifyFoundationDirectNativeParity,
} from '../src/foundation-direct-native-parity.mjs';

const RULE = '__rcl_foundation_perception_vision_0';
const WITNESS = 'rcl:foundation:perception:vision';

function semanticValue(value) {
  if (value && typeof value === 'object' && value.kind === 'NumberValue') return value.value;
  return value;
}

function root(state) {
  const normalized = Object.fromEntries(Object.keys(state).sort().map(key => [key, semanticValue(state[key])]));
  return `root:${JSON.stringify(normalized)}`;
}

function lowering(overrides = {}) {
  const lowered = overrides.lowered ?? [{
    domain: 'perception', declaration: 'vision', directive: 'Observe', syntheticRule: RULE,
    stateTargets: ['vision.lux'], witness: WITNESS,
  }];
  return {
    lowered,
    summary: { loweredCount: overrides.loweredCount ?? lowered.length },
    truthBoundary: { directDomains: ['perception'] },
  };
}

function nativeHistory(overrides = {}) {
  return [{
    rule: overrides.rule ?? RULE,
    witnesses: overrides.witnesses ?? [WITNESS],
    changes: overrides.changes ?? [{ target: 'vision.lux', before: 0, after: 10 }],
  }];
}

function deps({
  referenceState = { 'vision.lux': 10 },
  nativeState = { 'vision.lux': 10 },
  compileOk = true,
  nativeError = null,
  stateRootVerified = true,
  stateRootParity = true,
  directLowering = lowering(),
  history = nativeHistory(),
} = {}) {
  return {
    compileProgram: source => ({ name: String(source), perceptions: [], rules: [], directives: [] }),
    compileDirectBytecode: async () => compileOk ? {
      ok: true,
      diagnostics: [],
      bytecode: new Uint8Array([82, 67, 76, 66]),
      foundationDirectLowering: directLowering,
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
        history,
      };
    },
    semanticStateRoot: root,
    semanticValue,
  };
}

test('verified state, native root authority and lowering lineage produce native-verified', async () => {
  const result = await verifyFoundationDirectNativeParity({ name: 'P' }, deps());
  assert.equal(result.format, FOUNDATION_DIRECT_NATIVE_PARITY_FORMAT);
  assert.equal(result.status, 'native-verified');
  assert.equal(result.verified, true);
  assert.deepEqual(result.parity, {
    state: true,
    semanticStateRoot: true,
    nativeStateRootVerified: true,
    nativeStateRootParity: true,
    loweringLineage: true,
  });
  assert.equal(result.lineage.entries[0].ok, true);
  assert.deepEqual(result.gaps, []);
});

test('state divergence fails closed even when native root and lineage pass', async () => {
  const result = await verifyFoundationDirectNativeParity({ name: 'P' }, deps({ nativeState: { 'vision.lux': 11 } }));
  assert.equal(result.status, 'parity-failed');
  assert.equal(result.parity.state, false);
  assert.equal(result.parity.semanticStateRoot, false);
  assert.equal(result.parity.loweringLineage, true);
});

test('semantic state comparison ignores native heap metadata through semanticValue', async () => {
  const richSemanticValue = value => {
    if (Array.isArray(value)) return value.map(richSemanticValue);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.entries(value)
      .filter(([key]) => !['__rclKind', '__rclObjectId'].includes(key))
      .map(([key, item]) => [key, richSemanticValue(item)]));
  };
  const injected = deps({ referenceState: { payload: { value: 7 } }, nativeState: { payload: { __rclKind: 'Record', __rclObjectId: 12, value: 7 } } });
  injected.semanticValue = richSemanticValue;
  injected.semanticStateRoot = state => `root:${JSON.stringify(richSemanticValue(state))}`;
  injected.runNative = async () => ({
    state: { payload: { __rclKind: 'Record', __rclObjectId: 12, value: 7 } },
    semanticStateRoot: `root:${JSON.stringify({ payload: { value: 7 } })}`,
    nativeStateRoot: 'native-root', stateRootVerified: true, stateRootParity: true,
    history: nativeHistory(),
  });
  const result = await verifyFoundationDirectNativeParity({ name: 'P' }, injected);
  assert.equal(result.status, 'native-verified');
  assert.equal(result.parity.state, true);
});

test('native state-root authority is non-compensatory', async () => {
  const result = await verifyFoundationDirectNativeParity({ name: 'P' }, deps({ stateRootVerified: false, stateRootParity: false }));
  assert.equal(result.status, 'parity-failed');
  assert.equal(result.parity.loweringLineage, true);
  assert.equal(result.parity.nativeStateRootVerified, false);
  assert.equal(result.parity.nativeStateRootParity, false);
});

test('missing C Native VM becomes explicit blocked result', async () => {
  const error = new Error('missing'); error.code = 'RCL_NATIVE_VM_MISSING';
  const result = await verifyFoundationDirectNativeParity({ name: 'P' }, deps({ nativeError: error }));
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
  assert.equal(nativeCalls, 0);
  assert.deepEqual(result.gaps, ['direct-bytecode-not-available']);
});

test('source text is compiled through injected canonical compiler before parity work', async () => {
  let compiled = null;
  const injected = deps();
  injected.compileProgram = source => { compiled = source; return { name: 'compiled', perceptions: [], rules: [], directives: [] }; };
  const result = await verifyFoundationDirectNativeParity('reality Example {}', injected);
  assert.equal(compiled, 'reality Example {}');
  assert.equal(result.status, 'native-verified');
});

test('missing matching synthetic native record fails lowering lineage', async () => {
  const result = await verifyFoundationDirectNativeParity({ name: 'P' }, deps({ history: nativeHistory({ rule: 'other-rule' }) }));
  assert.equal(result.status, 'parity-failed');
  assert.equal(result.parity.loweringLineage, false);
  assert.equal(result.lineage.entries[0].checks.exactNativeRecord, false);
  assert.equal(result.gaps.includes('loweringLineage'), true);
});

test('missing lowering witness fails lineage even when state parity passes', async () => {
  const result = await verifyFoundationDirectNativeParity({ name: 'P' }, deps({ history: nativeHistory({ witnesses: ['other'] }) }));
  assert.equal(result.status, 'parity-failed');
  assert.equal(result.lineage.entries[0].checks.witnessPresent, false);
});

test('missing lowered state target in native changes fails lineage', async () => {
  const result = await verifyFoundationDirectNativeParity({ name: 'P' }, deps({ history: nativeHistory({ changes: [{ target: 'other.path' }] }) }));
  assert.equal(result.status, 'parity-failed');
  assert.equal(result.lineage.entries[0].checks.stateTargetsCovered, false);
});

test('declared lowering count must bind exact lowering metadata', () => {
  const report = verifyFoundationDirectLoweringLineage(lowering({ loweredCount: 2 }), nativeHistory());
  assert.equal(report.ok, false);
  assert.equal(report.metadataComplete, false);
});

test('synthetic rule identity must remain unique in the lowering receipt', () => {
  const duplicate = { domain: 'perception', declaration: 'vision2', directive: 'Observe', syntheticRule: RULE, stateTargets: ['vision2.lux'], witness: 'rcl:foundation:perception:vision2' };
  const report = verifyFoundationDirectLoweringLineage(lowering({ lowered: [...lowering().lowered, duplicate] }), nativeHistory());
  assert.equal(report.ok, false);
  assert.equal(report.ruleIdentityUnique, false);
});

test('history/domain receipt parity remain outside claim boundary while lowering lineage is explicit', async () => {
  const result = await verifyFoundationDirectNativeParity({ name: 'P' }, deps());
  assert.equal(result.truthBoundary.loweringLineageClaimedOnlyWhenVerified, true);
  assert.equal(result.truthBoundary.historyParityClaimed, false);
  assert.equal(result.truthBoundary.domainReceiptParityClaimed, false);
  assert.equal(result.truthBoundary.allFoundationDomainsNativeClaimed, false);
});
