import {
  FOUNDATION_NATIVE_BRIDGE_SPECS,
  foundationNativeBridgeCapabilityRegistrySnapshot,
} from './foundation-native-bridge-capability-registry.mjs';

export class FoundationNativeFederationRegistryBindingError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'FoundationNativeFederationRegistryBindingError';
    this.code = code;
    this.details = details;
  }
}

export function verifyFoundationNativeFederationRegistryBinding({
  federationProof,
  bridgeSpecs = FOUNDATION_NATIVE_BRIDGE_SPECS,
  registrySnapshot = foundationNativeBridgeCapabilityRegistrySnapshot(),
} = {}) {
  const expectedDomains = bridgeSpecs.map(spec => spec.domain);
  if (!federationProof || typeof federationProof !== 'object' || Array.isArray(federationProof)) {
    throw new FoundationNativeFederationRegistryBindingError(
      'RCL_FOUNDATION_FEDERATION_PROOF_MISSING',
      'Foundation Native Provider federation proof is missing.',
    );
  }
  if (
    federationProof.providerBridgeRegistryRoot !== registrySnapshot?.registryRoot
    || federationProof.providerBridgeSpecCount !== bridgeSpecs.length
  ) {
    throw new FoundationNativeFederationRegistryBindingError(
      'RCL_FOUNDATION_FEDERATION_REGISTRY_DRIFT',
      'Foundation Native Provider federation proof diverged from the executable canonical bridge registry.',
      {
        proofRegistryRoot: federationProof.providerBridgeRegistryRoot ?? null,
        canonicalRegistryRoot: registrySnapshot?.registryRoot ?? null,
        proofSpecCount: federationProof.providerBridgeSpecCount ?? null,
        canonicalSpecCount: bridgeSpecs.length,
      },
    );
  }
  if (JSON.stringify(federationProof.domains ?? []) !== JSON.stringify(expectedDomains)) {
    throw new FoundationNativeFederationRegistryBindingError(
      'RCL_FOUNDATION_FEDERATION_DOMAIN_DRIFT',
      'Foundation Native Provider federation domain order/set diverged from the executable canonical bridge registry.',
      {
        proofDomains: federationProof.domains ?? null,
        canonicalDomains: expectedDomains,
      },
    );
  }
  for (const spec of bridgeSpecs) {
    const batch = federationProof.providerBatches?.[spec.batchId];
    if (
      batch?.providerId !== spec.providerId
      || batch?.providerAbi !== 1
      || batch?.providerCallCount !== spec.providerCallCount
      || !Array.isArray(batch?.domains)
      || !batch.domains.includes(spec.domain)
    ) {
      throw new FoundationNativeFederationRegistryBindingError(
        'RCL_FOUNDATION_FEDERATION_BATCH_DRIFT',
        `${spec.domain} federation batch identity diverged from the executable canonical bridge registry.`,
        { spec, batch: batch ?? null },
      );
    }
  }
  return Object.freeze({
    ok: true,
    status: 'RCL_FOUNDATION_FEDERATION_REGISTRY_BINDING_VERIFIED',
    providerBridgeRegistryRoot: registrySnapshot.registryRoot,
    providerBridgeSpecCount: bridgeSpecs.length,
    domains: Object.freeze([...expectedDomains]),
    truthBoundary: Object.freeze({
      federationAttestationTopologyUsesExecutableCanonicalRegistry: true,
      registryBindingDoesNotClaimStatePathSemanticParity: true,
      providerBridgeDoesNotImplyDirectNativeExecution: true,
    }),
  });
}
