import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { compileNativeC, resolveNativeCCompiler } from '../src/native-c-compiler.mjs';

const compiler = resolveNativeCCompiler();

test('private VM ↔ Domain Value membrane round-trips admitted values and rejects unsupported kinds', { skip: !compiler }, () => {
  const temp = mkdtempSync(path.join(os.tmpdir(), 'rcl-domain-vm-value-'));
  const output = path.join(temp, 'domain-vm-value-smoke');
  try {
    const build = compileNativeC(compiler, {
      cwd: process.cwd(),
      includeDirs: ['native'],
      sources: ['native/rcl_domain_value.c', 'native/domain_vm_value_bridge_smoke.c'],
      linkLibraries: process.platform === 'win32' ? ['bcrypt'] : ['crypto', 'm'],
      output,
    });
    assert.equal(build.status, 0, `${build.stdout}\n${build.stderr}`);
    const run = spawnSync(output, [], { encoding: 'utf8' });
    assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
    assert.match(run.stdout, /domain-vm-value-bridge-smoke: PASS/);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});
