import crypto from 'node:crypto';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { RCL_MCP_SERVER_NAME, RCL_MCP_SERVER_VERSION, listRclMcpTools } from '../src/rcl-mcp-server.mjs';

const NATIVE_VM_PATH = fileURLToPath(new URL('../native/rclvm', import.meta.url));
const NATIVE_VM_ATTESTATION_PATH = fileURLToPath(new URL('../native/rclvm.vercel-attestation.json', import.meta.url));

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
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

  const evidenceBound = Boolean(
    bundled
    && executable
    && attestation
    && attestation.format === 'taowind.rcl-vercel-native-artifact.v0.1'
    && attestation.binarySha256 === binarySha256
    && attestation.replayProof?.stateRootVerified === true
    && attestation.replayProof?.stateRootParity === true
    && attestation.replayProof?.attestationBinarySha256 === binarySha256
    && typeof attestation.replayProof?.attestationRoot === 'string'
    && attestation.replayProof.attestationRoot.length > 0
  );

  return {
    bundled,
    executable,
    attestationBundled,
    evidenceBound,
    binarySha256,
    sourceRoot: attestation?.sourceMaterialization?.sourceRoot ?? null,
    executionAttestationRoot: attestation?.replayProof?.attestationRoot ?? null,
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
