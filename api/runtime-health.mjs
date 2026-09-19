import { RCL_MCP_SERVER_NAME, RCL_MCP_SERVER_VERSION, listRclMcpTools } from '../src/rcl-mcp-server.mjs';
import {
  FOUNDATION_NATIVE_BRIDGE_SPECS,
  foundationNativeBridgeCapabilityRegistrySnapshot,
} from '../src/foundation-native-bridge-capability-registry.mjs';
import { nativeVmDeploymentStatus } from './health.mjs';
import { runtimeCapabilityTruthSurface } from './capability-truth.mjs';

function isSha256(value) {
  return typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value);
}

function bridgeProofMatchesCanonicalSpec(proof, spec) {
  return Boolean(
    proof
    && proof.batchId === spec.batchId
    && proof.domain === spec.domain
    && proof.capability === spec.capability
    && proof.providerId === spec.providerId
    && proof.providerCallCount === spec.providerCallCount
    && proof.mode === 'native-provider-bridge'
    && proof.status === 'native-bridge-verified'
    && proof.verified === true
  );
}

export function runtimeHealthStatus({
  nativeStatus = null,
  runtimeSurface = null,
  bridgeSpecs = FOUNDATION_NATIVE_BRIDGE_SPECS,
  bridgeRegistrySnapshot = null,
} = {}) {
  const tools = listRclMcpTools();
  const nativeVmDeployment = nativeStatus ?? nativeVmDeploymentStatus();
  const runtimeCapabilityTruth = runtimeSurface ?? runtimeCapabilityTruthSurface();
  const registry = runtimeCapabilityTruth?.deploymentEvidenceRegistry;
  const canonicalBridgeRegistry = bridgeRegistrySnapshot ?? foundationNativeBridgeCapabilityRegistrySnapshot();
  const canonicalBridgeDomains = bridgeSpecs.map(spec => spec.domain);
  const nativeBridgeDomains = nativeVmDeployment?.foundationNativeBridgeDomains ?? [];
  const bridgeProofs = nativeVmDeployment?.foundationNativeBridgeProofs ?? {};

  const nativeDeploymentHealthy = Boolean(
    nativeVmDeployment?.bundled === true
    && nativeVmDeployment?.executable === true
    && nativeVmDeployment?.attestationBundled === true
    && nativeVmDeployment?.replayEvidenceBound === true
    && nativeVmDeployment?.evidenceBound === true
    && nativeVmDeployment?.extendedEvidenceBound === true
  );

  const runtimeTruthHealthy = Boolean(
    runtimeCapabilityTruth?.ok === true
    && runtimeCapabilityTruth?.status === 'RCL_FOUNDATION_RUNTIME_CAPABILITY_TRUTH_VERIFIED'
    && isSha256(runtimeCapabilityTruth?.truthRoot)
    && isSha256(runtimeCapabilityTruth?.runtimeTruthRoot)
    && runtimeCapabilityTruth?.runtimeTruth?.runtimeTruthRoot === runtimeCapabilityTruth?.runtimeTruthRoot
    && isSha256(registry?.registryRoot)
    && isSha256(registry?.evidenceSetRoot)
    && registry?.evidenceSetVerified === true
    && registry?.completeDirectDeploymentCoverage === true
    && registry?.missingDirectDeploymentEvidenceDomains?.length === 0
    && JSON.stringify(registry?.registeredDomains) === JSON.stringify(registry?.directImplementationDomains)
  );

  const providerBridgeTopologyHealthy = Boolean(
    isSha256(canonicalBridgeRegistry?.registryRoot)
    && runtimeCapabilityTruth?.providerBridge?.registryRoot === canonicalBridgeRegistry.registryRoot
    && JSON.stringify(runtimeCapabilityTruth?.providerBridge?.domains ?? []) === JSON.stringify(canonicalBridgeDomains)
    && JSON.stringify(nativeBridgeDomains) === JSON.stringify(canonicalBridgeDomains)
    && bridgeSpecs.every(spec => bridgeProofMatchesCanonicalSpec(bridgeProofs?.[spec.domain], spec))
  );

  const ok = nativeDeploymentHealthy && runtimeTruthHealthy && providerBridgeTopologyHealthy;
  return {
    ok,
    status: ok ? 'RCL_RUNTIME_HEALTH_VERIFIED' : 'RCL_RUNTIME_HEALTH_DRIFT',
    name: RCL_MCP_SERVER_NAME,
    version: RCL_MCP_SERVER_VERSION,
    endpoint: '/mcp',
    toolCount: tools.length,
    rclToolCount: tools.filter(tool => tool.name.startsWith('rcl_')).length,
    rncsToolCount: tools.filter(tool => tool.name.startsWith('rncs_')).length,
    nativeDeploymentHealthy,
    runtimeTruthHealthy,
    providerBridgeTopologyHealthy,
    nativeVmDeployment,
    runtimeCapabilityTruth: {
      status: runtimeCapabilityTruth?.status ?? null,
      capabilityTruthRoot: runtimeCapabilityTruth?.truthRoot ?? null,
      runtimeTruthRoot: runtimeCapabilityTruth?.runtimeTruthRoot ?? null,
      directRegistryRoot: runtimeCapabilityTruth?.direct?.registryRoot ?? null,
      providerBridgeRegistryRoot: runtimeCapabilityTruth?.providerBridge?.registryRoot ?? null,
      deploymentEvidenceRegistryRoot: registry?.registryRoot ?? null,
      deploymentEvidenceSetRoot: registry?.evidenceSetRoot ?? null,
      evidenceSetVerified: registry?.evidenceSetVerified === true,
      completeDirectDeploymentCoverage: registry?.completeDirectDeploymentCoverage === true,
      directImplementationDomains: [...(registry?.directImplementationDomains ?? [])],
      registeredDeploymentEvidenceDomains: [...(registry?.registeredDomains ?? [])],
      truthBoundary: {
        runtimeTruthRootBindsVersionedCapabilityAndDeploymentEvidenceSet:
          runtimeCapabilityTruth?.truthBoundary?.runtimeTruthRootBindsVersionedCapabilityAndDeploymentEvidenceSet === true,
        deploymentEvidenceSetRootBindsPerDomainEvidenceRoots:
          runtimeCapabilityTruth?.truthBoundary?.deploymentEvidenceSetRootBindsPerDomainEvidenceRoots === true,
        completeEvidenceCoverageDoesNotClaimFullDomainNativeCoverage:
          runtimeCapabilityTruth?.truthBoundary?.completeDirectDeploymentEvidenceCoverageMeansEvidenceCoverageNotFullDomainNativeCoverage === true,
      },
    },
    providerBridgeTopology: {
      registryRoot: canonicalBridgeRegistry?.registryRoot ?? null,
      domains: canonicalBridgeDomains,
      nativeEvidenceDomains: [...nativeBridgeDomains],
      proofCount: canonicalBridgeDomains.filter(domain => bridgeProofs?.[domain]).length,
      allProofsMatchCanonicalSpecs: bridgeSpecs.every(spec => bridgeProofMatchesCanonicalSpec(bridgeProofs?.[spec.domain], spec)),
    },
    truthBoundary: {
      healthFailsClosedOnRuntimeCapabilityTruthDrift: true,
      healthBindsCanonicalRuntimeTruthRoot: true,
      healthFailsClosedOnProviderBridgeTopologyDrift: true,
      healthUsesExecutableProviderBridgeRegistryAsCanonicalTopology: true,
      providerBridgeTopologyVerificationDoesNotClaimStatePathSemanticParity: true,
      completeEvidenceCoverageDoesNotClaimFullDomainNativeCoverage: true,
      providerBridgeMayCoexistWithDirectDeploymentEvidence: true,
    },
  };
}

export default function handler(_request, response) {
  let health;
  try {
    health = runtimeHealthStatus();
  } catch (error) {
    response.writeHead(503, { 'content-type': 'application/json; charset=utf-8' });
    response.end(`${JSON.stringify({
      ok: false,
      status: 'RCL_RUNTIME_HEALTH_UNAVAILABLE',
      error: error?.message ?? String(error),
    })}\n`);
    return;
  }

  response.writeHead(health.ok ? 200 : 503, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'public, max-age=0, must-revalidate',
  });
  response.end(`${JSON.stringify(health)}\n`);
}
