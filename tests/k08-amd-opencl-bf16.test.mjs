import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { compileRealityToBytecode } from '../src/bytecode.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROVIDER = path.join(ROOT, 'native', 'tensor-engine', 'amd_opencl_bf16_provider.py');
const GENOME = path.join(ROOT, 'examples', 'native-ai', 'opencl-bf16-matmul-genome.rcl');
const CONTRACT = path.join(ROOT, 'examples', 'native-ai', 'opencl-bf16-matmul-contract.v0.1.json');
const PYTHON = process.platform === 'win32' ? 'python' : 'python3';
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
  view.setUint32(0, bits << 16, false);
  return view.getFloat32(0, false);
}

function bitsHex(bits) {
  return bits.toString(16).padStart(4, '0');
}

function expectedMatmul(leftBits, rightBits, rows, columns, shared) {
  const output = [];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      let accumulator = f32(0);
      for (let inner = 0; inner < shared; inner += 1) {
        const product = f32(bf16Value(leftBits[row * shared + inner]) * bf16Value(rightBits[inner * columns + column]));
        accumulator = f32(accumulator + product);
      }
      output.push(bf16Bits(accumulator));
    }
  }
  return output.map(bitsHex);
}

function request() {
  return {
    format: 'rcl.opencl-bf16-matmul-request.v0.1',
    backend: 'opencl-amd',
    rows: 2,
    columns: 2,
    shared: 3,
    leftBits: ['3f80', '4000', '4040', '4080', '40a0', '40c0'],
    rightBits: ['3f80', '3f00', 'bf80', '4000', '4040', 'c000'],
  };
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

test('K08 AMD OpenCL BF16 genome and contract remain RCL-owned', () => {
  const source = fs.readFileSync(GENOME, 'utf8');
  const contract = JSON.parse(fs.readFileSync(CONTRACT, 'utf8'));
  assert.ok(compileRealityToBytecode(source).length > 0);
  assert.equal(contract.canonicalOwner, 'RCL');
  assert.equal(contract.lowering.semanticOwner, 'RCL');
  assert.equal(contract.lowering.fallback, 'forbidden');
  assert.equal(contract.shapePolicy.modelSpecialOpcodes, false);
  assert.ok(contract.claimsNotGranted.includes('GPU_TRAINING'));
});

test('K08 AMD OpenCL BF16 provider executes on a real AMD device or fails closed', () => {
  assert.equal(fs.existsSync(PROVIDER), true);
  const first = runProvider(request());
  if (first.status !== 0) {
    assert.ok(
      ['RCL_OPENCL_BACKEND_UNAVAILABLE', 'RCL_OPENCL_AMD_DEVICE_REQUIRED'].includes(first.value.code),
      JSON.stringify(first.value),
    );
    return;
  }
  assert.equal(first.value.format, 'rcl.opencl-bf16-matmul-result.v0.1');
  assert.equal(first.value.status, 'PASS_LOCAL_GPU_REFERENCE_CANDIDATE');
  assert.equal(first.value.backend, 'opencl-amd');
  assert.equal(first.value.gpuExecuted, true);
  assert.equal(first.value.gpuClaim, false);
  assert.match(first.value.device.deviceVendor, /advanced micro devices|amd/i);
  assert.deepEqual(first.value.outputBits, expectedMatmul(
    request().leftBits.map((bits) => Number.parseInt(bits, 16)),
    request().rightBits.map((bits) => Number.parseInt(bits, 16)),
    2,
    2,
    3,
  ));
  const replay = runProvider(request());
  assert.equal(replay.status, 0);
  assert.deepEqual(replay.value.outputBits, first.value.outputBits);
  assert.equal(replay.value.executionRoot, first.value.executionRoot);
});

test('K08 AMD OpenCL provider rejects unsupported backend and malformed BF16 input', () => {
  const wrongBackend = runProvider({ ...request(), backend: 'cpu-reference' });
  assert.equal(wrongBackend.status, 1);
  assert.equal(wrongBackend.value.code, 'RCL_OPENCL_BACKEND_UNAVAILABLE');

  const nonFinite = runProvider({ ...request(), leftBits: ['7f80', '4000', '4040', '4080', '40a0', '40c0'] });
  assert.equal(nonFinite.status, 1);
  assert.equal(nonFinite.value.code, 'RCL_OPENCL_BF16_NONFINITE');

  const malformedBits = runProvider({ ...request(), rightBits: ['3F80', '3f00', 'bf80', '4000', '4040', 'c000'] });
  assert.equal(malformedBits.status, 1);
  assert.equal(malformedBits.value.code, 'RCL_OPENCL_BF16_BITS');

  const malformedShape = runProvider({ ...request(), leftBits: request().leftBits.slice(0, 5) });
  assert.equal(malformedShape.status, 1);
  assert.equal(malformedShape.value.code, 'RCL_OPENCL_SHAPE');
});
