#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

function runNode(name, args, code) {
  const result = spawnSync(process.execPath, args, { stdio: 'inherit', env: process.env });
  if (result.error || result.status !== 0) {
    console.error(JSON.stringify({
      ok: false,
      status: 'DWAC_CYCLE90_EXIT_PROBE_FAILURE',
      probeExitCode: code,
      step: name,
      childExitCode: result.status ?? null,
      error: result.error?.message ?? null,
    }, null, 2));
    process.exit(code);
  }
}

function runNpmTest() {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(npm, ['test'], { stdio: 'inherit', env: process.env });
  if (result.error || result.status !== 0) {
    console.error(JSON.stringify({
      ok: false,
      status: 'DWAC_CYCLE90_EXIT_PROBE_FAILURE',
      probeExitCode: 262,
      step: 'canonical-full-npm-test-suite',
      childExitCode: result.status ?? null,
      error: result.error?.message ?? null,
    }, null, 2));
    process.exit(262);
  }
}

runNode('cycle89-regression-proof-chain', ['scripts/dwac-cycle89-exit-probe.mjs'], 261);
runNpmTest();
runNode('runtime-deployment-evidence-registry-replay-post-full-suite', ['scripts/verify-foundation-runtime-deployment-evidence-registry.mjs'], 263);
runNode('cross-domain-runtime-truth-replay-post-full-suite', ['scripts/verify-foundation-cross-domain-history-runtime-truth.mjs'], 264);
runNode('runtime-truth-static-dependency-closure-post-full-suite', ['scripts/verify-foundation-runtime-truth-dependency-closure.mjs'], 265);

console.log(JSON.stringify({
  ok: true,
  status: 'DWAC_CYCLE90_EXIT_PROBE_ALL_PASS',
  route: {
    mode: 'DEEP_DEVELOPMENT',
    schedulingContext: 'NORTH_STAR_REOBSERVATION',
    sovereigntyGate: 'AUTONOMOUS',
    selectedBottleneck: 'canonical-full-suite-validation-closure',
  },
  verification: {
    cycle89RegressionProofChainPassed: true,
    canonicalFullNpmTestSuitePassed: true,
    postSuiteRuntimeTruthReplayPassed: true,
    postSuiteCrossDomainRuntimeTruthReplayPassed: true,
    postSuiteStaticDependencyClosurePassed: true,
  },
  truthBoundary: {
    validationClosureOnly: true,
    noNewRclSemanticCapabilityClaimed: true,
    dynamicRuntimeResourcesClaimedByDependencyClosure: false,
    externalPackageByteClosureClaimed: false,
    fullHistoryParityClaimed: false,
    completeRuntimeClaimed: false,
    fullSelfHostingClaimed: false,
  },
}, null, 2));
