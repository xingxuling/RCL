import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDurableRealitySession, verifyDurableRealitySessionHistoryPage as verifyPage } from '../src/index.mjs';
import { semanticStateRootV2Stable as root } from '../src/semantic-state-root-v2.mjs';
import { commandIdentityForRecord, resultIdentityForRecord } from './fixtures/durable-history-identities.mjs';

const source = `reality MetadataInputs {
  input __rclKind : Text = "seed"
  input __rclType : Text = "seed"
  facet value : Number = 0
  subject actor { warrant state.write on value }
  emergence observe { cause actor when false needs state.write on value alter value <- value + 1 }
  emergence commit { cause actor when true needs state.write on value alter value <- value + 1 }
}`;
const command = (revision = 0, type = 'A', rule = 'observe', requestId = `request-${revision}`) => ({ requestId, expectedRevision: revision, rule, inputs: { __rclKind: 'Record', __rclType: type } });
const temporary = () => fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-identity-v2-'));
const cleanup = directory => { assert.equal(path.dirname(directory), os.tmpdir()); assert.ok(path.basename(directory).startsWith('rcl-identity-v2-')); fs.rmSync(directory, { recursive: true, force: true }); };
const reroot = value => { const { root: omitted, ...core } = value; value.root = root(core); };
function writeRecords(directory, records) {
  let previous = null;
  for (const [index, record] of records.entries()) {
    record.previousRoot = previous;
    if (index) { record.commandRoot = commandIdentityForRecord(record); record.resultRoot = resultIdentityForRecord(record); }
    reroot(record); previous = record.root;
  }
  fs.writeFileSync(path.join(directory, 'journal.jsonl'), records.map(record => JSON.stringify(record)).join('\n') + '\n');
}
const records = directory => fs.readFileSync(path.join(directory, 'journal.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
function makeLegacy(directory) {
  const items = records(directory); items[0].format = 'rcl.session-journal-genesis.v1'; items[0].journalFormat = 'rcl.session-journal.v1';
  for (const record of items.slice(1)) record.format = 'rcl.session-journal-command.v1';
  writeRecords(directory, items); return items.at(-1).root;
}

test('v2 exact input-map identity rejects changed metadata-like inputs before and after restart', async () => {
  const directory = temporary(); let session;
  try {
    session = await openDurableRealitySession(directory, { source, verifyReference: true });
    const first = await session.invoke(command()), head = session.snapshot();
    assert.equal(records(directory)[0].journalFormat, 'rcl.session-journal.v2');
    assert.equal(first.receipt.format, 'rcl.session-journal-command.v2');
    const bytes = fs.readFileSync(path.join(directory, 'journal.jsonl'));
    await assert.rejects(session.invoke(command(0, 'B')), { code: 'RCL_SESSION_IDEMPOTENCY_CONFLICT' });
    assert.equal((await session.invoke(command())).replayed, true);
    assert.deepEqual(fs.readFileSync(path.join(directory, 'journal.jsonl')), bytes);
    await session.close(); session = await openDurableRealitySession(directory, { expectedJournalRoot: head.journalRoot, verifyReference: true });
    await assert.rejects(session.invoke(command(0, 'B')), { code: 'RCL_SESSION_IDEMPOTENCY_CONFLICT' });
    assert.equal((await session.invoke(command())).replayed, true);
  } finally { await session?.close(); cleanup(directory); }
});

test('a forged metadata input cannot pass a v2 command binding even when the outer semantic hash is unchanged', async () => {
  const directory = temporary(); let session;
  try {
    session = await openDurableRealitySession(directory, { source }); await session.invoke(command());
    const page = await session.history(), forged = structuredClone(page);
    forged.entries[0].command.inputs.__rclType = 'B'; forged.entries[0].result.command.inputs.__rclType = 'B';
    const { root: ignored, ...core } = forged.entries[0];
    assert.equal(root(core), page.entries[0].root, 'the known layout-normalizing payload hash alone is insufficient');
    assert.throws(() => verifyPage(forged, { expectedJournalRoot: page.journalRoot }), { code: 'RCL_SESSION_HISTORY_COMMAND_INVALID' });
    await session.close(); session = null;
    const items = records(directory); items[1].command.inputs.__rclType = 'B'; items[1].result.command.inputs.__rclType = 'B';
    fs.writeFileSync(path.join(directory, 'journal.jsonl'), items.map(item => JSON.stringify(item)).join('\n') + '\n');
    await assert.rejects(openDurableRealitySession(directory), { code: 'RCL_SESSION_JOURNAL_COMMAND_BINDING_MISMATCH' });
  } finally { await session?.close(); cleanup(directory); }
});

test('v2 result identity binds the displayed command and complete facet map independently of heap-layout normalization', async () => {
  for (const field of ['command', 'state']) {
    const directory = temporary(); let session;
    try {
      session = await openDurableRealitySession(directory, { source, verifyReference: true }); await session.invoke(command(0, 'A', 'commit'));
      const page = await session.history(), forged = structuredClone(page);
      if (field === 'command') forged.entries[0].result.command.inputs.__rclType = 'B';
      else forged.entries[0].result.state.__rclType = 'B';
      assert.throws(() => verifyPage(forged, { expectedJournalRoot: page.journalRoot }), { code: 'RCL_SESSION_HISTORY_RESULT_INVALID' });
      await session.close(); session = null;
      const items = records(directory); items[1].result = forged.entries[0].result;
      fs.writeFileSync(path.join(directory, 'journal.jsonl'), items.map(item => JSON.stringify(item)).join('\n') + '\n');
      await assert.rejects(openDurableRealitySession(directory), { code: 'RCL_SESSION_JOURNAL_COMMAND_BINDING_MISMATCH' });
    } finally { await session?.close(); cleanup(directory); }
  }
});

test('legacy replay and exact retries remain compatible, then v2 append preserves every legacy byte and root', async () => {
  const directory = temporary(); let session;
  try {
    session = await openDurableRealitySession(directory, { source }); await session.invoke(command()); await session.close(); session = null;
    const oldHead = makeLegacy(directory), prefix = fs.readFileSync(path.join(directory, 'journal.jsonl'));
    session = await openDurableRealitySession(directory, { expectedJournalRoot: oldHead, verifyReference: true });
    assert.equal((await session.invoke(command())).replayed, true);
    await assert.rejects(session.invoke(command(0, 'B')), { code: 'RCL_SESSION_IDEMPOTENCY_CONFLICT' });
    await session.invoke(command(1, 'B'));
    const page = await session.history(), report = verifyPage(page, { expectedJournalRoot: session.snapshot().journalRoot });
    assert.deepEqual(page.entries.map(item => item.format), ['rcl.session-journal-command.v1', 'rcl.session-journal-command.v2']);
    assert.equal(fs.readFileSync(path.join(directory, 'journal.jsonl')).subarray(0, prefix.length).equals(prefix), true);
    assert.equal(report.status, 'LEGACY_IDENTITY_LIMITED'); assert.equal(report.legacyCommandEntries, 1); assert.equal(report.contentAnchored, false);
    const tail = await session.history({ fromRevision: 2 });
    assert.equal(verifyPage(tail, { expectedJournalRoot: page.journalRoot }).contentAnchored, true);
    await session.close(); session = await openDurableRealitySession(directory, { verifyReference: true });
    assert.equal(session.snapshot().revision, 2);
  } finally { await session?.close(); cleanup(directory); }
});

test('legacy ambiguous content is reported with limits rather than retroactively authenticated by a head/page pin', async () => {
  const directory = temporary(); let session;
  try {
    session = await openDurableRealitySession(directory, { source }); await session.invoke(command()); await session.close(); session = null;
    makeLegacy(directory); session = await openDurableRealitySession(directory);
    const page = await session.history(), forged = structuredClone(page);
    forged.entries[0].command.inputs.__rclType = 'B'; forged.entries[0].result.command.inputs.__rclType = 'B';
    for (const pins of [{ expectedJournalRoot: page.journalRoot }, { expectedPageRoot: page.pageRoot }]) {
      const report = verifyPage(forged, pins); assert.equal(report.status, 'LEGACY_IDENTITY_LIMITED'); assert.equal(report.contentAnchored, false);
    }
  } finally { await session?.close(); cleanup(directory); }
});

test('v2 genesis or an upgraded v1 stream cannot downgrade to legacy command identities', async () => {
  for (const legacy of [false, true]) {
    const directory = temporary(); let session;
    try {
      session = await openDurableRealitySession(directory, { source }); await session.invoke(command()); await session.close(); session = null;
      if (legacy) makeLegacy(directory);
      session = await openDurableRealitySession(directory); await session.invoke(command(1, 'B')); await session.invoke(command(2, 'C')); await session.close(); session = null;
      const items = records(directory); items.at(-1).format = 'rcl.session-journal-command.v1'; writeRecords(directory, items);
      await assert.rejects(openDurableRealitySession(directory), { code: 'RCL_SESSION_JOURNAL_CONTINUITY_MISMATCH' });
    } finally { await session?.close(); cleanup(directory); }
  }
});
