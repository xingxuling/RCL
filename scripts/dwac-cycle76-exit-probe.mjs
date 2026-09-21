#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const steps = [
  { code: 161, name: 'cycle75-regression-proof-chain', args: ['scripts/dwac-cycle75-exit-probe.mjs'] },
  { code: 162, name: 'knowledge-bounded-multi-claim-direct-lowering', args: ['--test', 'tests/foundation-knowledge-direct-lowering.test.mjs'] },
];

for (const step of steps) {
  const result = spawnSync(process.execPath, step.args, { stdio: 'inherit', env: process.env });
  if (result.error || result.status !== 0) {
    console.error(JSON.stringify({
      status: 'DWAC_CYCLE76_EXIT_PROBE_FAILURE',
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
  status: 'DWAC_CYCLE76_EXIT_PROBE_ALL_PASS',
  truthBoundary: {
    boundedPrimitiveMultiClaimKnowledgeDirectLoweringVerified: true,
    maxBoundedClaimCount: 4,
    oneLearnDirectiveMapsToOneAtomicSyntheticNativeTransaction: true,
    exactReferenceNativeMultiClaimReceiptParityRequired: true,
    canonicalRealCMultiClaimExecutionRequired: true,
    firstClaimRootMustEqualPreLearnRealityRoot: true,
    referenceSequentialClaimFormationRootsMustBePreserved: true,
    unsupportedKnowledgeProgramsRemainProviderBound: true,
    knowledgeProviderBridgeRemovedGlobally: false,
    allKnowledgeProgramsNativeClaimed: false,
    fullHistoryParityClaimed: false,
  },
}, null, 2));
