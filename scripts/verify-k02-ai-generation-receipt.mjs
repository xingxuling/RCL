#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { evidenceRoot } from '../src/universal-program-stress.mjs';
import { K02_AI_GENERATION_MUTATIONS } from './run-k02-independent-ai-generation.mjs';
import { verifyK02WebCandidate } from './verify-k02-web-candidate.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DEFAULT_CONTRACT_PATH = path.join(ROOT, 'examples', 'universal-stress', 'k02-ai-generation-contract.v0.1.json');
const DEFAULT_RECEIPT_DIR = path.join(ROOT, 'examples', 'universal-stress', 'evidence', 'k02-ai-generate');
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

function assertRootedReceipt(receipt, trialId) {
  const expected = evidenceRoot({ ...receipt, receiptRoot: undefined });
  if (receipt.receiptRoot !== expected) throw new Error(`RCL_K02_TRIAL_RECEIPT_ROOT_MISMATCH:${trialId}`);
}

export function verifyK02GithubAuthorityBinding(options = {}) {
  const authorityPath = path.resolve(options.authorityPath ?? DEFAULT_AUTHORITY_PATH);
  if (!fs.existsSync(authorityPath)) {
    return { admitted: false, status: 'GITHUB_AUTHORITY_RECEIPT_MISSING', authorityPath };
  }
  const contractPath = path.resolve(options.contractPath ?? DEFAULT_CONTRACT_PATH);
  const receiptDir = path.resolve(options.receiptDir ?? DEFAULT_RECEIPT_DIR);
  const authority = readJson(authorityPath);
  const contract = readJson(contractPath);
  const localReport = readJson(path.join(receiptDir, 'receipt.json'));
  if (authority.authorityRoot !== evidenceRoot({ ...authority, authorityRoot: undefined })) {
    throw new Error('RCL_K02_GITHUB_AUTHORITY_ROOT_MISMATCH');
  }
  if (authority.format !== 'rcl.k02.github-replay-authority.v0.1'
    || authority.authority !== 'GITHUB_HOSTED_ACTIONS'
    || authority.workflow?.name !== 'RCL Universal Program Stress v0.1'
    || authority.workflow?.event !== 'push'
    || authority.job?.name !== 'focused-verification'
    || authority.job?.conclusion !== 'success'
    || authority.step?.name !== 'K02 independent AI generation receipt replay'
    || authority.step?.conclusion !== 'success') {
    throw new Error('RCL_K02_GITHUB_AUTHORITY_INVALID');
  }
  if (!/^[0-9a-f]{40}$/u.test(authority.sourceCommit)
    || authority.run?.headSha !== authority.sourceCommit
    || !Number.isSafeInteger(authority.run?.id)
    || !Number.isSafeInteger(authority.job?.id)) {
    throw new Error('RCL_K02_GITHUB_AUTHORITY_IDENTITY_INVALID');
  }
  if (authority.contractRoot !== evidenceRoot(contract)
    || authority.localReceiptReportRoot !== localReport.reportRoot) {
    throw new Error('RCL_K02_GITHUB_AUTHORITY_EVIDENCE_MISMATCH');
  }
  return {
    admitted: true,
    status: 'PASS_GITHUB_HOSTED_REPLAY_BOUND',
    verifiedAt: authority.verifiedAt,
    sourceCommit: authority.sourceCommit,
    runId: authority.run.id,
    runUrl: authority.run.url,
    jobId: authority.job.id,
    jobUrl: authority.job.url,
    authorityRoot: authority.authorityRoot,
    authorityPath,
  };
}

export async function verifyK02AiGenerationReceipt(options = {}) {
  const contractPath = path.resolve(options.contractPath ?? DEFAULT_CONTRACT_PATH);
  const receiptDir = path.resolve(options.receiptDir ?? DEFAULT_RECEIPT_DIR);
  if (!fs.existsSync(path.join(receiptDir, 'receipt.json'))) {
    return {
      localReceiptPresent: false,
      aiGenerateAdmission: 'UNVERIFIED',
      verdict: 'K02_AI_GENERATION_RECEIPT_MISSING',
      githubAuthority: verifyK02GithubAuthorityBinding({ ...options, contractPath, receiptDir }),
    };
  }
  const contract = readJson(contractPath);
  const report = readJson(path.join(receiptDir, 'receipt.json'));
  const canonical = {
    'candidate.rcl': fs.readFileSync(path.join(ROOT, contract.canonical.sourcePath), 'utf8'),
    'candidate.web.json': fs.readFileSync(path.join(ROOT, contract.canonical.specPath), 'utf8'),
  };
  if (sha256(canonical['candidate.rcl']) !== contract.canonical.sourceSha256
    || sha256(canonical['candidate.web.json']) !== contract.canonical.specSha256) {
    throw new Error('RCL_K02_CANONICAL_INPUT_DRIFT');
  }
  if (report.contractRoot !== evidenceRoot(contract)) throw new Error('RCL_K02_CONTRACT_ROOT_MISMATCH');
  if (report.reportRoot !== evidenceRoot({ ...report, generatedAt: undefined, reportRoot: undefined })) {
    throw new Error('RCL_K02_REPORT_ROOT_MISMATCH');
  }
  if (report.requiredTrials !== contract.requiredTrials || report.trials.length !== contract.requiredTrials) {
    throw new Error('RCL_K02_TRIAL_COUNT_MISMATCH');
  }

  const results = [];
  for (const trialContract of contract.trials) {
    const receipt = report.trials.find((trial) => trial.trialId === trialContract.id);
    if (!receipt) throw new Error(`RCL_K02_TRIAL_RECEIPT_MISSING:${trialContract.id}`);
    assertRootedReceipt(receipt, trialContract.id);
    const mutation = K02_AI_GENERATION_MUTATIONS[trialContract.id];
    if (!mutation) throw new Error(`RCL_K02_UNKNOWN_TRIAL:${trialContract.id}`);
    const mutated = {
      ...canonical,
      [mutation.file]: replaceExactlyOnce(canonical[mutation.file], mutation.old, mutation.replacement, `RCL_K02_MUTATION_SITE_INVALID:${trialContract.id}`),
    };
    if (receipt.mutatedSourceSha256 !== sha256(mutated['candidate.rcl'])
      || receipt.mutatedSpecSha256 !== sha256(mutated['candidate.web.json'])) {
      throw new Error(`RCL_K02_MUTATED_HASH_MISMATCH:${trialContract.id}`);
    }
    const candidate = {
      ...mutated,
      [receipt.proposal.file]: replaceExactlyOnce(
        mutated[receipt.proposal.file],
        receipt.proposal.old,
        receipt.proposal.new,
        `RCL_K02_SAVED_EDIT_NOT_EXACT:${trialContract.id}`,
      ),
    };
    const savedSourcePath = path.join(receiptDir, trialContract.id, 'candidate.rcl');
    const savedSpecPath = path.join(receiptDir, trialContract.id, 'candidate.web.json');
    const savedSource = fs.readFileSync(savedSourcePath, 'utf8');
    const savedSpec = fs.readFileSync(savedSpecPath, 'utf8');
    if (candidate['candidate.rcl'] !== savedSource || candidate['candidate.web.json'] !== savedSpec
      || receipt.candidateSourceSha256 !== sha256(savedSource)
      || receipt.candidateSpecSha256 !== sha256(savedSpec)) {
      throw new Error(`RCL_K02_SAVED_CANDIDATE_MISMATCH:${trialContract.id}`);
    }
    const independence = receipt.independence ?? {};
    if (independence.oracleEditVisibleToGenerator !== false
      || independence.canonicalFilesVisibleToGenerator !== false
      || independence.developmentAgentAuthoredEdit !== false
      || independence.generatorReceivedMutatedCandidatesOnly !== true
      || independence.evaluatorAppliedExactSchemaEdit !== true
      || receipt.generator?.ephemeral !== true
      || receipt.generator?.sandbox !== 'read-only'
      || receipt.generator?.authoritativeRepositoryWritable !== false) {
      throw new Error(`RCL_K02_INDEPENDENCE_INVALID:${trialContract.id}`);
    }
    const verification = await verifyK02WebCandidate({ sourcePath: savedSourcePath, specPath: savedSpecPath });
    const restoredCanonicalBytes = savedSource === canonical['candidate.rcl'] && savedSpec === canonical['candidate.web.json'];
    const successful = verification.status === 'PASS'
      && restoredCanonicalBytes
      && receipt.restoredCanonicalBytes === true
      && receipt.verification?.successful === true
      && receipt.verification?.reportRoot === verification.reportRoot;
    results.push({
      trialId: trialContract.id,
      successful,
      threadId: receipt.generator.threadId,
      reportRoot: verification.reportRoot,
      manifestRoot: verification.manifestRoot,
    });
  }

  const successfulTrials = results.filter((result) => result.successful).length;
  const uniqueGeneratorSessions = new Set(results.map((result) => result.threadId)).size;
  const localAdmitted = successfulTrials === contract.admission.requiredSuccessfulTrials
    && uniqueGeneratorSessions === contract.admission.requiredUniqueGeneratorSessions;
  const githubAuthority = verifyK02GithubAuthorityBinding({ ...options, contractPath, receiptDir });
  const admitted = localAdmitted && githubAuthority.admitted;
  return {
    localReceiptPresent: true,
    localAdmitted,
    successfulTrials,
    requiredTrials: contract.requiredTrials,
    uniqueGeneratorSessions,
    eligibleCells: contract.admission.eligibleCells,
    results,
    githubAuthority,
    aiGenerateAdmission: admitted ? 'PASS' : 'UNVERIFIED',
    verdict: admitted
      ? 'PASS_RECEIPT_REPLAY_GITHUB_AUTHORITY_BOUND'
      : 'PASS_LOCAL_RECEIPT_GITHUB_AUTHORITY_REQUIRED',
  };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const result = await verifyK02AiGenerationReceipt();
  console.log(JSON.stringify(result, null, 2));
  if (!result.localAdmitted) process.exitCode = 1;
}
