import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

test('Stage-34 RCL-owned parser preserves warrant subject ownership across multiple subject blocks', () => {
  const out = execFileSync('node', ['scripts/verify-rcl-selfhost-stage34.mjs'], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
    maxBuffer: 128 * 1024 * 1024,
  });
  const report = JSON.parse(out);

  assert.equal(report.ok, true);
  assert.equal(report.stageStatus, 'STAGE34_RCL_OWNED_MULTISUBJECT_WARRANT_PARSER_SUBSET_VERIFIED');
  assert.equal(report.checks.nativeVmIsRealWindowsExecutable, true);
  assert.equal(report.checks.interpreterRunsInNativeVm, true);
  assert.equal(report.checks.sourceTargetCorrect, true);
  assert.equal(report.checks.sourceHasExpressions, true);
  assert.equal(report.checks.tokenizerWorks, true);
  assert.equal(report.checks.compilerParsesSource, true);
  assert.equal(report.checks.targetRbcGenerated, true);
  assert.equal(report.checks.targetRbcMatchesJsReference, true);
  assert.equal(report.checks.targetRunsInNativeVm, true);
  assert.equal(report.checks.multisubjectWarrantParserEvidence, true);
  assert.equal(report.checks.boundaryHonest, true);

  assert.equal(report.parser.tokenCount, 290);
  assert.equal(report.parser.subjectCount, 2);
  assert.equal(report.parser.warrantCount, 5);
  assert.equal(report.compiler.program, 'Stage34Target');
  assert.equal(report.compiler.facetCount, 4);
  assert.deepEqual(report.compiler.facetPaths, ['world.ready', 'world.score', 'world.level', 'world.certified']);
  assert.equal(report.compiler.subjectCount, 2);
  assert.equal(report.compiler.warrantCount, 5);
  assert.equal(report.compiler.warrants[4].subject, 'auditor');
  assert.equal(report.compiler.warrants[4].capability, 'world.audit');
  assert.equal(report.compiler.warrants[4].target, 'world');
  assert.deepEqual(report.compiler.ruleNames, ['publish', 'promote', 'certify', 'seal', 'audit']);
  assert.equal(report.compiler.directiveCount, 10);
  assert.equal(report.target.bytes, 3612);
  assert.equal(report.target.exactReferenceMatch, true);
  assert.equal(report.target.sha256, report.target.referenceSha256);
  assert.equal(report.target.sha256, 'c39c61e6e6bf9be8559fc041d2cfc943dba16a1168215ef111318e9e96a2d6b1');
  assert.deepEqual(report.target.numbers, [1, 0, 2, 3, 4, 5, 6]);
  assert.equal(report.target.instructions.length, 194);
  assert.equal(report.target.instructions.filter(instruction => instruction.name === 'GRANT_WARRANT').length, 5);
  assert.equal(report.target.instructions[12].name, 'GRANT_WARRANT');
  assert.equal(report.target.strings[report.target.instructions[12].a], 'auditor');
  assert.equal(report.target.strings[report.target.instructions[12].b], 'world.audit');
  assert.equal(report.target.instructions.filter(instruction => instruction.name === 'BEGIN_TX').length, 10);
  assert.equal(report.target.instructions.filter(instruction => instruction.name === 'PUSH_NUMBER').length, 32);
  assert.equal(report.target.instructions.filter(instruction => instruction.name === 'PUSH_BOOL').length, 2);
  assert.equal(report.target.instructions.filter(instruction => instruction.name === 'GTE').length, 20);
  assert.equal(report.target.instructions.filter(instruction => instruction.name === 'ADD').length, 10);
  assert.deepEqual(report.target.nativeRun.state, {
    'world.certified': false,
    'world.level': 1,
    'world.ready': true,
    'world.score': 6,
  });
  assert.equal(report.boundaries.notYetImplemented.includes('full native self-hosting'), true);
});
