import crypto from 'node:crypto';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const NATIVE_VM_PATH = fileURLToPath(new URL('../native/rclvm', import.meta.url));
const NATIVE_VM_ATTESTATION_PATH = fileURLToPath(new URL('../native/rclvm.vercel-attestation.json', import.meta.url));

export const FOUNDATION_KNOWLEDGE_DEPLOYMENT_EVIDENCE_FORMAT = 'taowind.rcl-foundation-knowledge-deployment-evidence.v0.1';
export const FOUNDATION_KNOWLEDGE_DEPLOYMENT_EVIDENCE_VERSION = '0.1.0';

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}
function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function sha256Canonical(value) { return sha256(JSON.stringify(canonical(value))); }
function isSha256(value) { return typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value); }

function validKnowledgeState(value, expectedFormedAtRoot) {
  return value?.kind === 'Knowledge'
    && value?.baseType === 'Truth'
    && value?.value === true
    && value?.confidence === 0.9
    && JSON.stringify(value?.evidence) === JSON.stringify(['sensor:signal-v1'])
    && value?.source === 'sensor:signal'
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
    || proof?.loweredClaimCount !== 1
  ) {
    fail('RCL_KNOWLEDGE_DEPLOYMENT_PROOF_IDENTITY_DRIFT', 'Knowledge deployment proof identity/counts are missing or overclaimed.', { proof });
  }

  const parity = proof?.parity ?? {};
  if (
    parity.state !== true
    || parity.semanticStateRoot !== true
    || parity.nativeStateRootVerified !== true
    || parity.nativeStateRootParity !== true
    || parity.nativeExecutionAttestation !== true
  ) {
    fail('RCL_KNOWLEDGE_DEPLOYMENT_PARITY_DRIFT', 'Knowledge deployment proof no longer closes state/root/executable parity.', { parity });
  }

  if (
    proof?.executionBinarySha256 !== binarySha256
    || !isSha256(proof?.nativeVmExecutionAttestationRoot)
    || !isSha256(proof?.initialStateRoot)
  ) {
    fail('RCL_KNOWLEDGE_DEPLOYMENT_ROOT_BINDING_DRIFT', 'Knowledge deployment proof lost content-addressed execution/binary/pre-Learn-root binding.', {
      executionBinarySha256: proof?.executionBinarySha256 ?? null,
      binarySha256,
      nativeVmExecutionAttestationRoot: proof?.nativeVmExecutionAttestationRoot ?? null,
      initialStateRoot: proof?.initialStateRoot ?? null,
    });
  }

  const knowledgeState = proof?.finalState?.['mind.trusted'];
  const decisionState = proof?.finalState?.['decision.allowed'];
  if (!validKnowledgeState(knowledgeState, proof?.initialStateRoot) || decisionState !== true) {
    fail('RCL_KNOWLEDGE_DEPLOYMENT_STATE_DRIFT', 'Knowledge deployment evidence lost the bounded claim state/accessor behavior.', {
      knowledgeState,
      decisionState,
      initialStateRoot: proof?.initialStateRoot ?? null,
    });
  }

  const boundary = proof?.truthBoundary ?? {};
  if (
    boundary.boundedSingleClaimKnowledgeSubsetOnly !== true
    || boundary.primitiveClaimTypesOnly !== true
    || boundary.exactInitialFormedAtRootRequired !== true
    || boundary.dependenciesRevisionsDecayAndDerivedKnowledgeRemainProviderBound !== true
    || boundary.referenceRuntimeStateParityRequired !== true
    || boundary.canonicalRealCExecutionRequiredForVerifiedStatus !== true
    || boundary.providerBridgeRemovedGlobally !== false
    || boundary.allKnowledgeProgramsNativeClaimed !== false
    || boundary.knowledgeDomainReceiptParityClaimed !== false
  ) {
    fail('RCL_KNOWLEDGE_DEPLOYMENT_BOUNDARY_DRIFT', 'Knowledge deployment truth boundary drifted or overclaimed the bounded proof.', { boundary });
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
    loweredDirectiveCount: proof?.loweredDirectiveCount ?? null,
    loweredClaimCount: proof?.loweredClaimCount ?? null,
    finalState: {
      'mind.trusted': knowledgeState ?? null,
      'decision.allowed': decisionState ?? null,
    },
    truthBoundary: {
      boundedSingleClaimKnowledgeSubsetOnly: boundary.boundedSingleClaimKnowledgeSubsetOnly === true,
      providerBridgeRemovedGlobally: boundary.providerBridgeRemovedGlobally === true,
      allKnowledgeProgramsNativeClaimed: boundary.allKnowledgeProgramsNativeClaimed === true,
      knowledgeDomainReceiptParityClaimed: boundary.knowledgeDomainReceiptParityClaimed === true,
    },
  };

  return {
    ok: errors.length === 0,
    ...payload,
    deploymentEvidenceRoot: sha256Canonical(payload),
    errors,
  };
}
