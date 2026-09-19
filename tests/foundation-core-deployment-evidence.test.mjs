import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import {
  FOUNDATION_CORE_DEPLOYMENT_DOMAIN_MAP,
  foundationCoreDeploymentEvidence,
} from '../src/foundation-core-deployment-evidence.mjs';

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function fixture(canonicalDomain) {
  const runtimeDomain = FOUNDATION_CORE_DEPLOYMENT_DOMAIN_MAP[canonicalDomain];
  const binaryBytes = Buffer.from(`cycle62-${canonicalDomain}-rclvm`);
  const binarySha256 = sha256(binaryBytes);
  const proof = {
    domain: runtimeDomain,
    status: 'native-verified',
    verified: true,
    loweredCount: 2,
    parity: {
      state: true,
      semanticStateRoot: true,
      nativeStateRootVerified: true,
      nativeStateRootParity: true,
      loweringLineage: true,
      domainReceipt: true,
      nativeExecutionAttestation: true,
    },
    foundationDomainReceiptRoot: 'a'.repeat(64),
    nativeVmExecutionAttestationRoot: 'b'.repeat(64),
    executionBinarySha256: binarySha256,
    finalState: { [`${runtimeDomain}.fixture`]: 1 },
  };
  return {
    binaryBytes,
    attestation: {
      binarySha256,
      foundationParityProofs: { [runtimeDomain]: proof },
    },
  };
}

for (const domain of ['perception', 'physical', 'neural', 'genetic', 'life']) {
  test(`${domain} core deployment evidence binds receipt/execution/binary identity`, () => {
    const report = foundationCoreDeploymentEvidence(domain, fixture(domain));
    assert.equal(report.ok, true, JSON.stringify(report, null, 2));
    assert.equal(report.status, 'deployment-bound');
    assert.equal(report.domain, domain);
    assert.equal(report.runtimeDomain, FOUNDATION_CORE_DEPLOYMENT_DOMAIN_MAP[domain]);
    assert.match(report.deploymentEvidenceRoot, /^[0-9a-f]{64}$/);
    assert.equal(report.executionBinarySha256, report.binarySha256);
    assert.equal(report.truthBoundary.providerBridgeRemovedGlobally, false);
    assert.equal(report.truthBoundary.completeFoundationDirectCoverageClaimed, false);
  });
}

test('life canonical evidence binds the living runtime proof without erasing the ID boundary', () => {
  const report = foundationCoreDeploymentEvidence('life', fixture('life'));
  assert.equal(report.ok, true, JSON.stringify(report, null, 2));
  assert.equal(report.domain, 'life');
  assert.equal(report.runtimeDomain, 'living');
  assert.equal(report.truthBoundary.canonicalDomainMayMapToDifferentRuntimeDomain, true);
});

test('core deployment evidence fails closed when binary identity drifts', () => {
  const input = fixture('physical');
  input.attestation.binarySha256 = 'c'.repeat(64);
  const report = foundationCoreDeploymentEvidence('physical', input);
  assert.equal(report.ok, false);
  assert.ok(report.errors.some(error => error.code === 'RCL_CORE_DEPLOYMENT_BINARY_DRIFT'));
});

test('core deployment evidence fails closed when domain receipt parity is lost', () => {
  const input = fixture('neural');
  input.attestation.foundationParityProofs.neural.parity.domainReceipt = false;
  const report = foundationCoreDeploymentEvidence('neural', input);
  assert.equal(report.ok, false);
  assert.ok(report.errors.some(error => error.code === 'RCL_CORE_DEPLOYMENT_PARITY_DRIFT'));
});

test('core deployment evidence rejects a direct domain without a mature core proof mapping', () => {
  const report = foundationCoreDeploymentEvidence('quantitative', {});
  assert.equal(report.ok, false);
  assert.equal(report.status, 'deployment-unsupported');
  assert.ok(report.errors.some(error => error.code === 'RCL_CORE_DEPLOYMENT_DOMAIN_UNSUPPORTED'));
});
