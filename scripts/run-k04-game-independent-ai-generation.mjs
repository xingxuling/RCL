#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { runIndependentRclRepairCampaign } from './independent-rcl-repair-harness.mjs';
import { K04_GAME_SPEC_PATH, verifyK04GameCandidate } from './verify-k04-game-candidate.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

export const K04_GAME_AI_GENERATION_MUTATIONS = Object.freeze({
  'K04-GAME-REPAIR-01': {
    old: 'alter player.vx <- 4',
    replacement: 'alter player.vx <- 5',
    invariant: 'The right-movement transaction sets the canonical velocity used by the fixed-step runtime.',
  },
  'K04-GAME-REPAIR-02': {
    old: 'when game.status == "ready"',
    replacement: 'when game.status == "paused"',
    invariant: 'The start transaction is admitted only from the canonical ready state.',
  },
  'K04-GAME-REPAIR-03': {
    old: 'alter game.score <- game.score + 1',
    replacement: 'alter game.score <- game.score + 2',
    invariant: 'One collectible collision increments the RCL-owned score exactly once.',
  },
});

export function runIndependentK04GameAiGeneration(options = {}) {
  return runIndependentRclRepairCampaign({
    root: ROOT,
    contractPath: path.join(ROOT, 'examples', 'universal-stress', 'k04-game-ai-generation-contract.v0.1.json'),
    outputDir: path.join(ROOT, 'examples', 'universal-stress', 'evidence', 'k04-game-ai-generate'),
    contractFormat: 'rcl.k04.game-ai-generation-contract.v0.1',
    trialReceiptFormat: 'rcl.k04.game-ai-trial-receipt.v0.1',
    reportFormat: 'rcl.k04.game-ai-generation-receipt.v0.1',
    errorPrefix: 'RCL_K04_GAME',
    campaignLabel: 'K04 game-runtime 2D game',
    semanticOwnershipPrompt: 'Keep RCL as the canonical owner of game state, transition guards, score transactions, authority and preserve semantics. The fixed-step JavaScript runtime is only a lowered execution organ.',
    forbiddenTokens: ['Date.now', 'performance.now', 'provider_call(', 'child_process', 'powershell', 'openai', 'disable test', 'skip verifier', 'skip evidence', 'hard-coded result'],
    mutations: K04_GAME_AI_GENERATION_MUTATIONS,
    verifyCandidate: ({ sourcePath }) => verifyK04GameCandidate({ sourcePath, specPath: K04_GAME_SPEC_PATH }),
    localPassVerdict: 'PASS_INDEPENDENT_GENERATOR_LOCAL_GAME_REPLAY_GITHUB_REQUIRED',
  }, options);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const report = runIndependentK04GameAiGeneration({ outputDir: process.argv[2] ? path.resolve(process.argv[2]) : undefined });
  console.log(JSON.stringify({
    localVerdict: report.localVerdict,
    aiGenerateStatus: report.aiGenerateStatus,
    successfulTrials: report.successfulTrials,
    uniqueGeneratorSessions: report.uniqueGeneratorSessions,
    runtimeEvidenceBinding: report.runtimeEvidenceBinding,
    reportRoot: report.reportRoot,
  }, null, 2));
  if (report.aiGenerateStatus !== 'CANDIDATE') process.exitCode = 1;
}
