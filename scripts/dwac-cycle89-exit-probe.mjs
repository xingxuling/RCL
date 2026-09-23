#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const steps = [
  { code: 256, propagateChildStatus: true, name: 'cycle88-regression-proof-chain', args: ['scripts/dwac-cycle88-exit-probe.mjs'] },
  { code: 257, name: 'runtime-truth-replay-closure-unit-negative-controls', args: ['--test', 'tests/foundation-runtime-truth-replay-closure.test.mjs'] },
  { code: 258, name: 'runtime-deployment-evidence-registry-replay-after-all-bound-evidence', args: ['scripts/verify-foundation-runtime-deployment-evidence-registry.mjs'] },
  { code: 259, name: 'cross-domain-runtime-truth-replay-after-knowledge-binding', args: ['scripts/verify-foundation-cross-domain-history-runtime-truth.mjs'] },
  { code: 260, name: 'runtime-truth-static-dependency-closure-final', args: ['scripts/verify-foundation-runtime-truth-dependency-closure.mjs'] },
];

for (const step of steps) {
  const result = spawnSync(process.execPath, step.args, { stdio: 'inherit', env: process.env });
  if (result.error || result.status !== 0) {
    const exitCode = step.propagateChildStatus && Number.isInteger(result.status) ? result.status : step.code;
    console.error(JSON.stringify({
      ok: false,
      status: 'DWAC_CYCLE89_EXIT_PROBE_FAILURE',
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
  status: 'DWAC_CYCLE89_EXIT_PROBE_ALL_PASS',
  route: {
    mode: 'DEEP_DEVELOPMENT',
    sovereigntyGate: 'AUTONOMOUS',
    selectedBottleneck: 'canonical-main-runtime-truth-replay-closure',
    schedulingContext: 'NORTH_STAR_REOBSERVATION',
  },
  repairedInvariant: {
    canonicalRuntimeTruthReplayUsesCompleteSurfaceEvidenceClosure: true,
    crossDomainHistoryReplayIncludesKnowledgeMultiLearnEvidenceWhenPresent: true,
    deploymentRegistryReplayIncludesKnowledgeMultiLearnEvidenceWhenPresent: true,
    omissionAndIdentityDriftControlsFailByRootDivergence: true,
  },
  truthBoundary: {
    noNewRclSemanticCapabilityClaimed: true,
    dynamicRuntimeResourcesClaimedByDependencyClosure: false,
    externalPackageByteClosureClaimed: false,
    fullHistoryParityClaimed: false,
    completeRuntimeClaimed: false,
    fullSelfHostingClaimed: false,
  },
}, null, 2));
