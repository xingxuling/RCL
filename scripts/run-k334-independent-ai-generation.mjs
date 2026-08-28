#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { runIndependentRclRepairCampaign } from './independent-rcl-repair-harness.mjs';
import { verifyK334CompilerAgentCandidate } from './verify-k334-compiler-agent-candidate.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const K334_AI_GENERATION_MUTATIONS = Object.freeze({
  'K334-AI-REPAIR-01': {
    old: 'action_capability(action) != granted_capability', replacement: 'action_capability(action) == granted_capability',
    invariant: 'An action is eligible only when its required capability exactly matches the granted capability.',
  },
  'K334-AI-REPAIR-02': {
    old: 'action_cost(action) > budget', replacement: 'action_cost(action) < budget',
    invariant: 'An action whose cost exceeds the bounded budget must be rejected before commit.',
  },
  'K334-AI-REPAIR-03': {
    old: 'action_requires_approval(action) == 1 and human_approval == 0',
    replacement: 'action_requires_approval(action) == 1 and human_approval == 1',
    invariant: 'An action requiring human approval must not commit when approval is absent.',
  },
});

export function runIndependentK334AiGeneration(options = {}) {
  return runIndependentRclRepairCampaign({
    root: ROOT,
    contractPath: path.join(ROOT, 'examples', 'universal-stress', 'k334-compiler-agent-ai-generation-contract.v0.1.json'),
    outputDir: path.join(ROOT, 'examples', 'universal-stress', 'evidence', 'k334-compiler-agent-ai-generate'),
    contractFormat: 'rcl.k334.compiler-agent-ai-generation-contract.v0.1',
    trialReceiptFormat: 'rcl.k334.compiler-agent-ai-trial-receipt.v0.1',
    reportFormat: 'rcl.k334.compiler-agent-ai-generation-receipt.v0.1',
    errorPrefix: 'RCL_K334', campaignLabel: 'K334 compiler-runtime agent',
    semanticOwnershipPrompt: 'Keep observation/action selection, capability, budget, risk, approval, kill-switch, bounded memory and commit semantics in RCL.',
    forbiddenTokens: ['provider_call(', 'child_process', 'powershell', 'kubectl', 'terraform', 'ollama', 'openai', 'disable test', 'skip verifier', 'skip evidence'],
    mutations: K334_AI_GENERATION_MUTATIONS,
    verifyCandidate: verifyK334CompilerAgentCandidate,
    localPassVerdict: 'PASS_INDEPENDENT_GENERATOR_LOCAL_NATIVE_AGENT_REPLAY_GITHUB_REQUIRED',
  }, options);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const report = runIndependentK334AiGeneration();
  console.log(JSON.stringify({
    localVerdict: report.localVerdict, aiGenerateStatus: report.aiGenerateStatus,
    successfulTrials: report.successfulTrials, uniqueGeneratorSessions: report.uniqueGeneratorSessions,
    runtimeEvidenceBinding: report.runtimeEvidenceBinding, reportRoot: report.reportRoot,
  }, null, 2));
  if (report.aiGenerateStatus !== 'CANDIDATE') process.exitCode = 1;
}
