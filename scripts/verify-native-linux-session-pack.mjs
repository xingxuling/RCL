import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  openDurableRealitySession,
  verifyDurableRealitySessionBackup,
} from '../src/index.mjs';
import { DEFAULT_NATIVE_COMPILER_PATH, DEFAULT_NATIVE_VM_PATH } from '../src/native-vm.mjs';
import { RCL_SEMANTIC_STATE_ROOT_V3_CANDIDATE as v3 } from '../src/semantic-state-root.mjs';
import { compileSourceFileSelfHosted } from '../src/selfhost-compiler.mjs';

assert.equal(process.platform, 'linux');
assert.equal(process.arch, 'x64');
const root = path.resolve(import.meta.dirname, '..');
assert.equal(DEFAULT_NATIVE_COMPILER_PATH, path.join(root, 'native/linux/rclc'));
assert.equal(DEFAULT_NATIVE_VM_PATH, path.join(root, 'native/linux/rclvm'));
const cli = path.join(root, 'src/reality-hub-cli.mjs');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-linux-pack-'));
const storage = path.join(directory, 'session');
const source = '\ufeff' + `reality LinuxPack {
  facet counter : Number = base + 1
  input base : Number = 2
  facet marker : Number = -0
  subject actor { warrant world.write on counter }
  emergence increment { cause actor when true needs world.write on counter
    alter counter <- counter + base + sequence_get(bytes_f64le(marker), 7) }
}`;
const sourcePath = path.join(directory, 'source.rcl');
function callCli(args) {
  const result = spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', timeout: 30_000 });
  assert.equal(result.status, 0, result.stderr || result.stdout || result.error?.message);
  return JSON.parse(result.stdout);
}

let session, candidate;
try {
  fs.writeFileSync(sourcePath, source);
  const once = callCli(['native', sourcePath]);
  assert.deepEqual(once.state, { base: 2, counter: 3, marker: 0 });
  assert.equal(once.stateRootVerified, true);
  const vmBinding = once.nativeVmExecutionAttestation.materialization;
  assert.match(vmBinding.sourceRoot, /^[0-9a-f]{64}$/u);
  const { nativeCompilerBinding } = compileSourceFileSelfHosted(sourcePath, path.join(directory, 'source.rbc'));
  assert.equal(nativeCompilerBinding.sourceBound, true);
  assert.equal(nativeCompilerBinding.sourceRoot, vmBinding.sourceRoot);

  session = await openDurableRealitySession(storage, { source, verifyReference: true });
  const initial = session.snapshot();
  assert.equal(initial.native.sourceBound, true);
  assert.equal(initial.native.sourceRoot, vmBinding.sourceRoot);
  assert.equal(initial.stateRootAlgorithm, 'rcl.semantic-state-root.v2');
  await assert.rejects(openDurableRealitySession(storage),
    error => error.code === 'RCL_SESSION_WRITER_BUSY_OR_LOCK_INVALID');
  const command = { requestId: 'first', expectedRevision: 0, rule: 'increment', inputs: { base: 4 } };
  const accepted = await session.invoke(command);
  assert.deepEqual(accepted.result.state, { base: 4, counter: 135, marker: 0 });
  const backupDir = path.join(directory, 'backup');
  const saved = await session.backup(backupDir);
  await session.close();
  session = null;
  const verified = await verifyDurableRealitySessionBackup(backupDir, {
    expectedBackupRoot: saved.backupRoot, expectedJournalRoot: saved.journalRoot, verifyReference: true,
  });
  assert.equal(verified.nativeReplayVerified, true);
  assert.equal(verified.referenceReplayVerified, true);
  assert.equal(verified.externalBackupAnchorChecked, true);
  assert.equal(verified.stateRoot, accepted.result.afterRoot);
  session = await openDurableRealitySession(backupDir, { expectedJournalRoot: saved.journalRoot });
  const retry = await session.invoke(command);
  assert.deepEqual(retry.receipt, accepted.receipt);
  assert.equal(retry.replayed, true);
  await session.close();
  session = null;
  const inspected = callCli(['session', 'inspect', storage, '--expected-root', accepted.receipt.root]);
  assert.equal(inspected.native.sourceBound, true);
  assert.equal(inspected.revision, 1);
  assert.equal(inspected.state.counter, 135);
  const continuation = path.join(directory, 'continuation');
  const checkpoint = callCli(['session', 'checkpoint', storage, continuation, '--expected-root', accepted.receipt.root]);
  assert.match(checkpoint.checkpointRoot, /^[0-9a-f]{64}$/u);
  session = await openDurableRealitySession(continuation, { expectedCheckpointRoot: checkpoint.checkpointRoot, verifyReference: true });
  assert.deepEqual((await session.invoke(command)).receipt, accepted.receipt);
  const continued = await session.invoke({ ...command, requestId: 'next', expectedRevision: 1 });
  assert.deepEqual(continued.result.state, { base: 4, counter: 267, marker: 0 });
  await session.close();
  session = null;
  const checkpointReplay = callCli(['session', 'verify', continuation, '--expected-checkpoint-root', checkpoint.checkpointRoot,
    '--expected-root', continued.receipt.root, '--reference']);
  assert.equal(checkpointReplay.nativeReplayVerified, false);
  assert.equal(checkpointReplay.nativeSuffixReplayVerified, true);
  assert.equal(checkpointReplay.referenceSuffixReplayVerified, true);
  assert.equal(checkpointReplay.replayedSuffixCommands, 1);
  const rolloverDir = path.join(directory, 'rollover');
  const rollover = callCli(['session', 'checkpoint', continuation, rolloverDir,
    '--expected-checkpoint-root', checkpoint.checkpointRoot, '--expected-root', continued.receipt.root, '--reference']);
  session = await openDurableRealitySession(rolloverDir, { expectedCheckpointRoot: rollover.checkpointRoot });
  assert.equal(session.snapshot().checkpointArchiveSegments, 2);
  assert.deepEqual((await session.invoke(command)).receipt, accepted.receipt);
  const afterRollover = await session.invoke({ ...command, requestId: 'after-rollover', expectedRevision: 2 });
  assert.deepEqual(afterRollover.result.state, { base: 4, counter: 399, marker: 0 });
  await session.close();
  session = null;
  const rolloverReplay = callCli(['session', 'verify', rolloverDir, '--expected-checkpoint-root', rollover.checkpointRoot,
    '--expected-root', afterRollover.receipt.root, '--reference']);
  assert.equal(rolloverReplay.checkpointArchiveSegments, 2);
  assert.equal(rolloverReplay.replayedArchiveCommands, 0);
  assert.equal(rolloverReplay.replayedSuffixCommands, 1);

  const candidateOptions = { native: { stateRootAlgorithm: v3, rejectProjectedAst: true } };
  const candidateSource = `reality LinuxAst {
    facet values : Sequence = empty_sequence()
    subject actor {}
    emergence update { cause actor when true
      alter values <- sequence_append(empty_sequence(), facet_ast("n", "Number", "Number", "01", make_span(0, 1, 1, 1))) }
  }`;
  candidate = await openDurableRealitySession(path.join(directory, 'candidate'), { ...candidateOptions, source: candidateSource });
  const update = await candidate.invoke({ requestId: 'ast', expectedRevision: 0, rule: 'update' });
  assert.equal(update.result.state.values[0].literalText, '01');
  const candidateBackupDir = path.join(directory, 'candidate-backup');
  const candidateBackup = await candidate.backup(candidateBackupDir);
  await candidate.close();
  candidate = null;
  const candidateReplay = await verifyDurableRealitySessionBackup(candidateBackupDir, {
    ...candidateOptions, expectedBackupRoot: candidateBackup.backupRoot, verifyReference: true,
  });
  assert.equal(candidateReplay.nativeReplayVerified, true);
  assert.equal(candidateReplay.referenceReplayVerified, true);
  assert.equal(candidateReplay.stateRootAlgorithm, v3);
  assert.equal(candidateReplay.stateRoot, update.result.afterRoot);
  console.log(JSON.stringify({
    format: 'rcl.installed-linux-session-acceptance.v1',
    ok: true, node: process.version, platform: process.platform, architecture: process.arch, installedRoot: root,
    defaultVm: path.relative(root, DEFAULT_NATIVE_VM_PATH), defaultCompiler: path.relative(root, DEFAULT_NATIVE_COMPILER_PATH),
    vmRoot: vmBinding.binarySha256, compilerRoot: nativeCompilerBinding.binarySha256,
    daemonRoot: initial.native.daemonRoot, daemonSourceRoot: initial.native.sourceRoot, daemonSourceBound: true,
    lockContentionRejected: true, exactRetryVerified: true, sdkAndCliVerified: true,
    v2: { journalRoot: verified.journalRoot, stateRoot: verified.stateRoot, backupRoot: verified.backupRoot },
    v3: { journalRoot: candidateReplay.journalRoot, stateRoot: candidateReplay.stateRoot, literalText: '01', backupRoot: candidateReplay.backupRoot },
    checkpoint: { root: checkpoint.checkpointRoot, journalRoot: checkpointReplay.journalRoot,
      stateRoot: checkpointReplay.stateRoot, replayedSuffixCommands: checkpointReplay.replayedSuffixCommands, numberSignBitsVerified: true },
    rollover: { root: rollover.checkpointRoot, journalRoot: rolloverReplay.journalRoot,
      archivedSegments: rolloverReplay.checkpointArchiveSegments, replayedSuffixCommands: rolloverReplay.replayedSuffixCommands },
  }, null, 2));
} finally {
  await session?.close();
  await candidate?.close();
  fs.rmSync(directory, { recursive: true, force: true });
}
