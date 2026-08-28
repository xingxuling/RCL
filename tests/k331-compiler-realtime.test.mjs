import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { K331_AI_GENERATION_MUTATIONS } from '../scripts/run-k331-independent-ai-generation.mjs';
import { verifyK331CompilerRealtimeCandidate } from '../scripts/verify-k331-compiler-realtime-candidate.mjs';
import { verifyK331CompilerRealtimeReceipt, verifyK331RuntimeEvidence } from '../scripts/verify-k331-compiler-realtime-receipt.mjs';
import { evidenceRoot } from '../src/universal-program-stress.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SOURCE_PATH = path.join(ROOT, 'examples', 'universal-stress', 'k331-compiler-realtime.rcl');
const RUNTIME_CONTRACT_PATH = path.join(ROOT, 'examples', 'universal-stress', 'k331-compiler-realtime-runtime-contract.v0.1.json');
const RUNTIME_EVIDENCE_PATH = path.join(ROOT, 'examples', 'universal-stress', 'evidence', 'k331-compiler-realtime-runtime-v0.1.json');
const AI_CONTRACT_PATH = path.join(ROOT, 'examples', 'universal-stress', 'k331-compiler-realtime-ai-generation-contract.v0.1.json');
const AI_RECEIPT_DIR = path.join(ROOT, 'examples', 'universal-stress', 'evidence', 'k331-compiler-realtime-ai-generate');

function replaceExactlyOnce(source, oldText, newText) {
  const index = source.indexOf(oldText);
  assert.notEqual(index, -1);
  assert.equal(source.indexOf(oldText, index + oldText.length), -1);
  return `${source.slice(0, index)}${newText}${source.slice(index + oldText.length)}`;
}

test('K331 executes RCL-owned bounded logical-time semantics natively and matches the auxiliary oracle', () => {
  const result = verifyK331CompilerRealtimeCandidate();
  assert.equal(result.status, 'PASS');
  assert.deepEqual(result.observed.sortedIds, [10, 15, 20, 30, 40]);
  assert.deepEqual(result.observed.success, [1, 4, [10, 15, 20, 30]]);
  assert.deepEqual(result.oracle.success, result.observed.success);
  assert.equal(result.oracle.budgetAtomic, true);
  assert.equal(result.oracle.authorityRejected, true);
});

test('K331 priority, monotonicity, budget and authority mutations fail closed', () => {
  const canonical = fs.readFileSync(SOURCE_PATH, 'utf8');
  const mutations = [
    ['priority', 'event_priority(left) < event_priority(right)', 'event_priority(left) > event_priority(right)'],
    ['monotonicity', 'choose(target < current,', 'choose(target > current,'],
    ['budget', ') > max_events,', ') < max_events,'],
    ['authority', 'temporal_commit_capability != 1', 'temporal_commit_capability != 0'],
  ];
  for (const [name, oldText, newText] of mutations) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), `rcl-k331-${name}-`));
    try {
      const candidatePath = path.join(directory, 'candidate.rcl');
      fs.writeFileSync(candidatePath, replaceExactlyOnce(canonical, oldText, newText), 'utf8');
      assert.equal(verifyK331CompilerRealtimeCandidate({ sourcePath: candidatePath }).status, 'FAIL', name);
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  }
});

test('K331 runtime evidence is rooted, deterministic and candidate-only before hosted authority', () => {
  const contract = JSON.parse(fs.readFileSync(RUNTIME_CONTRACT_PATH, 'utf8'));
  const evidence = JSON.parse(fs.readFileSync(RUNTIME_EVIDENCE_PATH, 'utf8'));
  assert.equal(evidence.contractRoot, evidenceRoot(contract));
  assert.equal(evidence.reportRoot, evidenceRoot({ ...evidence, generatedAt: undefined, reportRoot: undefined }));
  assert.equal(evidence.status, 'PASS');
  assert.equal(evidence.summary.successfulRounds, 20);
  assert.equal(evidence.summary.uniqueStateRoots, 1);
  assert.equal(evidence.summary.uniqueArtifactHashes, 1);
  assert.equal(evidence.summary.controlsPassed, true);
  assert.equal(evidence.summary.performancePassed, true);
  assert.deepEqual(evidence.eligibleCells, ['K331']);
});

test('K331 independent AI receipt binds three unique exact-canonical native repairs', () => {
  const canonical = fs.readFileSync(SOURCE_PATH, 'utf8');
  const contract = JSON.parse(fs.readFileSync(AI_CONTRACT_PATH, 'utf8'));
  const report = JSON.parse(fs.readFileSync(path.join(AI_RECEIPT_DIR, 'receipt.json'), 'utf8'));
  assert.equal(report.contractRoot, evidenceRoot(contract));
  assert.equal(report.reportRoot, evidenceRoot({ ...report, generatedAt: undefined, reportRoot: undefined }));
  assert.equal(report.successfulTrials, 3);
  assert.equal(report.uniqueGeneratorSessions, 3);
  assert.equal(new Set(report.trials.map((trial) => trial.generator.threadId)).size, 3);
  for (const trial of report.trials) {
    assert.equal(trial.receiptRoot, evidenceRoot({ ...trial, receiptRoot: undefined }));
    assert.ok(K331_AI_GENERATION_MUTATIONS[trial.trialId]);
    const candidatePath = path.join(AI_RECEIPT_DIR, trial.trialId, 'candidate.rcl');
    assert.equal(fs.readFileSync(candidatePath, 'utf8'), canonical);
    assert.equal(verifyK331CompilerRealtimeCandidate({ sourcePath: candidatePath }).status, 'PASS');
    assert.equal(trial.restoredCanonicalBytes, true);
    assert.equal(trial.verification.successful, true);
  }
});

test('K331 receipt remains local-only until exact GitHub Linux and Windows authority is present', () => {
  const result = verifyK331CompilerRealtimeReceipt();
  assert.equal(result.localAdmitted, true);
  assert.equal(result.successfulTrials, 3);
  assert.equal(result.uniqueGeneratorSessions, 3);
  assert.equal(result.runtimeEvidenceAdmitted, true);
  if (fs.existsSync(path.join(AI_RECEIPT_DIR, 'github-replay.json'))) {
    assert.equal(result.githubAuthority.admitted, true);
    assert.equal(result.aiGenerateAdmission, 'PASS');
  } else {
    assert.equal(result.githubAuthority.admitted, false);
    assert.equal(result.aiGenerateAdmission, 'UNVERIFIED');
    assert.equal(result.verdict, 'PASS_LOCAL_RECEIPT_GITHUB_AUTHORITY_REQUIRED');
  }
});

test('K331 rooted runtime tampering fails closed', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-k331-runtime-tamper-'));
  try {
    const evidence = JSON.parse(fs.readFileSync(RUNTIME_EVIDENCE_PATH, 'utf8'));
    evidence.performance.executeP95Ms = evidence.performance.budget.executeP95MsMax + 1;
    const tamperedPath = path.join(directory, 'runtime.json');
    fs.writeFileSync(tamperedPath, JSON.stringify(evidence));
    assert.throws(() => verifyK331RuntimeEvidence({ runtimeEvidencePath: tamperedPath }), /RCL_K331_RUNTIME_REPORT_ROOT_MISMATCH/u);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
