#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const steps = [
  { code: 298, propagateChildStatus: true, name: 'cycle85-regression-proof-chain', args: ['scripts/dwac-cycle85-exit-probe.mjs'] },
  { code: 299, name: 'knowledge-bounded-multi-learn-max-boundary-real-c-attestation', args: ['scripts/verify-vercel-foundation-knowledge-multi-learn-max-boundary.mjs'] },
  { code: 300, name: 'knowledge-bounded-multi-learn-max-boundary-negative-controls', args: ['scripts/verify-foundation-knowledge-multi-learn-max-boundary-negative-control.mjs'] },
];

for (const step of steps) {
  const result = spawnSync(process.execPath, step.args, { stdio: 'inherit', env: process.env });
  if (result.error || result.status !== 0) {
    const exitCode = step.propagateChildStatus && Number.isInteger(result.status) ? result.status : step.code;
    console.error(JSON.stringify({
      ok: false,
      status: 'DWAC_CYCLE86_EXIT_PROBE_FAILURE',
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
  status: 'DWAC_CYCLE86_EXIT_PROBE_ALL_PASS',
  truthBoundary: {
    boundedContiguousMultiLearnRealCVerified: true,
    maxDeclaredMultiLearnBoundaryRealCVerified: true,
    maxBoundedLearnDirectiveCount: 2,
    maxBoundedClaimCountPerLearn: 4,
    verifiedLearnDirectiveCount: 2,
    verifiedClaimCount: 8,
    exactNativeBinaryIdentityRequired: true,
    exactReferenceNativeStateParityRequired: true,
    exactReferenceNativeSemanticRootParityRequired: true,
    exactReferenceNativeDomainReceiptParityRequired: true,
    separateOrderedAtomicTransactionsRequired: true,
    crossLearnBoundaryRootContinuityRequired: true,
    globalSequentialClaimFormationRootsRequired: true,
    overBoundaryFiveClaimsPerLearnFailClosed: true,
    overBoundaryThreeLearnsFailClosed: true,
    threeOrMoreLearnDirectivesNativeClaimed: false,
    fiveOrMoreClaimsPerLearnNativeClaimed: false,
    nonLeadingOrInterleavedLearnNativeClaimed: false,
    dependenciesRevisionsDecayAndDerivedKnowledgeRemainProviderBound: true,
    maxBoundaryRuntimeTruthBindingClaimed: false,
    providerBridgeRemovedGlobally: false,
    allKnowledgeProgramsNativeClaimed: false,
    fullHistoryParityClaimed: false,
    completeRuntimeClaimed: false,
    fullSelfHostingClaimed: false,
  },
}, null, 2));
