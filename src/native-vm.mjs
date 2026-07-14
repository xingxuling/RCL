import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { compileRealityToBytecode } from './bytecode.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const DEFAULT_NATIVE_VM_PATH = path.join(ROOT, 'native', process.platform === 'win32' ? 'rclvm.exe' : 'rclvm');
export const DEFAULT_NATIVE_COMPILER_PATH = path.join(ROOT, 'native', process.platform === 'win32' ? 'rclc.exe' : 'rclc');

export class RCLNativeVMError extends Error {
  constructor(payload, details = {}) {
    super(payload?.message ?? 'RCL native VM execution failed');
    this.name = 'RCLNativeVMError';
    this.code = payload?.code ?? 'RCL_NATIVE_FAILURE';
    this.payload = payload;
    this.details = details;
  }
}

function parsePayload(text, fallback) {
  try { return JSON.parse(text); }
  catch { return fallback; }
}

export function runNativeBytecode(bytecodeOrPath, options = {}) {
  const vmPath = options.vmPath ?? DEFAULT_NATIVE_VM_PATH;
  if (!fs.existsSync(vmPath)) throw new RCLNativeVMError({ code: 'RCL_NATIVE_VM_MISSING', message: `Native VM binary is missing at ${vmPath}` });

  let bytecodePath = bytecodeOrPath;
  let temporaryDir = null;
  if (!Buffer.isBuffer(bytecodeOrPath) && !(bytecodeOrPath instanceof Uint8Array) && typeof bytecodeOrPath !== 'string') {
    throw new TypeError('runNativeBytecode expects a bytecode Buffer, Uint8Array, or path');
  }
  if (Buffer.isBuffer(bytecodeOrPath) || bytecodeOrPath instanceof Uint8Array) {
    temporaryDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-native-'));
    bytecodePath = path.join(temporaryDir, 'program.rbc');
    fs.writeFileSync(bytecodePath, bytecodeOrPath);
  }

  try {
    const result = spawnSync(vmPath, [bytecodePath], {
      encoding: 'utf8',
      maxBuffer: options.maxBuffer ?? 16 * 1024 * 1024,
      timeout: options.timeout ?? 30_000,
    });
    if (result.error) throw new RCLNativeVMError({ code: 'RCL_NATIVE_PROCESS', message: result.error.message }, { result });
    if (result.status !== 0) {
      const payload = parsePayload(result.stderr.trim(), { code: 'RCL_NATIVE_PROCESS', message: result.stderr.trim() || `Native VM exited with ${result.status}` });
      throw new RCLNativeVMError(payload, { status: result.status, stdout: result.stdout, stderr: result.stderr });
    }
    return normalizeNativeEvidence(parsePayload(result.stdout, { status: 'error', code: 'RCL_NATIVE_OUTPUT', message: 'Native VM returned invalid JSON', raw: result.stdout }));
  } finally {
    if (temporaryDir) fs.rmSync(temporaryDir, { recursive: true, force: true });
  }
}

export function runRealityNative(sourceOrProgram, options = {}) {
  const bytecode = compileRealityToBytecode(sourceOrProgram);
  return runNativeBytecode(bytecode, options);
}

export function runNativeCompiler(compilerBytecodePath, sourcePath, outputPath, options = {}) {
  const compilerPath = options.compilerPath ?? DEFAULT_NATIVE_COMPILER_PATH;
  if (!fs.existsSync(compilerPath)) {
    throw new RCLNativeVMError({ code: 'RCL_NATIVE_COMPILER_MISSING', message: `Native compiler binary is missing at ${compilerPath}` });
  }
  for (const [name, value] of Object.entries({ compilerBytecodePath, sourcePath, outputPath })) {
    if (typeof value !== 'string' || value.length === 0) throw new TypeError(`${name} must be a non-empty path`);
  }

  fs.mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });
  const env = { ...process.env, ...options.env };
  if (options.outputState) env.RCLC_OUTPUT_STATE = options.outputState;
  const result = spawnSync(compilerPath, [compilerBytecodePath, sourcePath, outputPath], {
    encoding: 'utf8',
    env,
    maxBuffer: options.maxBuffer ?? 16 * 1024 * 1024,
    timeout: options.timeout ?? 30_000,
  });
  if (result.error) throw new RCLNativeVMError({ code: 'RCL_NATIVE_COMPILER_PROCESS', message: result.error.message }, { result });
  if (result.status !== 0) {
    const payload = parsePayload(result.stderr.trim(), {
      code: 'RCL_NATIVE_COMPILER_PROCESS',
      message: result.stderr.trim() || `Native compiler exited with ${result.status}`,
    });
    throw new RCLNativeVMError(payload, { status: result.status, stdout: result.stdout, stderr: result.stderr });
  }
  if (!fs.existsSync(outputPath)) {
    throw new RCLNativeVMError({ code: 'RCL_NATIVE_COMPILER_OUTPUT', message: `Native compiler did not create ${outputPath}` }, { result });
  }
  const payload = parsePayload(result.stdout.trim(), { status: 'ok' });
  return { ...payload, outputPath, bytecode: fs.readFileSync(outputPath) };
}

function canonicalJson(value) {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalJson(value[key])]));
  }
  return value;
}

function equalJson(left, right) {
  return JSON.stringify(canonicalJson(left)) === JSON.stringify(canonicalJson(right));
}

const NATIVE_HEAP_METADATA = new Set(['__rclKind', '__rclType', '__rclObjectId', '__rclFieldOffsets']);

function semanticValue(value) {
  if (Array.isArray(value)) return value.map(semanticValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value)
      .filter(([key]) => !NATIVE_HEAP_METADATA.has(key))
      .map(([key, item]) => [key, semanticValue(item)]));
  }
  return value;
}

function semanticChanges(record) {
  return (record?.changes ?? []).map(change => ({
    target: change.target,
    before: semanticValue(change.before),
    after: semanticValue(change.after),
  }));
}

function historySemanticallyMatches(nativeRecord, referenceRecord) {
  return equalJson(semanticChanges(nativeRecord), semanticChanges(referenceRecord));
}

function semanticRoot(value) {
  return createHash('sha256').update(JSON.stringify(canonicalJson(semanticValue(value)))).digest('hex');
}

function hydrateFormedAtRoots(value, root) {
  if (Array.isArray(value)) return value.map(item => hydrateFormedAtRoots(item, root));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, nested]) => [
    key,
    key === 'formedAtRoot' && nested === '' ? root : hydrateFormedAtRoots(nested, root),
  ]));
}

function normalizeNativeValue(value) {
  if (Array.isArray(value)) return value.map(normalizeNativeValue);
  if (!value || typeof value !== 'object') return value;
  const normalized = Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, normalizeNativeValue(nested)]));
  if (normalized.kind === 'Intent' && Array.isArray(normalized.slots) && normalized.slots.length % 2 === 0
      && normalized.slots.every((item, index) => index % 2 === 0 ? typeof item === 'string' : true)) {
    normalized.slots = Object.fromEntries(normalized.slots.reduce((pairs, item, index, slots) => {
      if (index % 2 === 0) pairs.push([item, slots[index + 1]]);
      return pairs;
    }, []));
  }
  return normalized;
}

function normalizeNativeEvidence(result) {
  if (!result) return result;
  result.state = normalizeNativeValue(result.state ?? {});
  result.history = (result.history ?? []).map(record => ({
    ...record,
    changes: (record.changes ?? []).map(change => ({
      ...change,
      before: normalizeNativeValue(change.before),
      after: normalizeNativeValue(change.after),
    })),
  }));
  result.projections = (result.projections ?? []).map(record => ({
    ...record,
    changes: (record.changes ?? []).map(change => ({
      ...change,
      before: normalizeNativeValue(change.before),
      after: normalizeNativeValue(change.after),
    })),
  }));
  if (result.history.length === 0) return result;
  const state = structuredClone(result.state);

  // Reconstruct the initial flat state from native before-values, then replay
  // forward so evidence roots are based on semantic state rather than VM heap ids.
  for (let index = result.history.length - 1; index >= 0; index -= 1) {
    for (const change of [...(result.history[index].changes ?? [])].reverse()) {
      if (change.before === null) delete state[change.target];
      else state[change.target] = structuredClone(change.before);
    }
  }

  for (const record of result.history) {
    const before = structuredClone(state);
    const beforeRoot = semanticRoot(before);
    for (const change of record.changes ?? []) {
      change.before = Object.prototype.hasOwnProperty.call(state, change.target)
        ? structuredClone(state[change.target])
        : null;
      change.after = hydrateFormedAtRoots(change.after, semanticRoot(state));
      if (change.after === null) delete state[change.target];
      else state[change.target] = structuredClone(change.after);
    }
    record.beforeRoot = beforeRoot;
    record.afterRoot = semanticRoot(state);
  }
  result.state = state;
  return result;
}

export async function verifyNativeParity(source, options = {}) {
  const [{ runReality }, { compileReality }] = await Promise.all([import('./runtime.mjs'), import('./compiler.mjs')]);
  const program = compileReality(source);
  const reference = await runReality(program, options.referenceRuntime ?? {});
  const native = runRealityNative(program, options.nativeRuntime ?? {});
  const rawRoots = native.history.every((record, index) => record.beforeRoot === reference.history[index]?.beforeRoot && record.afterRoot === reference.history[index]?.afterRoot);
  const historySemantics = native.history.every((record, index) => historySemanticallyMatches(record, reference.history[index]));
  const parity = {
    state: equalJson(semanticValue(native.state), reference.state),
    projections: native.projections.length === reference.projections.length,
    history: native.history.length === reference.history.length,
    roots: rawRoots || historySemantics,
    rawRoots,
    historySemantics,
  };
  return { ok: parity.state && parity.projections && parity.history && parity.historySemantics, parity, reference, native };
}
