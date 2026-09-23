#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const build = spawnSync(npm, ['run', 'build:native'], { cwd: root, stdio: 'inherit', env: process.env });
if (build.error || build.status !== 0) process.exit(7);

function runGroup(prefix) {
  const tests = fs.readdirSync(path.join(root, 'tests'))
    .filter(name => name.endsWith('.test.mjs') && name[0]?.toLowerCase() === prefix)
    .sort();
  if (tests.length === 0) return { prefix, count: 0, passed: true, childExitCode: 0 };
  const result = spawnSync(process.execPath, ['--test', '--test-concurrency=1', ...tests.map(name => `tests/${name}`)], { cwd: root, stdio: 'inherit', env: process.env });
  return { prefix, count: tests.length, first: tests[0], last: tests.at(-1), passed: !result.error && result.status === 0, childExitCode: result.status ?? null, error: result.error?.message ?? null };
}

const f = runGroup('f');
const s = runGroup('s');
let mask = 0;
if (!f.passed) mask |= 1;
if (!s.passed) mask |= 2;
if (mask !== 0) {
  console.error(JSON.stringify({ ok: false, status: 'DWAC_CYCLE90_POSTFIX_FS_MASK_FAILURE', mask, encodedExitCode: 64 + mask, results: [f, s] }, null, 2));
  process.exit(64 + mask);
}
console.log(JSON.stringify({ ok: true, status: 'DWAC_CYCLE90_POSTFIX_FS_PASS', results: [f, s] }, null, 2));
