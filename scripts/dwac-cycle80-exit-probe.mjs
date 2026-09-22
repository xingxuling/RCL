#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const steps = [
  { code: 201, name: 'cycle79-regression-proof-chain', args: ['scripts/dwac-cycle79-exit-probe.mjs'] },
  { code: 202, name: 'cross-domain-history-root-parity-unit-negative-controls', args: ['--test', 'tests/foundation-cross-domain-history-root-parity.test.mjs'] },
  { code: 203, name: 'cross-domain-history-real-c-proof', args: ['scripts/verify-vercel-foundation-cross-domain-history.mjs'] },
];

for (const step of steps) {
  const result = spawnSync(process.execPath, step.args, { stdio: 'inherit', env: process.env });
  if (result.error || result.status !== 0) {
    console.error(JSON.stringify({
      status: 'DWAC_CYCLE80_EXIT_PROBE_FAILURE',
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
  status: 'DWAC_CYCLE80_EXIT_PROBE_ALL_PASS',
  truthBoundary: {
    cycle79RegressionProofChainRemainsRequired: true,
    boundedCrossDomainHistoryRootParityVerified: true,
    contiguousReferenceAndNativeBoundaryRootsRequired: true,
    exactTransitionValuesRequired: true,
    crossDomainOrderEvidenceRequired: true,
    realCNativeExecutionRequired: true,
    stagedGeneticHistoryIncluded: false,
    livingStagedHistoryIncluded: false,
    fullHistoryParityClaimed: false,
    allFoundationDomainsHistoryParityClaimed: false,
    completeRuntimeClaimed: false,
    fullSelfHostingClaimed: false,
  },
}, null, 2));
