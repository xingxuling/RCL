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

const tests = fs.readdirSync(path.join(root, 'tests'))
  .filter(name => name.endsWith('.test.mjs'))
  .sort();

const groups = [
  { label: '0-9', bit: 1, match: name => /[0-9]/.test(name[0]) },
  { label: 'a', bit: 2, match: name => name[0].toLowerCase() === 'a' },
  { label: 'b', bit: 4, match: name => name[0].toLowerCase() === 'b' },
  { label: 'c', bit: 8, match: name => name[0].toLowerCase() === 'c' },
  { label: 'd', bit: 16, match: name => name[0].toLowerCase() === 'd' },
  { label: 'e', bit: 32, match: name => name[0].toLowerCase() === 'e' },
  { label: 'f', bit: 64, match: name => name[0].toLowerCase() === 'f' },
];

let mask = 0;
const results = [];
for (const group of groups) {
  const selected = tests.filter(group.match);
  if (selected.length === 0) {
    results.push({ label: group.label, count: 0, skipped: true, passed: true });
    continue;
  }
  const result = spawnSync(process.execPath, ['--test', '--test-concurrency=1', ...selected.map(name => `tests/${name}`)], {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
  });
  const passed = !result.error && result.status === 0;
  if (!passed) mask |= group.bit;
  results.push({
    label: group.label,
    count: selected.length,
    passed,
    childExitCode: result.status ?? null,
    error: result.error?.message ?? null,
  });
}

if (mask !== 0) {
  console.error(JSON.stringify({
    ok: false,
    status: 'DWAC_CYCLE90_DIAGNOSTIC_GROUP_MASK_FAILURE',
    mask,
    encodedExitCode: 64 + mask,
    results,
  }, null, 2));
  process.exit(64 + mask);
}

console.log(JSON.stringify({
  ok: true,
  status: 'DWAC_CYCLE90_DIAGNOSTIC_0_THROUGH_F_PASS',
  results,
  route: {
    mode: 'DEEP_DEVELOPMENT',
    schedulingContext: 'NORTH_STAR_REOBSERVATION',
    sovereigntyGate: 'AUTONOMOUS',
    selectedBottleneck: 'canonical-full-suite-validation-closure',
  },
}, null, 2));
