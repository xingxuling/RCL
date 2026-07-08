import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

test('Stage-33 RCL-owned rule/directive loop scales to four rules and emits byte-identical target RBC', () => {
  const out = execFileSync('node', ['scripts/verify-rcl-selfhost-stage33.mjs'], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
    maxBuffer: 128 * 1024 * 1024,
  });
  const report = JSON.parse(out);

  assert.equal(report.ok, true);
  assert.equal(report.stageStatus, 'STAGE33_RCL_OWNED_GENERAL_RULE_DIRECTIVE_SCALING_SUBSET_VERIFIED');
  assert.equal(report.checks.nativeVmIsRealWindowsExecutable, true);
  assert.equal(report.checks.interpreterRunsInNativeVm, true);
  assert.equal(report.checks.sourceTargetCorrect, true);
  assert.equal(report.checks.sourceHasExpressions, true);
  assert.equal(report.checks.tokenizerWorks, true);
  assert.equal(report.checks.compilerParsesSource, true);
  assert.equal(report.checks.targetRbcGenerated, true);
  assert.equal(report.checks.targetRbcMatchesJsReference, true);
  assert.equal(report.checks.targetRunsInNativeVm, true);
  assert.equal(report.checks.generalRuleDirectiveScalingEvidence, true);
  assert.equal(report.checks.boundaryHonest, true);

  assert.equal(report.parser.tokenCount, 237);
  assert.equal(report.compiler.program, 'Stage33Target');
  assert.equal(report.compiler.facetCount, 4);
  assert.deepEqual(report.compiler.facetPaths, ['world.ready', 'world.score', 'world.level', 'world.certified']);
  assert.equal(report.compiler.warrantCount, 4);
  assert.deepEqual(report.compiler.ruleNames, ['publish', 'promote', 'certify', 'seal']);
  assert.equal(report.compiler.directiveCount, 8);
  assert.equal(report.target.bytes, 2956);
  assert.equal(report.target.exactReferenceMatch, true);
  assert.equal(report.target.sha256, report.target.referenceSha256);
  assert.equal(report.target.sha256, 'e53f947b071d5b04ba360f5615e7685cff3e3d40742af650c70b57fa691bcce1');
  assert.deepEqual(report.target.numbers, [1, 0, 2, 3, 4, 5]);
  assert.equal(report.target.instructions.length, 157);
  assert.equal(report.target.instructions.filter(instruction => instruction.name === 'GRANT_WARRANT').length, 4);
  assert.equal(report.target.instructions.filter(instruction => instruction.name === 'BEGIN_TX').length, 8);
  assert.equal(report.target.instructions.filter(instruction => instruction.name === 'PUSH_NUMBER').length, 26);
  assert.equal(report.target.instructions.filter(instruction => instruction.name === 'PUSH_BOOL').length, 2);
  assert.equal(report.target.instructions.filter(instruction => instruction.name === 'GTE').length, 16);
  assert.equal(report.target.instructions.filter(instruction => instruction.name === 'ADD').length, 8);
  assert.deepEqual(report.target.nativeRun.state, {
    'world.certified': false,
    'world.level': 1,
    'world.ready': true,
    'world.score': 5,
  });
  assert.equal(report.boundaries.notYetImplemented.includes('full native self-hosting'), true);
});
