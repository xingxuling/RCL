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
const proofPath = path.join(publicDir, 'rcl-foundation-knowledge-derived-dependency-native-proof.json');

function sha256(buffer) { return crypto.createHash('sha256').update(buffer).digest('hex'); }
function isSha256(value) { return typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value); }
function fail(message, details = {}, exitCode = 1) {
  console.error(JSON.stringify({ ok: false, status: 'RCL_VERCEL_FOUNDATION_KNOWLEDGE_DERIVED_DEPENDENCY_PROOF_FAILED', message, exitCode, ...details }, null, 2));
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
  'reality VercelKnowledgeDerivedDependencyProof {',
  '  facet world.signal : Truth = true',
  '  facet world.score : Number = 7',
  '  facet decision.ready : Truth = false',
  '  subject actor { }',
  '  knowledge mind {',
  '    claim trusted : Truth = world.signal confidence 0.80 evidence "sensor:signal-v1" source "sensor:signal"',
  '    claim score : Number = world.score confidence 0.60 evidence "sensor:score-v1" source "sensor:score"',
  '    derive ready : Truth = world.signal confidence 0.90 evidence "rule:ready-v1" from mind.trusted, mind.score',
  '  }',
  '  emergence apply_knowledge {',
  '    cause actor',
  '    when known(mind.ready, 0.50)',
  '    alter decision.ready <- belief(mind.ready)',
  '  }',
  '  learn mind',
  '  realize apply_knowledge',
  '}',
  '',
].join('\n');

if (!fs.existsSync(target)) fail('Canonical native VM artifact is missing', { target }, 301);
if (!fs.existsSync(manifestPath)) fail('Canonical native VM attestation is missing', { manifestPath }, 302);
const binarySha256 = sha256(fs.readFileSync(target));
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
if (
  manifest?.format !== 'taowind.rcl-vercel-native-artifact.v0.3'
  || manifest?.binarySha256 !== binarySha256
  || manifest?.replayProof?.attestationBinarySha256 !== binarySha256
) {
  fail('Derived Knowledge proof is not bound to the exact canonical native VM binary', { binarySha256, manifestFormat: manifest?.format ?? null }, 303);
}

let program;
try { program = compileReality(source); }
catch (error) { fail('Derived Knowledge proof source did not compile', { code: error?.code ?? null, error: error?.message ?? String(error) }, 304); }

let compiled;
try { compiled = tryCompileFoundationRealityToBytecode(program); }
catch (error) { fail('Derived Knowledge direct bytecode compilation threw', { code: error?.code ?? null, error: error?.message ?? String(error) }, 305); }

const item = compiled?.foundationKnowledgeDirectLowering?.lowered?.[0] ?? null;
if (
  compiled?.ok !== true
  || !compiled?.bytecode
  || compiled?.foundationKnowledgeDirectLowering?.summary?.knowledgeLoweredDeclarationCount !== 1
  || compiled?.foundationKnowledgeDirectLowering?.summary?.nativeKnowledgeRecordCount !== 3
  || compiled?.foundationKnowledgeDirectLowering?.summary?.boundedDerivedKnowledgeCount !== 1
  || compiled?.foundationKnowledgeDirectLowering?.truthBoundary?.boundedDerivedKnowledgeDependencySubsetNativeClaimed !== true
  || item?.claimCount !== 3
  || item?.primitiveClaimCount !== 2
  || item?.derivedKnowledgeCount !== 1
  || item?.dependencyEdgeCount !== 2
) {
  fail('Direct lowering did not expose the exact bounded 2-claim + 1-derived dependency slice', {
    ok: compiled?.ok ?? false,
    diagnostics: compiled?.diagnostics ?? null,
    summary: compiled?.foundationKnowledgeDirectLowering?.summary ?? null,
    truthBoundary: compiled?.foundationKnowledgeDirectLowering?.truthBoundary ?? null,
    item,
  }, 306);
}

const formedAtRoots = Object.fromEntries((item.formedAtRoots ?? []).map(entry => [entry.path, entry.root]));
if (
  !isSha256(formedAtRoots['mind.trusted'])
  || !isSha256(formedAtRoots['mind.score'])
  || !isSha256(formedAtRoots['mind.ready'])
  || new Set(Object.values(formedAtRoots)).size !== 3
) {
  fail('Derived Knowledge lowering did not retain the three-step reference formation-root topology', { formedAtRoots }, 307);
}

let reference;
try { reference = await runReality(program); }
catch (error) { fail('Reference Runtime could not execute bounded derived Knowledge source', { code: error?.code ?? null, error: error?.message ?? String(error), details: error?.details ?? null }, 308); }

let native;
try {
  native = await runNativeBytecode(compiled.bytecode, { vmPath: target, buildIfMissing: false, requireNativeStateRoot: true, timeout: 30_000 });
} catch (error) {
  fail('Canonical real-C Native VM could not execute bounded derived Knowledge bytecode', { code: error?.code ?? null, error: error?.message ?? String(error), details: error?.details ?? null }, 309);
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
if (receiptParity.ok !== true) fail('Derived Knowledge real-C receipt parity failed closed', { receiptParity }, 310);

const referenceReady = reference?.state?.['mind.ready'];
const nativeReady = native?.state?.['mind.ready'];
const expectedEvidence = ['rule:ready-v1', 'sensor:signal-v1', 'sensor:score-v1'];
const expectedDependencies = ['mind.trusted', 'mind.score'];
const executionAttestation = native?.nativeVmExecutionAttestation ?? null;
const executionBinarySha256 = executionAttestation?.materialization?.binarySha256 ?? null;
const parity = {
  state: same(nativeState, referenceState),
  semanticStateRoot: nativeRoot === referenceRoot,
  nativeStateRootVerified: native?.stateRootVerified === true,
  nativeStateRootParity: native?.stateRootParity === true,
  knowledgeReceipt: receiptParity.ok === true,
  derivedValue: referenceReady?.value === true && nativeReady?.value === true,
  derivedConfidence: referenceReady?.confidence === 0.6 && nativeReady?.confidence === 0.6,
  derivedEvidence: same(referenceReady?.evidence, expectedEvidence) && same(nativeReady?.evidence, expectedEvidence),
  derivedDependencies: same(referenceReady?.dependencies, expectedDependencies) && same(nativeReady?.dependencies, expectedDependencies),
  derivedStatus: referenceReady?.status === 'derived' && nativeReady?.status === 'derived',
  derivedFormedAtRoot: referenceReady?.formedAtRoot === formedAtRoots['mind.ready'] && nativeReady?.formedAtRoot === formedAtRoots['mind.ready'],
  observableAccessor: reference?.state?.['decision.ready'] === true && native?.state?.['decision.ready'] === true,
  nativeExecutionAttestation: Boolean(executionAttestation?.attestationRoot && executionBinarySha256 === binarySha256),
};
if (!Object.values(parity).every(Boolean)) {
  fail('Derived Knowledge proof did not close state/root/receipt/dependency metadata parity', {
    parity,
    referenceReady,
    nativeReady,
    referenceRoot,
    nativeRoot,
    executionBinarySha256,
    binarySha256,
  }, 311);
}

const mutated = structuredClone(native.history);
const nativeKnowledgeReceipt = mutated.find(record => record?.rule === item.syntheticRule);
const readyChange = nativeKnowledgeReceipt?.changes?.find(change => change?.target === 'mind.ready');
if (!readyChange) fail('Could not construct derived Knowledge negative control from native receipt', {}, 312);
readyChange.after.confidence = 0.9;
const negative = verifyFoundationKnowledgeReceiptParity(
  compiled.foundationKnowledgeDirectLowering,
  reference?.history,
  mutated,
  semanticValue,
);
if (negative.ok !== false || negative?.entries?.[0]?.checks?.transitionValuesEquivalent !== false) {
  fail('Derived Knowledge receipt negative control did not fail closed on confidence drift', { negative }, 313);
}

fs.mkdirSync(publicDir, { recursive: true });
const proof = {
  ok: true,
  format: 'taowind.rcl-vercel-foundation-knowledge-derived-dependency-native-proof.v0.1',
  status: 'native-verified',
  verified: true,
  binarySha256,
  executionBinarySha256,
  nativeVmExecutionAttestationRoot: executionAttestation.attestationRoot,
  semanticStateRoot: nativeRoot,
  knowledgeReceiptRoot: receiptParity.receiptRoot,
  formedAtRoots,
  derivedKnowledge: {
    path: 'mind.ready',
    value: nativeReady.value,
    confidence: nativeReady.confidence,
    evidence: nativeReady.evidence,
    dependencies: nativeReady.dependencies,
    source: nativeReady.source,
    status: nativeReady.status,
    revision: nativeReady.revision,
    formedAtRoot: nativeReady.formedAtRoot,
  },
  parity,
  negativeControl: {
    mutatedField: 'mind.ready.confidence',
    receiptParityFailedClosed: true,
  },
  truthBoundary: {
    boundedDerivedKnowledgeDependencySubsetNativeClaimed: true,
    maxTotalKnowledgeValuesPerLearn: 4,
    derivedExpressionsRestrictedToLiteralOrInitialPrimitivePath: true,
    dependenciesMustResolveWithinLeadingKnowledgeTransactions: true,
    dependencyConfidenceUsesMinimumBound: true,
    dependencyEvidencePropagationPreserved: true,
    revisionsAndDecayRemainProviderBound: true,
    unrestrictedDependencyAndDerivedSemanticsRemainProviderBound: true,
    providerBridgeRemovedGlobally: false,
    allKnowledgeProgramsNativeClaimed: false,
    fullHistoryParityClaimed: false,
  },
};
fs.writeFileSync(proofPath, `${JSON.stringify(proof, null, 2)}\n`);
console.log(JSON.stringify({
  ok: true,
  status: 'RCL_VERCEL_FOUNDATION_KNOWLEDGE_DERIVED_DEPENDENCY_NATIVE_VERIFIED',
  binarySha256,
  semanticStateRoot: nativeRoot,
  knowledgeReceiptRoot: receiptParity.receiptRoot,
  formedAtRoots,
  derivedKnowledge: proof.derivedKnowledge,
  parity,
}, null, 2));
