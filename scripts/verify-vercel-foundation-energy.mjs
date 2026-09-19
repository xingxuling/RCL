#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyFoundationEnergyNativeParity } from '../src/foundation-energy-native-parity.mjs';

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
function isEnergyQuantity(value, expected) {
  return value?.kind === 'Quantity'
    && value?.type === 'Energy'
    && value?.unit === 'J'
    && value?.value === expected;
}
function parityFailureExitCode(proof) {
  if (proof?.status === 'compile-blocked') return 61;
  if (proof?.status === 'native-blocked' || proof?.status === 'native-failed') return 62;
  if (proof?.parity?.state !== true) return 63;
  if (proof?.parity?.semanticStateRoot !== true) return 64;
  if (proof?.parity?.nativeStateRootVerified !== true || proof?.parity?.nativeStateRootParity !== true) return 65;
  if (proof?.parity?.energyReceipt !== true) return 66;
  if (proof?.parity?.nativeExecutionAttestation !== true) return 67;
  return 68;
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

try {
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

  const proof = await verifyFoundationEnergyNativeParity(source, {
    expectedBinarySha256: binarySha256,
    nativeRuntime: {
      vmPath: target,
      buildIfMissing: false,
      timeout: 30_000,
    },
  });

  if (proof?.status !== 'native-verified' || proof?.verified !== true) {
    fail('Bounded Energy direct lowering did not pass canonical real-C parity', {
      status: proof?.status ?? null,
      verified: proof?.verified ?? false,
      parity: proof?.parity ?? null,
      gaps: proof?.gaps ?? null,
      diagnostics: proof?.diagnostics ?? null,
      receiptParity: proof?.receiptParity ?? null,
    }, parityFailureExitCode(proof));
  }
  if (
    proof?.parity?.state !== true
    || proof?.parity?.semanticStateRoot !== true
    || proof?.parity?.nativeStateRootVerified !== true
    || proof?.parity?.nativeStateRootParity !== true
    || proof?.parity?.energyReceipt !== true
    || proof?.parity?.nativeExecutionAttestation !== true
  ) {
    fail('Energy proof did not close state/root/receipt/executable parity', { parity: proof?.parity ?? null }, 69);
  }
  if (
    proof?.lowering?.summary?.loweredDirectiveCount !== 1
    || proof?.lowering?.summary?.loweredFlowCount !== 1
    || proof?.receiptParity?.referenceReceiptCount !== 1
    || proof?.receiptParity?.nativeReceiptCount !== 1
  ) {
    fail('Energy proof did not preserve one declared Energize into one atomic native receipt', {
      loweringSummary: proof?.lowering?.summary ?? null,
      receiptParity: proof?.receiptParity ?? null,
    }, 70);
  }
  if (proof?.executionBinarySha256 !== binarySha256) {
    fail('Energy proof executed a different native VM binary', {
      binarySha256,
      executionBinarySha256: proof?.executionBinarySha256 ?? null,
    }, 71);
  }

  const sourceState = proof?.finalState?.['grid.source'];
  const loadState = proof?.finalState?.['grid.load'];
  if (!isEnergyQuantity(sourceState, 60) || !isEnergyQuantity(loadState, 36)) {
    fail('Energy native final state does not preserve the bounded transfer semantics', {
      sourceState,
      loadState,
    }, 72);
  }

  const energyParityProof = {
    format: proof.format,
    version: proof.version,
    domain: 'energy',
    status: proof.status,
    verified: true,
    boundedSubset: true,
    loweredDirectiveCount: proof.lowering.summary.loweredDirectiveCount,
    loweredFlowCount: proof.lowering.summary.loweredFlowCount,
    parity: proof.parity,
    energyReceiptRoot: proof.roots.energyReceiptRoot,
    energyReceiptRootAlgorithm: proof.roots.energyReceiptRootAlgorithm,
    nativeVmExecutionAttestationRoot: proof.roots.nativeVmExecutionAttestationRoot,
    executionBinarySha256: proof.executionBinarySha256,
    finalState: {
      'grid.source': sourceState,
      'grid.load': loadState,
    },
    truthBoundary: proof.truthBoundary,
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
} catch (error) {
  fail(error?.message ?? String(error), {
    code: error?.code ?? null,
    details: error?.details ?? null,
    stack: error?.stack ?? null,
  }, 79);
}
