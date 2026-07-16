import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { test } from 'node:test';
import {
  FOUNDATION_MANIFEST,
  FOUNDATION_DOMAINS,
  FOUNDATION_COMPOSITE_PLANES,
  FOUNDATION_META_PLANES,
  FOUNDATION_CROSS_DOMAIN_AXES,
  FOUNDATION_4R,
  foundationManifestSummary,
  runReality,
  tryCompileRealityToBytecode,
} from '../src/index.mjs';

test('Foundation Contract is complete and canonical', () => {
  const counts = foundationManifestSummary().counts;
  assert.deepEqual(counts, { domains: 14, compositePlanes: 5, metaRealityPlanes: 3, crossDomainAxes: 2, realityRobustness: 4 });
  assert.equal(FOUNDATION_MANIFEST.format, 'taowind.rcl-foundation-contract.v0.1');
  assert.equal([...FOUNDATION_DOMAINS, ...FOUNDATION_COMPOSITE_PLANES, ...FOUNDATION_META_PLANES, ...FOUNDATION_CROSS_DOMAIN_AXES].every(item => item.inputSchema && item.outputSchema && item.stateSchema && item.proposalSchema && item.constraintSchema && item.evidenceSchema), true);
  assert.equal(FOUNDATION_4R.every(item => item.requiredArtifacts.length > 0), true);
});

test('reference runtime emits standard Foundation results and deterministic roots', async () => {
  const source = await fs.readFile(new URL('../examples/cognitive-creation-agent.rcl', import.meta.url), 'utf8');
  const first = await runReality(source);
  const second = await runReality(source);
  assert.ok(first.foundationRuntime.length > 0);
  assert.equal(first.stateRoot, second.stateRoot);
  assert.deepEqual(first.foundationRuntime, second.foundationRuntime);
  assert.equal(first.foundationRuntime.every(item => item.format === 'taowind.rcl-foundation-runtime-result.v0.1' && typeof item.replayMetadata.deterministic === 'boolean'), true);
  assert.equal(first.foundationRuntime.some(item => item.domain === 'natural-language-reality' && item.evidence.length > 0), true);
});

test('native boundary is explicit instead of claiming unsupported domains', async () => {
  const source = await fs.readFile(new URL('../examples/foundation-closure.rcl', import.meta.url), 'utf8');
  const result = tryCompileRealityToBytecode(source);
  assert.equal(result.ok, false);
  assert.equal(result.diagnostics.some(item => item.code === 'RCL_NATIVE_DOMAIN_PROVIDER_REQUIRED'), true);
});

test('behavior mutation changes the Foundation state root', async () => {
  const source = await fs.readFile(new URL('../examples/eight-domain-foundation.rcl', import.meta.url), 'utf8');
  const mutated = source.replace('dt seconds(1)', 'dt seconds(2)');
  assert.notEqual((await runReality(source)).stateRoot, (await runReality(mutated)).stateRoot);
});
