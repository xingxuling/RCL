#!/usr/bin/env node
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  FOUNDATION_NATIVE_BRIDGE_SPECS,
  foundationNativeBridgeCapabilityRegistrySnapshot,
} from '../src/foundation-native-bridge-capability-registry.mjs';
import { verifyFoundationNativeFederationRegistryBinding } from '../src/foundation-native-federation-registry-binding.mjs';

const manifestPath = fileURLToPath(new URL('../native/rclvm.vercel-attestation.json', import.meta.url));

function isSha256(value) {
  return typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value);
}

function fail(message, details = {}) {
  console.error(JSON.stringify({
    ok: false,
    status: 'RCL_VERCEL_FOUNDATION_NATIVE_FEDERATION_REGISTRY_BINDING_FAILED',
    message,
    ...details,
  }, null, 2));
  process.exit(1);
}

try {
  if (!fs.existsSync(manifestPath)) fail('Native VM deployment attestation is missing.', { manifestPath });
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const proof = manifest?.foundationNativeBridgeFederationProof;
  const bridgeRegistry = foundationNativeBridgeCapabilityRegistrySnapshot();
  if (
    proof?.format !== 'taowind.rcl-vercel-foundation-native-provider-federation.v0.1'
    || proof?.status !== 'deployment-bound'
    || proof?.verified !== true
    || !isSha256(proof?.federationRoot)
  ) {
    fail('Native Provider federation deployment proof is not a verified content-addressed attestation.', { proof });
  }

  const binding = verifyFoundationNativeFederationRegistryBinding({
    federationProof: proof,
    bridgeSpecs: FOUNDATION_NATIVE_BRIDGE_SPECS,
    registrySnapshot: bridgeRegistry,
  });
  if (
    JSON.stringify(manifest?.foundationNativeBridgeDomains ?? []) !== JSON.stringify(binding.domains)
    || manifest?.foundationNativeBridgeProofs == null
    || Object.keys(manifest.foundationNativeBridgeProofs).length !== binding.providerBridgeSpecCount
  ) {
    fail('Native VM attestation bridge domain/proof surface diverged from the bound federation registry.', {
      manifestDomains: manifest?.foundationNativeBridgeDomains ?? null,
      proofCount: Object.keys(manifest?.foundationNativeBridgeProofs ?? {}).length,
      binding,
    });
  }

  console.log(JSON.stringify({
    ok: true,
    status: 'RCL_VERCEL_FOUNDATION_NATIVE_FEDERATION_REGISTRY_BINDING_VERIFIED',
    providerBridgeRegistryRoot: binding.providerBridgeRegistryRoot,
    providerBridgeSpecCount: binding.providerBridgeSpecCount,
    federationRoot: proof.federationRoot,
    domains: binding.domains,
    truthBoundary: binding.truthBoundary,
  }, null, 2));
} catch (error) {
  fail(error?.message ?? String(error), {
    code: error?.code ?? null,
    details: error?.details ?? null,
    stack: error?.stack ?? null,
  });
}
