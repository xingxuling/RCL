import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  runSourceMapPatchQueueDemo,
  runSourceMapPatchQueue,
  buildSourceMapPatchQueueSpec,
  renderSourceMapPatchQueueRcl,
  writeSourceMapPatchQueueReports,
} from '../src/source-map-patch-queue.mjs';

test('v0.81 establishes source map patch queue and code execution oracle seed', () => {
  const bundle = runSourceMapPatchQueueDemo();
  assert.equal(bundle.ok, true);
  assert.equal(bundle.result.version, '0.81.0-alpha.1');
  assert.equal(bundle.result.sourceMapPatchQueueEstablished, true);
  assert.ok(bundle.result.mappedSourceFileCount >= 7);
  assert.equal(bundle.result.patchQueueItemCount, 8);
  assert.ok(bundle.result.executablePatchItemCount >= 3);
  assert.equal(bundle.result.oracleProviderSeedEstablished, true);
  assert.equal(bundle.result.oracleCheckCount, 3);
  assert.equal(bundle.result.oraclePassedCount, 3);
  assert.equal(bundle.result.localTempExecutionOnly, true);
  assert.equal(bundle.result.noNetwork, true);
  assert.equal(bundle.result.noRemoteMutation, true);
  assert.equal(bundle.result.noWorktreeMutationByOracle, true);
  assert.equal(bundle.result.humanFinalAuthorityKept, true);
  assert.equal(bundle.result.canApplyRealPatchesWithoutOuterExecutor, false);
});

test('v0.81 source map records existing project files and ownership metadata', () => {
  const bundle = runSourceMapPatchQueue({ worktreeRoot: '.' });
  const paths = bundle.sourceMap.entries.map(e => e.path);
  assert.ok(paths.includes('src/self-upgrade-team-sandbox.mjs'));
  assert.ok(paths.includes('tests/self-upgrade-team-sandbox.test.mjs'));
  assert.ok(paths.includes('src/cli.mjs'));
  assert.ok(bundle.sourceMap.entries.some(e => e.kind === 'runtime-source'));
  assert.ok(bundle.sourceMap.entries.some(e => e.kind === 'test-source'));
  assert.ok(bundle.sourceMap.entries.every(e => e.entryRoot));
});

test('v0.81 patch queue materializes file-level operations with rollback and guards', () => {
  const bundle = runSourceMapPatchQueueDemo();
  const paths = bundle.patchQueue.items.map(i => i.path);
  assert.ok(paths.includes('src/source-map-patch-queue.mjs'));
  assert.ok(paths.includes('tests/source-map-patch-queue.test.mjs'));
  assert.ok(paths.includes('src/cli.mjs'));
  assert.ok(paths.includes('src/index.mjs'));
  assert.ok(paths.includes('examples/source-map-patch-queue/default-source-map-patch-queue.json'));
  assert.ok(bundle.patchQueue.rollbackPlan.length >= 4);
  assert.ok(bundle.patchQueue.humanAuthorityRequiredBefore.includes('git push'));
  assert.ok(bundle.patchQueue.items.every(i => i.semanticGuard.includes('no_remote_mutation')));
});

test('v0.81 code execution oracle uses local temp syntax checks and forbids remote mutation', () => {
  const bundle = runSourceMapPatchQueueDemo();
  assert.equal(bundle.oracle.providerClass, 'local deterministic syntax oracle');
  assert.equal(bundle.oracle.executionMode, 'local-temp-node-check');
  assert.equal(bundle.oracle.allowNetwork, false);
  assert.equal(bundle.oracle.allowRemoteRepositoryMutation, false);
  assert.equal(bundle.oracle.allowWorktreeMutationByOracle, false);
  assert.equal(bundle.oracle.oracleReady, true);
  assert.ok(bundle.oracle.checks.every(c => c.passed));
  assert.ok(bundle.oracle.checks.every(c => c.command.includes('--check')));
});

test('v0.81 writes reports and renders RCL handoff', () => {
  const outDir = path.join(os.tmpdir(), `rcl-source-map-patch-queue-${Date.now()}`);
  fs.rmSync(outDir, { recursive: true, force: true });
  const report = writeSourceMapPatchQueueReports(outDir, buildSourceMapPatchQueueSpec());
  assert.equal(report.ok, true);
  assert.ok(fs.existsSync(path.join(outDir, 'source-map-patch-queue-result.json')));
  assert.ok(fs.existsSync(path.join(outDir, 'source-map.json')));
  assert.ok(fs.existsSync(path.join(outDir, 'source-map.md')));
  assert.ok(fs.existsSync(path.join(outDir, 'patch-queue.json')));
  assert.ok(fs.existsSync(path.join(outDir, 'patch-queue.md')));
  assert.ok(fs.existsSync(path.join(outDir, 'oracle-report.json')));
  assert.ok(fs.existsSync(path.join(outDir, 'oracle-report.md')));
  assert.ok(fs.existsSync(path.join(outDir, 'validation-plan.md')));
  assert.ok(fs.existsSync(path.join(outDir, 'evidence-ledger.md')));
  assert.ok(fs.existsSync(path.join(outDir, 'release-verdict.md')));
  assert.ok(fs.existsSync(path.join(outDir, 'source-map-patch-queue.rcl')));
  assert.ok(fs.existsSync(path.join(outDir, 'canonical-root.txt')));
  const rcl = renderSourceMapPatchQueueRcl(buildSourceMapPatchQueueSpec());
  assert.match(rcl, /SourceMapPatchQueueV081/);
  assert.match(rcl, /local temp node --check/);
  assert.match(rcl, /v0\.82 Real Patch Apply Sandbox/);
});
