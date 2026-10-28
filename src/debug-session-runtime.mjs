import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import {
  DEFAULT_DEBUG_REPLAY_SOURCE,
  DEFAULT_DEBUG_REPLAY_TYPE_MODULES,
  runExecutionTrace,
  replayTrace,
  RCL_EXECUTION_TRACE_FORMAT,
  RCL_DEBUG_REPLAY_VERSION,
} from './debug-replay-runtime.mjs';

export const RCL_STEP_DEBUG_VERSION = '0.39.0-alpha.1';
export const RCL_DEBUG_SESSION_FORMAT = 'rcl.debug-session.v0.39';
export const RCL_DEBUG_STEP_REPORT_FORMAT = 'rcl.debug-step-report.v0.39';
export const RCL_DEBUG_SESSION_RUN_REPORT_FORMAT = 'rcl.debug-session-run-report.v0.39';
export const RCL_DEBUG_CONFIG_FORMAT = 'rcl.debug-config.v0.39';
export const RCL_DEBUG_REPLAY_CURSOR_FORMAT = 'rcl.debug-replay-cursor.v1';

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

function cloneJson(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function requireDebugEvidence(condition, code) {
  if (!condition) { const error = new Error(code); error.code = code; throw error; }
}

function admitDebugTrace(trace) {
  requireDebugEvidence(trace?.format === RCL_EXECUTION_TRACE_FORMAT && trace.version === RCL_DEBUG_REPLAY_VERSION && Array.isArray(trace.events), 'RCL_DEBUG_TRACE_INVALID');
  let previous = 0;
  for (const event of trace.events) {
    requireDebugEvidence(event && Number.isSafeInteger(event.seq) && event.seq > previous && typeof event.kind === 'string' && event.kind.length > 0, 'RCL_DEBUG_TRACE_SEQUENCE_INVALID');
    previous = event.seq;
  }
  const replay = replayTrace(trace);
  requireDebugEvidence(replay.deterministicReplay, 'RCL_DEBUG_TRACE_ROOT_MISMATCH');
  requireDebugEvidence(trace.eventCount === trace.events.length && trace.eventKindCounts && typeof trace.eventKindCounts === 'object'
    && !Array.isArray(trace.eventKindCounts) && sha256(trace.eventKindCounts) === sha256(replay.eventKindCounts), 'RCL_DEBUG_TRACE_COUNTS_MISMATCH');
}

function readJson(pathname, fallback = {}) {
  if (!pathname) return fallback;
  return JSON.parse(fs.readFileSync(pathname, 'utf8'));
}

function locationEquals(source, breakpointLocation) {
  if (!source || !breakpointLocation) return false;
  if (breakpointLocation.file && source.file && path.basename(breakpointLocation.file) !== path.basename(source.file)) return false;
  if (breakpointLocation.line != null && Number(breakpointLocation.line) !== Number(source.line)) return false;
  if (breakpointLocation.column != null && Number(breakpointLocation.column) !== Number(source.column)) return false;
  return true;
}

function inferBreakpointKind(breakpoint = {}) {
  if (breakpoint.kind) return breakpoint.kind;
  if (breakpoint.facet) return 'facet';
  if (breakpoint.semanticNodeId) return 'semantic-node';
  if (breakpoint.instructionIndex != null) return 'rbc-instruction';
  if (breakpoint.eventKind) return 'event-kind';
  return 'source-location';
}

function inferWatchKind(watch = {}) {
  if (watch.kind) return watch.kind;
  if (watch.facet) return 'facet';
  if (watch.semanticNodeId) return 'semantic-node';
  if (watch.eventKind) return 'event-kind';
  return 'source-location';
}

export function normalizeDebugConfig(config = {}) {
  const breakpoints = (config.breakpoints ?? []).map((breakpoint, index) => ({
    id: breakpoint.id ?? `bp:${index + 1}`,
    kind: inferBreakpointKind(breakpoint),
    enabled: breakpoint.enabled !== false,
    ...breakpoint,
  }));
  const watchExpressions = (config.watchExpressions ?? config.watches ?? []).map((watch, index) => ({
    id: watch.id ?? `watch:${index + 1}`,
    kind: inferWatchKind(watch),
    enabled: watch.enabled !== false,
    ...watch,
  }));
  const traceWatchpoints = (config.traceWatchpoints ?? config.watchpoints ?? []).map((watchpoint, index) => ({
    id: watchpoint.id ?? `trace-wp:${index + 1}`,
    kind: inferWatchKind(watchpoint),
    ...watchpoint,
  }));
  const convertedBreakpoints = breakpoints
    .filter(item => item.enabled && ['facet', 'semantic-node', 'source-location', 'location'].includes(item.kind))
    .map(item => ({
      id: `trace-${item.id}`,
      kind: item.kind,
      facet: item.facet,
      semanticNodeId: item.semanticNodeId,
      location: item.location ?? item,
    }));
  return {
    format: config.format ?? RCL_DEBUG_CONFIG_FORMAT,
    version: config.version ?? RCL_STEP_DEBUG_VERSION,
    stopOnEntry: config.stopOnEntry !== false,
    maxFrames: config.maxFrames ?? null,
    breakpoints,
    watchExpressions,
    traceWatchpoints: [...traceWatchpoints, ...convertedBreakpoints],
    stepDefaults: {
      startFrameIndex: config.stepDefaults?.startFrameIndex ?? 0,
      continueTarget: config.stepDefaults?.continueTarget ?? 'next-pause',
    },
  };
}

function matchBreakpointShape(breakpoint, event) {
  if (!breakpoint.enabled) return false;
  if (breakpoint.kind === 'facet') return event.facet === breakpoint.facet;
  if (breakpoint.kind === 'semantic-node' || breakpoint.kind === 'semantic') return event.semanticNodeId === breakpoint.semanticNodeId;
  if (breakpoint.kind === 'source-location' || breakpoint.kind === 'location') return locationEquals(event.source, breakpoint.location ?? breakpoint);
  if (breakpoint.kind === 'rbc-instruction') return Number(event.rbc?.instructionIndex) === Number(breakpoint.instructionIndex);
  if (breakpoint.kind === 'event-kind') return event.kind === breakpoint.eventKind;
  return false;
}

function evaluateBreakpointCondition(condition, event, variableIndex) {
  if (!condition) return true;
  if (condition.op === 'event-kind-equals') return event.kind === condition.eventKind;
  if (condition.op === 'facet-value-kind-equals') return variableIndex[condition.facet]?.valueKind === condition.valueKind;
  if (condition.op === 'facet-value-root-equals') return variableIndex[condition.facet]?.valueRoot === condition.valueRoot;
  if (condition.op === 'event-has-source') return Boolean(event.source?.line);
  return false;
}

function breakpointHitsForEvent(breakpoints, event, variableIndex) {
  return breakpoints
    .filter(breakpoint => matchBreakpointShape(breakpoint, event))
    .filter(breakpoint => evaluateBreakpointCondition(breakpoint.condition, event, variableIndex))
    .map(breakpoint => ({
      id: breakpoint.id,
      kind: breakpoint.kind,
      condition: breakpoint.condition ?? null,
      facet: breakpoint.facet ?? event.facet ?? null,
      semanticNodeId: breakpoint.semanticNodeId ?? event.semanticNodeId ?? null,
      source: event.source ?? null,
      rbc: event.rbc ?? null,
    }));
}

function updateVariableIndex(variableIndex, event) {
  if (event.kind !== 'facet.evaluation' || !event.facet) return variableIndex;
  variableIndex[event.facet] = {
    facet: event.facet,
    seq: event.seq,
    semanticNodeId: event.semanticNodeId ?? null,
    source: event.source ?? null,
    declaredType: event.declaredType ?? null,
    canonicalType: event.canonicalType ?? null,
    expressionKind: event.expressionKind ?? null,
    valueKind: event.valueKind ?? null,
    valueRoot: event.valueRoot ?? null,
    valuePreview: event.valuePreview ?? null,
  };
  return variableIndex;
}

function resolveWatchExpression(watch, event, variableIndex, frameEvents) {
  if (watch.enabled === false) return { id: watch.id, enabled: false, hits: [] };
  if (watch.kind === 'facet') {
    const value = variableIndex[watch.facet] ?? null;
    return { id: watch.id, kind: watch.kind, expression: watch.facet, available: Boolean(value), value };
  }
  if (watch.kind === 'semantic-node' || watch.kind === 'semantic') {
    const values = Object.values(variableIndex).filter(item => item.semanticNodeId === watch.semanticNodeId);
    const events = frameEvents.filter(item => item.semanticNodeId === watch.semanticNodeId);
    return { id: watch.id, kind: watch.kind, expression: watch.semanticNodeId, available: values.length > 0 || events.length > 0, values, events: events.slice(-3) };
  }
  if (watch.kind === 'event-kind') {
    const count = frameEvents.filter(item => item.kind === watch.eventKind).length;
    return { id: watch.id, kind: watch.kind, expression: watch.eventKind, count, latest: frameEvents.filter(item => item.kind === watch.eventKind).slice(-1)[0] ?? null };
  }
  if (watch.kind === 'source-location' || watch.kind === 'location') {
    const events = frameEvents.filter(item => locationEquals(item.source, watch.location ?? watch));
    return { id: watch.id, kind: watch.kind, expression: watch.location ?? watch, count: events.length, latest: events.slice(-1)[0] ?? null };
  }
  return { id: watch.id, kind: watch.kind, available: false, unsupported: true };
}

function variableWindowForFrame(events, frame, watchExpressions) {
  const variableIndex = Object.create(null);
  const frameEvents = [];
  for (const event of events) {
    if (event.seq > frame.seq) break;
    frameEvents.push(event);
    updateVariableIndex(variableIndex, event);
  }
  return {
    frameIndex: frame.frameIndex,
    seq: frame.seq,
    variables: Object.fromEntries(Object.entries(variableIndex).sort(([a], [b]) => a.localeCompare(b))),
    watches: watchExpressions.map(watch => resolveWatchExpression(watch, frame.event, variableIndex, frameEvents)),
    variablesRoot: sha256(variableIndex),
    watchesRoot: sha256(watchExpressions.map(watch => resolveWatchExpression(watch, frame.event, variableIndex, frameEvents))),
  };
}

function makeFrame({ event, frameIndex, variableIndex, breakpoints, stopOnEntry }) {
  updateVariableIndex(variableIndex, event);
  const breakHits = breakpointHitsForEvent(breakpoints, event, variableIndex);
  const entryStop = stopOnEntry && frameIndex === 0;
  return {
    frameIndex,
    seq: event.seq,
    eventKind: event.kind,
    facet: event.facet ?? null,
    semanticNodeId: event.semanticNodeId ?? null,
    source: event.source ?? null,
    rbc: event.rbc ?? null,
    typedObject: event.objectId ? { objectId: event.objectId, objectKind: event.objectKind ?? null, canonicalType: event.canonicalType ?? null } : null,
    typedRef: event.refObjectId ? { refObjectId: event.refObjectId, targetKind: event.targetKind ?? null, targetType: event.targetType ?? null } : null,
    stopKind: entryStop ? 'entry' : (breakHits.length > 0 ? 'breakpoint' : null),
    breakHits,
    eventRoot: sha256(event),
  };
}

export function buildDebugSessionFromTrace(trace, config = {}) {
  admitDebugTrace(trace);
  const debugConfig = normalizeDebugConfig(config);
  return buildAdmittedDebugSession(trace, debugConfig);
}

function buildAdmittedDebugSession(trace, debugConfig) {
  requireDebugEvidence(Number.isSafeInteger(debugConfig.stepDefaults?.startFrameIndex) && debugConfig.stepDefaults.startFrameIndex >= 0,
    'RCL_DEBUG_FRAME_INDEX_INVALID');
  requireDebugEvidence(debugConfig.maxFrames === null || (Number.isSafeInteger(debugConfig.maxFrames) && debugConfig.maxFrames >= 0), 'RCL_DEBUG_MAX_FRAMES_INVALID');
  const variableIndex = Object.create(null);
  const frames = [];
  for (const event of trace.events) {
    if (debugConfig.maxFrames != null && frames.length >= Number(debugConfig.maxFrames)) break;
    frames.push(makeFrame({
      event,
      frameIndex: frames.length,
      variableIndex,
      breakpoints: debugConfig.breakpoints,
      stopOnEntry: debugConfig.stopOnEntry,
    }));
  }
  const pausePoints = frames
    .filter(frame => frame.stopKind === 'entry' || frame.breakHits.length > 0)
    .map(frame => ({
      frameIndex: frame.frameIndex,
      seq: frame.seq,
      stopKind: frame.stopKind,
      eventKind: frame.eventKind,
      facet: frame.facet,
      semanticNodeId: frame.semanticNodeId,
      source: frame.source,
      breakHits: frame.breakHits,
    }));
  const initialFrameIndex = Math.min(Number(debugConfig.stepDefaults.startFrameIndex ?? 0), Math.max(frames.length - 1, 0));
  const cursorFrame = frames[initialFrameIndex] ?? null;
  const sessionSeed = {
    format: RCL_DEBUG_SESSION_FORMAT,
    version: RCL_STEP_DEBUG_VERSION,
    program: trace.program,
    programRoot: trace.programRoot,
    traceRoot: trace.traceRoot,
    summaryRoot: trace.summaryRoot,
    breakpoints: debugConfig.breakpoints,
    watchExpressions: debugConfig.watchExpressions,
    frames: frames.map(frame => ({
      frameIndex: frame.frameIndex,
      seq: frame.seq,
      eventKind: frame.eventKind,
      facet: frame.facet,
      semanticNodeId: frame.semanticNodeId,
      source: frame.source,
      rbc: frame.rbc,
      stopKind: frame.stopKind,
      breakHits: frame.breakHits,
    })),
  };
  const session = {
    format: RCL_DEBUG_SESSION_FORMAT,
    version: RCL_STEP_DEBUG_VERSION,
    mode: 'trace-backed-step-debugger-seed',
    program: trace.program,
    programRoot: trace.programRoot,
    lockRoot: trace.lockRoot ?? null,
    sourceMapRoot: trace.sourceMapRoot ?? null,
    traceRoot: trace.traceRoot,
    summaryRoot: trace.summaryRoot,
    stateRoot: trace.stateRoot ?? null,
    gcSnapshotRoot: trace.gcSnapshotRoot ?? null,
    markSweepPlanRoot: trace.markSweepPlanRoot ?? null,
    config: debugConfig,
    sessionId: `rcl-debug-session:${sha256(sessionSeed).slice(0, 24)}`,
    cursor: cursorFrame ? {
      frameIndex: cursorFrame.frameIndex,
      seq: cursorFrame.seq,
      eventKind: cursorFrame.eventKind,
      stopKind: cursorFrame.stopKind,
    } : null,
    frames,
    pausePoints,
    breakpointHitCount: frames.reduce((sum, frame) => sum + frame.breakHits.length, 0),
    watchExpressionCount: debugConfig.watchExpressions.length,
    frameCount: frames.length,
    boundary: 'P4 v0.39 seed is a trace-backed debugger: it supports deterministic breakpoints, watch windows and step cursors over serialized events. It does not pause a live VM thread or expose a network DAP server yet.',
  };
  const cursorWindow = cursorFrame ? variableWindowForFrame(trace.events, { ...cursorFrame, event: trace.events.find(item => item.seq === cursorFrame.seq) }, debugConfig.watchExpressions) : null;
  session.cursorVariableWindow = cursorWindow;
  session.sessionRoot = sha256({ ...session, frames: session.frames, cursorVariableWindow: cursorWindow });
  return session;
}

function parseStepCommand(command = 'next') {
  let parsed;
  if (typeof command === 'number') parsed = { op: 'goto', seq: command };
  if (typeof command === 'string') {
    if (/^seq:\d+$/.test(command)) parsed = { op: 'goto', seq: Number(command.slice(4)) };
    else if (/^frame:\d+$/.test(command)) parsed = { op: 'goto-frame', frameIndex: Number(command.slice(6)) };
    else if (/^\d+$/.test(command)) parsed = { op: 'goto', seq: Number(command) };
    else parsed = { op: command };
  }
  if (command && typeof command === 'object' && !Array.isArray(command)) parsed = { ...command };
  requireDebugEvidence(parsed && typeof parsed.op === 'string', 'RCL_DEBUG_STEP_COMMAND_INVALID');
  const aliases = new Map([['stepBack', 'previous'], ['reverseContinue', 'reverse-continue']]);
  parsed.op = aliases.get(parsed.op) ?? parsed.op;
  requireDebugEvidence(['reset', 'next', 'step', 'step-into', 'previous', 'back', 'continue', 'reverse-continue', 'goto', 'goto-frame'].includes(parsed.op), 'RCL_DEBUG_STEP_COMMAND_INVALID');
  const allowed = ['op', 'fromFrameIndex', ...(parsed.op === 'goto' ? ['seq'] : []), ...(parsed.op === 'goto-frame' ? ['frameIndex'] : [])];
  requireDebugEvidence(Reflect.ownKeys(parsed).every(key => allowed.includes(key)), 'RCL_DEBUG_STEP_COMMAND_INVALID');
  if (parsed.fromFrameIndex !== undefined) requireDebugEvidence(Number.isSafeInteger(parsed.fromFrameIndex) && parsed.fromFrameIndex >= 0, 'RCL_DEBUG_FRAME_INDEX_INVALID');
  if (parsed.op === 'goto') requireDebugEvidence(Number.isSafeInteger(parsed.seq) && parsed.seq > 0, 'RCL_DEBUG_STEP_COMMAND_INVALID');
  if (parsed.op === 'goto-frame') requireDebugEvidence(Number.isSafeInteger(parsed.frameIndex) && parsed.frameIndex >= 0, 'RCL_DEBUG_FRAME_INDEX_INVALID');
  return parsed;
}

function resolveFrameForCommand(session, command = 'next') {
  const cmd = parseStepCommand(command);
  const currentIndex = Number(cmd.fromFrameIndex ?? session.cursor?.frameIndex ?? 0);
  requireDebugEvidence(Number.isSafeInteger(currentIndex) && currentIndex >= 0 && (currentIndex < session.frames.length || (!session.frames.length && currentIndex === 0)), 'RCL_DEBUG_FRAME_INDEX_INVALID');
  if (cmd.op === 'reset') return 0;
  if (cmd.op === 'next' || cmd.op === 'step' || cmd.op === 'step-into') return Math.min(currentIndex + 1, session.frames.length - 1);
  if (cmd.op === 'previous' || cmd.op === 'back') return Math.max(currentIndex - 1, 0);
  if (cmd.op === 'continue') {
    const nextPause = session.pausePoints.find(point => point.frameIndex > currentIndex);
    return nextPause?.frameIndex ?? Math.max(session.frames.length - 1, 0);
  }
  if (cmd.op === 'reverse-continue') {
    const previousPause = session.pausePoints.filter(point => point.frameIndex < currentIndex).at(-1);
    return previousPause?.frameIndex ?? 0;
  }
  if (cmd.op === 'goto') {
    const exact = session.frames.find(frame => Number(frame.seq) === Number(cmd.seq));
    requireDebugEvidence(Boolean(exact), 'RCL_DEBUG_SEQUENCE_NOT_FOUND');
    return exact.frameIndex;
  }
  if (cmd.op === 'goto-frame') return Math.max(0, Math.min(Number(cmd.frameIndex), session.frames.length - 1));
  return currentIndex;
}

export function stepDebugSession(sessionOrPath, options = {}) {
  const session = typeof sessionOrPath === 'string' ? JSON.parse(fs.readFileSync(sessionOrPath, 'utf8')) : sessionOrPath;
  const trace = options.trace ?? (options.tracePath ? JSON.parse(fs.readFileSync(options.tracePath, 'utf8')) : null);
  admitDebugSession(session, trace, options);
  return stepAdmittedDebugSession(session, trace, options);
}

function admitDebugSession(session, trace, options = {}) {
  requireDebugEvidence(session?.format === RCL_DEBUG_SESSION_FORMAT && Array.isArray(session.frames), 'RCL_DEBUG_SESSION_INVALID');
  const { sessionRoot, ...core } = session;
  requireDebugEvidence(sessionRoot === sha256(core), 'RCL_DEBUG_SESSION_ROOT_MISMATCH');
  if (options.expectedSessionRoot !== undefined) requireDebugEvidence(options.expectedSessionRoot === sessionRoot, 'RCL_DEBUG_EXPECTED_SESSION_ROOT_MISMATCH');
  if (options.expectedTraceRoot !== undefined) requireDebugEvidence(options.expectedTraceRoot === session.traceRoot, 'RCL_DEBUG_EXPECTED_TRACE_ROOT_MISMATCH');
  if (trace) {
    admitDebugTrace(trace);
    const rebuilt = buildAdmittedDebugSession(trace, session.config);
    requireDebugEvidence(rebuilt.sessionRoot === sessionRoot, 'RCL_DEBUG_SESSION_TRACE_MISMATCH');
  }
}

function cursorForFrame(frame) {
  return frame ? { frameIndex: frame.frameIndex, seq: frame.seq, eventKind: frame.eventKind, stopKind: frame.stopKind } : null;
}

function stepAdmittedDebugSession(session, trace, options = {}) {
  const command = parseStepCommand(options.command ?? 'next');
  const beforeCursor = cursorForFrame(session.frames[command.fromFrameIndex ?? session.cursor?.frameIndex ?? 0]);
  const nextFrameIndex = resolveFrameForCommand(session, command);
  const frame = session.frames[nextFrameIndex] ?? null;
  const event = trace?.events?.find(item => item.seq === frame?.seq) ?? frame;
  const variableWindow = trace && frame
    ? variableWindowForFrame(trace.events, { ...frame, event }, session.config?.watchExpressions ?? [])
    : null;
  const report = {
    format: RCL_DEBUG_STEP_REPORT_FORMAT,
    version: RCL_STEP_DEBUG_VERSION,
    sessionId: session.sessionId,
    sessionRoot: session.sessionRoot,
    command,
    beforeCursor,
    afterCursor: frame ? {
      frameIndex: frame.frameIndex,
      seq: frame.seq,
      eventKind: frame.eventKind,
      stopKind: frame.stopKind,
      done: frame.frameIndex >= session.frames.length - 1,
    } : null,
    frame,
    variableWindow,
    traceEvidenceVerified: Boolean(trace),
    breakpointHits: frame?.breakHits ?? [],
    pausePoint: Boolean(frame?.stopKind || frame?.breakHits?.length),
    boundary: session.boundary,
  };
  report.stepRoot = sha256(report);
  if (options.outputDir) {
    fs.mkdirSync(options.outputDir, { recursive: true });
    const supplied = options.command ?? 'next';
    const suffix = typeof supplied === 'string' ? supplied.replace(/[^a-zA-Z0-9_.-]/g, '_') : 'command';
    fs.writeFileSync(path.join(options.outputDir, `debug-step-${suffix}.json`), `${JSON.stringify(report, null, 2)}\n`);
  }
  return report;
}

export function createDebugReplayCursor(sessionOrPath, options = {}) {
  const session = cloneJson(typeof sessionOrPath === 'string' ? readJson(sessionOrPath) : sessionOrPath);
  const trace = cloneJson(options.trace ?? (options.tracePath ? readJson(options.tracePath) : null));
  requireDebugEvidence(Boolean(trace), 'RCL_DEBUG_CURSOR_TRACE_REQUIRED');
  admitDebugSession(session, trace, options);
  requireDebugEvidence(options.cursorSnapshot === undefined || options.startFrameIndex === undefined, 'RCL_DEBUG_CURSOR_SNAPSHOT_INVALID');
  const saved = cloneJson(options.cursorSnapshot);
  let frameIndex = saved !== undefined ? saved?.frameIndex ?? 0 : options.startFrameIndex ?? session.cursor?.frameIndex ?? 0;
  requireDebugEvidence(Number.isSafeInteger(frameIndex) && frameIndex >= 0 && (frameIndex < session.frames.length || (!session.frames.length && frameIndex === 0)), 'RCL_DEBUG_FRAME_INDEX_INVALID');
  const snapshot = () => {
    const frame = session.frames[frameIndex];
    const core = { format: RCL_DEBUG_REPLAY_CURSOR_FORMAT, sessionRoot: session.sessionRoot, traceRoot: trace.traceRoot,
      frameIndex: frame?.frameIndex ?? null, seq: frame?.seq ?? null, done: !frame || frameIndex >= session.frames.length - 1 };
    return { ...core, cursorRoot: sha256(core) };
  };
  if (saved !== undefined) requireDebugEvidence(sha256(saved) === sha256(snapshot()), 'RCL_DEBUG_CURSOR_SNAPSHOT_INVALID');
  if (options.expectedCursorRoot !== undefined) requireDebugEvidence(saved && options.expectedCursorRoot === saved.cursorRoot, 'RCL_DEBUG_EXPECTED_CURSOR_ROOT_MISMATCH');
  return Object.freeze({
    step(input = 'next') {
      const command = parseStepCommand(input);
      requireDebugEvidence(command.fromFrameIndex === undefined, 'RCL_DEBUG_CURSOR_ORIGIN_OVERRIDE');
      const report = stepAdmittedDebugSession(session, trace, { command: { ...command, fromFrameIndex: frameIndex } });
      frameIndex = report.afterCursor?.frameIndex ?? 0;
      return cloneJson(report);
    },
    snapshot,
  });
}

export function runDebugSession(input = {}, options = {}) {
  const source = input.source ?? (input.sourcePath ? fs.readFileSync(input.sourcePath, 'utf8') : DEFAULT_DEBUG_REPLAY_SOURCE);
  const debugConfig = normalizeDebugConfig(options.debugConfig ?? input.debugConfig ?? {});
  const traceInput = {
    source,
    sourcePath: input.sourcePath,
    typePath: input.typePath,
    watchpoints: debugConfig.traceWatchpoints,
    nativeRuntime: input.nativeRuntime ?? options.nativeRuntime ?? {},
  };
  if (input.typeModuleSources) traceInput.typeModuleSources = input.typeModuleSources;
  else if (!input.typePath) traceInput.typeModuleSources = DEFAULT_DEBUG_REPLAY_TYPE_MODULES;
  const traceResult = runExecutionTrace(traceInput);
  if (!traceResult.ok) return traceResult;
  const session = buildDebugSessionFromTrace(traceResult.trace, debugConfig);
  const nextStep = stepDebugSession(session, { trace: traceResult.trace, command: 'next' });
  const continueStep = stepDebugSession(session, { trace: traceResult.trace, command: 'continue' });
  return {
    ok: true,
    version: RCL_STEP_DEBUG_VERSION,
    trace: traceResult.trace,
    sourceMapRuntime: traceResult.sourceMapRuntime,
    replay: traceResult.replay,
    debugReport: traceResult.debugReport,
    session,
    nextStep,
    continueStep,
  };
}

export function writeDebugSessionReports(sourcePath, typePath, outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-debug-session-')), options = {}) {
  const debugConfig = normalizeDebugConfig(options.debugConfig ?? readJson(options.debugConfigPath, {}));
  const result = runDebugSession({ sourcePath, typePath, debugConfig }, { debugConfig, nativeRuntime: options.nativeRuntime ?? {} });
  if (!result.ok) return result;
  fs.mkdirSync(outputDir, { recursive: true });
  const paths = {
    tracePath: path.join(outputDir, 'trace.json'),
    sourceMapPath: path.join(outputDir, 'source-map-runtime.json'),
    debugSessionPath: path.join(outputDir, 'debug-session.json'),
    nextStepPath: path.join(outputDir, 'debug-step-next.json'),
    continueStepPath: path.join(outputDir, 'debug-step-continue.json'),
    debugReportPath: path.join(outputDir, 'debug-report.json'),
  };
  fs.writeFileSync(paths.tracePath, `${JSON.stringify(result.trace, null, 2)}\n`);
  fs.writeFileSync(paths.sourceMapPath, `${JSON.stringify(result.sourceMapRuntime, null, 2)}\n`);
  fs.writeFileSync(paths.debugSessionPath, `${JSON.stringify(result.session, null, 2)}\n`);
  fs.writeFileSync(paths.nextStepPath, `${JSON.stringify(result.nextStep, null, 2)}\n`);
  fs.writeFileSync(paths.continueStepPath, `${JSON.stringify(result.continueStep, null, 2)}\n`);
  fs.writeFileSync(paths.debugReportPath, `${JSON.stringify(result.debugReport, null, 2)}\n`);
  const report = {
    ok: true,
    format: RCL_DEBUG_SESSION_RUN_REPORT_FORMAT,
    version: RCL_STEP_DEBUG_VERSION,
    outputDir,
    ...paths,
    program: result.session.program,
    programRoot: result.session.programRoot,
    traceRoot: result.session.traceRoot,
    sessionId: result.session.sessionId,
    sessionRoot: result.session.sessionRoot,
    frameCount: result.session.frameCount,
    pausePointCount: result.session.pausePoints.length,
    breakpointHitCount: result.session.breakpointHitCount,
    watchExpressionCount: result.session.watchExpressionCount,
    deterministicReplay: result.replay.deterministicReplay,
    nextStepRoot: result.nextStep.stepRoot,
    continueStepRoot: result.continueStep.stepRoot,
    boundary: result.session.boundary,
  };
  report.runReportRoot = sha256(report);
  fs.writeFileSync(path.join(outputDir, 'debug-session-run-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

export function stepDebugSessionFromFiles(sessionPath, command = 'next', outputDir = null, options = {}) {
  const session = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
  const inferredTracePath = options.tracePath ?? path.join(path.dirname(sessionPath), 'trace.json');
  const tracePath = fs.existsSync(inferredTracePath) ? inferredTracePath : null;
  return stepDebugSession(session, { command, outputDir, tracePath });
}

export function runDebugSessionDemo(options = {}) {
  const debugConfig = normalizeDebugConfig(options.debugConfig ?? {
    stopOnEntry: true,
    breakpoints: [
      { id: 'bp-entry-session', kind: 'facet', facet: 'app.session' },
      { id: 'bp-login-ref-semantic', kind: 'semantic-node', semanticNodeId: 'facet:app.loginRef' },
      { id: 'bp-first-record-constructor', kind: 'event-kind', eventKind: 'typed.constructor' },
      { id: 'bp-store-session-rbc', kind: 'rbc-instruction', instructionIndex: 7, condition: { op: 'event-has-source' } },
    ],
    watchExpressions: [
      { id: 'watch-session', kind: 'facet', facet: 'app.session' },
      { id: 'watch-login-ref', kind: 'semantic-node', semanticNodeId: 'facet:app.loginRef' },
      { id: 'watch-typed-objects', kind: 'event-kind', eventKind: 'typed.object.creation' },
    ],
  });
  const result = runDebugSession({
    source: options.source ?? DEFAULT_DEBUG_REPLAY_SOURCE,
    typeModuleSources: options.typeModuleSources ?? DEFAULT_DEBUG_REPLAY_TYPE_MODULES,
    debugConfig,
  }, { debugConfig });
  if (!result.ok) return result;
  const firstPause = result.session.pausePoints[0] ?? null;
  return {
    ok: true,
    version: RCL_STEP_DEBUG_VERSION,
    format: RCL_DEBUG_SESSION_FORMAT,
    sessionId: result.session.sessionId,
    program: result.session.program,
    programRoot: result.session.programRoot,
    traceRoot: result.session.traceRoot,
    sessionRoot: result.session.sessionRoot,
    deterministicReplay: result.replay.deterministicReplay,
    frameCount: result.session.frameCount,
    pausePointCount: result.session.pausePoints.length,
    breakpointHitCount: result.session.breakpointHitCount,
    watchExpressionCount: result.session.watchExpressionCount,
    firstPause,
    cursorVariableWindowRoot: result.session.cursorVariableWindow?.variablesRoot ?? null,
    nextStepRoot: result.nextStep.stepRoot,
    continueStepRoot: result.continueStep.stepRoot,
    boundary: result.session.boundary,
  };
}
