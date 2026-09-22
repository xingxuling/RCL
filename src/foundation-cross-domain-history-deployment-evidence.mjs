import crypto from 'node:crypto';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const NATIVE_VM_PATH = fileURLToPath(new URL('../native/rclvm', import.meta.url));
const NATIVE_VM_ATTESTATION_PATH = fileURLToPath(new URL('../native/rclvm.vercel-attestation.json', import.meta.url));

export const FOUNDATION_CROSS_DOMAIN_HISTORY_DEPLOYMENT_EVIDENCE_FORMAT = 'taowind.rcl-foundation-cross-domain-history-deployment-evidence.v0.2';
export const FOUNDATION_CROSS_DOMAIN_HISTORY_DEPLOYMENT_EVIDENCE_VERSION = '0.2.0';

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  }
  return value;
}
function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function sha256Canonical(value) { return sha256(JSON.stringify(canonical(value))); }
function isSha256(value) { return typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value); }

export function foundationCrossDomainHistoryDeploymentEvidence({ binaryBytes, attestation } = {}) {
  const errors = [];
  const fail = (code, message, details = {}) => errors.push({ code, message, ...details });
  const bytes = binaryBytes ?? fs.readFileSync(NATIVE_VM_PATH);
  const manifest = attestation ?? JSON.parse(fs.readFileSync(NATIVE_VM_ATTESTATION_PATH, 'utf8'));
  const binarySha256 = sha256(bytes);
  const proof = manifest?.foundationCrossDomainHistoryProof ?? null;
  const present = proof != null;

  if (manifest?.binarySha256 !== binarySha256) {
    fail('RCL_CROSS_DOMAIN_HISTORY_DEPLOYMENT_BINARY_DRIFT', 'Cross-domain history deployment evidence is not attached to the exact bundled Native VM binary.', {
      manifestBinarySha256: manifest?.binarySha256 ?? null,
      binarySha256,
    });
  }

  if (!present) {
    fail('RCL_CROSS_DOMAIN_HISTORY_RUNTIME_PROOF_MISSING', 'Bounded Physical + Perception + Neural cross-domain history proof is not present in the Native VM attestation.');
  } else {
    const domains = Array.isArray(proof?.domains) ? proof.domains : [];
    const truthBoundary = proof?.truthBoundary ?? {};
    if (
      proof?.format !== 'taowind.rcl-vercel-foundation-cross-domain-history-proof.v0.2'
      || proof?.status !== 'RCL_FOUNDATION_CROSS_DOMAIN_HISTORY_ROOT_PARITY_VERIFIED'
      || proof?.verified !== true
      || proof?.binarySha256 !== binarySha256
      || !isSha256(proof?.executionAttestationRoot)
      || proof?.rootAlgorithm !== 'rcl.foundation-cross-domain-history-root.sha256.v0.1'
      || !isSha256(proof?.referenceHistoryRoot)
      || !isSha256(proof?.nativeHistoryRoot)
      || proof?.referenceHistoryRoot !== proof?.nativeHistoryRoot
      || !domains.includes('physical')
      || !domains.includes('perception')
      || !domains.includes('neural')
      || Number(proof?.domainCount) < 3
      || Number(proof?.entryCount) < 3
      || truthBoundary?.boundedPhysicalPerceptionNeuralSpecimenOnly !== true
      || JSON.stringify(truthBoundary?.supportedCrossDomainRootDomains) !== JSON.stringify(['perception', 'physical', 'neural'])
      || truthBoundary?.stagedGeneticHistoryIncluded !== false
      || truthBoundary?.livingStagedHistoryIncluded !== false
      || truthBoundary?.unrelatedRuntimeHistoryIncluded !== false
      || truthBoundary?.fullHistoryParityClaimed !== false
      || truthBoundary?.allFoundationDomainsHistoryParityClaimed !== false
    ) {
      fail('RCL_CROSS_DOMAIN_HISTORY_RUNTIME_PROOF_DRIFT', 'Cross-domain history proof is present but no longer satisfies the bounded three-domain runtime truth contract.', { proof, binarySha256 });
    }
  }

  const payload = {
    format: FOUNDATION_CROSS_DOMAIN_HISTORY_DEPLOYMENT_EVIDENCE_FORMAT,
    version: FOUNDATION_CROSS_DOMAIN_HISTORY_DEPLOYMENT_EVIDENCE_VERSION,
    present,
    status: errors.length === 0 ? 'deployment-bound' : (present ? 'deployment-drift' : 'deployment-unbound'),
    verified: errors.length === 0,
    binarySha256,
    executionAttestationRoot: proof?.executionAttestationRoot ?? null,
    domains: Array.isArray(proof?.domains) ? [...proof.domains] : [],
    domainCount: Number(proof?.domainCount ?? 0),
    entryCount: Number(proof?.entryCount ?? 0),
    rootAlgorithm: proof?.rootAlgorithm ?? null,
    referenceHistoryRoot: proof?.referenceHistoryRoot ?? null,
    nativeHistoryRoot: proof?.nativeHistoryRoot ?? null,
    truthBoundary: {
      boundedPhysicalPerceptionNeuralSpecimenOnly: proof?.truthBoundary?.boundedPhysicalPerceptionNeuralSpecimenOnly === true,
      supportedCrossDomainRootDomains: Array.isArray(proof?.truthBoundary?.supportedCrossDomainRootDomains)
        ? [...proof.truthBoundary.supportedCrossDomainRootDomains]
        : [],
      stagedGeneticHistoryIncluded: proof?.truthBoundary?.stagedGeneticHistoryIncluded === true,
      livingStagedHistoryIncluded: proof?.truthBoundary?.livingStagedHistoryIncluded === true,
      unrelatedRuntimeHistoryIncluded: proof?.truthBoundary?.unrelatedRuntimeHistoryIncluded === true,
      fullHistoryParityClaimed: proof?.truthBoundary?.fullHistoryParityClaimed === true,
      allFoundationDomainsHistoryParityClaimed: proof?.truthBoundary?.allFoundationDomainsHistoryParityClaimed === true,
      runtimeTruthBindingDoesNotClaimAllDomainHistoryParity: true,
      runtimeTruthBindingDoesNotClaimFullHistoryParity: true,
    },
  };

  return {
    ok: errors.length === 0,
    ...payload,
    deploymentEvidenceRoot: errors.length === 0 ? sha256Canonical(payload) : null,
    errors,
  };
}
