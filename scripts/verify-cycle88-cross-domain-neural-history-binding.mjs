#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runtimeCapabilityTruthSurface } from '../api/capability-truth.mjs';
import { foundationCrossDomainHistoryDeploymentEvidence } from '../src/foundation-cross-domain-history-deployment-evidence.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const nativeDir = path.join(root, 'native');
const binaryPath = path.join(nativeDir, process.platform === 'win32' ? 'rclvm.exe' : 'rclvm');
const manifestPath = path.join(nativeDir, 'rclvm.vercel-attestation.json');

function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function isSha256(value) { return typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value); }
function fail(message, details = {}) {
  console.error(JSON.stringify({ ok: false, status: 'DWAC_CYCLE88_CROSS_DOMAIN_NEURAL_HISTORY_BINDING_FAILED', message, ...details }, null, 2));
  process.exit(252);
}

try {
  if (!fs.existsSync(binaryPath) || !fs.existsSync(manifestPath)) {
    fail('Canonical Native VM artifact or attestation is missing.', { binaryPath, manifestPath });
  }
  const binaryBytes = fs.readFileSync(binaryPath);
  const binarySha256 = sha256(binaryBytes);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const proof = manifest?.foundationCrossDomainHistoryProof ?? null;
  const expectedDomains = ['physical', 'perception', 'neural'];

  if (
    proof?.format !== 'taowind.rcl-vercel-foundation-cross-domain-history-proof.v0.2'
    || proof?.verified !== true
    || proof?.binarySha256 !== binarySha256
    || !expectedDomains.every(domain => proof?.domains?.includes(domain))
    || Number(proof?.domainCount) < 3
    || !isSha256(proof?.referenceHistoryRoot)
    || proof?.referenceHistoryRoot !== proof?.nativeHistoryRoot
    || proof?.truthBoundary?.boundedPhysicalPerceptionNeuralSpecimenOnly !== true
    || proof?.truthBoundary?.stagedGeneticHistoryIncluded !== false
    || proof?.truthBoundary?.livingStagedHistoryIncluded !== false
    || proof?.truthBoundary?.fullHistoryParityClaimed !== false
  ) {
    fail('Native VM attestation does not carry the exact bounded three-domain history proof.', { proof, binarySha256 });
  }

  const evidence = foundationCrossDomainHistoryDeploymentEvidence({ binaryBytes, attestation: manifest });
  if (
    evidence?.ok !== true
    || evidence?.verified !== true
    || evidence?.binarySha256 !== binarySha256
    || !isSha256(evidence?.deploymentEvidenceRoot)
    || !expectedDomains.every(domain => evidence?.domains?.includes(domain))
    || evidence?.referenceHistoryRoot !== proof.referenceHistoryRoot
    || evidence?.nativeHistoryRoot !== proof.nativeHistoryRoot
  ) {
    fail('Three-domain proof did not survive deployment-evidence binding.', { evidence, proof, binarySha256 });
  }

  const surface = runtimeCapabilityTruthSurface({ requireCrossDomainHistory: true });
  if (
    surface?.ok !== true
    || !isSha256(surface?.runtimeTruthRoot)
    || surface?.crossDomainHistoryEvidence?.deploymentEvidenceRoot !== evidence.deploymentEvidenceRoot
    || surface?.runtimeTruth?.crossDomainHistoryBound !== true
    || surface?.runtimeTruth?.crossDomainHistoryEvidenceRoot !== evidence.deploymentEvidenceRoot
    || surface?.runtimeTruth?.crossDomainHistoryReferenceRoot !== proof.referenceHistoryRoot
    || surface?.runtimeTruth?.crossDomainHistoryNativeRoot !== proof.nativeHistoryRoot
    || !expectedDomains.every(domain => surface?.runtimeTruth?.crossDomainHistoryDomains?.includes(domain))
    || surface?.truthBoundary?.crossDomainHistoryBindingDoesNotClaimFullHistoryParity !== true
    || surface?.truthBoundary?.crossDomainHistoryBindingDoesNotClaimAllFoundationDomainHistoryParity !== true
  ) {
    fail('Canonical runtime truth did not bind the exact bounded three-domain history evidence.', {
      runtimeTruthRoot: surface?.runtimeTruthRoot ?? null,
      runtimeTruth: surface?.runtimeTruth ?? null,
      truthBoundary: surface?.truthBoundary ?? null,
      crossDomainHistoryEvidence: surface?.crossDomainHistoryEvidence ?? null,
    });
  }

  console.log(JSON.stringify({
    ok: true,
    status: 'DWAC_CYCLE88_CROSS_DOMAIN_NEURAL_HISTORY_BINDING_VERIFIED',
    binarySha256,
    executionAttestationRoot: proof.executionAttestationRoot,
    historyRoot: proof.referenceHistoryRoot,
    deploymentEvidenceRoot: evidence.deploymentEvidenceRoot,
    runtimeTruthRoot: surface.runtimeTruthRoot,
    domains: surface.runtimeTruth.crossDomainHistoryDomains,
    domainCount: evidence.domainCount,
    entryCount: evidence.entryCount,
    truthBoundary: {
      boundedPhysicalPerceptionNeuralRealCHistoryVerified: true,
      boundedPhysicalPerceptionNeuralRuntimeTruthBound: true,
      stagedGeneticHistoryIncluded: false,
      livingStagedHistoryIncluded: false,
      fullHistoryParityClaimed: false,
      allFoundationDomainsHistoryParityClaimed: false,
      completeRuntimeClaimed: false,
      fullSelfHostingClaimed: false,
    },
  }, null, 2));
} catch (error) {
  fail(error?.message ?? String(error), { code: error?.code ?? null, stack: error?.stack ?? null });
}
