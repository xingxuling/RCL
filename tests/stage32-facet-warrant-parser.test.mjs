import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

test('Stage-32 RCL-owned facet/warrant parser emits byte-identical target RBC that runs in native rclvm.exe', () => {
  const out = execFileSync('node', ['scripts/verify-rcl-selfhost-stage32.mjs'], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
    maxBuffer: 128 * 1024 * 1024,
  });
  const report = JSON.parse(out);

  assert.equal(report.ok, true);
  assert.equal(report.stageStatus, 'STAGE32_RCL_OWNED_FACET_WARRANT_PARSER_SUBSET_VERIFIED');
  assert.equal(report.checks.nativeVmIsRealWindowsExecutable, true);
  assert.equal(report.checks.interpreterRunsInNativeVm, true);
  assert.equal(report.checks.sourceTargetCorrect, true);
  assert.equal(report.checks.sourceHasExpressions, true);
  assert.equal(report.checks.tokenizerWorks, true);
  assert.equal(report.checks.compilerParsesSource, true);
  assert.equal(report.checks.targetRbcGenerated, true);
  assert.equal(report.checks.targetRbcMatchesJsReference, true);
  assert.equal(report.checks.targetRunsInNativeVm, true);
  assert.equal(report.checks.facetWarrantParserEvidence, true);
  assert.equal(report.checks.boundaryHonest, true);

  assert.equal(report.parser.tokenCount, 188);
  assert.equal(report.compiler.program, 'Stage32Target');
  assert.equal(report.compiler.facetCount, 4);
  assert.deepEqual(report.compiler.facetPaths, ['world.ready', 'world.score', 'world.level', 'world.certified']);
  assert.equal(report.compiler.warrantCount, 3);
  assert.deepEqual(report.compiler.ruleNames, ['publish', 'promote', 'certify']);
  assert.equal(report.compiler.directiveCount, 6);
  assert.equal(report.target.bytes, 2314);
  assert.equal(report.target.exactReferenceMatch, true);
  assert.equal(report.target.sha256, report.target.referenceSha256);
  assert.equal(report.target.sha256, '4d2a9d824597df605c428a5fcab295b4b9bc955e7b90ef9a6535c0599742b967');
  assert.deepEqual(report.target.numbers, [1, 0, 2, 3, 4]);
  assert.equal(report.target.instructions.length, 120);
  assert.equal(report.target.instructions.filter(instruction => instruction.name === 'GRANT_WARRANT').length, 3);
  assert.equal(report.target.instructions.filter(instruction => instruction.name === 'BEGIN_TX').length, 6);
  assert.equal(report.target.instructions.filter(instruction => instruction.name === 'PUSH_NUMBER').length, 20);
  assert.equal(report.target.instructions.filter(instruction => instruction.name === 'PUSH_BOOL').length, 2);
  assert.equal(report.target.instructions.filter(instruction => instruction.name === 'GTE').length, 12);
  assert.equal(report.target.instructions.filter(instruction => instruction.name === 'ADD').length, 6);
  assert.deepEqual(report.target.nativeRun.state, {
    'world.certified': false,
    'world.level': 1,
    'world.ready': true,
    'world.score': 4,
  });
  assert.equal(report.boundaries.notYetImplemented.includes('full native self-hosting'), true);
});
