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
    status: 'RCL_KNOWLEDGE_MULTI_LEARN_RUNTIME_NEGATIVE_CONTROL_FAILED',
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
  || baseline?.loweredLearnCount !== 2
  || baseline?.loweredClaimCount !== 3
  || baseline?.truthBoundary?.runtimeTruthBound !== true
) {
  fail('Baseline bounded multi-Learn runtime evidence did not bind the exact canonical real-C proof.', { baseline });
}

const rootDrift = clone(manifest);
rootDrift.foundationKnowledgeMultiLearnProof.attestationRoot = '0'.repeat(64);
const rootDriftEvidence = foundationKnowledgeMultiLearnRuntimeEvidence({ binaryBytes, attestation: rootDrift });
if (rootDriftEvidence?.ok !== false || !hasCode(rootDriftEvidence, 'RCL_KNOWLEDGE_MULTI_LEARN_RUNTIME_ATTESTATION_DRIFT')) {
  fail('Multi-Learn attestation-root drift did not fail closed.', { rootDriftEvidence });
}

const receiptDrift = clone(manifest);
receiptDrift.foundationKnowledgeMultiLearnProof.knowledgeReceiptRoot = '1'.repeat(64);
const receiptDriftEvidence = foundationKnowledgeMultiLearnRuntimeEvidence({ binaryBytes, attestation: receiptDrift });
if (receiptDriftEvidence?.ok !== false || !hasCode(receiptDriftEvidence, 'RCL_KNOWLEDGE_MULTI_LEARN_RUNTIME_ATTESTATION_DRIFT')) {
  fail('Multi-Learn Knowledge receipt-root drift did not fail closed.', { receiptDriftEvidence });
}

const binaryDrift = clone(manifest);
binaryDrift.foundationKnowledgeMultiLearnProof.executionBinarySha256 = '2'.repeat(64);
const binaryDriftEvidence = foundationKnowledgeMultiLearnRuntimeEvidence({ binaryBytes, attestation: binaryDrift });
if (binaryDriftEvidence?.ok !== false || !hasCode(binaryDriftEvidence, 'RCL_KNOWLEDGE_MULTI_LEARN_RUNTIME_ATTESTATION_DRIFT')) {
  fail('Multi-Learn execution-binary drift did not fail closed.', { binaryDriftEvidence });
}

const orderOverclaim = clone(manifest);
orderOverclaim.foundationKnowledgeMultiLearnProof.truthBoundary.threeOrMoreLearnDirectivesNativeClaimed = true;
const orderOverclaimEvidence = foundationKnowledgeMultiLearnRuntimeEvidence({ binaryBytes, attestation: orderOverclaim });
if (orderOverclaimEvidence?.ok !== false || !hasCode(orderOverclaimEvidence, 'RCL_KNOWLEDGE_MULTI_LEARN_RUNTIME_ATTESTATION_DRIFT')) {
  fail('Three-or-more Learn overclaim did not fail closed.', { orderOverclaimEvidence });
}

const fullHistoryOverclaim = clone(manifest);
fullHistoryOverclaim.foundationKnowledgeMultiLearnProof.truthBoundary.fullHistoryParityClaimed = true;
const fullHistoryOverclaimEvidence = foundationKnowledgeMultiLearnRuntimeEvidence({ binaryBytes, attestation: fullHistoryOverclaim });
if (fullHistoryOverclaimEvidence?.ok !== false || !hasCode(fullHistoryOverclaimEvidence, 'RCL_KNOWLEDGE_MULTI_LEARN_RUNTIME_ATTESTATION_DRIFT')) {
  fail('Full-history overclaim did not fail closed.', { fullHistoryOverclaimEvidence });
}

const missing = clone(manifest);
delete missing.foundationKnowledgeMultiLearnProof;
const missingEvidence = foundationKnowledgeMultiLearnRuntimeEvidence({ binaryBytes, attestation: missing });
if (
  missingEvidence?.ok !== true
  || missingEvidence?.present !== false
  || missingEvidence?.verified !== false
  || missingEvidence?.status !== 'runtime-unbound'
  || missingEvidence?.truthBoundary?.runtimeTruthBound !== false
) {
  fail('Pre-binding compatibility must remain explicit and conservative rather than inventing bounded multi-Learn runtime truth.', { missingEvidence });
}

console.log(JSON.stringify({
  ok: true,
  status: 'RCL_KNOWLEDGE_MULTI_LEARN_RUNTIME_NEGATIVE_CONTROL_VERIFIED',
  runtimeEvidenceRoot: baseline.runtimeEvidenceRoot,
  attestationRoot: baseline.attestationRoot,
  knowledgeReceiptRoot: baseline.knowledgeReceiptRoot,
  truthBoundary: {
    exactAttestationRootRequiredWhenPresent: true,
    exactReceiptRootRequiredWhenPresent: true,
    exactExecutionBinaryRequiredWhenPresent: true,
    threeOrMoreLearnOverclaimFailsClosed: true,
    fullHistoryOverclaimFailsClosed: true,
    missingMultiLearnAttestationRemainsConservativeUntilCanonicalVerifier: true,
    canonicalFinalRuntimeTruthMustRequireBoundMultiLearnAttestation: true,
  },
}, null, 2));
