import { foundationRuntimeTruthContractRoot } from '../src/foundation-runtime-truth-contract.mjs';
import { verifyFoundationReleaseDeploymentAttestation } from '../src/foundation-release-deployment-source-parity.mjs';
import {
  FOUNDATION_RELEASE_RUNTIME_TRUTH_ATTESTATION,
  FOUNDATION_RELEASE_RUNTIME_TRUTH_DEPLOYMENT_CONTRACT,
} from '../src/generated/developer-release-runtime-truth-attestation.mjs';
import { runtimeCapabilityTruthSurface } from './capability-truth.mjs';

function isSha256(value) {
  return typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value);
}

export function releaseRuntimeTruthStatus({
  attestation = FOUNDATION_RELEASE_RUNTIME_TRUTH_ATTESTATION,
  deploymentContract = FOUNDATION_RELEASE_RUNTIME_TRUTH_DEPLOYMENT_CONTRACT,
  runtimeSurface = null,
} = {}) {
  if (!deploymentContract || !attestation) {
    return {
      ok: false,
      status: 'RCL_RELEASE_RUNTIME_TRUTH_BUILD_ATTESTATION_MISSING',
      truthBoundary: {
        buildTimeAttestationRequired: true,
        runtimeRequestRehashesFullDeploymentSourceTreeClaimed: false,
      },
    };
  }

  let computedContractRoot = null;
  try {
    computedContractRoot = foundationRuntimeTruthContractRoot(deploymentContract);
  } catch (error) {
    return {
      ok: false,
      status: 'RCL_RELEASE_RUNTIME_TRUTH_DEPLOYMENT_CONTRACT_INVALID',
      error: error?.message ?? String(error),
    };
  }
  if (!isSha256(deploymentContract.contractRoot) || computedContractRoot !== deploymentContract.contractRoot) {
    return {
      ok: false,
      status: 'RCL_RELEASE_RUNTIME_TRUTH_DEPLOYMENT_CONTRACT_ROOT_DRIFT',
      expected: deploymentContract.contractRoot ?? null,
      actual: computedContractRoot,
    };
  }

  const runtimeCapabilityTruth = runtimeSurface ?? runtimeCapabilityTruthSurface();
  const verification = verifyFoundationReleaseDeploymentAttestation(attestation, {
    deploymentContract,
    runtimeCapabilityTruth,
  });
  return {
    ...verification,
    deploymentContractVerification: 'RCL_FOUNDATION_RUNTIME_TRUTH_CONTRACT_ROOT_VERIFIED',
    runtimeCapabilityTruthStatus: runtimeCapabilityTruth?.status ?? null,
    runtimeObservation: {
      releaseRuntimeTruthSurfaceObserved: verification.ok === true,
      deploymentBuildSourceContractAttestationVerified: verification.ok === true,
      runtimeCapabilityTruthReverified: runtimeCapabilityTruth?.ok === true,
      runtimeRequestRehashesFullDeploymentSourceTree: false,
      developerReleaseArtifactRetainedInDeploymentObserved: false,
      developerReleaseInstalledAsDeploymentRuntimeObserved: false,
    },
  };
}

export default function handler(_request, response) {
  let status;
  try {
    status = releaseRuntimeTruthStatus();
  } catch (error) {
    response.writeHead(503, { 'content-type': 'application/json; charset=utf-8' });
    response.end(`${JSON.stringify({
      ok: false,
      status: 'RCL_RELEASE_RUNTIME_TRUTH_UNAVAILABLE',
      error: error?.message ?? String(error),
    })}\n`);
    return;
  }
  response.writeHead(status.ok ? 200 : 503, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'public, max-age=0, must-revalidate',
  });
  response.end(`${JSON.stringify(status)}\n`);
}
