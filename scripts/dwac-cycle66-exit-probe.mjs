#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const steps = [
  { code: 70, name: 'cycle65-regression-proof-chain', args: ['scripts/dwac-cycle65-exit-probe.mjs'] },
  { code: 71, name: 'runtime-health-bridge-topology-negative-controls', args: ['--test', 'tests/foundation-runtime-health-truth.test.mjs'] },
  { code: 72, name: 'runtime-health-canonical-bridge-topology', args: ['scripts/verify-vercel-runtime-health-truth.mjs'] },
];

for (const step of steps) {
  const result = spawnSync(process.execPath, step.args, { stdio: 'inherit', env: process.env });
  if (result.error || result.status !== 0) {
    console.error(JSON.stringify({
      status: 'DWAC_CYCLE66_EXIT_PROBE_FAILURE',
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
  status: 'DWAC_CYCLE66_EXIT_PROBE_ALL_PASS',
  truthBoundary: {
    healthFailsClosedOnProviderBridgeTopologyDrift: true,
    executableBridgeRegistryIsCanonicalTopology: true,
    bridgeTopologyProofDoesNotClaimStatePathSemanticParity: true,
  },
}, null, 2));
