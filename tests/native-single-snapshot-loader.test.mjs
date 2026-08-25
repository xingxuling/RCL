import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { compileRealityToBytecode } from '../src/bytecode.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function findCompiler() {
  if (process.platform !== 'win32') {
    const cc = process.env.CC ?? 'cc';
    if (spawnSync(cc, ['--version'], { encoding: 'utf8' }).status === 0) return { command: cc, windows: false };
  }
  const candidates = [
    process.env.ZIG,
    path.join(ROOT, '_tools', 'zig-x86_64-windows-0.16.0', 'zig.exe'),
    path.join(ROOT, '_tools', 'zig', 'zig.exe'),
    'zig',
  ].filter(Boolean);
  const zig = candidates.find(candidate => spawnSync(candidate, ['version'], { encoding: 'utf8' }).status === 0);
  return zig ? { command: zig, windows: process.platform === 'win32' } : null;
}

test('native file loader validates and parses one immutable RBC snapshot', t => {
  const compiler = findCompiler();
  if (!compiler) {
    t.skip('A native C compiler is required for the intercepted-open regression harness');
    return;
  }
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-single-snapshot-'));
  try {
    const validPath = path.join(directory, 'valid.rbc');
    const replacementPath = path.join(directory, 'replacement.rbc');
    const sourcePath = path.join(directory, 'single-snapshot.c');
    const executablePath = path.join(directory, process.platform === 'win32' ? 'single-snapshot.exe' : 'single-snapshot');
    fs.writeFileSync(validPath, compileRealityToBytecode('reality SingleSnapshot { facet world.ready : Truth = true }'));
    fs.writeFileSync(replacementPath, Buffer.from('RCLB'));
    fs.writeFileSync(sourcePath, `
#include <stdio.h>
static const char *snapshot_path;
static const char *replacement_path;
static int open_count;
static FILE *intercepted_fopen(const char *path, const char *mode);
#define fopen intercepted_fopen
#define RCLVM_EMBEDDED_ONLY
#include "rclvm.c"
#undef fopen
static FILE *intercepted_fopen(const char *path, const char *mode) {
  (void)path;
  open_count++;
  return fopen(open_count == 1 ? snapshot_path : replacement_path, mode);
}
int main(int argc, char **argv) {
  if (argc != 3) return 10;
  snapshot_path = argv[1];
  replacement_path = argv[2];
  char error[512] = {0};
  RclVmInstance *instance = rclvm_instance_create();
  if (!instance) return 11;
  int loaded = rclvm_instance_load_file(instance, "logical.rbc", error, sizeof(error));
  rclvm_instance_destroy(instance);
  if (!loaded) { fprintf(stderr, "%s\\n", error); return 12; }
  if (open_count != 1) { fprintf(stderr, "open_count=%d\\n", open_count); return 13; }
  return 0;
}
`);
    const args = compiler.windows
      ? ['cc', '-target', 'x86_64-windows-gnu', '-std=c11', '-O0', `-I${path.join(ROOT, 'native')}`, sourcePath, '-o', executablePath, '-lbcrypt', '-lm']
      : ['-std=c11', '-O0', `-I${path.join(ROOT, 'native')}`, sourcePath, '-o', executablePath, '-lcrypto', '-lm'];
    const build = spawnSync(compiler.command, args, { cwd: ROOT, encoding: 'utf8', timeout: 120_000 });
    assert.equal(build.status, 0, build.stderr || build.stdout || build.error?.message);
    const run = spawnSync(executablePath, [validPath, replacementPath], { encoding: 'utf8', timeout: 60_000 });
    assert.equal(run.status, 0, run.stderr || run.stdout || run.error?.message);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
