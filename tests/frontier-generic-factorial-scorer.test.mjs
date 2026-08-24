import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildGenericFullFactorialPayload,
  computeGenericOrthogonalFactorialEffects,
  validateGenericFullFactorialPayload,
} from '../src/frontier-generic-factorial-scorer.mjs';
import { routeFrontierScorer } from '../src/frontier-design-grammar-router.mjs';

const grammar = {
  id: 'generic_2pow3_test',
  family: 'full_factorial_2powk',
  factors: ['a', 'b', 'c'],
  nuisanceFactors: [],
  targetTerms: ['a', 'a:b'],
  response: 'response',
  levelEncoding: 'pm1',
  expectedCellCount: 8,
  declaredBeforeScoring: true,
};

function deterministicPayload() {
  const rows = [];
  let i = 0;
  for (const a of [-1, 1]) for (const b of [-1, 1]) for (const c of [-1, 1]) {
    for (let rep = 0; rep < 4; rep += 1) {
      rows.push({
        observationId: `g_${++i}`,
        factors: { a, b, c },
        response: 0.6 * a + 0.8 * a * b + 0.01 * (rep - 1.5),
      });
    }
  }
  return buildGenericFullFactorialPayload({ id: 'generic_test', factors: ['a', 'b', 'c'], rows });
}

test('generic full-factorial payload validates complete balanced 2^3 design', () => {
  const payload = deterministicPayload();
  const validation = validateGenericFullFactorialPayload(payload, grammar);
  assert.equal(validation.ok, true);
  assert.equal(validation.uniqueDesignCells, 8);
  assert.equal(validation.replicatesPerCell, 4);
});

test('generic orthogonal scorer recovers preregistered main and interaction terms', () => {
  const score = computeGenericOrthogonalFactorialEffects(deterministicPayload(), grammar, {
    minAbsEffect: 0.35,
    minStandardizedEffect: 2,
  });
  assert.equal(score.ok, true);
  assert.deepEqual([...score.detectedTargetTerms].sort(), ['a', 'a:b']);
});

test('design router selects generic factorial route without fallback', () => {
  const routed = routeFrontierScorer(grammar, deterministicPayload());
  assert.equal(routed.ok, true);
  assert.equal(routed.route, 'generic_orthogonal_full_factorial_2powk');
  assert.equal(routed.fallbackUsed, false);
});

test('generic factorial validator rejects incomplete cell coverage', () => {
  const payload = deterministicPayload();
  payload.rows = payload.rows.filter((row) => !(row.factors.a === 1 && row.factors.b === 1 && row.factors.c === 1));
  payload.root = null;
  const validation = validateGenericFullFactorialPayload(payload, grammar);
  assert.equal(validation.ok, false);
  assert.equal(validation.failures.includes('incomplete_full_factorial_design'), true);
});
