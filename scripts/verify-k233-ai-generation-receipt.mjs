#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { evidenceRoot } from '../src/universal-program-stress.mjs';
import { runPureRclXorCampaign } from './run-k08-pure-rcl-xor.mjs';
import { K233_AI_GENERATION_MUTATIONS } from './run-k233-independent-ai-generation.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DEFAULT_CONTRACT_PATH = path.join(ROOT, 'examples', 'native-ai', 'k233-ai-generation-contract.v0.1.json');
const DEFAULT_SOURCE_PATH = path.join(ROOT, 'examples', 'native-ai', 'pure-rcl-xor.rcl');
const DEFAULT_RECEIPT_DIR = path.join(ROOT, 'examples', 'native-ai', 'evidence', 'k233-ai-generate');
const DEFAULT_AUTHORITY_PATH = path.join(DEFAULT_RECEIPT_DIR, 'github-replay.json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function replaceExactlyOnce(source, oldText, newText, code) {
  const first = source.indexOf(oldText);
  if (first < 0 || source.indexOf(oldText, first + oldText.length) >= 0) throw new Error(code);
  return `${source.slice(0, first)}${newText}${source.slice(first + oldText.length)}`;
}

function assertRootedReceipt(receipt, trialId) {
  const expected = evidenceRoot({ ...receipt, receiptRoot: undefined });
  if (receipt.receiptRoot !== expected) throw new Error(`RCL_K233_TRIAL_RECEIPT_ROOT_MISMATCH:${trialId}`);
}

export function verifyGithubAuthorityBinding(options = {}) {
  const authorityPath = path.resolve(options.authorityPath ?? DEFAULT_AUTHORITY_PATH);
  if (!fs.existsSync(authorityPath)) {
    return { admitted: false, status: 'GITHUB_AUTHORITY_RECEIPT_MISSING', authorityPath };
  }
  const contractPath = path.resolve(options.contractPath ?? DEFAULT_CONTRACT_PATH);
  const receiptDir = path.resolve(options.receiptDir ?? DEFAULT_RECEIPT_DIR);
  const authority = readJson(authorityPath);
  const contract = readJson(contractPath);
  const localReport = readJson(path.join(receiptDir, 'receipt.json'));
  const expectedRoot = evidenceRoot({ ...authority, authorityRoot: undefined });
  if (authority.authorityRoot !== expectedRoot) throw new Error('RCL_K233_GITHUB_AUTHORITY_ROOT_MISMATCH');
  if (authority.format !== 'rcl.k233.github-replay-authority.v0.1'
    || authority.authority !== 'GITHUB_HOSTED_ACTIONS'
    || authority.workflow?.name !== 'RCL Universal Program Stress v0.1'
    || authority.workflow?.event !== 'push'
    || authority.job?.name !== 'focused-verification'
    || authority.job?.conclusion !== 'success'
    || authority.step?.name !== 'K233 independent AI generation receipt replay'
    || authority.step?.conclusion !== 'success') {
    throw new Error('RCL_K233_GITHUB_AUTHORITY_INVALID');
  }
  if (!/^[0-9a-f]{40}$/.test(authority.sourceCommit)
    || authority.run?.headSha !== authority.sourceCommit
    || !Number.isSafeInteger(authority.run?.id)
    || !Number.isSafeInteger(authority.job?.id)) {
    throw new Error('RCL_K233_GITHUB_AUTHORITY_IDENTITY_INVALID');
  }
  if (authority.contractRoot !== evidenceRoot(contract)
    || authority.localReceiptReportRoot !== localReport.reportRoot) {
    throw new Error('RCL_K233_GITHUB_AUTHORITY_EVIDENCE_MISMATCH');
  }
  return {
    admitted: true,
    status: 'PASS_GITHUB_HOSTED_REPLAY_BOUND',
    authorityPath,
    sourceCommit: authority.sourceCommit,
    runId: authority.run.id,
    runUrl: authority.run.url,
    jobId: authority.job.id,
    jobUrl: authority.job.url,
    authorityRoot: authority.authorityRoot,
  };
}

export function verifyK233AiGenerationReceipt(options = {}) {
  const contractPath = path.resolve(options.contractPath ?? DEFAULT_CONTRACT_PATH);
  const sourcePath = path.resolve(options.sourcePath ?? DEFAULT_SOURCE_PATH);
  const receiptDir = path.resolve(options.receiptDir ?? DEFAULT_RECEIPT_DIR);
  const contract = readJson(contractPath);
  const canonicalSource = fs.readFileSync(sourcePath, 'utf8');
  const report = readJson(path.join(receiptDir, 'receipt.json'));
  if (sha256(canonicalSource) !== contract.canonicalSourceSha256) throw new Error('RCL_K233_CANONICAL_SOURCE_DRIFT');
  if (report.contractRoot !== evidenceRoot(contract)) throw new Error('RCL_K233_CONTRACT_ROOT_MISMATCH');
  const expectedReportRoot = evidenceRoot({ ...report, generatedAt: undefined, reportRoot: undefined });
  if (report.reportRoot !== expectedReportRoot) throw new Error('RCL_K233_REPORT_ROOT_MISMATCH');
  if (report.requiredTrials !== contract.requiredTrials || report.trials.length !== contract.requiredTrials) {
    throw new Error('RCL_K233_TRIAL_COUNT_MISMATCH');
  }

  const results = [];
  for (const trialContract of contract.trials) {
    const mutation = K233_AI_GENERATION_MUTATIONS[trialContract.id];
    if (!mutation) throw new Error(`RCL_K233_UNKNOWN_TRIAL:${trialContract.id}`);
    const receipt = readJson(path.join(receiptDir, trialContract.id, 'receipt.json'));
    const candidatePath = path.join(receiptDir, trialContract.id, 'candidate.rcl');
    const candidateSource = fs.readFileSync(candidatePath, 'utf8');
    assertRootedReceipt(receipt, trialContract.id);
    if (receipt.trialId !== trialContract.id) throw new Error(`RCL_K233_TRIAL_ID_MISMATCH:${trialContract.id}`);
    if (receipt.generator.kind !== contract.generator.kind || receipt.generator.ephemeral !== true || receipt.generator.effectiveFilesystem !== 'read-only') {
      throw new Error(`RCL_K233_GENERATOR_PROVENANCE_INVALID:${trialContract.id}`);
    }
    if (receipt.independence.oraclePatchVisibleToGenerator !== false
      || receipt.independence.canonicalSourceVisibleToGenerator !== false
      || receipt.independence.developmentAgentAuthoredEdit !== false
      || receipt.independence.evaluatorAppliedExactSchemaEdit !== true) {
      throw new Error(`RCL_K233_INDEPENDENCE_BOUNDARY_INVALID:${trialContract.id}`);
    }
    if (sha256(candidateSource) !== receipt.candidateSourceSha256) throw new Error(`RCL_K233_CANDIDATE_ROOT_MISMATCH:${trialContract.id}`);
    const mutated = replaceExactlyOnce(canonicalSource, mutation.old, mutation.replacement, `RCL_K233_MUTATION_SITE_INVALID:${trialContract.id}`);
    if (sha256(mutated) !== receipt.mutatedSourceSha256) throw new Error(`RCL_K233_MUTATION_ROOT_MISMATCH:${trialContract.id}`);
    const mechanicallyApplied = replaceExactlyOnce(mutated, receipt.proposal.old, receipt.proposal.new, `RCL_K233_PROPOSAL_NOT_EXACT:${trialContract.id}`);
    if (mechanicallyApplied !== candidateSource) throw new Error(`RCL_K233_PROPOSAL_CANDIDATE_MISMATCH:${trialContract.id}`);
    if (candidateSource !== canonicalSource || receipt.candidateRestoredCanonicalBytes !== true) {
      throw new Error(`RCL_K233_CANONICAL_REPAIR_NOT_RESTORED:${trialContract.id}`);
    }
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), `rcl-k233-replay-${trialContract.id.toLowerCase()}-`));
    const verification = runPureRclXorCampaign({ sourcePath: candidatePath, outputDir });
    const nonAiGatesPass = Object.entries(verification.gates)
      .filter(([gate]) => gate !== 'AI_GENERATE')
      .every(([, gate]) => gate.status === 'PASS');
    const successful = verification.nativeLearningMilestone === 'PASS'
      && nonAiGatesPass
      && verification.pureExecutionPath.dependencyAudit.ok === true
      && verification.robustness.identicalSemanticStateRoots === true;
    if (!successful) throw new Error(`RCL_K233_REPLAY_FAILED:${trialContract.id}`);
    if (JSON.stringify(verification.robustness.semanticStateRoots) !== JSON.stringify(receipt.verification.semanticStateRoots)) {
      throw new Error(`RCL_K233_SEMANTIC_ROOT_REPLAY_MISMATCH:${trialContract.id}`);
    }
    results.push({
      trialId: trialContract.id,
      successful,
      generatorThreadId: receipt.generator.threadId,
      candidateSourceSha256: receipt.candidateSourceSha256,
      semanticStateRoot: verification.robustness.semanticStateRoots[0],
      localReceiptRoot: receipt.receiptRoot,
      replayReportRoot: verification.reportRoot,
    });
  }

  const uniqueSessions = new Set(results.map((result) => result.generatorThreadId)).size;
  const passed = results.length === contract.admission.requiredSuccessfulTrials
    && results.every((result) => result.successful)
    && uniqueSessions === contract.requiredTrials;
  const githubAuthority = passed ? verifyGithubAuthorityBinding({ contractPath, receiptDir }) : {
    admitted: false,
    status: 'LOCAL_REPLAY_FAILED',
  };
  const admitted = passed && githubAuthority.admitted;
  return {
    format: 'rcl.k233.ai-generation-replay-verification.v0.1',
    verdict: admitted
      ? 'PASS_RECEIPT_REPLAY_GITHUB_AUTHORITY_BOUND'
      : (passed ? 'PASS_RECEIPT_REPLAY_READY_FOR_GITHUB_AUTHORITY' : 'FAIL_RECEIPT_REPLAY'),
    aiGenerateAdmission: admitted ? 'PASS' : (passed ? 'CANDIDATE_GITHUB_AUTHORITY_REQUIRED' : 'UNVERIFIED'),
    contractRoot: evidenceRoot(contract),
    sourceSha256: sha256(canonicalSource),
    localReceiptReportRoot: report.reportRoot,
    successfulTrials: results.length,
    uniqueGeneratorSessions: uniqueSessions,
    githubAuthority,
    results,
    verificationRoot: evidenceRoot(results),
  };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const result = verifyK233AiGenerationReceipt();
  console.log(JSON.stringify(result, null, 2));
  if (!result.verdict.startsWith('PASS_')) process.exitCode = 1;
}
