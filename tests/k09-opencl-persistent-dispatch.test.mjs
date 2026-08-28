import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { compileRealityToBytecode } from '../src/bytecode.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROVIDER = path.join(ROOT, 'native', 'tensor-engine', 'amd_opencl_bf16_provider.py');
const GENOME = path.join(ROOT, 'examples', 'native-ai', 'gpu-opencl-persistent-dispatch-genome.rcl');
const CONTRACT = path.join(ROOT, 'examples', 'native-ai', 'gpu-opencl-persistent-dispatch-contract.v0.1.json');
const PYTHON = process.env.RCL_PYTHON || (process.platform === 'win32' ? 'python' : 'python3');

const request = {
  format: 'rcl.opencl-bf16-matmul-request.v0.1',
  backend: 'opencl-amd',
  rows: 1,
  columns: 1,
  shared: 1,
  leftBits: ['3f80'],
  rightBits: ['4000'],
  nodeId: 'k09-session-smoke',
};

function unavailable(code) {
  return [
    'RCL_OPENCL_BACKEND_UNAVAILABLE',
    'RCL_OPENCL_AMD_DEVICE_REQUIRED',
    'RCL_OPENCL_SYMBOL_UNAVAILABLE',
  ].includes(code);
}

test('K09 persistent OpenCL transport is RCL-owned, reusable and fail-closed', () => {
  assert.ok(compileRealityToBytecode(fs.readFileSync(GENOME, 'utf8')).length > 0);
  const contract = JSON.parse(fs.readFileSync(CONTRACT, 'utf8'));
  assert.equal(contract.status, 'OPENCL_AMD_PERSISTENT_DISPATCH_CANDIDATE');
  assert.equal(contract.canonicalOwner, 'RCL');
  assert.equal(contract.semanticBoundary.fallback, 'forbidden');
  assert.equal(contract.transport.scope, 'one RCL training request');

  const run = spawnSync(PYTHON, [PROVIDER, '--session'], {
    cwd: ROOT,
    input: `${JSON.stringify(request)}\n${JSON.stringify({ ...request, nodeId: 'k09-session-smoke-replay' })}\n`,
    encoding: 'utf8',
    timeout: 120_000,
    maxBuffer: 16 * 1024 * 1024,
  });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  const responses = run.stdout.trim().split(/\r?\n/).map((line) => JSON.parse(line));
  assert.equal(responses.length, 2);
  if (responses[0].status === 'error') {
    assert.equal(unavailable(responses[0].code), true, JSON.stringify(responses));
    assert.deepEqual(responses[1], responses[0]);
    return;
  }
  for (const response of responses) {
    assert.equal(response.status, 'PASS_LOCAL_GPU_REFERENCE_CANDIDATE');
    assert.equal(response.gpuExecuted, true);
    assert.deepEqual(response.outputBits, ['4000']);
    assert.equal(response.executionRoot, responses[0].executionRoot);
  }
});
