#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const tests = [
  'tests/foundation-conformance-truth.test.mjs',
  'tests/foundation-direct-capability-registry.test.mjs',
  'tests/foundation-native-bridge-capability-registry.test.mjs',
  'tests/foundation-quantity-native-lowering.test.mjs',
  'tests/foundation-quantitative-direct-lowering.test.mjs',
  'tests/foundation-energy-direct-lowering.test.mjs',
  'tests/foundation-neural-direct-lowering.test.mjs',
  'tests/foundation-neural-domain-receipt-parity.test.mjs',
  'tests/foundation-genetic-direct-lowering.test.mjs',
  'tests/foundation-genetic-domain-receipt-parity.test.mjs',
  'tests/foundation-living-direct-lowering.test.mjs',
  'tests/foundation-living-staged-receipt.test.mjs',
];
const steps = tests.map((file, index) => ({
  code: 10 + index,
  name: file,
  args: ['--test', file],
}));
steps.push(
  { code: 30, name: 'capability-registry-truth', args: ['scripts/verify-foundation-capability-registry-truth.mjs'] },
  { code: 31, name: 'version-contract-truth', args: ['scripts/verify-foundation-version-contract-truth.mjs'] },
  { code: 32, name: 'runtime-capability-truth', args: ['scripts/verify-foundation-capability-truth-surface.mjs'] },
  { code: 33, name: 'canonical-native-artifact', args: ['scripts/build-vercel-native.mjs'] },
  { code: 34, name: 'quantitative-direct-real-c', args: ['scripts/verify-vercel-foundation-quantitative-direct.mjs'] },
  { code: 35, name: 'batch-a-real-c-provider', args: ['scripts/verify-vercel-foundation-batch-a-bridge.mjs'] },
  { code: 36, name: 'batch-a-deployment-binding', args: ['scripts/bind-vercel-foundation-batch-a-bridge.mjs'] },
  { code: 37, name: 'full-federation-conformance', args: ['scripts/foundation-conformance.mjs', '--out', 'public/foundation-native-federation-conformance'] },
  { code: 38, name: 'canonical-conformance-truth', args: ['scripts/verify-foundation-conformance-truth.mjs', '--out', 'public/foundation-native-federation-conformance'] },
  { code: 39, name: 'developer-release-conformance-truth', args: ['scripts/verify-developer-release-conformance-truth.mjs'] },
  { code: 40, name: 'strict-federation-extension', args: ['scripts/verify-vercel-foundation-native-federation-extension.mjs'] },
  { code: 41, name: 'physical-real-c', args: ['scripts/verify-vercel-foundation-physical.mjs'] },
  { code: 42, name: 'neural-real-c', args: ['scripts/verify-vercel-foundation-neural.mjs'] },
  { code: 43, name: 'neural-deployment-binding', args: ['scripts/bind-vercel-foundation-neural.mjs'] },
  { code: 44, name: 'genetic-real-c', args: ['scripts/verify-vercel-foundation-genetic.mjs'] },
  { code: 45, name: 'living-real-c', args: ['scripts/verify-vercel-foundation-living.mjs'] },
  { code: 46, name: 'biological-deployment-binding', args: ['scripts/bind-vercel-foundation-biological.mjs'] },
  { code: 47, name: 'federation-deployment-binding', args: ['scripts/bind-vercel-foundation-native-federation.mjs'] },
  { code: 48, name: 'federation-root-stabilization', args: ['scripts/stabilize-vercel-foundation-native-federation-root.mjs'] },
  { code: 49, name: 'bridge-registry-verification', args: ['scripts/verify-foundation-native-bridge-capability-registry.mjs'] },
  { code: 50, name: 'quantitative-direct-deployment-binding', args: ['scripts/bind-vercel-foundation-quantitative-direct.mjs'] },
  { code: 51, name: 'quantitative-direct-health', args: ['scripts/verify-vercel-foundation-quantitative-direct-health.mjs'] },
  { code: 52, name: 'deployment-health', args: ['scripts/verify-vercel-health-evidence.mjs'] },
);

for (const step of steps) {
  const result = spawnSync(process.execPath, step.args, { stdio: 'inherit', env: process.env });
  if (result.error || result.status !== 0) {
    console.error(JSON.stringify({
      status: 'DWAC_CYCLE58_EXIT_PROBE_FAILURE',
      probeExitCode: step.code,
      step: step.name,
      childExitCode: result.status ?? null,
      error: result.error?.message ?? null,
    }, null, 2));
    process.exit(step.code);
  }
}
console.log(JSON.stringify({ ok: true, status: 'DWAC_CYCLE58_EXIT_PROBE_ALL_PASS' }, null, 2));
