import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

test('Stage-25 RCL-owned facet AST source lowering emits literal, LOAD_STATE builtin and provider bytecode through native rclvm.exe', () => {
  const out = execFileSync('node', ['scripts/verify-rcl-selfhost-stage25.mjs'], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  const report = JSON.parse(out);

  assert.equal(report.ok, true);
  assert.equal(report.stageStatus, 'RCL_OWNED_FACET_AST_SOURCE_LOWERING_SUBSET_VERIFIED');
  assert.equal(report.checks.nativeVmIsRealWindowsExecutable, true);
  assert.equal(report.checks.interpreterRunsInNativeVm, true);
  assert.equal(report.checks.rclRecursivelyParsedFacetList, true);
  assert.equal(report.checks.rclBuiltLiteralFacetAst, true);
  assert.equal(report.checks.rclGeneratedTargetRbcMatchesJsCompiler, true);
  assert.equal(report.checks.rclParsedSourceFieldsMatchCompilerShape, true);
  assert.equal(report.checks.decodedTargetShapeMatches, true);
  assert.equal(report.checks.nativeVmRejectsTargetWithProviderMissingAfterLiteralAndBuiltinPrefix, true);
  assert.equal(report.checks.decodedInterpreterContainsFacetAstParserRuntime, true);
  assert.equal(report.checks.boundaryHonest, true);

  assert.deepEqual(report.parser.facetStarts, [3, 11, 24]);
  assert.equal(report.compiler.literalAst.kind, 'FacetDecl');
  assert.equal(report.compiler.literalAst.path, 'seed.request');
  assert.equal(report.compiler.builtinArg0, 'seed.request');
  assert.equal(report.nativeVm.path, 'native/rclvm.exe');
  assert.equal(report.target.bytes, 361);
  assert.equal(report.target.exactReferenceMatch, true);
  assert.equal(report.target.instructions[2].name, 'LOAD_STATE');
  assert.equal(report.target.instructions[3].builtin, 'LENGTH');
  assert.equal(report.target.instructions[5].name, 'CALL_PROVIDER');
  assert.equal(report.boundaries.notYetImplemented.includes('not complete expression AST construction'), true);
});
