import crypto from 'node:crypto';
import { FOUNDATION_DIRECT_IMPLEMENTATION_DOMAINS } from './foundation-direct-capability-registry.mjs';
import { foundationPerceptionDeploymentEvidence, foundationPhysicalDeploymentEvidence, foundationNeuralDeploymentEvidence, foundationGeneticDeploymentEvidence, foundationLifeDeploymentEvidence } from './foundation-core-deployment-evidence.mjs';
import { foundationQuantitativeDeploymentEvidence } from './foundation-quantitative-deployment-evidence.mjs';
import { foundationEnergyDeploymentEvidence } from './foundation-energy-deployment-evidence.mjs';

export const FOUNDATION_RUNTIME_DEPLOYMENT_EVIDENCE_REGISTRY_FORMAT = 'taowind.rcl-foundation-runtime-deployment-evidence-registry.v0.3';
export const FOUNDATION_RUNTIME_DEPLOYMENT_EVIDENCE_REGISTRY_VERSION = '0.3.0';
export const FOUNDATION_RUNTIME_DEPLOYMENT_EVIDENCE_SET_FORMAT = 'taowind.rcl-foundation-runtime-deployment-evidence-set.v0.1';
export const FOUNDATION_RUNTIME_DEPLOYMENT_EVIDENCE_SET_VERSION = '0.1.0';
const RAW_PROVIDERS = [
  { domain: 'perception', evidenceModule: 'src/foundation-core-deployment-evidence.mjs', evidenceFunction: 'foundationPerceptionDeploymentEvidence' },
  { domain: 'physical', evidenceModule: 'src/foundation-core-deployment-evidence.mjs', evidenceFunction: 'foundationPhysicalDeploymentEvidence' },
  { domain: 'neural', evidenceModule: 'src/foundation-core-deployment-evidence.mjs', evidenceFunction: 'foundationNeuralDeploymentEvidence' },
  { domain: 'genetic', evidenceModule: 'src/foundation-core-deployment-evidence.mjs', evidenceFunction: 'foundationGeneticDeploymentEvidence' },
  { domain: 'life', evidenceModule: 'src/foundation-core-deployment-evidence.mjs', evidenceFunction: 'foundationLifeDeploymentEvidence' },
  { domain: 'quantitative', evidenceModule: 'src/foundation-quantitative-deployment-evidence.mjs', evidenceFunction: 'foundationQuantitativeDeploymentEvidence' },
  { domain: 'energy', evidenceModule: 'src/foundation-energy-deployment-evidence.mjs', evidenceFunction: 'foundationEnergyDeploymentEvidence' },
];
const DEFAULT_BUILDERS = Object.freeze({ perception: foundationPerceptionDeploymentEvidence, physical: foundationPhysicalDeploymentEvidence, neural: foundationNeuralDeploymentEvidence, genetic: foundationGeneticDeploymentEvidence, life: foundationLifeDeploymentEvidence, quantitative: foundationQuantitativeDeploymentEvidence, energy: foundationEnergyDeploymentEvidence });
function canonicalize(value) { if (Array.isArray(value)) return value.map(canonicalize); if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalize(value[key])])); return value; }
function sha256Canonical(value) { return crypto.createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex'); }
function normalizedProviders(providers) { return providers.map(item => ({ domain: String(item.domain), evidenceModule: String(item.evidenceModule), evidenceFunction: String(item.evidenceFunction) })); }
export const FOUNDATION_RUNTIME_DEPLOYMENT_EVIDENCE_PROVIDERS = Object.freeze(normalizedProviders(RAW_PROVIDERS).map(item => Object.freeze(item)));
export function foundationRuntimeDeploymentEvidenceRegistrySnapshot({ providers = FOUNDATION_RUNTIME_DEPLOYMENT_EVIDENCE_PROVIDERS } = {}) {
  const payload = { format: FOUNDATION_RUNTIME_DEPLOYMENT_EVIDENCE_REGISTRY_FORMAT, version: FOUNDATION_RUNTIME_DEPLOYMENT_EVIDENCE_REGISTRY_VERSION, providers: normalizedProviders(providers) };
  return { ...payload, registryRoot: sha256Canonical(payload) };
}
export function foundationRuntimeDeploymentEvidenceSetSnapshot({ registryRoot, directImplementationDomains = FOUNDATION_DIRECT_IMPLEMENTATION_DOMAINS, evidenceByDomain = {} } = {}) {
  const deploymentEvidenceRoots = Object.fromEntries(directImplementationDomains.map(domain => [domain, evidenceByDomain?.[domain]?.deploymentEvidenceRoot ?? null]));
  const payload = {
    format: FOUNDATION_RUNTIME_DEPLOYMENT_EVIDENCE_SET_FORMAT,
    version: FOUNDATION_RUNTIME_DEPLOYMENT_EVIDENCE_SET_VERSION,
    registryRoot: registryRoot ?? null,
    directImplementationDomains: [...directImplementationDomains],
    deploymentEvidenceRoots,
  };
  return { ...payload, evidenceSetRoot: sha256Canonical(payload) };
}
export function foundationRuntimeDeploymentEvidenceSurface({ providers = FOUNDATION_RUNTIME_DEPLOYMENT_EVIDENCE_PROVIDERS, builders = DEFAULT_BUILDERS, evidenceInputs = {}, requireCompleteDirectCoverage = false } = {}) {
  const errors = []; const fail = (code, message, details = {}) => errors.push({ code, message, ...details });
  const snapshot = foundationRuntimeDeploymentEvidenceRegistrySnapshot({ providers }); const evidenceByDomain = {}; const registeredDomains = snapshot.providers.map(item => item.domain);
  const duplicates = registeredDomains.filter((domain, index) => registeredDomains.indexOf(domain) !== index);
  if (duplicates.length > 0) fail('RCL_RUNTIME_DEPLOYMENT_EVIDENCE_REGISTRY_DUPLICATE_DOMAIN', 'Runtime deployment evidence registry contains duplicate domains.', { duplicates: [...new Set(duplicates)] });
  for (const provider of snapshot.providers) {
    if (!FOUNDATION_DIRECT_IMPLEMENTATION_DOMAINS.includes(provider.domain)) { fail('RCL_RUNTIME_DEPLOYMENT_EVIDENCE_REGISTRY_NON_DIRECT_DOMAIN', 'Runtime deployment evidence provider is not backed by the executable direct capability registry.', { provider, directDomains: [...FOUNDATION_DIRECT_IMPLEMENTATION_DOMAINS] }); continue; }
    const buildEvidence = builders?.[provider.domain];
    if (typeof buildEvidence !== 'function') { fail('RCL_RUNTIME_DEPLOYMENT_EVIDENCE_REGISTRY_BUILDER_MISSING', 'Runtime deployment evidence provider has no executable builder.', { provider }); continue; }
    let evidence; try { evidence = buildEvidence(evidenceInputs?.[provider.domain]); } catch (error) { evidence = { ok: false, domain: provider.domain, status: 'deployment-unavailable', verified: false, deploymentEvidenceRoot: null, errors: [{ code: error?.code ?? 'RCL_RUNTIME_DEPLOYMENT_EVIDENCE_UNAVAILABLE', message: error?.message ?? String(error) }] }; }
    evidenceByDomain[provider.domain] = evidence;
    if (evidence?.ok !== true || evidence?.verified !== true || evidence?.domain !== provider.domain || typeof evidence?.deploymentEvidenceRoot !== 'string' || !/^[0-9a-f]{64}$/i.test(evidence.deploymentEvidenceRoot)) fail('RCL_RUNTIME_DEPLOYMENT_EVIDENCE_PROVIDER_FAILED', 'A registered runtime deployment evidence provider did not produce verified content-addressed evidence.', { domain: provider.domain, provider, evidence });
  }
  const missingDirectDeploymentEvidenceDomains = FOUNDATION_DIRECT_IMPLEMENTATION_DOMAINS.filter(domain => !registeredDomains.includes(domain));
  const completeDirectDeploymentCoverage = missingDirectDeploymentEvidenceDomains.length === 0;
  if (requireCompleteDirectCoverage && !completeDirectDeploymentCoverage) fail('RCL_RUNTIME_DEPLOYMENT_EVIDENCE_COVERAGE_INCOMPLETE', 'Complete direct-domain deployment evidence was required but the registry is partial.', { missingDirectDeploymentEvidenceDomains, registeredDomains });
  const evidenceSet = foundationRuntimeDeploymentEvidenceSetSnapshot({ registryRoot: snapshot.registryRoot, directImplementationDomains: FOUNDATION_DIRECT_IMPLEMENTATION_DOMAINS, evidenceByDomain });
  const evidenceSetVerified = errors.length === 0 && completeDirectDeploymentCoverage && Object.values(evidenceSet.deploymentEvidenceRoots).every(root => typeof root === 'string' && /^[0-9a-f]{64}$/i.test(root));
  return { ok: errors.length === 0, status: errors.length === 0 ? 'RCL_FOUNDATION_RUNTIME_DEPLOYMENT_EVIDENCE_REGISTRY_VERIFIED' : 'RCL_FOUNDATION_RUNTIME_DEPLOYMENT_EVIDENCE_REGISTRY_DRIFT', ...snapshot, registeredDomains, registeredDomainCount: registeredDomains.length, directImplementationDomains: [...FOUNDATION_DIRECT_IMPLEMENTATION_DOMAINS], directImplementationDomainCount: FOUNDATION_DIRECT_IMPLEMENTATION_DOMAINS.length, missingDirectDeploymentEvidenceDomains, completeDirectDeploymentCoverage, evidenceSetFormat: evidenceSet.format, evidenceSetVersion: evidenceSet.version, evidenceSetRoot: evidenceSet.evidenceSetRoot, evidenceSetVerified, deploymentEvidenceRoots: evidenceSet.deploymentEvidenceRoots, evidenceByDomain, truthBoundary: { registeredEvidenceDoesNotImplyCompleteDomainCapability: true, unregisteredDirectDomainsAreReportedNotInvented: true, providerBridgeMayCoexistWithDirectDeploymentEvidence: true, completeDirectDeploymentCoverageClaimed: completeDirectDeploymentCoverage, completeDirectDeploymentCoverageMeansEvidenceCoverageNotFullDomainNativeCoverage: true, evidenceSetRootBindsRegistryAndPerDomainDeploymentRoots: true }, errors };
}
