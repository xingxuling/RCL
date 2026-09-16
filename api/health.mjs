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

function nativeVmDeploymentStatus() {
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
    && attestation.format === 'taowind.rcl-vercel-native-artifact.v0.2'
    && attestation.binarySha256 === binarySha256
    && attestation.replayProof?.stateRootVerified === true
    && attestation.replayProof?.stateRootParity === true
    && attestation.replayProof?.attestationBinarySha256 === binarySha256
    && isSha256(attestation.replayProof?.attestationRoot)
  );

  const foundationParity = attestation?.foundationParityProof ?? null;
  const foundationParityBound = Boolean(
    replayEvidenceBound
    && foundationParity?.domain === 'perception'
    && foundationParity?.status === 'native-verified'
    && foundationParity?.verified === true
    && foundationParity?.loweredCount === 1
    && foundationParity?.parity?.state === true
    && foundationParity?.parity?.semanticStateRoot === true
    && foundationParity?.parity?.nativeStateRootVerified === true
    && foundationParity?.parity?.nativeStateRootParity === true
    && foundationParity?.parity?.loweringLineage === true
    && foundationParity?.parity?.domainReceipt === true
    && foundationParity?.parity?.nativeExecutionAttestation === true
    && foundationParity?.executionBinarySha256 === binarySha256
    && isSha256(foundationParity?.foundationDomainReceiptRoot)
    && isSha256(foundationParity?.nativeVmExecutionAttestationRoot)
  );

  return {
    bundled,
    executable,
    attestationBundled,
    replayEvidenceBound,
    foundationParityBound,
    evidenceBound: replayEvidenceBound && foundationParityBound,
    binarySha256,
    sourceRoot: attestation?.sourceMaterialization?.sourceRoot ?? null,
    executionAttestationRoot: attestation?.replayProof?.attestationRoot ?? null,
    foundationParity: foundationParity ? {
      domain: foundationParity.domain ?? null,
      status: foundationParity.status ?? null,
      verified: foundationParity.verified === true,
      loweredCount: foundationParity.loweredCount ?? null,
      domainReceiptRoot: foundationParity.foundationDomainReceiptRoot ?? null,
      nativeVmExecutionAttestationRoot: foundationParity.nativeVmExecutionAttestationRoot ?? null,
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
