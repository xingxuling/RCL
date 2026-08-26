#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { evidenceRoot } from '../src/universal-program-stress.mjs';
import { verifyK321K322CompilerAlgorithmCliCandidate } from './verify-k321-k322-compiler-algorithm-cli-candidate.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DEFAULT_CONTRACT_PATH = path.join(ROOT, 'examples', 'universal-stress', 'k321-k322-compiler-algorithm-cli-ai-generation-contract.v0.1.json');
const DEFAULT_OUTPUT_DIR = path.join(ROOT, 'examples', 'universal-stress', 'evidence', 'k321-k322-compiler-algorithm-cli-ai-generate');

export const K321_K322_AI_GENERATION_MUTATIONS = Object.freeze({
  'K321-K322-AI-REPAIR-01': {
    old: 'gcd(b, a % b)',
    replacement: 'gcd(b, b % a)',
    invariant: 'Euclidean GCD must recurse with gcd(b, a % b), including the signed-zero boundary.',
  },
  'K321-K322-AI-REPAIR-02': {
    old: 'fibonacci(n - 1) + fibonacci(n - 2)',
    replacement: 'fibonacci(n - 1) + fibonacci(n - 3)',
    invariant: 'Fibonacci must use F(n-1)+F(n-2) with F(0)=0 and F(1)=1.',
  },
  'K321-K322-AI-REPAIR-03': {
    old: 'n * n + sum_squares(n - 1)',
    replacement: 'n + n + sum_squares(n - 1)',
    invariant: 'sum_squares(n) must accumulate n*n recursively down to zero.',
  },
});

function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function readJson(filePath) { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
function replaceExactlyOnce(source, oldText, newText, code) {
  const index = source.indexOf(oldText);
  if (index < 0 || source.indexOf(oldText, index + oldText.length) >= 0) throw new Error(code);
  return `${source.slice(0, index)}${newText}${source.slice(index + oldText.length)}`;
}
function commandExists(name) {
  return spawnSync(process.platform === 'win32' ? 'where.exe' : 'which', [name], { encoding: 'utf8' }).status === 0;
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
function assertTemporaryDirectory(directory) {
  const resolved = path.resolve(directory);
  const temporaryRoot = path.resolve(os.tmpdir());
  if (resolved === temporaryRoot || !resolved.startsWith(`${temporaryRoot}${path.sep}`)) throw new Error('RCL_K321_K322_UNSAFE_TEMP_DIRECTORY');
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
function buildPrompt(trial, mutation, diagnostic) {
  return [
    'You are the independent generator for a frozen RCL K321/K322 compiler-runtime algorithm CLI AI_GENERATE repair trial.',
    'You are in a fresh isolated workspace. The authoritative repository, canonical source and oracle edit are unavailable.',
    'Inspect candidate.rcl and diagnostics.json. Return the smallest exact-text edit that repairs the declared semantic invariant.',
    `Trial: ${trial.id}`,
    `Semantic invariant: ${mutation.invariant}`,
    'Constraints:',
    '- The workspace is read-only. Return an edit; do not try to modify files.',
    '- Do not access paths outside this workspace and do not use network access.',
    '- Keep the algorithms in RCL; do not delegate to JS, Python, Rust, shell commands or a provider.',
    '- Do not change tests, evidence, thresholds or authority policy.',
    '- You cannot claim PASS; exact replay through native rclc and rclvm decides.',
    '',
    `Observed status: ${diagnostic.status}`,
    `Observed checks: ${JSON.stringify(diagnostic.checks)}`,
    `Observed error code: ${diagnostic.errorCode ?? 'none'}`,
    '',
    'Return exactly one JSON object under the supplied Schema. old must occur exactly once in candidate.rcl.',
  ].join('\n');
}
function validateProposal(proposal, source, trialId) {
  if (!proposal || proposal.file !== 'candidate.rcl' || typeof proposal.old !== 'string'
    || typeof proposal.new !== 'string' || typeof proposal.diagnosis !== 'string') throw new Error(`RCL_K321_K322_GENERATOR_RESPONSE_INVALID:${trialId}`);
  if (proposal.old.length > 1200 || proposal.new.length > 1200 || proposal.diagnosis.length > 2000) throw new Error(`RCL_K321_K322_GENERATOR_RESPONSE_OVERSIZED:${trialId}`);
  const lowered = `${proposal.new}\n${proposal.diagnosis}`.toLowerCase();
  for (const forbidden of ['provider_call(', 'python', 'powershell', 'disable test', 'skip verifier']) {
    if (lowered.includes(forbidden)) throw new Error(`RCL_K321_K322_GENERATOR_RESPONSE_FORBIDDEN:${trialId}:${forbidden}`);
  }
  return replaceExactlyOnce(source, proposal.old, proposal.new, `RCL_K321_K322_GENERATOR_EDIT_NOT_EXACT:${trialId}`);
}

export function runIndependentK321K322AiGeneration(options = {}) {
  const contractPath = path.resolve(options.contractPath ?? DEFAULT_CONTRACT_PATH);
  const outputDir = path.resolve(options.outputDir ?? DEFAULT_OUTPUT_DIR);
  const contract = readJson(contractPath);
  const sourcePath = path.join(ROOT, contract.canonical.sourcePath);
  const canonical = fs.readFileSync(sourcePath, 'utf8');
  if (sha256(canonical) !== contract.canonical.sourceSha256) throw new Error('RCL_K321_K322_CANONICAL_INPUT_DRIFT');
  const canonicalVerification = verifyK321K322CompilerAlgorithmCliCandidate({ sourcePath });
  if (canonicalVerification.status !== 'PASS' || canonicalVerification.reportRoot !== contract.canonical.candidateReportRoot) throw new Error('RCL_K321_K322_CANONICAL_VERIFICATION_DRIFT');
  const runtimeEvidence = readJson(path.join(ROOT, contract.runtimeEvidence.path));
  if (runtimeEvidence.status !== 'PASS' || runtimeEvidence.reportRoot !== contract.runtimeEvidence.reportRoot) throw new Error('RCL_K321_K322_RUNTIME_EVIDENCE_DRIFT');
  if (!commandExists('codex')) throw new Error('RCL_K321_K322_CODEX_CLI_MISSING');
  const versionProbe = spawnSync('codex', ['--version'], { encoding: 'utf8', timeout: 30_000 });
  const cliVersion = String(versionProbe.stdout || versionProbe.stderr).trim();
  if (versionProbe.status !== 0 || !versionAtLeast(cliVersion, contract.generator.minimumCliVersion)) throw new Error(`RCL_K321_K322_CODEX_CLI_VERSION:${cliVersion}`);
  fs.mkdirSync(outputDir, { recursive: true });

  const trials = [];
  for (const trial of contract.trials) {
    const mutation = K321_K322_AI_GENERATION_MUTATIONS[trial.id];
    if (!mutation) throw new Error(`RCL_K321_K322_UNKNOWN_TRIAL:${trial.id}`);
    const mutated = replaceExactlyOnce(canonical, mutation.old, mutation.replacement, `RCL_K321_K322_MUTATION_SITE_INVALID:${trial.id}`);
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), `rcl-${trial.id.toLowerCase()}-`));
    assertTemporaryDirectory(workspace);
    try {
      const candidatePath = path.join(workspace, 'candidate.rcl');
      fs.writeFileSync(candidatePath, mutated, 'utf8');
      const diagnostic = verifyK321K322CompilerAlgorithmCliCandidate({ sourcePath: candidatePath });
      if (diagnostic.status !== 'FAIL') throw new Error(`RCL_K321_K322_MUTATION_NOT_EFFECTIVE:${trial.id}`);
      fs.writeFileSync(path.join(workspace, 'diagnostics.json'), `${JSON.stringify(diagnostic, null, 2)}\n`, 'utf8');
      const prompt = buildPrompt(trial, mutation, diagnostic);
      const schemaPath = path.join(workspace, 'edit-schema.json');
      const lastMessagePath = path.join(workspace, 'last-message.json');
      fs.writeFileSync(schemaPath, `${JSON.stringify(editSchema(), null, 2)}\n`, 'utf8');
      const generated = spawnSync('codex', [
        'exec', '-', '--cd', workspace, '--skip-git-repo-check', '--sandbox', 'read-only', '--ephemeral',
        '--ignore-user-config', '--ignore-rules', '--json', '--color', 'never', '--output-schema', schemaPath,
        '--output-last-message', lastMessagePath,
      ], {
        input: prompt,
        encoding: 'utf8',
        timeout: Number(options.generatorTimeoutMs ?? 600_000),
        maxBuffer: 64 * 1024 * 1024,
        cwd: workspace,
        env: { ...process.env, NO_COLOR: '1' },
      });
      if (generated.error || generated.status !== 0) throw new Error(`RCL_K321_K322_GENERATOR_FAILED:${trial.id}:${generated.error?.message ?? generated.stderr ?? generated.status}`);
      const proposal = readJson(lastMessagePath);
      const candidate = validateProposal(proposal, mutated, trial.id);
      fs.writeFileSync(candidatePath, candidate, 'utf8');
      const verification = verifyK321K322CompilerAlgorithmCliCandidate({ sourcePath: candidatePath });
      const restoredCanonicalBytes = candidate === canonical;
      const successful = verification.status === 'PASS' && restoredCanonicalBytes;
      const events = parseJsonl(generated.stdout);
      const trialOutputDir = path.join(outputDir, trial.id);
      fs.mkdirSync(trialOutputDir, { recursive: true });
      fs.writeFileSync(path.join(trialOutputDir, 'candidate.rcl'), candidate, 'utf8');
      const receipt = {
        format: 'rcl.k321-k322.compiler-algorithm-cli-ai-trial-receipt.v0.1',
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
        diagnostic: {
          status: diagnostic.status,
          reportRoot: diagnostic.reportRoot,
          failedChecks: Object.entries(diagnostic.checks).filter(([, value]) => !value.pass).map(([name]) => name),
          errorCode: diagnostic.errorCode,
        },
        verification: { successful, status: verification.status, reportRoot: verification.reportRoot, checks: verification.checks },
        receiptRoot: null,
      };
      receipt.receiptRoot = evidenceRoot({ ...receipt, receiptRoot: undefined });
      fs.writeFileSync(path.join(trialOutputDir, 'receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
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
    format: 'rcl.k321-k322.compiler-algorithm-cli-ai-generation-receipt.v0.1',
    generatedAt: new Date().toISOString(),
    contractRoot: evidenceRoot(contract),
    requiredTrials: contract.requiredTrials,
    successfulTrials,
    uniqueGeneratorSessions,
    eligibleCells: contract.eligibleCells,
    runtimeEvidenceBinding: { reportRoot: runtimeEvidence.reportRoot, contractRoot: runtimeEvidence.contractRoot },
    trials,
    localVerdict: complete ? 'PASS_INDEPENDENT_GENERATOR_LOCAL_NATIVE_CLI_REPLAY_GITHUB_REQUIRED' : 'FAIL_INDEPENDENT_GENERATOR_TRIALS',
    aiGenerateStatus: complete ? 'CANDIDATE' : 'UNVERIFIED',
    githubReplayRequired: true,
    evidenceBoundary: contract.evidenceBoundary,
    reportRoot: null,
  };
  report.reportRoot = evidenceRoot({ ...report, generatedAt: undefined, reportRoot: undefined });
  fs.writeFileSync(path.join(outputDir, 'receipt.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return report;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const report = runIndependentK321K322AiGeneration();
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
