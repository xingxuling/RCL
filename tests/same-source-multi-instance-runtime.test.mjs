import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  buildSameSourceMultiInstanceSpec,
  createGeneratorPartition,
  deriveSparseCoordinate,
  evaluateHeldOutConvergence,
  renderSameSourceMultiInstanceRcl,
  runSameSourceControls,
  runSameSourceMultiInstanceRuntime,
  runSparseMultiInstanceSearch,
  splitEndpoint64,
} from '../src/same-source-multi-instance-runtime.mjs';

const fixture = {
  instanceCount: 96,
  epochs: 5,
  fanout: 3,
  seed: 'test-v095',
  baseEndpoint64: 'AAB8A4809AEF1D05',
};

test('24+40 endpoint split is stable', () => {
  const split = splitEndpoint64('AAB8A4809AEF1D05');
  assert.equal(split.realm24, 'AAB8A4');
  assert.equal(split.instance40, '809AEF1D05');
});

test('sparse coordinate derivation is deterministic', () => {
  assert.deepEqual(deriveSparseCoordinate('AAB8A4809AEF1D05', 19, 'x'), deriveSparseCoordinate('AAB8A4809AEF1D05', 19, 'x'));
});

test('generator partition contains no holdout object', () => {
  const g = createGeneratorPartition(fixture);
  assert.equal('holdout' in g, false);
  assert.equal('expected' in g, false);
});

test('search is deterministic', () => {
  const a = runSparseMultiInstanceSearch(fixture);
  const b = runSparseMultiInstanceSearch(fixture);
  assert.equal(a.result.resultRoot, b.result.resultRoot);
  assert.equal(a.result.finalConvergence.convergenceRoot, b.result.finalConvergence.convergenceRoot);
});

test('search emits sparse edges and lineage roots', () => {
  const bundle = runSparseMultiInstanceSearch(fixture);
  assert.ok(bundle.epochs.every(x => x.edgeCount > 0));
  assert.ok(bundle.finalists.every(x => x.identity.lineageRoot));
});

test('held-out evaluator does not affect generator root', () => {
  const search = runSparseMultiInstanceSearch(fixture);
  const root = search.generator.partitionRoot;
  const evalA = evaluateHeldOutConvergence(search, { expected: { topology: ['mesh'] } });
  const evalB = evaluateHeldOutConvergence(search, { expected: { topology: ['containment_interface'] } });
  assert.equal(search.generator.partitionRoot, root);
  assert.notEqual(evalA.evaluatorRoot, evalB.evaluatorRoot);
});

test('full runtime keeps external-proof boundary false', () => {
  const bundle = runSameSourceMultiInstanceRuntime(fixture, null);
  assert.equal(bundle.result.canClaimExternalUniverseProof, false);
  assert.equal(bundle.result.ok, true);
});

test('controls are present', () => {
  const controls = runSameSourceControls({ ...fixture, instanceCount: 64, epochs: 4 });
  assert.ok(controls.primary.resultRoot);
  assert.ok(controls.randomCoreControl.resultRoot);
});

test('rendered RCL contains boundary and witness', () => {
  const rcl = renderSameSourceMultiInstanceRcl({ ...fixture, instanceCount: 32, epochs: 3 });
  assert.match(rcl, /can_claim_external_universe_proof : Truth = false/);
  assert.match(rcl, /rcl:same-source-multi-instance:v0\.95/);
});
