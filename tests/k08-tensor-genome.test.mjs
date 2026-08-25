import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { compileRealityToBytecode } from '../src/bytecode.mjs';
import { runNativeBytecode, runNativeCompiler } from '../src/native-vm.mjs';

const sourcePath = path.resolve('examples/native-ai/tensor-genome.rcl');

test('K08-C Tensor candidate executes bounded canonical tensor semantics through native RCL', { timeout: 120_000 }, () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-k08-tensor-genome-'));
  const rbcPath = path.join(directory, 'tensor-genome.rbc');
  const compile = runNativeCompiler('selfhost/compiler.rbc', sourcePath, rbcPath, {
    timeout: 120_000,
    maxBuffer: 64 * 1024 * 1024,
  });
  const nativeRbc = fs.readFileSync(rbcPath);
  const referenceRbc = Buffer.from(compileRealityToBytecode(fs.readFileSync(sourcePath, 'utf8')));
  assert.equal(compile.status, 'ok');
  assert.equal(nativeRbc.equals(referenceRbc), true, 'native self-host and JS bootstrap RBC must match');

  const replays = Array.from({ length: 3 }, () => runNativeBytecode(rbcPath, {
    timeout: 120_000,
    maxBuffer: 64 * 1024 * 1024,
    requireNativeStateRoot: true,
  }));
  assert.equal(new Set(replays.map((replay) => replay.semanticStateRoot)).size, 1);
  assert.equal(replays.every((replay) => replay.stateRootVerified), true);
  const state = replays[0].state;

  assert.deepEqual(state['tensor.scalar'][1], []);
  assert.deepEqual(state['tensor.a'][1], [2, 3]);
  assert.deepEqual(state['tensor.a'][3], [3, 1]);
  assert.deepEqual(state['tensor.broadcast_add'][7], [11, 22, 33, 14, 25, 36]);
  assert.deepEqual(state['tensor.broadcast_sub'][7], [-9, -18, -27, -6, -15, -24]);
  assert.deepEqual(state['tensor.broadcast_mul'][7], [10, 40, 90, 40, 100, 180]);
  assert.deepEqual(state['tensor.broadcast_div'][7], [0.1, 0.1, 0.1, 0.4, 0.25, 0.2]);
  assert.deepEqual(state['tensor.matmul'][7], [58, 64, 139, 154]);
  assert.deepEqual(state['tensor.reshape'][7], [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(state['tensor.transpose'][7], [1, 4, 2, 5, 3, 6]);
  assert.deepEqual(state['tensor.reduce_axis0'][7], [5, 7, 9]);
  assert.deepEqual(state['tensor.reduce_axis1'][7], [6, 15]);
  assert.deepEqual(state['tensor.reduce_mean_axis0'][7], [2.5, 3.5, 4.5]);
  assert.deepEqual(state['tensor.reduce_mean_axis1'][7], [2, 5]);
  assert.deepEqual(state['tensor.reduce_max_axis0'][7], [4, 5, 6]);
  assert.deepEqual(state['tensor.reduce_max_axis1'][7], [3, 6]);
  assert.deepEqual(state['tensor.exp'][7], [1, 2.71828182845905]);
  assert.deepEqual(state['tensor.log'][7], [0, 1.38629436111989, 2.1972245773142]);
  assert.deepEqual(state['tensor.sqrt'][7], [1, 2, 3]);
  for (const row of [state['tensor.softmax'][7].slice(0, 3), state['tensor.softmax'][7].slice(3)]) {
    assert.ok(Math.abs(row.reduce((sum, value) => sum + value, 0) - 1) < 1e-12);
    assert.ok(row[0] < row[1] && row[1] < row[2]);
  }
  assert.deepEqual(state['tensor.slice'][7], [2, 3, 5, 6]);
  for (const key of [
    'evaluation.scalar_valid',
    'evaluation.tensor_valid',
    'evaluation.broadcast_valid',
    'evaluation.invalid_broadcast_rejected',
    'evaluation.dtype_mismatch_rejected',
    'evaluation.device_mismatch_rejected',
    'evaluation.broadcast_div_valid',
    'evaluation.matmul_valid',
    'evaluation.invalid_matmul_rejected',
    'evaluation.reshape_valid',
    'evaluation.invalid_reshape_rejected',
    'evaluation.slice_valid',
    'evaluation.invalid_slice_rejected',
  ]) assert.equal(state[key], true, key);
});
