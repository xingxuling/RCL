import assert from 'node:assert/strict';
import test from 'node:test';
import { lowerDeclaredFoundationToCore } from '../src/foundation-direct-lowering.mjs';

const number = value => ({ kind: 'LiteralExpr', valueType: 'Number', value });
const path = value => ({ kind: 'PathExpr', path: value });

function baseProgram() {
  return {
    name: 'PerceptionNativeSlice',
    facets: [], warrants: [], functions: [], rules: [],
    physicals: [], neurals: [], livings: [], genetics: [], quantitatives: [], knowledges: [], naturalLanguages: [],
    understandings: [], creations: [], spacetimes: [], accelerations: [], compressions: [], metaDomains: [], energies: [],
    elements: [], sciences: [], embodiments: [], spirits: [],
    perceptions: [{
      kind: 'PerceptionDecl', name: 'vision', observer: 'agent.eye', source: 'world.scene',
      channels: [
        { kind: 'PerceptionChannelDecl', path: 'vision.lux', valueType: 'Number', expression: path('world.lux') },
        { kind: 'PerceptionChannelDecl', path: 'vision.bias', valueType: 'Number', expression: number(2) },
      ],
      preserves: [{ kind: 'BinaryExpr', operator: '>=', left: path('vision.lux'), right: number(0) }],
    }],
    directives: [{ kind: 'Observe', name: 'vision' }],
  };
}

test('Observe perception is rewritten to a direct core Realize rule', () => {
  const result = lowerDeclaredFoundationToCore(baseProgram());
  assert.equal(result.summary.loweredCount, 1);
  assert.equal(result.program.perceptions.length, 0);
  assert.equal(result.program.rules.length, 1);
  assert.deepEqual(result.program.directives, [{ kind: 'Realize', rule: '__rcl_foundation_perception_vision_0' }]);
});

test('channel expressions and state targets are preserved exactly', () => {
  const source = baseProgram();
  const result = lowerDeclaredFoundationToCore(source);
  assert.deepEqual(result.program.rules[0].alters, source.perceptions[0].channels.map(channel => ({ target: channel.path, expression: channel.expression })));
});

test('perception invariants and deterministic witness survive lowering', () => {
  const source = baseProgram();
  const result = lowerDeclaredFoundationToCore(source);
  assert.deepEqual(result.program.rules[0].preserves, source.perceptions[0].preserves);
  assert.deepEqual(result.program.rules[0].witnesses, ['rcl:foundation:perception:vision']);
  assert.equal(result.program.rules[0].cause, 'agent.eye');
});

test('existing core rules and directives are retained', () => {
  const source = baseProgram();
  source.rules.push({ kind: 'Emergence', name: 'existing', cause: 'actor', when: { kind: 'LiteralExpr', valueType: 'Truth', value: true }, needs: [], alters: [], calls: [], preserves: [], witnesses: [] });
  source.directives.unshift({ kind: 'Realize', rule: 'existing' });
  const result = lowerDeclaredFoundationToCore(source);
  assert.equal(result.program.rules[0].name, 'existing');
  assert.deepEqual(result.program.directives[0], { kind: 'Realize', rule: 'existing' });
});

test('unobserved perception remains present so canonical bytecode validation fails closed', () => {
  const source = baseProgram();
  source.perceptions.push({ kind: 'PerceptionDecl', name: 'hearing', observer: 'agent.ear', source: 'world.sound', channels: [], preserves: [] });
  const result = lowerDeclaredFoundationToCore(source);
  assert.deepEqual(result.program.perceptions.map(item => item.name), ['hearing']);
  assert.ok(result.diagnostics.some(item => item.code === 'RCL_FOUNDATION_DIRECT_LOWERING_DECLARATION_UNCONSUMED'));
});

test('unknown Observe target is not rewritten or silently accepted', () => {
  const source = baseProgram();
  source.directives = [{ kind: 'Observe', name: 'missing' }];
  const result = lowerDeclaredFoundationToCore(source);
  assert.deepEqual(result.program.directives, source.directives);
  assert.equal(result.program.perceptions.length, 1);
  assert.ok(result.diagnostics.some(item => item.code === 'RCL_FOUNDATION_DIRECT_LOWERING_TARGET_UNKNOWN'));
});

test('other Foundation declarations are untouched and cannot be mislabeled native', () => {
  const source = baseProgram();
  source.energies = [{ kind: 'EnergyDecl', name: 'grid', reservoirs: [], sources: [], flows: [] }];
  const result = lowerDeclaredFoundationToCore(source);
  assert.equal(result.program.energies.length, 1);
  assert.equal(result.truthBoundary.allFoundationDomainsNativeClaimed, false);
  assert.equal(result.truthBoundary.providerBridgeRemovedGlobally, false);
});
