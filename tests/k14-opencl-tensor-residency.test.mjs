import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { compileRealityToBytecode } from '../src/bytecode.mjs';
import { evidenceRoot } from '../src/universal-program-stress.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST = path.join(ROOT, 'native', 'tensor-engine', 'Cargo.toml');
const ENGINE = path.join(
  ROOT,
  'native',
  'tensor-engine',
  'target',
  'release',
  process.platform === 'win32' ? 'rcl-opencl-tensor-residency.exe' : 'rcl-opencl-tensor-residency',
);
const PROVIDER = path.join(ROOT, 'native', 'tensor-engine', 'amd_opencl_bf16_provider.py');
const GENOME = path.join(ROOT, 'examples', 'native-ai', 'gpu-opencl-tensor-residency-genome.rcl');
const CONTRACT = path.join(ROOT, 'examples', 'native-ai', 'gpu-opencl-tensor-residency-contract.v0.1.json');
const EVIDENCE = path.join(
  ROOT,
  'examples',
  'native-ai',
  'evidence',
  'gpu-opencl-tensor-residency-v0.1',
  'k14-opencl-tensor-residency-local-evidence.json',
);
const PYTHON = process.env.RCL_PYTHON || (process.platform === 'win32' ? 'python' : 'python3');

function valueRoot(dtype, shape, bits) {
  const chunks = [
    Buffer.from('rcl.tensor.value-residency.v0.1\0', 'utf8'),
    Buffer.from(`${dtype}\0`, 'ascii'),
  ];
  const count = Buffer.alloc(8);
  count.writeBigUInt64LE(BigInt(shape.length));
  chunks.push(count);
  for (const dimension of shape) {
    const encoded = Buffer.alloc(8);
    encoded.writeBigUInt64LE(BigInt(dimension));
    chunks.push(encoded);
  }
  for (const bitsValue of bits) chunks.push(Buffer.from(`${bitsValue}\0`, 'ascii'));
  return `sha256:${createHash('sha256').update(Buffer.concat(chunks)).digest('hex')}`;
}

function tensor(tensorId, storageIdentity, bits, shape = [1, 2]) {
  return {
    tensorId,
    storageIdentity,
    dtype: 'bf16',
    shape,
    bits,
  };
}

const left = tensor('left', 'storage:left', ['3f80', '4000']);
const right = tensor('right', 'storage:right', ['4040', '4080'], [2, 1]);

const probeRequest = {
  format: 'rcl.k14.opencl-amd-tensor-residency-probe-request.v0.1',
  backend: 'opencl-amd',
  providerPath: PROVIDER,
  tensors: [left, right],
  operations: [
    { operation: 'bind', tensorId: 'left' },
    { operation: 'bind', tensorId: 'right' },
    { operation: 'bind', tensorId: 'left' },
    { operation: 'bind', tensorId: 'right' },
    {
      operation: 'matmul',
      nodeId: 'node:residency.first',
      leftTensorId: 'left',
      rightTensorId: 'right',
      outputTensorId: 'residency.first.output',
    },
    {
      operation: 'matmul',
      nodeId: 'node:residency.second',
      leftTensorId: 'left',
      rightTensorId: 'right',
      outputTensorId: 'residency.second.output',
    },
  ],
};

function unavailable(code) {
  return [
    'RCL_OPENCL_BACKEND_UNAVAILABLE',
    'RCL_OPENCL_AMD_DEVICE_REQUIRED',
    'RCL_OPENCL_SYMBOL_UNAVAILABLE',
    'RCL_ACCELERATOR_PROVIDER_UNAVAILABLE',
  ].includes(code);
}

function buildEngine() {
  const run = spawnSync(
    'cargo',
    ['build', '--release', '--locked', '--manifest-path', MANIFEST, '--bin', 'rcl-opencl-tensor-residency'],
    { cwd: ROOT, encoding: 'utf8', timeout: 180_000, maxBuffer: 32 * 1024 * 1024 },
  );
  assert.equal(run.status, 0, run.stderr || run.stdout);
}

function executeProbe(request) {
  const run = spawnSync(ENGINE, ['-'], {
    cwd: ROOT,
    input: JSON.stringify(request),
    encoding: 'utf8',
    timeout: 180_000,
    maxBuffer: 32 * 1024 * 1024,
  });
  const raw = (run.status === 0 ? run.stdout : run.stderr).trim();
  return { status: run.status, value: JSON.parse(raw) };
}

function runProviderSession(mode, requests) {
  const args = [PROVIDER, '--session'];
  if (mode) args.push('--buffer-mode', mode);
  const run = spawnSync(PYTHON, args, {
    cwd: ROOT,
    input: `${requests.map((request) => JSON.stringify(request)).join('\n')}\n`,
    encoding: 'utf8',
    timeout: 120_000,
    maxBuffer: 32 * 1024 * 1024,
  });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  return run.stdout.trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

test.before(() => {
  buildEngine();
});

test('K14 contract keeps RCL Tensor identity ahead of provider residency', () => {
  assert.ok(compileRealityToBytecode(fs.readFileSync(GENOME, 'utf8')).length > 0);
  const contract = JSON.parse(fs.readFileSync(CONTRACT, 'utf8'));
  assert.equal(contract.status, 'OPENCL_AMD_TENSOR_VALUE_RESIDENCY_CANDIDATE');
  assert.equal(contract.canonicalOwner, 'RCL');
  assert.equal(contract.semanticBoundary.identity, 'storageIdentity');
  assert.equal(contract.semanticBoundary.valueRoot, 'sha256 over dtype shape and canonical BF16 bits');
  assert.equal(contract.semanticBoundary.fallback, 'forbidden');
  assert.equal(contract.residency.mode, 'tensor-residency-v0.1');
  assert.equal(contract.residency.maxResidentTensors, 64);
  assert.equal(contract.residency.maxResidentBytes, 2 * 1024 * 1024);
  assert.equal(contract.semanticBoundary.outputTransfer, 'explicit device-to-host readback for every matmul');
  assert.ok(contract.claimsNotGranted.includes('OPENCL_FULL_GRAPH_RESIDENCY'));
  assert.ok(contract.claimsNotGranted.includes('OPENCL_TRAINING_STEP_RESIDENCY'));
  const expectedLeftRoot = valueRoot(left.dtype, left.shape, left.bits);
  const expectedRightRoot = valueRoot(right.dtype, right.shape, right.bits);
  assert.match(expectedLeftRoot, /^sha256:[0-9a-f]{64}$/);
  assert.match(expectedRightRoot, /^sha256:[0-9a-f]{64}$/);
  const evidence = JSON.parse(fs.readFileSync(EVIDENCE, 'utf8'));
  assert.equal(evidence.reportRoot, evidenceRoot({ ...evidence, reportRoot: undefined }));
  assert.equal(evidence.k400.matrixAfter, '23 PASS / 0 BLOCKED / 377 UNTESTED');
  assert.equal(evidence.k400.verdict, 'INCOMPLETE');
});

test('K14 real AMD session elides repeated input transfers while preserving output roots', () => {
  const run = executeProbe(probeRequest);
  if (run.status !== 0) {
    assert.equal(unavailable(run.value.code), true, JSON.stringify(run.value));
    return;
  }
  assert.equal(run.value.status, 'PASS_LOCAL_OPENCL_TENSOR_VALUE_RESIDENCY_CANDIDATE');
  assert.equal(run.value.canonicalOwner, 'RCL');
  assert.equal(run.value.closed, true);
  assert.equal(run.value.telemetry.tensorValueResidency, true);
  assert.equal(run.value.telemetry.tensorBindCount, 2);
  assert.equal(run.value.telemetry.tensorResidencyHitCount, 2);
  assert.equal(run.value.telemetry.tensorReplacementCount, 0);
  assert.equal(run.value.telemetry.tensorHostToDeviceTransfers, 2);
  assert.equal(run.value.telemetry.tensorDeviceToHostTransfers, 2);
  assert.equal(run.value.telemetry.residentTensorCount, 0);
  assert.equal(run.value.telemetry.residentBytes, 0);
  assert.equal(run.value.telemetry.maxResidentTensors, 64);
  assert.equal(run.value.telemetry.maxResidentBytes, 2 * 1024 * 1024);
  assert.equal(run.value.telemetry.tensorReleaseCount, 2);
  assert.equal(run.value.telemetry.bufferAllocationCount, 4);
  assert.equal(run.value.telemetry.bufferReleaseCount, 4);
  assert.equal(run.value.telemetry.bufferAllocationBytes, 12);
  const bindings = run.value.operations.filter((operation) => operation.operation === 'bind');
  assert.deepEqual(bindings.map((operation) => operation.transfer), ['uploaded', 'uploaded', 'elided', 'elided']);
  const matmuls = run.value.operations.filter((operation) => operation.operation === 'matmul');
  assert.equal(matmuls.length, 2);
  assert.deepEqual(matmuls.map((operation) => operation.outputBits), [['4130'], ['4130']]);
  assert.ok(matmuls.every((operation) => /^[0-9a-f]{64}$/.test(operation.executionRoot)));
  assert.notEqual(matmuls[0].executionRoot, matmuls[1].executionRoot);
  if (process.env.RCL_K14_EVIDENCE === '1') {
    console.log(`K14_EVIDENCE ${JSON.stringify({
      device: run.value.device,
      bindings: bindings.map((operation) => operation.transfer),
      matmulOutputBits: matmuls.map((operation) => operation.outputBits),
      executionRoots: matmuls.map((operation) => operation.executionRoot),
      telemetry: run.value.telemetry,
      exactOutputParity: true,
    })}`);
  }
});

test('K14 changed valueRoot fails closed and unknown mode cannot open a session', () => {
  const stale = tensor('left', 'storage:left', ['4000', '4040'], left.shape);
  const bind = {
    format: 'rcl.opencl-amd-tensor-residency-request.v0.1',
    backend: 'opencl-amd',
    operation: 'bind',
    tensorIdentity: left.storageIdentity,
    valueRoot: valueRoot(left.dtype, left.shape, left.bits),
    dtype: left.dtype,
    shape: left.shape,
    access: 'read-only',
    bits: left.bits,
  };
  const staleBind = {
    ...bind,
    valueRoot: valueRoot(stale.dtype, stale.shape, stale.bits),
    bits: stale.bits,
  };
  const close = { format: 'rcl.opencl-amd-session-close-request.v0.1', backend: 'opencl-amd' };
  const responses = runProviderSession('tensor-residency-v0.1', [bind, staleBind, close]);
  if (responses[0]?.status === 'error') {
    assert.equal(unavailable(responses[0].code), true, JSON.stringify(responses));
  } else {
    assert.equal(responses[1].status, 'error');
    assert.equal(responses[1].code, 'RCL_OPENCL_TENSOR_VALUE_STALE');
    assert.equal(responses[2].closed, true);
    assert.equal(responses[2].sessionStats.residentTensorCount, 0);
    assert.equal(responses[2].sessionStats.tensorReleaseCount, 1);
  }

  const unsupported = runProviderSession('tensor-residency-unbounded', [bind]);
  assert.equal(unsupported[0].status, 'error');
  assert.equal(unsupported[0].code, 'RCL_OPENCL_BUFFER_ALLOCATION_MODE_UNSUPPORTED');
});
