#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const manifestPath = path.join(root, 'native', 'rclvm.vercel-attestation.json');
const proofPath = path.join(root, 'public', 'rcl-foundation-knowledge-max-boundary-proof.json');

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}
function sha256Canonical(value) {
  return crypto.createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}
function isSha256(value) { return typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value); }
function fail(message, details = {}, exitCode = 1) {
  console.error(JSON.stringify({
    ok: false,
    status: 'RCL_FOUNDATION_KNOWLEDGE_MAX_BOUNDARY_RUNTIME_BINDING_FAILED',
    message,
    exitCode,
    ...details,
  }, null, 2));
  process.exit(exitCode);
}

if (!fs.existsSync(manifestPath)) fail('Canonical Native VM attestation manifest is missing.', { manifestPath }, 231);
if (!fs.existsSync(proofPath)) fail('Knowledge max-boundary public proof is missing.', { proofPath }, 232);

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const proof = JSON.parse(fs.readFileSync(proofPath, 'utf8'));
const binarySha256 = manifest?.binarySha256 ?? null;
const roots = Object.values(proof?.claimFormedAtRoots ?? {});
if (
  proof?.ok !== true
  || proof?.verified !== true
  || proof?.status !== 'native-verified'
  || proof?.domain !== 'knowledge'
  || proof?.loweredDirectiveCount !== 1
  || proof?.loweredClaimCount !== 4
  || proof?.binarySha256 !== binarySha256
  || proof?.executionBinarySha256 !== binarySha256
  || !isSha256(proof?.nativeVmExecutionAttestationRoot)
  || !isSha256(proof?.knowledgeReceiptRoot)
  || roots.length !== 4
  || roots.some(rootValue => !isSha256(rootValue))
  || new Set(roots).size !== 4
  || proof?.parity?.state !== true
  || proof?.parity?.semanticStateRoot !== true
  || proof?.parity?.nativeStateRootVerified !== true
  || proof?.parity?.nativeStateRootParity !== true
  || proof?.parity?.knowledgeReceipt !== true
  || proof?.parity?.nativeExecutionAttestation !== true
  || proof?.truthBoundary?.maxBoundedClaimCount !== 4
  || proof?.truthBoundary?.verifiedAtomicClaimCount !== 4
  || proof?.truthBoundary?.maxBoundedClaimCountRealCVerified !== true
  || proof?.truthBoundary?.overBoundaryFiveClaimsRemainProviderBound !== true
  || proof?.truthBoundary?.providerBridgeRemovedGlobally !== false
  || proof?.truthBoundary?.allKnowledgeProgramsNativeClaimed !== false
  || proof?.truthBoundary?.fullHistoryParityClaimed !== false
) {
  fail('Knowledge max-boundary proof is not eligible for runtime attestation binding.', { proof, binarySha256 }, 233);
}

const attestationRoot = sha256Canonical(proof);
const runtimeAttestation = {
  ...proof,
  attestationRoot,
  runtimeBinding: {
    exactBinaryRequired: true,
    canonicalRuntimeTruthConsumerRequired: true,
    baseTwoClaimBehavioralSpecimenRemainsDistinct: true,
    maxBoundaryAttestationDoesNotClaimFullKnowledgeNativeCoverage: true,
  },
};
manifest.foundationKnowledgeMaxBoundaryProof = runtimeAttestation;
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(JSON.stringify({
  ok: true,
  status: 'RCL_FOUNDATION_KNOWLEDGE_MAX_BOUNDARY_RUNTIME_BOUND',
  binarySha256,
  attestationRoot,
  loweredClaimCount: runtimeAttestation.loweredClaimCount,
  knowledgeReceiptRoot: runtimeAttestation.knowledgeReceiptRoot,
  truthBoundary: runtimeAttestation.truthBoundary,
}, null, 2));
