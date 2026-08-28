import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { compileRealityToBytecode } from '../src/bytecode.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROVIDER = path.join(ROOT, 'native', 'tensor-engine', 'amd_opencl_bf16_provider.py');
const GENOME = path.join(ROOT, 'examples', 'native-ai', 'gpu-opencl-gradient-pair-batch-genome.rcl');
const CONTRACT = path.join(ROOT, 'examples', 'native-ai', 'gpu-opencl-gradient-pair-batch-contract.v0.1.json');
const PYTHON = process.env.RCL_PYTHON || (process.platform === 'win32' ? 'python' : 'python3');

const base = {
  format: 'rcl.opencl-bf16-matmul-gradient-request.v0.1',
  backend: 'opencl-amd',
  leftRows: 1,
  leftColumns: 1,
  rightRows: 1,
  rightColumns: 1,
  leftBits: ['3f80'],
  rightBits: ['4000'],
  upstreamF32Bits: ['40400000'],
};

function unavailable(code) {
  return [
    'RCL_OPENCL_BACKEND_UNAVAILABLE',
    'RCL_OPENCL_AMD_DEVICE_REQUIRED',
    'RCL_OPENCL_SYMBOL_UNAVAILABLE',
  ].includes(code);
}

test('K11 same-node reverse-matmul gradient pair is ordered, exact and fail-closed', () => {
  assert.ok(compileRealityToBytecode(fs.readFileSync(GENOME, 'utf8')).length > 0);
  const contract = JSON.parse(fs.readFileSync(CONTRACT, 'utf8'));
  assert.equal(contract.status, 'OPENCL_AMD_GRADIENT_PAIR_BATCH_CANDIDATE');
  assert.equal(contract.canonicalOwner, 'RCL');
  assert.equal(contract.semanticBoundary.fallback, 'forbidden');
  assert.equal(contract.transport.format, 'rcl.opencl-amd-batch-request.v0.1');
  assert.equal(contract.transport.maxOperations, 2);
  assert.deepEqual(contract.integration.pairOrder, ['left-gradient', 'right-gradient']);
  assert.equal(contract.integration.crossNodeBatching, false);

  const left = { ...base, operation: 'left-gradient', nodeId: 'k11-left-gradient' };
  const right = { ...base, operation: 'right-gradient', nodeId: 'k11-right-gradient' };
  const pair = {
    format: 'rcl.opencl-amd-batch-request.v0.1',
    backend: 'opencl-amd',
    requests: [left, right],
  };
  const run = spawnSync(PYTHON, [PROVIDER, '--session'], {
    cwd: ROOT,
    input: `${JSON.stringify(left)}\n${JSON.stringify(right)}\n${JSON.stringify(pair)}\n`,
    encoding: 'utf8',
    timeout: 120_000,
    maxBuffer: 16 * 1024 * 1024,
  });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  const responses = run.stdout.trim().split(/\r?\n/).map((line) => JSON.parse(line));
  assert.equal(responses.length, 3);
  if (responses[0].status === 'error') {
    assert.equal(unavailable(responses[0].code), true, JSON.stringify(responses));
    assert.equal(unavailable(responses[1].code), true, JSON.stringify(responses));
    assert.equal(unavailable(responses[2].code), true, JSON.stringify(responses));
    return;
  }

  const leftResult = responses[0];
  const rightResult = responses[1];
  const pairResult = responses[2];
  assert.equal(leftResult.status, 'PASS_LOCAL_GPU_GRADIENT_REFERENCE_CANDIDATE');
  assert.equal(rightResult.status, 'PASS_LOCAL_GPU_GRADIENT_REFERENCE_CANDIDATE');
  assert.deepEqual(leftResult.outputBits, ['40c00000']);
  assert.deepEqual(rightResult.outputBits, ['40400000']);
  assert.equal(pairResult.format, 'rcl.opencl-amd-batch-result.v0.1');
  assert.equal(pairResult.status, 'PASS_LOCAL_GPU_BATCH_REFERENCE_CANDIDATE');
  assert.equal(pairResult.gpuExecuted, true);
  assert.equal(pairResult.operationCount, 2);
  assert.deepEqual(pairResult.responses.map((item) => item.operation), ['left-gradient', 'right-gradient']);
  assert.deepEqual(pairResult.responses.map((item) => item.outputBits), [leftResult.outputBits, rightResult.outputBits]);
  assert.deepEqual(pairResult.responses.map((item) => item.executionRoot), [leftResult.executionRoot, rightResult.executionRoot]);
  assert.match(pairResult.executionRoot, /^[0-9a-f]{64}$/);
});
