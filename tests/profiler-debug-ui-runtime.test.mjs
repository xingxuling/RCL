import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_DEBUG_REPLAY_SOURCE,
  DEFAULT_DEBUG_REPLAY_TYPE_MODULES,
  RCL_PROFILER_DEBUG_UI_VERSION,
  RCL_PROFILER_REPORT_FORMAT,
  RCL_FLAMEGRAPH_FORMAT,
  RCL_REPLAY_INPUT_BUNDLE_FORMAT,
  RCL_REPLAY_BUNDLE_VERIFICATION_FORMAT,
  RCL_DEBUG_UI_PROTOCOL_FORMAT,
  runExecutionTrace,
  runDebugSession,
  buildProfilerReportFromTrace,
  buildReplayInputBundle,
  verifyReplayInputBundle,
  buildDebugUiProtocol,
  runProfilerDebugUi,
  writeProfilerDebugUiReports,
  runProfilerDemo,
  runDebugUiDemo,
} from '../src/index.mjs';

const PACKAGE_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function tmpdir(name) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `rcl-${name}-`));
}

const DEBUG_CONFIG = {
  stopOnEntry: true,
  breakpoints: [{ id: 'bp-session', kind: 'facet', facet: 'app.session' }],
  watchExpressions: [{ id: 'watch-session', kind: 'facet', facet: 'app.session' }],
};

test('P4.2 Profiler Runtime builds deterministic trace metrics and flamegraph data', () => {
  const traceResult = runExecutionTrace({ source: DEFAULT_DEBUG_REPLAY_SOURCE, typeModuleSources: DEFAULT_DEBUG_REPLAY_TYPE_MODULES });
  assert.equal(traceResult.ok, true);
  const profile = buildProfilerReportFromTrace(traceResult.trace);
  assert.equal(profile.format, RCL_PROFILER_REPORT_FORMAT);
  assert.equal(profile.version, RCL_PROFILER_DEBUG_UI_VERSION);
  assert.equal(profile.flamegraph.format, RCL_FLAMEGRAPH_FORMAT);
  assert.ok(profile.totalCostUnits > 0);
  assert.ok(profile.metrics.byKind.some(item => item.id === 'rbc.instruction'));
  assert.ok(profile.metrics.byFacet.some(item => item.id === 'app.session'));
  assert.ok(profile.metrics.byResource.some(item => item.id.includes('typed-gc')));
  assert.equal(profile.flamegraph.root.kind, 'program');
  assert.ok(profile.hotPath.length > 0);
});

test('P4.2 Profiler Runtime keeps profiler and flamegraph roots stable over cloned traces', () => {
  const traceResult = runExecutionTrace({ source: DEFAULT_DEBUG_REPLAY_SOURCE, typeModuleSources: DEFAULT_DEBUG_REPLAY_TYPE_MODULES });
  const a = buildProfilerReportFromTrace(traceResult.trace);
  const b = buildProfilerReportFromTrace(JSON.parse(JSON.stringify(traceResult.trace)));
  assert.equal(a.profilerRoot, b.profilerRoot);
  assert.equal(a.flamegraph.flamegraphRoot, b.flamegraph.flamegraphRoot);
  assert.equal(a.sequenceRoot, b.sequenceRoot);
});

test('P4.2 Deterministic Replay Input Bundle captures replay roots and verifies against trace evidence', () => {
  const traceResult = runExecutionTrace({ source: DEFAULT_DEBUG_REPLAY_SOURCE, typeModuleSources: DEFAULT_DEBUG_REPLAY_TYPE_MODULES });
  const bundle = buildReplayInputBundle(traceResult.trace, { sourcePath: 'examples/debug-replay/src/app.rcl' });
  assert.equal(bundle.format, RCL_REPLAY_INPUT_BUNDLE_FORMAT);
  assert.equal(bundle.version, RCL_PROFILER_DEBUG_UI_VERSION);
  assert.equal(bundle.deterministicReplay, true);
  assert.equal(bundle.traceRoot, traceResult.trace.traceRoot);
  assert.equal(bundle.eventCount, traceResult.trace.events.length);
  assert.ok(bundle.eventFingerprintRoot);
  const verified = verifyReplayInputBundle(bundle, traceResult.trace);
  assert.equal(verified.format, RCL_REPLAY_BUNDLE_VERIFICATION_FORMAT);
  assert.equal(verified.ok, true);
  assert.equal(verified.checks.eventFingerprintRoot, true);
});

test('P4.2 Debug UI Protocol exposes DAP-shaped messages, variables, profiler and replay bundle', () => {
  const result = runProfilerDebugUi({ source: DEFAULT_DEBUG_REPLAY_SOURCE, typeModuleSources: DEFAULT_DEBUG_REPLAY_TYPE_MODULES, debugConfig: DEBUG_CONFIG });
  assert.equal(result.ok, true);
  const protocol = buildDebugUiProtocol({ trace: result.trace, debugSession: result.session, profiler: result.profiler, replayBundle: result.replayBundle });
  assert.equal(protocol.format, RCL_DEBUG_UI_PROTOCOL_FORMAT);
  assert.equal(protocol.capabilities.profiler, true);
  assert.equal(protocol.capabilities.replayBundle, true);
  assert.equal(protocol.capabilities.stepDebugger, true);
  assert.equal(protocol.capabilities.livePauseResume, false);
  assert.ok(protocol.messages.some(item => item.command === 'stackTrace'));
  assert.ok(protocol.messages.some(item => item.event === 'profileSummary'));
  assert.ok(protocol.messages.some(item => item.event === 'replayBundle'));
  assert.ok(protocol.protocolRoot);
});

test('P4.2 Profiler Debug UI integrated run links trace, session, profiler, bundle and protocol roots', () => {
  const result = runProfilerDebugUi({ source: DEFAULT_DEBUG_REPLAY_SOURCE, typeModuleSources: DEFAULT_DEBUG_REPLAY_TYPE_MODULES, debugConfig: DEBUG_CONFIG });
  assert.equal(result.ok, true);
  assert.equal(result.replayVerification.ok, true);
  assert.equal(result.debugUiProtocol.profilerRoot, result.profiler.profilerRoot);
  assert.equal(result.debugUiProtocol.replayBundleRoot, result.replayBundle.bundleRoot);
  assert.equal(result.profiler.traceRoot, result.trace.traceRoot);
  assert.equal(result.session.traceRoot, result.trace.traceRoot);
});

test('P4.2 profile-run and debug-ui-protocol CLI write verifiable JSON reports', () => {
  const out = tmpdir('profile-run');
  const sourcePath = path.join(PACKAGE_ROOT, 'examples', 'debug-replay', 'src', 'app.rcl');
  const typePath = path.join(PACKAGE_ROOT, 'examples', 'debug-replay', 'types');
  const configPath = path.join(PACKAGE_ROOT, 'examples', 'debug-session', 'debug-config.json');
  const run = spawnSync(process.execPath, [path.join(PACKAGE_ROOT, 'src', 'cli.mjs'), 'profile-run', sourcePath, typePath, out, configPath], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  const payload = JSON.parse(run.stdout);
  assert.equal(payload.ok, true);
  assert.equal(payload.version, RCL_PROFILER_DEBUG_UI_VERSION);
  assert.equal(fs.existsSync(path.join(out, 'profiler-report.json')), true);
  assert.equal(fs.existsSync(path.join(out, 'flamegraph.json')), true);
  assert.equal(fs.existsSync(path.join(out, 'replay-input-bundle.json')), true);
  assert.equal(fs.existsSync(path.join(out, 'debug-ui-protocol.json')), true);
  assert.ok(payload.totalCostUnits > 0);

  const uiOut = tmpdir('debug-ui-protocol');
  const ui = spawnSync(process.execPath, [path.join(PACKAGE_ROOT, 'src', 'cli.mjs'), 'debug-ui-protocol', path.join(out, 'debug-session.json'), uiOut], { encoding: 'utf8' });
  assert.equal(ui.status, 0, ui.stderr);
  const uiPayload = JSON.parse(ui.stdout);
  assert.equal(uiPayload.format, RCL_DEBUG_UI_PROTOCOL_FORMAT);
  assert.equal(uiPayload.capabilities.profiler, true);
  assert.equal(fs.existsSync(path.join(uiOut, 'debug-ui-protocol.json')), true);
});

test('P4.2 replay-bundle CLI writes bundle and verification reports from a trace file', () => {
  const runOut = tmpdir('profile-run-for-bundle');
  const sourcePath = path.join(PACKAGE_ROOT, 'examples', 'debug-replay', 'src', 'app.rcl');
  const typePath = path.join(PACKAGE_ROOT, 'examples', 'debug-replay', 'types');
  const profileRun = writeProfilerDebugUiReports(sourcePath, typePath, runOut, { debugConfig: DEBUG_CONFIG });
  assert.equal(profileRun.ok, true);
  const bundleOut = tmpdir('replay-bundle');
  const run = spawnSync(process.execPath, [path.join(PACKAGE_ROOT, 'src', 'cli.mjs'), 'replay-bundle', path.join(runOut, 'trace.json'), bundleOut], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  const payload = JSON.parse(run.stdout);
  assert.equal(payload.ok, true);
  assert.equal(payload.deterministicReplay, true);
  assert.equal(fs.existsSync(path.join(bundleOut, 'replay-input-bundle.json')), true);
  assert.equal(fs.existsSync(path.join(bundleOut, 'replay-bundle-verification.json')), true);
});

test('P4.2 profiler-demo and debug-ui-demo return compact evidence', () => {
  const profilerDemo = runProfilerDemo();
  assert.equal(profilerDemo.ok, true);
  assert.equal(profilerDemo.version, RCL_PROFILER_DEBUG_UI_VERSION);
  assert.equal(profilerDemo.format, RCL_PROFILER_REPORT_FORMAT);
  assert.ok(profilerDemo.topHotPath.length > 0);
  const uiDemo = runDebugUiDemo();
  assert.equal(uiDemo.ok, true);
  assert.equal(uiDemo.format, RCL_DEBUG_UI_PROTOCOL_FORMAT);
  assert.equal(uiDemo.capabilities.profiler, true);
  assert.equal(uiDemo.capabilities.replayBundle, true);
  assert.ok(uiDemo.messageCount >= 8);
});
