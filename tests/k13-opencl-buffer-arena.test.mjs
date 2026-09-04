import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { compileRealityToBytecode } from '../src/bytecode.mjs';
import { evidenceRoot } from '../src/universal-program-stress.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROVIDER = path.join(ROOT, 'native', 'tensor-engine', 'amd_opencl_bf16_provider.py');
const GENOME = path.join(ROOT, 'examples', 'native-ai', 'gpu-opencl-buffer-arena-genome.rcl');
const CONTRACT = path.join(ROOT, 'examples', 'native-ai', 'gpu-opencl-buffer-arena-contract.v0.1.json');
const EVIDENCE = path.join(ROOT, 'examples', 'native-ai', 'evidence', 'gpu-opencl-buffer-arena-v0.1', 'k13-opencl-buffer-arena-local-evidence.json');
const PYTHON = process.env.RCL_PYTHON || (process.platform === 'win32' ? 'python' : 'python3');

const request = {
  format: 'rcl.opencl-bf16-matmul-request.v0.1',
  backend: 'opencl-amd',
  rows: 1,
  columns: 1,
  shared: 1,
  leftBits: ['3f80'],
  rightBits: ['4000'],
};
const closeRequest = {
  format: 'rcl.opencl-amd-session-close-request.v0.1',
  backend: 'opencl-amd',
};

function runSession(mode, requests = [request, request]) {
  const args = [PROVIDER, '--session'];
  if (mode) args.push('--buffer-mode', mode);
  const run = spawnSync(PYTHON, args, {
    cwd: ROOT,
    input: `${requests.map((item) => JSON.stringify(item)).join('\n')}\n`,
    encoding: 'utf8',
    timeout: 120_000,
    maxBuffer: 16 * 1024 * 1024,
  });
  assert.equal(run.status, 0, run.stderr);
  return run.stdout.trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

function unavailable(code) {
  return [
    'RCL_OPENCL_BACKEND_UNAVAILABLE',
    'RCL_OPENCL_AMD_DEVICE_REQUIRED',
    'RCL_OPENCL_SYMBOL_UNAVAILABLE',
  ].includes(code);
}

test('K13 contract keeps allocation reuse separate from Tensor value residency', () => {
  assert.ok(compileRealityToBytecode(fs.readFileSync(GENOME, 'utf8')).length > 0);
  const contract = JSON.parse(fs.readFileSync(CONTRACT, 'utf8'));
  assert.equal(contract.status, 'OPENCL_AMD_SESSION_BUFFER_ARENA_CANDIDATE');
  assert.equal(contract.canonicalOwner, 'RCL');
  assert.equal(contract.arena.mode, 'session-arena-v0.1');
  assert.equal(contract.arena.maxPooledBuffers, 64);
  assert.equal(contract.arena.maxPooledBytes, 2 * 1024 * 1024);
  assert.equal(contract.semanticBoundary.tensorValueResidency, false);
  assert.equal(contract.semanticBoundary.inputTransfer, 'host-to-device on every operation');
  assert.equal(contract.semanticBoundary.outputTransfer, 'device-to-host on every operation');
  assert.ok(contract.claimsNotGranted.includes('OPENCL_TENSOR_VALUE_RESIDENCY'));
  const evidence = JSON.parse(fs.readFileSync(EVIDENCE, 'utf8'));
  assert.equal(evidence.implementationCommit, 'f6f3de9a06fd191b6eef214a5649967a5e1aea2f');
  assert.equal(evidence.reportRoot, evidenceRoot({ ...evidence, reportRoot: undefined }));
  assert.equal(evidence.hostedReplay.status, 'PASS_EXACT_HEAD');
  assert.equal(evidence.hostedReplay.pullRequest, 115);
  assert.equal(evidence.postMergeVerification.status, 'PASS_MAIN_POSTMERGE');
  assert.equal(evidence.postMergeVerification.mainSha, '251b20a758326fd3a17056c424584145dde15e89');
  assert.equal(evidence.postMergeVerification.universalStressRun.attempt, 3);
  assert.equal(evidence.k400.matrixAfter, '23 PASS / 0 BLOCKED / 377 UNTESTED');
  assert.equal(evidence.k400.verdict, 'INCOMPLETE');
});

test('K13 real OpenCL session arena reuses bounded allocations without semantic drift', () => {
  const perKernel = runSession(null);
  if (perKernel[0]?.status === 'error') {
    assert.equal(unavailable(perKernel[0].code), true, JSON.stringify(perKernel[0]));
    return;
  }
  const arena = runSession('session-arena-v0.1', [request, request, closeRequest]);
  assert.equal(arena.length, 3);
  assert.deepEqual(arena.slice(0, 2).map((item) => item.outputBits), perKernel.map((item) => item.outputBits));
  assert.deepEqual(arena.slice(0, 2).map((item) => item.executionRoot), perKernel.map((item) => item.executionRoot));

  const baselineStats = perKernel.at(-1).sessionStats;
  assert.equal(baselineStats.bufferAllocationMode, 'per-kernel-v0.1');
  assert.equal(baselineStats.bufferAllocationCount, 6);
  assert.equal(baselineStats.bufferReuseCount, 0);
  assert.equal(baselineStats.bufferReleaseCount, 6);
  assert.equal(baselineStats.pooledBufferCount, 0);
  assert.equal(baselineStats.tensorValueResidency, false);

  const firstArenaStats = arena[0].sessionStats;
  const arenaStats = arena[1].sessionStats;
  assert.equal(firstArenaStats.bufferAllocationCount, 3);
  assert.equal(firstArenaStats.bufferReuseCount, 0);
  assert.equal(arenaStats.bufferAllocationMode, 'session-arena-v0.1');
  assert.equal(arenaStats.bufferAllocationCount, 3);
  assert.equal(arenaStats.bufferReuseCount, 3);
  assert.equal(arenaStats.bufferReleaseCount, 0);
  assert.equal(arenaStats.pooledBufferCount, 3);
  assert.equal(arenaStats.pooledBytes, 6);
  assert.ok(arenaStats.peakPooledBuffers <= arenaStats.maxArenaBuffers);
  assert.ok(arenaStats.peakPooledBytes <= arenaStats.maxArenaBytes);
  assert.equal(arenaStats.tensorValueResidency, false);
  const close = arena.at(-1);
  assert.equal(close.format, 'rcl.opencl-amd-session-close-result.v0.1');
  assert.equal(close.status, 'PASS_LOCAL_GPU_SESSION_CLOSE_CANDIDATE');
  assert.equal(close.closed, true);
  assert.equal(close.sessionStats.bufferReleaseCount, 3);
  assert.equal(close.sessionStats.pooledBufferCount, 0);
  assert.equal(close.sessionStats.pooledBytes, 0);
});

test('K13 unknown buffer allocation modes fail closed before device selection', () => {
  const [response] = runSession('session-arena-unbounded', [request]);
  assert.equal(response.status, 'error');
  assert.equal(response.code, 'RCL_OPENCL_BUFFER_ALLOCATION_MODE_UNSUPPORTED');
});
