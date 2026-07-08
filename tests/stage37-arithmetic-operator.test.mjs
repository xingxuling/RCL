import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

test('Stage-37 RCL-owned lowering emits arithmetic alter operator opcodes', () => {
  const out = execFileSync('node', ['scripts/verify-rcl-selfhost-stage37.mjs'], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
    maxBuffer: 128 * 1024 * 1024,
  });
  const report = JSON.parse(out);

  assert.equal(report.ok, true);
  assert.equal(report.stageStatus, 'STAGE37_RCL_OWNED_ARITHMETIC_OPERATOR_LOWERING_SUBSET_VERIFIED');
  assert.equal(report.checks.nativeVmIsRealWindowsExecutable, true);
  assert.equal(report.checks.interpreterRunsInNativeVm, true);
  assert.equal(report.checks.stage37HeaderCorrect, true);
  assert.equal(report.checks.gateFlagsCorrect, true);
  assert.equal(report.checks.sourceTargetCorrect, true);
  assert.equal(report.checks.sourceHasArithmeticOperators, true);
  assert.equal(report.checks.tokenizerWorks, true);
  assert.equal(report.checks.compilerParsesSource, true);
  assert.equal(report.checks.targetRbcGenerated, true);
  assert.equal(report.checks.targetRbcMatchesJsReference, true);
  assert.equal(report.checks.targetRunsInNativeVm, true);
  assert.equal(report.checks.arithmeticOperatorLoweringEvidence, true);
  assert.equal(report.checks.boundaryHonest, true);

  assert.equal(report.parser.tokenCount, 296);
  assert.equal(report.compiler.program, 'Stage37Target');
  assert.equal(report.compiler.programRoot, '60305caf3862937fa5de2fd352789cc93d0d24dc6cb5de8e5c2e0692e90f3771');
  assert.deepEqual(report.compiler.ruleNames, ['publish', 'promote', 'certify', 'seal', 'audit']);
  assert.equal(report.compiler.rules[0].alters[0].expression.operator, '+');
  assert.equal(report.compiler.rules[1].alters[0].expression.operator, '*');
  assert.equal(report.compiler.rules[2].alters[0].expression.operator, '-');
  assert.equal(report.compiler.rules[3].alters[0].expression.operator, '/');
  assert.equal(report.compiler.rules[4].alters[0].expression.operator, '+');

  assert.equal(report.target.bytes, 3672);
  assert.equal(report.target.exactReferenceMatch, true);
  assert.equal(report.target.sha256, report.target.referenceSha256);
  assert.equal(report.target.sha256, '7507a2041cdab6971bd3730ccb5b704bb6f9a7e79310d1a95cc1c513550c26a5');
  assert.deepEqual(report.target.numbers, [8, 1, 2, 10, 3, 6, 4]);
  assert.deepEqual(report.target.strings.slice(16, 27), [
    'publish',
    'sleep',
    'rcl:stage37:add',
    'promote',
    'rcl:stage37:mul',
    'certify',
    'rcl:stage37:sub',
    'seal',
    'rcl:stage37:div',
    'audit',
    'rcl:stage37:eq-truth',
  ]);
  assert.equal(report.target.instructions.length, 196);
  assert.deepEqual(report.target.arithmeticIndexes, {
    add: [23, 41, 167, 185],
    sub: [95, 113],
    mul: [59, 77],
    div: [131, 149],
  });
  assert.deepEqual(report.target.comparisonIndexes, {
    eq: [17, 35, 161, 172, 179, 190],
    neq: [28, 46],
    lt: [125, 143],
    lte: [89, 107, 136, 154],
    gt: [100, 118],
    gte: [53, 64, 71, 82],
  });
  assert.deepEqual(report.target.pushStringIndexes, [2, 16, 27, 34, 45]);
  assert.deepEqual(report.target.pushBoolIndexes, [0, 8, 160, 171, 178, 189]);
  assert.deepEqual(report.target.nativeRun.state, {
    'world.certified': false,
    'world.level': 2,
    'world.ready': true,
    'world.score': 4.5,
    'world.status': 'armed',
  });
  assert.equal(report.boundaries.notYetImplemented.includes('full native self-hosting'), true);
});
