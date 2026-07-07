import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import {
  DEFAULT_DEBUG_REPLAY_SOURCE,
  DEFAULT_DEBUG_REPLAY_TYPE_MODULES,
  RCL_EXECUTION_TRACE_FORMAT,
  replayTrace,
} from './debug-replay-runtime.mjs';
import {
  RCL_DEBUG_SESSION_FORMAT,
  runDebugSession,
} from './debug-session-runtime.mjs';

export const RCL_PROFILER_DEBUG_UI_VERSION = '0.40.0-alpha.1';
export const RCL_PROFILER_REPORT_FORMAT = 'rcl.profiler-report.v0.40';
export const RCL_FLAMEGRAPH_FORMAT = 'rcl.flamegraph.v0.40';
export const RCL_REPLAY_INPUT_BUNDLE_FORMAT = 'rcl.replay-input-bundle.v0.40';
export const RCL_REPLAY_BUNDLE_VERIFICATION_FORMAT = 'rcl.replay-bundle-verification.v0.40';
export const RCL_DEBUG_UI_PROTOCOL_FORMAT = 'rcl.debug-ui-protocol.v0.40';
export const RCL_PROFILE_RUN_REPORT_FORMAT = 'rcl.profile-run-report.v0.40';

const EVENT_KIND_COSTS = Object.freeze({
  'facet.evaluation': 8,
  'rbc.instruction': 1,
  'typed.constructor': 7,
  'typed.field.access': 3,
  'typed.match.branch': 5,
  'provider.call': 30,
  'resource.operation': 14,
  'gc.snapshot.root': 21,
  'gc.mark_sweep.root': 18,
  'typed.object.creation': 9,
  'typed.ref.creation': 6,
  'watchpoint.hit': 2,
});

function sortJson(value) {
  if (Array.isArray(value)) return value.map(sortJson);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, sortJson(item)]));
}

function stableJson(value) {
  return JSON.stringify(sortJson(value));
}

function sha256(value) {
  return createHash('sha256').update(typeof value === 'string' ? value : stableJson(value)).digest('hex');
}

function readJson(pathname, fallback = null) {
  if (!pathname) return fallback;
  return JSON.parse(fs.readFileSync(pathname, 'utf8'));
}

function asTrace(traceOrPath) {
  const trace = typeof traceOrPath === 'string' ? readJson(traceOrPath) : traceOrPath;
  if (!trace?.events || !Array.isArray(trace.events)) throw new TypeError('execution trace with events is required');
  return trace;
}

function eventFingerprint(event) {
  return sha256({
    seq: event.seq,
    kind: event.kind,
    facet: event.facet ?? null,
    semanticNodeId: event.semanticNodeId ?? null,
    source: event.source ?? null,
    rbc: event.rbc ?? null,
    valueRoot: event.valueRoot ?? null,
    objectId: event.objectId ?? null,
    refObjectId: event.refObjectId ?? null,
    snapshotRoot: event.snapshotRoot ?? null,
    planRoot: event.planRoot ?? null,
    providerId: event.providerId ?? null,
    capability: event.capability ?? null,
    resourceKind: event.resourceKind ?? null,
    operation: event.operation ?? null,
  });
}

function eventCostUnits(event) {
  const base = EVENT_KIND_COSTS[event.kind] ?? 4;
  const operandCost = event.rbc?.operands ? Object.keys(event.rbc.operands).length : 0;
  const typedCost = event.canonicalType ? 2 : 0;
  const providerCost = event.providerId || event.capability ? 8 : 0;
  const resourceCost = event.resourceKind || event.operation ? 4 : 0;
  const objectCost = event.objectId || event.refObjectId ? 3 : 0;
  const gcCost = event.rootCount != null || event.retainedCount != null
    ? Number(event.rootCount ?? 0) + Number(event.retainedCount ?? 0) + Number(event.referenceCount ?? 0)
    : 0;
  return base + operandCost + typedCost + providerCost + resourceCost + objectCost + gcCost;
}

function metricBucket(id, label, kind, extra = {}) {
  return {
    id,
    label,
    kind,
    count: 0,
    costUnits: 0,
    firstSeq: null,
    lastSeq: null,
    eventRoots: [],
    ...extra,
  };
}

function addMetric(map, key, label, kind, event, cost, extra = {}) {
  const id = String(key ?? 'unknown');
  if (!map.has(id)) map.set(id, metricBucket(id, label ?? id, kind, extra));
  const bucket = map.get(id);
  bucket.count += 1;
  bucket.costUnits += cost;
  bucket.firstSeq = bucket.firstSeq == null ? event.seq : Math.min(bucket.firstSeq, event.seq);
  bucket.lastSeq = bucket.lastSeq == null ? event.seq : Math.max(bucket.lastSeq, event.seq);
  bucket.eventRoots.push(eventFingerprint(event));
  return bucket;
}

function finalizeMetrics(map) {
  return [...map.values()]
    .map(item => ({
      ...item,
      eventRoots: item.eventRoots.slice(0, 12),
      metricRoot: sha256({ ...item, eventRoots: item.eventRoots }),
    }))
    .sort((a, b) => b.costUnits - a.costUnits || b.count - a.count || a.id.localeCompare(b.id));
}

function flameNode(name, kind, value = 0, children = [], extra = {}) {
  return { name, kind, value, unit: 'deterministic-cost-units', children, ...extra };
}

function buildFlamegraph({ trace, byKind, byFacet, byProvider, byResource, byOpcode, totalCostUnits }) {
  const kindChildren = byKind.map(metric => flameNode(metric.id, 'event-kind', metric.costUnits, [], { count: metric.count }));
  const facetChildren = byFacet.map(metric => flameNode(metric.label, 'facet', metric.costUnits, [], { facet: metric.id, count: metric.count }));
  const providerChildren = byProvider.map(metric => flameNode(metric.label, 'provider', metric.costUnits, [], { provider: metric.providerId, capability: metric.capability, count: metric.count }));
  const resourceChildren = byResource.map(metric => flameNode(metric.label, 'resource', metric.costUnits, [], { resourceKind: metric.resourceKind, operation: metric.operation, count: metric.count }));
  const opcodeChildren = byOpcode.map(metric => flameNode(metric.id, 'rbc-opcode', metric.costUnits, [], { count: metric.count }));
  const root = flameNode(trace.program ?? 'program', 'program', totalCostUnits, [
    flameNode('event-kinds', 'group', kindChildren.reduce((sum, item) => sum + item.value, 0), kindChildren),
    flameNode('facets', 'group', facetChildren.reduce((sum, item) => sum + item.value, 0), facetChildren),
    flameNode('providers', 'group', providerChildren.reduce((sum, item) => sum + item.value, 0), providerChildren),
    flameNode('resources', 'group', resourceChildren.reduce((sum, item) => sum + item.value, 0), resourceChildren),
    flameNode('rbc-opcodes', 'group', opcodeChildren.reduce((sum, item) => sum + item.value, 0), opcodeChildren),
  ], { programRoot: trace.programRoot, traceRoot: trace.traceRoot });
  const flamegraph = {
    format: RCL_FLAMEGRAPH_FORMAT,
    version: RCL_PROFILER_DEBUG_UI_VERSION,
    mode: 'deterministic-trace-cost-flamegraph-seed',
    root,
  };
  flamegraph.flamegraphRoot = sha256(flamegraph);
  return flamegraph;
}

export function buildProfilerReportFromTrace(traceOrPath, options = {}) {
  const trace = asTrace(traceOrPath);
  if (trace.format && trace.format !== RCL_EXECUTION_TRACE_FORMAT) throw new TypeError(`unsupported trace format: ${trace.format}`);
  const byKind = new Map();
  const byFacet = new Map();
  const byProvider = new Map();
  const byResource = new Map();
  const byOpcode = new Map();
  const sequence = [];
  let totalCostUnits = 0;

  for (const event of trace.events) {
    const cost = eventCostUnits(event);
    totalCostUnits += cost;
    const root = eventFingerprint(event);
    sequence.push({ seq: event.seq, kind: event.kind, facet: event.facet ?? null, costUnits: cost, eventRoot: root });
    addMetric(byKind, event.kind, event.kind, 'event-kind', event, cost);
    if (event.facet) addMetric(byFacet, event.facet, event.facet, 'facet', event, cost, { facet: event.facet });
    if (event.providerId || event.capability) {
      addMetric(byProvider, `${event.providerId ?? 'unknown'}:${event.capability ?? 'unknown'}`, `${event.providerId ?? 'unknown'} / ${event.capability ?? 'unknown'}`, 'provider', event, cost, { providerId: event.providerId ?? null, capability: event.capability ?? null });
    }
    if (event.resourceKind || event.operation) {
      addMetric(byResource, `${event.resourceKind ?? 'resource'}:${event.operation ?? 'operation'}`, `${event.resourceKind ?? 'resource'} / ${event.operation ?? 'operation'}`, 'resource', event, cost, { resourceKind: event.resourceKind ?? null, operation: event.operation ?? null });
    }
    if (event.rbc?.opcode) addMetric(byOpcode, event.rbc.opcode, event.rbc.opcode, 'rbc-opcode', event, cost);
  }

  const metrics = {
    byKind: finalizeMetrics(byKind),
    byFacet: finalizeMetrics(byFacet),
    byProvider: finalizeMetrics(byProvider),
    byResource: finalizeMetrics(byResource),
    byOpcode: finalizeMetrics(byOpcode),
  };
  const hotPath = [
    ...metrics.byFacet.map(item => ({ source: 'facet', id: item.id, label: item.label, costUnits: item.costUnits, count: item.count })),
    ...metrics.byProvider.map(item => ({ source: 'provider', id: item.id, label: item.label, costUnits: item.costUnits, count: item.count })),
    ...metrics.byResource.map(item => ({ source: 'resource', id: item.id, label: item.label, costUnits: item.costUnits, count: item.count })),
    ...metrics.byKind.map(item => ({ source: 'event-kind', id: item.id, label: item.label, costUnits: item.costUnits, count: item.count })),
  ].sort((a, b) => b.costUnits - a.costUnits || b.count - a.count || a.id.localeCompare(b.id)).slice(0, Number(options.hotPathLimit ?? 12));
  const flamegraph = buildFlamegraph({ trace, ...metrics, totalCostUnits });
  const report = {
    format: RCL_PROFILER_REPORT_FORMAT,
    version: RCL_PROFILER_DEBUG_UI_VERSION,
    mode: 'deterministic-trace-profiler-seed',
    program: trace.program,
    programRoot: trace.programRoot,
    lockRoot: trace.lockRoot ?? null,
    sourceMapRoot: trace.sourceMapRoot ?? null,
    traceRoot: trace.traceRoot,
    summaryRoot: trace.summaryRoot,
    eventCount: trace.events.length,
    eventKindCounts: trace.eventKindCounts ?? {},
    totalCostUnits,
    costModel: {
      unit: 'deterministic-cost-units',
      weights: EVENT_KIND_COSTS,
      note: 'v0.40 profiler seed uses deterministic trace-derived cost units until live high-resolution VM timers and provider duration probes are available.',
    },
    nativeMetrics: trace.nativeMetrics ?? {},
    metrics,
    hotPath,
    flamegraph,
    sequenceRoot: sha256(sequence),
    boundary: 'Profiler seed is deterministic and trace-derived. It reports cost units, hot facets, RBC opcodes, provider/resource costs and flamegraph data, but does not yet sample live wall-clock stacks or enforce performance regressions.',
  };
  report.profilerRoot = sha256(report);
  return report;
}

export function buildReplayInputBundle(traceOrPath, options = {}) {
  const trace = asTrace(traceOrPath);
  const replay = options.replay ?? replayTrace(trace);
  const eventFingerprints = trace.events.map(event => ({ seq: event.seq, kind: event.kind, fingerprint: eventFingerprint(event) }));
  const bundle = {
    format: RCL_REPLAY_INPUT_BUNDLE_FORMAT,
    version: RCL_PROFILER_DEBUG_UI_VERSION,
    mode: 'single-process-deterministic-replay-input-bundle',
    program: trace.program,
    programRoot: trace.programRoot,
    lockRoot: trace.lockRoot ?? null,
    typeModuleRoot: trace.typeModuleRoot ?? null,
    sourceMapRoot: trace.sourceMapRoot ?? null,
    bytecodeRoot: trace.bytecodeRoot ?? null,
    stateRoot: trace.stateRoot ?? null,
    traceRoot: trace.traceRoot,
    summaryRoot: trace.summaryRoot,
    replayRoot: replay.replayRoot,
    deterministicReplay: replay.deterministicReplay,
    gcSnapshotRoot: trace.gcSnapshotRoot ?? null,
    heapSnapshotRoot: trace.heapSnapshotRoot ?? null,
    markSweepPlanRoot: trace.markSweepPlanRoot ?? null,
    nativeMetrics: trace.nativeMetrics ?? {},
    eventCount: trace.events.length,
    eventKindCounts: trace.eventKindCounts ?? {},
    eventFingerprintRoot: sha256(eventFingerprints),
    eventFingerprints: options.includeEventFingerprints === false ? undefined : eventFingerprints,
    replayPolicy: {
      process: 'single-process',
      externalProviders: 'do-not-recall-external-provider; replay serialized provider boundary events only',
      resources: 'replay serialized resource operation evidence only',
      distributedActors: 'not-yet-supported',
    },
    inputHints: {
      sourcePath: options.sourcePath ?? null,
      typePath: options.typePath ?? null,
      debugConfigRoot: options.debugConfig ? sha256(options.debugConfig) : null,
    },
  };
  bundle.bundleRoot = sha256(bundle);
  return bundle;
}

export function verifyReplayInputBundle(bundleOrPath, traceOrPath) {
  const bundle = typeof bundleOrPath === 'string' ? readJson(bundleOrPath) : bundleOrPath;
  const trace = asTrace(traceOrPath);
  const expected = buildReplayInputBundle(trace, { includeEventFingerprints: bundle.eventFingerprints !== undefined });
  const checks = {
    format: bundle.format === RCL_REPLAY_INPUT_BUNDLE_FORMAT,
    programRoot: bundle.programRoot === trace.programRoot,
    lockRoot: bundle.lockRoot === (trace.lockRoot ?? null),
    sourceMapRoot: bundle.sourceMapRoot === (trace.sourceMapRoot ?? null),
    traceRoot: bundle.traceRoot === trace.traceRoot,
    summaryRoot: bundle.summaryRoot === trace.summaryRoot,
    eventFingerprintRoot: bundle.eventFingerprintRoot === expected.eventFingerprintRoot,
    eventCount: bundle.eventCount === trace.events.length,
    deterministicReplay: bundle.deterministicReplay === replayTrace(trace).deterministicReplay,
  };
  const result = {
    format: RCL_REPLAY_BUNDLE_VERIFICATION_FORMAT,
    version: RCL_PROFILER_DEBUG_UI_VERSION,
    ok: Object.values(checks).every(Boolean),
    bundleRoot: bundle.bundleRoot ?? null,
    expectedBundleRoot: expected.bundleRoot,
    checks,
  };
  result.verificationRoot = sha256(result);
  return result;
}

function variableRowsFromWindow(window) {
  return Object.values(window?.variables ?? {}).map(item => ({
    name: item.facet,
    kind: item.valueKind,
    type: item.canonicalType ?? item.declaredType ?? null,
    valueRoot: item.valueRoot ?? null,
    preview: item.valuePreview ?? null,
    source: item.source ?? null,
  })).sort((a, b) => a.name.localeCompare(b.name));
}

function compactFrame(frame) {
  return {
    id: frame.frameIndex,
    name: frame.facet ?? frame.eventKind,
    seq: frame.seq,
    eventKind: frame.eventKind,
    source: frame.source ?? null,
    rbc: frame.rbc ?? null,
    stopKind: frame.stopKind ?? null,
  };
}

export function buildDebugUiProtocol({ trace, debugSession, profiler, replayBundle } = {}) {
  if (!trace && !debugSession) throw new TypeError('trace or debugSession is required');
  const session = debugSession ?? null;
  const frames = session?.frames ?? (trace?.events ?? []).map((event, index) => ({ frameIndex: index, seq: event.seq, eventKind: event.kind, facet: event.facet ?? null, source: event.source ?? null, rbc: event.rbc ?? null, stopKind: null, breakHits: [] }));
  const currentFrame = session?.cursor ? frames[session.cursor.frameIndex] : frames[0] ?? null;
  const variables = variableRowsFromWindow(session?.cursorVariableWindow);
  const profile = profiler ?? (trace ? buildProfilerReportFromTrace(trace) : null);
  const replay = replayBundle ?? (trace ? buildReplayInputBundle(trace) : null);
  const messages = [
    { seq: 1, type: 'response', command: 'initialize', success: true, body: { adapterID: 'rcl-debug-ui-seed', supportsStep: Boolean(session), supportsConfigurationDoneRequest: false, supportsSetVariable: false, supportsProfiler: Boolean(profile), supportsReplayBundle: Boolean(replay) } },
    { seq: 2, type: 'event', event: 'loadedSource', body: { program: trace?.program ?? session?.program ?? null, programRoot: trace?.programRoot ?? session?.programRoot ?? null, sourceMapRoot: trace?.sourceMapRoot ?? session?.sourceMapRoot ?? null } },
    { seq: 3, type: 'event', event: 'traceSummary', body: { traceRoot: trace?.traceRoot ?? session?.traceRoot ?? null, summaryRoot: trace?.summaryRoot ?? session?.summaryRoot ?? null, eventCount: trace?.eventCount ?? trace?.events?.length ?? session?.frameCount ?? 0, eventKindCounts: trace?.eventKindCounts ?? {} } },
    { seq: 4, type: 'event', event: 'stopped', body: { reason: currentFrame?.stopKind ?? 'entry', frameId: currentFrame?.frameIndex ?? 0, seq: currentFrame?.seq ?? null, breakHits: currentFrame?.breakHits ?? [] } },
    { seq: 5, type: 'response', command: 'stackTrace', success: true, body: { stackFrames: frames.slice(0, 64).map(compactFrame), totalFrames: frames.length } },
    { seq: 6, type: 'response', command: 'scopes', success: true, body: { scopes: [{ name: 'Facet Variables', variablesReference: 1 }, { name: 'Watch Expressions', variablesReference: 2 }, { name: 'Profiler', variablesReference: 3 }, { name: 'Replay Bundle', variablesReference: 4 }] } },
    { seq: 7, type: 'response', command: 'variables', success: true, body: { variables } },
    { seq: 8, type: 'event', event: 'profileSummary', body: profile ? { profilerRoot: profile.profilerRoot, totalCostUnits: profile.totalCostUnits, hotPath: profile.hotPath.slice(0, 8) } : null },
    { seq: 9, type: 'event', event: 'flamegraph', body: profile?.flamegraph ?? null },
    { seq: 10, type: 'event', event: 'replayBundle', body: replay ? { bundleRoot: replay.bundleRoot, traceRoot: replay.traceRoot, deterministicReplay: replay.deterministicReplay, eventFingerprintRoot: replay.eventFingerprintRoot } : null },
  ];
  const protocol = {
    format: RCL_DEBUG_UI_PROTOCOL_FORMAT,
    version: RCL_PROFILER_DEBUG_UI_VERSION,
    mode: 'debug-ui-protocol-seed',
    compatibleWith: ['trace-viewer-json', 'dap-shape-seed'],
    capabilities: {
      sourceMap: Boolean(trace?.sourceMapRoot ?? session?.sourceMapRoot),
      trace: Boolean(trace),
      replayBundle: Boolean(replay),
      profiler: Boolean(profile),
      flamegraph: Boolean(profile?.flamegraph),
      stepDebugger: Boolean(session),
      variableWindow: variables.length > 0,
      livePauseResume: false,
      setVariable: false,
      lspBridge: false,
      dapServer: false,
    },
    program: trace?.program ?? session?.program ?? null,
    programRoot: trace?.programRoot ?? session?.programRoot ?? null,
    traceRoot: trace?.traceRoot ?? session?.traceRoot ?? null,
    sessionRoot: session?.sessionRoot ?? null,
    profilerRoot: profile?.profilerRoot ?? null,
    replayBundleRoot: replay?.bundleRoot ?? null,
    messages,
    boundary: 'Debug UI Protocol v0.40 is a serializable protocol seed for UI/DAP-like clients. It does not start a socket server, LSP server or live VM pause/resume loop yet.',
  };
  protocol.protocolRoot = sha256(protocol);
  return protocol;
}

export function runProfilerDebugUi(input = {}, options = {}) {
  const debugConfig = options.debugConfig ?? input.debugConfig ?? {};
  const result = runDebugSession({
    source: input.source ?? DEFAULT_DEBUG_REPLAY_SOURCE,
    sourcePath: input.sourcePath,
    typePath: input.typePath,
    typeModuleSources: input.typeModuleSources ?? DEFAULT_DEBUG_REPLAY_TYPE_MODULES,
    debugConfig,
  }, { debugConfig, nativeRuntime: options.nativeRuntime ?? {} });
  if (!result.ok) return result;
  const profiler = buildProfilerReportFromTrace(result.trace, options.profiler ?? {});
  const replayBundle = buildReplayInputBundle(result.trace, { sourcePath: input.sourcePath ?? null, typePath: input.typePath ?? null, debugConfig });
  const replayVerification = verifyReplayInputBundle(replayBundle, result.trace);
  const debugUiProtocol = buildDebugUiProtocol({ trace: result.trace, debugSession: result.session, profiler, replayBundle });
  return { ok: true, version: RCL_PROFILER_DEBUG_UI_VERSION, trace: result.trace, session: result.session, profiler, replayBundle, replayVerification, debugUiProtocol };
}

export function writeReplayInputBundle(tracePath, outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-replay-bundle-')), options = {}) {
  const trace = asTrace(tracePath);
  const bundle = buildReplayInputBundle(trace, options);
  const verification = verifyReplayInputBundle(bundle, trace);
  fs.mkdirSync(outputDir, { recursive: true });
  const replayBundlePath = path.join(outputDir, 'replay-input-bundle.json');
  const verificationPath = path.join(outputDir, 'replay-bundle-verification.json');
  fs.writeFileSync(replayBundlePath, `${JSON.stringify(bundle, null, 2)}\n`);
  fs.writeFileSync(verificationPath, `${JSON.stringify(verification, null, 2)}\n`);
  return {
    ok: true,
    version: RCL_PROFILER_DEBUG_UI_VERSION,
    outputDir,
    replayBundlePath,
    verificationPath,
    bundleRoot: bundle.bundleRoot,
    verificationRoot: verification.verificationRoot,
    deterministicReplay: bundle.deterministicReplay,
    eventFingerprintRoot: bundle.eventFingerprintRoot,
  };
}

export function buildDebugUiProtocolFromFiles(sessionPath, outputDir = null, options = {}) {
  const debugSession = readJson(sessionPath);
  const baseDir = path.dirname(sessionPath);
  const tracePath = options.tracePath ?? path.join(baseDir, 'trace.json');
  const profilerPath = options.profilerPath ?? path.join(baseDir, 'profiler-report.json');
  const replayBundlePath = options.replayBundlePath ?? path.join(baseDir, 'replay-input-bundle.json');
  const trace = fs.existsSync(tracePath) ? readJson(tracePath) : null;
  const profiler = fs.existsSync(profilerPath) ? readJson(profilerPath) : (trace ? buildProfilerReportFromTrace(trace) : null);
  const replayBundle = fs.existsSync(replayBundlePath) ? readJson(replayBundlePath) : (trace ? buildReplayInputBundle(trace) : null);
  const protocol = buildDebugUiProtocol({ trace, debugSession, profiler, replayBundle });
  if (outputDir) {
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(path.join(outputDir, 'debug-ui-protocol.json'), `${JSON.stringify(protocol, null, 2)}\n`);
  }
  return protocol;
}

export function writeProfilerDebugUiReports(sourcePath, typePath, outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-profile-run-')), options = {}) {
  const debugConfig = options.debugConfig ?? readJson(options.debugConfigPath, {});
  const result = runProfilerDebugUi({ sourcePath, typePath, debugConfig }, { debugConfig, nativeRuntime: options.nativeRuntime ?? {} });
  if (!result.ok) return result;
  fs.mkdirSync(outputDir, { recursive: true });
  const paths = {
    tracePath: path.join(outputDir, 'trace.json'),
    debugSessionPath: path.join(outputDir, 'debug-session.json'),
    profilerReportPath: path.join(outputDir, 'profiler-report.json'),
    flamegraphPath: path.join(outputDir, 'flamegraph.json'),
    replayBundlePath: path.join(outputDir, 'replay-input-bundle.json'),
    replayVerificationPath: path.join(outputDir, 'replay-bundle-verification.json'),
    debugUiProtocolPath: path.join(outputDir, 'debug-ui-protocol.json'),
  };
  fs.writeFileSync(paths.tracePath, `${JSON.stringify(result.trace, null, 2)}\n`);
  fs.writeFileSync(paths.debugSessionPath, `${JSON.stringify(result.session, null, 2)}\n`);
  fs.writeFileSync(paths.profilerReportPath, `${JSON.stringify(result.profiler, null, 2)}\n`);
  fs.writeFileSync(paths.flamegraphPath, `${JSON.stringify(result.profiler.flamegraph, null, 2)}\n`);
  fs.writeFileSync(paths.replayBundlePath, `${JSON.stringify(result.replayBundle, null, 2)}\n`);
  fs.writeFileSync(paths.replayVerificationPath, `${JSON.stringify(result.replayVerification, null, 2)}\n`);
  fs.writeFileSync(paths.debugUiProtocolPath, `${JSON.stringify(result.debugUiProtocol, null, 2)}\n`);
  const report = {
    ok: true,
    format: RCL_PROFILE_RUN_REPORT_FORMAT,
    version: RCL_PROFILER_DEBUG_UI_VERSION,
    outputDir,
    ...paths,
    program: result.trace.program,
    programRoot: result.trace.programRoot,
    traceRoot: result.trace.traceRoot,
    sessionRoot: result.session.sessionRoot,
    profilerRoot: result.profiler.profilerRoot,
    flamegraphRoot: result.profiler.flamegraph.flamegraphRoot,
    replayBundleRoot: result.replayBundle.bundleRoot,
    replayVerificationRoot: result.replayVerification.verificationRoot,
    debugUiProtocolRoot: result.debugUiProtocol.protocolRoot,
    deterministicReplay: result.replayBundle.deterministicReplay,
    eventCount: result.trace.eventCount,
    totalCostUnits: result.profiler.totalCostUnits,
    hotPath: result.profiler.hotPath.slice(0, 8),
    boundary: result.debugUiProtocol.boundary,
  };
  report.runReportRoot = sha256(report);
  fs.writeFileSync(path.join(outputDir, 'profile-run-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

export function runProfilerDemo(options = {}) {
  const result = runProfilerDebugUi({
    source: options.source ?? DEFAULT_DEBUG_REPLAY_SOURCE,
    typeModuleSources: options.typeModuleSources ?? DEFAULT_DEBUG_REPLAY_TYPE_MODULES,
    debugConfig: options.debugConfig ?? {},
  });
  if (!result.ok) return result;
  return {
    ok: true,
    version: RCL_PROFILER_DEBUG_UI_VERSION,
    format: RCL_PROFILER_REPORT_FORMAT,
    program: result.profiler.program,
    programRoot: result.profiler.programRoot,
    traceRoot: result.profiler.traceRoot,
    profilerRoot: result.profiler.profilerRoot,
    flamegraphRoot: result.profiler.flamegraph.flamegraphRoot,
    totalCostUnits: result.profiler.totalCostUnits,
    topHotPath: result.profiler.hotPath.slice(0, 5),
    byKindCount: result.profiler.metrics.byKind.length,
    byFacetCount: result.profiler.metrics.byFacet.length,
    deterministicReplay: result.replayBundle.deterministicReplay,
    boundary: result.profiler.boundary,
  };
}

export function runDebugUiDemo(options = {}) {
  const result = runProfilerDebugUi({
    source: options.source ?? DEFAULT_DEBUG_REPLAY_SOURCE,
    typeModuleSources: options.typeModuleSources ?? DEFAULT_DEBUG_REPLAY_TYPE_MODULES,
    debugConfig: options.debugConfig ?? { stopOnEntry: true, breakpoints: [{ id: 'bp-session', facet: 'app.session' }], watchExpressions: [{ id: 'watch-session', facet: 'app.session' }] },
  });
  if (!result.ok) return result;
  return {
    ok: true,
    version: RCL_PROFILER_DEBUG_UI_VERSION,
    format: RCL_DEBUG_UI_PROTOCOL_FORMAT,
    protocolRoot: result.debugUiProtocol.protocolRoot,
    capabilities: result.debugUiProtocol.capabilities,
    messageCount: result.debugUiProtocol.messages.length,
    profilerRoot: result.profiler.profilerRoot,
    replayBundleRoot: result.replayBundle.bundleRoot,
    deterministicReplay: result.replayBundle.deterministicReplay,
    sampleMessages: result.debugUiProtocol.messages.slice(0, 4),
    boundary: result.debugUiProtocol.boundary,
  };
}
