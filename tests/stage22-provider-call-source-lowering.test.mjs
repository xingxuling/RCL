import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

test('Stage-22 RCL-owned source lowering emits provider_call bytecode through native rclvm.exe', () => {
  const out = execFileSync('node', ['scripts/verify-rcl-selfhost-stage22.mjs'], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  const report = JSON.parse(out);

  assert.equal(report.ok, true);
  assert.equal(report.stageStatus, 'RCL_OWNED_PROVIDER_CALL_SOURCE_LOWERING_SUBSET_VERIFIED');
  assert.equal(report.checks.nativeVmIsRealWindowsExecutable, true);
  assert.equal(report.checks.interpreterRunsInNativeVm, true);
  assert.equal(report.checks.rclGeneratedTargetRbcMatchesJsCompiler, true);
  assert.equal(report.checks.rclExtractedSourceFieldsMatchCompilerShape, true);
  assert.equal(report.checks.decodedTargetShapeMatches, true);
  assert.equal(report.checks.nativeVmRejectsTargetWithProviderMissing, true);
  assert.equal(report.checks.decodedInterpreterContainsSourceLoweringRuntime, true);
  assert.equal(report.checks.boundaryHonest, true);

  assert.equal(report.nativeVm.path, 'native/rclvm.exe');
  assert.equal(report.nativeVm.executableFormat.mz, true);
  assert.equal(report.nativeVm.executableFormat.pe, true);
  assert.equal(report.target.bytes, 241);
  assert.equal(report.target.program, 'RuntimeProviderSourceLoweringTarget');
  assert.equal(report.target.sourceRoot, report.compiler.sourceRoot);
  assert.equal(report.target.exactReferenceMatch, true);
  assert.equal(report.target.nativeFailure.code, 'RCL_NATIVE_PROVIDER_MISSING');
  assert.equal(report.target.nativeFailure.message, "Provider 'echo' is not registered for capability 'echo.text'");
  assert.equal(report.boundaries.notYetImplemented.includes('not a full parser'), true);
});
