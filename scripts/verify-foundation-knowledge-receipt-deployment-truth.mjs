#!/usr/bin/env node
import { runtimeCapabilityTruthSurface } from '../api/capability-truth.mjs';

function fail(message, details = {}) {
  console.error(JSON.stringify({ ok: false, status: 'RCL_FOUNDATION_KNOWLEDGE_RECEIPT_RUNTIME_TRUTH_FAILED', message, ...details }, null, 2));
  process.exit(1);
}
function isSha256(value) { return typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value); }

try {
  const surface = runtimeCapabilityTruthSurface();
  if (surface?.ok !== true || surface?.status !== 'RCL_FOUNDATION_RUNTIME_CAPABILITY_TRUTH_VERIFIED') {
    fail('Runtime capability truth surface did not verify.', { surface });
  }
  for (const value of [surface?.truthRoot, surface?.direct?.registryRoot, surface?.providerBridge?.registryRoot, surface?.runtimeTruthRoot]) {
    if (!isSha256(value)) fail('Runtime capability truth lost a required content-addressed root.', { value, surface });
  }
  if (!surface?.direct?.domains?.includes('knowledge')) {
    fail('Executable direct capability registry no longer declares the bounded Knowledge implementation.', { direct: surface?.direct ?? null });
  }
  if (!surface?.providerBridge?.domains?.includes('knowledge')) {
    fail('Runtime capability truth incorrectly removed the Knowledge Provider bridge coexistence path.', { providerBridge: surface?.providerBridge ?? null });
  }

  const knowledge = surface?.deploymentEvidence?.knowledge;
  if (
    knowledge?.ok !== true
    || knowledge?.verified !== true
    || knowledge?.domain !== 'knowledge'
    || knowledge?.status !== 'deployment-bound'
    || knowledge?.loweredDirectiveCount !== 1
    || knowledge?.loweredClaimCount !== 1
  ) {
    fail('Runtime capability truth did not bind the bounded Knowledge deployment proof.', { knowledge });
  }

  for (const value of [
    knowledge?.binarySha256,
    knowledge?.executionBinarySha256,
    knowledge?.nativeVmExecutionAttestationRoot,
    knowledge?.initialStateRoot,
    knowledge?.knowledgeReceiptRoot,
    knowledge?.deploymentEvidenceRoot,
  ]) {
    if (!isSha256(value)) fail('Knowledge runtime truth is missing a required content-addressed execution/evidence/receipt root.', { value, knowledge });
  }
  if (knowledge.binarySha256 !== knowledge.executionBinarySha256) {
    fail('Knowledge runtime truth is not bound to the exact deployed canonical Native VM binary.', { knowledge });
  }
  if (
    knowledge?.finalState?.['mind.trusted']?.kind !== 'Knowledge'
    || knowledge?.finalState?.['mind.trusted']?.formedAtRoot !== knowledge.initialStateRoot
    || knowledge?.finalState?.['decision.allowed'] !== true
  ) {
    fail('Knowledge runtime truth lost the verified bounded claim/accessor final state.', { finalState: knowledge?.finalState ?? null });
  }
  if (
    surface?.truthBoundary?.deploymentEvidenceIsRuntimeSpecific !== true
    || surface?.truthBoundary?.deploymentEvidenceDoesNotRewriteVersionedCapabilityTruth !== true
    || knowledge?.truthBoundary?.boundedSingleClaimKnowledgeSubsetOnly !== true
    || knowledge?.truthBoundary?.exactReferenceNativeDomainReceiptParityRequired !== true
    || knowledge?.truthBoundary?.providerBridgeRemovedGlobally !== false
    || knowledge?.truthBoundary?.allKnowledgeProgramsNativeClaimed !== false
    || knowledge?.truthBoundary?.knowledgeDomainReceiptParityClaimed !== true
    || knowledge?.truthBoundary?.fullHistoryParityClaimed !== false
  ) {
    fail('Runtime Knowledge truth boundary drifted or overclaimed receipt/direct-native coverage.', {
      surfaceBoundary: surface?.truthBoundary ?? null,
      knowledgeBoundary: knowledge?.truthBoundary ?? null,
    });
  }

  console.log(JSON.stringify({
    ok: true,
    status: 'RCL_FOUNDATION_KNOWLEDGE_RECEIPT_RUNTIME_TRUTH_VERIFIED',
    truthRoot: surface.truthRoot,
    directRegistryRoot: surface.direct.registryRoot,
    providerBridgeRegistryRoot: surface.providerBridge.registryRoot,
    runtimeTruthRoot: surface.runtimeTruthRoot,
    knowledgeDeploymentEvidenceRoot: knowledge.deploymentEvidenceRoot,
    knowledgeReceiptRoot: knowledge.knowledgeReceiptRoot,
    initialStateRoot: knowledge.initialStateRoot,
    nativeVmExecutionAttestationRoot: knowledge.nativeVmExecutionAttestationRoot,
    binarySha256: knowledge.binarySha256,
  }, null, 2));
} catch (error) {
  fail(error?.message ?? String(error), { code: error?.code ?? null, stack: error?.stack ?? null });
}
