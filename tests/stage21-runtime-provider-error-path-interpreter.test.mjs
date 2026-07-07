import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

test('Stage-21 RCL-owned runtime interpreter covers unregistered provider error path', () => {
  const out = execFileSync('node', ['scripts/verify-rcl-selfhost-stage21.mjs'], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  const report = JSON.parse(out);

  assert.equal(report.ok, true);
  assert.equal(report.stageStatus, 'RCL_OWNED_RUNTIME_PROVIDER_ERROR_PATH_SUBSET_VERIFIED');
  assert.equal(report.checks.interpreterRunsInNativeVm, true);
  assert.equal(report.checks.rclGeneratedProviderTargetRbcMatchesIndependentReference, true);
  assert.equal(report.checks.decodedProviderTargetShapeMatches, true);
  assert.equal(report.checks.nativeVmRejectsProviderTargetWithProviderMissing, true);
  assert.equal(report.checks.rclInterpreterErrorStateMatchesNativeError, true);
  assert.equal(report.checks.decodedInterpreterContainsProviderMissingRuntime, true);
  assert.equal(report.checks.boundaryHonest, true);

  assert.equal(report.target.providerMissing.bytes, 231);
  assert.equal(report.target.providerMissing.nativeFailure.code, 'RCL_NATIVE_PROVIDER_MISSING');
  assert.equal(report.runtimeComparison.rclInterpreter.providerErrorCode, report.target.providerMissing.nativeFailure.code);
  assert.equal(report.runtimeComparison.rclInterpreter.providerErrorMessage, "Provider 'echo' is not registered for capability 'echo.text'");
  assert.equal(report.runtimeComparison.rclInterpreter.providerStackCount, 0);
  assert.equal(report.runtimeComparison.rclInterpreter.providerStateCount, 0);
  assert.equal(report.boundaries.notYetImplemented.includes('not registered-provider failure parity'), true);
});
