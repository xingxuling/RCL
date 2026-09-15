import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { compileRealityToBytecode } from '../src/bytecode.mjs';
import { runReality } from '../src/runtime.mjs';
import { runNativeBytecode, runNativeCompiler } from '../src/native-vm.mjs';

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
