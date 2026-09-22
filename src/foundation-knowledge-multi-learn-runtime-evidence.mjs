import crypto from 'node:crypto';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const NATIVE_VM_PATH = fileURLToPath(new URL('../native/rclvm', import.meta.url));
const NATIVE_VM_ATTESTATION_PATH = fileURLToPath(new URL('../native/rclvm.vercel-attestation.json', import.meta.url));

export const FOUNDATION_KNOWLEDGE_MULTI_LEARN_RUNTIME_EVIDENCE_FORMAT = 'taowind.rcl-foundation-knowledge-multi-learn-runtime-evidence.v0.2';
export const FOUNDATION_KNOWLEDGE_MULTI_LEARN_RUNTIME_EVIDENCE_VERSION = '0.2.0';

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}
function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function sha256Canonical(value) { return sha256(JSON.stringify(canonical(value))); }
function isSha256(value) { return typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value); }

export function foundationKnowledgeMultiLearnRuntimeEvidence({ binaryBytes, attestation } = {}) {
  const errors = [];
  const fail = (code, message, details = {}) => errors.push({ code, message, ...details });
  const bytes = binaryBytes ?? fs.readFileSync(NATIVE_VM_PATH);
  const manifest = attestation ?? JSON.parse(fs.readFileSync(NATIVE_VM_ATTESTATION_PATH, 'utf8'));
  const binarySha256 = sha256(bytes);
  const proof = manifest?.foundationKnowledgeMultiLearnProof ?? null;
  const maxBoundaryProof = manifest?.foundationKnowledgeMultiLearnMaxBoundaryProof ?? null;
  const present = proof != null;
  const maxBoundaryPresent = maxBoundaryProof != null;

  if (!present) {
    const payload = {
      format: FOUNDATION_KNOWLEDGE_MULTI_LEARN_RUNTIME_EVIDENCE_FORMAT,
      version: FOUNDATION_KNOWLEDGE_MULTI_LEARN_RUNTIME_EVIDENCE_VERSION,
      domain: 'knowledge',
      present: false,
      verified: false,
      status: 'runtime-unbound',
      binarySha256,
      attestationRoot: null,
      executionBinarySha256: null,
      nativeVmExecutionAttestationRoot: null,
      knowledgeReceiptRoot: null,
      knowledgeReceiptRootAlgorithm: null,
      loweredLearnCount: null,
      loweredClaimCount: null,
      declarations: [],
      formedAtRoots: [],
      maxBoundaryPresent: false,
      maxBoundaryVerified: false,
      maxBoundaryStatus: 'runtime-unbound',
      maxBoundaryAttestationRoot: null,
      maxBoundaryExecutionBinarySha256: null,
      maxBoundaryNativeVmExecutionAttestationRoot: null,
      maxBoundaryKnowledgeReceiptRoot: null,
      maxBoundaryKnowledgeReceiptRootAlgorithm: null,
      maxBoundaryLoweredLearnCount: null,
      maxBoundaryLoweredClaimCount: null,
      maxBoundaryDeclarations: [],
      maxBoundaryClaimPaths: [],
      maxBoundaryFormedAtRoots: [],
      truthBoundary: {
        boundedContiguousMultiLearnKnowledgeSubsetOnly: false,
        maxBoundedLearnDirectiveCount: null,
        maxBoundedClaimCountPerLearn: null,
        verifiedLearnDirectiveCount: null,
        verifiedClaimCount: null,
        runtimeTruthBound: false,
        maxBoundaryRuntimeTruthBound: false,
        fullHistoryParityClaimed: false,
        providerBridgeRemovedGlobally: false,
        allKnowledgeProgramsNativeClaimed: false,
      },
    };
    return { ok: true, ...payload, runtimeEvidenceRoot: sha256Canonical(payload), errors };
  }

  if (manifest?.binarySha256 !== binarySha256) {
    fail('RCL_KNOWLEDGE_MULTI_LEARN_RUNTIME_BINARY_DRIFT', 'Bounded multi-Learn runtime evidence is not attached to the exact bundled Native VM binary.', {
      manifestBinarySha256: manifest?.binarySha256 ?? null,
      binarySha256,
    });
  }

  const {
    attestationRoot = null,
    runtimeBinding = null,
    ...proofPayload
  } = proof && typeof proof === 'object' && !Array.isArray(proof) ? proof : {};
  const expectedPaths = ['mind.trusted', 'mind.score', 'context.label'];
  const formedAtRoots = proof?.formedAtRoots ?? [];
  const formedRootValues = formedAtRoots.map(entry => entry?.root);
  const parity = proof?.parity ?? {};
  const boundary = proof?.truthBoundary ?? {};

  if (
    proof?.format !== 'taowind.rcl-vercel-foundation-knowledge-multi-learn-proof.v0.1'
    || proof?.version !== '0.1.0'
    || proof?.ok !== true
    || proof?.verified !== true
    || proof?.status !== 'native-verified'
    || proof?.domain !== 'knowledge'
    || proof?.loweredLearnCount !== 2
    || proof?.loweredClaimCount !== 3
    || JSON.stringify(proof?.declarations) !== JSON.stringify(['mind', 'context'])
    || proof?.binarySha256 !== binarySha256
    || proof?.executionBinarySha256 !== binarySha256
    || !isSha256(proof?.nativeVmExecutionAttestationRoot)
    || !isSha256(proof?.knowledgeReceiptRoot)
    || formedAtRoots.length !== 3
    || JSON.stringify(formedAtRoots.map(entry => entry?.path)) !== JSON.stringify(expectedPaths)
    || formedRootValues.some(rootValue => !isSha256(rootValue))
    || new Set(formedRootValues).size !== 3
    || !isSha256(attestationRoot)
    || attestationRoot !== sha256Canonical(proofPayload)
    || parity.state !== true
    || parity.semanticStateRoot !== true
    || parity.nativeStateRootVerified !== true
    || parity.nativeStateRootParity !== true
    || parity.knowledgeReceipt !== true
    || parity.learnTransactionOrder !== true
    || parity.learnBoundaryContinuity !== true
    || parity.nativeExecutionAttestation !== true
    || boundary.boundedContiguousMultiLearnKnowledgeSubsetOnly !== true
    || boundary.maxBoundedLearnDirectiveCount !== 2
    || boundary.maxBoundedClaimCountPerLearn !== 4
    || boundary.verifiedLearnDirectiveCount !== 2
    || boundary.verifiedClaimCount !== 3
    || boundary.separateOrderedAtomicTransactionsRequired !== true
    || boundary.exactReferenceNativeDomainReceiptParityRequired !== true
    || boundary.crossLearnBoundaryRootContinuityRequired !== true
    || boundary.canonicalRealCExecutionRequiredForVerifiedStatus !== true
    || boundary.threeOrMoreLearnDirectivesNativeClaimed !== false
    || boundary.nonLeadingOrInterleavedLearnNativeClaimed !== false
    || boundary.dependenciesRevisionsDecayAndDerivedKnowledgeRemainProviderBound !== true
    || boundary.providerBridgeRemovedGlobally !== false
    || boundary.allKnowledgeProgramsNativeClaimed !== false
    || boundary.fullHistoryParityClaimed !== false
    || runtimeBinding?.exactBinaryRequired !== true
    || runtimeBinding?.canonicalRuntimeTruthConsumerRequired !== true
    || runtimeBinding?.singleLearnBehavioralAndMaxBoundaryProofsRemainDistinct !== true
    || runtimeBinding?.multiLearnAttestationDoesNotClaimFullKnowledgeNativeCoverage !== true
  ) {
    fail('RCL_KNOWLEDGE_MULTI_LEARN_RUNTIME_ATTESTATION_DRIFT', 'Bounded multi-Learn real-C attestation is present but unbound, inconsistent, or overclaims runtime coverage.', {
      proof,
      binarySha256,
      attestationRoot,
      recomputedAttestationRoot: Object.keys(proofPayload).length > 0 ? sha256Canonical(proofPayload) : null,
      expectedPaths,
    });
  }

  let maxBoundaryAttestationRoot = null;
  let maxBoundaryRuntimeBinding = null;
  let maxBoundaryPayload = {};
  let maxBoundaryFormedAtRoots = [];
  let maxBoundaryParity = {};
  let maxBoundaryBoundary = {};
  const expectedMaxBoundaryPaths = [
    'mind.trusted', 'mind.score', 'mind.label', 'mind.rank',
    'context.ready', 'context.weight', 'context.zone', 'context.level',
  ];

  if (maxBoundaryPresent) {
    ({
      attestationRoot: maxBoundaryAttestationRoot = null,
      runtimeBinding: maxBoundaryRuntimeBinding = null,
      ...maxBoundaryPayload
    } = maxBoundaryProof && typeof maxBoundaryProof === 'object' && !Array.isArray(maxBoundaryProof) ? maxBoundaryProof : {});
    maxBoundaryFormedAtRoots = maxBoundaryProof?.formedAtRoots ?? [];
    const maxBoundaryFormedRootValues = maxBoundaryFormedAtRoots.map(entry => entry?.root);
    maxBoundaryParity = maxBoundaryProof?.parity ?? {};
    maxBoundaryBoundary = maxBoundaryProof?.truthBoundary ?? {};

    if (
      maxBoundaryProof?.format !== 'taowind.rcl-vercel-foundation-knowledge-multi-learn-max-boundary-proof.v0.1'
      || maxBoundaryProof?.version !== '0.1.0'
      || maxBoundaryProof?.ok !== true
      || maxBoundaryProof?.verified !== true
      || maxBoundaryProof?.status !== 'native-verified'
      || maxBoundaryProof?.domain !== 'knowledge'
      || maxBoundaryProof?.loweredLearnCount !== 2
      || maxBoundaryProof?.loweredClaimCount !== 8
      || JSON.stringify(maxBoundaryProof?.declarations) !== JSON.stringify(['mind', 'context'])
      || JSON.stringify(maxBoundaryProof?.claimPaths) !== JSON.stringify(expectedMaxBoundaryPaths)
      || maxBoundaryProof?.binarySha256 !== binarySha256
      || maxBoundaryProof?.executionBinarySha256 !== binarySha256
      || !isSha256(maxBoundaryProof?.nativeVmExecutionAttestationRoot)
      || !isSha256(maxBoundaryProof?.knowledgeReceiptRoot)
      || maxBoundaryFormedAtRoots.length !== 8
      || JSON.stringify(maxBoundaryFormedAtRoots.map(entry => entry?.path)) !== JSON.stringify(expectedMaxBoundaryPaths)
      || maxBoundaryFormedRootValues.some(rootValue => !isSha256(rootValue))
      || new Set(maxBoundaryFormedRootValues).size !== 8
      || !isSha256(maxBoundaryAttestationRoot)
      || maxBoundaryAttestationRoot !== sha256Canonical(maxBoundaryPayload)
      || maxBoundaryParity.state !== true
      || maxBoundaryParity.semanticStateRoot !== true
      || maxBoundaryParity.nativeStateRootVerified !== true
      || maxBoundaryParity.nativeStateRootParity !== true
      || maxBoundaryParity.knowledgeReceipt !== true
      || maxBoundaryParity.learnTransactionOrder !== true
      || maxBoundaryParity.learnBoundaryContinuity !== true
      || maxBoundaryParity.nativeExecutionAttestation !== true
      || maxBoundaryBoundary.boundedContiguousMultiLearnKnowledgeSubsetOnly !== true
      || maxBoundaryBoundary.maxBoundedLearnDirectiveCount !== 2
      || maxBoundaryBoundary.maxBoundedClaimCountPerLearn !== 4
      || maxBoundaryBoundary.verifiedLearnDirectiveCount !== 2
      || maxBoundaryBoundary.verifiedClaimCount !== 8
      || maxBoundaryBoundary.maxDeclaredMultiLearnBoundaryRealCVerified !== true
      || maxBoundaryBoundary.separateOrderedAtomicTransactionsRequired !== true
      || maxBoundaryBoundary.exactReferenceNativeDomainReceiptParityRequired !== true
      || maxBoundaryBoundary.crossLearnBoundaryRootContinuityRequired !== true
      || maxBoundaryBoundary.globalSequentialClaimFormationRootsRequired !== true
      || maxBoundaryBoundary.canonicalRealCExecutionRequiredForVerifiedStatus !== true
      || maxBoundaryBoundary.threeOrMoreLearnDirectivesNativeClaimed !== false
      || maxBoundaryBoundary.fiveOrMoreClaimsPerLearnNativeClaimed !== false
      || maxBoundaryBoundary.nonLeadingOrInterleavedLearnNativeClaimed !== false
      || maxBoundaryBoundary.dependenciesRevisionsDecayAndDerivedKnowledgeRemainProviderBound !== true
      || maxBoundaryBoundary.providerBridgeRemovedGlobally !== false
      || maxBoundaryBoundary.allKnowledgeProgramsNativeClaimed !== false
      || maxBoundaryBoundary.fullHistoryParityClaimed !== false
      || maxBoundaryRuntimeBinding?.exactBinaryRequired !== true
      || maxBoundaryRuntimeBinding?.canonicalRuntimeTruthConsumerRequired !== true
      || maxBoundaryRuntimeBinding?.behavioralAndMaxBoundaryAttestationsRemainDistinct !== true
      || maxBoundaryRuntimeBinding?.maxBoundaryAttestationDoesNotClaimFullKnowledgeNativeCoverage !== true
    ) {
      fail('RCL_KNOWLEDGE_MULTI_LEARN_MAX_BOUNDARY_RUNTIME_ATTESTATION_DRIFT', 'Bounded multi-Learn max-boundary real-C attestation is present but unbound, inconsistent, or overclaims runtime coverage.', {
        maxBoundaryProof,
        binarySha256,
        maxBoundaryAttestationRoot,
        recomputedMaxBoundaryAttestationRoot: Object.keys(maxBoundaryPayload).length > 0 ? sha256Canonical(maxBoundaryPayload) : null,
        expectedMaxBoundaryPaths,
      });
    }
  }

  const maxBoundaryVerified = maxBoundaryPresent
    && errors.every(error => error?.code !== 'RCL_KNOWLEDGE_MULTI_LEARN_MAX_BOUNDARY_RUNTIME_ATTESTATION_DRIFT'
      && error?.code !== 'RCL_KNOWLEDGE_MULTI_LEARN_RUNTIME_BINARY_DRIFT');

  const payload = {
    format: FOUNDATION_KNOWLEDGE_MULTI_LEARN_RUNTIME_EVIDENCE_FORMAT,
    version: FOUNDATION_KNOWLEDGE_MULTI_LEARN_RUNTIME_EVIDENCE_VERSION,
    domain: 'knowledge',
    present: true,
    verified: errors.length === 0,
    status: errors.length === 0 ? 'runtime-bound' : 'runtime-drift',
    binarySha256,
    attestationRoot,
    executionBinarySha256: proof?.executionBinarySha256 ?? null,
    nativeVmExecutionAttestationRoot: proof?.nativeVmExecutionAttestationRoot ?? null,
    knowledgeReceiptRoot: proof?.knowledgeReceiptRoot ?? null,
    knowledgeReceiptRootAlgorithm: proof?.knowledgeReceiptRootAlgorithm ?? null,
    loweredLearnCount: proof?.loweredLearnCount ?? null,
    loweredClaimCount: proof?.loweredClaimCount ?? null,
    declarations: [...(proof?.declarations ?? [])],
    formedAtRoots: formedAtRoots.map(entry => ({
      declaration: entry?.declaration ?? null,
      path: entry?.path ?? null,
      root: entry?.root ?? null,
    })),
    maxBoundaryPresent,
    maxBoundaryVerified,
    maxBoundaryStatus: maxBoundaryPresent ? (maxBoundaryVerified ? 'runtime-bound' : 'runtime-drift') : 'runtime-unbound',
    maxBoundaryAttestationRoot,
    maxBoundaryExecutionBinarySha256: maxBoundaryProof?.executionBinarySha256 ?? null,
    maxBoundaryNativeVmExecutionAttestationRoot: maxBoundaryProof?.nativeVmExecutionAttestationRoot ?? null,
    maxBoundaryKnowledgeReceiptRoot: maxBoundaryProof?.knowledgeReceiptRoot ?? null,
    maxBoundaryKnowledgeReceiptRootAlgorithm: maxBoundaryProof?.knowledgeReceiptRootAlgorithm ?? null,
    maxBoundaryLoweredLearnCount: maxBoundaryProof?.loweredLearnCount ?? null,
    maxBoundaryLoweredClaimCount: maxBoundaryProof?.loweredClaimCount ?? null,
    maxBoundaryDeclarations: [...(maxBoundaryProof?.declarations ?? [])],
    maxBoundaryClaimPaths: [...(maxBoundaryProof?.claimPaths ?? [])],
    maxBoundaryFormedAtRoots: maxBoundaryFormedAtRoots.map(entry => ({
      declaration: entry?.declaration ?? null,
      path: entry?.path ?? null,
      root: entry?.root ?? null,
    })),
    maxBoundaryParity: maxBoundaryPresent ? {
      state: maxBoundaryParity.state === true,
      semanticStateRoot: maxBoundaryParity.semanticStateRoot === true,
      nativeStateRootVerified: maxBoundaryParity.nativeStateRootVerified === true,
      nativeStateRootParity: maxBoundaryParity.nativeStateRootParity === true,
      knowledgeReceipt: maxBoundaryParity.knowledgeReceipt === true,
      learnTransactionOrder: maxBoundaryParity.learnTransactionOrder === true,
      learnBoundaryContinuity: maxBoundaryParity.learnBoundaryContinuity === true,
      nativeExecutionAttestation: maxBoundaryParity.nativeExecutionAttestation === true,
    } : null,
    parity: {
      state: parity.state === true,
      semanticStateRoot: parity.semanticStateRoot === true,
      nativeStateRootVerified: parity.nativeStateRootVerified === true,
      nativeStateRootParity: parity.nativeStateRootParity === true,
      knowledgeReceipt: parity.knowledgeReceipt === true,
      learnTransactionOrder: parity.learnTransactionOrder === true,
      learnBoundaryContinuity: parity.learnBoundaryContinuity === true,
      nativeExecutionAttestation: parity.nativeExecutionAttestation === true,
    },
    truthBoundary: {
      boundedContiguousMultiLearnKnowledgeSubsetOnly: boundary.boundedContiguousMultiLearnKnowledgeSubsetOnly === true,
      maxBoundedLearnDirectiveCount: boundary.maxBoundedLearnDirectiveCount ?? null,
      maxBoundedClaimCountPerLearn: boundary.maxBoundedClaimCountPerLearn ?? null,
      verifiedLearnDirectiveCount: boundary.verifiedLearnDirectiveCount ?? null,
      verifiedClaimCount: boundary.verifiedClaimCount ?? null,
      separateOrderedAtomicTransactionsRequired: boundary.separateOrderedAtomicTransactionsRequired === true,
      exactReferenceNativeDomainReceiptParityRequired: boundary.exactReferenceNativeDomainReceiptParityRequired === true,
      crossLearnBoundaryRootContinuityRequired: boundary.crossLearnBoundaryRootContinuityRequired === true,
      canonicalRealCExecutionRequiredForVerifiedStatus: boundary.canonicalRealCExecutionRequiredForVerifiedStatus === true,
      threeOrMoreLearnDirectivesNativeClaimed: boundary.threeOrMoreLearnDirectivesNativeClaimed === true,
      nonLeadingOrInterleavedLearnNativeClaimed: boundary.nonLeadingOrInterleavedLearnNativeClaimed === true,
      dependenciesRevisionsDecayAndDerivedKnowledgeRemainProviderBound: boundary.dependenciesRevisionsDecayAndDerivedKnowledgeRemainProviderBound === true,
      runtimeTruthBound: errors.length === 0 && isSha256(attestationRoot),
      maxBoundaryRuntimeTruthBound: maxBoundaryVerified && isSha256(maxBoundaryAttestationRoot),
      maxBoundaryRealCVerified: maxBoundaryBoundary.maxDeclaredMultiLearnBoundaryRealCVerified === true,
      fiveOrMoreClaimsPerLearnNativeClaimed: maxBoundaryBoundary.fiveOrMoreClaimsPerLearnNativeClaimed === true,
      globalSequentialClaimFormationRootsRequired: maxBoundaryBoundary.globalSequentialClaimFormationRootsRequired === true,
      providerBridgeRemovedGlobally: boundary.providerBridgeRemovedGlobally === true,
      allKnowledgeProgramsNativeClaimed: boundary.allKnowledgeProgramsNativeClaimed === true,
      fullHistoryParityClaimed: boundary.fullHistoryParityClaimed === true,
    },
  };

  return {
    ok: errors.length === 0,
    ...payload,
    runtimeEvidenceRoot: sha256Canonical(payload),
    errors,
  };
}
