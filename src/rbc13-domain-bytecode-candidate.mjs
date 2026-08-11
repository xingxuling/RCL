import { decodeBytecode } from './bytecode.mjs';

export const RBC13_DOMAIN_BYTECODE_VERSION = Object.freeze({ major: 1, minor: 3 });
export const RBC13_DOMAIN_CALL_OPCODE = 45;
export const RBC13_DOMAIN_CALL_FLAGS = Object.freeze({ literal: 0, dynamic: 1 });

const BASE = Object.freeze({
  PUSH_NUMBER: 1,
  PUSH_BOOL: 2,
  PUSH_STRING: 3,
  LOAD_STATE: 4,
  STORE_STATE: 5,
  CALL_BUILTIN: 30,
  HALT: 31,
});

const BUILTIN = Object.freeze({
  EMPTY_SEQUENCE: 12,
  SEQUENCE_APPEND: 13,
});

class Pool {
  constructor() {
    this.strings = [];
    this.stringIds = new Map();
    this.numbers = [];
    this.numberIds = new Map();
  }
  string(value) {
    const text = String(value);
    if (this.stringIds.has(text)) return this.stringIds.get(text);
    const id = this.strings.length;
    this.strings.push(text);
    this.stringIds.set(text, id);
    return id;
  }
  number(value) {
    const number = Number(value);
    const key = Object.is(number, -0) ? '-0' : String(number);
    if (this.numberIds.has(key)) return this.numberIds.get(key);
    const id = this.numbers.length;
    this.numbers.push(number);
    this.numberIds.set(key, id);
    return id;
  }
}

function argumentInstructions(pool, value, depth = 0) {
  if (depth > 64) throw new TypeError('RBC 1.3 DOMAIN_CALL candidate argument nesting exceeds 64 levels');
  // Non-finite numbers are encoded only so negative controls can prove that
  // the native Domain Value membrane rejects them before organ invocation.
  if (typeof value === 'number') return [{ op: BASE.PUSH_NUMBER, a: pool.number(value) }];
  if (typeof value === 'boolean') return [{ op: BASE.PUSH_BOOL, a: value ? 1 : 0 }];
  if (typeof value === 'string') return [{ op: BASE.PUSH_STRING, a: pool.string(value) }];
  if (Array.isArray(value)) {
    const instructions = [{ op: BASE.CALL_BUILTIN, a: BUILTIN.EMPTY_SEQUENCE, b: 0 }];
    for (const item of value) {
      instructions.push(...argumentInstructions(pool, item, depth + 1));
      instructions.push({ op: BASE.CALL_BUILTIN, a: BUILTIN.SEQUENCE_APPEND, b: 2 });
    }
    return instructions;
  }
  if (value && typeof value === 'object' && !Array.isArray(value)
      && Object.keys(value).length === 1 && typeof value.$state === 'string' && value.$state.length > 0) {
    return [{ op: BASE.LOAD_STATE, a: pool.string(value.$state) }];
  }
  throw new TypeError(
    'RBC 1.3 DOMAIN_CALL candidate arguments accept Number, Truth, Text, recursive Sequence, or { $state: "path" } references',
  );
}

function encode({ pool, instructions, programNameIndex, sourceRootIndex }) {
  const stringBytes = pool.strings.map(text => Buffer.from(text, 'utf8'));
  const size = 36
    + stringBytes.reduce((sum, bytes) => sum + 4 + bytes.length, 0)
    + pool.numbers.length * 8
    + instructions.length * 16;
  const buffer = Buffer.alloc(size);
  let offset = 0;
  buffer.write('RCLB', offset, 4, 'ascii'); offset += 4;
  buffer.writeUInt16LE(1, offset); offset += 2;
  buffer.writeUInt16LE(3, offset); offset += 2;
  buffer.writeUInt32LE(0, offset); offset += 4;
  buffer.writeUInt32LE(programNameIndex, offset); offset += 4;
  buffer.writeUInt32LE(sourceRootIndex, offset); offset += 4;
  buffer.writeUInt32LE(pool.strings.length, offset); offset += 4;
  buffer.writeUInt32LE(pool.numbers.length, offset); offset += 4;
  buffer.writeUInt32LE(instructions.length, offset); offset += 4;
  buffer.writeUInt32LE(0, offset); offset += 4;
  for (const bytes of stringBytes) {
    buffer.writeUInt32LE(bytes.length, offset); offset += 4;
    bytes.copy(buffer, offset); offset += bytes.length;
  }
  for (const number of pool.numbers) {
    buffer.writeDoubleLE(number, offset); offset += 8;
  }
  for (const instruction of instructions) {
    buffer.writeUInt8(instruction.op, offset); offset += 1;
    buffer.writeUInt8(instruction.flags ?? 0, offset); offset += 1;
    buffer.writeUInt16LE(0, offset); offset += 2;
    buffer.writeInt32LE(instruction.a ?? 0, offset); offset += 4;
    buffer.writeInt32LE(instruction.b ?? 0, offset); offset += 4;
    buffer.writeInt32LE(instruction.c ?? 0, offset); offset += 4;
  }
  return buffer;
}

/** Candidate-only RBC 1.3 assembler. It never changes canonical compileRealityToBytecode lowering. */
export function assembleRbc13DomainCallProgram({
  program = 'Rbc13DomainCallCandidate',
  sourceRoot = 'candidate:rbc13-domain-call',
  calls,
}) {
  if (!Array.isArray(calls) || calls.length === 0) throw new TypeError('calls must be a non-empty array');
  const pool = new Pool();
  const instructions = [];
  const programNameIndex = pool.string(program);
  const sourceRootIndex = pool.string(sourceRoot);
  for (const [index, call] of calls.entries()) {
    if (!call || typeof call !== 'object') throw new TypeError(`calls[${index}] must be an object`);
    const domain = String(call.domain ?? '');
    const operation = String(call.operation ?? '');
    const target = String(call.target ?? '');
    const args = call.args ?? [];
    if (!domain || !operation || !target || !Array.isArray(args)) throw new TypeError(`calls[${index}] requires domain, operation, target and args[]`);
    const dynamic = call.dynamic === true;
    if (dynamic) {
      instructions.push({ op: BASE.PUSH_STRING, a: pool.string(domain) });
      instructions.push({ op: BASE.PUSH_STRING, a: pool.string(operation) });
    }
    for (const value of args) instructions.push(...argumentInstructions(pool, value));
    instructions.push({
      op: RBC13_DOMAIN_CALL_OPCODE,
      flags: dynamic ? RBC13_DOMAIN_CALL_FLAGS.dynamic : RBC13_DOMAIN_CALL_FLAGS.literal,
      a: dynamic ? 0 : pool.string(domain),
      b: dynamic ? 0 : pool.string(operation),
      c: args.length,
    });
    instructions.push({ op: BASE.STORE_STATE, a: pool.string(target) });
  }
  instructions.push({ op: BASE.HALT });
  return encode({ pool, instructions, programNameIndex, sourceRootIndex });
}

export function decodeRbc13DomainCallCandidate(bufferLike) {
  const decoded = decodeBytecode(bufferLike);
  const instructions = decoded.instructions.map(item => {
    if (item.op !== RBC13_DOMAIN_CALL_OPCODE) return item;
    return Object.freeze({
      ...item,
      name: 'DOMAIN_CALL',
      domain: item.flags === RBC13_DOMAIN_CALL_FLAGS.literal ? decoded.strings[item.a] : undefined,
      operation: item.flags === RBC13_DOMAIN_CALL_FLAGS.literal ? decoded.strings[item.b] : undefined,
      argc: item.c,
    });
  });
  return Object.freeze({ ...decoded, instructions });
}
