import crypto from 'node:crypto';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  FOUNDATION_DIRECT_IMPLEMENTATION_DOMAINS,
  foundationDirectCapabilityRegistrySnapshot,
} from './foundation-direct-capability-registry.mjs';
import {
  FOUNDATION_NATIVE_BRIDGE_BATCHES,
  FOUNDATION_NATIVE_BRIDGE_DOMAINS,
  foundationNativeBridgeCapabilityRegistrySnapshot,
} from './foundation-native-bridge-capability-registry.mjs';

const TRUTH_PATH = fileURLToPath(new URL('./foundation-capability-registry-truth.json', import.meta.url));
const FORMAT = 'taowind.rcl-foundation-capability-registry-truth.v0.1';
const VERSION = '0.1.0';

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value).sort().map(key => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

function sha256Canonical(value) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(canonicalize(value)))
    .digest('hex');
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function readFoundationCapabilityTruthSnapshot() {
  return JSON.parse(fs.readFileSync(TRUTH_PATH, 'utf8'));
}

export function foundationCapabilityTruthSurface({ truthOverride = null } = {}) {
  const errors = [];
  const truth = truthOverride ? clone(truthOverride) : readFoundationCapabilityTruthSnapshot();
  const direct = foundationDirectCapabilityRegistrySnapshot();
  const providerBridge = foundationNativeBridgeCapabilityRegistrySnapshot();
  const fail = (code, message, details = {}) => {
    errors.push({ code, message, ...details });
  };

  if (truth?.format !== FORMAT || truth?.version !== VERSION) {
    fail(
      'RCL_CAPABILITY_TRUTH_SURFACE_IDENTITY_DRIFT',
      'Versioned capability truth format/version diverged.',
      {
        expectedFormat: FORMAT,
        actualFormat: truth?.format ?? null,
        expectedVersion: VERSION,
        actualVersion: truth?.version ?? null,
      },
    );
  }

  const { truthRoot: committedTruthRoot, ...truthPayload } = truth ?? {};
  const recomputedTruthRoot = sha256Canonical(truthPayload);
  if (committedTruthRoot !== recomputedTruthRoot) {
    fail(
      'RCL_CAPABILITY_TRUTH_SURFACE_ROOT_DRIFT',
      'Versioned capability truth root does not match its canonical payload.',
      {
        committedTruthRoot: committedTruthRoot ?? null,
        recomputedTruthRoot,
      },
    );
  }

  if (truth?.direct?.registryRoot !== direct.registryRoot) {
    fail(
      'RCL_CAPABILITY_TRUTH_SURFACE_DIRECT_ROOT_DRIFT',
      'Versioned direct capability root diverged from the executable registry.',
      {
        committedRoot: truth?.direct?.registryRoot ?? null,
        executableRoot: direct.registryRoot,
      },
    );
  }
  if (
    JSON.stringify(truth?.direct?.domains)
    !== JSON.stringify(FOUNDATION_DIRECT_IMPLEMENTATION_DOMAINS)
  ) {
    fail(
      'RCL_CAPABILITY_TRUTH_SURFACE_DIRECT_DOMAINS_DRIFT',
      'Versioned direct capability domains diverged from the executable registry.',
      {
        committedDomains: truth?.direct?.domains ?? null,
        executableDomains: FOUNDATION_DIRECT_IMPLEMENTATION_DOMAINS,
      },
    );
  }

  if (truth?.providerBridge?.registryRoot !== providerBridge.registryRoot) {
    fail(
      'RCL_CAPABILITY_TRUTH_SURFACE_BRIDGE_ROOT_DRIFT',
      'Versioned Provider bridge capability root diverged from the executable registry.',
      {
        committedRoot: truth?.providerBridge?.registryRoot ?? null,
        executableRoot: providerBridge.registryRoot,
      },
    );
  }
  if (
    JSON.stringify(truth?.providerBridge?.domains)
    !== JSON.stringify(FOUNDATION_NATIVE_BRIDGE_DOMAINS)
  ) {
    fail(
      'RCL_CAPABILITY_TRUTH_SURFACE_BRIDGE_DOMAINS_DRIFT',
      'Versioned Provider bridge domains diverged from the executable registry.',
      {
        committedDomains: truth?.providerBridge?.domains ?? null,
        executableDomains: FOUNDATION_NATIVE_BRIDGE_DOMAINS,
      },
    );
  }

  const executableBatches = FOUNDATION_NATIVE_BRIDGE_BATCHES.map(batch => ({
    batchId: batch.batchId,
    providerId: batch.providerId,
    providerCallCount: batch.providerCallCount,
    domains: [...batch.domains],
  }));
  if (JSON.stringify(truth?.providerBridge?.batches) !== JSON.stringify(executableBatches)) {
    fail(
      'RCL_CAPABILITY_TRUTH_SURFACE_BRIDGE_BATCHES_DRIFT',
      'Versioned Provider bridge batch topology diverged from the executable registry.',
      {
        committedBatches: truth?.providerBridge?.batches ?? null,
        executableBatches,
      },
    );
  }

  const expectedBoundary = {
    directImplementationDoesNotImplyDeploymentVerification: true,
    providerBridgeDoesNotImplyDirectNativeExecution: true,
    registriesMayShareDomains: true,
    allFoundationDomainsDirectNativeClaimed: false,
  };
  if (JSON.stringify(truth?.truthBoundary) !== JSON.stringify(expectedBoundary)) {
    fail(
      'RCL_CAPABILITY_TRUTH_SURFACE_BOUNDARY_DRIFT',
      'Capability truth boundary drifted or overclaimed execution guarantees.',
      {
        committedBoundary: truth?.truthBoundary ?? null,
        expectedBoundary,
      },
    );
  }

  return {
    ok: errors.length === 0,
    status: errors.length === 0
      ? 'RCL_FOUNDATION_CAPABILITY_TRUTH_SURFACE_VERIFIED'
      : 'RCL_FOUNDATION_CAPABILITY_TRUTH_SURFACE_DRIFT',
    format: truth?.format ?? null,
    version: truth?.version ?? null,
    truthRoot: committedTruthRoot ?? null,
    recomputedTruthRoot,
    direct: {
      registryRoot: direct.registryRoot,
      domains: [...FOUNDATION_DIRECT_IMPLEMENTATION_DOMAINS],
      domainCount: FOUNDATION_DIRECT_IMPLEMENTATION_DOMAINS.length,
      capabilityCount: direct.capabilities.length,
    },
    providerBridge: {
      registryRoot: providerBridge.registryRoot,
      domains: [...FOUNDATION_NATIVE_BRIDGE_DOMAINS],
      domainCount: FOUNDATION_NATIVE_BRIDGE_DOMAINS.length,
      batchCount: FOUNDATION_NATIVE_BRIDGE_BATCHES.length,
      batches: executableBatches,
    },
    truthBoundary: expectedBoundary,
    errors,
  };
}
