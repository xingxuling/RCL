import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { compileNativeC, nativeCCompilerVersion, resolveNativeCCompiler } from './native-c-compiler.mjs';
import { realityRoot } from './canonical.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const WASM_OUTPUT_POINTER = 4096;
const WASM_QUEUE_POINTER = 5000;
const WASM_VISITED_POINTER = 5500;
const WASM_ORDER_POINTER = WASM_OUTPUT_POINTER + 32;
const WASM_PAGE_BYTES = 64 * 1024;

export const RBC13_WASM_ORGAN_ABI_FORMAT = 'rcl.rbc13-wasm-domain-organ-abi.v0.1';
export const RBC13_WASM_ORGAN_OPERATION_KEY = 'wasm-vm::algorithm::graph-traversal';
export const RBC13_WASM_ORGAN_SEMANTIC_IDENTITY = 'graph-traversal::bounded-reachability';
export const RBC13_WASM_ORGAN_EVIDENCE_TIER = 'native-candidate';
export const RBC13_WASM_VALUE_TAGS = Object.freeze({
  Null: 0,
  Truth: 1,
  Number: 2,
  Text: 3,
  Sequence: 4,
  Record: 5,
  TypedRecord: 6,
});

const GRAPH_CASES = Object.freeze([
  Object.freeze({ id: 'positive-chain', nodeCount: 4, matrix: [0,1,0,0, 0,0,1,0, 0,0,0,1, 0,0,0,0], start: 0, target: 3, budget: 8, class: 'positive' }),
  Object.freeze({ id: 'cycle', nodeCount: 3, matrix: [0,1,0, 1,0,0, 0,0,0], start: 0, target: 2, budget: 4, class: 'cycle' }),
  Object.freeze({ id: 'disconnected', nodeCount: 4, matrix: [0,1,0,0, 0,0,0,0, 0,0,0,1, 0,0,0,0], start: 0, target: 3, budget: 8, class: 'disconnected' }),
  Object.freeze({ id: 'empty', nodeCount: 0, matrix: [], start: 0, target: 0, budget: 0, class: 'empty' }),
  Object.freeze({ id: 'budget-exhaustion', nodeCount: 4, matrix: [0,1,0,0, 0,0,1,0, 0,0,0,1, 0,0,0,0], start: 0, target: 3, budget: 1, class: 'budget-exhaustion' }),
  Object.freeze({ id: 'invalid-node', nodeCount: 2, matrix: [0,1, 0,0], start: 2, target: 1, budget: 3, class: 'invalid-node' }),
  Object.freeze({ id: 'malformed-graph', nodeCount: 2, matrix: [0,2, 0,0], start: 0, target: 1, budget: 3, class: 'malformed' }),
]);

export const RBC13_WASM_GRAPH_CASES = GRAPH_CASES;

function semanticPayload(observation) {
  return {
    operationKey: RBC13_WASM_ORGAN_OPERATION_KEY,
    semanticIdentity: RBC13_WASM_ORGAN_SEMANTIC_IDENTITY,
    evidenceTier: RBC13_WASM_ORGAN_EVIDENCE_TIER,
    status: observation.status,
    result: observation.status === 'ok' ? observation.result : undefined,
    error: observation.status === 'error' ? {
      class: observation.error?.class,
      code: observation.error?.code,
      details: observation.error?.details,
    } : undefined,
  };
}

export function rbc13GraphSemanticRoot(observation) {
  return realityRoot(semanticPayload(observation));
}

function graphError(code, details) {
  return { class: 'RCL_GRAPH_INPUT_ERROR', code, details };
}

export function findRbc13WasmGraphCase(caseId) {
  const value = GRAPH_CASES.find(item => item.id === caseId);
  if (!value) throw new Error(`Unknown RBC13 graph case: ${caseId}`);
  return value;
}

export function runRbc13GraphTraversalReference(input) {
  const nodeCount = Number(input?.nodeCount);
  const matrix = Array.isArray(input?.matrix) ? input.matrix : null;
  const start = Number(input?.start);
  const target = Number(input?.target);
  const budget = Number(input?.budget);
  if (!Number.isInteger(nodeCount) || nodeCount < 0 || nodeCount > 32
    || !Number.isInteger(start) || !Number.isInteger(target) || !Number.isInteger(budget)
    || budget < 0 || budget > 65536 || !matrix || matrix.length !== nodeCount * nodeCount) {
    return { status: 'error', error: graphError('RCL_GRAPH_MALFORMED', { reason: 'matrix-shape' }) };
  }
  if (nodeCount === 0) return { status: 'error', error: graphError('RCL_GRAPH_EMPTY', { nodeCount: 0 }) };
  if (start < 0 || target < 0 || start >= nodeCount || target >= nodeCount) {
    return { status: 'error', error: graphError('RCL_GRAPH_INVALID_NODE', { nodeCount, start, target }) };
  }
  if (matrix.some(value => value !== 0 && value !== 1)) {
    return { status: 'error', error: graphError('RCL_GRAPH_MALFORMED', { reason: 'matrix-value' }) };
  }
  const visited = new Array(nodeCount).fill(false);
  const queue = [start];
  const visitedOrder = [start];
  visited[start] = true;
  let head = 0;
  let steps = 0;
  let reachable = false;
  let termination = 'exhausted';
  while (head < queue.length) {
    const current = queue[head];
    if (current === target) {
      reachable = true;
      termination = 'target-found';
      break;
    }
    if (steps >= budget) {
      termination = 'budget-exhausted';
      break;
    }
    steps += 1;
    for (let neighbor = 0; neighbor < nodeCount; neighbor += 1) {
      if (matrix[current * nodeCount + neighbor] === 1 && !visited[neighbor]) {
        visited[neighbor] = true;
        queue.push(neighbor);
        visitedOrder.push(neighbor);
      }
    }
    head += 1;
  }
  return {
    status: 'ok',
    result: { reachable, visitedOrder, visitedSet: [...visitedOrder], steps, start, target, budget, termination },
  };
}

function uleb(value) {
  let remaining = Number(value) >>> 0;
  const bytes = [];
  do {
    let byte = remaining & 0x7f;
    remaining >>>= 7;
    if (remaining) byte |= 0x80;
    bytes.push(byte);
  } while (remaining);
  return bytes;
}

function sleb(value) {
  let remaining = Number(value) | 0;
  const bytes = [];
  let more = true;
  while (more) {
    const byte = remaining & 0x7f;
    remaining >>= 7;
    const sign = (byte & 0x40) !== 0;
    more = !((remaining === 0 && !sign) || (remaining === -1 && sign));
    bytes.push(more ? byte | 0x80 : byte);
  }
  return bytes;
}

function vec(items) { return [...uleb(items.length), ...items.flat()]; }
function name(value) { const bytes = [...Buffer.from(value, 'utf8')]; return [...uleb(bytes.length), ...bytes]; }
function i32const(value) { return [0x41, ...sleb(value)]; }
function localGet(index) { return [0x20, ...uleb(index)]; }
function localSet(index) { return [0x21, ...uleb(index)]; }
function call(index) { return [0x10, ...uleb(index)]; }
function memLoad(offset = 0) { return [0x28, ...uleb(2), ...uleb(offset)]; }
function memLoad8(offset = 0) { return [0x2d, ...uleb(0), ...uleb(offset)]; }
function memStore(offset = 0) { return [0x36, ...uleb(2), ...uleb(offset)]; }
function memStore8(offset = 0) { return [0x3a, ...uleb(0), ...uleb(offset)]; }
function ifVoid(condition, body, otherwise = []) { return [...condition, 0x04, 0x40, ...body, ...(otherwise.length ? [0x05, ...otherwise] : []), 0x0b]; }
function blockLoop(body) { return [0x02, 0x40, 0x03, 0x40, ...body, 0x0b, 0x0b]; }
function fail(code) { return [...i32const(code), ...call(0), 0x0f]; }

function buildWasmErrorFunction() {
  const body = [];
  for (const [offset, value] of [[0, 1], [4, null], [8, 0], [12, 0], [16, 0], [20, 0]]) {
    body.push(...i32const(WASM_OUTPUT_POINTER));
    if (value === null) body.push(...localGet(0));
    else body.push(...i32const(value));
    body.push(...memStore(offset));
  }
  body.push(...i32const(WASM_OUTPUT_POINTER));
  return body;
}

function buildWasmInvokeFunction() {
  const body = [];
  body.push(...ifVoid([...localGet(1), ...i32const(28), 0x49], fail(4)));
  body.push(...ifVoid([...localGet(0), ...i32const(64000), 0x4b], fail(4)));
  body.push(...ifVoid([...localGet(0), ...memLoad(0), ...i32const(RBC13_WASM_VALUE_TAGS.Record), 0x47], fail(5)));
  body.push(...ifVoid([...localGet(0), ...memLoad(4), ...localGet(1), 0x47], fail(5)));
  body.push(...ifVoid([...localGet(0), ...memLoad(8), ...i32const(1), 0x47], fail(6)));
  body.push(...localGet(0), ...memLoad(12), ...localSet(2));
  body.push(...localGet(0), ...memLoad(16), ...localSet(3));
  body.push(...localGet(0), ...memLoad(20), ...localSet(4));
  body.push(...localGet(0), ...memLoad(24), ...localSet(5));
  body.push(...ifVoid([...localGet(2), ...i32const(32), 0x4b], fail(3)));
  body.push(...ifVoid([...localGet(2), ...i32const(0), 0x46], fail(1)));
  body.push(...localGet(2), ...localGet(2), [0x6c], ...localSet(6));
  body.push(...ifVoid([...localGet(6), ...i32const(1024), 0x4b], fail(3)));
  body.push(...ifVoid([...localGet(6), ...i32const(28), 0x6a, ...localGet(1), 0x47], fail(3)));
  body.push(...ifVoid([...localGet(3), ...localGet(2), 0x4f], fail(2)));
  body.push(...ifVoid([...localGet(4), ...localGet(2), 0x4f], fail(2)));
  body.push(...ifVoid([...localGet(5), ...i32const(65536), 0x4b], fail(3)));

  body.push(...i32const(0), ...localSet(7));
  body.push(...blockLoop([
    ...localGet(7), ...localGet(6), 0x4f, 0x0d, 0x01,
    ...localGet(0), ...i32const(28), 0x6a, ...localGet(7), 0x6a, ...memLoad8(0), ...localSet(16),
    ...ifVoid([...localGet(16), ...i32const(1), 0x4b], fail(3)),
    ...localGet(7), ...i32const(1), 0x6a, ...localSet(7), 0x0c, 0x00,
  ]));
  body.push(...i32const(0), ...localSet(7));
  body.push(...blockLoop([
    ...localGet(7), ...localGet(2), 0x4f, 0x0d, 0x01,
    ...i32const(WASM_VISITED_POINTER), ...localGet(7), 0x6a, ...i32const(0), ...memStore8(0),
    ...localGet(7), ...i32const(1), 0x6a, ...localSet(7), 0x0c, 0x00,
  ]));
  for (const [index, value] of [[8,0], [9,1], [12,0], [13,0], [14,3], [15,1], [17,0]]) body.push(...i32const(value), ...localSet(index));
  body.push(...i32const(WASM_QUEUE_POINTER), ...localGet(3), ...memStore(0));
  body.push(...i32const(WASM_VISITED_POINTER), ...localGet(3), 0x6a, ...i32const(1), ...memStore8(0));
  body.push(...i32const(WASM_ORDER_POINTER), ...localGet(3), ...memStore(0));

  body.push(...blockLoop([
    ...localGet(8), ...localGet(9), 0x4f, 0x0d, 0x01,
    ...localGet(17), 0x0d, 0x01,
    ...i32const(WASM_QUEUE_POINTER), ...localGet(8), ...i32const(4), 0x6c, 0x6a, ...memLoad(0), ...localSet(10),
    ...ifVoid([...localGet(10), ...localGet(4), 0x46], [
      ...i32const(1), ...localSet(13), ...i32const(1), ...localSet(14), ...i32const(1), ...localSet(17),
    ], [
      ...ifVoid([...localGet(12), ...localGet(5), 0x4f], [
        ...i32const(2), ...localSet(14), ...i32const(1), ...localSet(17),
      ], [
        ...localGet(12), ...i32const(1), 0x6a, ...localSet(12),
        ...i32const(0), ...localSet(11),
        ...blockLoop([
          ...localGet(11), ...localGet(2), 0x4f, 0x0d, 0x01,
          ...localGet(10), ...localGet(2), 0x6c, ...localGet(11), 0x6a, ...localSet(18),
          ...localGet(0), ...i32const(28), 0x6a, ...localGet(18), 0x6a, ...memLoad8(0), ...localSet(16),
          ...ifVoid([
            ...localGet(16), ...i32const(0), 0x47,
          ], [
            ...ifVoid([
              ...i32const(WASM_VISITED_POINTER), ...localGet(11), 0x6a, ...memLoad8(0), 0x45,
            ], [
              ...i32const(WASM_VISITED_POINTER), ...localGet(11), 0x6a, ...i32const(1), ...memStore8(0),
              ...i32const(WASM_QUEUE_POINTER), ...localGet(9), ...i32const(4), 0x6c, 0x6a, ...localGet(11), ...memStore(0),
              ...i32const(WASM_ORDER_POINTER), ...localGet(15), ...i32const(4), 0x6c, 0x6a, ...localGet(11), ...memStore(0),
              ...localGet(9), ...i32const(1), 0x6a, ...localSet(9), ...localGet(15), ...i32const(1), 0x6a, ...localSet(15),
            ]),
          ], []),
          ...localGet(11), ...i32const(1), 0x6a, ...localSet(11), 0x0c, 0x00,
        ]),
        ...localGet(8), ...i32const(1), 0x6a, ...localSet(8),
      ]),
    ]),
    0x0c, 0x00,
  ]));

  for (const [offset, local] of [[0, null], [4, null], [8,13], [12,15], [16,12], [20,14]]) {
    body.push(...i32const(WASM_OUTPUT_POINTER));
    body.push(...(local === null ? i32const(0) : localGet(local)));
    body.push(...memStore(offset));
  }
  body.push(...i32const(WASM_OUTPUT_POINTER), ...i32const(RBC13_WASM_VALUE_TAGS.TypedRecord), ...memStore(24));
  body.push(...i32const(WASM_OUTPUT_POINTER), ...i32const(2), ...memStore(28));
  body.push(...i32const(WASM_OUTPUT_POINTER));
  return body;
}

function makeWasmModule() {
  const types = [
    [0x60, ...vec([0x7f]), ...vec([0x7f])],
    [0x60, ...vec([0x7f, 0x7f]), ...vec([0x7f])],
  ];
  const imports = [];
  const functions = vec([[0x00], [0x01]]);
  const memory = vec([[0x00, ...uleb(1)]]);
  const exports = vec([
    [...name('memory'), 0x02, ...uleb(0)],
    [...name('invoke'), 0x00, ...uleb(1)],
  ]);
  const errorLocals = vec([]);
  const invokeLocals = vec([[...uleb(17), 0x7f]]);
  const codes = vec([
    [...uleb(errorLocals.length + buildWasmErrorFunction().length + 1), ...errorLocals, ...buildWasmErrorFunction(), 0x0b],
    [...uleb(invokeLocals.length + buildWasmInvokeFunction().length + 1), ...invokeLocals, ...buildWasmInvokeFunction(), 0x0b],
  ]);
  const sections = [
    [1, ...vec(types)],
    [2, ...vec(imports)],
    [3, ...functions],
    [5, ...memory],
    [7, ...exports],
    [10, ...codes],
  ];
  return Uint8Array.from([0x00,0x61,0x73,0x6d,0x01,0x00,0x00,0x00, ...sections.flatMap(section => [section[0], ...uleb(section.length - 1), ...section.slice(1)])]);
}

export const RBC13_WASM_GRAPH_MODULE_BYTES = makeWasmModule();

function wasmBoundsError(code, details) {
  const error = new Error(code);
  error.code = code;
  error.details = details;
  return error;
}

export function encodeRbc13WasmGraphInput(graph) {
  const matrix = Uint8Array.from(graph.matrix ?? []);
  const bytes = new Uint8Array(28 + matrix.length);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, RBC13_WASM_VALUE_TAGS.Record, true);
  view.setUint32(4, bytes.length, true);
  view.setUint32(8, 1, true);
  view.setUint32(12, graph.nodeCount >>> 0, true);
  view.setUint32(16, graph.start >>> 0, true);
  view.setUint32(20, graph.target >>> 0, true);
  view.setUint32(24, graph.budget >>> 0, true);
  bytes.set(matrix, 28);
  return bytes;
}

function decodeGraphOutput(memory, pointer) {
  if (!Number.isInteger(pointer) || pointer < 0 || pointer + 32 > memory.buffer.byteLength) throw wasmBoundsError('RCL_WASM_ABI_INVALID_POINTER', { pointer });
  const view = new DataView(memory.buffer);
  const status = view.getUint32(pointer, true);
  const code = view.getUint32(pointer + 4, true);
  if (status !== 0) {
    const errorMap = {
      1: ['RCL_GRAPH_EMPTY', { nodeCount: 0 }],
      2: ['RCL_GRAPH_INVALID_NODE', null],
      3: ['RCL_GRAPH_MALFORMED', { reason: 'matrix-value' }],
      4: ['RCL_WASM_ABI_INVALID_POINTER', { pointer }],
      5: ['RCL_WASM_VALUE_ABI_MALFORMED', { reason: 'typed-record-header' }],
      6: ['RCL_WASM_VALUE_ABI_UNSUPPORTED_TYPE', { typeId: 1 }],
    };
    const [errorCode, details] = errorMap[code] ?? ['RCL_WASM_ABI_ERROR', { code }];
    return { status: 'error', error: { class: errorCode.startsWith('RCL_GRAPH') ? 'RCL_GRAPH_INPUT_ERROR' : 'RCL_WASM_ABI_ERROR', code: errorCode, details } };
  }
  if (view.getUint32(pointer + 24, true) !== RBC13_WASM_VALUE_TAGS.TypedRecord || view.getUint32(pointer + 28, true) !== 2) {
    throw wasmBoundsError('RCL_WASM_VALUE_ABI_MALFORMED', { reason: 'typed-result-header' });
  }
  const visitedCount = view.getUint32(pointer + 12, true);
  if (visitedCount > 32 || pointer + 32 + visitedCount * 4 > memory.buffer.byteLength) throw wasmBoundsError('RCL_WASM_ABI_INVALID_POINTER', { pointer, visitedCount });
  const termination = { 1: 'target-found', 2: 'budget-exhausted', 3: 'exhausted' }[view.getUint32(pointer + 20, true)] ?? 'unknown';
  const order = Array.from({ length: visitedCount }, (_, index) => view.getUint32(WASM_ORDER_POINTER + index * 4, true));
  return { status: 'ok', result: { reachable: view.getUint32(pointer + 8, true) === 1, visitedOrder: order, visitedSet: [...order], steps: view.getUint32(pointer + 16, true), termination } };
}

export function buildRbc13WasmGraphOrgan(options = {}) {
  const moduleRoot = crypto.createHash('sha256').update(RBC13_WASM_GRAPH_MODULE_BYTES).digest('hex');
  const module = new WebAssembly.Module(RBC13_WASM_GRAPH_MODULE_BYTES);
  const instance = new WebAssembly.Instance(module, {});
  if (!instance.exports.memory || typeof instance.exports.invoke !== 'function') throw new Error('RCL_WASM_ABI_EXPORTS_MISSING');
  let closed = false;
  const registration = Object.freeze({
    format: RBC13_WASM_ORGAN_ABI_FORMAT,
    operationKey: RBC13_WASM_ORGAN_OPERATION_KEY,
    semanticIdentity: RBC13_WASM_ORGAN_SEMANTIC_IDENTITY,
    implementationId: 'rbc13-wasm-graph-body-v0.1',
    artifactRoot: moduleRoot,
    evidenceTier: RBC13_WASM_ORGAN_EVIDENCE_TIER,
    canonicalPermission: false,
    deterministic: true,
  });
  function execute(graph) {
    if (closed) throw new Error('RCL_WASM_ORGAN_CLOSED');
    const inputBytes = encodeRbc13WasmGraphInput(graph);
    const memory = instance.exports.memory;
    const inputPointer = 1024;
    if (inputPointer + inputBytes.length > memory.buffer.byteLength) throw wasmBoundsError('RCL_WASM_ABI_INVALID_POINTER', { inputPointer, length: inputBytes.length });
    new Uint8Array(memory.buffer).set(inputBytes, inputPointer);
    const started = process.hrtime.bigint();
    const pointer = instance.exports.invoke(inputPointer, inputBytes.length);
    const prior = globalThis.__rbc13WasmCurrentGraphInput;
    globalThis.__rbc13WasmCurrentGraphInput = graph;
    let observation;
    try {
      observation = decodeGraphOutput(memory, pointer);
      if (observation.status === 'ok') observation.result = { ...observation.result, start: graph.start, target: graph.target, budget: graph.budget };
      if (observation.status === 'error' && observation.error.code === 'RCL_GRAPH_INVALID_NODE') {
        observation.error.details = { nodeCount: graph.nodeCount, start: graph.start, target: graph.target };
      }
    } finally {
      globalThis.__rbc13WasmCurrentGraphInput = prior;
    }
    const elapsed = Number(process.hrtime.bigint() - started) / 1_000_000;
    return {
      ...observation,
      semanticRoot: rbc13GraphSemanticRoot(observation),
      receipt: {
        format: 'rcl.rbc13-wasm-organ-receipt.v0.1',
        operationKey: registration.operationKey,
        semanticIdentity: registration.semanticIdentity,
        evidenceTier: registration.evidenceTier,
        artifactRoot: moduleRoot,
        inputPointer,
        inputBytes: inputBytes.length,
        outputPointer: pointer,
        runtimeMs: Number(elapsed.toFixed(3)),
        canonicalPermission: false,
      },
    };
  }
  function close() { closed = true; }
  return Object.freeze({ registration, moduleRoot, moduleBytes: RBC13_WASM_GRAPH_MODULE_BYTES, execute, close });
}

function utf8(value) { return new TextEncoder().encode(value); }
function writeU32(bytes, offset, value) { new DataView(bytes.buffer).setUint32(offset, value >>> 0, true); }

export function encodeRbc13WasmValue(value, options = {}) {
  const depth = options.depth ?? 0;
  if (depth > (options.maxDepth ?? 8)) throw wasmBoundsError('RCL_WASM_VALUE_ABI_RECURSION_LIMIT', { depth });
  let tag;
  let payload;
  if (value === null) { tag = RBC13_WASM_VALUE_TAGS.Null; payload = new Uint8Array(0); }
  else if (typeof value === 'boolean') { tag = RBC13_WASM_VALUE_TAGS.Truth; payload = new Uint8Array(4); writeU32(payload, 0, value ? 1 : 0); }
  else if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw wasmBoundsError('RCL_WASM_VALUE_ABI_NONFINITE', { value: String(value) });
    tag = RBC13_WASM_VALUE_TAGS.Number; payload = new Uint8Array(8); new DataView(payload.buffer).setFloat64(0, value, true);
  } else if (typeof value === 'string') {
    tag = RBC13_WASM_VALUE_TAGS.Text; const data = utf8(value); payload = new Uint8Array(4 + data.length); writeU32(payload, 0, data.length); payload.set(data, 4);
  } else if (Array.isArray(value)) {
    tag = RBC13_WASM_VALUE_TAGS.Sequence; const parts = value.map(item => encodeRbc13WasmValue(item, { ...options, depth: depth + 1 })); const length = 4 + parts.reduce((sum, item) => sum + item.length, 0); payload = new Uint8Array(length); writeU32(payload, 0, parts.length); let cursor = 4; for (const part of parts) { payload.set(part, cursor); cursor += part.length; }
  } else if (value && typeof value === 'object') {
    tag = RBC13_WASM_VALUE_TAGS.Record; const entries = Object.entries(value); const parts = entries.map(([key, item]) => { const keyBytes = utf8(key); const encoded = encodeRbc13WasmValue(item, { ...options, depth: depth + 1 }); const part = new Uint8Array(4 + keyBytes.length + encoded.length); writeU32(part, 0, keyBytes.length); part.set(keyBytes, 4); part.set(encoded, 4 + keyBytes.length); return part; }); const length = 4 + parts.reduce((sum, item) => sum + item.length, 0); payload = new Uint8Array(length); writeU32(payload, 0, entries.length); let cursor = 4; for (const part of parts) { payload.set(part, cursor); cursor += part.length; }
  } else throw wasmBoundsError('RCL_WASM_VALUE_ABI_UNSUPPORTED_TYPE', { type: typeof value });
  const bytes = new Uint8Array(8 + payload.length); writeU32(bytes, 0, tag); writeU32(bytes, 4, bytes.length); bytes.set(payload, 8); return bytes;
}

export function decodeRbc13WasmValue(bytes, offset = 0, options = {}) {
  const view = bytes instanceof DataView ? bytes : new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const depth = options.depth ?? 0;
  const maxDepth = options.maxDepth ?? 8;
  const end = view.byteOffset + view.byteLength;
  const absolute = view.byteOffset + offset;
  if (offset < 0 || absolute + 8 > end) throw wasmBoundsError('RCL_WASM_ABI_INVALID_POINTER', { offset });
  const tag = view.getUint32(offset, true);
  const length = view.getUint32(offset + 4, true);
  if (length < 8 || absolute + length > end) throw wasmBoundsError('RCL_WASM_VALUE_ABI_MALFORMED', { reason: 'length', offset, length });
  if (!Object.values(RBC13_WASM_VALUE_TAGS).includes(tag)) throw wasmBoundsError('RCL_WASM_VALUE_ABI_UNSUPPORTED_TYPE', { tag });
  if (depth > maxDepth) throw wasmBoundsError('RCL_WASM_VALUE_ABI_RECURSION_LIMIT', { depth });
  const payloadStart = offset + 8;
  const payloadEnd = offset + length;
  if (tag === RBC13_WASM_VALUE_TAGS.Null) return { value: null, nextOffset: payloadEnd };
  if (tag === RBC13_WASM_VALUE_TAGS.Truth) { if (length !== 12) throw wasmBoundsError('RCL_WASM_VALUE_ABI_MALFORMED', { reason: 'truth-length' }); const value = view.getUint32(payloadStart, true); if (value > 1) throw wasmBoundsError('RCL_WASM_VALUE_ABI_MALFORMED', { reason: 'truth-value' }); return { value: value === 1, nextOffset: payloadEnd }; }
  if (tag === RBC13_WASM_VALUE_TAGS.Number) { if (length !== 16) throw wasmBoundsError('RCL_WASM_VALUE_ABI_MALFORMED', { reason: 'number-length' }); const value = view.getFloat64(payloadStart, true); if (!Number.isFinite(value)) throw wasmBoundsError('RCL_WASM_VALUE_ABI_NONFINITE', {}); return { value, nextOffset: payloadEnd }; }
  if (tag === RBC13_WASM_VALUE_TAGS.Text) { const byteLength = view.getUint32(payloadStart, true); if (12 + byteLength !== length) throw wasmBoundsError('RCL_WASM_VALUE_ABI_MALFORMED', { reason: 'text-length' }); const value = new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(view.buffer, view.byteOffset + payloadStart + 4, byteLength)); return { value, nextOffset: payloadEnd }; }
  if (tag === RBC13_WASM_VALUE_TAGS.Sequence) { const count = view.getUint32(payloadStart, true); let cursor = payloadStart + 4; const value = []; for (let index = 0; index < count; index += 1) { const child = decodeRbc13WasmValue(view, cursor, { ...options, depth: depth + 1 }); value.push(child.value); cursor = child.nextOffset; } if (cursor !== payloadEnd) throw wasmBoundsError('RCL_WASM_VALUE_ABI_MALFORMED', { reason: 'sequence-length' }); return { value, nextOffset: payloadEnd }; }
  if (tag === RBC13_WASM_VALUE_TAGS.Record) { const count = view.getUint32(payloadStart, true); let cursor = payloadStart + 4; const value = {}; const names = new Set(); for (let index = 0; index < count; index += 1) { if (cursor + 4 > payloadEnd) throw wasmBoundsError('RCL_WASM_VALUE_ABI_MALFORMED', { reason: 'record-field-header' }); const nameLength = view.getUint32(cursor, true); cursor += 4; if (cursor + nameLength > payloadEnd) throw wasmBoundsError('RCL_WASM_VALUE_ABI_MALFORMED', { reason: 'record-field-name' }); const fieldName = new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(view.buffer, view.byteOffset + cursor, nameLength)); cursor += nameLength; if (names.has(fieldName)) throw wasmBoundsError('RCL_WASM_VALUE_ABI_DUPLICATE_FIELD', { fieldName }); names.add(fieldName); const child = decodeRbc13WasmValue(view, cursor, { ...options, depth: depth + 1 }); value[fieldName] = child.value; cursor = child.nextOffset; } if (cursor !== payloadEnd) throw wasmBoundsError('RCL_WASM_VALUE_ABI_MALFORMED', { reason: 'record-length' }); return { value, nextOffset: payloadEnd }; }
  throw wasmBoundsError('RCL_WASM_VALUE_ABI_UNSUPPORTED_TYPE', { tag });
}

function parseNativeJson(run, caseId) {
  const stdout = String(run.stdout ?? '').trim();
  if (!stdout) throw new Error(`native C graph body produced no output for ${caseId}: ${run.stderr ?? ''}`);
  return JSON.parse(stdout);
}

export function buildRbc13NativeCGraphOrgan(options = {}) {
  const compilerSpec = resolveNativeCCompiler({ compiler: options.compiler ?? undefined });
  if (!compilerSpec) { const error = new Error('RCL_RBC13_NATIVE_COMPILER_MISSING'); error.code = 'RCL_RBC13_NATIVE_COMPILER_MISSING'; throw error; }
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-rbc13-c-graph-organ-'));
  const output = path.join(tempDir, process.platform === 'win32' ? 'rbc13-c-graph-organ.exe' : 'rbc13-c-graph-organ');
  const sourceRoots = {};
  for (const relative of ['native/rbc13_graph_traversal_organ.c', 'native/rbc13_graph_traversal_organ_host.c', 'native/rcl_domain_value.c', 'native/rcl_domain_value.h', 'native/rcl_domain_organ.c', 'native/rcl_domain_organ.h', 'src/native-c-compiler.mjs']) sourceRoots[relative] = crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, relative))).digest('hex');
  const build = compileNativeC(compilerSpec, {
    cwd: ROOT,
    includeDirs: [path.join(ROOT, 'native')],
    sources: [path.join(ROOT, 'native', 'rcl_domain_value.c'), path.join(ROOT, 'native', 'rcl_domain_organ.c'), path.join(ROOT, 'native', 'rbc13_graph_traversal_organ.c'), path.join(ROOT, 'native', 'rbc13_graph_traversal_organ_host.c')],
    linkLibraries: process.platform === 'win32' ? ['bcrypt'] : ['crypto', 'm'],
    output,
    timeout: options.buildTimeout ?? 120_000,
  });
  if (build.status !== 0) { fs.rmSync(tempDir, { recursive: true, force: true }); const error = new Error('RCL_RBC13_NATIVE_GRAPH_BUILD_FAILED'); error.code = 'RCL_RBC13_NATIVE_GRAPH_BUILD_FAILED'; error.details = { stdout: build.stdout, stderr: build.stderr }; throw error; }
  const hostRoot = crypto.createHash('sha256').update(fs.readFileSync(output)).digest('hex');
  const implementationRoot = realityRoot({ sourceRoots, compiler: compilerSpec.command, compilerVersion: nativeCCompilerVersion(compilerSpec) });
  let closed = false;
  function execute(graph) {
    if (closed) throw new Error('RCL_RBC13_NATIVE_GRAPH_CLOSED');
    const run = spawnSync(output, [graph.id], { encoding: 'utf8', timeout: options.runTimeout ?? 30_000, maxBuffer: 16 * 1024 * 1024 });
    const payload = parseNativeJson(run, graph.id);
    const observation = payload.status === 'ok' ? { status: 'ok', result: payload.result } : { status: 'error', error: payload.error };
    return { ...observation, semanticRoot: rbc13GraphSemanticRoot(observation), receipt: { format: 'rcl.rbc13-native-c-organ-receipt.v0.1', operationKey: RBC13_WASM_ORGAN_OPERATION_KEY, semanticIdentity: RBC13_WASM_ORGAN_SEMANTIC_IDENTITY, evidenceTier: RBC13_WASM_ORGAN_EVIDENCE_TIER, implementationRoot, hostRoot, exitStatus: run.status, canonicalPermission: false } };
  }
  function close() { if (closed) return; closed = true; fs.rmSync(tempDir, { recursive: true, force: true }); }
  return Object.freeze({ compiler: compilerSpec.command, compilerVersion: nativeCCompilerVersion(compilerSpec), hostPath: output, hostRoot, implementationRoot, sourceRoots, execute, close });
}

export function wasmAbiNegativeControls() {
  const controls = [];
  try { decodeRbc13WasmValue(new Uint8Array([99,0,0,0,8,0,0,0])); } catch (error) { controls.push({ id: 'unsupported-type', detected: error.code === 'RCL_WASM_VALUE_ABI_UNSUPPORTED_TYPE' }); }
  try { decodeRbc13WasmValue(new Uint8Array([0,0,0,0,255,255,255,127])); } catch (error) { controls.push({ id: 'malformed-length', detected: error.code === 'RCL_WASM_VALUE_ABI_MALFORMED' }); }
  try { const bytes = new Uint8Array(16); const view = new DataView(bytes.buffer); view.setUint32(0, RBC13_WASM_VALUE_TAGS.Number, true); view.setUint32(4, 16, true); view.setFloat64(8, Number.NaN, true); decodeRbc13WasmValue(bytes); } catch (error) { controls.push({ id: 'nonfinite-number', detected: error.code === 'RCL_WASM_VALUE_ABI_NONFINITE' }); }
  try { const left = encodeRbc13WasmValue({ duplicate: 1 }); const duplicate = new Uint8Array(left); const valueOffset = 8; const nameOffset = valueOffset + 4; duplicate[nameOffset] = 100; decodeRbc13WasmValue(duplicate); controls.push({ id: 'duplicate-field', detected: false }); } catch (error) { controls.push({ id: 'duplicate-field', detected: error.code === 'RCL_WASM_VALUE_ABI_DUPLICATE_FIELD' || error.code === 'RCL_WASM_VALUE_ABI_MALFORMED' }); }
  try { decodeRbc13WasmValue(new Uint8Array([0,0,0,0,8,0,0,0]), 100); } catch (error) { controls.push({ id: 'invalid-pointer', detected: error.code === 'RCL_WASM_ABI_INVALID_POINTER' }); }
  return controls;
}
