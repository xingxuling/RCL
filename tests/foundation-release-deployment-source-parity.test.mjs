import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createFoundationReleaseDeploymentAttestation,
  foundationReleaseDeploymentAttestationRoot,
  verifyFoundationReleaseDeploymentAttestation,
} from '../src/foundation-release-deployment-source-parity.mjs';

const roots = {
  contract: 'a'.repeat(64),
  capability: 'b'.repeat(64),
  direct: 'c'.repeat(64),
  bridge: 'd'.repeat(64),
  artifact: 'e'.repeat(64),
};

function contract() {
  return {
    contractRoot: roots.contract,
    capabilityTruth: {
      truthRoot: roots.capability,
      directRegistryRoot: roots.direct,
      providerBridgeRegistryRoot: roots.bridge,
    },
    sourceBindings: Array.from({ length: 10 }, (_, i) => ({ path: `p${i}`, sha256: 'f'.repeat(64) })),
    surfaces: Array.from({ length: 5 }, (_, i) => ({ id: `s${i}` })),
    truthBoundary: {
      deploymentMustReverifyRuntimeTruth: true,
      deploymentEvidenceClaimed: false,
      runtimeSurfaceAvailabilityClaimed: false,
    },
  };
}

function runtimeTruth() {
  return {
    ok: true,
    status: 'RCL_FOUNDATION_RUNTIME_CAPABILITY_TRUTH_VERIFIED',
    truthRoot: roots.capability,
    direct: { registryRoot: roots.direct },
    providerBridge: { registryRoot: roots.bridge },
  };
}

function make() {
  const releaseContract = contract();
  const deploymentContract = contract();
  return {
    deploymentContract,
    runtimeCapabilityTruth: runtimeTruth(),
    attestation: createFoundationReleaseDeploymentAttestation({
      artifactFileName: 'rcl.tgz',
      artifactSha256: roots.artifact,
      releaseContract,
      deploymentContract,
    }),
  };
}

test('release/deployment exact source-contract parity verifies', () => {
  const { attestation, deploymentContract, runtimeCapabilityTruth } = make();
  const result = verifyFoundationReleaseDeploymentAttestation(attestation, { deploymentContract, runtimeCapabilityTruth });
  assert.equal(result.ok, true, JSON.stringify(result.errors));
});

test('release contract root drift fails closed even when re-rooted', () => {
  const { attestation, deploymentContract, runtimeCapabilityTruth } = make();
  attestation.developerRelease.runtimeTruthContractRoot = '0'.repeat(64);
  attestation.attestationRoot = foundationReleaseDeploymentAttestationRoot(attestation);
  const result = verifyFoundationReleaseDeploymentAttestation(attestation, { deploymentContract, runtimeCapabilityTruth });
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /release\/deployment runtime truth contract roots diverged/);
});

test('installed-runtime overclaim fails closed even when re-rooted', () => {
  const { attestation, deploymentContract, runtimeCapabilityTruth } = make();
  attestation.truthBoundary.releaseArtifactInstalledAsRuntimeClaimed = true;
  attestation.attestationRoot = foundationReleaseDeploymentAttestationRoot(attestation);
  const result = verifyFoundationReleaseDeploymentAttestation(attestation, { deploymentContract, runtimeCapabilityTruth });
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /releaseArtifactInstalledAsRuntimeClaimed/);
});

test('runtime capability truth root drift fails closed', () => {
  const { attestation, deploymentContract, runtimeCapabilityTruth } = make();
  runtimeCapabilityTruth.truthRoot = '1'.repeat(64);
  const result = verifyFoundationReleaseDeploymentAttestation(attestation, { deploymentContract, runtimeCapabilityTruth });
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /runtime capability truth root diverged/);
});
