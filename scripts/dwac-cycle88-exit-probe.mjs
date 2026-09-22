#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const steps = [
  { code: 252, propagateChildStatus: true, name: 'cycle87-regression-proof-chain', args: ['scripts/dwac-cycle87-exit-probe.mjs'] },
  { code: 253, name: 'cross-domain-history-root-parity-three-domain-unit-negative-controls', args: ['--test', 'tests/foundation-cross-domain-history-root-parity.test.mjs'] },
  { code: 254, name: 'cross-domain-neural-history-real-c-proof', args: ['scripts/verify-vercel-foundation-cross-domain-neural-history.mjs'] },
];

for (const step of steps) {
  const result = spawnSync(process.execPath, step.args, { stdio: 'inherit', env: process.env });
  if (result.error || result.status !== 0) {
    const exitCode = step.propagateChildStatus && Number.isInteger(result.status) ? result.status : step.code;
    console.error(JSON.stringify({
      ok: false,
      status: 'DWAC_CYCLE88_EXIT_PROBE_FAILURE',
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
  status: 'DWAC_CYCLE88_EXIT_PROBE_ALL_PASS',
  route: {
    decisionBasis: 'DWAC_SOURCE_CONTRACT_REPLAY',
    schedulerMode: 'NORTH_STAR',
    implementationMode: 'DEEP_DEVELOPMENT',
    sovereigntyGate: 'AUTONOMOUS',
  },
  truthBoundary: {
    cycle87RegressionProofChainRemainsRequired: true,
    boundedPhysicalPerceptionNeuralDirectHistoryRootParityVerified: true,
    exactCanonicalRealCBinaryRequired: true,
    contiguousReferenceAndNativeBoundaryRootsRequired: true,
    exactNeuralTransitionValuesRequired: true,
    crossDomainOrderEvidenceRequired: true,
    canonicalCrossDomainRuntimeTruthBindingClaimed: false,
    stagedGeneticHistoryIncluded: false,
    livingStagedHistoryIncluded: false,
    fullHistoryParityClaimed: false,
    allFoundationDomainsHistoryParityClaimed: false,
    completeRuntimeClaimed: false,
    fullSelfHostingClaimed: false,
  },
}, null, 2));
