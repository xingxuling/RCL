#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const steps = [
  { code: 151, name: 'cycle74-regression-proof-chain', args: ['scripts/dwac-cycle74-exit-probe.mjs'] },
  { code: 152, name: 'developer-release-runtime-truth-contract', args: ['scripts/verify-developer-release-runtime-truth-contract.mjs'] },
];

for (const step of steps) {
  const result = spawnSync(process.execPath, step.args, { stdio: 'inherit', env: process.env });
  if (result.error || result.status !== 0) {
    console.error(JSON.stringify({
      status: 'DWAC_CYCLE75_EXIT_PROBE_FAILURE',
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
  status: 'DWAC_CYCLE75_EXIT_PROBE_ALL_PASS',
  truthBoundary: {
    developerReleaseRuntimeTruthContractBound: true,
    exactPackagedRuntimeTruthSourceBytesBound: true,
    deploymentMustReverifyRuntimeTruth: true,
    deploymentEvidenceClaimed: false,
    runtimeSurfaceAvailabilityClaimed: false,
    providerBridgeRemovedGlobally: false,
    completeRuntimeClaimed: false,
    fullSelfHostingClaimed: false,
  },
}, null, 2));
