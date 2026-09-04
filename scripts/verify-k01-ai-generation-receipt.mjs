#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { evidenceRoot } from '../src/universal-program-stress.mjs';
import { readCanonicalCompilerSourcePair } from '../src/canonical-source-archive.mjs';
import { K01_AI_GENERATION_MUTATIONS } from './run-k01-independent-ai-generation.mjs';
import { verifyK01CompilerCandidate } from './verify-k01-compiler-candidate.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DEFAULT_CONTRACT_PATH = path.join(ROOT, 'examples', 'universal-stress', 'k01-ai-generation-contract.v0.2.json');
const DEFAULT_RECEIPT_DIR = path.join(ROOT, 'examples', 'universal-stress', 'evidence', 'k01-ai-generate');
const DEFAULT_AUTHORITY_PATH = path.join(DEFAULT_RECEIPT_DIR, 'github-replay.json');

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function replaceExactlyOnce(source, oldText, newText, code) {
  const index = source.indexOf(oldText);
  if (index < 0 || source.indexOf(oldText, index + oldText.length) >= 0) throw new Error(code);
  return `${source.slice(0, index)}${newText}${source.slice(index + oldText.length)}`;
}

export function verifyK01GithubAuthorityBinding(options = {}) {
  const authorityPath = path.resolve(options.authorityPath ?? DEFAULT_AUTHORITY_PATH);
  if (!fs.existsSync(authorityPath)) return { admitted: false, status: 'GITHUB_AUTHORITY_RECEIPT_MISSING', authorityPath };
  const contractPath = path.resolve(options.contractPath ?? DEFAULT_CONTRACT_PATH);
  const receiptDir = path.resolve(options.receiptDir ?? DEFAULT_RECEIPT_DIR);
  const authority = readJson(authorityPath);
  const contract = readJson(contractPath);
  const localReport = readJson(path.join(receiptDir, 'receipt.json'));
  if (authority.authorityRoot !== evidenceRoot({ ...authority, authorityRoot: undefined })) throw new Error('RCL_K01_GITHUB_AUTHORITY_ROOT_MISMATCH');
  const jobs = authority.jobs ?? {};
  if (authority.format !== 'rcl.k01.github-replay-authority.v0.2'
    || authority.authority !== 'GITHUB_HOSTED_ACTIONS'
    || authority.workflow?.name !== 'RCL Universal Program Stress v0.1'
    || authority.workflow?.event !== 'push'
    || jobs.focused?.name !== 'focused-verification'
    || jobs.focused?.conclusion !== 'success'
    || jobs.focused?.step?.name !== 'K01 independent AI generation receipt replay'
    || jobs.focused?.step?.conclusion !== 'success'
    || jobs.windows?.name !== 'k01-windows-verification'
    || jobs.windows?.conclusion !== 'success'
    || jobs.windows?.step?.name !== 'K01 Windows self-hosting compiler campaign'
    || jobs.windows?.step?.conclusion !== 'success') throw new Error('RCL_K01_GITHUB_AUTHORITY_INVALID');
  if (!/^[0-9a-f]{40}$/u.test(authority.sourceCommit)
    || authority.run?.headSha !== authority.sourceCommit
    || !Number.isSafeInteger(authority.run?.id)
    || !Number.isSafeInteger(jobs.focused?.id)
    || !Number.isSafeInteger(jobs.windows?.id)) throw new Error('RCL_K01_GITHUB_AUTHORITY_IDENTITY_INVALID');
  if (authority.contractRoot !== evidenceRoot(contract)
    || authority.localReceiptReportRoot !== localReport.reportRoot) throw new Error('RCL_K01_GITHUB_AUTHORITY_EVIDENCE_MISMATCH');
  return {
    admitted: true,
    status: 'PASS_GITHUB_LINUX_WINDOWS_REPLAY_BOUND',
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

export function verifyK01AiGenerationReceipt(options = {}) {
  const contractPath = path.resolve(options.contractPath ?? DEFAULT_CONTRACT_PATH);
  const receiptDir = path.resolve(options.receiptDir ?? DEFAULT_RECEIPT_DIR);
  const receiptPath = path.join(receiptDir, 'receipt.json');
  if (!fs.existsSync(receiptPath)) return {
    localReceiptPresent: false,
    aiGenerateAdmission: 'UNVERIFIED',
    verdict: 'K01_AI_GENERATION_RECEIPT_MISSING',
    githubAuthority: verifyK01GithubAuthorityBinding({ ...options, contractPath, receiptDir }),
  };
  const contract = readJson(contractPath);
  const report = readJson(receiptPath);
  const canonical = readCanonicalCompilerSourcePair(contract).files;
  if (report.contractRoot !== evidenceRoot(contract)) throw new Error('RCL_K01_CONTRACT_ROOT_MISMATCH');
  if (report.reportRoot !== evidenceRoot({ ...report, generatedAt: undefined, reportRoot: undefined })) throw new Error('RCL_K01_REPORT_ROOT_MISMATCH');
  if (report.requiredTrials !== contract.requiredTrials || report.trials.length !== contract.requiredTrials) throw new Error('RCL_K01_TRIAL_COUNT_MISMATCH');

  const results = [];
  for (const trialContract of contract.trials) {
    const receipt = report.trials.find((trial) => trial.trialId === trialContract.id);
    if (!receipt) throw new Error(`RCL_K01_TRIAL_RECEIPT_MISSING:${trialContract.id}`);
    if (receipt.receiptRoot !== evidenceRoot({ ...receipt, receiptRoot: undefined })) throw new Error(`RCL_K01_TRIAL_RECEIPT_ROOT_MISMATCH:${trialContract.id}`);
    const mutation = K01_AI_GENERATION_MUTATIONS[trialContract.id];
    const mutated = {
      ...canonical,
      [mutation.file]: replaceExactlyOnce(canonical[mutation.file], mutation.old, mutation.replacement, `RCL_K01_MUTATION_SITE_INVALID:${trialContract.id}`),
    };
    if (receipt.mutatedCoreSha256 !== sha256(mutated['candidate-core.rcl'])
      || receipt.mutatedMainSha256 !== sha256(mutated['candidate-main.rcl'])) throw new Error(`RCL_K01_MUTATED_HASH_MISMATCH:${trialContract.id}`);
    const candidate = {
      ...mutated,
      [receipt.proposal.file]: replaceExactlyOnce(mutated[receipt.proposal.file], receipt.proposal.old, receipt.proposal.new, `RCL_K01_SAVED_EDIT_NOT_EXACT:${trialContract.id}`),
    };
    const independence = receipt.independence ?? {};
    if (independence.oracleEditVisibleToGenerator !== false
      || independence.canonicalFilesVisibleToGenerator !== false
      || independence.developmentAgentAuthoredEdit !== false
      || independence.generatorReceivedMutatedCandidatesOnly !== true
      || independence.evaluatorAppliedExactSchemaEdit !== true
      || receipt.generator?.ephemeral !== true
      || receipt.generator?.sandbox !== 'read-only'
      || receipt.generator?.authoritativeRepositoryWritable !== false) throw new Error(`RCL_K01_INDEPENDENCE_INVALID:${trialContract.id}`);
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), `rcl-${trialContract.id.toLowerCase()}-replay-`));
    let verification;
    try {
      const corePath = path.join(directory, 'candidate-core.rcl');
      const mainPath = path.join(directory, 'candidate-main.rcl');
      fs.writeFileSync(corePath, candidate['candidate-core.rcl'], 'utf8');
      fs.writeFileSync(mainPath, candidate['candidate-main.rcl'], 'utf8');
      verification = verifyK01CompilerCandidate({ corePath, mainPath });
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
    const restoredCanonicalBytes = candidate['candidate-core.rcl'] === canonical['candidate-core.rcl']
      && candidate['candidate-main.rcl'] === canonical['candidate-main.rcl'];
    const successful = verification.status === 'PASS'
      && restoredCanonicalBytes
      && receipt.restoredCanonicalBytes === true
      && receipt.verification?.successful === true
      && receipt.verification?.reportRoot === verification.reportRoot;
    results.push({ trialId: trialContract.id, successful, threadId: receipt.generator.threadId, reportRoot: verification.reportRoot });
  }
  const fixedPoint = report.sharedNativeFixedPoint ?? {};
  const canonicalSourceSha256 = sha256(`${canonical['candidate-core.rcl']}\n${canonical['candidate-main.rcl']}`);
  const fixedPointAdmitted = fixedPoint.ok === true
    && fixedPoint.byteIdentical === true
    && fixedPoint.sourceSha256 === canonicalSourceSha256
    && fixedPoint.generations?.c0 === fixedPoint.artifactSha256
    && fixedPoint.generations?.c1 === fixedPoint.artifactSha256
    && fixedPoint.generations?.c2 === fixedPoint.artifactSha256;
  const successfulTrials = results.filter((result) => result.successful).length;
  const uniqueGeneratorSessions = new Set(results.map((result) => result.threadId)).size;
  const localAdmitted = successfulTrials === contract.admission.requiredSuccessfulTrials
    && uniqueGeneratorSessions === contract.admission.requiredUniqueGeneratorSessions
    && fixedPointAdmitted;
  const githubAuthority = verifyK01GithubAuthorityBinding({ ...options, contractPath, receiptDir });
  const admitted = localAdmitted && githubAuthority.admitted;
  return {
    localReceiptPresent: true,
    localAdmitted,
    successfulTrials,
    requiredTrials: contract.requiredTrials,
    uniqueGeneratorSessions,
    fixedPointAdmitted,
    eligibleCells: contract.admission.eligibleCells,
    results,
    githubAuthority,
    aiGenerateAdmission: admitted ? 'PASS' : 'UNVERIFIED',
    verdict: admitted ? 'PASS_RECEIPT_REPLAY_GITHUB_LINUX_WINDOWS_AUTHORITY_BOUND' : 'PASS_LOCAL_RECEIPT_GITHUB_AUTHORITY_REQUIRED',
  };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const result = verifyK01AiGenerationReceipt();
  console.log(JSON.stringify(result, null, 2));
  if (!result.localAdmitted) process.exitCode = 1;
}
