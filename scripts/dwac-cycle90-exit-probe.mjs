#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { compileRealityToBytecode } from '../src/bytecode.mjs';
import { runNativeCompiler } from '../src/native-vm.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const HISTORICAL_PROCESS_GUARD_MS = 180_000;
const HISTORICAL_TOTAL_BUDGET_MS = 240_000;
const DIAGNOSTIC_PROCESS_GUARD_MS = 420_000;
const MINIMUM_NATIVE_INSTRUCTION_HEADROOM = 180_000_000;

function writePayload(payload) {
  const moduleSource = `const payload = ${JSON.stringify(payload, null, 2)};\nexport default function handler(_req, res) { res.status(200).json(payload); }\n`;
  fs.writeFileSync(path.join(ROOT, 'api', 'runtime-health.mjs'), moduleSource, 'utf8');
  console.log(JSON.stringify({
    status: payload.status,
    ok: payload.ok,
    firstElapsedMs: payload.first?.elapsedMs ?? null,
    secondElapsedMs: payload.second?.elapsedMs ?? null,
    totalElapsedMs: payload.totalElapsedMs ?? null,
    failure: payload.failure ?? null,
  }, null, 2));
}

function failureShape(error) {
  return {
    name: error?.name ?? null,
    code: error?.code ?? null,
    message: error?.message ?? String(error),
    payload: error?.payload ?? null,
  };
}

function stageShape(result, elapsedMs, expected) {
  const instructionBudget = Number(result?.instructionBudget ?? 0);
  const executedInstructions = Number(result?.executedInstructions ?? 0);
  const instructionHeadroom = instructionBudget - executedInstructions;
  return {
    elapsedMs,
    byteIdentical: Boolean(result?.bytecode?.equals(expected)),
    outputBytes: result?.bytecode?.length ?? null,
    executedInstructions,
    instructionBudget,
    instructionHeadroom,
    minimumInstructionHeadroom: MINIMUM_NATIVE_INSTRUCTION_HEADROOM,
    instructionHeadroomPassed: executedInstructions > 0
      && instructionBudget >= executedInstructions
      && instructionHeadroom >= MINIMUM_NATIVE_INSTRUCTION_HEADROOM,
    peakStackDepth: result?.peakStackDepth ?? null,
    peakCallFrames: result?.peakCallFrames ?? null,
    withinHistoricalProcessGuard: elapsedMs <= HISTORICAL_PROCESS_GUARD_MS,
  };
}

const build = spawnSync(process.execPath, ['scripts/build-native.mjs'], {
  cwd: ROOT,
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
  env: process.env,
});
if (build.error || build.status !== 0) {
  writePayload({
    ok: false,
    diagnosticOnly: true,
    status: 'DWAC_CYCLE90_NATIVE_FIXEDPOINT_HOST_DIAGNOSTIC',
    phase: 'build-native',
    failure: {
      code: 'NATIVE_BUILD_FAILED',
      message: build.error?.message ?? `build-native exited ${build.status}`,
      stdoutTail: String(build.stdout ?? '').slice(-5000),
      stderrTail: String(build.stderr ?? '').slice(-5000),
    },
    truthBoundary: {
      diagnosticOnly: true,
      canonicalAcceptanceUnchanged: true,
      noPerformancePassClaimed: true,
      noSemanticCapabilityClaimed: true,
    },
  });
  process.exit(0);
}

const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const compilerSource = `${read('selfhost/compiler-core.rcl')}\n${read('selfhost/compiler-main.rcl')}`;
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-cycle90-native-fixedpoint-host-'));

try {
  const sourcePath = path.join(directory, 'compiler.rcl');
  const c0Path = path.join(directory, 'compiler-c0.rbc');
  const c1Path = path.join(directory, 'compiler-c1.rbc');
  const c2Path = path.join(directory, 'compiler-c2.rbc');
  const c0 = compileRealityToBytecode(compilerSource);
  fs.writeFileSync(sourcePath, compilerSource, 'utf8');
  fs.writeFileSync(c0Path, c0);

  const startedAt = performance.now();
  let first = null;
  let second = null;
  let firstElapsedMs = null;
  let secondElapsedMs = null;
  let failure = null;

  try {
    const firstStartedAt = performance.now();
    first = runNativeCompiler(c0Path, sourcePath, c1Path, {
      outputState: 'compiler.output',
      timeout: DIAGNOSTIC_PROCESS_GUARD_MS,
      maxBuffer: 64 * 1024 * 1024,
    });
    firstElapsedMs = performance.now() - firstStartedAt;

    const secondStartedAt = performance.now();
    second = runNativeCompiler(c1Path, sourcePath, c2Path, {
      outputState: 'compiler.output',
      timeout: DIAGNOSTIC_PROCESS_GUARD_MS,
      maxBuffer: 64 * 1024 * 1024,
    });
    secondElapsedMs = performance.now() - secondStartedAt;
  } catch (error) {
    failure = failureShape(error);
  }

  const totalElapsedMs = performance.now() - startedAt;
  const firstEvidence = first && firstElapsedMs !== null ? stageShape(first, firstElapsedMs, c0) : null;
  const secondEvidence = second && secondElapsedMs !== null ? stageShape(second, secondElapsedMs, first?.bytecode) : null;
  const exactParity = Boolean(firstEvidence?.byteIdentical && secondEvidence?.byteIdentical);
  const deterministicResourceGate = Boolean(firstEvidence?.instructionHeadroomPassed && secondEvidence?.instructionHeadroomPassed);

  writePayload({
    ok: failure === null && exactParity && deterministicResourceGate,
    diagnosticOnly: true,
    status: 'DWAC_CYCLE90_NATIVE_FIXEDPOINT_HOST_DIAGNOSTIC',
    phase: failure ? 'native-fixedpoint-failed' : 'native-fixedpoint-complete',
    historicalAcceptanceContext: {
      historicalProcessGuardMs: HISTORICAL_PROCESS_GUARD_MS,
      historicalTotalBudgetMs: HISTORICAL_TOTAL_BUDGET_MS,
      diagnosticProcessGuardMs: DIAGNOSTIC_PROCESS_GUARD_MS,
      minimumInstructionHeadroom: MINIMUM_NATIVE_INSTRUCTION_HEADROOM,
    },
    c0Bytes: c0.length,
    first: firstEvidence,
    second: secondEvidence,
    totalElapsedMs,
    exactParityC0C1: firstEvidence?.byteIdentical ?? false,
    exactParityC1C2: secondEvidence?.byteIdentical ?? false,
    deterministicResourceGatePassed: deterministicResourceGate,
    withinHistoricalTotalBudget: totalElapsedMs <= HISTORICAL_TOTAL_BUDGET_MS,
    failure,
    truthBoundary: {
      diagnosticOnly: true,
      canonicalAcceptanceUnchanged: true,
      historicalWallClockBudgetNotWaived: true,
      noPerformancePassClaimed: true,
      noSemanticCapabilityClaimed: true,
      exactParityMustStillHold: true,
      instructionHeadroomMustStillHold: true,
    },
  });
} finally {
  fs.rmSync(directory, { recursive: true, force: true });
}
