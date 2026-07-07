import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { compileRealityToBytecode } from './bytecode.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const DEFAULT_NATIVE_VM_PATH = path.join(ROOT, 'native', process.platform === 'win32' ? 'rclvm.exe' : 'rclvm');

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

export async function verifyNativeParity(source, options = {}) {
  const [{ runReality }, { compileReality }] = await Promise.all([import('./runtime.mjs'), import('./compiler.mjs')]);
  const program = compileReality(source);
  const reference = await runReality(program, options.referenceRuntime ?? {});
  const native = runRealityNative(program, options.nativeRuntime ?? {});
  const parity = {
    state: equalJson(native.state, reference.state),
    projections: native.projections.length === reference.projections.length,
    history: native.history.length === reference.history.length,
    roots: native.history.every((record, index) => record.beforeRoot === reference.history[index]?.beforeRoot && record.afterRoot === reference.history[index]?.afterRoot),
  };
  return { ok: Object.values(parity).every(Boolean), parity, reference, native };
}
