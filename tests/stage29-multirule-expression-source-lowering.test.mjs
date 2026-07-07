import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

test('Stage-29 RCL-owned multirule expression source lowering emits two-rule transaction bytecode that runs in native rclvm.exe', () => {
  const out = execFileSync('node', ['scripts/verify-rcl-selfhost-stage29.mjs'], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
    maxBuffer: 128 * 1024 * 1024,
  });
  const report = JSON.parse(out);

  assert.equal(report.ok, true);
  assert.equal(report.stageStatus, 'RCL_OWNED_MULTIRULE_EXPRESSION_SOURCE_LOWERING_SUBSET_VERIFIED');
  assert.equal(report.checks.nativeVmIsRealWindowsExecutable, true);
  assert.equal(report.checks.interpreterRunsInNativeVm, true);
  assert.equal(report.checks.rclParsedMultiRuleExpressionSourceShape, true);
  assert.equal(report.checks.rclGeneratedTargetRbcMatchesJsCompiler, true);
  assert.equal(report.checks.rclParsedExpressionFieldsMatchCompilerShape, true);
  assert.equal(report.checks.decodedTargetShapeMatches, true);
  assert.equal(report.checks.rclGeneratedTargetRunsInNativeVm, true);
  assert.equal(report.checks.targetNativeAndJsTransactionHistoryMatch, true);
  assert.equal(report.checks.decodedInterpreterContainsMultiRuleExpressionLoweringRuntime, true);
  assert.equal(report.checks.boundaryHonest, true);

  assert.equal(report.parser.tokenCount, 131);
  assert.equal(report.compiler.facetCount, 3);
  assert.equal(report.compiler.warrantCount, 2);
  assert.equal(report.compiler.emergenceCount, 2);
  assert.equal(report.compiler.directiveCount, 4);
  assert.equal(report.compiler.ruleOne[0], 'publish');
  assert.equal(report.compiler.ruleOne[14], 'rcl:stage29:score');
  assert.equal(report.compiler.ruleTwo[0], 'promote');
  assert.equal(report.compiler.ruleTwo[5], 'world.promote');
  assert.equal(report.compiler.ruleTwo[7], 'world.level');
  assert.equal(report.compiler.ruleTwo[14], 'rcl:stage29:level');
  assert.equal(report.target.bytes, 1645);
  assert.deepEqual(report.target.numbers, [1, 0, 2, 3]);
  assert.equal(report.target.exactReferenceMatch, true);
  assert.equal(report.target.instructions.filter(instruction => instruction.name === 'GRANT_WARRANT').length, 2);
  assert.equal(report.target.instructions.filter(instruction => instruction.name === 'PUSH_NUMBER').length, 14);
  assert.equal(report.target.instructions.filter(instruction => instruction.name === 'BEGIN_TX').length, 4);
  assert.equal(report.target.instructions.filter(instruction => instruction.name === 'COMMIT_TX').length, 4);
  assert.deepEqual(report.target.nativeRun.state, {
    'world.level': 1,
    'world.ready': true,
    'world.score': 3,
  });
  assert.equal(report.target.nativeRun.projections.length, 2);
  assert.equal(report.target.nativeRun.history.length, 2);
  assert.equal(report.target.nativeRun.history[0].rule, 'publish');
  assert.equal(report.target.nativeRun.history[1].rule, 'promote');
  assert.equal(report.boundaries.notYetImplemented.includes('not loop-based general rule lowering'), true);
});
