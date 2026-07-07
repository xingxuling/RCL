import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  RCL_DEBUG_REPLAY_VERSION,
  RCL_SOURCE_MAP_RUNTIME_FORMAT,
  RCL_EXECUTION_TRACE_FORMAT,
  RCL_TRACE_REPLAY_FORMAT,
  DEFAULT_DEBUG_REPLAY_SOURCE,
  DEFAULT_DEBUG_REPLAY_TYPE_MODULES,
  buildSourceMapRuntime,
  querySourceMapRuntime,
  runExecutionTrace,
  replayTrace,
  writeTraceRunReports,
  runDebugMapDemo,
} from '../src/index.mjs';

const PACKAGE_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function tmpdir(name) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `rcl-${name}-`));
}

test('P4 Source Map Runtime links source, semantic facets and RBC instructions', () => {
  const result = buildSourceMapRuntime({
    source: DEFAULT_DEBUG_REPLAY_SOURCE,
    typeModuleSources: DEFAULT_DEBUG_REPLAY_TYPE_MODULES,
    sourceFile: 'examples/debug-replay/src/app.rcl',
  });
  assert.equal(result.ok, true);
  assert.equal(result.sourceMapRuntime.format, RCL_SOURCE_MAP_RUNTIME_FORMAT);
  assert.equal(result.sourceMapRuntime.version, RCL_DEBUG_REPLAY_VERSION);
  assert.ok(result.sourceMapRuntime.programRoot);
  assert.ok(result.sourceMapRuntime.lockRoot);
  assert.ok(result.sourceMapRuntime.unifiedMapRoot);
  assert.equal(result.sourceMapRuntime.facets['app.session'].canonicalType, 'core::Session');
  assert.ok(result.sourceMapRuntime.instructions.some(item => item.opcode === 'MAKE_TYPED_RECORD'));
  assert.ok(result.sourceMapRuntime.instructions.some(item => item.opcode === 'MAKE_TYPED_REF'));
});

test('P4 Source Map Runtime can be queried by state path, facet, semantic node, instruction and location', () => {
  const { sourceMapRuntime } = buildSourceMapRuntime({
    source: DEFAULT_DEBUG_REPLAY_SOURCE,
    typeModuleSources: DEFAULT_DEBUG_REPLAY_TYPE_MODULES,
    sourceFile: 'examples/debug-replay/src/app.rcl',
  });
  const state = querySourceMapRuntime(sourceMapRuntime, { statePath: 'app.session' });
  assert.equal(state.ok, true);
  assert.equal(state.result.semanticNodeId, 'facet:app.session');
  const facet = querySourceMapRuntime(sourceMapRuntime, { facet: 'app.payloadViaRef' });
  assert.equal(facet.ok, true);
  assert.equal(facet.result.expressionKind, 'FieldAccessExpr');
  const semantic = querySourceMapRuntime(sourceMapRuntime, { semanticNodeId: 'facet:app.loginRef' });
  assert.equal(semantic.ok, true);
  const firstStore = sourceMapRuntime.instructions.find(item => item.opcode === 'STORE_STATE' && item.facet === 'app.session');
  const instruction = querySourceMapRuntime(sourceMapRuntime, { instructionIndex: firstStore.instructionIndex });
  assert.equal(instruction.ok, true);
  assert.equal(instruction.result.facet, 'app.session');
  const location = querySourceMapRuntime(sourceMapRuntime, { location: sourceMapRuntime.facets['app.session'].source });
  assert.equal(location.ok, true);
});

test('P4 Execution Trace Runtime records typed execution, field access, refs and GC roots', () => {
  const result = runExecutionTrace({
    source: DEFAULT_DEBUG_REPLAY_SOURCE,
    typeModuleSources: DEFAULT_DEBUG_REPLAY_TYPE_MODULES,
    watchpoints: [{ id: 'wp-session', facet: 'app.session' }],
  });
  assert.equal(result.ok, true);
  assert.equal(result.trace.format, RCL_EXECUTION_TRACE_FORMAT);
  for (const kind of [
    'facet.evaluation',
    'rbc.instruction',
    'typed.constructor',
    'typed.field.access',
    'typed.object.creation',
    'typed.ref.creation',
    'gc.snapshot.root',
    'gc.mark_sweep.root',
    'resource.operation',
    'watchpoint.hit',
  ]) {
    assert.ok(result.trace.eventKindCounts[kind] > 0, `missing ${kind}`);
  }
  assert.equal(result.replay.deterministicReplay, true);
  assert.equal(result.debugReport.typedHeap.gcSnapshotRoot, result.trace.gcSnapshotRoot);
  assert.equal(result.debugReport.typedHeap.markSweepPlanRoot, result.trace.markSweepPlanRoot);
});

test('P4 Execution Trace Runtime records tagged union match branch decisions', () => {
  const source = fs.readFileSync(path.join(PACKAGE_ROOT, 'examples', 'typed-access-pattern', 'src', 'app.rcl'), 'utf8');
  const typeModuleSources = {
    'core.rcltype': fs.readFileSync(path.join(PACKAGE_ROOT, 'examples', 'typed-access-pattern', 'types', 'core.rcltype'), 'utf8'),
  };
  const result = runExecutionTrace({ source, typeModuleSources });
  assert.equal(result.ok, true);
  assert.ok(result.trace.eventKindCounts['typed.match.branch'] > 0);
  const match = result.trace.events.find(item => item.kind === 'typed.match.branch');
  assert.equal(match.selectedVariant, 'Ok');
  assert.equal(match.selectedCaseIndex, 0);
});

test('P4 deterministic replay recomputes the same trace summary roots', () => {
  const result = runExecutionTrace({ source: DEFAULT_DEBUG_REPLAY_SOURCE, typeModuleSources: DEFAULT_DEBUG_REPLAY_TYPE_MODULES });
  assert.equal(result.ok, true);
  const replayA = replayTrace(result.trace);
  const replayB = replayTrace(JSON.parse(JSON.stringify(result.trace)));
  assert.equal(replayA.format, RCL_TRACE_REPLAY_FORMAT);
  assert.equal(replayA.deterministicReplay, true);
  assert.equal(replayB.deterministicReplay, true);
  assert.equal(replayA.replayRoot, replayB.replayRoot);
  assert.equal(replayA.recomputedSummaryRoot, result.trace.summaryRoot);
  assert.equal(replayA.recomputedTraceRoot, result.trace.traceRoot);
});

test('P4 trace-run and replay-trace CLI write verifiable JSON reports', () => {
  const out = tmpdir('trace-run');
  const sourcePath = path.join(PACKAGE_ROOT, 'examples', 'typed-gc-snapshot', 'src', 'app.rcl');
  const typePath = path.join(PACKAGE_ROOT, 'examples', 'typed-gc-snapshot', 'types');
  const watchPath = path.join(out, 'watchpoints.json');
  fs.writeFileSync(watchPath, JSON.stringify([{ id: 'wp-session', facet: 'app.session' }], null, 2));
  const run = spawnSync(process.execPath, [path.join(PACKAGE_ROOT, 'src', 'cli.mjs'), 'trace-run', sourcePath, typePath, out, watchPath], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  const payload = JSON.parse(run.stdout);
  assert.equal(payload.ok, true);
  assert.equal(fs.existsSync(path.join(out, 'source-map-runtime.json')), true);
  assert.equal(fs.existsSync(path.join(out, 'trace.json')), true);
  assert.equal(fs.existsSync(path.join(out, 'debug-report.json')), true);
  assert.ok(payload.watchpointHitCount > 0);
  const replayDir = tmpdir('replay');
  const replay = spawnSync(process.execPath, [path.join(PACKAGE_ROOT, 'src', 'cli.mjs'), 'replay-trace', path.join(out, 'trace.json'), replayDir], { encoding: 'utf8' });
  assert.equal(replay.status, 0, replay.stderr);
  const replayPayload = JSON.parse(replay.stdout);
  assert.equal(replayPayload.deterministicReplay, true);
  assert.equal(fs.existsSync(path.join(replayDir, 'replay-report.json')), true);
});

test('P4 debug-map-demo produces a compact demo report with deterministic replay', () => {
  const report = runDebugMapDemo();
  assert.equal(report.ok, true);
  assert.equal(report.version, RCL_DEBUG_REPLAY_VERSION);
  assert.equal(report.deterministicReplay, true);
  assert.equal(report.queryResults.stateQuery.ok, true);
  assert.equal(report.queryResults.semanticQuery.ok, true);
  assert.equal(report.queryResults.instructionQuery.ok, true);
  assert.ok(report.eventKindCounts['typed.object.creation'] > 0);
  assert.ok(report.eventKindCounts['typed.ref.creation'] > 0);
});

// Provider calls are mapped before execution so debug tooling can expose the
// provider boundary even when a host chooses a dedicated provider runtime.
test('P4 Source Map Runtime maps provider call RBC instructions', () => {
  const source = 'reality ProviderDebug { facet provider.reply : Text = provider_call("echo", "echo.text", "request") }';
  const result = buildSourceMapRuntime({ source, typeModuleSources: {} });
  assert.equal(result.ok, true);
  const providerInstruction = result.sourceMapRuntime.instructions.find(item => item.opcode === 'CALL_PROVIDER');
  assert.ok(providerInstruction);
  assert.equal(providerInstruction.operands.providerId, 'echo');
  assert.equal(providerInstruction.operands.capability, 'echo.text');
  assert.equal(providerInstruction.facet, 'provider.reply');
});
