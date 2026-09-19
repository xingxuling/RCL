import { foundationCapabilityTruthSurface } from '../src/foundation-capability-truth-surface.mjs';
import { foundationEnergyDeploymentEvidence } from '../src/foundation-energy-deployment-evidence.mjs';

export function runtimeCapabilityTruthSurface() {
  const capability = foundationCapabilityTruthSurface();
  let energy;
  try {
    energy = foundationEnergyDeploymentEvidence();
  } catch (error) {
    energy = {
      ok: false,
      format: 'taowind.rcl-foundation-energy-deployment-evidence.v0.1',
      version: '0.1.0',
      domain: 'energy',
      status: 'deployment-unavailable',
      verified: false,
      deploymentEvidenceRoot: null,
      errors: [{
        code: error?.code ?? 'RCL_ENERGY_DEPLOYMENT_EVIDENCE_UNAVAILABLE',
        message: error?.message ?? String(error),
      }],
    };
  }

  const ok = capability.ok === true && energy.ok === true;
  return {
    ...capability,
    ok,
    status: ok
      ? 'RCL_FOUNDATION_RUNTIME_CAPABILITY_TRUTH_VERIFIED'
      : 'RCL_FOUNDATION_RUNTIME_CAPABILITY_TRUTH_DRIFT',
    deploymentEvidence: {
      energy,
    },
    truthBoundary: {
      ...capability.truthBoundary,
      deploymentEvidenceIsRuntimeSpecific: true,
      deploymentEvidenceDoesNotRewriteVersionedCapabilityTruth: true,
      energyProviderBridgeMayCoexistWithBoundedDirectVerification: true,
    },
  };
}

export default function handler(_request, response) {
  let surface;
  try {
    surface = runtimeCapabilityTruthSurface();
  } catch (error) {
    response.writeHead(503, { 'content-type': 'application/json; charset=utf-8' });
    response.end(`${JSON.stringify({
      ok: false,
      status: 'RCL_FOUNDATION_CAPABILITY_TRUTH_SURFACE_UNAVAILABLE',
      error: error?.message ?? String(error),
    })}\n`);
    return;
  }

  response.writeHead(surface.ok ? 200 : 503, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'public, max-age=0, must-revalidate',
  });
  response.end(`${JSON.stringify(surface)}\n`);
}
