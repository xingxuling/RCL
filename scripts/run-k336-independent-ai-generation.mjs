#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { runIndependentRclRepairCampaign } from './independent-rcl-repair-harness.mjs';
import { verifyK336CompilerAutomationCandidate } from './verify-k336-compiler-automation-candidate.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const K336_AI_GENERATION_MUTATIONS = Object.freeze({
  'K336-AI-REPAIR-01': {
    old: 'task_dependency(task) >= completed', replacement: 'task_dependency(task) > completed',
    invariant: 'A task is blocked unless its zero-based dependency index is strictly below the completed-task count.',
  },
  'K336-AI-REPAIR-02': {
    old: 'task_failures_before_success(sequence_get(tasks, cursor)) < task_max_attempts(sequence_get(tasks, cursor))',
    replacement: 'task_failures_before_success(sequence_get(tasks, cursor)) <= task_max_attempts(sequence_get(tasks, cursor))',
    invariant: 'A task succeeds only when failures-before-success is strictly less than the maximum attempt count.',
  },
  'K336-AI-REPAIR-03': {
    old: 'task_requires_approval(sequence_get(tasks, cursor)) == 1 and human_approval == 0',
    replacement: 'task_requires_approval(sequence_get(tasks, cursor)) == 1 and human_approval == 1',
    invariant: 'A task that requires approval must stop and compensate when human approval is absent.',
  },
});

export function runIndependentK336AiGeneration(options = {}) {
  return runIndependentRclRepairCampaign({
    root: ROOT,
    contractPath: path.join(ROOT, 'examples', 'universal-stress', 'k336-compiler-automation-ai-generation-contract.v0.1.json'),
    outputDir: path.join(ROOT, 'examples', 'universal-stress', 'evidence', 'k336-compiler-automation-ai-generate'),
    contractFormat: 'rcl.k336.compiler-automation-ai-generation-contract.v0.1',
    trialReceiptFormat: 'rcl.k336.compiler-automation-ai-trial-receipt.v0.1',
    reportFormat: 'rcl.k336.compiler-automation-ai-generation-receipt.v0.1',
    errorPrefix: 'RCL_K336',
    campaignLabel: 'K336 compiler-runtime automation',
    semanticOwnershipPrompt: 'Keep dependency, retry, approval, kill-switch, audit, commit and compensating rollback semantics in RCL.',
    forbiddenTokens: ['provider_call(', 'child_process', 'powershell', 'kubectl', 'terraform', 'disable test', 'skip verifier', 'skip evidence'],
    mutations: K336_AI_GENERATION_MUTATIONS,
    verifyCandidate: verifyK336CompilerAutomationCandidate,
    localPassVerdict: 'PASS_INDEPENDENT_GENERATOR_LOCAL_NATIVE_AUTOMATION_REPLAY_GITHUB_REQUIRED',
  }, options);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const report = runIndependentK336AiGeneration();
  console.log(JSON.stringify({
    localVerdict: report.localVerdict, aiGenerateStatus: report.aiGenerateStatus,
    successfulTrials: report.successfulTrials, uniqueGeneratorSessions: report.uniqueGeneratorSessions,
    runtimeEvidenceBinding: report.runtimeEvidenceBinding, reportRoot: report.reportRoot,
  }, null, 2));
  if (report.aiGenerateStatus !== 'CANDIDATE') process.exitCode = 1;
}
