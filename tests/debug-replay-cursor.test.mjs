import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as debug from '../src/debug-session-runtime.mjs';
import { runExecutionTrace, replayTrace } from '../src/debug-replay-runtime.mjs';
import { buildDapBridge } from '../src/lsp-dap-bridge-runtime.mjs';

const clone = value => structuredClone(value);
const sorted = value => Array.isArray(value) ? value.map(sorted) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, sorted(item)])) : value;
const digest = value => crypto.createHash('sha256').update(JSON.stringify(sorted(value))).digest('hex');
let trace, session;
test.before(() => {
  const result = runExecutionTrace(); assert.equal(result.ok, true);
  trace = result.trace;
  session = debug.buildDebugSessionFromTrace(trace, { breakpoints: [{ id: 'facets', kind: 'event-kind', eventKind: 'facet.evaluation' }], watchExpressions: [{ id: 'session', facet: 'app.session' }] });
});

test('admission rejects altered event evidence before producing a step report', () => {
  const altered = clone(trace); altered.events[0].valuePreview = 'unbound-preview';
  assert.throws(() => debug.stepDebugSession(session, { trace: altered }), /RCL_DEBUG_TRACE_ROOT_MISMATCH/);
});

test('admission rejects altered session roots even for frame-only stepping', () => {
  const altered = clone(session); altered.frames[0].eventKind = 'forged';
  assert.throws(() => debug.stepDebugSession(altered), /RCL_DEBUG_SESSION_ROOT_MISMATCH/);
});

test('admission binds re-rooted frames and variable windows to the actual trace', () => {
  const altered = clone(session); altered.frames[0].eventKind = 'forged';
  delete altered.sessionRoot; altered.sessionRoot = digest(altered);
  assert.throws(() => debug.stepDebugSession(altered, { trace }), /RCL_DEBUG_SESSION_TRACE_MISMATCH/);
});

test('admission rejects invalid step commands, origins and sequence targets', () => {
  for (const command of ['unknown', { op: 'next', fromFrameIndex: -1 }, { op: 'next', fromFrameIndex: 0.5 }, { op: 'goto-frame', frameIndex: NaN }, { op: 'goto', seq: -1 }, `seq:${trace.events.at(-1).seq + 100}`]) {
    assert.throws(() => debug.stepDebugSession(session, { trace, command }), /RCL_DEBUG_(STEP_COMMAND_INVALID|FRAME_INDEX_INVALID|SEQUENCE_NOT_FOUND)/);
  }
});

test('admission checks external root pins before creating output files', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-debug-pin-')), absent = path.join(directory, 'absent');
  try {
    assert.throws(() => debug.stepDebugSession(session, { trace, expectedSessionRoot: '0'.repeat(64), outputDir: absent }), /RCL_DEBUG_EXPECTED_SESSION_ROOT_MISMATCH/);
    assert.equal(fs.existsSync(absent), false);
    assert.throws(() => debug.stepDebugSession(session, { trace, expectedTraceRoot: '0'.repeat(64), outputDir: absent }), /RCL_DEBUG_EXPECTED_TRACE_ROOT_MISMATCH/);
    assert.equal(fs.existsSync(absent), false);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test('unsupported trace versions and stale informational counts cannot seed a cursor', () => {
  const version = clone(trace); version.version = 'unsupported';
  assert.throws(() => debug.buildDebugSessionFromTrace(version), /RCL_DEBUG_TRACE_INVALID/);
  for (const counts of [null, [], {}, { invented: 1 }]) {
    const altered = clone(trace); altered.eventKindCounts = counts;
    assert.throws(() => debug.buildDebugSessionFromTrace(altered), /RCL_DEBUG_TRACE_COUNTS_MISMATCH/);
  }
});

test('absent prototype-like watch names remain unavailable and do not invent variables', () => {
  const watched = debug.buildDebugSessionFromTrace(trace, { watchExpressions: [{ facet: 'constructor' }, { facet: '__proto__' }] });
  const report = debug.stepDebugSession(watched, { trace, command: `frame:${watched.frames.length - 1}` });
  assert.ok(report.variableWindow.watches.every(watch => watch.available === false && watch.value === null));
  assert.equal(report.traceEvidenceVerified, true);
  assert.equal(debug.stepDebugSession(watched).traceEvidenceVerified, false);
});

test('real prototype-like facet names retain native values in variable and watch windows', () => {
  const result = runExecutionTrace({ source: 'reality PrototypeNames { facet __proto__ : Number = 1 facet constructor : Number = 2 }', typeModuleSources: {} });
  assert.equal(result.ok, true);
  const declared = debug.buildDebugSessionFromTrace(result.trace, { watchExpressions: [{ facet: '__proto__' }, { facet: 'constructor' }] });
  const report = debug.stepDebugSession(declared, { trace: result.trace, command: `frame:${declared.frames.length - 1}` });
  assert.equal(Object.hasOwn(report.variableWindow.variables, '__proto__'), true);
  assert.equal(report.variableWindow.variables.__proto__.valuePreview, 1);
  assert.equal(report.variableWindow.variables.constructor.valuePreview, 2);
  assert.deepEqual(report.variableWindow.watches.map(item => item.value.valuePreview), [1, 2]);
});

test('a private replay cursor advances repeatedly, reverses to a pause and rewinds its variable window', () => {
  const cursor = debug.createDebugReplayCursor(session, { trace, expectedSessionRoot: session.sessionRoot, expectedTraceRoot: trace.traceRoot });
  const first = cursor.step('continue'), second = cursor.step('continue');
  assert.ok(second.afterCursor.frameIndex > first.afterCursor.frameIndex);
  assert.deepEqual(second.beforeCursor, Object.fromEntries(Object.entries(first.afterCursor).filter(([key]) => key !== 'done')));
  const backward = cursor.step('reverse-continue');
  assert.equal(backward.afterCursor.frameIndex, first.afterCursor.frameIndex);
  assert.deepEqual(backward.variableWindow, first.variableWindow);
  const next = cursor.step('next'); assert.equal(next.afterCursor.frameIndex, first.afterCursor.frameIndex + 1);
  const back = cursor.step('stepBack'); assert.equal(back.afterCursor.frameIndex, first.afterCursor.frameIndex);
  assert.equal(cursor.snapshot().frameIndex, back.afterCursor.frameIndex);
  assert.equal(session.cursor.frameIndex, 0);
});

test('cursor snapshots and reports are detached, deterministic and do not expose private session data', () => {
  const original = clone(session), local = clone(session), events = clone(trace);
  const a = debug.createDebugReplayCursor(local, { trace: events }), b = debug.createDebugReplayCursor(session, { trace });
  local.frames[1].eventKind = 'mutated'; events.events[1].kind = 'mutated';
  const stepA = a.step('next'), stepB = b.step('next'); assert.equal(stepA.stepRoot, stepB.stepRoot);
  stepA.frame.eventKind = 'mutated-report'; stepA.variableWindow.variables = {};
  const snapshot = a.snapshot(), { cursorRoot, ...core } = snapshot;
  assert.equal(cursorRoot, digest(core)); snapshot.frameIndex = 9999;
  assert.equal(a.step('next').stepRoot, b.step('next').stepRoot);
  assert.deepEqual(session, original);
});

test('invalid cursor steps cannot advance or override the current origin', () => {
  const cursor = debug.createDebugReplayCursor(session, { trace }); cursor.step('next'); const before = cursor.snapshot();
  assert.throws(() => cursor.step({ op: 'next', fromFrameIndex: 0 }), /RCL_DEBUG_CURSOR_ORIGIN_OVERRIDE/);
  assert.throws(() => cursor.step('invalid'), /RCL_DEBUG_STEP_COMMAND_INVALID/);
  assert.deepEqual(cursor.snapshot(), before);
  assert.equal(cursor.step('reset').afterCursor.frameIndex, 0);
  assert.equal(cursor.step('previous').afterCursor.frameIndex, 0);
  assert.equal(cursor.step('reverseContinue').afterCursor.frameIndex, 0);
});

test('serialized cursor checkpoints resume exact position with explicit source and cursor pins', () => {
  const cursor = debug.createDebugReplayCursor(session, { trace }); cursor.step('continue');
  const snapshot = JSON.parse(JSON.stringify(cursor.snapshot()));
  const resumed = debug.createDebugReplayCursor(session, { trace, cursorSnapshot: snapshot, expectedCursorRoot: snapshot.cursorRoot, expectedSessionRoot: session.sessionRoot, expectedTraceRoot: trace.traceRoot });
  assert.deepEqual(resumed.snapshot(), snapshot);
  assert.equal(resumed.step('next').stepRoot, cursor.step('next').stepRoot);
});

test('cursor checkpoints reject changed roots, wrong sequence bindings and conflicting origins', () => {
  const snapshot = debug.createDebugReplayCursor(session, { trace }).snapshot();
  assert.throws(() => debug.createDebugReplayCursor(session, { trace, cursorSnapshot: snapshot, startFrameIndex: 0 }), /RCL_DEBUG_CURSOR_SNAPSHOT_INVALID/);
  assert.throws(() => debug.createDebugReplayCursor(session, { trace, cursorSnapshot: snapshot, expectedCursorRoot: '0'.repeat(64) }), /RCL_DEBUG_EXPECTED_CURSOR_ROOT_MISMATCH/);
  for (const field of ['sessionRoot', 'traceRoot', 'seq', 'done']) {
    const altered = { ...snapshot, [field]: field === 'done' ? !snapshot.done : field === 'seq' ? snapshot.seq + 1 : '0'.repeat(64) };
    delete altered.cursorRoot; altered.cursorRoot = digest(altered);
    assert.throws(() => debug.createDebugReplayCursor(session, { trace, cursorSnapshot: altered }), /RCL_DEBUG_CURSOR_SNAPSHOT_INVALID/);
  }
});

test('empty admitted traces retain explicit null cursors and zero-frame history', () => {
  const empty = clone(trace); empty.events = []; empty.eventCount = 0; empty.eventKindCounts = {};
  const roots = replayTrace(empty); empty.traceRoot = roots.recomputedTraceRoot; empty.summaryRoot = roots.recomputedSummaryRoot;
  const emptySession = debug.buildDebugSessionFromTrace(empty), cursor = debug.createDebugReplayCursor(emptySession, { trace: empty });
  assert.equal(cursor.step('next').afterCursor, null); assert.equal(cursor.step('reverse-continue').afterCursor, null);
  assert.equal(cursor.snapshot().frameIndex, null);
});

test('serialized public CLI reverse stepping and DAP request plans use the same replay commands', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-debug-cursor-cli-'));
  try {
    fs.writeFileSync(path.join(directory, 'debug-session.json'), JSON.stringify(session)); fs.writeFileSync(path.join(directory, 'trace.json'), JSON.stringify(trace));
    const cli = fileURLToPath(new URL('../src/reality-hub-cli.mjs', import.meta.url));
    const result = spawnSync(process.execPath, [cli, 'debug-step', path.join(directory, 'debug-session.json'), 'reverse-continue', path.join(directory, 'reports')], { encoding: 'utf8', timeout: 30000, windowsHide: true });
    assert.equal(result.status, 0, result.stderr); assert.equal(JSON.parse(result.stdout).afterCursor.frameIndex, 0);
    const plan = buildDapBridge(session).stepRequestPlan;
    assert.equal(plan.find(item => item.command === 'stepBack').arguments.bridgeCommand, 'debug-step previous');
    assert.equal(plan.find(item => item.command === 'reverseContinue').arguments.bridgeCommand, 'debug-step reverse-continue');
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
