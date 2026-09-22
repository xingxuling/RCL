#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

// Cycle 82 preserves the exact Cycle 80/81 proof ordering while flattening
// wrappers so external deployment failures identify the precise regressed gate.
const steps = [
  { code: 221, name: 'cycle79-regression-proof-chain', args: ['scripts/dwac-cycle79-exit-probe.mjs'] },
  { code: 222, name: 'cycle80-cross-domain-history-root-parity-unit-negative-controls', args: ['--test', 'tests/foundation-cross-domain-history-root-parity.test.mjs'] },
  { code: 223, name: 'cycle80-cross-domain-history-real-c-proof', args: ['scripts/verify-vercel-foundation-cross-domain-history.mjs'] },
  { code: 224, name: 'cycle81-cross-domain-history-runtime-truth-binding', args: ['scripts/verify-foundation-cross-domain-history-runtime-truth.mjs'] },
  { code: 225, name: 'runtime-truth-static-dependency-closure', args: ['scripts/verify-foundation-runtime-truth-dependency-closure.mjs'] },
];

for (const step of steps) {
  const result = spawnSync(process.execPath, step.args, { stdio: 'inherit', env: process.env });
  if (result.error || result.status !== 0) {
    console.error(JSON.stringify({
      status: 'DWAC_CYCLE82_EXIT_PROBE_FAILURE',
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
  status: 'DWAC_CYCLE82_EXIT_PROBE_ALL_PASS',
  truthBoundary: {
    cycle79RegressionProofChainRemainsRequired: true,
    cycle80CrossDomainHistoryProofRemainsRequired: true,
    cycle81CrossDomainHistoryRuntimeTruthRemainsRequired: true,
    runtimeTruthStaticRepositoryLocalDependencyClosureBound: true,
    exactTransitiveSourceBytesRequired: true,
    unresolvedRelativeImportsFailClosed: true,
    dynamicRuntimeResourcesClaimedByDependencyClosure: false,
    externalPackageByteClosureClaimed: false,
    deploymentEvidenceClaimedByDeveloperReleaseContract: false,
    fullHistoryParityClaimed: false,
    completeRuntimeClaimed: false,
    fullSelfHostingClaimed: false,
  },
}, null, 2));
