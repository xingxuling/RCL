#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { K334_AI_GENERATION_MUTATIONS } from './run-k334-independent-ai-generation.mjs';
import { verifyK334CompilerAgentCandidate } from './verify-k334-compiler-agent-candidate.mjs';
import {
  verifyIndependentRclRepairReceipt,
  verifyRclGithubAuthorityBinding,
  verifyRootedRclRuntimeEvidence,
} from './verify-rcl-repair-receipt-harness.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CONFIG = Object.freeze({
  root: ROOT, errorPrefix: 'RCL_K334',
  contractPath: path.join(ROOT, 'examples', 'universal-stress', 'k334-compiler-agent-ai-generation-contract.v0.1.json'),
  runtimeContractPath: path.join(ROOT, 'examples', 'universal-stress', 'k334-compiler-agent-runtime-contract.v0.1.json'),
  runtimeEvidencePath: path.join(ROOT, 'examples', 'universal-stress', 'evidence', 'k334-compiler-agent-runtime-v0.1.json'),
  receiptDir: path.join(ROOT, 'examples', 'universal-stress', 'evidence', 'k334-compiler-agent-ai-generate'),
  authorityPath: path.join(ROOT, 'examples', 'universal-stress', 'evidence', 'k334-compiler-agent-ai-generate', 'github-replay.json'),
  authorityFormat: 'rcl.k334.compiler-agent-github-replay-authority.v0.1',
  focusedStepName: 'K334 independent Compiler Agent AI receipt replay',
  windowsStepName: 'K334 Windows native Compiler Agent runtime replay',
  authorityPassStatus: 'PASS_GITHUB_LINUX_WINDOWS_NATIVE_AGENT_REPLAY_BOUND',
  missingVerdict: 'K334_AI_GENERATION_RECEIPT_MISSING',
  localVerdict: 'PASS_LOCAL_RECEIPT_GITHUB_AUTHORITY_REQUIRED',
  admittedVerdict: 'PASS_RECEIPT_REPLAY_GITHUB_LINUX_WINDOWS_NATIVE_AGENT_AUTHORITY_BOUND',
  mutations: K334_AI_GENERATION_MUTATIONS,
  verifyCandidate: verifyK334CompilerAgentCandidate,
});

export function verifyK334RuntimeEvidence(options = {}) { return verifyRootedRclRuntimeEvidence(CONFIG, options); }
export function verifyK334GithubAuthorityBinding(options = {}) { return verifyRclGithubAuthorityBinding(CONFIG, options); }
export function verifyK334CompilerAgentReceipt(options = {}) { return verifyIndependentRclRepairReceipt(CONFIG, options); }

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const result = verifyK334CompilerAgentReceipt();
  console.log(JSON.stringify(result, null, 2));
  if (!result.localAdmitted) process.exitCode = 1;
}
