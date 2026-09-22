#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const steps = [
  { code: 274, propagateChildStatus: true, name: 'cycle84-regression-proof-chain', args: ['scripts/dwac-cycle84-exit-probe.mjs'] },
  { code: 275, name: 'knowledge-bounded-multi-learn-runtime-bind', args: ['scripts/bind-vercel-foundation-knowledge-multi-learn-runtime-truth.mjs'] },
  { code: 276, name: 'knowledge-bounded-multi-learn-runtime-negative-controls', args: ['scripts/verify-foundation-knowledge-multi-learn-runtime-negative-control.mjs'] },
  { code: 277, name: 'knowledge-runtime-truth-single-source-guard', args: ['scripts/verify-foundation-knowledge-runtime-truth-single-source.mjs'] },
  { code: 278, name: 'knowledge-bounded-multi-learn-canonical-runtime-truth', args: ['scripts/verify-foundation-knowledge-deployment-truth.mjs'] },
];

for (const step of steps) {
  const result = spawnSync(process.execPath, step.args, { stdio: 'inherit', env: process.env });
  if (result.error || result.status !== 0) {
    const exitCode = step.propagateChildStatus && Number.isInteger(result.status) ? result.status : step.code;
    console.error(JSON.stringify({
      ok: false,
      status: 'DWAC_CYCLE85_EXIT_PROBE_FAILURE',
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
  status: 'DWAC_CYCLE85_EXIT_PROBE_ALL_PASS',
  truthBoundary: {
    boundedContiguousMultiLearnRealCVerified: true,
    boundedContiguousMultiLearnCanonicalRuntimeTruthBound: true,
    maxBoundedLearnDirectiveCount: 2,
    maxBoundedClaimCountPerLearn: 4,
    verifiedLearnDirectiveCount: 2,
    verifiedClaimCount: 3,
    exactMultiLearnAttestationRootRequired: true,
    exactMultiLearnReceiptRootRequired: true,
    exactNativeBinaryIdentityRequired: true,
    separateOrderedAtomicTransactionsRequired: true,
    crossLearnBoundaryRootContinuityRequired: true,
    runtimeTruthRootBindsMultiLearnRuntimeEvidence: true,
    threeOrMoreLearnDirectivesNativeClaimed: false,
    nonLeadingOrInterleavedLearnNativeClaimed: false,
    dependenciesRevisionsDecayAndDerivedKnowledgeRemainProviderBound: true,
    providerBridgeRemovedGlobally: false,
    allKnowledgeProgramsNativeClaimed: false,
    fullHistoryParityClaimed: false,
    completeRuntimeClaimed: false,
    fullSelfHostingClaimed: false,
  },
}, null, 2));
