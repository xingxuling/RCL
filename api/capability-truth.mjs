import crypto from 'node:crypto';
import { foundationCapabilityTruthSurface } from '../src/foundation-capability-truth-surface.mjs';
import { foundationRuntimeDeploymentEvidenceSurface } from '../src/foundation-runtime-deployment-evidence-registry.mjs';
import { foundationCrossDomainHistoryDeploymentEvidence } from '../src/foundation-cross-domain-history-deployment-evidence.mjs';
import { foundationKnowledgeMultiLearnRuntimeEvidence } from '../src/foundation-knowledge-multi-learn-runtime-evidence.mjs';
import { foundationKnowledgeDerivedRuntimeEvidence } from '../src/foundation-knowledge-derived-runtime-evidence.mjs';

const RUNTIME_TRUTH_FORMAT = 'taowind.rcl-foundation-runtime-capability-truth.v0.6';
const RUNTIME_TRUTH_VERSION = '0.6.0';

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalize(value[key])]));
  return value;
}

function sha256Canonical(value) {
  return crypto.createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex');
}

export function foundationRuntimeCapabilityTruthAttestation({ capability, deployment, crossDomainHistory = null, knowledgeMultiLearn = null, knowledgeDerivedDependency = null }) {
  const crossDomainVerified = crossDomainHistory?.ok === true && crossDomainHistory?.verified === true;
  const knowledgeMultiLearnVerified = knowledgeMultiLearn?.present === true && knowledgeMultiLearn?.ok === true && knowledgeMultiLearn?.verified === true;
  const knowledgeMultiLearnMaxBoundaryVerified = knowledgeMultiLearnVerified
    && knowledgeMultiLearn?.maxBoundaryPresent === true
    && knowledgeMultiLearn?.maxBoundaryVerified === true
    && knowledgeMultiLearn?.truthBoundary?.maxBoundaryRuntimeTruthBound === true;
  const knowledgeDerivedVerified = knowledgeDerivedDependency?.present === true
    && knowledgeDerivedDependency?.ok === true
    && knowledgeDerivedDependency?.verified === true
    && knowledgeDerivedDependency?.truthBoundary?.boundedDerivedKnowledgeDependencySubsetNativeClaimed === true;
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
    knowledgeMultiLearnRuntimeBound: knowledgeMultiLearnVerified,
    knowledgeMultiLearnRuntimeEvidenceRoot: knowledgeMultiLearnVerified ? knowledgeMultiLearn.runtimeEvidenceRoot : null,
    knowledgeMultiLearnAttestationRoot: knowledgeMultiLearnVerified ? knowledgeMultiLearn.attestationRoot : null,
    knowledgeMultiLearnKnowledgeReceiptRoot: knowledgeMultiLearnVerified ? knowledgeMultiLearn.knowledgeReceiptRoot : null,
    knowledgeMultiLearnExecutionBinarySha256: knowledgeMultiLearnVerified ? knowledgeMultiLearn.executionBinarySha256 : null,
    knowledgeMultiLearnLoweredLearnCount: knowledgeMultiLearnVerified ? knowledgeMultiLearn.loweredLearnCount : null,
    knowledgeMultiLearnLoweredClaimCount: knowledgeMultiLearnVerified ? knowledgeMultiLearn.loweredClaimCount : null,
    knowledgeMultiLearnMaxBoundaryRuntimeBound: knowledgeMultiLearnMaxBoundaryVerified,
    knowledgeMultiLearnMaxBoundaryAttestationRoot: knowledgeMultiLearnMaxBoundaryVerified ? knowledgeMultiLearn.maxBoundaryAttestationRoot : null,
    knowledgeMultiLearnMaxBoundaryKnowledgeReceiptRoot: knowledgeMultiLearnMaxBoundaryVerified ? knowledgeMultiLearn.maxBoundaryKnowledgeReceiptRoot : null,
    knowledgeMultiLearnMaxBoundaryExecutionBinarySha256: knowledgeMultiLearnMaxBoundaryVerified ? knowledgeMultiLearn.maxBoundaryExecutionBinarySha256 : null,
    knowledgeMultiLearnMaxBoundaryLoweredLearnCount: knowledgeMultiLearnMaxBoundaryVerified ? knowledgeMultiLearn.maxBoundaryLoweredLearnCount : null,
    knowledgeMultiLearnMaxBoundaryLoweredClaimCount: knowledgeMultiLearnMaxBoundaryVerified ? knowledgeMultiLearn.maxBoundaryLoweredClaimCount : null,
    knowledgeMultiLearnMaxBoundaryClaimPaths: knowledgeMultiLearnMaxBoundaryVerified ? [...knowledgeMultiLearn.maxBoundaryClaimPaths] : [],
    knowledgeMultiLearnMaxBoundaryFormedAtRoots: knowledgeMultiLearnMaxBoundaryVerified ? knowledgeMultiLearn.maxBoundaryFormedAtRoots.map(entry => entry.root) : [],
    knowledgeDerivedDependencyRuntimeBound: knowledgeDerivedVerified,
    knowledgeDerivedDependencyRuntimeEvidenceRoot: knowledgeDerivedVerified ? knowledgeDerivedDependency.runtimeEvidenceRoot : null,
    knowledgeDerivedDependencyAttestationRoot: knowledgeDerivedVerified ? knowledgeDerivedDependency.attestationRoot : null,
    knowledgeDerivedDependencyKnowledgeReceiptRoot: knowledgeDerivedVerified ? knowledgeDerivedDependency.knowledgeReceiptRoot : null,
    knowledgeDerivedDependencyExecutionBinarySha256: knowledgeDerivedVerified ? knowledgeDerivedDependency.executionBinarySha256 : null,
    knowledgeDerivedDependencyPath: knowledgeDerivedVerified ? knowledgeDerivedDependency.derivedKnowledge?.path ?? null : null,
    knowledgeDerivedDependencyPaths: knowledgeDerivedVerified ? [...(knowledgeDerivedDependency.derivedKnowledge?.dependencies ?? [])] : [],
    knowledgeDerivedDependencyConfidence: knowledgeDerivedVerified ? knowledgeDerivedDependency.derivedKnowledge?.confidence ?? null : null,
    knowledgeDerivedDependencyFormedAtRoots: knowledgeDerivedVerified
      ? ['mind.trusted', 'mind.score', 'mind.ready'].map(pathName => knowledgeDerivedDependency.formedAtRoots?.[pathName] ?? null)
      : [],
  };
  return { ...payload, runtimeTruthRoot: sha256Canonical(payload) };
}

export function runtimeCapabilityTruthSurface({ requireCrossDomainHistory = false, requireKnowledgeMultiLearn = false, requireKnowledgeDerivedDependency = false } = {}) {
  const capability = foundationCapabilityTruthSurface();
  const deployment = foundationRuntimeDeploymentEvidenceSurface({ requireCompleteDirectCoverage: true });
  let crossDomainHistory;
  try {
    crossDomainHistory = foundationCrossDomainHistoryDeploymentEvidence();
  } catch (error) {
    crossDomainHistory = { ok: false, present: false, verified: false, status: 'deployment-unavailable', deploymentEvidenceRoot: null, errors: [{ code: error?.code ?? 'RCL_CROSS_DOMAIN_HISTORY_RUNTIME_EVIDENCE_UNAVAILABLE', message: error?.message ?? String(error) }] };
  }
  let knowledgeMultiLearn;
  try {
    knowledgeMultiLearn = foundationKnowledgeMultiLearnRuntimeEvidence();
  } catch (error) {
    knowledgeMultiLearn = { ok: false, present: false, verified: false, status: 'runtime-unavailable', runtimeEvidenceRoot: null, maxBoundaryPresent: false, maxBoundaryVerified: false, errors: [{ code: error?.code ?? 'RCL_KNOWLEDGE_MULTI_LEARN_RUNTIME_EVIDENCE_UNAVAILABLE', message: error?.message ?? String(error) }] };
  }
  let knowledgeDerivedDependency;
  try {
    knowledgeDerivedDependency = foundationKnowledgeDerivedRuntimeEvidence();
  } catch (error) {
    knowledgeDerivedDependency = { ok: false, present: false, verified: false, status: 'runtime-unavailable', runtimeEvidenceRoot: null, errors: [{ code: error?.code ?? 'RCL_KNOWLEDGE_DERIVED_RUNTIME_EVIDENCE_UNAVAILABLE', message: error?.message ?? String(error) }] };
  }
  const runtimeTruth = foundationRuntimeCapabilityTruthAttestation({ capability, deployment, crossDomainHistory, knowledgeMultiLearn, knowledgeDerivedDependency });
  const crossDomainRequiredSatisfied = requireCrossDomainHistory !== true || crossDomainHistory?.ok === true;
  const knowledgeMultiLearnPresentSatisfied = knowledgeMultiLearn?.present !== true || knowledgeMultiLearn?.ok === true;
  const knowledgeMultiLearnRequiredSatisfied = requireKnowledgeMultiLearn !== true || (knowledgeMultiLearn?.present === true && knowledgeMultiLearn?.ok === true && knowledgeMultiLearn?.verified === true);
  const knowledgeDerivedPresentSatisfied = knowledgeDerivedDependency?.present !== true || knowledgeDerivedDependency?.ok === true;
  const knowledgeDerivedRequiredSatisfied = requireKnowledgeDerivedDependency !== true
    || (knowledgeDerivedDependency?.present === true && knowledgeDerivedDependency?.ok === true && knowledgeDerivedDependency?.verified === true);
  const ok = capability.ok === true
    && deployment.ok === true
    && deployment.evidenceSetVerified === true
    && crossDomainRequiredSatisfied
    && knowledgeMultiLearnPresentSatisfied
    && knowledgeMultiLearnRequiredSatisfied
    && knowledgeDerivedPresentSatisfied
    && knowledgeDerivedRequiredSatisfied;

  return {
    ...capability,
    ok,
    status: ok ? 'RCL_FOUNDATION_RUNTIME_CAPABILITY_TRUTH_VERIFIED' : 'RCL_FOUNDATION_RUNTIME_CAPABILITY_TRUTH_DRIFT',
    runtimeTruth,
    runtimeTruthRoot: runtimeTruth.runtimeTruthRoot,
    crossDomainHistoryEvidence: crossDomainHistory,
    knowledgeMultiLearnEvidence: knowledgeMultiLearn,
    knowledgeDerivedDependencyEvidence: knowledgeDerivedDependency,
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
      runtimeDeploymentEvidenceRegistryDoesNotImplyCompleteDirectCoverage: deployment.completeDirectDeploymentCoverage !== true,
      runtimeDeploymentEvidenceRegistryDoesNotImplyCompleteDomainCapability: true,
      completeDirectDeploymentEvidenceCoverageClaimed: deployment.completeDirectDeploymentCoverage === true,
      completeDirectDeploymentEvidenceCoverageMeansEvidenceCoverageNotFullDomainNativeCoverage: true,
      runtimeTruthRootBindsVersionedCapabilityAndDeploymentEvidenceSet: true,
      deploymentEvidenceSetRootBindsPerDomainEvidenceRoots: true,
      crossDomainHistoryEvidencePresent: crossDomainHistory?.present === true,
      crossDomainHistoryRuntimeTruthBound: crossDomainHistory?.ok === true,
      crossDomainHistoryRuntimeTruthRequired: requireCrossDomainHistory === true,
      runtimeTruthRootBindsCrossDomainHistoryEvidenceWhenPresent: crossDomainHistory?.ok === true,
      crossDomainHistoryBindingDoesNotClaimFullHistoryParity: true,
      crossDomainHistoryBindingDoesNotClaimAllFoundationDomainHistoryParity: true,
      knowledgeMultiLearnEvidencePresent: knowledgeMultiLearn?.present === true,
      knowledgeMultiLearnRuntimeTruthBound: knowledgeMultiLearn?.present === true && knowledgeMultiLearn?.ok === true,
      knowledgeMultiLearnRuntimeTruthRequired: requireKnowledgeMultiLearn === true,
      runtimeTruthRootBindsKnowledgeMultiLearnEvidenceWhenPresent: knowledgeMultiLearn?.present === true && knowledgeMultiLearn?.ok === true,
      knowledgeMultiLearnMaxBoundaryEvidencePresent: knowledgeMultiLearn?.maxBoundaryPresent === true,
      knowledgeMultiLearnMaxBoundaryRuntimeTruthBound: knowledgeMultiLearn?.maxBoundaryPresent === true && knowledgeMultiLearn?.maxBoundaryVerified === true && knowledgeMultiLearn?.truthBoundary?.maxBoundaryRuntimeTruthBound === true,
      runtimeTruthRootBindsKnowledgeMultiLearnMaxBoundaryEvidenceWhenPresent: knowledgeMultiLearn?.maxBoundaryPresent === true && knowledgeMultiLearn?.maxBoundaryVerified === true && knowledgeMultiLearn?.truthBoundary?.maxBoundaryRuntimeTruthBound === true,
      knowledgeMultiLearnBindingDoesNotClaimThreeOrMoreLearnDirectives: true,
      knowledgeMultiLearnBindingDoesNotClaimFiveOrMoreClaimsPerLearn: true,
      knowledgeMultiLearnBindingDoesNotClaimNonLeadingOrInterleavedLearn: true,
      knowledgeMultiLearnBindingDoesNotClaimFullHistoryParity: true,
      knowledgeMultiLearnBindingDoesNotClaimGlobalProviderRemoval: true,
      knowledgeDerivedDependencyEvidencePresent: knowledgeDerivedDependency?.present === true,
      knowledgeDerivedDependencyRuntimeTruthBound: knowledgeDerivedDependency?.present === true && knowledgeDerivedDependency?.ok === true,
      knowledgeDerivedDependencyRuntimeTruthRequired: requireKnowledgeDerivedDependency === true,
      runtimeTruthRootBindsKnowledgeDerivedDependencyEvidenceWhenPresent: knowledgeDerivedDependency?.present === true && knowledgeDerivedDependency?.ok === true,
      knowledgeDerivedDependencyBindingRemainsBounded: true,
      knowledgeDerivedDependencyBindingDoesNotClaimRevisionsOrDecay: true,
      knowledgeDerivedDependencyBindingDoesNotClaimDynamicDerivedExpressions: true,
      knowledgeDerivedDependencyBindingDoesNotClaimUnrestrictedDependencies: true,
      knowledgeDerivedDependencyBindingDoesNotClaimGlobalProviderRemoval: true,
      knowledgeDerivedDependencyBindingDoesNotClaimFullHistoryParity: true,
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
    response.end(`${JSON.stringify({ ok: false, status: 'RCL_FOUNDATION_CAPABILITY_TRUTH_SURFACE_UNAVAILABLE', error: error?.message ?? String(error) })}\n`);
    return;
  }
  response.writeHead(surface.ok ? 200 : 503, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=0, must-revalidate' });
  response.end(`${JSON.stringify(surface)}\n`);
}
