import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

test('Stage0 source truth model binds every current JS reference module hash', () => {
  const run = spawnSync(process.execPath, [path.join(ROOT, 'scripts/verify-rcl-selfhost-stage0.mjs')], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
  });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  const report = JSON.parse(fs.readFileSync(path.join(ROOT, 'output/selfhost/stage0-verification.json'), 'utf8'));
  assert.equal(report.ok, true);
  assert.equal(report.stageStatus, 'PROXY_VERIFIED');
  assert.equal(report.checks.coreHashesMatch, true);
  assert.deepEqual(report.modules.filter((module) => !module.hashMatchesRcl), []);
  assert.equal(report.boundaries.rewriteStatus, 'Core implementation is not rewritten into RCL yet.');
});
