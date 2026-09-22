#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileReality } from '../src/compiler.mjs';
import { tryCompileFoundationRealityToBytecode } from '../src/foundation-direct-bytecode.mjs';
import { runReality } from '../src/runtime.mjs';
import { runNativeBytecode } from '../src/native-vm.mjs';
import { semanticStateRoot, semanticValue } from '../src/semantic-state-root.mjs';
import { verifyFoundationKnowledgeReceiptParity } from '../src/foundation-knowledge-native-parity.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const nativeDir = path.join(root, 'native');
const publicDir = path.join(root, 'public');
const target = path.join(nativeDir, process.platform === 'win32' ? 'rclvm.exe' : 'rclvm');
const manifestPath = path.join(nativeDir, 'rclvm.vercel-attestation.json');
const proofPath = path.join(publicDir, 'rcl-foundation-knowledge-multi-learn-proof.json');

function sha256(buffer) { return crypto.createHash('sha256').update(buffer).digest('hex'); }
function isSha256(value) { return typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value); }
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}
function normalizeState(value) { return canonical(semanticValue(value)); }
function same(left, right) { return JSON.stringify(left) === JSON.stringify(right); }
function fail(message, details = {}, exitCode = 1) {
  console.error(JSON.stringify({
    ok: false,
    status: 'RCL_VERCEL_FOUNDATION_KNOWLEDGE_MULTI_LEARN_PROOF_FAILED',
    message,
    exitCode,
    ...details,
  }, null, 2));
  process.exit(exitCode);
}

const source = [
  'reality VercelKnowledgeMultiLearnProof {',
  '  facet world.signal : Truth = true',
  '  facet world.score : Number = 7',
  '  facet world.label : Text = "ready"',
  '  facet decision.allowed : Truth = false',
  '  facet decision.label : Text = "unset"',
  '  subject actor { }',
  '  knowledge mind {',
  '    claim trusted : Truth = world.signal confidence 0.90 evidence "sensor:signal-v1" source "sensor:signal"',
  '    claim score : Number = world.score confidence 0.80 evidence "sensor:score-v1" source "sensor:score"',
  '  }',
  '  knowledge context {',
  '    claim label : Text = world.label confidence 0.85 evidence "sensor:label-v1" source "sensor:label"',
  '  }',
  '  emergence apply_knowledge {',
  '    cause actor',
  '    when known(mind.trusted, 0.80)',
  '    alter decision.allowed <- belief(mind.trusted)',
  '    alter decision.label <- belief(context.label)',
  '  }',
  '  learn mind',
  '  learn context',
  '  realize apply_knowledge',
  '}',
  '',
].join('\n');

if (!fs.existsSync(target)) fail('Canonical native VM artifact is missing before bounded multi-Learn proof.', { target }, 251);
if (!fs.existsSync(manifestPath)) fail('Canonical native VM attestation is missing before bounded multi-Learn proof.', { manifestPath }, 252);
const binarySha256 = sha256(fs.readFileSync(target));
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
if (
  manifest?.format !== 'taowind.rcl-vercel-native-artifact.v0.3'
  || manifest?.binarySha256 !== binarySha256
  || manifest?.replayProof?.attestationBinarySha256 !== binarySha256
) {
  fail('Bounded multi-Learn proof is not attached to the exact canonical Native VM binary.', {
    binarySha256,
    manifestFormat: manifest?.format ?? null,
    manifestBinarySha256: manifest?.binarySha256 ?? null,
    replayBinarySha256: manifest?.replayProof?.attestationBinarySha256 ?? null,
  }, 253);
}

let program;
try { program = compileReality(source); }
catch (error) {
  fail('Bounded multi-Learn proof source did not compile in the canonical compiler.', {
    code: error?.code ?? null,
    error: error?.message ?? String(error),
  }, 261);
}

let compiled;
try { compiled = tryCompileFoundationRealityToBytecode(program); }
catch (error) {
  fail('Bounded multi-Learn direct bytecode compilation threw unexpectedly.', {
    code: error?.code ?? null,
    error: error?.message ?? String(error),
  }, 262);
}
const lowering = compiled?.foundationKnowledgeDirectLowering;
if (
  compiled?.ok !== true
  || !compiled?.bytecode
  || lowering?.summary?.knowledgeLoweredDeclarationCount !== 2
  || lowering?.summary?.consumedDirectiveCount !== 2
  || lowering?.summary?.nativeKnowledgeRecordCount !== 3
  || lowering?.summary?.boundedLearnDirectiveCount !== 2
  || lowering?.lowered?.length !== 2
  || lowering?.lowered?.[0]?.declaration !== 'mind'
  || lowering?.lowered?.[1]?.declaration !== 'context'
  || lowering?.lowered?.[0]?.directiveIndex !== 0
  || lowering?.lowered?.[1]?.directiveIndex !== 1
) {
  fail('Bounded multi-Learn direct lowering did not expose two separate ordered Learn transactions.', {
    ok: compiled?.ok ?? false,
    diagnostics: compiled?.diagnostics ?? null,
    summary: lowering?.summary ?? null,
    lowered: lowering?.lowered ?? null,
  }, 263);
}

const formedAtRoots = lowering.lowered.flatMap(item => (
  (item?.formedAtRoots ?? []).map(entry => ({ declaration: item.declaration, path: entry.path, root: entry.root }))
));
if (
  formedAtRoots.length !== 3
  || formedAtRoots.some(entry => !isSha256(entry.root))
  || new Set(formedAtRoots.map(entry => entry.root)).size !== 3
) {
  fail('Bounded multi-Learn lowering lost global sequential formedAtRoot topology across Learn transactions.', { formedAtRoots }, 264);
}

let reference;
try { reference = await runReality(program); }
catch (error) {
  fail('Reference Runtime could not execute bounded multi-Learn Knowledge source.', {
    code: error?.code ?? null,
    error: error?.message ?? String(error),
    details: error?.details ?? null,
  }, 265);
}

let native;
try {
  native = await runNativeBytecode(compiled.bytecode, {
    vmPath: target,
    buildIfMissing: false,
    requireNativeStateRoot: true,
    timeout: 30_000,
  });
} catch (error) {
  fail('Canonical real-C Native VM could not execute bounded multi-Learn bytecode.', {
    code: error?.code ?? null,
    error: error?.message ?? String(error),
    details: error?.details ?? null,
  }, 266);
}

const referenceState = normalizeState(reference?.state ?? {});
const nativeState = normalizeState(native?.state ?? {});
const referenceRoot = semanticStateRoot(reference?.state ?? {});
const nativeRoot = native?.semanticStateRoot ?? semanticStateRoot(native?.state ?? {});
const receiptParity = verifyFoundationKnowledgeReceiptParity(
  lowering,
  reference?.history,
  native?.history,
  semanticValue,
);
const entries = receiptParity?.entries ?? [];
const orderedReceipts = entries.length === 2
  && entries[0]?.declaration === 'mind'
  && entries[1]?.declaration === 'context'
  && entries[0]?.referenceIndex < entries[1]?.referenceIndex
  && entries[0]?.nativeIndex < entries[1]?.nativeIndex;
const continuousBoundaryRoots = entries.length === 2
  && isSha256(entries[0]?.referenceAfterRoot)
  && entries[0]?.referenceAfterRoot === entries[1]?.referenceBeforeRoot
  && entries[0]?.nativeAfterRoot === entries[1]?.nativeBeforeRoot
  && entries[0]?.referenceAfterRoot === entries[0]?.nativeAfterRoot
  && entries[1]?.referenceBeforeRoot === entries[1]?.nativeBeforeRoot;
if (
  receiptParity?.ok !== true
  || receiptParity?.declaredLoweredCount !== 2
  || receiptParity?.entries?.length !== 2
  || receiptParity?.referenceCoverageExact !== true
  || receiptParity?.nativeCoverageExact !== true
  || !isSha256(receiptParity?.receiptRoot)
  || !orderedReceipts
  || !continuousBoundaryRoots
) {
  fail('Bounded multi-Learn reference/native domain receipt history failed order or boundary continuity.', {
    receiptParity,
    orderedReceipts,
    continuousBoundaryRoots,
  }, 267);
}

const executionAttestation = native?.nativeVmExecutionAttestation ?? null;
const executionBinarySha256 = executionAttestation?.materialization?.binarySha256 ?? null;
const parity = {
  state: same(nativeState, referenceState),
  semanticStateRoot: nativeRoot === referenceRoot,
  nativeStateRootVerified: native?.stateRootVerified === true,
  nativeStateRootParity: native?.stateRootParity === true,
  knowledgeReceipt: receiptParity.ok === true,
  learnTransactionOrder: orderedReceipts,
  learnBoundaryContinuity: continuousBoundaryRoots,
  nativeExecutionAttestation: Boolean(executionAttestation?.attestationRoot && executionBinarySha256 === binarySha256),
};
if (!Object.values(parity).every(Boolean)) {
  fail('Bounded multi-Learn proof did not close state/root/receipt/order/executable parity.', {
    parity,
    receiptParity,
    referenceRoot,
    nativeRoot,
    executionBinarySha256,
    binarySha256,
  }, 268);
}

const formedRootByPath = Object.fromEntries(formedAtRoots.map(entry => [entry.path, entry.root]));
const expectedKnowledge = {
  'mind.trusted': true,
  'mind.score': 7,
  'context.label': 'ready',
};
for (const [pathName, expectedValue] of Object.entries(expectedKnowledge)) {
  const referenceValue = reference?.state?.[pathName];
  const nativeValue = native?.state?.[pathName];
  if (
    referenceValue?.kind !== 'Knowledge'
    || nativeValue?.kind !== 'Knowledge'
    || !Object.is(referenceValue?.value, expectedValue)
    || !Object.is(nativeValue?.value, expectedValue)
    || referenceValue?.formedAtRoot !== formedRootByPath[pathName]
    || nativeValue?.formedAtRoot !== formedRootByPath[pathName]
  ) {
    fail('Bounded multi-Learn proof lost Knowledge value or formedAtRoot parity.', {
      path: pathName,
      expectedValue,
      expectedFormedAtRoot: formedRootByPath[pathName],
      referenceValue,
      nativeValue,
    }, 269);
  }
}
if (
  reference?.state?.['decision.allowed'] !== true
  || native?.state?.['decision.allowed'] !== true
  || reference?.state?.['decision.label'] !== 'ready'
  || native?.state?.['decision.label'] !== 'ready'
) {
  fail('Bounded multi-Learn proof lost downstream observable accessor semantics.', {
    referenceDecisionAllowed: reference?.state?.['decision.allowed'] ?? null,
    nativeDecisionAllowed: native?.state?.['decision.allowed'] ?? null,
    referenceDecisionLabel: reference?.state?.['decision.label'] ?? null,
    nativeDecisionLabel: native?.state?.['decision.label'] ?? null,
  }, 270);
}

const proof = {
  ok: true,
  format: 'taowind.rcl-vercel-foundation-knowledge-multi-learn-proof.v0.1',
  version: '0.1.0',
  status: 'native-verified',
  verified: true,
  domain: 'knowledge',
  binarySha256,
  executionBinarySha256,
  nativeVmExecutionAttestationRoot: executionAttestation.attestationRoot,
  loweredLearnCount: lowering.summary.consumedDirectiveCount,
  loweredClaimCount: lowering.summary.nativeKnowledgeRecordCount,
  declarations: lowering.lowered.map(item => item.declaration),
  formedAtRoots,
  knowledgeReceiptRoot: receiptParity.receiptRoot,
  knowledgeReceiptRootAlgorithm: receiptParity.rootAlgorithm,
  parity,
  truthBoundary: {
    boundedContiguousMultiLearnKnowledgeSubsetOnly: true,
    maxBoundedLearnDirectiveCount: 2,
    maxBoundedClaimCountPerLearn: 4,
    verifiedLearnDirectiveCount: 2,
    verifiedClaimCount: 3,
    separateOrderedAtomicTransactionsRequired: true,
    exactReferenceNativeDomainReceiptParityRequired: true,
    crossLearnBoundaryRootContinuityRequired: true,
    canonicalRealCExecutionRequiredForVerifiedStatus: true,
    threeOrMoreLearnDirectivesNativeClaimed: false,
    nonLeadingOrInterleavedLearnNativeClaimed: false,
    dependenciesRevisionsDecayAndDerivedKnowledgeRemainProviderBound: true,
    providerBridgeRemovedGlobally: false,
    allKnowledgeProgramsNativeClaimed: false,
    fullHistoryParityClaimed: false,
  },
};

fs.mkdirSync(publicDir, { recursive: true });
fs.writeFileSync(proofPath, `${JSON.stringify(proof, null, 2)}\n`);
console.log(JSON.stringify({
  ok: true,
  status: 'RCL_VERCEL_FOUNDATION_KNOWLEDGE_MULTI_LEARN_VERIFIED',
  binarySha256,
  loweredLearnCount: proof.loweredLearnCount,
  loweredClaimCount: proof.loweredClaimCount,
  declarations: proof.declarations,
  formedAtRoots,
  knowledgeReceiptRoot: proof.knowledgeReceiptRoot,
  nativeVmExecutionAttestationRoot: proof.nativeVmExecutionAttestationRoot,
  parity,
  truthBoundary: proof.truthBoundary,
}, null, 2));
