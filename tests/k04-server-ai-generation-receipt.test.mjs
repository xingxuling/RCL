import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { K04_SERVER_AI_GENERATION_MUTATIONS } from '../scripts/run-k04-independent-ai-generation.mjs';
import { verifyK04ServerAiGenerationReceipt } from '../scripts/verify-k04-server-ai-generation-receipt.mjs';
import { verifyK04ServerCandidate } from '../scripts/verify-k04-server-candidate.mjs';

function replaceExactlyOnce(source, oldText, newText) {
  const index = source.indexOf(oldText);
  assert.ok(index >= 0);
  assert.equal(source.indexOf(oldText, index + oldText.length), -1);
  return `${source.slice(0, index)}${newText}${source.slice(index + oldText.length)}`;
}

test('K04 independent Server repair receipt replays three sessions and the frozen runtime binding', async () => {
  const result = await verifyK04ServerAiGenerationReceipt();
  assert.equal(result.localAdmitted, true);
  assert.equal(result.successfulTrials, 3);
  assert.equal(result.uniqueGeneratorSessions, 3);
  assert.equal(result.runtimeAdmitted, true);
  assert.deepEqual(result.eligibleCells, ['K124', 'K138']);
  assert.equal(result.results.every((trial) => trial.successful), true);
  if (fs.existsSync('examples/universal-stress/evidence/k04-server-ai-generate/github-replay.json')) assert.equal(result.aiGenerateAdmission, 'PASS');
  else assert.equal(result.aiGenerateAdmission, 'UNVERIFIED');
});

test('all three K04 Server mutations are effective negative controls', async () => {
  const canonical = {
    'candidate.rcl': fs.readFileSync('examples/universal-stress/k02-complete-web-app.rcl', 'utf8'),
    'candidate.web.json': fs.readFileSync('examples/universal-stress/k02-complete-web-app.web.json', 'utf8'),
  };
  for (const [trialId, mutation] of Object.entries(K04_SERVER_AI_GENERATION_MUTATIONS)) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), `rcl-${trialId.toLowerCase()}-negative-`));
    try {
      const sourcePath = path.join(directory, 'candidate.rcl');
      const specPath = path.join(directory, 'candidate.web.json');
      const mutated = { ...canonical, [mutation.file]: replaceExactlyOnce(canonical[mutation.file], mutation.old, mutation.replacement) };
      fs.writeFileSync(sourcePath, mutated['candidate.rcl'], 'utf8');
      fs.writeFileSync(specPath, mutated['candidate.web.json'], 'utf8');
      assert.equal((await verifyK04ServerCandidate({ sourcePath, specPath })).status, 'FAIL', `${trialId} must fail before repair`);
    } finally { fs.rmSync(directory, { recursive: true, force: true }); }
  }
});
