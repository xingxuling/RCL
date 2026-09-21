#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const federationBaseline = `
import { verifyFoundationNativeFederationRegistryBinding } from './src/foundation-native-federation-registry-binding.mjs';
const ROOT='a'.repeat(64);
const SPECS=[
{batchId:'batch-a',providerId:'provider-a',providerCallCount:2,domain:'alpha',capability:'alpha.run',statePath:'bridge.alpha'},
{batchId:'batch-a',providerId:'provider-a',providerCallCount:2,domain:'beta',capability:'beta.run',statePath:'bridge.beta'}];
const proof={providerBridgeRegistryRoot:ROOT,providerBridgeSpecCount:2,domains:['alpha','beta'],providerBatches:{'batch-a':{providerId:'provider-a',providerAbi:1,providerCallCount:2,domains:['alpha','beta']}}};
try { const result=verifyFoundationNativeFederationRegistryBinding({federationProof:proof,bridgeSpecs:SPECS,registrySnapshot:{registryRoot:ROOT}}); if(result?.ok!==true) process.exit(102); } catch(error) { console.error(error?.code,error?.message,error?.details); process.exit(101); }
`;

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
  { code: null, propagateChildStatus: true, name: 'federation-registry-inline-baseline', args: ['--input-type=module', '-e', federationBaseline] },
  { code: 74, name: 'federation-registry-negative-controls', args: ['--test', 'tests/foundation-native-federation-registry-binding.test.mjs'] },
  { code: 75, name: 'deployed-federation-registry-binding', args: ['scripts/verify-vercel-foundation-native-federation-registry-binding.mjs'] },
  { code: 76, name: 'cycle68-deployment-health-regression', args: ['scripts/verify-vercel-health-evidence.mjs'] },
  { code: 77, name: 'cycle68-runtime-health-truth-regression', args: ['scripts/verify-vercel-runtime-health-truth.mjs'] },
  { code: 78, name: 'runtime-federation-registry-attestation', args: ['scripts/verify-vercel-runtime-federation-registry-binding.mjs'] },
  { code: 79, name: 'cycle69-deployment-health-regression', args: ['scripts/verify-vercel-health-evidence.mjs'] },
  { code: 80, name: 'cycle69-runtime-health-truth-regression', args: ['scripts/verify-vercel-runtime-health-truth.mjs'] },
  { code: 81, name: 'provider-bridge-statepath-attestation-bind', args: ['scripts/bind-vercel-foundation-native-bridge-statepath-attestation.mjs'] },
  { code: 82, name: 'provider-bridge-statepath-negative-controls', args: ['--test', 'tests/foundation-native-bridge-statepath-attestation.test.mjs'] },
  { code: 83, name: 'provider-bridge-statepath-deployment-attestation', args: ['scripts/verify-vercel-foundation-native-bridge-statepath-attestation.mjs'] },
  { code: 84, name: 'runtime-health-statepath-negative-controls', args: ['scripts/verify-runtime-health-statepath-negative-control.mjs'] },
  { code: 85, name: 'runtime-health-statepath-truth-binding', args: ['scripts/verify-vercel-runtime-health-statepath-truth.mjs'] },
  { code: 86, name: 'knowledge-direct-negative-controls', args: ['scripts/verify-foundation-knowledge-direct-negative-control.mjs'] },
  { code: 87, name: 'knowledge-runtime-capability-truth', args: ['scripts/verify-foundation-knowledge-deployment-truth.mjs'] },
];

for (const step of steps) {
  const result = spawnSync(process.execPath, step.args, { stdio: 'inherit', env: process.env });
  if (result.error || result.status !== 0) {
    const exitCode = step.propagateChildStatus && Number.isInteger(result.status) ? result.status : step.code;
    console.error(JSON.stringify({ status: 'DWAC_CYCLE72_EXIT_PROBE_FAILURE', probeExitCode: exitCode, step: step.name, childExitCode: result.status ?? null, error: result.error?.message ?? null }, null, 2));
    process.exit(exitCode ?? 1);
  }
}
console.log(JSON.stringify({ok:true,status:'DWAC_CYCLE72_EXIT_PROBE_ALL_PASS',truthBoundary:{inheritedRegressionProofChainPreserved:true,boundedSingleClaimKnowledgeDirectLoweringVerified:true,canonicalRealCStateAndSemanticRootParityRequired:true,exactInitialFormedAtRootBound:true,runtimeCapabilityTruthBindsKnowledgeDeploymentEvidence:true,unsupportedKnowledgeProgramsRemainProviderBound:true,knowledgeProviderBridgeRemovedGlobally:false,allKnowledgeProgramsNativeClaimed:false,knowledgeDomainReceiptParityClaimed:false}},null,2));
