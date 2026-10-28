import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { compileRealityToBytecode, compileRealitySessionBytecode } from '../src/bytecode.mjs';
import { runNativeCompiler } from '../src/native-vm.mjs';
import { createNativeRealitySession } from '../src/native-session.mjs';

let directory, compiler;
test.before(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-session-purity-')); compiler = path.join(directory, 'compiler.rbc');
  const read = name => fs.readFileSync(new URL('../selfhost/' + name, import.meta.url), 'utf8');
  fs.writeFileSync(compiler, compileRealityToBytecode(read('compiler-core.rcl') + '\n' + read('session-compiler-core.rcl') + '\n' + read('session-compiler-main.rcl')));
});
test.after(() => { if (directory) fs.rmSync(directory, { recursive: true, force: true }); });
const provider = 'provider_call("echo", "text", "{}")';
const program = ({ initial = '"none"', functions = '', when = 'true', value = '"accepted"', preserve = 'true' } = {}) => `reality SessionPurity {
  facet reply : Text = ${initial}
  ${functions}
  subject actor { warrant state.write on reply }
  emergence change { cause actor when ${when} needs state.write on reply alter reply <- ${value} preserve ${preserve} }
}`;
const effects = [
  ['facet initializer', { initial: provider }],
  ['unused function body', { functions: `reckon hidden() -> Text = ${provider}` }],
  ['function reached from initializer', { functions: `reckon hidden() -> Text = ${provider}`, initial: 'hidden()' }],
  ['rule alteration', { value: provider }],
  ['rule guard', { when: `${provider} == "ready"` }],
  ['rule preserve', { preserve: `${provider} != ""` }],
  ['unselected choose branch', { value: `choose(true, "safe", ${provider})` }],
  ['binary expression', { value: `"prefix" + ${provider}` }],
  ['unary expression', { when: `not (${provider} == "ready")` }],
];
for (const [label, options] of effects) test(`direct session compiler rejects provider effects in ${label}`, () => {
  const source = program(options);
  assert.throws(() => compileRealitySessionBytecode(source), error => error.code === 'RCL_SESSION_EXTERNAL_EFFECT_UNSUPPORTED');
  const input = path.join(directory, 'input.rcl'), output = path.join(directory, 'output.rbc'), retained = Buffer.from('retained-session-output');
  fs.writeFileSync(input, source); fs.writeFileSync(output, retained);
  const prefix = source.slice(0, source.indexOf(provider)).split('\n');
  assert.throws(() => runNativeCompiler(compiler, input, output, { outputState: 'compiler.output', timeout: 5000 }), error =>
    error.message.includes('RCL_SESSION_EXTERNAL_EFFECT_UNSUPPORTED') && error.message.includes(`at ${prefix.length}:${prefix.at(-1).length + 1}`));
  assert.deepEqual(fs.readFileSync(output), retained);
});

test('literal provider-like text and pure functions retain byte parity and genuine session execution', async () => {
  const source = program({ initial: '"provider_call is just text"', functions: 'reckon label(x : Text) -> Text = "pure:" + x', value: 'label(reply)' });
  const input = path.join(directory, 'input.rcl'), output = path.join(directory, 'output.rbc'); fs.writeFileSync(input, source);
  const native = runNativeCompiler(compiler, input, output, { outputState: 'compiler.output', timeout: 5000 });
  assert.deepEqual(native.bytecode, compileRealitySessionBytecode(source));
  const session = await createNativeRealitySession(source, { bytecode: native.bytecode });
  try { assert.equal((await session.invoke({ rule: 'change' })).state.reply, 'pure:provider_call is just text'); }
  finally { await session.close(); }
});
