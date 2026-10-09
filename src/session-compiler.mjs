import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { compileRealityToBytecode, compileRealitySessionBytecode } from './bytecode.mjs';
import { runNativeCompiler } from './native-vm.mjs';
import { sessionError } from './session-contract.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const digest = value => createHash('sha256').update(value).digest('hex');

export function compileRealitySessionNative(source, options = {}) {
  if (typeof source !== 'string') throw sessionError('RCL_SESSION_SOURCE_TEXT_REQUIRED');
  const expected = compileRealitySessionBytecode(source);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-session-compiler-'));
  const read = name => fs.readFileSync(path.join(ROOT, 'selfhost', name), 'utf8');
  const sessionSource = read('compiler-core.rcl') + '\n' + read('session-compiler-core.rcl') + '\n' + read('session-compiler-main.rcl');
  try {
    const sessionCompilerPath = path.join(directory, 'session-compiler.rbc');
    const bootstrap = compileRealityToBytecode(sessionSource);
    fs.writeFileSync(sessionCompilerPath, bootstrap);
    const sourcePath = path.join(directory, 'program.rcl');
    fs.writeFileSync(sourcePath, source);
    const target = runNativeCompiler(sessionCompilerPath, sourcePath, path.join(directory, 'session.rbc'), { timeout: 60_000, ...options });
    if (!target.bytecode.equals(expected)) throw sessionError('RCL_SESSION_COMPILER_TARGET_PARITY_MISMATCH');
    return {
      bytecode: target.bytecode,
      evidence: {
        format: 'rcl.session-compiler-evidence.v1', compilerOwner: 'RCL', executionOwner: 'native-vm',
        sourceHash: digest(Buffer.from(source)), compilerSourceHash: digest(Buffer.from(sessionSource)),
        compilerRoot: digest(bootstrap), bytecodeRoot: digest(target.bytecode),
        compilerBootstrap: 'JavaScript-to-RCL-bytecode', targetByteParity: true, referenceExecutionFallback: false,
      },
    };
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
}
