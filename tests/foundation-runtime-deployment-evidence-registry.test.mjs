import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import {
  FOUNDATION_RUNTIME_DEPLOYMENT_EVIDENCE_PROVIDERS,
  foundationRuntimeDeploymentEvidenceRegistrySnapshot,
  foundationRuntimeDeploymentEvidenceSurface,
} from '../src/foundation-runtime-deployment-evidence-registry.mjs';
import {
  FOUNDATION_DIRECT_IMPLEMENTATION_DOMAINS,
} from '../src/foundation-direct-capability-registry.mjs';

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function energyFixture() {
  const binaryBytes = Buffer.from('cycle61-canonical-rclvm');
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

test('runtime deployment evidence registry is deterministic and currently registers Energy once', () => {
  const left = foundationRuntimeDeploymentEvidenceRegistrySnapshot();
  const right = foundationRuntimeDeploymentEvidenceRegistrySnapshot();
  assert.deepEqual(left, right);
  assert.match(left.registryRoot, /^[0-9a-f]{64}$/);
  assert.deepEqual(left.providers, FOUNDATION_RUNTIME_DEPLOYMENT_EVIDENCE_PROVIDERS);
  assert.deepEqual(left.providers.map(item => item.domain), ['energy']);
});

test('runtime deployment evidence surface reports partial direct-domain coverage without inventing evidence', () => {
  const report = foundationRuntimeDeploymentEvidenceSurface({
    evidenceInputs: { energy: energyFixture() },
  });
  assert.equal(report.ok, true, JSON.stringify(report, null, 2));
  assert.equal(report.completeDirectDeploymentCoverage, false);
  assert.deepEqual(report.registeredDomains, ['energy']);
  assert.deepEqual(
    report.missingDirectDeploymentEvidenceDomains,
    FOUNDATION_DIRECT_IMPLEMENTATION_DOMAINS.filter(domain => domain !== 'energy'),
  );
  assert.equal(report.evidenceByDomain.energy.verified, true);
  assert.equal(report.truthBoundary.registeredEvidenceDoesNotImplyCompleteDirectCoverage, true);
  assert.equal(report.truthBoundary.unregisteredDirectDomainsAreReportedNotInvented, true);
  assert.equal(report.truthBoundary.completeDirectDeploymentCoverageClaimed, false);
});

test('runtime deployment evidence surface fails closed when a registered provider evidence breaks', () => {
  const input = energyFixture();
  input.attestation.foundationParityProofs.energy.parity.energyReceipt = false;
  const report = foundationRuntimeDeploymentEvidenceSurface({
    evidenceInputs: { energy: input },
  });
  assert.equal(report.ok, false);
  assert.ok(report.errors.some(error => error.code === 'RCL_RUNTIME_DEPLOYMENT_EVIDENCE_PROVIDER_FAILED'));
});

test('runtime deployment evidence registry rejects non-direct evidence providers', () => {
  const report = foundationRuntimeDeploymentEvidenceSurface({
    providers: [{
      domain: 'knowledge',
      evidenceModule: 'src/fake-knowledge-evidence.mjs',
      evidenceFunction: 'fakeKnowledgeEvidence',
    }],
    builders: {
      knowledge: () => ({
        ok: true,
        verified: true,
        domain: 'knowledge',
        deploymentEvidenceRoot: 'c'.repeat(64),
      }),
    },
  });
  assert.equal(report.ok, false);
  assert.ok(report.errors.some(error => error.code === 'RCL_RUNTIME_DEPLOYMENT_EVIDENCE_REGISTRY_NON_DIRECT_DOMAIN'));
});

test('complete deployment coverage can be required explicitly and then fails closed while coverage is partial', () => {
  const report = foundationRuntimeDeploymentEvidenceSurface({
    evidenceInputs: { energy: energyFixture() },
    requireCompleteDirectCoverage: true,
  });
  assert.equal(report.ok, false);
  assert.ok(report.errors.some(error => error.code === 'RCL_RUNTIME_DEPLOYMENT_EVIDENCE_COVERAGE_INCOMPLETE'));
});
