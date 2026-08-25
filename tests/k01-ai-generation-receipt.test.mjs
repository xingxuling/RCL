import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { evidenceRoot } from '../src/universal-program-stress.mjs';
import { K01_AI_GENERATION_MUTATIONS } from '../scripts/run-k01-independent-ai-generation.mjs';
import { verifyK01AiGenerationReceipt, verifyK01GithubAuthorityBinding } from '../scripts/verify-k01-ai-generation-receipt.mjs';
import { verifyK01CompilerCandidate } from '../scripts/verify-k01-compiler-candidate.mjs';

function replaceExactlyOnce(source, oldText, newText) {
  const index = source.indexOf(oldText);
  assert.ok(index >= 0);
  assert.equal(source.indexOf(oldText, index + oldText.length), -1);
  return `${source.slice(0, index)}${newText}${source.slice(index + oldText.length)}`;
}

test('K01 independent compiler repair receipt replays all three unique sessions and shared fixed point', () => {
  const result = verifyK01AiGenerationReceipt();
  assert.equal(result.localAdmitted, true);
  assert.equal(result.successfulTrials, 3);
  assert.equal(result.uniqueGeneratorSessions, 3);
  assert.equal(result.fixedPointAdmitted, true);
  assert.deepEqual(result.eligibleCells, ['K339']);
  assert.equal(result.results.every((trial) => trial.successful), true);
  if (fs.existsSync('examples/universal-stress/evidence/k01-ai-generate/github-replay.json')) {
    assert.equal(result.githubAuthority.admitted, true);
    assert.equal(result.aiGenerateAdmission, 'PASS');
  } else {
    assert.equal(result.aiGenerateAdmission, 'UNVERIFIED');
  }
});

test('all three K01 compiler mutations are effective negative controls', () => {
  const canonical = {
    'candidate-core.rcl': fs.readFileSync('selfhost/compiler-core.rcl', 'utf8'),
    'candidate-main.rcl': fs.readFileSync('selfhost/compiler-main.rcl', 'utf8'),
  };
  for (const [trialId, mutation] of Object.entries(K01_AI_GENERATION_MUTATIONS)) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), `rcl-${trialId.toLowerCase()}-negative-`));
    try {
      const corePath = path.join(directory, 'candidate-core.rcl');
      const mainPath = path.join(directory, 'candidate-main.rcl');
      const mutated = { ...canonical, [mutation.file]: replaceExactlyOnce(canonical[mutation.file], mutation.old, mutation.replacement) };
      fs.writeFileSync(corePath, mutated['candidate-core.rcl'], 'utf8');
      fs.writeFileSync(mainPath, mutated['candidate-main.rcl'], 'utf8');
      assert.equal(verifyK01CompilerCandidate({ corePath, mainPath }).status, 'FAIL', `${trialId} must fail before repair`);
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  }
});

test('K01 GitHub authority rejects a rooted claim missing Windows success', () => {
  const contract = JSON.parse(fs.readFileSync('examples/universal-stress/k01-ai-generation-contract.v0.2.json', 'utf8'));
  const local = JSON.parse(fs.readFileSync('examples/universal-stress/evidence/k01-ai-generate/receipt.json', 'utf8'));
  const invalid = {
    format: 'rcl.k01.github-replay-authority.v0.2',
    authority: 'GITHUB_HOSTED_ACTIONS',
    sourceCommit: 'a'.repeat(40),
    workflow: { name: 'RCL Universal Program Stress v0.1', event: 'push' },
    run: { id: 1, headSha: 'a'.repeat(40), url: 'https://example.invalid/run' },
    jobs: {
      focused: { id: 2, name: 'focused-verification', conclusion: 'success', step: { name: 'K01 independent AI generation receipt replay', conclusion: 'success' } },
      windows: { id: 3, name: 'k01-windows-verification', conclusion: 'failure', step: { name: 'K01 Windows self-hosting compiler campaign', conclusion: 'success' } },
    },
    contractRoot: evidenceRoot(contract),
    localReceiptReportRoot: local.reportRoot,
    authorityRoot: null,
  };
  invalid.authorityRoot = evidenceRoot({ ...invalid, authorityRoot: undefined });
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-k01-authority-negative-'));
  try {
    const authorityPath = path.join(directory, 'github-replay.json');
    fs.writeFileSync(authorityPath, `${JSON.stringify(invalid, null, 2)}\n`, 'utf8');
    assert.throws(() => verifyK01GithubAuthorityBinding({ authorityPath }), /RCL_K01_GITHUB_AUTHORITY_INVALID/u);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
