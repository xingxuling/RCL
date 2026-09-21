#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const steps = [
  { code: 141, name: 'cycle73-regression-proof-chain', args: ['scripts/dwac-cycle73-exit-probe.mjs'] },
  { code: 142, name: 'knowledge-runtime-truth-single-source', args: ['scripts/verify-foundation-knowledge-runtime-truth-single-source.mjs'] },
  { code: 143, name: 'canonical-knowledge-runtime-truth', args: ['scripts/verify-foundation-knowledge-deployment-truth.mjs'] },
];

for (const step of steps) {
  const result = spawnSync(process.execPath, step.args, { stdio: 'inherit', env: process.env });
  if (result.error || result.status !== 0) {
    console.error(JSON.stringify({
      status: 'DWAC_CYCLE74_EXIT_PROBE_FAILURE',
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
  status: 'DWAC_CYCLE74_EXIT_PROBE_ALL_PASS',
  truthBoundary: {
    canonicalKnowledgeRuntimeTruthIsSingleSource: true,
    exactKnowledgeReceiptRootRequired: true,
    directAndProviderBridgeCoexistenceRequired: true,
    duplicateReceiptRuntimeTruthVerifierRemoved: true,
    cycle73RealityProofRemainsRequired: true,
    fullHistoryParityClaimed: false,
  },
}, null, 2));
