import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import {
  DEFAULT_DEBUG_REPLAY_SOURCE,
  DEFAULT_DEBUG_REPLAY_TYPE_MODULES,
  buildSourceMapRuntime,
} from './debug-replay-runtime.mjs';
import {
  runDebugSession,
} from './debug-session-runtime.mjs';
import {
  buildDebugUiProtocol,
  runProfilerDebugUi,
} from './profiler-debug-ui-runtime.mjs';

export const RCL_IDE_BRIDGE_VERSION = '0.41.0-alpha.1';
export const RCL_LSP_INDEX_FORMAT = 'rcl.lsp-index.v0.41';
export const RCL_LSP_QUERY_REPORT_FORMAT = 'rcl.lsp-query-report.v0.41';
export const RCL_DAP_BRIDGE_FORMAT = 'rcl.dap-bridge.v0.41';
export const RCL_IDE_BRIDGE_REPORT_FORMAT = 'rcl.ide-bridge-report.v0.41';

export const RCL_LSP_SEMANTIC_TOKEN_TYPES = Object.freeze([
  'namespace',
  'type',
  'property',
  'variable',
  'function',
  'keyword',
  'string',
  'number',
  'operator',
]);

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

function readText(pathname, fallback = '') {
  return pathname ? fs.readFileSync(pathname, 'utf8') : fallback;
}

function isExistingPath(value) {
  return typeof value === 'string' && value.length > 0 && fs.existsSync(value);
}

function sourceUri(sourcePath, sourceFile = null) {
  const p = sourcePath ?? sourceFile;
  if (!p) return 'rcl://memory/debug-replay.rcl';
  try {
    return pathToFileURL(path.resolve(p)).href;
  } catch {
    return `rcl://source/${encodeURIComponent(String(p))}`;
  }
}

function sourceNameFromUri(uri) {
  if (!uri) return 'debug-replay.rcl';
  if (uri.startsWith('file://')) {
    try { return path.basename(fileURLToPath(uri)); } catch { return path.basename(uri); }
  }
  return path.basename(uri) || 'debug-replay.rcl';
}

function lspPosition(location) {
  return {
    line: Math.max(0, Number(location?.line ?? 1) - 1),
    character: Math.max(0, Number(location?.column ?? 1) - 1),
  };
}

function lspRange(location, length = 1) {
  const start = lspPosition(location);
  return {
    start,
    end: {
      line: start.line,
      character: start.character + Math.max(1, Number(length) || 1),
    },
  };
}

function protocolLocation(uri, source, length = 1) {
  return {
    uri,
    range: lspRange(source, length),
  };
}

function containsPosition(range, position) {
  if (!range || !position) return false;
  if (position.line < range.start.line || position.line > range.end.line) return false;
  if (position.line === range.start.line && position.character < range.start.character) return false;
  if (position.line === range.end.line && position.character > range.end.character) return false;
  return true;
}

function normalizeSourceInput(sourceOrOptions, options = {}) {
  if (typeof sourceOrOptions === 'string') return { sourcePath: sourceOrOptions, ...options };
  return { ...(sourceOrOptions ?? {}) };
}

function readTypeSources(typePath) {
  if (!typePath) return DEFAULT_DEBUG_REPLAY_TYPE_MODULES;
  const stat = fs.statSync(typePath);
  if (stat.isDirectory()) {
    return Object.fromEntries(fs.readdirSync(typePath)
      .filter(name => name.endsWith('.rcltype'))
      .sort((a, b) => a.localeCompare(b))
      .map(name => [name, fs.readFileSync(path.join(typePath, name), 'utf8')]));
  }
  return { [path.basename(typePath)]: fs.readFileSync(typePath, 'utf8') };
}

function diagnosticToLsp(diagnostic, index = 0, uri = 'rcl://memory/debug-replay.rcl') {
  const line = Math.max(0, Number(diagnostic?.line ?? 1) - 1);
  const character = Math.max(0, Number(diagnostic?.column ?? 1) - 1);
  return {
    source: 'rcl',
    code: diagnostic?.code ?? `RCL_DIAGNOSTIC_${index}`,
    message: diagnostic?.message ?? String(diagnostic ?? 'RCL diagnostic'),
    severity: 1,
    range: {
      start: { line, character },
      end: { line, character: character + 1 },
    },
    data: {
      uri,
      nodeKind: diagnostic?.nodeKind ?? null,
      typeSource: diagnostic?.typeSource ?? null,
    },
  };
}

function tokenTypeIndex(type) {
  const index = RCL_LSP_SEMANTIC_TOKEN_TYPES.indexOf(type);
  return index < 0 ? RCL_LSP_SEMANTIC_TOKEN_TYPES.indexOf('variable') : index;
}

function semanticToken(line, character, length, tokenType, tokenModifiers = 0, semanticNodeId = null) {
  return {
    line,
    character,
    length: Math.max(1, length),
    tokenType,
    tokenTypeIndex: tokenTypeIndex(tokenType),
    tokenModifiers,
    semanticNodeId,
  };
}

function encodeSemanticTokens(tokens) {
  const sorted = [...tokens].sort((a, b) => a.line - b.line || a.character - b.character || a.tokenTypeIndex - b.tokenTypeIndex);
  const data = [];
  let prevLine = 0;
  let prevChar = 0;
  for (const token of sorted) {
    const deltaLine = token.line - prevLine;
    const deltaStart = deltaLine === 0 ? token.character - prevChar : token.character;
    data.push(deltaLine, deltaStart, token.length, token.tokenTypeIndex, token.tokenModifiers ?? 0);
    prevLine = token.line;
    prevChar = token.character;
  }
  return data;
}

function buildSymbolFromFacet(uri, facet) {
  const range = lspRange(facet.source, facet.path.length);
  return {
    name: facet.path,
    detail: facet.canonicalType ?? facet.declaredType ?? null,
    kind: 13,
    tags: [],
    deprecated: false,
    range,
    selectionRange: range,
    data: {
      uri,
      facet: facet.path,
      semanticNodeId: facet.semanticNodeId,
      declaredType: facet.declaredType ?? null,
      canonicalType: facet.canonicalType ?? null,
      expressionKind: facet.expressionKind ?? null,
      constructor: facet.constructor ?? null,
    },
  };
}

function buildHoverForFacet(index, facet) {
  return {
    contents: {
      kind: 'markdown',
      value: [
        `### ${facet.path}`,
        '',
        `- semantic node: \`${facet.semanticNodeId}\``,
        `- declared type: \`${facet.declaredType ?? 'unknown'}\``,
        `- canonical type: \`${facet.canonicalType ?? 'unknown'}\``,
        `- expression: \`${facet.expressionKind ?? 'unknown'}\``,
        `- source map root: \`${index.sourceMapRoot}\``,
      ].join('\n'),
    },
    range: lspRange(facet.source, facet.path.length),
  };
}

function typeNamesFromRuntime(sourceMapRuntime) {
  return [...new Set(Object.values(sourceMapRuntime.facets ?? {})
    .flatMap(facet => [facet.declaredType, facet.canonicalType])
    .filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
}

function keywordCompletionItems() {
  return ['reality', 'facet', 'record', 'union', 'match', 'provider_call', 'typed_ref', 'typed_deref']
    .map((label, index) => ({ label, kind: 14, sortText: `0-${String(index).padStart(2, '0')}` }));
}

function buildLspPayloadFromRuntime(sourceMapRuntime, { sourceText = '', sourcePath = null, sourceFile = null } = {}) {
  const uri = sourceUri(sourcePath, sourceFile ?? sourceMapRuntime.sourceFile);
  const facets = Object.values(sourceMapRuntime.facets ?? {}).sort((a, b) => a.path.localeCompare(b.path));
  const documentSymbols = facets.map(facet => buildSymbolFromFacet(uri, facet));
  const hoverIndex = Object.fromEntries(facets.map(facet => [facet.path, buildHoverForFacet({ sourceMapRoot: sourceMapRuntime.unifiedMapRoot }, facet)]));
  const semanticNodeHoverIndex = Object.fromEntries(facets.map(facet => [facet.semanticNodeId, hoverIndex[facet.path]]));
  const definitionIndex = Object.fromEntries(facets.map(facet => [facet.path, protocolLocation(uri, facet.source, facet.path.length)]));
  const semanticNodeDefinitions = Object.fromEntries(facets.map(facet => [facet.semanticNodeId, definitionIndex[facet.path]]));

  const tokens = [];
  for (const facet of facets) {
    const position = lspPosition(facet.source);
    tokens.push(semanticToken(position.line, position.character, facet.path.length, 'property', 0, facet.semanticNodeId));
    if (facet.canonicalType) {
      tokens.push(semanticToken(position.line, position.character + facet.path.length + 3, String(facet.canonicalType).length, 'type', 0, facet.semanticNodeId));
    }
  }
  const semanticTokens = {
    legend: {
      tokenTypes: RCL_LSP_SEMANTIC_TOKEN_TYPES,
      tokenModifiers: [],
    },
    tokens,
    data: encodeSemanticTokens(tokens),
    resultId: sha256({ programRoot: sourceMapRuntime.programRoot, sourceMapRoot: sourceMapRuntime.unifiedMapRoot, tokens }),
  };

  const completionItems = [
    ...keywordCompletionItems(),
    ...facets.map((facet, index) => ({ label: facet.path, kind: 10, detail: facet.canonicalType ?? facet.declaredType ?? null, sortText: `1-${String(index).padStart(3, '0')}`, data: { facet: facet.path, semanticNodeId: facet.semanticNodeId } })),
    ...typeNamesFromRuntime(sourceMapRuntime).map((type, index) => ({ label: type, kind: 7, sortText: `2-${String(index).padStart(3, '0')}` })),
  ];

  const workspaceSymbols = documentSymbols.map(symbol => ({
    name: symbol.name,
    kind: symbol.kind,
    location: { uri, range: symbol.range },
    containerName: sourceMapRuntime.program,
    data: symbol.data,
  }));

  const index = {
    format: RCL_LSP_INDEX_FORMAT,
    version: RCL_IDE_BRIDGE_VERSION,
    mode: 'source-map-backed-lsp-index-seed',
    document: {
      uri,
      languageId: 'rcl',
      version: 1,
      name: sourceNameFromUri(uri),
      lineCount: sourceText ? sourceText.split(/\r?\n/).length : null,
      textRoot: sourceText ? sha256(sourceText) : null,
    },
    program: sourceMapRuntime.program,
    programRoot: sourceMapRuntime.programRoot,
    lockRoot: sourceMapRuntime.lockRoot ?? null,
    sourceMapRoot: sourceMapRuntime.unifiedMapRoot,
    semanticMapRoot: sourceMapRuntime.semanticMapRoot,
    instructionMapRoot: sourceMapRuntime.instructionMapRoot,
    capabilities: {
      textDocumentSync: 1,
      hoverProvider: true,
      definitionProvider: true,
      documentSymbolProvider: true,
      workspaceSymbolProvider: true,
      semanticTokensProvider: true,
      completionProvider: true,
      diagnosticsProvider: true,
      renameProvider: false,
      codeActionProvider: false,
      formattingProvider: false,
    },
    documentSymbols,
    workspaceSymbols,
    semanticTokens,
    completionItems,
    hoverIndex,
    semanticNodeHoverIndex,
    definitionIndex,
    semanticNodeDefinitions,
    diagnostics: [],
    boundary: 'LSP Index v0.41 is a static source-map-backed protocol bridge. It emits LSP-shaped symbols, hovers, definitions, semantic tokens, completions and diagnostics JSON, but it is not yet a live socket/stdio LSP server.',
  };
  index.indexRoot = sha256(index);
  return index;
}

export function buildLspIndex(sourceOrOptions = {}, options = {}) {
  const normalized = normalizeSourceInput(sourceOrOptions, options);
  const sourcePath = normalized.sourcePath ?? null;
  const source = normalized.source ?? readText(sourcePath, DEFAULT_DEBUG_REPLAY_SOURCE);
  const typeModuleSources = normalized.typeModuleSources ?? (normalized.typePath ? readTypeSources(normalized.typePath) : DEFAULT_DEBUG_REPLAY_TYPE_MODULES);
  const runtimeResult = buildSourceMapRuntime({
    source,
    sourcePath,
    sourceFile: normalized.sourceFile ?? sourcePath ?? 'examples/debug-replay/src/app.rcl',
    typeModuleSources,
    typePath: normalized.typePath,
    lockRoot: normalized.lockRoot,
  });
  const uri = sourceUri(sourcePath, normalized.sourceFile ?? sourcePath);
  if (!runtimeResult.ok) {
    const index = {
      format: RCL_LSP_INDEX_FORMAT,
      version: RCL_IDE_BRIDGE_VERSION,
      mode: 'diagnostic-only-lsp-index-seed',
      document: {
        uri,
        languageId: 'rcl',
        version: 1,
        name: sourceNameFromUri(uri),
        lineCount: source ? source.split(/\r?\n/).length : null,
        textRoot: source ? sha256(source) : null,
      },
      program: null,
      programRoot: null,
      lockRoot: normalized.lockRoot ?? null,
      sourceMapRoot: null,
      capabilities: {
        textDocumentSync: 1,
        hoverProvider: false,
        definitionProvider: false,
        documentSymbolProvider: false,
        workspaceSymbolProvider: false,
        semanticTokensProvider: false,
        completionProvider: false,
        diagnosticsProvider: true,
        renameProvider: false,
        codeActionProvider: false,
        formattingProvider: false,
      },
      documentSymbols: [],
      workspaceSymbols: [],
      semanticTokens: { legend: { tokenTypes: RCL_LSP_SEMANTIC_TOKEN_TYPES, tokenModifiers: [] }, tokens: [], data: [], resultId: sha256([]) },
      completionItems: keywordCompletionItems(),
      hoverIndex: {},
      semanticNodeHoverIndex: {},
      definitionIndex: {},
      semanticNodeDefinitions: {},
      diagnostics: (runtimeResult.diagnostics ?? []).map((diag, index) => diagnosticToLsp(diag, index, uri)),
      boundary: 'LSP Index v0.41 diagnostic-only mode is emitted when compilation/source-map construction fails.',
    };
    index.indexRoot = sha256(index);
    return { ok: false, diagnostics: runtimeResult.diagnostics ?? [], lspIndex: index };
  }
  return { ok: true, diagnostics: [], sourceMapRuntime: runtimeResult.sourceMapRuntime, lspIndex: buildLspPayloadFromRuntime(runtimeResult.sourceMapRuntime, { sourceText: source, sourcePath, sourceFile: normalized.sourceFile }) };
}

function findSymbol(index, query = {}) {
  if (query.facet && index.documentSymbols) return index.documentSymbols.find(symbol => symbol.data?.facet === query.facet) ?? null;
  if (query.semanticNodeId && index.documentSymbols) return index.documentSymbols.find(symbol => symbol.data?.semanticNodeId === query.semanticNodeId) ?? null;
  if (query.position) return index.documentSymbols.find(symbol => containsPosition(symbol.range, query.position)) ?? null;
  return null;
}

function normalizeLspIndex(indexOrPath) {
  return typeof indexOrPath === 'string' ? readJson(indexOrPath) : indexOrPath;
}

export function queryLspIndex(indexOrPath, query = {}) {
  const index = normalizeLspIndex(indexOrPath);
  const kind = query.kind ?? query.queryKind ?? 'hover';
  const symbol = findSymbol(index, query);
  let result = null;
  let ok = true;
  if (kind === 'hover') {
    const key = query.facet ?? symbol?.data?.facet ?? null;
    result = key ? index.hoverIndex?.[key] ?? null : (query.semanticNodeId ? index.semanticNodeHoverIndex?.[query.semanticNodeId] ?? null : null);
    ok = Boolean(result);
  } else if (kind === 'definition') {
    const key = query.facet ?? symbol?.data?.facet ?? null;
    result = key ? index.definitionIndex?.[key] ?? null : (query.semanticNodeId ? index.semanticNodeDefinitions?.[query.semanticNodeId] ?? null : null);
    ok = Boolean(result);
  } else if (kind === 'documentSymbols' || kind === 'symbols') {
    result = index.documentSymbols ?? [];
  } else if (kind === 'workspaceSymbols') {
    const needle = String(query.query ?? '').toLowerCase();
    result = (index.workspaceSymbols ?? []).filter(symbol => !needle || symbol.name.toLowerCase().includes(needle));
  } else if (kind === 'semanticTokens') {
    result = index.semanticTokens ?? null;
    ok = Boolean(result);
  } else if (kind === 'diagnostics') {
    result = index.diagnostics ?? [];
  } else if (kind === 'completion') {
    const prefix = String(query.prefix ?? '').toLowerCase();
    result = (index.completionItems ?? []).filter(item => !prefix || item.label.toLowerCase().startsWith(prefix));
  } else {
    ok = false;
    result = { error: `Unsupported LSP query kind '${kind}'` };
  }
  const report = {
    format: RCL_LSP_QUERY_REPORT_FORMAT,
    version: RCL_IDE_BRIDGE_VERSION,
    ok,
    kind,
    query,
    program: index.program ?? null,
    programRoot: index.programRoot ?? null,
    sourceMapRoot: index.sourceMapRoot ?? null,
    indexRoot: index.indexRoot ?? null,
    result,
  };
  report.queryRoot = sha256(report);
  return report;
}

export function parseLspQueryArg(arg = 'hover') {
  const [kindRaw, restRaw] = String(arg).split(':', 2);
  const kind = kindRaw || 'hover';
  const rest = restRaw ?? null;
  if (!rest) return { kind };
  if (rest.startsWith('semantic=')) return { kind, semanticNodeId: rest.slice('semantic='.length) };
  if (rest.startsWith('line=')) {
    const [line, character = '0'] = rest.slice('line='.length).split(',');
    return { kind, position: { line: Number(line), character: Number(character) } };
  }
  if (kind === 'completion') return { kind, prefix: rest };
  if (kind === 'workspaceSymbols') return { kind, query: rest };
  return { kind, facet: rest };
}

function dapSourceFromFrame(frame, fallbackUri = null) {
  const source = frame?.source ?? null;
  const rawPath = source?.file ?? fallbackUri ?? null;
  const uri = rawPath?.startsWith?.('file://') ? rawPath : sourceUri(rawPath);
  return {
    name: sourceNameFromUri(uri),
    path: uri.startsWith('file://') ? fileURLToPath(uri) : rawPath,
    sourceReference: 0,
    presentationHint: 'normal',
  };
}

function dapStackFrame(frame, fallbackUri = null) {
  const source = frame?.source ?? null;
  return {
    id: frame.frameIndex ?? frame.id ?? 0,
    name: frame.facet ?? frame.eventKind ?? 'rcl-frame',
    source: dapSourceFromFrame(frame, fallbackUri),
    line: Number(source?.line ?? 1),
    column: Number(source?.column ?? 1),
    endLine: Number(source?.line ?? 1),
    endColumn: Number(source?.column ?? 1) + 1,
    instructionPointerReference: frame.rbc?.instructionIndex != null ? `rbc://${frame.rbc.instructionIndex}` : null,
    presentationHint: frame.stopKind === 'breakpoint' ? 'label' : 'normal',
    data: {
      seq: frame.seq,
      eventKind: frame.eventKind,
      facet: frame.facet ?? null,
      semanticNodeId: frame.semanticNodeId ?? null,
      breakHits: frame.breakHits ?? [],
    },
  };
}

function variableRowsFromSession(session) {
  return Object.values(session?.cursorVariableWindow?.variables ?? {}).map((item, index) => ({
    name: item.facet ?? `var_${index}`,
    value: item.valuePreview ?? item.valueRoot ?? null,
    type: item.canonicalType ?? item.declaredType ?? null,
    variablesReference: 0,
    presentationHint: { kind: item.valueKind === 'Ref' ? 'property' : 'data' },
    evaluateName: item.facet ?? null,
    data: {
      semanticNodeId: item.semanticNodeId ?? null,
      valueKind: item.valueKind ?? null,
      valueRoot: item.valueRoot ?? null,
      source: item.source ?? null,
    },
  })).sort((a, b) => a.name.localeCompare(b.name));
}

function breakpointRowsFromSession(session) {
  const configured = session?.config?.breakpoints ?? [];
  const hits = new Map();
  for (const frame of session?.frames ?? []) {
    for (const hit of frame.breakHits ?? []) hits.set(hit.id ?? hit.breakpointId ?? JSON.stringify(hit), hit);
  }
  return configured.map((bp, index) => {
    const hit = hits.get(bp.id) ?? null;
    const line = Number(bp.location?.line ?? hit?.source?.line ?? 1);
    const column = Number(bp.location?.column ?? hit?.source?.column ?? 1);
    return {
      id: index + 1,
      verified: Boolean(hit) || ['event-kind', 'facet', 'semantic-node', 'rbc-instruction', 'source-location'].includes(bp.kind),
      message: hit ? 'breakpoint hit in serialized debug session' : 'breakpoint accepted by trace-backed bridge',
      source: hit?.source ? dapSourceFromFrame({ source: hit.source }) : null,
      line,
      column,
      data: {
        rclBreakpointId: bp.id ?? null,
        kind: bp.kind,
        facet: bp.facet ?? null,
        semanticNodeId: bp.semanticNodeId ?? null,
        eventKind: bp.eventKind ?? null,
        condition: bp.condition ?? null,
      },
    };
  });
}

function asDebugSession(sessionOrPath) {
  const session = typeof sessionOrPath === 'string' ? readJson(sessionOrPath) : sessionOrPath;
  if (!session?.frames || !Array.isArray(session.frames)) throw new TypeError('debug session with frames is required');
  return session;
}

export function buildDapBridge(sessionOrPath, options = {}) {
  const session = asDebugSession(sessionOrPath);
  const debugUiProtocol = options.debugUiProtocol ?? buildDebugUiProtocol({ debugSession: session });
  const frames = (session.frames ?? []).map(frame => dapStackFrame(frame));
  const variables = variableRowsFromSession(session);
  const breakpoints = breakpointRowsFromSession(session);
  const messages = [
    { seq: 1, type: 'response', request_seq: 1, command: 'initialize', success: true, body: {
      adapterID: 'rcl-dap-bridge-seed',
      supportsConfigurationDoneRequest: false,
      supportsEvaluateForHovers: true,
      supportsStepBack: true,
      supportsRestartRequest: true,
      supportsSetVariable: false,
      supportsLoadedSourcesRequest: true,
      supportsTerminateRequest: false,
    } },
    { seq: 2, type: 'event', event: 'initialized', body: { program: session.program, programRoot: session.programRoot } },
    { seq: 3, type: 'response', request_seq: 2, command: 'setBreakpoints', success: true, body: { breakpoints } },
    { seq: 4, type: 'event', event: 'stopped', body: { reason: session.cursor?.stopKind ?? 'entry', threadId: 1, allThreadsStopped: true, frameId: session.cursor?.frameIndex ?? 0 } },
    { seq: 5, type: 'response', request_seq: 3, command: 'threads', success: true, body: { threads: [{ id: 1, name: 'RCL deterministic trace thread' }] } },
    { seq: 6, type: 'response', request_seq: 4, command: 'stackTrace', success: true, body: { stackFrames: frames, totalFrames: frames.length } },
    { seq: 7, type: 'response', request_seq: 5, command: 'scopes', success: true, body: { scopes: [{ name: 'Facet Variables', variablesReference: 1, expensive: false }, { name: 'Watch Expressions', variablesReference: 2, expensive: false }, { name: 'Replay Evidence', variablesReference: 3, expensive: false }] } },
    { seq: 8, type: 'response', request_seq: 6, command: 'variables', success: true, body: { variables } },
    { seq: 9, type: 'request', command: 'next', arguments: { threadId: 1, granularity: 'statement', bridgeCommand: 'debug-step next' } },
    { seq: 10, type: 'request', command: 'continue', arguments: { threadId: 1, bridgeCommand: 'debug-step continue' } },
  ];
  const bridge = {
    format: RCL_DAP_BRIDGE_FORMAT,
    version: RCL_IDE_BRIDGE_VERSION,
    mode: 'trace-backed-dap-bridge-seed',
    adapterId: 'rcl-dap-bridge-seed',
    program: session.program,
    programRoot: session.programRoot,
    lockRoot: session.lockRoot ?? null,
    sourceMapRoot: session.sourceMapRoot ?? null,
    traceRoot: session.traceRoot,
    sessionRoot: session.sessionRoot,
    debugUiProtocolRoot: debugUiProtocol?.protocolRoot ?? null,
    capabilities: messages[0].body,
    thread: { id: 1, name: 'RCL deterministic trace thread' },
    breakpoints,
    stackFrames: frames,
    scopes: messages[6].body.scopes,
    variables,
    stepRequestPlan: messages.filter(message => message.type === 'request'),
    messages,
    boundary: 'DAP Bridge v0.41 emits DAP-shaped JSON for initialize, breakpoints, stopped, threads, stackTrace, scopes, variables and step request planning. It is not yet a live socket/stdio Debug Adapter Protocol server.',
  };
  bridge.bridgeRoot = sha256(bridge);
  return bridge;
}

export function buildIdeBridge(input = {}, options = {}) {
  const debugConfig = options.debugConfig ?? input.debugConfig ?? {};
  const lspResult = buildLspIndex({
    source: input.source,
    sourcePath: input.sourcePath,
    sourceFile: input.sourceFile,
    typePath: input.typePath,
    typeModuleSources: input.typeModuleSources,
  });
  const profilerRun = runProfilerDebugUi({
    source: input.source ?? DEFAULT_DEBUG_REPLAY_SOURCE,
    sourcePath: input.sourcePath,
    typePath: input.typePath,
    typeModuleSources: input.typeModuleSources ?? DEFAULT_DEBUG_REPLAY_TYPE_MODULES,
    debugConfig,
  }, { debugConfig });
  if (!profilerRun.ok) return profilerRun;
  const dapBridge = buildDapBridge(profilerRun.session, { debugUiProtocol: profilerRun.debugUiProtocol });
  const report = {
    format: RCL_IDE_BRIDGE_REPORT_FORMAT,
    version: RCL_IDE_BRIDGE_VERSION,
    mode: 'static-lsp-dap-ide-bridge-seed',
    ok: Boolean(lspResult.lspIndex) && Boolean(dapBridge),
    program: profilerRun.trace.program,
    programRoot: profilerRun.trace.programRoot,
    lockRoot: profilerRun.trace.lockRoot ?? null,
    sourceMapRoot: profilerRun.trace.sourceMapRoot,
    traceRoot: profilerRun.trace.traceRoot,
    sessionRoot: profilerRun.session.sessionRoot,
    profilerRoot: profilerRun.profiler.profilerRoot,
    replayBundleRoot: profilerRun.replayBundle.bundleRoot,
    debugUiProtocolRoot: profilerRun.debugUiProtocol.protocolRoot,
    lspIndexRoot: lspResult.lspIndex.indexRoot,
    dapBridgeRoot: dapBridge.bridgeRoot,
    capabilities: {
      lsp: lspResult.lspIndex.capabilities,
      dap: dapBridge.capabilities,
      profiler: true,
      replayBundle: true,
      debugUiProtocol: true,
      liveLspServer: false,
      liveDapServer: false,
    },
    artifactFormats: {
      lspIndex: RCL_LSP_INDEX_FORMAT,
      dapBridge: RCL_DAP_BRIDGE_FORMAT,
      debugUiProtocol: profilerRun.debugUiProtocol.format,
      profiler: profilerRun.profiler.format,
      replayBundle: profilerRun.replayBundle.format,
    },
    boundary: 'IDE Bridge v0.41 links static LSP JSON and DAP-shaped debug JSON to v0.38-v0.40 evidence roots. It does not launch language-server or debug-adapter processes yet.',
  };
  report.ideBridgeRoot = sha256(report);
  return { ok: true, version: RCL_IDE_BRIDGE_VERSION, lspIndex: lspResult.lspIndex, trace: profilerRun.trace, session: profilerRun.session, profiler: profilerRun.profiler, replayBundle: profilerRun.replayBundle, replayVerification: profilerRun.replayVerification, debugUiProtocol: profilerRun.debugUiProtocol, dapBridge, ideBridgeReport: report };
}

export function writeLspIndexReports(sourcePath, typePath, outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-lsp-index-')), options = {}) {
  const result = buildLspIndex({ sourcePath, typePath, ...options });
  fs.mkdirSync(outputDir, { recursive: true });
  const lspIndexPath = path.join(outputDir, 'lsp-index.json');
  const diagnosticsPath = path.join(outputDir, 'lsp-diagnostics.json');
  const symbolsPath = path.join(outputDir, 'lsp-document-symbols.json');
  const semanticTokensPath = path.join(outputDir, 'lsp-semantic-tokens.json');
  fs.writeFileSync(lspIndexPath, `${JSON.stringify(result.lspIndex, null, 2)}\n`);
  fs.writeFileSync(diagnosticsPath, `${JSON.stringify(result.lspIndex.diagnostics ?? [], null, 2)}\n`);
  fs.writeFileSync(symbolsPath, `${JSON.stringify(result.lspIndex.documentSymbols ?? [], null, 2)}\n`);
  fs.writeFileSync(semanticTokensPath, `${JSON.stringify(result.lspIndex.semanticTokens ?? {}, null, 2)}\n`);
  return {
    ok: result.ok,
    version: RCL_IDE_BRIDGE_VERSION,
    format: RCL_LSP_INDEX_FORMAT,
    outputDir,
    lspIndexPath,
    diagnosticsPath,
    symbolsPath,
    semanticTokensPath,
    program: result.lspIndex.program,
    programRoot: result.lspIndex.programRoot,
    sourceMapRoot: result.lspIndex.sourceMapRoot,
    indexRoot: result.lspIndex.indexRoot,
    diagnosticCount: result.lspIndex.diagnostics?.length ?? 0,
    symbolCount: result.lspIndex.documentSymbols?.length ?? 0,
    semanticTokenCount: result.lspIndex.semanticTokens?.tokens?.length ?? 0,
    boundary: result.lspIndex.boundary,
  };
}

export function writeLspQueryReport(indexPath, queryArg = 'hover', outputDir = null, options = {}) {
  const query = options.query ?? parseLspQueryArg(queryArg);
  const report = queryLspIndex(indexPath, query);
  if (outputDir) {
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(path.join(outputDir, 'lsp-query-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  }
  return report;
}

export function writeDapBridgeReports(sessionPath, outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-dap-bridge-')), options = {}) {
  const session = asDebugSession(sessionPath);
  const protocol = options.debugUiProtocolPath && isExistingPath(options.debugUiProtocolPath) ? readJson(options.debugUiProtocolPath) : buildDebugUiProtocol({ debugSession: session });
  const bridge = buildDapBridge(session, { debugUiProtocol: protocol });
  fs.mkdirSync(outputDir, { recursive: true });
  const dapBridgePath = path.join(outputDir, 'dap-bridge.json');
  const dapMessagesPath = path.join(outputDir, 'dap-messages.json');
  fs.writeFileSync(dapBridgePath, `${JSON.stringify(bridge, null, 2)}\n`);
  fs.writeFileSync(dapMessagesPath, `${JSON.stringify(bridge.messages, null, 2)}\n`);
  return {
    ok: true,
    version: RCL_IDE_BRIDGE_VERSION,
    format: RCL_DAP_BRIDGE_FORMAT,
    outputDir,
    dapBridgePath,
    dapMessagesPath,
    program: bridge.program,
    programRoot: bridge.programRoot,
    traceRoot: bridge.traceRoot,
    sessionRoot: bridge.sessionRoot,
    debugUiProtocolRoot: bridge.debugUiProtocolRoot,
    bridgeRoot: bridge.bridgeRoot,
    stackFrameCount: bridge.stackFrames.length,
    breakpointCount: bridge.breakpoints.length,
    variableCount: bridge.variables.length,
    boundary: bridge.boundary,
  };
}

export function writeIdeBridgeReports(sourcePath, typePath, outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-ide-bridge-')), options = {}) {
  const debugConfig = options.debugConfig ?? (options.debugConfigPath && isExistingPath(options.debugConfigPath) ? readJson(options.debugConfigPath) : {});
  const result = buildIdeBridge({ sourcePath, typePath, debugConfig }, { debugConfig });
  if (!result.ok) return result;
  fs.mkdirSync(outputDir, { recursive: true });
  const paths = {
    lspIndexPath: path.join(outputDir, 'lsp-index.json'),
    dapBridgePath: path.join(outputDir, 'dap-bridge.json'),
    debugUiProtocolPath: path.join(outputDir, 'debug-ui-protocol.json'),
    profilerReportPath: path.join(outputDir, 'profiler-report.json'),
    replayBundlePath: path.join(outputDir, 'replay-input-bundle.json'),
    ideBridgeReportPath: path.join(outputDir, 'ide-bridge-report.json'),
  };
  fs.writeFileSync(paths.lspIndexPath, `${JSON.stringify(result.lspIndex, null, 2)}\n`);
  fs.writeFileSync(paths.dapBridgePath, `${JSON.stringify(result.dapBridge, null, 2)}\n`);
  fs.writeFileSync(paths.debugUiProtocolPath, `${JSON.stringify(result.debugUiProtocol, null, 2)}\n`);
  fs.writeFileSync(paths.profilerReportPath, `${JSON.stringify(result.profiler, null, 2)}\n`);
  fs.writeFileSync(paths.replayBundlePath, `${JSON.stringify(result.replayBundle, null, 2)}\n`);
  fs.writeFileSync(paths.ideBridgeReportPath, `${JSON.stringify(result.ideBridgeReport, null, 2)}\n`);
  return {
    ok: true,
    version: RCL_IDE_BRIDGE_VERSION,
    format: RCL_IDE_BRIDGE_REPORT_FORMAT,
    outputDir,
    ...paths,
    program: result.ideBridgeReport.program,
    programRoot: result.ideBridgeReport.programRoot,
    sourceMapRoot: result.ideBridgeReport.sourceMapRoot,
    traceRoot: result.ideBridgeReport.traceRoot,
    sessionRoot: result.ideBridgeReport.sessionRoot,
    lspIndexRoot: result.ideBridgeReport.lspIndexRoot,
    dapBridgeRoot: result.ideBridgeReport.dapBridgeRoot,
    debugUiProtocolRoot: result.ideBridgeReport.debugUiProtocolRoot,
    ideBridgeRoot: result.ideBridgeReport.ideBridgeRoot,
    boundary: result.ideBridgeReport.boundary,
  };
}

export function runLspDemo(options = {}) {
  const result = buildLspIndex({ source: options.source ?? DEFAULT_DEBUG_REPLAY_SOURCE, typeModuleSources: options.typeModuleSources ?? DEFAULT_DEBUG_REPLAY_TYPE_MODULES, sourceFile: 'examples/debug-replay/src/app.rcl' });
  const hover = queryLspIndex(result.lspIndex, { kind: 'hover', facet: 'app.session' });
  const definition = queryLspIndex(result.lspIndex, { kind: 'definition', semanticNodeId: 'facet:app.loginRef' });
  const symbols = queryLspIndex(result.lspIndex, { kind: 'documentSymbols' });
  return {
    ok: result.ok,
    version: RCL_IDE_BRIDGE_VERSION,
    format: RCL_LSP_INDEX_FORMAT,
    program: result.lspIndex.program,
    programRoot: result.lspIndex.programRoot,
    sourceMapRoot: result.lspIndex.sourceMapRoot,
    indexRoot: result.lspIndex.indexRoot,
    symbolCount: result.lspIndex.documentSymbols.length,
    semanticTokenCount: result.lspIndex.semanticTokens.tokens.length,
    hoverRoot: hover.queryRoot,
    definitionRoot: definition.queryRoot,
    symbolsRoot: symbols.queryRoot,
    capabilities: result.lspIndex.capabilities,
    boundary: result.lspIndex.boundary,
  };
}

export function runDapDemo(options = {}) {
  const debugConfig = options.debugConfig ?? {
    stopOnEntry: true,
    breakpoints: [{ id: 'bp-session', kind: 'facet', facet: 'app.session' }],
    watchExpressions: [{ id: 'watch-session', kind: 'facet', facet: 'app.session' }],
  };
  const sessionResult = runDebugSession({ source: options.source ?? DEFAULT_DEBUG_REPLAY_SOURCE, typeModuleSources: options.typeModuleSources ?? DEFAULT_DEBUG_REPLAY_TYPE_MODULES, debugConfig }, { debugConfig });
  if (!sessionResult.ok) return sessionResult;
  const bridge = buildDapBridge(sessionResult.session);
  return {
    ok: true,
    version: RCL_IDE_BRIDGE_VERSION,
    format: RCL_DAP_BRIDGE_FORMAT,
    program: bridge.program,
    programRoot: bridge.programRoot,
    traceRoot: bridge.traceRoot,
    sessionRoot: bridge.sessionRoot,
    bridgeRoot: bridge.bridgeRoot,
    stackFrameCount: bridge.stackFrames.length,
    breakpointCount: bridge.breakpoints.length,
    variableCount: bridge.variables.length,
    messageCount: bridge.messages.length,
    capabilities: bridge.capabilities,
    boundary: bridge.boundary,
  };
}
