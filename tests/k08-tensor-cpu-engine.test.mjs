import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import { compileRealityToBytecode } from '../src/bytecode.mjs';
import { compileTypedRealityToBytecodeLayout } from '../src/typed-bytecode-layout.mjs';
import { runNativeBytecode, runNativeCompiler } from '../src/native-vm.mjs';

const root = path.resolve('.');
const manifestPath = path.join(root, 'native', 'tensor-engine', 'Cargo.toml');
const binaryPath = path.join(root, 'native', 'tensor-engine', 'target', 'release', process.platform === 'win32' ? 'rcl-tensor-engine.exe' : 'rcl-tensor-engine');

function buildEngine() {
  const build = spawnSync('cargo', ['build', '--release', '--manifest-path', manifestPath, '--offline'], {
    cwd: root,
    encoding: 'utf8',
    timeout: 120_000,
    maxBuffer: 16 * 1024 * 1024,
  });
  assert.equal(build.status, 0, build.stderr || build.stdout);
}

function descriptor(id, shape, storageIdentity, overrides = {}) {
  return {
    id,
    shape,
    dtype: 'f64',
    layout: 'row-major',
    device: 'cpu',
    gradientIdentity: `parameter:${id}`,
    storageIdentity,
    ...overrides,
  };
}

function request(operation, tensors, storages, attributes = {}) {
  return { format: 'rcl.tensor-execution-request.v0.1', operation, tensors, storages, attributes };
}

function executeEngine(payload, expectSuccess = true) {
  const run = spawnSync(binaryPath, ['execute', '-'], {
    cwd: root,
    input: JSON.stringify(payload),
    encoding: 'utf8',
    timeout: 120_000,
    maxBuffer: 64 * 1024 * 1024,
  });
  assert.equal(run.status === 0, expectSuccess, run.stderr || run.stdout);
  return JSON.parse((expectSuccess ? run.stdout : run.stderr).trim());
}

function sha256(value) {
  return crypto.createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value)).digest('hex');
}

function artifactHash(relativePaths) {
  const hash = crypto.createHash('sha256');
  for (const relativePath of relativePaths) {
    hash.update(relativePath);
    hash.update('\0');
    hash.update(fs.readFileSync(path.join(root, relativePath)));
    hash.update('\0');
  }
  return hash.digest('hex');
}

test('K08-C canonical Tensor is a typed RCL object with separate replaceable Storage identity', () => {
  const source = fs.readFileSync(path.join(root, 'examples', 'native-ai', 'tensor-object.rcl'), 'utf8');
  const typeModuleSources = {
    'tensor.rcltype': fs.readFileSync(path.join(root, 'examples', 'native-ai', 'types', 'tensor.rcltype'), 'utf8'),
  };
  const compilation = compileTypedRealityToBytecodeLayout(source, { typeModuleSources });
  const native = runNativeBytecode(compilation.bytecode, { requireNativeStateRoot: true });
  assert.equal(compilation.layout.typedInstructionCount, 2);
  assert.equal(native.state['tensor.a'].__rclKind, 'Record');
  assert.equal(native.state['tensor.a'].__rclType, 'tensor::Tensor');
  assert.equal(native.state['tensor.a'].storageIdentity, native.state['storage.a'].identity);
  assert.equal(Object.hasOwn(native.state['tensor.a'], 'data'), false);
  assert.equal(native.state['contract.tensor_is_sequence'], false);
  assert.equal(native.state['contract.storage_is_replaceable'], true);
});

test('K08-C evidence root binds the current Tensor semantics, provider and Rust backend sources', () => {
  const evidence = JSON.parse(fs.readFileSync(path.join(root, 'examples', 'native-ai', 'evidence', 'tensor-cpu-v0.1', 'k08-c-tensor-cpu-evidence.json'), 'utf8'));
  const reportRoot = evidence.reportRoot;
  delete evidence.reportRoot;
  assert.equal(sha256(evidence), reportRoot);
  const contract = JSON.parse(fs.readFileSync(path.join(root, 'examples', 'native-ai', 'tensor-genome-contract.v0.1.json'), 'utf8'));
  assert.equal(contract.evidence.reportRoot, reportRoot);
  delete contract.evidence.reportRoot;
  assert.equal(evidence.artifactHashes.tensorContract, sha256(contract));
  assert.equal(evidence.artifactHashes.tensorSemantics, artifactHash(['examples/native-ai/tensor-genome.rcl', 'examples/native-ai/tensor-object.rcl', 'examples/native-ai/types/tensor.rcltype']));
  assert.equal(evidence.artifactHashes.providerBoundary, artifactHash(['examples/native-ai/tensor-cpu-provider.rcl', 'examples/native-ai/tensor-cpu-request.v0.1.json']));
  assert.equal(evidence.artifactHashes.rustBackend, artifactHash(['native/tensor-engine/Cargo.toml', 'native/tensor-engine/Cargo.lock', 'native/tensor-engine/src/lib.rs', 'native/tensor-engine/src/main.rs', 'native/tensor-engine/src/rclvm_provider.rs']));
});

test('K08-C GitHub replay receipt binds the exact implementation and local evidence root', () => {
  const receipt = JSON.parse(fs.readFileSync(path.join(root, 'examples', 'native-ai', 'evidence', 'tensor-cpu-v0.1', 'github-replay.json'), 'utf8'));
  const authorityRoot = receipt.authorityRoot;
  delete receipt.authorityRoot;
  assert.equal(sha256(receipt), authorityRoot);
  assert.equal(receipt.status, 'PASS_GITHUB_HOSTED_REPLAY_BOUND');
  assert.equal(receipt.sourceCommit, 'e5c3124bb759e5d5c2ec8bbf3e668aabc6a0b080');
  assert.equal(receipt.runId, 32804405376);
  assert.equal(receipt.runConclusion, 'success');
  assert.deepEqual(receipt.jobs.map(({ platform, conclusion }) => [platform, conclusion]), [
    ['ubuntu-latest', 'success'],
    ['windows-latest', 'success'],
  ]);
  const evidence = JSON.parse(fs.readFileSync(path.join(root, 'examples', 'native-ai', 'evidence', 'tensor-cpu-v0.1', 'k08-c-tensor-cpu-evidence.json'), 'utf8'));
  assert.equal(receipt.localEvidenceReportRoot, evidence.reportRoot);
  assert.ok(receipt.claimsNotGranted.includes('K400_PASS'));
  assert.ok(receipt.claimsNotGranted.includes('GENERAL_MLP_118X_GAP_CLOSED'));
});

test('K08-C optimized CPU backend covers Tensor kernel set and fails closed', { timeout: 180_000 }, () => {
  buildEngine();
  const a = descriptor('a', [2, 3], 'storage:a');
  const row = descriptor('row', [1, 3], 'storage:row');
  const storageA = { identity: 'storage:a', kind: 'cpu-dense', data: [1, 2, 3, 4, 5, 6] };
  const storageRow = { identity: 'storage:row', kind: 'cpu-dense', data: [10, 20, 30] };

  assert.deepEqual(executeEngine(request('add', [a, row], [storageA, storageRow])).storage.data, [11, 22, 33, 14, 25, 36]);
  assert.deepEqual(executeEngine(request('sub', [a, row], [storageA, storageRow])).storage.data, [-9, -18, -27, -6, -15, -24]);
  assert.deepEqual(executeEngine(request('mul', [a, row], [storageA, storageRow])).storage.data, [10, 40, 90, 40, 100, 180]);
  assert.deepEqual(executeEngine(request('div', [a, row], [storageA, storageRow])).storage.data, [0.1, 0.1, 0.1, 0.4, 0.25, 0.2]);

  for (const [operation, expected] of [['sum', [6, 15]], ['mean', [2, 5]], ['max', [3, 6]]]) {
    assert.deepEqual(executeEngine(request(operation, [a], [storageA], { axis: 1 })).storage.data, expected);
  }
  assert.deepEqual(executeEngine(request('sqrt', [a], [storageA])).storage.data, [1, Math.sqrt(2), Math.sqrt(3), 2, Math.sqrt(5), Math.sqrt(6)]);
  const exp = executeEngine(request('exp', [a], [storageA])).storage.data;
  const logged = executeEngine(request('log', [a], [storageA])).storage.data;
  assert.ok(exp.every((value, index) => Math.abs(value - Math.exp(storageA.data[index])) < 1e-12));
  assert.ok(logged.every((value, index) => Math.abs(value - Math.log(storageA.data[index])) < 1e-12));

  const softmax = executeEngine(request('softmax', [a], [storageA])).storage.data;
  for (const values of [softmax.slice(0, 3), softmax.slice(3)]) assert.ok(Math.abs(values.reduce((sum, value) => sum + value, 0) - 1) < 1e-12);
  for (const operation of ['layer-norm', 'rms-norm']) {
    const result = executeEngine(request(operation, [a], [storageA], { epsilon: 1e-5 }));
    assert.equal(result.storage.data.length, 6);
    assert.ok(result.storage.data.every(Number.isFinite));
  }

  const invalidShape = executeEngine(request('matmul', [a, descriptor('bad', [2, 2], 'storage:bad')], [storageA, { identity: 'storage:bad', kind: 'cpu-dense', data: [1, 2, 3, 4] }]), false);
  assert.equal(invalidShape.code, 'RCL_TENSOR_MATMUL_SHAPE');
  const dtypeMismatch = executeEngine(request('add', [a, descriptor('f32', [2, 3], 'storage:f32', { dtype: 'f32' })], [storageA, { identity: 'storage:f32', kind: 'cpu-dense', data: [1, 2, 3, 4, 5, 6] }]), false);
  assert.equal(dtypeMismatch.code, 'RCL_TENSOR_DTYPE_MISMATCH');
  const deviceMismatch = executeEngine(request('add', [a, descriptor('gpu', [2, 3], 'storage:gpu', { device: 'gpu:0' })], [storageA, { identity: 'storage:gpu', kind: 'cpu-dense', data: [1, 2, 3, 4, 5, 6] }]), false);
  assert.equal(deviceMismatch.code, 'RCL_TENSOR_DEVICE_MISMATCH');
});

test('K08-C RCL provider lowering reaches the Rust CPU backend through native VM', { timeout: 180_000, skip: process.platform !== 'win32' }, () => {
  buildEngine();
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-tensor-provider-'));
  const rbcPath = path.join(directory, 'tensor-provider.rbc');
  const sourcePath = path.join(root, 'examples', 'native-ai', 'tensor-cpu-provider.rcl');
  const compile = runNativeCompiler(path.join(root, 'selfhost', 'compiler.rbc'), sourcePath, rbcPath, { timeout: 120_000, maxBuffer: 64 * 1024 * 1024 });
  const referenceRbc = Buffer.from(compileRealityToBytecode(fs.readFileSync(sourcePath, 'utf8')));
  assert.equal(fs.readFileSync(rbcPath).equals(referenceRbc), true);
  const run = spawnSync(binaryPath, ['run-rbc', rbcPath, path.join(root, 'native', 'rclvm.dll')], { cwd: root, encoding: 'utf8', timeout: 120_000, maxBuffer: 64 * 1024 * 1024 });
  assert.equal(run.status, 0, run.stderr);
  const native = JSON.parse(run.stdout);
  const result = JSON.parse(native.state['tensor.matmul_result']);
  assert.deepEqual(result.storage.data, [58, 64, 139, 154]);
  assert.equal(result.tensor.storageIdentity, result.storage.identity);
  assert.equal(result.telemetry.backend, 'rcl-tensor-cpu-rust-v0.1');
  assert.equal(native.metrics.instructions, 16);
});
