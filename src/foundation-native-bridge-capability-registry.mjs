import crypto from 'node:crypto';
import {
  FOUNDATION_NATIVE_BATCH_A,
  FOUNDATION_NATIVE_PROVIDER_ID,
} from './foundation-native-bridge.mjs';
import {
  FOUNDATION_NATIVE_META_BATCH_B,
  FOUNDATION_NATIVE_META_PROVIDER_ID,
} from './foundation-native-meta-bridge.mjs';
import {
  FOUNDATION_NATIVE_BATCH_C,
  FOUNDATION_NATIVE_BATCH_C_PROVIDER_ID,
} from './foundation-native-batch-c.mjs';
import {
  FOUNDATION_NATIVE_BATCH_D,
  FOUNDATION_NATIVE_BATCH_D_PROVIDER_ID,
} from './foundation-native-batch-d.mjs';
import {
  FOUNDATION_NATIVE_BATCH_E,
  FOUNDATION_NATIVE_BATCH_E_PROVIDER_ID,
} from './foundation-native-batch-e.mjs';

export const FOUNDATION_NATIVE_BRIDGE_CAPABILITY_REGISTRY_FORMAT =
  'taowind.rcl-foundation-native-bridge-capability-registry.v0.1';
export const FOUNDATION_NATIVE_BRIDGE_CAPABILITY_REGISTRY_VERSION = '0.1.0';

const RAW_BATCHES = [
  { batchId: 'batch-a', providerId: FOUNDATION_NATIVE_PROVIDER_ID, entries: FOUNDATION_NATIVE_BATCH_A },
  { batchId: 'meta-batch-b', providerId: FOUNDATION_NATIVE_META_PROVIDER_ID, entries: FOUNDATION_NATIVE_META_BATCH_B },
  { batchId: 'batch-c', providerId: FOUNDATION_NATIVE_BATCH_C_PROVIDER_ID, entries: FOUNDATION_NATIVE_BATCH_C },
  { batchId: 'batch-d', providerId: FOUNDATION_NATIVE_BATCH_D_PROVIDER_ID, entries: FOUNDATION_NATIVE_BATCH_D },
  { batchId: 'batch-e', providerId: FOUNDATION_NATIVE_BATCH_E_PROVIDER_ID, entries: FOUNDATION_NATIVE_BATCH_E },
];

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

export const FOUNDATION_NATIVE_BRIDGE_BATCHES = Object.freeze(
  RAW_BATCHES.map(batch => Object.freeze({
    batchId: batch.batchId,
    providerId: batch.providerId,
    providerCallCount: batch.entries.length,
    domains: Object.freeze(batch.entries.map(entry => entry.domain)),
  })),
);

export const FOUNDATION_NATIVE_BRIDGE_SPECS = Object.freeze(
  RAW_BATCHES.flatMap(batch => batch.entries.map(entry => Object.freeze({
    batchId: batch.batchId,
    providerId: batch.providerId,
    providerCallCount: batch.entries.length,
    domain: entry.domain,
    capability: entry.capability,
    statePath: entry.statePath,
  }))),
);

export const FOUNDATION_NATIVE_BRIDGE_DOMAINS = Object.freeze(
  FOUNDATION_NATIVE_BRIDGE_SPECS.map(spec => spec.domain),
);

export function foundationNativeBridgeCapability(domain) {
  return FOUNDATION_NATIVE_BRIDGE_SPECS.find(spec => spec.domain === domain) ?? null;
}

export function foundationNativeBridgeBatch(batchId) {
  return FOUNDATION_NATIVE_BRIDGE_BATCHES.find(batch => batch.batchId === batchId) ?? null;
}

export function foundationNativeBridgeCapabilityRegistrySnapshot() {
  const payload = {
    format: FOUNDATION_NATIVE_BRIDGE_CAPABILITY_REGISTRY_FORMAT,
    version: FOUNDATION_NATIVE_BRIDGE_CAPABILITY_REGISTRY_VERSION,
    batches: FOUNDATION_NATIVE_BRIDGE_BATCHES.map(batch => ({
      batchId: batch.batchId,
      providerId: batch.providerId,
      providerCallCount: batch.providerCallCount,
      domains: [...batch.domains],
    })),
    capabilities: FOUNDATION_NATIVE_BRIDGE_SPECS.map(spec => ({ ...spec })),
  };
  return {
    ...payload,
    registryRoot: sha256Canonical(payload),
  };
}

export const FOUNDATION_NATIVE_BRIDGE_CAPABILITY_REGISTRY_ROOT =
  foundationNativeBridgeCapabilityRegistrySnapshot().registryRoot;
