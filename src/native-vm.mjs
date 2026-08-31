import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { compileRealityToBytecode } from './bytecode.mjs';
import {
  RCL_NATIVE_STATE_ROOT_ALGORITHM,
  RCLSemanticStateRootError,
  semanticStateRoot,
  semanticValue,
  verifyNativeSemanticStateRoot,
} from './semantic-state-root.mjs';

export {
  RCL_NATIVE_STATE_ROOT_ALGORITHM,
  semanticStateRoot,
  verifyNativeSemanticStateRoot,
};

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

function verifyNativePayload(payload, options) {
  if (payload?.code === 'RCL_NATIVE_OUTPUT' || payload?.status === 'error') return payload;
  try {
    return verifyNativeSemanticStateRoot(payload, {
      requireNativeRoot: options.requireNativeStateRoot === true,
    });
  } catch (error) {
    if (error instanceof RCLSemanticStateRootError) {
      throw new RCLNativeVMError({ code: error.code, message: error.message }, error.details);
    }
    throw error;
  }
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
      env: { ...process.env, ...(options.env ?? {}) },
      maxBuffer: options.maxBuffer ?? 16 * 1024 * 1024,
      timeout: options.timeout ?? 30_000,
    });
    if (result.error) throw new RCLNativeVMError({ code: 'RCL_NATIVE_PROCESS', message: result.error.message }, { result });
    if (result.status !== 0) {
      const payload = parsePayload(result.stderr.trim(), { code: 'RCL_NATIVE_PROCESS', message: result.stderr.trim() || `Native VM exited with ${result.status}` });
      throw new RCLNativeVMError(payload, { status: result.status, stdout: result.stdout, stderr: result.stderr });
    }
    const payload = parsePayload(result.stdout, { status: 'error', code: 'RCL_NATIVE_OUTPUT', message: 'Native VM returned invalid JSON', raw: result.stdout });
    return verifyNativePayload(payload, options);
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

export async function verifyNativeParity(source, options = {}) {
  const [{ runReality }, { compileReality }] = await Promise.all([import('./runtime.mjs'), import('./compiler.mjs')]);
  const program = compileReality(source);
  const reference = await runReality(program, options.referenceRuntime ?? {});
  const native = runRealityNative(program, options.nativeRuntime ?? {});
  const referenceSemanticStateRoot = semanticStateRoot(reference.state);
  const parity = {
    state: equalJson(semanticValue(native.state), semanticValue(reference.state)),
    projections: native.projections.length === reference.projections.length,
    history: native.history.length === reference.history.length,
    roots: native.history.every((record, index) => record.beforeRoot === reference.history[index]?.beforeRoot && record.afterRoot === reference.history[index]?.afterRoot),
    semanticStateRoot: native.semanticStateRoot === referenceSemanticStateRoot,
  };
  const nativeAuthority = {
    algorithm: native.stateRootAlgorithm,
    emittedByNative: native.nativeStateRoot !== null,
    verified: native.stateRootVerified === true,
    parity: native.stateRootParity === true,
  };
  return { ok: Object.values(parity).every(Boolean), parity, nativeAuthority, reference, native };
}
