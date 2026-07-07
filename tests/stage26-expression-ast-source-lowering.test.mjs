import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

test('Stage-26 RCL-owned expression AST source lowering emits nested builtin bytecode that runs in native rclvm.exe', () => {
  const out = execFileSync('node', ['scripts/verify-rcl-selfhost-stage26.mjs'], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
    maxBuffer: 96 * 1024 * 1024,
  });
  const report = JSON.parse(out);

  assert.equal(report.ok, true);
  assert.equal(report.stageStatus, 'RCL_OWNED_EXPRESSION_AST_SOURCE_LOWERING_SUBSET_VERIFIED');
  assert.equal(report.checks.nativeVmIsRealWindowsExecutable, true);
  assert.equal(report.checks.interpreterRunsInNativeVm, true);
  assert.equal(report.checks.rclRecursivelyParsedExpressionAst, true);
  assert.equal(report.checks.rclGeneratedTargetRbcMatchesJsCompiler, true);
  assert.equal(report.checks.rclParsedSourceFieldsMatchCompilerShape, true);
  assert.equal(report.checks.decodedTargetShapeMatches, true);
  assert.equal(report.checks.rclGeneratedTargetRunsInNativeVm, true);
  assert.equal(report.checks.decodedInterpreterContainsExpressionAstRuntime, true);
  assert.equal(report.checks.boundaryHonest, true);

  assert.equal(report.compiler.facetCount, 4);
  assert.equal(report.compiler.expressionNodeCount, 9);
  assert.equal(report.compiler.lengthArg0Name, 'trim');
  assert.equal(report.compiler.lengthNestedArg0Path, 'seed.raw');
  assert.equal(report.target.bytes, 471);
  assert.equal(report.target.exactReferenceMatch, true);
  assert.equal(report.target.instructions[3].builtin, 'TRIM');
  assert.equal(report.target.instructions[7].builtin, 'LENGTH');
  assert.equal(report.target.instructions[11].builtin, 'CONTAINS');
  assert.deepEqual(report.target.nativeRun.state, {
    'metrics.has_request': true,
    'metrics.request_size': 7,
    'seed.raw': ' request ',
    'seed.trimmed': 'request',
  });
  assert.equal(report.boundaries.notYetImplemented.includes('not a complete parser'), true);
});
