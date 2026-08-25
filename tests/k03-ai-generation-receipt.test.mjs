import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { K03_AI_GENERATION_MUTATIONS } from '../scripts/run-k03-independent-ai-generation.mjs';
import { verifyK03AiGenerationReceipt } from '../scripts/verify-k03-ai-generation-receipt.mjs';
import { verifyK03AndroidCandidate } from '../scripts/verify-k03-android-candidate.mjs';

function replaceExactlyOnce(source, oldText, newText) {
  const index = source.indexOf(oldText);
  assert.ok(index >= 0);
  assert.equal(source.indexOf(oldText, index + oldText.length), -1);
  return `${source.slice(0, index)}${newText}${source.slice(index + oldText.length)}`;
}

test('K03 independent Android repair receipt replays three sessions and the real emulator binding', () => {
  const result = verifyK03AiGenerationReceipt();
  assert.equal(result.localAdmitted, true);
  assert.equal(result.successfulTrials, 3);
  assert.equal(result.uniqueGeneratorSessions, 3);
  assert.equal(result.emulatorAdmitted, true);
  assert.deepEqual(result.eligibleCells, ['K083', 'K085', 'K098']);
  assert.equal(result.results.every((trial) => trial.successful), true);
  if (fs.existsSync('examples/universal-stress/evidence/k03-ai-generate/github-replay.json')) assert.equal(result.aiGenerateAdmission, 'PASS');
  else assert.equal(result.aiGenerateAdmission, 'UNVERIFIED');
});

test('all three K03 Android mutations are effective negative controls', () => {
  const canonical = {
    'candidate.rcl': fs.readFileSync('examples/universal-stress/k03-native-android-app.rcl', 'utf8'),
    'candidate.android.json': fs.readFileSync('examples/universal-stress/k03-native-android-app.android.json', 'utf8'),
  };
  for (const [trialId, mutation] of Object.entries(K03_AI_GENERATION_MUTATIONS)) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), `rcl-${trialId.toLowerCase()}-negative-`));
    try {
      const sourcePath = path.join(directory, 'candidate.rcl');
      const specPath = path.join(directory, 'candidate.android.json');
      const mutated = { ...canonical, [mutation.file]: replaceExactlyOnce(canonical[mutation.file], mutation.old, mutation.replacement) };
      fs.writeFileSync(sourcePath, mutated['candidate.rcl'], 'utf8');
      fs.writeFileSync(specPath, mutated['candidate.android.json'], 'utf8');
      assert.equal(verifyK03AndroidCandidate({ sourcePath, specPath }).status, 'FAIL', `${trialId} must fail before repair`);
    } finally { fs.rmSync(directory, { recursive: true, force: true }); }
  }
});
