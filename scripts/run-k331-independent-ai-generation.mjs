#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { runIndependentRclRepairCampaign } from './independent-rcl-repair-harness.mjs';
import { verifyK331CompilerRealtimeCandidate } from './verify-k331-compiler-realtime-candidate.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const K331_AI_GENERATION_MUTATIONS = Object.freeze({
  'K331-AI-REPAIR-01': {
    old: 'event_priority(left) < event_priority(right)', replacement: 'event_priority(left) > event_priority(right)',
    invariant: 'Equal-instant events are ordered by lower numeric priority before stable event identity.',
  },
  'K331-AI-REPAIR-02': {
    old: ') > max_events,', replacement: ') < max_events,',
    invariant: 'An advance exceeding its declared event budget is rejected without moving logical time or committing events.',
  },
  'K331-AI-REPAIR-03': {
    old: 'temporal_commit_capability != 1', replacement: 'temporal_commit_capability != 0',
    invariant: 'Capability value 0 must be rejected and only the exact temporal commit capability value 1 may admit an external time proposal.',
  },
});

export function runIndependentK331AiGeneration(options = {}) {
  return runIndependentRclRepairCampaign({
    root: ROOT,
    contractPath: path.join(ROOT, 'examples', 'universal-stress', 'k331-compiler-realtime-ai-generation-contract.v0.1.json'),
    outputDir: path.join(ROOT, 'examples', 'universal-stress', 'evidence', 'k331-compiler-realtime-ai-generate'),
    contractFormat: 'rcl.k331.compiler-realtime-ai-generation-contract.v0.1',
    trialReceiptFormat: 'rcl.k331.compiler-realtime-ai-trial-receipt.v0.1',
    reportFormat: 'rcl.k331.compiler-realtime-ai-generation-receipt.v0.1',
    errorPrefix: 'RCL_K331', campaignLabel: 'K331 compiler-runtime realtime',
    semanticOwnershipPrompt: 'Keep event ordering, monotonic logical time, budget atomicity and external-time authority semantics in RCL. Do not introduce wall-clock or provider authority.',
    forbiddenTokens: ['Date.now', 'performance.now', 'provider_call(', 'child_process', 'powershell', 'openai', 'disable test', 'skip verifier', 'skip evidence'],
    mutations: K331_AI_GENERATION_MUTATIONS,
    verifyCandidate: verifyK331CompilerRealtimeCandidate,
    localPassVerdict: 'PASS_INDEPENDENT_GENERATOR_LOCAL_NATIVE_LOGICAL_TIME_REPLAY_GITHUB_REQUIRED',
  }, options);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const report = runIndependentK331AiGeneration();
  console.log(JSON.stringify({
    localVerdict: report.localVerdict, aiGenerateStatus: report.aiGenerateStatus,
    successfulTrials: report.successfulTrials, uniqueGeneratorSessions: report.uniqueGeneratorSessions,
    runtimeEvidenceBinding: report.runtimeEvidenceBinding, reportRoot: report.reportRoot,
  }, null, 2));
  if (report.aiGenerateStatus !== 'CANDIDATE') process.exitCode = 1;
}
