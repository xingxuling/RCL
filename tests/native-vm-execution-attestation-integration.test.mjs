import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { DEFAULT_NATIVE_VM_PATH, runNativeBytecode } from '../src/native-vm.mjs';
import { assembleLiteralProgram } from '../src/bytecode.mjs';
import { verifyNativeVmExecutionAttestation } from '../src/native-vm-execution-attestation.mjs';

test('runNativeBytecode binds a successful VM result to the exact external executable binary', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-native-attested-vm-'));
  try {
    const vmPath = path.join(dir, process.platform === 'win32' ? 'rclvm.exe' : 'rclvm');
    fs.copyFileSync(DEFAULT_NATIVE_VM_PATH, vmPath);
    fs.chmodSync(vmPath, 0o755);
    const expectedBinarySha256 = crypto.createHash('sha256').update(fs.readFileSync(vmPath)).digest('hex');
    const bytecode = assembleLiteralProgram({ path: 'probe', value: 17 });
    const result = runNativeBytecode(bytecode, { vmPath, requireNativeStateRoot: true });
    assert.equal(result.state.probe, 17);
    assert.equal(result.nativeVmExecutionAttestation.materialization.binarySha256, expectedBinarySha256);
    assert.equal(result.nativeVmExecutionAttestation.programSourceRoot, result.sourceRoot);
    assert.equal(verifyNativeVmExecutionAttestation(result.nativeVmExecutionAttestation).ok, true);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
