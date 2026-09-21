#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const steps = [
  { code: 131, name: 'cycle71-regression-proof-chain', args: ['scripts/dwac-cycle71-exit-probe.mjs'] },
  { code: 132, name: 'knowledge-direct-negative-controls', args: ['scripts/verify-foundation-knowledge-direct-negative-control.mjs'] },
  { code: 133, name: 'knowledge-receipt-parity-negative-controls', args: ['--test', 'tests/foundation-knowledge-native-parity.test.mjs'] },
  { code: 134, name: 'knowledge-real-c-receipt-parity', args: ['scripts/verify-vercel-foundation-knowledge.mjs'] },
  { code: 135, name: 'knowledge-receipt-runtime-capability-truth', args: ['scripts/verify-foundation-knowledge-receipt-deployment-truth.mjs'] },
];

for (const step of steps) {
  const result = spawnSync(process.execPath, step.args, { stdio: 'inherit', env: process.env });
  if (result.error || result.status !== 0) {
    console.error(JSON.stringify({
      status: 'DWAC_CYCLE73_EXIT_PROBE_FAILURE',
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
  status: 'DWAC_CYCLE73_EXIT_PROBE_ALL_PASS',
  truthBoundary: {
    boundedSingleClaimKnowledgeDirectLoweringVerified: true,
    canonicalRealCStateAndSemanticRootParityRequired: true,
    exactReferenceNativeKnowledgeDomainReceiptParityRequired: true,
    knowledgeReceiptRootBoundIntoRuntimeDeploymentEvidence: true,
    exactInitialFormedAtRootBound: true,
    unsupportedKnowledgeProgramsRemainProviderBound: true,
    knowledgeProviderBridgeRemovedGlobally: false,
    allKnowledgeProgramsNativeClaimed: false,
    fullHistoryParityClaimed: false,
  },
}, null, 2));
