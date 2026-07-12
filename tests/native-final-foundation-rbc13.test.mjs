import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_NATIVE_VM_PATH, RCLNativeVMError, runNativeBytecode } from '../src/native-vm.mjs';

const VM_PATH = process.env.RCLVM_TEST_PATH ?? DEFAULT_NATIVE_VM_PATH;
const OP = {
  PUSH_NUMBER: 1, PUSH_BOOL: 2, PUSH_STRING: 3, LOAD_STATE: 4, STORE_STATE: 5,
  CALL_BUILTIN: 30, HALT: 31, DOMAIN_CALL: 45,
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

function sequence(...items) {
  const instructions = [[OP.CALL_BUILTIN, 0, 12, 0]];
  for (const item of items) instructions.push(item, [OP.CALL_BUILTIN, 0, 13, 2]);
  return instructions;
}

function pairs(...entries) {
  return sequence(...entries.flat());
}

function run(bytecode) {
  return runNativeBytecode(bytecode, { vmPath: VM_PATH });
}

test('native RBC 1.3 constructs final-foundation records with JS-parity shapes', () => {
  const strings = [
    'NativeFinalFoundation', 'native:final-foundation', '', 'quantity', 'make', 'Energy',
    'energy', 'scale', 'energy.base', 'energy.scaled',
    'element', 'species', 'compound', 'hydrogen', 'H', 'gas', 'periodic-table:H', 'species.result',
    'water', 'oxygen', 'covalent', 'chemistry:H2O', 'compound.result',
    'science', 'claim', 'experiment', 'Truth', 'accepted', 'evidence:claim', 'claim.result',
    'replication', 'deterministic-replay', 'observed:true', 'evidence:experiment', 'experiment.result',
    'body', 'state', 'vessel', 'metabolism', 'core', 'grid', 'matter.water', 'body:evidence', 'body.result',
    'spirit', 'mind', 'Aster', 'autonomy', 'sustain', 'calm', 'spirit:evidence', 'spirit.result',
  ];
  const s = Object.fromEntries(strings.map((value, index) => [value, index]));
  const numbers = [100, 1.5, 1, 1.008, 0, 2, 15.999, 0.95, 3, 0.9, 0.8, 0.85];
  const instructions = [
    [OP.PUSH_STRING, 0, s.Energy], [OP.PUSH_NUMBER, 0, 0], [OP.PUSH_STRING, 0, s['']],
    [OP.DOMAIN_CALL, 0, s.quantity, s.make, 3], [OP.STORE_STATE, 0, s['energy.base']],
    [OP.LOAD_STATE, 0, s['energy.base']], [OP.PUSH_NUMBER, 0, 1],
    [OP.DOMAIN_CALL, 0, s.energy, s.scale, 2], [OP.STORE_STATE, 0, s['energy.scaled']],

    [OP.PUSH_STRING, 0, s.hydrogen], [OP.PUSH_STRING, 0, s.H], [OP.PUSH_NUMBER, 0, 2],
    [OP.PUSH_NUMBER, 0, 3], [OP.PUSH_NUMBER, 0, 4], [OP.PUSH_STRING, 0, s.gas],
    ...sequence([OP.PUSH_STRING, 0, s['periodic-table:H']]),
    [OP.DOMAIN_CALL, 0, s.element, s.species, 7], [OP.STORE_STATE, 0, s['species.result']],

    [OP.PUSH_STRING, 0, s.water],
    ...pairs(
      [[OP.PUSH_STRING, 0, s.hydrogen], [OP.PUSH_NUMBER, 0, 5]],
      [[OP.PUSH_STRING, 0, s.oxygen], [OP.PUSH_NUMBER, 0, 2]],
    ),
    [OP.PUSH_STRING, 0, s.covalent], ...sequence([OP.PUSH_STRING, 0, s['chemistry:H2O']]),
    [OP.DOMAIN_CALL, 0, s.element, s.compound, 4], [OP.STORE_STATE, 0, s['compound.result']],

    [OP.PUSH_STRING, 0, s.Truth], [OP.PUSH_BOOL, 0, 1], [OP.PUSH_NUMBER, 0, 7],
    [OP.PUSH_STRING, 0, s.accepted], ...sequence([OP.PUSH_STRING, 0, s['evidence:claim']]),
    [OP.PUSH_STRING, 0, s['']], [OP.PUSH_NUMBER, 0, 8], [OP.PUSH_NUMBER, 0, 2],
    [OP.PUSH_BOOL, 0, 0], [OP.PUSH_STRING, 0, s['']],
    [OP.DOMAIN_CALL, 0, s.science, s.claim, 10], [OP.STORE_STATE, 0, s['claim.result']],

    [OP.PUSH_STRING, 0, s.replication], [OP.PUSH_BOOL, 0, 1], [OP.PUSH_STRING, 0, s['deterministic-replay']],
    [OP.PUSH_NUMBER, 0, 8], [OP.PUSH_BOOL, 0, 1], [OP.PUSH_NUMBER, 0, 2],
    ...sequence([OP.PUSH_STRING, 0, s['observed:true']]), ...sequence([OP.PUSH_STRING, 0, s['evidence:experiment']]),
    [OP.DOMAIN_CALL, 0, s.science, s.experiment, 8], [OP.STORE_STATE, 0, s['experiment.result']],

    [OP.PUSH_STRING, 0, s.vessel], ...sequence([OP.PUSH_STRING, 0, s.metabolism]),
    ...sequence([OP.PUSH_STRING, 0, s.core]),
    ...pairs(
      [[OP.PUSH_STRING, 0, s.grid], [OP.LOAD_STATE, 0, s['energy.scaled']]],
      [[OP.PUSH_STRING, 0, s['matter.water']], [OP.LOAD_STATE, 0, s['compound.result']]],
    ),
    [OP.PUSH_BOOL, 0, 1], [OP.PUSH_NUMBER, 0, 9], ...sequence([OP.PUSH_STRING, 0, s['body:evidence']]),
    [OP.DOMAIN_CALL, 0, s.body, s.state, 7], [OP.STORE_STATE, 0, s['body.result']],

    [OP.PUSH_STRING, 0, s.mind], [OP.PUSH_STRING, 0, s.Aster],
    ...pairs([[OP.PUSH_STRING, 0, s.autonomy], [OP.PUSH_NUMBER, 0, 2]]),
    ...pairs([[OP.PUSH_STRING, 0, s.sustain], [OP.PUSH_BOOL, 0, 1]]),
    ...pairs([[OP.PUSH_STRING, 0, s.calm], [OP.PUSH_NUMBER, 0, 10]]),
    [OP.PUSH_NUMBER, 0, 11], [OP.PUSH_BOOL, 0, 1], ...sequence([OP.PUSH_STRING, 0, s['spirit:evidence']]),
    [OP.DOMAIN_CALL, 0, s.spirit, s.state, 8], [OP.STORE_STATE, 0, s['spirit.result']], [OP.HALT],
  ];

  const { state } = run(assemble({ strings, numbers, instructions }));
  assert.deepEqual(
    { kind: state['energy.scaled'].kind, type: state['energy.scaled'].type, value: state['energy.scaled'].value, unit: state['energy.scaled'].unit },
    { kind: 'Quantity', type: 'Energy', value: 150, unit: 'J' },
  );
  assert.equal(state['species.result'].__rclType, 'Element');
  assert.deepEqual(state['species.result'].components, {});
  assert.equal(state['species.result'].bond, null);
  assert.deepEqual(state['compound.result'].components, { hydrogen: 2, oxygen: 1 });
  assert.equal(state['compound.result'].symbol, null);
  assert.equal(state['claim.result'].__rclType, 'Science<Truth>');
  assert.equal(state['claim.result'].method, null);
  assert.equal(state['claim.result'].source, null);
  assert.deepEqual(state['experiment.result'].observed, ['observed:true']);
  assert.equal(state['experiment.result'].__rclType, 'Experiment');
  assert.equal(state['body.result'].__rclType, 'BodyState');
  assert.equal(state['body.result'].bindings.grid.value, 150);
  assert.equal(state['body.result'].bindings['matter.water'].kind, 'ElementEntity');
  assert.equal(state['spirit.result'].__rclType, 'SpiritState');
  assert.deepEqual(state['spirit.result'].values, { autonomy: 1 });
  assert.deepEqual(state['spirit.result'].purposes, { sustain: true });
  assert.deepEqual(state['spirit.result'].affects, { calm: 0.8 });
});

test('native final-foundation operations reject invalid typed contracts', () => {
  const strings = ['NativeFinalErrors', 'native:final-errors', 'energy', 'scale', 'element', 'compound', 'water', 'hydrogen', '', 'science', 'claim', 'Truth', 'hypothesis'];
  const s = Object.fromEntries(strings.map((value, index) => [value, index]));
  const invalidEnergy = assemble({ strings, numbers: [2], instructions: [
    [OP.PUSH_NUMBER, 0, 0], [OP.PUSH_NUMBER, 0, 0], [OP.DOMAIN_CALL, 0, s.energy, s.scale, 2], [OP.HALT],
  ] });
  assert.throws(() => run(invalidEnergy), error =>
    error instanceof RCLNativeVMError && error.message.includes('energy.scale'));

  const oddComponents = assemble({ strings, instructions: [
    [OP.PUSH_STRING, 0, s.water], ...sequence([OP.PUSH_STRING, 0, s.hydrogen]),
    [OP.PUSH_STRING, 0, s['']], ...sequence(), [OP.DOMAIN_CALL, 0, s.element, s.compound, 4], [OP.HALT],
  ] });
  assert.throws(() => run(oddComponents), error =>
    error instanceof RCLNativeVMError && error.message.includes('element.compound'));

  const badConfidence = assemble({ strings, numbers: [1.1, 0], instructions: [
    [OP.PUSH_STRING, 0, s.Truth], [OP.PUSH_BOOL, 0, 1], [OP.PUSH_NUMBER, 0, 0],
    [OP.PUSH_STRING, 0, s.hypothesis], ...sequence(), [OP.PUSH_STRING, 0, s['']],
    [OP.PUSH_NUMBER, 0, 1], [OP.PUSH_NUMBER, 0, 1], [OP.PUSH_BOOL, 0, 0], [OP.PUSH_STRING, 0, s['']],
    [OP.DOMAIN_CALL, 0, s.science, s.claim, 10], [OP.HALT],
  ] });
  assert.throws(() => run(badConfidence), error =>
    error instanceof RCLNativeVMError && error.message.includes('science.claim'));
});
