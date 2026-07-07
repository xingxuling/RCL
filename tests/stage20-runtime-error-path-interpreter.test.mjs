import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

test('Stage-20 RCL-owned runtime interpreter covers authority and preserve error paths', () => {
  const out = execFileSync('node', ['scripts/verify-rcl-selfhost-stage20.mjs'], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  const report = JSON.parse(out);

  assert.equal(report.ok, true);
  assert.equal(report.stageStatus, 'RCL_OWNED_RUNTIME_ERROR_PATH_SUBSET_VERIFIED');
  assert.equal(report.checks.interpreterRunsInNativeVm, true);
  assert.equal(report.checks.rclGeneratedDeniedTargetRbcMatchesIndependentReference, true);
  assert.equal(report.checks.rclGeneratedPreserveTargetRbcMatchesIndependentReference, true);
  assert.equal(report.checks.decodedDeniedTargetShapeMatches, true);
  assert.equal(report.checks.decodedPreserveTargetShapeMatches, true);
  assert.equal(report.checks.nativeVmRejectsDeniedTargetWithAuthorityDenied, true);
  assert.equal(report.checks.nativeVmRejectsPreserveTargetWithRealityBoundBroken, true);
  assert.equal(report.checks.rclInterpreterErrorStateMatchesNativeErrors, true);
  assert.equal(report.checks.decodedInterpreterContainsErrorPathRuntime, true);
  assert.equal(report.checks.boundaryHonest, true);

  assert.equal(report.targets.denied.bytes, 486);
  assert.equal(report.targets.preserve.bytes, 516);
  assert.equal(report.targets.denied.nativeFailure.code, 'RCL_AUTHORITY_DENIED');
  assert.equal(report.targets.preserve.nativeFailure.code, 'RCL_REALITY_BOUND_BROKEN');
  assert.equal(report.runtimeComparison.rclInterpreter.deniedErrorCode, report.targets.denied.nativeFailure.code);
  assert.equal(report.runtimeComparison.rclInterpreter.preserveErrorCode, report.targets.preserve.nativeFailure.code);
  assert.equal(report.runtimeComparison.rclInterpreter.deniedWorldStatus, 'draft');
  assert.equal(report.runtimeComparison.rclInterpreter.preserveWorldStatus, 'draft');
  assert.equal(report.runtimeComparison.rclInterpreter.deniedHistoryCount, 0);
  assert.equal(report.runtimeComparison.rclInterpreter.preserveHistoryCount, 0);
  assert.equal(report.boundaries.notYetImplemented.includes('not full provider failure parity'), true);
});
