#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const build = spawnSync(npm, ['run', 'build:native'], { cwd: root, stdio: 'inherit', env: process.env });
if (build.error || build.status !== 0) process.exit(7);

const tests = fs.readdirSync(path.join(root, 'tests'))
  .filter(name => name.endsWith('.test.mjs') && !['f', 's'].includes(name[0]?.toLowerCase()))
  .sort();
const topBucketCount = 4;
const topBuckets = Array.from({ length: topBucketCount }, () => []);
for (let i = 0; i < tests.length; i += 1) topBuckets[Math.floor(i * topBucketCount / tests.length)].push(tests[i]);
const suspects = topBuckets[0];
const bucketCount = 7;
const buckets = Array.from({ length: bucketCount }, () => []);
for (let i = 0; i < suspects.length; i += 1) buckets[Math.floor(i * bucketCount / suspects.length)].push(suspects[i]);

let mask = 0;
const results = [];
for (let i = 0; i < buckets.length; i += 1) {
  const selected = buckets[i];
  const bit = 1 << i;
  const result = spawnSync(process.execPath, ['--test', '--test-concurrency=1', ...selected.map(name => `tests/${name}`)], { cwd: root, stdio: 'inherit', env: process.env });
  const passed = !result.error && result.status === 0;
  if (!passed) mask |= bit;
  results.push({ bucket: i, bit, count: selected.length, first: selected[0] ?? null, last: selected.at(-1) ?? null, passed, childExitCode: result.status ?? null, error: result.error?.message ?? null });
}
if (mask !== 0) {
  console.error(JSON.stringify({ ok: false, status: 'DWAC_CYCLE90_RESIDUAL_B0_MASK_FAILURE', suspectCount: suspects.length, bucketCount, mask, encodedExitCode: 64 + mask, results }, null, 2));
  process.exit(64 + mask);
}
console.log(JSON.stringify({ ok: true, status: 'DWAC_CYCLE90_RESIDUAL_B0_PASS', suspectCount: suspects.length, results }, null, 2));
