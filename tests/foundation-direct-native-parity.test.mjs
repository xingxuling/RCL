import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FOUNDATION_DIRECT_NATIVE_PARITY_FORMAT,
  verifyFoundationDirectLoweringLineage,
  verifyFoundationDomainReceiptParity,
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
    domain: 'perception', declaration: 'vision', directive: 'Observe', directiveIndex: 0,
    syntheticRule: RULE, stateTargets: ['vision.lux'], witness: WITNESS,
    observer: 'agent.eye', sourceReality: 'world.scene', authorityClass: 'observation',
  }];
  return {
    lowered,
    summary: { loweredCount: overrides.loweredCount ?? lowered.length },
    truthBoundary: { directDomains: ['perception'] },
  };
}

function referenceHistory(overrides = {}) {
  return [{
    kind: 'DomainTransition', domainKind: 'perceptual', name: overrides.name ?? 'vision', status: overrides.status ?? 'realized',
    observer: overrides.observer ?? 'agent.eye', sourceReality: overrides.sourceReality ?? 'world.scene',
    authorityClass: overrides.authorityClass ?? 'observation',
    changes: overrides.changes ?? [{ target: 'vision.lux', before: 0, after: 10 }],
  }];
}

function nativeHistory(overrides = {}) {
  return [{
    rule: overrides.rule ?? RULE,
    status: overrides.status ?? 'realized',
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
  referenceReceiptHistory = referenceHistory(),
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
    runReference: async () => ({ state: referenceState, history: referenceReceiptHistory }),
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

test('verified state, native root authority, lowering lineage and domain receipt produce native-verified', async () => {
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
    domainReceipt: true,
  });
  assert.equal(result.lineage.entries[0].ok, true);
  assert.equal(result.domainReceipt.entries[0].ok, true);
  assert.deepEqual(result.gaps, []);
});

test('state divergence fails closed even when native root and receipt evidence pass', async () => {
  const result = await verifyFoundationDirectNativeParity({ name: 'P' }, deps({ nativeState: { 'vision.lux': 11 } }));
  assert.equal(result.status, 'parity-failed');
  assert.equal(result.parity.state, false);
  assert.equal(result.parity.semanticStateRoot, false);
  assert.equal(result.parity.loweringLineage, true);
  assert.equal(result.parity.domainReceipt, true);
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
  assert.equal(result.parity.domainReceipt, true);
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

test('missing matching synthetic native record fails lowering lineage and receipt parity', async () => {
  const result = await verifyFoundationDirectNativeParity({ name: 'P' }, deps({ history: nativeHistory({ rule: 'other-rule' }) }));
  assert.equal(result.status, 'parity-failed');
  assert.equal(result.parity.loweringLineage, false);
  assert.equal(result.parity.domainReceipt, false);
  assert.equal(result.lineage.entries[0].checks.exactNativeRecord, false);
  assert.equal(result.gaps.includes('loweringLineage'), true);
});

test('missing lowering witness fails lineage and domain receipt even when state parity passes', async () => {
  const result = await verifyFoundationDirectNativeParity({ name: 'P' }, deps({ history: nativeHistory({ witnesses: ['other'] }) }));
  assert.equal(result.status, 'parity-failed');
  assert.equal(result.lineage.entries[0].checks.witnessPresent, false);
  assert.equal(result.domainReceipt.entries[0].checks.witnessPresent, false);
});

test('missing lowered state target in native changes fails lineage', async () => {
  const result = await verifyFoundationDirectNativeParity({ name: 'P' }, deps({ history: nativeHistory({ changes: [{ target: 'other.path' }] }) }));
  assert.equal(result.status, 'parity-failed');
  assert.equal(result.lineage.entries[0].checks.stateTargetsCovered, false);
  assert.equal(result.parity.domainReceipt, false);
});

test('declared lowering count must bind exact lowering metadata', () => {
  const report = verifyFoundationDirectLoweringLineage(lowering({ loweredCount: 2 }), nativeHistory());
  assert.equal(report.ok, false);
  assert.equal(report.metadataComplete, false);
});

test('synthetic rule identity must remain unique in the lowering receipt', () => {
  const duplicate = {
    domain: 'perception', declaration: 'vision2', directive: 'Observe', directiveIndex: 1,
    syntheticRule: RULE, stateTargets: ['vision2.lux'], witness: 'rcl:foundation:perception:vision2',
    observer: 'agent.eye2', sourceReality: 'world.scene', authorityClass: 'observation',
  };
  const report = verifyFoundationDirectLoweringLineage(lowering({ lowered: [...lowering().lowered, duplicate] }), nativeHistory());
  assert.equal(report.ok, false);
  assert.equal(report.ruleIdentityUnique, false);
});

test('domain receipt rejects extra native mutation even when lowering lineage subset check passes', async () => {
  const history = nativeHistory({ changes: [
    { target: 'vision.lux', before: 0, after: 10 },
    { target: 'secret.extra', before: 0, after: 1 },
  ] });
  const result = await verifyFoundationDirectNativeParity({ name: 'P' }, deps({ history }));
  assert.equal(result.parity.loweringLineage, true);
  assert.equal(result.parity.domainReceipt, false);
  assert.equal(result.domainReceipt.entries[0].checks.nativeTargetsExact, false);
});

test('domain receipt rejects matching target with divergent transition value', () => {
  const report = verifyFoundationDomainReceiptParity(
    lowering(),
    referenceHistory(),
    nativeHistory({ changes: [{ target: 'vision.lux', before: 0, after: 11 }] }),
    semanticValue,
  );
  assert.equal(report.ok, false);
  assert.equal(report.entries[0].checks.transitionValuesEquivalent, false);
});

test('domain receipt binds reference observation identity and authority class', () => {
  const report = verifyFoundationDomainReceiptParity(
    lowering(),
    referenceHistory({ observer: 'other.eye' }),
    nativeHistory(),
    semanticValue,
  );
  assert.equal(report.ok, false);
  assert.equal(report.entries[0].checks.referenceReceiptAligned, false);
});

test('domain receipt metadata is fail-closed when lowering omits source identity', () => {
  const incomplete = lowering();
  delete incomplete.lowered[0].sourceReality;
  const report = verifyFoundationDomainReceiptParity(incomplete, referenceHistory(), nativeHistory(), semanticValue);
  assert.equal(report.ok, false);
  assert.equal(report.metadataComplete, false);
});

test('domain receipt preserves lowered transaction order in native history', () => {
  const secondRule = '__rcl_foundation_perception_depth_1';
  const secondWitness = 'rcl:foundation:perception:depth';
  const second = {
    domain: 'perception', declaration: 'depth', directive: 'Observe', directiveIndex: 1,
    syntheticRule: secondRule, stateTargets: ['depth.mm'], witness: secondWitness,
    observer: 'agent.depth', sourceReality: 'world.scene', authorityClass: 'observation',
  };
  const directLowering = lowering({ lowered: [...lowering().lowered, second] });
  const references = [
    ...referenceHistory(),
    { kind: 'DomainTransition', domainKind: 'perceptual', name: 'depth', status: 'realized', observer: 'agent.depth', sourceReality: 'world.scene', authorityClass: 'observation', changes: [{ target: 'depth.mm', before: 0, after: 42 }] },
  ];
  const native = [
    { rule: secondRule, status: 'realized', witnesses: [secondWitness], changes: [{ target: 'depth.mm', before: 0, after: 42 }] },
    ...nativeHistory(),
  ];
  const report = verifyFoundationDomainReceiptParity(directLowering, references, native, semanticValue);
  assert.equal(report.ok, false);
  assert.equal(report.nativeOrderPreserved, false);
});

test('receipt comparison normalizes semantic number wrappers', () => {
  const wrapped = nativeHistory({ changes: [{ target: 'vision.lux', before: { kind: 'NumberValue', value: 0 }, after: { kind: 'NumberValue', value: 10 } }] });
  const report = verifyFoundationDomainReceiptParity(lowering(), referenceHistory(), wrapped, semanticValue);
  assert.equal(report.ok, true);
});

test('domain receipt parity is explicit while full history/all-domain claims remain outside boundary', async () => {
  const result = await verifyFoundationDirectNativeParity({ name: 'P' }, deps());
  assert.equal(result.truthBoundary.loweringLineageClaimedOnlyWhenVerified, true);
  assert.equal(result.truthBoundary.domainReceiptParityClaimedOnlyWhenVerified, true);
  assert.equal(result.truthBoundary.fullHistoryParityClaimed, false);
  assert.equal(result.truthBoundary.allFoundationDomainsNativeClaimed, false);
});
