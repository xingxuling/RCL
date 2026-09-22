#!/usr/bin/env node
import { runtimeCapabilityTruthSurface } from '../api/capability-truth.mjs';

function fail(message, details = {}) {
  console.error(JSON.stringify({ ok: false, status: 'RCL_FOUNDATION_KNOWLEDGE_RUNTIME_TRUTH_FAILED', message, ...details }, null, 2));
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
    || knowledge?.loweredClaimCount !== 2
    || knowledge?.maxBoundaryLoweredClaimCount !== 4
  ) {
    fail('Runtime capability truth did not bind both the two-claim behavioral specimen and the exact four-claim Knowledge max-boundary proof.', { knowledge });
  }

  for (const value of [
    knowledge?.binarySha256,
    knowledge?.executionBinarySha256,
    knowledge?.nativeVmExecutionAttestationRoot,
    knowledge?.initialStateRoot,
    knowledge?.claimFormedAtRoots?.['mind.trusted'],
    knowledge?.claimFormedAtRoots?.['mind.score'],
    knowledge?.knowledgeReceiptRoot,
    knowledge?.maxBoundaryAttestationRoot,
    knowledge?.maxBoundaryExecutionBinarySha256,
    knowledge?.maxBoundaryNativeVmExecutionAttestationRoot,
    knowledge?.maxBoundaryKnowledgeReceiptRoot,
    knowledge?.maxBoundaryClaimFormedAtRoots?.['mind.trusted'],
    knowledge?.maxBoundaryClaimFormedAtRoots?.['mind.score'],
    knowledge?.maxBoundaryClaimFormedAtRoots?.['mind.label'],
    knowledge?.maxBoundaryClaimFormedAtRoots?.['mind.rank'],
    knowledge?.deploymentEvidenceRoot,
  ]) {
    if (!isSha256(value)) fail('Knowledge runtime truth is missing a required content-addressed execution/evidence/formation/receipt/max-boundary root.', { value, knowledge });
  }
  const maxRoots = [
    knowledge?.maxBoundaryClaimFormedAtRoots?.['mind.trusted'],
    knowledge?.maxBoundaryClaimFormedAtRoots?.['mind.score'],
    knowledge?.maxBoundaryClaimFormedAtRoots?.['mind.label'],
    knowledge?.maxBoundaryClaimFormedAtRoots?.['mind.rank'],
  ];
  if (
    knowledge.binarySha256 !== knowledge.executionBinarySha256
    || knowledge.binarySha256 !== knowledge.maxBoundaryExecutionBinarySha256
    || knowledge.initialStateRoot !== knowledge?.claimFormedAtRoots?.['mind.trusted']
    || knowledge?.claimFormedAtRoots?.['mind.trusted'] === knowledge?.claimFormedAtRoots?.['mind.score']
    || new Set(maxRoots).size !== 4
  ) {
    fail('Knowledge runtime truth is not bound to one exact Native VM binary and the required sequential claim-formation root topology.', { knowledge, maxRoots });
  }
  if (
    knowledge?.finalState?.['mind.trusted']?.kind !== 'Knowledge'
    || knowledge?.finalState?.['mind.trusted']?.formedAtRoot !== knowledge?.claimFormedAtRoots?.['mind.trusted']
    || knowledge?.finalState?.['mind.score']?.kind !== 'Knowledge'
    || knowledge?.finalState?.['mind.score']?.formedAtRoot !== knowledge?.claimFormedAtRoots?.['mind.score']
    || knowledge?.finalState?.['mind.score']?.value !== 7
    || knowledge?.finalState?.['decision.allowed'] !== true
    || knowledge?.finalState?.['decision.score'] !== 7
  ) {
    fail('Knowledge runtime truth lost the verified bounded behavioral specimen/accessor final state.', { finalState: knowledge?.finalState ?? null });
  }
  if (
    surface?.truthBoundary?.deploymentEvidenceIsRuntimeSpecific !== true
    || surface?.truthBoundary?.deploymentEvidenceDoesNotRewriteVersionedCapabilityTruth !== true
    || knowledge?.truthBoundary?.boundedPrimitiveMultiClaimKnowledgeSubsetOnly !== true
    || knowledge?.truthBoundary?.maxBoundedClaimCount !== 4
    || knowledge?.truthBoundary?.behavioralSpecimenVerifiedAtomicClaimCount !== 2
    || knowledge?.truthBoundary?.verifiedAtomicClaimCount !== 4
    || knowledge?.truthBoundary?.maxBoundedClaimCountRealCVerified !== true
    || knowledge?.truthBoundary?.maxBoundaryRuntimeTruthBound !== true
    || knowledge?.truthBoundary?.overBoundaryFiveClaimsRemainProviderBound !== true
    || knowledge?.truthBoundary?.referenceSequentialClaimFormationRootsMustBePreserved !== true
    || knowledge?.truthBoundary?.oneLearnDirectiveMapsToOneAtomicSyntheticTransaction !== true
    || knowledge?.truthBoundary?.exactReferenceNativeDomainReceiptParityRequired !== true
    || knowledge?.truthBoundary?.providerBridgeRemovedGlobally !== false
    || knowledge?.truthBoundary?.allKnowledgeProgramsNativeClaimed !== false
    || knowledge?.truthBoundary?.knowledgeDomainReceiptParityClaimed !== true
    || knowledge?.truthBoundary?.fullHistoryParityClaimed !== false
  ) {
    fail('Runtime Knowledge truth boundary drifted or overclaimed receipt/direct-native/max-boundary coverage.', {
      surfaceBoundary: surface?.truthBoundary ?? null,
      knowledgeBoundary: knowledge?.truthBoundary ?? null,
    });
  }

  const multiLearn = surface?.knowledgeMultiLearnEvidence ?? null;
  const multiLearnPresent = multiLearn?.present === true;
  if (multiLearnPresent) {
    if (
      multiLearn?.ok !== true
      || multiLearn?.verified !== true
      || multiLearn?.status !== 'runtime-bound'
      || multiLearn?.domain !== 'knowledge'
      || multiLearn?.loweredLearnCount !== 2
      || multiLearn?.loweredClaimCount !== 3
      || JSON.stringify(multiLearn?.declarations) !== JSON.stringify(['mind', 'context'])
    ) {
      fail('Canonical runtime truth saw a bounded multi-Learn attestation but did not bind the exact two-Learn real-C proof.', { multiLearn });
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

    const multiParity = multiLearn?.parity ?? {};
    if (
      multiParity.state !== true
      || multiParity.semanticStateRoot !== true
      || multiParity.nativeStateRootVerified !== true
      || multiParity.nativeStateRootParity !== true
      || multiParity.knowledgeReceipt !== true
      || multiParity.learnTransactionOrder !== true
      || multiParity.learnBoundaryContinuity !== true
      || multiParity.nativeExecutionAttestation !== true
    ) {
      fail('Bounded multi-Learn runtime truth lost state/root/receipt/order/boundary/executable parity.', { multiParity, multiLearn });
    }

    const multiBoundary = multiLearn?.truthBoundary ?? {};
    if (
      multiBoundary.boundedContiguousMultiLearnKnowledgeSubsetOnly !== true
      || multiBoundary.maxBoundedLearnDirectiveCount !== 2
      || multiBoundary.maxBoundedClaimCountPerLearn !== 4
      || multiBoundary.verifiedLearnDirectiveCount !== 2
      || multiBoundary.verifiedClaimCount !== 3
      || multiBoundary.separateOrderedAtomicTransactionsRequired !== true
      || multiBoundary.exactReferenceNativeDomainReceiptParityRequired !== true
      || multiBoundary.crossLearnBoundaryRootContinuityRequired !== true
      || multiBoundary.canonicalRealCExecutionRequiredForVerifiedStatus !== true
      || multiBoundary.runtimeTruthBound !== true
      || multiBoundary.threeOrMoreLearnDirectivesNativeClaimed !== false
      || multiBoundary.nonLeadingOrInterleavedLearnNativeClaimed !== false
      || multiBoundary.dependenciesRevisionsDecayAndDerivedKnowledgeRemainProviderBound !== true
      || multiBoundary.providerBridgeRemovedGlobally !== false
      || multiBoundary.allKnowledgeProgramsNativeClaimed !== false
      || multiBoundary.fullHistoryParityClaimed !== false
    ) {
      fail('Bounded multi-Learn runtime truth boundary drifted or overclaimed coverage.', { multiBoundary });
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
      || surface?.truthBoundary?.knowledgeMultiLearnEvidencePresent !== true
      || surface?.truthBoundary?.knowledgeMultiLearnRuntimeTruthBound !== true
      || surface?.truthBoundary?.runtimeTruthRootBindsKnowledgeMultiLearnEvidenceWhenPresent !== true
      || surface?.truthBoundary?.knowledgeMultiLearnBindingDoesNotClaimThreeOrMoreLearnDirectives !== true
      || surface?.truthBoundary?.knowledgeMultiLearnBindingDoesNotClaimNonLeadingOrInterleavedLearn !== true
      || surface?.truthBoundary?.knowledgeMultiLearnBindingDoesNotClaimFullHistoryParity !== true
      || surface?.truthBoundary?.knowledgeMultiLearnBindingDoesNotClaimGlobalProviderRemoval !== true
    ) {
      fail('Canonical runtimeTruthRoot did not bind the bounded multi-Learn evidence identity and conservative truth boundary.', {
        runtimeTruth,
        surfaceBoundary: surface?.truthBoundary ?? null,
        multiLearn,
      });
    }
  } else if (
    surface?.runtimeTruth?.knowledgeMultiLearnRuntimeBound !== false
    || surface?.runtimeTruth?.knowledgeMultiLearnRuntimeEvidenceRoot !== null
    || surface?.truthBoundary?.knowledgeMultiLearnEvidencePresent !== false
    || surface?.truthBoundary?.knowledgeMultiLearnRuntimeTruthBound !== false
  ) {
    fail('Pre-binding canonical runtime truth invented bounded multi-Learn coverage without an attestation.', {
      runtimeTruth: surface?.runtimeTruth ?? null,
      surfaceBoundary: surface?.truthBoundary ?? null,
      multiLearn,
    });
  }

  console.log(JSON.stringify({
    ok: true,
    status: 'RCL_FOUNDATION_KNOWLEDGE_RUNTIME_TRUTH_VERIFIED',
    truthRoot: surface.truthRoot,
    directRegistryRoot: surface.direct.registryRoot,
    providerBridgeRegistryRoot: surface.providerBridge.registryRoot,
    runtimeTruthRoot: surface.runtimeTruthRoot,
    knowledgeDeploymentEvidenceRoot: knowledge.deploymentEvidenceRoot,
    knowledgeReceiptRoot: knowledge.knowledgeReceiptRoot,
    maxBoundaryAttestationRoot: knowledge.maxBoundaryAttestationRoot,
    maxBoundaryKnowledgeReceiptRoot: knowledge.maxBoundaryKnowledgeReceiptRoot,
    initialStateRoot: knowledge.initialStateRoot,
    claimFormedAtRoots: knowledge.claimFormedAtRoots,
    maxBoundaryClaimFormedAtRoots: knowledge.maxBoundaryClaimFormedAtRoots,
    loweredClaimCount: knowledge.loweredClaimCount,
    maxBoundaryLoweredClaimCount: knowledge.maxBoundaryLoweredClaimCount,
    nativeVmExecutionAttestationRoot: knowledge.nativeVmExecutionAttestationRoot,
    maxBoundaryNativeVmExecutionAttestationRoot: knowledge.maxBoundaryNativeVmExecutionAttestationRoot,
    binarySha256: knowledge.binarySha256,
    multiLearnPresent,
    multiLearnRuntimeEvidenceRoot: multiLearnPresent ? multiLearn.runtimeEvidenceRoot : null,
    multiLearnAttestationRoot: multiLearnPresent ? multiLearn.attestationRoot : null,
    multiLearnKnowledgeReceiptRoot: multiLearnPresent ? multiLearn.knowledgeReceiptRoot : null,
    multiLearnNativeVmExecutionAttestationRoot: multiLearnPresent ? multiLearn.nativeVmExecutionAttestationRoot : null,
    multiLearnExecutionBinarySha256: multiLearnPresent ? multiLearn.executionBinarySha256 : null,
    multiLearnFormedAtRoots: multiLearnPresent ? multiLearn.formedAtRoots : [],
    multiLearnLoweredLearnCount: multiLearnPresent ? multiLearn.loweredLearnCount : null,
    multiLearnLoweredClaimCount: multiLearnPresent ? multiLearn.loweredClaimCount : null,
  }, null, 2));
} catch (error) {
  fail(error?.message ?? String(error), { code: error?.code ?? null, stack: error?.stack ?? null });
}
