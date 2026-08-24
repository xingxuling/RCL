import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { sha256 } from '../src/reality-compiler-kernel.mjs';
import {
  buildCalibrationReceipt,
  buildInstrumentBindingContract,
  validateInstrumentBindingContract,
  buildRawAcquisitionTemplate,
  validateCompletedRawAcquisition,
  exportInstrumentBindingBundle,
} from '../src/frontier-instrument-binding-contract.mjs';

function validBundle() {
  const calibration = buildCalibrationReceipt({
    status: 'valid',
    instrumentId: 'sensor-demo-001',
    referenceId: 'traceable-reference-001',
    measuredAt: '2026-08-11T00:00:00.000Z',
    method: 'known-reference-zero-and-span-check',
    tolerance: 0.01,
    unit: 'arb',
    rawCalibrationRoot: 'calibration_raw_root_demo',
  });
  return buildInstrumentBindingContract({
    instrument: {
      instrumentId: 'sensor-demo-001',
      sensorType: 'passive_scalar_sensor',
      unit: 'arb',
      deviceFingerprint: 'device-fingerprint-demo-001',
      passiveMeasurementOnly: true,
      exportFormat: 'json',
    },
    calibration,
  });
}

test('valid passive instrument + calibration produces bound but disarmed contract', () => {
  const b = validBundle();
  const v = validateInstrumentBindingContract(b);
  assert.equal(v.ok, true);
  assert.equal(b.contract.bindingStatus, 'BOUND_CALIBRATED');
  assert.equal(b.contract.unknownAcquisitionArmed, false);
});

test('invalid calibration blocks instrument binding', () => {
  const b = buildInstrumentBindingContract({
    instrument: { instrumentId: 'x', sensorType: 'passive', unit: 'u', deviceFingerprint: 'fp' },
    calibration: { status: 'invalid' },
  });
  const v = validateInstrumentBindingContract(b);
  assert.equal(v.ok, false);
  assert.ok(v.failures.some((x) => x.startsWith('calibration:')));
});

test('raw template mirrors all 96 schedule slots without semantic labels', () => {
  const b = validBundle();
  const raw = buildRawAcquisitionTemplate(b);
  assert.equal(raw.rows.length, 96);
  for (const row of raw.rows) {
    assert.equal('symbolCondition' in row, false);
    assert.equal('spatialContext' in row, false);
  }
});

test('completed raw acquisition validates only after timestamps and numeric responses are filled', () => {
  const b = validBundle();
  const raw = buildRawAcquisitionTemplate(b);
  const invalid = validateCompletedRawAcquisition(raw, b);
  assert.equal(invalid.ok, false);
  raw.rows = raw.rows.map((row, i) => ({ ...row, timestamp: new Date(Date.UTC(2026, 7, 11, 0, 0, i)).toISOString(), response: i / 100 }));
  raw.root = sha256({ ...raw, root: undefined });
  const valid = validateCompletedRawAcquisition(raw, b);
  assert.equal(valid.ok, true);
  assert.equal(raw.magicVerified, false);
});

test('exporter writes binding, calibration, redacted schedule, raw template and private semantic manifest separately', () => {
  const b = validBundle();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-phase2c-'));
  const out = exportInstrumentBindingBundle(dir, b);
  for (const file of Object.values(out.files)) assert.equal(fs.existsSync(file), true);
  const schedule = JSON.parse(fs.readFileSync(out.files.schedule, 'utf8'));
  assert.equal(schedule.length, 96);
  const privateManifest = JSON.parse(fs.readFileSync(out.files.privateManifest, 'utf8'));
  assert.equal(privateManifest.mapping.length, 4);
});
