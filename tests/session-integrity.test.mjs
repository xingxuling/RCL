import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createNativeRealitySession } from '../src/native-session.mjs';
import { openDurableRealitySession } from '../src/durable-session.mjs';
import { createRealitySession } from '../src/runtime.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const source = `reality ReplyProbe {
  input delta : Number = 1
  facet value : Number = 0
  subject worker { warrant value.write on value }
  emergence increment {
    cause worker
    when true
    needs value.write on value
    alter value <- value + delta
    preserve value <= 100
    witness "probe:increment"
  }
}`;
let fixtureDirectory, daemonPath;

test.before(() => {
  fixtureDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-session-fault-'));
  daemonPath = path.join(fixtureDirectory, process.platform === 'win32' ? 'fault.exe' : 'fault');
  const candidates = process.platform === 'win32'
    ? [process.env.ZIG, path.join(ROOT, '_tools/zig-x86_64-windows-0.16.0/zig.exe'), path.join(ROOT, '_tools/zig/zig.exe'), 'zig'].filter(Boolean)
    : [process.env.CC ?? 'cc'];
  const compiler = candidates.find(candidate => spawnSync(candidate, [process.platform === 'win32' ? 'version' : '--version'], { windowsHide: true }).status === 0);
  assert.ok(compiler, 'A local C compiler is required for the real-VM fault harness');
  const args = process.platform === 'win32'
    ? ['cc', '-target', 'x86_64-windows-gnu', '-DRCLVM_USE_DLL'] : [];
  args.push('-std=c11', `-I${path.join(ROOT, 'native')}`, path.join(ROOT, 'tests/fixtures/session-fault-daemon.c'),
    path.join(ROOT, process.platform === 'win32' ? 'native/rclvm.lib' : 'native/librclvm.a'));
  if (process.platform !== 'win32') args.push('-lcrypto', '-lm');
  args.push('-o', daemonPath);
  const build = spawnSync(compiler, args, { encoding: 'utf8', timeout: 60_000, windowsHide: true, env: {
    ...process.env,
    ZIG_GLOBAL_CACHE_DIR: process.env.ZIG_GLOBAL_CACHE_DIR ?? path.join(ROOT, '_tools/zig-global-cache'),
    ZIG_LOCAL_CACHE_DIR: process.env.ZIG_LOCAL_CACHE_DIR ?? path.join(ROOT, '_tools/zig-local-cache'),
  } });
  assert.equal(build.status, 0, build.stderr || build.stdout || build.error?.message);
  if (process.platform === 'win32') fs.copyFileSync(path.join(ROOT, 'native/rclvm.dll'), path.join(fixtureDirectory, 'rclvm.dll'));
});
test.after(() => { if (fixtureDirectory) fs.rmSync(fixtureDirectory, { recursive: true, force: true }); });

for (const fault of ['root', 'source', 'shape', 'rule', 'before', 'after', 'projection']) {
  test(`a real VM commit with invalid ${fault} evidence closes the native session`, async () => {
    const session = await createNativeRealitySession(source, { daemonPath, env: { RCL_SESSION_FAULT: fault } });
    const initial = session.snapshot();
    try {
      await assert.rejects(session.invoke({ rule: 'increment', mode: fault === 'projection' ? 'foresee' : 'realize' }),
        error => error.code === 'RCL_SESSION_NATIVE_EVIDENCE_INVALID');
      assert.equal(session.snapshot().stateRoot, initial.stateRoot, 'Only the last verified state can be observed');
      await assert.rejects(session.invoke({ rule: 'increment' }), error => error.code === 'RCL_SESSION_NATIVE_CLOSED');
    } finally { await session.close(); }
  });
}

test('initial native evidence must bind the source before a session becomes usable', async () => {
  await assert.rejects(createNativeRealitySession(source, { daemonPath, env: { RCL_SESSION_FAULT: 'source', RCL_SESSION_FAULT_INITIAL: '1' } }),
    error => error.code === 'RCL_SESSION_NATIVE_EVIDENCE_INVALID');
});

test('unverified native commits poison the durable writer and replay permits a safe retry', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-durable-fault-'));
  const command = { requestId: 'once', expectedRevision: 0, rule: 'increment' };
  let session;
  try {
    session = await openDurableRealitySession(directory, { source, native: { daemonPath, env: { RCL_SESSION_FAULT: 'root' } } });
    const bytes = fs.readFileSync(path.join(directory, 'journal.jsonl'));
    await assert.rejects(session.invoke(command), error => error.code === 'RCL_SESSION_DURABILITY_UNCERTAIN'
      && error.details.cause === 'RCL_SESSION_NATIVE_EVIDENCE_INVALID');
    assert.throws(() => session.snapshot(), error => error.code === 'RCL_SESSION_CLOSED_OR_DURABILITY_UNCERTAIN');
    await assert.rejects(session.invoke(command), error => error.code === 'RCL_SESSION_CLOSED_OR_DURABILITY_UNCERTAIN');
    assert.ok(fs.readFileSync(path.join(directory, 'journal.jsonl')).equals(bytes));
    await session.close(); session = null;
    session = await openDurableRealitySession(directory, { verifyReference: true });
    assert.equal(session.snapshot().revision, 0);
    assert.equal((await session.invoke(command)).result.state.value, 1);
    assert.equal((await session.invoke(command)).replayed, true);
  } finally { await session?.close(); fs.rmSync(directory, { recursive: true, force: true }); }
});

test('durable commands capture request identity and scalar inputs before entering the queue', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-durable-capture-'));
  let session;
  try {
    session = await openDurableRealitySession(directory, { source, verifyReference: true });
    const mutable = { requestId: 'queued', expectedRevision: 1, rule: 'increment', inputs: { delta: 2 } };
    const first = session.invoke({ requestId: 'first', expectedRevision: 0, rule: 'increment' });
    const second = session.invoke(mutable);
    mutable.requestId = 'changed'; mutable.expectedRevision = 0; mutable.mode = 'foresee'; mutable.inputs.delta = 90;
    await first;
    const accepted = await second;
    assert.equal(accepted.receipt.requestId, 'queued');
    assert.equal(accepted.result.command.mode, 'realize');
    assert.equal(accepted.result.state.value, 3);
    assert.equal((await session.invoke({ requestId: 'queued', expectedRevision: 1, rule: 'increment', inputs: { delta: 2 } })).replayed, true);
    assert.equal(session.snapshot().revision, 2);
  } finally { await session?.close(); fs.rmSync(directory, { recursive: true, force: true }); }
});

test('native transport death poisons a durable writer and releases the real OS lock', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-durable-death-'));
  let session, reopened;
  try {
    session = await openDurableRealitySession(directory, { source });
    process.kill(session.snapshot().native.processId);
    await assert.rejects(session.invoke({ requestId: 'lost-peer', expectedRevision: 0, rule: 'increment' }),
      error => error.code === 'RCL_SESSION_DURABILITY_UNCERTAIN');
    assert.throws(() => session.snapshot(), error => error.code === 'RCL_SESSION_CLOSED_OR_DURABILITY_UNCERTAIN');
    reopened = await openDurableRealitySession(directory);
    assert.equal(reopened.snapshot().revision, 0);
  } finally { await session?.close(); await reopened?.close(); fs.rmSync(directory, { recursive: true, force: true }); }
});

test('returned native states cannot rewrite the last verified session state', async () => {
  const session = await createNativeRealitySession(source);
  try {
    const accepted = await session.invoke({ rule: 'increment' });
    accepted.state.value = 90; accepted.command.inputs.delta = 90;
    const snapshot = session.snapshot(); snapshot.state.value = 95;
    assert.equal(session.snapshot().state.value, 1);
    assert.equal((await session.invoke({ rule: 'increment' })).state.value, 2);
  } finally { await session.close(); }
});

test('strict native evidence keeps resonance realization and projection compatible', async () => {
  const resonance = fs.readFileSync(path.join(ROOT, 'examples/subject-resonance.rcl'), 'utf8');
  const session = await createNativeRealitySession(resonance), reference = createRealitySession(resonance);
  try {
    for (const mode of ['foresee', 'realize', 'realize']) {
      assert.deepEqual(await session.invoke({ rule: 'greeting', mode }), await reference.invoke({ rule: 'greeting', mode }));
    }
  } finally { await session.close(); }
});

test('repeated alterations of one field have identical reference/native receipts and durable replay', async () => {
  const repeated = source.replace('alter value <- value + delta', 'alter value <- value + delta\n    alter value <- value + delta + 1');
  const native = await createNativeRealitySession(repeated), reference = createRealitySession(repeated);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-durable-repeat-'));
  let durable;
  try {
    for (const mode of ['foresee', 'realize']) {
      const result = await native.invoke({ rule: 'increment', mode });
      assert.deepEqual(result, await reference.invoke({ rule: 'increment', mode }));
      assert.equal(result.transition.changes.length, 1);
      assert.equal(result.transition.changes[0].after, 2);
    }
    durable = await openDurableRealitySession(directory, { source: repeated, verifyReference: true });
    const request = { requestId: 'repeated', expectedRevision: 0, rule: 'increment' };
    const accepted = await durable.invoke(request);
    await durable.close(); durable = null;
    durable = await openDurableRealitySession(directory, { verifyReference: true });
    assert.equal(durable.snapshot().state.value, 2);
    assert.deepEqual((await durable.invoke(request)).receipt, accepted.receipt);
  } finally { await native.close(); await durable?.close(); fs.rmSync(directory, { recursive: true, force: true }); }
});
