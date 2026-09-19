import crypto from 'node:crypto';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const NATIVE_VM_PATH = fileURLToPath(new URL('../native/rclvm', import.meta.url));
const NATIVE_VM_ATTESTATION_PATH = fileURLToPath(new URL('../native/rclvm.vercel-attestation.json', import.meta.url));

export const FOUNDATION_ENERGY_DEPLOYMENT_EVIDENCE_FORMAT = 'taowind.rcl-foundation-energy-deployment-evidence.v0.1';
export const FOUNDATION_ENERGY_DEPLOYMENT_EVIDENCE_VERSION = '0.1.0';

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

function isEnergyQuantity(value, expected) {
  return value?.kind === 'Quantity'
    && value?.type === 'Energy'
    && value?.unit === 'J'
    && value?.value === expected;
}

export function foundationEnergyDeploymentEvidence({ binaryBytes, attestation } = {}) {
  const errors = [];
  const fail = (code, message, details = {}) => errors.push({ code, message, ...details });
  const bytes = binaryBytes ?? fs.readFileSync(NATIVE_VM_PATH);
  const manifest = attestation ?? JSON.parse(fs.readFileSync(NATIVE_VM_ATTESTATION_PATH, 'utf8'));
  const binarySha256 = sha256(bytes);
  const proof = manifest?.foundationParityProofs?.energy ?? manifest?.foundationEnergyParityProof ?? null;

  if (manifest?.binarySha256 !== binarySha256) {
    fail(
      'RCL_ENERGY_DEPLOYMENT_BINARY_DRIFT',
      'Energy deployment evidence is not attached to the exact bundled Native VM binary.',
      { manifestBinarySha256: manifest?.binarySha256 ?? null, binarySha256 },
    );
  }

  if (
    proof?.domain !== 'energy'
    || proof?.status !== 'native-verified'
    || proof?.verified !== true
    || proof?.boundedSubset !== true
    || proof?.loweredDirectiveCount !== 1
    || proof?.loweredFlowCount !== 1
  ) {
    fail(
      'RCL_ENERGY_DEPLOYMENT_PROOF_IDENTITY_DRIFT',
      'Energy deployment proof identity/counts are missing or overclaimed.',
      { proof },
    );
  }

  const parity = proof?.parity ?? {};
  if (
    parity.state !== true
    || parity.semanticStateRoot !== true
    || parity.nativeStateRootVerified !== true
    || parity.nativeStateRootParity !== true
    || parity.energyReceipt !== true
    || parity.nativeExecutionAttestation !== true
  ) {
    fail(
      'RCL_ENERGY_DEPLOYMENT_PARITY_DRIFT',
      'Energy deployment proof no longer closes state/root/receipt/executable parity.',
      { parity },
    );
  }

  if (
    proof?.executionBinarySha256 !== binarySha256
    || !isSha256(proof?.nativeVmExecutionAttestationRoot)
    || !isSha256(proof?.energyReceiptRoot)
    || proof?.energyReceiptRootAlgorithm !== 'rcl.foundation-energy-receipt-root.sha256.v0.1'
  ) {
    fail(
      'RCL_ENERGY_DEPLOYMENT_ROOT_BINDING_DRIFT',
      'Energy deployment proof lost content-addressed receipt/execution/binary binding.',
      {
        executionBinarySha256: proof?.executionBinarySha256 ?? null,
        binarySha256,
        nativeVmExecutionAttestationRoot: proof?.nativeVmExecutionAttestationRoot ?? null,
        energyReceiptRoot: proof?.energyReceiptRoot ?? null,
        energyReceiptRootAlgorithm: proof?.energyReceiptRootAlgorithm ?? null,
      },
    );
  }

  const sourceState = proof?.finalState?.['grid.source'];
  const loadState = proof?.finalState?.['grid.load'];
  if (!isEnergyQuantity(sourceState, 60) || !isEnergyQuantity(loadState, 36)) {
    fail(
      'RCL_ENERGY_DEPLOYMENT_STATE_DRIFT',
      'Energy deployment evidence lost the verified bounded transfer final state.',
      { sourceState, loadState },
    );
  }

  const boundary = proof?.truthBoundary ?? {};
  if (
    boundary.boundedEnergySubsetOnly !== true
    || boundary.stateIndependentAmountsRequired !== true
    || boundary.literalEfficiencyRequired !== true
    || boundary.disjointReservoirTopologyRequired !== true
    || boundary.oneEnergizeDirectiveMapsToOneAtomicNativeTransaction !== true
    || boundary.referenceReceiptAndNativeReceiptMustMatchExactly !== true
    || boundary.canonicalRealCExecutionRequiredForVerifiedStatus !== true
    || boundary.providerBridgeRemovedGlobally !== false
    || boundary.allEnergyProgramsNativeClaimed !== false
    || boundary.fullHistoryParityClaimed !== false
  ) {
    fail(
      'RCL_ENERGY_DEPLOYMENT_BOUNDARY_DRIFT',
      'Energy deployment truth boundary drifted or overclaimed the bounded proof.',
      { boundary },
    );
  }

  const payload = {
    format: FOUNDATION_ENERGY_DEPLOYMENT_EVIDENCE_FORMAT,
    version: FOUNDATION_ENERGY_DEPLOYMENT_EVIDENCE_VERSION,
    domain: 'energy',
    status: errors.length === 0 ? 'deployment-bound' : 'deployment-drift',
    verified: errors.length === 0,
    binarySha256,
    executionBinarySha256: proof?.executionBinarySha256 ?? null,
    nativeVmExecutionAttestationRoot: proof?.nativeVmExecutionAttestationRoot ?? null,
    energyReceiptRoot: proof?.energyReceiptRoot ?? null,
    energyReceiptRootAlgorithm: proof?.energyReceiptRootAlgorithm ?? null,
    loweredDirectiveCount: proof?.loweredDirectiveCount ?? null,
    loweredFlowCount: proof?.loweredFlowCount ?? null,
    finalState: {
      'grid.source': sourceState ?? null,
      'grid.load': loadState ?? null,
    },
    truthBoundary: {
      boundedEnergySubsetOnly: boundary.boundedEnergySubsetOnly === true,
      providerBridgeRemovedGlobally: boundary.providerBridgeRemovedGlobally === true,
      allEnergyProgramsNativeClaimed: boundary.allEnergyProgramsNativeClaimed === true,
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
