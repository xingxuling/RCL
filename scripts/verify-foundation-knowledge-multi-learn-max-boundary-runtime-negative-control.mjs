#!/usr/bin/env node
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { foundationKnowledgeMultiLearnRuntimeEvidence } from '../src/foundation-knowledge-multi-learn-runtime-evidence.mjs';

const binaryPath = fileURLToPath(new URL('../native/rclvm', import.meta.url));
const manifestPath = fileURLToPath(new URL('../native/rclvm.vercel-attestation.json', import.meta.url));

function clone(value) { return structuredClone(value); }
function fail(message, details = {}) {
  console.error(JSON.stringify({
    ok: false,
    status: 'RCL_KNOWLEDGE_MULTI_LEARN_MAX_BOUNDARY_RUNTIME_NEGATIVE_CONTROL_FAILED',
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
const baseline = foundationKnowledgeMultiLearnRuntimeEvidence({ binaryBytes, attestation: manifest });
if (
  baseline?.ok !== true
  || baseline?.present !== true
  || baseline?.verified !== true
  || baseline?.status !== 'runtime-bound'
  || baseline?.maxBoundaryPresent !== true
  || baseline?.maxBoundaryVerified !== true
  || baseline?.maxBoundaryStatus !== 'runtime-bound'
  || baseline?.maxBoundaryLoweredLearnCount !== 2
  || baseline?.maxBoundaryLoweredClaimCount !== 8
  || baseline?.truthBoundary?.maxBoundaryRuntimeTruthBound !== true
) {
  fail('Baseline bounded multi-Learn max-boundary runtime evidence did not bind the exact canonical 2x4 real-C proof.', { baseline });
}

const rootDrift = clone(manifest);
rootDrift.foundationKnowledgeMultiLearnMaxBoundaryProof.attestationRoot = '0'.repeat(64);
const rootDriftEvidence = foundationKnowledgeMultiLearnRuntimeEvidence({ binaryBytes, attestation: rootDrift });
if (rootDriftEvidence?.ok !== false || !hasCode(rootDriftEvidence, 'RCL_KNOWLEDGE_MULTI_LEARN_MAX_BOUNDARY_RUNTIME_ATTESTATION_DRIFT')) {
  fail('Multi-Learn max-boundary attestation-root drift did not fail closed.', { rootDriftEvidence });
}

const receiptDrift = clone(manifest);
receiptDrift.foundationKnowledgeMultiLearnMaxBoundaryProof.knowledgeReceiptRoot = '1'.repeat(64);
const receiptDriftEvidence = foundationKnowledgeMultiLearnRuntimeEvidence({ binaryBytes, attestation: receiptDrift });
if (receiptDriftEvidence?.ok !== false || !hasCode(receiptDriftEvidence, 'RCL_KNOWLEDGE_MULTI_LEARN_MAX_BOUNDARY_RUNTIME_ATTESTATION_DRIFT')) {
  fail('Multi-Learn max-boundary Knowledge receipt-root drift did not fail closed.', { receiptDriftEvidence });
}

const binaryDrift = clone(manifest);
binaryDrift.foundationKnowledgeMultiLearnMaxBoundaryProof.executionBinarySha256 = '2'.repeat(64);
const binaryDriftEvidence = foundationKnowledgeMultiLearnRuntimeEvidence({ binaryBytes, attestation: binaryDrift });
if (binaryDriftEvidence?.ok !== false || !hasCode(binaryDriftEvidence, 'RCL_KNOWLEDGE_MULTI_LEARN_MAX_BOUNDARY_RUNTIME_ATTESTATION_DRIFT')) {
  fail('Multi-Learn max-boundary execution-binary drift did not fail closed.', { binaryDriftEvidence });
}

const claimOverclaim = clone(manifest);
claimOverclaim.foundationKnowledgeMultiLearnMaxBoundaryProof.truthBoundary.fiveOrMoreClaimsPerLearnNativeClaimed = true;
const claimOverclaimEvidence = foundationKnowledgeMultiLearnRuntimeEvidence({ binaryBytes, attestation: claimOverclaim });
if (claimOverclaimEvidence?.ok !== false || !hasCode(claimOverclaimEvidence, 'RCL_KNOWLEDGE_MULTI_LEARN_MAX_BOUNDARY_RUNTIME_ATTESTATION_DRIFT')) {
  fail('Five-or-more claims per Learn overclaim did not fail closed.', { claimOverclaimEvidence });
}

const orderOverclaim = clone(manifest);
orderOverclaim.foundationKnowledgeMultiLearnMaxBoundaryProof.truthBoundary.threeOrMoreLearnDirectivesNativeClaimed = true;
const orderOverclaimEvidence = foundationKnowledgeMultiLearnRuntimeEvidence({ binaryBytes, attestation: orderOverclaim });
if (orderOverclaimEvidence?.ok !== false || !hasCode(orderOverclaimEvidence, 'RCL_KNOWLEDGE_MULTI_LEARN_MAX_BOUNDARY_RUNTIME_ATTESTATION_DRIFT')) {
  fail('Three-or-more Learn overclaim did not fail closed.', { orderOverclaimEvidence });
}

const topologyDrift = clone(manifest);
topologyDrift.foundationKnowledgeMultiLearnMaxBoundaryProof.formedAtRoots[7].root =
  topologyDrift.foundationKnowledgeMultiLearnMaxBoundaryProof.formedAtRoots[6].root;
const topologyDriftEvidence = foundationKnowledgeMultiLearnRuntimeEvidence({ binaryBytes, attestation: topologyDrift });
if (topologyDriftEvidence?.ok !== false || !hasCode(topologyDriftEvidence, 'RCL_KNOWLEDGE_MULTI_LEARN_MAX_BOUNDARY_RUNTIME_ATTESTATION_DRIFT')) {
  fail('Max-boundary sequential formedAtRoot topology drift did not fail closed.', { topologyDriftEvidence });
}

const fullHistoryOverclaim = clone(manifest);
fullHistoryOverclaim.foundationKnowledgeMultiLearnMaxBoundaryProof.truthBoundary.fullHistoryParityClaimed = true;
const fullHistoryOverclaimEvidence = foundationKnowledgeMultiLearnRuntimeEvidence({ binaryBytes, attestation: fullHistoryOverclaim });
if (fullHistoryOverclaimEvidence?.ok !== false || !hasCode(fullHistoryOverclaimEvidence, 'RCL_KNOWLEDGE_MULTI_LEARN_MAX_BOUNDARY_RUNTIME_ATTESTATION_DRIFT')) {
  fail('Full-history overclaim did not fail closed.', { fullHistoryOverclaimEvidence });
}

const missing = clone(manifest);
delete missing.foundationKnowledgeMultiLearnMaxBoundaryProof;
const missingEvidence = foundationKnowledgeMultiLearnRuntimeEvidence({ binaryBytes, attestation: missing });
if (
  missingEvidence?.ok !== true
  || missingEvidence?.present !== true
  || missingEvidence?.verified !== true
  || missingEvidence?.status !== 'runtime-bound'
  || missingEvidence?.maxBoundaryPresent !== false
  || missingEvidence?.maxBoundaryVerified !== false
  || missingEvidence?.maxBoundaryStatus !== 'runtime-unbound'
  || missingEvidence?.truthBoundary?.runtimeTruthBound !== true
  || missingEvidence?.truthBoundary?.maxBoundaryRuntimeTruthBound !== false
) {
  fail('Cycle-85 behavioral binding must remain valid and conservative when the max-boundary attestation is absent.', { missingEvidence });
}

console.log(JSON.stringify({
  ok: true,
  status: 'RCL_KNOWLEDGE_MULTI_LEARN_MAX_BOUNDARY_RUNTIME_NEGATIVE_CONTROL_VERIFIED',
  runtimeEvidenceRoot: baseline.runtimeEvidenceRoot,
  behavioralAttestationRoot: baseline.attestationRoot,
  maxBoundaryAttestationRoot: baseline.maxBoundaryAttestationRoot,
  maxBoundaryKnowledgeReceiptRoot: baseline.maxBoundaryKnowledgeReceiptRoot,
  truthBoundary: {
    exactMaxBoundaryAttestationRootRequiredWhenPresent: true,
    exactMaxBoundaryReceiptRootRequiredWhenPresent: true,
    exactMaxBoundaryExecutionBinaryRequiredWhenPresent: true,
    eightDistinctSequentialFormationRootsRequired: true,
    threeOrMoreLearnOverclaimFailsClosed: true,
    fiveOrMoreClaimsPerLearnOverclaimFailsClosed: true,
    fullHistoryOverclaimFailsClosed: true,
    missingMaxBoundaryAttestationPreservesCycle85BehavioralTruth: true,
    canonicalFinalRuntimeTruthMustBindMaxBoundaryAttestation: true,
  },
}, null, 2));
