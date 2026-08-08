import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { compileNativeC, resolveNativeCCompiler } from '../src/native-c-compiler.mjs';

const compiler = resolveNativeCCompiler();

test('native domain-organ/value ABI enforces evidence tier and preserves typed values', { skip: !compiler }, () => {
  const temp = mkdtempSync(path.join(os.tmpdir(), 'rcl-domain-organ-'));
  const output = path.join(temp, process.platform === 'win32' ? 'domain-organ-smoke.exe' : 'domain-organ-smoke');
  try {
    const build = compileNativeC(compiler, {
      cwd: process.cwd(),
      includeDirs: ['native'],
      sources: ['native/rcl_domain_value.c', 'native/rcl_domain_organ.c', 'native/domain_organ_smoke.c'],
      output,
    });
    assert.equal(build.status, 0, `${build.stdout}\n${build.stderr}`);
    const run = spawnSync(output, [], { encoding: 'utf8' });
    assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
    assert.match(run.stdout, /domain-organ-value-smoke: PASS/);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});
