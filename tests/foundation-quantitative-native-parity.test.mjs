import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeQuantitativeSemanticValue,
  quantitativeSemanticStateRoot,
  verifyFoundationQuantitativeReceiptParity,
} from '../src/foundation-quantitative-native-parity.mjs';

const measurementReference = {
  kind: 'Measurement',
  baseType: 'Temperature',
  value: { kind: 'Quantity', type: 'Temperature', value: 8, unit: '°C' },
  uncertainty: { kind: 'Quantity', type: 'Temperature', value: 0.2, unit: '°C' },
  confidence: 0.98,
  unit: '°C',
  scale: 'interval',
  evidence: ['sensor:ambient-v1'],
  calibratedBy: 'calibration:ambient-v1',
};
const measurementNative = {
  ...measurementReference,
  evidence: '["sensor:ambient-v1"]',
  hasUnit: true,
  hasCalibration: true,
};
const lowering = {
  lowered: [{
    domain: 'quantitative',
    declaration: 'sensor',
    directive: 'Quantify',
    syntheticRule: '__rcl_foundation_quantitative_sensor_0',
    stateTargets: ['sensor.temperature', 'sensor.healthy'],
    witness: 'rcl:foundation:quantitative:sensor',
    authorityClass: 'measurement',
    measurementCount: 1,
    measurementPaths: ['sensor.temperature'],
  }],
};
function referenceHistory() {
  return [{
    kind: 'DomainTransition',
    domainKind: 'quantitative',
    name: 'sensor',
    status: 'realized',
    authorityClass: 'evidentiary-measurement',
    measurements: [{ path: 'sensor.temperature' }],
    changes: [
      { target: 'sensor.temperature', before: null, after: measurementReference },
      { target: 'sensor.healthy', before: null, after: true },
    ],
  }];
}
function nativeHistory() {
  return [{
    rule: '__rcl_foundation_quantitative_sensor_0',
    witnesses: ['rcl:foundation:quantitative:sensor'],
    changes: [
      { target: 'sensor.temperature', before: null, after: measurementNative },
      { target: 'sensor.healthy', before: null, after: true },
    ],
  }];
}

test('Quantitative receipt parity normalizes evidence representation without erasing semantics', () => {
  assert.deepEqual(
    normalizeQuantitativeSemanticValue(measurementReference),
    normalizeQuantitativeSemanticValue(measurementNative),
  );
  const report = verifyFoundationQuantitativeReceiptParity(lowering, referenceHistory(), nativeHistory());
  assert.equal(report.ok, true, JSON.stringify(report, null, 2));
  assert.match(report.receiptRoot, /^[0-9a-f]{64}$/);
  assert.equal(report.entries[0].checks.receiptRootParity, true);
});

test('Quantitative receipt parity fails closed on measurement semantic drift', () => {
  const native = nativeHistory();
  native[0].changes[0].after.confidence = 0.75;
  const report = verifyFoundationQuantitativeReceiptParity(lowering, referenceHistory(), native);
  assert.equal(report.ok, false);
  assert.equal(report.entries[0].checks.changesParity, false);
});

test('Quantitative receipt parity fails closed when native witness is missing', () => {
  const native = nativeHistory();
  native[0].witnesses = [];
  const report = verifyFoundationQuantitativeReceiptParity(lowering, referenceHistory(), native);
  assert.equal(report.ok, false);
  assert.equal(report.entries[0].checks.nativeWitness, false);
});

test('Quantitative semantic state root treats canonical evidence text and evidence arrays identically', () => {
  const left = quantitativeSemanticStateRoot({
    'sensor.temperature': measurementReference,
    'sensor.healthy': true,
  }, ['sensor.temperature', 'sensor.healthy']);
  const right = quantitativeSemanticStateRoot({
    'sensor.temperature': measurementNative,
    'sensor.healthy': true,
  }, ['sensor.temperature', 'sensor.healthy']);
  assert.equal(left, right);
});
