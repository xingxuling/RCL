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
import {
  FOUNDATION_ENERGY_NATIVE_PARITY_FORMAT,
  FOUNDATION_ENERGY_NATIVE_PARITY_VERSION,
  verifyFoundationEnergyReceiptParity,
} from '../src/foundation-energy-native-parity.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const nativeDir = path.join(root, 'native');
const publicDir = path.join(root, 'public');
const target = path.join(nativeDir, process.platform === 'win32' ? 'rclvm.exe' : 'rclvm');
const manifestPath = path.join(nativeDir, 'rclvm.vercel-attestation.json');
const publicBuildProofPath = path.join(publicDir, 'rcl-native-build-proof.json');
const proofPath = path.join(publicDir, 'rcl-foundation-energy-native-proof.json');

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}
function fail(message, details = {}, exitCode = 1) {
  console.error(JSON.stringify({
    ok: false,
    status: 'RCL_VERCEL_FOUNDATION_ENERGY_PROOF_FAILED',
    message,
    exitCode,
    ...details,
  }, null, 2));
  process.exit(exitCode);
}
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  }
  return value;
}
function normalizeState(value) {
  return canonical(semanticValue(value));
}
function same(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}
function isEnergyQuantity(value, expected) {
  return value?.kind === 'Quantity'
    && value?.type === 'Energy'
    && value?.unit === 'J'
    && value?.value === expected;
}

const source = [
  'reality VercelEnergyNativeProof {',
  '  energy grid {',
  '    reservoir source : Energy = joules(100)',
  '    reservoir load : Energy = joules(0)',
  '    flow charge from source to load amount joules(40) efficiency 0.9 evidence "meter:grid-transfer"',
  '    preserve grid.source >= joules(0)',
  '    preserve grid.load >= joules(0)',
  '    witness "energy:atomic-transfer"',
  '  }',
  '  energize grid',
  '}',
  '',
].join('\n');

if (!fs.existsSync(target)) fail('Canonical native VM artifact is missing before Energy parity proof', { target }, 51);
if (!fs.existsSync(manifestPath)) fail('Canonical native VM attestation is missing before Energy parity proof', { manifestPath }, 52);
const binarySha256 = sha256(fs.readFileSync(target));
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

if (
  manifest?.format !== 'taowind.rcl-vercel-native-artifact.v0.3'
  || manifest?.binarySha256 !== binarySha256
  || manifest?.replayProof?.attestationBinarySha256 !== binarySha256
) {
  fail('Energy proof cannot attach to a manifest that is not bound to the exact canonical native VM binary', {
    binarySha256,
    manifestFormat: manifest?.format ?? null,
    manifestBinarySha256: manifest?.binarySha256 ?? null,
    replayBinarySha256: manifest?.replayProof?.attestationBinarySha256 ?? null,
  }, 53);
}

const requiredPriorDomains = ['perception', 'physical', 'neural', 'genetic', 'living'];
for (const domain of requiredPriorDomains) {
  const prior = manifest?.foundationParityProofs?.[domain];
  if (prior?.domain !== domain || prior?.verified !== true || prior?.executionBinarySha256 !== binarySha256) {
    fail('Energy proof requires the existing direct-native parity chain to remain bound to the same binary', {
      domain,
      prior,
      binarySha256,
    }, 54);
  }
}

let program;
try {
  program = compileReality(source);
} catch (error) {
  fail('Energy proof source did not compile in the canonical compiler', {
    code: error?.code ?? null,
    error: error?.message ?? String(error),
  }, 61);
}

let compiled;
try {
  compiled = tryCompileFoundationRealityToBytecode(program);
} catch (error) {
  fail('Energy direct bytecode compilation threw unexpectedly', {
    code: error?.code ?? null,
    error: error?.message ?? String(error),
  }, 62);
}
if (
  compiled?.ok !== true
  || !compiled?.bytecode
  || compiled?.foundationEnergyDirectLowering?.summary?.loweredDirectiveCount !== 1
  || compiled?.foundationEnergyDirectLowering?.summary?.loweredFlowCount !== 1
) {
  fail('Energy direct bytecode compilation did not expose exactly one bounded Energize lowering', {
    ok: compiled?.ok ?? false,
    diagnostics: compiled?.diagnostics ?? null,
    energySummary: compiled?.foundationEnergyDirectLowering?.summary ?? null,
  }, 63);
}

let reference;
try {
  reference = await runReality(program);
} catch (error) {
  fail('Reference Runtime could not execute the bounded Energy proof source', {
    code: error?.code ?? null,
    error: error?.message ?? String(error),
    details: error?.details ?? null,
  }, 64);
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
  fail('Canonical real-C Native VM could not execute the lowered Energy bytecode', {
    code: error?.code ?? null,
    error: error?.message ?? String(error),
    details: error?.details ?? null,
  }, 65);
}

let receiptParity;
try {
  receiptParity = verifyFoundationEnergyReceiptParity(
    compiled.foundationEnergyDirectLowering,
    reference?.history,
    native?.history,
    semanticValue,
  );
} catch (error) {
  fail('Energy receipt-parity evaluation threw unexpectedly', {
    code: error?.code ?? null,
    error: error?.message ?? String(error),
    details: error?.details ?? null,
  }, 66);
}
if (receiptParity?.ok !== true) {
  fail('Energy reference/native receipt parity did not close', { receiptParity }, 67);
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
  fail('Energy semantic state/root normalization threw unexpectedly', {
    code: error?.code ?? null,
    error: error?.message ?? String(error),
  }, 68);
}

const executionAttestation = native?.nativeVmExecutionAttestation ?? null;
const executionBinarySha256 = executionAttestation?.materialization?.binarySha256 ?? null;
const parity = {
  state: same(nativeState, referenceState),
  semanticStateRoot: nativeRoot === referenceRoot,
  nativeStateRootVerified: native?.stateRootVerified === true,
  nativeStateRootParity: native?.stateRootParity === true,
  energyReceipt: receiptParity.ok === true,
  nativeExecutionAttestation: Boolean(
    executionAttestation?.attestationRoot
    && executionBinarySha256 === binarySha256
  ),
};
if (!Object.values(parity).every(Boolean)) {
  fail('Energy proof did not close state/root/receipt/executable parity', {
    parity,
    referenceRoot,
    nativeRoot,
    executionBinarySha256,
    binarySha256,
  }, 69);
}

const sourceState = native?.state?.['grid.source'];
const loadState = native?.state?.['grid.load'];
if (!isEnergyQuantity(sourceState, 60) || !isEnergyQuantity(loadState, 36)) {
  fail('Energy native final state does not preserve the bounded transfer semantics', {
    sourceState,
    loadState,
  }, 70);
}

const energyParityProof = {
  format: FOUNDATION_ENERGY_NATIVE_PARITY_FORMAT,
  version: FOUNDATION_ENERGY_NATIVE_PARITY_VERSION,
  domain: 'energy',
  status: 'native-verified',
  verified: true,
  boundedSubset: true,
  loweredDirectiveCount: compiled.foundationEnergyDirectLowering.summary.loweredDirectiveCount,
  loweredFlowCount: compiled.foundationEnergyDirectLowering.summary.loweredFlowCount,
  parity,
  energyReceiptRoot: receiptParity.receiptRoot,
  energyReceiptRootAlgorithm: receiptParity.rootAlgorithm,
  nativeVmExecutionAttestationRoot: executionAttestation.attestationRoot,
  executionBinarySha256,
  finalState: {
    'grid.source': sourceState,
    'grid.load': loadState,
  },
  truthBoundary: {
    boundedEnergySubsetOnly: true,
    stateIndependentAmountsRequired: true,
    literalEfficiencyRequired: true,
    disjointReservoirTopologyRequired: true,
    oneEnergizeDirectiveMapsToOneAtomicNativeTransaction: true,
    referenceReceiptAndNativeReceiptMustMatchExactly: true,
    canonicalRealCExecutionRequiredForVerifiedStatus: true,
    providerBridgeRemovedGlobally: false,
    allEnergyProgramsNativeClaimed: false,
    fullHistoryParityClaimed: false,
  },
};

manifest.foundationParityProofs = {
  ...(manifest.foundationParityProofs ?? {}),
  energy: energyParityProof,
};
manifest.foundationEnergyParityProof = energyParityProof;
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

fs.mkdirSync(publicDir, { recursive: true });
const artifact = {
  ok: true,
  format: 'taowind.rcl-vercel-foundation-energy-native-proof.v0.1',
  status: 'native-verified',
  verified: true,
  binarySha256,
  energyParityProof,
};
fs.writeFileSync(proofPath, `${JSON.stringify(artifact, null, 2)}\n`);

const publicBuildProof = fs.existsSync(publicBuildProofPath)
  ? JSON.parse(fs.readFileSync(publicBuildProofPath, 'utf8'))
  : {};
const existingDomains = Array.isArray(publicBuildProof.foundationParityDomains)
  ? publicBuildProof.foundationParityDomains
  : requiredPriorDomains;
publicBuildProof.binarySha256 = binarySha256;
publicBuildProof.foundationParityDomains = [...new Set([...existingDomains, 'energy'])];
publicBuildProof.foundationParityProofs = manifest.foundationParityProofs;
publicBuildProof.foundationEnergyParity = {
  domain: 'energy',
  status: energyParityProof.status,
  verified: true,
  boundedSubset: true,
  energyReceiptRoot: energyParityProof.energyReceiptRoot,
  nativeVmExecutionAttestationRoot: energyParityProof.nativeVmExecutionAttestationRoot,
  executionBinarySha256,
};
fs.writeFileSync(publicBuildProofPath, `${JSON.stringify(publicBuildProof, null, 2)}\n`);

console.log(JSON.stringify({
  ok: true,
  status: 'RCL_VERCEL_FOUNDATION_ENERGY_NATIVE_VERIFIED',
  binarySha256,
  loweredDirectiveCount: energyParityProof.loweredDirectiveCount,
  loweredFlowCount: energyParityProof.loweredFlowCount,
  energyReceiptRoot: energyParityProof.energyReceiptRoot,
  nativeVmExecutionAttestationRoot: energyParityProof.nativeVmExecutionAttestationRoot,
  foundationParityDomains: Object.keys(manifest.foundationParityProofs),
  finalSource: sourceState,
  finalLoad: loadState,
}, null, 2));
