#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const steps = [
  { code: 246, propagateChildStatus: true, name: 'cycle86-regression-proof-chain', args: ['scripts/dwac-cycle86-exit-probe.mjs'] },
  { code: 247, name: 'knowledge-bounded-multi-learn-max-boundary-runtime-bind', args: ['scripts/bind-vercel-foundation-knowledge-multi-learn-max-boundary-runtime-truth.mjs'] },
  { code: 248, name: 'knowledge-bounded-multi-learn-max-boundary-runtime-negative-controls', args: ['scripts/verify-foundation-knowledge-multi-learn-max-boundary-runtime-negative-control.mjs'] },
  { code: 249, name: 'knowledge-runtime-truth-single-source-guard', args: ['scripts/verify-foundation-knowledge-runtime-truth-single-source.mjs'] },
  { code: 250, name: 'knowledge-canonical-runtime-truth-regression', args: ['scripts/verify-foundation-knowledge-deployment-truth.mjs'] },
  { code: 251, name: 'knowledge-multi-learn-max-boundary-canonical-runtime-binding', args: ['scripts/verify-cycle87-knowledge-multi-learn-max-boundary-runtime-binding.mjs'] },
];

for (const step of steps) {
  const result = spawnSync(process.execPath, step.args, { stdio: 'inherit', env: process.env });
  if (result.error || result.status !== 0) {
    const exitCode = step.propagateChildStatus && Number.isInteger(result.status) ? result.status : step.code;
    console.error(JSON.stringify({
      ok: false,
      status: 'DWAC_CYCLE87_EXIT_PROBE_FAILURE',
      probeExitCode: exitCode,
      step: step.name,
      childExitCode: result.status ?? null,
      error: result.error?.message ?? null,
    }, null, 2));
    process.exit(exitCode ?? 1);
  }
}

console.log(JSON.stringify({
  ok: true,
  status: 'DWAC_CYCLE87_EXIT_PROBE_ALL_PASS',
  truthBoundary: {
    boundedContiguousMultiLearnRealCVerified: true,
    boundedContiguousMultiLearnCanonicalRuntimeTruthBound: true,
    maxDeclaredMultiLearnBoundaryRealCVerified: true,
    maxDeclaredMultiLearnBoundaryCanonicalRuntimeTruthBound: true,
    maxBoundedLearnDirectiveCount: 2,
    maxBoundedClaimCountPerLearn: 4,
    behavioralVerifiedClaimCount: 3,
    maxBoundaryVerifiedClaimCount: 8,
    exactBehavioralAndMaxBoundaryAttestationsRemainDistinct: true,
    exactNativeBinaryIdentityRequired: true,
    exactMaxBoundaryAttestationRootRequired: true,
    exactMaxBoundaryKnowledgeReceiptRootRequired: true,
    exactEightClaimFormationTopologyRequired: true,
    runtimeTruthRootBindsMultiLearnMaxBoundaryEvidence: true,
    threeOrMoreLearnDirectivesNativeClaimed: false,
    fiveOrMoreClaimsPerLearnNativeClaimed: false,
    nonLeadingOrInterleavedLearnNativeClaimed: false,
    dependenciesRevisionsDecayAndDerivedKnowledgeRemainProviderBound: true,
    providerBridgeRemovedGlobally: false,
    allKnowledgeProgramsNativeClaimed: false,
    fullHistoryParityClaimed: false,
    completeRuntimeClaimed: false,
    fullSelfHostingClaimed: false,
  },
}, null, 2));
