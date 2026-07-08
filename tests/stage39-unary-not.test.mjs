import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

test('Stage-39 RCL-owned lowering emits unary NOT opcodes', () => {
  const out = execFileSync('node', ['scripts/verify-rcl-selfhost-stage39.mjs'], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
    maxBuffer: 160 * 1024 * 1024,
  });
  const report = JSON.parse(out);

  assert.equal(report.ok, true);
  assert.equal(report.stageStatus, 'STAGE39_RCL_OWNED_UNARY_NOT_LOWERING_SUBSET_VERIFIED');
  assert.equal(report.checks.nativeVmIsRealWindowsExecutable, true);
  assert.equal(report.checks.interpreterRunsInNativeVm, true);
  assert.equal(report.checks.stage39HeaderCorrect, true);
  assert.equal(report.checks.gateFlagsCorrect, true);
  assert.equal(report.checks.sourceTargetCorrect, true);
  assert.equal(report.checks.sourceHasUnaryNotExpressions, true);
  assert.equal(report.checks.tokenizerWorks, true);
  assert.equal(report.checks.compilerParsesSource, true);
  assert.equal(report.checks.targetRbcGenerated, true);
  assert.equal(report.checks.targetRbcMatchesJsReference, true);
  assert.equal(report.checks.targetRunsInNativeVm, true);
  assert.equal(report.checks.unaryNotLoweringEvidence, true);
  assert.equal(report.checks.boundaryHonest, true);

  assert.equal(report.parser.tokenCount, 424);
  assert.equal(report.compiler.program, 'Stage39Target');
  assert.equal(report.compiler.programRoot, '6961b0ffd5019d30b8aa4d22368200a5bdb1f17e7cb5ffd40a31dcf1947d436b');
  assert.deepEqual(report.compiler.ruleNames, ['publish', 'promote', 'certify', 'seal', 'audit']);
  assert.deepEqual(report.compiler.rules.map(rule => rule.when.operator), ['and', 'and', 'and', 'and', 'and']);
  assert.deepEqual(report.compiler.rules.map(rule => rule.preserves[0].operator), ['and', 'or', 'and', 'or', 'and']);
  assert.equal(report.compiler.rules[0].when.left.operator, 'not');
  assert.equal(report.compiler.rules[0].when.left.expression.operator, '!=');
  assert.equal(report.compiler.rules[1].when.left.expression.operator, '<');
  assert.equal(report.compiler.rules[2].when.left.expression.operator, '>');
  assert.equal(report.compiler.rules[3].when.left.expression.operator, '>=');
  assert.equal(report.compiler.rules[4].when.right.expression.operator, '!=');
  assert.deepEqual(report.compiler.rules.map(rule => rule.alters[0].expression.operator), ['+', '*', '-', '/', '+']);

  assert.equal(report.target.bytes, 5624);
  assert.equal(report.target.exactReferenceMatch, true);
  assert.equal(report.target.sha256, report.target.referenceSha256);
  assert.equal(report.target.sha256, '9fa109da0638ab9946be1ec56e012ab0a3ca05d105a0a6bd1cd884a643483ddc');
  assert.equal(report.target.instructions.length, 316);
  assert.deepEqual(report.target.numbers, [8, 1, 2, 10, 3, 6, 4]);
  assert.deepEqual(report.target.strings.slice(16, 27), [
    'publish',
    'sleep',
    'rcl:stage39:add-not-and',
    'promote',
    'rcl:stage39:mul-not-or',
    'certify',
    'rcl:stage39:sub-not-and',
    'seal',
    'rcl:stage39:div-not-or',
    'audit',
    'rcl:stage39:eq-not-and',
  ]);
  assert.deepEqual(report.target.unaryIndexes, {
    not: [18, 22, 35, 39, 48, 52, 65, 69, 78, 82, 95, 99, 108, 112, 125, 129, 138, 142, 155, 159, 168, 172, 185, 189, 198, 202, 215, 219, 228, 232, 245, 249, 258, 262, 275, 279, 288, 292, 305, 309],
  });
  assert.deepEqual(report.target.booleanIndexes, {
    and: [23, 40, 53, 70, 83, 113, 143, 160, 173, 190, 203, 233, 263, 280, 293, 310],
    or: [100, 130, 220, 250],
  });
  assert.equal(report.target.opcodeCounts.NOT, 40);
  assert.equal(report.target.opcodeCounts.AND, 16);
  assert.equal(report.target.opcodeCounts.OR, 4);
  assert.deepEqual(report.target.nativeRun.state, {
    'world.certified': false,
    'world.level': 2,
    'world.ready': true,
    'world.score': 4.5,
    'world.status': 'armed',
  });
  assert.equal(report.boundaries.notYetImplemented.includes('full native self-hosting'), true);
});
