import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const FOUNDATION_RUNTIME_TRUTH_CONTRACT_FORMAT = 'taowind.rcl-foundation-runtime-truth-contract.v0.1';
export const FOUNDATION_RUNTIME_TRUTH_CONTRACT_VERSION = '0.1.0';
export const FOUNDATION_RUNTIME_TRUTH_CONTRACT_ROOT_ALGORITHM = 'rcl.foundation-runtime-truth-contract.sha256.v0.1';

const SOURCE_BINDING_PATHS = Object.freeze([
  'api/health.mjs',
  'api/runtime-health.mjs',
  'api/capability-truth.mjs',
  'api/bridge-statepath-truth.mjs',
  'src/foundation-capability-registry-truth.json',
  'src/foundation-direct-capability-registry.mjs',
  'src/foundation-native-bridge-capability-registry.mjs',
  'src/foundation-runtime-truth-contract.mjs',
]);

const RUNTIME_TRUTH_SURFACES = Object.freeze([
  { id: 'runtime-health', logicalPath: '/health', source: 'api/runtime-health.mjs' },
  { id: 'capability-truth', logicalPath: '/capability-truth', source: 'api/capability-truth.mjs' },
  { id: 'bridge-statepath-truth', logicalPath: '/bridge-statepath-truth', source: 'api/bridge-statepath-truth.mjs' },
  { id: 'native-deployment-health', logicalPath: 'internal:native-deployment-health', source: 'api/health.mjs' },
]);

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  }
  return value;
}

function sha256Bytes(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function sha256Canonical(value) {
  return sha256Bytes(JSON.stringify(canonical(value)));
}

function isSha256(value) {
  return typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value);
}

function readJson(rootDir, relativePath) {
  return JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), 'utf8'));
}

function sourceBindings(rootDir) {
  return SOURCE_BINDING_PATHS.map(relativePath => ({
    path: relativePath,
    sha256: sha256Bytes(fs.readFileSync(path.join(rootDir, relativePath))),
  }));
}

function truthBoundary() {
  return {
    packagedRuntimeTruthSourcesBound: true,
    deploymentMustReverifyRuntimeTruth: true,
    deploymentEvidenceClaimed: false,
    runtimeSurfaceAvailabilityClaimed: false,
    providerBridgeRemovedGlobally: false,
    allFoundationDomainsDirectNativeClaimed: false,
    completeRuntimeClaimed: false,
    fullSelfHostingClaimed: false,
  };
}

export function foundationRuntimeTruthContractRoot(contract) {
  if (!contract || typeof contract !== 'object' || Array.isArray(contract)) {
    throw new TypeError('Foundation runtime truth contract object is required');
  }
  const { contractRoot: _contractRoot, ...payload } = contract;
  return sha256Canonical(payload);
}

export function createFoundationRuntimeTruthContract(rootDir) {
  const root = path.resolve(rootDir);
  const capabilityTruth = readJson(root, 'src/foundation-capability-registry-truth.json');
  const payload = {
    format: FOUNDATION_RUNTIME_TRUTH_CONTRACT_FORMAT,
    version: FOUNDATION_RUNTIME_TRUTH_CONTRACT_VERSION,
    rootAlgorithm: FOUNDATION_RUNTIME_TRUTH_CONTRACT_ROOT_ALGORITHM,
    capabilityTruth: {
      snapshot: 'src/foundation-capability-registry-truth.json',
      truthRoot: capabilityTruth.truthRoot,
      directRegistryRoot: capabilityTruth?.direct?.registryRoot ?? null,
      directDomains: [...(capabilityTruth?.direct?.domains ?? [])],
      providerBridgeRegistryRoot: capabilityTruth?.providerBridge?.registryRoot ?? null,
      providerBridgeDomains: [...(capabilityTruth?.providerBridge?.domains ?? [])],
      providerBatchCount: capabilityTruth?.providerBridge?.batches?.length ?? 0,
    },
    surfaces: RUNTIME_TRUTH_SURFACES.map(item => ({ ...item })),
    sourceBindings: sourceBindings(root),
    truthBoundary: truthBoundary(),
  };
  return { ...payload, contractRoot: sha256Canonical(payload) };
}

export function verifyFoundationRuntimeTruthContract(contract, { rootDir } = {}) {
  const errors = [];
  if (!rootDir) errors.push('rootDir is required');
  if (!contract || typeof contract !== 'object' || Array.isArray(contract)) {
    return { ok: false, errors: ['contract object is required'] };
  }
  const root = rootDir ? path.resolve(rootDir) : null;
  if (contract.format !== FOUNDATION_RUNTIME_TRUTH_CONTRACT_FORMAT) errors.push('contract format drifted');
  if (contract.version !== FOUNDATION_RUNTIME_TRUTH_CONTRACT_VERSION) errors.push('contract version drifted');
  if (contract.rootAlgorithm !== FOUNDATION_RUNTIME_TRUTH_CONTRACT_ROOT_ALGORITHM) errors.push('contract root algorithm drifted');
  if (!isSha256(contract.contractRoot) || contract.contractRoot !== foundationRuntimeTruthContractRoot(contract)) {
    errors.push('contract root does not match canonical payload');
  }

  if (root) {
    let expected = null;
    try {
      expected = createFoundationRuntimeTruthContract(root);
    } catch (error) {
      errors.push(`unable to materialize expected runtime truth contract: ${error?.message ?? String(error)}`);
    }
    if (expected) {
      if (JSON.stringify(canonical(contract.capabilityTruth)) !== JSON.stringify(canonical(expected.capabilityTruth))) {
        errors.push('capability truth binding drifted');
      }
      if (JSON.stringify(canonical(contract.surfaces)) !== JSON.stringify(canonical(expected.surfaces))) {
        errors.push('runtime truth surface contract drifted');
      }
      if (JSON.stringify(canonical(contract.sourceBindings)) !== JSON.stringify(canonical(expected.sourceBindings))) {
        errors.push('runtime truth source hash binding drifted');
      }
      if (contract.contractRoot !== expected.contractRoot) errors.push('contract root diverged from exact source tree');
    }
  }

  const boundary = contract.truthBoundary ?? {};
  if (boundary.packagedRuntimeTruthSourcesBound !== true) errors.push('packaged runtime truth source binding is not asserted');
  if (boundary.deploymentMustReverifyRuntimeTruth !== true) errors.push('deployment re-verification boundary is missing');
  if (boundary.deploymentEvidenceClaimed !== false) errors.push('developer release must not fabricate deployment evidence');
  if (boundary.runtimeSurfaceAvailabilityClaimed !== false) errors.push('developer release must not claim hosted endpoint availability');
  if (boundary.providerBridgeRemovedGlobally !== false) errors.push('Provider bridge removal is overclaimed');
  if (boundary.allFoundationDomainsDirectNativeClaimed !== false) errors.push('all-Foundation direct-native coverage is overclaimed');
  if (boundary.completeRuntimeClaimed !== false) errors.push('complete runtime is overclaimed');
  if (boundary.fullSelfHostingClaimed !== false) errors.push('full self-hosting is overclaimed');

  const boundPaths = new Set((contract.sourceBindings ?? []).map(item => item?.path));
  for (const requiredPath of SOURCE_BINDING_PATHS) {
    if (!boundPaths.has(requiredPath)) errors.push(`required runtime truth source is not bound: ${requiredPath}`);
  }
  for (const binding of contract.sourceBindings ?? []) {
    if (!binding?.path || !isSha256(binding?.sha256)) errors.push(`invalid source binding: ${binding?.path ?? '<missing>'}`);
  }
  for (const surface of contract.surfaces ?? []) {
    if (!surface?.id || !surface?.logicalPath || !boundPaths.has(surface?.source)) {
      errors.push(`runtime truth surface is not backed by a bound source: ${surface?.id ?? '<missing>'}`);
    }
  }

  return {
    ok: errors.length === 0,
    status: errors.length === 0
      ? 'RCL_FOUNDATION_RUNTIME_TRUTH_CONTRACT_VERIFIED'
      : 'RCL_FOUNDATION_RUNTIME_TRUTH_CONTRACT_FAILED',
    errors,
    contractRoot: contract.contractRoot ?? null,
    sourceBindingCount: Array.isArray(contract.sourceBindings) ? contract.sourceBindings.length : 0,
    surfaceCount: Array.isArray(contract.surfaces) ? contract.surfaces.length : 0,
  };
}

export const FOUNDATION_RUNTIME_TRUTH_SOURCE_BINDINGS = SOURCE_BINDING_PATHS;
export const FOUNDATION_RUNTIME_TRUTH_SURFACES = RUNTIME_TRUTH_SURFACES;
