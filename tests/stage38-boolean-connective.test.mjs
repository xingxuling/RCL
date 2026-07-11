import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

test('Stage-38 RCL-owned lowering emits JS-compatible boolean short-circuit bytecode', () => {
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

  assert.equal(report.target.bytes, 6244);
  assert.equal(report.target.exactReferenceMatch, true);
  assert.equal(report.target.sha256, report.target.referenceSha256);
  assert.equal(report.target.sha256, '04ae75aa6f73329773483c0022a0895a86870ccc5d2149ba30ae5ea68d5363a4');
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
  assert.equal(report.target.instructions.length, 356);
  assert.deepEqual(report.target.booleanIndexes, {
    and: [],
    or: [],
  });
  assert.deepEqual(report.target.arithmeticIndexes, {
    add: [31, 65, 303, 337],
    sub: [167, 201],
    mul: [99, 133],
    div: [235, 269],
  });
  assert.deepEqual(report.target.comparisonIndexes, {
    eq: [17, 21, 40, 51, 55, 74, 89, 110, 123, 144, 157, 176, 191, 210, 225, 246, 259, 280, 289, 293, 308, 312, 323, 327, 342, 346],
    neq: [36, 70],
    lt: [221, 255],
    lte: [153, 187, 240, 274],
    gt: [172, 206],
    gte: [85, 104, 119, 138],
  });
  assert.deepEqual(report.target.pushStringIndexes, [2, 16, 35, 50, 69, 175, 209, 292, 311, 326, 345]);
  assert.deepEqual(report.target.pushBoolIndexes, [0, 8, 20, 25, 39, 44, 54, 59, 73, 78, 88, 93, 106, 109, 122, 127, 140, 143, 156, 161, 180, 190, 195, 214, 224, 229, 242, 245, 258, 263, 276, 279, 288, 297, 307, 316, 322, 331, 341, 350]);
  assert.equal(report.target.opcodeCounts.AND, 0);
  assert.equal(report.target.opcodeCounts.OR, 0);
  assert.equal(report.target.opcodeCounts.NOT, 40);
  assert.equal(report.target.opcodeCounts.JUMP, 20);
  assert.equal(report.target.opcodeCounts.JUMP_IF_FALSE, 30);
  assert.deepEqual(report.target.controlIndexes.checkWarrant, [28, 62, 96, 130, 164, 198, 232, 266, 300, 334]);
  assert.deepEqual(report.target.nativeRun.state, {
    'world.certified': false,
    'world.level': 2,
    'world.ready': true,
    'world.score': 4.5,
    'world.status': 'armed',
  });
  assert.equal(report.boundaries.notYetImplemented.includes('full native self-hosting'), true);
});
