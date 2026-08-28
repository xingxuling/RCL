import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { evidenceRoot } from '../src/universal-program-stress.mjs';
import { replaceRclRepairTextOnce } from './independent-rcl-repair-harness.mjs';

function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function readJson(filePath) { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }

export function verifyRootedRclRuntimeEvidence(config, options = {}) {
  const contract = readJson(path.resolve(options.runtimeContractPath ?? config.runtimeContractPath));
  const evidence = readJson(path.resolve(options.runtimeEvidencePath ?? config.runtimeEvidencePath));
  if (evidence.reportRoot !== evidenceRoot({ ...evidence, generatedAt: undefined, reportRoot: undefined })) throw new Error(`${config.errorPrefix}_RUNTIME_REPORT_ROOT_MISMATCH`);
  if (evidence.contractRoot !== evidenceRoot(contract)) throw new Error(`${config.errorPrefix}_RUNTIME_CONTRACT_ROOT_MISMATCH`);
  const rounds = evidence.rounds ?? [];
  if (evidence.status !== 'PASS'
    || evidence.summary?.successfulRounds !== contract.required.rounds
    || rounds.length !== contract.required.rounds
    || evidence.summary?.uniqueStateRoots !== contract.required.uniqueStateRoots
    || evidence.summary?.uniqueArtifactHashes !== contract.required.uniqueArtifactHashes
    || evidence.summary?.controlsPassed !== true
    || evidence.summary?.performancePassed !== true
    || Object.values(evidence.negativeControls ?? {}).length !== contract.required.negativeControls.length
    || !Object.values(evidence.negativeControls ?? {}).every(Boolean)
    || !rounds.every((round) => round.stateRoot === contract.canonical.semanticStateRoot)
    || !rounds.every((round) => round.artifactSha256 === contract.canonical.bootstrapArtifactSha256)
    || evidence.performance?.compileP95Ms > contract.performanceBudget.compileP95MsMax
    || evidence.performance?.executeP95Ms > contract.performanceBudget.executeP95MsMax
    || evidence.performance?.combinedP95Ms > contract.performanceBudget.combinedP95MsMax) throw new Error(`${config.errorPrefix}_RUNTIME_EVIDENCE_INVALID`);
  return { admitted: true, reportRoot: evidence.reportRoot, contractRoot: evidence.contractRoot, rounds: evidence.summary.successfulRounds };
}

export function verifyRclGithubAuthorityBinding(config, options = {}) {
  const authorityPath = path.resolve(options.authorityPath ?? config.authorityPath);
  if (!fs.existsSync(authorityPath)) return { admitted: false, status: 'GITHUB_AUTHORITY_RECEIPT_MISSING', authorityPath };
  const contractPath = path.resolve(options.contractPath ?? config.contractPath);
  const receiptDir = path.resolve(options.receiptDir ?? config.receiptDir);
  const authority = readJson(authorityPath);
  const contract = readJson(contractPath);
  const localReport = readJson(path.join(receiptDir, 'receipt.json'));
  if (authority.authorityRoot !== evidenceRoot({ ...authority, authorityRoot: undefined })) throw new Error(`${config.errorPrefix}_GITHUB_AUTHORITY_ROOT_MISMATCH`);
  const jobs = authority.jobs ?? {};
  if (authority.format !== config.authorityFormat
    || authority.authority !== 'GITHUB_HOSTED_ACTIONS'
    || authority.workflow?.name !== 'RCL Universal Program Stress v0.1'
    || authority.workflow?.event !== 'push'
    || jobs.focused?.name !== 'focused-verification'
    || jobs.focused?.conclusion !== 'success'
    || jobs.focused?.step?.name !== config.focusedStepName
    || jobs.focused?.step?.conclusion !== 'success'
    || jobs.windows?.name !== 'k01-windows-verification'
    || jobs.windows?.conclusion !== 'success'
    || jobs.windows?.step?.name !== config.windowsStepName
    || jobs.windows?.step?.conclusion !== 'success') throw new Error(`${config.errorPrefix}_GITHUB_AUTHORITY_INVALID`);
  if (!/^[0-9a-f]{40}$/u.test(authority.sourceCommit)
    || authority.run?.headSha !== authority.sourceCommit
    || !Number.isSafeInteger(authority.run?.id)
    || !Number.isSafeInteger(jobs.focused?.id)
    || !Number.isSafeInteger(jobs.windows?.id)) throw new Error(`${config.errorPrefix}_GITHUB_AUTHORITY_IDENTITY_INVALID`);
  if (authority.contractRoot !== evidenceRoot(contract)
    || authority.localReceiptReportRoot !== localReport.reportRoot
    || authority.runtimeEvidenceBindingRoot !== evidenceRoot(localReport.runtimeEvidenceBinding)) throw new Error(`${config.errorPrefix}_GITHUB_AUTHORITY_EVIDENCE_MISMATCH`);
  return {
    admitted: true, status: config.authorityPassStatus, verifiedAt: authority.verifiedAt,
    sourceCommit: authority.sourceCommit, runId: authority.run.id, runUrl: authority.run.url,
    focusedJobId: jobs.focused.id, windowsJobId: jobs.windows.id,
    authorityRoot: authority.authorityRoot, authorityPath,
  };
}

export function verifyIndependentRclRepairReceipt(config, options = {}) {
  const contractPath = path.resolve(options.contractPath ?? config.contractPath);
  const receiptDir = path.resolve(options.receiptDir ?? config.receiptDir);
  const receiptPath = path.join(receiptDir, 'receipt.json');
  if (!fs.existsSync(receiptPath)) return {
    localReceiptPresent: false, aiGenerateAdmission: 'UNVERIFIED', verdict: config.missingVerdict,
    githubAuthority: verifyRclGithubAuthorityBinding(config, { ...options, contractPath, receiptDir }),
  };
  const contract = readJson(contractPath);
  const report = readJson(receiptPath);
  const canonicalPath = path.join(config.root, contract.canonical.sourcePath);
  const canonical = fs.readFileSync(canonicalPath, 'utf8');
  if (sha256(canonical) !== contract.canonical.sourceSha256) throw new Error(`${config.errorPrefix}_CANONICAL_SOURCE_DRIFT`);
  const canonicalVerification = config.verifyCandidate({ sourcePath: canonicalPath });
  if (canonicalVerification.status !== 'PASS' || canonicalVerification.reportRoot !== contract.canonical.candidateReportRoot) throw new Error(`${config.errorPrefix}_CANONICAL_VERIFICATION_MISMATCH`);
  if (report.contractRoot !== evidenceRoot(contract)) throw new Error(`${config.errorPrefix}_AI_CONTRACT_ROOT_MISMATCH`);
  if (report.reportRoot !== evidenceRoot({ ...report, generatedAt: undefined, reportRoot: undefined })) throw new Error(`${config.errorPrefix}_AI_REPORT_ROOT_MISMATCH`);
  if (report.requiredTrials !== contract.requiredTrials || report.trials?.length !== contract.requiredTrials) throw new Error(`${config.errorPrefix}_AI_TRIAL_COUNT_MISMATCH`);
  const results = [];
  for (const trialContract of contract.trials) {
    const receipt = report.trials.find((trial) => trial.trialId === trialContract.id);
    if (!receipt) throw new Error(`${config.errorPrefix}_AI_TRIAL_MISSING:${trialContract.id}`);
    if (receipt.receiptRoot !== evidenceRoot({ ...receipt, receiptRoot: undefined })) throw new Error(`${config.errorPrefix}_AI_TRIAL_ROOT_MISMATCH:${trialContract.id}`);
    const mutation = config.mutations[trialContract.id];
    const mutated = replaceRclRepairTextOnce(canonical, mutation.old, mutation.replacement, `${config.errorPrefix}_MUTATION_SITE_INVALID:${trialContract.id}`);
    if (receipt.mutatedSourceSha256 !== sha256(mutated)) throw new Error(`${config.errorPrefix}_MUTATED_HASH_MISMATCH:${trialContract.id}`);
    const candidate = replaceRclRepairTextOnce(mutated, receipt.proposal.old, receipt.proposal.new, `${config.errorPrefix}_SAVED_EDIT_NOT_EXACT:${trialContract.id}`);
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
      || receipt.generator.threadId.length === 0) throw new Error(`${config.errorPrefix}_INDEPENDENCE_INVALID:${trialContract.id}`);
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), `rcl-${trialContract.id.toLowerCase()}-replay-`));
    let verification;
    try {
      const candidatePath = path.join(directory, 'candidate.rcl');
      fs.writeFileSync(candidatePath, candidate, 'utf8');
      verification = config.verifyCandidate({ sourcePath: candidatePath });
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
  const runtime = verifyRootedRclRuntimeEvidence(config, options);
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
  const githubAuthority = verifyRclGithubAuthorityBinding(config, { ...options, contractPath, receiptDir });
  const admitted = localAdmitted && githubAuthority.admitted;
  return {
    localReceiptPresent: true, localAdmitted, successfulTrials, requiredTrials: contract.requiredTrials,
    uniqueGeneratorSessions, runtimeEvidenceAdmitted, runtimeEvidenceBinding: report.runtimeEvidenceBinding,
    eligibleCells: contract.eligibleCells, results, githubAuthority,
    aiGenerateAdmission: admitted ? 'PASS' : 'UNVERIFIED',
    verdict: admitted ? config.admittedVerdict : config.localVerdict,
  };
}
