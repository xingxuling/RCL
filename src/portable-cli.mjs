import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createPortableNativeTarget } from './portable-native-vm.mjs';
import { compileReality } from './compiler.mjs';

export function runPortableCli(args) {
  let target, temporary;
  try {
    if (args.length !== 2 || args.some(arg => arg.startsWith('--'))) throw new Error('Usage: rcl portable-run <windows|wasm-vm|linux|android> <source.rcl>');
    const [environment, file] = args, sourcePath = path.resolve(file);
    const source = fs.readFileSync(sourcePath, 'utf8');
    const sourceRoot = compileReality(source).programRoot;
    target = createPortableNativeTarget(environment);
    temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-portable-cli-'));
    const compilation = target.compile(sourcePath, path.join(temporary, 'program.rbc'));
    const execution = target.execute(path.join(temporary, 'program.rbc'), sourceRoot);
    return { ok: true, command: 'portable-run', target: environment, targetBinding: target.binding,
      compiler: 'RCL-authored native-core compiler RBC', artifactHash: createHash('sha256').update(compilation.bytecode).digest('hex'),
      artifactBytes: compilation.bytecode.length, compileMs: compilation.ms, executeMs: execution.ms, result: execution.result };
  } catch (error) {
    return { ok: false, command: 'portable-run', target: args[0], code: error.code ?? 'RCL_PORTABLE_RUN_FAILED', message: error.message };
  } finally {
    target?.dispose();
    if (temporary) fs.rmSync(temporary, { recursive: true, force: true });
  }
}
