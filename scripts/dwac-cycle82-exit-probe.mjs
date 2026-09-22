#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const steps = [
  { code: 221, name: 'cycle81-regression-proof-chain', args: ['scripts/dwac-cycle81-exit-probe.mjs'] },
  { code: 222, name: 'runtime-truth-static-dependency-closure', args: ['scripts/verify-foundation-runtime-truth-dependency-closure.mjs'] },
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
    cycle81RegressionProofChainRemainsRequired: true,
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
