import crypto from 'node:crypto';

export const FOUNDATION_DIRECT_CAPABILITY_REGISTRY_FORMAT = 'taowind.rcl-foundation-direct-capability-registry.v0.2';
export const FOUNDATION_DIRECT_CAPABILITY_REGISTRY_VERSION = '0.2.0';

const RAW_CAPABILITIES = [
  {
    canonicalDomain: 'perception',
    runtimeDomain: 'perception',
    lowererStage: 'foundation-core',
    implementationModule: 'src/foundation-direct-lowering.mjs',
    bytecodeModule: 'src/foundation-direct-bytecode.mjs',
  },
  {
    canonicalDomain: 'physical',
    runtimeDomain: 'physical',
    lowererStage: 'foundation-core',
    implementationModule: 'src/foundation-direct-lowering.mjs',
    bytecodeModule: 'src/foundation-direct-bytecode.mjs',
  },
  {
    canonicalDomain: 'neural',
    runtimeDomain: 'neural',
    lowererStage: 'foundation-core',
    implementationModule: 'src/foundation-direct-lowering.mjs',
    bytecodeModule: 'src/foundation-direct-bytecode.mjs',
  },
  {
    canonicalDomain: 'genetic',
    runtimeDomain: 'genetic',
    lowererStage: 'foundation-core',
    implementationModule: 'src/foundation-direct-lowering.mjs',
    bytecodeModule: 'src/foundation-direct-bytecode.mjs',
  },
  {
    canonicalDomain: 'life',
    runtimeDomain: 'living',
    lowererStage: 'foundation-core',
    implementationModule: 'src/foundation-direct-lowering.mjs',
    bytecodeModule: 'src/foundation-direct-bytecode.mjs',
  },
  {
    canonicalDomain: 'quantitative',
    runtimeDomain: 'quantitative',
    lowererStage: 'quantitative-prepass',
    implementationModule: 'src/foundation-quantitative-direct-lowering.mjs',
    bytecodeModule: 'src/foundation-direct-bytecode.mjs',
  },
  {
    canonicalDomain: 'energy',
    runtimeDomain: 'energy',
    lowererStage: 'energy-prepass',
    implementationModule: 'src/foundation-energy-direct-lowering.mjs',
    bytecodeModule: 'src/foundation-direct-bytecode.mjs',
  },
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

export const FOUNDATION_DIRECT_CAPABILITIES = Object.freeze(
  RAW_CAPABILITIES.map(item => Object.freeze({ ...item })),
);

export const FOUNDATION_DIRECT_IMPLEMENTATION_DOMAINS = Object.freeze(
  FOUNDATION_DIRECT_CAPABILITIES.map(item => item.canonicalDomain),
);

export const FOUNDATION_CORE_DIRECT_RUNTIME_DOMAINS = Object.freeze(
  FOUNDATION_DIRECT_CAPABILITIES
    .filter(item => item.lowererStage === 'foundation-core')
    .map(item => item.runtimeDomain),
);

export function canonicalFoundationDirectDomainId(value) {
  const item = FOUNDATION_DIRECT_CAPABILITIES.find(candidate => (
    candidate.canonicalDomain === value || candidate.runtimeDomain === value
  ));
  return item?.canonicalDomain ?? value;
}

export function foundationDirectCapability(domain) {
  const canonicalDomain = canonicalFoundationDirectDomainId(domain);
  return FOUNDATION_DIRECT_CAPABILITIES.find(item => item.canonicalDomain === canonicalDomain) ?? null;
}

export function foundationDirectImplementation(domain) {
  const capability = foundationDirectCapability(domain);
  if (!capability) return null;
  return `${capability.implementationModule} + ${capability.bytecodeModule}`;
}

export function foundationDirectCapabilityRegistrySnapshot() {
  const capabilities = FOUNDATION_DIRECT_CAPABILITIES.map(item => ({ ...item }));
  const payload = {
    format: FOUNDATION_DIRECT_CAPABILITY_REGISTRY_FORMAT,
    version: FOUNDATION_DIRECT_CAPABILITY_REGISTRY_VERSION,
    capabilities,
  };
  return {
    ...payload,
    registryRoot: sha256Canonical(payload),
  };
}

export const FOUNDATION_DIRECT_CAPABILITY_REGISTRY_ROOT =
  foundationDirectCapabilityRegistrySnapshot().registryRoot;
