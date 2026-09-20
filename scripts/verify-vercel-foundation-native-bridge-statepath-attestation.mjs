#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bridgeStatePathTruthStatus } from '../api/bridge-statepath-truth.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const publicProofPath = path.join(root, 'public', 'rcl-foundation-native-bridge-statepath-attestation.json');
const manifestPath = path.join(root, 'native', 'rclvm.vercel-attestation.json');
const publicBuildProofPath = path.join(root, 'public', 'rcl-native-build-proof.json');

function fail(message, details = {}) {
  console.error(JSON.stringify({
    ok: false,
    status: 'RCL_VERCEL_FOUNDATION_NATIVE_BRIDGE_STATEPATH_ATTESTATION_FAILED',
    message,
    ...details,
  }, null, 2));
  process.exit(1);
}

try {
  for (const requiredPath of [publicProofPath, manifestPath, publicBuildProofPath]) {
    if (!fs.existsSync(requiredPath)) fail('StatePath deployment evidence file is missing', { requiredPath });
  }
  const publicProof = JSON.parse(fs.readFileSync(publicProofPath, 'utf8'));
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const publicBuildProof = JSON.parse(fs.readFileSync(publicBuildProofPath, 'utf8'));
  const runtimeTruth = bridgeStatePathTruthStatus();
  const manifestProof = manifest?.foundationNativeBridgeStatePathAttestation ?? null;
  const buildProof = publicBuildProof?.foundationNativeBridgeStatePathAttestation ?? null;

  if (
    runtimeTruth?.ok !== true
    || runtimeTruth?.status !== 'RCL_PROVIDER_BRIDGE_STATEPATH_SEMANTICS_VERIFIED'
    || publicProof?.attestationRoot !== runtimeTruth.attestationRoot
    || manifestProof?.attestationRoot !== runtimeTruth.attestationRoot
    || buildProof?.attestationRoot !== runtimeTruth.attestationRoot
    || publicProof?.providerBridgeRegistryRoot !== runtimeTruth.providerBridgeRegistryRoot
    || publicProof?.providerBridgeSpecCount !== runtimeTruth.providerBridgeSpecCount
  ) {
    fail('Runtime/public/native StatePath attestations do not share one canonical identity', {
      runtimeTruth,
      publicRoot: publicProof?.attestationRoot ?? null,
      manifestRoot: manifestProof?.attestationRoot ?? null,
      buildRoot: buildProof?.attestationRoot ?? null,
    });
  }

  console.log(JSON.stringify({
    ok: true,
    status: 'RCL_VERCEL_FOUNDATION_NATIVE_BRIDGE_STATEPATH_ATTESTATION_VERIFIED',
    attestationRoot: runtimeTruth.attestationRoot,
    providerBridgeRegistryRoot: runtimeTruth.providerBridgeRegistryRoot,
    providerBridgeSpecCount: runtimeTruth.providerBridgeSpecCount,
    domains: runtimeTruth.domains,
    truthBoundary: runtimeTruth.truthBoundary,
  }, null, 2));
} catch (error) {
  fail(error?.message ?? String(error), {
    code: error?.code ?? null,
    details: error?.details ?? null,
    stack: error?.stack ?? null,
  });
}
