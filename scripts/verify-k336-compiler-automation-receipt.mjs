#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { K336_AI_GENERATION_MUTATIONS } from './run-k336-independent-ai-generation.mjs';
import { verifyK336CompilerAutomationCandidate } from './verify-k336-compiler-automation-candidate.mjs';
import {
  verifyIndependentRclRepairReceipt,
  verifyRclGithubAuthorityBinding,
  verifyRootedRclRuntimeEvidence,
} from './verify-rcl-repair-receipt-harness.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CONFIG = Object.freeze({
  root: ROOT,
  errorPrefix: 'RCL_K336',
  contractPath: path.join(ROOT, 'examples', 'universal-stress', 'k336-compiler-automation-ai-generation-contract.v0.1.json'),
  runtimeContractPath: path.join(ROOT, 'examples', 'universal-stress', 'k336-compiler-automation-runtime-contract.v0.1.json'),
  runtimeEvidencePath: path.join(ROOT, 'examples', 'universal-stress', 'evidence', 'k336-compiler-automation-runtime-v0.1.json'),
  receiptDir: path.join(ROOT, 'examples', 'universal-stress', 'evidence', 'k336-compiler-automation-ai-generate'),
  authorityPath: path.join(ROOT, 'examples', 'universal-stress', 'evidence', 'k336-compiler-automation-ai-generate', 'github-replay.json'),
  authorityFormat: 'rcl.k336.compiler-automation-github-replay-authority.v0.1',
  focusedStepName: 'K336 independent Compiler Automation AI receipt replay',
  windowsStepName: 'K336 Windows native Compiler Automation runtime replay',
  authorityPassStatus: 'PASS_GITHUB_LINUX_WINDOWS_NATIVE_AUTOMATION_REPLAY_BOUND',
  missingVerdict: 'K336_AI_GENERATION_RECEIPT_MISSING',
  localVerdict: 'PASS_LOCAL_RECEIPT_GITHUB_AUTHORITY_REQUIRED',
  admittedVerdict: 'PASS_RECEIPT_REPLAY_GITHUB_LINUX_WINDOWS_NATIVE_AUTOMATION_AUTHORITY_BOUND',
  mutations: K336_AI_GENERATION_MUTATIONS,
  verifyCandidate: verifyK336CompilerAutomationCandidate,
});

export function verifyK336RuntimeEvidence(options = {}) { return verifyRootedRclRuntimeEvidence(CONFIG, options); }
export function verifyK336GithubAuthorityBinding(options = {}) { return verifyRclGithubAuthorityBinding(CONFIG, options); }
export function verifyK336CompilerAutomationReceipt(options = {}) { return verifyIndependentRclRepairReceipt(CONFIG, options); }

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const result = verifyK336CompilerAutomationReceipt();
  console.log(JSON.stringify(result, null, 2));
  if (!result.localAdmitted) process.exitCode = 1;
}
