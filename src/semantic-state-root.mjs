import { RCL_SEMANTIC_STATE_ROOT_V2_ALGORITHM, semanticStateRootV2 } from './canonical-f64.mjs';
import { createHash } from 'node:crypto';

export const RCL_NATIVE_STATE_ROOT_ALGORITHM = 'rcl.semantic-state-root.v1';
export const RCL_NATIVE_STATE_ROOT_ALGORITHMS = Object.freeze([RCL_NATIVE_STATE_ROOT_ALGORITHM, RCL_SEMANTIC_STATE_ROOT_V2_ALGORITHM]);

const NATIVE_HEAP_METADATA = new Set([
  '__rclKind',
  '__rclType',
  '__rclObjectId',
  '__rclFieldOffsets',
  '__rclPayloadOffsets',
]);

export class RCLSemanticStateRootError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'RCLSemanticStateRootError';
    this.code = code;
    this.details = details;
  }
}

export function canonicalJson(value) {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalJson(value[key])]));
  }
  return value;
}

export function semanticValue(value) {
  if (Array.isArray(value)) return value.map(semanticValue);
  if (!value || typeof value !== 'object') return value;
  const normalized = Object.fromEntries(Object.entries(value)
    .filter(([key]) => !NATIVE_HEAP_METADATA.has(key))
    .map(([key, item]) => [key, semanticValue(item)]));
  if (normalized.kind === 'Intent' && Array.isArray(normalized.slots)
      && normalized.slots.length % 2 === 0
      && normalized.slots.every((item, index) => index % 2 === 0 ? typeof item === 'string' : true)) {
    normalized.slots = Object.fromEntries(normalized.slots.reduce((pairs, item, index, slots) => {
      if (index % 2 === 0) pairs.push([item, slots[index + 1]]);
      return pairs;
    }, []));
  }
  return normalized;
}

export function semanticStateRoot(value) {
  return createHash('sha256')
    .update(JSON.stringify(canonicalJson(semanticValue(value))))
    .digest('hex');
}

export function verifyNativeSemanticStateRoot(payload, options = {}) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new RCLSemanticStateRootError('RCL_NATIVE_STATE_ROOT_PAYLOAD', 'Native VM payload must be an object', { payload });
  }
  const nativeStateRoot = typeof payload.stateRoot === 'string' ? payload.stateRoot : null;
  const nativeStateRootAlgorithm = typeof payload.stateRootAlgorithm === 'string' ? payload.stateRootAlgorithm : null;
  if ((nativeStateRoot === null) !== (nativeStateRootAlgorithm === null)) {
    throw new RCLSemanticStateRootError('RCL_NATIVE_STATE_ROOT_INCOMPLETE', 'Native VM must emit stateRoot and stateRootAlgorithm together', { nativeStateRoot, nativeStateRootAlgorithm });
  }
  if (nativeStateRootAlgorithm !== null && !RCL_NATIVE_STATE_ROOT_ALGORITHMS.includes(nativeStateRootAlgorithm)) {
    throw new RCLSemanticStateRootError('RCL_NATIVE_STATE_ROOT_ALGORITHM_MISMATCH', `Unsupported native state root algorithm: ${nativeStateRootAlgorithm}`, { nativeStateRootAlgorithm, expected: RCL_NATIVE_STATE_ROOT_ALGORITHMS });
  }
  const selectedAlgorithm = nativeStateRootAlgorithm ?? RCL_NATIVE_STATE_ROOT_ALGORITHM;
  const computedStateRoot = selectedAlgorithm === RCL_SEMANTIC_STATE_ROOT_V2_ALGORITHM
    ? semanticStateRootV2(payload.state ?? {})
    : semanticStateRoot(payload.state ?? {});
  if (nativeStateRoot !== null && nativeStateRoot !== computedStateRoot) {
    throw new RCLSemanticStateRootError('RCL_NATIVE_STATE_ROOT_MISMATCH', `Native state root ${nativeStateRoot} does not match semantic state root ${computedStateRoot}`, { nativeStateRoot, computedStateRoot });
  }
  if (options.requireNativeRoot === true && nativeStateRoot === null) {
    throw new RCLSemanticStateRootError('RCL_NATIVE_STATE_ROOT_MISSING', 'Native VM did not emit a semantic state root', { expectedAlgorithm: RCL_NATIVE_STATE_ROOT_ALGORITHM });
  }
  return {
    ...payload,
    nativeStateRoot,
    semanticStateRoot: computedStateRoot,
    stateRoot: computedStateRoot,
    stateRootAlgorithm: selectedAlgorithm,
    stateRootVerified: nativeStateRoot !== null,
    stateRootParity: nativeStateRoot !== null && nativeStateRoot === computedStateRoot,
  };
}
