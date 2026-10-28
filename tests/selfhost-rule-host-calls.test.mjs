import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { compileRealityToBytecode, compileRealitySessionBytecode, decodeBytecode } from '../src/bytecode.mjs';
import { runNativeCompiler } from '../src/native-vm.mjs';

const compiler = process.env.RCL_TEST_GENERAL_COMPILER_ARTIFACT ?? fileURLToPath(new URL('../selfhost/compiler.rbc', import.meta.url));
let directory;
test.before(() => { directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-selfhost-rule-call-')); });
test.after(() => { if (directory) fs.rmSync(directory, { recursive: true, force: true }); });
const source = (options = {}) => `reality HostCalls {
  facet reply : ${options.targetType ?? 'Text'} = ${options.targetType === 'Number' ? '0' : options.targetType === 'Truth' ? 'false' : '"none"'}
  facet other : Text = "none" facet count : Number = 0 facet request : Text = "{}"
  subject actor { ${options.noWarrant ? '' : 'warrant computer.invoke on echo'} }
  ${options.noHost ? '' : `host echo { offers text -> ${options.returnType ?? 'Text'} }`}
  reckon plus(x : Number) -> Number = x + 1
  emergence ask { cause actor when ${options.when ?? 'reply == "none"'} needs computer.invoke on echo
    ${options.effects ?? `call ${options.capability ?? 'echo.text'}(${options.request ?? '"{}"'}) -> ${options.target ?? 'reply'}`}
    ${options.preserve ?? 'preserve length(reply) > 0'} witness "local-test"
  }
  ${options.directive ?? 'realize ask'}
}`;
function native(text, artifact = compiler) {
  const input = path.join(directory, 'input.rcl'), output = path.join(directory, 'output.rbc'); fs.writeFileSync(input, text);
  return runNativeCompiler(artifact, input, output, { outputState: 'compiler.output', timeout: 5000 }).bytecode;
}

test('both previously excluded host-call fixtures reproduce exact bootstrap bytecode', () => {
  for (const name of ['native-provider-host-call', 'computer-reality']) {
    const text = fs.readFileSync(new URL('../examples/' + name + '.rcl', import.meta.url), 'utf8');
    assert.deepEqual(native(text), compileRealityToBytecode(text), name);
  }
});

test('calls retain source order across immutable rule updates and preserve instruction addresses', () => {
  const text = source({ effects: 'call echo.text("{\\"n\\":1}") -> reply alter count <- plus(count) call echo.text("🦊") -> other', preserve: 'preserve count == 1 preserve length(other) > 0' });
  assert.deepEqual(native(text), compileRealityToBytecode(text));
  const decoded = decodeBytecode(native(text));
  assert.equal(decoded.version.minor, 2);
  assert.equal(decoded.instructions.filter(item => item.name === 'CALL_PROVIDER').length, 2);
  assert.equal(decoded.instructions.filter(item => item.name === 'STAGE_STORE' && item.flags === 1).length, 2);
});

test('unused host calls remain metadata-only while conditional warrants retain RBC 1.3', () => {
  const conditional = source().replace('warrant computer.invoke on echo', 'warrant computer.invoke on echo while true');
  for (const text of [source({ directive: '' }), conditional, source({ effects: 'call echo.text("{}",) -> reply' })]) assert.deepEqual(native(text), compileRealityToBytecode(text));
  assert.equal(decodeBytecode(native(source({ directive: '' }))).version.minor, 1);
  assert.equal(decodeBytecode(native(conditional)).version.minor, 3);
});

test('self-hosted output executes through the existing local echo provider and preserves receipts', () => {
  const text = source(), bytes = native(text), artifact = path.join(directory, 'host-target.rbc'); fs.writeFileSync(artifact, bytes);
  const executable = fileURLToPath(new URL('../native/' + (process.platform === 'win32' ? 'provider_demo.exe' : 'provider_demo'), import.meta.url));
  const result = spawnSync(executable, [artifact], { encoding: 'utf8', timeout: 30000, windowsHide: true });
  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.history[0].hostCalls[0].providerId, 'echo');
  assert.equal(payload.history[0].hostCalls[0].requestJson, '{}');
  assert.equal(payload.history[0].changes[0].source, 'host:echo.text');
  assert.deepEqual(payload.history[0].witnesses, ['local-test']);
});

const invalid = [
  ['missing warrant', { noWarrant: true }, /RCL_WARRANT_MISSING/],
  ['unknown host', { noHost: true }, /RCL_HOST_UNKNOWN/],
  ['unknown offered capability', { capability: 'echo.missing' }, /RCL_HOST_CAPABILITY_UNKNOWN/],
  ['unknown target', { target: 'missing' }, /RCL_CALL_TARGET_UNKNOWN/],
  ['mismatched result type', { targetType: 'Number', when: 'true', preserve: '' }, /RCL_CALL_TARGET_TYPE/],
  ['numeric response outside the Text ABI', { targetType: 'Number', returnType: 'Number', when: 'true', preserve: '' }, /RCL_NATIVE_HOST_CALL_RESPONSE_TYPE/],
  ['truth response outside the Text ABI', { targetType: 'Truth', returnType: 'Truth', when: 'true', preserve: '' }, /RCL_NATIVE_HOST_CALL_RESPONSE_TYPE/],
  ['zero request arguments', { request: '' }, /RCL_NATIVE_HOST_CALL_REQUEST/],
  ['multiple request arguments', { request: '"a", "b"' }, /RCL_NATIVE_HOST_CALL_REQUEST/],
  ['nontext request', { request: '7' }, /RCL_NATIVE_HOST_CALL_REQUEST_TYPE/],
  ['dynamic request', { request: 'request' }, /RCL_NATIVE_HOST_CALL_REQUEST_TYPE/],
  ['unsupported foresee', { directive: 'foresee ask' }, /RCL_NATIVE_HOST_CALL_FORESEE_UNSUPPORTED/],
];
for (const [label, options, code] of invalid) test(`native rule call rejects ${label} without replacing output`, () => {
  const text = source(options); assert.throws(() => compileRealityToBytecode(text), error =>
    error.diagnostics?.some(item => code.test(item.code)) === true || code.test(error.code ?? ''));
  const output = path.join(directory, 'output.rbc'), retained = Buffer.from('retained-output'); fs.writeFileSync(output, retained);
  assert.throws(() => native(text), code); assert.deepEqual(fs.readFileSync(output), retained);
});

test('malformed call delimiters and missing targets reject', () => {
  for (const replacement of ['call echo.text "{}" -> reply', 'call echo.text("{}") reply', 'call echo.text("{}") ->']) {
    const text = source({ effects: replacement }); assert.throws(() => compileRealityToBytecode(text));
    const output = path.join(directory, 'output.rbc'), retained = Buffer.from('retained-output'); fs.writeFileSync(output, retained);
    assert.throws(() => native(text), /RCL_SEMANTIC_ASSERT/); assert.deepEqual(fs.readFileSync(output), retained);
  }
});

test('direct native session compiler rejects rule effects even though general lowering supports them', () => {
  const read = name => fs.readFileSync(new URL('../selfhost/' + name, import.meta.url), 'utf8');
  const artifact = path.join(directory, 'session-compiler.rbc'); fs.writeFileSync(artifact, compileRealityToBytecode(read('compiler-core.rcl') + '\n' + read('session-compiler-core.rcl') + '\n' + read('session-compiler-main.rcl')));
  const text = source({ directive: '' }); assert.throws(() => compileRealitySessionBytecode(text), /RCL_SESSION_EXTERNAL_EFFECT_UNSUPPORTED/);
  assert.throws(() => native(text, artifact), /RCL_SESSION_EXTERNAL_EFFECT_UNSUPPORTED/);
});
