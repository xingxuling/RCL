#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const steps = [
  { code: 121, name: 'cycle70-regression-proof-chain', args: ['scripts/dwac-cycle70-exit-probe.mjs'] },
  { code: 122, name: 'cycle71-runtime-health-statepath-negative-controls', args: ['scripts/verify-runtime-health-statepath-negative-control.mjs'] },
  { code: 123, name: 'cycle71-runtime-health-statepath-truth-binding', args: ['scripts/verify-vercel-runtime-health-statepath-truth.mjs'] },
  { code: 124, name: 'knowledge-direct-negative-controls', args: ['scripts/verify-foundation-knowledge-direct-negative-control.mjs'] },
  { code: 125, name: 'knowledge-runtime-capability-truth', args: ['scripts/verify-foundation-knowledge-deployment-truth.mjs'] },
];

for (const step of steps) {
  const result = spawnSync(process.execPath, step.args, { stdio: 'inherit', env: process.env });
  if (result.error || result.status !== 0) {
    console.error(JSON.stringify({
      status: 'DWAC_CYCLE72_EXIT_PROBE_FAILURE',
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
  status: 'DWAC_CYCLE72_EXIT_PROBE_ALL_PASS',
  truthBoundary: {
    cycle71RegressionProofChainPreserved: true,
    boundedSingleClaimKnowledgeDirectLoweringVerified: true,
    canonicalRealCStateAndSemanticRootParityRequired: true,
    exactInitialFormedAtRootBound: true,
    runtimeCapabilityTruthBindsKnowledgeDeploymentEvidence: true,
    unsupportedKnowledgeProgramsRemainProviderBound: true,
    knowledgeProviderBridgeRemovedGlobally: false,
    allKnowledgeProgramsNativeClaimed: false,
    knowledgeDomainReceiptParityClaimed: false,
  },
}, null, 2));
