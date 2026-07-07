import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

test('Stage-27 RCL-owned rule/emergence source lowering emits transaction bytecode that runs in native rclvm.exe', () => {
  const out = execFileSync('node', ['scripts/verify-rcl-selfhost-stage27.mjs'], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
    maxBuffer: 96 * 1024 * 1024,
  });
  const report = JSON.parse(out);

  assert.equal(report.ok, true);
  assert.equal(report.stageStatus, 'RCL_OWNED_RULE_EMERGENCE_SOURCE_LOWERING_SUBSET_VERIFIED');
  assert.equal(report.checks.nativeVmIsRealWindowsExecutable, true);
  assert.equal(report.checks.interpreterRunsInNativeVm, true);
  assert.equal(report.checks.rclParsedRuleSourceShape, true);
  assert.equal(report.checks.rclGeneratedTargetRbcMatchesJsCompiler, true);
  assert.equal(report.checks.rclParsedSourceFieldsMatchCompilerShape, true);
  assert.equal(report.checks.decodedTargetShapeMatches, true);
  assert.equal(report.checks.rclGeneratedTargetRunsInNativeVm, true);
  assert.equal(report.checks.targetNativeAndJsTransactionHistoryMatch, true);
  assert.equal(report.checks.decodedInterpreterContainsRuleSourceLoweringRuntime, true);
  assert.equal(report.checks.boundaryHonest, true);

  assert.equal(report.parser.tokenCount, 67);
  assert.equal(report.compiler.facetCount, 2);
  assert.equal(report.compiler.subjectCount, 1);
  assert.equal(report.compiler.warrantCount, 1);
  assert.equal(report.compiler.emergenceCount, 1);
  assert.equal(report.compiler.directiveCount, 2);
  assert.equal(report.compiler.rule[0], 'publish');
  assert.equal(report.compiler.rule[3], 'world.publish');
  assert.equal(report.compiler.rule[5], 'world.status');
  assert.equal(report.compiler.rule[10], 'rcl:stage27:published');
  assert.equal(report.target.bytes, 809);
  assert.equal(report.target.exactReferenceMatch, true);
  assert.equal(report.target.instructions.filter(instruction => instruction.name === 'BEGIN_TX').length, 2);
  assert.equal(report.target.instructions.filter(instruction => instruction.name === 'COMMIT_TX').length, 2);
  assert.deepEqual(report.target.nativeRun.state, {
    'world.ready': true,
    'world.status': 'published',
  });
  assert.equal(report.target.nativeRun.projections.length, 1);
  assert.equal(report.target.nativeRun.history.length, 1);
  assert.equal(report.boundaries.notYetImplemented.includes('not arbitrary rule/expression bytecode lowering'), true);
});
