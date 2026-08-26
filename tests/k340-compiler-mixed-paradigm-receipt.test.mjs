import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { evidenceRoot } from '../src/universal-program-stress.mjs';
import { K340_AI_GENERATION_MUTATIONS } from '../scripts/run-k340-independent-ai-generation.mjs';
import { verifyK340CompilerMixedParadigmCandidate } from '../scripts/verify-k340-compiler-mixed-paradigm-candidate.mjs';
import { verifyK340CompilerMixedParadigmReceipt, verifyK340GithubAuthorityBinding, verifyK340RuntimeEvidence } from '../scripts/verify-k340-compiler-mixed-paradigm-receipt.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SOURCE_PATH = path.join(ROOT, 'examples', 'universal-stress', 'k340-compiler-mixed-paradigm.rcl');
const RUNTIME_PATH = path.join(ROOT, 'examples', 'universal-stress', 'evidence', 'k340-compiler-mixed-paradigm-runtime-v0.1.json');
const CONTRACT_PATH = path.join(ROOT, 'examples', 'universal-stress', 'k340-compiler-mixed-paradigm-ai-generation-contract.v0.1.json');
const RECEIPT_PATH = path.join(ROOT, 'examples', 'universal-stress', 'evidence', 'k340-compiler-mixed-paradigm-ai-generate', 'receipt.json');
const AUTHORITY_PATH = path.join(ROOT, 'examples', 'universal-stress', 'evidence', 'k340-compiler-mixed-paradigm-ai-generate', 'github-replay.json');
function replaceOnce(source, oldText, newText) {
  const index = source.indexOf(oldText);
  assert.notEqual(index, -1);
  assert.equal(source.indexOf(oldText, index + oldText.length), -1);
  return `${source.slice(0, index)}${newText}${source.slice(index + oldText.length)}`;
}

test('K340 replays three independent mixed-paradigm repairs and binds runtime evidence', () => {
  const result = verifyK340CompilerMixedParadigmReceipt();
  assert.equal(result.localAdmitted, true);
  assert.equal(result.successfulTrials, 3);
  assert.equal(result.uniqueGeneratorSessions, 3);
  assert.equal(result.runtimeEvidenceAdmitted, true);
  assert.deepEqual(result.eligibleCells, ['K340']);
  assert.equal(result.results.every((trial) => trial.successful), true);
  if (fs.existsSync(AUTHORITY_PATH)) {
    assert.equal(result.githubAuthority.admitted, true);
    assert.equal(result.aiGenerateAdmission, 'PASS');
    assert.equal(result.verdict, 'PASS_RECEIPT_REPLAY_GITHUB_LINUX_WINDOWS_NATIVE_MIXED_AUTHORITY_BOUND');
  } else {
    assert.equal(result.githubAuthority.admitted, false);
    assert.equal(result.aiGenerateAdmission, 'UNVERIFIED');
    assert.equal(result.verdict, 'PASS_LOCAL_RECEIPT_GITHUB_AUTHORITY_REQUIRED');
  }
});

test('all three K340 AI mutations remain effective native negative controls', () => {
  const canonical = fs.readFileSync(SOURCE_PATH, 'utf8');
  for (const [trialId, mutation] of Object.entries(K340_AI_GENERATION_MUTATIONS)) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), `rcl-${trialId.toLowerCase()}-test-`));
    try {
      const candidatePath = path.join(directory, 'candidate.rcl');
      fs.writeFileSync(candidatePath, replaceOnce(canonical, mutation.old, mutation.replacement));
      assert.equal(verifyK340CompilerMixedParadigmCandidate({ sourcePath: candidatePath }).status, 'FAIL', trialId);
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  }
});

test('K340 runtime receipt fails closed after rooted performance tampering', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-k340-receipt-tamper-'));
  try {
    const evidence = JSON.parse(fs.readFileSync(RUNTIME_PATH, 'utf8'));
    evidence.performance.compileP95Ms = evidence.performance.budget.compileP95MsMax + 1;
    const tampered = path.join(directory, 'runtime.json');
    fs.writeFileSync(tampered, `${JSON.stringify(evidence, null, 2)}\n`);
    assert.throws(() => verifyK340RuntimeEvidence({ runtimeEvidencePath: tampered }), /RCL_K340_RUNTIME_REPORT_ROOT_MISMATCH/u);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('K340 GitHub authority admits only the exact focused and Windows replay steps', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-k340-authority-test-'));
  try {
    const contract = JSON.parse(fs.readFileSync(CONTRACT_PATH, 'utf8'));
    const receipt = JSON.parse(fs.readFileSync(RECEIPT_PATH, 'utf8'));
    const receiptDir = path.join(directory, 'receipt');
    fs.mkdirSync(receiptDir);
    fs.writeFileSync(path.join(receiptDir, 'receipt.json'), JSON.stringify(receipt));
    const sourceCommit = 'a'.repeat(40);
    const authority = {
      format: 'rcl.k340.compiler-mixed-paradigm-github-replay-authority.v0.1',
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
          step: { name: 'K340 independent Compiler Mixed AI receipt replay', conclusion: 'success' },
        },
        windows: {
          id: 789,
          name: 'k01-windows-verification',
          conclusion: 'success',
          step: { name: 'K340 Windows native Compiler Mixed runtime replay', conclusion: 'success' },
        },
      },
    };
    authority.authorityRoot = evidenceRoot(authority);
    const authorityPath = path.join(directory, 'github-replay.json');
    fs.writeFileSync(authorityPath, JSON.stringify(authority));
    assert.equal(verifyK340GithubAuthorityBinding({ authorityPath, contractPath: CONTRACT_PATH, receiptDir }).admitted, true);

    authority.jobs.windows.step.name = 'Different step';
    authority.authorityRoot = evidenceRoot({ ...authority, authorityRoot: undefined });
    fs.writeFileSync(authorityPath, JSON.stringify(authority));
    assert.throws(
      () => verifyK340GithubAuthorityBinding({ authorityPath, contractPath: CONTRACT_PATH, receiptDir }),
      /RCL_K340_GITHUB_AUTHORITY_INVALID/u,
    );
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
