import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { compileRealityToBytecode } from '../src/bytecode.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROVIDER = path.join(ROOT, 'native', 'tensor-engine', 'amd_opencl_bf16_provider.py');
const GENOME = path.join(ROOT, 'examples', 'native-ai', 'gpu-opencl-cross-node-gradient-batch-genome.rcl');
const CONTRACT = path.join(ROOT, 'examples', 'native-ai', 'gpu-opencl-cross-node-gradient-batch-contract.v0.1.json');
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

test('K12 cross-node reverse-matmul frontier preserves ordered child results', () => {
  assert.ok(compileRealityToBytecode(fs.readFileSync(GENOME, 'utf8')).length > 0);
  const contract = JSON.parse(fs.readFileSync(CONTRACT, 'utf8'));
  assert.equal(contract.status, 'OPENCL_AMD_CROSS_NODE_GRADIENT_BATCH_CANDIDATE');
  assert.equal(contract.canonicalOwner, 'RCL');
  assert.equal(contract.semanticBoundary.fallback, 'forbidden');
  assert.equal(contract.transport.format, 'rcl.opencl-amd-batch-request.v0.1');
  assert.equal(contract.transport.maxNodes, 32);
  assert.equal(contract.transport.maxOperations, 64);
  assert.deepEqual(contract.planner.nodePairOrder, ['left-gradient', 'right-gradient']);
  assert.equal(contract.planner.requiresReadyGradient, true);
  assert.equal(contract.planner.requiresIndependentNodes, true);
  assert.equal(contract.planner.canonicalReverseOrder, true);

  const requests = ['k12-node-b', 'k12-node-a'].flatMap((nodeId) => [
    { ...base, operation: 'left-gradient', nodeId },
    { ...base, operation: 'right-gradient', nodeId },
  ]);
  const batch = {
    format: 'rcl.opencl-amd-batch-request.v0.1',
    backend: 'opencl-amd',
    requests,
  };
  const run = spawnSync(PYTHON, [PROVIDER, '--session'], {
    cwd: ROOT,
    input: `${requests.map((request) => JSON.stringify(request)).join('\n')}\n${JSON.stringify(batch)}\n`,
    encoding: 'utf8',
    timeout: 120_000,
    maxBuffer: 16 * 1024 * 1024,
  });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  const responses = run.stdout.trim().split(/\r?\n/).map((line) => JSON.parse(line));
  assert.equal(responses.length, 5);
  if (responses[0].status === 'error') {
    assert.ok(responses.every((response) => unavailable(response.code)), JSON.stringify(responses));
    return;
  }

  const individual = responses.slice(0, 4);
  const batched = responses[4];
  assert.equal(batched.status, 'PASS_LOCAL_GPU_BATCH_REFERENCE_CANDIDATE');
  assert.equal(batched.gpuExecuted, true);
  assert.equal(batched.operationCount, 4);
  assert.deepEqual(
    batched.responses.map((response) => response.operation),
    ['left-gradient', 'right-gradient', 'left-gradient', 'right-gradient'],
  );
  assert.deepEqual(
    batched.responses.map((response) => response.outputBits),
    individual.map((response) => response.outputBits),
  );
  assert.deepEqual(
    batched.responses.map((response) => response.executionRoot),
    individual.map((response) => response.executionRoot),
  );
  assert.match(batched.executionRoot, /^[0-9a-f]{64}$/);
});
