import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RCL_SEMANTIC_STATE_ROOT_V2,
  semanticStateCanonicalV2Stable,
  semanticStateRootV2Stable,
} from '../src/semantic-state-root-v2.mjs';
import { verifyNativeSemanticStateRoot, semanticStateRoot } from '../src/semantic-state-root.mjs';
import { runRealityNative, runNativeBytecode, verifyNativeParity } from '../src/native-vm.mjs';
import { assembleLiteralProgram } from '../src/bytecode.mjs';
import { compileReality } from '../src/compiler.mjs';
import { compileTypedModuleGraph } from '../src/type-module-kernel.mjs';
import { runReality } from '../src/runtime.mjs';
import { compileTypedRealityToBytecodeLayout } from '../src/typed-bytecode-layout.mjs';

const options = { stateRootAlgorithm: RCL_SEMANTIC_STATE_ROOT_V2, requireNativeStateRoot: true };

test('v2 uses injective type tags and does not collide with the legacy candidate number wrapper', () => {
  const values = [1, '1', true, null, { $rclF64: '3ff0000000000000' }, ['number', '3ff0000000000000']];
  assert.equal(new Set(values.map(semanticStateRootV2Stable)).size, values.length);
  assert.equal(semanticStateCanonicalV2Stable(1), '["number","3ff0000000000000"]');
  assert.equal(semanticStateRootV2Stable(-0), semanticStateRootV2Stable(0));
  assert.notEqual(semanticStateRootV2Stable(9007199254740990), semanticStateRootV2Stable(9007199254740991));
});

test('v2 orders UTF-8 record fields explicitly, including numeric and supplementary keys', () => {
  const a = { '2': 2, '10': 10, '\u{10000}': 'outside BMP', '\ue000': 'BMP' };
  const b = { '\ue000': 'BMP', '\u{10000}': 'outside BMP', '10': 10, '2': 2 };
  assert.equal(semanticStateRootV2Stable(a), semanticStateRootV2Stable(b));
  const encoded = JSON.parse(semanticStateCanonicalV2Stable(a));
  assert.deepEqual(encoded[1].map(([key]) => key), ['10', '2', '\ue000', '\u{10000}']);
});

test('v2 retains semantic normalization and excludes native layout metadata', () => {
  assert.notEqual(semanticStateRootV2Stable({ value: 1 }), semanticStateRootV2Stable({ value: 1, __rclObjectId: 33 }));
  const semantic = { actor: { value: 1 } };
  const native = { actor: { __rclKind: 'Record', __rclType: 'Actor', __rclObjectId: 33, __rclFieldOffsets: { value: 0 }, value: 1 } };
  assert.equal(semanticStateRootV2Stable(semantic), semanticStateRootV2Stable(native));
  assert.notEqual(semanticStateRootV2Stable({ actor: { value: 1, __rclObjectId: 33 } }), semanticStateRootV2Stable({ actor: { value: 1, __rclObjectId: 34 } }));
  assert.equal(semanticStateRootV2Stable({ intent: { kind: 'Intent', slots: ['v', 1] } }), semanticStateRootV2Stable({ intent: { kind: 'Intent', slots: { v: 1 } } }));
  assert.notEqual(semanticStateRootV2Stable({ __rclRefObjectId: 1 }), semanticStateRootV2Stable({ __rclRefObjectId: 2 }));
  assert.throws(() => semanticStateRootV2Stable({ intent: { kind: 'Intent', slots: ['v', 1, 'v', 2] } }), /DUPLICATE_SLOT/);
});

test('native v2 binds user facets named after heap metadata and rejects their tampering', () => {
  for (const field of ['__rclKind', '__rclType', '__rclObjectId', '__rclFieldOffsets', '__rclPayloadOffsets']) {
    const result = runRealityNative('reality UserMetadata { facet ' + field + ' : Number = 1 }', options);
    assert.equal(result.stateRootParity, true, field);
    assert.throws(() => verifyNativeSemanticStateRoot({ ...result, state: { ...result.state, [field]: 2 } }), /does not match/);
  }
});

test('outer facets named kind and slots remain semantic values rather than an Intent envelope', async () => {
  const source = 'reality FacetNames { reckon pairs()->Sequence=sequence_append(sequence_append(empty_sequence(),"v"),1) facet kind:Text="Intent" facet slots:Sequence=pairs() }';
  const result = await verifyNativeParity(source);
  assert.equal(result.ok, true);
  assert.deepEqual(result.native.state.slots, ['v', 1]);
  assert.notEqual(semanticStateRootV2Stable({ kind: 'Intent', slots: ['v', 1] }), semanticStateRootV2Stable({ kind: 'Intent', slots: { v: 1 } }));
});

test('typed record layout names fail closed in module declarations and untrusted bytecode', () => {
  for (const name of ['__rclKind', '__rclType', '__rclObjectId', '__rclFieldOffsets', '__rclPayloadOffsets', '__rclRecord', '__rclUnion']) {
    const typed = compileTypedModuleGraph({ 'probe.rcltype': 'module probe\nexport record Probe {\n' + name + ': Number\n}' });
    assert.equal(typed.ok, false);
    assert.ok(typed.diagnostics.some(d => d.code === 'RCL_RECORD_FIELD_RESERVED'));
    const raw = structuredClone(compileReality('reality RawLayoutProbe { facet value : Number = 1 }'));
    raw.facets[0].value = { kind: 'RecordConstructExpr', canonicalType: 'Probe', fields: [{ name, value: { kind: 'LiteralExpr', valueType: 'Number', value: 1 } }] };
    assert.throws(() => runRealityNative(raw, options), e => e.code === 'RCL_RECORD_FIELD_RESERVED');
  }
});

test('native/reference v2 retains prototype-named facets and typed semantic fields', async () => {
  const parity = await verifyNativeParity('reality PrototypeName { facet __proto__ : Number = 1 }');
  assert.equal(parity.ok, true);
  assert.equal(Object.hasOwn(parity.reference.state, '__proto__'), true);
  const source = 'reality TypedValue { facet value : probe.Probe = { __proto__: 7, other: 9007199254740991 } }';
  const compilerOptions = { typeModuleSources: { 'probe.rcltype': 'module probe\nexport record Probe {\n__proto__: Number\nother: Number\n}' } };
  const typed = compileTypedRealityToBytecodeLayout(source, compilerOptions);
  assert.equal(typed.ok, true);
  const native = runNativeBytecode(typed.bytecode, options);
  const reference = await runReality(compileReality(source, compilerOptions), options);
  assert.equal(Object.hasOwn(reference.state.value, '__proto__'), true);
  assert.equal(native.stateRoot, reference.stateRoot);
});

test('native Text preserves admitted Unicode and controls and rejects lossy pool encoding', () => {
  for (const value of ['a\b\f\n\t\rb', '中😀é', '\u2028\u2029', '\u{10ffff}']) {
    const result = runNativeBytecode(assembleLiteralProgram({ path: 'text', value }), options);
    assert.equal(result.state.text, value);
    assert.equal(result.stateRoot, semanticStateRootV2Stable({ text: value }));
  }
  assert.throws(() => assembleLiteralProgram({ path: 'text', value: '\ud800' }), /SCALAR_REQUIRED/);
  assert.throws(() => assembleLiteralProgram({ path: 'text', value: 'a\0b' }), /NUL_UNSUPPORTED/);
  for (const [byte, code] of [[0, 'RCL_NATIVE_TEXT_NUL_UNSUPPORTED'], [255, 'RCL_NATIVE_TEXT_UTF8_REQUIRED']]) {
    const corrupted = Buffer.from(assembleLiteralProgram({ path: 'text', value: 'abc' }));
    const offset = corrupted.indexOf(Buffer.from('abc'));
    assert.ok(offset >= 0);
    corrupted[offset + 1] = byte;
    assert.throws(() => runNativeBytecode(corrupted, options), e => e.message.includes(code));
  }
});

test('native v2 applies the same semantic Intent slot normalization and rejects duplicate slots', async () => {
  const source = 'reality IntentValue { reckon slots()->Sequence = sequence_append(sequence_append(empty_sequence(),"v"),1) facet value:probe.IntentValue={kind:"Intent",slots:slots()} }';
  const compilerOptions = { typeModuleSources: { 'probe.rcltype': 'module probe\nexport record IntentValue {\nkind:Text\nslots:Sequence\n}' } };
  const typed = compileTypedRealityToBytecodeLayout(source, compilerOptions);
  assert.equal(typed.ok, true);
  const native = runNativeBytecode(typed.bytecode, options);
  const reference = await runReality(compileReality(source, compilerOptions), options);
  assert.equal(native.stateRoot, reference.stateRoot);
  const duplicate = source.replace('sequence_append(sequence_append(empty_sequence(),"v"),1)', 'sequence_concat(sequence_append(sequence_append(empty_sequence(),"v"),1),sequence_append(sequence_append(empty_sequence(),"v"),2))');
  const rejected = compileTypedRealityToBytecodeLayout(duplicate, compilerOptions);
  assert.equal(rejected.ok, true);
  assert.throws(() => runNativeBytecode(rejected.bytecode, options), e => e.code === 'RCL_NATIVE_STATE_ROOT_V2_INVALID');
});

test('v2 rejects values without an unambiguous inert JSON representation', () => {
  const cycle = {}; cycle.next = cycle;
  for (const value of [NaN, Infinity, -Infinity, undefined, 1n, new Date(), cycle, [, 1], '\ud800']) {
    assert.throws(() => semanticStateRootV2Stable(value));
  }
  let getterCalls = 0;
  const slots = [];
  Object.defineProperty(slots, '0', { enumerable: true, get() { getterCalls++; return 'v'; } });
  slots[1] = 1;
  assert.throws(() => semanticStateRootV2Stable({ intent: { kind: 'Intent', slots } }), /ACCESSOR/);
  assert.equal(getterCalls, 0);
  const symbolSlots = ['v', 1];
  symbolSlots[Symbol('hidden')] = 2;
  assert.throws(() => semanticStateRootV2Stable({ intent: { kind: 'Intent', slots: symbolSlots } }), /SYMBOL_KEY/);
  const extendedSlots = ['v', 1];
  extendedSlots.extra = 2;
  assert.throws(() => semanticStateRootV2Stable({ intent: { kind: 'Intent', slots: extendedSlots } }), /SEQUENCE_PROPERTY/);
});

test('v1 and v2 evidence stay separate and requested algorithms cannot be downgraded', () => {
  const state = { value: 0.1 };
  const v1 = { state, stateRootAlgorithm: 'rcl.semantic-state-root.v1', stateRoot: semanticStateRoot(state) };
  const v2 = { state, stateRootAlgorithm: RCL_SEMANTIC_STATE_ROOT_V2, stateRoot: semanticStateRootV2Stable(state) };
  assert.equal(verifyNativeSemanticStateRoot(v1).stateRootVerified, true);
  assert.equal(verifyNativeSemanticStateRoot(v2, { expectedAlgorithm: RCL_SEMANTIC_STATE_ROOT_V2 }).stateRootVerified, true);
  assert.throws(() => verifyNativeSemanticStateRoot(v1, { expectedAlgorithm: RCL_SEMANTIC_STATE_ROOT_V2 }), /requested/);
  for (const payload of [v1, v2]) assert.throws(() => verifyNativeSemanticStateRoot({ ...payload, stateRoot: '0'.repeat(64) }), /does not match/);
  assert.throws(() => verifyNativeSemanticStateRoot({ stateRootAlgorithm: RCL_SEMANTIC_STATE_ROOT_V2, stateRoot: v2.stateRoot }), /explicit object/);
});

test('rebuilt native VM passes the frozen ten-case finite Number corpus with exact public JSON', () => {
  const literals = ['0', '-0', '0.1', '0.30000000000000004', '1.23456789012345', '1.2345678901234567',
    '9007199254740991', '9007199254740990', '1234567890123456', '0.000000000000001'];
  for (const literal of literals) {
    const result = runRealityNative('reality NumberV2 { facet value : Number = ' + literal + ' }', options);
    assert.equal(result.state.value, Number(literal) === 0 ? 0 : Number(literal), literal);
    assert.equal(result.stateRootParity, true, literal);
    assert.equal(result.stateRootAlgorithm, RCL_SEMANTIC_STATE_ROOT_V2, literal);
  }
  const historical = runRealityNative('reality OldRoot { facet value : Number = 0.1 }', { stateRootAlgorithm: 'rcl.semantic-state-root.v1' });
  assert.equal(historical.stateRootAlgorithm, 'rcl.semantic-state-root.v1');
});

test('native v2 and JS match a seeded finite binary64 corpus including subnormal and extreme numbers', () => {
  const values = [Number.MIN_VALUE, Number.MAX_VALUE, Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, -0, 0, 1e-308, 1e308];
  let state = 0x1e20c3a5n;
  const mask = (1n << 64n) - 1n;
  while (values.length < 136) {
    state ^= state << 13n; state &= mask; state ^= state >> 7n; state ^= state << 17n; state &= mask;
    const bytes = Buffer.alloc(8); bytes.writeBigUInt64BE(state);
    const value = bytes.readDoubleBE();
    if (Number.isFinite(value)) values.push(value);
  }
  for (const value of values) {
    const result = runNativeBytecode(assembleLiteralProgram({ path: 'value', value }), options);
    assert.equal(result.state.value, value === 0 ? 0 : value);
    assert.equal(result.nativeStateRoot, semanticStateRootV2Stable({ value }));
  }
});

test('native v2 roots nested semantic sequences and typed compiler values', () => {
  const source = [
    'reality StructuredV2 {',
    'reckon pair() -> Sequence = sequence_append(sequence_append(empty_sequence(), 0.1), 9007199254740991)',
    'facet values : Sequence = pair()',
    'facet ratio : Number = 0.00000001',
    '}',
  ].join('\n');
  const result = runRealityNative(source, options);
  assert.deepEqual(result.state.values, [0.1, 9007199254740991]);
  assert.equal(result.nativeStateRoot, semanticStateRootV2Stable(result.state));
  const astResult = runRealityNative('reality AstV2 { facet tree : AstNode = facet_ast("value", "Number", "Number", "9007199254740991", make_span(0, 1, 1, 5)) }', options);
  assert.equal(astResult.nativeStateRoot, semanticStateRootV2Stable(astResult.state));
});

test('native v2 fails closed on nonfinite state and unsupported algorithm selection', () => {
  for (const value of [Infinity, -Infinity, NaN]) {
    assert.throws(() => runNativeBytecode(assembleLiteralProgram({ path: 'value', value }), options),
      error => error.code === 'RCL_NATIVE_STATE_ROOT_V2_INVALID');
  }
  assert.throws(() => runRealityNative('reality Unsupported { facet value : Number = 1 }', { env: { RCL_SEMANTIC_STATE_ROOT_ALGORITHM: 'unknown' } }),
    error => error.code === 'RCL_NATIVE_STATE_ROOT_ALGORITHM_MISMATCH');
});

test('reference/native parity uses the explicitly negotiated final-state algorithm', async () => {
  const result = await verifyNativeParity('reality ParityV2 { facet value : Number = 9007199254740991 }', { nativeRuntime: options });
  assert.equal(result.ok, true);
  assert.equal(result.nativeAuthority.algorithm, RCL_SEMANTIC_STATE_ROOT_V2);
});

test('native default v2 includes finite Number precision and versioned transition roots', async () => {
  const source = [
    'reality TransactionV2 {',
    'facet value : Number = 9007199254740990',
    'subject operator { warrant world.write on value }',
    'emergence next {',
    'cause operator',
    'when true',
    'needs world.write on value',
    'alter value <- value + 1',
    'preserve value <= 9007199254740991',
    'witness "numeric-v2"',
    '}',
    'foresee next',
    'realize next',
    '}',
  ].join('\n');
  const parity = await verifyNativeParity(source);
  assert.equal(parity.ok, true);
  assert.equal(parity.native.stateRootAlgorithm, RCL_SEMANTIC_STATE_ROOT_V2);
  for (const record of [...parity.native.history, ...parity.native.projections]) {
    assert.equal(record.stateRootAlgorithm, RCL_SEMANTIC_STATE_ROOT_V2);
    assert.equal(record.beforeRoot, semanticStateRootV2Stable({ value: 9007199254740990 }));
    assert.equal(record.afterRoot, semanticStateRootV2Stable({ value: 9007199254740991 }));
    assert.notEqual(record.beforeRoot, record.afterRoot);
  }
  const tampered = structuredClone(parity.native);
  tampered.history[0].stateRootAlgorithm = 'rcl.semantic-state-root.v1';
  assert.throws(() => verifyNativeSemanticStateRoot(tampered), e => e.code === 'RCL_NATIVE_TRANSITION_ROOT_ALGORITHM_MISMATCH');
});
