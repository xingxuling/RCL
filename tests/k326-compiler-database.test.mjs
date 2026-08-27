import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { verifyK326CompilerDatabaseCandidate } from '../scripts/verify-k326-compiler-database-candidate.mjs';
import { K326_AI_GENERATION_MUTATIONS } from '../scripts/run-k326-independent-ai-generation.mjs';
import {
  verifyK326CompilerDatabaseReceipt,
  verifyK326RuntimeEvidence,
} from '../scripts/verify-k326-compiler-database-receipt.mjs';
import { evidenceRoot } from '../src/universal-program-stress.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SOURCE_PATH = path.join(ROOT, 'examples', 'universal-stress', 'k326-compiler-database.rcl');
const RUNTIME_CONTRACT_PATH = path.join(ROOT, 'examples', 'universal-stress', 'k326-compiler-database-runtime-contract.v0.1.json');
const RUNTIME_EVIDENCE_PATH = path.join(ROOT, 'examples', 'universal-stress', 'evidence', 'k326-compiler-database-runtime-v0.1.json');
const AI_CONTRACT_PATH = path.join(ROOT, 'examples', 'universal-stress', 'k326-compiler-database-ai-generation-contract.v0.1.json');
const AI_RECEIPT_DIR = path.join(ROOT, 'examples', 'universal-stress', 'evidence', 'k326-compiler-database-ai-generate');

function replaceExactlyOnce(source, oldText, newText) {
  const index = source.indexOf(oldText);
  assert.notEqual(index, -1);
  assert.equal(source.indexOf(oldText, index + oldText.length), -1);
  return `${source.slice(0, index)}${newText}${source.slice(index + oldText.length)}`;
}

test('K326 executes RCL-owned relational queries and atomic insert transactions natively', () => {
  const result = verifyK326CompilerDatabaseCandidate();
  assert.equal(result.status, 'PASS');
  assert.equal(result.observed.customerCount, 2);
  assert.equal(result.observed.initialSum, 160);
  assert.equal(result.observed.initialJoinCount, 2);
  assert.equal(result.observed.duplicate[1], 0);
  assert.equal(result.observed.orphan[1], 0);
  assert.equal(result.observed.negative[1], 0);
  assert.equal(result.observed.valid[1], 1);
  assert.equal(result.observed.valid[0].length, 5);
  assert.equal(result.observed.committedSum, 185);
  assert.equal(result.observed.committedJoinCount, 3);
});

test('K326 primary-key, foreign-key, aggregate and rollback mutations fail closed', () => {
  const canonical = fs.readFileSync(SOURCE_PATH, 'utf8');
  const mutations = [
    ['primary-key', 'order_id(sequence_get(orders, cursor)) == id', 'order_id(sequence_get(orders, cursor)) != id'],
    ['foreign-key', 'not has_customer(customers, 0, order_customer(row))', 'has_customer(customers, 0, order_customer(row))'],
    ['aggregate', '        order_amount(sequence_get(orders, cursor)),\n        0) + sum_approved_orders_for_region', '        0 - order_amount(sequence_get(orders, cursor)),\n        0) + sum_approved_orders_for_region'],
    ['rollback', 'make_transaction(orders, 0)', 'make_transaction(sequence_append(orders, row), 0)'],
  ];
  for (const [name, oldText, newText] of mutations) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), `rcl-k326-${name}-`));
    try {
      const candidatePath = path.join(directory, 'candidate.rcl');
      fs.writeFileSync(candidatePath, replaceExactlyOnce(canonical, oldText, newText), 'utf8');
      assert.equal(verifyK326CompilerDatabaseCandidate({ sourcePath: candidatePath }).status, 'FAIL', name);
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  }
});

test('K326 runtime evidence is rooted, deterministic and candidate-only before hosted authority', () => {
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
  assert.deepEqual(evidence.eligibleCells, ['K326']);
});

test('K326 independent AI receipt binds three unique exact-canonical native repairs', () => {
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
    assert.ok(K326_AI_GENERATION_MUTATIONS[trial.trialId]);
    const candidatePath = path.join(AI_RECEIPT_DIR, trial.trialId, 'candidate.rcl');
    assert.equal(fs.readFileSync(candidatePath, 'utf8'), canonical);
    assert.equal(verifyK326CompilerDatabaseCandidate({ sourcePath: candidatePath }).status, 'PASS');
    assert.equal(trial.restoredCanonicalBytes, true);
    assert.equal(trial.verification.successful, true);
  }
});

test('K326 receipt remains local-only until exact GitHub Linux and Windows authority is present', () => {
  const result = verifyK326CompilerDatabaseReceipt();
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

test('K326 rooted runtime tampering fails closed', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-k326-runtime-tamper-'));
  try {
    const evidence = JSON.parse(fs.readFileSync(RUNTIME_EVIDENCE_PATH, 'utf8'));
    evidence.performance.executeP95Ms = evidence.performance.budget.executeP95MsMax + 1;
    const tamperedPath = path.join(directory, 'runtime.json');
    fs.writeFileSync(tamperedPath, JSON.stringify(evidence));
    assert.throws(() => verifyK326RuntimeEvidence({ runtimeEvidencePath: tamperedPath }), /RCL_K326_RUNTIME_REPORT_ROOT_MISMATCH/u);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
