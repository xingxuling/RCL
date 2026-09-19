#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const steps = [
  { code: 73, name: 'cycle66-regression-proof-chain', args: ['scripts/dwac-cycle66-exit-probe.mjs'] },
  { code: 74, name: 'runtime-health-native-registry-negative-controls', args: ['--test', 'tests/foundation-runtime-health-truth.test.mjs'] },
  { code: 75, name: 'native-deployment-health-canonical-bridge-registry', args: ['scripts/verify-vercel-health-evidence.mjs'] },
  { code: 76, name: 'runtime-health-native-registry-truth', args: ['scripts/verify-vercel-runtime-health-truth.mjs'] },
];

for (const step of steps) {
  const result = spawnSync(process.execPath, step.args, { stdio: 'inherit', env: process.env });
  if (result.error || result.status !== 0) {
    console.error(JSON.stringify({
      status: 'DWAC_CYCLE67_EXIT_PROBE_FAILURE',
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
  status: 'DWAC_CYCLE67_EXIT_PROBE_ALL_PASS',
  truthBoundary: {
    nativeDeploymentUsesExecutableBridgeRegistryAsCanonicalTopology: true,
    deploymentHealthVerifierUsesExecutableBridgeRegistryAsCanonicalTopology: true,
    runtimeHealthFailsClosedOnNativeDeploymentRegistryRootDrift: true,
    bridgeTopologyProofDoesNotClaimStatePathSemanticParity: true,
  },
}, null, 2));
