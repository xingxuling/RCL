import crypto from 'node:crypto';
import { foundationCapabilityTruthSurface } from '../src/foundation-capability-truth-surface.mjs';
import {
  foundationRuntimeDeploymentEvidenceSurface,
} from '../src/foundation-runtime-deployment-evidence-registry.mjs';
import {
  foundationCrossDomainHistoryDeploymentEvidence,
} from '../src/foundation-cross-domain-history-deployment-evidence.mjs';

const RUNTIME_TRUTH_FORMAT = 'taowind.rcl-foundation-runtime-capability-truth.v0.3';
const RUNTIME_TRUTH_VERSION = '0.3.0';

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalize(value[key])]));
  }
  return value;
}

function sha256Canonical(value) {
  return crypto.createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex');
}

export function foundationRuntimeCapabilityTruthAttestation({ capability, deployment, crossDomainHistory = null }) {
  const crossDomainVerified = crossDomainHistory?.ok === true && crossDomainHistory?.verified === true;
  const payload = {
    format: RUNTIME_TRUTH_FORMAT,
    version: RUNTIME_TRUTH_VERSION,
    capabilityTruthRoot: capability?.truthRoot ?? null,
    directRegistryRoot: capability?.direct?.registryRoot ?? null,
    providerBridgeRegistryRoot: capability?.providerBridge?.registryRoot ?? null,
    deploymentEvidenceRegistryRoot: deployment?.registryRoot ?? null,
    deploymentEvidenceSetRoot: deployment?.evidenceSetRoot ?? null,
    directImplementationDomains: [...(deployment?.directImplementationDomains ?? [])],
    registeredDeploymentEvidenceDomains: [...(deployment?.registeredDomains ?? [])],
    completeDirectDeploymentCoverage: deployment?.completeDirectDeploymentCoverage === true,
    crossDomainHistoryBound: crossDomainVerified,
    crossDomainHistoryEvidenceRoot: crossDomainVerified ? crossDomainHistory.deploymentEvidenceRoot : null,
    crossDomainHistoryReferenceRoot: crossDomainVerified ? crossDomainHistory.referenceHistoryRoot : null,
    crossDomainHistoryNativeRoot: crossDomainVerified ? crossDomainHistory.nativeHistoryRoot : null,
    crossDomainHistoryDomains: crossDomainVerified ? [...crossDomainHistory.domains] : [],
  };
  return { ...payload, runtimeTruthRoot: sha256Canonical(payload) };
}

export function runtimeCapabilityTruthSurface({ requireCrossDomainHistory = false } = {}) {
  const capability = foundationCapabilityTruthSurface();
  const deployment = foundationRuntimeDeploymentEvidenceSurface({ requireCompleteDirectCoverage: true });
  let crossDomainHistory;
  try {
    crossDomainHistory = foundationCrossDomainHistoryDeploymentEvidence();
  } catch (error) {
    crossDomainHistory = {
      ok: false,
      present: false,
      verified: false,
      status: 'deployment-unavailable',
      deploymentEvidenceRoot: null,
      errors: [{ code: error?.code ?? 'RCL_CROSS_DOMAIN_HISTORY_RUNTIME_EVIDENCE_UNAVAILABLE', message: error?.message ?? String(error) }],
    };
  }
  const runtimeTruth = foundationRuntimeCapabilityTruthAttestation({ capability, deployment, crossDomainHistory });
  const crossDomainRequiredSatisfied = requireCrossDomainHistory !== true || crossDomainHistory?.ok === true;
  const ok = capability.ok === true
    && deployment.ok === true
    && deployment.evidenceSetVerified === true
    && crossDomainRequiredSatisfied;

  return {
    ...capability,
    ok,
    status: ok
      ? 'RCL_FOUNDATION_RUNTIME_CAPABILITY_TRUTH_VERIFIED'
      : 'RCL_FOUNDATION_RUNTIME_CAPABILITY_TRUTH_DRIFT',
    runtimeTruth,
    runtimeTruthRoot: runtimeTruth.runtimeTruthRoot,
    crossDomainHistoryEvidence: crossDomainHistory,
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
      evidenceSetFormat: deployment.evidenceSetFormat,
      evidenceSetVersion: deployment.evidenceSetVersion,
      evidenceSetRoot: deployment.evidenceSetRoot,
      evidenceSetVerified: deployment.evidenceSetVerified,
      deploymentEvidenceRoots: deployment.deploymentEvidenceRoots,
      truthBoundary: deployment.truthBoundary,
      errors: deployment.errors,
    },
    deploymentEvidence: deployment.evidenceByDomain,
    truthBoundary: {
      ...capability.truthBoundary,
      deploymentEvidenceIsRuntimeSpecific: true,
      deploymentEvidenceDoesNotRewriteVersionedCapabilityTruth: true,
      runtimeDeploymentEvidenceRegistryDoesNotImplyCompleteDirectCoverage:
        deployment.completeDirectDeploymentCoverage !== true,
      runtimeDeploymentEvidenceRegistryDoesNotImplyCompleteDomainCapability: true,
      completeDirectDeploymentEvidenceCoverageClaimed:
        deployment.completeDirectDeploymentCoverage === true,
      completeDirectDeploymentEvidenceCoverageMeansEvidenceCoverageNotFullDomainNativeCoverage: true,
      runtimeTruthRootBindsVersionedCapabilityAndDeploymentEvidenceSet: true,
      deploymentEvidenceSetRootBindsPerDomainEvidenceRoots: true,
      crossDomainHistoryEvidencePresent: crossDomainHistory?.present === true,
      crossDomainHistoryRuntimeTruthBound: crossDomainHistory?.ok === true,
      crossDomainHistoryRuntimeTruthRequired: requireCrossDomainHistory === true,
      runtimeTruthRootBindsCrossDomainHistoryEvidenceWhenPresent: crossDomainHistory?.ok === true,
      crossDomainHistoryBindingDoesNotClaimFullHistoryParity: true,
      crossDomainHistoryBindingDoesNotClaimAllFoundationDomainHistoryParity: true,
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
