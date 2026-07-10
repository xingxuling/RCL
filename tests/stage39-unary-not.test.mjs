import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

test('Stage-39 RCL-owned lowering emits unary NOT with JS-compatible boolean short-circuit bytecode', () => {
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

  assert.equal(report.target.bytes, 6904);
  assert.equal(report.target.exactReferenceMatch, true);
  assert.equal(report.target.sha256, report.target.referenceSha256);
  assert.equal(report.target.sha256, '32fb9710be02209584c4ecdd3a270c4d13bd9e717633da6b77a5ca886d06a9d4');
  assert.equal(report.target.instructions.length, 396);
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
    not: [18, 23, 24, 25, 39, 44, 45, 46, 56, 61, 62, 63, 77, 82, 83, 84, 94, 99, 100, 101, 115, 122, 123, 124, 132, 137, 138, 139, 153, 160, 161, 162, 170, 175, 176, 177, 191, 196, 197, 198, 208, 213, 214, 215, 229, 234, 235, 236, 246, 251, 252, 253, 267, 274, 275, 276, 284, 289, 290, 291, 305, 312, 313, 314, 322, 327, 328, 329, 343, 348, 349, 350, 360, 365, 366, 367, 381, 386, 387, 388],
  });
  assert.deepEqual(report.target.booleanIndexes, {
    and: [],
    or: [],
  });
  assert.equal(report.target.opcodeCounts.NOT, 80);
  assert.equal(report.target.opcodeCounts.AND, 0);
  assert.equal(report.target.opcodeCounts.OR, 0);
  assert.equal(report.target.opcodeCounts.JUMP, 20);
  assert.equal(report.target.opcodeCounts.JUMP_IF_FALSE, 30);
  assert.deepEqual(report.target.controlIndexes.checkWarrant, [30, 68, 106, 144, 182, 220, 258, 296, 334, 372]);
  assert.deepEqual(report.target.nativeRun.state, {
    'world.certified': false,
    'world.level': 2,
    'world.ready': true,
    'world.score': 4.5,
    'world.status': 'armed',
  });
  assert.equal(report.boundaries.notYetImplemented.includes('full native self-hosting'), true);
});
