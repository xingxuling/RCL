#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const native = spawnSync(npm, ['run', 'build:native'], { cwd: root, stdio: 'inherit', env: process.env });
if (native.error || native.status !== 0) process.exit(6);

const result = spawnSync(process.execPath, ['--test', '--test-concurrency=1', 'tests/foundation-direct-native-parity-default-promotion.test.mjs'], {
  cwd: root,
  encoding: 'utf8',
  env: process.env,
});
if (result.error) process.exit(7);
if (result.status === 0) {
  console.log(JSON.stringify({ ok:true, status:'DWAC_CYCLE90_PARITY_DEFAULT_PROMOTION_PASS' }, null, 2));
  process.exit(0);
}
const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
const failed = [...output.matchAll(/^not ok\s+(\d+)\s+-/gm)].map(match => Number(match[1])).filter(Number.isInteger);
let mask = 0;
for (const index of failed) if (index >= 1 && index <= 6) mask |= 1 << (index - 1);
if (mask === 0) process.exit(127);
console.error(JSON.stringify({ ok:false, status:'DWAC_CYCLE90_PARITY_DEFAULT_PROMOTION_SUBTEST_MASK', failed, mask, encodedExitCode:64+mask }, null, 2));
process.exit(64 + mask);
