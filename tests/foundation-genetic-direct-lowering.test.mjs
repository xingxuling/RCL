import assert from 'node:assert/strict';
import test from 'node:test';
import { lowerDeclaredFoundationToCore } from '../src/foundation-direct-lowering.mjs';

const number = value => ({ kind: 'LiteralExpr', valueType: 'Number', value });
const truth = value => ({ kind: 'LiteralExpr', valueType: 'Truth', value });
const path = value => ({ kind: 'PathExpr', path: value });
const binary = (operator, left, right) => ({ kind: 'BinaryExpr', operator, left, right });

function baseProgram() {
  return {
    name: 'GeneticNativeSlice',
    facets: [], warrants: [], functions: [], rules: [], physicals: [], perceptions: [], neurals: [], livings: [],
    genetics: [{
      kind: 'GeneticDecl', name: 'lineage', facets: [], genes: [],
      mutations: [{ target: 'genome.seed', expression: number(2) }],
      expressions: [{ target: 'body.trait', expression: binary('*', path('genome.seed'), number(3)) }],
      preserves: [binary('>=', path('body.trait'), number(0))], witnesses: ['genetic:lineage'],
    }],
    quantitatives: [], knowledges: [], naturalLanguages: [], understandings: [], creations: [],
    spacetimes: [], accelerations: [], compressions: [], metaDomains: [], energies: [], elements: [], sciences: [], embodiments: [], spirits: [],
    directives: [{ kind: 'Inherit', name: 'lineage', count: number(2), dt: null }],
  };
}

test('bounded Inherit expands each generation into ordered mutation and expression stages', () => {
  const result = lowerDeclaredFoundationToCore(baseProgram());
  assert.equal(result.summary.geneticLoweredGenerationCount, 2);
  assert.equal(result.summary.geneticLoweredStageCount, 4);
  assert.equal(result.program.genetics.length, 0);
  assert.deepEqual(result.program.directives, [
    { kind: 'Realize', rule: '__rcl_foundation_genetic_lineage_0_1_mutation' },
    { kind: 'Realize', rule: '__rcl_foundation_genetic_lineage_0_1_expression' },
    { kind: 'Realize', rule: '__rcl_foundation_genetic_lineage_0_2_mutation' },
    { kind: 'Realize', rule: '__rcl_foundation_genetic_lineage_0_2_expression' },
  ]);
  assert.deepEqual(result.lowered.map(item => [item.generationIndex, item.stage]), [[1,'mutation'],[1,'expression'],[2,'mutation'],[2,'expression']]);
});

test('mutation stage reconstructs reference additive mutation against pre-stage state', () => {
  const source = baseProgram();
  const result = lowerDeclaredFoundationToCore(source);
  assert.deepEqual(result.program.rules[0].alters, [{
    target: 'genome.seed',
    expression: binary('+', path('genome.seed'), number(2)),
  }]);
  assert.deepEqual(result.program.rules[0].preserves, []);
});

test('expression stage evaluates after mutation and owns the final preserve boundary', () => {
  const source = baseProgram();
  const result = lowerDeclaredFoundationToCore(source);
  assert.deepEqual(result.program.rules[1].alters, source.genetics[0].expressions.map(expression => ({ target: expression.target, expression: expression.expression })));
  assert.deepEqual(result.program.rules[1].preserves, source.genetics[0].preserves);
  assert.equal(result.lowered[1].finalStage, true);
  assert.deepEqual(result.lowered[1].generationStateTargets, ['genome.seed', 'body.trait']);
});

test('genetic witnesses and stage lineage remain explicit without granting more authority', () => {
  const result = lowerDeclaredFoundationToCore(baseProgram());
  assert.deepEqual(result.program.rules[0].witnesses, ['rcl:foundation:genetic:lineage:generation:1:mutation']);
  assert.deepEqual(result.program.rules[1].witnesses, ['genetic:lineage', 'rcl:foundation:genetic:lineage:generation:1:expression']);
  assert.equal(result.lowered[0].authorityClass, 'lineage-transformation');
  assert.equal(result.lowered[1].authorityClass, 'lineage-transformation');
  assert.equal(result.truthBoundary.geneticDomainReceiptParityClaimed, false);
});

test('dynamic genetic generation count fails closed and retains provider-domain semantics', () => {
  const source = baseProgram();
  source.directives[0].count = path('lineage.generations');
  const result = lowerDeclaredFoundationToCore(source);
  assert.equal(result.program.genetics.length, 1);
  assert.deepEqual(result.program.directives, source.directives);
  assert.equal(result.summary.geneticLoweredGenerationCount, 0);
  assert.ok(result.diagnostics.some(item => item.code === 'RCL_FOUNDATION_DIRECT_LOWERING_GENETIC_DYNAMIC_GENERATIONS_UNSUPPORTED'));
});

test('oversized genetic inheritance remains bounded and fails closed', () => {
  const source = baseProgram();
  source.directives[0].count = number(257);
  const result = lowerDeclaredFoundationToCore(source);
  assert.equal(result.program.genetics.length, 1);
  assert.equal(result.summary.geneticLoweredStageCount, 0);
});

test('unknown Inherit target is retained and diagnosed', () => {
  const source = baseProgram();
  source.directives[0].name = 'missing';
  const result = lowerDeclaredFoundationToCore(source);
  assert.equal(result.program.genetics.length, 1);
  assert.deepEqual(result.program.directives, source.directives);
  assert.ok(result.diagnostics.some(item => item.code === 'RCL_FOUNDATION_DIRECT_LOWERING_TARGET_UNKNOWN' && item.details.domain === 'genetic'));
});

test('genetic synthetic identities cannot shadow user core rules', () => {
  const source = baseProgram();
  const reserved = '__rcl_foundation_genetic_lineage_0_1_mutation';
  source.rules.push({ kind: 'Emergence', name: reserved, cause: 'user', when: truth(true), needs: [], alters: [], calls: [], preserves: [], witnesses: ['user'] });
  const result = lowerDeclaredFoundationToCore(source);
  assert.equal(result.program.rules[0].name, reserved);
  assert.equal(result.program.rules[1].name, `${reserved}_1`);
  assert.equal(result.lowered[0].syntheticRule, `${reserved}_1`);
  assert.equal(result.summary.renamedSyntheticRuleCount, 1);
});

test('unconsumed second genetic reality remains fail-closed', () => {
  const source = baseProgram();
  source.genetics.push({ kind: 'GeneticDecl', name: 'unused', facets: [], genes: [], mutations: [], expressions: [], preserves: [], witnesses: [] });
  const result = lowerDeclaredFoundationToCore(source);
  assert.deepEqual(result.program.genetics.map(item => item.name), ['unused']);
  assert.ok(result.diagnostics.some(item => item.code === 'RCL_FOUNDATION_DIRECT_LOWERING_DECLARATION_UNCONSUMED' && item.details.domain === 'genetic'));
});

test('domain selection can leave genetic semantics untouched while truth boundary stays explicit', () => {
  const source = baseProgram();
  const result = lowerDeclaredFoundationToCore(source, { domains: ['perception', 'physical', 'neural'] });
  assert.equal(result.program.genetics.length, 1);
  assert.deepEqual(result.program.directives, source.directives);
  assert.deepEqual(result.truthBoundary.directDomains, ['perception', 'physical', 'neural']);
  assert.equal(result.truthBoundary.allFoundationDomainsNativeClaimed, false);
});
