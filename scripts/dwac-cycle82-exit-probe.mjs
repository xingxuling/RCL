#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

// Cycle 82 flattens the Cycle 81 wrapper into its two canonical child gates so
// an external deployment failure identifies the exact regressed boundary while
// preserving the same proof order and fail-closed semantics.
const steps = [
  { code: 221, name: 'cycle80-regression-proof-chain', args: ['scripts/dwac-cycle80-exit-probe.mjs'] },
  { code: 222, name: 'cycle81-cross-domain-history-runtime-truth-binding', args: ['scripts/verify-foundation-cross-domain-history-runtime-truth.mjs'] },
  { code: 223, name: 'runtime-truth-static-dependency-closure', args: ['scripts/verify-foundation-runtime-truth-dependency-closure.mjs'] },
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
    cycle80RegressionProofChainRemainsRequired: true,
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
