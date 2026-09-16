#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { materializeNativeVm } from '../src/native-vm-materialization.mjs';
import { runRealityNative } from '../src/native-vm.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const nativeDir = path.join(root, 'native');
const target = path.join(nativeDir, process.platform === 'win32' ? 'rclvm.exe' : 'rclvm');
const manifestPath = path.join(nativeDir, 'rclvm.vercel-attestation.json');

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function fail(message, details = {}) {
  console.error(JSON.stringify({
    ok: false,
    status: 'RCL_VERCEL_NATIVE_ARTIFACT_BUILD_FAILED',
    message,
    ...details,
  }, null, 2));
  process.exit(1);
}

if (process.platform !== 'linux') {
  fail('Vercel canonical native artifact build requires a Linux build environment', {
    platform: process.platform,
    arch: process.arch,
  });
}

try {
  fs.rmSync(target, { force: true });
  fs.rmSync(manifestPath, { force: true });

  const materialization = materializeNativeVm(root, {
    cacheRoot: path.join(os.tmpdir(), 'taowind-rcl-vercel-native-build'),
    buildIfMissing: true,
    buildTimeout: 120_000,
  });

  if (!materialization?.vmPath || !fs.existsSync(materialization.vmPath)) {
    fail('Canonical native VM materialization returned no executable artifact', { materialization });
  }

  fs.copyFileSync(materialization.vmPath, target);
  fs.chmodSync(target, 0o755);

  const binarySha256 = sha256(fs.readFileSync(target));
  if (binarySha256 !== materialization.binarySha256) {
    fail('Copied Vercel native VM binary hash does not match source materialization evidence', {
      materializedBinarySha256: materialization.binarySha256,
      copiedBinarySha256: binarySha256,
    });
  }

  const proofSource = [
    'reality VercelNativeArtifactProof {',
    '  facet world.ready : Truth = true',
    '  facet world.value : Number = 30',
    '}',
    '',
  ].join('\n');

  const proof = runRealityNative(proofSource, {
    vmPath: target,
    buildIfMissing: false,
    requireNativeStateRoot: true,
    timeout: 30_000,
  });

  if (proof?.status === 'error' || proof?.stateRootVerified !== true || proof?.stateRootParity !== true) {
    fail('Materialized native VM did not pass the canonical RBC replay proof', {
      proofStatus: proof?.status ?? null,
      stateRootVerified: proof?.stateRootVerified ?? null,
      stateRootParity: proof?.stateRootParity ?? null,
    });
  }

  const executionAttestation = proof.nativeVmExecutionAttestation ?? null;
  if (!executionAttestation?.attestationRoot) {
    fail('Canonical RBC replay did not produce an executable-artifact attestation');
  }
  const attestationBinarySha256 = executionAttestation.materialization?.binarySha256 ?? null;

  const deploymentArtifact = {
    format: 'taowind.rcl-vercel-native-artifact.v0.1',
    platform: process.platform,
    arch: process.arch,
    target: 'native/rclvm',
    binarySha256,
    sourceMaterialization: {
      format: materialization.format,
      version: materialization.version,
      provenance: materialization.provenance,
      sourceRoot: materialization.sourceRoot ?? null,
      supportProvenance: materialization.supportProvenance ?? null,
      build: materialization.build ?? null,
    },
    replayProof: {
      status: proof.status ?? 'ok',
      stateRootAlgorithm: proof.stateRootAlgorithm ?? null,
      nativeStateRoot: proof.nativeStateRoot ?? null,
      semanticStateRoot: proof.semanticStateRoot ?? null,
      stateRootVerified: proof.stateRootVerified === true,
      stateRootParity: proof.stateRootParity === true,
      attestationRoot: executionAttestation.attestationRoot,
      attestationBinarySha256,
    },
  };

  if (deploymentArtifact.replayProof.attestationBinarySha256 !== binarySha256) {
    fail('Execution attestation is not bound to the exact Vercel native VM binary', {
      binarySha256,
      attestationBinarySha256: deploymentArtifact.replayProof.attestationBinarySha256,
    });
  }

  fs.writeFileSync(manifestPath, `${JSON.stringify(deploymentArtifact, null, 2)}\n`);
  console.log(JSON.stringify({
    ok: true,
    status: 'RCL_VERCEL_NATIVE_ARTIFACT_READY',
    target: 'native/rclvm',
    binarySha256,
    sourceRoot: deploymentArtifact.sourceMaterialization.sourceRoot,
    attestationRoot: deploymentArtifact.replayProof.attestationRoot,
    stateRootVerified: true,
    stateRootParity: true,
  }, null, 2));
} catch (error) {
  fail(error?.message ?? String(error), {
    code: error?.code ?? null,
    details: error?.details ?? null,
    stack: error?.stack ?? null,
  });
}
