import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyNativeParity } from '../src/native-vm.mjs';
import { applyBinary } from '../src/quantity.mjs';
import { span, symbolValue, semanticFacet, irStore } from '../src/compiler-primitives.mjs';

const s = 'make_span(0, 2, 3, 4)';
const constructors = [
  ['Symbol', `make_symbol("a", "Number", 0, ${s})`, `make_symbol("b", "Number", 0, ${s})`],
  ['SemanticNode', `make_semantic_facet("a", "Number", "Number", "01", 0, ${s})`, `make_semantic_facet("a", "Number", "Number", "1", 0, ${s})`],
  ['IrNode', `make_ir_store("store", "a", "Number", "Number", "1", 0, ${s})`, `make_ir_store("load", "a", "Number", "Number", "1", 0, ${s})`],
  ['ParseState', 'make_parse_state(0, sequence_append(empty_sequence(), 1))', 'make_parse_state(1, sequence_append(empty_sequence(), 1))'],
];
for (const [type, value, different] of constructors) {
  test(`${type} equality agrees with native for independent and nested values`, async () => {
    const result = await verifyNativeParity(`reality CompilerValues {
      facet same : Truth = ${value} == ${value}
      facet different : Truth = ${value} != ${different}
      facet nested : Truth = sequence_append(empty_sequence(), ${value}) == sequence_append(empty_sequence(), ${value})
    }`, { nativeRuntime: { stateRootAlgorithm: 'rcl.semantic-state-root.v2' } });
    assert.deepEqual([result.reference.state.same, result.reference.state.different, result.reference.state.nested], [true, true, true]);
    assert.equal(result.ok, true, JSON.stringify(result.parity));
  });
}

test('compiler value comparison includes every native field and source span', () => {
  const a = span(0, 1, 1, 1), b = span(0, 1, 2, 1);
  for (const [make, args] of [
    [symbolValue, ['x', 'Number', 1, a]],
    [semanticFacet, ['x', 'Number', 'Number', '01', 1, a]],
    [irStore, ['store', 'x', 'Number', 'Number', '01', 1, a]],
  ]) {
    const value = make(...args);
    assert.equal(applyBinary('==', value, make(...args)), true);
    for (let i = 0; i < args.length; i++) {
      const changed = [...args];
      changed[i] = i === args.length - 1 ? b : typeof args[i] === 'number' ? args[i] + 1 : args[i] + '!';
      assert.equal(applyBinary('!=', value, make(...changed)), true, `field ${i}`);
    }
  }
  assert.equal(applyBinary('==', symbolValue('x', 'Number', 1, a), { kind: 'Unknown', path: 'x' }), false);
});
