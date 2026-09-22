#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

// Cycle 82 first proves the new source-closure contract can materialize on the
// exact deployment tree, then replays the legacy proof chain. Typed child exit
// codes are preserved on diagnostic gates without weakening fail-closed order.
const steps = [
  { code: 220, propagateChildStatus: true, name: 'runtime-truth-static-dependency-closure-preflight', args: ['scripts/verify-foundation-runtime-truth-dependency-closure.mjs'] },
  { code: 221, propagateChildStatus: true, name: 'cycle63-knowledge-core-proof-chain', args: ['scripts/dwac-cycle63-exit-probe.mjs'] },
  { code: 222, name: 'cycle71-regression-proof-chain', args: ['scripts/dwac-cycle71-exit-probe.mjs'] },
  { code: 223, name: 'cycle73-knowledge-direct-negative-controls', args: ['scripts/verify-foundation-knowledge-direct-negative-control.mjs'] },
  { code: 224, name: 'cycle73-knowledge-receipt-parity-negative-controls', args: ['--test', 'tests/foundation-knowledge-native-parity.test.mjs'] },
  { code: 225, name: 'cycle73-knowledge-real-c-receipt-parity', args: ['scripts/verify-vercel-foundation-knowledge.mjs'] },
  { code: 226, name: 'cycle73-knowledge-max-boundary-real-c-attestation', args: ['scripts/verify-vercel-foundation-knowledge-max-boundary.mjs'] },
  { code: 227, name: 'cycle73-knowledge-max-boundary-runtime-binding', args: ['scripts/bind-vercel-foundation-knowledge-max-boundary-runtime-truth.mjs'] },
  { code: 228, name: 'cycle73-knowledge-runtime-capability-truth', args: ['scripts/verify-foundation-knowledge-deployment-truth.mjs'] },
  { code: 229, name: 'cycle74-knowledge-runtime-truth-single-source', args: ['scripts/verify-foundation-knowledge-runtime-truth-single-source.mjs'] },
  { code: 230, name: 'cycle74-canonical-knowledge-runtime-truth', args: ['scripts/verify-foundation-knowledge-deployment-truth.mjs'] },
  { code: 231, name: 'cycle75-developer-release-runtime-truth-contract', args: ['scripts/verify-developer-release-runtime-truth-contract.mjs'] },
  { code: 232, name: 'cycle76-knowledge-bounded-multi-claim-direct-lowering', args: ['--test', 'tests/foundation-knowledge-direct-lowering.test.mjs'] },
  { code: 233, name: 'cycle77-knowledge-four-claim-boundary-unit-and-negative-control', args: ['--test', 'tests/foundation-knowledge-max-boundary.test.mjs'] },
  { code: 234, name: 'cycle77-knowledge-four-claim-boundary-real-c-attestation', args: ['scripts/verify-vercel-foundation-knowledge-max-boundary.mjs'] },
  { code: 235, name: 'cycle78-knowledge-max-boundary-runtime-negative-controls', args: ['scripts/verify-foundation-knowledge-max-boundary-runtime-negative-control.mjs'] },
  { code: 236, name: 'cycle78-knowledge-runtime-truth-single-source-guard', args: ['scripts/verify-foundation-knowledge-runtime-truth-single-source.mjs'] },
  { code: 237, name: 'cycle78-knowledge-max-boundary-canonical-runtime-truth', args: ['scripts/verify-foundation-knowledge-deployment-truth.mjs'] },
  { code: 238, name: 'cycle79-release-deployment-source-parity-unit-negative-controls', args: ['--test', 'tests/foundation-release-deployment-source-parity.test.mjs'] },
  { code: 239, name: 'cycle79-developer-release-deployment-source-parity-bind', args: ['scripts/bind-vercel-developer-release-runtime-truth.mjs'] },
  { code: 240, name: 'cycle80-cross-domain-history-root-parity-unit-negative-controls', args: ['--test', 'tests/foundation-cross-domain-history-root-parity.test.mjs'] },
  { code: 241, name: 'cycle80-cross-domain-history-real-c-proof', args: ['scripts/verify-vercel-foundation-cross-domain-history.mjs'] },
  { code: 242, name: 'cycle81-cross-domain-history-runtime-truth-binding', args: ['scripts/verify-foundation-cross-domain-history-runtime-truth.mjs'] },
  { code: 243, name: 'runtime-truth-static-dependency-closure-final', args: ['scripts/verify-foundation-runtime-truth-dependency-closure.mjs'] },
];

for (const step of steps) {
  const result = spawnSync(process.execPath, step.args, { stdio: 'inherit', env: process.env });
  if (result.error || result.status !== 0) {
    const exitCode = step.propagateChildStatus && Number.isInteger(result.status) ? result.status : step.code;
    console.error(JSON.stringify({
      status: 'DWAC_CYCLE82_EXIT_PROBE_FAILURE',
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
  status: 'DWAC_CYCLE82_EXIT_PROBE_ALL_PASS',
  truthBoundary: {
    dependencyClosurePreflightAndFinalVerificationRequired: true,
    cycle63And71KnowledgeProofPrerequisitesRemainRequired: true,
    cycle73Through81CanonicalProofOrderPreserved: true,
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
