import assert from 'node:assert/strict';
import test from 'node:test';
import { lowerDeclaredFoundationToCore } from '../src/foundation-direct-lowering.mjs';

const number = value => ({ kind: 'LiteralExpr', valueType: 'Number', value });
const truth = value => ({ kind: 'LiteralExpr', valueType: 'Truth', value });
const path = value => ({ kind: 'PathExpr', path: value });
const binary = (operator, left, right) => ({ kind: 'BinaryExpr', operator, left, right });

function baseProgram() {
  return {
    name: 'NeuralNativeSlice',
    facets: [
      { kind: 'FacetDecl', path: 'brain.stimulus', valueType: 'Number', value: number(1) },
      { kind: 'FacetDecl', path: 'brain.response', valueType: 'Number', value: number(0) },
      { kind: 'FacetDecl', path: 'brain.trace', valueType: 'Number', value: number(0) },
    ],
    warrants: [], functions: [], rules: [], physicals: [], perceptions: [],
    neurals: [{
      kind: 'NeuralDecl', name: 'brain', facets: [], pathways: [
        {
          kind: 'NeuralPathwayDecl', name: 'brain.integrate', domain: 'brain',
          when: binary('>', path('brain.stimulus'), number(0)),
          changes: [{ mode: 'transmit', target: 'brain.response', expression: binary('+', path('brain.response'), path('brain.stimulus')) }],
          preserves: [binary('>=', path('brain.response'), number(0))], witnesses: ['neural:integrate'],
        },
        {
          kind: 'NeuralPathwayDecl', name: 'brain.trace', domain: 'brain',
          when: truth(true),
          changes: [{ mode: 'learn', target: 'brain.trace', expression: binary('+', path('brain.trace'), path('brain.response')) }],
          preserves: [], witnesses: ['neural:trace'],
        },
      ],
    }],
    livings: [], genetics: [], quantitatives: [], knowledges: [], naturalLanguages: [], understandings: [], creations: [],
    spacetimes: [], accelerations: [], compressions: [], metaDomains: [], energies: [], elements: [], sciences: [], embodiments: [], spirits: [],
    directives: [{ kind: 'Propagate', name: 'brain', count: number(2), dt: null }],
  };
}

test('bounded Propagate expands each step and pathway into ordered unique core Realize transactions', () => {
  const result = lowerDeclaredFoundationToCore(baseProgram());
  assert.equal(result.summary.neuralLoweredTransactionCount, 4);
  assert.equal(result.program.neurals.length, 0);
  assert.deepEqual(result.program.directives, [
    { kind: 'Realize', rule: '__rcl_foundation_neural_brain_integrate_0_1_1' },
    { kind: 'Realize', rule: '__rcl_foundation_neural_brain_trace_0_1_2' },
    { kind: 'Realize', rule: '__rcl_foundation_neural_brain_integrate_0_2_1' },
    { kind: 'Realize', rule: '__rcl_foundation_neural_brain_trace_0_2_2' },
  ]);
  assert.deepEqual(result.lowered.map(item => [item.stepIndex, item.pathwayIndex]), [[1,1],[1,2],[2,1],[2,2]]);
});

test('neural conditions, changes and preserves are structurally preserved', () => {
  const source = baseProgram();
  const result = lowerDeclaredFoundationToCore(source);
  const first = result.program.rules[0];
  assert.deepEqual(first.when, source.neurals[0].pathways[0].when);
  assert.deepEqual(first.alters, source.neurals[0].pathways[0].changes.map(change => ({ target: change.target, expression: change.expression })));
  assert.deepEqual(first.preserves, source.neurals[0].pathways[0].preserves);
});

test('neural lowering preserves original witnesses and deterministic lineage witness', () => {
  const result = lowerDeclaredFoundationToCore(baseProgram());
  assert.deepEqual(result.program.rules[0].witnesses, ['neural:integrate', 'rcl:foundation:neural:brain.integrate:step:1']);
  assert.equal(result.lowered[0].authorityClass, 'intrinsic-neural-dynamics');
  assert.equal(result.lowered[0].sourceReality, 'brain');
  assert.deepEqual(result.lowered[0].originalWitnesses, ['neural:integrate']);
  assert.deepEqual(result.lowered[0].changeModes, ['transmit']);
});

test('dynamic neural step count fails closed and retains neural provider-domain semantics', () => {
  const source = baseProgram();
  source.directives[0].count = path('brain.steps');
  const result = lowerDeclaredFoundationToCore(source);
  assert.equal(result.program.neurals.length, 1);
  assert.deepEqual(result.program.directives, source.directives);
  assert.equal(result.summary.neuralLoweredTransactionCount, 0);
  assert.ok(result.diagnostics.some(item => item.code === 'RCL_FOUNDATION_DIRECT_LOWERING_NEURAL_DYNAMIC_STEPS_UNSUPPORTED'));
});

test('neural domain without pathways fails closed', () => {
  const source = baseProgram();
  source.neurals[0].pathways = [];
  const result = lowerDeclaredFoundationToCore(source);
  assert.equal(result.program.neurals.length, 1);
  assert.ok(result.diagnostics.some(item => item.code === 'RCL_FOUNDATION_DIRECT_LOWERING_NEURAL_PATHWAYS_MISSING'));
});

test('unknown Propagate target is retained and diagnosed', () => {
  const source = baseProgram();
  source.directives[0].name = 'missing';
  const result = lowerDeclaredFoundationToCore(source);
  assert.equal(result.program.neurals.length, 1);
  assert.deepEqual(result.program.directives, source.directives);
  assert.ok(result.diagnostics.some(item => item.code === 'RCL_FOUNDATION_DIRECT_LOWERING_TARGET_UNKNOWN' && item.details.domain === 'neural'));
});

test('neural synthetic identity cannot shadow a user core rule', () => {
  const source = baseProgram();
  const reserved = '__rcl_foundation_neural_brain_integrate_0_1_1';
  source.rules.push({ kind: 'Emergence', name: reserved, cause: 'user', when: truth(true), needs: [], alters: [], calls: [], preserves: [], witnesses: ['user'] });
  const result = lowerDeclaredFoundationToCore(source);
  assert.equal(result.program.rules[0].name, reserved);
  assert.equal(result.program.rules[1].name, `${reserved}_1`);
  assert.equal(result.lowered[0].syntheticRule, `${reserved}_1`);
  assert.equal(result.summary.renamedSyntheticRuleCount, 1);
});

test('unconsumed second neural domain remains to preserve native fail-closed validation', () => {
  const source = baseProgram();
  source.neurals.push({ kind: 'NeuralDecl', name: 'unused', facets: [], pathways: [{ kind: 'NeuralPathwayDecl', name: 'unused.p', domain: 'unused', when: truth(true), changes: [], preserves: [], witnesses: [] }] });
  const result = lowerDeclaredFoundationToCore(source);
  assert.deepEqual(result.program.neurals.map(item => item.name), ['unused']);
  assert.ok(result.diagnostics.some(item => item.code === 'RCL_FOUNDATION_DIRECT_LOWERING_DECLARATION_UNCONSUMED' && item.details.domain === 'neural'));
});

test('oversized neural propagation is rejected to keep direct lowering bounded', () => {
  const source = baseProgram();
  source.directives[0].count = number(257);
  const result = lowerDeclaredFoundationToCore(source);
  assert.equal(result.program.neurals.length, 1);
  assert.equal(result.summary.neuralLoweredTransactionCount, 0);
});

test('domain selection can leave neural semantics untouched while truth boundary stays explicit', () => {
  const source = baseProgram();
  const result = lowerDeclaredFoundationToCore(source, { domains: ['perception', 'physical'] });
  assert.equal(result.program.neurals.length, 1);
  assert.deepEqual(result.program.directives, source.directives);
  assert.deepEqual(result.truthBoundary.directDomains, ['perception', 'physical']);
  assert.equal(result.truthBoundary.allFoundationDomainsNativeClaimed, false);
});
