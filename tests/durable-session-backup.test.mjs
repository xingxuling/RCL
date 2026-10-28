import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { openDurableRealitySession, verifyDurableRealitySessionBackup } from '../src/durable-session.mjs';
import { semanticStateRootV2Stable as root } from '../src/semantic-state-root-v2.mjs';
import { runSessionCli } from '../src/session-cli.mjs';

const source = fs.readFileSync(new URL('../examples/sessions/governed-counter.rcl', import.meta.url), 'utf8');
const command = (revision, delta = 1) => ({ requestId: 'request-' + revision, expectedRevision: revision, rule: 'increment', inputs: { 'event.delta': delta, 'event.label': 'backup' } });
const temp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-session-backup-'));

test('queued backup captures one committed prefix and restores exact roots and idempotency', async () => {
  const directory = temp(); let live, restored;
  try {
    const storage = path.join(directory, 'live'), backup = path.join(directory, 'backup');
    live = await openDurableRealitySession(storage, { source });
    const first = live.invoke(command(0, 2));
    const exporting = live.backup(backup);
    const second = live.invoke(command(1, 3));
    const [saved, manifest] = await Promise.all([first, exporting, second]);
    assert.equal(manifest.revision, 1);
    assert.equal(live.snapshot().revision, 2);
    assert.equal(manifest.journalRoot, saved.receipt.root);
    assert.equal(manifest.nativeReplayVerified, false);
    assert.deepEqual(fs.readdirSync(backup).sort(), ['backup.json', 'journal.jsonl', 'session.rbc', 'source.rcl']);
    const verified = await verifyDurableRealitySessionBackup(backup, { expectedBackupRoot: manifest.backupRoot, expectedJournalRoot: manifest.journalRoot, verifyReference: true });
    assert.equal(verified.nativeReplayVerified, true);
    assert.equal(verified.referenceReplayVerified, true);
    assert.equal(verified.stateRoot, manifest.stateRoot);
    restored = await openDurableRealitySession(backup, { expectedJournalRoot: manifest.journalRoot });
    const retry = await restored.invoke(command(0, 2));
    assert.equal(retry.replayed, true);
    assert.deepEqual(retry.receipt, saved.receipt);
    await restored.invoke(command(1, 7));
    assert.notEqual(restored.snapshot().stateRoot, live.snapshot().stateRoot);
  } finally { await restored?.close(); await live?.close(); fs.rmSync(directory, { recursive: true, force: true }); }
});

test('genesis backups verify without pretending their own roots are external anchors', async () => {
  const directory = temp(); let live;
  try {
    live = await openDurableRealitySession(path.join(directory, 'live'), { source });
    const backup = path.join(directory, 'backup'), manifest = await live.backup(backup);
    const verified = await verifyDurableRealitySessionBackup(backup);
    assert.equal(verified.revision, 0);
    assert.equal(verified.stateRoot, manifest.stateRoot);
    assert.equal(verified.externalHistoryAnchorChecked, false);
    assert.equal(verified.externalBackupAnchorChecked, false);
  } finally { await live?.close(); fs.rmSync(directory, { recursive: true, force: true }); }
});

test('existing/inside destinations and closed writers reject without altering the source', async () => {
  const directory = temp(); let live;
  try {
    const storage = path.join(directory, 'live');
    live = await openDurableRealitySession(storage, { source });
    const before = live.snapshot();
    await assert.rejects(live.backup(path.join(storage, 'backup')), error => error.code === 'RCL_SESSION_BACKUP_INSIDE_SOURCE');
    const existing = path.join(directory, 'existing'); fs.mkdirSync(existing); fs.writeFileSync(path.join(existing, 'sentinel'), 'keep');
    await assert.rejects(live.backup(existing), error => error.code === 'RCL_SESSION_BACKUP_TARGET_EXISTS');
    assert.equal(fs.readFileSync(path.join(existing, 'sentinel'), 'utf8'), 'keep');
    assert.equal(live.snapshot().journalRoot, before.journalRoot);
    await live.invoke(command(0));
    await live.close();
    await assert.rejects(live.backup(path.join(directory, 'closed')), error => error.code === 'RCL_SESSION_CLOSED_OR_DURABILITY_UNCERTAIN');
    assert.equal(fs.existsSync(path.join(directory, 'closed')), false);
  } finally { await live?.close(); fs.rmSync(directory, { recursive: true, force: true }); }
});

test('asset and manifest corruption fail before any native writer is started', async () => {
  const directory = temp(); let live;
  try {
    live = await openDurableRealitySession(path.join(directory, 'live'), { source });
    for (const name of ['source.rcl', 'session.rbc', 'journal.jsonl', 'backup.json']) {
      const backup = path.join(directory, name.replace('.', '-'));
      await live.backup(backup);
      fs.appendFileSync(path.join(backup, name), 'corrupt');
      await assert.rejects(verifyDurableRealitySessionBackup(backup), error => /^RCL_SESSION_BACKUP_(ASSET_MISMATCH|MANIFEST_INVALID)$/.test(error.code));
      assert.equal(fs.existsSync(path.join(backup, '.writer.lock')), false);
    }
  } finally { await live?.close(); fs.rmSync(directory, { recursive: true, force: true }); }
});

test('failed backup storage is unacknowledged and leaves the live writer usable', async () => {
  const directory = temp(); let live;
  const open = fs.openSync;
  try {
    live = await openDurableRealitySession(path.join(directory, 'live'), { source });
    const backup = path.join(directory, 'backup'), before = live.snapshot();
    fs.openSync = (file, ...args) => {
      if (file === path.join(backup, 'session.rbc')) throw Object.assign(new Error('injected backup storage failure'), { code: 'EIO' });
      return open(file, ...args);
    };
    try { await assert.rejects(live.backup(backup), error => error.code === 'EIO'); }
    finally { fs.openSync = open; }
    assert.equal(fs.existsSync(path.join(backup, 'backup.json')), false);
    assert.equal(live.snapshot().journalRoot, before.journalRoot);
    await live.invoke(command(0));
    assert.equal(live.snapshot().revision, 1);
  } finally { fs.openSync = open; await live?.close(); fs.rmSync(directory, { recursive: true, force: true }); }
});

test('recomputed manifest does not override replay or trusted external anchors', async () => {
  const directory = temp(); let live;
  try {
    live = await openDurableRealitySession(path.join(directory, 'live'), { source });
    const backup = path.join(directory, 'backup'), manifest = await live.backup(backup);
    const { backupRoot, ...changed } = manifest;
    delete changed.directory; delete changed.nativeReplayVerified;
    changed.stateRoot = '0'.repeat(64);
    fs.writeFileSync(path.join(backup, 'backup.json'), JSON.stringify({ ...changed, backupRoot: root(changed) }));
    await assert.rejects(verifyDurableRealitySessionBackup(backup, { expectedBackupRoot: backupRoot }), error => error.code === 'RCL_SESSION_BACKUP_EXPECTED_ROOT_MISMATCH');
    await assert.rejects(verifyDurableRealitySessionBackup(backup), error => error.code === 'RCL_SESSION_BACKUP_REPLAY_MISMATCH');
  } finally { await live?.close(); fs.rmSync(directory, { recursive: true, force: true }); }
});

test('live storage drift rejects export before creating a target', async () => {
  const directory = temp(); let live;
  try {
    const storage = path.join(directory, 'live'), target = path.join(directory, 'backup');
    live = await openDurableRealitySession(storage, { source });
    fs.appendFileSync(path.join(storage, 'journal.jsonl'), '{"partial":');
    await assert.rejects(live.backup(target), error => error.code === 'RCL_SESSION_BACKUP_SOURCE_CHANGED');
    assert.equal(fs.existsSync(target), false);
  } finally { await live?.close(); fs.rmSync(directory, { recursive: true, force: true }); }
});

test('CLI exports and verifies with explicit anchor flags and strict argument admission', async () => {
  const directory = temp(); let live;
  try {
    const storage = path.join(directory, 'live'), backup = path.join(directory, 'backup');
    live = await openDurableRealitySession(storage, { source }); await live.close();
    const exported = await runSessionCli(['backup', storage, backup]); assert.equal(exported.ok, true);
    const verified = await runSessionCli(['backup-verify', backup, '--expected-backup-root', exported.backupRoot]);
    assert.equal(verified.status, 'PASS'); assert.equal(verified.externalBackupAnchorChecked, true);
    const invalid = await runSessionCli(['backup', storage, path.join(directory, 'invalid'), '--expected-backup-root', exported.backupRoot]);
    assert.equal(invalid.code, 'RCL_SESSION_CLI_ARGUMENT_INVALID');
    assert.equal(fs.existsSync(path.join(directory, 'invalid')), false);
  } finally { await live?.close(); fs.rmSync(directory, { recursive: true, force: true }); }
});

test('public CLI creates, exports and verifies a backup in separate real processes', () => {
  const directory = temp();
  try {
    const cli = fileURLToPath(new URL('../src/reality-hub-cli.mjs', import.meta.url));
    const fixture = fileURLToPath(new URL('../examples/sessions/governed-counter.rcl', import.meta.url));
    const run = args => {
      const result = spawnSync(process.execPath, [cli, 'session', ...args], { encoding: 'utf8', timeout: 30000, windowsHide: true });
      assert.equal(result.status, 0, result.stdout + result.stderr);
      return JSON.parse(result.stdout);
    };
    const storage = path.join(directory, 'live'), backup = path.join(directory, 'backup');
    const initialized = run(['init', fixture, storage]);
    const exported = run(['backup', storage, backup, '--expected-root', initialized.journalRoot]);
    const verified = run(['backup-verify', backup, '--expected-backup-root', exported.backupRoot, '--reference']);
    assert.equal(verified.nativeReplayVerified, true);
    assert.equal(verified.referenceReplayVerified, true);
    assert.equal(verified.journalRoot, initialized.journalRoot);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
