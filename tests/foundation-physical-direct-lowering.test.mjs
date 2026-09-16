import assert from 'node:assert/strict';
import test from 'node:test';
import { lowerDeclaredFoundationToCore } from '../src/foundation-direct-lowering.mjs';

const number = value => ({ kind: 'LiteralExpr', valueType: 'Number', value });
const path = value => ({ kind: 'PathExpr', path: value });
const call = (name, ...args) => ({ kind: 'CallExpr', name, args });
const binary = (operator, left, right) => ({ kind: 'BinaryExpr', operator, left, right });

function physicalProgram() {
  return {
    name: 'PhysicalNativeSlice',
    facets: [
      { kind: 'FacetDecl', path: 'world.position', valueType: 'Number', value: number(10) },
      { kind: 'FacetDecl', path: 'world.velocity', valueType: 'Number', value: number(0) },
      { kind: 'FacetDecl', path: 'world.acceleration', valueType: 'Number', value: number(-1) },
    ],
    warrants: [], functions: [], rules: [],
    physicals: [{
      kind: 'PhysicalDecl',
      name: 'world',
      facets: [], bodies: [], fields: [],
      laws: [{
        kind: 'PhysicalLawDecl',
        name: 'world.fall',
        domain: 'world',
        step: { name: 'dt', valueType: 'Time' },
        when: binary('>', path('world.position'), number(0)),
        evolves: [
          { target: 'world.velocity', expression: binary('+', path('world.velocity'), binary('*', path('world.acceleration'), path('dt'))) },
          { target: 'world.position', expression: binary('+', path('world.position'), binary('*', path('world.velocity'), path('dt'))) },
        ],
        conserves: [binary('>=', path('world.position'), number(0))],
        witnesses: ['physical:gravity'],
      }],
    }],
    perceptions: [], neurals: [], livings: [], genetics: [], quantitatives: [], knowledges: [], naturalLanguages: [],
    understandings: [], creations: [], spacetimes: [], accelerations: [], compressions: [], metaDomains: [], energies: [],
    elements: [], sciences: [], embodiments: [], spirits: [],
    directives: [{ kind: 'Advance', name: 'world.fall', count: number(2), dt: call('seconds', number(1)) }],
  };
}

function hasPath(value, target) {
  if (Array.isArray(value)) return value.some(item => hasPath(item, target));
  if (value && typeof value === 'object') {
    if (value.kind === 'PathExpr' && value.path === target) return true;
    return Object.values(value).some(item => hasPath(item, target));
  }
  return false;
}

test('bounded physical Advance lowers into one unique core Realize transaction per step', () => {
  const result = lowerDeclaredFoundationToCore(physicalProgram());
  assert.equal(result.summary.physicalLoweredStepCount, 2);
  assert.equal(result.program.physicals.length, 0);
  assert.equal(result.program.rules.length, 2);
  assert.deepEqual(result.program.directives, [
    { kind: 'Realize', rule: '__rcl_foundation_physical_world_fall_0_1' },
    { kind: 'Realize', rule: '__rcl_foundation_physical_world_fall_0_2' },
  ]);
  assert.deepEqual(result.lowered.map(item => item.stepIndex), [1, 2]);
  assert.ok(result.lowered.every(item => item.stepCount === 2 && item.authorityClass === 'natural-law'));
});

test('physical step variable is structurally substituted with the state-independent dt expression', () => {
  const result = lowerDeclaredFoundationToCore(physicalProgram());
  for (const rule of result.program.rules) {
    assert.equal(hasPath(rule.when, 'dt'), false);
    assert.equal(hasPath(rule.alters, 'dt'), false);
    assert.equal(hasPath(rule.preserves, 'dt'), false);
    assert.deepEqual(rule.witnesses, ['physical:gravity', `rcl:foundation:physical:world.fall:step:${result.program.rules.indexOf(rule) + 1}`]);
  }
  assert.equal(result.program.rules[0].alters[0].expression.right.right.kind, 'CallExpr');
  assert.equal(result.program.rules[0].alters[0].expression.right.right.name, 'seconds');
});

test('physical lowering retains exact target set and deterministic step metadata', () => {
  const result = lowerDeclaredFoundationToCore(physicalProgram());
  assert.deepEqual(result.lowered[0].stateTargets, ['world.velocity', 'world.position']);
  assert.deepEqual(result.lowered[0].originalWitnesses, ['physical:gravity']);
  assert.deepEqual(result.lowered[0].dtExpression, call('seconds', number(1)));
  assert.equal(result.lowered[1].syntheticRule, '__rcl_foundation_physical_world_fall_0_2');
});

test('dynamic physical step count fails closed and keeps the provider-domain declaration', () => {
  const source = physicalProgram();
  source.directives[0].count = path('world.steps');
  const result = lowerDeclaredFoundationToCore(source);
  assert.deepEqual(result.program.directives, source.directives);
  assert.equal(result.program.physicals.length, 1);
  assert.equal(result.summary.physicalLoweredStepCount, 0);
  assert.ok(result.diagnostics.some(item => item.code === 'RCL_FOUNDATION_DIRECT_LOWERING_PHYSICAL_DYNAMIC_STEPS_UNSUPPORTED'));
});

test('state-dependent physical dt fails closed instead of changing once-per-directive dt semantics', () => {
  const source = physicalProgram();
  source.directives[0].dt = path('world.clock_dt');
  const result = lowerDeclaredFoundationToCore(source);
  assert.deepEqual(result.program.directives, source.directives);
  assert.equal(result.program.physicals.length, 1);
  assert.ok(result.diagnostics.some(item => item.code === 'RCL_FOUNDATION_DIRECT_LOWERING_PHYSICAL_DYNAMIC_DT_UNSUPPORTED'));
});

test('physical synthetic rule identity cannot shadow a user core rule', () => {
  const source = physicalProgram();
  const reserved = '__rcl_foundation_physical_world_fall_0_1';
  source.rules.push({
    kind: 'Emergence', name: reserved, cause: 'user',
    when: { kind: 'LiteralExpr', valueType: 'Truth', value: true },
    needs: [], alters: [], calls: [], preserves: [], witnesses: ['user:rule'],
  });
  const result = lowerDeclaredFoundationToCore(source);
  assert.equal(result.program.rules[0].name, reserved);
  assert.equal(result.program.rules[1].name, `${reserved}_1`);
  assert.equal(result.lowered[0].syntheticRule, `${reserved}_1`);
  assert.equal(result.summary.renamedSyntheticRuleCount, 1);
});

test('an unconsumed physical law remains so canonical bytecode validation still fails closed', () => {
  const source = physicalProgram();
  source.physicals[0].laws.push({
    ...structuredClone(source.physicals[0].laws[0]),
    name: 'world.unused',
  });
  const result = lowerDeclaredFoundationToCore(source);
  assert.equal(result.program.physicals.length, 1);
  assert.deepEqual(result.program.physicals[0].laws.map(law => law.name), ['world.unused']);
  assert.ok(result.diagnostics.some(item => item.code === 'RCL_FOUNDATION_DIRECT_LOWERING_DECLARATION_UNCONSUMED' && item.details.declaration === 'world.unused'));
});

test('oversized physical expansion is rejected to keep direct lowering bounded', () => {
  const source = physicalProgram();
  source.directives[0].count = number(257);
  const result = lowerDeclaredFoundationToCore(source);
  assert.equal(result.program.physicals.length, 1);
  assert.equal(result.summary.physicalLoweredStepCount, 0);
  assert.ok(result.diagnostics.some(item => item.code === 'RCL_FOUNDATION_DIRECT_LOWERING_PHYSICAL_DYNAMIC_STEPS_UNSUPPORTED'));
});

test('domain selection can keep physical semantics untouched', () => {
  const source = physicalProgram();
  const result = lowerDeclaredFoundationToCore(source, { domains: ['perception'] });
  assert.equal(result.program.physicals.length, 1);
  assert.deepEqual(result.program.directives, source.directives);
  assert.deepEqual(result.truthBoundary.directDomains, ['perception']);
});

test('perception direct lowering remains available after physical extension', () => {
  const source = physicalProgram();
  source.physicals = [];
  source.directives = [{ kind: 'Observe', name: 'sight' }];
  source.perceptions = [{
    kind: 'PerceptionDecl', name: 'sight', observer: 'eye', source: 'world',
    channels: [{ path: 'sight.value', expression: number(1) }],
    preserves: [],
  }];
  const result = lowerDeclaredFoundationToCore(source);
  assert.equal(result.program.perceptions.length, 0);
  assert.equal(result.lowered[0].domain, 'perception');
  assert.equal(result.program.directives[0].kind, 'Realize');
});
