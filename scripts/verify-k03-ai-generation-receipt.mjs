#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { evidenceRoot } from '../src/universal-program-stress.mjs';
import { K03_AI_GENERATION_MUTATIONS } from './run-k03-independent-ai-generation.mjs';
import { verifyK03AndroidCandidate } from './verify-k03-android-candidate.mjs';
import { verifyK03AndroidEmulatorEvidence } from './verify-k03-android-emulator-evidence.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DEFAULT_CONTRACT_PATH = path.join(ROOT, 'examples', 'universal-stress', 'k03-ai-generation-contract.v0.1.json');
const DEFAULT_RECEIPT_DIR = path.join(ROOT, 'examples', 'universal-stress', 'evidence', 'k03-ai-generate');
const DEFAULT_AUTHORITY_PATH = path.join(DEFAULT_RECEIPT_DIR, 'github-replay.json');

function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function readJson(filePath) { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
function replaceExactlyOnce(source, oldText, newText, code) {
  const index = source.indexOf(oldText);
  if (index < 0 || source.indexOf(oldText, index + oldText.length) >= 0) throw new Error(code);
  return `${source.slice(0, index)}${newText}${source.slice(index + oldText.length)}`;
}

export function verifyK03GithubAuthorityBinding(options = {}) {
  const authorityPath = path.resolve(options.authorityPath ?? DEFAULT_AUTHORITY_PATH);
  if (!fs.existsSync(authorityPath)) return { admitted: false, status: 'GITHUB_AUTHORITY_RECEIPT_MISSING', authorityPath };
  const contractPath = path.resolve(options.contractPath ?? DEFAULT_CONTRACT_PATH);
  const receiptDir = path.resolve(options.receiptDir ?? DEFAULT_RECEIPT_DIR);
  const authority = readJson(authorityPath);
  const contract = readJson(contractPath);
  const local = readJson(path.join(receiptDir, 'receipt.json'));
  if (authority.authorityRoot !== evidenceRoot({ ...authority, authorityRoot: undefined })) throw new Error('RCL_K03_GITHUB_AUTHORITY_ROOT_MISMATCH');
  if (authority.format !== 'rcl.k03.github-replay-authority.v0.1'
    || authority.authority !== 'GITHUB_HOSTED_ACTIONS'
    || authority.workflow?.name !== 'RCL Universal Program Stress v0.1'
    || authority.workflow?.event !== 'push'
    || authority.job?.name !== 'focused-verification'
    || authority.job?.conclusion !== 'success'
    || authority.step?.name !== 'K03 independent AI generation receipt replay'
    || authority.step?.conclusion !== 'success') throw new Error('RCL_K03_GITHUB_AUTHORITY_INVALID');
  if (!/^[0-9a-f]{40}$/u.test(authority.sourceCommit)
    || authority.run?.headSha !== authority.sourceCommit
    || !Number.isSafeInteger(authority.run?.id)
    || !Number.isSafeInteger(authority.job?.id)) throw new Error('RCL_K03_GITHUB_AUTHORITY_IDENTITY_INVALID');
  if (authority.contractRoot !== evidenceRoot(contract)
    || authority.localReceiptReportRoot !== local.reportRoot
    || authority.emulatorReportRoot !== local.emulatorReportRoot) throw new Error('RCL_K03_GITHUB_AUTHORITY_EVIDENCE_MISMATCH');
  return { admitted: true, status: 'PASS_GITHUB_HOSTED_REPLAY_BOUND', verifiedAt: authority.verifiedAt, sourceCommit: authority.sourceCommit, runId: authority.run.id, runUrl: authority.run.url, jobId: authority.job.id, authorityRoot: authority.authorityRoot, authorityPath };
}

export function verifyK03AiGenerationReceipt(options = {}) {
  const contractPath = path.resolve(options.contractPath ?? DEFAULT_CONTRACT_PATH);
  const receiptDir = path.resolve(options.receiptDir ?? DEFAULT_RECEIPT_DIR);
  const receiptPath = path.join(receiptDir, 'receipt.json');
  if (!fs.existsSync(receiptPath)) return { localReceiptPresent: false, localAdmitted: false, aiGenerateAdmission: 'UNVERIFIED', githubAuthority: verifyK03GithubAuthorityBinding({ ...options, contractPath, receiptDir }) };
  const contract = readJson(contractPath);
  const report = readJson(receiptPath);
  const canonical = {
    'candidate.rcl': fs.readFileSync(path.join(ROOT, contract.canonical.sourcePath), 'utf8'),
    'candidate.android.json': fs.readFileSync(path.join(ROOT, contract.canonical.specPath), 'utf8'),
  };
  if (sha256(canonical['candidate.rcl']) !== contract.canonical.sourceSha256 || sha256(canonical['candidate.android.json']) !== contract.canonical.specSha256) throw new Error('RCL_K03_CANONICAL_INPUT_DRIFT');
  if (report.contractRoot !== evidenceRoot(contract)) throw new Error('RCL_K03_CONTRACT_ROOT_MISMATCH');
  if (report.reportRoot !== evidenceRoot({ ...report, generatedAt: undefined, reportRoot: undefined })) throw new Error('RCL_K03_REPORT_ROOT_MISMATCH');
  if (report.requiredTrials !== contract.requiredTrials || report.trials.length !== contract.requiredTrials) throw new Error('RCL_K03_TRIAL_COUNT_MISMATCH');
  const results = [];
  for (const trialContract of contract.trials) {
    const receipt = report.trials.find((trial) => trial.trialId === trialContract.id);
    if (!receipt) throw new Error(`RCL_K03_TRIAL_RECEIPT_MISSING:${trialContract.id}`);
    if (receipt.receiptRoot !== evidenceRoot({ ...receipt, receiptRoot: undefined })) throw new Error(`RCL_K03_TRIAL_RECEIPT_ROOT_MISMATCH:${trialContract.id}`);
    const mutation = K03_AI_GENERATION_MUTATIONS[trialContract.id];
    const mutated = { ...canonical, [mutation.file]: replaceExactlyOnce(canonical[mutation.file], mutation.old, mutation.replacement, `RCL_K03_MUTATION_SITE_INVALID:${trialContract.id}`) };
    if (receipt.mutatedSourceSha256 !== sha256(mutated['candidate.rcl']) || receipt.mutatedSpecSha256 !== sha256(mutated['candidate.android.json'])) throw new Error(`RCL_K03_MUTATED_HASH_MISMATCH:${trialContract.id}`);
    const candidate = { ...mutated, [receipt.proposal.file]: replaceExactlyOnce(mutated[receipt.proposal.file], receipt.proposal.old, receipt.proposal.new, `RCL_K03_SAVED_EDIT_NOT_EXACT:${trialContract.id}`) };
    const independence = receipt.independence ?? {};
    if (independence.oracleEditVisibleToGenerator !== false || independence.canonicalFilesVisibleToGenerator !== false
      || independence.developmentAgentAuthoredEdit !== false || independence.generatorReceivedMutatedCandidatesOnly !== true
      || independence.evaluatorAppliedExactSchemaEdit !== true || receipt.generator?.ephemeral !== true
      || receipt.generator?.sandbox !== 'read-only' || receipt.generator?.authoritativeRepositoryWritable !== false) throw new Error(`RCL_K03_INDEPENDENCE_INVALID:${trialContract.id}`);
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), `rcl-${trialContract.id.toLowerCase()}-replay-`));
    let verification;
    try {
      const sourcePath = path.join(directory, 'candidate.rcl');
      const specPath = path.join(directory, 'candidate.android.json');
      fs.writeFileSync(sourcePath, candidate['candidate.rcl'], 'utf8');
      fs.writeFileSync(specPath, candidate['candidate.android.json'], 'utf8');
      verification = verifyK03AndroidCandidate({ sourcePath, specPath });
    } finally { fs.rmSync(directory, { recursive: true, force: true }); }
    const restoredCanonicalBytes = candidate['candidate.rcl'] === canonical['candidate.rcl'] && candidate['candidate.android.json'] === canonical['candidate.android.json'];
    const successful = verification.status === 'PASS' && restoredCanonicalBytes && receipt.restoredCanonicalBytes === true && receipt.verification?.successful === true && receipt.verification?.reportRoot === verification.reportRoot;
    results.push({ trialId: trialContract.id, successful, threadId: receipt.generator.threadId, reportRoot: verification.reportRoot, manifestRoot: verification.manifestRoot });
  }
  const emulator = verifyK03AndroidEmulatorEvidence();
  if (report.emulatorReportRoot !== emulator.reportRoot) throw new Error('RCL_K03_EMULATOR_RECEIPT_MISMATCH');
  const successfulTrials = results.filter((result) => result.successful).length;
  const uniqueGeneratorSessions = new Set(results.map((result) => result.threadId)).size;
  const localAdmitted = successfulTrials === contract.admission.requiredSuccessfulTrials
    && uniqueGeneratorSessions === contract.admission.requiredUniqueGeneratorSessions && emulator.admitted;
  const githubAuthority = verifyK03GithubAuthorityBinding({ ...options, contractPath, receiptDir });
  return {
    localReceiptPresent: true,
    localAdmitted,
    successfulTrials,
    requiredTrials: contract.requiredTrials,
    uniqueGeneratorSessions,
    emulatorAdmitted: emulator.admitted,
    emulatorReportRoot: emulator.reportRoot,
    eligibleCells: contract.admission.eligibleCells,
    results,
    githubAuthority,
    aiGenerateAdmission: localAdmitted && githubAuthority.admitted ? 'PASS' : 'UNVERIFIED',
    verdict: localAdmitted && githubAuthority.admitted ? 'PASS_RECEIPT_REPLAY_GITHUB_AUTHORITY_BOUND' : 'PASS_LOCAL_RECEIPT_GITHUB_AUTHORITY_REQUIRED',
  };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const result = verifyK03AiGenerationReceipt();
  console.log(JSON.stringify(result, null, 2));
  if (!result.localAdmitted) process.exitCode = 1;
}
