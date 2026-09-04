#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { compileRealityToBytecode } from '../src/bytecode.mjs';
import { LogicalTimeScheduler, LogicalTimeSchedulerError } from '../src/logical-time-scheduler.mjs';
import { runNativeBytecode, runNativeCompiler } from '../src/native-vm.mjs';
import { evidenceRoot } from '../src/universal-program-stress.mjs';
import { readCanonicalCompilerArtifact } from '../src/canonical-source-archive.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DEFAULT_SOURCE_PATH = path.join(ROOT, 'examples', 'universal-stress', 'k331-compiler-realtime.rcl');
const RUNTIME_CONTRACT_PATH = path.join(ROOT, 'examples', 'universal-stress', 'k331-compiler-realtime-runtime-contract.v0.1.json');
const COMPILER_RBC_PATH = readCanonicalCompilerArtifact(JSON.parse(fs.readFileSync(RUNTIME_CONTRACT_PATH, 'utf8'))).path;

function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function check(checks, name, condition, details = undefined) {
  checks[name] = { pass: Boolean(condition), ...(details === undefined ? {} : { details }) };
}
function scheduledIds(result) {
  return result.events.filter((event) => event.type === 'scheduled-event-fired').map((event) => Number(event.scheduleId));
}

function runLogicalSchedulerOracle() {
  const scheduler = new LogicalTimeScheduler({ replicaId: 'k331-oracle', timeScale: 1 });
  for (const [id, at, priority] of [[30, 4, 0], [20, 2, 1], [10, 2, 0], [15, 2, 0], [40, 6, 0]]) {
    scheduler.scheduleAt({ id: String(id), at, priority, kind: 'compiler-event' });
  }
  const success = scheduler.advanceTo(4, { maxEvents: 4 });

  const budget = new LogicalTimeScheduler({ replicaId: 'k331-budget' });
  for (const [id, at, priority] of [[30, 4, 0], [20, 2, 1], [10, 2, 0], [15, 2, 0], [40, 6, 0]]) {
    budget.scheduleAt({ id: String(id), at, priority, kind: 'compiler-event' });
  }
  const budgetBeforeRoot = budget.snapshot().root;
  let budgetRejected = false;
  try { budget.advanceTo(4, { maxEvents: 3 }); } catch (error) {
    budgetRejected = error instanceof LogicalTimeSchedulerError && error.code === 'RCL_LOGICAL_TIME_MAX_EVENTS_EXCEEDED';
  }

  const external = new LogicalTimeScheduler({ replicaId: 'k331-external' });
  external.advanceTo(4);
  const proposal = external.proposeExternalTime({
    id: 'host-observation', source: 'host-clock', observedAtMs: 1, proposedLogicalTime: 8,
  });
  let authorityRejected = false;
  try { external.commitExternalTime(proposal.id, { subject: 'observer', capabilities: [] }); } catch (error) {
    authorityRejected = error instanceof LogicalTimeSchedulerError && error.code === 'RCL_LOGICAL_TIME_AUTHORITY_DENIED';
  }
  external.commitExternalTime(proposal.id, { subject: 'timekeeper', capabilities: ['temporal.commit'] });

  return {
    success: [1, success.currentTime, scheduledIds(success)],
    budgetAtomic: budgetRejected && budget.snapshot().root === budgetBeforeRoot,
    authorityRejected,
    externalCommittedTime: external.currentTime,
    projection: [scheduler.projectWallDuration(8), new LogicalTimeScheduler({ timeScale: 4 }).projectWallDuration(8)],
  };
}

export function verifyK331CompilerRealtimeCandidate(options = {}) {
  const sourcePath = path.resolve(options.sourcePath ?? DEFAULT_SOURCE_PATH);
  const source = fs.readFileSync(sourcePath, 'utf8');
  const checks = {};
  let artifactSha256 = null;
  let semanticStateRoot = null;
  let observed = null;
  let oracle = null;
  let errorCode = null;
  try {
    check(checks, 'rcl-owns-logical-time-semantics', /facet contract\.owner : Text = "RCL"/u.test(source)
      && /facet contract\.execution : Text = "NATIVE_RCLC_TO_RCLVM"/u.test(source));
    check(checks, 'deterministic-total-order-expressed', /reckon event_before/u.test(source)
      && /event_priority\(left\) < event_priority\(right\)/u.test(source)
      && /event_id\(left\) < event_id\(right\)/u.test(source));
    check(checks, 'monotonic-budget-authority-expressed', /target < current/u.test(source)
      && /due_count\([\s\S]*\) > max_events/u.test(source)
      && /temporal_commit_capability != 1/u.test(source));
    check(checks, 'explicit-non-hard-realtime-boundary', /DETERMINISTIC_LOGICAL_TIME_NOT_WALL_CLOCK_OR_HARD_REALTIME/u.test(source)
      && /evidence\.no_wall_clock_authority/u.test(source));
    check(checks, 'no-wall-clock-or-provider-bypass', !/Date\.now|performance\.now|provider_call\(|child_process|powershell|cmd\.exe|python|openai/iu.test(source));

    const bootstrap = Buffer.from(compileRealityToBytecode(source));
    artifactSha256 = sha256(bootstrap);
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-k331-candidate-'));
    try {
      const nativePath = path.join(directory, 'candidate.rbc');
      const compilation = runNativeCompiler(COMPILER_RBC_PATH, sourcePath, nativePath, { timeout: 90_000 });
      check(checks, 'native-compiler-byte-parity', Buffer.from(compilation.bytecode).equals(bootstrap));
      const runtime = runNativeBytecode(nativePath, { timeout: 90_000, requireNativeStateRoot: true });
      semanticStateRoot = runtime.semanticStateRoot;
      observed = {
        sortedIds: runtime.state?.['schedule.sorted']?.map((event) => event[0]),
        success: runtime.state?.['result.success'],
        budgetRejected: runtime.state?.['result.budget_rejected'],
        backwardRejected: runtime.state?.['result.backward_rejected'],
        invalidRejected: runtime.state?.['result.invalid_rejected'],
        externalUnapproved: runtime.state?.['result.external_unapproved'],
        externalApproved: runtime.state?.['result.external_approved'],
        projection: [runtime.state?.['projection.normal'], runtime.state?.['projection.accelerated']],
      };
      check(checks, 'native-deterministic-order-and-advance', runtime.state?.['evaluation.pass'] === true
        && JSON.stringify(observed.sortedIds) === JSON.stringify([10, 15, 20, 30, 40])
        && JSON.stringify(observed.success) === JSON.stringify([1, 4, [10, 15, 20, 30]]));
      check(checks, 'native-fail-closed-boundaries', JSON.stringify(observed.budgetRejected) === JSON.stringify([-2, 0, []])
        && JSON.stringify(observed.backwardRejected) === JSON.stringify([-1, 4, []])
        && JSON.stringify(observed.invalidRejected) === JSON.stringify([-5, 0, []])
        && JSON.stringify(observed.externalUnapproved) === JSON.stringify([-3, 4, []])
        && JSON.stringify(observed.externalApproved) === JSON.stringify([1, 8, []]));
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }

    oracle = runLogicalSchedulerOracle();
    check(checks, 'auxiliary-runtime-differential-oracle', JSON.stringify(oracle.success) === JSON.stringify([1, 4, [10, 15, 20, 30]])
      && oracle.budgetAtomic && oracle.authorityRejected && oracle.externalCommittedTime === 8
      && JSON.stringify(oracle.projection) === JSON.stringify([8, 2]));
  } catch (error) {
    errorCode = String(error?.code ?? error?.message ?? error).split(':')[0];
  }
  const passed = errorCode === null && Object.keys(checks).length === 9
    && Object.values(checks).every((item) => item.pass);
  const payload = {
    format: 'rcl.k331.compiler-realtime-candidate-verification.v0.1',
    status: passed ? 'PASS' : 'FAIL', sourceSha256: sha256(source), artifactSha256,
    semanticStateRoot, observed, oracle, checks, errorCode,
  };
  return { ...payload, reportRoot: evidenceRoot(payload) };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const result = verifyK331CompilerRealtimeCandidate({ sourcePath: process.argv[2] });
  console.log(JSON.stringify(result, null, 2));
  if (result.status !== 'PASS') process.exitCode = 1;
}
