import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

test('Stage-23 RCL-owned source lowering emits builtin and provider bytecode through the selected native VM', () => {
  const out = execFileSync('node', ['scripts/verify-rcl-selfhost-stage23.mjs'], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  const report = JSON.parse(out);

  assert.equal(report.ok, true);
  assert.equal(report.stageStatus, 'RCL_OWNED_BUILTIN_PROVIDER_SOURCE_LOWERING_SUBSET_VERIFIED');
  assert.equal(report.checks.nativeVmIsRealWindowsExecutable, true);
  assert.equal(report.checks.interpreterRunsInNativeVm, true);
  assert.equal(report.checks.rclGeneratedTargetRbcMatchesJsCompiler, true);
  assert.equal(report.checks.rclExtractedSourceFieldsMatchCompilerShape, true);
  assert.equal(report.checks.decodedTargetShapeMatches, true);
  assert.equal(report.checks.nativeVmRejectsTargetWithProviderMissingAfterBuiltinPrefix, true);
  assert.equal(report.checks.decodedInterpreterContainsBuiltinProviderSourceLoweringRuntime, true);
  assert.equal(report.checks.boundaryHonest, true);

  assert.equal(report.nativeVm.path, process.platform === 'win32' ? 'native/rclvm.exe' : 'native/rclvm');
  assert.equal(report.nativeVm.executableFormat.exists, true);
  assert.equal(report.nativeVm.executableFormat.mz, process.platform === 'win32');
  assert.equal(report.nativeVm.executableFormat.pe, process.platform === 'win32');
  assert.equal(report.target.bytes, 320);
  assert.equal(report.target.program, 'RuntimeBuiltinProviderSourceLoweringTarget');
  assert.equal(report.target.sourceRoot, report.compiler.sourceRoot);
  assert.equal(report.target.exactReferenceMatch, true);
  assert.equal(report.target.instructions[1].builtin, 'LENGTH');
  assert.equal(report.target.instructions[3].name, 'CALL_PROVIDER');
  assert.equal(report.target.nativeFailure.code, 'RCL_NATIVE_PROVIDER_MISSING');
  assert.equal(report.boundaries.notYetImplemented.includes('not a complete lexer/parser'), true);
});
