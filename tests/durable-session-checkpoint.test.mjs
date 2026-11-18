import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  openDurableRealitySession,
  verifyDurableRealitySession,
  verifyDurableRealitySessionBackup,
  verifyDurableRealitySessionHistoryPages,
  RCL_SESSION_CHECKPOINT_FORMAT,
  RCL_SESSION_CHECKPOINT_CHAIN_FORMAT,
  RCL_SESSION_CHECKPOINT_SEQUENCE_FORMAT,
} from '../src/index.mjs';
import { RCL_SEMANTIC_STATE_ROOT_V3_CANDIDATE } from '../src/semantic-state-root.mjs';
import { semanticStateRootV2Stable as root } from '../src/semantic-state-root-v2.mjs';

const fixture = fileURLToPath(new URL('../examples/sessions/governed-counter.rcl', import.meta.url));
const source = fs.readFileSync(fixture, 'utf8');
const cli = fileURLToPath(new URL('../src/reality-hub-cli.mjs', import.meta.url));
const temp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-checkpoint-test-'));
const command = (expectedRevision, delta, mode = 'realize') => ({
  requestId: 'request-' + expectedRevision,
  expectedRevision,
  rule: 'increment', mode,
  inputs: { 'event.delta': delta, 'event.label': '检查点' },
});

function writeCheckpointFixture(directory, manifest) {
  const bytes = Buffer.from(JSON.stringify(manifest) + '\n');
  const checkpointRoot = createHash('sha256').update(bytes).digest('hex');
  fs.writeFileSync(path.join(directory, 'checkpoint.json'), bytes);
  const journal = path.join(directory, 'journal.jsonl');
  const [first, ...suffix] = fs.readFileSync(journal, 'utf8').split('\n');
  const { root: _headerRoot, ...header } = JSON.parse(first);
  header.checkpointRoot = checkpointRoot;
  fs.writeFileSync(journal, [JSON.stringify({ ...header, root: root(header) }), ...suffix].join('\n'));
  return checkpointRoot;
}

for (const algorithm of ['rcl.semantic-state-root.v2', RCL_SEMANTIC_STATE_ROOT_V3_CANDIDATE]) {
  test(`checkpoint resumes ${algorithm} with the same receipts, idempotency and history`, async () => {
    const parent = temp(); let live, resumed;
    try {
      const original = path.join(parent, 'original'), continuation = path.join(parent, 'continuation');
      const native = { stateRootAlgorithm: algorithm };
      live = await openDurableRealitySession(original, { source, native, verifyReference: true });
      const initialStateRoot = live.snapshot().stateRoot;
      const first = await live.invoke(command(0, 3));
      const prefix = fs.readFileSync(path.join(original, 'journal.jsonl'));
      const checkpoint = await live.checkpoint(continuation, first.receipt.root);
      assert.equal(checkpoint.format, RCL_SESSION_CHECKPOINT_FORMAT);
      assert.equal(checkpoint.revision, 1);
      assert.deepEqual(fs.readFileSync(path.join(continuation, 'checkpoint-prefix.jsonl')), prefix);
      assert.deepEqual(fs.readFileSync(path.join(original, 'journal.jsonl')), prefix);
      await assert.rejects(openDurableRealitySession(continuation, {native}), { code: 'RCL_SESSION_CHECKPOINT_TRUSTED_ROOT_REQUIRED' });
      const options = { native, expectedCheckpointRoot: checkpoint.checkpointRoot, verifyReference: true };
      resumed = await openDurableRealitySession(continuation, options);
      assert.equal(resumed.snapshot().journalRoot, first.receipt.root);
      assert.equal(resumed.snapshot().stateRoot, first.result.afterRoot);
      assert.equal(resumed.snapshot().native.initialStateRoot, initialStateRoot);
      assert.equal(resumed.snapshot().sessionId, live.snapshot().sessionId);
      await assert.rejects(openDurableRealitySession(continuation, options), { code: 'RCL_SESSION_WRITER_BUSY_OR_LOCK_INVALID' });
      assert.deepEqual(await resumed.invoke(command(0, 3)), { ...first, replayed: true });
      await assert.rejects(resumed.invoke(command(0, 4)), { code: 'RCL_SESSION_IDEMPOTENCY_CONFLICT' });
      assert.deepEqual(await resumed.invoke(command(1, 2, 'foresee')), await live.invoke(command(1, 2, 'foresee')));
      const settled = await resumed.invoke(command(2, 1));
      assert.deepEqual(settled, await live.invoke(command(2, 1)));
      const pages = [await resumed.history({ limit: 1 }), await resumed.history({ fromRevision: 2 })];
      const history = verifyDurableRealitySessionHistoryPages(pages, {
        expectedJournalRoot: settled.receipt.root, expectedCheckpointRoot: checkpoint.checkpointRoot,
      });
      assert.equal(history.completeHistory, true);
      assert.equal(history.checkpointRevision, 1);
      const backup = path.join(parent, 'backup');
      const manifest = await resumed.backup(backup);
      await resumed.close(); resumed = null;
      const verified = await verifyDurableRealitySessionBackup(backup, { ...options, expectedBackupRoot: manifest.backupRoot });
      assert.equal(verified.journalRoot, settled.receipt.root);
      assert.equal(verified.checkpointRestored, true);
      assert.equal(verified.nativeReplayVerified, false);
      assert.equal(verified.referenceReplayVerified, false);
      assert.equal(verified.replayedSuffixCommands, 2);
      assert.equal(verified.nativeSuffixReplayVerified, true);
      assert.equal(verified.referenceSuffixReplayVerified, true);
    } finally { await resumed?.close(); await live?.close(); fs.rmSync(parent, { recursive: true, force: true }); }
  });
}

test('checkpoint admission rejects drifted source, archive and suffix before accepting a writer', async () => {
  const parent = temp(); let live;
  try {
    const original = path.join(parent, 'original'), continuation = path.join(parent, 'continue');
    live = await openDurableRealitySession(original, { source });
    const first = await live.invoke(command(0, 3));
    await assert.rejects(live.checkpoint(continuation, '0'.repeat(64)), { code: 'RCL_SESSION_EXPECTED_HEAD_MISMATCH' });
    assert.equal(fs.existsSync(continuation), false);
    const checkpoint = await live.checkpoint(continuation, first.receipt.root);
    const options = { expectedCheckpointRoot: checkpoint.checkpointRoot };
    await assert.rejects(openDurableRealitySession(continuation, { expectedCheckpointRoot: '0'.repeat(64) }),
      { code: 'RCL_SESSION_CHECKPOINT_EXPECTED_ROOT_MISMATCH' });
    const archivedPath = path.join(continuation, 'checkpoint-prefix.jsonl');
    const archived = fs.readFileSync(archivedPath);
    fs.appendFileSync(archivedPath, '\n');
    await assert.rejects(openDurableRealitySession(continuation, options), { code: 'RCL_SESSION_BACKUP_ASSET_MISMATCH' });
    fs.writeFileSync(archivedPath, archived);
    const sourcePath = path.join(continuation, 'source.rcl');
    fs.appendFileSync(sourcePath, '\n');
    await assert.rejects(openDurableRealitySession(continuation, options), { code: 'RCL_SESSION_CHECKPOINT_SOURCE_BINDING_MISMATCH' });
    fs.writeFileSync(sourcePath, source);
    const suffixPath = path.join(continuation, 'journal.jsonl');
    const suffix = fs.readFileSync(suffixPath);
    const {root: _, ...header} = JSON.parse(suffix);
    header.previousRoot = '0'.repeat(64);
    fs.writeFileSync(suffixPath, JSON.stringify({...header, root:root(header)}) + '\n');
    await assert.rejects(openDurableRealitySession(continuation, options), { code: 'RCL_SESSION_CHECKPOINT_SUFFIX_BINDING_MISMATCH' });
    fs.writeFileSync(suffixPath, suffix);
    const verified = await verifyDurableRealitySession(continuation, { ...options, expectedJournalRoot: first.receipt.root });
    assert.equal(verified.replayedSuffixCommands, 0);
    assert.equal(verified.externalCheckpointAnchorChecked, true);
  } finally { await live?.close(); fs.rmSync(parent, { recursive: true, force: true }); }
});

test('a Sequence containing an AST value remains replayable and rejects an exact-data checkpoint', async () => {
  const parent = temp(); let live;
  try {
    const original = path.join(parent, 'original'), continuation = path.join(parent, 'continue');
    const source = 'reality SequenceState { facet values : Sequence = sequence_append(empty_sequence(), facet_ast("x", "Number", "Number", "1", make_span(0, 1, 1, 1))) }';
    live = await openDurableRealitySession(original, { source });
    const { journalRoot } = live.snapshot();
    await assert.rejects(live.checkpoint(continuation, journalRoot), { code: 'RCL_SESSION_CHECKPOINT_VALUE_UNSUPPORTED' });
    assert.equal(fs.existsSync(continuation), false);
    assert.equal(live.snapshot().journalRoot, journalRoot);
  } finally { await live?.close(); fs.rmSync(parent, { recursive: true, force: true }); }
});

for (const algorithm of ['rcl.semantic-state-root.v2', RCL_SEMANTIC_STATE_ROOT_V3_CANDIDATE]) {
  test('Sequence checkpoint preserves exact replay across rollover with ' + algorithm, async () => {
    const parent = temp(); let live, resumed, rolled;
    try {
      const original = path.join(parent, 'original'), continuation = path.join(parent, 'continue');
      const second = path.join(parent, 'second'), backup = path.join(parent, 'backup');
      const source = [
        'reality NestedSequence {',
        '  facet values : Sequence = empty_sequence()',
        '  facet reported : Number = 0',
        '  facet 名称 : Text = "😀 é"',
        '  facet enabled : Truth = false',
        '  subject actor {}',
        '  emergence fill { cause actor when true',
        '    alter values <- sequence_append(empty_sequence(), sequence_append(sequence_append(sequence_append(empty_sequence(), -0), empty_sequence()), 名称))',
        '    alter enabled <- true',
        '  }',
        '  emergence readsign { cause actor when enabled',
        '    alter reported <- sequence_get(bytes_f64le(sequence_get(sequence_get(values, 0), 0)), 7)',
        '  }',
        '}',
      ].join('\n');
      const native = { stateRootAlgorithm: algorithm };
      live = await openDurableRealitySession(original, { source, native, verifyReference: true });
      const invoke = (requestId, expectedRevision, rule) => ({ requestId, expectedRevision, rule });
      const fill = invoke('fill', 0, 'fill'), first = await live.invoke(fill);
      const exported = await live.checkpoint(continuation, first.receipt.root);
      assert.equal(exported.format, RCL_SESSION_CHECKPOINT_SEQUENCE_FORMAT);
      assert.equal(exported.archiveSha256s.length, 1);
      const manifest = JSON.parse(fs.readFileSync(path.join(continuation, 'checkpoint.json')));
      assert.ok(manifest.stateWireHex.startsWith('52435031'));
      assert.equal(manifest.archives[0].checkpointRoot, null);
      await assert.rejects(openDurableRealitySession(continuation, { native }), { code: 'RCL_SESSION_CHECKPOINT_TRUSTED_ROOT_REQUIRED' });
      const options = { native, expectedCheckpointRoot: exported.checkpointRoot, verifyReference: true };
      resumed = await openDurableRealitySession(continuation, options);
      assert.deepEqual(await resumed.invoke(fill), { ...first, replayed: true });
      const event = invoke('inspect-sign', 1, 'readsign');
      const result = await resumed.invoke(event);
      assert.equal(result.result.state.reported, 128);
      assert.deepEqual(result, await live.invoke(event));
      const exportedAgain = await resumed.checkpoint(second, result.receipt.root);
      assert.equal(exportedAgain.format, RCL_SESSION_CHECKPOINT_SEQUENCE_FORMAT);
      assert.equal(exportedAgain.archiveSha256s.length, 2);
      await resumed.close(); resumed = null;
      const rolloverOptions = { ...options, expectedCheckpointRoot: exportedAgain.checkpointRoot };
      rolled = await openDurableRealitySession(second, rolloverOptions);
      assert.equal(rolled.snapshot().checkpointArchiveSegments, 2);
      const nextEvent = invoke('inspect-after-rollover', 2, 'readsign');
      const final = await rolled.invoke(nextEvent);
      assert.deepEqual(final, await live.invoke(nextEvent));
      const history = verifyDurableRealitySessionHistoryPages([await rolled.history()], {
        expectedJournalRoot: final.receipt.root, expectedCheckpointRoot: exportedAgain.checkpointRoot,
      });
      assert.equal(history.completeHistory, true);
      assert.equal(history.checkpointArchiveSegments, 2);
      const saved = await rolled.backup(backup);
      await rolled.close(); rolled = null;
      const verified = await verifyDurableRealitySessionBackup(backup, {
        ...rolloverOptions, expectedBackupRoot: saved.backupRoot, expectedJournalRoot: final.receipt.root,
      });
      assert.equal(verified.replayedArchiveCommands, 0);
      assert.equal(verified.replayedSuffixCommands, 1);
      assert.equal(verified.referenceSuffixReplayVerified, true);
      assert.equal(verified.stateRoot, final.result.afterRoot);
    } finally { await rolled?.close(); await resumed?.close(); await live?.close(); fs.rmSync(parent, { recursive: true, force: true }); }
  });
}

test('Sequence checkpoint export rejects a state deeper than the restore profile before writing a destination', async () => {
  const parent = temp(); let live;
  try {
    const source = [
      'reality TooDeep {',
      '  reckon nest(remaining : Number) -> Sequence = choose(remaining == 0, empty_sequence(), sequence_append(empty_sequence(), nest(remaining - 1)))',
      '  facet values : Sequence = nest(33)',
      '}',
    ].join('\n');
    live = await openDurableRealitySession(path.join(parent, 'original'), { source });
    const initial = live.snapshot();
    const destination = path.join(parent, 'continue');
    await assert.rejects(live.checkpoint(destination, initial.journalRoot), { code: 'RCL_SESSION_CHECKPOINT_STATE_LIMIT' });
    assert.equal(fs.existsSync(destination), false);
    assert.equal(live.snapshot().journalRoot, initial.journalRoot);
    assert.equal(live.snapshot().native.peerStatus, 'NO_EXIT_OBSERVED');
  } finally { await live?.close(); fs.rmSync(parent, { recursive: true, force: true }); }
});

test('checkpoints preserve the observable sign of zero and older manifests use full replay', async () => {
  const parent = temp(); let live, resumed;
  try {
    const original = path.join(parent, 'original'), continuation = path.join(parent, 'continue');
    const source = `reality SignedState {
      facet signed : Number = 0
      facet reported : Number = 0
      subject actor {}
      emergence zero { cause actor when true alter signed <- -0 }
      emergence observebits { cause actor when true alter reported <- sequence_get(bytes_f64le(signed), 7) }
    }`;
    live = await openDurableRealitySession(original, { source, verifyReference: true });
    const zero = await live.invoke({ requestId: 'write-zero', expectedRevision: 0, rule: 'zero' });
    const checkpoint = await live.checkpoint(continuation, zero.receipt.root);
    const manifest = JSON.parse(fs.readFileSync(path.join(continuation, 'checkpoint.json')));
    assert.deepEqual(manifest.negativeZeroFacets, ['signed']);
    assert.equal(manifest.state.signed, 0);
    const legacy = path.join(parent, 'legacy');
    fs.cpSync(continuation, legacy, { recursive: true });
    const { negativeZeroFacets: _, ...old } = manifest;
    old.format = 'rcl.session-checkpoint.v1-candidate';
    const oldRoot = writeCheckpointFixture(legacy, old);

    const inspectBits = { requestId: 'read-bits', expectedRevision: 1, rule: 'observebits' };
    const expected = await live.invoke(inspectBits);
    assert.equal(expected.result.state.reported, 128);
    for (const [store, expectedCheckpointRoot, restored] of [[continuation, checkpoint.checkpointRoot, true], [legacy, oldRoot, false]]) {
      const options = { expectedCheckpointRoot, verifyReference: true };
      resumed = await openDurableRealitySession(store, options);
      assert.deepEqual(await resumed.invoke(inspectBits), expected);
      await resumed.close(); resumed = null;
      const verified = await verifyDurableRealitySession(store, options);
      assert.equal(verified.checkpointRestored, restored);
      assert.equal(verified.nativeReplayVerified, !restored);
      assert.equal(verified.replayedArchiveCommands, restored ? 0 : 1);
      assert.equal(verified.replayedSuffixCommands, 1);
    }
  } finally { await resumed?.close(); await live?.close(); fs.rmSync(parent, { recursive: true, force: true }); }
});

test('repeated checkpoints keep exact archived segments and replay just the active segment', async () => {
  const parent = temp(); let live;
  const archived = [];
  let storage = path.join(parent, 'original'), checkpointRoot;
  try {
    live = await openDurableRealitySession(storage, { source, verifyReference: true });
    const first = await live.invoke(command(0, 1));
    for (let archive = 1; archive <= 4; archive++) {
      const bytes = fs.readFileSync(path.join(storage, 'journal.jsonl'));
      archived.push(bytes);
      const target = path.join(parent, `rollover-${archive}`);
      const exported = await live.checkpoint(target, live.snapshot().journalRoot);
      assert.equal(exported.format, archive === 1 ? RCL_SESSION_CHECKPOINT_FORMAT : RCL_SESSION_CHECKPOINT_CHAIN_FORMAT);
      assert.equal(exported.revision, archive);
      await live.close(); live = null;
      for (const [index, preserved] of archived.entries()) {
        const name = index === 0 ? 'checkpoint-prefix.jsonl' : `checkpoint-prefix-${index}.jsonl`;
        assert.deepEqual(fs.readFileSync(path.join(target, name)), preserved);
      }
      assert.deepEqual(fs.readFileSync(path.join(storage, 'journal.jsonl')), bytes);
      storage = target; checkpointRoot = exported.checkpointRoot;
      live = await openDurableRealitySession(storage, { expectedCheckpointRoot: checkpointRoot, verifyReference: true });
      assert.equal(live.snapshot().checkpointArchiveSegments, archive);
      await live.invoke(command(archive, 1));
    }
    assert.deepEqual(await live.invoke(command(0, 1)), { ...first, replayed: true });
    const head = live.snapshot().journalRoot;
    const pages = [await live.history({ limit: 2 }), await live.history({ fromRevision: 3 })];
    const verified = verifyDurableRealitySessionHistoryPages(pages, { expectedJournalRoot: head, expectedCheckpointRoot: checkpointRoot });
    assert.equal(verified.checkpointArchiveSegments, 4);
    assert.equal(verified.completeHistory, true);
    const rejected = path.join(parent, 'archive-limit');
    await assert.rejects(live.checkpoint(rejected, head), { code: 'RCL_SESSION_CHECKPOINT_ARCHIVE_LIMIT' });
    assert.equal(fs.existsSync(rejected), false);
    const backup = path.join(parent, 'backup');
    const saved = await live.backup(backup);
    await live.close(); live = null;
    const replay = await verifyDurableRealitySessionBackup(backup, {
      expectedCheckpointRoot: checkpointRoot, expectedBackupRoot: saved.backupRoot, expectedJournalRoot: head, verifyReference: true,
    });
    assert.equal(replay.checkpointArchiveSegments, 4);
    assert.equal(replay.replayedArchiveCommands, 0);
    assert.equal(replay.replayedSuffixCommands, 1);
    assert.equal(replay.stateRoot, saved.stateRoot);
    const broken = path.join(parent, 'broken-boundary');
    fs.cpSync(storage, broken, { recursive: true });
    const manifest = JSON.parse(fs.readFileSync(path.join(broken, 'checkpoint.json')));
    manifest.archives[1].checkpointRoot = '0'.repeat(64);
    const expectedCheckpointRoot = writeCheckpointFixture(broken, manifest);
    await assert.rejects(openDurableRealitySession(broken, { expectedCheckpointRoot }),
      { code: 'RCL_SESSION_CHECKPOINT_ARCHIVE_BOUNDARY_MISMATCH' });
  } finally { await live?.close(); fs.rmSync(parent, { recursive: true, force: true }); }
});

test('public CLI requires a known archive head to export and an exact checkpoint root to continue', () => {
  const parent = temp();
  try {
    const run = (...args) => {
      const result = spawnSync(process.execPath, [cli, 'session', ...args], {encoding:'utf8',timeout:15000,windowsHide:true});
      return JSON.parse(result.stdout);
    };
    const original = path.join(parent, 'original'), continuation = path.join(parent, 'continuation');
    const sourcePath = path.join(parent, 'source-with-bom.rcl');
    fs.writeFileSync(sourcePath, '\ufeff' + source);
    const genesis = run('init', sourcePath, original);
    const input = path.join(parent, 'command.json');
    fs.writeFileSync(input, JSON.stringify(command(0, 3)));
    assert.equal(run('checkpoint', original, continuation).code, 'RCL_SESSION_CLI_ARGUMENT_INVALID');
    const first = run('invoke', original, input);
    assert.equal(first.receipt.previousRoot, genesis.journalRoot);
    const checkpoint = run('checkpoint', original, continuation, '--expected-root', first.receipt.root);
    assert.equal(checkpoint.ok, true);
    assert.deepEqual(fs.readFileSync(path.join(continuation, 'source.rcl')), fs.readFileSync(sourcePath));
    assert.equal(run('invoke', continuation, input).code, 'RCL_SESSION_CHECKPOINT_TRUSTED_ROOT_REQUIRED');
    assert.equal(run('invoke', continuation, input, '--expected-checkpoint-root', checkpoint.checkpointRoot).replayed, true);
    fs.writeFileSync(input, JSON.stringify(command(1, 2)));
    const next = run('invoke', continuation, input, '--expected-checkpoint-root', checkpoint.checkpointRoot);
    assert.equal(next.receipt.sequence, 2);
    assert.equal(run('verify', continuation, '--expected-checkpoint-root', checkpoint.checkpointRoot, '--reference').replayedSuffixCommands, 1);
  } finally { fs.rmSync(parent, { recursive: true, force: true }); }
});
