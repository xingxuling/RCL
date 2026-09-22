#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const steps = [
  { code: 253, propagateChildStatus: true, name: 'cycle87-regression-proof-chain', args: ['scripts/dwac-cycle87-exit-probe.mjs'] },
  { code: 254, name: 'semantic-root-v2-native-candidate-focused-tests', args: ['--test', '--test-concurrency=1', 'tests/semantic-state-root-v2-native-candidate.test.mjs'] },
  { code: 255, name: 'canonical-version-contract-regression', args: ['scripts/verify-version-contract.mjs'] },
  { code: 256, name: 'semantic-root-v2-candidate-authority-binding', args: ['scripts/verify-semantic-state-root-v2-authority-binding.mjs'] },
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
    primaryMode: 'DEEP_DEVELOPMENT',
    auxiliaryMode: 'NORTH_STAR',
    sovereigntyGate: 'AUTONOMOUS',
    bottleneck: 'semantic-state-root-v2-candidate-authority-binding-gap',
  },
  truthBoundary: {
    finiteF64V2CandidateImplementationPresent: true,
    finiteF64V2CandidateAuthorityBound: true,
    frozenTenCaseNativeCandidateParityRequired: true,
    ordinaryVerificationMembraneAdmissionRequired: true,
    canonicalDefaultRemainsV1: true,
    canonicalV2PromotionClaimed: false,
    windowsCandidateReplayClaimed: false,
    hostedCiAuthorityClaimed: false,
    historicalRootMigrationClaimed: false,
    downstreamAcceptanceClaimed: false,
    wholeLanguageRuntimeSelfHostingClaimed: false,
    completeRuntimeClaimed: false
  }
}, null, 2));
