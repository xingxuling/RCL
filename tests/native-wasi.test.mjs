import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { compileRealityToBytecode } from '../src/bytecode.mjs';
import { runNativeBytecode } from '../src/native-vm.mjs';
import { verifyNativeSemanticStateRoot } from '../src/semantic-state-root.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const runWasi = file => spawnSync(process.execPath,
  [path.join(ROOT, 'scripts/run-native-wasi.mjs'), path.join(ROOT, 'native/wasi/rclvm.wasm'), file],
  { encoding: 'utf8', timeout: 15_000, windowsHide: true });

test('WASI uses the native VM for typed values and transaction capture with root-v2 parity', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-wasi-parity-'));
  try {
    const file = path.join(directory, 'typed-transaction.rbc');
    fs.writeFileSync(file, compileRealityToBytecode(`reality WasiTypedTransaction {
      facet sample.text : Text = "RCL中文🧪"
      facet sample.fraction : Number = 0.1
      facet sample.large : Number = 9007199254740991
      facet sample.sequence : Sequence = sequence_append(sequence_append(empty_sequence(), -0.5), 7)
      facet sample.count : Number = 0
      subject tester { warrant write on sample }
      emergence advance {
        cause tester
        needs write on sample
        when sample.count == 0
        alter sample.count <- 1
        alter sample.count <- sample.count + 2
        preserve sample.count == 2
        witness "typed-wasi"
      }
      realize advance
    }`));
    const wasi = runWasi(file);
    assert.equal(wasi.status, 0, wasi.stderr);
    const result = verifyNativeSemanticStateRoot(JSON.parse(wasi.stdout),
      { requireNativeRoot: true, expectedAlgorithm: 'rcl.semantic-state-root.v2' });
    const native = runNativeBytecode(file, { requireNativeStateRoot: true, stateRootAlgorithm: 'rcl.semantic-state-root.v2' });
    assert.deepEqual(result.state, native.state);
    assert.equal(result.stateRoot, native.stateRoot);
    assert.equal(result.state['sample.count'], 2);
    assert.equal(result.state['sample.text'], 'RCL中文🧪');
    assert.deepEqual(result.history, native.history);
    assert.ok(result.history.length > 0);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test('WASI rejects truncated bytecode and a missing input instead of returning a PASS result', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-wasi-corrupt-'));
  try {
    const file = path.join(directory, 'corrupt.rbc');
    fs.writeFileSync(file, Buffer.from('RCLB'));
    assert.notEqual(runWasi(file).status, 0);
    assert.notEqual(runWasi(path.join(directory, 'missing.rbc')).status, 0);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
