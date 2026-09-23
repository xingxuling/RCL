#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

function runNode(name, args, code) {
  const result = spawnSync(process.execPath, args, { stdio: 'inherit', env: process.env });
  if (result.error || result.status !== 0) {
    console.error(JSON.stringify({
      ok: false,
      status: 'DWAC_CYCLE93_EXIT_PROBE_FAILURE',
      probeExitCode: code,
      step: name,
      childExitCode: result.status ?? null,
      error: result.error?.message ?? null,
    }, null, 2));
    process.exit(code);
  }
}

runNode('cycle92-regression-proof-chain', ['scripts/dwac-cycle92-exit-probe.mjs'], 291);
runNode('bounded-reinforcement-revision-unit-and-negative-controls', [
  '--test',
  'tests/foundation-knowledge-reinforcement-revision-direct-lowering.test.mjs',
], 292);
runNode('bounded-reinforcement-revision-canonical-real-c-proof', [
  'scripts/verify-vercel-foundation-knowledge-reinforcement-revision.mjs',
], 293);
runNode('runtime-truth-static-dependency-closure-regression', [
  'scripts/verify-foundation-runtime-truth-dependency-closure.mjs',
], 294);

console.log(JSON.stringify({
  ok: true,
  status: 'DWAC_CYCLE93_EXIT_PROBE_ALL_PASS',
  route: {
    schedulingMode: 'NORTH_STAR',
    implementationMode: 'DEEP_DEVELOPMENT',
    sovereigntyGate: 'AUTONOMOUS',
    selectedBottleneck: 'bounded-knowledge-reinforcement-revision-native-lowering',
  },
  verification: {
    cycle92RegressionProofChainPassed: true,
    boundedReinforcementRevisionUnitControlsPassed: true,
    exactTwoTransactionKnowledgeReceiptParityPassed: true,
    canonicalRealCNativeExecutionPassed: true,
    semanticStateRootParityPassed: true,
    exactNativeBinaryAttestationPassed: true,
    revisionConfidenceEvidenceSourceStatusAndRevisionParityPassed: true,
    receiptMutationFailedClosed: true,
    staticDependencyClosureRegressionPassed: true,
  },
  truthBoundary: {
    boundedSameValueReinforcementRevisionSubsetNativeClaimed: true,
    revisionOccursInSeparateSecondLeadingLearnTransaction: true,
    contradictoryRevisionAlternativesRemainProviderBound: true,
    revisionDependenciesRemainProviderBound: true,
    decayRemainsProviderBound: true,
    arbitraryRevisionTopologyRemainsProviderBound: true,
    sameDeclarationClaimPlusRevisionRemainsProviderBound: true,
    providerBridgeRemovedGlobally: false,
    dynamicRuntimeResourcesClaimedByDependencyClosure: false,
    externalPackageByteClosureClaimed: false,
    fullHistoryParityClaimed: false,
    completeRuntimeClaimed: false,
    fullSelfHostingClaimed: false,
  },
}, null, 2));
