import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const candidates = [process.env.ZIG, path.join(ROOT, '_tools/zig-x86_64-windows-0.16.0/zig.exe'), path.join(ROOT, '_tools/zig/zig.exe'), 'zig'].filter(Boolean);
const zig = candidates.find(candidate => spawnSync(candidate, ['version'], { windowsHide: true }).status === 0);
if (!zig) throw new Error('RCL_WASI_ZIG_MISSING');
const output = path.resolve(ROOT, process.argv[2] ?? 'build/wasi');
fs.mkdirSync(output, { recursive: true });
const env = { ...process.env,
  ZIG_GLOBAL_CACHE_DIR: process.env.ZIG_GLOBAL_CACHE_DIR ?? path.join(ROOT, '_tools/zig-global-cache'),
  ZIG_LOCAL_CACHE_DIR: process.env.ZIG_LOCAL_CACHE_DIR ?? path.join(ROOT, '_tools/zig-local-cache'),
};
const run = args => {
  const result = spawnSync(zig, args, { cwd: ROOT, env, encoding: 'utf8', timeout: 120_000, windowsHide: true });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || result.error?.message);
};
const object = path.join(output, 'sha256.o'), vm = path.join(output, 'rclvm.wasm');
run(['build-obj', 'native/wasi-sha256.zig', '-target', 'wasm32-wasi', '-O', 'ReleaseSmall', '-femit-bin=' + object]);
run(['cc', '-target', 'wasm32-wasi', '-std=c11', '-O2', '-I', 'native/wasi-compat', 'native/rclvm.c', 'native/wasi-compat/stdio-capture.c', object, '-lm', '-o', vm]);
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const sources = ['native/rclvm.c', 'native/rclvm.h', 'native/semantic_state_v2.h', 'native/wasi-sha256.zig', 'native/wasi-compat/openssl/sha.h', 'native/wasi-compat/stdio-capture.c', 'scripts/build-native-wasi.mjs'];
const report = { format: 'rcl.native-wasi-build.v1', status: 'BUILT_NOT_RUNTIME_VERIFIED', target: 'wasm32-wasi',
  zigVersion: spawnSync(zig, ['version'], { encoding: 'utf8' }).stdout.trim(),
  sources: sources.map(name => ({ path: name, sha256: sha256(fs.readFileSync(path.join(ROOT, name))) })),
  wasm: { path: vm, bytes: fs.statSync(vm).size, sha256: sha256(fs.readFileSync(vm)) },
  vmImplementationOwner: 'native/rclvm.c', cryptoOwner: 'Zig standard SHA-256', wasiHostOwner: 'Node WASI', securitySandboxClaimed: false };
fs.writeFileSync(path.join(output, 'build-manifest.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
