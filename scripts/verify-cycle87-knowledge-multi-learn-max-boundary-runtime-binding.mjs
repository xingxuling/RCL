#!/usr/bin/env node
import { runtimeCapabilityTruthSurface } from '../api/capability-truth.mjs';

function isSha256(value) { return typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value); }
function fail(message, details = {}, exitCode = 1) {
  console.error(JSON.stringify({
    ok: false,
    status: 'RCL_CYCLE87_KNOWLEDGE_MULTI_LEARN_MAX_BOUNDARY_RUNTIME_BINDING_FAILED',
    message,
    exitCode,
    ...details,
  }, null, 2));
  process.exit(exitCode);
}

const surface = runtimeCapabilityTruthSurface();
const multi = surface?.knowledgeMultiLearnEvidence ?? null;
const runtimeTruth = surface?.runtimeTruth ?? {};
const boundary = surface?.truthBoundary ?? {};
const expectedPaths = [
  'mind.trusted', 'mind.score', 'mind.label', 'mind.rank',
  'context.ready', 'context.weight', 'context.zone', 'context.level',
];

if (
  surface?.ok !== true
  || surface?.status !== 'RCL_FOUNDATION_RUNTIME_CAPABILITY_TRUTH_VERIFIED'
  || multi?.ok !== true
  || multi?.present !== true
  || multi?.verified !== true
  || multi?.status !== 'runtime-bound'
  || multi?.loweredLearnCount !== 2
  || multi?.loweredClaimCount !== 3
  || multi?.maxBoundaryPresent !== true
  || multi?.maxBoundaryVerified !== true
  || multi?.maxBoundaryStatus !== 'runtime-bound'
  || multi?.maxBoundaryLoweredLearnCount !== 2
  || multi?.maxBoundaryLoweredClaimCount !== 8
  || JSON.stringify(multi?.maxBoundaryDeclarations) !== JSON.stringify(['mind', 'context'])
  || JSON.stringify(multi?.maxBoundaryClaimPaths) !== JSON.stringify(expectedPaths)
) {
  fail('Canonical runtime surface did not preserve the Cycle-85 behavioral specimen while binding the exact Cycle-86 2x4 real-C proof.', { surface, multi }, 241);
}

const formedRoots = (multi?.maxBoundaryFormedAtRoots ?? []).map(entry => entry?.root);
const formedPaths = (multi?.maxBoundaryFormedAtRoots ?? []).map(entry => entry?.path);
for (const value of [
  surface?.runtimeTruthRoot,
  multi?.runtimeEvidenceRoot,
  multi?.binarySha256,
  multi?.executionBinarySha256,
  multi?.attestationRoot,
  multi?.knowledgeReceiptRoot,
  multi?.maxBoundaryAttestationRoot,
  multi?.maxBoundaryExecutionBinarySha256,
  multi?.maxBoundaryNativeVmExecutionAttestationRoot,
  multi?.maxBoundaryKnowledgeReceiptRoot,
  ...formedRoots,
]) {
  if (!isSha256(value)) fail('Cycle-87 runtime truth lost a required content-addressed binary/evidence/receipt/formation root.', { value, multi }, 242);
}
if (
  JSON.stringify(formedPaths) !== JSON.stringify(expectedPaths)
  || formedRoots.length !== 8
  || new Set(formedRoots).size !== 8
  || multi?.binarySha256 !== multi?.executionBinarySha256
  || multi?.binarySha256 !== multi?.maxBoundaryExecutionBinarySha256
) {
  fail('Cycle-87 runtime truth lost exact binary identity or the global eight-root formation topology.', {
    formedPaths,
    formedRoots,
    binarySha256: multi?.binarySha256 ?? null,
    behavioralExecutionBinarySha256: multi?.executionBinarySha256 ?? null,
    maxBoundaryExecutionBinarySha256: multi?.maxBoundaryExecutionBinarySha256 ?? null,
  }, 243);
}

const maxParity = multi?.maxBoundaryParity ?? {};
const multiBoundary = multi?.truthBoundary ?? {};
if (
  maxParity.state !== true
  || maxParity.semanticStateRoot !== true
  || maxParity.nativeStateRootVerified !== true
  || maxParity.nativeStateRootParity !== true
  || maxParity.knowledgeReceipt !== true
  || maxParity.learnTransactionOrder !== true
  || maxParity.learnBoundaryContinuity !== true
  || maxParity.nativeExecutionAttestation !== true
  || multiBoundary.maxBoundaryRuntimeTruthBound !== true
  || multiBoundary.maxBoundaryRealCVerified !== true
  || multiBoundary.maxBoundedLearnDirectiveCount !== 2
  || multiBoundary.maxBoundedClaimCountPerLearn !== 4
  || multiBoundary.globalSequentialClaimFormationRootsRequired !== true
  || multiBoundary.fiveOrMoreClaimsPerLearnNativeClaimed !== false
  || multiBoundary.threeOrMoreLearnDirectivesNativeClaimed !== false
  || multiBoundary.providerBridgeRemovedGlobally !== false
  || multiBoundary.allKnowledgeProgramsNativeClaimed !== false
  || multiBoundary.fullHistoryParityClaimed !== false
) {
  fail('Cycle-87 max-boundary runtime truth parity/boundary drifted or overclaimed coverage.', { maxParity, multiBoundary }, 244);
}

if (
  runtimeTruth.knowledgeMultiLearnRuntimeBound !== true
  || runtimeTruth.knowledgeMultiLearnRuntimeEvidenceRoot !== multi.runtimeEvidenceRoot
  || runtimeTruth.knowledgeMultiLearnLoweredClaimCount !== 3
  || runtimeTruth.knowledgeMultiLearnMaxBoundaryRuntimeBound !== true
  || runtimeTruth.knowledgeMultiLearnMaxBoundaryAttestationRoot !== multi.maxBoundaryAttestationRoot
  || runtimeTruth.knowledgeMultiLearnMaxBoundaryKnowledgeReceiptRoot !== multi.maxBoundaryKnowledgeReceiptRoot
  || runtimeTruth.knowledgeMultiLearnMaxBoundaryExecutionBinarySha256 !== multi.maxBoundaryExecutionBinarySha256
  || runtimeTruth.knowledgeMultiLearnMaxBoundaryLoweredLearnCount !== 2
  || runtimeTruth.knowledgeMultiLearnMaxBoundaryLoweredClaimCount !== 8
  || JSON.stringify(runtimeTruth.knowledgeMultiLearnMaxBoundaryClaimPaths) !== JSON.stringify(expectedPaths)
  || JSON.stringify(runtimeTruth.knowledgeMultiLearnMaxBoundaryFormedAtRoots) !== JSON.stringify(formedRoots)
  || boundary.knowledgeMultiLearnEvidencePresent !== true
  || boundary.knowledgeMultiLearnRuntimeTruthBound !== true
  || boundary.knowledgeMultiLearnMaxBoundaryEvidencePresent !== true
  || boundary.knowledgeMultiLearnMaxBoundaryRuntimeTruthBound !== true
  || boundary.runtimeTruthRootBindsKnowledgeMultiLearnMaxBoundaryEvidenceWhenPresent !== true
  || boundary.knowledgeMultiLearnBindingDoesNotClaimThreeOrMoreLearnDirectives !== true
  || boundary.knowledgeMultiLearnBindingDoesNotClaimFiveOrMoreClaimsPerLearn !== true
  || boundary.knowledgeMultiLearnBindingDoesNotClaimNonLeadingOrInterleavedLearn !== true
  || boundary.knowledgeMultiLearnBindingDoesNotClaimFullHistoryParity !== true
  || boundary.knowledgeMultiLearnBindingDoesNotClaimGlobalProviderRemoval !== true
) {
  fail('Canonical runtimeTruthRoot did not bind the 2x4 max-boundary evidence identity and conservative truth boundary.', {
    runtimeTruth,
    boundary,
    multi,
  }, 245);
}

console.log(JSON.stringify({
  ok: true,
  status: 'RCL_CYCLE87_KNOWLEDGE_MULTI_LEARN_MAX_BOUNDARY_RUNTIME_BINDING_VERIFIED',
  runtimeTruthRoot: surface.runtimeTruthRoot,
  runtimeEvidenceRoot: multi.runtimeEvidenceRoot,
  behavioralAttestationRoot: multi.attestationRoot,
  maxBoundaryAttestationRoot: multi.maxBoundaryAttestationRoot,
  maxBoundaryKnowledgeReceiptRoot: multi.maxBoundaryKnowledgeReceiptRoot,
  executionBinarySha256: multi.maxBoundaryExecutionBinarySha256,
  maxBoundaryFormedAtRoots: multi.maxBoundaryFormedAtRoots,
  truthBoundary: {
    behavioralThreeClaimRuntimeTruthPreserved: true,
    maxDeclaredTwoByFourBoundaryRuntimeTruthBound: true,
    exactNativeBinaryIdentityRequired: true,
    exactEightClaimFormationTopologyRequired: true,
    threeOrMoreLearnDirectivesNativeClaimed: false,
    fiveOrMoreClaimsPerLearnNativeClaimed: false,
    fullHistoryParityClaimed: false,
    providerBridgeRemovedGlobally: false,
    completeRuntimeClaimed: false,
    fullSelfHostingClaimed: false,
  },
}, null, 2));
