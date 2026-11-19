import { semanticStateRootForAlgorithm } from './semantic-state-root.mjs';
import { RCL_SESSION_INPUT_TYPES, sessionError } from './session-contract.mjs';

// RCP1 stores exact binary64 bits and a tree of immutable scalar values.
const types = Object.freeze({ ...RCL_SESSION_INPUT_TYPES, Sequence: 4 });
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_TEXT_BYTES = 1024 * 1024;
const MAX_DEPTH = 32;
const MAX_VALUES = 65536;
const MAX_FACETS = 2048;
const header = Buffer.from('RCP1');
const utf8 = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
const invalid = () => sessionError('RCL_SESSION_CHECKPOINT_STATE_INVALID');
const limit = () => sessionError('RCL_SESSION_CHECKPOINT_STATE_LIMIT');
const unsupported = () => sessionError('RCL_SESSION_CHECKPOINT_VALUE_UNSUPPORTED');

export function hasSequenceCheckpointState(program) {
  return program.facets.some((facet) => facet.valueType === 'Sequence');
}

function orderedFacets(program) {
  if (program.facets.length > MAX_FACETS) throw limit();
  return program.facets.map(({ path, valueType }) => {
    if (!Object.hasOwn(types, valueType)) throw unsupported();
    return { path, name: textBytes(path), type: types[valueType] };
  }).sort((left, right) => Buffer.compare(left.name, right.name));
}

function textBytes(text) {
  if (text.includes('\0') || !text.isWellFormed()) throw invalid();
  if (Buffer.byteLength(text, 'utf8') > MAX_TEXT_BYTES) throw limit();
  return Buffer.from(text, 'utf8');
}

function valueType(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return types.Number;
  if (typeof value === 'boolean') return types.Truth;
  if (typeof value === 'string') return types.Text;
  if (Array.isArray(value)) return types.Sequence;
  throw unsupported();
}

export function encodeSequenceCheckpointState(program, state) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) throw invalid();
  const facets = orderedFacets(program);
  const fields = Object.getOwnPropertyDescriptors(state);
  if (Reflect.ownKeys(fields).length !== facets.length) throw invalid();
  const bytes = Buffer.allocUnsafe(MAX_BYTES);
  let offset = 0;
  let values = 0;
  function advance(count) {
    if (count > bytes.length - offset) throw limit();
    const position = offset;
    offset += count;
    return position;
  }
  const write = (chunk) => chunk.copy(bytes, advance(chunk.length));
  const unsigned = (value) => bytes.writeUInt32LE(value, advance(4));
  function writeText(chunk) {
    unsigned(chunk.length);
    write(chunk);
  }
  function writeValue(value, type, depth) {
    if (++values > MAX_VALUES || depth > MAX_DEPTH) throw limit();
    bytes[advance(1)] = type;
    if (type === types.Number) bytes.writeDoubleLE(value, advance(8));
    else if (type === types.Truth) bytes[advance(1)] = Number(value);
    else if (type === types.Text) writeText(textBytes(value));
    else {
      if (value.length > MAX_VALUES - values) throw limit();
      unsigned(value.length);
      for (const item of value) writeValue(item, valueType(item), depth + 1);
    }
  }
  write(header);
  unsigned(facets.length);
  for (const { path, name, type } of facets) {
    const field = Object.hasOwn(fields, path) ? fields[path] : null;
    if (!field?.enumerable || !('value' in field) || valueType(field.value) !== type) throw invalid();
    writeText(name);
    writeValue(field.value, type, 0);
  }
  return bytes.toString('hex', 0, offset);
}

export function captureSequenceSessionCheckpoint(program, checkpoint, algorithm) {
  const { stateRoot, stateWireHex } = checkpoint ?? {};
  if (typeof stateRoot !== 'string' || !/^[0-9a-f]{64}$/u.test(stateRoot)
      || typeof stateWireHex !== 'string' || stateWireHex.length < 16 || stateWireHex.length > MAX_BYTES * 2
      || stateWireHex.length % 2 !== 0 || !/^[0-9a-f]+$/u.test(stateWireHex)) throw invalid();
  const bytes = Buffer.from(stateWireHex, 'hex');
  const facets = orderedFacets(program);
  let offset = 0;
  let values = 0;
  function advance(count) {
    if (count > bytes.length - offset) throw invalid();
    const position = offset;
    offset += count;
    return position;
  }
  const unsigned = () => bytes.readUInt32LE(advance(4));
  const take = (count) => bytes.subarray(advance(count), offset);
  function takeTextBytes() {
    const length = unsigned();
    if (length > MAX_TEXT_BYTES) throw limit();
    const text = take(length);
    if (text.includes(0)) throw invalid();
    return text;
  }
  function readValue(depth, expectedType) {
    if (++values > MAX_VALUES || depth > MAX_DEPTH) throw limit();
    const type = bytes[advance(1)];
    if (expectedType !== undefined && type !== expectedType) throw invalid();
    if (type === types.Number) {
      const number = bytes.readDoubleLE(advance(8));
      if (!Number.isFinite(number)) throw invalid();
      return number;
    }
    if (type === types.Truth) {
      const truth = bytes[advance(1)];
      if (truth > 1) throw invalid();
      return truth === 1;
    }
    if (type === types.Text) {
      const text = takeTextBytes();
      try { return utf8.decode(text); } catch { throw invalid(); }
    }
    if (type !== types.Sequence) throw unsupported();
    const count = unsigned();
    if (count > MAX_VALUES - values) throw limit();
    if (count > bytes.length - offset) throw invalid();
    const result = [];
    for (let index = 0; index < count; index++) result.push(readValue(depth + 1));
    return Object.freeze(result);
  }
  if (!take(4).equals(header) || unsigned() !== facets.length) throw invalid();
  const state = Object.create(null);
  for (const { path, name, type } of facets) {
    if (!takeTextBytes().equals(name)) throw invalid();
    state[path] = readValue(0, type);
  }
  if (offset !== bytes.length) throw invalid();
  if (semanticStateRootForAlgorithm(state, algorithm) !== stateRoot) throw sessionError('RCL_SESSION_CHECKPOINT_STATE_ROOT_MISMATCH');
  return Object.freeze({ state: Object.freeze(state), stateRoot, stateWireHex });
}
