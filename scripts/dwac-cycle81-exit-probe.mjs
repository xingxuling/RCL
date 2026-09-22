#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const steps = [
  { code: 211, name: 'cycle80-regression-proof-chain', args: ['scripts/dwac-cycle80-exit-probe.mjs'] },
  { code: 212, name: 'cross-domain-history-runtime-truth-binding', args: ['scripts/verify-foundation-cross-domain-history-runtime-truth.mjs'] },
];

for (const step of steps) {
  const result = spawnSync(process.execPath, step.args, { stdio: 'inherit', env: process.env });
  if (result.error || result.status !== 0) {
    console.error(JSON.stringify({
      status: 'DWAC_CYCLE81_EXIT_PROBE_FAILURE',
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
  status: 'DWAC_CYCLE81_EXIT_PROBE_ALL_PASS',
  truthBoundary: {
    cycle80RegressionProofChainRemainsRequired: true,
    crossDomainHistoryRuntimeTruthBound: true,
    exactCrossDomainEvidenceRootRequired: true,
    exactCrossDomainHistoryRootRequired: true,
    exactNativeBinaryIdentityRequired: true,
    negativeControlsRequired: true,
    stagedGeneticHistoryIncluded: false,
    livingStagedHistoryIncluded: false,
    fullHistoryParityClaimed: false,
    allFoundationDomainsHistoryParityClaimed: false,
    completeRuntimeClaimed: false,
    fullSelfHostingClaimed: false,
  },
}, null, 2));
