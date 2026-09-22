#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const steps = [
  { code: null, propagateChildStatus: true, name: 'cycle63-knowledge-core-proof-chain', args: ['scripts/dwac-cycle63-exit-probe.mjs'] },
  { code: 131, name: 'cycle71-regression-proof-chain', args: ['scripts/dwac-cycle71-exit-probe.mjs'] },
  { code: 132, name: 'knowledge-direct-negative-controls', args: ['scripts/verify-foundation-knowledge-direct-negative-control.mjs'] },
  { code: 133, name: 'knowledge-receipt-parity-negative-controls', args: ['--test', 'tests/foundation-knowledge-native-parity.test.mjs'] },
  { code: 134, name: 'knowledge-real-c-receipt-parity', args: ['scripts/verify-vercel-foundation-knowledge.mjs'] },
  { code: 135, name: 'knowledge-max-boundary-real-c-attestation', args: ['scripts/verify-vercel-foundation-knowledge-max-boundary.mjs'] },
  { code: 136, name: 'knowledge-max-boundary-runtime-binding', args: ['scripts/bind-vercel-foundation-knowledge-max-boundary-runtime-truth.mjs'] },
  { code: 137, name: 'knowledge-runtime-capability-truth', args: ['scripts/verify-foundation-knowledge-deployment-truth.mjs'] },
];

for (const step of steps) {
  const result = spawnSync(process.execPath, step.args, { stdio: 'inherit', env: process.env });
  if (result.error || result.status !== 0) {
    const exitCode = step.propagateChildStatus && Number.isInteger(result.status) ? result.status : step.code;
    console.error(JSON.stringify({
      status: 'DWAC_CYCLE73_EXIT_PROBE_FAILURE',
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
  status: 'DWAC_CYCLE73_EXIT_PROBE_ALL_PASS',
  truthBoundary: {
    boundedPrimitiveMultiClaimKnowledgeDirectLoweringVerified: true,
    maxBoundedClaimCount: 4,
    canonicalRealCStateAndSemanticRootParityRequired: true,
    exactReferenceNativeKnowledgeDomainReceiptParityRequired: true,
    oneLearnDirectiveMapsToOneAtomicSyntheticTransaction: true,
    knowledgeReceiptRootBoundIntoRuntimeDeploymentEvidence: true,
    maxBoundedClaimCountRealCVerified: true,
    maxBoundaryAttestationBoundIntoRuntimeDeploymentEvidence: true,
    canonicalKnowledgeRuntimeTruthVerifierRequired: true,
    exactInitialFormedAtRootBound: true,
    unsupportedKnowledgeProgramsRemainProviderBound: true,
    knowledgeProviderBridgeRemovedGlobally: false,
    allKnowledgeProgramsNativeClaimed: false,
    fullHistoryParityClaimed: false,
  },
}, null, 2));
