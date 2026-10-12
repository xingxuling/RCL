import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { compileRealityToBytecode, compileRealitySessionBytecode } from '../src/bytecode.mjs';
import { runNativeCompiler } from '../src/native-vm.mjs';
import { createNativeRealitySession } from '../src/native-session.mjs';
import { createRealitySession } from '../src/runtime.mjs';
import { invalidPredicates, validPredicates, predicateSource } from './fixtures/warrant-predicate-cases.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
let directory, sessionCompiler;
const generalCompiler = process.env.RCL_TEST_GENERAL_COMPILER_ARTIFACT ?? path.join(ROOT, 'selfhost/compiler.rbc');
const read = name => fs.readFileSync(path.join(ROOT, 'selfhost', name), 'utf8');
test.before(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-warrant-admission-'));
  sessionCompiler = path.join(directory, 'session-compiler.rbc');
  fs.writeFileSync(sessionCompiler, compileRealityToBytecode(read('compiler-core.rcl') + '\n' + read('session-compiler-core.rcl') + '\n' + read('session-compiler-main.rcl')));
});
test.after(() => { if (directory) fs.rmSync(directory, { recursive: true, force: true }); });

for (const [name, predicate, diagnostic, reckons] of invalidPredicates) {
  test(`native RCL compilers reject ${name} before replacing an artifact`, () => {
    const source = predicateSource(predicate, reckons);
    assert.throws(() => compileRealityToBytecode(source), 'The independent JS type checker must reject this source');
    const input = path.join(directory, 'invalid.rcl'), output = path.join(directory, 'retained.rbc');
    fs.writeFileSync(input, source);
    const retained = Buffer.from('previous-artifact-must-survive');
    for (const artifact of [generalCompiler, sessionCompiler]) {
      fs.writeFileSync(output, retained);
      // Target source is passed straight to rclc: no JS target validation/fallback.
      assert.throws(() => runNativeCompiler(artifact, input, output, { timeout: 20_000 }),
        error => error.code === 'RCLC_COMPILER_FAILURE' && error.message.includes(diagnostic));
      assert.ok(fs.readFileSync(output).equals(retained));
    }
  });
}

for (const [name, predicate, admitted, reckons] of validPredicates) {
  test(`valid ${name} preserves native/bootstrap parity and runtime warrant behavior`, async () => {
    const source = predicateSource(predicate, reckons);
    const input = path.join(directory, 'valid.rcl'); fs.writeFileSync(input, source);
    const ordinary = runNativeCompiler(generalCompiler, input, path.join(directory, 'ordinary.rbc'), { timeout: 20_000 });
    assert.ok(ordinary.bytecode.equals(compileRealityToBytecode(source)));
    const compiled = runNativeCompiler(sessionCompiler, input, path.join(directory, 'session.rbc'), { timeout: 20_000 });
    assert.ok(compiled.bytecode.equals(compileRealitySessionBytecode(source)));
    const native = await createNativeRealitySession(source, { bytecode: compiled.bytecode }), reference = createRealitySession(source);
    try {
      if (admitted) assert.deepEqual(await native.invoke({ rule: 'increment' }), await reference.invoke({ rule: 'increment' }));
      else {
        for (const session of [native, reference]) {
          const initial = session.snapshot().stateRoot;
          await assert.rejects(async () => session.invoke({ rule: 'increment' }), error => error.code === 'RCL_AUTHORITY_DENIED');
          assert.equal(session.snapshot().stateRoot, initial);
        }
      }
    } finally { await native.close(); }
  });
}
