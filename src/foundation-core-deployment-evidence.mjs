import crypto from 'node:crypto';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const NATIVE_VM_PATH = fileURLToPath(new URL('../native/rclvm', import.meta.url));
const NATIVE_VM_ATTESTATION_PATH = fileURLToPath(new URL('../native/rclvm.vercel-attestation.json', import.meta.url));

export const FOUNDATION_CORE_DEPLOYMENT_EVIDENCE_FORMAT =
  'taowind.rcl-foundation-core-deployment-evidence.v0.1';
export const FOUNDATION_CORE_DEPLOYMENT_EVIDENCE_VERSION = '0.1.0';

export const FOUNDATION_CORE_DEPLOYMENT_DOMAIN_MAP = Object.freeze({
  perception: 'perception',
  physical: 'physical',
  neural: 'neural',
  genetic: 'genetic',
  life: 'living',
});

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  }
  return value;
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function sha256Canonical(value) {
  return sha256(JSON.stringify(canonical(value)));
}

function isSha256(value) {
  return typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value);
}

export function foundationCoreDeploymentEvidence(canonicalDomain, { binaryBytes, attestation } = {}) {
  const runtimeDomain = FOUNDATION_CORE_DEPLOYMENT_DOMAIN_MAP[canonicalDomain] ?? null;
  const errors = [];
  const fail = (code, message, details = {}) => errors.push({ code, message, ...details });

  if (!runtimeDomain) {
    return {
      ok: false,
      format: FOUNDATION_CORE_DEPLOYMENT_EVIDENCE_FORMAT,
      version: FOUNDATION_CORE_DEPLOYMENT_EVIDENCE_VERSION,
      domain: canonicalDomain ?? null,
      runtimeDomain: null,
      status: 'deployment-unsupported',
      verified: false,
      deploymentEvidenceRoot: null,
      errors: [{
        code: 'RCL_CORE_DEPLOYMENT_DOMAIN_UNSUPPORTED',
        message: 'No bounded core deployment-evidence mapping exists for this canonical domain.',
      }],
    };
  }

  const bytes = binaryBytes ?? fs.readFileSync(NATIVE_VM_PATH);
  const manifest = attestation ?? JSON.parse(fs.readFileSync(NATIVE_VM_ATTESTATION_PATH, 'utf8'));
  const binarySha256 = sha256(bytes);
  const proof = manifest?.foundationParityProofs?.[runtimeDomain] ?? null;

  if (manifest?.binarySha256 !== binarySha256) {
    fail(
      'RCL_CORE_DEPLOYMENT_BINARY_DRIFT',
      'Core deployment evidence is not attached to the exact bundled Native VM binary.',
      { canonicalDomain, runtimeDomain, manifestBinarySha256: manifest?.binarySha256 ?? null, binarySha256 },
    );
  }

  if (
    proof?.domain !== runtimeDomain
    || proof?.status !== 'native-verified'
    || proof?.verified !== true
    || !Number.isInteger(proof?.loweredCount)
    || proof.loweredCount < 1
  ) {
    fail(
      'RCL_CORE_DEPLOYMENT_PROOF_IDENTITY_DRIFT',
      'Core deployment proof identity/counts are missing or overclaimed.',
      { canonicalDomain, runtimeDomain, proof },
    );
  }

  const parity = proof?.parity ?? {};
  if (
    parity.state !== true
    || parity.semanticStateRoot !== true
    || parity.nativeStateRootVerified !== true
    || parity.nativeStateRootParity !== true
    || parity.loweringLineage !== true
    || parity.domainReceipt !== true
    || parity.nativeExecutionAttestation !== true
  ) {
    fail(
      'RCL_CORE_DEPLOYMENT_PARITY_DRIFT',
      'Core deployment proof no longer closes state/root/lineage/receipt/executable parity.',
      { canonicalDomain, runtimeDomain, parity },
    );
  }

  if (
    proof?.executionBinarySha256 !== binarySha256
    || !isSha256(proof?.foundationDomainReceiptRoot)
    || !isSha256(proof?.nativeVmExecutionAttestationRoot)
  ) {
    fail(
      'RCL_CORE_DEPLOYMENT_ROOT_BINDING_DRIFT',
      'Core deployment proof lost content-addressed receipt/execution/binary binding.',
      {
        canonicalDomain,
        runtimeDomain,
        executionBinarySha256: proof?.executionBinarySha256 ?? null,
        binarySha256,
        foundationDomainReceiptRoot: proof?.foundationDomainReceiptRoot ?? null,
        nativeVmExecutionAttestationRoot: proof?.nativeVmExecutionAttestationRoot ?? null,
      },
    );
  }

  if (!proof?.finalState || typeof proof.finalState !== 'object' || Array.isArray(proof.finalState)) {
    fail(
      'RCL_CORE_DEPLOYMENT_FINAL_STATE_MISSING',
      'Core deployment proof lost its bounded final-state witness.',
      { canonicalDomain, runtimeDomain, finalState: proof?.finalState ?? null },
    );
  }

  const payload = {
    format: FOUNDATION_CORE_DEPLOYMENT_EVIDENCE_FORMAT,
    version: FOUNDATION_CORE_DEPLOYMENT_EVIDENCE_VERSION,
    domain: canonicalDomain,
    runtimeDomain,
    status: errors.length === 0 ? 'deployment-bound' : 'deployment-drift',
    verified: errors.length === 0,
    binarySha256,
    executionBinarySha256: proof?.executionBinarySha256 ?? null,
    foundationDomainReceiptRoot: proof?.foundationDomainReceiptRoot ?? null,
    nativeVmExecutionAttestationRoot: proof?.nativeVmExecutionAttestationRoot ?? null,
    loweredCount: proof?.loweredCount ?? null,
    finalState: proof?.finalState ?? null,
    truthBoundary: {
      boundedFoundationSliceOnly: true,
      canonicalDomainMayMapToDifferentRuntimeDomain: canonicalDomain !== runtimeDomain,
      providerBridgeRemovedGlobally: false,
      allProgramsNativeClaimed: false,
      completeFoundationDirectCoverageClaimed: false,
      fullHistoryParityClaimed: false,
    },
  };

  return {
    ok: errors.length === 0,
    ...payload,
    deploymentEvidenceRoot: sha256Canonical(payload),
    errors,
  };
}

export const foundationPerceptionDeploymentEvidence = options =>
  foundationCoreDeploymentEvidence('perception', options);
export const foundationPhysicalDeploymentEvidence = options =>
  foundationCoreDeploymentEvidence('physical', options);
export const foundationNeuralDeploymentEvidence = options =>
  foundationCoreDeploymentEvidence('neural', options);
export const foundationGeneticDeploymentEvidence = options =>
  foundationCoreDeploymentEvidence('genetic', options);
export const foundationLifeDeploymentEvidence = options =>
  foundationCoreDeploymentEvidence('life', options);
