#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const manifestPath = path.join(root, 'native', 'rclvm.vercel-attestation.json');
const proofPath = path.join(root, 'public', 'rcl-foundation-knowledge-derived-dependency-native-proof.json');

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}
function sha256Canonical(value) { return crypto.createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex'); }
function isSha256(value) { return typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value); }
function fail(message, details = {}, exitCode = 1) {
  console.error(JSON.stringify({ ok: false, status: 'RCL_FOUNDATION_KNOWLEDGE_DERIVED_RUNTIME_BINDING_FAILED', message, exitCode, ...details }, null, 2));
  process.exit(exitCode);
}

if (!fs.existsSync(manifestPath)) fail('Canonical Native VM attestation manifest is missing.', { manifestPath }, 321);
if (!fs.existsSync(proofPath)) fail('Cycle 91 bounded-derived Knowledge proof is missing.', { proofPath }, 322);

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const proof = JSON.parse(fs.readFileSync(proofPath, 'utf8'));
const binarySha256 = manifest?.binarySha256 ?? null;
const formedAtRoots = proof?.formedAtRoots ?? {};
const expectedPaths = ['mind.trusted', 'mind.score', 'mind.ready'];
const formedRootValues = expectedPaths.map(pathName => formedAtRoots?.[pathName]);
const derived = proof?.derivedKnowledge ?? {};
const parity = proof?.parity ?? {};
const boundary = proof?.truthBoundary ?? {};

if (
  proof?.ok !== true
  || proof?.format !== 'taowind.rcl-vercel-foundation-knowledge-derived-dependency-native-proof.v0.1'
  || proof?.status !== 'native-verified'
  || proof?.verified !== true
  || !isSha256(binarySha256)
  || proof?.binarySha256 !== binarySha256
  || proof?.executionBinarySha256 !== binarySha256
  || !isSha256(proof?.nativeVmExecutionAttestationRoot)
  || !isSha256(proof?.semanticStateRoot)
  || !isSha256(proof?.knowledgeReceiptRoot)
  || formedRootValues.some(rootValue => !isSha256(rootValue))
  || new Set(formedRootValues).size !== 3
  || derived?.path !== 'mind.ready'
  || derived?.value !== true
  || derived?.confidence !== 0.6
  || JSON.stringify(derived?.evidence) !== JSON.stringify(['rule:ready-v1', 'sensor:signal-v1', 'sensor:score-v1'])
  || JSON.stringify(derived?.dependencies) !== JSON.stringify(['mind.trusted', 'mind.score'])
  || derived?.status !== 'derived'
  || derived?.revision !== 1
  || derived?.formedAtRoot !== formedAtRoots?.['mind.ready']
  || !Object.values(parity).every(Boolean)
  || proof?.negativeControl?.receiptParityFailedClosed !== true
  || boundary.boundedDerivedKnowledgeDependencySubsetNativeClaimed !== true
  || boundary.maxTotalKnowledgeValuesPerLearn !== 4
  || boundary.derivedExpressionsRestrictedToLiteralOrInitialPrimitivePath !== true
  || boundary.dependenciesMustResolveWithinLeadingKnowledgeTransactions !== true
  || boundary.dependencyConfidenceUsesMinimumBound !== true
  || boundary.dependencyEvidencePropagationPreserved !== true
  || boundary.revisionsAndDecayRemainProviderBound !== true
  || boundary.unrestrictedDependencyAndDerivedSemanticsRemainProviderBound !== true
  || boundary.providerBridgeRemovedGlobally !== false
  || boundary.allKnowledgeProgramsNativeClaimed !== false
  || boundary.fullHistoryParityClaimed !== false
) {
  fail('Cycle 91 bounded-derived Knowledge proof is not eligible for canonical runtime-truth binding.', { proof, binarySha256 }, 323);
}

const attestationRoot = sha256Canonical(proof);
const runtimeAttestation = {
  ...proof,
  attestationRoot,
  runtimeBinding: {
    exactBinaryRequired: true,
    canonicalRuntimeTruthConsumerRequired: true,
    cycle91ProofRemainsBounded: true,
    revisionsAndDecayRemainProviderBound: true,
    unrestrictedDependencyAndDerivedSemanticsRemainProviderBound: true,
    derivedDependencyAttestationDoesNotClaimFullKnowledgeNativeCoverage: true
  }
};
manifest.foundationKnowledgeDerivedDependencyProof = runtimeAttestation;
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(JSON.stringify({
  ok: true,
  status: 'RCL_FOUNDATION_KNOWLEDGE_DERIVED_RUNTIME_BOUND',
  binarySha256,
  attestationRoot,
  knowledgeReceiptRoot: runtimeAttestation.knowledgeReceiptRoot,
  derivedKnowledge: runtimeAttestation.derivedKnowledge,
  formedAtRoots: runtimeAttestation.formedAtRoots
}, null, 2));
