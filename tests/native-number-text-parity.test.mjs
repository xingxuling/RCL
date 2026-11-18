import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { compileRealityToBytecode } from '../src/bytecode.mjs';
import { runReality } from '../src/runtime.mjs';
import { runNativeBytecode, runNativeCompiler } from '../src/native-vm.mjs';
import { compileRealitySessionNative } from '../src/session-compiler.mjs';
import { getTokenSourceRange, lexReality } from '../src/lexer.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const COMPILER_RBC = path.join(ROOT, 'selfhost', 'compiler.rbc');

const DECIMAL_CASES = [
  '0.20413929516019372',
  '0.5818731081470214',
  '0.36543156563841334',
  '0.03270909958610245',
  '0.000001',
  '0.0000001',
  '100000000000000000000',
  '1000000000000000000000',
  '0.5000',
  '00012.34000',
  '-0',
  '5e-324',
  '1e-324',
  '-1e-324',
  '2.225073858507201e-308',
  '\u2003+1.5\ufeff',
  '\u00a0\u2028',
  '0b101',
  '0O77',
  '0x20000000000001',
  '0x20000000000003',
  '0b1' + '0'.repeat(52) + '101',
  '0o4' + '0'.repeat(17) + '3',
  '0x' + 'f'.repeat(13) + '8' + '0'.repeat(242),
];

function runtimeSource() {
  const facets = DECIMAL_CASES.map((value, index) =>
    `  facet value_${index} : Text = text(number_from_text(${JSON.stringify(value)}))`
  ).join('\n');
  return `reality NativeNumberTextParity {\n${facets}\n}\n`;
}

function compilerSource() {
  return `reality SelfHostLongDecimalParity {\n`
    + `  facet w0 : Number = 0.20413929516019372\n`
    + `  facet w1 : Number = 0.5818731081470214\n`
    + `  facet w2 : Number = 0.36543156563841334\n`
    + `  facet w3 : Number = 0.03270909958610245\n`
    + `  facet small_fixed : Number = 0.000001\n`
    + `  facet small_scientific_threshold : Number = 0.0000001\n`
    + `  facet redundant_decimal : Number = 0.5000\n`
    + `  facet subnormal : Number = 0.${'0'.repeat(323)}5\n`
    + `  facet rounds_to_zero : Number = 0.${'0'.repeat(323)}1\n`
    + `}\n`;
}

test('native text(Number) exactly matches JS Number string semantics on round-trip boundaries', async () => {
  const source = runtimeSource();
  const reference = await runReality(source);
  const native = runNativeBytecode(Buffer.from(compileRealityToBytecode(source)), {
    requireNativeStateRoot: true,
  });
  for (let index = 0; index < DECIMAL_CASES.length; index += 1) {
    const key = `value_${index}`;
    const expected = String(Number(DECIMAL_CASES[index]));
    assert.equal(reference.state[key], expected, `JS reference mismatch for ${DECIMAL_CASES[index]}`);
    assert.equal(native.state[key], expected, `native number text mismatch for ${DECIMAL_CASES[index]}`);
  }
  assert.equal(native.stateRootVerified, true);
});

test('native number_from_text rejects the same malformed and overflowing inputs as the reference', async () => {
  const overflowMidpoint = ((1n << 54n) - 1n) << 970n;
  for (const value of [
    '0x1p2', '-0x10', '+0b1', '0o8', '0b', '1e+', '1e309',
    '\u00851.5', '1\u20032', '0x' + 'f'.repeat(256), String(overflowMidpoint),
  ]) {
    const source = `reality InvalidNumber { facet value : Number = number_from_text(${JSON.stringify(value)}) }`;
    await assert.rejects(runReality(source), error => error.code === 'RCL_TEXT_NUMBER_INVALID');
    assert.throws(() => runNativeBytecode(compileRealityToBytecode(source)),
      error => error.code === 'RCL_TEXT_NUMBER_INVALID');
  }
});

test('native decimal parsing rounds exactly at binary64 halfway points', async () => {
  const oneMidpoint = '1.00000000000000011102230246251565404236316680908203125';
  const zeroMidpoint = '0.' + String(5n ** 1075n).padStart(1075, '0');
  const tinySuffix = '0'.repeat(820) + '1';
  const finiteLimit = (((1n << 54n) - 1n) << 970n) - 1n;
  const inputs = [
    '6.595736340067464e-229',
    '9.546676135936264e-153',
    oneMidpoint, oneMidpoint + tinySuffix, '-' + oneMidpoint + tinySuffix,
    zeroMidpoint, zeroMidpoint + tinySuffix, String(finiteLimit),
    '1' + '0'.repeat(1200) + 'e-1200',
    '0.' + '0'.repeat(1200) + '5e1201',
  ];
  const source = 'reality DecimalMidpoint { ' + inputs.map((value, index) =>
    `facet value${index} : Number = number_from_text(${JSON.stringify(value)})`).join(' ') + ' }';
  const native = runNativeBytecode(compileRealityToBytecode(source), { requireNativeStateRoot: true });
  const reference = await runReality(source);
  assert.deepEqual(native.state, reference.state);
  assert.deepEqual(inputs.map((_, index) => native.state[`value${index}`]),
    [6.595736340067464e-229, 9.546676135936264e-153, 1, 1 + Number.EPSILON,
      -(1 + Number.EPSILON), 0, Number.MIN_VALUE, Number.MAX_VALUE, 1, 5]);
});

test('AST constructors retain parsed numeric bits and reject malformed literal text', async () => {
  const literal = '6.595736340067464e-229';
  const source = `reality AstNumber {
    facet node : AstNode = facet_ast("value", "Number", "Number", "${literal}", make_span(0, 1, 1, 1))
  }`;
  const algorithm = 'rcl.semantic-state-root.v3-candidate';
  const expected = await runReality(source, { stateRootAlgorithm: algorithm });
  const native = runNativeBytecode(compileRealityToBytecode(source), {
    requireNativeStateRoot: true, stateRootAlgorithm: algorithm, rejectProjectedAst: true,
  });
  assert.deepEqual(native.state, expected.state);
  assert.equal(native.state.node.value.value, Number(literal));
  assert.equal(native.state.node.literalText, literal);
  assert.equal(native.stateRoot, expected.stateRoot);

  const malformed = source.replace(literal, '1e+');
  await assert.rejects(runReality(malformed), /Invalid Number literal/);
  assert.throws(() => runNativeBytecode(compileRealityToBytecode(malformed)),
    error => error.code === 'RCL_AST_LITERAL_VALUE');
});

test('native selfhost compiler is byte-identical to JS compiler for long decimal literals', () => {
  const source = compilerSource();
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-number-parity-'));
  try {
    const sourcePath = path.join(temp, 'numbers.rcl');
    const nativePath = path.join(temp, 'numbers-native.rbc');
    fs.writeFileSync(sourcePath, source, 'utf8');
    runNativeCompiler(COMPILER_RBC, sourcePath, nativePath, {
      timeout: 120_000,
      maxBuffer: 64 * 1024 * 1024,
    });
    const nativeBytes = fs.readFileSync(nativePath);
    const referenceBytes = Buffer.from(compileRealityToBytecode(source));
    assert.deepEqual(nativeBytes, referenceBytes);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test('canonical source and session compilers admit exact scientific literals', () => {
  const literals = ['1e3', '1E+3', '.125e2', '-2.5E-2', '1.e1', '5e-324', '1e-400', '1.7976931348623157e308'];
  const source = 'reality Exponents {\r\n facet prefix : Text = "😀中" '
    + literals.map((value, index) => `facet n${index} : Number = ${value}`).join(' ') + '\r\n}';
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-exponents-'));
  try {
    const input = path.join(directory, 'numbers.rcl');
    const output = path.join(directory, 'numbers.rbc');
    fs.writeFileSync(input, source);
    const native = runNativeCompiler(COMPILER_RBC, input, output).bytecode;
    assert.deepEqual(native, compileRealityToBytecode(source));
    const { state } = runNativeBytecode(native, { requireNativeStateRoot: true });
    for (const [index, value] of literals.entries()) assert.equal(state[`n${index}`], Number(value));
    assert.equal(compileRealitySessionNative(source).evidence.targetByteParity, true);

    const exponent = lexReality(source, { sourceRanges: true }).find(token => token.value === '5e-324');
    const range = getTokenSourceRange(exponent);
    assert.equal(source.slice(range.offset, range.offset + range.length), '5e-324');
    assert.equal(range.length, 6);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('malformed and overflowing scientific literals fail without publishing compiler output', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-bad-exponents-'));
  try {
    const input = path.join(directory, 'numbers.rcl');
    const output = path.join(directory, 'numbers.rbc');
    const retained = Buffer.from('retained-before-invalid-number');
    for (const literal of ['1e', '1e+', '1E-', '1e2e3', '1e309']) {
      const source = `reality InvalidExponent { facet n : Number = ${literal} }`;
      assert.throws(() => compileRealityToBytecode(source));
      fs.writeFileSync(input, source);
      fs.writeFileSync(output, retained);
      assert.throws(() => runNativeCompiler(COMPILER_RBC, input, output));
      assert.deepEqual(fs.readFileSync(output), retained);
    }
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
