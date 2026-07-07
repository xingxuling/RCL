import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  RCL_STEP_DEBUG_VERSION,
  RCL_DEBUG_SESSION_FORMAT,
  RCL_DEBUG_STEP_REPORT_FORMAT,
  DEFAULT_DEBUG_REPLAY_SOURCE,
  DEFAULT_DEBUG_REPLAY_TYPE_MODULES,
  runExecutionTrace,
  normalizeDebugConfig,
  buildDebugSessionFromTrace,
  runDebugSession,
  stepDebugSession,
  writeDebugSessionReports,
  runDebugSessionDemo,
} from '../src/index.mjs';

const PACKAGE_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function tmpdir(name) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `rcl-${name}-`));
}

const DEBUG_CONFIG = {
  stopOnEntry: true,
  breakpoints: [
    { id: 'bp-session', kind: 'facet', facet: 'app.session' },
    { id: 'bp-login-ref-semantic', kind: 'semantic-node', semanticNodeId: 'facet:app.loginRef' },
    { id: 'bp-typed-object-event', kind: 'event-kind', eventKind: 'typed.object.creation' },
    { id: 'bp-conditional-record', kind: 'facet', facet: 'app.session', condition: { op: 'facet-value-kind-equals', facet: 'app.session', valueKind: 'Record' } },
  ],
  watchExpressions: [
    { id: 'watch-session', kind: 'facet', facet: 'app.session' },
    { id: 'watch-login-ref', kind: 'semantic-node', semanticNodeId: 'facet:app.loginRef' },
    { id: 'watch-gc', kind: 'event-kind', eventKind: 'gc.snapshot.root' },
  ],
};

test('P4.1 Debug Session Runtime builds breakpointed frames and variable windows from a trace', () => {
  const traceResult = runExecutionTrace({ source: DEFAULT_DEBUG_REPLAY_SOURCE, typeModuleSources: DEFAULT_DEBUG_REPLAY_TYPE_MODULES });
  assert.equal(traceResult.ok, true);
  const session = buildDebugSessionFromTrace(traceResult.trace, DEBUG_CONFIG);
  assert.equal(session.format, RCL_DEBUG_SESSION_FORMAT);
  assert.equal(session.version, RCL_STEP_DEBUG_VERSION);
  assert.ok(session.sessionId.startsWith('rcl-debug-session:'));
  assert.ok(session.frameCount > 0);
  assert.ok(session.pausePoints.length > 0);
  assert.ok(session.breakpointHitCount > 0);
  assert.equal(session.cursorVariableWindow.variables['app.session'].valueKind, 'Record');
  assert.equal(session.cursorVariableWindow.watches.find(item => item.id === 'watch-session').available, true);
});

test('P4.1 Debug Session Runtime supports semantic-node, event-kind and conditional breakpoints', () => {
  const result = runDebugSession({ source: DEFAULT_DEBUG_REPLAY_SOURCE, typeModuleSources: DEFAULT_DEBUG_REPLAY_TYPE_MODULES, debugConfig: DEBUG_CONFIG });
  assert.equal(result.ok, true);
  assert.ok(result.session.frames.some(frame => frame.breakHits.some(hit => hit.id === 'bp-login-ref-semantic')));
  assert.ok(result.session.frames.some(frame => frame.breakHits.some(hit => hit.id === 'bp-typed-object-event')));
  const conditionalHit = result.session.frames.find(frame => frame.breakHits.some(hit => hit.id === 'bp-conditional-record'));
  assert.ok(conditionalHit);
  assert.equal(conditionalHit.facet, 'app.session');
});

test('P4.1 step cursor next and continue produce deterministic step reports', () => {
  const result = runDebugSession({ source: DEFAULT_DEBUG_REPLAY_SOURCE, typeModuleSources: DEFAULT_DEBUG_REPLAY_TYPE_MODULES, debugConfig: DEBUG_CONFIG });
  assert.equal(result.ok, true);
  const nextA = stepDebugSession(result.session, { trace: result.trace, command: 'next' });
  const nextB = stepDebugSession(JSON.parse(JSON.stringify(result.session)), { trace: JSON.parse(JSON.stringify(result.trace)), command: 'next' });
  assert.equal(nextA.format, RCL_DEBUG_STEP_REPORT_FORMAT);
  assert.equal(nextA.stepRoot, nextB.stepRoot);
  assert.equal(nextA.afterCursor.frameIndex, 1);
  const cont = stepDebugSession(result.session, { trace: result.trace, command: 'continue' });
  assert.equal(cont.pausePoint, true);
  assert.ok(cont.breakpointHits.length > 0 || cont.afterCursor.stopKind === 'entry');
});

test('P4.1 step cursor can jump by seq and frame id', () => {
  const result = runDebugSession({ source: DEFAULT_DEBUG_REPLAY_SOURCE, typeModuleSources: DEFAULT_DEBUG_REPLAY_TYPE_MODULES, debugConfig: DEBUG_CONFIG });
  assert.equal(result.ok, true);
  const target = result.session.frames.find(frame => frame.eventKind === 'gc.snapshot.root');
  assert.ok(target);
  const bySeq = stepDebugSession(result.session, { trace: result.trace, command: `seq:${target.seq}` });
  assert.equal(bySeq.afterCursor.seq, target.seq);
  const byFrame = stepDebugSession(result.session, { trace: result.trace, command: `frame:${target.frameIndex}` });
  assert.equal(byFrame.afterCursor.frameIndex, target.frameIndex);
});

test('P4.1 debug-session-run and debug-step CLI write verifiable JSON reports', () => {
  const out = tmpdir('debug-session-run');
  const sourcePath = path.join(PACKAGE_ROOT, 'examples', 'debug-replay', 'src', 'app.rcl');
  const typePath = path.join(PACKAGE_ROOT, 'examples', 'debug-replay', 'types');
  const configPath = path.join(PACKAGE_ROOT, 'examples', 'debug-session', 'debug-config.json');
  const run = spawnSync(process.execPath, [path.join(PACKAGE_ROOT, 'src', 'cli.mjs'), 'debug-session-run', sourcePath, typePath, out, configPath], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  const payload = JSON.parse(run.stdout);
  assert.equal(payload.ok, true);
  assert.equal(payload.version, RCL_STEP_DEBUG_VERSION);
  assert.equal(fs.existsSync(path.join(out, 'debug-session.json')), true);
  assert.equal(fs.existsSync(path.join(out, 'debug-step-next.json')), true);
  assert.ok(payload.breakpointHitCount > 0);
  const stepOut = tmpdir('debug-step');
  const step = spawnSync(process.execPath, [path.join(PACKAGE_ROOT, 'src', 'cli.mjs'), 'debug-step', path.join(out, 'debug-session.json'), 'continue', stepOut], { encoding: 'utf8' });
  assert.equal(step.status, 0, step.stderr);
  const stepPayload = JSON.parse(step.stdout);
  assert.equal(stepPayload.format, RCL_DEBUG_STEP_REPORT_FORMAT);
  assert.equal(fs.existsSync(path.join(stepOut, 'debug-step-continue.json')), true);
});

test('P4.1 debug-session-demo returns compact debugger evidence', () => {
  const report = runDebugSessionDemo();
  assert.equal(report.ok, true);
  assert.equal(report.version, RCL_STEP_DEBUG_VERSION);
  assert.equal(report.format, RCL_DEBUG_SESSION_FORMAT);
  assert.ok(report.frameCount > 0);
  assert.ok(report.pausePointCount > 0);
  assert.ok(report.breakpointHitCount > 0);
  assert.equal(report.deterministicReplay, true);
  assert.ok(report.nextStepRoot);
  assert.ok(report.continueStepRoot);
});

test('P4.1 Debug Session Runtime normalizes config and keeps deterministic session roots', () => {
  const normalized = normalizeDebugConfig({ breakpoints: [{ facet: 'app.session' }], watches: [{ facet: 'app.session' }] });
  assert.equal(normalized.breakpoints[0].kind, 'facet');
  assert.equal(normalized.watchExpressions[0].kind, 'facet');
  const traceResult = runExecutionTrace({ source: DEFAULT_DEBUG_REPLAY_SOURCE, typeModuleSources: DEFAULT_DEBUG_REPLAY_TYPE_MODULES, watchpoints: normalized.traceWatchpoints });
  assert.equal(traceResult.ok, true);
  const a = buildDebugSessionFromTrace(traceResult.trace, normalized);
  const b = buildDebugSessionFromTrace(JSON.parse(JSON.stringify(traceResult.trace)), JSON.parse(JSON.stringify(normalized)));
  assert.equal(a.sessionRoot, b.sessionRoot);
  assert.equal(a.breakpointHitCount, b.breakpointHitCount);
});
