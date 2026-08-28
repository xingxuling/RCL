import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { compileRealityToBytecode } from '../src/bytecode.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROVIDER = path.join(ROOT, 'native', 'tensor-engine', 'amd_opencl_bf16_provider.py');
const GENOME = path.join(ROOT, 'examples', 'native-ai', 'gpu-opencl-batched-dispatch-genome.rcl');
const CONTRACT = path.join(ROOT, 'examples', 'native-ai', 'gpu-opencl-batched-dispatch-contract.v0.1.json');
const PYTHON = process.env.RCL_PYTHON || (process.platform === 'win32' ? 'python' : 'python3');

const request = {
  format: 'rcl.opencl-bf16-matmul-request.v0.1',
  backend: 'opencl-amd',
  rows: 1,
  columns: 1,
  shared: 1,
  leftBits: ['3f80'],
  rightBits: ['4000'],
  nodeId: 'k10-batch-single',
};

function unavailable(code) {
  return [
    'RCL_OPENCL_BACKEND_UNAVAILABLE',
    'RCL_OPENCL_AMD_DEVICE_REQUIRED',
    'RCL_OPENCL_SYMBOL_UNAVAILABLE',
  ].includes(code);
}

test('K10 batched OpenCL dispatch is bounded, exact and fail-closed', () => {
  assert.ok(compileRealityToBytecode(fs.readFileSync(GENOME, 'utf8')).length > 0);
  const contract = JSON.parse(fs.readFileSync(CONTRACT, 'utf8'));
  assert.equal(contract.status, 'OPENCL_AMD_BATCHED_DISPATCH_CANDIDATE');
  assert.equal(contract.canonicalOwner, 'RCL');
  assert.equal(contract.semanticBoundary.fallback, 'forbidden');
  assert.equal(contract.transport.format, 'rcl.opencl-amd-batch-request.v0.1');
  assert.equal(contract.transport.maxOperations, 64);

  const batchRequest = {
    format: 'rcl.opencl-amd-batch-request.v0.1',
    backend: 'opencl-amd',
    requests: [
      request,
      { ...request, nodeId: 'k10-batch-child' },
    ],
  };
  const oversizedBatch = {
    format: 'rcl.opencl-amd-batch-request.v0.1',
    backend: 'opencl-amd',
    requests: Array.from({ length: 65 }, (_, index) => ({ ...request, nodeId: `k10-overflow-${index}` })),
  };
  const run = spawnSync(PYTHON, [PROVIDER, '--session'], {
    cwd: ROOT,
    input: `${JSON.stringify(request)}\n${JSON.stringify(batchRequest)}\n${JSON.stringify(oversizedBatch)}\n`,
    encoding: 'utf8',
    timeout: 120_000,
    maxBuffer: 16 * 1024 * 1024,
  });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  const responses = run.stdout.trim().split(/\r?\n/).map((line) => JSON.parse(line));
  assert.equal(responses.length, 3);
  if (responses[0].status === 'error') {
    assert.equal(unavailable(responses[0].code), true, JSON.stringify(responses));
    assert.equal(responses[1].status, 'error');
    assert.equal(unavailable(responses[1].code), true, JSON.stringify(responses));
    assert.equal(responses[2].status, 'error');
    assert.equal(unavailable(responses[2].code), true, JSON.stringify(responses));
    return;
  }

  const single = responses[0];
  const batch = responses[1];
  assert.equal(single.status, 'PASS_LOCAL_GPU_REFERENCE_CANDIDATE');
  assert.equal(single.gpuExecuted, true);
  assert.deepEqual(single.outputBits, ['4000']);
  assert.equal(batch.format, 'rcl.opencl-amd-batch-result.v0.1');
  assert.equal(batch.status, 'PASS_LOCAL_GPU_BATCH_REFERENCE_CANDIDATE');
  assert.equal(batch.gpuExecuted, true);
  assert.equal(batch.operationCount, 2);
  assert.equal(batch.responses.length, 2);
  for (const child of batch.responses) {
    assert.equal(child.status, 'PASS_LOCAL_GPU_REFERENCE_CANDIDATE');
    assert.equal(child.gpuExecuted, true);
    assert.deepEqual(child.outputBits, single.outputBits);
    assert.equal(child.executionRoot, single.executionRoot);
  }
  assert.match(batch.executionRoot, /^[0-9a-f]{64}$/);
  assert.equal(responses[2].status, 'error');
  assert.equal(responses[2].code, 'RCL_OPENCL_BATCH');
});
