import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
import { openDurableRealitySession, verifyDurableRealitySession } from '../src/durable-session.mjs';
import { semanticStateRootV2Stable as root } from '../src/semantic-state-root-v2.mjs';

const source = fs.readFileSync(new URL('../examples/sessions/governed-counter.rcl', import.meta.url), 'utf8');
const cli = fileURLToPath(new URL('../src/reality-hub-cli.mjs', import.meta.url));
const fixture = fileURLToPath(new URL('../examples/sessions/governed-counter.rcl', import.meta.url));
const moduleUrl = new URL('../src/durable-session.mjs', import.meta.url).href;
const temp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-durable-test-'));
const first = { requestId: 'one', expectedRevision: 0, rule: 'increment', inputs: { 'event.delta': 3, 'event.label': 'persisted' } };

test('restart replays native transactions and an acknowledged request retries without duplication', async () => {
  const directory = temp(); let session;
  try {
    session = await openDurableRealitySession(directory, { source, verifyReference: true });
    const saved = await session.invoke(first);
    const snapshot = session.snapshot();
    await session.close();
    session = await openDurableRealitySession(directory, { expectedJournalRoot: snapshot.journalRoot, minimumRevision: 1, verifyReference: true });
    assert.notEqual(session.snapshot().native.processId, snapshot.native.processId);
    assert.equal(session.snapshot().stateRoot, snapshot.stateRoot);
    const retried = await session.invoke(first);
    assert.equal(retried.replayed, true);
    assert.deepEqual(retried.receipt, saved.receipt);
    assert.equal(session.snapshot().revision, 1);
    await assert.rejects(session.invoke({ ...first, inputs: { 'event.delta': 4 } }), error => error.code === 'RCL_SESSION_IDEMPOTENCY_CONFLICT');
    await assert.rejects(session.invoke({ ...first, requestId: 'new' }), error => error.code === 'RCL_SESSION_REVISION_CONFLICT');
    await session.close(); session = null;
    assert.equal((await verifyDurableRealitySession(directory, { verifyReference: true })).status, 'PASS');
  } finally { await session?.close(); fs.rmSync(directory, { recursive: true, force: true }); }
});

test('a live OS writer lock excludes another writer and is reusable after close', async () => {
  const directory = temp(); let owner, next;
  try {
    owner = await openDurableRealitySession(directory, { source });
    await assert.rejects(openDurableRealitySession(directory), error => error.code === 'RCL_SESSION_WRITER_BUSY_OR_LOCK_INVALID');
    await owner.close(); owner = null;
    next = await openDurableRealitySession(directory);
    assert.equal(next.snapshot().revision, 0);
  } finally { await owner?.close(); await next?.close(); fs.rmSync(directory, { recursive: true, force: true }); }
});

test('a killed real writer releases its OS lock and preserves the acknowledged command', { timeout: 15_000 }, async () => {
  const directory = temp(); let recovered;
  const code = `import fs from 'node:fs'; import {openDurableRealitySession} from ${JSON.stringify(moduleUrl)};
    const session=await openDurableRealitySession(process.argv[1],{source:fs.readFileSync(process.argv[2],'utf8')});
    await session.invoke(${JSON.stringify(first)}); console.log(JSON.stringify(session.snapshot())); setInterval(()=>{},1000);`;
  const child = spawn(process.execPath, ['--input-type=module', '-e', code, directory, fixture], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '', stderr = '';
  child.stderr.on('data', chunk => { stderr += chunk; });
  try {
    const acknowledged = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Writer did not acknowledge: ' + stderr)), 5000);
      child.stdout.on('data', chunk => { stdout += chunk; if (stdout.includes('\n')) { clearTimeout(timer); resolve(JSON.parse(stdout.trim())); } });
      child.once('error', error => { clearTimeout(timer); reject(error); });
      child.once('exit', () => { clearTimeout(timer); reject(new Error('Writer exited: ' + stderr)); });
    });
    const exited = once(child, 'exit'); child.kill(); await exited;
    for (let attempt = 0; attempt < 30; attempt++) {
      try { recovered = await openDurableRealitySession(directory); break; }
      catch (error) { if (error.code !== 'RCL_SESSION_WRITER_BUSY_OR_LOCK_INVALID') throw error; await new Promise(resolve => setTimeout(resolve, 25)); }
    }
    assert.ok(recovered, 'Writer OS lock must be released after its owner/pipe dies');
    assert.equal(recovered.snapshot().stateRoot, acknowledged.stateRoot);
    assert.equal(recovered.snapshot().revision, 1);
    assert.equal((await recovered.invoke(first)).replayed, true);
  } finally { child.kill(); await recovered?.close(); fs.rmSync(directory, { recursive: true, force: true }); }
});

test('an incomplete tail requires explicit recovery and its bytes are retained separately', async () => {
  const directory = temp(); let session;
  try {
    session = await openDurableRealitySession(directory, { source });
    await session.invoke(first); const snapshot = session.snapshot(); await session.close(); session = null;
    const journal = path.join(directory, 'journal.jsonl');
    const bytes = fs.readFileSync(journal);
    const tail = Buffer.from('{"format":"interrupted-write'); fs.appendFileSync(journal, tail);
    await assert.rejects(openDurableRealitySession(directory), error => error.code === 'RCL_SESSION_INCOMPLETE_TAIL');
    assert.ok(fs.readFileSync(journal).equals(Buffer.concat([bytes, tail])));
    session = await openDurableRealitySession(directory, { repairIncompleteTail: true, expectedJournalRoot: snapshot.journalRoot });
    assert.equal(session.snapshot().stateRoot, snapshot.stateRoot);
    assert.equal(session.snapshot().recovery.discardedIncompleteBytes, tail.length);
    assert.ok(fs.readFileSync(session.snapshot().recovery.backupPath).equals(tail));
    assert.ok(fs.readFileSync(journal).equals(bytes));
  } finally { await session?.close(); fs.rmSync(directory, { recursive: true, force: true }); }
});

test('valid recomputed hashes cannot substitute for native semantic replay', async () => {
  const directory = temp(); let session;
  try {
    session = await openDurableRealitySession(directory, { source }); await session.invoke(first); await session.close(); session = null;
    const journal = path.join(directory, 'journal.jsonl');
    const records = fs.readFileSync(journal, 'utf8').trim().split('\n').map(JSON.parse);
    const record = records[1];
    record.result.state['counter.value'] = 50;
    record.result.afterRoot = root(record.result.state);
    record.afterStateRoot = record.result.afterRoot; record.resultRoot = root(record.result);
    const { root: ignored, ...core } = record; record.root = root(core);
    fs.writeFileSync(journal, records.map(value => JSON.stringify(value)).join('\n') + '\n');
    await assert.rejects(openDurableRealitySession(directory), error => error.code === 'RCL_SESSION_REPLAY_MISMATCH');
  } finally { await session?.close(); fs.rmSync(directory, { recursive: true, force: true }); }
});

test('rejected rules do not append state, inputs or journal records', async () => {
  const directory = temp(); let session;
  try {
    session = await openDurableRealitySession(directory, { source });
    const initial = session.snapshot();
    const bytes = fs.readFileSync(path.join(directory, 'journal.jsonl'));
    await assert.rejects(session.invoke({ ...first, inputs: { 'event.delta': -1 } }));
    assert.equal(session.snapshot().stateRoot, initial.stateRoot);
    assert.equal(session.snapshot().journalRoot, initial.journalRoot);
    assert.ok(bytes.equals(fs.readFileSync(path.join(directory, 'journal.jsonl'))));
  } finally { await session?.close(); fs.rmSync(directory, { recursive: true, force: true }); }
});

test('an externally pinned head/revision detects an otherwise valid history truncation', async () => {
  const directory = temp(); let session;
  try {
    session = await openDurableRealitySession(directory, { source }); await session.invoke(first);
    await session.invoke({ ...first, requestId: 'two', expectedRevision: 1 }); const snapshot = session.snapshot(); await session.close(); session = null;
    const journal = path.join(directory, 'journal.jsonl');
    const lines = fs.readFileSync(journal, 'utf8').trim().split('\n'); fs.writeFileSync(journal, lines.slice(0, 2).join('\n') + '\n');
    await assert.rejects(openDurableRealitySession(directory, { minimumRevision: 2 }), error => error.code === 'RCL_SESSION_REVISION_ROLLBACK');
    await assert.rejects(openDurableRealitySession(directory, { expectedJournalRoot: snapshot.journalRoot }), error => error.code === 'RCL_SESSION_EXPECTED_HEAD_MISMATCH');
  } finally { await session?.close(); fs.rmSync(directory, { recursive: true, force: true }); }
});

test('public CLI persists and retries commands through separate real processes', () => {
  const directory = temp();
  const storage = path.join(directory, 'storage'), command = path.join(directory, 'command.json');
  const run = args => {
    const result = spawnSync(process.execPath, [cli, 'session', ...args], { encoding: 'utf8', timeout: 20_000, windowsHide: true });
    assert.equal(result.status, 0, result.stderr + result.stdout); return JSON.parse(result.stdout);
  };
  try {
    fs.writeFileSync(command, JSON.stringify(first));
    assert.equal(run(['init', fixture, storage]).revision, 0);
    assert.equal(run(['invoke', storage, command]).result.state['counter.value'], 3);
    assert.equal(run(['invoke', storage, command]).replayed, true);
    assert.equal(run(['inspect', storage]).revision, 1);
    assert.equal(run(['verify', storage, '--reference']).referenceReplayVerified, true);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
