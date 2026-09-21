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

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const nativeDir = path.join(root, 'native');
const publicDir = path.join(root, 'public');
const target = path.join(nativeDir, process.platform === 'win32' ? 'rclvm.exe' : 'rclvm');
const manifestPath = path.join(nativeDir, 'rclvm.vercel-attestation.json');
const publicBuildProofPath = path.join(publicDir, 'rcl-native-build-proof.json');
const proofPath = path.join(publicDir, 'rcl-foundation-knowledge-native-proof.json');

function sha256(buffer) { return crypto.createHash('sha256').update(buffer).digest('hex'); }
function fail(message, details = {}, exitCode = 1) {
  console.error(JSON.stringify({ ok: false, status: 'RCL_VERCEL_FOUNDATION_KNOWLEDGE_PROOF_FAILED', message, exitCode, ...details }, null, 2));
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
  'reality VercelKnowledgeNativeProof {',
  '  facet world.signal : Truth = true',
  '  facet decision.allowed : Truth = false',
  '  knowledge mind {',
  '    claim trusted : Truth = world.signal confidence 0.90 evidence "sensor:signal-v1" source "sensor:signal"',
  '  }',
  '  emergence apply_knowledge {',
  '    cause actor',
  '    when known(mind.trusted, 0.80)',
  '    alter decision.allowed <- belief(mind.trusted)',
  '  }',
  '  learn mind',
  '  realize apply_knowledge',
  '}',
  '',
].join('\n');

if (!fs.existsSync(target)) fail('Canonical native VM artifact is missing before Knowledge parity proof', { target }, 101);
if (!fs.existsSync(manifestPath)) fail('Canonical native VM attestation is missing before Knowledge parity proof', { manifestPath }, 102);
const binarySha256 = sha256(fs.readFileSync(target));
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
if (
  manifest?.format !== 'taowind.rcl-vercel-native-artifact.v0.3'
  || manifest?.binarySha256 !== binarySha256
  || manifest?.replayProof?.attestationBinarySha256 !== binarySha256
) {
  fail('Knowledge proof cannot attach to a manifest that is not bound to the exact canonical native VM binary', {
    binarySha256,
    manifestFormat: manifest?.format ?? null,
    manifestBinarySha256: manifest?.binarySha256 ?? null,
    replayBinarySha256: manifest?.replayProof?.attestationBinarySha256 ?? null,
  }, 103);
}

for (const domain of ['perception', 'physical', 'neural', 'genetic', 'living', 'energy']) {
  const prior = manifest?.foundationParityProofs?.[domain];
  if (prior?.domain !== domain || prior?.verified !== true || prior?.executionBinarySha256 !== binarySha256) {
    fail('Knowledge proof requires the existing parity-based direct-native chain to remain bound to the same binary', { domain, prior, binarySha256 }, 104);
  }
}
const quantitativePrior = manifest?.foundationDirectExtensionProofs?.quantitative ?? manifest?.foundationQuantitativeDirectProof ?? null;
if (
  quantitativePrior?.domain !== 'quantitative'
  || quantitativePrior?.verified !== true
  || quantitativePrior?.executionBinarySha256 !== binarySha256
) {
  fail('Knowledge proof requires the Quantitative direct-extension proof to remain bound to the same binary', {
    domain: 'quantitative',
    prior: quantitativePrior,
    binarySha256,
  }, 105);
}

let program;
try { program = compileReality(source); }
catch (error) { fail('Knowledge proof source did not compile in the canonical compiler', { code: error?.code ?? null, error: error?.message ?? String(error) }, 111); }

let compiled;
try { compiled = tryCompileFoundationRealityToBytecode(program); }
catch (error) { fail('Knowledge direct bytecode compilation threw unexpectedly', { code: error?.code ?? null, error: error?.message ?? String(error) }, 112); }
if (
  compiled?.ok !== true
  || !compiled?.bytecode
  || compiled?.foundationKnowledgeDirectLowering?.summary?.knowledgeLoweredDeclarationCount !== 1
  || compiled?.foundationKnowledgeDirectLowering?.summary?.consumedDirectiveCount !== 1
) {
  fail('Knowledge direct bytecode compilation did not expose exactly one bounded Learn lowering', {
    ok: compiled?.ok ?? false,
    diagnostics: compiled?.diagnostics ?? null,
    knowledgeSummary: compiled?.foundationKnowledgeDirectLowering?.summary ?? null,
  }, 113);
}

let reference;
try { reference = await runReality(program); }
catch (error) { fail('Reference Runtime could not execute the bounded Knowledge proof source', { code: error?.code ?? null, error: error?.message ?? String(error), details: error?.details ?? null }, 114); }

let native;
try {
  native = await runNativeBytecode(compiled.bytecode, { vmPath: target, buildIfMissing: false, requireNativeStateRoot: true, timeout: 30_000 });
} catch (error) {
  fail('Canonical real-C Native VM could not execute the lowered Knowledge bytecode', { code: error?.code ?? null, error: error?.message ?? String(error), details: error?.details ?? null }, 115);
}

let referenceState;
let nativeState;
let referenceRoot;
let nativeRoot;
try {
  referenceState = normalizeState(reference?.state ?? {});
  nativeState = normalizeState(native?.state ?? {});
  referenceRoot = semanticStateRoot(reference?.state ?? {});
  nativeRoot = native?.semanticStateRoot ?? semanticStateRoot(native?.state ?? {});
} catch (error) {
  fail('Knowledge semantic state/root normalization threw unexpectedly', { code: error?.code ?? null, error: error?.message ?? String(error) }, 116);
}

const executionAttestation = native?.nativeVmExecutionAttestation ?? null;
const executionBinarySha256 = executionAttestation?.materialization?.binarySha256 ?? null;
const parity = {
  state: same(nativeState, referenceState),
  semanticStateRoot: nativeRoot === referenceRoot,
  nativeStateRootVerified: native?.stateRootVerified === true,
  nativeStateRootParity: native?.stateRootParity === true,
  nativeExecutionAttestation: Boolean(executionAttestation?.attestationRoot && executionBinarySha256 === binarySha256),
};
if (!Object.values(parity).every(Boolean)) {
  fail('Knowledge proof did not close state/root/executable parity', { parity, referenceState, nativeState, referenceRoot, nativeRoot, executionBinarySha256, binarySha256 }, 117);
}

const initialStateRoot = compiled.foundationKnowledgeDirectLowering.summary.formedAtRoot;
const nativeKnowledge = native?.state?.['mind.trusted'];
const referenceKnowledge = reference?.state?.['mind.trusted'];
if (
  typeof initialStateRoot !== 'string'
  || !/^[0-9a-f]{64}$/i.test(initialStateRoot)
  || referenceKnowledge?.formedAtRoot !== initialStateRoot
  || nativeKnowledge?.formedAtRoot !== initialStateRoot
  || native?.state?.['decision.allowed'] !== true
  || reference?.state?.['decision.allowed'] !== true
) {
  fail('Knowledge bounded proof lost formedAtRoot or observable knowledge semantics', {
    initialStateRoot,
    nativeKnowledge,
    referenceKnowledge,
    nativeDecision: native?.state?.['decision.allowed'] ?? null,
    referenceDecision: reference?.state?.['decision.allowed'] ?? null,
  }, 118);
}

const knowledgeParityProof = {
  format: 'taowind.rcl-foundation-knowledge-native-parity.v0.1',
  version: '0.1.0',
  domain: 'knowledge',
  status: 'native-verified',
  verified: true,
  boundedSubset: true,
  loweredDirectiveCount: compiled.foundationKnowledgeDirectLowering.summary.consumedDirectiveCount,
  loweredClaimCount: compiled.foundationKnowledgeDirectLowering.summary.knowledgeLoweredDeclarationCount,
  parity,
  initialStateRoot,
  nativeVmExecutionAttestationRoot: executionAttestation.attestationRoot,
  executionBinarySha256,
  finalState: {
    'mind.trusted': nativeKnowledge,
    'decision.allowed': native?.state?.['decision.allowed'],
  },
  truthBoundary: {
    boundedSingleClaimKnowledgeSubsetOnly: true,
    primitiveClaimTypesOnly: true,
    exactInitialFormedAtRootRequired: true,
    dependenciesRevisionsDecayAndDerivedKnowledgeRemainProviderBound: true,
    referenceRuntimeStateParityRequired: true,
    canonicalRealCExecutionRequiredForVerifiedStatus: true,
    providerBridgeRemovedGlobally: false,
    allKnowledgeProgramsNativeClaimed: false,
    knowledgeDomainReceiptParityClaimed: false,
  },
};

manifest.foundationParityProofs = { ...(manifest.foundationParityProofs ?? {}), knowledge: knowledgeParityProof };
manifest.foundationKnowledgeParityProof = knowledgeParityProof;
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

fs.mkdirSync(publicDir, { recursive: true });
fs.writeFileSync(proofPath, `${JSON.stringify({ ok: true, format: 'taowind.rcl-vercel-foundation-knowledge-native-proof.v0.1', status: 'native-verified', verified: true, binarySha256, knowledgeParityProof }, null, 2)}\n`);
const publicBuildProof = fs.existsSync(publicBuildProofPath) ? JSON.parse(fs.readFileSync(publicBuildProofPath, 'utf8')) : {};
const existingDomains = Array.isArray(publicBuildProof.foundationParityDomains) ? publicBuildProof.foundationParityDomains : [];
publicBuildProof.binarySha256 = binarySha256;
publicBuildProof.foundationParityDomains = [...new Set([...existingDomains, 'knowledge'])];
publicBuildProof.foundationParityProofs = manifest.foundationParityProofs;
publicBuildProof.foundationKnowledgeParity = {
  domain: 'knowledge',
  status: knowledgeParityProof.status,
  verified: true,
  boundedSubset: true,
  initialStateRoot,
  nativeVmExecutionAttestationRoot: knowledgeParityProof.nativeVmExecutionAttestationRoot,
  executionBinarySha256,
};
fs.writeFileSync(publicBuildProofPath, `${JSON.stringify(publicBuildProof, null, 2)}\n`);

console.log(JSON.stringify({
  ok: true,
  status: 'RCL_VERCEL_FOUNDATION_KNOWLEDGE_NATIVE_VERIFIED',
  binarySha256,
  loweredDirectiveCount: knowledgeParityProof.loweredDirectiveCount,
  loweredClaimCount: knowledgeParityProof.loweredClaimCount,
  initialStateRoot,
  nativeVmExecutionAttestationRoot: knowledgeParityProof.nativeVmExecutionAttestationRoot,
  foundationParityDomains: Object.keys(manifest.foundationParityProofs),
  finalKnowledge: nativeKnowledge,
  finalDecision: native?.state?.['decision.allowed'],
}, null, 2));
