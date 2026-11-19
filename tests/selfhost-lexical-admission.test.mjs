import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileRealityToBytecode } from '../src/bytecode.mjs';
import { runReality } from '../src/runtime.mjs';
import { runNativeCompiler, runNativeBytecode } from '../src/native-vm.mjs';
const compiler = process.env.RCL_TEST_GENERAL_COMPILER_ARTIFACT ?? fileURLToPath(new URL('../selfhost/compiler.rbc', import.meta.url));
let directory;
test.before(() => { directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-lexical-admission-')); });
test.after(() => { if (directory) fs.rmSync(directory, { recursive: true, force: true }); });
function native(source) {
  const input = path.join(directory, 'source.rcl'), output = path.join(directory, 'target.rbc');
  fs.writeFileSync(input, source); runNativeCompiler(compiler, input, output);
  return fs.readFileSync(output);
}
test('leading-dot decimal literals preserve reference bytecode and native numeric values', () => {
  for (const [literal, value] of [['.5', .5], ['.050', .05], ['-.5', -.5], ['1.', 1], ['0.5', .5]]) {
    const source = `reality Decimal { facet value : Number = ${literal} }`, bytes = native(source);
    assert.deepEqual(bytes, compileRealityToBytecode(source), literal);
    assert.equal(runNativeBytecode(bytes).state.value, value, literal);
  }
});
test('leading-dot decimals work in function bodies, calls and UI layout metadata', () => {
  for (const source of [
    'reality Decimal { reckon half(x : Number) -> Number = x * .5 facet value : Number = half(.25) }',
    'reality Decimal { ui App { view Root { layout vertical { gap .5 width fixed .25 } } } }',
  ]) assert.deepEqual(native(source), compileRealityToBytecode(source));
});
test('malformed decimal punctuation rejects without replacing output', () => {
  for (const literal of ['..5', '1.2.3', '.']) {
    const source = `reality Decimal { facet value : Number = ${literal} }`;
    assert.throws(() => compileRealityToBytecode(source));
    const output = path.join(directory, 'target.rbc'), retained = Buffer.from('retained-decimal-output'); fs.writeFileSync(output, retained);
    assert.throws(() => native(source)); assert.deepEqual(fs.readFileSync(output), retained);
  }
});


test('diagnostic coordinates remain correct after leading-dot decimals', () => {
  for (const newline of ['\n', '\r\n']) {
    const source = ['reality Decimal {', '  facet value : Number = .5 + missing', '}'].join(newline);
    assert.throws(() => compileRealityToBytecode(source));
    const output = path.join(directory, 'target.rbc'), retained = Buffer.from('retained-decimal-diagnostic'); fs.writeFileSync(output, retained);
    assert.throws(() => native(source), error => /RCL_SEMANTIC_UNKNOWN_PATH/.test(error.message) && error.message.endsWith(' at 2:31'));
    assert.deepEqual(fs.readFileSync(output), retained);
  }
});


test('native whitespace predicate agrees with reference Unicode and single-character semantics', async () => {
  const values = [9, 10, 11, 12, 13, 32, 160, 5760, ...Array.from({length: 11}, (_, i) => 8192 + i), 8232, 8233, 8239, 8287, 12288, 65279, 133, 6158, 8203, 8288].map(value => String.fromCodePoint(value));
  values.push('', '  ', ' a', 'a ', '😀');
  const literal = value => '"' + value.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('\n', '\\n').replaceAll('\r', '\\r').replaceAll('\t', '\\t') + '"';
  const source = 'reality Whitespace {\n' + [
    ...values.map((value, i) => `facet w${i} : Truth = is_whitespace(${literal(value)})`),
    ...values.filter(value => /^\s$/u.test(value)).flatMap((value, i) => [`facet s${i} : Truth = is_identifier_start(${literal(value)})`, `facet p${i} : Truth = is_identifier_part(${literal(value)})`]),
  ].join('\n') + '\n}';
  const reference = await runReality(source), actual = runNativeBytecode(compileRealityToBytecode(source));
  for (let i = 0; i < values.length; i++) assert.equal(actual.state[`w${i}`], reference.state[`w${i}`], JSON.stringify(values[i]));
  assert.deepEqual(actual.state, reference.state);
});
test('native source tokenizer admits BOM and Unicode whitespace accepted by reference', () => {
  for (const whitespace of ['\ufeff', '\u00a0', '\u2003', '\u2028', '\u3000']) {
    const source = `${whitespace}reality${whitespace}Whitespace${whitespace}{${whitespace}facet value : Number = 1${whitespace}}`;
    assert.deepEqual(native(source), compileRealityToBytecode(source), JSON.stringify(whitespace));
  }
});


test('character predicates require one scalar and distinguish letters, numbers and punctuation', async () => {
  const values = ['A', '_', '0', '中', 'é', 'Ω', '١', 'Ⅷ', '²', '𐐀', '𝟘', '😀', '。', '—', '́', '‍', '\u0085', '', 'abc', '12', '中a', 'a\n'];
  const source = 'reality Characters {' + values.flatMap((value, i) => ['is_digit', 'is_identifier_start', 'is_identifier_part'].map((name, j) => 'facet c' + i + '_' + j + ' : Truth = ' + name + '(' + JSON.stringify(value) + ')')).join('\n') + '}';
  assert.deepEqual(runNativeBytecode(compileRealityToBytecode(source)).state, (await runReality(source)).state);
});

test('source rejects punctuation, emoji and combining marks in identifier positions', () => {
  for (const name of ['😀', '。', '—', 'a😀', 'a。', 'á', 'a‍', '𐐀', 'a𐐀']) {
    const source = 'reality Invalid { facet ' + name + ' : Number = 1 }';
    assert.throws(() => compileRealityToBytecode(source), name);
    const output = path.join(directory, 'target.rbc'), retained = Buffer.from('retained-character-output'); fs.writeFileSync(output, retained);
    assert.throws(() => native(source), name); assert.deepEqual(fs.readFileSync(output), retained, name);
  }
});


test('BMP identifier categories preserve native bytecode and executed user state', () => {
  for (const name of ['世界', 'é', 'Ω', '_value', 'a١', 'aⅧ', 'a²']) {
    const source = 'reality Names { facet ' + name + ' : Number = 7 }';
    const bytes = native(source);
    assert.deepEqual(bytes, compileRealityToBytecode(source), name);
    assert.equal(runNativeBytecode(bytes).state[name], 7, name);
  }
});


test('EOF diagnostics count supplementary text in hash and slash comments as UTF-16', () => {
  for (const comment of ['# 😀𐐀', '// 🦊舟', '# text 😀\r', '// 😀\u2028𐐀']) {
    for (const prefix of ['reality Comment { ', 'reality Comment {\n  ', 'reality Comment {\r\n  ']) {
      const source = prefix + comment, lines = source.split('\n');
      const expected = lines.length + ':' + (lines.at(-1).length + 1);
      assert.throws(() => compileRealityToBytecode(source));
      const output = path.join(directory, 'target.rbc'), retained = Buffer.from('retained-comment-eof'); fs.writeFileSync(output, retained);
      assert.throws(() => native(source), error => error.message.endsWith(' at ' + expected), JSON.stringify(source));
      assert.deepEqual(fs.readFileSync(output), retained);
    }
  }
});
