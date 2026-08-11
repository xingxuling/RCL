import assert from 'node:assert/strict';
import test from 'node:test';
import { quantity } from '../src/quantity.mjs';
import {
  RBC13_DOMAIN_CALL_ABI_CANDIDATE,
  RBC13_DOMAIN_CALL_OPERATION_INVENTORY,
  buildRbc13DomainCallSalvageReport,
  invokeRbc13DomainCallReference,
} from '../src/rbc13-domain-call-salvage.mjs';

test('RBC 1.3 salvage keeps opcode 45 quarantined from canonical RBC 1.2', () => {
  assert.equal(RBC13_DOMAIN_CALL_ABI_CANDIDATE.bytecodeMajor, 1);
  assert.equal(RBC13_DOMAIN_CALL_ABI_CANDIDATE.bytecodeMinor, 3);
  assert.equal(RBC13_DOMAIN_CALL_ABI_CANDIDATE.opcode, 45);
  assert.equal(RBC13_DOMAIN_CALL_ABI_CANDIDATE.opcodeName, 'DOMAIN_CALL');
  assert.equal(RBC13_DOMAIN_CALL_ABI_CANDIDATE.currentCanonicalFeatureVersion, '1.2');
  assert.equal(RBC13_DOMAIN_CALL_ABI_CANDIDATE.canonicalEnabled, false);
});

test('legacy operation inventory distinguishes four reference-backed operations from fourteen native-only experiments', () => {
  const report = buildRbc13DomainCallSalvageReport();
  assert.equal(RBC13_DOMAIN_CALL_OPERATION_INVENTORY.length, 18);
  assert.deepEqual(report.counts, {
    totalLegacyOperations: 18,
    admittedReferenceOperations: 4,
    quarantinedLegacyNativeOnlyOperations: 14,
  });
  assert.equal(report.status, 'CANDIDATE');
  assert.equal(report.authority.canonicalBytecodeMutationAllowed, false);
  assert.equal(report.authority.nativeFoundationSyntaxClaimAllowed, false);
  assert.equal(report.authority.oldBinaryReuseAllowed, false);
  assert.match(report.evidenceRoot, /^[a-f0-9]{64}$/);
});

test('source-only reference restores core.echo and quantity.make semantics', () => {
  assert.equal(invokeRbc13DomainCallReference('core', 'echo', ['hello']), 'hello');
  assert.deepEqual(
    invokeRbc13DomainCallReference('quantity', 'make', ['Temperature', 25, '']),
    { kind: 'Quantity', type: 'Temperature', value: 25, unit: '°C' },
  );
});

test('source-only reference restores quantitative.measure semantics using the current quantity oracle', () => {
  const value = quantity('Temperature', 25);
  const uncertainty = quantity('Temperature', 0.5);
  const result = invokeRbc13DomainCallReference('quantitative', 'measure', [
    'Temperature',
    value,
    uncertainty,
    0.9,
    '',
    'ratio',
    ['sensor:A'],
    'sensor-A',
  ]);

  assert.equal(result.kind, 'Measurement');
  assert.equal(result.baseType, 'Temperature');
  assert.deepEqual(result.value, value);
  assert.deepEqual(result.uncertainty, uncertainty);
  assert.equal(result.confidence, 0.9);
  assert.equal(result.unit, '°C');
  assert.equal(result.scale, 'ratio');
  assert.deepEqual(result.evidence, ['sensor:A']);
  assert.equal(result.calibratedBy, 'sensor-A');
});

test('source-only reference restores knowledge.claim semantics using the current knowledge oracle', () => {
  const value = quantity('Temperature', 25);
  const result = invokeRbc13DomainCallReference('knowledge', 'claim', [
    'Temperature',
    value,
    0.8,
    ['sensor:A'],
    'lab',
    'local',
    'provisional',
    [],
    1,
    'root-1',
  ]);

  assert.equal(result.kind, 'Knowledge');
  assert.equal(result.baseType, 'Temperature');
  assert.deepEqual(result.value, value);
  assert.equal(result.confidence, 0.8);
  assert.deepEqual(result.evidence, ['sensor:A']);
  assert.equal(result.source, 'lab');
  assert.equal(result.scope, 'local');
  assert.equal(result.status, 'provisional');
  assert.equal(result.revision, 1);
  assert.equal(result.formedAtRoot, 'root-1');
});

test('legacy native-only operations fail closed instead of inheriting native status', () => {
  assert.throws(
    () => invokeRbc13DomainCallReference('energy', 'scale', []),
    error => error?.code === 'RCL_DOMAIN_CALL_CANDIDATE_UNIMPLEMENTED'
      && error?.details?.nearestCurrentBridge === 'energy.balance',
  );
  assert.throws(
    () => invokeRbc13DomainCallReference('science', 'claim', []),
    error => error?.code === 'RCL_DOMAIN_CALL_CANDIDATE_UNIMPLEMENTED'
      && error?.details?.nearestCurrentBridge === null,
  );
});

test('unknown domain operation is rejected explicitly', () => {
  assert.throws(
    () => invokeRbc13DomainCallReference('unknown', 'operation', []),
    error => error?.code === 'RCL_DOMAIN_OPERATION_MISSING',
  );
});
