#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const steps = [
  ['targeted-foundation-tests', [
    '--test',
    'tests/foundation-conformance-truth.test.mjs',
    'tests/foundation-direct-capability-registry.test.mjs',
    'tests/foundation-native-bridge-capability-registry.test.mjs',
    'tests/foundation-quantity-native-lowering.test.mjs',
    'tests/foundation-quantitative-direct-lowering.test.mjs',
    'tests/foundation-energy-direct-lowering.test.mjs',
    'tests/foundation-energy-native-parity.test.mjs',
    'tests/foundation-neural-direct-lowering.test.mjs',
    'tests/foundation-neural-domain-receipt-parity.test.mjs',
    'tests/foundation-genetic-direct-lowering.test.mjs',
    'tests/foundation-genetic-domain-receipt-parity.test.mjs',
    'tests/foundation-living-direct-lowering.test.mjs',
    'tests/foundation-living-staged-receipt.test.mjs',
  ]],
  ['capability-registry-truth-verification', [
    'scripts/verify-foundation-capability-registry-truth.mjs',
  ]],
  ['version-contract-capability-truth-verification', [
    'scripts/verify-foundation-version-contract-truth.mjs',
  ]],
  ['runtime-capability-truth-surface-verification', [
    'scripts/verify-foundation-capability-truth-surface.mjs',
  ]],
  ['canonical-native-artifact', ['scripts/build-vercel-native.mjs']],
  ['quantitative-declared-direct-real-c-proof', ['scripts/verify-vercel-foundation-quantitative-direct.mjs']],
  ['batch-a-real-c-provider-proof', ['scripts/verify-vercel-foundation-batch-a-bridge.mjs']],
  ['batch-a-bridge-deployment-binding', ['scripts/bind-vercel-foundation-batch-a-bridge.mjs']],
  ['full-native-provider-federation-conformance', [
    'scripts/foundation-conformance.mjs',
    '--out',
    'public/foundation-native-federation-conformance',
  ]],
  ['canonical-foundation-conformance-truth-verification', [
    'scripts/verify-foundation-conformance-truth.mjs',
    '--out',
    'public/foundation-native-federation-conformance',
  ]],
  ['developer-release-conformance-truth-proof', [
    'scripts/verify-developer-release-conformance-truth.mjs',
  ]],
  ['strict-native-provider-federation-extension-proof', [
    'scripts/verify-vercel-foundation-native-federation-extension.mjs',
  ]],
  ['physical-real-c-proof', ['scripts/verify-vercel-foundation-physical.mjs']],
  ['neural-real-c-proof', ['scripts/verify-vercel-foundation-neural.mjs']],
  ['neural-deployment-binding', ['scripts/bind-vercel-foundation-neural.mjs']],
  ['genetic-real-c-proof', ['scripts/verify-vercel-foundation-genetic.mjs']],
  ['living-real-c-proof', ['scripts/verify-vercel-foundation-living.mjs']],
  ['biological-deployment-binding', ['scripts/bind-vercel-foundation-biological.mjs']],
  ['energy-real-c-receipt-parity-proof', ['scripts/verify-vercel-foundation-energy.mjs']],
  ['native-provider-federation-deployment-binding', [
    'scripts/bind-vercel-foundation-native-federation.mjs',
  ]],
  ['native-provider-federation-root-stabilization', [
    'scripts/stabilize-vercel-foundation-native-federation-root.mjs',
  ]],
  ['provider-bridge-capability-registry-verification', [
    'scripts/verify-foundation-native-bridge-capability-registry.mjs',
  ]],
  ['quantitative-direct-deployment-binding', [
    'scripts/bind-vercel-foundation-quantitative-direct.mjs',
  ]],
  ['quantitative-direct-health-evidence', [
    'scripts/verify-vercel-foundation-quantitative-direct-health.mjs',
  ]],
  ['deployment-health-evidence', ['scripts/verify-vercel-health-evidence.mjs']],
];

for (const [name, args] of steps) {
  const result = spawnSync(process.execPath, args, {
    stdio: 'inherit',
    env: process.env,
  });
  if (result.error) {
    console.error(JSON.stringify({
      ok: false,
      status: 'RCL_VERCEL_PROOF_CHAIN_STEP_FAILED',
      step: name,
      error: result.error.message,
    }, null, 2));
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(JSON.stringify({
      ok: false,
      status: 'RCL_VERCEL_PROOF_CHAIN_STEP_FAILED',
      step: name,
      exitCode: result.status,
      signal: result.signal ?? null,
    }, null, 2));
    process.exit(result.status ?? 1);
  }
}

console.log(JSON.stringify({
  ok: true,
  status: 'RCL_VERCEL_PROOF_CHAIN_VERIFIED',
  steps: steps.map(([name]) => name),
}, null, 2));
