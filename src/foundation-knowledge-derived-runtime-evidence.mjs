import crypto from 'node:crypto';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const NATIVE_VM_PATH = fileURLToPath(new URL('../native/rclvm', import.meta.url));
const NATIVE_VM_ATTESTATION_PATH = fileURLToPath(new URL('../native/rclvm.vercel-attestation.json', import.meta.url));

export const FOUNDATION_KNOWLEDGE_DERIVED_RUNTIME_EVIDENCE_FORMAT = 'taowind.rcl-foundation-knowledge-derived-runtime-evidence.v0.1';
export const FOUNDATION_KNOWLEDGE_DERIVED_RUNTIME_EVIDENCE_VERSION = '0.1.0';

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}
function sha256Bytes(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex'); }
function sha256Canonical(value) { return sha256Bytes(JSON.stringify(canonical(value))); }
function isSha256(value) { return typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value); }

export function foundationKnowledgeDerivedRuntimeEvidence({ binaryBytes, attestation } = {}) {
  const errors = [];
  const fail = (code, message, details = {}) => errors.push({ code, message, ...details });
  const bytes = binaryBytes ?? fs.readFileSync(NATIVE_VM_PATH);
  const manifest = attestation ?? JSON.parse(fs.readFileSync(NATIVE_VM_ATTESTATION_PATH, 'utf8'));
  const binarySha256 = sha256Bytes(bytes);
  const proof = manifest?.foundationKnowledgeDerivedDependencyProof ?? null;
  const present = proof != null;

  if (!present) {
    return {
      ok: true,
      present: false,
      verified: false,
      status: 'runtime-unavailable',
      format: FOUNDATION_KNOWLEDGE_DERIVED_RUNTIME_EVIDENCE_FORMAT,
      version: FOUNDATION_KNOWLEDGE_DERIVED_RUNTIME_EVIDENCE_VERSION,
      runtimeEvidenceRoot: null,
      errors: []
    };
  }

  if (manifest?.binarySha256 !== binarySha256) {
    fail('RCL_KNOWLEDGE_DERIVED_RUNTIME_BINARY_DRIFT', 'Derived Knowledge runtime evidence is not attached to the exact bundled Native VM binary.', {
      manifestBinarySha256: manifest?.binarySha256 ?? null,
      binarySha256
    });
  }

  const { attestationRoot = null, runtimeBinding = null, ...proofPayload } = proof && typeof proof === 'object' && !Array.isArray(proof) ? proof : {};
  const recomputedAttestationRoot = sha256Canonical(proofPayload);
  const formedAtRoots = proof?.formedAtRoots ?? {};
  const expectedPaths = ['mind.trusted', 'mind.score', 'mind.ready'];
  const formedRootValues = expectedPaths.map(pathName => formedAtRoots?.[pathName]);
  const derived = proof?.derivedKnowledge ?? {};
  const parity = proof?.parity ?? {};
  const boundary = proof?.truthBoundary ?? {};

  if (
    proof?.ok !== true
    || proof?.format !== 'taowind.rcl-vercel-foundation-knowledge-derived-dependency-native-proof.v0.1'
    || proof?.status !== 'native-verified'
    || proof?.verified !== true
    || proof?.binarySha256 !== binarySha256
    || proof?.executionBinarySha256 !== binarySha256
    || !isSha256(proof?.nativeVmExecutionAttestationRoot)
    || !isSha256(proof?.semanticStateRoot)
    || !isSha256(proof?.knowledgeReceiptRoot)
    || !isSha256(attestationRoot)
    || attestationRoot !== recomputedAttestationRoot
    || formedRootValues.some(rootValue => !isSha256(rootValue))
    || new Set(formedRootValues).size !== 3
    || derived?.path !== 'mind.ready'
    || derived?.value !== true
    || derived?.confidence !== 0.6
    || JSON.stringify(derived?.evidence) !== JSON.stringify(['rule:ready-v1', 'sensor:signal-v1', 'sensor:score-v1'])
    || JSON.stringify(derived?.dependencies) !== JSON.stringify(['mind.trusted', 'mind.score'])
    || derived?.status !== 'derived'
    || derived?.revision !== 1
    || derived?.formedAtRoot !== formedAtRoots?.['mind.ready']
    || !Object.values(parity).every(Boolean)
    || proof?.negativeControl?.receiptParityFailedClosed !== true
    || boundary.boundedDerivedKnowledgeDependencySubsetNativeClaimed !== true
    || boundary.revisionsAndDecayRemainProviderBound !== true
    || boundary.unrestrictedDependencyAndDerivedSemanticsRemainProviderBound !== true
    || boundary.providerBridgeRemovedGlobally !== false
    || boundary.allKnowledgeProgramsNativeClaimed !== false
    || boundary.fullHistoryParityClaimed !== false
    || runtimeBinding?.exactBinaryRequired !== true
    || runtimeBinding?.canonicalRuntimeTruthConsumerRequired !== true
    || runtimeBinding?.cycle91ProofRemainsBounded !== true
    || runtimeBinding?.revisionsAndDecayRemainProviderBound !== true
    || runtimeBinding?.unrestrictedDependencyAndDerivedSemanticsRemainProviderBound !== true
    || runtimeBinding?.derivedDependencyAttestationDoesNotClaimFullKnowledgeNativeCoverage !== true
  ) {
    fail('RCL_KNOWLEDGE_DERIVED_RUNTIME_ATTESTATION_DRIFT', 'Bounded derived Knowledge runtime attestation is missing, inconsistent, or overclaims native coverage.', {
      binarySha256,
      proof,
      attestationRoot,
      recomputedAttestationRoot
    });
  }

  const payload = {
    format: FOUNDATION_KNOWLEDGE_DERIVED_RUNTIME_EVIDENCE_FORMAT,
    version: FOUNDATION_KNOWLEDGE_DERIVED_RUNTIME_EVIDENCE_VERSION,
    present: true,
    verified: errors.length === 0,
    status: errors.length === 0 ? 'runtime-bound' : 'runtime-drift',
    binarySha256,
    executionBinarySha256: proof?.executionBinarySha256 ?? null,
    nativeVmExecutionAttestationRoot: proof?.nativeVmExecutionAttestationRoot ?? null,
    attestationRoot,
    semanticStateRoot: proof?.semanticStateRoot ?? null,
    knowledgeReceiptRoot: proof?.knowledgeReceiptRoot ?? null,
    formedAtRoots,
    derivedKnowledge: derived,
    truthBoundary: {
      boundedDerivedKnowledgeDependencySubsetNativeClaimed: boundary.boundedDerivedKnowledgeDependencySubsetNativeClaimed === true,
      revisionsAndDecayRemainProviderBound: boundary.revisionsAndDecayRemainProviderBound === true,
      unrestrictedDependencyAndDerivedSemanticsRemainProviderBound: boundary.unrestrictedDependencyAndDerivedSemanticsRemainProviderBound === true,
      providerBridgeRemovedGlobally: boundary.providerBridgeRemovedGlobally === true,
      allKnowledgeProgramsNativeClaimed: boundary.allKnowledgeProgramsNativeClaimed === true,
      fullHistoryParityClaimed: boundary.fullHistoryParityClaimed === true
    }
  };

  return {
    ok: errors.length === 0,
    ...payload,
    runtimeEvidenceRoot: sha256Canonical(payload),
    errors
  };
}
