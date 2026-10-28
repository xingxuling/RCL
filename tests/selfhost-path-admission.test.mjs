import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { compileRealityToBytecode, compileRealitySessionBytecode } from '../src/bytecode.mjs';
import { runNativeCompiler } from '../src/native-vm.mjs';

let directory, compilers;
const read = name => fs.readFileSync(new URL('../selfhost/' + name, import.meta.url), 'utf8');
test.before(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-path-admission-'));
  compilers = ['compiler-main.rcl', 'session-compiler-main.rcl'].map((name, index) => {
    const artifact = path.join(directory, `compiler-${index}.rbc`);
    fs.writeFileSync(artifact, compileRealityToBytecode(read('compiler-core.rcl') + '\n'
      + (index ? read('session-compiler-core.rcl') + '\n' : '') + read(name)));
    return artifact;
  });
});
test.after(() => { if (directory) fs.rmSync(directory, { recursive: true, force: true }); });
const base = `reality PathAdmission {
  facet value : Number = 0
  subject actor { warrant world.write on value }
  emergence update { cause actor when true
    needs world.write on value
    alter value <- 1
  }
}`;
const fixtures = [
  ['numeric capability segment', base.replaceAll('world.write', 'world.7'), '7', 'RCL_PATH_SEGMENT'],
  ['quoted capability', base.replaceAll('world.write', '"world.write"'), '"world.write"', 'RCL_PATH_NAME'],
  ['wildcard source target', base.replaceAll('on value', 'on *'), '*', 'RCL_PATH_NAME'],
  ['numeric source target', base.replaceAll('on value', 'on 9'), '9', 'RCL_PATH_NAME'],
  ['quoted source target', base.replaceAll('on value', 'on "value"'), '"value"', 'RCL_PATH_NAME'],
  ['numeric facet/path names', base.replaceAll(/\bvalue\b/gu, '8'), '8', 'RCL_PATH_NAME'],
  ['wrong warrant delimiter', base.replace('warrant world.write on value', 'warrant world.write over value'), 'over', 'on'],
  ['wrong needs delimiter', base.replace('needs world.write on value', 'needs world.write over value'), 'over', 'on'],
];
for (const [name, original, needle, diagnostic] of fixtures) for (const newline of ['\n', '\r\n']) test(`direct native path admission rejects ${name} with ${JSON.stringify(newline)}`, () => {
  const source = original.replaceAll('\n', newline);
  assert.throws(() => compileRealityToBytecode(source), /RCL_SYNTAX_ERROR/u, 'reference grammar rejects');
  const index = source.indexOf(needle), lines = source.slice(0, index).split('\n');
  const position = `${lines.length}:${lines.at(-1).length + 1}`;
  const input = path.join(directory, 'input.rcl'), output = path.join(directory, 'output.rbc'), retained = Buffer.from('kept-before-invalid-path');
  fs.writeFileSync(input, source);
  for (const compiler of compilers) {
    fs.writeFileSync(output, retained);
    assert.throws(() => runNativeCompiler(compiler, input, output), error => {
      assert.equal(error.code, 'RCLC_COMPILER_FAILURE');
      assert.ok(error.message.includes(diagnostic), error.message);
      assert.ok(error.message.endsWith(' at ' + position), error.message);
      return true;
    });
    assert.deepEqual(fs.readFileSync(output), retained);
  }
});

test('Unicode and hierarchical identifier paths preserve general and session byte parity', () => {
  const source = base.replaceAll('world.write', '领域.写').replaceAll(/\bvalue\b/gu, '世界.数值');
  const input = path.join(directory, 'input.rcl'), output = path.join(directory, 'output.rbc');
  fs.writeFileSync(input, source);
  assert.deepEqual(runNativeCompiler(compilers[0], input, output).bytecode, compileRealityToBytecode(source));
  assert.deepEqual(runNativeCompiler(compilers[1], input, output).bytecode, compileRealitySessionBytecode(source));
});
