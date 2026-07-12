import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_NATIVE_VM_PATH, RCLNativeVMError, runNativeBytecode } from '../src/native-vm.mjs';

const VM_PATH = process.env.RCLVM_TEST_PATH ?? DEFAULT_NATIVE_VM_PATH;
const OP = { PUSH_NUMBER: 1, PUSH_STRING: 3, LOAD_STATE: 4, STORE_STATE: 5, HALT: 31, DOMAIN_CALL: 45 };

function assemble({ strings, numbers = [], instructions }) {
  const encodedStrings = strings.map(value => Buffer.from(value));
  const poolBytes = encodedStrings.reduce((sum, value) => sum + 4 + value.length, 0);
  const bytes = Buffer.alloc(36 + poolBytes + numbers.length * 8 + instructions.length * 16);
  bytes.write('RCLB', 0, 4, 'ascii');
  bytes.writeUInt16LE(1, 4);
  bytes.writeUInt16LE(3, 6);
  bytes.writeUInt32LE(1, 16);
  bytes.writeUInt32LE(strings.length, 20);
  bytes.writeUInt32LE(numbers.length, 24);
  bytes.writeUInt32LE(instructions.length, 28);
  let offset = 36;
  for (const value of encodedStrings) {
    bytes.writeUInt32LE(value.length, offset);
    value.copy(bytes, offset + 4);
    offset += 4 + value.length;
  }
  for (const value of numbers) {
    bytes.writeDoubleLE(value, offset);
    offset += 8;
  }
  for (const [op, flags = 0, a = 0, b = 0, c = 0] of instructions) {
    bytes.writeUInt8(op, offset);
    bytes.writeUInt8(flags, offset + 1);
    bytes.writeInt32LE(a, offset + 4);
    bytes.writeInt32LE(b, offset + 8);
    bytes.writeInt32LE(c, offset + 12);
    offset += 16;
  }
  return bytes;
}

function run(bytecode) {
  return runNativeBytecode(bytecode, { vmPath: VM_PATH });
}

test('native RBC 1.3 spacetime point and retime preserve typed coordinates', () => {
  const strings = [
    'NativeSpacetime', 'native:spacetime', 'quantity', 'make', 'spacetime', 'point', 'retime', '',
    'Length', 'Time', 'earth-fixed', 'probe:alpha', 'probe:beta', 'initial', 'retimed',
  ];
  const s = Object.fromEntries(strings.map((value, index) => [value, index]));
  const quantity = (type, numberIndex) => [
    [OP.PUSH_STRING, 0, s[type]], [OP.PUSH_NUMBER, 0, numberIndex], [OP.PUSH_STRING, 0, s['']],
    [OP.DOMAIN_CALL, 0, s.quantity, s.make, 3],
  ];
  const instructions = [
    [OP.PUSH_STRING, 0, s['earth-fixed']],
    ...quantity('Length', 0), ...quantity('Length', 1), ...quantity('Length', 2),
    ...quantity('Time', 3), [OP.PUSH_STRING, 0, s['probe:alpha']],
    [OP.DOMAIN_CALL, 0, s.spacetime, s.point, 6], [OP.STORE_STATE, 0, s.initial],
    [OP.LOAD_STATE, 0, s.initial], ...quantity('Time', 4), [OP.PUSH_STRING, 0, s['probe:beta']],
    [OP.DOMAIN_CALL, 0, s.spacetime, s.retime, 3], [OP.STORE_STATE, 0, s.retimed], [OP.HALT],
  ];

  const { state } = run(assemble({ strings, numbers: [1, 2, 3, 4, 9], instructions }));
  assert.deepEqual(
    { kind: state.initial.kind, frame: state.initial.frame, x: state.initial.x.value, y: state.initial.y.value,
      z: state.initial.z.value, t: state.initial.t.value, target: state.initial.target },
    { kind: 'SpacetimePoint', frame: 'earth-fixed', x: 1, y: 2, z: 3, t: 4, target: 'probe:alpha' },
  );
  assert.equal(state.retimed.kind, 'SpacetimePoint');
  assert.equal(state.retimed.frame, state.initial.frame);
  assert.deepEqual([state.retimed.x, state.retimed.y, state.retimed.z], [state.initial.x, state.initial.y, state.initial.z]);
  assert.deepEqual({ type: state.retimed.t.type, value: state.retimed.t.value, unit: state.retimed.t.unit },
    { type: 'Time', value: 9, unit: 's' });
  assert.equal(state.retimed.target, 'probe:beta');
});

test('native spacetime.point rejects a non-Length coordinate', () => {
  const strings = ['NativeSpacetimeError', 'native:spacetime-error', 'quantity', 'make', 'spacetime', 'point', '', 'Length', 'Time', 'frame', 'target'];
  const s = Object.fromEntries(strings.map((value, index) => [value, index]));
  const quantity = type => [
    [OP.PUSH_STRING, 0, s[type]], [OP.PUSH_NUMBER, 0, 0], [OP.PUSH_STRING, 0, s['']],
    [OP.DOMAIN_CALL, 0, s.quantity, s.make, 3],
  ];
  const bytecode = assemble({ strings, numbers: [1], instructions: [
    [OP.PUSH_STRING, 0, s.frame], ...quantity('Length'), ...quantity('Length'), ...quantity('Time'),
    ...quantity('Time'), [OP.PUSH_STRING, 0, s.target], [OP.DOMAIN_CALL, 0, s.spacetime, s.point, 6], [OP.HALT],
  ] });
  assert.throws(() => run(bytecode), error =>
    error instanceof RCLNativeVMError && error.code === 'RCL_NATIVE_DOMAIN_ARGUMENT');
});
