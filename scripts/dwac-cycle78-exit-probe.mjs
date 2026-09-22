#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const steps = [
  { code: 181, name: 'cycle77-regression-proof-chain', args: ['scripts/dwac-cycle77-exit-probe.mjs'] },
  { code: 182, name: 'knowledge-max-boundary-runtime-negative-controls', args: ['scripts/verify-foundation-knowledge-max-boundary-runtime-negative-control.mjs'] },
  { code: 183, name: 'knowledge-runtime-truth-single-source-guard', args: ['scripts/verify-foundation-knowledge-runtime-truth-single-source.mjs'] },
  { code: 184, name: 'knowledge-max-boundary-canonical-runtime-truth', args: ['scripts/verify-foundation-knowledge-deployment-truth.mjs'] },
];

for (const step of steps) {
  const result = spawnSync(process.execPath, step.args, { stdio: 'inherit', env: process.env });
  if (result.error || result.status !== 0) {
    console.error(JSON.stringify({
      status: 'DWAC_CYCLE78_EXIT_PROBE_FAILURE',
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
  status: 'DWAC_CYCLE78_EXIT_PROBE_ALL_PASS',
  truthBoundary: {
    behavioralSpecimenVerifiedAtomicClaimCount: 2,
    maxBoundedClaimCount: 4,
    maxBoundaryVerifiedAtomicClaimCount: 4,
    maxBoundaryRealCProofBoundIntoNativeRuntimeAttestation: true,
    canonicalRuntimeTruthRequiresMaxBoundaryAttestation: true,
    exactMaxBoundaryAttestationRootRequired: true,
    exactMaxBoundaryReceiptRootRequired: true,
    exactBinaryIdentityRequiredAcrossBehavioralAndMaxBoundaryProofs: true,
    fourSequentialClaimFormationRootsRequired: true,
    overBoundaryFiveClaimsRemainProviderBound: true,
    providerBridgeRemovedGlobally: false,
    allKnowledgeProgramsNativeClaimed: false,
    fullHistoryParityClaimed: false,
  },
}, null, 2));
