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

runNode('cycle89-regression-proof-chain', ['scripts/dwac-cycle89-exit-probe.mjs'], 261);
runNpm('canonical-native-pretest-build', ['run', 'build:native'], 262);

const tests = fs.readdirSync(path.join(root, 'tests'))
  .filter(name => name.endsWith('.test.mjs'))
  .sort();
const selected = tests.filter(name => {
  const first = name[0].toLowerCase();
  return first >= 'n' && first <= 'z';
});

if (selected.length === 0) {
  console.error(JSON.stringify({ ok: false, status: 'DWAC_CYCLE90_DIAGNOSTIC_EMPTY_SELECTION' }, null, 2));
  process.exit(263);
}

runNode(
  'canonical-test-suite-bisection-n-through-z',
  ['--test', '--test-concurrency=1', ...selected.map(name => `tests/${name}`)],
  264,
);

console.log(JSON.stringify({
  ok: true,
  status: 'DWAC_CYCLE90_DIAGNOSTIC_HALF_PASS',
  diagnostic: {
    selection: 'tests sorted by filename with first character n-z',
    selectedCount: selected.length,
    totalCount: tests.length,
  },
  route: {
    mode: 'DEEP_DEVELOPMENT',
    schedulingContext: 'NORTH_STAR_REOBSERVATION',
    sovereigntyGate: 'AUTONOMOUS',
    selectedBottleneck: 'canonical-full-suite-validation-closure',
  },
}, null, 2));
