#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { evidenceRoot } from '../src/universal-program-stress.mjs';
import { runPureRclXorCampaign } from './run-k08-pure-rcl-xor.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DEFAULT_CONTRACT_PATH = path.join(ROOT, 'examples', 'native-ai', 'k233-ai-generation-contract.v0.1.json');
const DEFAULT_SOURCE_PATH = path.join(ROOT, 'examples', 'native-ai', 'pure-rcl-xor.rcl');
const DEFAULT_OUTPUT_DIR = path.join(ROOT, 'output', 'k233-independent-ai-generation-v0.1');

export const K233_AI_GENERATION_MUTATIONS = Object.freeze({
  'K233-AI-REPAIR-01': {
    old: '0.5 / ((1 + absolute(value)) * (1 + absolute(value)))',
    replacement: '0.5 / (1 + absolute(value))',
    invariant: 'activate(value) is 0.5 + 0.5*value/(1+abs(value)); the analytic derivative must be correct on both sides of zero.',
  },
  'K233-AI-REPAIR-02': {
    old: '(predict(parameters, sequence_get(sample, 0), sequence_get(sample, 1)) - sequence_get(sample, 2))\n      * activate_derivative(output_pre',
    replacement: '(predict(parameters, sequence_get(sample, 0), sequence_get(sample, 1)) - sequence_get(sample, 1))\n      * activate_derivative(output_pre',
    invariant: 'Each sample is [x1, x2, target]. The output error must bind to the supervised target, not either input coordinate.',
  },
  'K233-AI-REPAIR-03': {
    old: 'output_delta(parameters, sample) * hidden_two(parameters, sequence_get(sample, 0), sequence_get(sample, 1)),',
    replacement: 'output_delta(parameters, sample) * hidden_one(parameters, sequence_get(sample, 0), sequence_get(sample, 1)),',
    invariant: 'Parameter index 7 is the second hidden unit to output weight; its gradient must route through the matching hidden activation.',
  },
});

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function replaceExactlyOnce(source, oldText, newText, errorCode) {
  const first = source.indexOf(oldText);
  if (first < 0 || source.indexOf(oldText, first + oldText.length) >= 0) throw new Error(errorCode);
  return `${source.slice(0, first)}${newText}${source.slice(first + oldText.length)}`;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function commandExists(name) {
  const probe = spawnSync(process.platform === 'win32' ? 'where.exe' : 'which', [name], { encoding: 'utf8' });
  return probe.status === 0;
}

function versionTuple(value) {
  const match = String(value).match(/(\d+)\.(\d+)\.(\d+)/u);
  return match ? match.slice(1).map(Number) : [0, 0, 0];
}

function versionAtLeast(actual, minimum) {
  const left = versionTuple(actual);
  const right = versionTuple(minimum);
  for (let index = 0; index < 3; index += 1) {
    if (left[index] > right[index]) return true;
    if (left[index] < right[index]) return false;
  }
  return true;
}

function parseJsonl(text) {
  return String(text).split(/\r?\n/u).filter(Boolean).flatMap((line) => {
    try { return [JSON.parse(line)]; }
    catch { return []; }
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

function buildPrompt(trial, mutation, diagnostic) {
  return [
    'You are the independent generator for a frozen RCL K233 AI_GENERATE repair trial.',
    'You are in a fresh isolated workspace. The authoritative repository and oracle patch are not available.',
    'Inspect candidate.rcl and diagnostics.json. Propose the smallest exact-text edit that repairs the frozen Pure RCL XOR native-learning contract.',
    `Trial: ${trial.id}`,
    `Intent: ${trial.intent}`,
    `Semantic invariant: ${mutation.invariant}`,
    'Constraints:',
    '- The workspace is intentionally read-only. Do not try to edit files.',
    '- Do not access any path outside this workspace and do not use network access.',
    '- Do not replace RCL training with Python, JavaScript, a provider, a new VM opcode or a hard-coded final answer.',
    '- Do not change thresholds, dataset, tests or the evidence contract.',
    '- Make the smallest general semantic repair supported by the source and diagnostics.',
    '- You do not have permission to claim PASS; a separate deterministic evaluator will decide.',
    '',
    `Observed verdict: ${diagnostic.verdict}`,
    `Observed checks: ${JSON.stringify(diagnostic.checks)}`,
    `Observed evaluation: ${JSON.stringify(diagnostic.evaluation)}`,
    '',
    '- Return one JSON object with exact old text, exact new text, and a concise diagnosis under the supplied output Schema.',
    '- The old text must occur exactly once in candidate.rcl. The evaluator will apply old -> new mechanically and will not repair your response.',
  ].join('\n');
}

function editSchema() {
  return {
    type: 'object',
    properties: {
      old: { type: 'string', minLength: 1, maxLength: 1200 },
      new: { type: 'string', minLength: 1, maxLength: 1200 },
      diagnosis: { type: 'string', minLength: 1, maxLength: 2000 },
    },
    required: ['old', 'new', 'diagnosis'],
    additionalProperties: false,
  };
}

function validateProposal(proposal, mutatedSource, trialId) {
  if (!proposal || typeof proposal.old !== 'string' || typeof proposal.new !== 'string' || typeof proposal.diagnosis !== 'string') {
    throw new Error(`RCL_K233_GENERATOR_RESPONSE_INVALID:${trialId}`);
  }
  if (proposal.old.length > 1200 || proposal.new.length > 1200 || proposal.diagnosis.length > 2000) {
    throw new Error(`RCL_K233_GENERATOR_RESPONSE_OVERSIZED:${trialId}`);
  }
  const lowered = proposal.new.toLowerCase();
  for (const forbidden of ['provider_call(', 'python', 'javascript', 'pytorch', 'tensorflow', 'hard-coded']) {
    if (lowered.includes(forbidden)) throw new Error(`RCL_K233_GENERATOR_RESPONSE_FORBIDDEN:${trialId}:${forbidden}`);
  }
  return replaceExactlyOnce(mutatedSource, proposal.old, proposal.new, `RCL_K233_GENERATOR_EDIT_NOT_EXACT:${trialId}`);
}

function assertTemporaryDirectory(directory) {
  const resolved = path.resolve(directory);
  const tempRoot = path.resolve(os.tmpdir());
  if (resolved === tempRoot || !resolved.startsWith(`${tempRoot}${path.sep}`)) throw new Error('RCL_K233_UNSAFE_TEMP_DIRECTORY');
}

export function runIndependentAiGeneration(options = {}) {
  const contractPath = path.resolve(options.contractPath ?? DEFAULT_CONTRACT_PATH);
  const sourcePath = path.resolve(options.sourcePath ?? DEFAULT_SOURCE_PATH);
  const outputDir = path.resolve(options.outputDir ?? DEFAULT_OUTPUT_DIR);
  const contract = readJson(contractPath);
  const canonicalSource = fs.readFileSync(sourcePath, 'utf8');
  if (sha256(canonicalSource) !== contract.canonicalSourceSha256) throw new Error('RCL_K233_CANONICAL_SOURCE_DRIFT');
  if (!commandExists('codex')) throw new Error('RCL_K233_CODEX_CLI_MISSING');
  const versionProbe = spawnSync('codex', ['--version'], { encoding: 'utf8', timeout: 30_000 });
  const cliVersion = String(versionProbe.stdout || versionProbe.stderr).trim();
  if (versionProbe.status !== 0 || !versionAtLeast(cliVersion, contract.generator.minimumCliVersion)) {
    throw new Error(`RCL_K233_CODEX_CLI_VERSION:${cliVersion}`);
  }
  fs.mkdirSync(outputDir, { recursive: true });

  const trials = [];
  for (const trial of contract.trials) {
    const mutation = K233_AI_GENERATION_MUTATIONS[trial.id];
    if (!mutation) throw new Error(`RCL_K233_UNKNOWN_TRIAL:${trial.id}`);
    const mutatedSource = replaceExactlyOnce(canonicalSource, mutation.old, mutation.replacement, `RCL_K233_MUTATION_SITE_INVALID:${trial.id}`);
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), `rcl-${trial.id.toLowerCase()}-`));
    assertTemporaryDirectory(workspace);
    const candidatePath = path.join(workspace, 'candidate.rcl');
    const diagnosticDir = path.join(workspace, 'diagnostic-evidence');
    const diagnostic = runPureRclXorCampaign({ sourcePath: writeAndReturn(candidatePath, mutatedSource), outputDir: diagnosticDir });
    if (diagnostic.nativeLearningMilestone === 'PASS') throw new Error(`RCL_K233_MUTATION_NOT_EFFECTIVE:${trial.id}`);
    fs.writeFileSync(path.join(workspace, 'diagnostics.json'), `${JSON.stringify({
      trial: trial.id,
      verdict: diagnostic.verdict,
      checks: diagnostic.checks,
      evaluation: diagnostic.evaluation,
      evidenceBoundary: diagnostic.evidenceBoundary,
    }, null, 2)}\n`, 'utf8');
    const prompt = buildPrompt(trial, mutation, diagnostic);
    const eventLogPath = path.join(workspace, 'codex-events.jsonl');
    const lastMessagePath = path.join(workspace, 'last-message.txt');
    const schemaPath = path.join(workspace, 'edit-schema.json');
    fs.writeFileSync(schemaPath, `${JSON.stringify(editSchema(), null, 2)}\n`, 'utf8');
    const generated = spawnSync('codex', [
      'exec', '-',
      '--cd', workspace,
      '--skip-git-repo-check',
      '--sandbox', 'read-only',
      '--ephemeral',
      '--ignore-user-config',
      '--ignore-rules',
      '--json',
      '--color', 'never',
      '--output-schema', schemaPath,
      '--output-last-message', lastMessagePath,
    ], {
      input: prompt,
      encoding: 'utf8',
      timeout: Number(options.generatorTimeoutMs ?? 600_000),
      maxBuffer: 64 * 1024 * 1024,
      cwd: workspace,
      env: { ...process.env, NO_COLOR: '1' },
    });
    fs.writeFileSync(eventLogPath, generated.stdout ?? '', 'utf8');
    if (generated.error || generated.status !== 0) {
      throw new Error(`RCL_K233_GENERATOR_FAILED:${trial.id}:${generated.error?.message ?? generated.stderr ?? generated.status}`);
    }
    const proposal = readJson(lastMessagePath);
    const candidateSource = validateProposal(proposal, mutatedSource, trial.id);
    if (candidateSource === mutatedSource) throw new Error(`RCL_K233_GENERATOR_DID_NOT_REPAIR:${trial.id}`);
    fs.writeFileSync(candidatePath, candidateSource, 'utf8');
    const verificationDir = path.join(workspace, 'verification-evidence');
    const verification = runPureRclXorCampaign({ sourcePath: candidatePath, outputDir: verificationDir });
    const successful = verification.nativeLearningMilestone === 'PASS'
      && Object.entries(verification.gates).filter(([gate]) => gate !== 'AI_GENERATE').every(([, gate]) => gate.status === 'PASS')
      && verification.pureExecutionPath.dependencyAudit.ok === true;
    const events = parseJsonl(generated.stdout);
    const threadId = events.find((event) => event.type === 'thread.started')?.thread_id ?? null;
    const trialOutputDir = path.join(outputDir, trial.id);
    fs.mkdirSync(trialOutputDir, { recursive: true });
    fs.writeFileSync(path.join(trialOutputDir, 'candidate.rcl'), candidateSource, 'utf8');
    const receipt = {
      format: 'rcl.k233.ai-generation-trial-receipt.v0.1',
      trialId: trial.id,
      mutationClass: trial.mutationClass,
      generator: {
        kind: contract.generator.kind,
        cliVersion,
        threadId,
        ephemeral: true,
        ignoredUserConfig: true,
        ignoredRules: true,
        sandbox: 'read-only',
        effectiveFilesystem: 'read-only',
        authoritativeRepositoryWritable: false,
      },
      independence: {
        oraclePatchVisibleToGenerator: false,
        canonicalSourceVisibleToGenerator: false,
        developmentAgentAuthoredEdit: false,
        generatorReceivedMutatedSourceOnly: true,
        evaluatorAppliedExactSchemaEdit: true,
      },
      proposal,
      promptRoot: sha256(prompt),
      mutatedSourceSha256: sha256(mutatedSource),
      candidateSourceSha256: sha256(candidateSource),
      canonicalSourceSha256: sha256(canonicalSource),
      candidateRestoredCanonicalBytes: candidateSource === canonicalSource,
      generatorEventLogSha256: sha256(generated.stdout ?? ''),
      generatorEvents: sanitizeEvents(events),
      finalMessageSha256: fs.existsSync(lastMessagePath) ? sha256(fs.readFileSync(lastMessagePath)) : null,
      verification: {
        successful,
        verdict: verification.verdict,
        reportRoot: verification.reportRoot,
        semanticStateRoots: verification.robustness.semanticStateRoots,
        maximumParameterDrift: verification.evaluation.maximumParameterDrift,
        maximumPredictionDrift: verification.evaluation.maximumPredictionDrift,
      },
      receiptRoot: null,
    };
    receipt.receiptRoot = evidenceRoot({ ...receipt, receiptRoot: undefined });
    fs.writeFileSync(path.join(trialOutputDir, 'receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
    trials.push(receipt);
  }

  const successfulTrials = trials.filter((trial) => trial.verification.successful).length;
  const complete = trials.length === contract.requiredTrials
    && successfulTrials === contract.admission.requiredSuccessfulTrials
    && new Set(trials.map((trial) => trial.generator.threadId)).size === contract.requiredTrials;
  const report = {
    format: 'rcl.k233.ai-generation-receipt.v0.1',
    generatedAt: new Date().toISOString(),
    contractRoot: evidenceRoot(contract),
    contractStatus: contract.status,
    generatorKind: contract.generator.kind,
    requiredTrials: contract.requiredTrials,
    successfulTrials,
    uniqueGeneratorSessions: new Set(trials.map((trial) => trial.generator.threadId)).size,
    trials,
    localVerdict: complete ? 'PASS_INDEPENDENT_GENERATOR_LOCAL_REPLAY_GITHUB_REPLAY_REQUIRED' : 'FAIL_INDEPENDENT_GENERATOR_TRIALS',
    aiGenerateStatus: complete ? 'CANDIDATE' : 'UNVERIFIED',
    githubReplayRequired: true,
    evidenceBoundary: contract.evidenceBoundary,
    reportRoot: null,
  };
  report.reportRoot = evidenceRoot({ ...report, generatedAt: undefined, reportRoot: undefined });
  fs.writeFileSync(path.join(outputDir, 'receipt.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return report;
}

function writeAndReturn(filePath, content) {
  fs.writeFileSync(filePath, content, 'utf8');
  return filePath;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const outputDir = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_OUTPUT_DIR;
  const report = runIndependentAiGeneration({ outputDir });
  console.log(JSON.stringify({
    localVerdict: report.localVerdict,
    aiGenerateStatus: report.aiGenerateStatus,
    successfulTrials: report.successfulTrials,
    uniqueGeneratorSessions: report.uniqueGeneratorSessions,
    reportRoot: report.reportRoot,
    outputDir,
  }, null, 2));
  if (report.aiGenerateStatus !== 'CANDIDATE') process.exitCode = 1;
}
