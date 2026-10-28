import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileRealityToBytecode, compileRealitySessionBytecode } from '../src/bytecode.mjs';
import { runNativeCompiler } from '../src/native-vm.mjs';
import { invalidPredicates, predicateSource } from './fixtures/warrant-predicate-cases.mjs';

let directory, sessionCompiler;
const generalCompiler = process.env.RCL_TEST_GENERAL_COMPILER_ARTIFACT ?? fileURLToPath(new URL('../selfhost/compiler.rbc', import.meta.url));
const core = fs.readFileSync(new URL('../selfhost/compiler-core.rcl', import.meta.url), 'utf8');
test.before(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-semantic-locations-'));
  sessionCompiler = path.join(directory, 'session-compiler.rbc');
  const read = name => fs.readFileSync(new URL('../selfhost/' + name, import.meta.url), 'utf8');
  fs.writeFileSync(sessionCompiler, compileRealityToBytecode(core + '\n' + read('session-compiler-core.rcl') + '\n' + read('session-compiler-main.rcl')));
});
test.after(() => { if (directory) fs.rmSync(directory, { recursive: true, force: true }); });
const position = (source, token, from = 0) => {
  const index = source.indexOf(token, from);
  assert.notEqual(index, -1);
  const before = source.slice(0, index).split('\n');
  return `${before.length}:${before.at(-1).length + 1}`;
};
function rejectsAt(source, diagnostic, token, from = 0) {
  const input = path.join(directory, 'invalid.rcl'), output = path.join(directory, 'retained.rbc');
  fs.writeFileSync(input, source);
  const sentinel = Buffer.from('retained-before-failed-compilation');
  for (const compiler of [generalCompiler, sessionCompiler]) {
    fs.writeFileSync(output, sentinel);
    assert.throws(() => runNativeCompiler(compiler, input, output), error => {
      assert.equal(error.code, 'RCLC_COMPILER_FAILURE');
      assert.ok(error.message.includes(diagnostic), error.message);
      assert.ok(error.message.endsWith(' at ' + position(source, token, from)), error.message);
      return true;
    });
    assert.deepEqual(fs.readFileSync(output), sentinel);
  }
}

test('native name, literal and call diagnostics point at the failing expression', () => {
  for (const newline of ['\n', '\r\n']) {
    for (const [expression, diagnostic, token] of [
      ['1 + missing.value', 'RCL_SEMANTIC_UNKNOWN_PATH', 'missing.value'],
      ['missing_call(1)', 'RCL_SEMANTIC_UNKNOWN_CALL', 'missing_call'],
      ['"wrong"', 'RCL_SEMANTIC_TYPE_MISMATCH', '"wrong"'],
      ['choose(true, 1)', 'RCL_SEMANTIC_CALL_ARITY', 'choose'],
      ['known()', 'RCL_SEMANTIC_CALL_ARITY', 'known()'],
      ['((missing.value))', 'RCL_SEMANTIC_UNKNOWN_PATH', 'missing.value'],
    ]) {
      const source = ['reality Located {', '  # 中文 comment before source diagnostic', '  reckon known(value : Number) -> Number = value', `\t facet value : Number = ${expression}`, '}'].join(newline);
      rejectsAt(source, diagnostic, token);
    }
  }
});

const predicateTokens = {
  'nested unknown path': 'missing.enabled',
  'invalid unary': 'not', 'invalid logic': 'and', 'invalid arithmetic': '+',
  'mixed equality': '==', 'text ordering': '>',
  'user predicate body': 'value\n', 'nested user predicate body': 'value\n',
  'user predicate operand': 'and',
};
for (const [name, predicate, diagnostic, reckons] of invalidPredicates) {
  test(`native warrant diagnostic retains exact source position: ${name}`, () => {
    const source = predicateSource(predicate, reckons);
    const token = predicateTokens[name] ?? predicate;
    const bodyError = name.includes('predicate body') || name === 'user predicate operand';
    const from = bodyError ? source.indexOf('-> Truth =') + '-> Truth ='.length : source.indexOf('while ') + 6;
    rejectsAt(source, diagnostic, token, from);
  });
}

test('unknown alteration target points to target rather than right hand side', () => {
  const source = predicateSource('true').replace('alter state <- state + 1', 'alter missing.target <- state + 1');
  rejectsAt(source, 'RCL_SEMANTIC_UNKNOWN_ALTER_TARGET', 'missing.target');
});

test('diagnostic columns use UTF-16 editor coordinates after non-BMP text', () => {
  const source = 'reality Unicode {\n  facet label : Text = "🦊舟" facet value : Number = missing.value\n}';
  rejectsAt(source, 'RCL_SEMANTIC_UNKNOWN_PATH', 'missing.value');
});

test('diagnostic metadata preserves accepted source bytecode in general and session compilers', () => {
  for (const source of [predicateSource('enabled and eligible(count)'), predicateSource('(count + 2) > 0'), 'reality Literal { facet value : Number = ((1 + 2) * 3) }', 'reality Unicode { facet label : Text = "🦊舟" facet value : Number = 3 }']) {
    const input = path.join(directory, 'valid.rcl');
    fs.writeFileSync(input, source);
    assert.deepEqual(runNativeCompiler(generalCompiler, input, path.join(directory, 'valid.rbc')).bytecode, compileRealityToBytecode(source));
    assert.deepEqual(runNativeCompiler(sessionCompiler, input, path.join(directory, 'session.rbc')).bytecode, compileRealitySessionBytecode(source));
  }
});
