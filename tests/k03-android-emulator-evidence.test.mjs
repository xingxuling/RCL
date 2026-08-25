import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { evidenceRoot } from '../src/universal-program-stress.mjs';
import { verifyK03AndroidEmulatorEvidence } from '../scripts/verify-k03-android-emulator-evidence.mjs';

test('K03 Android emulator receipt binds install, transactions, lifecycle and bounded performance', () => {
  const result = verifyK03AndroidEmulatorEvidence();
  assert.equal(result.admitted, true);
  assert.equal(result.device.avdName, 'Rcl_Aether_API35_ATD');
  assert.equal(result.device.apiLevel, 35);
  assert.equal(result.performance.samples.length, 5);
  assert.ok(result.performance.p95Ms <= result.performance.interactionBudgetMs);
});

test('K03 Android emulator receipt rejects a rooted failed lifecycle claim', () => {
  const source = JSON.parse(fs.readFileSync('examples/universal-stress/evidence/k03-android-emulator-v0.1.json', 'utf8'));
  const invalid = structuredClone(source);
  invalid.runtime.lifecycleRestoreAfterRotation = 'FAIL';
  invalid.gates.CORRECT = 'FAIL';
  invalid.status = 'FAIL';
  invalid.reportRoot = evidenceRoot({ ...invalid, generatedAt: undefined, reportRoot: undefined });
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-k03-emulator-negative-'));
  try {
    const evidencePath = path.join(directory, 'receipt.json');
    fs.writeFileSync(evidencePath, `${JSON.stringify(invalid, null, 2)}\n`, 'utf8');
    assert.equal(verifyK03AndroidEmulatorEvidence({ evidencePath }).admitted, false);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
