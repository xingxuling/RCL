import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { runK340CompilerMixedParadigmEvidence } from '../scripts/run-k340-compiler-mixed-paradigm-evidence.mjs';
import { verifyK340CompilerMixedParadigmCandidate } from '../scripts/verify-k340-compiler-mixed-paradigm-candidate.mjs';

test('K340 replays recursive, authority, transaction and state-trigger paradigms in one native program', { timeout: 120_000 }, () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-k340-test-'));
  try {
    const evidence = runK340CompilerMixedParadigmEvidence({ outputPath: path.join(directory, 'runtime.json') });
    assert.equal(evidence.status, 'PASS');
    assert.equal(evidence.summary.successfulRounds, 20);
    assert.equal(evidence.summary.uniqueStateRoots, 1);
    assert.equal(evidence.summary.uniqueArtifactHashes, 1);
    assert.equal(evidence.summary.controlsPassed, true);
    assert.equal(evidence.summary.performancePassed, true);
    assert.deepEqual(evidence.negativeControls, {
      recursiveMutationRejected: true,
      phaseMutationNoCommit: true,
      missingWarrantRejected: true,
      zeroBatchNoMutation: true,
      corruptRbcRejected: true,
    });
    assert.equal(evidence.rounds.every((round) => round.peakCallFrames > 0), true);
    assert.equal(evidence.rounds.every((round) => round.transactionRoots[0].afterRoot === round.transactionRoots[1].beforeRoot), true);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('K340 checked-in receipt is rooted but grants no AI or hosted admission', () => {
  const result = verifyK340CompilerMixedParadigmCandidate();
  assert.equal(result.localRuntimeAdmitted, true);
  assert.deepEqual(result.eligibleCells, ['K340']);
  assert.equal(result.paradigms.length, 4);
  assert.equal(result.aiGenerateAdmission, 'UNVERIFIED');
  assert.equal(result.githubHostedAdmission, 'UNVERIFIED');
});

test('K340 rooted receipt fails closed after control tampering', () => {
  const source = path.resolve('examples/universal-stress/evidence/k340-compiler-mixed-paradigm-runtime-v0.1.json');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-k340-tamper-'));
  try {
    const evidence = JSON.parse(fs.readFileSync(source, 'utf8'));
    evidence.negativeControls.recursiveMutationRejected = false;
    const tampered = path.join(directory, 'runtime.json');
    fs.writeFileSync(tampered, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
    assert.throws(() => verifyK340CompilerMixedParadigmCandidate({ evidencePath: tampered }), /RCL_K340_REPORT_ROOT/u);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
