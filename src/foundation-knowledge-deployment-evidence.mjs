import crypto from 'node:crypto';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const NATIVE_VM_PATH = fileURLToPath(new URL('../native/rclvm', import.meta.url));
const NATIVE_VM_ATTESTATION_PATH = fileURLToPath(new URL('../native/rclvm.vercel-attestation.json', import.meta.url));

export const FOUNDATION_KNOWLEDGE_DEPLOYMENT_EVIDENCE_FORMAT = 'taowind.rcl-foundation-knowledge-deployment-evidence.v0.4';
export const FOUNDATION_KNOWLEDGE_DEPLOYMENT_EVIDENCE_VERSION = '0.4.0';

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}
function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function sha256Canonical(value) { return sha256(JSON.stringify(canonical(value))); }
function isSha256(value) { return typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value); }

function validKnowledgeState(value, expected = {}, expectedFormedAtRoot) {
  return value?.kind === 'Knowledge'
    && value?.baseType === expected.baseType
    && Object.is(value?.value, expected.value)
    && value?.confidence === expected.confidence
    && JSON.stringify(value?.evidence) === JSON.stringify(expected.evidence)
    && value?.source === expected.source
    && value?.scope === 'local'
    && value?.status === 'provisional'
    && JSON.stringify(value?.dependencies) === '[]'
    && value?.revision === 1
    && JSON.stringify(value?.alternatives) === '[]'
    && value?.formedAtRoot === expectedFormedAtRoot;
}

export function foundationKnowledgeDeploymentEvidence({ binaryBytes, attestation } = {}) {
  const errors = [];
  const fail = (code, message, details = {}) => errors.push({ code, message, ...details });
  const bytes = binaryBytes ?? fs.readFileSync(NATIVE_VM_PATH);
  const manifest = attestation ?? JSON.parse(fs.readFileSync(NATIVE_VM_ATTESTATION_PATH, 'utf8'));
  const binarySha256 = sha256(bytes);
  const proof = manifest?.foundationParityProofs?.knowledge ?? manifest?.foundationKnowledgeParityProof ?? null;
  const maxBoundaryProof = manifest?.foundationKnowledgeMaxBoundaryProof ?? null;

  if (manifest?.binarySha256 !== binarySha256) {
    fail('RCL_KNOWLEDGE_DEPLOYMENT_BINARY_DRIFT', 'Knowledge deployment evidence is not attached to the exact bundled Native VM binary.', {
      manifestBinarySha256: manifest?.binarySha256 ?? null,
      binarySha256,
    });
  }
  if (
    proof?.domain !== 'knowledge'
    || proof?.status !== 'native-verified'
    || proof?.verified !== true
    || proof?.boundedSubset !== true
    || proof?.loweredDirectiveCount !== 1
    || proof?.loweredClaimCount !== 2
  ) {
    fail('RCL_KNOWLEDGE_DEPLOYMENT_PROOF_IDENTITY_DRIFT', 'Knowledge behavioral specimen proof identity/counts are missing or overclaimed.', { proof });
  }

  const parity = proof?.parity ?? {};
  if (
    parity.state !== true
    || parity.semanticStateRoot !== true
    || parity.nativeStateRootVerified !== true
    || parity.nativeStateRootParity !== true
    || parity.knowledgeReceipt !== true
    || parity.nativeExecutionAttestation !== true
  ) {
    fail('RCL_KNOWLEDGE_DEPLOYMENT_PARITY_DRIFT', 'Knowledge behavioral specimen proof no longer closes state/root/domain-receipt/executable parity.', { parity });
  }

  const formedRoots = proof?.claimFormedAtRoots ?? {};
  if (
    proof?.executionBinarySha256 !== binarySha256
    || !isSha256(proof?.nativeVmExecutionAttestationRoot)
    || !isSha256(proof?.initialStateRoot)
    || !isSha256(formedRoots?.['mind.trusted'])
    || !isSha256(formedRoots?.['mind.score'])
    || proof?.initialStateRoot !== formedRoots?.['mind.trusted']
    || formedRoots?.['mind.trusted'] === formedRoots?.['mind.score']
    || !isSha256(proof?.knowledgeReceiptRoot)
    || proof?.receiptParity?.ok !== true
    || proof?.receiptParity?.receiptRoot !== proof?.knowledgeReceiptRoot
    || proof?.receiptParity?.entries?.[0]?.claimCount !== 2
  ) {
    fail('RCL_KNOWLEDGE_DEPLOYMENT_ROOT_BINDING_DRIFT', 'Knowledge behavioral specimen proof lost content-addressed execution/binary/sequential-formation/domain-receipt binding.', {
      executionBinarySha256: proof?.executionBinarySha256 ?? null,
      binarySha256,
      nativeVmExecutionAttestationRoot: proof?.nativeVmExecutionAttestationRoot ?? null,
      initialStateRoot: proof?.initialStateRoot ?? null,
      claimFormedAtRoots: formedRoots,
      knowledgeReceiptRoot: proof?.knowledgeReceiptRoot ?? null,
      receiptParityRoot: proof?.receiptParity?.receiptRoot ?? null,
      receiptClaimCount: proof?.receiptParity?.entries?.[0]?.claimCount ?? null,
    });
  }

  const trustedKnowledge = proof?.finalState?.['mind.trusted'];
  const scoreKnowledge = proof?.finalState?.['mind.score'];
  const decisionAllowed = proof?.finalState?.['decision.allowed'];
  const decisionScore = proof?.finalState?.['decision.score'];
  const trustedExpected = {
    baseType: 'Truth', value: true, confidence: 0.9, evidence: ['sensor:signal-v1'], source: 'sensor:signal',
  };
  const scoreExpected = {
    baseType: 'Number', value: 7, confidence: 0.8, evidence: ['sensor:score-v1'], source: 'sensor:score',
  };
  if (
    !validKnowledgeState(trustedKnowledge, trustedExpected, formedRoots?.['mind.trusted'])
    || !validKnowledgeState(scoreKnowledge, scoreExpected, formedRoots?.['mind.score'])
    || decisionAllowed !== true
    || decisionScore !== 7
  ) {
    fail('RCL_KNOWLEDGE_DEPLOYMENT_STATE_DRIFT', 'Knowledge behavioral specimen evidence lost the bounded multi-claim state/accessor behavior.', {
      trustedKnowledge,
      scoreKnowledge,
      decisionAllowed,
      decisionScore,
      claimFormedAtRoots: formedRoots,
    });
  }

  const boundary = proof?.truthBoundary ?? {};
  if (
    boundary.boundedSingleClaimKnowledgeSubsetOnly !== false
    || boundary.boundedPrimitiveMultiClaimKnowledgeSubsetOnly !== true
    || boundary.maxBoundedClaimCount !== 4
    || boundary.verifiedAtomicClaimCount !== 2
    || boundary.primitiveClaimTypesOnly !== true
    || boundary.directMultiClaimExpressionsRestrictedToLiteralOrInitialPrimitivePath !== true
    || boundary.referenceSequentialClaimFormationRootsMustBePreserved !== true
    || boundary.oneLearnDirectiveMapsToOneAtomicSyntheticTransaction !== true
    || boundary.dependenciesRevisionsDecayAndDerivedKnowledgeRemainProviderBound !== true
    || boundary.referenceRuntimeStateParityRequired !== true
    || boundary.exactReferenceNativeDomainReceiptParityRequired !== true
    || boundary.canonicalRealCExecutionRequiredForVerifiedStatus !== true
    || boundary.providerBridgeRemovedGlobally !== false
    || boundary.allKnowledgeProgramsNativeClaimed !== false
    || boundary.knowledgeDomainReceiptParityClaimed !== true
    || boundary.fullHistoryParityClaimed !== false
  ) {
    fail('RCL_KNOWLEDGE_DEPLOYMENT_BOUNDARY_DRIFT', 'Knowledge behavioral specimen truth boundary drifted or overclaimed the bounded multi-claim proof.', { boundary });
  }

  const maxBoundaryRoots = maxBoundaryProof?.claimFormedAtRoots ?? {};
  const expectedMaxBoundaryPaths = ['mind.trusted', 'mind.score', 'mind.label', 'mind.rank'];
  const maxBoundaryRootValues = expectedMaxBoundaryPaths.map(pathName => maxBoundaryRoots?.[pathName]);
  const {
    attestationRoot: maxBoundaryAttestationRoot = null,
    runtimeBinding: maxBoundaryRuntimeBinding = null,
    ...maxBoundaryPayload
  } = maxBoundaryProof && typeof maxBoundaryProof === 'object' && !Array.isArray(maxBoundaryProof)
    ? maxBoundaryProof
    : {};
  if (
    maxBoundaryProof?.format !== 'taowind.rcl-vercel-foundation-knowledge-max-boundary-proof.v0.1'
    || maxBoundaryProof?.version !== '0.1.0'
    || maxBoundaryProof?.ok !== true
    || maxBoundaryProof?.verified !== true
    || maxBoundaryProof?.status !== 'native-verified'
    || maxBoundaryProof?.domain !== 'knowledge'
    || maxBoundaryProof?.loweredDirectiveCount !== 1
    || maxBoundaryProof?.loweredClaimCount !== 4
    || maxBoundaryProof?.binarySha256 !== binarySha256
    || maxBoundaryProof?.executionBinarySha256 !== binarySha256
    || !isSha256(maxBoundaryProof?.nativeVmExecutionAttestationRoot)
    || !isSha256(maxBoundaryProof?.knowledgeReceiptRoot)
    || !isSha256(maxBoundaryAttestationRoot)
    || maxBoundaryAttestationRoot !== sha256Canonical(maxBoundaryPayload)
    || JSON.stringify(maxBoundaryProof?.claimPaths) !== JSON.stringify(expectedMaxBoundaryPaths)
    || maxBoundaryRootValues.some(rootValue => !isSha256(rootValue))
    || new Set(maxBoundaryRootValues).size !== 4
    || maxBoundaryProof?.parity?.state !== true
    || maxBoundaryProof?.parity?.semanticStateRoot !== true
    || maxBoundaryProof?.parity?.nativeStateRootVerified !== true
    || maxBoundaryProof?.parity?.nativeStateRootParity !== true
    || maxBoundaryProof?.parity?.knowledgeReceipt !== true
    || maxBoundaryProof?.parity?.nativeExecutionAttestation !== true
    || maxBoundaryProof?.truthBoundary?.boundedPrimitiveMultiClaimKnowledgeSubsetOnly !== true
    || maxBoundaryProof?.truthBoundary?.maxBoundedClaimCount !== 4
    || maxBoundaryProof?.truthBoundary?.verifiedAtomicClaimCount !== 4
    || maxBoundaryProof?.truthBoundary?.maxBoundedClaimCountRealCVerified !== true
    || maxBoundaryProof?.truthBoundary?.overBoundaryFiveClaimsRemainProviderBound !== true
    || maxBoundaryProof?.truthBoundary?.referenceSequentialClaimFormationRootsMustBePreserved !== true
    || maxBoundaryProof?.truthBoundary?.oneLearnDirectiveMapsToOneAtomicSyntheticTransaction !== true
    || maxBoundaryProof?.truthBoundary?.exactReferenceNativeDomainReceiptParityRequired !== true
    || maxBoundaryProof?.truthBoundary?.canonicalRealCExecutionRequiredForVerifiedStatus !== true
    || maxBoundaryProof?.truthBoundary?.providerBridgeRemovedGlobally !== false
    || maxBoundaryProof?.truthBoundary?.allKnowledgeProgramsNativeClaimed !== false
    || maxBoundaryProof?.truthBoundary?.fullHistoryParityClaimed !== false
    || maxBoundaryRuntimeBinding?.exactBinaryRequired !== true
    || maxBoundaryRuntimeBinding?.canonicalRuntimeTruthConsumerRequired !== true
    || maxBoundaryRuntimeBinding?.baseTwoClaimBehavioralSpecimenRemainsDistinct !== true
    || maxBoundaryRuntimeBinding?.maxBoundaryAttestationDoesNotClaimFullKnowledgeNativeCoverage !== true
  ) {
    fail('RCL_KNOWLEDGE_MAX_BOUNDARY_RUNTIME_ATTESTATION_DRIFT', 'Knowledge max-boundary real-C attestation is missing, unbound, or overclaims runtime coverage.', {
      maxBoundaryProof,
      maxBoundaryAttestationRoot,
      recomputedAttestationRoot: Object.keys(maxBoundaryPayload).length > 0 ? sha256Canonical(maxBoundaryPayload) : null,
      binarySha256,
    });
  }

  const payload = {
    format: FOUNDATION_KNOWLEDGE_DEPLOYMENT_EVIDENCE_FORMAT,
    version: FOUNDATION_KNOWLEDGE_DEPLOYMENT_EVIDENCE_VERSION,
    domain: 'knowledge',
    status: errors.length === 0 ? 'deployment-bound' : 'deployment-drift',
    verified: errors.length === 0,
    binarySha256,
    executionBinarySha256: proof?.executionBinarySha256 ?? null,
    nativeVmExecutionAttestationRoot: proof?.nativeVmExecutionAttestationRoot ?? null,
    initialStateRoot: proof?.initialStateRoot ?? null,
    claimFormedAtRoots: formedRoots,
    knowledgeReceiptRoot: proof?.knowledgeReceiptRoot ?? null,
    knowledgeReceiptRootAlgorithm: proof?.knowledgeReceiptRootAlgorithm ?? null,
    loweredDirectiveCount: proof?.loweredDirectiveCount ?? null,
    loweredClaimCount: proof?.loweredClaimCount ?? null,
    maxBoundaryAttestationRoot,
    maxBoundaryExecutionBinarySha256: maxBoundaryProof?.executionBinarySha256 ?? null,
    maxBoundaryNativeVmExecutionAttestationRoot: maxBoundaryProof?.nativeVmExecutionAttestationRoot ?? null,
    maxBoundaryKnowledgeReceiptRoot: maxBoundaryProof?.knowledgeReceiptRoot ?? null,
    maxBoundaryKnowledgeReceiptRootAlgorithm: maxBoundaryProof?.knowledgeReceiptRootAlgorithm ?? null,
    maxBoundaryClaimFormedAtRoots: maxBoundaryRoots,
    maxBoundaryLoweredClaimCount: maxBoundaryProof?.loweredClaimCount ?? null,
    finalState: {
      'mind.trusted': trustedKnowledge ?? null,
      'mind.score': scoreKnowledge ?? null,
      'decision.allowed': decisionAllowed ?? null,
      'decision.score': decisionScore ?? null,
    },
    truthBoundary: {
      boundedPrimitiveMultiClaimKnowledgeSubsetOnly: boundary.boundedPrimitiveMultiClaimKnowledgeSubsetOnly === true,
      maxBoundedClaimCount: boundary.maxBoundedClaimCount ?? null,
      behavioralSpecimenVerifiedAtomicClaimCount: boundary.verifiedAtomicClaimCount ?? null,
      verifiedAtomicClaimCount: maxBoundaryProof?.truthBoundary?.verifiedAtomicClaimCount ?? null,
      maxBoundedClaimCountRealCVerified: maxBoundaryProof?.truthBoundary?.maxBoundedClaimCountRealCVerified === true,
      maxBoundaryRuntimeTruthBound: isSha256(maxBoundaryAttestationRoot),
      overBoundaryFiveClaimsRemainProviderBound: maxBoundaryProof?.truthBoundary?.overBoundaryFiveClaimsRemainProviderBound === true,
      referenceSequentialClaimFormationRootsMustBePreserved: boundary.referenceSequentialClaimFormationRootsMustBePreserved === true,
      exactReferenceNativeDomainReceiptParityRequired: boundary.exactReferenceNativeDomainReceiptParityRequired === true,
      oneLearnDirectiveMapsToOneAtomicSyntheticTransaction: boundary.oneLearnDirectiveMapsToOneAtomicSyntheticTransaction === true,
      providerBridgeRemovedGlobally: boundary.providerBridgeRemovedGlobally === true,
      allKnowledgeProgramsNativeClaimed: boundary.allKnowledgeProgramsNativeClaimed === true,
      knowledgeDomainReceiptParityClaimed: boundary.knowledgeDomainReceiptParityClaimed === true,
      fullHistoryParityClaimed: boundary.fullHistoryParityClaimed === true,
    },
  };

  return {
    ok: errors.length === 0,
    ...payload,
    deploymentEvidenceRoot: sha256Canonical(payload),
    errors,
  };
}
