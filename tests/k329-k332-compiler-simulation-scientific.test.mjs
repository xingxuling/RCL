import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { verifyK329K332CompilerSimulationScientificCandidate } from '../scripts/verify-k329-k332-compiler-simulation-scientific-candidate.mjs';
import { K329_K332_AI_GENERATION_MUTATIONS } from '../scripts/run-k329-k332-independent-ai-generation.mjs';
import {
  verifyK329K332CompilerSimulationScientificReceipt,
  verifyK329K332GithubAuthorityBinding,
  verifyK329K332RuntimeEvidence,
} from '../scripts/verify-k329-k332-compiler-simulation-scientific-receipt.mjs';
import { evidenceRoot } from '../src/universal-program-stress.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SOURCE_PATH = path.join(ROOT, 'examples', 'universal-stress', 'k329-k332-compiler-simulation-scientific.rcl');
const CONTRACT_PATH = path.join(ROOT, 'examples', 'universal-stress', 'k329-k332-compiler-simulation-scientific-runtime-contract.v0.1.json');
const EVIDENCE_PATH = path.join(ROOT, 'examples', 'universal-stress', 'evidence', 'k329-k332-compiler-simulation-scientific-runtime-v0.1.json');
const AI_CONTRACT_PATH = path.join(ROOT, 'examples', 'universal-stress', 'k329-k332-compiler-simulation-scientific-ai-generation-contract.v0.1.json');
const AI_RECEIPT_DIR = path.join(ROOT, 'examples', 'universal-stress', 'evidence', 'k329-k332-compiler-simulation-scientific-ai-generate');
function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }

function replaceExactlyOnce(source, oldText, newText) {
  const index = source.indexOf(oldText);
  assert.notEqual(index, -1);
  assert.equal(source.indexOf(oldText, index + oldText.length), -1);
  return `${source.slice(0, index)}${newText}${source.slice(index + oldText.length)}`;
}

test('K329/K332 executes a native RCL simulation with an independent scientific oracle', () => {
  const result = verifyK329K332CompilerSimulationScientificCandidate();
  assert.equal(result.status, 'PASS');
  assert.equal(result.observed.position, 120);
  assert.equal(result.observed.velocity, 23);
  assert.deepEqual(result.observed.trajectory, [0, 3, 8, 15, 24, 35, 48, 63, 80, 99, 120]);
  assert.equal(result.observed.oraclePosition, 120);
  assert.equal(result.observed.oracleVelocity, 23);
});

test('K329/K332 simulation, scientific and boundary mutations remain effective', () => {
  const canonical = fs.readFileSync(SOURCE_PATH, 'utf8');
  const mutations = [
    ['position', 'make_state(\n      state_position(state) + state_velocity(state),', 'make_state(\n      state_position(state) + acceleration,'],
    ['velocity', 'state_velocity(state) + acceleration,', 'state_velocity(state) - acceleration,'],
    ['oracle', 'acceleration * steps * (steps - 1) / 2', 'acceleration * steps * (steps + 1) / 2'],
    ['zero-step', 'choose(completed >= steps,', 'choose(completed > steps,'],
  ];
  for (const [name, oldText, newText] of mutations) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), `rcl-k329-k332-${name}-`));
    try {
      const candidatePath = path.join(directory, 'candidate.rcl');
      fs.writeFileSync(candidatePath, replaceExactlyOnce(canonical, oldText, newText), 'utf8');
      assert.equal(verifyK329K332CompilerSimulationScientificCandidate({ sourcePath: candidatePath }).status, 'FAIL', name);
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  }
});

test('K329/K332 runtime evidence is rooted and candidate-only', () => {
  const contract = JSON.parse(fs.readFileSync(CONTRACT_PATH, 'utf8'));
  const evidence = JSON.parse(fs.readFileSync(EVIDENCE_PATH, 'utf8'));
  assert.equal(evidence.contractRoot, evidenceRoot(contract));
  assert.equal(evidence.reportRoot, evidenceRoot({ ...evidence, generatedAt: undefined, reportRoot: undefined }));
  assert.equal(evidence.status, 'PASS');
  assert.equal(evidence.summary.successfulRounds, 20);
  assert.equal(evidence.summary.uniqueStateRoots, 1);
  assert.equal(evidence.summary.uniqueArtifactHashes, 1);
  assert.equal(evidence.summary.controlsPassed, true);
  assert.equal(evidence.summary.performancePassed, true);
  assert.deepEqual(evidence.eligibleCells, ['K329', 'K332']);
});

test('K329/K332 AI receipt binds three unique exact-canonical native repairs', () => {
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
    const mutation = K329_K332_AI_GENERATION_MUTATIONS[trial.trialId];
    const mutated = replaceExactlyOnce(canonical, mutation.old, mutation.replacement);
    assert.equal(trial.mutatedSourceSha256, sha256(mutated));
    const candidatePath = path.join(AI_RECEIPT_DIR, trial.trialId, 'candidate.rcl');
    assert.equal(fs.readFileSync(candidatePath, 'utf8'), canonical);
    assert.equal(verifyK329K332CompilerSimulationScientificCandidate({ sourcePath: candidatePath }).status, 'PASS');
    assert.equal(trial.restoredCanonicalBytes, true);
    assert.equal(trial.verification.successful, true);
  }
});

test('K329/K332 independent receipt replay remains local without hosted authority', () => {
  const result = verifyK329K332CompilerSimulationScientificReceipt();
  assert.equal(result.localAdmitted, true);
  assert.equal(result.successfulTrials, 3);
  assert.equal(result.uniqueGeneratorSessions, 3);
  assert.equal(result.runtimeEvidenceAdmitted, true);
  assert.equal(result.aiGenerateAdmission, 'UNVERIFIED');
  assert.deepEqual(result.eligibleCells, ['K329', 'K332']);
});

test('K329/K332 rooted runtime tampering fails closed', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-k329-k332-runtime-tamper-'));
  try {
    const evidence = JSON.parse(fs.readFileSync(EVIDENCE_PATH, 'utf8'));
    evidence.performance.executeP95Ms = evidence.performance.budget.executeP95MsMax + 1;
    const tamperedPath = path.join(directory, 'runtime.json');
    fs.writeFileSync(tamperedPath, JSON.stringify(evidence));
    assert.throws(() => verifyK329K332RuntimeEvidence({ runtimeEvidencePath: tamperedPath }), /RCL_K329_K332_RUNTIME_REPORT_ROOT_MISMATCH/u);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('K329/K332 GitHub authority requires exact focused and Windows replay steps', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-k329-k332-authority-'));
  try {
    const contract = JSON.parse(fs.readFileSync(AI_CONTRACT_PATH, 'utf8'));
    const receipt = JSON.parse(fs.readFileSync(path.join(AI_RECEIPT_DIR, 'receipt.json'), 'utf8'));
    const receiptDir = path.join(directory, 'receipt');
    fs.mkdirSync(receiptDir);
    fs.writeFileSync(path.join(receiptDir, 'receipt.json'), JSON.stringify(receipt));
    const sourceCommit = 'c'.repeat(40);
    const authority = {
      format: 'rcl.k329-k332.compiler-simulation-scientific-github-replay-authority.v0.1',
      authority: 'GITHUB_HOSTED_ACTIONS',
      verifiedAt: '2026-08-27T00:00:00.000Z',
      sourceCommit,
      contractRoot: evidenceRoot(contract),
      localReceiptReportRoot: receipt.reportRoot,
      runtimeEvidenceBindingRoot: evidenceRoot(receipt.runtimeEvidenceBinding),
      workflow: { name: 'RCL Universal Program Stress v0.1', event: 'push' },
      run: { id: 123, url: 'https://github.com/xingxuling/RCL/actions/runs/123', headSha: sourceCommit },
      jobs: {
        focused: {
          id: 456,
          name: 'focused-verification',
          conclusion: 'success',
          step: { name: 'K329/K332 independent Compiler Simulation Scientific AI receipt replay', conclusion: 'success' },
        },
        windows: {
          id: 789,
          name: 'k01-windows-verification',
          conclusion: 'success',
          step: { name: 'K329/K332 Windows native Compiler Simulation Scientific runtime replay', conclusion: 'success' },
        },
      },
    };
    authority.authorityRoot = evidenceRoot(authority);
    const authorityPath = path.join(directory, 'github-replay.json');
    fs.writeFileSync(authorityPath, JSON.stringify(authority));
    assert.equal(verifyK329K332GithubAuthorityBinding({ authorityPath, contractPath: AI_CONTRACT_PATH, receiptDir }).admitted, true);
    authority.jobs.windows.step.name = 'Different step';
    authority.authorityRoot = evidenceRoot({ ...authority, authorityRoot: undefined });
    fs.writeFileSync(authorityPath, JSON.stringify(authority));
    assert.throws(
      () => verifyK329K332GithubAuthorityBinding({ authorityPath, contractPath: AI_CONTRACT_PATH, receiptDir }),
      /RCL_K329_K332_GITHUB_AUTHORITY_INVALID/u,
    );
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
