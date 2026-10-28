import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

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
const object = path.join(output, 'sha256.o'), vm = path.join(output, 'rclvm');
run(['build-obj', 'native/wasi-sha256.zig', '-target', 'x86_64-linux-musl', '-O', 'ReleaseSmall', '-femit-bin=' + object]);
run(['cc', '-target', 'x86_64-linux-musl', '-std=c11', '-O2', '-I', 'native/wasi-compat', 'native/rclvm.c', object, '-lm', '-o', vm]);
const compiler = path.join(output, 'rclc');
run(['cc', '-target', 'x86_64-linux-musl', '-std=c11', '-O2', '-DRCLVM_EMBEDDED_ONLY', '-I', 'native/wasi-compat',
  'native/rclvm.c', 'native/rclc.c', object, '-lm', '-o', compiler]);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const manifest = { format: 'rcl.native-linux-build.v1', status: 'BUILT_NOT_RUNTIME_VERIFIED', target: 'x86_64-linux-musl', staticLibc: true,
  zigVersion: spawnSync(zig, ['version'], { encoding: 'utf8' }).stdout.trim(),
  sources: ['native/rclvm.c', 'native/rclvm.h', 'native/rclc.c', 'native/semantic_state_v2.h', 'native/wasi-sha256.zig', 'native/wasi-compat/openssl/sha.h', 'scripts/build-native-linux.mjs']
    .map(file => ({ path: file, sha256: sha(fs.readFileSync(path.join(ROOT, file))) })),
  binary: { path: vm, bytes: fs.statSync(vm).size, sha256: sha(fs.readFileSync(vm)) },
  compiler: { path: compiler, bytes: fs.statSync(compiler).size, sha256: sha(fs.readFileSync(compiler)) },
  vmImplementationOwner: 'native/rclvm.c', cryptoOwner: 'Zig standard SHA-256', hardwareOrAndroidClaimed: false };
fs.writeFileSync(path.join(output, 'build-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify(manifest, null, 2));
