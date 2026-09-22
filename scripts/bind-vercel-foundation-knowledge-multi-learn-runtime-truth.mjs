#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const manifestPath = path.join(root, 'native', 'rclvm.vercel-attestation.json');
const proofPath = path.join(root, 'public', 'rcl-foundation-knowledge-multi-learn-proof.json');

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
    status: 'RCL_FOUNDATION_KNOWLEDGE_MULTI_LEARN_RUNTIME_BINDING_FAILED',
    message,
    exitCode,
    ...details,
  }, null, 2));
  process.exit(exitCode);
}

if (!fs.existsSync(manifestPath)) fail('Canonical Native VM attestation manifest is missing.', { manifestPath }, 271);
if (!fs.existsSync(proofPath)) fail('Knowledge bounded multi-Learn public proof is missing.', { proofPath }, 272);

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const proof = JSON.parse(fs.readFileSync(proofPath, 'utf8'));
const binarySha256 = manifest?.binarySha256 ?? null;
const expectedPaths = ['mind.trusted', 'mind.score', 'context.label'];
const formedAtRoots = proof?.formedAtRoots ?? [];
const formedRootValues = formedAtRoots.map(entry => entry?.root);
const parity = proof?.parity ?? {};
const boundary = proof?.truthBoundary ?? {};

if (
  proof?.ok !== true
  || proof?.format !== 'taowind.rcl-vercel-foundation-knowledge-multi-learn-proof.v0.1'
  || proof?.version !== '0.1.0'
  || proof?.verified !== true
  || proof?.status !== 'native-verified'
  || proof?.domain !== 'knowledge'
  || proof?.loweredLearnCount !== 2
  || proof?.loweredClaimCount !== 3
  || JSON.stringify(proof?.declarations) !== JSON.stringify(['mind', 'context'])
  || proof?.binarySha256 !== binarySha256
  || proof?.executionBinarySha256 !== binarySha256
  || !isSha256(proof?.nativeVmExecutionAttestationRoot)
  || !isSha256(proof?.knowledgeReceiptRoot)
  || formedAtRoots.length !== 3
  || JSON.stringify(formedAtRoots.map(entry => entry?.path)) !== JSON.stringify(expectedPaths)
  || formedRootValues.some(rootValue => !isSha256(rootValue))
  || new Set(formedRootValues).size !== 3
  || parity.state !== true
  || parity.semanticStateRoot !== true
  || parity.nativeStateRootVerified !== true
  || parity.nativeStateRootParity !== true
  || parity.knowledgeReceipt !== true
  || parity.learnTransactionOrder !== true
  || parity.learnBoundaryContinuity !== true
  || parity.nativeExecutionAttestation !== true
  || boundary.boundedContiguousMultiLearnKnowledgeSubsetOnly !== true
  || boundary.maxBoundedLearnDirectiveCount !== 2
  || boundary.maxBoundedClaimCountPerLearn !== 4
  || boundary.verifiedLearnDirectiveCount !== 2
  || boundary.verifiedClaimCount !== 3
  || boundary.separateOrderedAtomicTransactionsRequired !== true
  || boundary.exactReferenceNativeDomainReceiptParityRequired !== true
  || boundary.crossLearnBoundaryRootContinuityRequired !== true
  || boundary.canonicalRealCExecutionRequiredForVerifiedStatus !== true
  || boundary.threeOrMoreLearnDirectivesNativeClaimed !== false
  || boundary.nonLeadingOrInterleavedLearnNativeClaimed !== false
  || boundary.dependenciesRevisionsDecayAndDerivedKnowledgeRemainProviderBound !== true
  || boundary.providerBridgeRemovedGlobally !== false
  || boundary.allKnowledgeProgramsNativeClaimed !== false
  || boundary.fullHistoryParityClaimed !== false
) {
  fail('Knowledge bounded multi-Learn proof is not eligible for canonical runtime attestation binding.', {
    proof,
    binarySha256,
    expectedPaths,
  }, 273);
}

const attestationRoot = sha256Canonical(proof);
const runtimeAttestation = {
  ...proof,
  attestationRoot,
  runtimeBinding: {
    exactBinaryRequired: true,
    canonicalRuntimeTruthConsumerRequired: true,
    singleLearnBehavioralAndMaxBoundaryProofsRemainDistinct: true,
    multiLearnAttestationDoesNotClaimFullKnowledgeNativeCoverage: true,
  },
};
manifest.foundationKnowledgeMultiLearnProof = runtimeAttestation;
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(JSON.stringify({
  ok: true,
  status: 'RCL_FOUNDATION_KNOWLEDGE_MULTI_LEARN_RUNTIME_BOUND',
  binarySha256,
  attestationRoot,
  loweredLearnCount: runtimeAttestation.loweredLearnCount,
  loweredClaimCount: runtimeAttestation.loweredClaimCount,
  knowledgeReceiptRoot: runtimeAttestation.knowledgeReceiptRoot,
  formedAtRoots: runtimeAttestation.formedAtRoots,
  truthBoundary: runtimeAttestation.truthBoundary,
}, null, 2));
