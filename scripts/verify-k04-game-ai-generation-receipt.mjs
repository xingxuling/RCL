#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { evidenceRoot } from '../src/universal-program-stress.mjs';
import { replaceRclRepairTextOnce } from './independent-rcl-repair-harness.mjs';
import { K04_GAME_AI_GENERATION_MUTATIONS } from './run-k04-game-independent-ai-generation.mjs';
import { K04_GAME_SPEC_PATH, verifyK04GameCandidate } from './verify-k04-game-candidate.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DEFAULT_CONTRACT_PATH = path.join(ROOT, 'examples', 'universal-stress', 'k04-game-ai-generation-contract.v0.1.json');
const DEFAULT_RECEIPT_DIR = path.join(ROOT, 'examples', 'universal-stress', 'evidence', 'k04-game-ai-generate');
const DEFAULT_RUNTIME_PATH = path.join(ROOT, 'examples', 'universal-stress', 'evidence', 'k04-game-runtime-v0.1.json');
const DEFAULT_AUTHORITY_PATH = path.join(DEFAULT_RECEIPT_DIR, 'github-replay.json');

function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function readJson(filePath) { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }

function verifyRuntimeEvidence(contract, runtimePath) {
  const runtime = readJson(runtimePath);
  if (runtime.status !== 'PASS'
    || runtime.reportRoot !== evidenceRoot({ ...runtime, reportRoot: undefined })
    || runtime.reportRoot !== contract.runtimeEvidence.reportRoot
    || runtime.sourceSha256 !== contract.canonical.sourceSha256
    || Object.values(runtime.checks ?? {}).some((item) => item.pass !== true)) {
    throw new Error('RCL_K04_GAME_RUNTIME_EVIDENCE_INVALID');
  }
  return { admitted: true, reportRoot: runtime.reportRoot };
}

export function verifyK04GameGithubAuthorityBinding(options = {}) {
  const authorityPath = path.resolve(options.authorityPath ?? DEFAULT_AUTHORITY_PATH);
  if (!fs.existsSync(authorityPath)) return { admitted: false, status: 'GITHUB_AUTHORITY_RECEIPT_MISSING', authorityPath };
  const contractPath = path.resolve(options.contractPath ?? DEFAULT_CONTRACT_PATH);
  const receiptDir = path.resolve(options.receiptDir ?? DEFAULT_RECEIPT_DIR);
  const authority = readJson(authorityPath);
  const contract = readJson(contractPath);
  const local = readJson(path.join(receiptDir, 'receipt.json'));
  if (authority.authorityRoot !== evidenceRoot({ ...authority, authorityRoot: undefined })) throw new Error('RCL_K04_GAME_GITHUB_AUTHORITY_ROOT_MISMATCH');
  if (authority.format !== 'rcl.k04.game-github-replay-authority.v0.1'
    || authority.authority !== 'GITHUB_HOSTED_ACTIONS'
    || authority.workflow?.name !== 'RCL Universal Program Stress v0.1'
    || authority.workflow?.event !== 'push'
    || authority.job?.name !== 'focused-verification'
    || authority.job?.conclusion !== 'success'
    || authority.step?.name !== 'K04 independent 2D Game AI generation receipt replay'
    || authority.step?.conclusion !== 'success') throw new Error('RCL_K04_GAME_GITHUB_AUTHORITY_INVALID');
  if (!/^[0-9a-f]{40}$/u.test(authority.sourceCommit)
    || authority.run?.headSha !== authority.sourceCommit
    || !Number.isSafeInteger(authority.run?.id)
    || !Number.isSafeInteger(authority.job?.id)) throw new Error('RCL_K04_GAME_GITHUB_AUTHORITY_IDENTITY_INVALID');
  if (authority.contractRoot !== evidenceRoot(contract)
    || authority.localReceiptReportRoot !== local.reportRoot
    || authority.runtimeReportRoot !== local.runtimeEvidenceBinding?.reportRoot) throw new Error('RCL_K04_GAME_GITHUB_AUTHORITY_EVIDENCE_MISMATCH');
  return {
    admitted: true,
    status: 'PASS_GITHUB_HOSTED_GAME_REPLAY_BOUND',
    verifiedAt: authority.verifiedAt,
    sourceCommit: authority.sourceCommit,
    runId: authority.run.id,
    runUrl: authority.run.url,
    jobId: authority.job.id,
    authorityRoot: authority.authorityRoot,
    authorityPath,
  };
}

export function verifyK04GameAiGenerationReceipt(options = {}) {
  const contractPath = path.resolve(options.contractPath ?? DEFAULT_CONTRACT_PATH);
  const receiptDir = path.resolve(options.receiptDir ?? DEFAULT_RECEIPT_DIR);
  const runtimePath = path.resolve(options.runtimeEvidencePath ?? DEFAULT_RUNTIME_PATH);
  const receiptPath = path.join(receiptDir, 'receipt.json');
  if (!fs.existsSync(receiptPath)) {
    return {
      localReceiptPresent: false,
      localAdmitted: false,
      aiGenerateAdmission: 'UNVERIFIED',
      verdict: 'K04_GAME_AI_GENERATION_RECEIPT_MISSING',
      githubAuthority: verifyK04GameGithubAuthorityBinding({ ...options, contractPath, receiptDir }),
    };
  }
  const contract = readJson(contractPath);
  const report = readJson(receiptPath);
  const canonicalPath = path.join(ROOT, contract.canonical.sourcePath);
  const canonical = fs.readFileSync(canonicalPath, 'utf8');
  const specPath = path.join(ROOT, contract.canonical.specPath);
  if (sha256(canonical) !== contract.canonical.sourceSha256
    || sha256(fs.readFileSync(specPath, 'utf8')) !== contract.canonical.specSha256) throw new Error('RCL_K04_GAME_CANONICAL_INPUT_DRIFT');
  const canonicalVerification = verifyK04GameCandidate({ sourcePath: canonicalPath, specPath: K04_GAME_SPEC_PATH });
  if (canonicalVerification.status !== 'PASS' || canonicalVerification.reportRoot !== contract.canonical.candidateReportRoot) throw new Error('RCL_K04_GAME_CANONICAL_VERIFICATION_MISMATCH');
  if (report.contractRoot !== evidenceRoot(contract)) throw new Error('RCL_K04_GAME_CONTRACT_ROOT_MISMATCH');
  if (report.reportRoot !== evidenceRoot({ ...report, generatedAt: undefined, reportRoot: undefined })) throw new Error('RCL_K04_GAME_REPORT_ROOT_MISMATCH');
  if (report.requiredTrials !== contract.requiredTrials || report.trials?.length !== contract.requiredTrials) throw new Error('RCL_K04_GAME_TRIAL_COUNT_MISMATCH');
  const runtime = verifyRuntimeEvidence(contract, runtimePath);
  if (report.runtimeEvidenceBinding?.reportRoot !== runtime.reportRoot) throw new Error('RCL_K04_GAME_RUNTIME_BINDING_MISMATCH');

  const results = [];
  for (const trialContract of contract.trials) {
    const receipt = report.trials.find((trial) => trial.trialId === trialContract.id);
    if (!receipt) throw new Error(`RCL_K04_GAME_TRIAL_MISSING:${trialContract.id}`);
    if (receipt.receiptRoot !== evidenceRoot({ ...receipt, receiptRoot: undefined })) throw new Error(`RCL_K04_GAME_TRIAL_ROOT_MISMATCH:${trialContract.id}`);
    const mutation = K04_GAME_AI_GENERATION_MUTATIONS[trialContract.id];
    const mutated = replaceRclRepairTextOnce(canonical, mutation.old, mutation.replacement, `RCL_K04_GAME_MUTATION_SITE_INVALID:${trialContract.id}`);
    if (receipt.mutatedSourceSha256 !== sha256(mutated)) throw new Error(`RCL_K04_GAME_MUTATED_HASH_MISMATCH:${trialContract.id}`);
    const candidate = replaceRclRepairTextOnce(mutated, receipt.proposal.old, receipt.proposal.new, `RCL_K04_GAME_SAVED_EDIT_NOT_EXACT:${trialContract.id}`);
    const independence = receipt.independence ?? {};
    if (independence.oracleEditVisibleToGenerator !== false
      || independence.canonicalFilesVisibleToGenerator !== false
      || independence.developmentAgentAuthoredEdit !== false
      || independence.generatorReceivedMutatedCandidatesOnly !== true
      || independence.evaluatorAppliedExactSchemaEdit !== true
      || receipt.generator?.ephemeral !== true
      || receipt.generator?.sandbox !== 'read-only'
      || receipt.generator?.authoritativeRepositoryWritable !== false
      || typeof receipt.generator?.threadId !== 'string'
      || receipt.generator.threadId.length === 0) throw new Error(`RCL_K04_GAME_INDEPENDENCE_INVALID:${trialContract.id}`);
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), `rcl-${trialContract.id.toLowerCase()}-replay-`));
    let verification;
    try {
      const candidatePath = path.join(directory, 'candidate.rcl');
      fs.writeFileSync(candidatePath, candidate, 'utf8');
      verification = verifyK04GameCandidate({ sourcePath: candidatePath, specPath });
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
    const successful = candidate === canonical
      && verification.status === 'PASS'
      && receipt.restoredCanonicalBytes === true
      && receipt.verification?.successful === true
      && receipt.verification?.status === 'PASS'
      && receipt.verification?.reportRoot === verification.reportRoot;
    results.push({ trialId: trialContract.id, successful, threadId: receipt.generator.threadId, reportRoot: verification.reportRoot });
  }
  const successfulTrials = results.filter((result) => result.successful).length;
  const uniqueGeneratorSessions = new Set(results.map((result) => result.threadId)).size;
  const localAdmitted = successfulTrials === contract.admission.requiredSuccessfulTrials
    && uniqueGeneratorSessions === contract.admission.requiredUniqueGeneratorSessions
    && report.successfulTrials === successfulTrials
    && report.uniqueGeneratorSessions === uniqueGeneratorSessions;
  const githubAuthority = verifyK04GameGithubAuthorityBinding({ ...options, contractPath, receiptDir });
  const admitted = localAdmitted && githubAuthority.admitted;
  return {
    localReceiptPresent: true,
    localAdmitted,
    successfulTrials,
    requiredTrials: contract.requiredTrials,
    uniqueGeneratorSessions,
    runtimeEvidenceBinding: report.runtimeEvidenceBinding,
    eligibleCells: contract.eligibleCells,
    results,
    githubAuthority,
    aiGenerateAdmission: admitted ? 'PASS' : 'UNVERIFIED',
    verdict: admitted ? 'PASS_RECEIPT_REPLAY_GITHUB_AUTHORITY_BOUND' : 'PASS_LOCAL_RECEIPT_GITHUB_AUTHORITY_REQUIRED',
  };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const result = verifyK04GameAiGenerationReceipt();
  console.log(JSON.stringify(result, null, 2));
  if (result.aiGenerateAdmission !== 'PASS') process.exitCode = 1;
}
