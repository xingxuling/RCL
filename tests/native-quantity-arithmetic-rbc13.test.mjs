import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_NATIVE_VM_PATH, RCLNativeVMError, runNativeBytecode } from '../src/native-vm.mjs';

const VM_PATH = process.env.RCLVM_TEST_PATH ?? DEFAULT_NATIVE_VM_PATH;
const OP = {
  PUSH_NUMBER: 1, PUSH_STRING: 3, LOAD_STATE: 4, STORE_STATE: 5,
  ADD: 6, SUB: 7, MUL: 8, GTE: 15, JUMP: 20, JUMP_IF_FALSE: 21,
  HALT: 31, DOMAIN_CALL: 45,
};

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

test('native Quantity arithmetic follows dimension-safe motion rules and comparison-driven max', () => {
  const strings = [
    'NativeQuantityArithmetic', 'native:quantity-arithmetic', 'quantity', 'make', '',
    'Acceleration', 'Time', 'Velocity', 'Length',
    'acceleration', 'dt', 'delta.velocity', 'velocity.initial', 'velocity.updated',
    'displacement', 'position.initial', 'position.raw', 'ground', 'position.clamped',
  ];
  const s = Object.fromEntries(strings.map((value, index) => [value, index]));
  const numbers = [-9.81, 2, 10, 0];
  const quantity = (type, numberIndex) => [
    [OP.PUSH_STRING, 0, s[type]], [OP.PUSH_NUMBER, 0, numberIndex], [OP.PUSH_STRING, 0, s['']],
    [OP.DOMAIN_CALL, 0, s.quantity, s.make, 3],
  ];
  const instructions = [
    ...quantity('Acceleration', 0), [OP.STORE_STATE, 0, s.acceleration],
    ...quantity('Time', 1), [OP.STORE_STATE, 0, s.dt],
    [OP.LOAD_STATE, 0, s.acceleration], [OP.LOAD_STATE, 0, s.dt], [OP.MUL],
    [OP.STORE_STATE, 0, s['delta.velocity']],
    ...quantity('Velocity', 2), [OP.STORE_STATE, 0, s['velocity.initial']],
    [OP.LOAD_STATE, 0, s['velocity.initial']], [OP.LOAD_STATE, 0, s['delta.velocity']], [OP.ADD],
    [OP.STORE_STATE, 0, s['velocity.updated']],
    [OP.LOAD_STATE, 0, s.dt], [OP.LOAD_STATE, 0, s['velocity.updated']], [OP.MUL],
    [OP.STORE_STATE, 0, s.displacement],
    ...quantity('Length', 2), [OP.STORE_STATE, 0, s['position.initial']],
    [OP.LOAD_STATE, 0, s['position.initial']], [OP.LOAD_STATE, 0, s.displacement], [OP.ADD],
    [OP.STORE_STATE, 0, s['position.raw']],
    ...quantity('Length', 3), [OP.STORE_STATE, 0, s.ground],
  ];
  instructions.push([OP.LOAD_STATE, 0, s['position.raw']], [OP.LOAD_STATE, 0, s.ground], [OP.GTE]);
  const branch = instructions.push([OP.JUMP_IF_FALSE, 0, 0]) - 1;
  instructions.push([OP.LOAD_STATE, 0, s['position.raw']], [OP.STORE_STATE, 0, s['position.clamped']]);
  const jumpEnd = instructions.push([OP.JUMP, 0, 0]) - 1;
  instructions[branch][2] = instructions.length;
  instructions.push([OP.LOAD_STATE, 0, s.ground], [OP.STORE_STATE, 0, s['position.clamped']]);
  instructions[jumpEnd][2] = instructions.length;
  instructions.push([OP.HALT]);

  const { state } = run(assemble({ strings, numbers, instructions }));
  assert.deepEqual(
    { type: state['delta.velocity'].type, value: state['delta.velocity'].value, unit: state['delta.velocity'].unit },
    { type: 'Velocity', value: -19.62, unit: 'm/s' },
  );
  assert.deepEqual(
    { type: state.displacement.type, value: state.displacement.value, unit: state.displacement.unit },
    { type: 'Length', value: -19.24, unit: 'm' },
  );
  assert.equal(state['position.raw'].value, -9.24);
  assert.equal(state['position.clamped'].value, 0);
  assert.equal(state['position.clamped'].unit, 'm');
});

test('native Quantity arithmetic rejects unsupported dimensions and unit systems', () => {
  const strings = [
    'NativeQuantityErrors', 'native:quantity-errors', 'quantity', 'make', '',
    'Acceleration', 'Length', 'Time', 'ft/s²',
  ];
  const s = Object.fromEntries(strings.map((value, index) => [value, index]));
  const make = (type, numberIndex, unit = '') => [
    [OP.PUSH_STRING, 0, s[type]], [OP.PUSH_NUMBER, 0, numberIndex], [OP.PUSH_STRING, 0, s[unit]],
    [OP.DOMAIN_CALL, 0, s.quantity, s.make, 3],
  ];
  const badDimension = assemble({ strings, numbers: [1], instructions: [
    ...make('Acceleration', 0), ...make('Length', 0), [OP.MUL], [OP.HALT],
  ] });
  assert.throws(() => run(badDimension), error =>
    error instanceof RCLNativeVMError && error.code === 'RCL_NATIVE_QUANTITY_DIMENSION');

  const unsupportedUnits = assemble({ strings, numbers: [1], instructions: [
    ...make('Acceleration', 0, 'ft/s²'), ...make('Time', 0), [OP.MUL], [OP.HALT],
  ] });
  assert.throws(() => run(unsupportedUnits), error =>
    error instanceof RCLNativeVMError && error.code === 'RCL_NATIVE_QUANTITY_DIMENSION');
});
