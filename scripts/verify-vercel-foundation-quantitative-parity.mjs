#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileReality } from '../src/compiler.mjs';
import { tryCompileFoundationRealityToBytecode } from '../src/foundation-direct-bytecode.mjs';
import { runReality } from '../src/runtime.mjs';
import { runNativeBytecode } from '../src/native-vm.mjs';
import { semanticValue } from '../src/semantic-state-root.mjs';
import {
  FOUNDATION_QUANTITATIVE_NATIVE_PARITY_FORMAT,
  FOUNDATION_QUANTITATIVE_NATIVE_PARITY_VERSION,
  quantitativeStateProjection,
  quantitativeSemanticStateRoot,
  verifyFoundationQuantitativeReceiptParity,
} from '../src/foundation-quantitative-native-parity.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const nativeDir = path.join(root, 'native');
const publicDir = path.join(root, 'public');
const target = path.join(nativeDir, process.platform === 'win32' ? 'rclvm.exe' : 'rclvm');
const manifestPath = path.join(nativeDir, 'rclvm.vercel-attestation.json');
const publicBuildProofPath = path.join(publicDir, 'rcl-native-build-proof.json');
const proofPath = path.join(publicDir, 'rcl-foundation-quantitative-parity-proof.json');

function sha256(buffer) { return crypto.createHash('sha256').update(buffer).digest('hex'); }
function fail(message, details = {}, exitCode = 1) {
  console.error(JSON.stringify({ ok: false, status: 'RCL_VERCEL_FOUNDATION_QUANTITATIVE_PARITY_FAILED', message, exitCode, ...details }, null, 2));
  process.exit(exitCode);
}
function same(left, right) { return JSON.stringify(left) === JSON.stringify(right); }

const source = [
  'reality VercelQuantitativeDeclaredDirectProof {',
  '  facet ambient.raw : Temperature = celsius(8)',
  '  quantitative sensor {',
  '    measure temperature : Temperature = ambient.raw uncertainty celsius(0.2) confidence 0.98 unit "°C" scale interval evidence "sensor:ambient-v1" calibrated by "calibration:ambient-v1"',
  '    derive healthy : Truth = confidence(sensor.temperature) >= 0.95',
  '    preserve confidence(sensor.temperature) >= 0.90',
  '  }',
  '  quantify sensor',
  '}',
  '',
].join('\n');

if (!fs.existsSync(target)) fail('Canonical native VM artifact is missing before Quantitative parity proof', { target }, 61);
if (!fs.existsSync(manifestPath)) fail('Canonical native VM attestation is missing before Quantitative parity proof', { manifestPath }, 62);
const binarySha256 = sha256(fs.readFileSync(target));
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
if (manifest?.binarySha256 !== binarySha256 || manifest?.replayProof?.attestationBinarySha256 !== binarySha256) {
  fail('Quantitative parity proof is not attached to the exact canonical native VM binary', { binarySha256, manifestBinarySha256: manifest?.binarySha256 ?? null }, 63);
}

let program;
let compiled;
let reference;
let native;
try {
  program = compileReality(source);
  compiled = tryCompileFoundationRealityToBytecode(program);
} catch (error) {
  fail('Quantitative parity source/lowering compilation failed', { code: error?.code ?? null, error: error?.message ?? String(error) }, 64);
}
if (compiled?.ok !== true || !compiled?.bytecode || compiled?.foundationQuantitativeDirectLowering?.summary?.loweredCount !== 1) {
  fail('Quantitative parity proof did not produce exactly one bounded direct lowering', { compiled }, 65);
}
try {
  reference = await runReality(program);
} catch (error) {
  fail('Reference Runtime could not execute bounded Quantitative source', { code: error?.code ?? null, error: error?.message ?? String(error) }, 66);
}
try {
  native = await runNativeBytecode(compiled.bytecode, { vmPath: target, buildIfMissing: false, requireNativeStateRoot: true, timeout: 30_000 });
} catch (error) {
  fail('Canonical real-C Native VM could not execute Quantitative bytecode', { code: error?.code ?? null, error: error?.message ?? String(error) }, 67);
}

const lowering = compiled.foundationQuantitativeDirectLowering;
const targets = lowering.lowered.flatMap(item => item?.stateTargets ?? []);
const receiptParity = verifyFoundationQuantitativeReceiptParity(lowering, reference?.history, native?.history, semanticValue);
if (receiptParity?.ok !== true) fail('Quantitative reference/native domain receipt parity did not close', { receiptParity }, 68);

const referenceProjection = quantitativeStateProjection(reference?.state ?? {}, targets, semanticValue);
const nativeProjection = quantitativeStateProjection(native?.state ?? {}, targets, semanticValue);
const referenceQuantitativeStateRoot = quantitativeSemanticStateRoot(reference?.state ?? {}, targets, semanticValue);
const nativeQuantitativeStateRoot = quantitativeSemanticStateRoot(native?.state ?? {}, targets, semanticValue);
const executionAttestation = native?.nativeVmExecutionAttestation ?? null;
const executionBinarySha256 = executionAttestation?.materialization?.binarySha256 ?? null;
const parity = {
  quantitativeStateProjection: same(referenceProjection, nativeProjection),
  quantitativeSemanticStateRoot: referenceQuantitativeStateRoot === nativeQuantitativeStateRoot,
  nativeStateRootVerified: native?.stateRootVerified === true,
  nativeStateRootParity: native?.stateRootParity === true,
  quantitativeReceipt: receiptParity.ok === true,
  nativeExecutionAttestation: Boolean(executionAttestation?.attestationRoot && executionBinarySha256 === binarySha256),
};
if (!Object.values(parity).every(Boolean)) {
  fail('Quantitative proof did not close projection/root/receipt/executable parity', { parity, referenceProjection, nativeProjection, referenceQuantitativeStateRoot, nativeQuantitativeStateRoot, executionBinarySha256, binarySha256 }, 69);
}

const measurement = native?.state?.['sensor.temperature'];
const healthy = native?.state?.['sensor.healthy'];
if (measurement?.kind !== 'Measurement' || measurement?.baseType !== 'Temperature' || measurement?.confidence !== 0.98 || measurement?.unit !== '°C' || measurement?.scale !== 'interval' || healthy !== true) {
  fail('Quantitative native final state lost bounded measurement semantics', { measurement, healthy }, 70);
}

const quantitativeParityProof = {
  format: FOUNDATION_QUANTITATIVE_NATIVE_PARITY_FORMAT,
  version: FOUNDATION_QUANTITATIVE_NATIVE_PARITY_VERSION,
  domain: 'quantitative',
  status: 'native-verified',
  verified: true,
  boundedSubset: true,
  loweredCount: lowering.summary.loweredCount,
  parity,
  quantitativeReceiptRoot: receiptParity.receiptRoot,
  quantitativeReceiptRootAlgorithm: receiptParity.rootAlgorithm,
  referenceQuantitativeStateRoot,
  nativeQuantitativeStateRoot,
  nativeVmExecutionAttestationRoot: executionAttestation.attestationRoot,
  executionBinarySha256,
  finalState: { 'sensor.temperature': measurement, 'sensor.healthy': healthy },
  truthBoundary: {
    boundedQuantitativeSubsetOnly: true,
    measurementSemanticNormalizationRequired: true,
    referenceReceiptAndNativeReceiptMustMatchExactlyAfterQuantitativeSemanticNormalization: true,
    canonicalRealCExecutionRequiredForVerifiedStatus: true,
    standaloneDirectProofTruthBoundaryRemainsConservative: true,
    providerBridgeRemovedGlobally: false,
    allQuantitativeProgramsNativeClaimed: false,
    fullHistoryParityClaimed: false,
  },
};
manifest.foundationQuantitativeParityProof = quantitativeParityProof;
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
fs.mkdirSync(publicDir, { recursive: true });
fs.writeFileSync(proofPath, `${JSON.stringify({ ok: true, binarySha256, quantitativeParityProof }, null, 2)}\n`);
const publicBuildProof = fs.existsSync(publicBuildProofPath) ? JSON.parse(fs.readFileSync(publicBuildProofPath, 'utf8')) : {};
publicBuildProof.foundationQuantitativeParity = {
  domain: 'quantitative', status: quantitativeParityProof.status, verified: true,
  quantitativeReceiptRoot: quantitativeParityProof.quantitativeReceiptRoot,
  nativeVmExecutionAttestationRoot: quantitativeParityProof.nativeVmExecutionAttestationRoot,
  executionBinarySha256,
};
fs.writeFileSync(publicBuildProofPath, `${JSON.stringify(publicBuildProof, null, 2)}\n`);
console.log(JSON.stringify({ ok: true, status: 'RCL_VERCEL_FOUNDATION_QUANTITATIVE_PARITY_VERIFIED', binarySha256, quantitativeReceiptRoot: quantitativeParityProof.quantitativeReceiptRoot, referenceQuantitativeStateRoot, nativeQuantitativeStateRoot }, null, 2));
