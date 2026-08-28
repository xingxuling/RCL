import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { verifyK336CompilerAutomationCandidate } from '../scripts/verify-k336-compiler-automation-candidate.mjs';
import { K336_AI_GENERATION_MUTATIONS } from '../scripts/run-k336-independent-ai-generation.mjs';
import {
  verifyK336CompilerAutomationReceipt,
  verifyK336RuntimeEvidence,
} from '../scripts/verify-k336-compiler-automation-receipt.mjs';
import { evidenceRoot } from '../src/universal-program-stress.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SOURCE_PATH = path.join(ROOT, 'examples', 'universal-stress', 'k336-compiler-automation.rcl');
const RUNTIME_CONTRACT_PATH = path.join(ROOT, 'examples', 'universal-stress', 'k336-compiler-automation-runtime-contract.v0.1.json');
const RUNTIME_EVIDENCE_PATH = path.join(ROOT, 'examples', 'universal-stress', 'evidence', 'k336-compiler-automation-runtime-v0.1.json');
const AI_CONTRACT_PATH = path.join(ROOT, 'examples', 'universal-stress', 'k336-compiler-automation-ai-generation-contract.v0.1.json');
const AI_RECEIPT_DIR = path.join(ROOT, 'examples', 'universal-stress', 'evidence', 'k336-compiler-automation-ai-generate');

function replaceExactlyOnce(source, oldText, newText) {
  const index = source.indexOf(oldText);
  assert.notEqual(index, -1);
  assert.equal(source.indexOf(oldText, index + oldText.length), -1);
  return `${source.slice(0, index)}${newText}${source.slice(index + oldText.length)}`;
}

test('K336 executes RCL-owned governed automation workflows natively', () => {
  const result = verifyK336CompilerAutomationCandidate();
  assert.equal(result.status, 'PASS');
  assert.deepEqual(result.observed.success, [1, 5, 3, 0, [10, 20, 30], 1]);
  assert.deepEqual(result.observed.retryFailure, [-1, 5, 2, 2, [10, 20, -30], 0]);
  assert.deepEqual(result.observed.unapproved, [-2, 3, 2, 2, [10, 20, -30], 0]);
  assert.deepEqual(result.observed.killSwitch, [-4, 0, 0, 0, [-4], 0]);
  assert.deepEqual(result.observed.invalidDependency, [-3, 0, 0, 0, [-10], 0]);
  assert.deepEqual(result.observed.dryRun, [2, 0, 3, 0, [], 0]);
});

test('K336 dependency, retry, approval and compensation mutations fail closed', () => {
  const canonical = fs.readFileSync(SOURCE_PATH, 'utf8');
  const mutations = [
    ['dependency', 'task_dependency(task) >= completed', 'task_dependency(task) > completed'],
    ['retry', 'task_failures_before_success(sequence_get(tasks, cursor)) < task_max_attempts(sequence_get(tasks, cursor))', 'task_failures_before_success(sequence_get(tasks, cursor)) <= task_max_attempts(sequence_get(tasks, cursor))'],
    ['approval', 'task_requires_approval(sequence_get(tasks, cursor)) == 1 and human_approval == 0', 'task_requires_approval(sequence_get(tasks, cursor)) == 1 and human_approval == 1'],
    ['compensation', 'choose(cursor >= completed,', 'choose(cursor > completed,'],
  ];
  for (const [name, oldText, newText] of mutations) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), `rcl-k336-${name}-`));
    try {
      const candidatePath = path.join(directory, 'candidate.rcl');
      fs.writeFileSync(candidatePath, replaceExactlyOnce(canonical, oldText, newText), 'utf8');
      assert.equal(verifyK336CompilerAutomationCandidate({ sourcePath: candidatePath }).status, 'FAIL', name);
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  }
});

test('K336 runtime evidence is rooted, deterministic and candidate-only before hosted authority', () => {
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
  assert.deepEqual(evidence.eligibleCells, ['K336']);
});

test('K336 independent AI receipt binds three unique exact-canonical native repairs', () => {
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
    assert.ok(K336_AI_GENERATION_MUTATIONS[trial.trialId]);
    const candidatePath = path.join(AI_RECEIPT_DIR, trial.trialId, 'candidate.rcl');
    assert.equal(fs.readFileSync(candidatePath, 'utf8'), canonical);
    assert.equal(verifyK336CompilerAutomationCandidate({ sourcePath: candidatePath }).status, 'PASS');
    assert.equal(trial.restoredCanonicalBytes, true);
    assert.equal(trial.verification.successful, true);
  }
});

test('K336 receipt remains local-only until exact GitHub Linux and Windows authority is present', () => {
  const result = verifyK336CompilerAutomationReceipt();
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

test('K336 rooted runtime tampering fails closed', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-k336-runtime-tamper-'));
  try {
    const evidence = JSON.parse(fs.readFileSync(RUNTIME_EVIDENCE_PATH, 'utf8'));
    evidence.performance.executeP95Ms = evidence.performance.budget.executeP95MsMax + 1;
    const tamperedPath = path.join(directory, 'runtime.json');
    fs.writeFileSync(tamperedPath, JSON.stringify(evidence));
    assert.throws(() => verifyK336RuntimeEvidence({ runtimeEvidencePath: tamperedPath }), /RCL_K336_RUNTIME_REPORT_ROOT_MISMATCH/u);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
