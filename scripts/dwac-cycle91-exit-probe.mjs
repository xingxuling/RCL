#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

function runNode(name, args, code) {
  const result = spawnSync(process.execPath, args, { stdio: 'inherit', env: process.env });
  if (result.error || result.status !== 0) {
    console.error(JSON.stringify({
      ok: false,
      status: 'DWAC_CYCLE91_EXIT_PROBE_FAILURE',
      probeExitCode: code,
      step: name,
      childExitCode: result.status ?? null,
      error: result.error?.message ?? null,
    }, null, 2));
    process.exit(code);
  }
}

runNode('cycle90-regression-proof-chain', ['scripts/dwac-cycle90-exit-probe.mjs'], 271);
runNode('bounded-derived-knowledge-dependency-unit-and-negative-controls', [
  '--test',
  'tests/foundation-knowledge-derived-dependency-direct-lowering.test.mjs',
], 272);
runNode('bounded-derived-knowledge-dependency-real-c-proof', [
  'scripts/verify-vercel-foundation-knowledge-derived-dependency.mjs',
], 273);
runNode('knowledge-deployment-truth-regression', [
  'scripts/verify-foundation-knowledge-deployment-truth.mjs',
], 274);

console.log(JSON.stringify({
  ok: true,
  status: 'DWAC_CYCLE91_EXIT_PROBE_ALL_PASS',
  route: {
    mode: 'DEEP_DEVELOPMENT',
    schedulingContext: 'NORTH_STAR_REOBSERVATION',
    sovereigntyGate: 'AUTONOMOUS',
    selectedBottleneck: 'bounded-derived-knowledge-dependency-native-lowering-closure',
  },
  verification: {
    cycle90RegressionProofChainPassed: true,
    completeCanonicalTestSurfacePassedThroughCycle90: true,
    boundedDerivedKnowledgeUnitAndNegativeControlsPassed: true,
    canonicalRealCNativeVmParityPassed: true,
    derivedDependencyMetadataParityPassed: true,
    receiptMutationFailedClosed: true,
    knowledgeDeploymentTruthRegressionPassed: true,
  },
  truthBoundary: {
    boundedDerivedKnowledgeDependencySubsetNativeClaimed: true,
    maxTotalKnowledgeValuesPerLearn: 4,
    maxLeadingLearnDirectives: 2,
    dynamicDerivedExpressionsRemainProviderBound: true,
    revisionsAndDecayRemainProviderBound: true,
    providerBridgeRemovedGlobally: false,
    allKnowledgeProgramsNativeClaimed: false,
    dynamicRuntimeResourcesClaimedByDependencyClosure: false,
    externalPackageByteClosureClaimed: false,
    fullHistoryParityClaimed: false,
    completeRuntimeClaimed: false,
    fullSelfHostingClaimed: false
  }
}, null, 2));
