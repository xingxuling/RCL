import test from 'node:test';
import assert from 'node:assert/strict';
import { runFrontierNaturalLawCalibrationBenchmark } from '../src/frontier-natural-law-calibration-benchmark.mjs';

const lanes = [
  'spell_symbolic_control_protocol',
  'aether_substrate_information_medium',
  'formation_spatial_constraint_array',
  'qi_environmental_biofield_coupling',
  'mana_crystal_reservoir',
  'alchemical_transmutation_lattice',
];

test('synthetic calibration rejects nulls and detects injected effects', () => {
  const result = runFrontierNaturalLawCalibrationBenchmark(lanes);
  assert.equal(result.calibrationPassed, true);
  assert.equal(result.nullControlsPass, true);
  assert.equal(result.injectedControlsPass, true);
  assert.equal(result.externalRealityVerified, false);
  assert.equal(result.rows.length, 6);
});

test('calibration is deterministic at fixed seed', () => {
  const a = runFrontierNaturalLawCalibrationBenchmark(lanes, { seed: 7 });
  const b = runFrontierNaturalLawCalibrationBenchmark(lanes, { seed: 7 });
  assert.equal(a.root, b.root);
  assert.deepEqual(a.rows, b.rows);
});
