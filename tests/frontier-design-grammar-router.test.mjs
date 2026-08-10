import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  FRONTIER_DESIGN_FAMILIES,
  buildNistCeramicDesignGrammar,
  buildSimple2x2DesignGrammar,
  normalizeFrontierDesignGrammar,
  routeFrontierScorer,
} from '../src/frontier-design-grammar-router.mjs';
import { buildKnownSoftwareInteractionControl } from '../src/frontier-external-observation-contract.mjs';

const nist = JSON.parse(fs.readFileSync('data/frontier-public-datasets/nist-ceramic-2pow5.json', 'utf8'));

test('simple 2x2 contract routes to existing blind scorer', () => {
  const grammar = buildSimple2x2DesignGrammar();
  const contract = buildKnownSoftwareInteractionControl({ samplesPerCell: 24, interactionEffect: 1.2 });
  const result = routeFrontierScorer(grammar, contract, { randomizationSeed: 11 });
  assert.equal(result.ok, true);
  assert.equal(result.route, 'frontier_symbolic_geometry_blind_2x2');
  assert.equal(result.fallbackUsed, false);
  assert.equal(result.score.score.detected, true);
});

test('NIST 2^5 dataset routes to factorial scorer and preserves published interaction scale', () => {
  const result = routeFrontierScorer(buildNistCeramicDesignGrammar(), nist);
  assert.equal(result.ok, true);
  assert.equal(result.route, 'orthogonal_full_factorial_2powk');
  assert.ok(Math.abs(result.score.terms.speed_rate.sumSquares - 4872.57) <= 0.01);
});

test('structured nuisance cannot be silently flattened into simple 2x2', () => {
  const grammar = normalizeFrontierDesignGrammar({
    family: FRONTIER_DESIGN_FAMILIES.SIMPLE_2X2,
    factors: ['speed', 'rate'],
    nuisanceFactors: ['grit', 'direction', 'batch'],
    response: 'strength',
    expectedCellCount: 4,
  });
  const result = routeFrontierScorer(grammar, nist);
  assert.equal(result.ok, false);
  assert.equal(result.status, 'BLOCKED');
  assert.ok(result.validation.failures.includes('simple_2x2_forbids_declared_structured_nuisance_without_explicit_loss_override'));
  assert.equal(result.fallbackUsed, false);
});

test('unsupported repeated-measures and continuous-field grammars block rather than fall back', () => {
  for (const family of [FRONTIER_DESIGN_FAMILIES.REPEATED_MEASURES, FRONTIER_DESIGN_FAMILIES.CONTINUOUS_FIELD]) {
    const grammar = normalizeFrontierDesignGrammar({ family, factors: ['a', 'b'], response: 'y' });
    const result = routeFrontierScorer(grammar, null);
    assert.equal(result.ok, false);
    assert.equal(result.status, 'BLOCKED');
    assert.equal(result.route, null);
    assert.equal(result.fallbackUsed, false);
  }
});

test('same declared design and payload produce deterministic route roots for factorial data', () => {
  const grammar = buildNistCeramicDesignGrammar();
  const a = routeFrontierScorer(grammar, nist);
  const b = routeFrontierScorer(grammar, nist);
  assert.equal(a.root, b.root);
  assert.equal(a.designRoot, b.designRoot);
  assert.equal(a.payloadRoot, b.payloadRoot);
});
