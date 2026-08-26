import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { runK337K338CompilerGovernanceReactiveEvidence } from '../scripts/run-k337-k338-compiler-governance-reactive-evidence.mjs';
import { verifyK337K338CompilerGovernanceReactiveCandidate } from '../scripts/verify-k337-k338-compiler-governance-reactive-candidate.mjs';

test('K337/K338 native compiler governance and reactive runtime replays the frozen contract', { timeout: 120_000 }, () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-k337-k338-test-'));
  try {
    const evidence = runK337K338CompilerGovernanceReactiveEvidence({
      outputPath: path.join(directory, 'runtime-evidence.json'),
    });
    assert.equal(evidence.status, 'PASS');
    assert.equal(evidence.summary.successfulRounds, 20);
    assert.equal(evidence.summary.uniqueStateRoots, 1);
    assert.equal(evidence.summary.uniqueArtifactHashes, 1);
    assert.equal(evidence.summary.controlsPassed, true);
    assert.equal(evidence.summary.performancePassed, true);
    assert.deepEqual(evidence.negativeControls, {
      missingWarrantRejected: true,
      brokenPreserveRejected: true,
      invalidRequestNoMutation: true,
      corruptRbcRejected: true,
    });
    assert.deepEqual(evidence.negativeControlDetails.missingWarrant, {
      rejectionStage: 'NATIVE_VM_BEFORE_COMMIT',
      compileExitCode: 0,
      executeExitCode: 1,
      errorCode: 'RCL_AUTHORITY_DENIED',
    });
    assert.equal(evidence.rounds[0].transactionRoots[0].afterRoot, evidence.rounds[0].transactionRoots[1].beforeRoot);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('K337/K338 checked-in receipt is rooted and discloses the static warrant-validation gap', () => {
  const result = verifyK337K338CompilerGovernanceReactiveCandidate();
  assert.equal(result.localRuntimeAdmitted, true);
  assert.deepEqual(result.eligibleCells, ['K337', 'K338']);
  assert.equal(result.rclGap, 'RCL_GAP_K337_SELFHOST_WARRANT_STATIC_VALIDATION');
  assert.equal(result.aiGenerateAdmission, 'UNVERIFIED');
  assert.equal(result.githubHostedAdmission, 'UNVERIFIED');
});
