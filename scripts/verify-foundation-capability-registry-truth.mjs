#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FOUNDATION_DIRECT_IMPLEMENTATION_DOMAINS,
  foundationDirectCapabilityRegistrySnapshot,
} from '../src/foundation-direct-capability-registry.mjs';
import {
  FOUNDATION_NATIVE_BRIDGE_BATCHES,
  FOUNDATION_NATIVE_BRIDGE_DOMAINS,
  foundationNativeBridgeCapabilityRegistrySnapshot,
} from '../src/foundation-native-bridge-capability-registry.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const TRUTH_PATH = path.join(ROOT, 'src', 'foundation-capability-registry-truth.json');
const FORMAT = 'taowind.rcl-foundation-capability-registry-truth.v0.1';
const VERSION = '0.1.0';

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

function fail(message, details = {}) {
  const error = new Error(message);
  error.code = 'RCL_FOUNDATION_CAPABILITY_REGISTRY_TRUTH_DRIFT';
  error.details = details;
  throw error;
}

const truth = JSON.parse(fs.readFileSync(TRUTH_PATH, 'utf8'));
const direct = foundationDirectCapabilityRegistrySnapshot();
const bridge = foundationNativeBridgeCapabilityRegistrySnapshot();

if (truth?.format !== FORMAT || truth?.version !== VERSION) {
  fail('Capability registry truth surface format/version drifted', {
    observedFormat: truth?.format ?? null,
    observedVersion: truth?.version ?? null,
    expectedFormat: FORMAT,
    expectedVersion: VERSION,
  });
}

if (truth?.direct?.registryRoot !== direct.registryRoot) {
  fail('Versioned direct capability registry root drifted from executable registry', {
    committedRoot: truth?.direct?.registryRoot ?? null,
    executableRoot: direct.registryRoot,
  });
}

if (JSON.stringify(truth?.direct?.domains) !== JSON.stringify(FOUNDATION_DIRECT_IMPLEMENTATION_DOMAINS)) {
  fail('Versioned direct capability domains drifted from executable registry', {
    committedDomains: truth?.direct?.domains ?? null,
    executableDomains: FOUNDATION_DIRECT_IMPLEMENTATION_DOMAINS,
  });
}

if (truth?.providerBridge?.registryRoot !== bridge.registryRoot) {
  fail('Versioned Provider bridge registry root drifted from executable registry', {
    committedRoot: truth?.providerBridge?.registryRoot ?? null,
    executableRoot: bridge.registryRoot,
  });
}

if (JSON.stringify(truth?.providerBridge?.domains) !== JSON.stringify(FOUNDATION_NATIVE_BRIDGE_DOMAINS)) {
  fail('Versioned Provider bridge domains drifted from executable registry', {
    committedDomains: truth?.providerBridge?.domains ?? null,
    executableDomains: FOUNDATION_NATIVE_BRIDGE_DOMAINS,
  });
}

const executableBatches = FOUNDATION_NATIVE_BRIDGE_BATCHES.map(batch => ({
  batchId: batch.batchId,
  providerId: batch.providerId,
  providerCallCount: batch.providerCallCount,
  domains: [...batch.domains],
}));
if (JSON.stringify(truth?.providerBridge?.batches) !== JSON.stringify(executableBatches)) {
  fail('Versioned Provider bridge batch topology drifted from executable registry', {
    committedBatches: truth?.providerBridge?.batches ?? null,
    executableBatches,
  });
}

const expectedBoundary = {
  directImplementationDoesNotImplyDeploymentVerification: true,
  providerBridgeDoesNotImplyDirectNativeExecution: true,
  registriesMayShareDomains: true,
  allFoundationDomainsDirectNativeClaimed: false,
};
if (JSON.stringify(truth?.truthBoundary) !== JSON.stringify(expectedBoundary)) {
  fail('Capability registry truth boundary drifted or overclaimed execution guarantees', {
    observed: truth?.truthBoundary ?? null,
    expected: expectedBoundary,
  });
}

const { truthRoot, ...truthPayload } = truth;
const expectedTruthRoot = sha256Canonical(truthPayload);
if (truthRoot !== expectedTruthRoot) {
  fail('Capability registry truth root does not match canonical payload', {
    committedTruthRoot: truthRoot ?? null,
    expectedTruthRoot,
  });
}

console.log(JSON.stringify({
  ok: true,
  status: 'RCL_FOUNDATION_CAPABILITY_REGISTRY_TRUTH_VERIFIED',
  truthPath: TRUTH_PATH,
  truthRoot,
  directRegistryRoot: direct.registryRoot,
  providerBridgeRegistryRoot: bridge.registryRoot,
  directDomainCount: FOUNDATION_DIRECT_IMPLEMENTATION_DOMAINS.length,
  providerBridgeDomainCount: FOUNDATION_NATIVE_BRIDGE_DOMAINS.length,
  providerBatchCount: FOUNDATION_NATIVE_BRIDGE_BATCHES.length,
}, null, 2));
