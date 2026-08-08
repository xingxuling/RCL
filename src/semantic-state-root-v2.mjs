import { createHash } from 'node:crypto';
import { TextEncoder } from 'node:util';
import { semanticValue } from './semantic-state-root.mjs';
import {
  RCL_CANONICAL_NUMBER_ENCODING_V2,
  canonicalNumberV2,
} from './canonical-number-v2.mjs';

export const RCL_NATIVE_STATE_ROOT_ALGORITHM_V2 = 'rcl.semantic-state-root.v2';
export const RCL_SEMANTIC_STATE_ROOT_V2_FORMAT = 'rcl.semantic-state-root-v2.v0.1';

const encoder = new TextEncoder();

export class RCLSemanticStateRootV2Error extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'RCLSemanticStateRootV2Error';
    this.code = code;
    this.details = details;
  }
}

function stringToken(value) {
  const text = String(value);
  return `s${encoder.encode(text).byteLength}:${text};`;
}

function numberToken(value) {
  return `d${canonicalNumberV2(value)};`;
}

function encode(value, seen) {
  if (value === null) return 'n;';
  if (typeof value === 'boolean') return value ? 'b1;' : 'b0;';
  if (typeof value === 'number') return numberToken(value);
  if (typeof value === 'string') return stringToken(value);
  if (typeof value === 'undefined' || typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint') {
    throw new RCLSemanticStateRootV2Error('RCL_SEMANTIC_ROOT_V2_VALUE_TYPE', `Unsupported semantic value type: ${typeof value}`, { valueType: typeof value });
  }
  if (seen.has(value)) {
    throw new RCLSemanticStateRootV2Error('RCL_SEMANTIC_ROOT_V2_CYCLE', 'Semantic state root v2 does not accept cyclic values');
  }
  seen.add(value);
  let result;
  if (Array.isArray(value)) {
    result = `a${value.length}[${value.map(item => encode(item, seen)).join('')}]`;
  } else {
    const keys = Object.keys(value).sort();
    result = `o${keys.length}{${keys.map(key => `${stringToken(key)}${encode(value[key], seen)}`).join('')}}`;
  }
  seen.delete(value);
  return result;
}

export function canonicalSemanticValueV2(value) {
  return semanticValue(value);
}

export function canonicalSemanticBytesV2(value) {
  return Buffer.from(encode(canonicalSemanticValueV2(value), new Set()), 'utf8');
}

export function semanticStateRootV2(value) {
  return createHash('sha256').update(canonicalSemanticBytesV2(value)).digest('hex');
}

export function verifySemanticStateRootV2(payload, options = {}) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new RCLSemanticStateRootV2Error('RCL_SEMANTIC_ROOT_V2_PAYLOAD', 'Semantic root v2 payload must be an object', { payload });
  }
  const computedStateRoot = semanticStateRootV2(payload.state ?? {});
  const nativeStateRoot = typeof payload.stateRoot === 'string' ? payload.stateRoot : null;
  const nativeStateRootAlgorithm = typeof payload.stateRootAlgorithm === 'string' ? payload.stateRootAlgorithm : null;
  if ((nativeStateRoot === null) !== (nativeStateRootAlgorithm === null)) {
    throw new RCLSemanticStateRootV2Error('RCL_SEMANTIC_ROOT_V2_INCOMPLETE', 'Semantic root v2 payload must emit stateRoot and stateRootAlgorithm together');
  }
  if (nativeStateRootAlgorithm !== null && nativeStateRootAlgorithm !== RCL_NATIVE_STATE_ROOT_ALGORITHM_V2) {
    throw new RCLSemanticStateRootV2Error('RCL_SEMANTIC_ROOT_V2_ALGORITHM_MISMATCH', `Unsupported semantic root v2 algorithm: ${nativeStateRootAlgorithm}`, { expected: RCL_NATIVE_STATE_ROOT_ALGORITHM_V2 });
  }
  if (nativeStateRoot !== null && nativeStateRoot !== computedStateRoot) {
    throw new RCLSemanticStateRootV2Error('RCL_SEMANTIC_ROOT_V2_MISMATCH', `Semantic root v2 ${nativeStateRoot} does not match ${computedStateRoot}`, { nativeStateRoot, computedStateRoot });
  }
  if (options.requireNativeRoot === true && nativeStateRoot === null) {
    throw new RCLSemanticStateRootV2Error('RCL_SEMANTIC_ROOT_V2_MISSING', 'Semantic root v2 payload is missing native root evidence', { expectedAlgorithm: RCL_NATIVE_STATE_ROOT_ALGORITHM_V2 });
  }
  return {
    ...payload,
    semanticStateRoot: computedStateRoot,
    nativeStateRoot,
    stateRoot: computedStateRoot,
    stateRootAlgorithm: nativeStateRootAlgorithm ?? RCL_NATIVE_STATE_ROOT_ALGORITHM_V2,
    stateRootVerified: nativeStateRoot !== null,
    stateRootParity: nativeStateRoot !== null && nativeStateRoot === computedStateRoot,
    numberEncoding: RCL_CANONICAL_NUMBER_ENCODING_V2,
  };
}
