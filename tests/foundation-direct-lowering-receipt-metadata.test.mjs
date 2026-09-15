import assert from 'node:assert/strict';
import test from 'node:test';
import { lowerDeclaredFoundationToCore } from '../src/foundation-direct-lowering.mjs';

test('perception lowering emits receipt identity metadata needed for domain parity', () => {
  const program = {
    rules: [],
    perceptions: [{
      name: 'vision', observer: 'camera.front', source: 'world.room',
      channels: [{ path: 'vision.lux', expression: { kind: 'LiteralExpr', valueType: 'Number', value: 10 } }],
      preserves: [],
    }],
    directives: [{ kind: 'Observe', name: 'vision' }],
  };
  const result = lowerDeclaredFoundationToCore(program);
  assert.equal(result.version, '0.2.0');
  assert.equal(result.lowered.length, 1);
  assert.deepEqual(result.lowered[0], {
    domain: 'perception', declaration: 'vision', directive: 'Observe', directiveIndex: 0,
    syntheticRule: '__rcl_foundation_perception_vision_0', stateTargets: ['vision.lux'],
    preserveCount: 0, witness: 'rcl:foundation:perception:vision', observer: 'camera.front',
    sourceReality: 'world.room', authorityClass: 'observation',
  });
  assert.equal(result.truthBoundary.domainReceiptParityTargeted, true);
});
