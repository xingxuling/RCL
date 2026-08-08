#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  compileNativeC,
  nativeCCompilerVersion,
  resolveNativeCCompiler,
} from '../src/native-c-compiler.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outputPath = path.resolve(process.argv[2] ?? path.join(ROOT, 'output', 'rbc13-execution-benchmark', 'report.json'));
const ITERATIONS = [1000, 10000, 100000];
const WARMUP = 1000;
const REPETITIONS = 7;
const PATHS = ['primitive', 'native-organ', 'provider'];

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * p) - 1));
  return sorted[index];
}

function stats(sample, iterations, processSample) {
  const durations = sample.runs.map(run => Number(run.elapsedNs));
  const mean = durations.reduce((sum, value) => sum + value, 0) / durations.length;
  const variance = durations.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / durations.length;
  const medianNs = percentile(durations, 0.5);
  return {
    iterations,
    repetitions: durations.length,
    medianNs,
    p95Ns: percentile(durations, 0.95),
    meanNs: Number(mean.toFixed(3)),
    varianceNsSquared: Number(variance.toFixed(3)),
    medianNsPerOperation: Number((medianNs / iterations).toFixed(6)),
    medianOpsPerSecond: Number(((iterations * 1_000_000_000) / medianNs).toFixed(3)),
    minNs: Math.min(...durations),
    maxNs: Math.max(...durations),
    rssBeforeBytes: processSample.rssBeforeBytes,
    rssAfterBytes: processSample.rssAfterBytes,
    rssDeltaBytes: Number(processSample.rssAfterBytes) - Number(processSample.rssBeforeBytes),
    allocationCount: sample.runs.reduce((sum, run) => sum + Number(run.allocationCount ?? 0), 0),
    allocationBytes: sample.runs.reduce((sum, run) => sum + Number(run.allocationBytes ?? 0), 0),
    organCloneCalls: sample.runs.reduce((sum, run) => sum + Number(run.organCloneCalls ?? 0), 0),
    rawRuns: durations,
  };
}

function buildHost() {
  const compiler = resolveNativeCCompiler();
  if (!compiler) return { status: 'BLOCKED', reason: 'RCL_RBC13_PERFORMANCE_C_COMPILER_MISSING' };
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-rbc13-performance-'));
  const output = path.join(tempDir, `rbc13-execution-benchmark${process.platform === 'win32' ? '.exe' : ''}`);
  const build = compileNativeC(compiler, {
    cwd: tempDir,
    includeDirs: [path.join(ROOT, 'native')],
    sources: [
      path.join(ROOT, 'native', 'rcl_domain_value.c'),
      path.join(ROOT, 'native', 'rcl_domain_organ.c'),
      path.join(ROOT, 'native', 'rcl_domain_admitted_organs.c'),
      path.join(ROOT, 'native', 'rbc13_execution_benchmark.c'),
    ],
    linkLibraries: process.platform === 'win32' ? ['Psapi'] : [],
    output,
    timeout: 120_000,
  });
  if (build.status !== 0) {
    fs.rmSync(tempDir, { recursive: true, force: true });
    return { status: 'BLOCKED', reason: 'RCL_RBC13_PERFORMANCE_C_BUILD_FAILED', stderr: String(build.stderr ?? '').slice(-4000), stdout: String(build.stdout ?? '').slice(-4000), compiler: compiler.command };
  }
  return { status: 'ready', compiler, tempDir, output, hostRoot: sha256(fs.readFileSync(output)) };
}

function runSample(host, iterations) {
  const started = process.hrtime.bigint();
  const run = spawnSync(host.output, ['--iterations', String(iterations), '--warmup', String(WARMUP), '--repetitions', String(REPETITIONS)], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 180_000,
    maxBuffer: 8 * 1024 * 1024,
  });
  const processElapsedMs = Number(process.hrtime.bigint() - started) / 1_000_000;
  if (run.status !== 0) return { status: 'BLOCKED', reason: 'RCL_RBC13_PERFORMANCE_HOST_RUN_FAILED', exitStatus: run.status, stderr: String(run.stderr ?? '').slice(-4000), processElapsedMs };
  try {
    return { status: 'VERIFIED', sample: JSON.parse(String(run.stdout ?? '').trim()), processElapsedMs };
  } catch (error) {
    return { status: 'BLOCKED', reason: 'RCL_RBC13_PERFORMANCE_HOST_JSON_FAILED', message: String(error?.message ?? error), stdout: String(run.stdout ?? '').slice(-4000), processElapsedMs };
  }
}

function main() {
  const started = process.hrtime.bigint();
  const host = buildHost();
  if (host.status !== 'ready') {
    const blocked = { format: 'rcl.rbc13-execution-benchmark.v0.1', status: 'BLOCKED', reason: host.reason, detail: host, boundary: 'No performance claim is made without a buildable benchmark host.' };
    blocked.root = sha256(JSON.stringify({ ...blocked, root: undefined }));
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(blocked, null, 2)}\n`);
    console.log(JSON.stringify(blocked, null, 2));
    process.exitCode = 2;
    return;
  }
  const samples = [];
  for (const iterations of ITERATIONS) {
    const result = runSample(host, iterations);
    if (result.status !== 'VERIFIED') {
      fs.rmSync(host.tempDir, { recursive: true, force: true });
      const blocked = { format: 'rcl.rbc13-execution-benchmark.v0.1', status: 'BLOCKED', reason: result.reason, detail: result, hostRoot: host.hostRoot };
      blocked.root = sha256(JSON.stringify({ ...blocked, root: undefined }));
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, `${JSON.stringify(blocked, null, 2)}\n`);
      console.log(JSON.stringify(blocked, null, 2));
      process.exitCode = 2;
      return;
    }
    samples.push({ iterations, processElapsedMs: result.processElapsedMs, sample: result.sample });
  }
  const paths = Object.fromEntries(PATHS.map(pathName => [pathName, samples.map(item => stats(item.sample.paths[pathName], item.iterations, item.sample))]));
  const complete = Object.values(paths).every(series => series.length === ITERATIONS.length && series.every(item => Number.isFinite(item.medianNs) && item.repetitions === REPETITIONS));
  const report = {
    format: 'rcl.rbc13-execution-benchmark.v0.1',
    status: complete ? 'VERIFIED' : 'CANDIDATE',
    protocol: {
      seed: 'RBC13-PERFORMANCE-2026-08-09',
      input: 9007199254740991,
      iterations: ITERATIONS,
      warmup: WARMUP,
      repetitions: REPETITIONS,
      paths: {
        primitive: 'direct in-process Primitive echo with no Domain Value membrane',
        'native-organ': 'in-process rcl_domain_organ_invoke through the real registry and Domain Value ABI v1',
        provider: 'in-process provider-shaped JSON text boundary with request allocation; no network latency claim',
      },
    },
    compiler: host.compiler.command,
    compilerVersion: nativeCCompilerVersion(host.compiler),
    hostRoot: host.hostRoot,
    samples: samples.map(item => ({ iterations: item.iterations, processElapsedMs: item.processElapsedMs })),
    paths,
    measures: {
      allPathsExecuted: complete,
      repeatedSamples: complete,
      varianceRecorded: complete && Object.values(paths).flat().every(item => Number.isFinite(item.varianceNsSquared)),
      rssProxyRecorded: complete && Object.values(paths).flat().every(item => Number.isFinite(item.rssBeforeBytes)),
      processStartupProxyRecorded: samples.every(item => Number.isFinite(item.processElapsedMs)),
      competitiveRankingClaim: false,
    },
    durationMs: Number(process.hrtime.bigint() - started) / 1_000_000,
    boundary: 'VERIFIED means the three declared in-process paths were independently measured under a fixed protocol. It does not mean Native Organ is faster than Provider, does not include network latency, and does not activate canonical RBC 1.3.',
  };
  report.root = sha256(JSON.stringify({ ...report, root: undefined }));
  fs.rmSync(host.tempDir, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
}

main();
