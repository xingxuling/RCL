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
const EXPECTED_ADVANCED_RUNTIME = 'JavaScript Reference Runtime plus implementation-bound direct lowering for 8 declared Foundation domains and 5 Native Provider bridge batches covering 16 bridge domains';

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalize(value[key])]));
  return value;
}
function sha256Canonical(value) { return crypto.createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex'); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }

function validate(contract, truth) {
  const errors = [];
  const fail = (code, message, details = {}) => errors.push({ code, message, ...details });
  const claims = contract?.claims ?? {};
  const capabilityTruth = claims.foundationCapabilityTruth ?? {};
  const direct = claims.foundationDeclaredDirectLowering ?? {};
  const bridge = claims.foundationNativeProviderFederation ?? {};
  const legacyBridge = claims.foundationNativeProviderBridge ?? {};
  const boundary = contract?.boundary ?? {};
  const truthBoundary = truth?.truthBoundary ?? {};
  const directDomains = Array.isArray(truth?.direct?.domains) ? truth.direct.domains : [];
  const bridgeDomains = Array.isArray(truth?.providerBridge?.domains) ? truth.providerBridge.domains : [];
  const bridgeBatches = Array.isArray(truth?.providerBridge?.batches) ? truth.providerBridge.batches : [];
  const { truthRoot: committedTruthRoot, ...truthPayload } = truth ?? {};
  const recomputedTruthRoot = sha256Canonical(truthPayload);

  if (committedTruthRoot !== recomputedTruthRoot) fail('RCL_FOUNDATION_CAPABILITY_TRUTH_ROOT_INVALID', 'Versioned capability truth root does not match its canonical payload.', { committedTruthRoot, recomputedTruthRoot });
  if (capabilityTruth.path !== EXPECTED_TRUTH_PATH) fail('RCL_FOUNDATION_VERSION_CONTRACT_TRUTH_PATH_DRIFT', 'VERSION-CONTRACT.json points at the wrong capability truth surface.', { expected: EXPECTED_TRUTH_PATH, actual: capabilityTruth.path ?? null });
  if (capabilityTruth.format !== truth?.format || capabilityTruth.version !== truth?.version) fail('RCL_FOUNDATION_VERSION_CONTRACT_TRUTH_IDENTITY_DRIFT', 'VERSION-CONTRACT.json capability truth format/version diverged.');
  if (capabilityTruth.truthRoot !== committedTruthRoot) fail('RCL_FOUNDATION_VERSION_CONTRACT_TRUTH_ROOT_DRIFT', 'VERSION-CONTRACT.json capability truth root diverged.', { expected: committedTruthRoot, actual: capabilityTruth.truthRoot ?? null });
  if (capabilityTruth.directRegistryRoot !== truth?.direct?.registryRoot || direct.registryRoot !== truth?.direct?.registryRoot) fail('RCL_FOUNDATION_VERSION_CONTRACT_DIRECT_ROOT_DRIFT', 'VERSION-CONTRACT.json direct registry root diverged.', { expected: truth?.direct?.registryRoot ?? null, capabilityTruth: capabilityTruth.directRegistryRoot ?? null, directClaim: direct.registryRoot ?? null });
  if (capabilityTruth.directImplementationDomainCount !== directDomains.length || direct.domainCount !== directDomains.length) fail('RCL_FOUNDATION_VERSION_CONTRACT_DIRECT_COUNT_DRIFT', 'VERSION-CONTRACT.json direct implementation domain count diverged.', { expected: directDomains.length, capabilityTruth: capabilityTruth.directImplementationDomainCount ?? null, directClaim: direct.domainCount ?? null });
  if (direct.status !== 'implementation-bound' || direct.registry !== EXPECTED_DIRECT_REGISTRY) fail('RCL_FOUNDATION_VERSION_CONTRACT_DIRECT_IDENTITY_DRIFT', 'Direct-lowering contract identity drifted.', { direct });
  if (direct.deploymentEvidenceClaimed !== false || direct.allFoundationDomainsDirectNativeClaimed !== false) fail('RCL_FOUNDATION_VERSION_CONTRACT_DIRECT_OVERCLAIM', 'Static VERSION-CONTRACT must keep direct capability implementation-bound without global deployment/all-domain overclaim.', { direct });

  if (capabilityTruth.providerBridgeRegistryRoot !== truth?.providerBridge?.registryRoot || bridge.registryRoot !== truth?.providerBridge?.registryRoot) fail('RCL_FOUNDATION_VERSION_CONTRACT_BRIDGE_ROOT_DRIFT', 'Provider bridge registry root diverged.', { expected: truth?.providerBridge?.registryRoot ?? null });
  if (capabilityTruth.providerBridgeDomainCount !== bridgeDomains.length || bridge.domainCount !== bridgeDomains.length || capabilityTruth.providerBatchCount !== bridgeBatches.length || bridge.batchCount !== bridgeBatches.length) fail('RCL_FOUNDATION_VERSION_CONTRACT_BRIDGE_TOPOLOGY_DRIFT', 'Provider federation domain/batch counts diverged from capability truth.', { expectedDomains: bridgeDomains.length, expectedBatches: bridgeBatches.length });
  if (bridge.status !== 'implementation-bound' || bridge.registry !== EXPECTED_BRIDGE_REGISTRY || bridge.directNativeExecutionClaimed !== false) fail('RCL_FOUNDATION_VERSION_CONTRACT_BRIDGE_IDENTITY_DRIFT', 'Provider federation identity or direct-native boundary drifted.', { bridge });

  const batchA = bridgeBatches.find(batch => batch.batchId === 'batch-a');
  const metaB = bridgeBatches.find(batch => batch.batchId === 'meta-batch-b');
  if (legacyBridge.scope !== 'legacy-batch-a-and-meta-batch-b-summary' || legacyBridge.providerId !== batchA?.providerId || JSON.stringify(legacyBridge.domains ?? []) !== JSON.stringify(batchA?.domains ?? []) || legacyBridge.metaBatchB?.providerId !== metaB?.providerId || JSON.stringify(legacyBridge.metaBatchB?.domains ?? []) !== JSON.stringify(metaB?.domains ?? [])) fail('RCL_FOUNDATION_VERSION_CONTRACT_LEGACY_SUMMARY_DRIFT', 'Legacy Batch A / Meta Batch B compatibility summary diverged from canonical capability truth.');

  if (claims.advancedDomainRuntime !== EXPECTED_ADVANCED_RUNTIME) fail('RCL_FOUNDATION_VERSION_CONTRACT_RUNTIME_DESCRIPTION_DRIFT', 'Advanced runtime description no longer reflects current direct/bridge topology.', { expected: EXPECTED_ADVANCED_RUNTIME, actual: claims.advancedDomainRuntime ?? null });
  if (boundary.declaredFoundationSyntaxNative !== false || boundary.declaredFoundationDirectLoweringImplemented !== true || boundary.providerBridgeRemovedGlobally !== false) fail('RCL_FOUNDATION_VERSION_CONTRACT_GLOBAL_BOUNDARY_DRIFT', 'Global Foundation native/direct/bridge boundary drifted.', { boundary });
  if (boundary.allFoundationDomainsDirectNativeClaimed !== truthBoundary.allFoundationDomainsDirectNativeClaimed) fail('RCL_FOUNDATION_VERSION_CONTRACT_ALL_DOMAIN_BOUNDARY_DRIFT', 'All-domain direct-native boundary diverged from capability truth.', { expected: truthBoundary.allFoundationDomainsDirectNativeClaimed, actual: boundary.allFoundationDomainsDirectNativeClaimed });

  const verifierCommand = 'node scripts/verify-foundation-version-contract-truth.mjs';
  const verifierPath = 'scripts/verify-foundation-version-contract-truth.mjs';
  if (!(contract?.verificationCommands ?? []).includes(verifierCommand)) fail('RCL_FOUNDATION_VERSION_CONTRACT_VERIFIER_COMMAND_MISSING', 'VERSION-CONTRACT verificationCommands must include the Foundation capability truth verifier.', { expected: verifierCommand });
  if (!(contract?.evidence?.scripts ?? []).includes(verifierPath)) fail('RCL_FOUNDATION_VERSION_CONTRACT_VERIFIER_EVIDENCE_MISSING', 'VERSION-CONTRACT evidence scripts must include its Foundation capability truth verifier.', { expected: verifierPath });
  return errors;
}

const contract = JSON.parse(fs.readFileSync(CONTRACT_PATH, 'utf8'));
const truth = JSON.parse(fs.readFileSync(TRUTH_PATH, 'utf8'));
const errors = validate(contract, truth);
const negativeControls = [];
for (const mutation of [
  { id: 'truth-root-mutation', apply(value) { value.claims.foundationCapabilityTruth.truthRoot = '0'.repeat(64); } },
  { id: 'direct-domain-count-mutation', apply(value) { value.claims.foundationDeclaredDirectLowering.domainCount += 1; } },
  { id: 'provider-batch-count-mutation', apply(value) { value.claims.foundationNativeProviderFederation.batchCount += 1; } },
  { id: 'all-domain-native-overclaim-mutation', apply(value) { value.boundary.allFoundationDomainsDirectNativeClaimed = true; } },
]) {
  const mutated = clone(contract);
  mutation.apply(mutated);
  const mutationErrors = validate(mutated, truth);
  const detected = mutationErrors.length > 0;
  negativeControls.push({ id: mutation.id, detected, errorCodes: mutationErrors.map(item => item.code) });
  if (!detected) errors.push({ code: 'RCL_FOUNDATION_VERSION_CONTRACT_NEGATIVE_CONTROL_FAILED', message: `Negative control ${mutation.id} was not detected.` });
}

const report = {
  ok: errors.length === 0,
  status: errors.length === 0 ? 'RCL_FOUNDATION_VERSION_CONTRACT_TRUTH_VERIFIED' : 'RCL_FOUNDATION_VERSION_CONTRACT_TRUTH_FAILED',
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
