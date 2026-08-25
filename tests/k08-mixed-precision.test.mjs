import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { compileRealityToBytecode } from '../src/bytecode.mjs';
import { runNativeBytecode, runNativeCompiler } from '../src/native-vm.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST = path.join(ROOT, 'native', 'tensor-engine', 'Cargo.toml');
const ENGINE = path.join(ROOT, 'native', 'tensor-engine', 'target', 'release', process.platform === 'win32' ? 'rcl-mixed-precision.exe' : 'rcl-mixed-precision');
const SOURCE = path.join(ROOT, 'examples', 'native-ai', 'mixed-precision-genome.rcl');
const CONTRACT = path.join(ROOT, 'examples', 'native-ai', 'mixed-precision-contract.v0.1.json');

function buildEngine() {
  const run = spawnSync('cargo', ['build', '--release', '--locked', '--manifest-path', MANIFEST, '--bin', 'rcl-mixed-precision'], {
    cwd: ROOT, encoding: 'utf8', timeout: 180_000, maxBuffer: 32 * 1024 * 1024,
  });
  if (run.status !== 0) throw new Error(run.stderr || run.stdout || 'RCL_K08_Q_BUILD_FAILED');
}

function execute(request, expectSuccess = true) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-k08-q-'));
  const requestPath = path.join(directory, 'request.json');
  fs.writeFileSync(requestPath, JSON.stringify(request));
  const run = spawnSync(ENGINE, [requestPath], { cwd: ROOT, encoding: 'utf8', timeout: 60_000, maxBuffer: 16 * 1024 * 1024 });
  fs.rmSync(directory, { recursive: true, force: true });
  if (run.error) throw run.error;
  if ((run.status === 0) !== expectSuccess) throw new Error(run.stderr || run.stdout || 'RCL_K08_Q_EXECUTION_STATUS');
  return JSON.parse((expectSuccess ? run.stdout : run.stderr).trim());
}

const view = new DataView(new ArrayBuffer(4));
function numberFromF32Bits(bits) { view.setUint32(0, bits >>> 0, false); return view.getFloat32(0, false); }
function f32Bits(value) { view.setFloat32(0, Math.fround(value), false); return view.getUint32(0, false); }
function bf16Bits(value) {
  const bits = f32Bits(value);
  const lsb = (bits >>> 16) & 1;
  return ((bits + 0x7fff + lsb) >>> 16) & 0xffff;
}
function bf16ValueFromBits(bits) { return numberFromF32Bits((bits & 0xffff) << 16); }
function quantize(value) { const bits = bf16Bits(value); return { bits, value: bf16ValueFromBits(bits) }; }
function hex16(value) { return value.toString(16).padStart(4, '0'); }

function matmulF64(a, m, k, b, n) {
  const out = new Array(m * n).fill(0);
  for (let row = 0; row < m; row += 1) for (let inner = 0; inner < k; inner += 1) for (let col = 0; col < n; col += 1) out[row * n + col] += a[row * k + inner] * b[inner * n + col];
  return out;
}

function bf16MatmulOracle(a, m, k, b, n) {
  const qa = a.map((value) => quantize(value).value);
  const qb = b.map((value) => quantize(value).value);
  const bits = [];
  for (let row = 0; row < m; row += 1) {
    for (let col = 0; col < n; col += 1) {
      let sum = Math.fround(0);
      for (let inner = 0; inner < k; inner += 1) {
        const product = Math.fround(Math.fround(qa[row * k + inner]) * Math.fround(qb[inner * n + col]));
        sum = Math.fround(sum + product);
      }
      bits.push(bf16Bits(sum));
    }
  }
  return { bits, data: bits.map(bf16ValueFromBits) };
}

function bf16ElementwiseOracle(operation, left, right) {
  const bits = left.map((value, index) => {
    const a = Math.fround(quantize(value).value); const b = Math.fround(quantize(right[index]).value);
    const result = operation === 'add' ? Math.fround(a + b) : Math.fround(a * b);
    return bf16Bits(result);
  });
  return { bits, data: bits.map(bf16ValueFromBits) };
}

const LEFT = [
  0.125, -0.75, 1.5,
  2.25, 0.33, -1.125,
];
const RIGHT = [
  0.5, -1.0,
  1.25, 0.75,
  -0.25, 2.0,
];

let known;
let matmul;

test.before(() => {
  buildEngine();
  known = execute({ format: 'rcl.mixed-precision-request.v0.1', backend: 'cpu-reference', operation: 'quantize', shape: [4], values: [1, -2, 0, Math.PI] });
  matmul = execute({
    format: 'rcl.mixed-precision-request.v0.1', backend: 'cpu-reference', operation: 'matmul',
    left: { shape: [2, 3], data: LEFT }, right: { shape: [3, 2], data: RIGHT },
  });
});

test('K08-Q RCL mixed-precision genome self-hosts with byte-identical RBC and native semantic root', { timeout: 180_000 }, () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-k08-q-source-')); const rbc = path.join(directory, 'mixed.rbc');
  const compiled = runNativeCompiler('selfhost/compiler.rbc', SOURCE, rbc, { timeout: 120_000, maxBuffer: 64 * 1024 * 1024 }); assert.equal(compiled.status, 'ok');
  assert.equal(fs.readFileSync(rbc).equals(Buffer.from(compileRealityToBytecode(fs.readFileSync(SOURCE, 'utf8')))), true);
  const run = runNativeBytecode(rbc, { timeout: 120_000, maxBuffer: 64 * 1024 * 1024, requireNativeStateRoot: true });
  assert.equal(run.stateRootVerified, true); assert.equal(run.state['evaluation.hidden_2048_valid'], true); assert.equal(run.state['evaluation.rcl1b_geometry_valid'], true); assert.equal(run.state['evaluation.gpu_claim_closed'], true);
  fs.rmSync(directory, { recursive: true, force: true });
});

test('K08-Q known BF16 bit patterns and dequantized values are exact', () => {
  assert.deepEqual(known.tensor.bitsHex, ['3f80', 'c000', '0000', '4049']);
  assert.deepEqual(known.tensor.data, [1, -2, 0, 3.140625]);
  assert.equal(known.tensor.dtype, 'bf16'); assert.equal(known.tensor.accumulationDtype, 'f32'); assert.equal(known.gpuClaim, false);
});

test('K08-Q BF16 conversion uses round-to-nearest ties-to-even', () => {
  const evenTie = numberFromF32Bits(0x3f808000);
  const oddTie = numberFromF32Bits(0x3f818000);
  const result = execute({ format: 'rcl.mixed-precision-request.v0.1', backend: 'cpu-reference', operation: 'quantize', values: [evenTie, oddTie], shape: [2] });
  assert.deepEqual(result.tensor.bitsHex, ['3f80', '3f82']);
});

test('K08-Q deterministic BF16 storage identity roots exact bit payload and shape', () => {
  const again = execute({ format: 'rcl.mixed-precision-request.v0.1', backend: 'cpu-reference', operation: 'quantize', shape: [4], values: [1, -2, 0, Math.PI] });
  assert.equal(again.tensor.storageRoot, known.tensor.storageRoot);
  assert.deepEqual(again.tensor.bitsHex, known.tensor.bitsHex);
  const reshaped = execute({ format: 'rcl.mixed-precision-request.v0.1', backend: 'cpu-reference', operation: 'quantize', shape: [2, 2], values: [1, -2, 0, Math.PI] });
  assert.notEqual(reshaped.tensor.storageRoot, known.tensor.storageRoot);
});

test('K08-Q BF16 matmul with FP32 accumulation matches independent bit-level oracle', () => {
  const expected = bf16MatmulOracle(LEFT, 2, 3, RIGHT, 2);
  assert.deepEqual(matmul.tensor.bitsHex, expected.bits.map(hex16));
  assert.deepEqual(matmul.tensor.data, expected.data);
  assert.deepEqual(matmul.tensor.shape, [2, 2]);
});

test('K08-Q BF16 add and mul match independent bit-level oracle', () => {
  const left = [0.1, -0.7, 3.125, 1.001]; const right = [0.2, 0.3, -0.5, 2.004];
  for (const operation of ['add', 'mul']) {
    const result = execute({
      format: 'rcl.mixed-precision-request.v0.1', backend: 'cpu-reference', operation,
      left: { shape: [2, 2], data: left }, right: { shape: [2, 2], data: right },
    });
    const expected = bf16ElementwiseOracle(operation, left, right);
    assert.deepEqual(result.tensor.bitsHex, expected.bits.map(hex16));
    assert.deepEqual(result.tensor.data, expected.data);
  }
});

test('K08-Q BF16 reference error stays bounded against f64 matmul oracle', () => {
  const reference = matmulF64(LEFT, 2, 3, RIGHT, 2);
  const maximum = reference.reduce((value, expected, index) => Math.max(value, Math.abs(expected - matmul.tensor.data[index])), 0);
  assert.ok(maximum < 0.02, `BF16 drift too large: ${maximum}`);
});

test('K08-Q invalid shapes and f32 overflow fail closed', () => {
  const badShape = execute({
    format: 'rcl.mixed-precision-request.v0.1', backend: 'cpu-reference', operation: 'matmul',
    left: { shape: [2, 2], data: [1, 2, 3, 4] }, right: { shape: [3, 1], data: [1, 2, 3] },
  }, false);
  assert.equal(badShape.code, 'RCL_MP_MATMUL_SHAPE');
  const overflow = execute({ format: 'rcl.mixed-precision-request.v0.1', backend: 'cpu-reference', operation: 'quantize', shape: [1], values: [1e40] }, false);
  assert.equal(overflow.code, 'RCL_MP_F32_OVERFLOW');
});

test('K08-Q unsupported accelerator requests fail closed and never silently fall back to CPU', () => {
  for (const backend of ['cuda', 'vulkan', 'metal']) {
    const result = execute({ format: 'rcl.mixed-precision-request.v0.1', backend, operation: 'quantize', shape: [1], values: [1] }, false);
    assert.equal(result.code, 'RCL_ACCELERATOR_BACKEND_UNAVAILABLE');
    assert.match(result.message, /silent fallback is forbidden/);
  }
});

test('K08-Q contract grants BF16 reference semantics only and keeps GPU/training/scale claims closed', () => {
  const contract = JSON.parse(fs.readFileSync(CONTRACT, 'utf8'));
  assert.equal(contract.format, 'rcl.k08-q.mixed-precision-contract.v0.1'); assert.equal(contract.canonicalOwner, 'RCL');
  for (const claim of ['BF16_CANONICAL_ROUNDING_SEMANTICS', 'BF16_CPU_REFERENCE_EXECUTION', 'FP32_ACCUMULATION_POLICY', 'NO_SILENT_ACCELERATOR_FALLBACK']) assert.ok(contract.claimsGrantedOnAdmission.includes(claim));
  for (const claim of ['GPU', 'CUDA', 'VULKAN_GPU', 'BF16_AUTODIFF_TRAINING', 'RCL_10M', 'DISTRIBUTED_TRAINING', 'RCL_1B_COMPLETE']) assert.ok(contract.claimsNotGranted.includes(claim));
});
