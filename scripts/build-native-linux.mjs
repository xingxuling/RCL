import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { RCL_LINUX_BUILD_FORMAT, RCL_LINUX_BUILD_SOURCES, RCL_LINUX_BUILD_TARGET } from '../src/native-linux-build-contract.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const candidates = [process.env.ZIG, path.join(ROOT, '_tools/zig-x86_64-windows-0.16.0/zig.exe'), 'zig'].filter(Boolean);
const zig = candidates.find(candidate => spawnSync(candidate, ['version'], { windowsHide: true }).status === 0);
if (!zig) throw new Error('RCL_LINUX_ZIG_MISSING');
const output = path.resolve(ROOT, process.argv[2] ?? 'build/linux');
fs.mkdirSync(output, { recursive: true });
const env = { ...process.env, ZIG_GLOBAL_CACHE_DIR: process.env.ZIG_GLOBAL_CACHE_DIR ?? path.join(ROOT, '_tools/zig-global-cache'), ZIG_LOCAL_CACHE_DIR: process.env.ZIG_LOCAL_CACHE_DIR ?? path.join(ROOT, '_tools/zig-local-cache') };
const run = args => {
  const result = spawnSync(zig, args, { cwd: ROOT, env, encoding: 'utf8', timeout: 120_000, windowsHide: true });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || result.error?.message);
};
const object = path.join(output, 'sha256.o');
const vm = path.join(output, 'rclvm'), compiler = path.join(output, 'rclc'), daemon = path.join(output, 'rclvmd');
run(['build-obj', 'native/wasi-sha256.zig', '-target', RCL_LINUX_BUILD_TARGET, '-O', 'ReleaseSmall', '-femit-bin=' + object]);
// Published binaries omit compiler debug metadata and its host-specific paths.
const common = ['cc', '-target', RCL_LINUX_BUILD_TARGET, '-std=c11', '-O2', '-s', '-I', 'native/wasi-compat'];
run([...common, 'native/rclvm.c', object, '-lm', '-o', vm]);
run([...common, '-DRCLVM_EMBEDDED_ONLY', 'native/rclvm.c', 'native/rclc.c', object, '-lm', '-o', compiler]);
run([...common, '-DRCLVM_EMBEDDED_ONLY', 'native/rclvm.c', 'native/rclvmd.c', object, '-lm', '-o', daemon]);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const artifact = file => ({ path: path.relative(ROOT, file).replaceAll(path.sep, '/'), bytes: fs.statSync(file).size, sha256: sha(fs.readFileSync(file)) });
const manifest = { format: RCL_LINUX_BUILD_FORMAT, status: 'BUILT_NOT_RUNTIME_VERIFIED', target: RCL_LINUX_BUILD_TARGET, staticLibc: true,
  zigVersion: spawnSync(zig, ['version'], { encoding: 'utf8' }).stdout.trim(),
  sources: RCL_LINUX_BUILD_SOURCES
    .map(file => ({ path: file, sha256: sha(fs.readFileSync(path.join(ROOT, file))) })),
  binary: artifact(vm), compiler: artifact(compiler), daemon: artifact(daemon),
  vmImplementationOwner: 'native/rclvm.c', cryptoOwner: 'Zig standard SHA-256', hardwareOrAndroidClaimed: false };
fs.writeFileSync(path.join(output, 'build-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify(manifest, null, 2));
