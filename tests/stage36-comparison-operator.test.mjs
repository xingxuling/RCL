import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

test('Stage-36 RCL-owned lowering emits every primitive comparison operator opcode', () => {
  const out = execFileSync('node', ['scripts/verify-rcl-selfhost-stage36.mjs'], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
    maxBuffer: 128 * 1024 * 1024,
  });
  const report = JSON.parse(out);

  assert.equal(report.ok, true);
  assert.equal(report.stageStatus, 'STAGE36_RCL_OWNED_COMPARISON_OPERATOR_LOWERING_SUBSET_VERIFIED');
  assert.equal(report.checks.nativeVmIsRealWindowsExecutable, true);
  assert.equal(report.checks.interpreterRunsInNativeVm, true);
  assert.equal(report.checks.stage36HeaderCorrect, true);
  assert.equal(report.checks.sourceTargetCorrect, true);
  assert.equal(report.checks.sourceHasComparisonOperators, true);
  assert.equal(report.checks.tokenizerWorks, true);
  assert.equal(report.checks.compilerParsesSource, true);
  assert.equal(report.checks.targetRbcGenerated, true);
  assert.equal(report.checks.targetRbcMatchesJsReference, true);
  assert.equal(report.checks.targetRunsInNativeVm, true);
  assert.equal(report.checks.comparisonOperatorLoweringEvidence, true);
  assert.equal(report.checks.boundaryHonest, true);

  assert.equal(report.parser.tokenCount, 296);
  assert.equal(report.compiler.program, 'Stage36Target');
  assert.equal(report.compiler.programRoot, '41173c1d829f80a3e7dac8f20588b199b1ed7761dea3d245dde1caf62d97c018');
  assert.deepEqual(report.compiler.ruleNames, ['publish', 'promote', 'certify', 'seal', 'audit']);
  assert.equal(report.compiler.rules[0].when.operator, '==');
  assert.equal(report.compiler.rules[0].preserves[0].operator, '!=');
  assert.equal(report.compiler.rules[2].when.operator, '<=');
  assert.equal(report.compiler.rules[2].preserves[0].operator, '>');
  assert.equal(report.compiler.rules[3].when.operator, '<');
  assert.equal(report.compiler.rules[3].preserves[0].operator, '<=');

  assert.equal(report.target.bytes, 3665);
  assert.equal(report.target.exactReferenceMatch, true);
  assert.equal(report.target.sha256, report.target.referenceSha256);
  assert.equal(report.target.sha256, '76158ca907369c15b1765693a5fcb1ba857991b417b60eac17a2ff3121aac4ff');
  assert.deepEqual(report.target.numbers, [1, 0, 2, 3, 5]);
  assert.deepEqual(report.target.strings.slice(16, 27), [
    'publish',
    'sleep',
    'rcl:stage36:eq-neq',
    'promote',
    'rcl:stage36:gte',
    'certify',
    'rcl:stage36:lte-gt',
    'seal',
    'rcl:stage36:lt-lte',
    'audit',
    'rcl:stage36:eq-truth',
  ]);
  assert.equal(report.target.instructions.length, 196);
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
    'world.level': 1,
    'world.ready': true,
    'world.score': 6,
    'world.status': 'armed',
  });
  assert.equal(report.boundaries.notYetImplemented.includes('full native self-hosting'), true);
});
