import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

test('Stage-35 RCL-owned lowering emits Text and Truth equality expressions as EQ bytecode', () => {
  const out = execFileSync('node', ['scripts/verify-rcl-selfhost-stage35.mjs'], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
    maxBuffer: 128 * 1024 * 1024,
  });
  const report = JSON.parse(out);

  assert.equal(report.ok, true);
  assert.equal(report.stageStatus, 'STAGE35_RCL_OWNED_EQUALITY_EXPRESSION_LOWERING_SUBSET_VERIFIED');
  assert.equal(report.checks.nativeVmIsRealWindowsExecutable, true);
  assert.equal(report.checks.interpreterRunsInNativeVm, true);
  assert.equal(report.checks.stage35HeaderCorrect, true);
  assert.equal(report.checks.sourceTargetCorrect, true);
  assert.equal(report.checks.sourceHasExpressions, true);
  assert.equal(report.checks.tokenizerWorks, true);
  assert.equal(report.checks.compilerParsesSource, true);
  assert.equal(report.checks.targetRbcGenerated, true);
  assert.equal(report.checks.targetRbcMatchesJsReference, true);
  assert.equal(report.checks.targetRunsInNativeVm, true);
  assert.equal(report.checks.equalityExpressionLoweringEvidence, true);
  assert.equal(report.checks.boundaryHonest, true);

  assert.equal(report.parser.tokenCount, 298);
  assert.equal(report.parser.subjectCount, 2);
  assert.equal(report.parser.warrantCount, 5);
  assert.equal(report.compiler.program, 'Stage35Target');
  assert.equal(report.compiler.facetCount, 5);
  assert.deepEqual(report.compiler.facetPaths, [
    'world.ready',
    'world.status',
    'world.score',
    'world.level',
    'world.certified',
  ]);
  assert.equal(report.compiler.warrantCount, 5);
  assert.equal(report.compiler.warrants[4].subject, 'auditor');
  assert.equal(report.compiler.warrants[4].capability, 'world.audit');
  assert.equal(report.compiler.rules[0].when.operator, '==');
  assert.equal(report.compiler.rules[0].when.right.value, 'armed');
  assert.equal(report.compiler.rules[4].when.operator, '==');
  assert.equal(report.compiler.rules[4].when.right.value, true);
  assert.deepEqual(report.compiler.ruleNames, ['publish', 'promote', 'certify', 'seal', 'audit']);
  assert.equal(report.compiler.directiveCount, 10);

  assert.equal(report.target.bytes, 3666);
  assert.equal(report.target.exactReferenceMatch, true);
  assert.equal(report.target.sha256, report.target.referenceSha256);
  assert.equal(report.target.sha256, '45044f5c2848a2459f38c05e564192a4140c1290c253e18215a0b8c3878c4a5f');
  assert.deepEqual(report.target.numbers, [1, 0, 2, 3, 4, 5]);
  assert.equal(report.target.instructions.length, 196);
  assert.deepEqual(report.target.eqIndexes, [17, 28, 35, 46, 161, 172, 179, 190]);
  assert.deepEqual(report.target.pushStringIndexes, [2, 16, 27, 34, 45]);
  assert.deepEqual(report.target.pushBoolIndexes, [0, 8, 160, 171, 178, 189]);
  assert.equal(report.target.instructions.filter(instruction => instruction.name === 'GRANT_WARRANT').length, 5);
  assert.equal(report.target.instructions.filter(instruction => instruction.name === 'EQ').length, 8);
  assert.equal(report.target.instructions.filter(instruction => instruction.name === 'GTE').length, 12);
  assert.equal(report.target.instructions.filter(instruction => instruction.name === 'PUSH_STRING').length, 5);
  assert.equal(report.target.instructions.filter(instruction => instruction.name === 'PUSH_BOOL').length, 6);
  assert.equal(report.target.strings[report.target.instructions[2].a], 'armed');
  assert.equal(report.target.strings[report.target.instructions[14].a], 'auditor');
  assert.equal(report.target.strings[report.target.instructions[14].b], 'world.audit');
  assert.deepEqual(report.target.nativeRun.state, {
    'world.certified': false,
    'world.level': 1,
    'world.ready': true,
    'world.score': 6,
    'world.status': 'armed',
  });
  assert.equal(report.boundaries.notYetImplemented.includes('full native self-hosting'), true);
});
