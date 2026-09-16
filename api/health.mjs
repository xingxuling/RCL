import crypto from 'node:crypto';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { RCL_MCP_SERVER_NAME, RCL_MCP_SERVER_VERSION, listRclMcpTools } from '../src/rcl-mcp-server.mjs';

const NATIVE_VM_PATH = fileURLToPath(new URL('../native/rclvm', import.meta.url));
const NATIVE_VM_ATTESTATION_PATH = fileURLToPath(new URL('../native/rclvm.vercel-attestation.json', import.meta.url));

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function isSha256(value) {
  return typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value);
}

function coreParityBound(proof, domain, binarySha256) {
  return Boolean(
    proof?.domain === domain
    && proof?.status === 'native-verified'
    && proof?.verified === true
    && Number(proof?.loweredCount ?? 0) >= 1
    && proof?.parity?.state === true
    && proof?.parity?.semanticStateRoot === true
    && proof?.parity?.nativeStateRootVerified === true
    && proof?.parity?.nativeStateRootParity === true
    && proof?.parity?.loweringLineage === true
    && proof?.parity?.domainReceipt === true
    && proof?.parity?.nativeExecutionAttestation === true
    && proof?.executionBinarySha256 === binarySha256
    && isSha256(proof?.foundationDomainReceiptRoot)
    && isSha256(proof?.nativeVmExecutionAttestationRoot)
  );
}

function physicalQuantityEvidenceBound(proof, binarySha256) {
  const position = proof?.finalState?.['world.stone.position'];
  const velocity = proof?.finalState?.['world.stone.velocity'];
  return Boolean(
    coreParityBound(proof, 'physical', binarySha256)
    && proof?.loweredCount === 2
    && Number(proof?.quantityNativeLowering?.summary?.quantityConstructorCount ?? 0) >= 1
    && Number(proof?.quantityNativeLowering?.summary?.quantityBinaryCount ?? 0) >= 1
    && Number(proof?.quantityNativeLowering?.summary?.quantityExtremumCount ?? 0) >= 1
    && proof?.quantityNativeLowering?.truthBoundary?.quantityMetadataRetained === true
    && proof?.quantityNativeLowering?.truthBoundary?.quantityExtremaLoweredViaPureChoose === true
    && proof?.quantityNativeLowering?.truthBoundary?.nativeVmOpcodeExtensionRequired === false
    && position?.kind === 'Quantity'
    && position?.type === 'Length'
    && position?.unit === 'm'
    && position?.value === 12
    && velocity?.kind === 'Quantity'
    && velocity?.type === 'Velocity'
    && velocity?.unit === 'm/s'
    && velocity?.value === 1
  );
}

function proofSummary(proof) {
  if (!proof) return null;
  return {
    domain: proof.domain ?? null,
    status: proof.status ?? null,
    verified: proof.verified === true,
    loweredCount: proof.loweredCount ?? null,
    domainReceiptRoot: proof.foundationDomainReceiptRoot ?? null,
    nativeVmExecutionAttestationRoot: proof.nativeVmExecutionAttestationRoot ?? null,
    executionBinarySha256: proof.executionBinarySha256 ?? null,
  };
}

export function nativeVmDeploymentStatus() {
  const bundled = fs.existsSync(NATIVE_VM_PATH);
  const attestationBundled = fs.existsSync(NATIVE_VM_ATTESTATION_PATH);
  let executable = false;
  let binarySha256 = null;
  let attestation = null;

  if (bundled) {
    binarySha256 = sha256(fs.readFileSync(NATIVE_VM_PATH));
    try {
      fs.accessSync(NATIVE_VM_PATH, fs.constants.X_OK);
      executable = true;
    } catch {
      executable = false;
    }
  }

  if (attestationBundled) {
    try {
      attestation = JSON.parse(fs.readFileSync(NATIVE_VM_ATTESTATION_PATH, 'utf8'));
    } catch {
      attestation = null;
    }
  }

  const replayEvidenceBound = Boolean(
    bundled
    && executable
    && attestation
    && attestation.format === 'taowind.rcl-vercel-native-artifact.v0.3'
    && attestation.binarySha256 === binarySha256
    && attestation.replayProof?.stateRootVerified === true
    && attestation.replayProof?.stateRootParity === true
    && attestation.replayProof?.attestationBinarySha256 === binarySha256
    && isSha256(attestation.replayProof?.attestationRoot)
  );

  const perceptionProof = attestation?.foundationParityProofs?.perception ?? attestation?.foundationParityProof ?? null;
  const physicalProof = attestation?.foundationParityProofs?.physical ?? attestation?.foundationPhysicalParityProof ?? null;
  const perceptionParityBound = Boolean(replayEvidenceBound && coreParityBound(perceptionProof, 'perception', binarySha256));
  const physicalParityBound = Boolean(replayEvidenceBound && physicalQuantityEvidenceBound(physicalProof, binarySha256));
  const foundationParityBound = perceptionParityBound && physicalParityBound;
  const foundationParityDomains = [
    ...(perceptionParityBound ? ['perception'] : []),
    ...(physicalParityBound ? ['physical'] : []),
  ];

  return {
    bundled,
    executable,
    attestationBundled,
    replayEvidenceBound,
    foundationParityBound,
    perceptionParityBound,
    physicalParityBound,
    evidenceBound: replayEvidenceBound && foundationParityBound,
    binarySha256,
    sourceRoot: attestation?.sourceMaterialization?.sourceRoot ?? null,
    executionAttestationRoot: attestation?.replayProof?.attestationRoot ?? null,
    foundationParityDomains,
    foundationParity: proofSummary(perceptionProof),
    foundationParityProofs: {
      perception: proofSummary(perceptionProof),
      physical: proofSummary(physicalProof),
    },
    physicalQuantityEvidence: physicalProof ? {
      quantityConstructorCount: physicalProof.quantityNativeLowering?.summary?.quantityConstructorCount ?? null,
      quantityBinaryCount: physicalProof.quantityNativeLowering?.summary?.quantityBinaryCount ?? null,
      quantityExtremumCount: physicalProof.quantityNativeLowering?.summary?.quantityExtremumCount ?? null,
      finalPosition: physicalProof.finalState?.['world.stone.position'] ?? null,
      finalVelocity: physicalProof.finalState?.['world.stone.velocity'] ?? null,
    } : null,
  };
}

export default function handler(_request, response) {
  const tools = listRclMcpTools();
  response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  response.end(`${JSON.stringify({
    ok: true,
    name: RCL_MCP_SERVER_NAME,
    version: RCL_MCP_SERVER_VERSION,
    endpoint: '/mcp',
    toolCount: tools.length,
    rclToolCount: tools.filter(tool => tool.name.startsWith('rcl_')).length,
    rncsToolCount: tools.filter(tool => tool.name.startsWith('rncs_')).length,
    nativeVmDeployment: nativeVmDeploymentStatus(),
  })}\n`);
}
