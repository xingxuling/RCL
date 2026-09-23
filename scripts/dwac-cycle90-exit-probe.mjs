#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const build = spawnSync(npm, ['run', 'build:native'], { cwd: root, stdio: 'inherit', env: process.env });
if (build.error || build.status !== 0) process.exit(7);

const tests = fs.readdirSync(path.join(root, 'tests'))
  .filter(name => name.endsWith('.test.mjs') && !['f', 's'].includes(name[0]?.toLowerCase()))
  .sort();
const topBuckets = Array.from({ length: 4 }, () => []);
for (let i = 0; i < tests.length; i += 1) topBuckets[Math.floor(i * 4 / tests.length)].push(tests[i]);
const level1 = Array.from({ length: 7 }, () => []);
for (let i = 0; i < topBuckets[0].length; i += 1) level1[Math.floor(i * 7 / topBuckets[0].length)].push(topBuckets[0][i]);
const suspects = level1[5];

const results = [];
for (const name of suspects) {
  const result = spawnSync(process.execPath, ['--test', '--test-concurrency=1', `tests/${name}`], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    env: process.env,
  });
  const passed = !result.error && result.status === 0;
  results.push({
    name,
    passed,
    exitCode: result.status ?? null,
    error: result.error?.message ?? null,
    stdoutTail: String(result.stdout ?? '').slice(-5000),
    stderrTail: String(result.stderr ?? '').slice(-5000),
  });
}

const payload = {
  ok: true,
  diagnosticOnly: true,
  status: 'DWAC_CYCLE90_RESIDUAL_B0_S5_FILE_DETAILS',
  suspectCount: suspects.length,
  failed: results.filter(item => !item.passed).map(item => item.name),
  results,
};
const moduleSource = `const payload = ${JSON.stringify(payload, null, 2)};\nexport default function handler(_req, res) { res.status(200).json(payload); }\n`;
fs.writeFileSync(path.join(root, 'api', 'runtime-health.mjs'), moduleSource, 'utf8');
console.log(JSON.stringify({ status: payload.status, suspectCount: payload.suspectCount, failed: payload.failed }, null, 2));
