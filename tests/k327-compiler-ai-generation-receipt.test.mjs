import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { K327_COMPILER_AI_GENERATION_MUTATIONS } from '../scripts/run-k327-independent-compiler-ai-generation.mjs';
import { verifyK327CompilerAiGenerationReceipt } from '../scripts/verify-k327-compiler-ai-generation-receipt.mjs';
import { verifyK327CompilerCandidate } from '../scripts/verify-k327-compiler-candidate.mjs';

function replaceExactlyOnce(source, oldText, newText) {
  const index = source.indexOf(oldText);
  assert.ok(index >= 0);
  assert.equal(source.indexOf(oldText, index + oldText.length), -1);
  return `${source.slice(0, index)}${newText}${source.slice(index + oldText.length)}`;
}

test('K327 compiler receipt replays three new sessions and binds admitted compiler runtime evidence', () => {
  const result = verifyK327CompilerAiGenerationReceipt();
  assert.equal(result.localAdmitted, true);
  assert.equal(result.successfulTrials, 3);
  assert.equal(result.uniqueGeneratorSessions, 3);
  assert.equal(result.compilerRuntimeAdmitted, true);
  assert.deepEqual(result.eligibleCells, ['K327']);
  assert.equal(result.results.every((trial) => trial.successful), true);
  if (fs.existsSync('examples/universal-stress/evidence/k327-compiler-ai-generate/github-replay.json')) assert.equal(result.aiGenerateAdmission, 'PASS');
  else assert.equal(result.aiGenerateAdmission, 'UNVERIFIED');
});

test('all three K327 compiler mutations are effective negative controls', () => {
  const canonical = {
    'candidate-core.rcl': fs.readFileSync('selfhost/compiler-core.rcl', 'utf8'),
    'candidate-main.rcl': fs.readFileSync('selfhost/compiler-main.rcl', 'utf8'),
  };
  for (const [trialId, mutation] of Object.entries(K327_COMPILER_AI_GENERATION_MUTATIONS)) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), `rcl-${trialId.toLowerCase()}-negative-`));
    try {
      const corePath = path.join(directory, 'candidate-core.rcl');
      const mainPath = path.join(directory, 'candidate-main.rcl');
      const mutated = { ...canonical, [mutation.file]: replaceExactlyOnce(canonical[mutation.file], mutation.old, mutation.replacement) };
      fs.writeFileSync(corePath, mutated['candidate-core.rcl'], 'utf8');
      fs.writeFileSync(mainPath, mutated['candidate-main.rcl'], 'utf8');
      assert.equal(verifyK327CompilerCandidate({ corePath, mainPath }).status, 'FAIL', `${trialId} must fail before repair`);
    } finally { fs.rmSync(directory, { recursive: true, force: true }); }
  }
});
