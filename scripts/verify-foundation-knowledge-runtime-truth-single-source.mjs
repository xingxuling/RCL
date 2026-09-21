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
  'exactReferenceNativeDomainReceiptParityRequired',
  'knowledgeDomainReceiptParityClaimed',
  'fullHistoryParityClaimed',
  "providerBridge?.domains?.includes('knowledge')",
  "direct?.domains?.includes('knowledge')",
];
for (const token of requiredCanonicalClaims) {
  if (!canonicalSource.includes(token)) {
    fail('Canonical Knowledge runtime truth verifier lost a required receipt/coexistence assertion.', { token });
  }
}
if (!gateSource.includes("scripts/verify-foundation-knowledge-deployment-truth.mjs")) {
  fail('Cycle 73 regression gate no longer consumes the canonical Knowledge runtime truth verifier.');
}
if (gateSource.includes('verify-foundation-knowledge-receipt-deployment-truth.mjs')) {
  fail('Cycle 73 regression gate still consumes the retired duplicate Knowledge runtime truth verifier.');
}

console.log(JSON.stringify({
  ok: true,
  status: 'RCL_FOUNDATION_KNOWLEDGE_RUNTIME_TRUTH_SINGLE_SOURCE_VERIFIED',
  canonicalVerifier: 'scripts/verify-foundation-knowledge-deployment-truth.mjs',
  retiredDuplicateAbsent: true,
  cycle73GateConsumesCanonicalVerifier: true,
  truthBoundary: {
    canonicalKnowledgeRuntimeTruthIsSingleSource: true,
    receiptRootRequiredByCanonicalVerifier: true,
    directAndProviderBridgeCoexistenceStillRequired: true,
    fullHistoryParityClaimed: false,
  },
}, null, 2));
