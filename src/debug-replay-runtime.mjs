import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { tryCompileReality } from './compiler.mjs';
import { compileRealityToBytecode, decodeBytecode, OPCODES } from './bytecode.mjs';
import { runNativeBytecode } from './native-vm.mjs';
import { realityRoot } from './canonical.mjs';
import { readTypedModuleSourcesFromDir } from './type-module-kernel.mjs';
import {
  DEFAULT_TYPED_GC_SOURCE,
  DEFAULT_TYPED_GC_TYPE_MODULES,
  compileTypedGcSnapshot,
} from './typed-gc-snapshot.mjs';

export const RCL_DEBUG_REPLAY_VERSION = '0.38.0-alpha.1';
export const RCL_SOURCE_MAP_RUNTIME_FORMAT = 'rcl.source-map-runtime.v0.38';
export const RCL_EXECUTION_TRACE_FORMAT = 'rcl.execution-trace.v0.38';
export const RCL_TRACE_REPLAY_FORMAT = 'rcl.trace-replay.v0.38';
export const RCL_DEBUG_REPORT_FORMAT = 'rcl.debug-report.v0.38';

export const DEFAULT_DEBUG_REPLAY_TYPE_MODULES = DEFAULT_TYPED_GC_TYPE_MODULES;
export const DEFAULT_DEBUG_REPLAY_SOURCE = DEFAULT_TYPED_GC_SOURCE;

const TRACE_OPCODE_NAMES = Object.freeze(Object.fromEntries(Object.entries(OPCODES).map(([name, value]) => [value, name])));

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

function readTypeSources(typePath) {
  if (!typePath) return null;
  if (fs.statSync(typePath).isDirectory()) return readTypedModuleSourcesFromDir(typePath);
  return { [path.basename(typePath)]: fs.readFileSync(typePath, 'utf8') };
}

function normalizeSourceInput(sourceOrOptions, options = {}) {
  if (typeof sourceOrOptions === 'string') return { source: sourceOrOptions, ...options };
  return { ...(sourceOrOptions ?? {}) };
}

function stringOperand(decoded, value) {
  return decoded.strings?.[value] ?? value;
}

function instructionOperands(decoded, instruction) {
  switch (instruction.op) {
    case OPCODES.PUSH_NUMBER: return { number: decoded.numbers?.[instruction.a] ?? instruction.a };
    case OPCODES.PUSH_BOOL: return { value: Boolean(instruction.a) };
    case OPCODES.PUSH_STRING:
    case OPCODES.LOAD_STATE:
    case OPCODES.STORE_STATE:
    case OPCODES.GET_TYPED_FIELD:
    case OPCODES.IS_UNION_VARIANT:
    case OPCODES.RECORD_WITNESS:
      return { value: stringOperand(decoded, instruction.a) };
    case OPCODES.MAKE_TYPED_RECORD:
      return { canonicalType: stringOperand(decoded, instruction.a), fields: String(stringOperand(decoded, instruction.b)).split('\n').filter(Boolean), fieldCount: instruction.c };
    case OPCODES.MAKE_TYPED_UNION:
      return { canonicalType: stringOperand(decoded, instruction.a), variant: stringOperand(decoded, instruction.b), payloadCount: instruction.c };
    case OPCODES.GET_UNION_PAYLOAD: return { payloadIndex: instruction.a };
    case OPCODES.CALL_PROVIDER: return { providerId: stringOperand(decoded, instruction.a), capability: stringOperand(decoded, instruction.b), requestJson: stringOperand(decoded, instruction.c) };
    case OPCODES.BEGIN_TX: return { realize: Boolean(instruction.a), rule: stringOperand(decoded, instruction.b), actor: stringOperand(decoded, instruction.c) };
    case OPCODES.CHECK_WARRANT: return { actor: stringOperand(decoded, instruction.a), capability: stringOperand(decoded, instruction.b), target: stringOperand(decoded, instruction.c) };
    case OPCODES.STAGE_STORE: return { target: stringOperand(decoded, instruction.a) };
    case OPCODES.CALL_BUILTIN: return { builtin: instruction.builtin, argc: instruction.b };
    case OPCODES.JUMP:
    case OPCODES.JUMP_IF_FALSE:
    case OPCODES.CALL:
      return { targetPc: instruction.a, argc: instruction.b };
    default:
      return { a: instruction.a, b: instruction.b, c: instruction.c };
  }
}

function semanticNodeIdForFacet(pathKey) {
  return `facet:${pathKey}`;
}

function expressionNodeId(kind, facetPath, index, payload = {}) {
  return `${kind}:${facetPath}:${index}:${sha256(payload).slice(0, 12)}`;
}

function locationEquals(source, watchLocation) {
  if (!source || !watchLocation) return false;
  if (watchLocation.file && source.file && path.basename(watchLocation.file) !== path.basename(source.file)) return false;
  if (Number(watchLocation.line) !== Number(source.line)) return false;
  if (watchLocation.column != null && Number(watchLocation.column) !== Number(source.column)) return false;
  return true;
}

function normalizeSourceLocation(location, sourceFile = null) {
  if (!location) return null;
  return {
    file: sourceFile,
    line: location.line ?? null,
    column: location.column ?? null,
  };
}

function compileDebugProgram({ source, typeModuleSources = null, typeModuleDir = null, sourceFile = null } = {}) {
  const compileOptions = {};
  if (typeModuleSources) compileOptions.typeModuleSources = typeModuleSources;
  if (typeModuleDir) compileOptions.typeModuleDir = typeModuleDir;
  const compiled = tryCompileReality(source, compileOptions);
  if (!compiled.ok) return { ok: false, diagnostics: compiled.diagnostics };
  const bytecode = compileRealityToBytecode(compiled.program);
  const decoded = decodeBytecode(bytecode);
  return { ok: true, diagnostics: [], ...compiled, bytecode, decoded, sourceFile };
}

function mapFacetInstructionRanges(program, decoded, sourceMapRuntime) {
  const ranges = [];
  const facetByPath = new Map(program.facets.map(facet => [facet.path, facet]));
  let rangeStart = 0;
  for (const instruction of decoded.instructions ?? []) {
    if (instruction.op !== OPCODES.STORE_STATE) continue;
    const pathKey = stringOperand(decoded, instruction.a);
    const facet = facetByPath.get(pathKey);
    if (!facet) continue;
    ranges.push({ facetPath: pathKey, start: rangeStart, end: instruction.index });
    rangeStart = instruction.index + 1;
    if (ranges.length >= program.facets.length) break;
  }
  const rangesByFacet = new Map(ranges.map(item => [item.facetPath, item]));
  const instructions = (decoded.instructions ?? []).map(instruction => {
    const range = ranges.find(item => instruction.index >= item.start && instruction.index <= item.end) ?? null;
    const facet = range ? sourceMapRuntime.facets[range.facetPath] : null;
    return {
      instructionIndex: instruction.index,
      opcode: instruction.name,
      op: instruction.op,
      operands: instructionOperands(decoded, instruction),
      facet: facet?.path ?? null,
      semanticNodeId: facet?.semanticNodeId ?? null,
      source: facet?.source ?? null,
      canonicalType: facet?.canonicalType ?? null,
    };
  });
  return { ranges, rangesByFacet, instructions };
}

function buildFacetEntries({ program, semanticMap, sourceMap, sourceFile }) {
  return Object.fromEntries((program.facets ?? []).map(facet => {
    const semantic = semanticMap?.facets?.[facet.path] ?? {};
    const source = normalizeSourceLocation(sourceMap?.facets?.[facet.path]?.location ?? facet.location ?? semantic.location, sourceFile);
    return [facet.path, {
      path: facet.path,
      semanticNodeId: semanticNodeIdForFacet(facet.path),
      declaredType: facet.valueType,
      canonicalType: semantic.canonicalType ?? facet.valueType,
      externalType: Boolean(semantic.externalType),
      owner: facet.owner ?? semantic.owner ?? null,
      expressionKind: facet.value?.kind ?? null,
      constructor: semantic.constructor ?? null,
      fieldAccesses: semantic.fieldAccesses ?? [],
      matches: semantic.matches ?? [],
      source,
    }];
  }));
}

export function buildSourceMapRuntime(input, options = {}) {
  const normalized = normalizeSourceInput(input, options);
  const source = normalized.source ?? (normalized.sourcePath ? fs.readFileSync(normalized.sourcePath, 'utf8') : DEFAULT_DEBUG_REPLAY_SOURCE);
  const sourceFile = normalized.sourceFile ?? normalized.sourcePath ?? null;
  const typeModuleSources = normalized.typeModuleSources ?? (normalized.typePath ? readTypeSources(normalized.typePath) : DEFAULT_DEBUG_REPLAY_TYPE_MODULES);
  const compiled = compileDebugProgram({ source, typeModuleSources, typeModuleDir: normalized.typeModuleDir, sourceFile });
  if (!compiled.ok) return { ok: false, diagnostics: compiled.diagnostics };
  const facets = buildFacetEntries({ program: compiled.program, semanticMap: compiled.semanticMap, sourceMap: compiled.sourceMap, sourceFile });
  const partial = {
    format: RCL_SOURCE_MAP_RUNTIME_FORMAT,
    version: RCL_DEBUG_REPLAY_VERSION,
    program: compiled.program.name,
    programRoot: compiled.program.programRoot,
    bytecodeSourceRoot: compiled.decoded.sourceRoot,
    lockRoot: compiled.typeModuleReport?.irRoot ?? normalized.lockRoot ?? null,
    typeModuleRoot: compiled.typeModuleReport?.irRoot ?? null,
    sourceFile,
    semanticMapRoot: sha256(compiled.semanticMap ?? {}),
    compilerSourceMapRoot: sha256(compiled.sourceMap ?? {}),
    bytecodeRoot: sha256(Buffer.from(compiled.bytecode).toString('base64')),
    facets,
  };
  const instructionMap = mapFacetInstructionRanges(compiled.program, compiled.decoded, partial);
  const stateIndex = Object.fromEntries(Object.values(facets).map(facet => [facet.path, {
    statePath: facet.path,
    facet: facet.path,
    semanticNodeId: facet.semanticNodeId,
    source: facet.source,
    canonicalType: facet.canonicalType,
    instructionRange: instructionMap.ranges.find(item => item.facetPath === facet.path) ?? null,
  }]));
  const semanticIndex = Object.fromEntries(Object.values(facets).map(facet => [facet.semanticNodeId, {
    semanticNodeId: facet.semanticNodeId,
    facet: facet.path,
    source: facet.source,
    canonicalType: facet.canonicalType,
  }]));
  const runtime = {
    ...partial,
    stateIndex,
    semanticIndex,
    instructionRanges: instructionMap.ranges,
    instructions: instructionMap.instructions,
  };
  runtime.instructionMapRoot = sha256({ ranges: runtime.instructionRanges, instructions: runtime.instructions });
  runtime.unifiedMapRoot = sha256({
    format: runtime.format,
    version: runtime.version,
    programRoot: runtime.programRoot,
    lockRoot: runtime.lockRoot,
    semanticMapRoot: runtime.semanticMapRoot,
    compilerSourceMapRoot: runtime.compilerSourceMapRoot,
    instructionMapRoot: runtime.instructionMapRoot,
    stateIndex: runtime.stateIndex,
    semanticIndex: runtime.semanticIndex,
  });
  return { ok: true, diagnostics: [], sourceMapRuntime: runtime, compiled };
}

export function querySourceMapRuntime(sourceMapRuntime, query = {}) {
  if (!sourceMapRuntime?.format) throw new TypeError('sourceMapRuntime is required');
  if (query.statePath) return {
    ok: Boolean(sourceMapRuntime.stateIndex?.[query.statePath]),
    queryKind: 'statePath',
    query,
    result: sourceMapRuntime.stateIndex?.[query.statePath] ?? null,
  };
  if (query.facet) return {
    ok: Boolean(sourceMapRuntime.facets?.[query.facet]),
    queryKind: 'facet',
    query,
    result: sourceMapRuntime.facets?.[query.facet] ?? null,
  };
  if (query.semanticNodeId) return {
    ok: Boolean(sourceMapRuntime.semanticIndex?.[query.semanticNodeId]),
    queryKind: 'semanticNodeId',
    query,
    result: sourceMapRuntime.semanticIndex?.[query.semanticNodeId] ?? null,
  };
  if (query.instructionIndex != null) return {
    ok: Boolean(sourceMapRuntime.instructions?.[Number(query.instructionIndex)]),
    queryKind: 'instructionIndex',
    query,
    result: sourceMapRuntime.instructions?.[Number(query.instructionIndex)] ?? null,
  };
  if (query.location) {
    const hits = Object.values(sourceMapRuntime.facets ?? {}).filter(facet => locationEquals(facet.source, query.location));
    return { ok: hits.length > 0, queryKind: 'location', query, result: hits };
  }
  return { ok: false, queryKind: 'unknown', query, result: null };
}

function valueKind(value) {
  if (value && typeof value === 'object') return value.__rclKind ?? (Array.isArray(value) ? 'Array' : 'Object');
  return typeof value;
}

function compactValuePreview(value) {
  if (value && typeof value === 'object') {
    if (value.__rclKind === 'Record') return { kind: 'Record', objectId: value.__rclObjectId ?? null, canonicalType: value.__rclType ?? null };
    if (value.__rclKind === 'Union') return { kind: 'Union', objectId: value.__rclObjectId ?? null, canonicalType: value.__rclType ?? null, variant: value.variant ?? null };
    if (value.__rclKind === 'Ref') return { kind: 'Ref', objectId: value.__rclRefObjectId ?? null, targetType: value.__rclRefType ?? null };
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value == null) return value;
  return { kind: valueKind(value), root: sha256(value) };
}

function expressionPath(expr) {
  if (!expr) return null;
  if (expr.kind === 'PathExpr') return expr.path;
  if (expr.kind === 'FieldAccessExpr') {
    const base = expressionPath(expr.object);
    return base ? `${base}.${expr.field}` : expr.basePath ?? null;
  }
  return null;
}

function collectExpressionDebugNodes(expr, facetPath, sourceMapRuntime, state, nodes = { constructors: [], fieldAccesses: [], matches: [] }) {
  if (!expr) return nodes;
  if (expr.kind === 'RecordConstructExpr') {
    const index = nodes.constructors.length;
    nodes.constructors.push({
      semanticNodeId: expressionNodeId('constructor', facetPath, index, { kind: expr.kind, canonicalType: expr.canonicalType, fields: expr.fields?.map(item => item.name) ?? [] }),
      facet: facetPath,
      kind: 'Record',
      canonicalType: expr.canonicalType,
      typeName: expr.typeName ?? null,
      fields: expr.fields?.map(item => item.name) ?? [],
      source: normalizeSourceLocation(expr.location ?? sourceMapRuntime.facets?.[facetPath]?.source, sourceMapRuntime.sourceFile),
    });
    for (const field of expr.fields ?? []) collectExpressionDebugNodes(field.value ?? field.expression, facetPath, sourceMapRuntime, state, nodes);
    return nodes;
  }
  if (expr.kind === 'UnionConstructExpr') {
    const index = nodes.constructors.length;
    nodes.constructors.push({
      semanticNodeId: expressionNodeId('constructor', facetPath, index, { kind: expr.kind, canonicalType: expr.canonicalType, variant: expr.variant }),
      facet: facetPath,
      kind: 'Union',
      canonicalType: expr.canonicalType,
      typeName: expr.typeName ?? null,
      variant: expr.variant,
      payloadCount: expr.payload?.length ?? 0,
      source: normalizeSourceLocation(expr.location ?? sourceMapRuntime.facets?.[facetPath]?.source, sourceMapRuntime.sourceFile),
    });
    for (const payload of expr.payload ?? []) collectExpressionDebugNodes(payload.value ?? payload.expression ?? payload, facetPath, sourceMapRuntime, state, nodes);
    return nodes;
  }
  if (expr.kind === 'FieldAccessExpr') {
    const index = nodes.fieldAccesses.length;
    nodes.fieldAccesses.push({
      semanticNodeId: expressionNodeId('field-access', facetPath, index, { field: expr.field, canonicalType: expr.canonicalType, target: expressionPath(expr.object) }),
      facet: facetPath,
      field: expr.field,
      canonicalType: expr.canonicalType ?? null,
      basePath: expr.basePath ?? expressionPath(expr.object),
      targetPath: expressionPath(expr),
      source: normalizeSourceLocation(expr.location ?? sourceMapRuntime.facets?.[facetPath]?.source, sourceMapRuntime.sourceFile),
    });
    collectExpressionDebugNodes(expr.object, facetPath, sourceMapRuntime, state, nodes);
    return nodes;
  }
  if (expr.kind === 'MatchUnionExpr') {
    const targetPath = expressionPath(expr.target);
    const targetValue = targetPath ? state?.[targetPath] : null;
    const selectedVariant = targetValue?.__rclKind === 'Union' ? targetValue.variant : null;
    const index = nodes.matches.length;
    nodes.matches.push({
      semanticNodeId: expressionNodeId('match', facetPath, index, { targetPath, cases: expr.cases?.map(item => item.variant) ?? [] }),
      facet: facetPath,
      canonicalType: expr.canonicalType ?? null,
      targetPath,
      selectedVariant,
      selectedCaseIndex: selectedVariant == null ? null : (expr.cases ?? []).findIndex(item => item.wildcard || item.variant === selectedVariant),
      cases: (expr.cases ?? []).map((item, caseIndex) => ({
        caseIndex,
        variant: item.variant,
        wildcard: Boolean(item.wildcard),
        bindings: item.bindings ?? [],
        source: normalizeSourceLocation(item.location, sourceMapRuntime.sourceFile),
      })),
      source: normalizeSourceLocation(expr.location ?? sourceMapRuntime.facets?.[facetPath]?.source, sourceMapRuntime.sourceFile),
    });
    collectExpressionDebugNodes(expr.target, facetPath, sourceMapRuntime, state, nodes);
    for (const item of expr.cases ?? []) collectExpressionDebugNodes(item.expression, facetPath, sourceMapRuntime, state, nodes);
    return nodes;
  }
  if (expr.kind === 'RecordLiteralExpr') for (const field of expr.fields ?? []) collectExpressionDebugNodes(field.expression, facetPath, sourceMapRuntime, state, nodes);
  else if (expr.kind === 'CallExpr') for (const arg of expr.args ?? []) collectExpressionDebugNodes(arg, facetPath, sourceMapRuntime, state, nodes);
  else if (expr.kind === 'UnaryExpr') collectExpressionDebugNodes(expr.expression, facetPath, sourceMapRuntime, state, nodes);
  else if (expr.kind === 'BinaryExpr') { collectExpressionDebugNodes(expr.left, facetPath, sourceMapRuntime, state, nodes); collectExpressionDebugNodes(expr.right, facetPath, sourceMapRuntime, state, nodes); }
  return nodes;
}

function eventKindCounts(events) {
  const counts = {};
  for (const event of events) counts[event.kind] = (counts[event.kind] ?? 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

function computeTraceRoots(traceLike) {
  const eventFingerprints = (traceLike.events ?? []).map(event => sha256({
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
    operation: event.operation ?? null,
  }));
  const summarySeed = {
    format: 'rcl.execution-trace-summary.v0.38',
    version: RCL_DEBUG_REPLAY_VERSION,
    program: traceLike.program,
    programRoot: traceLike.programRoot,
    lockRoot: traceLike.lockRoot,
    stateRoot: traceLike.stateRoot,
    sourceMapRoot: traceLike.sourceMapRoot,
    eventCount: traceLike.events?.length ?? 0,
    eventKindCounts: eventKindCounts(traceLike.events ?? []),
    eventFingerprints,
    gcSnapshotRoot: traceLike.gcSnapshotRoot ?? null,
    markSweepPlanRoot: traceLike.markSweepPlanRoot ?? null,
  };
  const summaryRoot = sha256(summarySeed);
  const traceRoot = sha256({
    format: traceLike.format,
    version: traceLike.version,
    program: traceLike.program,
    programRoot: traceLike.programRoot,
    lockRoot: traceLike.lockRoot,
    stateRoot: traceLike.stateRoot,
    sourceMapRoot: traceLike.sourceMapRoot,
    events: traceLike.events,
    gcSnapshotRoot: traceLike.gcSnapshotRoot ?? null,
    markSweepPlanRoot: traceLike.markSweepPlanRoot ?? null,
  });
  return { summarySeed, summaryRoot, traceRoot };
}

function watchpointMatches(watchpoint, event) {
  if (!watchpoint || !event) return false;
  if (watchpoint.kind === 'facet') return event.facet === watchpoint.facet;
  if (watchpoint.kind === 'source-location' || watchpoint.kind === 'location') return locationEquals(event.source, watchpoint.location ?? watchpoint);
  if (watchpoint.kind === 'semantic-node' || watchpoint.kind === 'semantic') return event.semanticNodeId === watchpoint.semanticNodeId;
  return false;
}

function normalizeWatchpoints(watchpoints = []) {
  return (watchpoints ?? []).map((watchpoint, index) => ({
    id: watchpoint.id ?? `watchpoint:${index + 1}`,
    kind: watchpoint.kind ?? (watchpoint.facet ? 'facet' : watchpoint.semanticNodeId ? 'semantic-node' : 'source-location'),
    ...watchpoint,
  }));
}

function createTraceEmitter({ programRoot, lockRoot, watchpoints }) {
  const events = [];
  let seq = 0;
  const normalizedWatchpoints = normalizeWatchpoints(watchpoints);
  const emit = (event) => {
    const base = {
      seq: seq += 1,
      programRoot,
      lockRoot,
      ...event,
    };
    events.push(base);
    for (const watchpoint of normalizedWatchpoints) {
      if (!watchpointMatches(watchpoint, base)) continue;
      events.push({
        seq: seq += 1,
        programRoot,
        lockRoot,
        kind: 'watchpoint.hit',
        watchpointId: watchpoint.id,
        watchpointKind: watchpoint.kind,
        triggeredBySeq: base.seq,
        facet: base.facet ?? null,
        semanticNodeId: base.semanticNodeId ?? null,
        source: base.source ?? null,
      });
    }
    return base;
  };
  return { events, emit, watchpoints: normalizedWatchpoints };
}

export class RCLExecutionTraceRuntime {
  constructor({ source, sourcePath = null, typeModuleSources = null, typePath = null, watchpoints = [], nativeRuntime = {} } = {}) {
    this.source = source ?? (sourcePath ? fs.readFileSync(sourcePath, 'utf8') : DEFAULT_DEBUG_REPLAY_SOURCE);
    this.sourcePath = sourcePath;
    this.typeModuleSources = typeModuleSources ?? (typePath ? readTypeSources(typePath) : DEFAULT_DEBUG_REPLAY_TYPE_MODULES);
    this.watchpoints = watchpoints;
    this.nativeRuntime = nativeRuntime;
  }

  run() {
    const mapResult = buildSourceMapRuntime({
      source: this.source,
      sourcePath: this.sourcePath,
      sourceFile: this.sourcePath,
      typeModuleSources: this.typeModuleSources,
    });
    if (!mapResult.ok) return { ok: false, diagnostics: mapResult.diagnostics };

    const { sourceMapRuntime, compiled } = mapResult;
    const native = runNativeBytecode(compiled.bytecode, this.nativeRuntime);
    const typedGc = compileTypedGcSnapshot(this.source, { typeModuleSources: this.typeModuleSources, nativeRuntime: this.nativeRuntime });
    if (!typedGc.ok) return { ok: false, diagnostics: typedGc.diagnostics };

    const programRoot = compiled.program.programRoot;
    const lockRoot = sourceMapRuntime.lockRoot;
    const emitter = createTraceEmitter({ programRoot, lockRoot, watchpoints: this.watchpoints });
    const state = native.state ?? {};

    for (const facet of compiled.program.facets ?? []) {
      const map = sourceMapRuntime.facets[facet.path];
      const value = state[facet.path];
      emitter.emit({
        kind: 'facet.evaluation',
        facet: facet.path,
        semanticNodeId: map?.semanticNodeId ?? semanticNodeIdForFacet(facet.path),
        source: map?.source ?? null,
        declaredType: map?.declaredType ?? facet.valueType,
        canonicalType: map?.canonicalType ?? facet.valueType,
        expressionKind: facet.value?.kind ?? null,
        valueKind: valueKind(value),
        valueRoot: sha256(value ?? null),
        valuePreview: compactValuePreview(value),
      });
    }

    for (const instruction of sourceMapRuntime.instructions ?? []) {
      emitter.emit({
        kind: 'rbc.instruction',
        facet: instruction.facet,
        semanticNodeId: instruction.semanticNodeId,
        source: instruction.source,
        rbc: {
          instructionIndex: instruction.instructionIndex,
          opcode: instruction.opcode,
          operands: instruction.operands,
        },
      });
    }

    for (const facet of compiled.program.facets ?? []) {
      const nodes = collectExpressionDebugNodes(facet.value, facet.path, sourceMapRuntime, state);
      for (const node of nodes.constructors) {
        emitter.emit({
          kind: 'typed.constructor',
          facet: facet.path,
          semanticNodeId: node.semanticNodeId,
          source: node.source,
          constructorKind: node.kind,
          canonicalType: node.canonicalType,
          typeName: node.typeName,
          variant: node.variant ?? null,
          fields: node.fields ?? null,
          payloadCount: node.payloadCount ?? null,
        });
      }
      for (const node of nodes.fieldAccesses) {
        emitter.emit({
          kind: 'typed.field.access',
          facet: facet.path,
          semanticNodeId: node.semanticNodeId,
          source: node.source,
          field: node.field,
          canonicalType: node.canonicalType,
          basePath: node.basePath,
          targetPath: node.targetPath,
        });
      }
      for (const node of nodes.matches) {
        emitter.emit({
          kind: 'typed.match.branch',
          facet: facet.path,
          semanticNodeId: node.semanticNodeId,
          source: node.source,
          canonicalType: node.canonicalType,
          targetPath: node.targetPath,
          selectedVariant: node.selectedVariant,
          selectedCaseIndex: node.selectedCaseIndex,
          cases: node.cases,
        });
      }
    }

    for (const instruction of sourceMapRuntime.instructions ?? []) {
      if (instruction.op !== OPCODES.CALL_PROVIDER) continue;
      emitter.emit({
        kind: 'provider.call',
        facet: instruction.facet,
        semanticNodeId: instruction.semanticNodeId,
        source: instruction.source,
        providerId: instruction.operands.providerId,
        capability: instruction.operands.capability,
        requestRoot: sha256(instruction.operands.requestJson ?? ''),
        deterministicMode: 'planned-native-call',
        rbc: { instructionIndex: instruction.instructionIndex, opcode: instruction.opcode },
      });
    }

    for (const object of typedGc.report.heapSnapshot.objects ?? []) {
      emitter.emit({
        kind: 'typed.object.creation',
        facet: object.paths?.[0] ?? null,
        semanticNodeId: object.paths?.[0] ? sourceMapRuntime.facets?.[object.paths[0]]?.semanticNodeId ?? null : null,
        source: object.paths?.[0] ? sourceMapRuntime.facets?.[object.paths[0]]?.source ?? null : null,
        objectId: object.objectId,
        objectKind: object.kind,
        canonicalType: object.canonicalType,
        firstPath: object.firstPath,
        valueRoot: sha256(object.value),
      });
    }

    for (const ref of typedGc.report.heapSnapshot.references ?? []) {
      emitter.emit({
        kind: 'typed.ref.creation',
        facet: ref.path,
        semanticNodeId: sourceMapRuntime.facets?.[ref.path]?.semanticNodeId ?? null,
        source: sourceMapRuntime.facets?.[ref.path]?.source ?? null,
        refObjectId: ref.objectId,
        targetKind: ref.targetKind,
        targetType: ref.targetType,
        parentObjectId: ref.parentObjectId,
        slot: ref.slot,
      });
    }

    emitter.emit({
      kind: 'gc.snapshot.root',
      snapshotRoot: typedGc.report.heapSnapshot.snapshotRoot,
      gcSnapshotRoot: typedGc.report.gcSnapshotRoot,
      rootCount: typedGc.report.heapSnapshot.roots.length,
      objectCount: typedGc.report.objectCount,
      referenceCount: typedGc.report.referenceCount,
    });
    emitter.emit({
      kind: 'gc.mark_sweep.root',
      planRoot: typedGc.report.markSweep.planRoot,
      retainedCount: typedGc.report.markSweep.retainedCount,
      reclaimableCount: typedGc.report.markSweep.reclaimableCount,
      sweepCandidateCount: typedGc.report.markSweep.sweepCandidateCount,
    });
    emitter.emit({
      kind: 'resource.operation',
      operation: 'typed-heap-snapshot-persist',
      resourceKind: 'typed-heap',
      snapshotRoot: typedGc.report.heapSnapshot.snapshotRoot,
      restoredStateRoot: typedGc.report.persistence.restoredStateRoot,
      allReferencesResolved: typedGc.report.persistence.allReferencesResolved,
    });
    emitter.emit({
      kind: 'resource.operation',
      operation: 'typed-mark-sweep-plan',
      resourceKind: 'typed-gc',
      planRoot: typedGc.report.markSweep.planRoot,
      sweepMode: typedGc.report.markSweep.sweepMode,
    });

    const trace = {
      format: RCL_EXECUTION_TRACE_FORMAT,
      version: RCL_DEBUG_REPLAY_VERSION,
      program: compiled.program.name,
      programRoot,
      lockRoot,
      typeModuleRoot: sourceMapRuntime.typeModuleRoot,
      stateRoot: realityRoot(state),
      sourceMapRoot: sourceMapRuntime.unifiedMapRoot,
      bytecodeRoot: sourceMapRuntime.bytecodeRoot,
      gcSnapshotRoot: typedGc.report.gcSnapshotRoot,
      heapSnapshotRoot: typedGc.report.heapSnapshot.snapshotRoot,
      markSweepPlanRoot: typedGc.report.markSweep.planRoot,
      watchpoints: emitter.watchpoints,
      nativeMetrics: native.metrics ?? {},
      events: emitter.events,
    };
    const roots = computeTraceRoots(trace);
    trace.eventCount = trace.events.length;
    trace.eventKindCounts = roots.summarySeed.eventKindCounts;
    trace.summaryRoot = roots.summaryRoot;
    trace.traceRoot = roots.traceRoot;

    const replay = replayTrace(trace);
    const debugReport = buildDebugReport({ sourceMapRuntime, trace, replay, typedGc: typedGc.report, native });
    return { ok: true, sourceMapRuntime, trace, replay, debugReport, compiled, native, typedGc: typedGc.report };
  }
}

export function runExecutionTrace(input = {}, options = {}) {
  const normalized = normalizeSourceInput(input, options);
  const runtime = new RCLExecutionTraceRuntime(normalized);
  return runtime.run();
}

export function replayTrace(traceOrPath, options = {}) {
  const trace = typeof traceOrPath === 'string' ? JSON.parse(fs.readFileSync(traceOrPath, 'utf8')) : traceOrPath;
  const roots = computeTraceRoots(trace);
  const replay = {
    format: RCL_TRACE_REPLAY_FORMAT,
    version: RCL_DEBUG_REPLAY_VERSION,
    mode: 'single-process-deterministic-seed',
    program: trace.program,
    programRoot: trace.programRoot,
    lockRoot: trace.lockRoot ?? null,
    sourceMapRoot: trace.sourceMapRoot ?? null,
    stateRoot: trace.stateRoot ?? null,
    gcSnapshotRoot: trace.gcSnapshotRoot ?? null,
    heapSnapshotRoot: trace.heapSnapshotRoot ?? null,
    markSweepPlanRoot: trace.markSweepPlanRoot ?? null,
    eventCount: trace.events?.length ?? 0,
    eventKindCounts: roots.summarySeed.eventKindCounts,
    recomputedSummaryRoot: roots.summaryRoot,
    recomputedTraceRoot: roots.traceRoot,
    originalSummaryRoot: trace.summaryRoot ?? null,
    originalTraceRoot: trace.traceRoot ?? null,
    deterministicReplay: roots.summaryRoot === trace.summaryRoot && roots.traceRoot === trace.traceRoot,
    boundary: 'Single-process deterministic replay seed: replays serialized trace evidence and verifies stable summary roots; it does not re-call external providers or distributed actors.',
  };
  replay.replayRoot = sha256({
    format: replay.format,
    version: replay.version,
    programRoot: replay.programRoot,
    lockRoot: replay.lockRoot,
    eventCount: replay.eventCount,
    eventKindCounts: replay.eventKindCounts,
    recomputedSummaryRoot: replay.recomputedSummaryRoot,
    recomputedTraceRoot: replay.recomputedTraceRoot,
    deterministicReplay: replay.deterministicReplay,
  });
  if (options.outputDir) {
    fs.mkdirSync(options.outputDir, { recursive: true });
    fs.writeFileSync(path.join(options.outputDir, 'replay-report.json'), `${JSON.stringify(replay, null, 2)}\n`);
  }
  return replay;
}

export function buildDebugReport({ sourceMapRuntime, trace, replay, typedGc, native } = {}) {
  const report = {
    format: RCL_DEBUG_REPORT_FORMAT,
    version: RCL_DEBUG_REPLAY_VERSION,
    program: trace.program,
    programRoot: trace.programRoot,
    lockRoot: trace.lockRoot,
    sourceMapRoot: sourceMapRuntime.unifiedMapRoot,
    traceRoot: trace.traceRoot,
    summaryRoot: trace.summaryRoot,
    replayRoot: replay.replayRoot,
    deterministicReplay: replay.deterministicReplay,
    facetCount: Object.keys(sourceMapRuntime.facets ?? {}).length,
    instructionCount: sourceMapRuntime.instructions?.length ?? 0,
    eventCount: trace.eventCount,
    eventKindCounts: trace.eventKindCounts,
    watchpointHitCount: trace.eventKindCounts['watchpoint.hit'] ?? 0,
    typedHeap: {
      objectCount: typedGc.objectCount,
      referenceCount: typedGc.referenceCount,
      heapSnapshotRoot: typedGc.heapSnapshot.snapshotRoot,
      gcSnapshotRoot: typedGc.gcSnapshotRoot,
      markSweepPlanRoot: typedGc.markSweep.planRoot,
      retainedCount: typedGc.markSweep.retainedCount,
      reclaimableCount: typedGc.markSweep.reclaimableCount,
    },
    nativeMetrics: native.metrics ?? {},
    boundary: 'P4 v0.38 seed covers source-map queries, serializable trace events, watchpoint hits and deterministic single-process replay. Interactive stepping, DAP, profiler UI and distributed replay remain future cuts.',
  };
  report.debugReportRoot = sha256(report);
  return report;
}

export function writeTraceRunReports(sourcePath, typePath, outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-trace-run-')), options = {}) {
  const watchpoints = options.watchpoints ?? (options.watchpointsPath ? JSON.parse(fs.readFileSync(options.watchpointsPath, 'utf8')) : []);
  const result = runExecutionTrace({ sourcePath, typePath, watchpoints, nativeRuntime: options.nativeRuntime ?? {} });
  if (!result.ok) return result;
  fs.mkdirSync(outputDir, { recursive: true });
  const paths = {
    sourceMapPath: path.join(outputDir, 'source-map-runtime.json'),
    tracePath: path.join(outputDir, 'trace.json'),
    replayPath: path.join(outputDir, 'replay-report.json'),
    debugReportPath: path.join(outputDir, 'debug-report.json'),
  };
  fs.writeFileSync(paths.sourceMapPath, `${JSON.stringify(result.sourceMapRuntime, null, 2)}\n`);
  fs.writeFileSync(paths.tracePath, `${JSON.stringify(result.trace, null, 2)}\n`);
  fs.writeFileSync(paths.replayPath, `${JSON.stringify(result.replay, null, 2)}\n`);
  fs.writeFileSync(paths.debugReportPath, `${JSON.stringify(result.debugReport, null, 2)}\n`);
  return {
    ok: true,
    version: RCL_DEBUG_REPLAY_VERSION,
    outputDir,
    ...paths,
    program: result.trace.program,
    programRoot: result.trace.programRoot,
    lockRoot: result.trace.lockRoot,
    sourceMapRoot: result.sourceMapRuntime.unifiedMapRoot,
    traceRoot: result.trace.traceRoot,
    summaryRoot: result.trace.summaryRoot,
    replayRoot: result.replay.replayRoot,
    deterministicReplay: result.replay.deterministicReplay,
    eventCount: result.trace.eventCount,
    eventKindCounts: result.trace.eventKindCounts,
    watchpointHitCount: result.debugReport.watchpointHitCount,
    heapSnapshotRoot: result.trace.heapSnapshotRoot,
    markSweepPlanRoot: result.trace.markSweepPlanRoot,
    boundary: result.debugReport.boundary,
  };
}

export function runDebugMapDemo(options = {}) {
  const watchpoints = options.watchpoints ?? [
    { id: 'wp-facet-session', kind: 'facet', facet: 'app.session' },
    { id: 'wp-semantic-login-ref', kind: 'semantic-node', semanticNodeId: 'facet:app.loginRef' },
  ];
  const mapResult = buildSourceMapRuntime({
    source: options.source ?? DEFAULT_DEBUG_REPLAY_SOURCE,
    typeModuleSources: options.typeModuleSources ?? DEFAULT_DEBUG_REPLAY_TYPE_MODULES,
    sourceFile: options.sourceFile ?? 'examples/debug-replay/src/app.rcl',
  });
  if (!mapResult.ok) return mapResult;
  const stateQuery = querySourceMapRuntime(mapResult.sourceMapRuntime, { statePath: 'app.session' });
  const semanticQuery = querySourceMapRuntime(mapResult.sourceMapRuntime, { semanticNodeId: 'facet:app.sessionRef' });
  const firstStore = mapResult.sourceMapRuntime.instructions.find(item => item.opcode === 'STORE_STATE' && item.facet === 'app.session');
  const instructionQuery = querySourceMapRuntime(mapResult.sourceMapRuntime, { instructionIndex: firstStore?.instructionIndex ?? 0 });
  const traceResult = runExecutionTrace({ source: options.source ?? DEFAULT_DEBUG_REPLAY_SOURCE, typeModuleSources: options.typeModuleSources ?? DEFAULT_DEBUG_REPLAY_TYPE_MODULES, watchpoints });
  if (!traceResult.ok) return traceResult;
  return {
    ok: true,
    version: RCL_DEBUG_REPLAY_VERSION,
    sourceMapFormat: mapResult.sourceMapRuntime.format,
    traceFormat: traceResult.trace.format,
    replayFormat: traceResult.replay.format,
    program: mapResult.sourceMapRuntime.program,
    programRoot: mapResult.sourceMapRuntime.programRoot,
    lockRoot: mapResult.sourceMapRuntime.lockRoot,
    sourceMapRoot: mapResult.sourceMapRuntime.unifiedMapRoot,
    traceRoot: traceResult.trace.traceRoot,
    replayRoot: traceResult.replay.replayRoot,
    deterministicReplay: traceResult.replay.deterministicReplay,
    queryResults: { stateQuery, semanticQuery, instructionQuery },
    eventKindCounts: traceResult.trace.eventKindCounts,
    watchpointHitCount: traceResult.debugReport.watchpointHitCount,
    boundary: traceResult.debugReport.boundary,
  };
}
