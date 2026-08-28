import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { verifyK334CompilerAgentCandidate } from '../scripts/verify-k334-compiler-agent-candidate.mjs';
import { K334_AI_GENERATION_MUTATIONS } from '../scripts/run-k334-independent-ai-generation.mjs';
import { verifyK334CompilerAgentReceipt, verifyK334RuntimeEvidence } from '../scripts/verify-k334-compiler-agent-receipt.mjs';
import { evidenceRoot } from '../src/universal-program-stress.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SOURCE_PATH = path.join(ROOT, 'examples', 'universal-stress', 'k334-compiler-agent.rcl');
const RUNTIME_CONTRACT_PATH = path.join(ROOT, 'examples', 'universal-stress', 'k334-compiler-agent-runtime-contract.v0.1.json');
const RUNTIME_EVIDENCE_PATH = path.join(ROOT, 'examples', 'universal-stress', 'evidence', 'k334-compiler-agent-runtime-v0.1.json');
const AI_CONTRACT_PATH = path.join(ROOT, 'examples', 'universal-stress', 'k334-compiler-agent-ai-generation-contract.v0.1.json');
const AI_RECEIPT_DIR = path.join(ROOT, 'examples', 'universal-stress', 'evidence', 'k334-compiler-agent-ai-generate');

function replaceExactlyOnce(source, oldText, newText) {
  const index = source.indexOf(oldText);
  assert.notEqual(index, -1);
  assert.equal(source.indexOf(oldText, index + oldText.length), -1);
  return `${source.slice(0, index)}${newText}${source.slice(index + oldText.length)}`;
}

test('K334 executes RCL-owned bounded governed agent deliberation natively', () => {
  const result = verifyK334CompilerAgentCandidate();
  assert.equal(result.status, 'PASS');
  assert.deepEqual(result.observed.success, [1, 20, 11, 3, [10, 20], 1]);
  assert.deepEqual(result.observed.observeOnly, [2, 20, 11, 0, [10, 20], 0]);
  assert.deepEqual(result.observed.capabilityDenied, [-1, 0, 0, 0, [-30], 0]);
  assert.deepEqual(result.observed.budgetDenied, [-2, 0, 0, 0, [-40], 0]);
  assert.deepEqual(result.observed.unapproved, [-3, 0, 0, 0, [-20], 0]);
  assert.deepEqual(result.observed.riskDenied, [-5, 0, 0, 0, [-50], 0]);
  assert.deepEqual(result.observed.killSwitch, [-4, 0, 0, 0, [-4], 0]);
});

test('K334 capability, budget, approval and selection mutations fail closed', () => {
  const canonical = fs.readFileSync(SOURCE_PATH, 'utf8');
  const mutations = [
    ['capability', 'action_capability(action) != granted_capability', 'action_capability(action) == granted_capability'],
    ['budget', 'action_cost(action) > budget', 'action_cost(action) < budget'],
    ['approval', 'action_requires_approval(action) == 1 and human_approval == 0', 'action_requires_approval(action) == 1 and human_approval == 1'],
    ['selection', 'action_score(sequence_get(actions, cursor)) > best_score', 'action_score(sequence_get(actions, cursor)) < best_score'],
  ];
  for (const [name, oldText, newText] of mutations) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), `rcl-k334-${name}-`));
    try {
      const candidatePath = path.join(directory, 'candidate.rcl');
      fs.writeFileSync(candidatePath, replaceExactlyOnce(canonical, oldText, newText), 'utf8');
      assert.equal(verifyK334CompilerAgentCandidate({ sourcePath: candidatePath }).status, 'FAIL', name);
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  }
});

test('K334 runtime evidence is rooted, deterministic and candidate-only before hosted authority', () => {
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
  assert.deepEqual(evidence.eligibleCells, ['K334']);
});

test('K334 independent AI receipt binds three unique exact-canonical native repairs', () => {
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
    assert.ok(K334_AI_GENERATION_MUTATIONS[trial.trialId]);
    const candidatePath = path.join(AI_RECEIPT_DIR, trial.trialId, 'candidate.rcl');
    assert.equal(fs.readFileSync(candidatePath, 'utf8'), canonical);
    assert.equal(verifyK334CompilerAgentCandidate({ sourcePath: candidatePath }).status, 'PASS');
    assert.equal(trial.restoredCanonicalBytes, true);
    assert.equal(trial.verification.successful, true);
  }
});

test('K334 receipt remains local-only until exact GitHub Linux and Windows authority is present', () => {
  const result = verifyK334CompilerAgentReceipt();
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

test('K334 rooted runtime tampering fails closed', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-k334-runtime-tamper-'));
  try {
    const evidence = JSON.parse(fs.readFileSync(RUNTIME_EVIDENCE_PATH, 'utf8'));
    evidence.performance.executeP95Ms = evidence.performance.budget.executeP95MsMax + 1;
    const tamperedPath = path.join(directory, 'runtime.json');
    fs.writeFileSync(tamperedPath, JSON.stringify(evidence));
    assert.throws(() => verifyK334RuntimeEvidence({ runtimeEvidencePath: tamperedPath }), /RCL_K334_RUNTIME_REPORT_ROOT_MISMATCH/u);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
