#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const steps = [
  { code: 191, name: 'cycle78-regression-proof-chain', args: ['scripts/dwac-cycle78-exit-probe.mjs'] },
  { code: 192, name: 'release-deployment-source-parity-unit-negative-controls', args: ['--test', 'tests/foundation-release-deployment-source-parity.test.mjs'] },
  { code: 193, name: 'developer-release-deployment-source-parity-bind', args: ['scripts/bind-vercel-developer-release-runtime-truth.mjs'] },
];

for (const step of steps) {
  const result = spawnSync(process.execPath, step.args, { stdio: 'inherit', env: process.env });
  if (result.error || result.status !== 0) {
    console.error(JSON.stringify({
      status: 'DWAC_CYCLE79_EXIT_PROBE_FAILURE',
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
  status: 'DWAC_CYCLE79_EXIT_PROBE_ALL_PASS',
  truthBoundary: {
    developerReleaseRuntimeTruthContractRemainsRequired: true,
    exactReleaseDeploymentSourceContractParityVerified: true,
    developerReleaseArtifactHashVerifiedAtBuildTime: true,
    deployedSourceTreeRuntimeTruthContractReverified: true,
    runtimeCapabilityTruthMustMatchDeploymentContract: true,
    releaseRuntimeTruthSurfaceMaterialized: true,
    releaseArtifactRetainedInDeploymentClaimed: false,
    releaseArtifactInstalledAsRuntimeClaimed: false,
    deploymentBinaryParityClaimed: false,
    completeRuntimeClaimed: false,
    fullSelfHostingClaimed: false,
  },
}, null, 2));
