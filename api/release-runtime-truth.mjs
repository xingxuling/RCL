import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createFoundationRuntimeTruthContract,
  verifyFoundationRuntimeTruthContract,
} from '../src/foundation-runtime-truth-contract.mjs';
import { verifyFoundationReleaseDeploymentAttestation } from '../src/foundation-release-deployment-source-parity.mjs';
import { runtimeCapabilityTruthSurface } from './capability-truth.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ATTESTATION_PATH = path.join(ROOT, 'public', 'developer-release-runtime-truth-attestation.json');

export function releaseRuntimeTruthStatus({ rootDir = ROOT, attestation = null, runtimeSurface = null } = {}) {
  const deploymentContract = createFoundationRuntimeTruthContract(rootDir);
  const deploymentVerification = verifyFoundationRuntimeTruthContract(deploymentContract, { rootDir });
  if (deploymentVerification.ok !== true) {
    return {
      ok: false,
      status: 'RCL_RELEASE_RUNTIME_TRUTH_DEPLOYMENT_CONTRACT_FAILED',
      deploymentVerification,
    };
  }

  let persistedAttestation = attestation;
  if (!persistedAttestation) {
    if (!fs.existsSync(ATTESTATION_PATH)) {
      return {
        ok: false,
        status: 'RCL_RELEASE_RUNTIME_TRUTH_ATTESTATION_MISSING',
        attestationPath: ATTESTATION_PATH,
      };
    }
    persistedAttestation = JSON.parse(fs.readFileSync(ATTESTATION_PATH, 'utf8'));
  }

  const runtimeCapabilityTruth = runtimeSurface ?? runtimeCapabilityTruthSurface();
  const verification = verifyFoundationReleaseDeploymentAttestation(persistedAttestation, {
    deploymentContract,
    runtimeCapabilityTruth,
  });
  return {
    ...verification,
    deploymentContractVerification: deploymentVerification.status,
    runtimeCapabilityTruthStatus: runtimeCapabilityTruth?.status ?? null,
    runtimeObservation: {
      releaseRuntimeTruthSurfaceObserved: verification.ok === true,
      deployedSourceTreeContractReverified: deploymentVerification.ok === true,
      runtimeCapabilityTruthReverified: runtimeCapabilityTruth?.ok === true,
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
