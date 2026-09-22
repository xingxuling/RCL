#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

// Cycle 82 preserves the canonical Cycle 74→81 proof ordering while flattening
// wrapper-only probes so Vercel reports the exact regressed boundary.
const steps = [
  { code: 221, name: 'cycle74-regression-proof-chain', args: ['scripts/dwac-cycle74-exit-probe.mjs'] },
  { code: 222, name: 'cycle75-developer-release-runtime-truth-contract', args: ['scripts/verify-developer-release-runtime-truth-contract.mjs'] },
  { code: 223, name: 'cycle76-knowledge-bounded-multi-claim-direct-lowering', args: ['--test', 'tests/foundation-knowledge-direct-lowering.test.mjs'] },
  { code: 224, name: 'cycle77-knowledge-four-claim-boundary-unit-and-negative-control', args: ['--test', 'tests/foundation-knowledge-max-boundary.test.mjs'] },
  { code: 225, name: 'cycle77-knowledge-four-claim-boundary-real-c-attestation', args: ['scripts/verify-vercel-foundation-knowledge-max-boundary.mjs'] },
  { code: 226, name: 'cycle78-knowledge-max-boundary-runtime-negative-controls', args: ['scripts/verify-foundation-knowledge-max-boundary-runtime-negative-control.mjs'] },
  { code: 227, name: 'cycle78-knowledge-runtime-truth-single-source-guard', args: ['scripts/verify-foundation-knowledge-runtime-truth-single-source.mjs'] },
  { code: 228, name: 'cycle78-knowledge-max-boundary-canonical-runtime-truth', args: ['scripts/verify-foundation-knowledge-deployment-truth.mjs'] },
  { code: 229, name: 'cycle79-release-deployment-source-parity-unit-negative-controls', args: ['--test', 'tests/foundation-release-deployment-source-parity.test.mjs'] },
  { code: 230, name: 'cycle79-developer-release-deployment-source-parity-bind', args: ['scripts/bind-vercel-developer-release-runtime-truth.mjs'] },
  { code: 231, name: 'cycle80-cross-domain-history-root-parity-unit-negative-controls', args: ['--test', 'tests/foundation-cross-domain-history-root-parity.test.mjs'] },
  { code: 232, name: 'cycle80-cross-domain-history-real-c-proof', args: ['scripts/verify-vercel-foundation-cross-domain-history.mjs'] },
  { code: 233, name: 'cycle81-cross-domain-history-runtime-truth-binding', args: ['scripts/verify-foundation-cross-domain-history-runtime-truth.mjs'] },
  { code: 234, name: 'runtime-truth-static-dependency-closure', args: ['scripts/verify-foundation-runtime-truth-dependency-closure.mjs'] },
];

for (const step of steps) {
  const result = spawnSync(process.execPath, step.args, { stdio: 'inherit', env: process.env });
  if (result.error || result.status !== 0) {
    console.error(JSON.stringify({
      status: 'DWAC_CYCLE82_EXIT_PROBE_FAILURE',
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
  status: 'DWAC_CYCLE82_EXIT_PROBE_ALL_PASS',
  truthBoundary: {
    cycle74RegressionProofChainRemainsRequired: true,
    cycle75Through81CanonicalProofOrderPreserved: true,
    runtimeTruthStaticRepositoryLocalDependencyClosureBound: true,
    exactTransitiveSourceBytesRequired: true,
    unresolvedRelativeImportsFailClosed: true,
    dynamicRuntimeResourcesClaimedByDependencyClosure: false,
    externalPackageByteClosureClaimed: false,
    deploymentEvidenceClaimedByDeveloperReleaseContract: false,
    fullHistoryParityClaimed: false,
    completeRuntimeClaimed: false,
    fullSelfHostingClaimed: false,
  },
}, null, 2));
