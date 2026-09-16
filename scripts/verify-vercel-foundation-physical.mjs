#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tryCompileFoundationRealityToBytecode } from '../src/foundation-direct-bytecode.mjs';
import { verifyFoundationDirectNativeParity } from '../src/foundation-direct-native-parity.mjs';
import { runNativeBytecode } from '../src/native-vm.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const target = path.join(root, 'native', process.platform === 'win32' ? 'rclvm.exe' : 'rclvm');
const proofPath = path.join(root, 'public', 'rcl-foundation-physical-native-proof.json');

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
  '      evolve world.stone.position <- world.stone.position + world.stone.velocity * dt',
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
    format: 'taowind.rcl-vercel-foundation-physical-native-proof.v0.1',
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
  fs.mkdirSync(path.dirname(proofPath), { recursive: true });
  fs.writeFileSync(proofPath, `${JSON.stringify(artifact, null, 2)}\n`);
  console.log(JSON.stringify({
    ok: true,
    status: 'RCL_VERCEL_FOUNDATION_PHYSICAL_NATIVE_VERIFIED',
    binarySha256,
    physicalLoweredStepCount: artifact.physicalLoweredStepCount,
    quantityConstructorCount: artifact.quantityNativeLowering?.summary?.quantityConstructorCount ?? null,
    quantityBinaryCount: artifact.quantityNativeLowering?.summary?.quantityBinaryCount ?? null,
    foundationDomainReceiptRoot: artifact.foundationDomainReceiptRoot,
    nativeVmExecutionAttestationRoot: artifact.nativeVmExecutionAttestationRoot,
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
