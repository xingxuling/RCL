import assert from 'node:assert/strict';
import test from 'node:test';
import { compileReality } from '../src/compiler.mjs';
import { tryCompileFoundationRealityToBytecode } from '../src/foundation-direct-bytecode.mjs';
import { lowerDeclaredQuantitativeToCore } from '../src/foundation-quantitative-direct-lowering.mjs';

const source = [
  'reality QuantitativeDeclaredDirect {',
  '  facet ambient.raw : Temperature = celsius(8)',
  '  quantitative sensor {',
  '    measure temperature : Temperature = ambient.raw uncertainty celsius(0.2) confidence 0.98 unit "°C" scale interval evidence "sensor:ambient-v1" calibrated by "calibration:ambient-v1"',
  '    derive healthy : Truth = confidence(sensor.temperature) >= 0.95',
  '    preserve confidence(sensor.temperature) >= 0.90',
  '  }',
  '  quantify sensor',
  '}',
  '',
].join('\n');

test('Quantify consumes the declared quantitative domain into one deterministic core transaction', () => {
  const program = compileReality(source);
  const result = lowerDeclaredQuantitativeToCore(program);
  assert.equal(result.summary.quantitativeLoweredDeclarationCount, 1);
  assert.equal(result.summary.consumedDirectiveCount, 1);
  assert.equal(result.summary.syntheticRuleCount, 1);
  assert.equal(result.summary.remainingQuantitativeCount, 0);
  assert.equal(result.program.quantitatives.length, 0);
  assert.deepEqual(result.program.directives, [{ kind: 'Realize', rule: '__rcl_foundation_quantitative_sensor_0' }]);
  assert.equal(result.lowered[0].domain, 'quantitative');
  assert.equal(result.lowered[0].measurementCount, 1);
  assert.equal(result.lowered[0].derivedCount, 1);
  assert.deepEqual(result.lowered[0].stateTargets, ['sensor.temperature', 'sensor.healthy']);
});

test('measurement metadata is retained in a native typed record and accessors become typed fields', () => {
  const program = compileReality(source);
  const result = lowerDeclaredQuantitativeToCore(program);
  const measurement = result.program.facets.find(item => item.path === 'sensor.temperature');
  const healthy = result.program.facets.find(item => item.path === 'sensor.healthy');
  assert.equal(measurement.value.kind, 'RecordConstructExpr');
  assert.equal(measurement.value.canonicalType, 'taowind.rcl.native.Measurement.v0.1');
  const fields = Object.fromEntries(measurement.value.fields.map(item => [item.name, item.value]));
  assert.equal(fields.kind.value, 'Measurement');
  assert.equal(fields.baseType.value, 'Temperature');
  assert.equal(fields.confidence.value, 0.98);
  assert.equal(fields.unit.value, '°C');
  assert.equal(fields.scale.value, 'interval');
  assert.equal(fields.evidence.value, '["sensor:ambient-v1"]');
  assert.equal(fields.calibratedBy.value, 'calibration:ambient-v1');
  assert.equal(healthy.value.kind, 'BinaryExpr');
  assert.equal(healthy.value.left.kind, 'FieldAccessExpr');
  assert.equal(healthy.value.left.field, 'confidence');
  assert.equal(result.program.rules[0].preserves[0].left.kind, 'FieldAccessExpr');
  assert.equal(result.program.rules[0].preserves[0].left.field, 'confidence');
});

test('unknown or unconsumed Quantitative declarations remain visible and fail closed', () => {
  const program = compileReality(source.replace('  quantify sensor\n', ''));
  const result = lowerDeclaredQuantitativeToCore(program);
  assert.equal(result.program.quantitatives.length, 1);
  assert.equal(result.summary.quantitativeLoweredDeclarationCount, 0);
  assert.ok(result.diagnostics.some(item => item.code === 'RCL_FOUNDATION_QUANTITATIVE_DIRECT_LOWERING_DECLARATION_UNCONSUMED'));
  const compiled = tryCompileFoundationRealityToBytecode(program);
  assert.equal(compiled.ok, false);
  assert.ok(compiled.diagnostics.some(item => item.code === 'RCL_NATIVE_DOMAIN_PROVIDER_REQUIRED'));
});

test('declared Quantitative source reaches canonical generic native bytecode without a provider bridge', () => {
  const compiled = tryCompileFoundationRealityToBytecode(source);
  assert.equal(compiled.ok, true, JSON.stringify(compiled.diagnostics));
  assert.ok(compiled.bytecode);
  assert.equal(compiled.foundationQuantitativeDirectLowering.summary.quantitativeLoweredDeclarationCount, 1);
  assert.equal(compiled.foundationQuantitativeDirectLowering.summary.measurementRecordCount, 1);
  assert.equal(compiled.foundationQuantitativeDirectLowering.truthBoundary.providerBridgeRemovedGlobally, false);
  assert.equal(compiled.foundationQuantitativeDirectLowering.truthBoundary.declaredQuantitativeDirectLoweringVerified, false);
});

test('synthetic Quantitative identity cannot shadow an existing user rule', () => {
  const program = compileReality(source);
  program.rules.push({
    kind: 'Emergence', name: '__rcl_foundation_quantitative_sensor_0', cause: 'owner',
    when: { kind: 'LiteralExpr', valueType: 'Truth', value: true },
    needs: [], alters: [], calls: [], preserves: [], witnesses: ['user:rule'],
  });
  const result = lowerDeclaredQuantitativeToCore(program);
  assert.equal(result.lowered[0].syntheticRule, '__rcl_foundation_quantitative_sensor_0_1');
  assert.equal(result.summary.renamedSyntheticRuleCount, 1);
  assert.ok(result.diagnostics.some(item => item.code === 'RCL_FOUNDATION_QUANTITATIVE_DIRECT_LOWERING_RULE_NAME_COLLISION_AVOIDED'));
});
