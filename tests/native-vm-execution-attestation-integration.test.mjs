import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { runNativeBytecode } from '../src/native-vm.mjs';
import { verifyNativeVmExecutionAttestation } from '../src/native-vm-execution-attestation.mjs';

const emptyStateRoot = crypto.createHash('sha256').update('{}').digest('hex');

test('runNativeBytecode binds a successful VM result to the exact executable binary', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-native-attested-vm-'));
  try {
    const vmPath = path.join(dir, 'fake-rclvm');
    const payload = {
      vm: 'rcl-native-vm/test-probe',
      bytecodeVersion: '1.0',
      program: 'AttestedProbe',
      sourceRoot: 'attested-probe-source-root',
      stateRootAlgorithm: 'rcl.semantic-state-root.v1',
      stateRoot: emptyStateRoot,
      state: {},
      projections: [],
      history: [],
    };
    fs.writeFileSync(vmPath, `#!/bin/sh\nprintf '%s\\n' '${JSON.stringify(payload)}'\n`, { mode: 0o755 });
    const expectedBinarySha256 = crypto.createHash('sha256').update(fs.readFileSync(vmPath)).digest('hex');
    const result = runNativeBytecode(Buffer.from([82, 67, 76, 66]), { vmPath, requireNativeStateRoot: true });
    assert.equal(result.nativeVmExecutionAttestation.materialization.binarySha256, expectedBinarySha256);
    assert.equal(result.nativeVmExecutionAttestation.programSourceRoot, payload.sourceRoot);
    assert.equal(verifyNativeVmExecutionAttestation(result.nativeVmExecutionAttestation).ok, true);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
