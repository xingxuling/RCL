import assert from 'node:assert/strict';
import test from 'node:test';

import { verifyK233AiGenerationReceipt } from '../scripts/verify-k233-ai-generation-receipt.mjs';

test('K233 independent AI repair receipts replay fail-closed through the native path', { timeout: 180_000 }, () => {
  const result = verifyK233AiGenerationReceipt();
  assert.equal(result.verdict, 'PASS_RECEIPT_REPLAY_READY_FOR_GITHUB_AUTHORITY');
  assert.equal(result.aiGenerateAdmission, 'CANDIDATE_GITHUB_AUTHORITY_REQUIRED');
  assert.equal(result.successfulTrials, 3);
  assert.equal(result.uniqueGeneratorSessions, 3);
  assert.equal(new Set(result.results.map((trial) => trial.semanticStateRoot)).size, 1);
  assert.equal(result.results.every((trial) => trial.successful), true);
});
