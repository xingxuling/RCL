import crypto from 'node:crypto';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const NATIVE_VM_PATH = fileURLToPath(new URL('../native/rclvm', import.meta.url));
const NATIVE_VM_ATTESTATION_PATH = fileURLToPath(new URL('../native/rclvm.vercel-attestation.json', import.meta.url));
export const FOUNDATION_QUANTITATIVE_DEPLOYMENT_EVIDENCE_FORMAT = 'taowind.rcl-foundation-quantitative-deployment-evidence.v0.1';
export const FOUNDATION_QUANTITATIVE_DEPLOYMENT_EVIDENCE_VERSION = '0.1.0';

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}
function sha256(buffer) { return crypto.createHash('sha256').update(buffer).digest('hex'); }
function sha256Canonical(value) { return sha256(JSON.stringify(canonical(value))); }
function isSha256(value) { return typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value); }

export function foundationQuantitativeDeploymentEvidence({ binaryBytes, attestation } = {}) {
  const bytes = binaryBytes ?? fs.readFileSync(NATIVE_VM_PATH);
  const manifest = attestation ?? JSON.parse(fs.readFileSync(NATIVE_VM_ATTESTATION_PATH, 'utf8'));
  const binarySha256 = sha256(bytes);
  const proof = manifest?.foundationQuantitativeParityProof ?? null;
  const errors = [];
  const fail = (code, message, details = {}) => errors.push({ code, message, ...details });

  if (manifest?.binarySha256 !== binarySha256) fail('RCL_QUANTITATIVE_DEPLOYMENT_BINARY_DRIFT', 'Quantitative deployment evidence is not attached to the exact bundled Native VM binary.', { binarySha256, manifestBinarySha256: manifest?.binarySha256 ?? null });
  if (proof?.domain !== 'quantitative' || proof?.status !== 'native-verified' || proof?.verified !== true || proof?.boundedSubset !== true || Number(proof?.loweredCount ?? 0) < 1) {
    fail('RCL_QUANTITATIVE_DEPLOYMENT_PROOF_IDENTITY_DRIFT', 'Quantitative parity proof identity/status is missing or overclaimed.', { proof });
  }
  if (
    proof?.parity?.quantitativeStateProjection !== true
    || proof?.parity?.quantitativeSemanticStateRoot !== true
    || proof?.parity?.nativeStateRootVerified !== true
    || proof?.parity?.nativeStateRootParity !== true
    || proof?.parity?.quantitativeReceipt !== true
    || proof?.parity?.nativeExecutionAttestation !== true
  ) fail('RCL_QUANTITATIVE_DEPLOYMENT_PARITY_DRIFT', 'Quantitative deployment proof lost projection/root/receipt/executable parity.', { parity: proof?.parity ?? null });
  if (
    proof?.executionBinarySha256 !== binarySha256
    || !isSha256(proof?.quantitativeReceiptRoot)
    || !isSha256(proof?.referenceQuantitativeStateRoot)
    || !isSha256(proof?.nativeQuantitativeStateRoot)
    || proof?.referenceQuantitativeStateRoot !== proof?.nativeQuantitativeStateRoot
    || !isSha256(proof?.nativeVmExecutionAttestationRoot)
  ) fail('RCL_QUANTITATIVE_DEPLOYMENT_ROOT_BINDING_DRIFT', 'Quantitative deployment proof lost content-addressed receipt/state/execution binding.', { proof, binarySha256 });

  const payload = {
    format: FOUNDATION_QUANTITATIVE_DEPLOYMENT_EVIDENCE_FORMAT,
    version: FOUNDATION_QUANTITATIVE_DEPLOYMENT_EVIDENCE_VERSION,
    domain: 'quantitative',
    status: errors.length === 0 ? 'deployment-bound' : 'deployment-drift',
    verified: errors.length === 0,
    binarySha256,
    executionBinarySha256: proof?.executionBinarySha256 ?? null,
    quantitativeReceiptRoot: proof?.quantitativeReceiptRoot ?? null,
    quantitativeStateRoot: proof?.nativeQuantitativeStateRoot ?? null,
    nativeVmExecutionAttestationRoot: proof?.nativeVmExecutionAttestationRoot ?? null,
    finalState: proof?.finalState ?? null,
    truthBoundary: {
      boundedQuantitativeSubsetOnly: true,
      parityProofIsSeparateFromStandaloneDirectExecutionProof: true,
      standaloneDirectProofMayRemainConservative: true,
      providerBridgeRemovedGlobally: false,
      allQuantitativeProgramsNativeClaimed: false,
      fullHistoryParityClaimed: false,
    },
  };
  return { ok: errors.length === 0, ...payload, deploymentEvidenceRoot: sha256Canonical(payload), errors };
}
