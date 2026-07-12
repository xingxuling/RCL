import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_NATIVE_VM_PATH, runNativeBytecode } from '../src/native-vm.mjs';

const VM_PATH = process.env.RCLVM_TEST_PATH ?? DEFAULT_NATIVE_VM_PATH;
const OP = {
  PUSH_NUMBER: 1, PUSH_BOOL: 2, PUSH_STRING: 3, LOAD_STATE: 4, STORE_STATE: 5,
  CALL_BUILTIN: 30, HALT: 31, DOMAIN_CALL: 45,
};

function assemble({ strings, numbers, instructions }) {
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

function sequence(...itemInstructions) {
  const instructions = [[OP.CALL_BUILTIN, 0, 12, 0]];
  for (const item of itemInstructions) instructions.push(item, [OP.CALL_BUILTIN, 0, 13, 2]);
  return instructions;
}

test('native RBC 1.3 cognition domains construct JS-parity typed records', () => {
  const strings = [
    'NativeCognition', 'native:cognition', 'language', 'utterance', 'intent', 'understanding', 'model',
    'creation', 'candidate', 'select', 'hello', 'operator', 'en', 'voice', 'evidence-a', 'root-a',
    'compose', 'write', 'answer', 'topic', 'runtime', 'Text', 'model-value', 'supported', 'hypothesis',
    'draft', 'response', 'dependency-a', 'candidate-a',
    'utterance.result', 'intent.result', 'understanding.result', 'candidate.result', 'selection.result', 'inactive.result',
  ];
  const s = Object.fromEntries(strings.map((value, index) => [value, index]));
  const numbers = [0.9, 0.8, 0.7, 0.6, 0.2];
  const instructions = [
    [OP.PUSH_STRING, 0, s.hello], [OP.PUSH_STRING, 0, s.operator], [OP.PUSH_STRING, 0, s.en],
    [OP.PUSH_STRING, 0, s.voice], ...sequence([OP.PUSH_STRING, 0, s['evidence-a']]),
    [OP.PUSH_STRING, 0, s['root-a']], [OP.DOMAIN_CALL, 0, s.language, s.utterance, 6],
    [OP.STORE_STATE, 0, s['utterance.result']],

    [OP.PUSH_STRING, 0, s.compose], [OP.PUSH_BOOL, 0, 0], [OP.PUSH_STRING, 0, s.write],
    [OP.PUSH_STRING, 0, s.answer], [OP.PUSH_NUMBER, 0, 0], ...sequence(),
    ...sequence([OP.LOAD_STATE, 0, s['utterance.result']]),
    ...sequence([OP.PUSH_STRING, 0, s.topic], [OP.PUSH_STRING, 0, s.runtime]),
    [OP.PUSH_STRING, 0, s['root-a']], [OP.DOMAIN_CALL, 0, s.language, s.intent, 9],
    [OP.STORE_STATE, 0, s['intent.result']],

    [OP.PUSH_STRING, 0, s.Text], [OP.PUSH_STRING, 0, s['model-value']], [OP.PUSH_NUMBER, 0, 1],
    [OP.PUSH_STRING, 0, s.supported], ...sequence([OP.PUSH_STRING, 0, s['evidence-a']]),
    ...sequence([OP.PUSH_STRING, 0, s['dependency-a']]), [OP.PUSH_NUMBER, 0, 2], [OP.PUSH_NUMBER, 0, 3],
    [OP.PUSH_STRING, 0, s.hypothesis], [OP.PUSH_STRING, 0, s['root-a']],
    [OP.DOMAIN_CALL, 0, s.understanding, s.model, 10], [OP.STORE_STATE, 0, s['understanding.result']],

    [OP.PUSH_STRING, 0, s.Text], [OP.PUSH_STRING, 0, s.draft], [OP.PUSH_BOOL, 0, 1],
    [OP.PUSH_STRING, 0, s.response], [OP.PUSH_NUMBER, 0, 4], [OP.PUSH_NUMBER, 0, 0],
    [OP.PUSH_NUMBER, 0, 1], [OP.PUSH_NUMBER, 0, 4], ...sequence([OP.PUSH_STRING, 0, s['evidence-a']]),
    ...sequence([OP.PUSH_STRING, 0, s['dependency-a']]), [OP.PUSH_STRING, 0, s['root-a']],
    [OP.DOMAIN_CALL, 0, s.creation, s.candidate, 11], [OP.STORE_STATE, 0, s['candidate.result']],

    [OP.LOAD_STATE, 0, s['candidate.result']], ...sequence([OP.PUSH_STRING, 0, s['candidate-a']]),
    [OP.DOMAIN_CALL, 0, s.creation, s.select, 2], [OP.STORE_STATE, 0, s['selection.result']],

    [OP.PUSH_STRING, 0, s.Text], [OP.PUSH_STRING, 0, s.draft], [OP.PUSH_BOOL, 0, 0],
    [OP.PUSH_STRING, 0, s.response], [OP.PUSH_NUMBER, 0, 4], [OP.PUSH_NUMBER, 0, 0],
    [OP.PUSH_NUMBER, 0, 1], [OP.PUSH_NUMBER, 0, 4], ...sequence(), ...sequence(),
    [OP.PUSH_STRING, 0, s['root-a']], [OP.DOMAIN_CALL, 0, s.creation, s.candidate, 11],
    [OP.STORE_STATE, 0, s['inactive.result']], [OP.HALT],
  ];

  const result = runNativeBytecode(assemble({ strings, numbers, instructions }), { vmPath: VM_PATH });
  assert.deepEqual(result.state['utterance.result'].evidence, ['evidence-a']);
  assert.equal(result.state['utterance.result'].__rclType, 'Utterance');
  assert.equal(result.state['intent.result'].confidence, 0);
  assert.deepEqual(result.state['intent.result'].slots, ['topic', 'runtime']);
  assert.equal(result.state['understanding.result'].__rclType, 'Understand<Text>');
  assert.deepEqual(result.state['understanding.result'].dependencies, ['dependency-a']);
  assert.equal(result.state['candidate.result'].__rclType, 'Create<Text>');
  assert.equal(result.state['candidate.result'].score, 0.755);
  assert.equal(result.state['candidate.result'].status, 'candidate');
  assert.equal(result.state['selection.result'].status, 'selected');
  assert.deepEqual(result.state['selection.result'].selectedFrom, ['candidate-a']);
  assert.equal(result.state['selection.result'].value, 'draft');
  assert.equal(result.state['inactive.result'].score, 0);
  assert.equal(result.state['inactive.result'].status, 'inactive');
});
