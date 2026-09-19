#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const steps = [
  { code: 67, name: 'cycle64-regression-proof-chain', args: ['scripts/dwac-cycle64-exit-probe.mjs'] },
  { code: 68, name: 'runtime-health-truth-negative-controls', args: ['--test', 'tests/foundation-runtime-health-truth.test.mjs'] },
  { code: 69, name: 'runtime-health-canonical-root-parity', args: ['scripts/verify-vercel-runtime-health-truth.mjs'] },
];

for (const step of steps) {
  const result = spawnSync(process.execPath, step.args, { stdio: 'inherit', env: process.env });
  if (result.error || result.status !== 0) {
    console.error(JSON.stringify({
      status: 'DWAC_CYCLE65_EXIT_PROBE_FAILURE',
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
  status: 'DWAC_CYCLE65_EXIT_PROBE_ALL_PASS',
  truthBoundary: {
    canonicalHealthFailsClosedOnRuntimeTruthDrift: true,
    canonicalHealthBindsAggregateRuntimeTruthRoot: true,
    completeEvidenceCoverageDoesNotClaimFullDomainNativeCoverage: true,
  },
}, null, 2));
