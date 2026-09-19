import { foundationCapabilityTruthSurface } from '../src/foundation-capability-truth-surface.mjs';
import {
  foundationRuntimeDeploymentEvidenceSurface,
} from '../src/foundation-runtime-deployment-evidence-registry.mjs';

export function runtimeCapabilityTruthSurface() {
  const capability = foundationCapabilityTruthSurface();
  const deployment = foundationRuntimeDeploymentEvidenceSurface();
  const ok = capability.ok === true && deployment.ok === true;

  return {
    ...capability,
    ok,
    status: ok
      ? 'RCL_FOUNDATION_RUNTIME_CAPABILITY_TRUTH_VERIFIED'
      : 'RCL_FOUNDATION_RUNTIME_CAPABILITY_TRUTH_DRIFT',
    deploymentEvidenceRegistry: {
      format: deployment.format,
      version: deployment.version,
      registryRoot: deployment.registryRoot,
      providers: deployment.providers,
      registeredDomains: deployment.registeredDomains,
      registeredDomainCount: deployment.registeredDomainCount,
      directImplementationDomains: deployment.directImplementationDomains,
      directImplementationDomainCount: deployment.directImplementationDomainCount,
      missingDirectDeploymentEvidenceDomains: deployment.missingDirectDeploymentEvidenceDomains,
      completeDirectDeploymentCoverage: deployment.completeDirectDeploymentCoverage,
      truthBoundary: deployment.truthBoundary,
      errors: deployment.errors,
    },
    deploymentEvidence: deployment.evidenceByDomain,
    truthBoundary: {
      ...capability.truthBoundary,
      deploymentEvidenceIsRuntimeSpecific: true,
      deploymentEvidenceDoesNotRewriteVersionedCapabilityTruth: true,
      runtimeDeploymentEvidenceRegistryDoesNotImplyCompleteDirectCoverage: true,
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
