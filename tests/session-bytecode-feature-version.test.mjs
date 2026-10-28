import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { compileRealityToBytecode, compileRealitySessionBytecode, decodeBytecode } from '../src/bytecode.mjs';
import { runNativeCompiler } from '../src/native-vm.mjs';
import { createNativeRealitySession } from '../src/native-session.mjs';

test('native session compiler chooses the instruction-required minor version, including ruleless programs', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-session-feature-version-'));
  try {
    const read = name => fs.readFileSync(new URL('../selfhost/' + name, import.meta.url), 'utf8');
    const compiler = path.join(directory, 'compiler.rbc');
    fs.writeFileSync(compiler, compileRealityToBytecode(read('compiler-core.rcl') + '\n' + read('session-compiler-core.rcl') + '\n' + read('session-compiler-main.rcl')));
    for (const [source, minor, state] of [
      ['reality Empty { }', 1, {}],
      ['reality Literal { facet value : Number = 3 }', 1, { value: 3 }],
      ['reality Modulo { facet value : Number = 11 % 4 }', 2, { value: 3 }],
      ['reality Input { input value : Number = 3 }', 3, { value: 3 }],
      ['reality Rule { facet value : Number = 3 subject worker { warrant state.write on value } emergence noop { cause worker when true needs state.write on value alter value <- value } }', 3, { value: 3 }],
    ]) {
      const input = path.join(directory, 'target.rcl'), output = path.join(directory, 'target.rbc');
      fs.writeFileSync(input, source);
      const native = runNativeCompiler(compiler, input, output).bytecode;
      const expected = compileRealitySessionBytecode(source);
      assert.deepEqual(native, expected, source);
      assert.equal(decodeBytecode(native).version.minor, minor, source);
      const session = await createNativeRealitySession(source, { bytecode: native });
      try { assert.deepEqual(session.snapshot().state, state); }
      finally { await session.close(); }
    }
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
