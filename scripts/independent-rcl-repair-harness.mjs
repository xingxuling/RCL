import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { evidenceRoot } from '../src/universal-program-stress.mjs';

function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function readJson(filePath) { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
export function replaceRclRepairTextOnce(source, oldText, newText, code) {
  const index = source.indexOf(oldText);
  if (index < 0 || source.indexOf(oldText, index + oldText.length) >= 0) throw new Error(code);
  return `${source.slice(0, index)}${newText}${source.slice(index + oldText.length)}`;
}
function parseJsonl(value) {
  return String(value).split(/\r?\n/u).filter(Boolean).flatMap((line) => {
    try { return [JSON.parse(line)]; } catch { return []; }
  });
}
function sanitizeEvents(events) {
  return events.map((event) => {
    if (event.type === 'thread.started') return { type: event.type, threadId: event.thread_id ?? null };
    if (event.type === 'turn.completed') return { type: event.type, usage: event.usage ?? null };
    if (event.type === 'turn.failed') return { type: event.type, error: event.error?.message ?? String(event.error ?? '') };
    if (event.type === 'item.completed') return {
      type: event.type, itemType: event.item?.type ?? null, exitCode: event.item?.exit_code ?? null,
      textRoot: typeof event.item?.text === 'string' ? sha256(event.item.text) : null,
    };
    return { type: event.type ?? 'unknown' };
  });
}
function versionTuple(value) {
  const match = String(value).match(/(\d+)\.(\d+)\.(\d+)/u);
  return match ? match.slice(1).map(Number) : [0, 0, 0];
}
function versionAtLeast(actual, minimum) {
  const left = versionTuple(actual);
  const right = versionTuple(minimum);
  for (let index = 0; index < 3; index += 1) if (left[index] !== right[index]) return left[index] > right[index];
  return true;
}
function editSchema() {
  return {
    type: 'object',
    properties: {
      file: { type: 'string', enum: ['candidate.rcl'] },
      old: { type: 'string', minLength: 1, maxLength: 1200 },
      new: { type: 'string', minLength: 1, maxLength: 1200 },
      diagnosis: { type: 'string', minLength: 1, maxLength: 2000 },
    },
    required: ['file', 'old', 'new', 'diagnosis'],
    additionalProperties: false,
  };
}
function validateProposal(proposal, source, trialId, errorPrefix, forbidden) {
  if (!proposal || proposal.file !== 'candidate.rcl' || typeof proposal.old !== 'string'
    || typeof proposal.new !== 'string' || typeof proposal.diagnosis !== 'string') throw new Error(`${errorPrefix}_GENERATOR_RESPONSE_INVALID:${trialId}`);
  if (/\r|\n/u.test(proposal.old) || /\r|\n/u.test(proposal.new)) throw new Error(`${errorPrefix}_GENERATOR_EDIT_NOT_SINGLE_LINE:${trialId}`);
  const lowered = `${proposal.new}\n${proposal.diagnosis}`.toLowerCase();
  for (const token of forbidden) if (lowered.includes(token)) throw new Error(`${errorPrefix}_GENERATOR_RESPONSE_FORBIDDEN:${trialId}:${token}`);
  return replaceRclRepairTextOnce(source, proposal.old, proposal.new, `${errorPrefix}_GENERATOR_EDIT_NOT_EXACT:${trialId}`);
}

export function runIndependentRclRepairCampaign(config, options = {}) {
  const contractPath = path.resolve(options.contractPath ?? config.contractPath);
  const outputDir = path.resolve(options.outputDir ?? config.outputDir);
  const contract = readJson(contractPath);
  if (contract.format !== config.contractFormat || contract.frozenBeforeTrials !== true) throw new Error(`${config.errorPrefix}_AI_CONTRACT_INVALID`);
  const sourcePath = path.join(config.root, contract.canonical.sourcePath);
  const canonical = fs.readFileSync(sourcePath, 'utf8');
  if (sha256(canonical) !== contract.canonical.sourceSha256) throw new Error(`${config.errorPrefix}_CANONICAL_INPUT_DRIFT`);
  const canonicalVerification = config.verifyCandidate({ sourcePath });
  if (canonicalVerification.status !== 'PASS' || canonicalVerification.reportRoot !== contract.canonical.candidateReportRoot) throw new Error(`${config.errorPrefix}_CANONICAL_VERIFICATION_DRIFT`);
  const runtimeEvidence = readJson(path.join(config.root, contract.runtimeEvidence.path));
  if (runtimeEvidence.status !== 'PASS' || runtimeEvidence.reportRoot !== contract.runtimeEvidence.reportRoot) throw new Error(`${config.errorPrefix}_RUNTIME_EVIDENCE_DRIFT`);
  const versionProbe = spawnSync('codex', ['--version'], { encoding: 'utf8', timeout: 30_000 });
  const cliVersion = String(versionProbe.stdout || versionProbe.stderr).trim();
  if (versionProbe.status !== 0 || !versionAtLeast(cliVersion, contract.generator.minimumCliVersion)) throw new Error(`${config.errorPrefix}_CODEX_CLI_VERSION:${cliVersion}`);
  fs.mkdirSync(outputDir, { recursive: true });

  const trials = [];
  for (const trial of contract.trials) {
    const mutation = config.mutations[trial.id];
    if (!mutation) throw new Error(`${config.errorPrefix}_UNKNOWN_TRIAL:${trial.id}`);
    const mutated = replaceRclRepairTextOnce(canonical, mutation.old, mutation.replacement, `${config.errorPrefix}_MUTATION_SITE_INVALID:${trial.id}`);
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), `rcl-${trial.id.toLowerCase()}-`));
    try {
      const candidatePath = path.join(workspace, 'candidate.rcl');
      fs.writeFileSync(candidatePath, mutated, 'utf8');
      const diagnostic = config.verifyCandidate({ sourcePath: candidatePath });
      if (diagnostic.status !== 'FAIL') throw new Error(`${config.errorPrefix}_MUTATION_NOT_EFFECTIVE:${trial.id}`);
      fs.writeFileSync(path.join(workspace, 'diagnostics.json'), `${JSON.stringify(diagnostic, null, 2)}\n`);
      const prompt = [
        `You are the independent generator for a frozen RCL ${config.campaignLabel} AI_GENERATE repair trial.`,
        'The canonical source and oracle edit are unavailable. Inspect only candidate.rcl and diagnostics.json.',
        `Trial: ${trial.id}`,
        `Semantic invariant: ${mutation.invariant}`,
        'Return the smallest exact-text repair under the supplied JSON Schema.',
        'old and new must each be one single-line fragment; do not alter unrelated literals or lines.',
        'A successful receipt requires restoring the hidden canonical source byte-for-byte, not merely making diagnostics pass.',
        config.semanticOwnershipPrompt,
        'You may use read-only file-inspection commands inside this isolated workspace to read candidate.rcl and diagnostics.json.',
        'Do not modify files, access outside paths or network, delegate semantics, change tests/thresholds, or weaken evidence.',
        'The workspace is read-only. You propose one edit; native rclc/rclvm replay decides PASS.',
        `Observed status: ${diagnostic.status}`,
        `Observed checks: ${JSON.stringify(diagnostic.checks)}`,
        `Observed error code: ${diagnostic.errorCode ?? 'none'}`,
        'old must occur exactly once in candidate.rcl.',
      ].join('\n');
      const schemaPath = path.join(workspace, 'edit-schema.json');
      const lastMessagePath = path.join(workspace, 'last-message.json');
      fs.writeFileSync(schemaPath, `${JSON.stringify(editSchema(), null, 2)}\n`);
      const generated = spawnSync('codex', [
        'exec', '-', '--cd', workspace, '--skip-git-repo-check', '--sandbox', 'read-only', '--ephemeral',
        '--ignore-user-config', '--ignore-rules', '--json', '--color', 'never', '--output-schema', schemaPath,
        '--output-last-message', lastMessagePath,
      ], {
        input: prompt, cwd: workspace, encoding: 'utf8', timeout: Number(options.generatorTimeoutMs ?? 600_000),
        maxBuffer: 64 * 1024 * 1024, env: { ...process.env, NO_COLOR: '1' },
      });
      if (generated.error || generated.status !== 0) throw new Error(`${config.errorPrefix}_GENERATOR_FAILED:${trial.id}:${generated.error?.message ?? generated.stderr ?? generated.status}`);
      const proposal = readJson(lastMessagePath);
      const candidate = validateProposal(proposal, mutated, trial.id, config.errorPrefix, config.forbiddenTokens);
      fs.writeFileSync(candidatePath, candidate, 'utf8');
      const verification = config.verifyCandidate({ sourcePath: candidatePath });
      const events = parseJsonl(generated.stdout);
      const restoredCanonicalBytes = candidate === canonical;
      const successful = verification.status === 'PASS' && restoredCanonicalBytes;
      const trialDir = path.join(outputDir, trial.id);
      fs.mkdirSync(trialDir, { recursive: true });
      fs.writeFileSync(path.join(trialDir, 'candidate.rcl'), candidate);
      const receipt = {
        format: config.trialReceiptFormat,
        trialId: trial.id, mutationClass: trial.mutationClass,
        generator: {
          kind: contract.generator.kind, cliVersion,
          threadId: events.find((event) => event.type === 'thread.started')?.thread_id ?? null,
          ephemeral: true, ignoredUserConfig: true, ignoredRules: true, sandbox: 'read-only', authoritativeRepositoryWritable: false,
        },
        independence: {
          oracleEditVisibleToGenerator: false, canonicalFilesVisibleToGenerator: false,
          developmentAgentAuthoredEdit: false, generatorReceivedMutatedCandidatesOnly: true, evaluatorAppliedExactSchemaEdit: true,
        },
        proposal, promptRoot: sha256(prompt), mutatedSourceSha256: sha256(mutated), candidateSourceSha256: sha256(candidate),
        restoredCanonicalBytes, generatorEventLogSha256: sha256(generated.stdout ?? ''), generatorEvents: sanitizeEvents(events),
        finalMessageSha256: sha256(fs.readFileSync(lastMessagePath)),
        diagnostic: { status: diagnostic.status, reportRoot: diagnostic.reportRoot, errorCode: diagnostic.errorCode },
        verification: { successful, status: verification.status, reportRoot: verification.reportRoot, checks: verification.checks },
        receiptRoot: null,
      };
      receipt.receiptRoot = evidenceRoot({ ...receipt, receiptRoot: undefined });
      fs.writeFileSync(path.join(trialDir, 'receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`);
      trials.push(receipt);
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  }

  const successfulTrials = trials.filter((trial) => trial.verification.successful).length;
  const uniqueGeneratorSessions = new Set(trials.map((trial) => trial.generator.threadId)).size;
  const complete = trials.length === contract.requiredTrials
    && successfulTrials === contract.admission.requiredSuccessfulTrials
    && uniqueGeneratorSessions === contract.admission.requiredUniqueGeneratorSessions;
  const report = {
    format: config.reportFormat, generatedAt: new Date().toISOString(), contractRoot: evidenceRoot(contract),
    requiredTrials: contract.requiredTrials, successfulTrials, uniqueGeneratorSessions, eligibleCells: contract.eligibleCells,
    runtimeEvidenceBinding: { reportRoot: runtimeEvidence.reportRoot, contractRoot: runtimeEvidence.contractRoot }, trials,
    localVerdict: complete ? config.localPassVerdict : 'FAIL_INDEPENDENT_GENERATOR_TRIALS',
    aiGenerateStatus: complete ? 'CANDIDATE' : 'UNVERIFIED', githubReplayRequired: true,
    evidenceBoundary: contract.evidenceBoundary, reportRoot: null,
  };
  report.reportRoot = evidenceRoot({ ...report, generatedAt: undefined, reportRoot: undefined });
  fs.writeFileSync(path.join(outputDir, 'receipt.json'), `${JSON.stringify(report, null, 2)}\n`);
  return report;
}
