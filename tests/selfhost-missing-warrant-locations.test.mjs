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
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-warrant-locations-'));
  compilers = ['compiler-main.rcl', 'session-compiler-main.rcl'].map((name, index) => {
    const artifact = path.join(directory, `compiler-${index}.rbc`);
    fs.writeFileSync(artifact, compileRealityToBytecode(read('compiler-core.rcl') + '\n'
      + (index ? read('session-compiler-core.rcl') + '\n' : '') + read(name)));
    return artifact;
  });
});
test.after(() => { if (directory) fs.rmSync(directory, { recursive: true, force: true }); });
const fixtures = [
  ['emergence', `reality Missing {
    facet value : Number = 0
    subject actor {}
    emergence update { cause actor when true
      needs world.write on value
      alter value <- 1
    }
  }`],
  ['resonance', `reality Missing {
    facet value : Number = 0
    subject actor {} subject target {}
    resonance update { from actor into target when true
      needs world.write on value
      alter value <- 1
    }
  }`],
  ['later need after Unicode', `reality Missing {
    facet value : Number = 0
    subject actor { warrant world.read on value }
    emergence update { cause actor when true
      needs world.read on value witness "🦊" needs world.write on value
      alter value <- 1
    }
  }`],
];
for (const [label, text] of fixtures) for (const newline of ['\n', '\r\n']) test(`missing warrant points at ${label} capability with ${JSON.stringify(newline)}`, () => {
  const source = text.replaceAll('\n', newline), needle = 'world.write', index = source.indexOf(needle);
  const lines = source.slice(0, index).split('\n'), position = `${lines.length}:${lines.at(-1).length + 1}`;
  const input = path.join(directory, 'input.rcl'), output = path.join(directory, 'output.rbc'), retained = Buffer.from('retain-before-diagnostic');
  fs.writeFileSync(input, source);
  for (const compiler of compilers) {
    fs.writeFileSync(output, retained);
    assert.throws(() => runNativeCompiler(compiler, input, output), error => {
      assert.equal(error.code, 'RCLC_COMPILER_FAILURE');
      assert.ok(error.message.includes('RCL_WARRANT_MISSING:update:actor:world.write:value'), error.message);
      assert.ok(error.message.endsWith(' at ' + position), error.message);
      return true;
    });
    assert.deepEqual(fs.readFileSync(output), retained);
  }
});

test('need location metadata preserves target roots and bytes for scope grants and later immutable rule updates', () => {
  for (const grant of ['value.child', 'value']) {
    const source = `reality Granted {
      facet value.child : Number = 0
      subject actor { warrant world.write on ${grant} }
      emergence update {
        needs world.write on value.child
        cause actor when true alter value.child <- 1 preserve value.child >= 0 witness "kept"
      }
    }`;
    const input = path.join(directory, 'input.rcl'), output = path.join(directory, 'output.rbc');
    fs.writeFileSync(input, source);
    assert.deepEqual(runNativeCompiler(compilers[0], input, output).bytecode, compileRealityToBytecode(source));
    assert.deepEqual(runNativeCompiler(compilers[1], input, output).bytecode, compileRealitySessionBytecode(source));
  }
});
