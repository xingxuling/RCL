import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

function commandExists(command) {
  const probe = spawnSync('sh', ['-lc', `command -v ${command}`], { encoding: 'utf8' });
  return probe.status === 0;
}

const compilerAvailable = process.platform !== 'win32' && (commandExists('cc') || commandExists('gcc'));

test('private VM ↔ Domain Value membrane round-trips admitted values and rejects unsupported kinds', { skip: !compilerAvailable }, () => {
  const compiler = commandExists('cc') ? 'cc' : 'gcc';
  const temp = mkdtempSync(path.join(os.tmpdir(), 'rcl-domain-vm-value-'));
  const output = path.join(temp, 'domain-vm-value-smoke');
  try {
    const build = spawnSync(compiler, [
      '-std=c11', '-Wall', '-Wextra', '-pedantic', '-Inative',
      'native/rcl_domain_value.c',
      'native/domain_vm_value_bridge_smoke.c',
      '-lcrypto', '-lm', '-o', output,
    ], { cwd: process.cwd(), encoding: 'utf8' });
    assert.equal(build.status, 0, `${build.stdout}\n${build.stderr}`);
    const run = spawnSync(output, [], { encoding: 'utf8' });
    assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
    assert.match(run.stdout, /domain-vm-value-bridge-smoke: PASS/);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});
