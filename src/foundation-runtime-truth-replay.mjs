import { foundationRuntimeCapabilityTruthAttestation } from '../api/capability-truth.mjs';

export function replayFoundationRuntimeCapabilityTruthFromSurface(surface) {
  const registry = surface?.deploymentEvidenceRegistry ?? {};
  return foundationRuntimeCapabilityTruthAttestation({
    capability: surface,
    deployment: {
      ...registry,
      evidenceSetRoot: registry.evidenceSetRoot ?? null,
    },
    crossDomainHistory: surface?.crossDomainHistoryEvidence ?? null,
    knowledgeMultiLearn: surface?.knowledgeMultiLearnEvidence ?? null,
    knowledgeDerivedDependency: surface?.knowledgeDerivedDependencyEvidence ?? null,
  });
}
