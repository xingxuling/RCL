import crypto from 'node:crypto';
import {
  FOUNDATION_NATIVE_BRIDGE_SPECS,
  foundationNativeBridgeCapabilityRegistrySnapshot,
} from './foundation-native-bridge-capability-registry.mjs';

export const FOUNDATION_NATIVE_BRIDGE_STATEPATH_ATTESTATION_FORMAT =
  'taowind.rcl-foundation-native-bridge-statepath-attestation.v0.1';
export const FOUNDATION_NATIVE_BRIDGE_STATEPATH_ATTESTATION_VERSION = '0.1.0';

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalize(value[key])]));
  }
  return value;
}

function sha256Canonical(value) {
  return crypto.createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex');
}

function isSha256(value) {
  return typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value);
}

function fail(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.details = details;
  throw error;
}

export function expectedFoundationBridgeSemanticResultPath(domain) {
  if (typeof domain !== 'string' || domain.length === 0) {
    throw new TypeError('domain must be a non-empty string');
  }
  return `foundation.${domain}.result`;
}

export function verifyFoundationNativeBridgeStatePathAttestation({
  attestation,
  bridgeSpecs = FOUNDATION_NATIVE_BRIDGE_SPECS,
  registrySnapshot = foundationNativeBridgeCapabilityRegistrySnapshot(),
} = {}) {
  if (!attestation || typeof attestation !== 'object' || Array.isArray(attestation)) {
    fail('RCL_FOUNDATION_BRIDGE_STATEPATH_ATTESTATION_MISSING', 'StatePath attestation must be an object');
  }
  if (
    attestation.format !== FOUNDATION_NATIVE_BRIDGE_STATEPATH_ATTESTATION_FORMAT
    || attestation.version !== FOUNDATION_NATIVE_BRIDGE_STATEPATH_ATTESTATION_VERSION
    || attestation.status !== 'statepath-semantics-verified'
    || attestation.verified !== true
  ) {
    fail(
      'RCL_FOUNDATION_BRIDGE_STATEPATH_ATTESTATION_FORMAT',
      'StatePath attestation envelope is invalid',
      { attestation },
    );
  }
  if (
    attestation.providerBridgeRegistryRoot !== registrySnapshot?.registryRoot
    || attestation.providerBridgeSpecCount !== bridgeSpecs.length
  ) {
    fail(
      'RCL_FOUNDATION_BRIDGE_STATEPATH_REGISTRY_DRIFT',
      'StatePath attestation is not bound to the executable canonical Provider bridge registry',
      {
        observedRegistryRoot: attestation.providerBridgeRegistryRoot ?? null,
        expectedRegistryRoot: registrySnapshot?.registryRoot ?? null,
        observedSpecCount: attestation.providerBridgeSpecCount ?? null,
        expectedSpecCount: bridgeSpecs.length,
      },
    );
  }
  if (!Array.isArray(attestation.entries) || attestation.entries.length !== bridgeSpecs.length) {
    fail(
      'RCL_FOUNDATION_BRIDGE_STATEPATH_ENTRY_COUNT',
      'StatePath attestation entry count diverged from the canonical Provider bridge registry',
      { observed: attestation.entries?.length ?? null, expected: bridgeSpecs.length },
    );
  }

  bridgeSpecs.forEach((spec, index) => {
    const entry = attestation.entries[index];
    const semanticResultPath = expectedFoundationBridgeSemanticResultPath(spec.domain);
    if (
      entry?.batchId !== spec.batchId
      || entry?.providerId !== spec.providerId
      || entry?.providerCallCount !== spec.providerCallCount
      || entry?.domain !== spec.domain
      || entry?.capability !== spec.capability
      || entry?.statePath !== spec.statePath
    ) {
      fail(
        'RCL_FOUNDATION_BRIDGE_STATEPATH_SPEC_DRIFT',
        'StatePath attestation entry diverged from canonical Provider bridge metadata',
        { index, expected: spec, observed: entry ?? null },
      );
    }
    const expectedSequence = bridgeSpecs
      .slice(0, index + 1)
      .filter(item => item.batchId === spec.batchId).length;
    if (entry?.sequence !== expectedSequence) {
      fail(
        'RCL_FOUNDATION_BRIDGE_STATEPATH_SEQUENCE_DRIFT',
        'StatePath attestation replay sequence diverged from the canonical Provider batch order',
        { domain: spec.domain, expected: expectedSequence, observed: entry?.sequence ?? null },
      );
    }
    if (entry?.semanticResultPath !== semanticResultPath) {
      fail(
        'RCL_FOUNDATION_BRIDGE_STATEPATH_SEMANTIC_PATH_DRIFT',
        'StatePath attestation semantic result path diverged from the Foundation domain contract',
        { domain: spec.domain, expected: semanticResultPath, observed: entry?.semanticResultPath ?? null },
      );
    }
    for (const field of ['sourceRoot', 'bytecodeRoot', 'deterministicReceiptRoot', 'beforeRoot', 'afterRoot']) {
      if (!isSha256(entry?.[field])) {
        fail(
          'RCL_FOUNDATION_BRIDGE_STATEPATH_EVIDENCE_ROOT_INVALID',
          `StatePath attestation ${field} is not a SHA-256 root`,
          { domain: spec.domain, field, value: entry?.[field] ?? null },
        );
      }
    }
    if (entry?.replayVerified !== true || entry?.semanticChangeVerified !== true) {
      fail(
        'RCL_FOUNDATION_BRIDGE_STATEPATH_SEMANTIC_EVIDENCE_INCOMPLETE',
        'StatePath attestation requires replay and semantic-change verification',
        { domain: spec.domain, replayVerified: entry?.replayVerified, semanticChangeVerified: entry?.semanticChangeVerified },
      );
    }
  });

  const truthBoundary = attestation.truthBoundary ?? {};
  if (
    truthBoundary.executableStatePathBoundToCanonicalRegistry !== true
    || truthBoundary.semanticResultPathBoundToFoundationDomainContract !== true
    || truthBoundary.sourceRootAndReceiptRootBindObservedExecutionEvidence !== true
    || truthBoundary.replayVerificationRequired !== true
    || truthBoundary.statePathSemanticAttestationDoesNotImplyDirectNativeExecution !== true
  ) {
    fail(
      'RCL_FOUNDATION_BRIDGE_STATEPATH_TRUTH_BOUNDARY_DRIFT',
      'StatePath attestation truth boundary is incomplete or overclaims execution semantics',
      { truthBoundary },
    );
  }

  const payload = {
    format: attestation.format,
    version: attestation.version,
    status: attestation.status,
    verified: attestation.verified,
    providerBridgeRegistryRoot: attestation.providerBridgeRegistryRoot,
    providerBridgeSpecCount: attestation.providerBridgeSpecCount,
    entries: attestation.entries,
    truthBoundary: attestation.truthBoundary,
  };
  const expectedRoot = sha256Canonical(payload);
  if (attestation.attestationRoot !== expectedRoot) {
    fail(
      'RCL_FOUNDATION_BRIDGE_STATEPATH_ROOT_DRIFT',
      'StatePath attestation root does not match its canonical payload',
      { observed: attestation.attestationRoot ?? null, expected: expectedRoot },
    );
  }

  return Object.freeze({
    ok: true,
    status: 'RCL_FOUNDATION_NATIVE_BRIDGE_STATEPATH_ATTESTATION_VERIFIED',
    attestationRoot: expectedRoot,
    providerBridgeRegistryRoot: registrySnapshot.registryRoot,
    providerBridgeSpecCount: bridgeSpecs.length,
    domains: Object.freeze(bridgeSpecs.map(spec => spec.domain)),
  });
}

export function createFoundationNativeBridgeStatePathAttestation({
  entries,
  bridgeSpecs = FOUNDATION_NATIVE_BRIDGE_SPECS,
  registrySnapshot = foundationNativeBridgeCapabilityRegistrySnapshot(),
} = {}) {
  const payload = {
    format: FOUNDATION_NATIVE_BRIDGE_STATEPATH_ATTESTATION_FORMAT,
    version: FOUNDATION_NATIVE_BRIDGE_STATEPATH_ATTESTATION_VERSION,
    status: 'statepath-semantics-verified',
    verified: true,
    providerBridgeRegistryRoot: registrySnapshot?.registryRoot ?? null,
    providerBridgeSpecCount: bridgeSpecs.length,
    entries: Array.isArray(entries) ? entries.map(entry => ({ ...entry })) : entries,
    truthBoundary: {
      executableStatePathBoundToCanonicalRegistry: true,
      semanticResultPathBoundToFoundationDomainContract: true,
      sourceRootAndReceiptRootBindObservedExecutionEvidence: true,
      replayVerificationRequired: true,
      statePathSemanticAttestationDoesNotImplyDirectNativeExecution: true,
    },
  };
  const attestation = {
    ...payload,
    attestationRoot: sha256Canonical(payload),
  };
  verifyFoundationNativeBridgeStatePathAttestation({ attestation, bridgeSpecs, registrySnapshot });
  return Object.freeze(attestation);
}
