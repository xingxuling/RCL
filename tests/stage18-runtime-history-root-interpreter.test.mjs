import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

test('Stage-18 RCL-owned runtime interpreter emits transaction history root preimages subset', () => {
  const out = execFileSync('node', ['scripts/verify-rcl-selfhost-stage18.mjs'], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  const report = JSON.parse(out);

  assert.equal(report.ok, true);
  assert.equal(report.stageStatus, 'RCL_OWNED_RUNTIME_HISTORY_ROOT_PREIMAGE_SUBSET_VERIFIED');
  assert.equal(report.checks.interpreterRunsInNativeVm, true);
  assert.equal(report.checks.rclGeneratedTargetRbcMatchesJsCompiler, true);
  assert.equal(report.checks.rclInterpreterStateMatchesNativeRuntime, true);
  assert.equal(report.checks.rclInterpreterStateMatchesJsRuntime, true);
  assert.equal(report.checks.rclCanonicalPreimagesMatchReferenceCanonicalReality, true);
  assert.equal(report.checks.rclPreimageHashesMatchRclEmittedRoots, true);
  assert.equal(report.checks.rclRootValuesMatchNativeAndJsHistoryRoots, true);
  assert.equal(report.checks.nativeAndJsRootPreimagesMatchProjectedState, true);
  assert.equal(report.checks.boundaryHonest, true);

  assert.equal(report.roots.expectedBeforePreimage, '{"world.ready":true,"world.status":"draft"}');
  assert.equal(report.roots.expectedAfterPreimage, '{"world.ready":true,"world.status":"published"}');
  assert.equal(report.roots.expectedBeforeRoot, '8304f203486bbcb3fc104741b8603f3eecf23bf24b8da1eeccc11a09b8d64cc6');
  assert.equal(report.roots.expectedAfterRoot, '23023719c2954b37274f61cfe00ffb28acc5871df151436c3aff9e553ddcb77b');
  assert.deepEqual(report.roots.rclBeforeRoots, [
    report.roots.expectedBeforeRoot,
    report.roots.expectedBeforeRoot,
    report.roots.expectedBeforeRoot,
  ]);
  assert.deepEqual(report.roots.rclAfterRoots, [
    report.roots.expectedAfterRoot,
    report.roots.expectedAfterRoot,
    report.roots.expectedAfterRoot,
  ]);
  assert.equal(report.runtimeComparison.nativeDirect.projections[0].beforeRoot, report.roots.expectedBeforeRoot);
  assert.equal(report.runtimeComparison.nativeDirect.projections[0].afterRoot, report.roots.expectedAfterRoot);
  assert.equal(report.runtimeComparison.nativeDirect.history[0].beforeRoot, report.roots.expectedBeforeRoot);
  assert.equal(report.runtimeComparison.nativeDirect.history[0].afterRoot, report.roots.expectedAfterRoot);
  assert.equal(report.boundaries.notYetImplemented.includes('SHA-256 hashing is still verified by JS/native host code'), true);
});
