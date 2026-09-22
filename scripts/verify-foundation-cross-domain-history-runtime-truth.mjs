#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  foundationRuntimeCapabilityTruthAttestation,
  runtimeCapabilityTruthSurface,
} from '../api/capability-truth.mjs';
import {
  foundationCrossDomainHistoryDeploymentEvidence,
} from '../src/foundation-cross-domain-history-deployment-evidence.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const nativeDir = path.join(root, 'native');
const binaryPath = path.join(nativeDir, process.platform === 'win32' ? 'rclvm.exe' : 'rclvm');
const manifestPath = path.join(nativeDir, 'rclvm.vercel-attestation.json');
const publicDir = path.join(root, 'public');
const artifactPath = path.join(publicDir, 'rcl-foundation-cross-domain-runtime-truth.json');

function fail(message, details = {}) {
  console.error(JSON.stringify({ ok: false, status: 'RCL_FOUNDATION_CROSS_DOMAIN_HISTORY_RUNTIME_TRUTH_FAILED', message, ...details }, null, 2));
  process.exit(1);
}
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function isSha256(value) { return typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value); }
function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }

try {
  if (!fs.existsSync(binaryPath)) fail('Canonical Native VM binary is missing before cross-domain runtime truth binding.', { binaryPath });
  if (!fs.existsSync(manifestPath)) fail('Canonical Native VM attestation is missing before cross-domain runtime truth binding.', { manifestPath });

  const binaryBytes = fs.readFileSync(binaryPath);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const binarySha256 = sha256(binaryBytes);
  const evidence = foundationCrossDomainHistoryDeploymentEvidence({ binaryBytes, attestation: manifest });
  if (evidence?.ok !== true || evidence?.verified !== true || evidence?.present !== true) {
    fail('Bounded Physical + Perception + Neural cross-domain history proof did not bind into deployment evidence.', { evidence });
  }
  if (
    evidence.binarySha256 !== binarySha256
    || !isSha256(evidence.deploymentEvidenceRoot)
    || !isSha256(evidence.executionAttestationRoot)
    || !isSha256(evidence.referenceHistoryRoot)
    || evidence.referenceHistoryRoot !== evidence.nativeHistoryRoot
    || !evidence.domains.includes('physical')
    || !evidence.domains.includes('perception')
    || !evidence.domains.includes('neural')
    || evidence.domainCount < 3
  ) {
    fail('Three-domain history deployment evidence lost content-addressed root/binary/domain binding.', { evidence, binarySha256 });
  }

  const surface = runtimeCapabilityTruthSurface({ requireCrossDomainHistory: true });
  if (surface?.ok !== true || surface?.status !== 'RCL_FOUNDATION_RUNTIME_CAPABILITY_TRUTH_VERIFIED') {
    fail('Canonical runtime capability truth did not verify with cross-domain history required.', { surface });
  }
  if (
    surface?.crossDomainHistoryEvidence?.deploymentEvidenceRoot !== evidence.deploymentEvidenceRoot
    || surface?.runtimeTruth?.crossDomainHistoryBound !== true
    || surface?.runtimeTruth?.crossDomainHistoryEvidenceRoot !== evidence.deploymentEvidenceRoot
    || surface?.runtimeTruth?.crossDomainHistoryReferenceRoot !== evidence.referenceHistoryRoot
    || surface?.runtimeTruth?.crossDomainHistoryNativeRoot !== evidence.nativeHistoryRoot
    || JSON.stringify(surface?.runtimeTruth?.crossDomainHistoryDomains) !== JSON.stringify(evidence.domains)
    || !surface?.runtimeTruth?.crossDomainHistoryDomains?.includes('neural')
    || surface?.truthBoundary?.crossDomainHistoryRuntimeTruthBound !== true
    || surface?.truthBoundary?.runtimeTruthRootBindsCrossDomainHistoryEvidenceWhenPresent !== true
    || surface?.truthBoundary?.crossDomainHistoryBindingDoesNotClaimFullHistoryParity !== true
    || surface?.truthBoundary?.crossDomainHistoryBindingDoesNotClaimAllFoundationDomainHistoryParity !== true
  ) {
    fail('Canonical runtime truth surface did not bind the exact three-domain cross-domain evidence without overclaim.', {
      runtimeTruth: surface?.runtimeTruth,
      truthBoundary: surface?.truthBoundary,
      crossDomainHistoryEvidence: surface?.crossDomainHistoryEvidence,
    });
  }

  const registry = surface.deploymentEvidenceRegistry;
  const replayed = foundationRuntimeCapabilityTruthAttestation({
    capability: surface,
    deployment: { ...registry, evidenceSetRoot: registry.evidenceSetRoot },
    crossDomainHistory: surface.crossDomainHistoryEvidence,
  });
  if (!isSha256(surface.runtimeTruthRoot) || replayed.runtimeTruthRoot !== surface.runtimeTruthRoot) {
    fail('Runtime truth root does not replay from canonical capability/deployment/cross-domain evidence.', {
      runtimeTruthRoot: surface.runtimeTruthRoot,
      replayedRuntimeTruthRoot: replayed.runtimeTruthRoot,
    });
  }

  const nativeRootDrift = clone(manifest);
  nativeRootDrift.foundationCrossDomainHistoryProof.nativeHistoryRoot = '0'.repeat(64);
  const nativeRootNegative = foundationCrossDomainHistoryDeploymentEvidence({ binaryBytes, attestation: nativeRootDrift });
  if (nativeRootNegative.ok !== false) {
    fail('Native history root drift negative control did not fail closed.', { nativeRootNegative });
  }

  const binaryDrift = clone(manifest);
  binaryDrift.foundationCrossDomainHistoryProof.binarySha256 = '1'.repeat(64);
  const binaryNegative = foundationCrossDomainHistoryDeploymentEvidence({ binaryBytes, attestation: binaryDrift });
  if (binaryNegative.ok !== false) {
    fail('Cross-domain proof binary identity drift negative control did not fail closed.', { binaryNegative });
  }

  const neuralDomainDrift = clone(manifest);
  neuralDomainDrift.foundationCrossDomainHistoryProof.domains = neuralDomainDrift.foundationCrossDomainHistoryProof.domains.filter(domain => domain !== 'neural');
  const neuralDomainNegative = foundationCrossDomainHistoryDeploymentEvidence({ binaryBytes, attestation: neuralDomainDrift });
  if (neuralDomainNegative.ok !== false) {
    fail('Removing Neural from the bounded three-domain proof did not fail closed.', { neuralDomainNegative });
  }

  const boundaryOverclaim = clone(manifest);
  boundaryOverclaim.foundationCrossDomainHistoryProof.truthBoundary.fullHistoryParityClaimed = true;
  const boundaryNegative = foundationCrossDomainHistoryDeploymentEvidence({ binaryBytes, attestation: boundaryOverclaim });
  if (boundaryNegative.ok !== false) {
    fail('Full-history overclaim negative control did not fail closed.', { boundaryNegative });
  }

  const artifact = {
    ok: true,
    format: 'taowind.rcl-foundation-cross-domain-runtime-truth.v0.2',
    status: 'RCL_FOUNDATION_CROSS_DOMAIN_HISTORY_RUNTIME_TRUTH_VERIFIED',
    runtimeTruthRoot: surface.runtimeTruthRoot,
    crossDomainHistoryEvidenceRoot: evidence.deploymentEvidenceRoot,
    crossDomainHistoryRoot: evidence.referenceHistoryRoot,
    domains: evidence.domains,
    domainCount: evidence.domainCount,
    entryCount: evidence.entryCount,
    binarySha256,
    executionAttestationRoot: evidence.executionAttestationRoot,
    negativeControls: {
      nativeHistoryRootDriftFailsClosed: true,
      proofBinaryIdentityDriftFailsClosed: true,
      neuralDomainRemovalFailsClosed: true,
      fullHistoryOverclaimFailsClosed: true,
    },
    truthBoundary: {
      boundedPhysicalPerceptionNeuralSpecimenOnly: true,
      stagedGeneticHistoryIncluded: false,
      livingStagedHistoryIncluded: false,
      fullHistoryParityClaimed: false,
      allFoundationDomainsHistoryParityClaimed: false,
      completeRuntimeClaimed: false,
      fullSelfHostingClaimed: false,
    },
  };
  fs.mkdirSync(publicDir, { recursive: true });
  fs.writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`);

  console.log(JSON.stringify(artifact, null, 2));
} catch (error) {
  fail(error?.message ?? String(error), { code: error?.code ?? null, stack: error?.stack ?? null });
}
