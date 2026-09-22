#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const publicDir = path.join(root, 'public');
fs.mkdirSync(publicDir, { recursive: true });

function run(args) {
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    encoding: 'utf8',
    env: process.env,
    maxBuffer: 16 * 1024 * 1024,
  });
  return {
    args,
    status: result.status,
    signal: result.signal ?? null,
    error: result.error?.message ?? null,
    stdoutTail: (result.stdout ?? '').split('\n').slice(-120).join('\n'),
    stderrTail: (result.stderr ?? '').split('\n').slice(-120).join('\n'),
  };
}

const baseline = run(['scripts/dwac-cycle85-exit-probe.mjs']);
let neuralRecheck = null;
if (baseline.status === 44) {
  neuralRecheck = run(['scripts/bind-vercel-foundation-neural.mjs']);
}

const diagnostic = {
  ok: baseline.status === 0,
  format: 'taowind.rcl-cycle86-diagnostic.v0.1',
  status: baseline.status === 0 ? 'BASELINE_REGRESSION_PASS' : 'BASELINE_REGRESSION_FAILED',
  baseline,
  neuralRecheck,
  diagnosticOnly: true,
  validationClaimed: false,
};
fs.writeFileSync(path.join(publicDir, 'rcl-cycle86-diagnostic.json'), `${JSON.stringify(diagnostic, null, 2)}\n`);
console.log(JSON.stringify({
  ok: true,
  status: 'RCL_CYCLE86_DIAGNOSTIC_ARTIFACT_EMITTED',
  baselineExitCode: baseline.status,
  neuralRecheckExitCode: neuralRecheck?.status ?? null,
  diagnosticOnly: true,
  validationClaimed: false,
}, null, 2));
