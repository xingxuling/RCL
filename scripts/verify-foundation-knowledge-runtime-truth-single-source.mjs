#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const canonicalVerifier = path.join(root, 'scripts', 'verify-foundation-knowledge-deployment-truth.mjs');
const retiredVerifier = path.join(root, 'scripts', 'verify-foundation-knowledge-receipt-deployment-truth.mjs');
const cycle73Gate = path.join(root, 'scripts', 'dwac-cycle73-exit-probe.mjs');

function fail(message, details = {}) {
  console.error(JSON.stringify({
    ok: false,
    status: 'RCL_FOUNDATION_KNOWLEDGE_RUNTIME_TRUTH_SINGLE_SOURCE_FAILED',
    message,
    ...details,
  }, null, 2));
  process.exit(1);
}

if (!fs.existsSync(canonicalVerifier)) {
  fail('Canonical Knowledge runtime truth verifier is missing.', { canonicalVerifier });
}
if (fs.existsSync(retiredVerifier)) {
  fail('Retired duplicate Knowledge receipt runtime truth verifier still exists.', { retiredVerifier });
}
if (!fs.existsSync(cycle73Gate)) {
  fail('Cycle 73 regression gate is missing.', { cycle73Gate });
}

const canonicalSource = fs.readFileSync(canonicalVerifier, 'utf8');
const gateSource = fs.readFileSync(cycle73Gate, 'utf8');
const requiredCanonicalClaims = [
  'knowledgeReceiptRoot',
  'claimFormedAtRoots',
  'maxBoundaryAttestationRoot',
  'maxBoundaryKnowledgeReceiptRoot',
  'maxBoundaryClaimFormedAtRoots',
  'maxBoundaryLoweredClaimCount',
  'boundedPrimitiveMultiClaimKnowledgeSubsetOnly',
  'maxBoundedClaimCount',
  'behavioralSpecimenVerifiedAtomicClaimCount',
  'verifiedAtomicClaimCount',
  'maxBoundedClaimCountRealCVerified',
  'maxBoundaryRuntimeTruthBound',
  'overBoundaryFiveClaimsRemainProviderBound',
  'referenceSequentialClaimFormationRootsMustBePreserved',
  'oneLearnDirectiveMapsToOneAtomicSyntheticTransaction',
  'exactReferenceNativeDomainReceiptParityRequired',
  'knowledgeDomainReceiptParityClaimed',
  'fullHistoryParityClaimed',
  "providerBridge?.domains?.includes('knowledge')",
  "direct?.domains?.includes('knowledge')",
];
for (const token of requiredCanonicalClaims) {
  if (!canonicalSource.includes(token)) {
    fail('Canonical Knowledge runtime truth verifier lost a required receipt/formation/max-boundary/coexistence assertion.', { token });
  }
}
for (const gateToken of [
  'scripts/verify-vercel-foundation-knowledge.mjs',
  'scripts/verify-vercel-foundation-knowledge-max-boundary.mjs',
  'scripts/bind-vercel-foundation-knowledge-max-boundary-runtime-truth.mjs',
  'scripts/verify-foundation-knowledge-deployment-truth.mjs',
]) {
  if (!gateSource.includes(gateToken)) {
    fail('Cycle 73 regression gate no longer materializes and consumes the canonical Knowledge max-boundary runtime truth chain.', { gateToken });
  }
}
if (gateSource.includes('verify-foundation-knowledge-receipt-deployment-truth.mjs')) {
  fail('Cycle 73 regression gate still consumes the retired duplicate Knowledge receipt runtime truth verifier.');
}

console.log(JSON.stringify({
  ok: true,
  status: 'RCL_FOUNDATION_KNOWLEDGE_RUNTIME_TRUTH_SINGLE_SOURCE_VERIFIED',
  canonicalVerifier: 'scripts/verify-foundation-knowledge-deployment-truth.mjs',
  retiredDuplicateAbsent: true,
  cycle73GateConsumesCanonicalVerifier: true,
  cycle73GateMaterializesMaxBoundaryBeforeCanonicalVerifier: true,
  truthBoundary: {
    canonicalKnowledgeRuntimeTruthIsSingleSource: true,
    boundedPrimitiveMultiClaimTruthRequiredByCanonicalVerifier: true,
    sequentialClaimFormationRootsRequiredByCanonicalVerifier: true,
    receiptRootRequiredByCanonicalVerifier: true,
    maxBoundaryAttestationRequiredByCanonicalVerifier: true,
    exactFourClaimRealCMaxBoundaryRequiredByCanonicalVerifier: true,
    directAndProviderBridgeCoexistenceStillRequired: true,
    fullHistoryParityClaimed: false,
  },
}, null, 2));
