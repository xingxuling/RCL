#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const steps = [
  { code: 247, propagateChildStatus: true, name: 'cycle83-regression-proof-chain', args: ['scripts/dwac-cycle83-exit-probe.mjs'] },
  { code: 248, name: 'knowledge-bounded-multi-learn-real-c-attestation', args: ['scripts/verify-vercel-foundation-knowledge-multi-learn.mjs'] },
];

for (const step of steps) {
  const result = spawnSync(process.execPath, step.args, { stdio: 'inherit', env: process.env });
  if (result.error || result.status !== 0) {
    const exitCode = step.propagateChildStatus && Number.isInteger(result.status) ? result.status : step.code;
    console.error(JSON.stringify({
      ok: false,
      status: 'DWAC_CYCLE84_EXIT_PROBE_FAILURE',
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
  status: 'DWAC_CYCLE84_EXIT_PROBE_ALL_PASS',
  truthBoundary: {
    boundedContiguousMultiLearnRealCVerified: true,
    maxBoundedLearnDirectiveCount: 2,
    maxBoundedClaimCountPerLearn: 4,
    separateOrderedAtomicTransactionsRequired: true,
    exactReferenceNativeDomainReceiptParityRequired: true,
    crossLearnBoundaryRootContinuityRequired: true,
    canonicalRealCExecutionRequiredForVerifiedStatus: true,
    threeOrMoreLearnDirectivesNativeClaimed: false,
    nonLeadingOrInterleavedLearnNativeClaimed: false,
    dependenciesRevisionsDecayAndDerivedKnowledgeRemainProviderBound: true,
    fullHistoryParityClaimed: false,
    providerBridgeRemovedGlobally: false,
    allKnowledgeProgramsNativeClaimed: false,
    completeRuntimeClaimed: false,
    fullSelfHostingClaimed: false,
  },
}, null, 2));
