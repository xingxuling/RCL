import { RCL_MCP_SERVER_NAME, RCL_MCP_SERVER_VERSION, listRclMcpTools } from '../src/rcl-mcp-server.mjs';
import { nativeVmDeploymentStatus } from './health.mjs';
import { runtimeCapabilityTruthSurface } from './capability-truth.mjs';

function isSha256(value) {
  return typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value);
}

export function runtimeHealthStatus({ nativeStatus = null, runtimeSurface = null } = {}) {
  const tools = listRclMcpTools();
  const nativeVmDeployment = nativeStatus ?? nativeVmDeploymentStatus();
  const runtimeCapabilityTruth = runtimeSurface ?? runtimeCapabilityTruthSurface();
  const registry = runtimeCapabilityTruth?.deploymentEvidenceRegistry;

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

  const ok = nativeDeploymentHealthy && runtimeTruthHealthy;
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
    truthBoundary: {
      healthFailsClosedOnRuntimeCapabilityTruthDrift: true,
      healthBindsCanonicalRuntimeTruthRoot: true,
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
