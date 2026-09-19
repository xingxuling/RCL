#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

fs.mkdirSync('public', { recursive: true });
const result = spawnSync(process.execPath, ['scripts/build-vercel-proof-chain.mjs'], {
  encoding: 'utf8',
  maxBuffer: 20 * 1024 * 1024,
  env: process.env,
});
const payload = {
  ok: result.status === 0,
  exitCode: result.status,
  signal: result.signal ?? null,
  stdout: result.stdout ?? '',
  stderr: result.stderr ?? '',
};
fs.writeFileSync(
  path.join('public', 'dwac-cycle58-proof-debug.json'),
  `${JSON.stringify(payload, null, 2)}\n`,
  'utf8',
);
console.log(JSON.stringify({
  status: 'DWAC_CYCLE58_DIAGNOSTIC_CAPTURED',
  proofExitCode: result.status,
  artifact: '/dwac-cycle58-proof-debug.json',
}, null, 2));
// Diagnostic preview only. Canonical proof chain remains unchanged and will be
// restored as the Vercel build command before any PR is opened.
process.exit(0);
