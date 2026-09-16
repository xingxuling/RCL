import assert from 'node:assert/strict';
import test from 'node:test';
import { compileReality } from '../src/compiler.mjs';
import { decodeBytecode, tryCompileRealityToBytecode } from '../src/bytecode.mjs';
import { lowerDeclaredFoundationToCore } from '../src/foundation-direct-lowering.mjs';
import { lowerFoundationQuantitiesForNativeBytecode } from '../src/foundation-quantity-native-lowering.mjs';
import { tryCompileFoundationRealityToBytecode } from '../src/foundation-direct-bytecode.mjs';

const SOURCE = `
reality PhysicalQuantityNativeSlice {
  physical world {
    body stone {
      facet position : Length = meters(10)
      facet velocity : Velocity = meters_per_second(1)
    }
    field gravity {
      facet acceleration : Acceleration = meters_per_second2(0)
    }
    law drift {
      step dt : Time
      when world.stone.position > meters(0)
      evolve world.stone.position <- world.stone.position + world.stone.velocity * dt
      evolve world.stone.velocity <- world.stone.velocity + world.gravity.acceleration * dt
      conserve world.stone.position >= meters(0)
      witness "physical:quantity-native"
    }
  }
  advance world.drift steps 2 dt seconds(1)
}
`;

function visit(value, callback) {
  if (Array.isArray(value)) {
    value.forEach(item => visit(item, callback));
    return;
  }
  if (!value || typeof value !== 'object') return;
  callback(value);
  Object.values(value).forEach(item => visit(item, callback));
}

test('Foundation quantity lowering maps constructors and dimensional arithmetic onto existing typed-record bytecode semantics', () => {
  const program = compileReality(SOURCE);
  const direct = lowerDeclaredFoundationToCore(program);
  const lowered = lowerFoundationQuantitiesForNativeBytecode(direct.program);
  const kinds = [];
  const calls = [];
  visit(lowered.program, node => {
    if (node.kind) kinds.push(node.kind);
    if (node.kind === 'CallExpr') calls.push(node.name);
  });
  assert.ok(lowered.summary.quantityConstructorCount >= 4);
  assert.ok(lowered.summary.quantityBinaryCount >= 4);
  assert.ok(kinds.includes('RecordConstructExpr'));
  assert.ok(kinds.includes('FieldAccessExpr'));
  assert.equal(calls.includes('meters'), false);
  assert.equal(calls.includes('meters_per_second'), false);
  assert.equal(calls.includes('meters_per_second2'), false);
  assert.equal(calls.includes('seconds'), false);
});

test('generic native bytecode accepts the lowered quantity representation without adding a new VM opcode', () => {
  const program = compileReality(SOURCE);
  const direct = lowerDeclaredFoundationToCore(program);
  const lowered = lowerFoundationQuantitiesForNativeBytecode(direct.program);
  const compiled = tryCompileRealityToBytecode(lowered.program);
  assert.equal(compiled.ok, true, JSON.stringify(compiled.diagnostics));
  const decoded = decodeBytecode(compiled.bytecode);
  assert.ok(decoded.instructions.some(item => item.name === 'MAKE_TYPED_RECORD'));
  assert.ok(decoded.instructions.some(item => item.name === 'GET_TYPED_FIELD'));
});

test('canonical Foundation direct bytecode exposes quantity lowering evidence while preserving semantic core program', () => {
  const compiled = tryCompileFoundationRealityToBytecode(SOURCE);
  assert.equal(compiled.ok, true, JSON.stringify(compiled.diagnostics));
  assert.equal(compiled.foundationDirectLowering.summary.physicalLoweredStepCount, 2);
  assert.equal(compiled.foundationQuantityNativeLowering.summary.representation, 'existing-native-typed-record');
  assert.equal(compiled.foundationQuantityNativeLowering.truthBoundary.nativeVmOpcodeExtensionRequired, false);
  assert.equal(compiled.program.rules.length, 2);
  assert.equal(compiled.program.rules[0].alters[0].expression.kind, 'BinaryExpr');
});
