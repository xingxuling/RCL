import assert from 'node:assert/strict';
import test from 'node:test';
import { compileRealityToBytecode } from '../src/bytecode.mjs';
import { DEFAULT_NATIVE_VM_PATH, runNativeBytecode, RCLNativeVMError } from '../src/native-vm.mjs';

const VM_PATH = process.env.RCLVM_TEST_PATH ?? DEFAULT_NATIVE_VM_PATH;
const OP = {
  PUSH_NUMBER: 1, PUSH_STRING: 3, STORE_STATE: 5, ADD: 6, EQ: 10, LT: 12,
  CALL_BUILTIN: 30, HALT: 31, LOAD_STATE: 4, DOMAIN_CALL: 45,
};

function assemble({ strings, numbers = [], instructions, minor = 3 }) {
  const encodedStrings = strings.map(value => Buffer.from(value));
  const poolBytes = encodedStrings.reduce((sum, value) => sum + 4 + value.length, 0);
  const bytes = Buffer.alloc(36 + poolBytes + numbers.length * 8 + instructions.length * 16);
  bytes.write('RCLB', 0, 4, 'ascii');
  bytes.writeUInt16LE(1, 4);
  bytes.writeUInt16LE(minor, 6);
  bytes.writeUInt32LE(0, 8);
  bytes.writeUInt32LE(0, 12);
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
  assert.ok(VM_PATH, 'RCLVM_TEST_PATH must point to the VM under test');
  return runNativeBytecode(bytecode, { vmPath: VM_PATH });
}

test('native RBC 1.3 dispatches literal and dynamic domains with typed quantitative and knowledge values', () => {
  const strings = [
    'NativeDomainCall', 'native:domain-call', 'core', 'echo', 'hello', 'literal.echo', 'dynamic.echo',
    'quantity', 'make', 'Temperature', '', 'q.low', 'q.high', 'q.equal', 'q.less', 'q.sum',
    'quantitative', 'measure', 'ratio', 'sensor-A', 'measure.temp',
    'knowledge', 'claim', 'lab', 'provisional', 'root-1', 'knowledge.temp',
  ];
  const s = Object.fromEntries(strings.map((value, index) => [value, index]));
  const numbers = [25, 30, 0, 0.9, 0.8, 1];
  const quantity = numberIndex => [
    [OP.PUSH_STRING, 0, s.Temperature], [OP.PUSH_NUMBER, 0, numberIndex], [OP.PUSH_STRING, 0, s['']],
    [OP.DOMAIN_CALL, 0, s.quantity, s.make, 3],
  ];
  const instructions = [
    [OP.PUSH_STRING, 0, s.hello], [OP.DOMAIN_CALL, 0, s.core, s.echo, 1], [OP.STORE_STATE, 0, s['literal.echo']],
    [OP.PUSH_STRING, 0, s.core], [OP.PUSH_STRING, 0, s.echo], [OP.PUSH_STRING, 0, s.hello],
    [OP.DOMAIN_CALL, 1, 0, 0, 1], [OP.STORE_STATE, 0, s['dynamic.echo']],
    ...quantity(0), [OP.STORE_STATE, 0, s['q.low']],
    ...quantity(1), [OP.STORE_STATE, 0, s['q.high']],
    [OP.LOAD_STATE, 0, s['q.low']], [OP.LOAD_STATE, 0, s['q.low']], [OP.EQ], [OP.STORE_STATE, 0, s['q.equal']],
    [OP.LOAD_STATE, 0, s['q.low']], [OP.LOAD_STATE, 0, s['q.high']], [OP.LT], [OP.STORE_STATE, 0, s['q.less']],
    [OP.LOAD_STATE, 0, s['q.low']], [OP.LOAD_STATE, 0, s['q.high']], [OP.ADD], [OP.STORE_STATE, 0, s['q.sum']],
    [OP.PUSH_STRING, 0, s.Temperature], [OP.LOAD_STATE, 0, s['q.low']], ...quantity(2),
    [OP.PUSH_NUMBER, 0, 3], [OP.PUSH_STRING, 0, s['']], [OP.PUSH_STRING, 0, s.ratio],
    [OP.CALL_BUILTIN, 0, 12, 0], [OP.PUSH_STRING, 0, s['sensor-A']],
    [OP.DOMAIN_CALL, 0, s.quantitative, s.measure, 8], [OP.STORE_STATE, 0, s['measure.temp']],
    [OP.PUSH_STRING, 0, s.Temperature], [OP.LOAD_STATE, 0, s['q.low']], [OP.PUSH_NUMBER, 0, 4],
    [OP.CALL_BUILTIN, 0, 12, 0], [OP.PUSH_STRING, 0, s['sensor-A']], [OP.PUSH_STRING, 0, s.lab],
    [OP.PUSH_STRING, 0, s.provisional], [OP.CALL_BUILTIN, 0, 12, 0], [OP.PUSH_NUMBER, 0, 5],
    [OP.PUSH_STRING, 0, s['root-1']], [OP.DOMAIN_CALL, 0, s.knowledge, s.claim, 10],
    [OP.STORE_STATE, 0, s['knowledge.temp']], [OP.HALT],
  ];
  const result = run(assemble({ strings, numbers, instructions }));

  assert.equal(result.state['literal.echo'], 'hello');
  assert.equal(result.state['dynamic.echo'], 'hello');
  assert.deepEqual(
    { kind: result.state['q.low'].kind, type: result.state['q.low'].type, value: result.state['q.low'].value, unit: result.state['q.low'].unit },
    { kind: 'Quantity', type: 'Temperature', value: 25, unit: '°C' },
  );
  assert.equal(result.state['q.equal'], true);
  assert.equal(result.state['q.less'], true);
  assert.equal(result.state['q.sum'].__rclType, 'Quantity');
  assert.equal(result.state['q.sum'].type, 'Temperature');
  assert.equal(result.state['q.sum'].value, 55);
  assert.equal(result.state['q.sum'].unit, '°C');
  assert.equal(result.state['measure.temp'].__rclType, 'Measure<Temperature>');
  assert.equal(result.state['measure.temp'].unit, '°C');
  assert.equal(result.state['measure.temp'].calibratedBy, 'sensor-A');
  assert.equal(result.state['knowledge.temp'].__rclType, 'Know<Temperature>');
  assert.deepEqual(result.state['knowledge.temp'].alternatives, []);
  assert.equal(result.state['knowledge.temp'].formedAtRoot, 'root-1');
});

test('native RBC 1.3 validates feature versions, flags, arity and missing operations', () => {
  const strings = ['NativeDomainErrors', 'native:domain-errors', 'core', 'missing', 'quantity', 'make'];
  const call = [[OP.DOMAIN_CALL, 0, 2, 3, 0], [OP.HALT]];
  assert.throws(() => run(assemble({ strings, instructions: call, minor: 2 })), error =>
    error instanceof RCLNativeVMError && error.code === 'RCL_NATIVE_LOAD' && error.message.includes('RCL_NATIVE_BYTECODE_FEATURE_VERSION'));
  assert.throws(() => run(assemble({ strings, instructions: [[OP.DOMAIN_CALL, 2, 2, 3, 0], [OP.HALT]] })), error =>
    error instanceof RCLNativeVMError && error.code === 'RCL_NATIVE_LOAD' && error.message.includes('RCL_NATIVE_BYTECODE_FLAGS'));
  assert.throws(() => run(assemble({ strings, instructions: call })), error =>
    error instanceof RCLNativeVMError && error.code === 'RCL_NATIVE_DOMAIN_OPERATION_MISSING');
  assert.throws(() => run(assemble({ strings, instructions: [[OP.DOMAIN_CALL, 0, 4, 5, 0], [OP.HALT]] })), error =>
    error instanceof RCLNativeVMError && error.code === 'RCL_NATIVE_DOMAIN_ARGUMENT');
});

test('native RBC 1.1 and 1.2 programs retain their prior execution behavior', () => {
  const base = run(compileRealityToBytecode('reality Base11 { facet world.ready : Truth = true }'));
  const mod = run(compileRealityToBytecode('reality Mod12 { facet math.value : Number = 17 % 5 }'));
  assert.equal(base.state['world.ready'], true);
  assert.equal(mod.state['math.value'], 2);
});
