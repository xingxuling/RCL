#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const result = spawnSync(process.execPath, [
  '--test',
  'tests/foundation-quantitative-direct-lowering.test.mjs',
], {
  encoding: 'utf8',
  env: process.env,
});

fs.mkdirSync('public', { recursive: true });
fs.writeFileSync(path.join('public', 'rcl-cycle46-targeted-debug.json'), `${JSON.stringify({
  status: result.status,
  signal: result.signal ?? null,
  error: result.error?.message ?? null,
  stdout: result.stdout ?? '',
  stderr: result.stderr ?? '',
}, null, 2)}\n`);

console.log(JSON.stringify({
  ok: true,
  status: 'RCL_CYCLE46_TARGETED_DEBUG_CAPTURED',
  testExitCode: result.status,
}, null, 2));
