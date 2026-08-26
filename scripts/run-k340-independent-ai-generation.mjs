#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { evidenceRoot } from '../src/universal-program-stress.mjs';
import { verifyK340CompilerMixedParadigmCandidate } from './verify-k340-compiler-mixed-paradigm-candidate.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DEFAULT_CONTRACT_PATH = path.join(ROOT, 'examples', 'universal-stress', 'k340-compiler-mixed-paradigm-ai-generation-contract.v0.1.json');
const DEFAULT_OUTPUT_DIR = path.join(ROOT, 'examples', 'universal-stress', 'evidence', 'k340-compiler-mixed-paradigm-ai-generate');

export const K340_AI_GENERATION_MUTATIONS = Object.freeze({
  'K340-AI-REPAIR-01': {
    old: 'n * n + sum_squares(n - 1)',
    replacement: 'n + n + sum_squares(n - 1)',
    invariant: 'sum_squares must accumulate n*n recursively so batch size 8 yields digest 204.',
  },
  'K340-AI-REPAIR-02': {
    old: 'compiler.phase == 1 and compiler.digest == 204',
    replacement: 'compiler.phase == 2 and compiler.digest == 204',
    invariant: 'emit_batch must become eligible after analyze_batch commits phase=1 and digest=204.',
  },
  'K340-AI-REPAIR-03': {
    old: 'needs compiler.analyze on source',
    replacement: 'needs compiler.emit on source',
    invariant: 'analyze_batch must require compiler.analyze on source under the builder warrant.',
  },
});

function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function readJson(filePath) { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
function replaceOnce(source, oldText, newText, code) {
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
      type: event.type,
      itemType: event.item?.type ?? null,
      exitCode: event.item?.exit_code ?? null,
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
function promptFor(trial, mutation, diagnostic) {
  return [
    'You are the independent generator for a frozen RCL K340 compiler-runtime mixed-paradigm AI_GENERATE repair trial.',
    'The canonical source and oracle edit are unavailable. Inspect only candidate.rcl and diagnostics.json.',
    `Trial: ${trial.id}`,
    `Semantic invariant: ${mutation.invariant}`,
    'Return the smallest exact-text repair under the supplied JSON Schema.',
    'Keep recursive computation, authority, transactions and phase triggering in RCL.',
    'You may use read-only file-inspection commands inside this isolated workspace to read candidate.rcl and diagnostics.json.',
    'Do not modify files, access outside paths or network, delegate semantics to providers/other languages, change tests or thresholds, or weaken authority.',
    'The workspace is read-only. You propose one edit; native rclc/rclvm replay decides PASS.',
    `Observed status: ${diagnostic.status}`,
    `Observed checks: ${JSON.stringify(diagnostic.checks)}`,
    `Observed error code: ${diagnostic.errorCode ?? 'none'}`,
    'old must occur exactly once in candidate.rcl.',
  ].join('\n');
}
function validateProposal(proposal, source, trialId) {
  if (!proposal || proposal.file !== 'candidate.rcl' || typeof proposal.old !== 'string'
    || typeof proposal.new !== 'string' || typeof proposal.diagnosis !== 'string') throw new Error(`RCL_K340_GENERATOR_RESPONSE_INVALID:${trialId}`);
  const lowered = `${proposal.new}\n${proposal.diagnosis}`.toLowerCase();
  for (const forbidden of ['provider_call(', 'python', 'powershell', 'disable test', 'skip verifier', 'remove authority', 'skip authority']) {
    if (lowered.includes(forbidden)) throw new Error(`RCL_K340_GENERATOR_RESPONSE_FORBIDDEN:${trialId}:${forbidden}`);
  }
  return replaceOnce(source, proposal.old, proposal.new, `RCL_K340_GENERATOR_EDIT_NOT_EXACT:${trialId}`);
}

export function runIndependentK340AiGeneration(options = {}) {
  const contractPath = path.resolve(options.contractPath ?? DEFAULT_CONTRACT_PATH);
  const outputDir = path.resolve(options.outputDir ?? DEFAULT_OUTPUT_DIR);
  const contract = readJson(contractPath);
  if (contract.format !== 'rcl.k340.compiler-mixed-paradigm-ai-generation-contract.v0.1'
    || contract.frozenBeforeTrials !== true) throw new Error('RCL_K340_AI_CONTRACT_INVALID');
  const sourcePath = path.join(ROOT, contract.canonical.sourcePath);
  const canonical = fs.readFileSync(sourcePath, 'utf8');
  if (sha256(canonical) !== contract.canonical.sourceSha256) throw new Error('RCL_K340_CANONICAL_INPUT_DRIFT');
  const canonicalVerification = verifyK340CompilerMixedParadigmCandidate({ sourcePath });
  if (canonicalVerification.status !== 'PASS' || canonicalVerification.reportRoot !== contract.canonical.candidateReportRoot) throw new Error('RCL_K340_CANONICAL_VERIFICATION_DRIFT');
  const runtimeEvidence = readJson(path.join(ROOT, contract.runtimeEvidence.path));
  if (runtimeEvidence.status !== 'PASS' || runtimeEvidence.reportRoot !== contract.runtimeEvidence.reportRoot) throw new Error('RCL_K340_RUNTIME_EVIDENCE_DRIFT');
  const versionProbe = spawnSync('codex', ['--version'], { encoding: 'utf8', timeout: 30_000 });
  const cliVersion = String(versionProbe.stdout || versionProbe.stderr).trim();
  if (versionProbe.status !== 0 || !versionAtLeast(cliVersion, contract.generator.minimumCliVersion)) throw new Error(`RCL_K340_CODEX_CLI_VERSION:${cliVersion}`);
  fs.mkdirSync(outputDir, { recursive: true });

  const trials = [];
  for (const trial of contract.trials) {
    const mutation = K340_AI_GENERATION_MUTATIONS[trial.id];
    if (!mutation) throw new Error(`RCL_K340_UNKNOWN_TRIAL:${trial.id}`);
    const mutated = replaceOnce(canonical, mutation.old, mutation.replacement, `RCL_K340_MUTATION_SITE_INVALID:${trial.id}`);
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), `rcl-${trial.id.toLowerCase()}-`));
    try {
      const candidatePath = path.join(workspace, 'candidate.rcl');
      fs.writeFileSync(candidatePath, mutated, 'utf8');
      const diagnostic = verifyK340CompilerMixedParadigmCandidate({ sourcePath: candidatePath });
      if (diagnostic.status !== 'FAIL') throw new Error(`RCL_K340_MUTATION_NOT_EFFECTIVE:${trial.id}`);
      fs.writeFileSync(path.join(workspace, 'diagnostics.json'), `${JSON.stringify(diagnostic, null, 2)}\n`);
      const prompt = promptFor(trial, mutation, diagnostic);
      const schemaPath = path.join(workspace, 'edit-schema.json');
      const lastMessagePath = path.join(workspace, 'last-message.json');
      fs.writeFileSync(schemaPath, `${JSON.stringify(editSchema(), null, 2)}\n`);
      const generated = spawnSync('codex', [
        'exec', '-', '--cd', workspace, '--skip-git-repo-check', '--sandbox', 'read-only', '--ephemeral',
        '--ignore-user-config', '--ignore-rules', '--json', '--color', 'never', '--output-schema', schemaPath,
        '--output-last-message', lastMessagePath,
      ], {
        input: prompt,
        cwd: workspace,
        encoding: 'utf8',
        timeout: Number(options.generatorTimeoutMs ?? 600_000),
        maxBuffer: 64 * 1024 * 1024,
        env: { ...process.env, NO_COLOR: '1' },
      });
      if (generated.error || generated.status !== 0) throw new Error(`RCL_K340_GENERATOR_FAILED:${trial.id}:${generated.error?.message ?? generated.stderr ?? generated.status}`);
      const proposal = readJson(lastMessagePath);
      let candidate;
      try {
        candidate = validateProposal(proposal, mutated, trial.id);
      } catch (error) {
        throw new Error(`${error.message}:proposal=${JSON.stringify(proposal)}`);
      }
      fs.writeFileSync(candidatePath, candidate, 'utf8');
      const verification = verifyK340CompilerMixedParadigmCandidate({ sourcePath: candidatePath });
      const events = parseJsonl(generated.stdout);
      const restoredCanonicalBytes = candidate === canonical;
      const successful = verification.status === 'PASS' && restoredCanonicalBytes;
      const trialDir = path.join(outputDir, trial.id);
      fs.mkdirSync(trialDir, { recursive: true });
      fs.writeFileSync(path.join(trialDir, 'candidate.rcl'), candidate);
      const receipt = {
        format: 'rcl.k340.compiler-mixed-paradigm-ai-trial-receipt.v0.1',
        trialId: trial.id,
        mutationClass: trial.mutationClass,
        generator: {
          kind: contract.generator.kind,
          cliVersion,
          threadId: events.find((event) => event.type === 'thread.started')?.thread_id ?? null,
          ephemeral: true,
          ignoredUserConfig: true,
          ignoredRules: true,
          sandbox: 'read-only',
          authoritativeRepositoryWritable: false,
        },
        independence: {
          oracleEditVisibleToGenerator: false,
          canonicalFilesVisibleToGenerator: false,
          developmentAgentAuthoredEdit: false,
          generatorReceivedMutatedCandidatesOnly: true,
          evaluatorAppliedExactSchemaEdit: true,
        },
        proposal,
        promptRoot: sha256(prompt),
        mutatedSourceSha256: sha256(mutated),
        candidateSourceSha256: sha256(candidate),
        restoredCanonicalBytes,
        generatorEventLogSha256: sha256(generated.stdout ?? ''),
        generatorEvents: sanitizeEvents(events),
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
    format: 'rcl.k340.compiler-mixed-paradigm-ai-generation-receipt.v0.1',
    generatedAt: new Date().toISOString(),
    contractRoot: evidenceRoot(contract),
    requiredTrials: contract.requiredTrials,
    successfulTrials,
    uniqueGeneratorSessions,
    eligibleCells: contract.eligibleCells,
    runtimeEvidenceBinding: { reportRoot: runtimeEvidence.reportRoot, contractRoot: runtimeEvidence.contractRoot },
    trials,
    localVerdict: complete ? 'PASS_INDEPENDENT_GENERATOR_LOCAL_NATIVE_MIXED_REPLAY_GITHUB_REQUIRED' : 'FAIL_INDEPENDENT_GENERATOR_TRIALS',
    aiGenerateStatus: complete ? 'CANDIDATE' : 'UNVERIFIED',
    githubReplayRequired: true,
    evidenceBoundary: contract.evidenceBoundary,
    reportRoot: null,
  };
  report.reportRoot = evidenceRoot({ ...report, generatedAt: undefined, reportRoot: undefined });
  fs.writeFileSync(path.join(outputDir, 'receipt.json'), `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const report = runIndependentK340AiGeneration();
  console.log(JSON.stringify({
    localVerdict: report.localVerdict,
    aiGenerateStatus: report.aiGenerateStatus,
    successfulTrials: report.successfulTrials,
    uniqueGeneratorSessions: report.uniqueGeneratorSessions,
    runtimeEvidenceBinding: report.runtimeEvidenceBinding,
    reportRoot: report.reportRoot,
  }, null, 2));
  if (report.aiGenerateStatus !== 'CANDIDATE') process.exitCode = 1;
}
