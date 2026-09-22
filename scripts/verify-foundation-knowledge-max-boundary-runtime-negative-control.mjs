#!/usr/bin/env node
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { foundationKnowledgeDeploymentEvidence } from '../src/foundation-knowledge-deployment-evidence.mjs';

const binaryPath = fileURLToPath(new URL('../native/rclvm', import.meta.url));
const manifestPath = fileURLToPath(new URL('../native/rclvm.vercel-attestation.json', import.meta.url));

function clone(value) { return structuredClone(value); }
function fail(message, details = {}) {
  console.error(JSON.stringify({
    ok: false,
    status: 'RCL_KNOWLEDGE_MAX_BOUNDARY_RUNTIME_NEGATIVE_CONTROL_FAILED',
    message,
    ...details,
  }, null, 2));
  process.exit(1);
}
function hasCode(evidence, code) {
  return Array.isArray(evidence?.errors) && evidence.errors.some(error => error?.code === code);
}

const binaryBytes = fs.readFileSync(binaryPath);
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const baseline = foundationKnowledgeDeploymentEvidence({ binaryBytes, attestation: manifest });
if (
  baseline?.ok !== true
  || baseline?.verified !== true
  || baseline?.truthBoundary?.maxBoundaryRuntimeTruthBound !== true
  || baseline?.truthBoundary?.maxBoundedClaimCountRealCVerified !== true
  || baseline?.truthBoundary?.verifiedAtomicClaimCount !== 4
  || baseline?.maxBoundaryLoweredClaimCount !== 4
) {
  fail('Baseline Knowledge deployment evidence did not bind the exact four-claim max-boundary runtime attestation.', { baseline });
}

const rootDrift = clone(manifest);
rootDrift.foundationKnowledgeMaxBoundaryProof.attestationRoot = '0'.repeat(64);
const rootDriftEvidence = foundationKnowledgeDeploymentEvidence({ binaryBytes, attestation: rootDrift });
if (rootDriftEvidence?.ok !== false || !hasCode(rootDriftEvidence, 'RCL_KNOWLEDGE_MAX_BOUNDARY_RUNTIME_ATTESTATION_DRIFT')) {
  fail('Attestation-root drift did not fail closed.', { rootDriftEvidence });
}

const receiptDrift = clone(manifest);
receiptDrift.foundationKnowledgeMaxBoundaryProof.knowledgeReceiptRoot = '1'.repeat(64);
const receiptDriftEvidence = foundationKnowledgeDeploymentEvidence({ binaryBytes, attestation: receiptDrift });
if (receiptDriftEvidence?.ok !== false || !hasCode(receiptDriftEvidence, 'RCL_KNOWLEDGE_MAX_BOUNDARY_RUNTIME_ATTESTATION_DRIFT')) {
  fail('Max-boundary Knowledge receipt-root drift did not fail closed.', { receiptDriftEvidence });
}

const overclaim = clone(manifest);
overclaim.foundationKnowledgeMaxBoundaryProof.truthBoundary.fullHistoryParityClaimed = true;
const overclaimEvidence = foundationKnowledgeDeploymentEvidence({ binaryBytes, attestation: overclaim });
if (overclaimEvidence?.ok !== false || !hasCode(overclaimEvidence, 'RCL_KNOWLEDGE_MAX_BOUNDARY_RUNTIME_ATTESTATION_DRIFT')) {
  fail('Full-history overclaim did not fail closed.', { overclaimEvidence });
}

const missing = clone(manifest);
delete missing.foundationKnowledgeMaxBoundaryProof;
const missingEvidence = foundationKnowledgeDeploymentEvidence({ binaryBytes, attestation: missing });
if (
  missingEvidence?.ok !== true
  || missingEvidence?.truthBoundary?.maxBoundaryRuntimeTruthBound !== false
  || missingEvidence?.truthBoundary?.maxBoundedClaimCountRealCVerified !== false
  || missingEvidence?.truthBoundary?.verifiedAtomicClaimCount !== 2
) {
  fail('Pre-binding compatibility must remain explicit and conservative rather than inventing max-boundary truth.', { missingEvidence });
}

console.log(JSON.stringify({
  ok: true,
  status: 'RCL_KNOWLEDGE_MAX_BOUNDARY_RUNTIME_NEGATIVE_CONTROL_VERIFIED',
  truthBoundary: {
    exactAttestationRootRequiredWhenPresent: true,
    exactReceiptRootRequiredWhenPresent: true,
    fullHistoryOverclaimFailsClosed: true,
    missingMaxBoundaryAttestationRemainsConservativeUntilCanonicalVerifier: true,
    canonicalFinalRuntimeTruthMustRequireBoundMaxBoundaryAttestation: true,
  },
}, null, 2));
