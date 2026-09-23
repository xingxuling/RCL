#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function runCommand(name, command, args, code) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', env: process.env });
  if (result.error || result.status !== 0) {
    console.error(JSON.stringify({ ok: false, status: 'DWAC_CYCLE90_DIAGNOSTIC_FAILURE', probeExitCode: code, step: name, childExitCode: result.status ?? null, error: result.error?.message ?? null }, null, 2));
    process.exit(code);
  }
}
function runNode(name, args, code) { runCommand(name, process.execPath, args, code); }
function runNpm(name, args, code) { runCommand(name, process.platform === 'win32' ? 'npm.cmd' : 'npm', args, code); }

runNode('cycle89-regression-proof-chain', ['scripts/dwac-cycle89-exit-probe.mjs'], 5);
runNpm('canonical-native-pretest-build', ['run', 'build:native'], 6);

const fTests = fs.readdirSync(path.join(root, 'tests'))
  .filter(name => name.endsWith('.test.mjs') && name[0]?.toLowerCase() === 'f')
  .sort();
if (fTests.length === 0) process.exit(7);

const topBucketCount = Math.min(7, fTests.length);
const suspectPrefix = fTests.filter((_, i) => Math.floor(i * topBucketCount / fTests.length) < 2);
const level2Count = Math.min(7, suspectPrefix.length);
const level2Buckets = Array.from({ length: level2Count }, () => []);
for (let i = 0; i < suspectPrefix.length; i += 1) level2Buckets[Math.floor(i * level2Count / suspectPrefix.length)].push(suspectPrefix[i]);

// Prior oracle exited 84 => 84-64=20 => level-2 buckets 2 and 4 are the only failing buckets.
const suspect = [...(level2Buckets[2] ?? []), ...(level2Buckets[4] ?? [])].sort();
if (suspect.length === 0) process.exit(8);

const bucketCount = Math.min(7, suspect.length);
const buckets = Array.from({ length: bucketCount }, () => []);
for (let i = 0; i < suspect.length; i += 1) buckets[Math.floor(i * bucketCount / suspect.length)].push(suspect[i]);

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
  console.error(JSON.stringify({ ok: false, status: 'DWAC_CYCLE90_DIAGNOSTIC_F_LEVEL3_MASK_FAILURE', fTestCount: fTests.length, suspectPrefixCount: suspectPrefix.length, level2FailingBuckets: [2, 4], suspectCount: suspect.length, bucketCount, mask, encodedExitCode: 64 + mask, results }, null, 2));
  process.exit(64 + mask);
}

console.log(JSON.stringify({ ok: true, status: 'DWAC_CYCLE90_DIAGNOSTIC_F_LEVEL3_PASS', results, route: { mode: 'DEEP_DEVELOPMENT', schedulingContext: 'NORTH_STAR_REOBSERVATION', sovereigntyGate: 'AUTONOMOUS', selectedBottleneck: 'canonical-full-suite-validation-closure' } }, null, 2));
