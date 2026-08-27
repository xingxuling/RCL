#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { evidenceRoot } from '../src/universal-program-stress.mjs';
import { K326_AI_GENERATION_MUTATIONS } from './run-k326-independent-ai-generation.mjs';
import { verifyK326CompilerDatabaseCandidate } from './verify-k326-compiler-database-candidate.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DEFAULT_CONTRACT_PATH = path.join(ROOT, 'examples', 'universal-stress', 'k326-compiler-database-ai-generation-contract.v0.1.json');
const DEFAULT_RUNTIME_CONTRACT_PATH = path.join(ROOT, 'examples', 'universal-stress', 'k326-compiler-database-runtime-contract.v0.1.json');
const DEFAULT_RUNTIME_EVIDENCE_PATH = path.join(ROOT, 'examples', 'universal-stress', 'evidence', 'k326-compiler-database-runtime-v0.1.json');
const DEFAULT_RECEIPT_DIR = path.join(ROOT, 'examples', 'universal-stress', 'evidence', 'k326-compiler-database-ai-generate');
const DEFAULT_AUTHORITY_PATH = path.join(DEFAULT_RECEIPT_DIR, 'github-replay.json');

function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function readJson(filePath) { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
function replaceExactlyOnce(source, oldText, newText, code) {
  const index = source.indexOf(oldText);
  if (index < 0 || source.indexOf(oldText, index + oldText.length) >= 0) throw new Error(code);
  return `${source.slice(0, index)}${newText}${source.slice(index + oldText.length)}`;
}

export function verifyK326RuntimeEvidence(options = {}) {
  const contract = readJson(path.resolve(options.runtimeContractPath ?? DEFAULT_RUNTIME_CONTRACT_PATH));
  const evidence = readJson(path.resolve(options.runtimeEvidencePath ?? DEFAULT_RUNTIME_EVIDENCE_PATH));
  if (evidence.reportRoot !== evidenceRoot({ ...evidence, generatedAt: undefined, reportRoot: undefined })) throw new Error('RCL_K326_RUNTIME_REPORT_ROOT_MISMATCH');
  if (evidence.contractRoot !== evidenceRoot(contract)) throw new Error('RCL_K326_RUNTIME_CONTRACT_ROOT_MISMATCH');
  const rounds = evidence.rounds ?? [];
  if (evidence.status !== 'PASS'
    || evidence.summary?.successfulRounds !== contract.required.rounds
    || rounds.length !== contract.required.rounds
    || evidence.summary?.uniqueStateRoots !== contract.required.uniqueStateRoots
    || evidence.summary?.uniqueArtifactHashes !== contract.required.uniqueArtifactHashes
    || evidence.summary?.controlsPassed !== true
    || evidence.summary?.performancePassed !== true
    || Object.values(evidence.negativeControls ?? {}).length !== 5
    || !Object.values(evidence.negativeControls ?? {}).every(Boolean)
    || !rounds.every((round) => round.stateRoot === contract.canonical.semanticStateRoot)
    || !rounds.every((round) => round.artifactSha256 === contract.canonical.bootstrapArtifactSha256)
    || evidence.performance?.compileP95Ms > contract.performanceBudget.compileP95MsMax
    || evidence.performance?.executeP95Ms > contract.performanceBudget.executeP95MsMax
    || evidence.performance?.combinedP95Ms > contract.performanceBudget.combinedP95MsMax) throw new Error('RCL_K326_RUNTIME_EVIDENCE_INVALID');
  return { admitted: true, reportRoot: evidence.reportRoot, contractRoot: evidence.contractRoot, rounds: evidence.summary.successfulRounds };
}

export function verifyK326GithubAuthorityBinding(options = {}) {
  const authorityPath = path.resolve(options.authorityPath ?? DEFAULT_AUTHORITY_PATH);
  if (!fs.existsSync(authorityPath)) return { admitted: false, status: 'GITHUB_AUTHORITY_RECEIPT_MISSING', authorityPath };
  const contractPath = path.resolve(options.contractPath ?? DEFAULT_CONTRACT_PATH);
  const receiptDir = path.resolve(options.receiptDir ?? DEFAULT_RECEIPT_DIR);
  const authority = readJson(authorityPath);
  const contract = readJson(contractPath);
  const localReport = readJson(path.join(receiptDir, 'receipt.json'));
  if (authority.authorityRoot !== evidenceRoot({ ...authority, authorityRoot: undefined })) throw new Error('RCL_K326_GITHUB_AUTHORITY_ROOT_MISMATCH');
  const jobs = authority.jobs ?? {};
  if (authority.format !== 'rcl.k326.compiler-database-github-replay-authority.v0.1'
    || authority.authority !== 'GITHUB_HOSTED_ACTIONS'
    || authority.workflow?.name !== 'RCL Universal Program Stress v0.1'
    || authority.workflow?.event !== 'push'
    || jobs.focused?.name !== 'focused-verification'
    || jobs.focused?.conclusion !== 'success'
    || jobs.focused?.step?.name !== 'K326 independent Compiler Database AI receipt replay'
    || jobs.focused?.step?.conclusion !== 'success'
    || jobs.windows?.name !== 'k01-windows-verification'
    || jobs.windows?.conclusion !== 'success'
    || jobs.windows?.step?.name !== 'K326 Windows native Compiler Database runtime replay'
    || jobs.windows?.step?.conclusion !== 'success') throw new Error('RCL_K326_GITHUB_AUTHORITY_INVALID');
  if (!/^[0-9a-f]{40}$/u.test(authority.sourceCommit)
    || authority.run?.headSha !== authority.sourceCommit
    || !Number.isSafeInteger(authority.run?.id)
    || !Number.isSafeInteger(jobs.focused?.id)
    || !Number.isSafeInteger(jobs.windows?.id)) throw new Error('RCL_K326_GITHUB_AUTHORITY_IDENTITY_INVALID');
  if (authority.contractRoot !== evidenceRoot(contract)
    || authority.localReceiptReportRoot !== localReport.reportRoot
    || authority.runtimeEvidenceBindingRoot !== evidenceRoot(localReport.runtimeEvidenceBinding)) throw new Error('RCL_K326_GITHUB_AUTHORITY_EVIDENCE_MISMATCH');
  return {
    admitted: true,
    status: 'PASS_GITHUB_LINUX_WINDOWS_NATIVE_DATABASE_REPLAY_BOUND',
    verifiedAt: authority.verifiedAt,
    sourceCommit: authority.sourceCommit,
    runId: authority.run.id,
    runUrl: authority.run.url,
    focusedJobId: jobs.focused.id,
    windowsJobId: jobs.windows.id,
    authorityRoot: authority.authorityRoot,
    authorityPath,
  };
}

export function verifyK326CompilerDatabaseReceipt(options = {}) {
  const contractPath = path.resolve(options.contractPath ?? DEFAULT_CONTRACT_PATH);
  const receiptDir = path.resolve(options.receiptDir ?? DEFAULT_RECEIPT_DIR);
  const receiptPath = path.join(receiptDir, 'receipt.json');
  if (!fs.existsSync(receiptPath)) return {
    localReceiptPresent: false,
    aiGenerateAdmission: 'UNVERIFIED',
    verdict: 'K326_AI_GENERATION_RECEIPT_MISSING',
    githubAuthority: verifyK326GithubAuthorityBinding({ ...options, contractPath, receiptDir }),
  };
  const contract = readJson(contractPath);
  const report = readJson(receiptPath);
  const canonicalPath = path.join(ROOT, contract.canonical.sourcePath);
  const canonical = fs.readFileSync(canonicalPath, 'utf8');
  if (sha256(canonical) !== contract.canonical.sourceSha256) throw new Error('RCL_K326_CANONICAL_SOURCE_DRIFT');
  const canonicalVerification = verifyK326CompilerDatabaseCandidate({ sourcePath: canonicalPath });
  if (canonicalVerification.status !== 'PASS' || canonicalVerification.reportRoot !== contract.canonical.candidateReportRoot) throw new Error('RCL_K326_CANONICAL_VERIFICATION_MISMATCH');
  if (report.contractRoot !== evidenceRoot(contract)) throw new Error('RCL_K326_AI_CONTRACT_ROOT_MISMATCH');
  if (report.reportRoot !== evidenceRoot({ ...report, generatedAt: undefined, reportRoot: undefined })) throw new Error('RCL_K326_AI_REPORT_ROOT_MISMATCH');
  if (report.requiredTrials !== contract.requiredTrials || report.trials?.length !== contract.requiredTrials) throw new Error('RCL_K326_AI_TRIAL_COUNT_MISMATCH');
  const results = [];
  for (const trialContract of contract.trials) {
    const receipt = report.trials.find((trial) => trial.trialId === trialContract.id);
    if (!receipt) throw new Error(`RCL_K326_AI_TRIAL_MISSING:${trialContract.id}`);
    if (receipt.receiptRoot !== evidenceRoot({ ...receipt, receiptRoot: undefined })) throw new Error(`RCL_K326_AI_TRIAL_ROOT_MISMATCH:${trialContract.id}`);
    const mutation = K326_AI_GENERATION_MUTATIONS[trialContract.id];
    const mutated = replaceExactlyOnce(canonical, mutation.old, mutation.replacement, `RCL_K326_MUTATION_SITE_INVALID:${trialContract.id}`);
    if (receipt.mutatedSourceSha256 !== sha256(mutated)) throw new Error(`RCL_K326_MUTATED_HASH_MISMATCH:${trialContract.id}`);
    const candidate = replaceExactlyOnce(mutated, receipt.proposal.old, receipt.proposal.new, `RCL_K326_SAVED_EDIT_NOT_EXACT:${trialContract.id}`);
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
      || receipt.generator.threadId.length === 0) throw new Error(`RCL_K326_INDEPENDENCE_INVALID:${trialContract.id}`);
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), `rcl-${trialContract.id.toLowerCase()}-replay-`));
    let verification;
    try {
      const candidatePath = path.join(directory, 'candidate.rcl');
      fs.writeFileSync(candidatePath, candidate, 'utf8');
      verification = verifyK326CompilerDatabaseCandidate({ sourcePath: candidatePath });
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
    const successful = candidate === canonical
      && verification.status === 'PASS'
      && receipt.restoredCanonicalBytes === true
      && receipt.verification?.successful === true
      && receipt.verification?.reportRoot === verification.reportRoot;
    results.push({ trialId: trialContract.id, successful, threadId: receipt.generator.threadId, reportRoot: verification.reportRoot });
  }
  const runtime = verifyK326RuntimeEvidence(options);
  const runtimeEvidenceAdmitted = runtime.admitted === true
    && report.runtimeEvidenceBinding?.reportRoot === runtime.reportRoot
    && report.runtimeEvidenceBinding?.contractRoot === runtime.contractRoot;
  const successfulTrials = results.filter((result) => result.successful).length;
  const uniqueGeneratorSessions = new Set(results.map((result) => result.threadId)).size;
  const localAdmitted = successfulTrials === contract.admission.requiredSuccessfulTrials
    && uniqueGeneratorSessions === contract.admission.requiredUniqueGeneratorSessions
    && report.successfulTrials === successfulTrials
    && report.uniqueGeneratorSessions === uniqueGeneratorSessions
    && runtimeEvidenceAdmitted;
  const githubAuthority = verifyK326GithubAuthorityBinding({ ...options, contractPath, receiptDir });
  const admitted = localAdmitted && githubAuthority.admitted;
  return {
    localReceiptPresent: true,
    localAdmitted,
    successfulTrials,
    requiredTrials: contract.requiredTrials,
    uniqueGeneratorSessions,
    runtimeEvidenceAdmitted,
    runtimeEvidenceBinding: report.runtimeEvidenceBinding,
    eligibleCells: contract.eligibleCells,
    results,
    githubAuthority,
    aiGenerateAdmission: admitted ? 'PASS' : 'UNVERIFIED',
    verdict: admitted ? 'PASS_RECEIPT_REPLAY_GITHUB_LINUX_WINDOWS_NATIVE_DATABASE_AUTHORITY_BOUND' : 'PASS_LOCAL_RECEIPT_GITHUB_AUTHORITY_REQUIRED',
  };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const result = verifyK326CompilerDatabaseReceipt();
  console.log(JSON.stringify(result, null, 2));
  if (!result.localAdmitted) process.exitCode = 1;
}
