#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const steps = [
  { code: 64, name: 'cycle63-regression-proof-chain', args: ['scripts/dwac-cycle63-exit-probe.mjs'] },
  { code: 65, name: 'runtime-capability-truth-root-negative-controls', args: ['--test', 'tests/foundation-runtime-capability-truth-root.test.mjs'] },
  { code: 66, name: 'runtime-deployment-evidence-root-replay', args: ['scripts/verify-foundation-runtime-deployment-evidence-registry.mjs'] },
];

for (const step of steps) {
  const result = spawnSync(process.execPath, step.args, { stdio: 'inherit', env: process.env });
  if (result.error || result.status !== 0) {
    console.error(JSON.stringify({
      status: 'DWAC_CYCLE64_EXIT_PROBE_FAILURE',
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
  status: 'DWAC_CYCLE64_EXIT_PROBE_ALL_PASS',
  truthBoundary: {
    aggregateRuntimeTruthIsContentAddressed: true,
    deploymentEvidenceSetRootBindsPerDomainEvidenceRoots: true,
    completeEvidenceCoverageDoesNotClaimFullDomainNativeCoverage: true,
  },
}, null, 2));
