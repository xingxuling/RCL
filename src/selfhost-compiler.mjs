import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileRealityToBytecode } from './bytecode.mjs';
import { runNativeCompiler } from './native-vm.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

export const SELFHOST_COMPILER_CORE_PATH = path.join(ROOT, 'selfhost', 'compiler-core.rcl');
export const SELFHOST_COMPILER_MAIN_PATH = path.join(ROOT, 'selfhost', 'compiler-main.rcl');
export const DEFAULT_GENERAL_SELFHOST_COMPILER_ARTIFACT_PATH = path.join(ROOT, 'selfhost', 'compiler.rbc');

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function readSelfHostedCompilerSource(options = {}) {
  const corePath = options.corePath ?? SELFHOST_COMPILER_CORE_PATH;
  const mainPath = options.mainPath ?? SELFHOST_COMPILER_MAIN_PATH;
  return `${fs.readFileSync(corePath, 'utf8')}\n${fs.readFileSync(mainPath, 'utf8')}`;
}

export function bootstrapSelfHostedCompiler(options = {}) {
  const source = options.source ?? readSelfHostedCompilerSource(options);
  const outputPath = options.outputPath ?? DEFAULT_GENERAL_SELFHOST_COMPILER_ARTIFACT_PATH;
  const temporaryDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-selfhost-bootstrap-'));
  const sourcePath = path.join(temporaryDir, 'compiler.rcl');
  const c0Path = path.join(temporaryDir, 'compiler-c0.rbc');
  const c1Path = path.join(temporaryDir, 'compiler-c1.rbc');
  const c2Path = path.join(temporaryDir, 'compiler-c2.rbc');

  try {
    const c0 = Buffer.from(compileRealityToBytecode(source));
    fs.writeFileSync(sourcePath, source);
    fs.writeFileSync(c0Path, c0);
    const first = runNativeCompiler(c0Path, sourcePath, c1Path, {
      outputState: 'compiler.output',
      timeout: options.timeout ?? 300_000,
      maxBuffer: options.maxBuffer ?? 64 * 1024 * 1024,
      compilerPath: options.compilerPath,
    });
    const second = runNativeCompiler(c1Path, sourcePath, c2Path, {
      outputState: 'compiler.output',
      timeout: options.timeout ?? 300_000,
      maxBuffer: options.maxBuffer ?? 64 * 1024 * 1024,
      compilerPath: options.compilerPath,
    });
    if (!c0.equals(first.bytecode) || !first.bytecode.equals(second.bytecode)) {
      throw new Error('RCL self-hosted compiler did not reach a byte-identical C0/C1/C2 fixed point');
    }
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, second.bytecode);
    return Object.freeze({
      ok: true,
      format: 'rcl.selfhost.compiler.fixed-point.v1',
      outputPath,
      bytes: second.bytecode.length,
      sha256: sha256(second.bytecode),
      sourceSha256: sha256(source),
      byteIdentical: true,
      generations: { c0: sha256(c0), c1: sha256(first.bytecode), c2: sha256(second.bytecode) },
      native: {
        c0ToC1: first,
        c1ToC2: second,
      },
    });
  } finally {
    fs.rmSync(temporaryDir, { recursive: true, force: true });
  }
}

export function compileSourceFileSelfHosted(sourcePath, outputPath, options = {}) {
  const compilerArtifactPath = options.compilerArtifactPath ?? DEFAULT_GENERAL_SELFHOST_COMPILER_ARTIFACT_PATH;
  if (!fs.existsSync(compilerArtifactPath)) {
    throw new Error(`Self-hosted compiler artifact is missing at ${compilerArtifactPath}; run npm run build:selfhost-compiler`);
  }
  return runNativeCompiler(compilerArtifactPath, sourcePath, outputPath, {
    outputState: 'compiler.output',
    timeout: options.timeout ?? 60_000,
    maxBuffer: options.maxBuffer ?? 64 * 1024 * 1024,
    compilerPath: options.compilerPath,
  });
}

export function compileSourceSelfHosted(source, options = {}) {
  const temporaryDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-selfhost-compile-'));
  const sourcePath = path.join(temporaryDir, 'source.rcl');
  const outputPath = path.join(temporaryDir, 'output.rbc');
  try {
    fs.writeFileSync(sourcePath, source);
    return compileSourceFileSelfHosted(sourcePath, outputPath, options).bytecode;
  } finally {
    fs.rmSync(temporaryDir, { recursive: true, force: true });
  }
}
