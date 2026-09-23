#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function runCommand(name, command, args, code) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', env: process.env });
  if (result.error || result.status !== 0) {
    console.error(JSON.stringify({
      ok: false,
      status: 'DWAC_CYCLE90_DIAGNOSTIC_FAILURE',
      probeExitCode: code,
      step: name,
      childExitCode: result.status ?? null,
      error: result.error?.message ?? null,
    }, null, 2));
    process.exit(code);
  }
}

function runNode(name, args, code) {
  runCommand(name, process.execPath, args, code);
}

function runNpm(name, args, code) {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  runCommand(name, npm, args, code);
}

runNode('cycle89-regression-proof-chain', ['scripts/dwac-cycle89-exit-probe.mjs'], 5);
runNpm('canonical-native-pretest-build', ['run', 'build:native'], 6);

const sTests = fs.readdirSync(path.join(root, 'tests'))
  .filter(name => name.endsWith('.test.mjs') && name[0]?.toLowerCase() === 's')
  .sort();

if (sTests.length === 0) {
  console.error(JSON.stringify({ ok: false, status: 'DWAC_CYCLE90_DIAGNOSTIC_EMPTY_S_SELECTION' }, null, 2));
  process.exit(7);
}

const bucketCount = Math.min(7, sTests.length);
const buckets = Array.from({ length: bucketCount }, () => []);
for (let i = 0; i < sTests.length; i += 1) {
  buckets[Math.floor(i * bucketCount / sTests.length)].push(sTests[i]);
}

let mask = 0;
const results = [];
for (let i = 0; i < buckets.length; i += 1) {
  const selected = buckets[i];
  const bit = 1 << i;
  const result = spawnSync(process.execPath, ['--test', '--test-concurrency=1', ...selected.map(name => `tests/${name}`)], {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
  });
  const passed = !result.error && result.status === 0;
  if (!passed) mask |= bit;
  results.push({
    bucket: i,
    bit,
    count: selected.length,
    first: selected[0] ?? null,
    last: selected.at(-1) ?? null,
    passed,
    childExitCode: result.status ?? null,
    error: result.error?.message ?? null,
  });
}

if (mask !== 0) {
  console.error(JSON.stringify({
    ok: false,
    status: 'DWAC_CYCLE90_DIAGNOSTIC_S_BUCKET_MASK_FAILURE',
    sTestCount: sTests.length,
    bucketCount,
    mask,
    encodedExitCode: 64 + mask,
    results,
  }, null, 2));
  process.exit(64 + mask);
}

console.log(JSON.stringify({
  ok: true,
  status: 'DWAC_CYCLE90_DIAGNOSTIC_ALL_S_TESTS_PASS',
  sTestCount: sTests.length,
  bucketCount,
  results,
  route: {
    mode: 'DEEP_DEVELOPMENT',
    schedulingContext: 'NORTH_STAR_REOBSERVATION',
    sovereigntyGate: 'AUTONOMOUS',
    selectedBottleneck: 'canonical-full-suite-validation-closure',
  },
}, null, 2));
