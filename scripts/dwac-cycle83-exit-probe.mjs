#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const steps = [
  { code: 244, name: 'cycle82-regression-proof-chain', args: ['scripts/dwac-cycle82-exit-probe.mjs'] },
  { code: 245, name: 'knowledge-single-and-multi-claim-regression', args: ['--test', 'tests/foundation-knowledge-direct-lowering.test.mjs'] },
  { code: 246, name: 'knowledge-bounded-multi-learn-direct-lowering', args: ['--test', 'tests/foundation-knowledge-multi-learn-direct-lowering.test.mjs'] },
];

for (const step of steps) {
  const result = spawnSync(process.execPath, step.args, { stdio: 'inherit', env: process.env });
  if (result.error || result.status !== 0) {
    console.error(JSON.stringify({
      ok: false,
      status: 'DWAC_CYCLE83_EXIT_PROBE_FAILURE',
      probeExitCode: step.code,
      step: step.name,
      childExitCode: result.status ?? null,
      error: result.error?.message ?? null,
    }, null, 2));
    process.exit(step.code);
  }
}

console.log(JSON.stringify({
  ok: true,
  status: 'DWAC_CYCLE83_EXIT_PROBE_ALL_PASS',
  truthBoundary: {
    boundedContiguousMultiLearnDirectLoweringVerified: true,
    maxBoundedLearnDirectiveCount: 2,
    maxBoundedClaimCountPerLearn: 4,
    distinctLearnDeclarationNamesRequired: true,
    globallyUniqueLearnedClaimPathsRequired: true,
    multipleLearnDirectivesRemainSeparateOrderedAtomicTransactions: true,
    duplicateLearnReplayClaimed: false,
    threeOrMoreLearnDirectivesNativeClaimed: false,
    dependenciesRevisionsDecayAndDerivedKnowledgeRemainProviderBound: true,
    fullHistoryParityClaimed: false,
    providerBridgeRemovedGlobally: false,
    allKnowledgeProgramsNativeClaimed: false,
    completeRuntimeClaimed: false,
    fullSelfHostingClaimed: false,
  },
}, null, 2));
