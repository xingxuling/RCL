import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildUnknownLawExperimentSpec,
  buildDefaultUnknownLawExperimentPortfolio,
  validateUnknownLawExperimentSpec,
} from '../src/frontier-unknown-law-experiment-spec.mjs';

test('portfolio binds the three first unknown-law lanes to existing candidate roots', () => {
  const p = buildDefaultUnknownLawExperimentPortfolio();
  assert.equal(p.specs.length, 3);
  assert.deepEqual(p.specs.map((x) => x.laneId).sort(), [
    'aether_substrate_information_medium',
    'formation_spatial_constraint_array',
    'spell_symbolic_control_protocol',
  ]);
  for (const spec of p.specs) {
    assert.ok(spec.sourceCandidateRoot);
    assert.equal(validateUnknownLawExperimentSpec(spec).ok, true);
    assert.equal(spec.boundary.externalRealityVerified, false);
    assert.equal(spec.boundary.magicVerified, false);
  }
});

test('symbolic-control study is immediately compatible with the existing simple 2x2 analysis family', () => {
  const spec = buildUnknownLawExperimentSpec('spell_symbolic_control_protocol');
  assert.equal(spec.designGrammar.family, 'simple_2x2');
  assert.equal(spec.analysisRuntimeStatus, 'READY_EXISTING_SIMPLE_2X2_SCORER');
  assert.equal(spec.designGrammar.expectedCellCount, 4);
  assert.ok(spec.stopConditions.some((x) => x.includes('ordinary')));
});

test('formation study preserves factorial structure instead of flattening it', () => {
  const spec = buildUnknownLawExperimentSpec('formation_spatial_constraint_array');
  assert.equal(spec.designGrammar.family, 'full_factorial_2powk');
  assert.equal(spec.designGrammar.expectedCellCount, 8);
  assert.equal(spec.analysisRuntimeStatus, 'BLOCKED_PENDING_GENERIC_FULL_FACTORIAL_PAYLOAD_ADAPTER');
  assert.deepEqual(spec.designGrammar.factors, ['layout_topology', 'orientation', 'boundary_mask']);
});

test('aether study fails closed until a dedicated continuous-field scorer exists', () => {
  const spec = buildUnknownLawExperimentSpec('aether_substrate_information_medium');
  assert.equal(spec.designGrammar.family, 'continuous_field');
  assert.equal(spec.analysisRuntimeStatus, 'BLOCKED_PENDING_CONTINUOUS_FIELD_SCORER');
  assert.ok(spec.stopConditions[0].includes('continuous-field scorer'));
});

test('spec root detects post-build mutation', () => {
  const spec = buildUnknownLawExperimentSpec('spell_symbolic_control_protocol');
  spec.nullHypothesis = 'post hoc replacement';
  const v = validateUnknownLawExperimentSpec(spec);
  assert.equal(v.ok, false);
  assert.ok(v.failures.includes('spec_root_mismatch'));
});
