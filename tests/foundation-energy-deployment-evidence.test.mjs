import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { foundationEnergyDeploymentEvidence } from '../src/foundation-energy-deployment-evidence.mjs';

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function fixture() {
  const binaryBytes = Buffer.from('cycle60-canonical-rclvm');
  const binarySha256 = sha256(binaryBytes);
  const proof = {
    domain: 'energy',
    status: 'native-verified',
    verified: true,
    boundedSubset: true,
    loweredDirectiveCount: 1,
    loweredFlowCount: 1,
    parity: {
      state: true,
      semanticStateRoot: true,
      nativeStateRootVerified: true,
      nativeStateRootParity: true,
      energyReceipt: true,
      nativeExecutionAttestation: true,
    },
    energyReceiptRoot: 'a'.repeat(64),
    energyReceiptRootAlgorithm: 'rcl.foundation-energy-receipt-root.sha256.v0.1',
    nativeVmExecutionAttestationRoot: 'b'.repeat(64),
    executionBinarySha256: binarySha256,
    finalState: {
      'grid.source': { kind: 'Quantity', type: 'Energy', value: 60, unit: 'J' },
      'grid.load': { kind: 'Quantity', type: 'Energy', value: 36, unit: 'J' },
    },
    truthBoundary: {
      boundedEnergySubsetOnly: true,
      stateIndependentAmountsRequired: true,
      literalEfficiencyRequired: true,
      disjointReservoirTopologyRequired: true,
      oneEnergizeDirectiveMapsToOneAtomicNativeTransaction: true,
      referenceReceiptAndNativeReceiptMustMatchExactly: true,
      canonicalRealCExecutionRequiredForVerifiedStatus: true,
      providerBridgeRemovedGlobally: false,
      allEnergyProgramsNativeClaimed: false,
      fullHistoryParityClaimed: false,
    },
  };
  return {
    binaryBytes,
    attestation: {
      binarySha256,
      foundationParityProofs: { energy: proof },
      foundationEnergyParityProof: proof,
    },
  };
}

test('Energy deployment evidence binds the exact canonical binary, receipt root and bounded truth boundary', () => {
  const input = fixture();
  const report = foundationEnergyDeploymentEvidence(input);
  assert.equal(report.ok, true, JSON.stringify(report, null, 2));
  assert.equal(report.status, 'deployment-bound');
  assert.equal(report.domain, 'energy');
  assert.match(report.deploymentEvidenceRoot, /^[0-9a-f]{64}$/);
  assert.equal(report.executionBinarySha256, report.binarySha256);
  assert.equal(report.finalState['grid.source'].value, 60);
  assert.equal(report.finalState['grid.load'].value, 36);
  assert.equal(report.truthBoundary.providerBridgeRemovedGlobally, false);
  assert.equal(report.truthBoundary.allEnergyProgramsNativeClaimed, false);
});

test('Energy deployment evidence fails closed when the bundled binary identity drifts', () => {
  const input = fixture();
  input.attestation.binarySha256 = 'c'.repeat(64);
  const report = foundationEnergyDeploymentEvidence(input);
  assert.equal(report.ok, false);
  assert.ok(report.errors.some(error => error.code === 'RCL_ENERGY_DEPLOYMENT_BINARY_DRIFT'));
});

test('Energy deployment evidence fails closed when receipt parity is no longer verified', () => {
  const input = fixture();
  input.attestation.foundationParityProofs.energy.parity.energyReceipt = false;
  const report = foundationEnergyDeploymentEvidence(input);
  assert.equal(report.ok, false);
  assert.ok(report.errors.some(error => error.code === 'RCL_ENERGY_DEPLOYMENT_PARITY_DRIFT'));
});

test('Energy deployment evidence rejects a global Provider-bridge removal overclaim', () => {
  const input = fixture();
  input.attestation.foundationParityProofs.energy.truthBoundary.providerBridgeRemovedGlobally = true;
  const report = foundationEnergyDeploymentEvidence(input);
  assert.equal(report.ok, false);
  assert.ok(report.errors.some(error => error.code === 'RCL_ENERGY_DEPLOYMENT_BOUNDARY_DRIFT'));
});
