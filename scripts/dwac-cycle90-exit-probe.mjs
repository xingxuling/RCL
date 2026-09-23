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

function rangeTests(tests, lo, hi) {
  return tests.filter(name => {
    const first = name[0].toLowerCase();
    return first >= lo && first <= hi;
  });
}

runNode('cycle89-regression-proof-chain', ['scripts/dwac-cycle89-exit-probe.mjs'], 261);
runNpm('canonical-native-pretest-build', ['run', 'build:native'], 262);

const tests = fs.readdirSync(path.join(root, 'tests'))
  .filter(name => name.endsWith('.test.mjs'))
  .sort();
const first = rangeTests(tests, 'n', 't');
const second = rangeTests(tests, 'u', 'z');

if (first.length === 0 || second.length === 0) {
  console.error(JSON.stringify({ ok: false, status: 'DWAC_CYCLE90_DIAGNOSTIC_EMPTY_SELECTION', firstCount: first.length, secondCount: second.length }, null, 2));
  process.exit(263);
}

runNode(
  'canonical-test-suite-bisection-n-through-t',
  ['--test', '--test-concurrency=1', ...first.map(name => `tests/${name}`)],
  264,
);
runNode(
  'canonical-test-suite-bisection-u-through-z',
  ['--test', '--test-concurrency=1', ...second.map(name => `tests/${name}`)],
  265,
);

console.log(JSON.stringify({
  ok: true,
  status: 'DWAC_CYCLE90_DIAGNOSTIC_N_THROUGH_Z_PASS',
  diagnostic: {
    firstSelection: 'n-t',
    firstCount: first.length,
    secondSelection: 'u-z',
    secondCount: second.length,
    totalCount: tests.length,
  },
  route: {
    mode: 'DEEP_DEVELOPMENT',
    schedulingContext: 'NORTH_STAR_REOBSERVATION',
    sovereigntyGate: 'AUTONOMOUS',
    selectedBottleneck: 'canonical-full-suite-validation-closure',
  },
}, null, 2));
