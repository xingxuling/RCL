#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const steps = [
  { code: null, propagateChildStatus: true, name: 'cycle63-regression-proof-chain', args: ['scripts/dwac-cycle63-exit-probe.mjs'] },
  { code: 64, name: 'runtime-capability-truth-root-negative-controls', args: ['--test', 'tests/foundation-runtime-capability-truth-root.test.mjs'] },
  { code: 65, name: 'runtime-deployment-evidence-root-replay', args: ['scripts/verify-foundation-runtime-deployment-evidence-registry.mjs'] },
  { code: 66, name: 'runtime-health-truth-negative-controls', args: ['--test', 'tests/foundation-runtime-health-truth.test.mjs'] },
  { code: 67, name: 'runtime-health-canonical-root-parity', args: ['scripts/verify-vercel-runtime-health-truth.mjs'] },
  { code: 68, name: 'runtime-health-bridge-topology-negative-controls', args: ['--test', 'tests/foundation-runtime-health-truth.test.mjs'] },
  { code: 69, name: 'runtime-health-canonical-bridge-topology', args: ['scripts/verify-vercel-runtime-health-truth.mjs'] },
  { code: 70, name: 'runtime-health-native-registry-negative-controls', args: ['--test', 'tests/foundation-runtime-health-truth.test.mjs'] },
  { code: 71, name: 'native-deployment-health-canonical-bridge-registry', args: ['scripts/verify-vercel-health-evidence.mjs'] },
  { code: 72, name: 'runtime-health-native-registry-truth', args: ['scripts/verify-vercel-runtime-health-truth.mjs'] },
  { code: 73, name: 'federation-producer-canonical-registry-rebind', args: ['scripts/bind-vercel-foundation-native-federation.mjs'] },
  { code: 74, name: 'federation-registry-baseline', args: ['--test', '--test-name-pattern=exact executable canonical bridge registry identity', 'tests/foundation-native-federation-registry-binding.test.mjs'] },
  { code: 75, name: 'federation-registry-root-drift-control', args: ['--test', '--test-name-pattern=registry-root drift', 'tests/foundation-native-federation-registry-binding.test.mjs'] },
  { code: 76, name: 'federation-registry-count-drift-control', args: ['--test', '--test-name-pattern=spec-count drift', 'tests/foundation-native-federation-registry-binding.test.mjs'] },
  { code: 77, name: 'federation-registry-domain-drift-control', args: ['--test', '--test-name-pattern=domain topology drift', 'tests/foundation-native-federation-registry-binding.test.mjs'] },
  { code: 78, name: 'federation-registry-batch-drift-control', args: ['--test', '--test-name-pattern=provider batch identity drift', 'tests/foundation-native-federation-registry-binding.test.mjs'] },
  { code: 79, name: 'deployed-federation-registry-binding', args: ['scripts/verify-vercel-foundation-native-federation-registry-binding.mjs'] },
  { code: 80, name: 'cycle68-deployment-health-regression', args: ['scripts/verify-vercel-health-evidence.mjs'] },
  { code: 81, name: 'cycle68-runtime-health-truth-regression', args: ['scripts/verify-vercel-runtime-health-truth.mjs'] },
  { code: 82, name: 'runtime-federation-registry-attestation', args: ['scripts/verify-vercel-runtime-federation-registry-binding.mjs'] },
  { code: 83, name: 'cycle69-deployment-health-regression', args: ['scripts/verify-vercel-health-evidence.mjs'] },
  { code: 84, name: 'cycle69-runtime-health-truth-regression', args: ['scripts/verify-vercel-runtime-health-truth.mjs'] },
  { code: 85, name: 'provider-bridge-statepath-attestation-bind', args: ['scripts/bind-vercel-foundation-native-bridge-statepath-attestation.mjs'] },
  { code: 86, name: 'provider-bridge-statepath-negative-controls', args: ['--test', 'tests/foundation-native-bridge-statepath-attestation.test.mjs'] },
  { code: 87, name: 'provider-bridge-statepath-deployment-attestation', args: ['scripts/verify-vercel-foundation-native-bridge-statepath-attestation.mjs'] },
  { code: 88, name: 'runtime-health-statepath-negative-controls', args: ['scripts/verify-runtime-health-statepath-negative-control.mjs'] },
  { code: 89, name: 'runtime-health-statepath-truth-binding', args: ['scripts/verify-vercel-runtime-health-statepath-truth.mjs'] },
  { code: 90, name: 'knowledge-direct-negative-controls', args: ['scripts/verify-foundation-knowledge-direct-negative-control.mjs'] },
  { code: 91, name: 'knowledge-runtime-capability-truth', args: ['scripts/verify-foundation-knowledge-deployment-truth.mjs'] },
];

for (const step of steps) {
  const result = spawnSync(process.execPath, step.args, { stdio: 'inherit', env: process.env });
  if (result.error || result.status !== 0) {
    const exitCode = step.propagateChildStatus && Number.isInteger(result.status) ? result.status : step.code;
    console.error(JSON.stringify({ status: 'DWAC_CYCLE72_EXIT_PROBE_FAILURE', probeExitCode: exitCode, step: step.name, childExitCode: result.status ?? null, error: result.error?.message ?? null }, null, 2));
    process.exit(exitCode ?? 1);
  }
}

console.log(JSON.stringify({
  ok: true,
  status: 'DWAC_CYCLE72_EXIT_PROBE_ALL_PASS',
  truthBoundary: {
    inheritedRegressionProofChainPreserved: true,
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
