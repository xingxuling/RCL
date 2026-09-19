import assert from 'node:assert/strict';
import test from 'node:test';
import { compileReality } from '../src/compiler.mjs';
import { tryCompileFoundationRealityToBytecode } from '../src/foundation-direct-bytecode.mjs';
import { lowerDeclaredEnergyToCore } from '../src/foundation-energy-direct-lowering.mjs';

const source = [
  'reality EnergyDeclaredDirect {',
  '  energy grid {',
  '    reservoir source : Energy = joules(100)',
  '    reservoir load : Energy = joules(0)',
  '    flow charge from source to load amount joules(40) efficiency 0.9 evidence "meter:grid-transfer"',
  '    preserve grid.source >= joules(0)',
  '    preserve grid.load >= joules(0)',
  '    witness "energy:atomic-transfer"',
  '  }',
  '  energize grid',
  '}',
  '',
].join('\n');

test('Energize lowers one disjoint static energy graph into one atomic core transaction', () => {
  const program = compileReality(source);
  const result = lowerDeclaredEnergyToCore(program);
  assert.equal(result.summary.loweredDirectiveCount, 1);
  assert.equal(result.summary.loweredFlowCount, 1);
  assert.equal(result.summary.syntheticRuleCount, 1);
  assert.equal(result.summary.remainingEnergyCount, 0);
  assert.equal(result.program.energies.length, 0);
  assert.deepEqual(result.program.directives, [{ kind: 'Realize', rule: '__rcl_foundation_energy_grid_0' }]);
  assert.equal(result.lowered[0].domain, 'energy');
  assert.equal(result.lowered[0].flowCount, 1);
  assert.deepEqual(result.lowered[0].stateTargets, ['grid.source', 'grid.load']);
  const rule = result.program.rules.find(item => item.name === '__rcl_foundation_energy_grid_0');
  assert.ok(rule);
  assert.equal(rule.alters.length, 2);
  assert.equal(rule.preserves.length, 3);
  assert.equal(rule.alters[0].target, 'grid.source');
  assert.equal(rule.alters[0].expression.operator, '-');
  assert.equal(rule.alters[1].target, 'grid.load');
  assert.equal(rule.alters[1].expression.operator, '+');
  assert.equal(rule.alters[1].expression.right.operator, '*');
});

test('canonical declared Energy source reaches generic native bytecode without requiring the energy provider bridge', () => {
  const compiled = tryCompileFoundationRealityToBytecode(source);
  assert.equal(compiled.ok, true, JSON.stringify(compiled.diagnostics));
  assert.ok(compiled.bytecode);
  assert.equal(compiled.foundationEnergyDirectLowering.summary.loweredDirectiveCount, 1);
  assert.equal(compiled.foundationEnergyDirectLowering.summary.loweredFlowCount, 1);
  assert.equal(compiled.foundationEnergyDirectLowering.truthBoundary.oneEnergizeDirectiveLowersToOneAtomicCoreTransaction, true);
  assert.equal(compiled.foundationEnergyDirectLowering.truthBoundary.providerBridgeRemovedGlobally, false);
  assert.ok(compiled.foundationDirectCapabilityRegistry.capabilities.some(item => (
    item.canonicalDomain === 'energy'
    && item.lowererStage === 'energy-prepass'
  )));
});

test('source sufficiency remains a fail-closed projected preserve in the atomic transaction', () => {
  const result = lowerDeclaredEnergyToCore(compileReality(source));
  const rule = result.program.rules.find(item => item.name === '__rcl_foundation_energy_grid_0');
  const syntheticBound = rule.preserves.at(-1);
  assert.equal(syntheticBound.kind, 'BinaryExpr');
  assert.equal(syntheticBound.operator, '>=');
  assert.equal(syntheticBound.left.kind, 'PathExpr');
  assert.equal(syntheticBound.left.path, 'grid.source');
  assert.equal(syntheticBound.right.kind, 'CallExpr');
  assert.equal(syntheticBound.right.name, 'joules');
});

test('coupled flow reservoirs remain visible and fail closed instead of collapsing sequential semantics', () => {
  const coupled = source.replace(
    '    preserve grid.source >= joules(0)',
    '    flow recharge from load to source amount joules(1) efficiency 1 evidence "meter:return"\n    preserve grid.source >= joules(0)',
  );
  const program = compileReality(coupled);
  const result = lowerDeclaredEnergyToCore(program);
  assert.equal(result.summary.loweredDirectiveCount, 0);
  assert.equal(result.program.energies.length, 1);
  assert.ok(result.diagnostics.some(item => item.code === 'RCL_FOUNDATION_ENERGY_DIRECT_COUPLED_RESERVOIRS_UNSUPPORTED'));
  const compiled = tryCompileFoundationRealityToBytecode(program);
  assert.equal(compiled.ok, false);
  assert.ok(compiled.diagnostics.some(item => item.code === 'RCL_NATIVE_DOMAIN_PROVIDER_REQUIRED'));
});

test('state-dependent energy amounts remain provider-bound and fail closed', () => {
  const dynamic = source.replace('amount joules(40)', 'amount grid.source');
  const program = compileReality(dynamic);
  const result = lowerDeclaredEnergyToCore(program);
  assert.equal(result.summary.loweredDirectiveCount, 0);
  assert.equal(result.program.energies.length, 1);
  assert.ok(result.diagnostics.some(item => item.code === 'RCL_FOUNDATION_ENERGY_DIRECT_DYNAMIC_AMOUNT_UNSUPPORTED'));
  const compiled = tryCompileFoundationRealityToBytecode(program);
  assert.equal(compiled.ok, false);
  assert.ok(compiled.diagnostics.some(item => item.code === 'RCL_NATIVE_DOMAIN_PROVIDER_REQUIRED'));
});
