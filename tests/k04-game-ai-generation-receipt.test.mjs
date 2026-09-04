import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { evidenceRoot } from '../src/universal-program-stress.mjs';
import { replaceRclRepairTextOnce } from '../scripts/independent-rcl-repair-harness.mjs';
import { K04_GAME_AI_GENERATION_MUTATIONS } from '../scripts/run-k04-game-independent-ai-generation.mjs';
import { verifyK04GameAiGenerationReceipt } from '../scripts/verify-k04-game-ai-generation-receipt.mjs';
import { K04_GAME_SOURCE_PATH, K04_GAME_SPEC_PATH, verifyK04GameCandidate } from '../scripts/verify-k04-game-candidate.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const RUNTIME_PATH = path.join(ROOT, 'examples', 'universal-stress', 'evidence', 'k04-game-runtime-v0.1.json');

test('K04 game candidate verifier is stable and closes all non-AI gates', () => {
  const first = verifyK04GameCandidate({ sourcePath: K04_GAME_SOURCE_PATH, specPath: K04_GAME_SPEC_PATH });
  const second = verifyK04GameCandidate({ sourcePath: K04_GAME_SOURCE_PATH, specPath: K04_GAME_SPEC_PATH });
  assert.equal(first.status, 'PASS');
  assert.equal(first.reportRoot, second.reportRoot);
  assert.equal(first.manifestRoot, '6e3ffc44619138635e49d438395b71854d87eaaa27318b03c657c74c112c5f48');
  assert.ok(Object.values(first.checks).every((item) => item.pass));
});

test('K04 mutations are effective before independent repair', () => {
  const canonical = fs.readFileSync(K04_GAME_SOURCE_PATH, 'utf8');
  for (const mutation of Object.values(K04_GAME_AI_GENERATION_MUTATIONS)) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-k04-game-test-'));
    try {
      const candidatePath = path.join(directory, 'candidate.rcl');
      fs.writeFileSync(candidatePath, replaceRclRepairTextOnce(canonical, mutation.old, mutation.replacement, 'TEST_MUTATION_SITE'), 'utf8');
      const result = verifyK04GameCandidate({ sourcePath: candidatePath, specPath: K04_GAME_SPEC_PATH });
      assert.equal(result.status, 'FAIL');
      assert.ok(Object.values(result.checks).some((item) => !item.pass));
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  }
});

test('K04 independent receipt binds runtime evidence and reports hosted replay state', () => {
  const result = verifyK04GameAiGenerationReceipt();
  assert.equal(result.localReceiptPresent, true);
  assert.equal(result.localAdmitted, true);
  const authorityPath = path.join(ROOT, 'examples', 'universal-stress', 'evidence', 'k04-game-ai-generate', 'github-replay.json');
  assert.equal(result.aiGenerateAdmission, fs.existsSync(authorityPath) ? 'PASS' : 'UNVERIFIED');
  assert.equal(result.runtimeEvidenceBinding.reportRoot, JSON.parse(fs.readFileSync(RUNTIME_PATH, 'utf8')).reportRoot);
});

test('K04 runtime evidence root is stable', () => {
  const runtime = JSON.parse(fs.readFileSync(RUNTIME_PATH, 'utf8'));
  assert.equal(runtime.status, 'PASS');
  assert.equal(runtime.reportRoot, evidenceRoot({ ...runtime, reportRoot: undefined }));
});
