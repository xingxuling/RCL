#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

function runNode(name, args, code) {
  const result = spawnSync(process.execPath, args, { stdio: 'inherit', env: process.env });
  if (result.error || result.status !== 0) {
    console.error(JSON.stringify({
      ok: false,
      status: 'DWAC_CYCLE92_EXIT_PROBE_FAILURE',
      probeExitCode: code,
      step: name,
      childExitCode: result.status ?? null,
      error: result.error?.message ?? null,
    }, null, 2));
    process.exit(code);
  }
}

runNode('cycle91-regression-proof-chain', ['scripts/dwac-cycle91-exit-probe.mjs'], 281);
runNode('bind-bounded-derived-knowledge-proof-into-runtime-attestation', [
  'scripts/bind-vercel-foundation-knowledge-derived-runtime-truth.mjs',
], 282);
runNode('bounded-derived-knowledge-runtime-truth-binding', [
  'scripts/verify-cycle92-knowledge-derived-runtime-truth-binding.mjs',
], 283);
runNode('runtime-truth-replay-closure-regression', [
  '--test',
  'tests/foundation-runtime-truth-replay-closure.test.mjs',
], 284);
runNode('deployment-evidence-runtime-truth-replay-regression', [
  'scripts/verify-foundation-runtime-deployment-evidence-registry.mjs',
], 285);
runNode('cross-domain-runtime-truth-replay-regression', [
  'scripts/verify-foundation-cross-domain-history-runtime-truth.mjs',
], 286);
runNode('runtime-truth-static-dependency-closure-regression', [
  'scripts/verify-foundation-runtime-truth-dependency-closure.mjs',
], 287);

console.log(JSON.stringify({
  ok: true,
  status: 'DWAC_CYCLE92_EXIT_PROBE_ALL_PASS',
  route: {
    schedulingMode: 'NORTH_STAR',
    implementationMode: 'WHOLE_ARTIFACT',
    sovereigntyGate: 'AUTONOMOUS',
    selectedBottleneck: 'bounded-derived-knowledge-runtime-truth-binding-closure',
  },
  verification: {
    cycle91RegressionProofChainPassed: true,
    cycle91CanonicalRealCProofReproduced: true,
    exactBinaryRuntimeAttestationBindingPassed: true,
    boundedDerivedRuntimeEvidencePassed: true,
    canonicalRuntimeTruthRootBindingPassed: true,
    runtimeTruthReplayClosurePassed: true,
    omissionRootDivergencePassed: true,
    mutatedEvidenceFailedClosed: true,
    deploymentEvidenceReplayRegressionPassed: true,
    crossDomainReplayRegressionPassed: true,
    staticDependencyClosureRegressionPassed: true,
  },
  truthBoundary: {
    boundedDerivedKnowledgeDependencySubsetRuntimeTruthBound: true,
    revisionsAndDecayRemainProviderBound: true,
    dynamicDerivedExpressionsRemainProviderBound: true,
    unrestrictedDependenciesRemainProviderBound: true,
    providerBridgeRemovedGlobally: false,
    allKnowledgeProgramsNativeClaimed: false,
    dynamicRuntimeResourcesClaimedByDependencyClosure: false,
    externalPackageByteClosureClaimed: false,
    fullHistoryParityClaimed: false,
    completeRuntimeClaimed: false,
    fullSelfHostingClaimed: false,
  },
}, null, 2));
