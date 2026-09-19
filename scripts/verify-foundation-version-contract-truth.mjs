#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CONTRACT_PATH = path.join(ROOT, 'VERSION-CONTRACT.json');
const TRUTH_PATH = path.join(ROOT, 'src', 'foundation-capability-registry-truth.json');
const EXPECTED_TRUTH_PATH = 'src/foundation-capability-registry-truth.json';
const EXPECTED_DIRECT_REGISTRY = 'src/foundation-direct-capability-registry.mjs';
const EXPECTED_BRIDGE_REGISTRY = 'src/foundation-native-bridge-capability-registry.mjs';
const EXPECTED_ADVANCED_RUNTIME =
  'JavaScript Reference Runtime plus implementation-bound direct lowering for 7 declared Foundation domains and 5 Native Provider bridge batches covering 16 bridge domains';

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

function validate(contract, truth) {
  const errors = [];
  const fail = (code, message, details = {}) => {
    errors.push({ code, message, ...details });
  };
  const claims = contract?.claims ?? {};
  const capabilityTruth = claims.foundationCapabilityTruth ?? {};
  const direct = claims.foundationDeclaredDirectLowering ?? {};
  const bridge = claims.foundationNativeProviderFederation ?? {};
  const legacyBridge = claims.foundationNativeProviderBridge ?? {};
  const boundary = contract?.boundary ?? {};
  const truthBoundary = truth?.truthBoundary ?? {};
  const directDomains = Array.isArray(truth?.direct?.domains) ? truth.direct.domains : [];
  const bridgeDomains = Array.isArray(truth?.providerBridge?.domains)
    ? truth.providerBridge.domains
    : [];
  const bridgeBatches = Array.isArray(truth?.providerBridge?.batches)
    ? truth.providerBridge.batches
    : [];

  const { truthRoot: committedTruthRoot, ...truthPayload } = truth ?? {};
  const recomputedTruthRoot = sha256Canonical(truthPayload);
  if (committedTruthRoot !== recomputedTruthRoot) {
    fail(
      'RCL_FOUNDATION_CAPABILITY_TRUTH_ROOT_INVALID',
      'Versioned capability truth root does not match its canonical payload.',
      { committedTruthRoot: committedTruthRoot ?? null, recomputedTruthRoot },
    );
  }

  if (capabilityTruth.path !== EXPECTED_TRUTH_PATH) {
    fail(
      'RCL_FOUNDATION_VERSION_CONTRACT_TRUTH_PATH_DRIFT',
      'VERSION-CONTRACT.json points at the wrong capability truth surface.',
      { expected: EXPECTED_TRUTH_PATH, actual: capabilityTruth.path ?? null },
    );
  }
  if (capabilityTruth.format !== truth?.format || capabilityTruth.version !== truth?.version) {
    fail(
      'RCL_FOUNDATION_VERSION_CONTRACT_TRUTH_IDENTITY_DRIFT',
      'VERSION-CONTRACT.json capability truth format/version diverged.',
      {
        expectedFormat: truth?.format ?? null,
        actualFormat: capabilityTruth.format ?? null,
        expectedVersion: truth?.version ?? null,
        actualVersion: capabilityTruth.version ?? null,
      },
    );
  }
  if (capabilityTruth.truthRoot !== committedTruthRoot) {
    fail(
      'RCL_FOUNDATION_VERSION_CONTRACT_TRUTH_ROOT_DRIFT',
      'VERSION-CONTRACT.json capability truth root diverged.',
      {
        expected: committedTruthRoot ?? null,
        actual: capabilityTruth.truthRoot ?? null,
      },
    );
  }

  if (capabilityTruth.directRegistryRoot !== truth?.direct?.registryRoot) {
    fail(
      'RCL_FOUNDATION_VERSION_CONTRACT_DIRECT_ROOT_DRIFT',
      'VERSION-CONTRACT.json direct registry root diverged.',
      {
        expected: truth?.direct?.registryRoot ?? null,
        actual: capabilityTruth.directRegistryRoot ?? null,
      },
    );
  }
  if (capabilityTruth.directImplementationDomainCount !== directDomains.length) {
    fail(
      'RCL_FOUNDATION_VERSION_CONTRACT_DIRECT_COUNT_DRIFT',
      'VERSION-CONTRACT.json direct implementation domain count diverged.',
      {
        expected: directDomains.length,
        actual: capabilityTruth.directImplementationDomainCount ?? null,
      },
    );
  }
  if (direct.status !== 'implementation-bound') {
    fail(
      'RCL_FOUNDATION_VERSION_CONTRACT_DIRECT_STATUS_DRIFT',
      'Direct-lowering contract must remain explicitly implementation-bound.',
      { actual: direct.status ?? null },
    );
  }
  if (direct.registry !== EXPECTED_DIRECT_REGISTRY) {
    fail(
      'RCL_FOUNDATION_VERSION_CONTRACT_DIRECT_REGISTRY_PATH_DRIFT',
      'Direct-lowering contract points at the wrong executable registry.',
      { expected: EXPECTED_DIRECT_REGISTRY, actual: direct.registry ?? null },
    );
  }
  if (direct.registryRoot !== truth?.direct?.registryRoot) {
    fail(
      'RCL_FOUNDATION_VERSION_CONTRACT_DIRECT_CLAIM_ROOT_DRIFT',
      'Direct-lowering claim root diverged from capability truth.',
      {
        expected: truth?.direct?.registryRoot ?? null,
        actual: direct.registryRoot ?? null,
      },
    );
  }
  if (direct.domainCount !== directDomains.length) {
    fail(
      'RCL_FOUNDATION_VERSION_CONTRACT_DIRECT_CLAIM_COUNT_DRIFT',
      'Direct-lowering claim domain count diverged from capability truth.',
      { expected: directDomains.length, actual: direct.domainCount ?? null },
    );
  }
  if (direct.deploymentEvidenceClaimed !== false) {
    fail(
      'RCL_FOUNDATION_VERSION_CONTRACT_DIRECT_DEPLOYMENT_OVERCLAIM',
      'Static VERSION-CONTRACT must not turn implementation capability into complete deployment evidence.',
      { actual: direct.deploymentEvidenceClaimed ?? null },
    );
  }
  if (direct.allFoundationDomainsDirectNativeClaimed !== false) {
    fail(
      'RCL_FOUNDATION_VERSION_CONTRACT_DIRECT_ALL_DOMAIN_OVERCLAIM',
      'Static VERSION-CONTRACT must not claim every Foundation domain is direct native.',
      { actual: direct.allFoundationDomainsDirectNativeClaimed ?? null },
    );
  }

  if (capabilityTruth.providerBridgeRegistryRoot !== truth?.providerBridge?.registryRoot) {
    fail(
      'RCL_FOUNDATION_VERSION_CONTRACT_BRIDGE_ROOT_DRIFT',
      'VERSION-CONTRACT.json Provider bridge registry root diverged.',
      {
        expected: truth?.providerBridge?.registryRoot ?? null,
        actual: capabilityTruth.providerBridgeRegistryRoot ?? null,
      },
    );
  }
  if (capabilityTruth.providerBridgeDomainCount !== bridgeDomains.length) {
    fail(
      'RCL_FOUNDATION_VERSION_CONTRACT_BRIDGE_COUNT_DRIFT',
      'VERSION-CONTRACT.json Provider bridge domain count diverged.',
      {
        expected: bridgeDomains.length,
        actual: capabilityTruth.providerBridgeDomainCount ?? null,
      },
    );
  }
  if (capabilityTruth.providerBatchCount !== bridgeBatches.length) {
    fail(
      'RCL_FOUNDATION_VERSION_CONTRACT_BRIDGE_BATCH_COUNT_DRIFT',
      'VERSION-CONTRACT.json Provider bridge batch count diverged.',
      {
        expected: bridgeBatches.length,
        actual: capabilityTruth.providerBatchCount ?? null,
      },
    );
  }
  if (bridge.status !== 'implementation-bound') {
    fail(
      'RCL_FOUNDATION_VERSION_CONTRACT_BRIDGE_STATUS_DRIFT',
      'Provider federation contract must remain explicitly implementation-bound.',
      { actual: bridge.status ?? null },
    );
  }
  if (bridge.registry !== EXPECTED_BRIDGE_REGISTRY) {
    fail(
      'RCL_FOUNDATION_VERSION_CONTRACT_BRIDGE_REGISTRY_PATH_DRIFT',
      'Provider federation contract points at the wrong executable registry.',
      { expected: EXPECTED_BRIDGE_REGISTRY, actual: bridge.registry ?? null },
    );
  }
  if (bridge.registryRoot !== truth?.providerBridge?.registryRoot) {
    fail(
      'RCL_FOUNDATION_VERSION_CONTRACT_BRIDGE_CLAIM_ROOT_DRIFT',
      'Provider federation claim root diverged from capability truth.',
      {
        expected: truth?.providerBridge?.registryRoot ?? null,
        actual: bridge.registryRoot ?? null,
      },
    );
  }
  if (bridge.domainCount !== bridgeDomains.length || bridge.batchCount !== bridgeBatches.length) {
    fail(
      'RCL_FOUNDATION_VERSION_CONTRACT_BRIDGE_TOPOLOGY_DRIFT',
      'Provider federation domain/batch counts diverged from capability truth.',
      {
        expectedDomains: bridgeDomains.length,
        actualDomains: bridge.domainCount ?? null,
        expectedBatches: bridgeBatches.length,
        actualBatches: bridge.batchCount ?? null,
      },
    );
  }
  if (bridge.directNativeExecutionClaimed !== false) {
    fail(
      'RCL_FOUNDATION_VERSION_CONTRACT_BRIDGE_DIRECT_OVERCLAIM',
      'Provider bridge capability must not be relabeled as direct-native execution.',
      { actual: bridge.directNativeExecutionClaimed ?? null },
    );
  }

  if (legacyBridge.scope !== 'legacy-batch-a-and-meta-batch-b-summary') {
    fail(
      'RCL_FOUNDATION_VERSION_CONTRACT_LEGACY_SCOPE_DRIFT',
      'Legacy Batch A / Meta Batch B summary must be explicitly scoped as non-federation-complete.',
      { actual: legacyBridge.scope ?? null },
    );
  }
  const batchA = bridgeBatches.find(batch => batch.batchId === 'batch-a');
  const metaB = bridgeBatches.find(batch => batch.batchId === 'meta-batch-b');
  if (
    legacyBridge.providerId !== batchA?.providerId
    || JSON.stringify(legacyBridge.domains ?? []) !== JSON.stringify(batchA?.domains ?? [])
    || legacyBridge.metaBatchB?.providerId !== metaB?.providerId
    || JSON.stringify(legacyBridge.metaBatchB?.domains ?? []) !== JSON.stringify(metaB?.domains ?? [])
  ) {
    fail(
      'RCL_FOUNDATION_VERSION_CONTRACT_LEGACY_SUMMARY_DRIFT',
      'Legacy Batch A / Meta Batch B compatibility summary diverged from canonical capability truth.',
      {
        batchAProvider: batchA?.providerId ?? null,
        metaBProvider: metaB?.providerId ?? null,
      },
    );
  }

  if (claims.advancedDomainRuntime !== EXPECTED_ADVANCED_RUNTIME) {
    fail(
      'RCL_FOUNDATION_VERSION_CONTRACT_RUNTIME_DESCRIPTION_DRIFT',
      'Advanced runtime description no longer reflects the current direct/bridge topology.',
      { expected: EXPECTED_ADVANCED_RUNTIME, actual: claims.advancedDomainRuntime ?? null },
    );
  }

  if (boundary.declaredFoundationSyntaxNative !== false) {
    fail(
      'RCL_FOUNDATION_VERSION_CONTRACT_GLOBAL_NATIVE_OVERCLAIM',
      'Global declared-Foundation-native boundary must stay false until all domains are separately proved.',
      { actual: boundary.declaredFoundationSyntaxNative ?? null },
    );
  }
  if (boundary.declaredFoundationDirectLoweringImplemented !== true) {
    fail(
      'RCL_FOUNDATION_VERSION_CONTRACT_DIRECT_IMPLEMENTATION_UNDERCLAIM',
      'VERSION-CONTRACT must acknowledge the implementation-bound direct-lowering subset.',
      { actual: boundary.declaredFoundationDirectLoweringImplemented ?? null },
    );
  }
  if (
    boundary.allFoundationDomainsDirectNativeClaimed
    !== truthBoundary.allFoundationDomainsDirectNativeClaimed
  ) {
    fail(
      'RCL_FOUNDATION_VERSION_CONTRACT_ALL_DOMAIN_BOUNDARY_DRIFT',
      'VERSION-CONTRACT all-domain direct-native boundary diverged from capability truth.',
      {
        expected: truthBoundary.allFoundationDomainsDirectNativeClaimed ?? null,
        actual: boundary.allFoundationDomainsDirectNativeClaimed ?? null,
      },
    );
  }
  if (boundary.providerBridgeRemovedGlobally !== false) {
    fail(
      'RCL_FOUNDATION_VERSION_CONTRACT_BRIDGE_REMOVAL_OVERCLAIM',
      'VERSION-CONTRACT must preserve that Provider bridges remain part of the runtime.',
      { actual: boundary.providerBridgeRemovedGlobally ?? null },
    );
  }

  const verifierCommand = 'node scripts/verify-foundation-version-contract-truth.mjs';
  if (!(contract?.verificationCommands ?? []).includes(verifierCommand)) {
    fail(
      'RCL_FOUNDATION_VERSION_CONTRACT_VERIFIER_COMMAND_MISSING',
      'VERSION-CONTRACT verificationCommands must include the Foundation capability truth verifier.',
      { expected: verifierCommand },
    );
  }
  const verifierPath = 'scripts/verify-foundation-version-contract-truth.mjs';
  if (!(contract?.evidence?.scripts ?? []).includes(verifierPath)) {
    fail(
      'RCL_FOUNDATION_VERSION_CONTRACT_VERIFIER_EVIDENCE_MISSING',
      'VERSION-CONTRACT evidence scripts must include its Foundation capability truth verifier.',
      { expected: verifierPath },
    );
  }

  return errors;
}

const contract = JSON.parse(fs.readFileSync(CONTRACT_PATH, 'utf8'));
const truth = JSON.parse(fs.readFileSync(TRUTH_PATH, 'utf8'));
const errors = validate(contract, truth);

const negativeControls = [];
for (const mutation of [
  {
    id: 'truth-root-mutation',
    apply(value) {
      value.claims.foundationCapabilityTruth.truthRoot = '0'.repeat(64);
    },
  },
  {
    id: 'direct-domain-count-mutation',
    apply(value) {
      value.claims.foundationDeclaredDirectLowering.domainCount += 1;
    },
  },
  {
    id: 'provider-batch-count-mutation',
    apply(value) {
      value.claims.foundationNativeProviderFederation.batchCount += 1;
    },
  },
  {
    id: 'all-domain-native-overclaim-mutation',
    apply(value) {
      value.boundary.allFoundationDomainsDirectNativeClaimed = true;
    },
  },
]) {
  const mutated = clone(contract);
  mutation.apply(mutated);
  const mutationErrors = validate(mutated, truth);
  const detected = mutationErrors.length > 0;
  negativeControls.push({
    id: mutation.id,
    detected,
    errorCodes: mutationErrors.map(item => item.code),
  });
  if (!detected) {
    errors.push({
      code: 'RCL_FOUNDATION_VERSION_CONTRACT_NEGATIVE_CONTROL_FAILED',
      message: `Negative control ${mutation.id} was not detected.`,
    });
  }
}

const report = {
  ok: errors.length === 0,
  status: errors.length === 0
    ? 'RCL_FOUNDATION_VERSION_CONTRACT_TRUTH_VERIFIED'
    : 'RCL_FOUNDATION_VERSION_CONTRACT_TRUTH_FAILED',
  contractPath: CONTRACT_PATH,
  truthPath: TRUTH_PATH,
  capabilityTruthRoot: truth.truthRoot ?? null,
  directRegistryRoot: truth?.direct?.registryRoot ?? null,
  directImplementationDomainCount: truth?.direct?.domains?.length ?? 0,
  providerBridgeRegistryRoot: truth?.providerBridge?.registryRoot ?? null,
  providerBridgeDomainCount: truth?.providerBridge?.domains?.length ?? 0,
  providerBatchCount: truth?.providerBridge?.batches?.length ?? 0,
  negativeControls,
  errors,
};

console.log(JSON.stringify(report, null, 2));
if (errors.length > 0) process.exitCode = 1;
