#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const steps = [
  { code: 83, name: 'cycle68-regression-proof-chain', args: ['scripts/dwac-cycle68-exit-probe.mjs'] },
  { code: 84, name: 'runtime-federation-registry-attestation', args: ['scripts/verify-vercel-runtime-federation-registry-binding.mjs'] },
  { code: 85, name: 'deployment-health-regression', args: ['scripts/verify-vercel-health-evidence.mjs'] },
  { code: 86, name: 'runtime-health-truth-regression', args: ['scripts/verify-vercel-runtime-health-truth.mjs'] },
];

for (const step of steps) {
  const result = spawnSync(process.execPath, step.args, { stdio: 'inherit', env: process.env });
  if (result.error || result.status !== 0) {
    console.error(JSON.stringify({
      status: 'DWAC_CYCLE69_EXIT_PROBE_FAILURE',
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
  status: 'DWAC_CYCLE69_EXIT_PROBE_ALL_PASS',
  truthBoundary: {
    runtimeHealthFailsClosedOnFederationRegistryAttestationDrift: true,
    runtimeFederationSummaryExposesRegistryIdentity: true,
    federationProducerAndRuntimeConsumerShareCanonicalRegistryIdentity: true,
    registryBindingDoesNotClaimStatePathSemanticParity: true,
    providerBridgeDoesNotImplyDirectNativeExecution: true,
  },
}, null, 2));
