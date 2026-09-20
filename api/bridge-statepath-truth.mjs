import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  FOUNDATION_NATIVE_BRIDGE_SPECS,
  foundationNativeBridgeCapabilityRegistrySnapshot,
} from '../src/foundation-native-bridge-capability-registry.mjs';
import { verifyFoundationNativeBridgeStatePathAttestation } from '../src/foundation-native-bridge-statepath-attestation.mjs';

const ATTESTATION_PATH = fileURLToPath(new URL('../native/rclvm.vercel-attestation.json', import.meta.url));

export function bridgeStatePathTruthStatus() {
  if (!fs.existsSync(ATTESTATION_PATH)) {
    const error = new Error('Canonical native deployment attestation is missing');
    error.code = 'RCL_BRIDGE_STATEPATH_NATIVE_ATTESTATION_MISSING';
    throw error;
  }
  const nativeAttestation = JSON.parse(fs.readFileSync(ATTESTATION_PATH, 'utf8'));
  const attestation = nativeAttestation?.foundationNativeBridgeStatePathAttestation ?? null;
  const registry = foundationNativeBridgeCapabilityRegistrySnapshot();
  const verification = verifyFoundationNativeBridgeStatePathAttestation({
    attestation,
    bridgeSpecs: FOUNDATION_NATIVE_BRIDGE_SPECS,
    registrySnapshot: registry,
  });
  return Object.freeze({
    ok: true,
    status: 'RCL_PROVIDER_BRIDGE_STATEPATH_SEMANTICS_VERIFIED',
    attestationRoot: verification.attestationRoot,
    providerBridgeRegistryRoot: verification.providerBridgeRegistryRoot,
    providerBridgeSpecCount: verification.providerBridgeSpecCount,
    domains: [...verification.domains],
    truthBoundary: {
      executableStatePathBoundToCanonicalRegistry: true,
      semanticResultPathBoundToFoundationDomainContract: true,
      sourceRootAndReceiptRootBindObservedExecutionEvidence: true,
      replayVerificationRequired: true,
      statePathSemanticAttestationDoesNotImplyDirectNativeExecution: true,
    },
  });
}

export default function handler(_request, response) {
  try {
    const status = bridgeStatePathTruthStatus();
    response.writeHead(200, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=0, must-revalidate',
    });
    response.end(`${JSON.stringify(status)}\n`);
  } catch (error) {
    response.writeHead(503, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=0, must-revalidate',
    });
    response.end(`${JSON.stringify({
      ok: false,
      status: 'RCL_PROVIDER_BRIDGE_STATEPATH_SEMANTICS_DRIFT',
      error: error?.message ?? String(error),
      code: error?.code ?? null,
      details: error?.details ?? null,
    })}\n`);
  }
}
