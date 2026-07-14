import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
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
    return parsePayload(result.stdout, { status: 'error', code: 'RCL_NATIVE_OUTPUT', message: 'Native VM returned invalid JSON', raw: result.stdout });
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
