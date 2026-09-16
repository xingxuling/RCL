#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const nativeDir = path.join(root, 'native');
const target = path.join(nativeDir, process.platform === 'win32' ? 'rclvm.exe' : 'rclvm');
const manifestPath = path.join(nativeDir, 'rclvm.vercel-attestation.json');
const publicDir = path.join(root, 'public');
const neuralProofPath = path.join(publicDir, 'rcl-foundation-neural-native-proof.json');
const publicBuildProofPath = path.join(publicDir, 'rcl-native-build-proof.json');

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function isSha256(value) {
  return typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value);
}

function fail(message, details = {}) {
  console.error(JSON.stringify({
    ok: false,
    status: 'RCL_VERCEL_FOUNDATION_NEURAL_BINDING_FAILED',
    message,
    ...details,
  }, null, 2));
  process.exit(1);
}

function coreParityValid(proof) {
  return Boolean(
    proof?.parity?.state === true
    && proof?.parity?.semanticStateRoot === true
    && proof?.parity?.nativeStateRootVerified === true
    && proof?.parity?.nativeStateRootParity === true
    && proof?.parity?.loweringLineage === true
    && proof?.parity?.domainReceipt === true
    && proof?.parity?.nativeExecutionAttestation === true
  );
}

try {
  if (!fs.existsSync(target)) fail('Canonical native VM is missing before Neural evidence binding', { target });
  if (!fs.existsSync(manifestPath)) fail('Deployment attestation is missing before Neural evidence binding', { manifestPath });
  if (!fs.existsSync(neuralProofPath)) fail('Standalone Neural real-C proof is missing before deployment binding', { neuralProofPath });

  const binarySha256 = sha256(fs.readFileSync(target));
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const neural = JSON.parse(fs.readFileSync(neuralProofPath, 'utf8'));

  if (manifest?.format !== 'taowind.rcl-vercel-native-artifact.v0.3') {
    fail('Deployment attestation format is not the expected multi-domain format', { format: manifest?.format ?? null });
  }
  if (
    manifest?.binarySha256 !== binarySha256
    || manifest?.replayProof?.attestationBinarySha256 !== binarySha256
    || manifest?.replayProof?.stateRootVerified !== true
    || manifest?.replayProof?.stateRootParity !== true
    || !isSha256(manifest?.replayProof?.attestationRoot)
  ) {
    fail('Deployment replay evidence is not bound to the exact current canonical binary', {
      binarySha256,
      manifestBinarySha256: manifest?.binarySha256 ?? null,
      replayProof: manifest?.replayProof ?? null,
    });
  }

  const perception = manifest?.foundationParityProofs?.perception ?? null;
  const physical = manifest?.foundationParityProofs?.physical ?? null;
  for (const [domain, existing] of [['perception', perception], ['physical', physical]]) {
    if (
      existing?.domain !== domain
      || existing?.status !== 'native-verified'
      || existing?.verified !== true
      || existing?.executionBinarySha256 !== binarySha256
      || !coreParityValid(existing)
      || !isSha256(existing?.foundationDomainReceiptRoot)
      || !isSha256(existing?.nativeVmExecutionAttestationRoot)
    ) {
      fail(`Existing ${domain} proof is not valid enough to extend the deployment evidence manifest`, { domain, existing });
    }
  }

  if (
    neural?.format !== 'taowind.rcl-vercel-foundation-neural-native-proof.v0.1'
    || neural?.domain !== 'neural'
    || neural?.status !== 'native-verified'
    || neural?.verified !== true
    || neural?.binarySha256 !== binarySha256
    || neural?.executionBinarySha256 !== binarySha256
    || neural?.neuralLoweredTransactionCount !== 4
    || neural?.boundedSteps !== 2
    || neural?.pathwayCount !== 2
    || neural?.activePathway !== 'brain.integrate'
    || neural?.inactivePathway !== 'brain.dormant'
    || !coreParityValid(neural)
    || !isSha256(neural?.foundationDomainReceiptRoot)
    || !isSha256(neural?.nativeVmExecutionAttestationRoot)
    || neural?.finalState?.['brain.stimulus'] !== 1
    || neural?.finalState?.['brain.response'] !== 1
    || neural?.finalState?.['brain.trace'] !== 0
  ) {
    fail('Standalone Neural proof does not satisfy the deployment evidence contract', { neural });
  }

  const neuralParityProof = {
    format: neural.format,
    version: '0.1.0',
    domain: 'neural',
    status: neural.status,
    verified: true,
    loweredCount: neural.neuralLoweredTransactionCount,
    boundedSteps: neural.boundedSteps,
    pathwayCount: neural.pathwayCount,
    activePathway: neural.activePathway,
    inactivePathway: neural.inactivePathway,
    parity: neural.parity,
    foundationDomainReceiptRoot: neural.foundationDomainReceiptRoot,
    foundationCompositeReceiptRoot: neural.foundationCompositeReceiptRoot,
    nativeVmExecutionAttestationRoot: neural.nativeVmExecutionAttestationRoot,
    executionBinarySha256: neural.executionBinarySha256,
    finalState: neural.finalState,
  };

  manifest.foundationParityProofs = {
    ...(manifest.foundationParityProofs ?? {}),
    perception,
    physical,
    neural: neuralParityProof,
  };
  manifest.foundationNeuralParityProof = neuralParityProof;
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  const publicBuildProof = fs.existsSync(publicBuildProofPath)
    ? JSON.parse(fs.readFileSync(publicBuildProofPath, 'utf8'))
    : {};
  publicBuildProof.format = manifest.format;
  publicBuildProof.binarySha256 = binarySha256;
  publicBuildProof.foundationParityDomains = ['perception', 'physical', 'neural'];
  publicBuildProof.foundationParityProofs = {
    perception,
    physical,
    neural: neuralParityProof,
  };
  publicBuildProof.foundationNeuralParity = {
    domain: 'neural',
    status: neuralParityProof.status,
    verified: neuralParityProof.verified,
    loweredCount: neuralParityProof.loweredCount,
    foundationDomainReceiptRoot: neuralParityProof.foundationDomainReceiptRoot,
    nativeVmExecutionAttestationRoot: neuralParityProof.nativeVmExecutionAttestationRoot,
    executionBinarySha256: neuralParityProof.executionBinarySha256,
    finalState: neuralParityProof.finalState,
  };
  fs.writeFileSync(publicBuildProofPath, `${JSON.stringify(publicBuildProof, null, 2)}\n`);

  console.log(JSON.stringify({
    ok: true,
    status: 'RCL_VERCEL_FOUNDATION_NEURAL_DEPLOYMENT_BOUND',
    binarySha256,
    foundationParityDomains: Object.keys(manifest.foundationParityProofs),
    neuralLoweredTransactionCount: neuralParityProof.loweredCount,
    neuralDomainReceiptRoot: neuralParityProof.foundationDomainReceiptRoot,
    neuralExecutionAttestationRoot: neuralParityProof.nativeVmExecutionAttestationRoot,
    finalState: neuralParityProof.finalState,
  }, null, 2));
} catch (error) {
  fail(error?.message ?? String(error), {
    code: error?.code ?? null,
    stack: error?.stack ?? null,
  });
}
