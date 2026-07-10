import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const EXPECTED_RULE_NEEDS = {
  publish: [
    { capability: 'world.publish', target: 'world' },
    { capability: 'world.promote', target: 'world' },
  ],
  promote: [
    { capability: 'world.promote', target: 'world' },
    { capability: 'world.certify', target: 'world' },
  ],
  certify: [
    { capability: 'world.certify', target: 'world' },
    { capability: 'world.seal', target: 'world' },
  ],
  seal: [
    { capability: 'world.seal', target: 'world' },
    { capability: 'world.publish', target: 'world' },
  ],
  audit: [
    { capability: 'world.audit', target: 'world' },
    { capability: 'world.inspect', target: 'world' },
  ],
};

test('Stage-40 RCL-owned lowering emits and executes two CHECK_WARRANT instructions per target rule invocation', () => {
  const out = execFileSync('node', ['scripts/verify-rcl-selfhost-stage40.mjs'], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
    maxBuffer: 160 * 1024 * 1024,
  });
  const report = JSON.parse(out);

  assert.equal(report.ok, true);
  assert.equal(report.format, 'rcl.selfhost.stage40.verification.v1');
  assert.equal(report.rclFile, 'selfhost/rcl-dual-need-stage40.rcl');
  assert.equal(report.stageStatus, 'STAGE40_RCL_OWNED_DUAL_NEED_WARRANT_LOWERING_SUBSET_VERIFIED');
  assert.equal(report.selfHostClaim, 'rcl_lowers_dual_needs_clauses_to_warrant_bytecode');

  for (const check of [
    'nativeVmIsRealWindowsExecutable',
    'interpreterRunsInNativeVm',
    'stage40HeaderCorrect',
    'gateFlagsCorrect',
    'sourceTargetCorrect',
    'sourceHasDualNeeds',
    'tokenizerWorks',
    'compilerParsesDualNeeds',
    'targetRbcGenerated',
    'targetRbcMatchesJsReference',
    'targetRunsInNativeVm',
    'targetHasCorrectInstructionCount',
    'targetHasCorrectStringPool',
    'targetHasCorrectNumberPool',
    'dualNeedLoweringEvidence',
    'dualNeedExecutionEvidence',
    'shortCircuitBooleanLoweringEvidence',
    'boundaryHonest',
  ]) {
    assert.equal(report.checks[check], true, `${check} should pass`);
  }

  assert.equal(report.parser.tokenCount, 460);
  assert.equal(report.parser.warrantCount, 6);
  assert.equal(report.compiler.program, 'Stage40Target');
  assert.equal(report.compiler.programRoot, '71e899db3794f862101f898dbf0549a534db488f4320f30d07585d523a25ce14');
  assert.deepEqual(report.compiler.ruleNames, ['publish', 'promote', 'certify', 'seal', 'audit']);
  assert.deepEqual(report.compiler.ruleNeeds, EXPECTED_RULE_NEEDS);
  assert.ok(report.compiler.rules.every(rule => rule.needs.length === 2));

  assert.equal(report.target.bytes, 7147);
  assert.equal(report.target.exactReferenceMatch, true);
  assert.equal(report.target.sha256, report.target.referenceSha256);
  assert.equal(report.target.sha256, '4dbfe7408fb24484065b06e7b2d5b421cd2f6773bef28e29cfacd393c724e318');
  assert.equal(report.target.instructions.length, 407);
  assert.equal(report.target.opcodeCounts.CHECK_WARRANT, 20);
  assert.deepEqual(report.target.checkWarrants.map(check => check.index), [
    31, 32, 70, 71, 109, 110, 148, 149, 187, 188,
    226, 227, 265, 266, 304, 305, 343, 344, 382, 383,
  ]);
  assert.equal(report.target.checkWarrantPairs.length, 10);
  assert.ok(report.target.checkWarrantPairs.every(pair => (
    pair.checks.length === 2 && pair.checks[1].index === pair.checks[0].index + 1
  )));
  assert.deepEqual(report.target.checkWarrantPairs[0].checks.map(check => check.capability), [
    'world.publish',
    'world.promote',
  ]);
  assert.deepEqual(report.target.checkWarrantPairs.at(-1).checks.map(check => check.capability), [
    'world.audit',
    'world.inspect',
  ]);

  for (const record of [...report.target.nativeRun.projections, ...report.target.nativeRun.history]) {
    assert.equal(record.authority.needs.length, 2);
    assert.deepEqual(record.authority.needs, EXPECTED_RULE_NEEDS[record.rule]);
  }
  assert.deepEqual(report.target.nativeRun.state, {
    'world.certified': false,
    'world.level': 2,
    'world.ready': true,
    'world.score': 4.5,
    'world.status': 'armed',
  });
  assert.equal(report.boundaries.notYetImplemented.includes('full native self-hosting'), true);
});
