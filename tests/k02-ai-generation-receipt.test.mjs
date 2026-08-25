import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { evidenceRoot } from '../src/universal-program-stress.mjs';
import { K02_AI_GENERATION_MUTATIONS } from '../scripts/run-k02-independent-ai-generation.mjs';
import {
  verifyK02AiGenerationReceipt,
  verifyK02GithubAuthorityBinding,
} from '../scripts/verify-k02-ai-generation-receipt.mjs';
import { verifyK02WebCandidate } from '../scripts/verify-k02-web-candidate.mjs';

const SOURCE_PATH = 'examples/universal-stress/k02-complete-web-app.rcl';
const SPEC_PATH = 'examples/universal-stress/k02-complete-web-app.web.json';

function replaceExactlyOnce(source, oldText, newText) {
  const index = source.indexOf(oldText);
  assert.ok(index >= 0);
  assert.equal(source.indexOf(oldText, index + oldText.length), -1);
  return `${source.slice(0, index)}${newText}${source.slice(index + oldText.length)}`;
}

test('K02 independent AI repair receipts replay through RCL Web and loopback Server', { timeout: 30_000 }, async () => {
  const result = await verifyK02AiGenerationReceipt();
  assert.equal(result.localAdmitted, true);
  assert.equal(result.successfulTrials, 3);
  assert.equal(result.uniqueGeneratorSessions, 3);
  assert.deepEqual(result.eligibleCells, ['K063', 'K064', 'K078']);
  assert.equal(result.results.every((trial) => trial.successful), true);
  assert.equal(new Set(result.results.map((trial) => trial.manifestRoot)).size, 1);
  if (fs.existsSync('examples/universal-stress/evidence/k02-ai-generate/github-replay.json')) {
    assert.equal(result.githubAuthority.admitted, true);
    assert.equal(result.aiGenerateAdmission, 'PASS');
  } else {
    assert.equal(result.aiGenerateAdmission, 'UNVERIFIED');
  }
});

test('all three frozen K02 semantic mutations are effective negative controls', { timeout: 30_000 }, async () => {
  const canonical = {
    'candidate.rcl': fs.readFileSync(SOURCE_PATH, 'utf8'),
    'candidate.web.json': fs.readFileSync(SPEC_PATH, 'utf8'),
  };
  for (const [trialId, mutation] of Object.entries(K02_AI_GENERATION_MUTATIONS)) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), `rcl-${trialId.toLowerCase()}-negative-`));
    const sourcePath = path.join(directory, 'candidate.rcl');
    const specPath = path.join(directory, 'candidate.web.json');
    const mutated = {
      ...canonical,
      [mutation.file]: replaceExactlyOnce(canonical[mutation.file], mutation.old, mutation.replacement),
    };
    fs.writeFileSync(sourcePath, mutated['candidate.rcl'], 'utf8');
    fs.writeFileSync(specPath, mutated['candidate.web.json'], 'utf8');
    const result = await verifyK02WebCandidate({ sourcePath, specPath });
    fs.rmSync(directory, { recursive: true, force: true });
    assert.equal(result.status, 'FAIL', `${trialId} must fail before independent repair`);
  }
});

test('K02 GitHub authority binding rejects a rooted failed replay claim', () => {
  const sourcePath = 'examples/native-ai/evidence/k233-ai-generate/github-replay.json';
  const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
  const contract = JSON.parse(fs.readFileSync('examples/universal-stress/k02-ai-generation-contract.v0.1.json', 'utf8'));
  const local = JSON.parse(fs.readFileSync('examples/universal-stress/evidence/k02-ai-generate/receipt.json', 'utf8'));
  const invalid = {
    format: 'rcl.k02.github-replay-authority.v0.1',
    authority: 'GITHUB_HOSTED_ACTIONS',
    sourceCommit: source.sourceCommit,
    workflow: { ...source.workflow },
    run: { ...source.run, headSha: source.sourceCommit },
    job: { ...source.job, name: 'focused-verification', conclusion: 'failure' },
    step: { name: 'K02 independent AI generation receipt replay', conclusion: 'success' },
    contractRoot: evidenceRoot(contract),
    localReceiptReportRoot: local.reportRoot,
    authorityRoot: null,
  };
  invalid.authorityRoot = evidenceRoot({ ...invalid, authorityRoot: undefined });
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-k02-authority-negative-'));
  const authorityPath = path.join(directory, 'github-replay.json');
  fs.writeFileSync(authorityPath, `${JSON.stringify(invalid, null, 2)}\n`, 'utf8');
  assert.throws(
    () => verifyK02GithubAuthorityBinding({ authorityPath }),
    /RCL_K02_GITHUB_AUTHORITY_INVALID/u,
  );
  fs.rmSync(directory, { recursive: true, force: true });
});
