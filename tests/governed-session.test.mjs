import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRealitySession } from '../src/runtime.mjs';
import { createNativeRealitySession } from '../src/native-session.mjs';
import { compileRealitySessionBytecode, compileRealityToBytecode, decodeBytecode } from '../src/bytecode.mjs';
import { runReality } from '../src/runtime.mjs';
import { runRealityNative } from '../src/native-vm.mjs';

const source = fs.readFileSync(new URL('../examples/sessions/governed-counter.rcl', import.meta.url), 'utf8');

test('native and reference sessions keep state, commit typed inputs and project atomically', async () => {
  const reference = createRealitySession(source);
  const native = await createNativeRealitySession(source);
  try {
    assert.equal(native.snapshot().stateRoot, reference.snapshot().stateRoot);
    const commands = [
      { rule: 'increment', inputs: { 'event.delta': 3, 'event.label': 'first 🌱' } },
      { rule: 'increment', inputs: { 'event.delta': 2 } },
      { rule: 'increment', mode: 'foresee', inputs: { 'event.delta': 90, 'event.label': 'projection' } },
      { rule: 'increment', inputs: { 'event.delta': 0, 'event.label': 'false guard' } },
      { rule: 'increment', inputs: { 'event.delta': 1e-8, 'event.label': '精确浮点数' } },
    ];
    for (const command of commands) assert.deepEqual(await native.invoke(command), await reference.invoke(command));
    assert.equal(native.snapshot().state['counter.value'], 5.00000001);
    assert.equal(native.snapshot().state['counter.lastLabel'], '精确浮点数');
  } finally { await native.close(); }
});

test('dynamic warrant revocation and preserve rejection leave inputs and state unchanged', async () => {
  const reference = createRealitySession(source);
  const native = await createNativeRealitySession(source);
  try {
    for (const session of [reference, native]) {
      const initial = session.snapshot().stateRoot;
      await assert.rejects(async () => session.invoke({ rule: 'increment', inputs: { 'event.delta': -1 } }));
      assert.equal(session.snapshot().stateRoot, initial);
      await session.invoke({ rule: 'revoke' });
      const revoked = session.snapshot().stateRoot;
      await assert.rejects(async () => session.invoke({ rule: 'increment', inputs: { 'event.delta': 1 } }), error => error.code === 'RCL_AUTHORITY_DENIED');
      assert.equal(session.snapshot().stateRoot, revoked);
      await session.invoke({ rule: 'grant' });
      assert.equal((await session.invoke({ rule: 'increment', inputs: { 'event.delta': 1 } })).state['counter.value'], 1);
    }
    assert.equal(native.snapshot().stateRoot, reference.snapshot().stateRoot);
  } finally { await native.close(); }
});

test('only declared, correctly typed scalar inputs enter a session', async () => {
  const native = await createNativeRealitySession(source);
  try {
    const root = native.snapshot().stateRoot;
    for (const inputs of [{ 'counter.value': 10 }, { 'access.enabled': true }, { 'event.delta': '1' }, { 'event.delta': Infinity }, { 'event.label': '\0' }, { 'event.label': '\ud800' }]) {
      await assert.rejects(async () => native.invoke({ rule: 'increment', inputs }));
      assert.equal(native.snapshot().stateRoot, root);
    }
    await assert.rejects(async () => native.invoke({ rule: 'unknown' }), error => error.code === 'RCL_RULE_UNKNOWN');
  } finally { await native.close(); }
});

test('queued invocations and independent daemon instances preserve isolation', async () => {
  const first = await createNativeRealitySession(source), second = await createNativeRealitySession(source);
  try {
    const results = await Promise.all(Array.from({ length: 8 }, () => first.invoke({ rule: 'increment', inputs: { 'event.delta': 1 } })));
    assert.deepEqual(results.map(result => result.state['counter.value']), [1, 2, 3, 4, 5, 6, 7, 8]);
    assert.equal(second.snapshot().state['counter.value'], 0);
    assert.notEqual(first.snapshot().native.processId, second.snapshot().native.processId);
  } finally { await first.close(); await second.close(); }
});

test('session RBC uses an independent 1.3 feature contract and rejects artifact substitution', async () => {
  const bytecode = compileRealitySessionBytecode(source);
  const decoded = decodeBytecode(bytecode);
  assert.equal(decoded.version.minor, 3);
  assert.equal(decoded.flags & 4, 4);
  const changed = Buffer.from(bytecode); changed[changed.length - 1] ^= 1;
  await assert.rejects(createNativeRealitySession(source, { bytecode: changed }), error => error.code === 'RCL_SESSION_BYTECODE_SOURCE_MISMATCH');
  assert.throws(() => compileRealitySessionBytecode('reality External { facet result:Text=provider_call("io","read","{}") }'), error => error.code === 'RCL_SESSION_EXTERNAL_EFFECT_UNSUPPORTED');
});

test('ordinary native bytecode reevaluates conditional warrants between directives', async () => {
  const program = `${source.slice(0, source.lastIndexOf('}'))}\n realize revoke\n realize increment\n}`.replace('input event.delta : Number = 0', 'input event.delta : Number = 1');
  await assert.rejects(runReality(program), error => error.code === 'RCL_AUTHORITY_DENIED');
  assert.throws(() => runRealityNative(program), error => error.code === 'RCL_AUTHORITY_DENIED');
  assert.equal(decodeBytecode(compileRealityToBytecode(program)).version.minor, 3);
});

test('native peer death returns a structured failure and close releases process resources', async () => {
  const session = await createNativeRealitySession(source);
  const before = session.snapshot().stateRoot;
  process.kill(session.snapshot().native.processId);
  try {
    await assert.rejects(session.invoke({ rule: 'increment', inputs: { 'event.delta': 1 } }), error => /^RCL_SESSION_NATIVE_/u.test(error.code));
    assert.equal(session.snapshot().stateRoot, before);
  } finally { await session.close(); }
});
