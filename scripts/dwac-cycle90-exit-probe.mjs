#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const native = spawnSync(npm, ['run', 'build:native'], { cwd: root, stdio: 'inherit', env: process.env });
if (native.error || native.status !== 0) process.exit(6);

const file = 'tests/foundation-direct-native-parity-default-promotion.test.mjs';
const patterns = [
  'default entry point requires attested composite parity',
  'Living default entry point keeps composite evidence',
  'Living evidence failure stays fail-closed',
  'missing execution attestation fails closed',
  'invalid execution attestation cannot compensate',
  'legacy generic verifier remains explicitly addressable',
];
let mask = 0;
const results = [];
for (let i = 0; i < patterns.length; i += 1) {
  const result = spawnSync(process.execPath, ['--test', '--test-concurrency=1', `--test-name-pattern=${patterns[i]}`, file], {
    cwd: root,
    stdio: 'ignore',
    env: process.env,
  });
  const passed = !result.error && result.status === 0;
  if (!passed) mask |= 1 << i;
  results.push({ index:i+1, pattern:patterns[i], passed, childExitCode:result.status ?? null, error:result.error?.message ?? null });
}
if (mask !== 0) {
  console.error(JSON.stringify({ ok:false, status:'DWAC_CYCLE90_PARITY_DEFAULT_PROMOTION_PATTERN_MASK', mask, encodedExitCode:64+mask, results }, null, 2));
  process.exit(64 + mask);
}
console.log(JSON.stringify({ ok:true, status:'DWAC_CYCLE90_PARITY_DEFAULT_PROMOTION_ALL_PATTERNS_PASS', results }, null, 2));
