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
const proofPath = path.join(publicDir, 'rcl-foundation-knowledge-reinforcement-revision-native-proof.json');

function sha256(buffer) { return crypto.createHash('sha256').update(buffer).digest('hex'); }
function isSha256(value) { return typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value); }
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}
function same(left, right) { return JSON.stringify(canonical(left)) === JSON.stringify(canonical(right)); }
function normalizeState(value) { return canonical(semanticValue(value)); }
function fail(message, details = {}, exitCode = 1) {
  console.error(JSON.stringify({
    ok: false,
    status: 'RCL_VERCEL_FOUNDATION_KNOWLEDGE_REINFORCEMENT_REVISION_PROOF_FAILED',
    message,
    exitCode,
    ...details,
  }, null, 2));
  process.exit(exitCode);
}

const source = [
  'reality VercelKnowledgeReinforcementRevisionProof {',
  '  facet world.route : Text = "left"',
  '  facet decision.route : Text = "unknown"',
  '  subject actor { }',
  '  knowledge mind {',
  '    claim route : Text = world.route confidence 0.60 evidence "map:old" source "old-map"',
  '  }',
  '  knowledge refresh {',
  '    revise mind.route <- world.route confidence 0.50 evidence "sensor:fresh" source "fresh-map"',
  '  }',
  '  emergence use_route {',
  '    cause actor',
  '    when supported(mind.route, 0.79)',
  '    alter decision.route <- belief(mind.route)',
  '  }',
  '  learn mind',
  '  learn refresh',
  '  realize use_route',
  '}',
  '',
].join('\n');

if (!fs.existsSync(target)) fail('Canonical native VM artifact is missing', { target }, 321);
if (!fs.existsSync(manifestPath)) fail('Canonical native VM attestation is missing', { manifestPath }, 322);
const binarySha256 = sha256(fs.readFileSync(target));
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
if (
  manifest?.format !== 'taowind.rcl-vercel-native-artifact.v0.3'
  || manifest?.binarySha256 !== binarySha256
  || manifest?.replayProof?.attestationBinarySha256 !== binarySha256
) {
  fail('Reinforcement revision proof is not bound to the exact canonical native VM binary', {
    binarySha256,
    manifestFormat: manifest?.format ?? null,
  }, 323);
}

let program;
try { program = compileReality(source); }
catch (error) {
  fail('Reinforcement revision proof source did not compile', {
    code: error?.code ?? null,
    error: error?.message ?? String(error),
  }, 324);
}

let compiled;
try { compiled = tryCompileFoundationRealityToBytecode(program); }
catch (error) {
  fail('Reinforcement revision direct bytecode compilation threw', {
    code: error?.code ?? null,
    error: error?.message ?? String(error),
  }, 325);
}

const lowering = compiled?.foundationKnowledgeDirectLowering ?? null;
const claimItem = lowering?.lowered?.[0] ?? null;
const revisionItem = lowering?.lowered?.[1] ?? null;
if (
  compiled?.ok !== true
  || !compiled?.bytecode
  || lowering?.summary?.knowledgeLoweredDeclarationCount !== 2
  || lowering?.summary?.boundedKnowledgeRevisionCount !== 1
  || lowering?.summary?.boundedSameValueReinforcementRevisionCount !== 1
  || lowering?.truthBoundary?.boundedSameValueReinforcementRevisionSubsetNativeClaimed !== true
  || lowering?.truthBoundary?.contradictoryRevisionAlternativesRemainProviderBound !== true
  || claimItem?.knowledgeMutationMode !== 'claim-first-write'
  || revisionItem?.knowledgeMutationMode !== 'revision-existing-target'
  || revisionItem?.revisionSemantics !== 'same-value-reinforcement'
  || !same(claimItem?.stateTargets, ['mind.route'])
  || !same(revisionItem?.stateTargets, ['mind.route'])
  || !same(compiled?.foundationKnowledgeNativeInitialization?.omittedInitialFacetPaths, ['mind.route'])
  || compiled?.foundationKnowledgeNativeInitialization?.truthBoundary?.orderedRevisionExistingTargetCount !== 1
) {
  fail('Direct lowering did not expose the exact bounded ordered reinforcement-revision slice', {
    ok: compiled?.ok ?? false,
    diagnostics: compiled?.diagnostics ?? null,
    summary: lowering?.summary ?? null,
    truthBoundary: lowering?.truthBoundary ?? null,
    nativeInitialization: compiled?.foundationKnowledgeNativeInitialization ?? null,
    claimItem,
    revisionItem,
  }, 326);
}

const formationRoots = {
  claim: claimItem?.formedAtRoot ?? null,
  revision: revisionItem?.formedAtRoot ?? null,
};
if (
  !isSha256(formationRoots.claim)
  || !isSha256(formationRoots.revision)
  || formationRoots.claim === formationRoots.revision
) {
  fail('Reinforcement revision lowering did not retain distinct sequential claim/revision formation roots', {
    formationRoots,
  }, 327);
}

let reference;
try { reference = await runReality(program); }
catch (error) {
  fail('Reference Runtime could not execute bounded reinforcement revision source', {
    code: error?.code ?? null,
    error: error?.message ?? String(error),
    details: error?.details ?? null,
  }, 328);
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
  fail('Canonical real-C Native VM could not execute bounded reinforcement revision bytecode', {
    code: error?.code ?? null,
    error: error?.message ?? String(error),
    details: error?.details ?? null,
  }, 329);
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
if (receiptParity.ok !== true) {
  fail('Reinforcement revision real-C Knowledge receipt parity failed closed', { receiptParity }, 330);
}

const referenceRoute = reference?.state?.['mind.route'];
const nativeRoute = native?.state?.['mind.route'];
const executionAttestation = native?.nativeVmExecutionAttestation ?? null;
const executionBinarySha256 = executionAttestation?.materialization?.binarySha256 ?? null;
const expectedEvidence = ['map:old', 'sensor:fresh'];
const parity = {
  state: same(nativeState, referenceState),
  semanticStateRoot: nativeRoot === referenceRoot,
  nativeStateRootVerified: native?.stateRootVerified === true,
  nativeStateRootParity: native?.stateRootParity === true,
  knowledgeReceipt: receiptParity.ok === true,
  receiptCount: receiptParity.entries?.length === 2,
  revisionValue: referenceRoute?.value === 'left' && nativeRoute?.value === 'left',
  revisionConfidence: Math.abs(Number(referenceRoute?.confidence) - 0.8) < 1e-12
    && Math.abs(Number(nativeRoute?.confidence) - 0.8) < 1e-12,
  revisionEvidence: same(referenceRoute?.evidence, expectedEvidence) && same(nativeRoute?.evidence, expectedEvidence),
  revisionSource: referenceRoute?.source === 'fresh-map' && nativeRoute?.source === 'fresh-map',
  revisionStatus: referenceRoute?.status === 'reinforced' && nativeRoute?.status === 'reinforced',
  revisionNumber: referenceRoute?.revision === 2 && nativeRoute?.revision === 2,
  revisionAlternatives: same(referenceRoute?.alternatives, []) && same(nativeRoute?.alternatives, []),
  revisionFormedAtRoot: referenceRoute?.formedAtRoot === formationRoots.revision
    && nativeRoute?.formedAtRoot === formationRoots.revision,
  observableAccessor: reference?.state?.['decision.route'] === 'left' && native?.state?.['decision.route'] === 'left',
  nativeExecutionAttestation: Boolean(
    executionAttestation?.attestationRoot
    && executionBinarySha256 === binarySha256
  ),
};
if (!Object.values(parity).every(Boolean)) {
  fail('Reinforcement revision proof did not close state/root/receipt/revision metadata parity', {
    parity,
    referenceRoute,
    nativeRoute,
    referenceRoot,
    nativeRoot,
    executionBinarySha256,
    binarySha256,
  }, 331);
}

const mutatedHistory = structuredClone(native.history);
const revisionReceipt = mutatedHistory.find(record => record?.rule === revisionItem.syntheticRule);
const routeChange = revisionReceipt?.changes?.find(change => change?.target === 'mind.route');
if (!routeChange) fail('Could not construct reinforcement revision negative control', {}, 332);
routeChange.after.confidence = 0.9;
const negative = verifyFoundationKnowledgeReceiptParity(
  lowering,
  reference?.history,
  mutatedHistory,
  semanticValue,
);
if (
  negative.ok !== false
  || negative?.entries?.[1]?.checks?.transitionValuesEquivalent !== false
) {
  fail('Reinforcement revision receipt negative control did not fail closed on confidence drift', {
    negative,
  }, 333);
}

fs.mkdirSync(publicDir, { recursive: true });
const proof = {
  ok: true,
  format: 'taowind.rcl-vercel-foundation-knowledge-reinforcement-revision-native-proof.v0.1',
  status: 'native-verified',
  verified: true,
  binarySha256,
  executionBinarySha256,
  nativeVmExecutionAttestationRoot: executionAttestation.attestationRoot,
  semanticStateRoot: nativeRoot,
  knowledgeReceiptRoot: receiptParity.receiptRoot,
  formationRoots,
  revisionKnowledge: {
    path: 'mind.route',
    value: nativeRoute.value,
    confidence: nativeRoute.confidence,
    evidence: nativeRoute.evidence,
    source: nativeRoute.source,
    status: nativeRoute.status,
    revision: nativeRoute.revision,
    alternatives: nativeRoute.alternatives,
    formedAtRoot: nativeRoute.formedAtRoot,
  },
  parity,
  negativeControl: {
    mutatedField: 'mind.route.confidence',
    receiptParityFailedClosed: true,
  },
  truthBoundary: {
    boundedSameValueReinforcementRevisionSubsetNativeClaimed: true,
    revisionOccursInSeparateSecondLeadingLearnTransaction: true,
    oneLearnDirectiveMapsToOneAtomicSyntheticTransaction: true,
    exactKnowledgeReceiptParityClaimedForBoundedSlice: true,
    revisionExpressionRestrictedToLiteralOrInitialPrimitivePath: true,
    contradictoryRevisionAlternativesRemainProviderBound: true,
    revisionDependenciesRemainProviderBound: true,
    decayRemainsProviderBound: true,
    arbitraryRevisionTopologyRemainsProviderBound: true,
    providerBridgeRemovedGlobally: false,
    allKnowledgeProgramsNativeClaimed: false,
    fullHistoryParityClaimed: false,
  },
};
fs.writeFileSync(proofPath, `${JSON.stringify(proof, null, 2)}\n`);

console.log(JSON.stringify({
  ok: true,
  status: 'RCL_VERCEL_FOUNDATION_KNOWLEDGE_REINFORCEMENT_REVISION_NATIVE_VERIFIED',
  binarySha256,
  semanticStateRoot: nativeRoot,
  knowledgeReceiptRoot: receiptParity.receiptRoot,
  formationRoots,
  revisionKnowledge: proof.revisionKnowledge,
  parity,
}, null, 2));
