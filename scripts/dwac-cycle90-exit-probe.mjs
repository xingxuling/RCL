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
function partition(items) {
  const count = Math.min(7, items.length);
  const buckets = Array.from({ length: count }, () => []);
  for (let i = 0; i < items.length; i += 1) buckets[Math.floor(i * count / items.length)].push(items[i]);
  return buckets;
}

runNode('cycle89-regression-proof-chain', ['scripts/dwac-cycle89-exit-probe.mjs'], 5);
runNpm('canonical-native-pretest-build', ['run', 'build:native'], 6);

const fTests = fs.readdirSync(path.join(root, 'tests')).filter(name => name.endsWith('.test.mjs') && name[0]?.toLowerCase() === 'f').sort();
if (fTests.length === 0) process.exit(7);

const top = partition(fTests);
const level1 = [...(top[0] ?? []), ...(top[1] ?? [])].sort();
const level2 = partition(level1);
const level2Suspect = [...(level2[2] ?? []), ...(level2[4] ?? [])].sort();
const level3 = partition(level2Suspect);
const level3Suspect = [...(level3[2] ?? []), ...(level3[4] ?? [])].sort();
const level4 = partition(level3Suspect);
// Previous level-4 oracle exited 67 => 67-64=3 => only buckets 0 and 1 fail.
const suspect = [...(level4[0] ?? []), ...(level4[1] ?? [])].sort();
if (suspect.length === 0) process.exit(8);
const buckets = partition(suspect);

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
  console.error(JSON.stringify({ ok: false, status: 'DWAC_CYCLE90_DIAGNOSTIC_F_LEVEL5_MASK_FAILURE', fTestCount: fTests.length, priorFailingPath: [[0,1],[2,4],[2,4],[0,1]], suspectCount: suspect.length, bucketCount: buckets.length, mask, encodedExitCode: 64 + mask, results }, null, 2));
  process.exit(64 + mask);
}
console.log(JSON.stringify({ ok: true, status: 'DWAC_CYCLE90_DIAGNOSTIC_F_LEVEL5_PASS', results, route: { mode: 'DEEP_DEVELOPMENT', schedulingContext: 'NORTH_STAR_REOBSERVATION', sovereigntyGate: 'AUTONOMOUS', selectedBottleneck: 'canonical-full-suite-validation-closure' } }, null, 2));
