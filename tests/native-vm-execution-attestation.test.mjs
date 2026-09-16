import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createNativeVmExecutionAttestation,
  verifyNativeVmExecutionAttestation,
  RCL_NATIVE_VM_EXECUTION_ATTESTATION_ROOT_ALGORITHM,
} from '../src/native-vm-execution-attestation.mjs';

const materialization = {
  format: 'taowind.rcl-native-vm-materialization.v0.2',
  version: '0.2.0',
  provenance: 'staged-repository-source-makefile',
  sourceRoot: '1'.repeat(64),
  binarySha256: '2'.repeat(64),
};
const payload = {
  vm: 'rcl-native-vm/0.6.0-alpha.1',
  bytecodeVersion: '1.0',
  program: 'AttestedReality',
  sourceRoot: 'program-root',
};

test('execution attestation binds VM identity, program identity and materialized binary identity', () => {
  const attestation = createNativeVmExecutionAttestation(materialization, payload);
  const verdict = verifyNativeVmExecutionAttestation(attestation);
  assert.equal(verdict.ok, true);
  assert.equal(attestation.algorithm, RCL_NATIVE_VM_EXECUTION_ATTESTATION_ROOT_ALGORITHM);
  assert.equal(attestation.materialization.binarySha256, materialization.binarySha256);
});

test('binary identity tampering invalidates the execution attestation', () => {
  const attestation = createNativeVmExecutionAttestation(materialization, payload);
  attestation.materialization.binarySha256 = '3'.repeat(64);
  const verdict = verifyNativeVmExecutionAttestation(attestation);
  assert.equal(verdict.ok, false);
  assert.equal(verdict.checks.attestationRoot, false);
});

test('program source identity is bound into the attestation root', () => {
  const first = createNativeVmExecutionAttestation(materialization, payload);
  const second = createNativeVmExecutionAttestation(materialization, { ...payload, sourceRoot: 'other-program-root' });
  assert.notEqual(first.attestationRoot, second.attestationRoot);
});

test('VM-reported runtime identity is bound into the attestation root', () => {
  const first = createNativeVmExecutionAttestation(materialization, payload);
  const second = createNativeVmExecutionAttestation(materialization, { ...payload, vm: 'rcl-native-vm/other' });
  assert.notEqual(first.attestationRoot, second.attestationRoot);
});

test('missing binary digest cannot verify as an execution attestation', () => {
  const attestation = createNativeVmExecutionAttestation({ ...materialization, binarySha256: null }, payload);
  const verdict = verifyNativeVmExecutionAttestation(attestation);
  assert.equal(verdict.ok, false);
  assert.equal(verdict.checks.binarySha256, false);
});
