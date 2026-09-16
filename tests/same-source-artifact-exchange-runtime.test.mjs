
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSameSourceArtifactExchangeSpec,
  createInstances,
  buildSparseEdges,
  generateArtifacts,
  autonomousDiscoverArtifacts,
  transmitArtifact,
  runArtifactExchangeControls,
  runSameSourceArtifactExchange,
} from '../src/same-source-artifact-exchange-runtime.mjs';

test('creates distinct instances under one shared core', () => {
  const spec = buildSameSourceArtifactExchangeSpec({ instanceCount: 32 });
  const rows = createInstances(spec);
  assert.equal(rows.length, 32);
  assert.equal(new Set(rows.map(r => r.id)).size, 32);
  assert.equal(new Set(rows.map(r => r.coreId)).size, 1);
});

test('builds sparse rather than complete topology', () => {
  const spec = buildSameSourceArtifactExchangeSpec({ instanceCount: 64, fanout: 4 });
  const rows = createInstances(spec);
  const edges = buildSparseEdges(rows, spec);
  assert.ok(edges.length <= 64 * 4);
  assert.ok(edges.length < 64 * 63);
});

test('autonomous discovery selects visible generated artifacts', () => {
  const spec = buildSameSourceArtifactExchangeSpec({ instanceCount: 1 });
  const [row] = createInstances(spec);
  const artifacts = generateArtifacts(row, spec, 1);
  row.vfs = artifacts;
  const discovered = autonomousDiscoverArtifacts(row);
  assert.equal(discovered.length, spec.artifactKinds.length);
  assert.equal(discovered.every(x => x.userPreselected === false), true);
});

test('artifact transport preserves exact content integrity', () => {
  const spec = buildSameSourceArtifactExchangeSpec({ instanceCount: 2 });
  const [a, b] = createInstances(spec);
  const [artifact] = generateArtifacts(a, spec, 1);
  const receipt = transmitArtifact(a, b, artifact, spec);
  assert.equal(receipt.accepted, true);
  assert.equal(b.acceptedArtifacts, 1);
});

test('negative controls reject tamper replay and cross-core', () => {
  const controls = runArtifactExchangeControls({ instanceCount: 2 });
  assert.equal(controls.cleanAccepted, true);
  assert.equal(controls.tamperRejected, true);
  assert.equal(controls.replayRejected, true);
  assert.equal(controls.crossCoreRejected, true);
});

test('runtime establishes governed artifact exchange and convergence', () => {
  const result = runSameSourceArtifactExchange({
    instanceCount: 128,
    epochs: 10,
    fanout: 4,
    thresholds: { minConvergenceGain: 0.03 },
  });
  assert.equal(result.artifactExchangeEstablished, true);
  assert.equal(result.evidence.judge.controls.tamperRejected, true);
  assert.equal(result.evidence.judge.controls.replayRejected, true);
  assert.equal(result.evidence.judge.controls.crossCoreRejected, true);
  assert.ok(result.evidence.finalConvergence >= result.evidence.initialConvergence);
  assert.equal(result.canClaimExternalUniverseProof, false);
});
