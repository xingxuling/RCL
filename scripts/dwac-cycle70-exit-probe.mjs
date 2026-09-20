#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const steps = [
  { code: 87, name: 'cycle69-regression-proof-chain', args: ['scripts/dwac-cycle69-exit-probe.mjs'] },
  { code: 88, name: 'provider-bridge-statepath-attestation-bind', args: ['scripts/bind-vercel-foundation-native-bridge-statepath-attestation.mjs'] },
  { code: 89, name: 'provider-bridge-statepath-negative-controls', args: ['--test', 'tests/foundation-native-bridge-statepath-attestation.test.mjs'] },
  { code: 90, name: 'provider-bridge-statepath-deployment-attestation', args: ['scripts/verify-vercel-foundation-native-bridge-statepath-attestation.mjs'] },
  { code: 91, name: 'deployment-health-regression', args: ['scripts/verify-vercel-health-evidence.mjs'] },
  { code: 92, name: 'runtime-health-truth-regression', args: ['scripts/verify-vercel-runtime-health-truth.mjs'] },
];

for (const step of steps) {
  const result = spawnSync(process.execPath, step.args, { stdio: 'inherit', env: process.env });
  if (result.error || result.status !== 0) {
    console.error(JSON.stringify({
      status: 'DWAC_CYCLE70_EXIT_PROBE_FAILURE',
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
  status: 'DWAC_CYCLE70_EXIT_PROBE_ALL_PASS',
  truthBoundary: {
    providerBridgeStatePathsBoundToExecutableCanonicalRegistry: true,
    statePathsBoundToExactRenderedProviderCallSources: true,
    semanticResultPathsBoundToObservedReplayEvidence: true,
    statePathAttestationFailsClosedOnRegistryOrSemanticDrift: true,
    statePathSemanticAttestationDoesNotClaimDirectNativeExecution: true,
  },
}, null, 2));
