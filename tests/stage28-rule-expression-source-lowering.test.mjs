import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

test('Stage-28 RCL-owned rule expression source lowering emits numeric transaction bytecode that runs in native rclvm.exe', () => {
  const out = execFileSync('node', ['scripts/verify-rcl-selfhost-stage28.mjs'], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
    maxBuffer: 96 * 1024 * 1024,
  });
  const report = JSON.parse(out);

  assert.equal(report.ok, true);
  assert.equal(report.stageStatus, 'RCL_OWNED_RULE_EXPRESSION_SOURCE_LOWERING_SUBSET_VERIFIED');
  assert.equal(report.checks.nativeVmIsRealWindowsExecutable, true);
  assert.equal(report.checks.interpreterRunsInNativeVm, true);
  assert.equal(report.checks.rclParsedRuleExpressionSourceShape, true);
  assert.equal(report.checks.rclGeneratedTargetRbcMatchesJsCompiler, true);
  assert.equal(report.checks.rclParsedExpressionFieldsMatchCompilerShape, true);
  assert.equal(report.checks.decodedTargetShapeMatches, true);
  assert.equal(report.checks.rclGeneratedTargetRunsInNativeVm, true);
  assert.equal(report.checks.targetNativeAndJsTransactionHistoryMatch, true);
  assert.equal(report.checks.decodedInterpreterContainsRuleExpressionLoweringRuntime, true);
  assert.equal(report.checks.boundaryHonest, true);

  assert.equal(report.parser.tokenCount, 74);
  assert.equal(report.compiler.facetCount, 2);
  assert.equal(report.compiler.subjectCount, 1);
  assert.equal(report.compiler.warrantCount, 1);
  assert.equal(report.compiler.emergenceCount, 1);
  assert.equal(report.compiler.directiveCount, 2);
  assert.equal(report.compiler.rule[0], 'publish');
  assert.equal(report.compiler.rule[2], 'world.score');
  assert.equal(report.compiler.rule[3], '>=');
  assert.equal(report.compiler.rule[4], '1');
  assert.equal(report.compiler.rule[7], 'world.score');
  assert.equal(report.compiler.rule[8], 'world.score');
  assert.equal(report.compiler.rule[9], '+');
  assert.equal(report.compiler.rule[10], '2');
  assert.equal(report.compiler.rule[11], 'world.score');
  assert.equal(report.compiler.rule[12], '>=');
  assert.equal(report.compiler.rule[13], '3');
  assert.equal(report.compiler.rule[14], 'rcl:stage28:score');
  assert.equal(report.target.bytes, 944);
  assert.deepEqual(report.target.numbers, [1, 2, 3]);
  assert.equal(report.target.exactReferenceMatch, true);
  assert.equal(report.target.instructions.filter(instruction => instruction.name === 'PUSH_NUMBER').length, 7);
  assert.equal(report.target.instructions.filter(instruction => instruction.name === 'GTE').length, 4);
  assert.equal(report.target.instructions.filter(instruction => instruction.name === 'ADD').length, 2);
  assert.equal(report.target.instructions.filter(instruction => instruction.name === 'COMMIT_TX').length, 2);
  assert.deepEqual(report.target.nativeRun.state, {
    'world.ready': true,
    'world.score': 3,
  });
  assert.equal(report.target.nativeRun.projections.length, 1);
  assert.equal(report.target.nativeRun.history.length, 1);
  assert.equal(report.boundaries.notYetImplemented.includes('not general expression precedence'), true);
});
