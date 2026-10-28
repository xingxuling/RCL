import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { openDurableRealitySession, RCL_SESSION_HISTORY_FORMAT } from '../src/durable-session.mjs';
import { semanticStateRootV2Stable as root } from '../src/semantic-state-root-v2.mjs';
import { runSessionCli } from '../src/session-cli.mjs';

const source = fs.readFileSync(new URL('../examples/sessions/governed-counter.rcl', import.meta.url), 'utf8');
const command = revision => ({ requestId: `history-${revision}`, expectedRevision: revision, rule: 'increment', inputs: { 'event.delta': revision + 1, 'event.label': 'history' } });
const temporary = () => fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-session-history-'));
const validPage = page => { const { pageRoot, ...core } = page; assert.equal(pageRoot, root(core)); return page; };

test('history captures the queued committed prefix and a checkable receipt chain', async () => {
  const directory = temporary(); let session;
  try {
    session = await openDurableRealitySession(directory, { source });
    const genesis = session.snapshot();
    const first = session.invoke(command(0)), reading = session.history({ limit: 1 }), second = session.invoke(command(1));
    const [saved, page] = await Promise.all([first, reading, second]);
    validPage(page);
    assert.equal(page.format, RCL_SESSION_HISTORY_FORMAT); assert.equal(page.revision, 1);
    assert.equal(page.journalRoot, saved.receipt.root); assert.equal(page.previousRoot, genesis.journalRoot);
    assert.equal(page.entries[0].previousRoot, page.previousRoot); assert.equal(page.nextRevision, null);
    assert.equal(page.entries[0].root, page.journalRoot); assert.equal(session.snapshot().revision, 2);
  } finally { await session?.close(); fs.rmSync(directory, { recursive: true, force: true }); }
});

test('paged history preserves anchors, forecast receipts, idempotency and immutable copies', async () => {
  const directory = temporary(); let session;
  try {
    session = await openDurableRealitySession(directory, { source, verifyReference: true });
    const first = await session.invoke(command(0));
    await session.invoke({ ...command(1), mode: 'foresee' });
    await session.invoke(command(2));
    const before = session.snapshot(), bytes = fs.readFileSync(path.join(directory, 'journal.jsonl'));
    assert.equal((await session.invoke(command(0))).replayed, true);
    const one = validPage(await session.history({ limit: 2, expectedJournalRoot: before.journalRoot }));
    assert.equal(one.entries.length, 2); assert.equal(one.nextRevision, 3);
    assert.equal(one.entries[1].command.mode, 'foresee'); assert.equal(one.entries[1].result.status, 'projected');
    const two = validPage(await session.history({ fromRevision: one.nextRevision, limit: 2, expectedJournalRoot: one.journalRoot }));
    assert.equal(two.entries.length, 1); assert.equal(two.entries[0].previousRoot, one.entries.at(-1).root);
    assert.equal(two.previousRoot, one.entries.at(-1).root); assert.equal(two.entries[0].root, two.journalRoot);
    const empty = validPage(await session.history({ fromRevision: 4 }));
    assert.deepEqual(empty.entries, []); assert.equal(empty.previousRoot, before.journalRoot); assert.equal(empty.nextRevision, null);
    one.entries[0].result.state['counter.value'] = 999; one.entries[0].root = 'corrupt';
    assert.deepEqual((await session.history({ limit: 1 })).entries[0], first.receipt);
    assert.deepEqual(session.snapshot(), before); assert.deepEqual(fs.readFileSync(path.join(directory, 'journal.jsonl')), bytes);
  } finally { await session?.close(); fs.rmSync(directory, { recursive: true, force: true }); }
});

test('history roots reproduce after native replay and an actual CLI process', async () => {
  const directory = temporary(); let session;
  try {
    session = await openDurableRealitySession(directory, { source });
    await session.invoke(command(0)); const page = await session.history();
    await session.close(); session = null;
    const cli = fileURLToPath(new URL('../src/reality-hub-cli.mjs', import.meta.url));
    const result = spawnSync(process.execPath, [cli, 'session', 'history', directory, '--expected-root', page.journalRoot, '--from-revision', '1', '--limit', '100', '--reference'], { encoding: 'utf8', windowsHide: true, timeout: 30000 });
    assert.equal(result.status, 0, result.stderr);
    const { ok, ...actual } = JSON.parse(result.stdout);
    assert.equal(ok, true); assert.deepEqual(actual, page);
    session = await openDurableRealitySession(directory);
    assert.deepEqual(await session.history(), page);
  } finally { await session?.close(); fs.rmSync(directory, { recursive: true, force: true }); }
});

test('stale pagination pins and invalid ranges fail without poisoning the writer', async () => {
  const directory = temporary(); let session;
  try {
    session = await openDurableRealitySession(directory, { source });
    const genesis = session.snapshot().journalRoot;
    await session.invoke(command(0));
    await assert.rejects(session.history({ expectedJournalRoot: genesis }), error => error.code === 'RCL_SESSION_EXPECTED_HEAD_MISMATCH');
    for (const options of [null, [], { fromRevision: 0 }, { fromRevision: 3 }, { fromRevision: 1.1 }, { limit: 0 }, { limit: 1001 }, { unknown: true }, { expectedJournalRoot: 'bad' }]) {
      await assert.rejects(session.history(options), error => /^RCL_SESSION_HISTORY_/u.test(error.code));
    }
    await session.invoke(command(1)); assert.equal((await session.history()).entries.length, 2);
    await session.close();
    await assert.rejects(session.history(), error => error.code === 'RCL_SESSION_CLOSED_OR_DURABILITY_UNCERTAIN');
  } finally { await session?.close(); fs.rmSync(directory, { recursive: true, force: true }); }
});

test('empty genesis history is explicit and does not manufacture command receipts', async () => {
  const directory = temporary(); let session;
  try {
    session = await openDurableRealitySession(directory, { source });
    const page = validPage(await session.history());
    assert.equal(page.revision, 0); assert.deepEqual(page.entries, []);
    assert.equal(page.previousRoot, page.journalRoot); assert.equal(page.nextRevision, null);
  } finally { await session?.close(); fs.rmSync(directory, { recursive: true, force: true }); }
});

test('history CLI validates pagination before creating storage and confines flags to history', async () => {
  const directory = temporary(), absent = path.join(directory, 'absent');
  try {
    for (const flags of [['--from-revision', '0'], ['--limit', '1001'], ['--limit', '2', '--limit', '3'], ['--from-revision', 'NaN'], ['--from-revision']]) {
      const result = await runSessionCli(['history', absent, ...flags]);
      assert.equal(result.code, 'RCL_SESSION_CLI_ARGUMENT_INVALID'); assert.equal(fs.existsSync(absent), false);
    }
    assert.equal((await runSessionCli(['inspect', absent, '--limit', '2'])).code, 'RCL_SESSION_CLI_ARGUMENT_INVALID');
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
