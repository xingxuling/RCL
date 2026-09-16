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
const proofPath = path.join(publicDir, 'rcl-foundation-genetic-native-proof.json');

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function fail(message, details = {}) {
  console.error(JSON.stringify({
    ok: false,
    status: 'RCL_VERCEL_FOUNDATION_GENETIC_PROOF_FAILED',
    message,
    ...details,
  }, null, 2));
  process.exit(1);
}

const source = [
  'reality VercelGeneticNativeProof {',
  '  genetic lineage {',
  '    gene seed : Number = 1',
  '    facet trait : Number = 0',
  '    mutate lineage.seed by 2',
  '    express lineage.trait <- lineage.seed * 3',
  '    preserve lineage.trait >= 0',
  '    witness "genetic:lineage-native"',
  '  }',
  '  inherit lineage generations 2',
  '}',
  '',
].join('\n');

try {
  if (!fs.existsSync(target)) fail('Canonical Vercel native VM artifact is missing before Genetic parity proof', { target });
  if (!fs.existsSync(manifestPath)) fail('Canonical Vercel native VM attestation is missing before Genetic parity proof', { manifestPath });

  const binarySha256 = sha256(fs.readFileSync(target));
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest?.format !== 'taowind.rcl-vercel-native-artifact.v0.3') {
    fail('Native deployment attestation is not the expected multi-domain evidence format', { format: manifest?.format ?? null });
  }
  if (manifest?.binarySha256 !== binarySha256 || manifest?.replayProof?.attestationBinarySha256 !== binarySha256) {
    fail('Genetic proof is not running against the exact attested canonical binary', {
      binarySha256,
      manifestBinarySha256: manifest?.binarySha256 ?? null,
      replayBinarySha256: manifest?.replayProof?.attestationBinarySha256 ?? null,
    });
  }

  for (const domain of ['perception', 'physical', 'neural']) {
    const existing = manifest?.foundationParityProofs?.[domain] ?? null;
    if (existing?.domain !== domain || existing?.status !== 'native-verified' || existing?.verified !== true || existing?.executionBinarySha256 !== binarySha256) {
      fail(`Existing ${domain} real-C proof must remain bound before Genetic replay`, { domain, existing });
    }
  }

  const nativeRuntime = {
    vmPath: target,
    buildIfMissing: false,
    timeout: 30_000,
  };
  const proof = await verifyFoundationDirectNativeParity(source, { nativeRuntime });

  if (proof?.status !== 'native-verified' || proof?.verified !== true) {
    fail('Genetic Foundation slice did not pass canonical real-C native parity', {
      status: proof?.status ?? null,
      verified: proof?.verified ?? false,
      diagnostics: proof?.diagnostics ?? null,
      gaps: proof?.gaps ?? null,
      parity: proof?.parity ?? null,
    });
  }
  if (
    proof?.lowering?.summary?.geneticLoweredGenerationCount !== 2
    || proof?.lowering?.summary?.geneticLoweredStageCount !== 4
    || proof?.lowering?.summary?.loweredCount !== 4
  ) {
    fail('Genetic direct lowering did not preserve the expected 2-generation mutation/expression schedule', {
      loweringSummary: proof?.lowering?.summary ?? null,
    });
  }
  if (
    proof?.parity?.state !== true
    || proof?.parity?.semanticStateRoot !== true
    || proof?.parity?.nativeStateRootVerified !== true
    || proof?.parity?.nativeStateRootParity !== true
    || proof?.parity?.loweringLineage !== true
    || proof?.parity?.domainReceipt !== true
    || proof?.parity?.nativeExecutionAttestation !== true
  ) {
    fail('Genetic proof did not close state/root/lineage/receipt/executable-attestation parity', { parity: proof?.parity ?? null });
  }

  const executionBinarySha256 = proof?.nativeExecutionAttestation?.materialization?.binarySha256 ?? null;
  if (executionBinarySha256 !== binarySha256) {
    fail('Genetic parity execution is not bound to the exact Vercel native VM binary', {
      binarySha256,
      executionBinarySha256,
    });
  }

  const compiled = tryCompileFoundationRealityToBytecode(source);
  if (!compiled?.ok || !compiled?.bytecode) {
    fail('Genetic source did not produce canonical Foundation direct bytecode', {
      diagnostics: compiled?.diagnostics ?? null,
    });
  }
  if (
    compiled?.foundationDirectLowering?.summary?.geneticLoweredGenerationCount !== 2
    || compiled?.foundationDirectLowering?.summary?.geneticLoweredStageCount !== 4
  ) {
    fail('Direct bytecode compilation lost the expected Genetic staged lowering counts', {
      loweringSummary: compiled?.foundationDirectLowering?.summary ?? null,
    });
  }

  const native = runNativeBytecode(compiled.bytecode, {
    ...nativeRuntime,
    requireNativeStateRoot: true,
  });
  const state = native?.state ?? {};
  if (state['lineage.seed'] !== 5 || state['lineage.trait'] !== 15) {
    fail('Genetic native final state does not preserve ordered additive mutation and expression semantics', {
      seed: state['lineage.seed'] ?? null,
      trait: state['lineage.trait'] ?? null,
    });
  }
  if (native?.stateRootVerified !== true || native?.stateRootParity !== true) {
    fail('Direct Genetic native replay did not verify its semantic state root', {
      stateRootVerified: native?.stateRootVerified ?? false,
      stateRootParity: native?.stateRootParity ?? false,
    });
  }

  const artifact = {
    ok: true,
    format: 'taowind.rcl-vercel-foundation-genetic-native-proof.v0.1',
    domain: 'genetic',
    status: proof.status,
    verified: true,
    binarySha256,
    geneticLoweredGenerationCount: proof.lowering.summary.geneticLoweredGenerationCount,
    geneticLoweredStageCount: proof.lowering.summary.geneticLoweredStageCount,
    parity: proof.parity,
    foundationDomainReceiptRoot: proof?.roots?.foundationDomainReceiptRoot ?? null,
    foundationCompositeReceiptRoot: proof?.roots?.foundationCompositeReceiptRoot ?? null,
    nativeVmExecutionAttestationRoot: proof?.roots?.nativeVmExecutionAttestationRoot ?? null,
    executionBinarySha256,
    truthBoundary: {
      canonicalRealCReplayExecuted: true,
      exactExecutableIdentityBound: true,
      orderedMutationExpressionSemanticsExercised: true,
      deploymentHealthBindingClaimed: false,
      dynamicGenerationCountClaimed: false,
      allFoundationDomainsNativeClaimed: false,
    },
    finalState: {
      'lineage.seed': state['lineage.seed'],
      'lineage.trait': state['lineage.trait'],
    },
  };

  fs.mkdirSync(publicDir, { recursive: true });
  fs.writeFileSync(proofPath, `${JSON.stringify(artifact, null, 2)}\n`);

  console.log(JSON.stringify({
    ok: true,
    status: 'RCL_VERCEL_FOUNDATION_GENETIC_NATIVE_VERIFIED',
    binarySha256,
    geneticLoweredGenerationCount: artifact.geneticLoweredGenerationCount,
    geneticLoweredStageCount: artifact.geneticLoweredStageCount,
    foundationDomainReceiptRoot: artifact.foundationDomainReceiptRoot,
    nativeVmExecutionAttestationRoot: artifact.nativeVmExecutionAttestationRoot,
    finalSeed: artifact.finalState['lineage.seed'],
    finalTrait: artifact.finalState['lineage.trait'],
  }, null, 2));
} catch (error) {
  fail(error?.message ?? String(error), {
    code: error?.code ?? null,
    details: error?.details ?? null,
    stack: error?.stack ?? null,
  });
}
