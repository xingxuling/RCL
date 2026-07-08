import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

test('Stage-38 RCL-owned lowering emits boolean connective opcodes', () => {
  const out = execFileSync('node', ['scripts/verify-rcl-selfhost-stage38.mjs'], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
    maxBuffer: 128 * 1024 * 1024,
  });
  const report = JSON.parse(out);

  assert.equal(report.ok, true);
  assert.equal(report.stageStatus, 'STAGE38_RCL_OWNED_BOOLEAN_CONNECTIVE_LOWERING_SUBSET_VERIFIED');
  assert.equal(report.checks.nativeVmIsRealWindowsExecutable, true);
  assert.equal(report.checks.interpreterRunsInNativeVm, true);
  assert.equal(report.checks.stage38HeaderCorrect, true);
  assert.equal(report.checks.gateFlagsCorrect, true);
  assert.equal(report.checks.sourceTargetCorrect, true);
  assert.equal(report.checks.sourceHasBooleanConnectives, true);
  assert.equal(report.checks.tokenizerWorks, true);
  assert.equal(report.checks.compilerParsesSource, true);
  assert.equal(report.checks.targetRbcGenerated, true);
  assert.equal(report.checks.targetRbcMatchesJsReference, true);
  assert.equal(report.checks.targetRunsInNativeVm, true);
  assert.equal(report.checks.targetHasCorrectInstructionCount, true);
  assert.equal(report.checks.booleanConnectiveLoweringEvidence, true);
  assert.equal(report.checks.boundaryHonest, true);

  assert.equal(report.parser.tokenCount, 366);
  assert.equal(report.compiler.program, 'Stage38Target');
  assert.equal(report.compiler.programRoot, '0000e8518e93fa380b2200a21b3cf37bb51000054fb90c14337b95d4d1c9fa8d');
  assert.deepEqual(report.compiler.ruleNames, ['publish', 'promote', 'certify', 'seal', 'audit']);
  assert.deepEqual(report.compiler.rules.map(rule => rule.when.operator), ['and', 'and', 'and', 'and', 'and']);
  assert.deepEqual(report.compiler.rules.map(rule => rule.preserves[0].operator), ['and', 'or', 'and', 'or', 'and']);
  assert.deepEqual(report.compiler.rules.map(rule => rule.alters[0].expression.operator), ['+', '*', '-', '/', '+']);

  assert.equal(report.compiler.rules[0].when.left.operator, '==');
  assert.equal(report.compiler.rules[0].when.right.operator, '==');
  assert.equal(report.compiler.rules[0].preserves[0].left.operator, '!=');
  assert.equal(report.compiler.rules[1].preserves[0].left.operator, '>=');
  assert.equal(report.compiler.rules[2].when.left.operator, '<=');
  assert.equal(report.compiler.rules[2].preserves[0].left.operator, '>');
  assert.equal(report.compiler.rules[3].when.left.operator, '<');
  assert.equal(report.compiler.rules[3].preserves[0].left.operator, '<=');
  assert.equal(report.compiler.rules[4].when.right.left.path, 'world.status');

  assert.equal(report.target.bytes, 4964);
  assert.equal(report.target.exactReferenceMatch, true);
  assert.equal(report.target.sha256, report.target.referenceSha256);
  assert.equal(report.target.sha256, '272a07ab81b67d69da55703c79c879b9eaa6714a6c935e2cd1cae1ca52c3c822');
  assert.deepEqual(report.target.numbers, [8, 1, 2, 10, 3, 6, 4]);
  assert.deepEqual(report.target.strings.slice(16, 27), [
    'publish',
    'sleep',
    'rcl:stage38:add-and',
    'promote',
    'rcl:stage38:mul-or',
    'certify',
    'rcl:stage38:sub-and',
    'seal',
    'rcl:stage38:div-or',
    'audit',
    'rcl:stage38:eq-and',
  ]);
  assert.equal(report.target.instructions.length, 276);
  assert.deepEqual(report.target.booleanIndexes, {
    and: [21, 36, 47, 62, 73, 99, 125, 140, 151, 166, 177, 203, 229, 244, 255, 270],
    or: [88, 114, 192, 218],
  });
  assert.deepEqual(report.target.arithmeticIndexes, {
    add: [27, 53, 235, 261],
    sub: [131, 157],
    mul: [79, 105],
    div: [183, 209],
  });
  assert.deepEqual(report.target.comparisonIndexes, {
    eq: [17, 20, 35, 43, 46, 61, 72, 87, 98, 113, 124, 139, 150, 165, 176, 191, 202, 217, 225, 228, 240, 243, 251, 254, 266, 269],
    neq: [32, 58],
    lt: [173, 199],
    lte: [121, 147, 188, 214],
    gt: [136, 162],
    gte: [69, 84, 95, 110],
  });
  assert.deepEqual(report.target.pushStringIndexes, [2, 16, 31, 42, 57, 138, 164, 227, 242, 253, 268]);
  assert.deepEqual(report.target.pushBoolIndexes, [0, 8, 19, 34, 45, 60, 71, 86, 97, 112, 123, 149, 175, 190, 201, 216, 224, 239, 250, 265]);
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
