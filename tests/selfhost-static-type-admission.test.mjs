import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileRealityToBytecode, compileRealitySessionBytecode } from '../src/bytecode.mjs';
import { runNativeCompiler, runNativeBytecode } from '../src/native-vm.mjs';

const compiler = fileURLToPath(new URL('../selfhost/compiler.rbc', import.meta.url));
let directory, sessionCompiler;
test.before(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-static-type-admission-'));
  sessionCompiler = path.join(directory, 'session-compiler.rbc');
  const read = name => fs.readFileSync(new URL('../selfhost/' + name, import.meta.url), 'utf8');
  fs.writeFileSync(sessionCompiler, compileRealityToBytecode(read('compiler-core.rcl') + '\n' + read('session-compiler-core.rcl') + '\n' + read('session-compiler-main.rcl')));
});
test.after(() => { if (directory) fs.rmSync(directory, {recursive: true, force: true}); });
function compile(source, artifact = compiler) {
  const input = path.join(directory, 'input.rcl'), output = path.join(directory, 'output.rbc');
  fs.writeFileSync(input, source); return runNativeCompiler(artifact, input, output).bytecode;
}
const invalid = [
  ['arithmetic operands', '1 + true', 'Number', '', 'RCL_TYPE_BINARY'],
  ['logic operands', 'true and 1', 'Truth', '', 'RCL_TYPE_LOGIC'],
  ['not operand', 'not 1', 'Truth', '', 'RCL_TYPE_UNARY'],
  ['minus operand', '-true', 'Number', '', 'RCL_TYPE_UNARY'],
  ['choose condition', 'choose(1, 2, 3)', 'Number', '', 'RCL_TYPE_CHOOSE'],
  ['choose branches', 'choose(true, 1, "x")', 'Number', '', 'RCL_TYPE_CHOOSE'],
  ['builtin argument', 'length(1)', 'Number', '', 'RCL_CALL_TYPE'],
  ['builtin arity', 'starts_with("a")', 'Truth', '', 'RCL_CALL_ARITY'],
  ['builtin index', 'char_at("x", true)', 'Text', '', 'RCL_CALL_TYPE'],
  ['user argument', 'f("x")', 'Number', 'reckon f(x : Number) -> Number = x', 'RCL_CALL_TYPE'],
  ['user body', 'f()', 'Number', 'reckon f() -> Number = true', 'RCL_RECKON_RETURN_TYPE'],
  ['unused user body', '1', 'Number', 'reckon f() -> Number = true', 'RCL_RECKON_RETURN_TYPE'],
  ['inferred facet result', '1 + 2', 'Truth', '', 'RCL_SEMANTIC_TYPE_MISMATCH'],
];
for (const [name, expression, type, reckons, code] of invalid) {
  test(`ordinary native static type admission rejects ${name}`, () => {
    const source = `reality Types { ${reckons} facet value : ${type} = ${expression} }`;
    assert.throws(() => compileRealityToBytecode(source));
    const output = path.join(directory, 'output.rbc'), retained = Buffer.from('retained-static-type-output'); fs.writeFileSync(output, retained);
    assert.throws(() => compile(source), error => {
      assert.equal(error.diagnostic?.code, code, error.message);
      assert.ok(error.diagnostic.span.length > 0); return true;
    });
    assert.deepEqual(fs.readFileSync(output), retained);
  });
}

test('ordinary native typing preserves recursive signatures and dynamic Sequence values', () => {
  for (const source of [
    'reality Valid { reckon f(x : Number) -> Number = choose(x <= 0, 0, f(x - 1) + 1) facet value : Number = f(4) }',
    'reality Valid { reckon even(x : Number) -> Truth = choose(x <= 0, true, odd(x - 1)) reckon odd(x : Number) -> Truth = choose(x <= 0, false, even(x - 1)) facet value : Truth = even(4) }',
    'reality Valid { facet items : Sequence = sequence_append(empty_sequence(), true) facet value : Truth = sequence_get(items, 0) }',
    'reality Valid { facet value : Text = "left" + "right" facet result : Truth = 1 + 2 == 3 }',
  ]) {
    const bytes = compile(source); assert.deepEqual(bytes, compileRealityToBytecode(source));
    assert.equal(runNativeBytecode(bytes).status, 'ok');
  }
});


test('reference/native unary utility calls reject absent and extra arguments', () => {
  for (const [name, type] of [['text', 'Text'], ['length', 'Number'], ['number_from_text', 'Number'], ['lower_text', 'Text'], ['upper_text', 'Text'], ['trim', 'Text']]) {
    for (const args of ['', '"1", "2"']) {
      const source = `reality Arity { facet value : ${type} = ${name}(${args}) }`;
      assert.throws(() => compileRealityToBytecode(source), error => error.diagnostics?.some(item => item.code === 'RCL_CALL_ARITY'));
      const output = path.join(directory, 'output.rbc'), retained = Buffer.from('retained-utility-arity'); fs.writeFileSync(output, retained);
      assert.throws(() => compile(source), error => error.diagnostic?.code === 'RCL_CALL_ARITY');
      assert.deepEqual(fs.readFileSync(output), retained);
    }
  }
});


function ruleSource(kind, when, alteration, preserve, directive = '') {
  return `reality RuleTypes {
    facet state : Number = 0
    facet flags : Sequence = sequence_append(empty_sequence(), true)
    facet numbers : Sequence = sequence_append(empty_sequence(), 1)
    subject actor { warrant state.write on state }
    subject peer {}
    ${kind} update { ${kind === 'emergence' ? 'cause actor' : 'from actor into peer'}
      when ${when} needs state.write on state
      alter state <- ${alteration}
      preserve ${preserve}
    }
    ${directive}
  }`;
}
for (const kind of ['emergence', 'resonance']) {
  test(`${kind} typing rejects invalid conditions, alterations and preserves before output`, () => {
    for (const [when, alteration, preserve, code] of [
      ['1', '1', 'true', 'RCL_RULE_WHEN_TYPE'],
      ['"yes"', '1', 'true', 'RCL_RULE_WHEN_TYPE'],
      ['true and 1', '1', 'true', 'RCL_TYPE_LOGIC'],
      ['true', 'true', 'true', 'RCL_ALTER_TYPE'],
      ['true', 'not 1', 'true', 'RCL_TYPE_UNARY'],
      ['true', 'length(true)', 'true', 'RCL_CALL_TYPE'],
      ['true', '1', '1', 'RCL_PRESERVE_TYPE'],
      ['true', '1', '"yes"', 'RCL_PRESERVE_TYPE'],
      ['true', '1', 'true and 1', 'RCL_TYPE_LOGIC'],
    ]) {
      const source = ruleSource(kind, when, alteration, preserve);
      assert.throws(() => compileRealityToBytecode(source));
      const output = path.join(directory, 'output.rbc'), retained = Buffer.from('retained-rule-type-output'); fs.writeFileSync(output, retained);
      assert.throws(() => compile(source), error => error.diagnostic?.code === code, source);
      assert.deepEqual(fs.readFileSync(output), retained);
    }
  });
}

test('rule typing preserves dynamic values and valid realized or projected bytecode', () => {
  for (const kind of ['emergence', 'resonance']) {
    for (const directive of ['realize update', 'foresee update']) {
      const source = ruleSource(kind, 'sequence_get(flags, 0)', 'sequence_get(numbers, 0)', 'sequence_get(flags, 0)', directive);
      const bytes = compile(source); assert.deepEqual(bytes, compileRealityToBytecode(source));
      const actual = runNativeBytecode(bytes);
      assert.equal(actual.state.state, directive.startsWith('realize') ? 1 : 0);
      assert.equal(actual[directive.startsWith('realize') ? 'history' : 'projections'].length, 1);
    }
  }
});


test('direct session compiler reuses rule expression type admission', () => {
  for (const kind of ['emergence', 'resonance']) {
    for (const [when, alteration, preserve, code] of [
      ['1', '1', 'true', 'RCL_RULE_WHEN_TYPE'],
      ['true', 'true', 'true', 'RCL_ALTER_TYPE'],
      ['true', '1', '1', 'RCL_PRESERVE_TYPE'],
    ]) {
      const source = ruleSource(kind, when, alteration, preserve);
      assert.throws(() => compileRealitySessionBytecode(source));
      const output = path.join(directory, 'output.rbc'), retained = Buffer.from('retained-session-types'); fs.writeFileSync(output, retained);
      assert.throws(() => compile(source, sessionCompiler), error => error.diagnostic?.code === code);
      assert.deepEqual(fs.readFileSync(output), retained);
    }
    const source = ruleSource(kind, 'sequence_get(flags, 0)', 'sequence_get(numbers, 0)', 'sequence_get(flags, 0)');
    assert.deepEqual(compile(source, sessionCompiler), compileRealitySessionBytecode(source));
  }
});
