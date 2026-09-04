import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { compileRealityToBytecode } from '../src/bytecode.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROVIDER = path.join(ROOT, 'native', 'tensor-engine', 'amd_opencl_bf16_provider.py');
const GENOME = path.join(ROOT, 'examples', 'native-ai', 'gpu-opencl-masked-softmax-genome.rcl');
const CONTRACT = path.join(ROOT, 'examples', 'native-ai', 'gpu-opencl-masked-softmax-contract.v0.1.json');
const PYTHON = process.env.RCL_PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
const view = new DataView(new ArrayBuffer(4));

function f32(value) {
  view.setFloat32(0, value, false);
  return view.getFloat32(0, false);
}

function f32Bits(value) {
  view.setFloat32(0, f32(value), false);
  return view.getUint32(0, false);
}

function bf16Bits(value) {
  const bits = f32Bits(value);
  return ((bits + 0x7fff + ((bits >>> 16) & 1)) >>> 16) & 0xffff;
}

function bf16Value(bits) {
  view.setUint32(0, (bits & 0xffff) << 16, false);
  return view.getFloat32(0, false);
}

function bitsHex(bits) {
  return bits.toString(16).padStart(4, '0');
}

function expectedMaskedSoftmax(logitsBits, maskBits, rows, columns) {
  const output = [];
  for (let row = 0; row < rows; row += 1) {
    const combined = [];
    for (let column = 0; column < columns; column += 1) {
      combined.push(f32(bf16Value(logitsBits[row * columns + column]) + bf16Value(maskBits[row * columns + column])));
    }
    const maximum = Math.max(...combined);
    const exponentials = combined.map((value) => f32(Math.exp(value - maximum)));
    const sum = exponentials.reduce((total, value) => f32(total + value), 0);
    for (const value of exponentials) output.push(bf16Bits(f32(value / sum)));
  }
  return output.map(bitsHex);
}

const REQUEST = {
  format: 'rcl.opencl-bf16-masked-softmax-request.v0.1',
  backend: 'opencl-amd',
  operation: 'masked-softmax',
  maskMode: 'additive',
  rows: 2,
  columns: 3,
  logitsBits: ['0000', '3f80', '4000', '4000', '0000', 'bf80'],
  maskBits: ['0000', 'c1a0', 'c1a0', 'c1a0', '0000', '0000'],
};

function unavailable(code) {
  return [
    'RCL_OPENCL_BACKEND_UNAVAILABLE',
    'RCL_OPENCL_AMD_DEVICE_REQUIRED',
    'RCL_OPENCL_SYMBOL_UNAVAILABLE',
  ].includes(code);
}

function runProvider(input) {
  const run = spawnSync(PYTHON, [PROVIDER], {
    cwd: ROOT,
    input: JSON.stringify(input),
    encoding: 'utf8',
    timeout: 60_000,
    maxBuffer: 16 * 1024 * 1024,
  });
  if (run.error) throw run.error;
  const raw = (run.status === 0 ? run.stdout : run.stderr).trim();
  return { status: run.status, value: JSON.parse(raw) };
}

test('K16 masked-softmax genome and contract keep generic Tensor semantics RCL-owned', () => {
  assert.ok(compileRealityToBytecode(fs.readFileSync(GENOME, 'utf8')).length > 0);
  const contract = JSON.parse(fs.readFileSync(CONTRACT, 'utf8'));
  assert.equal(contract.status, 'OPENCL_AMD_BF16_MASKED_SOFTMAX_CANDIDATE');
  assert.equal(contract.canonicalOwner, 'RCL');
  assert.equal(contract.semanticBoundary.maskMode, 'additive');
  assert.equal(contract.semanticBoundary.computeDtype, 'f32');
  assert.equal(contract.semanticBoundary.fallback, 'forbidden');
  assert.equal(contract.shapePolicy.maskShape, 'exactly equal to logits shape');
  assert.ok(contract.claimsNotGranted.includes('GPU_TRAINING'));
  assert.ok(contract.claimsNotGranted.includes('K400_PASS'));
});

test('K16 real AMD OpenCL performs stable additive masked softmax or fails closed', () => {
  const first = runProvider(REQUEST);
  if (first.status !== 0) {
    assert.equal(unavailable(first.value.code), true, JSON.stringify(first.value));
    return;
  }
  assert.equal(first.value.format, 'rcl.opencl-bf16-masked-softmax-result.v0.1');
  assert.equal(first.value.status, 'PASS_LOCAL_GPU_MASKED_SOFTMAX_CANDIDATE');
  assert.equal(first.value.backend, 'opencl-amd');
  assert.equal(first.value.gpuExecuted, true);
  assert.equal(first.value.gpuClaim, false);
  assert.equal(first.value.maskMode, 'additive');
  assert.equal(first.value.inputDtype, 'bf16');
  assert.equal(first.value.computeDtype, 'f32');
  assert.equal(first.value.outputDtype, 'bf16');
  assert.match(first.value.device.deviceVendor, /advanced micro devices|amd/i);
  assert.deepEqual(first.value.outputBits, expectedMaskedSoftmax(
    REQUEST.logitsBits.map((bits) => Number.parseInt(bits, 16)),
    REQUEST.maskBits.map((bits) => Number.parseInt(bits, 16)),
    REQUEST.rows,
    REQUEST.columns,
  ));
  for (let row = 0; row < REQUEST.rows; row += 1) {
    const probabilities = first.value.outputData.slice(row * REQUEST.columns, (row + 1) * REQUEST.columns);
    assert.ok(Math.abs(probabilities.reduce((total, value) => total + value, 0) - 1) < 0.01);
  }
  const replay = runProvider(REQUEST);
  assert.equal(replay.status, 0);
  assert.deepEqual(replay.value.outputBits, first.value.outputBits);
  assert.equal(replay.value.executionRoot, first.value.executionRoot);
  if (process.env.RCL_K16_EVIDENCE === '1') {
    console.log(`K16_EVIDENCE ${JSON.stringify({
      device: first.value.device,
      outputBits: first.value.outputBits,
      outputData: first.value.outputData,
      executionRoot: first.value.executionRoot,
      exactCpuDifferential: true,
      deterministicReplay: true,
    })}`);
  }
});

test('K16 rejects unsupported backend, mask mode, non-finite and malformed payloads', () => {
  const wrongBackend = runProvider({ ...REQUEST, backend: 'cpu-reference' });
  assert.equal(wrongBackend.status, 1);
  assert.equal(wrongBackend.value.code, 'RCL_OPENCL_BACKEND_UNAVAILABLE');

  const wrongMode = runProvider({ ...REQUEST, maskMode: 'boolean' });
  assert.equal(wrongMode.status, 1);
  assert.equal(wrongMode.value.code, 'RCL_OPENCL_MASK_MODE');

  const nonFinite = runProvider({ ...REQUEST, logitsBits: ['7f80', ...REQUEST.logitsBits.slice(1)] });
  assert.equal(nonFinite.status, 1);
  assert.equal(nonFinite.value.code, 'RCL_OPENCL_BF16_NONFINITE');

  const malformedShape = runProvider({ ...REQUEST, maskBits: REQUEST.maskBits.slice(0, -1) });
  assert.equal(malformedShape.status, 1);
  assert.equal(malformedShape.value.code, 'RCL_OPENCL_SHAPE');
});
