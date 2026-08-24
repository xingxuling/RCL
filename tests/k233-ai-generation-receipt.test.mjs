import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { evidenceRoot } from '../src/universal-program-stress.mjs';
import {
  verifyGithubAuthorityBinding,
  verifyK233AiGenerationReceipt,
} from '../scripts/verify-k233-ai-generation-receipt.mjs';

test('K233 independent AI repair receipts replay fail-closed through the native path', { timeout: 180_000 }, () => {
  const result = verifyK233AiGenerationReceipt();
  assert.equal(result.verdict, 'PASS_RECEIPT_REPLAY_GITHUB_AUTHORITY_BOUND');
  assert.equal(result.aiGenerateAdmission, 'PASS');
  assert.equal(result.githubAuthority.admitted, true);
  assert.equal(result.successfulTrials, 3);
  assert.equal(result.uniqueGeneratorSessions, 3);
  assert.equal(new Set(result.results.map((trial) => trial.semanticStateRoot)).size, 1);
  assert.equal(result.results.every((trial) => trial.successful), true);
});

test('K233 GitHub authority binding rejects a rooted failed replay claim', () => {
  const source = JSON.parse(fs.readFileSync('examples/native-ai/evidence/k233-ai-generate/github-replay.json', 'utf8'));
  source.job.conclusion = 'failure';
  source.authorityRoot = evidenceRoot({ ...source, authorityRoot: undefined });
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-k233-authority-negative-'));
  const authorityPath = path.join(directory, 'github-replay.json');
  fs.writeFileSync(authorityPath, `${JSON.stringify(source, null, 2)}\n`, 'utf8');
  assert.throws(
    () => verifyGithubAuthorityBinding({ authorityPath }),
    /RCL_K233_GITHUB_AUTHORITY_INVALID/,
  );
});
