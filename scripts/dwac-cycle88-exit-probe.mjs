#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const steps = [
  { code: 252, propagateChildStatus: true, name: 'cycle87-regression-proof-chain', args: ['scripts/dwac-cycle87-exit-probe.mjs'] },
  { code: 253, name: 'three-domain-history-root-unit-negative-controls', args: ['--test', 'tests/foundation-cross-domain-history-root-parity.test.mjs'] },
  { code: 254, name: 'physical-perception-neural-runtime-truth-binding', args: ['scripts/verify-cycle88-cross-domain-neural-history-binding.mjs'] },
  { code: 255, name: 'runtime-truth-static-dependency-closure-final', args: ['scripts/verify-foundation-runtime-truth-dependency-closure.mjs'] },
];

for (const step of steps) {
  const result = spawnSync(process.execPath, step.args, { stdio: 'inherit', env: process.env });
  if (result.error || result.status !== 0) {
    const exitCode = step.propagateChildStatus && Number.isInteger(result.status) ? result.status : step.code;
    console.error(JSON.stringify({
      ok: false,
      status: 'DWAC_CYCLE88_EXIT_PROBE_FAILURE',
      probeExitCode: exitCode,
      step: step.name,
      childExitCode: result.status ?? null,
      error: result.error?.message ?? null,
    }, null, 2));
    process.exit(exitCode ?? 1);
  }
}

console.log(JSON.stringify({
  ok: true,
  status: 'DWAC_CYCLE88_EXIT_PROBE_ALL_PASS',
  route: {
    schedulingMode: 'NORTH_STAR',
    implementationMode: 'WHOLE_ARTIFACT',
    sovereigntyGate: 'AUTONOMOUS',
    selectedBottleneck: 'bounded-physical-perception-neural-cross-domain-history-real-c-runtime-truth-closure',
  },
  truthBoundary: {
    boundedPhysicalPerceptionNeuralRealCHistoryVerified: true,
    boundedPhysicalPerceptionNeuralCanonicalRuntimeTruthBound: true,
    exactNativeBinaryIdentityRequired: true,
    exactCrossDomainHistoryRootRequired: true,
    contiguousScopedHistoryRequired: true,
    stagedGeneticHistoryIncluded: false,
    livingStagedHistoryIncluded: false,
    dynamicRuntimeResourcesClaimedByDependencyClosure: false,
    externalPackageByteClosureClaimed: false,
    fullHistoryParityClaimed: false,
    allFoundationDomainsHistoryParityClaimed: false,
    completeRuntimeClaimed: false,
    fullSelfHostingClaimed: false,
  },
}, null, 2));
