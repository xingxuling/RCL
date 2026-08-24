#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, sortKeys(value[key])]));
}

function canonicalJson(value) {
  return JSON.stringify(sortKeys(value));
}

function sha256(value) {
  return createHash('sha256').update(typeof value === 'string' ? value : canonicalJson(value)).digest('hex');
}

function stableRank(seed, cell, replicate) {
  return sha256(`${seed}:${cell.symbolCondition}:${cell.geometryCondition}:${replicate}`);
}

const sleeper = new Int32Array(new SharedArrayBuffer(4));
const timingScale = process.platform === 'win32' ? 16 : 1;

function waitForDelay(delayMs) {
  Atomics.wait(sleeper, 0, 0, delayMs * timingScale);
}

function measure(delayMs, repeats) {
  const xs = [];
  for (let i = 0; i < repeats; i += 1) {
    const start = process.hrtime.bigint();
    waitForDelay(delayMs);
    xs.push(Number(process.hrtime.bigint() - start) / 1e6);
  }
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

const outputPath = process.argv[2];
const mode = process.argv[3] || 'interaction';
if (!outputPath) {
  console.error('Usage: node produce-known-timing-dataset.mjs <output.json> [interaction|additive]');
  process.exit(2);
}
if (!['interaction', 'additive'].includes(mode)) {
  console.error(`Unsupported mode: ${mode}`);
  process.exit(2);
}
const resolvedOutputPath = path.resolve(outputPath);

const seed = 20260811;
const samplesPerCell = 10;
const repeats = 1;
const baseDelayMs = 1;
const symbolDelayMs = 3;
const geometryDelayMs = 5;
const interactionDelayMs = mode === 'interaction' ? 8 : 0;
const startedAt = new Date().toISOString();
const schedule = [];
for (const symbolCondition of ['control', 'active']) {
  for (const geometryCondition of ['control', 'active']) {
    for (let replicate = 0; replicate < samplesPerCell; replicate += 1) {
      schedule.push({ symbolCondition, geometryCondition, replicate });
    }
  }
}
schedule.sort((a, b) => stableRank(seed, a, a.replicate).localeCompare(stableRank(seed, b, b.replicate)));
Atomics.wait(sleeper, 0, 0, 2);
const rows = schedule.map((c, index) => {
  const s = c.symbolCondition === 'active' ? symbolDelayMs : 0;
  const g = c.geometryCondition === 'active' ? geometryDelayMs : 0;
  const x = c.symbolCondition === 'active' && c.geometryCondition === 'active' ? interactionDelayMs : 0;
  return {
    observationId: `independent_${mode}_${String(index + 1).padStart(4, '0')}`,
    timestamp: new Date().toISOString(),
    instrumentId: 'standalone-node-process.hrtime.bigint',
    session: index % 8,
    symbolCondition: c.symbolCondition,
    geometryCondition: c.geometryCondition,
    response: Number(measure(baseDelayMs + s + g + x, repeats).toFixed(6)),
    qualityFlags: [],
  };
});
const completedAt = new Date().toISOString();
const host = {
  node: process.version,
  platform: process.platform,
  arch: process.arch,
  cpuModels: [...new Set(os.cpus().map(cpu => cpu.model))],
};
const payload = {
  format: 'rcl.frontier-independent-acquisition-file.v0.1',
  producer: {
    implementation: 'standalone-node-known-timing-producer-v0.1',
    processId: process.pid,
    parentProcessId: process.ppid,
    importsRcl: false,
    startedAt,
    completedAt,
    hostFingerprint: sha256(host),
    producerSourceBoundary: 'node-builtins-only_no_rcl_imports',
  },
  study: {
    mode,
    seed,
    samplesPerCell,
    repeats,
    timingScale,
    baseDelayMs,
    symbolDelayMs,
    geometryDelayMs,
    interactionDelayMs,
    truthClass: mode === 'interaction' ? 'known_engineered_interaction' : 'known_engineered_additive',
  },
  provenance: {
    sourceType: 'software_control',
    sourceUri: pathToFileURL(resolvedOutputPath).href,
    collector: 'standalone acquisition producer (not RCL runtime)',
    acquiredAt: startedAt,
    licenseOrPermission: 'local-process-measurement-authorized',
    acquisitionMethod: `separate Node process; Atomics.wait timing observed by process.hrtime.bigint; platform timing scale=${timingScale}; output file completed before RCL intake`,
  },
  calibration: {
    status: 'valid',
    referenceId: 'standalone-node-process.hrtime.bigint-monotonic-clock',
    measuredAt: startedAt,
    method: 'monotonic high-resolution process clock with warmup',
    tolerance: 0.001,
    notes: 'Known ordinary software timing control; not a natural-law instrument calibration.',
  },
  rows,
};
payload.fileRoot = sha256({ ...payload, fileRoot: undefined });
fs.mkdirSync(path.dirname(resolvedOutputPath), { recursive: true });
fs.writeFileSync(resolvedOutputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ outputPath: resolvedOutputPath, mode, observationCount: rows.length, fileRoot: payload.fileRoot, producerProcessId: process.pid }, null, 2));
