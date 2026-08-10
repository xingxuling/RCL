import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  validatePublicFactorialDataset,
  computeOrthogonalFactorialEffects,
  verifyNistPublishedEffectHoldout,
  mapNistCeramicToExternalObservationContract,
  runNistCeramicPublicDatasetCheck,
} from '../src/frontier-public-factorial-dataset.mjs';

const fixture = JSON.parse(fs.readFileSync('data/frontier-public-datasets/nist-ceramic-2pow5.json', 'utf8'));

test('official NIST fixture is a complete 2^5 design with 32 unique cells', () => {
  const result = validatePublicFactorialDataset(fixture);
  assert.equal(result.ok, true);
  assert.equal(result.rowCount, 32);
  assert.equal(result.uniqueDesignCells, 32);
});

test('orthogonal factorial effect engine reproduces published NIST sums of squares', () => {
  const effects = computeOrthogonalFactorialEffects(fixture);
  const holdout = verifyNistPublishedEffectHoldout(effects);
  assert.equal(effects.ok, true);
  assert.equal(holdout.ok, true);
  assert.ok(Math.abs(effects.terms.speed_rate.sumSquares - 4872.57) <= 0.01);
  assert.ok(Math.abs(effects.terms.direction.sumSquares - 315132.65) <= 0.01);
});

test('public dataset maps into the same immutable external observation contract without publishing holdout truth to scorer', () => {
  const mapped = mapNistCeramicToExternalObservationContract(fixture);
  assert.equal(mapped.ok, true);
  assert.equal(mapped.contract.provenance.sourceType, 'public_dataset');
  assert.equal(mapped.contract.rows.length, 32);
  assert.equal(mapped.publishedHoldoutIncludedInContract, false);
});

test('Phase1D records generic 2x2 scorer miss as negative result while structured factorial engine passes public reproduction', () => {
  const result = runNistCeramicPublicDatasetCheck(fixture);
  assert.equal(result.ok, true);
  assert.equal(result.factorialEngineReproducesPublishedSummary, true);
  assert.equal(result.currentGenericScorerReproducesPublishedSpeedRateInteraction, false);
  assert.equal(result.blind2x2.detected, false);
  assert.equal(result.blind2x2.modelWinner, 'H0_null');
  assert.equal(result.methodologicalFinding, 'generic_2x2_scorer_missed_public_interaction_due_to_structured_nuisance_variation_do_not_relax_thresholds_use_factorial_structure');
  assert.equal(result.externalRealityVerified, false);
});
