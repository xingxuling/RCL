#!/usr/bin/env node
import { runtimeCapabilityTruthSurface } from '../api/capability-truth.mjs';

function fail(message, details = {}) {
  console.error(JSON.stringify({
    ok: false,
    status: 'RCL_FOUNDATION_KNOWLEDGE_CYCLE85_RUNTIME_TRUTH_FAILED',
    message,
    ...details,
  }, null, 2));
  process.exit(1);
}
function isSha256(value) { return typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value); }

try {
  const surface = runtimeCapabilityTruthSurface({ requireKnowledgeMultiLearn: true });
  if (surface?.ok !== true || surface?.status !== 'RCL_FOUNDATION_RUNTIME_CAPABILITY_TRUTH_VERIFIED') {
    fail('Runtime capability truth surface did not verify with bounded multi-Learn evidence required.', { surface });
  }
  for (const value of [
    surface?.truthRoot,
    surface?.direct?.registryRoot,
    surface?.providerBridge?.registryRoot,
    surface?.runtimeTruthRoot,
  ]) {
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
    || knowledge?.status !== 'deployment-bound'
    || knowledge?.maxBoundaryLoweredClaimCount !== 4
    || knowledge?.truthBoundary?.maxBoundaryRuntimeTruthBound !== true
    || knowledge?.truthBoundary?.providerBridgeRemovedGlobally !== false
    || knowledge?.truthBoundary?.allKnowledgeProgramsNativeClaimed !== false
    || knowledge?.truthBoundary?.fullHistoryParityClaimed !== false
  ) {
    fail('Existing canonical Knowledge deployment truth regressed while binding bounded multi-Learn evidence.', { knowledge });
  }

  const multiLearn = surface?.knowledgeMultiLearnEvidence;
  if (
    multiLearn?.ok !== true
    || multiLearn?.present !== true
    || multiLearn?.verified !== true
    || multiLearn?.status !== 'runtime-bound'
    || multiLearn?.domain !== 'knowledge'
    || multiLearn?.loweredLearnCount !== 2
    || multiLearn?.loweredClaimCount !== 3
    || JSON.stringify(multiLearn?.declarations) !== JSON.stringify(['mind', 'context'])
  ) {
    fail('Canonical runtime truth did not bind the exact bounded two-Learn real-C proof.', { multiLearn });
  }

  for (const value of [
    multiLearn?.binarySha256,
    multiLearn?.executionBinarySha256,
    multiLearn?.nativeVmExecutionAttestationRoot,
    multiLearn?.knowledgeReceiptRoot,
    multiLearn?.attestationRoot,
    multiLearn?.runtimeEvidenceRoot,
    multiLearn?.formedAtRoots?.[0]?.root,
    multiLearn?.formedAtRoots?.[1]?.root,
    multiLearn?.formedAtRoots?.[2]?.root,
  ]) {
    if (!isSha256(value)) {
      fail('Bounded multi-Learn runtime truth is missing a required content-addressed binary/evidence/receipt/formation root.', { value, multiLearn });
    }
  }

  const expectedPaths = ['mind.trusted', 'mind.score', 'context.label'];
  const formedPaths = (multiLearn?.formedAtRoots ?? []).map(entry => entry?.path);
  const formedRoots = (multiLearn?.formedAtRoots ?? []).map(entry => entry?.root);
  if (
    JSON.stringify(formedPaths) !== JSON.stringify(expectedPaths)
    || new Set(formedRoots).size !== 3
    || multiLearn.binarySha256 !== multiLearn.executionBinarySha256
  ) {
    fail('Bounded multi-Learn runtime truth lost exact binary identity or sequential formedAtRoot topology.', {
      expectedPaths,
      formedPaths,
      formedRoots,
      binarySha256: multiLearn?.binarySha256 ?? null,
      executionBinarySha256: multiLearn?.executionBinarySha256 ?? null,
    });
  }

  const parity = multiLearn?.parity ?? {};
  if (
    parity.state !== true
    || parity.semanticStateRoot !== true
    || parity.nativeStateRootVerified !== true
    || parity.nativeStateRootParity !== true
    || parity.knowledgeReceipt !== true
    || parity.learnTransactionOrder !== true
    || parity.learnBoundaryContinuity !== true
    || parity.nativeExecutionAttestation !== true
  ) {
    fail('Bounded multi-Learn runtime truth lost state/root/receipt/order/boundary/executable parity.', { parity, multiLearn });
  }

  const boundary = multiLearn?.truthBoundary ?? {};
  if (
    boundary.boundedContiguousMultiLearnKnowledgeSubsetOnly !== true
    || boundary.maxBoundedLearnDirectiveCount !== 2
    || boundary.maxBoundedClaimCountPerLearn !== 4
    || boundary.verifiedLearnDirectiveCount !== 2
    || boundary.verifiedClaimCount !== 3
    || boundary.separateOrderedAtomicTransactionsRequired !== true
    || boundary.exactReferenceNativeDomainReceiptParityRequired !== true
    || boundary.crossLearnBoundaryRootContinuityRequired !== true
    || boundary.canonicalRealCExecutionRequiredForVerifiedStatus !== true
    || boundary.runtimeTruthBound !== true
    || boundary.threeOrMoreLearnDirectivesNativeClaimed !== false
    || boundary.nonLeadingOrInterleavedLearnNativeClaimed !== false
    || boundary.dependenciesRevisionsDecayAndDerivedKnowledgeRemainProviderBound !== true
    || boundary.providerBridgeRemovedGlobally !== false
    || boundary.allKnowledgeProgramsNativeClaimed !== false
    || boundary.fullHistoryParityClaimed !== false
  ) {
    fail('Bounded multi-Learn runtime truth boundary drifted or overclaimed coverage.', { boundary });
  }

  const runtimeTruth = surface?.runtimeTruth ?? {};
  if (
    runtimeTruth.knowledgeMultiLearnRuntimeBound !== true
    || runtimeTruth.knowledgeMultiLearnRuntimeEvidenceRoot !== multiLearn.runtimeEvidenceRoot
    || runtimeTruth.knowledgeMultiLearnAttestationRoot !== multiLearn.attestationRoot
    || runtimeTruth.knowledgeMultiLearnKnowledgeReceiptRoot !== multiLearn.knowledgeReceiptRoot
    || runtimeTruth.knowledgeMultiLearnExecutionBinarySha256 !== multiLearn.executionBinarySha256
    || runtimeTruth.knowledgeMultiLearnLoweredLearnCount !== 2
    || runtimeTruth.knowledgeMultiLearnLoweredClaimCount !== 3
  ) {
    fail('Canonical runtimeTruthRoot payload did not bind the bounded multi-Learn evidence identity.', { runtimeTruth, multiLearn });
  }

  if (
    surface?.truthBoundary?.knowledgeMultiLearnEvidencePresent !== true
    || surface?.truthBoundary?.knowledgeMultiLearnRuntimeTruthBound !== true
    || surface?.truthBoundary?.knowledgeMultiLearnRuntimeTruthRequired !== true
    || surface?.truthBoundary?.runtimeTruthRootBindsKnowledgeMultiLearnEvidenceWhenPresent !== true
    || surface?.truthBoundary?.knowledgeMultiLearnBindingDoesNotClaimThreeOrMoreLearnDirectives !== true
    || surface?.truthBoundary?.knowledgeMultiLearnBindingDoesNotClaimNonLeadingOrInterleavedLearn !== true
    || surface?.truthBoundary?.knowledgeMultiLearnBindingDoesNotClaimFullHistoryParity !== true
    || surface?.truthBoundary?.knowledgeMultiLearnBindingDoesNotClaimGlobalProviderRemoval !== true
  ) {
    fail('Canonical runtime truth surface lost bounded multi-Learn truth-boundary declarations.', {
      truthBoundary: surface?.truthBoundary ?? null,
    });
  }

  console.log(JSON.stringify({
    ok: true,
    status: 'RCL_FOUNDATION_KNOWLEDGE_CYCLE85_RUNTIME_TRUTH_VERIFIED',
    truthRoot: surface.truthRoot,
    runtimeTruthRoot: surface.runtimeTruthRoot,
    knowledgeDeploymentEvidenceRoot: knowledge.deploymentEvidenceRoot,
    multiLearnRuntimeEvidenceRoot: multiLearn.runtimeEvidenceRoot,
    multiLearnAttestationRoot: multiLearn.attestationRoot,
    multiLearnKnowledgeReceiptRoot: multiLearn.knowledgeReceiptRoot,
    multiLearnNativeVmExecutionAttestationRoot: multiLearn.nativeVmExecutionAttestationRoot,
    multiLearnExecutionBinarySha256: multiLearn.executionBinarySha256,
    multiLearnFormedAtRoots: multiLearn.formedAtRoots,
    loweredLearnCount: multiLearn.loweredLearnCount,
    loweredClaimCount: multiLearn.loweredClaimCount,
    truthBoundary: multiLearn.truthBoundary,
  }, null, 2));
} catch (error) {
  fail(error?.message ?? String(error), { code: error?.code ?? null, stack: error?.stack ?? null });
}
