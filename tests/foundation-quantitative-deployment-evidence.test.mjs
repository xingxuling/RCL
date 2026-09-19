import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { foundationQuantitativeDeploymentEvidence } from '../src/foundation-quantitative-deployment-evidence.mjs';
function sha256(buffer) { return crypto.createHash('sha256').update(buffer).digest('hex'); }
function fixture() {
  const binaryBytes = Buffer.from('cycle63-quantitative-rclvm');
  const binarySha256 = sha256(binaryBytes);
  return {
    binaryBytes,
    attestation: {
      binarySha256,
      foundationQuantitativeParityProof: {
        domain: 'quantitative', status: 'native-verified', verified: true, boundedSubset: true, loweredCount: 1,
        parity: { quantitativeStateProjection: true, quantitativeSemanticStateRoot: true, nativeStateRootVerified: true, nativeStateRootParity: true, quantitativeReceipt: true, nativeExecutionAttestation: true },
        quantitativeReceiptRoot: 'a'.repeat(64), referenceQuantitativeStateRoot: 'b'.repeat(64), nativeQuantitativeStateRoot: 'b'.repeat(64), nativeVmExecutionAttestationRoot: 'c'.repeat(64), executionBinarySha256: binarySha256,
        finalState: { 'sensor.healthy': true },
      },
    },
  };
}
test('Quantitative deployment evidence binds receipt/state/execution roots', () => {
  const report = foundationQuantitativeDeploymentEvidence(fixture());
  assert.equal(report.ok, true, JSON.stringify(report, null, 2));
  assert.equal(report.verified, true);
  assert.match(report.deploymentEvidenceRoot, /^[0-9a-f]{64}$/);
  assert.equal(report.quantitativeStateRoot, 'b'.repeat(64));
});
test('Quantitative deployment evidence fails closed on state-root parity drift', () => {
  const input = fixture();
  input.attestation.foundationQuantitativeParityProof.nativeQuantitativeStateRoot = 'd'.repeat(64);
  const report = foundationQuantitativeDeploymentEvidence(input);
  assert.equal(report.ok, false);
  assert.ok(report.errors.some(error => error.code === 'RCL_QUANTITATIVE_DEPLOYMENT_ROOT_BINDING_DRIFT'));
});
test('Quantitative deployment evidence fails closed on receipt parity loss', () => {
  const input = fixture();
  input.attestation.foundationQuantitativeParityProof.parity.quantitativeReceipt = false;
  const report = foundationQuantitativeDeploymentEvidence(input);
  assert.equal(report.ok, false);
  assert.ok(report.errors.some(error => error.code === 'RCL_QUANTITATIVE_DEPLOYMENT_PARITY_DRIFT'));
});
