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
const proofPath = path.join(publicDir, 'rcl-foundation-knowledge-max-boundary-proof.json');

function sha256(buffer) { return crypto.createHash('sha256').update(buffer).digest('hex'); }
function isSha256(value) { return typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value); }
function fail(message, details = {}, exitCode = 1) {
  console.error(JSON.stringify({
    ok: false,
    status: 'RCL_VERCEL_FOUNDATION_KNOWLEDGE_MAX_BOUNDARY_PROOF_FAILED',
    message,
    exitCode,
    ...details,
  }, null, 2));
  process.exit(exitCode);
}
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}
function normalizeState(value) { return canonical(semanticValue(value)); }
function same(left, right) { return JSON.stringify(left) === JSON.stringify(right); }

const source = [
  'reality VercelKnowledgeMaxBoundaryProof {',
  '  facet world.signal : Truth = true',
  '  facet world.score : Number = 7',
  '  facet world.label : Text = "alpha"',
  '  facet world.rank : Number = 3',
  '  facet decision.allowed : Truth = false',
  '  facet decision.score : Number = 0',
  '  subject actor { }',
  '  knowledge mind {',
  '    claim trusted : Truth = world.signal confidence 0.90 evidence "sensor:signal-v1" source "sensor:signal"',
  '    claim score : Number = world.score confidence 0.80 evidence "sensor:score-v1" source "sensor:score"',
  '    claim label : Text = world.label confidence 0.70 evidence "sensor:label-v1" source "sensor:label"',
  '    claim rank : Number = world.rank confidence 0.60 evidence "sensor:rank-v1" source "sensor:rank"',
  '  }',
  '  emergence apply_knowledge {',
  '    cause actor',
  '    when known(mind.trusted, 0.80)',
  '    alter decision.allowed <- belief(mind.trusted)',
  '    alter decision.score <- belief(mind.score)',
  '  }',
  '  learn mind',
  '  realize apply_knowledge',
  '}',
  '',
].join('\n');

if (!fs.existsSync(target)) fail('Canonical native VM artifact is missing before max-boundary Knowledge proof.', { target }, 201);
if (!fs.existsSync(manifestPath)) fail('Canonical native VM attestation is missing before max-boundary Knowledge proof.', { manifestPath }, 202);
const binarySha256 = sha256(fs.readFileSync(target));
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
if (
  manifest?.format !== 'taowind.rcl-vercel-native-artifact.v0.3'
  || manifest?.binarySha256 !== binarySha256
  || manifest?.replayProof?.attestationBinarySha256 !== binarySha256
) {
  fail('Max-boundary Knowledge proof is not bound to the exact canonical Native VM binary.', {
    binarySha256,
    manifestFormat: manifest?.format ?? null,
    manifestBinarySha256: manifest?.binarySha256 ?? null,
    replayBinarySha256: manifest?.replayProof?.attestationBinarySha256 ?? null,
  }, 203);
}

let program;
try { program = compileReality(source); }
catch (error) {
  fail('Max-boundary Knowledge proof source did not compile in the canonical compiler.', {
    code: error?.code ?? null,
    error: error?.message ?? String(error),
  }, 211);
}

let compiled;
try { compiled = tryCompileFoundationRealityToBytecode(program); }
catch (error) {
  fail('Max-boundary Knowledge direct bytecode compilation threw unexpectedly.', {
    code: error?.code ?? null,
    error: error?.message ?? String(error),
  }, 212);
}
if (
  compiled?.ok !== true
  || !compiled?.bytecode
  || compiled?.foundationKnowledgeDirectLowering?.summary?.knowledgeLoweredDeclarationCount !== 1
  || compiled?.foundationKnowledgeDirectLowering?.summary?.consumedDirectiveCount !== 1
  || compiled?.foundationKnowledgeDirectLowering?.summary?.nativeKnowledgeRecordCount !== 4
  || compiled?.foundationKnowledgeDirectLowering?.lowered?.[0]?.claimCount !== 4
  || compiled?.foundationKnowledgeDirectLowering?.truthBoundary?.maxBoundedClaimCount !== 4
) {
  fail('Knowledge direct lowering did not reach its declared four-claim bounded edge as one atomic Learn transaction.', {
    ok: compiled?.ok ?? false,
    diagnostics: compiled?.diagnostics ?? null,
    summary: compiled?.foundationKnowledgeDirectLowering?.summary ?? null,
    lowered: compiled?.foundationKnowledgeDirectLowering?.lowered ?? null,
    boundary: compiled?.foundationKnowledgeDirectLowering?.truthBoundary ?? null,
  }, 213);
}

const loweredKnowledge = compiled.foundationKnowledgeDirectLowering.lowered[0];
const expectedPaths = ['mind.trusted', 'mind.score', 'mind.label', 'mind.rank'];
const claimFormedAtRoots = Object.fromEntries((loweredKnowledge.formedAtRoots ?? []).map(entry => [entry.path, entry.root]));
const roots = expectedPaths.map(pathName => claimFormedAtRoots[pathName]);
if (
  loweredKnowledge?.claimCount !== 4
  || JSON.stringify(loweredKnowledge?.claimPaths) !== JSON.stringify(expectedPaths)
  || roots.some(rootValue => !isSha256(rootValue))
  || new Set(roots).size !== 4
) {
  fail('Four-claim Knowledge lowering lost exact claim ordering or sequential formedAtRoot topology.', {
    claimPaths: loweredKnowledge?.claimPaths ?? null,
    formedAtRoots: loweredKnowledge?.formedAtRoots ?? null,
  }, 214);
}

let reference;
try { reference = await runReality(program); }
catch (error) {
  fail('Reference Runtime could not execute the four-claim Knowledge boundary proof.', {
    code: error?.code ?? null,
    error: error?.message ?? String(error),
    details: error?.details ?? null,
  }, 215);
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
  fail('Canonical real-C Native VM could not execute four-claim Knowledge boundary bytecode.', {
    code: error?.code ?? null,
    error: error?.message ?? String(error),
    details: error?.details ?? null,
  }, 216);
}

const referenceState = normalizeState(reference?.state ?? {});
const nativeState = normalizeState(native?.state ?? {});
const referenceRoot = semanticStateRoot(reference?.state ?? {});
const nativeRoot = native?.semanticStateRoot ?? semanticStateRoot(native?.state ?? {});
const receiptParity = verifyFoundationKnowledgeReceiptParity(
  compiled.foundationKnowledgeDirectLowering,
  reference?.history,
  native?.history,
  semanticValue,
);
if (
  receiptParity?.ok !== true
  || receiptParity?.entries?.length !== 1
  || receiptParity?.entries?.[0]?.claimCount !== 4
  || !isSha256(receiptParity?.receiptRoot)
) {
  fail('Four-claim Knowledge domain receipt parity failed closed at the declared max boundary.', { receiptParity }, 217);
}

const executionAttestation = native?.nativeVmExecutionAttestation ?? null;
const executionBinarySha256 = executionAttestation?.materialization?.binarySha256 ?? null;
const parity = {
  state: same(nativeState, referenceState),
  semanticStateRoot: nativeRoot === referenceRoot,
  nativeStateRootVerified: native?.stateRootVerified === true,
  nativeStateRootParity: native?.stateRootParity === true,
  knowledgeReceipt: receiptParity.ok === true,
  nativeExecutionAttestation: Boolean(executionAttestation?.attestationRoot && executionBinarySha256 === binarySha256),
};
if (!Object.values(parity).every(Boolean)) {
  fail('Four-claim Knowledge max-boundary proof did not close state/root/receipt/executable parity.', {
    parity,
    receiptParity,
    referenceRoot,
    nativeRoot,
    executionBinarySha256,
    binarySha256,
  }, 218);
}

const expectedValues = {
  'mind.trusted': true,
  'mind.score': 7,
  'mind.label': 'alpha',
  'mind.rank': 3,
};
for (const pathName of expectedPaths) {
  const referenceValue = reference?.state?.[pathName];
  const nativeValue = native?.state?.[pathName];
  const formedAtRoot = claimFormedAtRoots[pathName];
  if (
    referenceValue?.kind !== 'Knowledge'
    || nativeValue?.kind !== 'Knowledge'
    || !Object.is(referenceValue?.value, expectedValues[pathName])
    || !Object.is(nativeValue?.value, expectedValues[pathName])
    || referenceValue?.formedAtRoot !== formedAtRoot
    || nativeValue?.formedAtRoot !== formedAtRoot
  ) {
    fail('Four-claim Knowledge max-boundary state lost value or formedAtRoot parity.', {
      path: pathName,
      expectedValue: expectedValues[pathName],
      formedAtRoot,
      referenceValue,
      nativeValue,
    }, 219);
  }
}
if (
  native?.state?.['decision.allowed'] !== true
  || reference?.state?.['decision.allowed'] !== true
  || native?.state?.['decision.score'] !== 7
  || reference?.state?.['decision.score'] !== 7
) {
  fail('Four-claim Knowledge max-boundary proof lost observable accessor semantics.', {
    nativeDecisionAllowed: native?.state?.['decision.allowed'] ?? null,
    referenceDecisionAllowed: reference?.state?.['decision.allowed'] ?? null,
    nativeDecisionScore: native?.state?.['decision.score'] ?? null,
    referenceDecisionScore: reference?.state?.['decision.score'] ?? null,
  }, 220);
}

const proof = {
  ok: true,
  format: 'taowind.rcl-vercel-foundation-knowledge-max-boundary-proof.v0.1',
  version: '0.1.0',
  status: 'native-verified',
  verified: true,
  domain: 'knowledge',
  binarySha256,
  executionBinarySha256,
  nativeVmExecutionAttestationRoot: executionAttestation.attestationRoot,
  loweredDirectiveCount: compiled.foundationKnowledgeDirectLowering.summary.consumedDirectiveCount,
  loweredClaimCount: compiled.foundationKnowledgeDirectLowering.summary.nativeKnowledgeRecordCount,
  claimPaths: expectedPaths,
  claimFormedAtRoots,
  knowledgeReceiptRoot: receiptParity.receiptRoot,
  knowledgeReceiptRootAlgorithm: receiptParity.rootAlgorithm,
  parity,
  truthBoundary: {
    boundedPrimitiveMultiClaimKnowledgeSubsetOnly: true,
    maxBoundedClaimCount: 4,
    verifiedAtomicClaimCount: 4,
    maxBoundedClaimCountRealCVerified: true,
    overBoundaryFiveClaimsRemainProviderBound: true,
    referenceSequentialClaimFormationRootsMustBePreserved: true,
    oneLearnDirectiveMapsToOneAtomicSyntheticTransaction: true,
    exactReferenceNativeDomainReceiptParityRequired: true,
    canonicalRealCExecutionRequiredForVerifiedStatus: true,
    providerBridgeRemovedGlobally: false,
    allKnowledgeProgramsNativeClaimed: false,
    fullHistoryParityClaimed: false,
  },
};

fs.mkdirSync(publicDir, { recursive: true });
fs.writeFileSync(proofPath, `${JSON.stringify(proof, null, 2)}\n`);
console.log(JSON.stringify({
  ok: true,
  status: 'RCL_VERCEL_FOUNDATION_KNOWLEDGE_MAX_BOUNDARY_VERIFIED',
  binarySha256,
  loweredClaimCount: proof.loweredClaimCount,
  claimFormedAtRoots,
  knowledgeReceiptRoot: proof.knowledgeReceiptRoot,
  nativeVmExecutionAttestationRoot: proof.nativeVmExecutionAttestationRoot,
  truthBoundary: proof.truthBoundary,
}, null, 2));
