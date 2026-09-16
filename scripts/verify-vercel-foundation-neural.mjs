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
const proofPath = path.join(publicDir, 'rcl-foundation-neural-native-proof.json');

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function fail(message, details = {}) {
  console.error(JSON.stringify({
    ok: false,
    status: 'RCL_VERCEL_FOUNDATION_NEURAL_PROOF_FAILED',
    message,
    ...details,
  }, null, 2));
  process.exit(1);
}

const source = [
  'reality VercelNeuralNativeProof {',
  '  neural brain {',
  '    facet stimulus : Number = 1',
  '    facet response : Number = 0',
  '    facet trace : Number = 0',
  '    pathway integrate {',
  '      when brain.stimulus > 0',
  '      transmit brain.response <- brain.response + brain.stimulus * 0.5',
  '      preserve brain.response >= 0 and brain.response <= 1',
  '      witness "neural:integration-native"',
  '    }',
  '    pathway dormant {',
  '      when brain.stimulus < 0',
  '      learn brain.trace <- brain.trace + 1',
  '      preserve brain.trace >= 0',
  '      witness "neural:dormant-native"',
  '    }',
  '  }',
  '  propagate brain steps 2',
  '}',
  '',
].join('\n');

try {
  if (!fs.existsSync(target)) fail('Canonical Vercel native VM artifact is missing before Neural parity proof', { target });
  if (!fs.existsSync(manifestPath)) fail('Canonical Vercel native VM attestation is missing before Neural parity proof', { manifestPath });

  const binarySha256 = sha256(fs.readFileSync(target));
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest?.format !== 'taowind.rcl-vercel-native-artifact.v0.3') {
    fail('Native deployment attestation is not the expected multi-domain evidence format', { format: manifest?.format ?? null });
  }
  if (manifest?.binarySha256 !== binarySha256 || manifest?.replayProof?.attestationBinarySha256 !== binarySha256) {
    fail('Neural proof is not running against the exact attested canonical binary', {
      binarySha256,
      manifestBinarySha256: manifest?.binarySha256 ?? null,
      replayBinarySha256: manifest?.replayProof?.attestationBinarySha256 ?? null,
    });
  }

  const perception = manifest?.foundationParityProofs?.perception ?? null;
  const physical = manifest?.foundationParityProofs?.physical ?? null;
  for (const [domain, existing] of [['perception', perception], ['physical', physical]]) {
    if (existing?.domain !== domain || existing?.status !== 'native-verified' || existing?.verified !== true || existing?.executionBinarySha256 !== binarySha256) {
      fail(`Existing ${domain} real-C proof must remain bound before Neural replay`, { domain, existing });
    }
  }

  const nativeRuntime = {
    vmPath: target,
    buildIfMissing: false,
    timeout: 30_000,
  };
  const proof = await verifyFoundationDirectNativeParity(source, { nativeRuntime });

  if (proof?.status !== 'native-verified' || proof?.verified !== true) {
    fail('Neural Foundation slice did not pass canonical real-C native parity', {
      status: proof?.status ?? null,
      verified: proof?.verified ?? false,
      diagnostics: proof?.diagnostics ?? null,
      gaps: proof?.gaps ?? null,
      parity: proof?.parity ?? null,
    });
  }
  if (proof?.lowering?.summary?.neuralLoweredTransactionCount !== 4 || proof?.lowering?.summary?.loweredCount !== 4) {
    fail('Neural direct lowering did not preserve the expected 2-step x 2-pathway bounded schedule', {
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
    fail('Neural proof did not close state/root/lineage/receipt/executable-attestation parity', { parity: proof?.parity ?? null });
  }

  const executionBinarySha256 = proof?.nativeExecutionAttestation?.materialization?.binarySha256 ?? null;
  if (executionBinarySha256 !== binarySha256) {
    fail('Neural parity execution is not bound to the exact Vercel native VM binary', {
      binarySha256,
      executionBinarySha256,
    });
  }

  const compiled = tryCompileFoundationRealityToBytecode(source);
  if (!compiled?.ok || !compiled?.bytecode) {
    fail('Neural source did not produce canonical Foundation direct bytecode', {
      diagnostics: compiled?.diagnostics ?? null,
    });
  }
  if (compiled?.foundationDirectLowering?.summary?.neuralLoweredTransactionCount !== 4) {
    fail('Direct bytecode compilation lost the expected Neural transaction count', {
      loweringSummary: compiled?.foundationDirectLowering?.summary ?? null,
    });
  }

  const native = runNativeBytecode(compiled.bytecode, {
    ...nativeRuntime,
    requireNativeStateRoot: true,
  });
  const state = native?.state ?? {};
  if (state['brain.stimulus'] !== 1 || state['brain.response'] !== 1 || state['brain.trace'] !== 0) {
    fail('Neural native final state does not preserve active/inactive pathway semantics', {
      stimulus: state['brain.stimulus'] ?? null,
      response: state['brain.response'] ?? null,
      trace: state['brain.trace'] ?? null,
    });
  }
  if (native?.stateRootVerified !== true || native?.stateRootParity !== true) {
    fail('Direct Neural native replay did not verify its semantic state root', {
      stateRootVerified: native?.stateRootVerified ?? false,
      stateRootParity: native?.stateRootParity ?? false,
    });
  }

  const artifact = {
    ok: true,
    format: 'taowind.rcl-vercel-foundation-neural-native-proof.v0.1',
    domain: 'neural',
    status: proof.status,
    verified: true,
    binarySha256,
    neuralLoweredTransactionCount: proof.lowering.summary.neuralLoweredTransactionCount,
    boundedSteps: 2,
    pathwayCount: 2,
    activePathway: 'brain.integrate',
    inactivePathway: 'brain.dormant',
    parity: proof.parity,
    foundationDomainReceiptRoot: proof?.roots?.foundationDomainReceiptRoot ?? null,
    foundationCompositeReceiptRoot: proof?.roots?.foundationCompositeReceiptRoot ?? null,
    nativeVmExecutionAttestationRoot: proof?.roots?.nativeVmExecutionAttestationRoot ?? null,
    executionBinarySha256,
    truthBoundary: {
      canonicalRealCReplayExecuted: true,
      exactExecutableIdentityBound: true,
      activeAndInactivePathwaySemanticsExercised: true,
      deploymentHealthBindingClaimed: false,
      dynamicPropagationClaimed: false,
      allFoundationDomainsNativeClaimed: false,
    },
    finalState: {
      'brain.stimulus': state['brain.stimulus'],
      'brain.response': state['brain.response'],
      'brain.trace': state['brain.trace'],
    },
  };

  fs.mkdirSync(publicDir, { recursive: true });
  fs.writeFileSync(proofPath, `${JSON.stringify(artifact, null, 2)}\n`);

  console.log(JSON.stringify({
    ok: true,
    status: 'RCL_VERCEL_FOUNDATION_NEURAL_NATIVE_VERIFIED',
    binarySha256,
    neuralLoweredTransactionCount: artifact.neuralLoweredTransactionCount,
    boundedSteps: artifact.boundedSteps,
    pathwayCount: artifact.pathwayCount,
    foundationDomainReceiptRoot: artifact.foundationDomainReceiptRoot,
    nativeVmExecutionAttestationRoot: artifact.nativeVmExecutionAttestationRoot,
    finalStimulus: artifact.finalState['brain.stimulus'],
    finalResponse: artifact.finalState['brain.response'],
    finalTrace: artifact.finalState['brain.trace'],
  }, null, 2));
} catch (error) {
  fail(error?.message ?? String(error), {
    code: error?.code ?? null,
    details: error?.details ?? null,
    stack: error?.stack ?? null,
  });
}
