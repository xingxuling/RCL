#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tryCompileFoundationRealityToBytecode } from '../src/foundation-direct-bytecode.mjs';
import { verifyFoundationDirectNativeParity } from '../src/foundation-direct-native-parity.mjs';
import { runNativeBytecode } from '../src/native-vm.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const nativeDir = path.join(root, 'native');
const target = path.join(nativeDir, process.platform === 'win32' ? 'rclvm.exe' : 'rclvm');
const manifestPath = path.join(nativeDir, 'rclvm.vercel-attestation.json');
const publicDir = path.join(root, 'public');
const proofPath = path.join(publicDir, 'rcl-foundation-physical-native-proof.json');
const publicBuildProofPath = path.join(publicDir, 'rcl-native-build-proof.json');

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function fail(message, details = {}) {
  console.error(JSON.stringify({
    ok: false,
    status: 'RCL_VERCEL_FOUNDATION_PHYSICAL_PROOF_FAILED',
    message,
    ...details,
  }, null, 2));
  process.exit(1);
}

const source = [
  'reality VercelPhysicalQuantityNativeProof {',
  '  physical world {',
  '    body stone {',
  '      facet position : Length = meters(10)',
  '      facet velocity : Velocity = meters_per_second(1)',
  '    }',
  '    field gravity {',
  '      facet acceleration : Acceleration = meters_per_second2(0)',
  '    }',
  '    law drift {',
  '      step dt : Time',
  '      when world.stone.position > meters(0)',
  '      evolve world.stone.position <- min(meters(100), max(meters(0), world.stone.position + world.stone.velocity * dt))',
  '      evolve world.stone.velocity <- world.stone.velocity + world.gravity.acceleration * dt',
  '      conserve world.stone.position >= meters(0)',
  '      witness "physical:quantity-native"',
  '    }',
  '  }',
  '  advance world.drift steps 2 dt seconds(1)',
  '}',
  '',
].join('\n');

try {
  if (!fs.existsSync(target)) fail('Canonical Vercel native VM artifact is missing before physical parity proof', { target });
  if (!fs.existsSync(manifestPath)) fail('Canonical Vercel native VM attestation is missing before physical parity proof', { manifestPath });
  const binarySha256 = sha256(fs.readFileSync(target));
  const nativeRuntime = {
    vmPath: target,
    buildIfMissing: false,
    timeout: 30_000,
  };
  const proof = await verifyFoundationDirectNativeParity(source, { nativeRuntime });

  if (proof?.status !== 'native-verified' || proof?.verified !== true) {
    fail('Physical Quantity Foundation slice did not pass canonical real-C native parity', {
      status: proof?.status ?? null,
      verified: proof?.verified ?? false,
      diagnostics: proof?.diagnostics ?? null,
      gaps: proof?.gaps ?? null,
      parity: proof?.parity ?? null,
    });
  }
  if (proof?.lowering?.summary?.physicalLoweredStepCount !== 2) {
    fail('Physical direct lowering did not preserve the expected two bounded steps', {
      loweringSummary: proof?.lowering?.summary ?? null,
    });
  }
  if (proof?.parity?.state !== true || proof?.parity?.semanticStateRoot !== true || proof?.parity?.nativeStateRootVerified !== true || proof?.parity?.nativeStateRootParity !== true) {
    fail('Physical Quantity proof did not close state/root authority parity', { parity: proof?.parity ?? null });
  }
  if (proof?.parity?.loweringLineage !== true || proof?.parity?.domainReceipt !== true || proof?.parity?.nativeExecutionAttestation !== true) {
    fail('Physical Quantity proof did not close lineage/receipt/executable-attestation parity', { parity: proof?.parity ?? null });
  }

  const executionBinarySha256 = proof?.nativeExecutionAttestation?.materialization?.binarySha256 ?? null;
  if (executionBinarySha256 !== binarySha256) {
    fail('Physical Quantity proof is not bound to the exact Vercel native VM binary', {
      binarySha256,
      executionBinarySha256,
    });
  }

  const compiled = tryCompileFoundationRealityToBytecode(source);
  if (!compiled?.ok || !compiled?.bytecode) {
    fail('Physical Quantity source did not produce canonical Foundation direct bytecode', {
      diagnostics: compiled?.diagnostics ?? null,
    });
  }
  if ((compiled?.foundationQuantityNativeLowering?.summary?.quantityExtremumCount ?? 0) < 4) {
    fail('Physical Quantity source did not lower both min/max across both bounded steps', {
      quantityNativeLowering: compiled?.foundationQuantityNativeLowering ?? null,
    });
  }
  const native = runNativeBytecode(compiled.bytecode, {
    ...nativeRuntime,
    requireNativeStateRoot: true,
  });
  const state = native?.state ?? {};
  const position = state['world.stone.position'];
  const velocity = state['world.stone.velocity'];
  if (position?.kind !== 'Quantity' || position?.type !== 'Length' || position?.unit !== 'm' || position?.value !== 12) {
    fail('Physical native final Length state is not the expected dimensioned value', { position });
  }
  if (velocity?.kind !== 'Quantity' || velocity?.type !== 'Velocity' || velocity?.unit !== 'm/s' || velocity?.value !== 1) {
    fail('Physical native final Velocity state is not the expected dimensioned value', { velocity });
  }
  if (native?.stateRootVerified !== true || native?.stateRootParity !== true) {
    fail('Direct physical native replay did not verify its semantic state root', {
      stateRootVerified: native?.stateRootVerified ?? false,
      stateRootParity: native?.stateRootParity ?? false,
    });
  }

  const artifact = {
    ok: true,
    format: 'taowind.rcl-vercel-foundation-physical-native-proof.v0.3',
    domain: 'physical',
    status: proof.status,
    verified: true,
    binarySha256,
    physicalLoweredStepCount: proof.lowering.summary.physicalLoweredStepCount,
    quantityNativeLowering: compiled.foundationQuantityNativeLowering ?? null,
    parity: proof.parity,
    foundationDomainReceiptRoot: proof?.roots?.foundationDomainReceiptRoot ?? null,
    foundationCompositeReceiptRoot: proof?.roots?.foundationCompositeReceiptRoot ?? null,
    nativeVmExecutionAttestationRoot: proof?.roots?.nativeVmExecutionAttestationRoot ?? null,
    executionBinarySha256,
    finalState: {
      'world.stone.position': position,
      'world.stone.velocity': velocity,
    },
  };

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest?.format !== 'taowind.rcl-vercel-native-artifact.v0.3') {
    fail('Native deployment attestation is not the expected multi-domain evidence format', { format: manifest?.format ?? null });
  }
  if (manifest?.binarySha256 !== binarySha256 || manifest?.replayProof?.attestationBinarySha256 !== binarySha256) {
    fail('Native deployment attestation is not bound to the exact binary before adding Physical evidence', {
      binarySha256,
      manifestBinarySha256: manifest?.binarySha256 ?? null,
      replayBinarySha256: manifest?.replayProof?.attestationBinarySha256 ?? null,
    });
  }
  const perception = manifest?.foundationParityProofs?.perception ?? manifest?.foundationParityProof ?? null;
  if (perception?.domain !== 'perception' || perception?.verified !== true || perception?.executionBinarySha256 !== binarySha256) {
    fail('Perception Foundation proof must remain bound before Physical evidence can extend the deployment manifest', { perception });
  }

  const physicalParityProof = {
    format: proof.format ?? null,
    version: proof.version ?? null,
    domain: 'physical',
    status: proof.status,
    verified: true,
    loweredCount: artifact.physicalLoweredStepCount,
    quantityNativeLowering: artifact.quantityNativeLowering,
    parity: artifact.parity,
    foundationDomainReceiptRoot: artifact.foundationDomainReceiptRoot,
    foundationCompositeReceiptRoot: artifact.foundationCompositeReceiptRoot,
    nativeVmExecutionAttestationRoot: artifact.nativeVmExecutionAttestationRoot,
    executionBinarySha256,
    finalState: artifact.finalState,
  };

  manifest.foundationParityProofs = {
    ...(manifest.foundationParityProofs ?? {}),
    perception,
    physical: physicalParityProof,
  };
  manifest.foundationPhysicalParityProof = physicalParityProof;

  fs.mkdirSync(publicDir, { recursive: true });
  fs.writeFileSync(proofPath, `${JSON.stringify(artifact, null, 2)}\n`);
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  const publicBuildProof = fs.existsSync(publicBuildProofPath)
    ? JSON.parse(fs.readFileSync(publicBuildProofPath, 'utf8'))
    : {};
  publicBuildProof.format = manifest.format;
  publicBuildProof.binarySha256 = binarySha256;
  publicBuildProof.foundationParityDomains = ['perception', 'physical'];
  publicBuildProof.foundationParityProofs = {
    perception,
    physical: physicalParityProof,
  };
  publicBuildProof.foundationPhysicalParity = {
    domain: 'physical',
    status: physicalParityProof.status,
    verified: physicalParityProof.verified,
    loweredCount: physicalParityProof.loweredCount,
    foundationDomainReceiptRoot: physicalParityProof.foundationDomainReceiptRoot,
    nativeVmExecutionAttestationRoot: physicalParityProof.nativeVmExecutionAttestationRoot,
    executionBinarySha256,
  };
  fs.writeFileSync(publicBuildProofPath, `${JSON.stringify(publicBuildProof, null, 2)}\n`);

  console.log(JSON.stringify({
    ok: true,
    status: 'RCL_VERCEL_FOUNDATION_PHYSICAL_NATIVE_VERIFIED',
    binarySha256,
    physicalLoweredStepCount: artifact.physicalLoweredStepCount,
    quantityConstructorCount: artifact.quantityNativeLowering?.summary?.quantityConstructorCount ?? null,
    quantityBinaryCount: artifact.quantityNativeLowering?.summary?.quantityBinaryCount ?? null,
    quantityExtremumCount: artifact.quantityNativeLowering?.summary?.quantityExtremumCount ?? null,
    foundationDomainReceiptRoot: artifact.foundationDomainReceiptRoot,
    nativeVmExecutionAttestationRoot: artifact.nativeVmExecutionAttestationRoot,
    foundationParityDomains: Object.keys(manifest.foundationParityProofs).sort(),
    finalPosition: position,
    finalVelocity: velocity,
  }, null, 2));
} catch (error) {
  fail(error?.message ?? String(error), {
    code: error?.code ?? null,
    details: error?.details ?? null,
    stack: error?.stack ?? null,
  });
}
