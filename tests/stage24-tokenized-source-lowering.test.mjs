import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

test('Stage-24 RCL-owned tokenized source lowering emits builtin and provider bytecode through the selected native VM', () => {
  const out = execFileSync('node', ['scripts/verify-rcl-selfhost-stage24.mjs'], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  const report = JSON.parse(out);

  assert.equal(report.ok, true);
  assert.equal(report.stageStatus, 'RCL_OWNED_TOKENIZED_SOURCE_LOWERING_SUBSET_VERIFIED');
  assert.equal(report.checks.nativeVmIsRealWindowsExecutable, true);
  assert.equal(report.checks.interpreterRunsInNativeVm, true);
  assert.equal(report.checks.rclTokenizedSourceBeforeLowering, true);
  assert.equal(report.checks.rclGeneratedTargetRbcMatchesJsCompiler, true);
  assert.equal(report.checks.rclParsedSourceFieldsMatchCompilerShape, true);
  assert.equal(report.checks.decodedTargetShapeMatches, true);
  assert.equal(report.checks.nativeVmRejectsTargetWithProviderMissingAfterBuiltinPrefix, true);
  assert.equal(report.checks.decodedInterpreterContainsTokenizedParserRuntime, true);
  assert.equal(report.checks.boundaryHonest, true);

  assert.equal(report.parser.tokenCount, 31);
  assert.equal(report.parser.firstToken, 'reality');
  assert.equal(report.parser.builtinCallToken, 'length');
  assert.equal(report.parser.providerCallToken, 'provider_call');
  assert.equal(report.nativeVm.path, process.platform === 'win32' ? 'native/rclvm.exe' : 'native/rclvm');
  assert.equal(report.target.bytes, 320);
  assert.equal(report.target.exactReferenceMatch, true);
  assert.equal(report.target.instructions[1].builtin, 'LENGTH');
  assert.equal(report.target.instructions[3].name, 'CALL_PROVIDER');
  assert.equal(report.boundaries.notYetImplemented.includes('not a complete lexer/parser'), true);
});
