import test from 'node:test';
import assert from 'node:assert/strict';
import { compileRealityToBytecode } from '../src/bytecode.mjs';
import { runNativeBytecode, verifyNativeParity } from '../src/native-vm.mjs';
import { compileTypedGcSnapshot } from '../src/typed-gc-snapshot.mjs';

const nativeOptions = { ...(process.env.RCL_TEST_SEQUENCE_VM ? { vmPath: process.env.RCL_TEST_SEQUENCE_VM } : {}), timeout: 30000 };
const run = source => runNativeBytecode(compileRealityToBytecode(source), { ...nativeOptions, stateRootAlgorithm: 'rcl.semantic-state-root.v2' });

test('persistent concatenation preserves aliases, empty operands and append snapshots under both root algorithms', async () => {
  const source = `reality Aliases {
    facet seed : Sequence = sequence_append(empty_sequence(), "🦊")
    facet paired : Sequence = sequence_concat(seed, seed)
    facet appended : Sequence = sequence_append(paired, true)
    facet emptyLeft : Sequence = sequence_concat(empty_sequence(), paired)
    facet emptyRight : Sequence = sequence_concat(paired, empty_sequence())
    facet mixed : Sequence = sequence_concat(appended, sequence_append(empty_sequence(), 7))
  }`;
  for (const algorithm of ['rcl.semantic-state-root.v1', 'rcl.semantic-state-root.v2']) {
    const result = await verifyNativeParity(source, { nativeRuntime: { ...nativeOptions, stateRootAlgorithm: algorithm } });
    assert.equal(result.ok, true, JSON.stringify(result.parity));
    assert.deepEqual(result.native.state.seed, ['🦊']);
    assert.deepEqual(result.native.state.paired, ['🦊', '🦊']);
    assert.deepEqual(result.native.state.mixed, ['🦊', '🦊', true, 7]);
  }
});

test('mixed structural branches and nested sequences preserve left-to-right order', async () => {
  const source = `reality Branches {
    facet a : Sequence = sequence_append(sequence_append(empty_sequence(), 1), 2)
    facet b : Sequence = sequence_concat(a, sequence_append(empty_sequence(), 3))
    facet c : Sequence = sequence_append(sequence_concat(b, a), b)
    facet d : Sequence = sequence_concat(c, sequence_concat(a, b))
    facet equal : Truth = sequence_concat(a, a) == sequence_concat(a, a)
  }`;
  // Preserve the native value-equality contract. The pre-existing reference
  // identity-comparison discrepancy is recorded separately from storage parity.
  assert.equal(run(source).state.equal, true);
  const ordered = source.replace('facet equal : Truth = sequence_concat(a, a) == sequence_concat(a, a)', '');
  const result = await verifyNativeParity(ordered, { nativeRuntime: { ...nativeOptions, stateRootAlgorithm: 'rcl.semantic-state-root.v2' } });
  assert.equal(result.ok, true, JSON.stringify(result.parity));
  assert.deepEqual(result.native.state.d, [1, 2, 3, 1, 2, [1, 2, 3], 1, 2, 1, 2, 3]);
});

test('span/token values remain independently owned when shared branches materialize', async () => {
  const source = `reality StructuredValues {
    facet position : Span = make_span(0, 2, 3, 4)
    facet token : Token = make_token("IDENT", "field", position)
    facet values : Sequence = sequence_append(sequence_append(empty_sequence(), position), token)
    facet twice : Sequence = sequence_concat(values, values)
    facet line : Number = span_line(sequence_get(twice, 0))
    facet label : Text = token_text(sequence_get(twice, 3))
  }`;
  const result = await verifyNativeParity(source, { nativeRuntime: { ...nativeOptions, stateRootAlgorithm: 'rcl.semantic-state-root.v2' } });
  assert.equal(result.ok, true, JSON.stringify(result.parity));
  assert.equal(result.native.state.line, 2); assert.equal(result.native.state.label, 'field');
});

test('typed record and reference values inside concatenation retain heap identity and reachability', () => {
  const result = compileTypedGcSnapshot(`reality RopeTypedRoots {
    facet user : core.User<Text> = { id: "rope", payload: "owned" }
    facet references : Sequence = sequence_concat(sequence_append(empty_sequence(), typed_ref(user)), sequence_append(empty_sequence(), user))
    facet count : Number = length(references)
  }`, { nativeRuntime: nativeOptions });
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  assert.equal(result.native.state.count, 2);
  const [reference, record] = result.native.state.references;
  assert.equal(reference.__rclRefObjectId, record.__rclObjectId);
  assert.equal(record.__rclObjectId, result.native.state.user.__rclObjectId);
  assert.equal(record.payload, 'owned');
  assert.equal(result.report.persistence.allReferencesResolved, true);
  assert.deepEqual(result.report.markSweep.markedObjectIds, [record.__rclObjectId]);
  assert.deepEqual(result.report.markSweep.reclaimableObjectIds, []);
});

test('a deep left concatenation chain materializes once without changing ordered values', () => {
  const size = 20000;
  const result = run(`reality LeftChain {
    reckon build(index : Number, values : Sequence) -> Sequence = choose(index == ${size}, values,
      build(index + 1, sequence_concat(values, sequence_append(empty_sequence(), index))))
    facet values : Sequence = build(0, empty_sequence())
  }`);
  assert.deepEqual(result.state.values, Array.from({ length: size }, (_, index) => index));
});

test('unmaterialized left and right chains release without recursive native stack growth', () => {
  const result = run(`reality ReleaseChains {
    reckon left(index : Number, values : Sequence) -> Number = choose(index == 100000, length(values),
      left(index + 1, sequence_concat(values, sequence_append(empty_sequence(), index))))
    reckon right(index : Number, values : Sequence) -> Number = choose(index == 100000, length(values),
      right(index + 1, sequence_concat(sequence_append(empty_sequence(), index), values)))
    facet leftCount : Number = left(0, empty_sequence())
    facet rightCount : Number = right(0, empty_sequence())
  }`);
  assert.equal(result.state.leftCount, 100000); assert.equal(result.state.rightCount, 100000);
});

test('shared logical branches support length-only operations without dense expansion', () => {
  const result = run(`reality SharedLength {
    reckon count(values : Sequence, remaining : Number) -> Number = choose(remaining == 0, length(values),
      count(sequence_concat(values, values), remaining - 1))
    facet count : Number = count(sequence_append(empty_sequence(), 1), 40)
  }`);
  assert.equal(result.state.count, 2 ** 40);
});

test('unrepresentable sequence sizes reject before dense allocation', () => {
  assert.throws(() => run(`reality Overflow {
    reckon grow(values : Sequence, remaining : Number) -> Number = choose(remaining == 0, length(values),
      grow(sequence_concat(values, values), remaining - 1))
    facet count : Number = grow(sequence_append(empty_sequence(), 1), 64)
  }`), error => error.code === 'RCL_NATIVE_OOM');
});

test('VM failure releases shared unmaterialized arguments and a later process stays usable', () => {
  assert.throws(() => run(`reality CleanupFailure {
    reckon fail(values : Sequence, remaining : Number) -> Number = choose(remaining == 0, 1 / 0,
      fail(sequence_concat(values, values), remaining - 1))
    facet count : Number = fail(sequence_append(empty_sequence(), 1), 40)
  }`), error => error.code === 'RCL_NATIVE_DIVIDE_ZERO');
  assert.deepEqual(run('reality AfterFailure { facet values : Sequence = sequence_concat(sequence_append(empty_sequence(), 1), sequence_append(empty_sequence(), 2)) }').state.values, [1, 2]);
});
