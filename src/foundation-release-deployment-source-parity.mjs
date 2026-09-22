import crypto from 'node:crypto';

export const FOUNDATION_RELEASE_DEPLOYMENT_ATTESTATION_FORMAT = 'taowind.rcl-foundation-release-deployment-attestation.v0.1';
export const FOUNDATION_RELEASE_DEPLOYMENT_ATTESTATION_VERSION = '0.1.0';
export const FOUNDATION_RELEASE_DEPLOYMENT_ATTESTATION_ROOT_ALGORITHM = 'rcl.foundation-release-deployment-attestation.sha256.v0.1';

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  }
  return value;
}

function sha256Canonical(value) {
  return crypto.createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}

function isSha256(value) {
  return typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value);
}

function safeBoundary() {
  return {
    exactReleaseDeploymentSourceContractParityRequired: true,
    packagedRuntimeTruthContractVerifiedAtBuildTime: true,
    developerReleaseArtifactHashVerifiedAtBuildTime: true,
    deployedSourceTreeMustReverifyRuntimeTruthContract: true,
    deploymentRuntimeCapabilityTruthMustMatchContract: true,
    releaseArtifactRetainedInDeploymentClaimed: false,
    releaseArtifactInstalledAsRuntimeClaimed: false,
    deploymentBinaryParityClaimed: false,
    runtimeSurfaceAvailabilityClaimed: false,
    completeRuntimeClaimed: false,
    fullSelfHostingClaimed: false,
  };
}

export function foundationReleaseDeploymentAttestationRoot(attestation) {
  if (!attestation || typeof attestation !== 'object' || Array.isArray(attestation)) {
    throw new TypeError('Foundation release deployment attestation object is required');
  }
  const { attestationRoot: _attestationRoot, ...payload } = attestation;
  return sha256Canonical(payload);
}

export function createFoundationReleaseDeploymentAttestation({
  artifactFileName,
  artifactSha256,
  releaseContract,
  deploymentContract,
} = {}) {
  if (!releaseContract || !deploymentContract) {
    throw new TypeError('releaseContract and deploymentContract are required');
  }
  const payload = {
    format: FOUNDATION_RELEASE_DEPLOYMENT_ATTESTATION_FORMAT,
    version: FOUNDATION_RELEASE_DEPLOYMENT_ATTESTATION_VERSION,
    rootAlgorithm: FOUNDATION_RELEASE_DEPLOYMENT_ATTESTATION_ROOT_ALGORITHM,
    developerRelease: {
      artifactFileName: artifactFileName ?? null,
      artifactSha256: artifactSha256 ?? null,
      runtimeTruthContractRoot: releaseContract.contractRoot ?? null,
      capabilityTruthRoot: releaseContract?.capabilityTruth?.truthRoot ?? null,
      directRegistryRoot: releaseContract?.capabilityTruth?.directRegistryRoot ?? null,
      providerBridgeRegistryRoot: releaseContract?.capabilityTruth?.providerBridgeRegistryRoot ?? null,
      sourceBindingCount: Array.isArray(releaseContract?.sourceBindings) ? releaseContract.sourceBindings.length : 0,
      surfaceCount: Array.isArray(releaseContract?.surfaces) ? releaseContract.surfaces.length : 0,
      runtimeTruthBoundary: {
        deploymentMustReverifyRuntimeTruth: releaseContract?.truthBoundary?.deploymentMustReverifyRuntimeTruth === true,
        deploymentEvidenceClaimed: releaseContract?.truthBoundary?.deploymentEvidenceClaimed === true,
        runtimeSurfaceAvailabilityClaimed: releaseContract?.truthBoundary?.runtimeSurfaceAvailabilityClaimed === true,
      },
    },
    deploymentSource: {
      runtimeTruthContractRoot: deploymentContract.contractRoot ?? null,
      capabilityTruthRoot: deploymentContract?.capabilityTruth?.truthRoot ?? null,
      directRegistryRoot: deploymentContract?.capabilityTruth?.directRegistryRoot ?? null,
      providerBridgeRegistryRoot: deploymentContract?.capabilityTruth?.providerBridgeRegistryRoot ?? null,
      sourceBindingCount: Array.isArray(deploymentContract?.sourceBindings) ? deploymentContract.sourceBindings.length : 0,
      surfaceCount: Array.isArray(deploymentContract?.surfaces) ? deploymentContract.surfaces.length : 0,
    },
    truthBoundary: safeBoundary(),
  };
  return { ...payload, attestationRoot: sha256Canonical(payload) };
}

export function verifyFoundationReleaseDeploymentAttestation(
  attestation,
  { deploymentContract = null, runtimeCapabilityTruth = null } = {},
) {
  const errors = [];
  if (!attestation || typeof attestation !== 'object' || Array.isArray(attestation)) {
    return { ok: false, status: 'RCL_FOUNDATION_RELEASE_DEPLOYMENT_ATTESTATION_FAILED', errors: ['attestation object is required'] };
  }
  if (attestation.format !== FOUNDATION_RELEASE_DEPLOYMENT_ATTESTATION_FORMAT) errors.push('attestation format drifted');
  if (attestation.version !== FOUNDATION_RELEASE_DEPLOYMENT_ATTESTATION_VERSION) errors.push('attestation version drifted');
  if (attestation.rootAlgorithm !== FOUNDATION_RELEASE_DEPLOYMENT_ATTESTATION_ROOT_ALGORITHM) errors.push('attestation root algorithm drifted');
  if (!isSha256(attestation.attestationRoot) || attestation.attestationRoot !== foundationReleaseDeploymentAttestationRoot(attestation)) {
    errors.push('attestation root does not match canonical payload');
  }

  const release = attestation.developerRelease ?? {};
  const deployment = attestation.deploymentSource ?? {};
  for (const [label, value] of [
    ['developer release artifact hash', release.artifactSha256],
    ['developer release runtime truth contract root', release.runtimeTruthContractRoot],
    ['developer release capability truth root', release.capabilityTruthRoot],
    ['developer release direct registry root', release.directRegistryRoot],
    ['developer release Provider bridge registry root', release.providerBridgeRegistryRoot],
    ['deployment source runtime truth contract root', deployment.runtimeTruthContractRoot],
    ['deployment source capability truth root', deployment.capabilityTruthRoot],
    ['deployment source direct registry root', deployment.directRegistryRoot],
    ['deployment source Provider bridge registry root', deployment.providerBridgeRegistryRoot],
  ]) {
    if (!isSha256(value)) errors.push(`${label} is not a SHA-256 root`);
  }
  if (typeof release.artifactFileName !== 'string' || release.artifactFileName.length === 0) errors.push('developer release artifact filename is missing');
  if (release.runtimeTruthContractRoot !== deployment.runtimeTruthContractRoot) errors.push('release/deployment runtime truth contract roots diverged');
  if (release.capabilityTruthRoot !== deployment.capabilityTruthRoot) errors.push('release/deployment capability truth roots diverged');
  if (release.directRegistryRoot !== deployment.directRegistryRoot) errors.push('release/deployment direct registry roots diverged');
  if (release.providerBridgeRegistryRoot !== deployment.providerBridgeRegistryRoot) errors.push('release/deployment Provider bridge registry roots diverged');
  if (release.sourceBindingCount !== deployment.sourceBindingCount || !Number.isInteger(release.sourceBindingCount) || release.sourceBindingCount <= 0) {
    errors.push('release/deployment source-binding counts diverged or are invalid');
  }
  if (release.surfaceCount !== deployment.surfaceCount || !Number.isInteger(release.surfaceCount) || release.surfaceCount <= 0) {
    errors.push('release/deployment runtime-surface counts diverged or are invalid');
  }

  if (release?.runtimeTruthBoundary?.deploymentMustReverifyRuntimeTruth !== true) errors.push('release contract lost deployment re-verification requirement');
  if (release?.runtimeTruthBoundary?.deploymentEvidenceClaimed !== false) errors.push('release contract fabricates deployment evidence');
  if (release?.runtimeTruthBoundary?.runtimeSurfaceAvailabilityClaimed !== false) errors.push('release contract fabricates runtime surface availability');

  const boundary = attestation.truthBoundary ?? {};
  const requiredTrue = [
    'exactReleaseDeploymentSourceContractParityRequired',
    'packagedRuntimeTruthContractVerifiedAtBuildTime',
    'developerReleaseArtifactHashVerifiedAtBuildTime',
    'deployedSourceTreeMustReverifyRuntimeTruthContract',
    'deploymentRuntimeCapabilityTruthMustMatchContract',
  ];
  const requiredFalse = [
    'releaseArtifactRetainedInDeploymentClaimed',
    'releaseArtifactInstalledAsRuntimeClaimed',
    'deploymentBinaryParityClaimed',
    'runtimeSurfaceAvailabilityClaimed',
    'completeRuntimeClaimed',
    'fullSelfHostingClaimed',
  ];
  for (const key of requiredTrue) if (boundary[key] !== true) errors.push(`required truth boundary missing: ${key}`);
  for (const key of requiredFalse) if (boundary[key] !== false) errors.push(`truth boundary overclaim: ${key}`);

  if (deploymentContract) {
    if (deployment.runtimeTruthContractRoot !== deploymentContract.contractRoot) errors.push('attested deployment contract root diverged from current deployment source tree');
    if (deployment.capabilityTruthRoot !== deploymentContract?.capabilityTruth?.truthRoot) errors.push('attested deployment capability truth root diverged from current deployment source tree');
    if (deployment.directRegistryRoot !== deploymentContract?.capabilityTruth?.directRegistryRoot) errors.push('attested deployment direct registry root diverged from current deployment source tree');
    if (deployment.providerBridgeRegistryRoot !== deploymentContract?.capabilityTruth?.providerBridgeRegistryRoot) errors.push('attested deployment Provider bridge registry root diverged from current deployment source tree');
    if (deployment.sourceBindingCount !== deploymentContract?.sourceBindings?.length) errors.push('attested deployment source-binding count diverged from current deployment source tree');
    if (deployment.surfaceCount !== deploymentContract?.surfaces?.length) errors.push('attested deployment surface count diverged from current deployment source tree');
  }

  if (runtimeCapabilityTruth) {
    if (runtimeCapabilityTruth?.ok !== true || runtimeCapabilityTruth?.status !== 'RCL_FOUNDATION_RUNTIME_CAPABILITY_TRUTH_VERIFIED') {
      errors.push('runtime capability truth is not verified');
    }
    if (runtimeCapabilityTruth?.truthRoot !== deployment.capabilityTruthRoot) errors.push('runtime capability truth root diverged from deployment contract');
    if (runtimeCapabilityTruth?.direct?.registryRoot !== deployment.directRegistryRoot) errors.push('runtime direct registry root diverged from deployment contract');
    if (runtimeCapabilityTruth?.providerBridge?.registryRoot !== deployment.providerBridgeRegistryRoot) errors.push('runtime Provider bridge registry root diverged from deployment contract');
  }

  const ok = errors.length === 0;
  return {
    ok,
    status: ok
      ? 'RCL_FOUNDATION_RELEASE_DEPLOYMENT_SOURCE_PARITY_VERIFIED'
      : 'RCL_FOUNDATION_RELEASE_DEPLOYMENT_ATTESTATION_FAILED',
    errors,
    attestationRoot: attestation.attestationRoot ?? null,
    artifactSha256: release.artifactSha256 ?? null,
    releaseContractRoot: release.runtimeTruthContractRoot ?? null,
    deploymentContractRoot: deployment.runtimeTruthContractRoot ?? null,
    capabilityTruthRoot: deployment.capabilityTruthRoot ?? null,
    directRegistryRoot: deployment.directRegistryRoot ?? null,
    providerBridgeRegistryRoot: deployment.providerBridgeRegistryRoot ?? null,
    sourceBindingCount: deployment.sourceBindingCount ?? 0,
    surfaceCount: deployment.surfaceCount ?? 0,
    truthBoundary: boundary,
  };
}
