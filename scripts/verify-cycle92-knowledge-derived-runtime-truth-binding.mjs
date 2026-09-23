#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runtimeCapabilityTruthSurface, foundationRuntimeCapabilityTruthAttestation } from '../api/capability-truth.mjs';
import { foundationKnowledgeDerivedRuntimeEvidence } from '../src/foundation-knowledge-derived-runtime-evidence.mjs';
import { replayFoundationRuntimeCapabilityTruthFromSurface } from '../src/foundation-runtime-truth-replay.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const binaryPath = path.join(root, 'native', process.platform === 'win32' ? 'rclvm.exe' : 'rclvm');
const manifestPath = path.join(root, 'native', 'rclvm.vercel-attestation.json');

function isSha256(value) { return typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value); }
function fail(message, details = {}, exitCode = 1) {
  console.error(JSON.stringify({ ok: false, status: 'RCL_CYCLE92_DERIVED_RUNTIME_TRUTH_BINDING_FAILED', message, exitCode, ...details }, null, 2));
  process.exit(exitCode);
}

const binaryBytes = fs.readFileSync(binaryPath);
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const surface = runtimeCapabilityTruthSurface({ requireKnowledgeDerivedDependency: true });
const evidence = surface?.knowledgeDerivedDependencyEvidence ?? null;
const runtimeTruth = surface?.runtimeTruth ?? null;

if (
  surface?.ok !== true
  || evidence?.present !== true
  || evidence?.ok !== true
  || evidence?.verified !== true
  || !isSha256(evidence?.runtimeEvidenceRoot)
  || !isSha256(evidence?.attestationRoot)
  || !isSha256(evidence?.knowledgeReceiptRoot)
  || evidence?.executionBinarySha256 !== manifest?.binarySha256
  || runtimeTruth?.knowledgeDerivedDependencyRuntimeBound !== true
  || runtimeTruth?.knowledgeDerivedDependencyRuntimeEvidenceRoot !== evidence.runtimeEvidenceRoot
  || runtimeTruth?.knowledgeDerivedDependencyAttestationRoot !== evidence.attestationRoot
  || runtimeTruth?.knowledgeDerivedDependencyKnowledgeReceiptRoot !== evidence.knowledgeReceiptRoot
  || runtimeTruth?.knowledgeDerivedDependencyExecutionBinarySha256 !== evidence.executionBinarySha256
  || runtimeTruth?.knowledgeDerivedDependencyPath !== 'mind.ready'
  || JSON.stringify(runtimeTruth?.knowledgeDerivedDependencyPaths) !== JSON.stringify(['mind.trusted', 'mind.score'])
  || runtimeTruth?.knowledgeDerivedDependencyConfidence !== 0.6
  || !isSha256(runtimeTruth?.runtimeTruthRoot)
) {
  fail('Canonical runtime truth did not bind the exact bounded-derived Knowledge evidence surface.', { surface, evidence, runtimeTruth }, 331);
}

const replayed = replayFoundationRuntimeCapabilityTruthFromSurface(surface);
if (replayed.runtimeTruthRoot !== surface.runtimeTruthRoot) {
  fail('Canonical runtime truth does not replay from the complete post-Cycle91 evidence surface.', {
    runtimeTruthRoot: surface.runtimeTruthRoot,
    replayedRuntimeTruthRoot: replayed.runtimeTruthRoot,
  }, 332);
}

const omitted = foundationRuntimeCapabilityTruthAttestation({
  capability: surface,
  deployment: surface.deploymentEvidenceRegistry,
  crossDomainHistory: surface.crossDomainHistoryEvidence,
  knowledgeMultiLearn: surface.knowledgeMultiLearnEvidence,
  knowledgeDerivedDependency: null,
});
if (omitted.runtimeTruthRoot === surface.runtimeTruthRoot || omitted.knowledgeDerivedDependencyRuntimeBound !== false) {
  fail('Omitting bounded-derived Knowledge evidence did not fail closed by runtime-root divergence.', {
    runtimeTruthRoot: surface.runtimeTruthRoot,
    omittedRuntimeTruthRoot: omitted.runtimeTruthRoot,
  }, 333);
}

const mutatedManifest = structuredClone(manifest);
if (!mutatedManifest?.foundationKnowledgeDerivedDependencyProof?.derivedKnowledge) {
  fail('Cannot construct bounded-derived Knowledge runtime evidence negative control.', {}, 334);
}
mutatedManifest.foundationKnowledgeDerivedDependencyProof.derivedKnowledge.confidence = 0.9;
const drift = foundationKnowledgeDerivedRuntimeEvidence({ binaryBytes, attestation: mutatedManifest });
if (drift.ok !== false || !drift.errors.some(error => error.code === 'RCL_KNOWLEDGE_DERIVED_RUNTIME_ATTESTATION_DRIFT')) {
  fail('Mutated bounded-derived Knowledge runtime evidence did not fail closed.', { drift }, 335);
}

const boundary = surface?.truthBoundary ?? {};
if (
  boundary.knowledgeDerivedDependencyEvidencePresent !== true
  || boundary.knowledgeDerivedDependencyRuntimeTruthBound !== true
  || boundary.runtimeTruthRootBindsKnowledgeDerivedDependencyEvidenceWhenPresent !== true
  || boundary.knowledgeDerivedDependencyBindingRemainsBounded !== true
  || boundary.knowledgeDerivedDependencyBindingDoesNotClaimRevisionsOrDecay !== true
  || boundary.knowledgeDerivedDependencyBindingDoesNotClaimDynamicDerivedExpressions !== true
  || boundary.knowledgeDerivedDependencyBindingDoesNotClaimUnrestrictedDependencies !== true
  || boundary.knowledgeDerivedDependencyBindingDoesNotClaimGlobalProviderRemoval !== true
  || boundary.knowledgeDerivedDependencyBindingDoesNotClaimFullHistoryParity !== true
) {
  fail('Cycle 92 runtime truth boundary drifted or overclaimed derived Knowledge coverage.', { boundary }, 336);
}

console.log(JSON.stringify({
  ok: true,
  status: 'RCL_CYCLE92_DERIVED_RUNTIME_TRUTH_BINDING_VERIFIED',
  runtimeTruthRoot: surface.runtimeTruthRoot,
  runtimeEvidenceRoot: evidence.runtimeEvidenceRoot,
  attestationRoot: evidence.attestationRoot,
  knowledgeReceiptRoot: evidence.knowledgeReceiptRoot,
  executionBinarySha256: evidence.executionBinarySha256,
  derivedKnowledge: evidence.derivedKnowledge,
  negativeControls: {
    omissionRootDivergence: true,
    mutatedEvidenceFailedClosed: true,
  },
  truthBoundary: {
    boundedDerivedKnowledgeOnly: true,
    revisionsAndDecayRemainProviderBound: true,
    dynamicDerivedExpressionsRemainProviderBound: true,
    unrestrictedDependenciesRemainProviderBound: true,
    providerBridgeRemovedGlobally: false,
    fullHistoryParityClaimed: false,
  },
}, null, 2));
