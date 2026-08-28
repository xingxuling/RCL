#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { K331_AI_GENERATION_MUTATIONS } from './run-k331-independent-ai-generation.mjs';
import { verifyK331CompilerRealtimeCandidate } from './verify-k331-compiler-realtime-candidate.mjs';
import {
  verifyIndependentRclRepairReceipt,
  verifyRclGithubAuthorityBinding,
  verifyRootedRclRuntimeEvidence,
} from './verify-rcl-repair-receipt-harness.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CONFIG = Object.freeze({
  root: ROOT, errorPrefix: 'RCL_K331',
  contractPath: path.join(ROOT, 'examples', 'universal-stress', 'k331-compiler-realtime-ai-generation-contract.v0.1.json'),
  runtimeContractPath: path.join(ROOT, 'examples', 'universal-stress', 'k331-compiler-realtime-runtime-contract.v0.1.json'),
  runtimeEvidencePath: path.join(ROOT, 'examples', 'universal-stress', 'evidence', 'k331-compiler-realtime-runtime-v0.1.json'),
  receiptDir: path.join(ROOT, 'examples', 'universal-stress', 'evidence', 'k331-compiler-realtime-ai-generate'),
  authorityPath: path.join(ROOT, 'examples', 'universal-stress', 'evidence', 'k331-compiler-realtime-ai-generate', 'github-replay.json'),
  authorityFormat: 'rcl.k331.compiler-realtime-github-replay-authority.v0.1',
  focusedStepName: 'K331 independent Compiler Realtime AI receipt replay',
  windowsStepName: 'K331 Windows native Compiler Realtime runtime replay',
  authorityPassStatus: 'PASS_GITHUB_LINUX_WINDOWS_NATIVE_LOGICAL_TIME_REPLAY_BOUND',
  missingVerdict: 'K331_AI_GENERATION_RECEIPT_MISSING',
  localVerdict: 'PASS_LOCAL_RECEIPT_GITHUB_AUTHORITY_REQUIRED',
  admittedVerdict: 'PASS_RECEIPT_REPLAY_GITHUB_LINUX_WINDOWS_NATIVE_LOGICAL_TIME_AUTHORITY_BOUND',
  mutations: K331_AI_GENERATION_MUTATIONS,
  verifyCandidate: verifyK331CompilerRealtimeCandidate,
});

export function verifyK331RuntimeEvidence(options = {}) { return verifyRootedRclRuntimeEvidence(CONFIG, options); }
export function verifyK331GithubAuthorityBinding(options = {}) { return verifyRclGithubAuthorityBinding(CONFIG, options); }
export function verifyK331CompilerRealtimeReceipt(options = {}) { return verifyIndependentRclRepairReceipt(CONFIG, options); }

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const result = verifyK331CompilerRealtimeReceipt();
  console.log(JSON.stringify(result, null, 2));
  if (!result.localAdmitted) process.exitCode = 1;
}
