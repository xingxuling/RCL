#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const steps = [
  { code: 171, name: 'cycle76-regression-proof-chain', args: ['scripts/dwac-cycle76-exit-probe.mjs'] },
  { code: 172, name: 'knowledge-four-claim-boundary-unit-and-negative-control', args: ['--test', 'tests/foundation-knowledge-max-boundary.test.mjs'] },
  { code: 173, name: 'knowledge-four-claim-boundary-real-c-attestation', args: ['scripts/verify-vercel-foundation-knowledge-max-boundary.mjs'] },
];

for (const step of steps) {
  const result = spawnSync(process.execPath, step.args, { stdio: 'inherit', env: process.env });
  if (result.error || result.status !== 0) {
    console.error(JSON.stringify({
      status: 'DWAC_CYCLE77_EXIT_PROBE_FAILURE',
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
  status: 'DWAC_CYCLE77_EXIT_PROBE_ALL_PASS',
  truthBoundary: {
    boundedPrimitiveMultiClaimKnowledgeDirectLoweringRemainsRequired: true,
    maxBoundedClaimCount: 4,
    maxBoundedClaimCountRealCVerified: true,
    verifiedAtomicClaimCount: 4,
    overBoundaryFiveClaimsFailClosedToProviderPath: true,
    exactReferenceNativeFourClaimReceiptParityRequired: true,
    canonicalRealCFourClaimExecutionRequired: true,
    sequentialFourClaimFormationRootsRequired: true,
    oneLearnDirectiveMapsToOneAtomicSyntheticNativeTransaction: true,
    unsupportedKnowledgeProgramsRemainProviderBound: true,
    knowledgeProviderBridgeRemovedGlobally: false,
    allKnowledgeProgramsNativeClaimed: false,
    fullHistoryParityClaimed: false,
  },
}, null, 2));
