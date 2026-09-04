#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { compileRealityToBytecode } from '../src/bytecode.mjs';
import { LogicalTimeScheduler, LogicalTimeSchedulerError } from '../src/logical-time-scheduler.mjs';
import { verifyNativeSemanticStateRoot } from '../src/native-vm.mjs';
import { evidenceRoot } from '../src/universal-program-stress.mjs';
import { readCanonicalCompilerArtifact } from '../src/canonical-source-archive.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DEFAULT_CONTRACT_PATH = path.join(ROOT, 'examples', 'universal-stress', 'k331-compiler-realtime-runtime-contract.v0.1.json');
const DEFAULT_OUTPUT_PATH = path.join(ROOT, 'examples', 'universal-stress', 'evidence', 'k331-compiler-realtime-runtime-v0.1.json');

function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function percentile95(values) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)];
}
function run(command, args, options = {}) {
  const started = performance.now();
  const result = spawnSync(command, args, {
    cwd: ROOT, encoding: 'utf8', timeout: options.timeout ?? 90_000, maxBuffer: 32 * 1024 * 1024,
  });
  return { ...result, elapsedMs: performance.now() - started };
}
function parseJson(text, code) {
  try { return JSON.parse(text); } catch { throw new Error(`${code}:${String(text).slice(0, 500)}`); }
}
function replaceExactlyOnce(source, oldText, newText, code) {
  const index = source.indexOf(oldText);
  if (index < 0 || source.indexOf(oldText, index + oldText.length) >= 0) throw new Error(code);
  return `${source.slice(0, index)}${newText}${source.slice(index + oldText.length)}`;
}
function project(state) {
  return {
    sortedIds: state?.['schedule.sorted']?.map((event) => event[0]),
    success: state?.['result.success'], budgetRejected: state?.['result.budget_rejected'],
    backwardRejected: state?.['result.backward_rejected'], invalidRejected: state?.['result.invalid_rejected'],
    externalUnapproved: state?.['result.external_unapproved'], externalApproved: state?.['result.external_approved'],
    projection: [state?.['projection.normal'], state?.['projection.accelerated']],
  };
}
function scheduledIds(result) {
  return result.events.filter((event) => event.type === 'scheduled-event-fired').map((event) => Number(event.scheduleId));
}
function independentOracle() {
  const scheduler = new LogicalTimeScheduler({ replicaId: 'k331-runtime-oracle' });
  for (const [id, at, priority] of [[30, 4, 0], [20, 2, 1], [10, 2, 0], [15, 2, 0], [40, 6, 0]]) {
    scheduler.scheduleAt({ id: String(id), at, priority, kind: 'compiler-event' });
  }
  const success = scheduler.advanceTo(4, { maxEvents: 4 });
  const budget = new LogicalTimeScheduler({ replicaId: 'k331-runtime-budget' });
  for (const [id, at, priority] of [[30, 4, 0], [20, 2, 1], [10, 2, 0], [15, 2, 0], [40, 6, 0]]) {
    budget.scheduleAt({ id: String(id), at, priority, kind: 'compiler-event' });
  }
  const budgetRoot = budget.snapshot().root;
  let budgetAtomic = false;
  try { budget.advanceTo(4, { maxEvents: 3 }); } catch (error) {
    budgetAtomic = error instanceof LogicalTimeSchedulerError
      && error.code === 'RCL_LOGICAL_TIME_MAX_EVENTS_EXCEEDED' && budget.snapshot().root === budgetRoot;
  }
  return {
    sortedIds: [10, 15, 20, 30, 40],
    success: [1, success.currentTime, scheduledIds(success)],
    budgetRejected: [-2, 0, []], backwardRejected: [-1, 4, []], invalidRejected: [-5, 0, []],
    externalUnapproved: [-3, 4, []], externalApproved: [1, 8, []], projection: [8, 2], budgetAtomic,
  };
}

export function runK331CompilerRealtimeEvidence(options = {}) {
  const contractPath = path.resolve(options.contractPath ?? DEFAULT_CONTRACT_PATH);
  const outputPath = path.resolve(options.outputPath ?? DEFAULT_OUTPUT_PATH);
  const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
  if (contract.format !== 'rcl.k331.compiler-realtime-runtime-contract.v0.1'
    || contract.frozenBeforeAcquisition !== true) throw new Error('RCL_K331_RUNTIME_CONTRACT_INVALID');
  const sourcePath = path.join(ROOT, contract.canonical.sourcePath);
  const compilerRbcPath = readCanonicalCompilerArtifact(contract).path;
  const rclcPath = path.join(ROOT, 'native', process.platform === 'win32' ? 'rclc.exe' : 'rclc');
  const rclvmPath = path.join(ROOT, 'native', process.platform === 'win32' ? 'rclvm.exe' : 'rclvm');
  for (const requiredPath of [sourcePath, compilerRbcPath, rclcPath, rclvmPath]) {
    if (!fs.existsSync(requiredPath)) throw new Error(`RCL_K331_REQUIRED_ARTIFACT_MISSING:${requiredPath}`);
  }
  const source = fs.readFileSync(sourcePath, 'utf8');
  if (sha256(source) !== contract.canonical.sourceSha256) throw new Error('RCL_K331_CANONICAL_SOURCE_DRIFT');
  if (sha256(fs.readFileSync(compilerRbcPath)) !== contract.canonical.compilerRbcSha256) throw new Error('RCL_K331_COMPILER_RBC_DRIFT');
  const oracle = independentOracle();
  const oracleProjection = { ...oracle };
  delete oracleProjection.budgetAtomic;
  if (!oracle.budgetAtomic || JSON.stringify(contract.expectedProjection) !== JSON.stringify(oracleProjection)) {
    throw new Error('RCL_K331_CONTRACT_ORACLE_DRIFT');
  }

  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-k331-runtime-'));
  const compileDurations = [];
  const executeDurations = [];
  const rounds = [];
  const negativeControls = {};
  try {
    const bootstrapBytecode = Buffer.from(compileRealityToBytecode(source));
    if (sha256(bootstrapBytecode) !== contract.canonical.bootstrapArtifactSha256) throw new Error('RCL_K331_BOOTSTRAP_ARTIFACT_DRIFT');
    for (let index = 0; index < contract.required.rounds; index += 1) {
      const rbcPath = path.join(directory, `round-${index}.rbc`);
      const compilation = run(rclcPath, [compilerRbcPath, sourcePath, rbcPath]);
      if (compilation.error || compilation.status !== 0) throw new Error(`RCL_K331_NATIVE_COMPILE_FAILED:${index}:${compilation.stderr}`);
      const nativeBytecode = fs.readFileSync(rbcPath);
      if (contract.required.bootstrapByteParity && !nativeBytecode.equals(bootstrapBytecode)) throw new Error(`RCL_K331_BOOTSTRAP_PARITY_FAILED:${index}`);
      const execution = run(rclvmPath, [rbcPath]);
      if (execution.error || execution.status !== 0) throw new Error(`RCL_K331_NATIVE_EXECUTE_FAILED:${index}:${execution.stderr}`);
      const payload = verifyNativeSemanticStateRoot(parseJson(execution.stdout, 'RCL_K331_NATIVE_JSON_INVALID'), {
        requireNativeRoot: contract.required.nativeSemanticStateRoot,
      });
      const observed = project(payload.state);
      if (JSON.stringify(observed) !== JSON.stringify(contract.expectedProjection)) throw new Error(`RCL_K331_EXPECTED_STATE_MISMATCH:${index}`);
      compileDurations.push(compilation.elapsedMs);
      executeDurations.push(execution.elapsedMs);
      rounds.push({
        index, compileMs: compilation.elapsedMs, executeMs: execution.elapsedMs,
        combinedMs: compilation.elapsedMs + execution.elapsedMs,
        artifactSha256: sha256(nativeBytecode), stateRoot: payload.semanticStateRoot,
        instructionCount: payload.metrics?.instructions ?? null,
      });
    }
    const controls = [
      ['priorityOrderMutationRejected', 'event_priority(left) < event_priority(right)', 'event_priority(left) > event_priority(right)'],
      ['monotonicityMutationRejected', 'choose(target < current,', 'choose(target > current,'],
      ['eventBudgetMutationRejected', ') > max_events,', ') < max_events,'],
      ['externalAuthorityMutationRejected', 'temporal_commit_capability != 1', 'temporal_commit_capability == 1'],
    ];
    for (const [name, oldText, newText] of controls) {
      const mutatedSource = replaceExactlyOnce(source, oldText, newText, `RCL_K331_MUTATION_SITE_INVALID:${name}`);
      const mutatedSourcePath = path.join(directory, `${name}.rcl`);
      const mutatedRbcPath = path.join(directory, `${name}.rbc`);
      fs.writeFileSync(mutatedSourcePath, mutatedSource, 'utf8');
      const compilation = run(rclcPath, [compilerRbcPath, mutatedSourcePath, mutatedRbcPath]);
      if (compilation.status !== 0) { negativeControls[name] = true; continue; }
      const execution = run(rclvmPath, [mutatedRbcPath]);
      if (execution.status !== 0) { negativeControls[name] = true; continue; }
      const payload = verifyNativeSemanticStateRoot(parseJson(execution.stdout, `RCL_K331_${name}_JSON_INVALID`), { requireNativeRoot: true });
      negativeControls[name] = payload.state?.['evaluation.pass'] !== true;
    }
    const corruptPath = path.join(directory, 'corrupt.rbc');
    const corrupt = Buffer.from(bootstrapBytecode);
    corrupt[0] ^= 0xff;
    fs.writeFileSync(corruptPath, corrupt);
    negativeControls.corruptRbcRejected = run(rclvmPath, [corruptPath]).status !== 0;
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }

  const combinedDurations = rounds.map((round) => round.combinedMs);
  const uniqueStateRoots = new Set(rounds.map((round) => round.stateRoot)).size;
  const uniqueArtifactHashes = new Set(rounds.map((round) => round.artifactSha256)).size;
  const performanceEvidence = {
    compileP95Ms: percentile95(compileDurations), executeP95Ms: percentile95(executeDurations),
    combinedP95Ms: percentile95(combinedDurations), budget: contract.performanceBudget,
  };
  const performancePassed = performanceEvidence.compileP95Ms <= contract.performanceBudget.compileP95MsMax
    && performanceEvidence.executeP95Ms <= contract.performanceBudget.executeP95MsMax
    && performanceEvidence.combinedP95Ms <= contract.performanceBudget.combinedP95MsMax;
  const controlsPassed = Object.values(negativeControls).length === 5 && Object.values(negativeControls).every(Boolean);
  const passed = rounds.length === contract.required.rounds
    && uniqueStateRoots === contract.required.uniqueStateRoots
    && uniqueArtifactHashes === contract.required.uniqueArtifactHashes
    && rounds.every((round) => round.stateRoot === contract.canonical.semanticStateRoot)
    && controlsPassed && performancePassed;
  const withoutRoot = {
    format: 'rcl.k331.compiler-realtime-runtime-evidence.v0.1', generatedAt: new Date().toISOString(),
    contractRoot: evidenceRoot(contract), eligibleCells: contract.eligibleCells, profile: contract.profile,
    host: { platform: process.platform, arch: process.arch, release: os.release() },
    artifacts: {
      sourceSha256: sha256(source), compilerRbcSha256: sha256(fs.readFileSync(compilerRbcPath)),
      rclcSha256: sha256(fs.readFileSync(rclcPath)), rclvmSha256: sha256(fs.readFileSync(rclvmPath)),
      bootstrapArtifactSha256: rounds[0]?.artifactSha256 ?? null,
    },
    oracle: { implementation: 'logical-time-scheduler-auxiliary-runtime', expected: oracleProjection, budgetAtomic: oracle.budgetAtomic },
    rounds, negativeControls,
    summary: { requiredRounds: contract.required.rounds, successfulRounds: rounds.length, uniqueStateRoots, uniqueArtifactHashes, controlsPassed, performancePassed },
    performance: performanceEvidence, status: passed ? 'PASS' : 'FAIL', evidenceBoundary: contract.evidenceBoundary,
  };
  const payload = { ...withoutRoot, reportRoot: evidenceRoot({ ...withoutRoot, generatedAt: undefined }) };
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return payload;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const result = runK331CompilerRealtimeEvidence();
  console.log(JSON.stringify({ status: result.status, reportRoot: result.reportRoot, summary: result.summary, performance: result.performance }, null, 2));
  if (result.status !== 'PASS') process.exitCode = 1;
}
