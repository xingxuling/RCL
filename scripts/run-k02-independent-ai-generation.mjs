#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { evidenceRoot } from '../src/universal-program-stress.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DEFAULT_CONTRACT_PATH = path.join(ROOT, 'examples', 'universal-stress', 'k02-ai-generation-contract.v0.1.json');
const DEFAULT_OUTPUT_DIR = path.join(ROOT, 'output', 'k02-independent-ai-generation-v0.1');
const VERIFIER_PATH = path.join(ROOT, 'scripts', 'verify-k02-web-candidate.mjs');

export const K02_AI_GENERATION_MUTATIONS = Object.freeze({
  'K02-AI-REPAIR-01': {
    file: 'candidate.rcl',
    old: 'alter app.todo_count <- app.todo_count + 1',
    replacement: 'alter app.todo_count <- app.todo_count + 2',
    invariant: 'One accepted addTodo transaction increments app.todo_count exactly once.',
  },
  'K02-AI-REPAIR-02': {
    file: 'candidate.rcl',
    old: 'when app.todo_input != ""\n    needs app.write on app\n    alter app.todo_count',
    replacement: 'when app.todo_input != ""\n    needs app.read on app\n    alter app.todo_count',
    invariant: 'addTodo must require the declared app.write capability; authority checks cannot be removed or weakened.',
  },
  'K02-AI-REPAIR-03': {
    file: 'candidate.web.json',
    old: '"valueState": "app.todo_input", "observeState": "app.todo_input"',
    replacement: '"valueState": "app.todo_input", "observeState": "app.last_action"',
    invariant: 'The Todo input must display and observe app.todo_input so view and reactive state remain one binding.',
  },
});

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
    if (left[index] !== right[index]) return left[index] > right[index];
  }
  return true;
}

function parseJsonl(text) {
  return String(text).split(/\r?\n/u).filter(Boolean).flatMap((line) => {
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
  const tempRoot = path.resolve(os.tmpdir());
  if (resolved === tempRoot || !resolved.startsWith(`${tempRoot}${path.sep}`)) {
    throw new Error('RCL_K02_UNSAFE_TEMP_DIRECTORY');
  }
}

function editSchema() {
  return {
    type: 'object',
    properties: {
      file: { type: 'string', enum: ['candidate.rcl', 'candidate.web.json'] },
      old: { type: 'string', minLength: 1, maxLength: 1600 },
      new: { type: 'string', minLength: 1, maxLength: 1600 },
      diagnosis: { type: 'string', minLength: 1, maxLength: 2000 },
    },
    required: ['file', 'old', 'new', 'diagnosis'],
    additionalProperties: false,
  };
}

function buildPrompt(trial, mutation, diagnostic) {
  return [
    'You are the independent generator for a frozen RCL K02 Web/GUI/reactive AI_GENERATE repair trial.',
    'You are in a fresh isolated workspace. The authoritative repository, canonical files and oracle edit are unavailable.',
    'Inspect candidate.rcl, candidate.web.json and diagnostics.json. Return the smallest exact-text edit that repairs the declared invariant.',
    `Trial: ${trial.id}`,
    `Intent: ${trial.intent}`,
    `Semantic invariant: ${mutation.invariant}`,
    'Constraints:',
    '- The workspace is read-only. Return an edit; do not try to modify files.',
    '- Do not access any path outside this workspace and do not use network access.',
    '- Do not replace RCL/Web compilation or runtime with Python, JavaScript, a provider or hard-coded results.',
    '- Do not remove authority checks, change acceptance thresholds, or propose changes to tests/evidence.',
    '- You cannot claim PASS; the deterministic compiler/Web/loopback evaluator decides.',
    '',
    `Observed status: ${diagnostic.status}`,
    `Observed checks: ${JSON.stringify(diagnostic.checks)}`,
    `Observed error: ${diagnostic.error ?? 'none'}`,
    '',
    'Return exactly one JSON object under the supplied Schema. old must occur exactly once in the named candidate file.',
  ].join('\n');
}

function runVerification(sourcePath, specPath) {
  const run = spawnSync(process.execPath, [VERIFIER_PATH, sourcePath, specPath], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 60_000,
    maxBuffer: 32 * 1024 * 1024,
  });
  if (run.error) throw new Error(`RCL_K02_VERIFIER_SPAWN:${run.error.message}`);
  const lines = String(run.stdout).trim().split(/\r?\n/u).filter(Boolean);
  if (lines.length === 0) throw new Error(`RCL_K02_VERIFIER_EMPTY:${run.stderr}`);
  return JSON.parse(lines.at(-1));
}

function validateProposal(proposal, files, trialId) {
  if (!proposal || !['candidate.rcl', 'candidate.web.json'].includes(proposal.file)
    || typeof proposal.old !== 'string' || typeof proposal.new !== 'string'
    || typeof proposal.diagnosis !== 'string') {
    throw new Error(`RCL_K02_GENERATOR_RESPONSE_INVALID:${trialId}`);
  }
  if (proposal.old.length > 1600 || proposal.new.length > 1600 || proposal.diagnosis.length > 2000) {
    throw new Error(`RCL_K02_GENERATOR_RESPONSE_OVERSIZED:${trialId}`);
  }
  const lowered = `${proposal.new}\n${proposal.diagnosis}`.toLowerCase();
  for (const forbidden of ['provider_call(', 'pytorch', 'tensorflow', 'skip authority', 'remove authority', 'hard-coded result']) {
    if (lowered.includes(forbidden)) throw new Error(`RCL_K02_GENERATOR_RESPONSE_FORBIDDEN:${trialId}:${forbidden}`);
  }
  return {
    ...files,
    [proposal.file]: replaceExactlyOnce(
      files[proposal.file],
      proposal.old,
      proposal.new,
      `RCL_K02_GENERATOR_EDIT_NOT_EXACT:${trialId}`,
    ),
  };
}

export function runIndependentK02AiGeneration(options = {}) {
  const contractPath = path.resolve(options.contractPath ?? DEFAULT_CONTRACT_PATH);
  const outputDir = path.resolve(options.outputDir ?? DEFAULT_OUTPUT_DIR);
  const contract = readJson(contractPath);
  const canonicalSourcePath = path.join(ROOT, contract.canonical.sourcePath);
  const canonicalSpecPath = path.join(ROOT, contract.canonical.specPath);
  const canonical = {
    'candidate.rcl': fs.readFileSync(canonicalSourcePath, 'utf8'),
    'candidate.web.json': fs.readFileSync(canonicalSpecPath, 'utf8'),
  };
  if (sha256(canonical['candidate.rcl']) !== contract.canonical.sourceSha256
    || sha256(canonical['candidate.web.json']) !== contract.canonical.specSha256) {
    throw new Error('RCL_K02_CANONICAL_INPUT_DRIFT');
  }
  if (!commandExists('codex')) throw new Error('RCL_K02_CODEX_CLI_MISSING');
  const versionProbe = spawnSync('codex', ['--version'], { encoding: 'utf8', timeout: 30_000 });
  const cliVersion = String(versionProbe.stdout || versionProbe.stderr).trim();
  if (versionProbe.status !== 0 || !versionAtLeast(cliVersion, contract.generator.minimumCliVersion)) {
    throw new Error(`RCL_K02_CODEX_CLI_VERSION:${cliVersion}`);
  }
  fs.mkdirSync(outputDir, { recursive: true });

  const trials = [];
  for (const trial of contract.trials) {
    const mutation = K02_AI_GENERATION_MUTATIONS[trial.id];
    if (!mutation) throw new Error(`RCL_K02_UNKNOWN_TRIAL:${trial.id}`);
    const mutated = {
      ...canonical,
      [mutation.file]: replaceExactlyOnce(
        canonical[mutation.file],
        mutation.old,
        mutation.replacement,
        `RCL_K02_MUTATION_SITE_INVALID:${trial.id}`,
      ),
    };
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), `rcl-${trial.id.toLowerCase()}-`));
    assertTemporaryDirectory(workspace);
    const sourcePath = path.join(workspace, 'candidate.rcl');
    const specPath = path.join(workspace, 'candidate.web.json');
    fs.writeFileSync(sourcePath, mutated['candidate.rcl'], 'utf8');
    fs.writeFileSync(specPath, mutated['candidate.web.json'], 'utf8');
    const diagnostic = runVerification(sourcePath, specPath);
    if (diagnostic.status !== 'FAIL') throw new Error(`RCL_K02_MUTATION_NOT_EFFECTIVE:${trial.id}`);
    fs.writeFileSync(path.join(workspace, 'diagnostics.json'), `${JSON.stringify(diagnostic, null, 2)}\n`, 'utf8');
    const prompt = buildPrompt(trial, mutation, diagnostic);
    const schemaPath = path.join(workspace, 'edit-schema.json');
    const lastMessagePath = path.join(workspace, 'last-message.json');
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
    if (generated.error || generated.status !== 0) {
      throw new Error(`RCL_K02_GENERATOR_FAILED:${trial.id}:${generated.error?.message ?? generated.stderr ?? generated.status}`);
    }
    const proposal = readJson(lastMessagePath);
    const candidate = validateProposal(proposal, mutated, trial.id);
    fs.writeFileSync(sourcePath, candidate['candidate.rcl'], 'utf8');
    fs.writeFileSync(specPath, candidate['candidate.web.json'], 'utf8');
    const verification = runVerification(sourcePath, specPath);
    const restoredCanonicalBytes = candidate['candidate.rcl'] === canonical['candidate.rcl']
      && candidate['candidate.web.json'] === canonical['candidate.web.json'];
    const successful = verification.status === 'PASS' && restoredCanonicalBytes;
    const events = parseJsonl(generated.stdout);
    const threadId = events.find((event) => event.type === 'thread.started')?.thread_id ?? null;
    const trialOutputDir = path.join(outputDir, trial.id);
    fs.mkdirSync(trialOutputDir, { recursive: true });
    fs.writeFileSync(path.join(trialOutputDir, 'candidate.rcl'), candidate['candidate.rcl'], 'utf8');
    fs.writeFileSync(path.join(trialOutputDir, 'candidate.web.json'), candidate['candidate.web.json'], 'utf8');
    const receipt = {
      format: 'rcl.k02.ai-generation-trial-receipt.v0.1',
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
      mutatedFile: mutation.file,
      mutatedSourceSha256: sha256(mutated['candidate.rcl']),
      mutatedSpecSha256: sha256(mutated['candidate.web.json']),
      candidateSourceSha256: sha256(candidate['candidate.rcl']),
      candidateSpecSha256: sha256(candidate['candidate.web.json']),
      restoredCanonicalBytes,
      generatorEventLogSha256: sha256(generated.stdout ?? ''),
      generatorEvents: sanitizeEvents(events),
      finalMessageSha256: sha256(fs.readFileSync(lastMessagePath)),
      diagnostic: {
        status: diagnostic.status,
        reportRoot: diagnostic.reportRoot,
        failedChecks: Object.entries(diagnostic.checks).filter(([, value]) => !value.pass).map(([name]) => name),
        error: diagnostic.error,
      },
      verification: {
        successful,
        status: verification.status,
        reportRoot: verification.reportRoot,
        manifestRoot: verification.manifestRoot,
        checks: verification.checks,
      },
      receiptRoot: null,
    };
    receipt.receiptRoot = evidenceRoot({ ...receipt, receiptRoot: undefined });
    fs.writeFileSync(path.join(trialOutputDir, 'receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
    trials.push(receipt);
    fs.rmSync(workspace, { recursive: true, force: true });
  }

  const successfulTrials = trials.filter((trial) => trial.verification.successful).length;
  const uniqueGeneratorSessions = new Set(trials.map((trial) => trial.generator.threadId)).size;
  const complete = trials.length === contract.requiredTrials
    && successfulTrials === contract.admission.requiredSuccessfulTrials
    && uniqueGeneratorSessions === contract.admission.requiredUniqueGeneratorSessions;
  const report = {
    format: 'rcl.k02.ai-generation-receipt.v0.1',
    generatedAt: new Date().toISOString(),
    contractRoot: evidenceRoot(contract),
    contractStatus: contract.status,
    generatorKind: contract.generator.kind,
    requiredTrials: contract.requiredTrials,
    successfulTrials,
    uniqueGeneratorSessions,
    eligibleCells: contract.admission.eligibleCells,
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

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const outputDir = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_OUTPUT_DIR;
  const report = runIndependentK02AiGeneration({ outputDir });
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
