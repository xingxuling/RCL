import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  compileTypedGcSnapshot,
  runTypedGcSnapshotDemo,
  compileTypedGcSnapshotFromFiles,
  loadTypedHeapSnapshot,
  verifyTypedHeapSnapshot,
  DEFAULT_TYPED_GC_SOURCE,
  DEFAULT_TYPED_GC_TYPE_MODULES,
} from '../src/index.mjs';

function writeGcFiles(dir) {
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'types'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'src/app.rcl'), DEFAULT_TYPED_GC_SOURCE);
  fs.writeFileSync(path.join(dir, 'types/core.rcltype'), DEFAULT_TYPED_GC_TYPE_MODULES['core.rcltype']);
}

test('P3 typed GC snapshot captures native typed objects, references and persistent state', () => {
  const result = compileTypedGcSnapshot();
  assert.equal(result.ok, true);
  assert.equal(result.report.format, 'rcl.typed-gc-snapshot.v0.37');
  assert.equal(result.report.heapSnapshot.format, 'rcl.typed-heap-snapshot.v0.37');
  assert.equal(result.report.objectCount, 4);
  assert.equal(result.report.referenceCount, 2);
  assert.equal(result.report.heapSnapshot.roots.some(item => item.rootPath === 'app.sessionRef' && item.rootKind === 'reference'), true);
  assert.equal(result.report.persistence.allReferencesResolved, true);
  assert.match(result.report.heapSnapshot.snapshotRoot, /^[0-9a-f]{64}$/);
  assert.match(result.report.gcSnapshotRoot, /^[0-9a-f]{64}$/);
});

test('P3 typed GC mark/sweep seed retains all reachable roots and reports deterministic sweep plan', () => {
  const result = compileTypedGcSnapshot();
  assert.equal(result.report.markSweep.kind, 'TypedHeapMarkSweepSeed');
  assert.equal(result.report.markSweep.registeredObjectCount, result.native.typedHeap.registered);
  assert.deepEqual(result.report.markSweep.markedObjectIds, [1, 2, 3, 4]);
  assert.deepEqual(result.report.markSweep.reclaimableObjectIds, []);
  assert.equal(result.report.markSweep.retainedCount, 4);
  assert.equal(result.report.markSweep.sweepCandidateCount, 0);
  assert.match(result.report.markSweep.planRoot, /^[0-9a-f]{64}$/);
});

test('P3 typed heap snapshot verifies and reloads object reference persistence', () => {
  const result = compileTypedGcSnapshot();
  const verification = verifyTypedHeapSnapshot(result.report.heapSnapshot);
  assert.equal(verification.ok, true);

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-typed-gc-snapshot-'));
  const snapshotPath = path.join(dir, 'typed-heap-snapshot.json');
  fs.writeFileSync(snapshotPath, JSON.stringify(result.report.heapSnapshot, null, 2));
  const loaded = loadTypedHeapSnapshot(snapshotPath);
  assert.equal(loaded.verification.ok, true);
  assert.equal(loaded.persistence.restoredStateRoot, result.report.persistence.stateRoot);
  assert.equal(loaded.persistence.allReferencesResolved, true);
  assert.equal(loaded.markSweep.retainedCount, 4);
});

test('P3 typed GC demo and CLI build expose snapshot evidence files', () => {
  const demo = runTypedGcSnapshotDemo();
  assert.equal(demo.ok, true);
  assert.equal(demo.objectCount, 4);
  assert.equal(demo.allReferencesResolved, true);

  const cwd = new URL('..', import.meta.url);
  const cliDemo = JSON.parse(execFileSync('node', ['src/cli.mjs', 'typed-gc-demo'], { cwd, encoding: 'utf8' }));
  assert.equal(cliDemo.ok, true);
  assert.equal(cliDemo.sweepCandidateCount, 0);

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-typed-gc-cli-'));
  writeGcFiles(dir);
  const cliBuild = JSON.parse(execFileSync('node', ['src/cli.mjs', 'typed-gc-build', path.join(dir, 'src/app.rcl'), path.join(dir, 'types'), path.join(dir, 'out')], { cwd, encoding: 'utf8' }));
  assert.equal(cliBuild.ok, true);
  assert.equal(cliBuild.loadedSnapshotOk, true);
  assert.equal(fs.existsSync(cliBuild.bytecodePath), true);
  assert.equal(fs.existsSync(cliBuild.reportPath), true);
  assert.equal(fs.existsSync(cliBuild.snapshotPath), true);
});
