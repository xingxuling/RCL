import { createHash } from 'node:crypto';

export const RCL_CANONICAL_F64_VERSION = '0.1.0-candidate.1';
export const RCL_CANONICAL_F64_FORMAT = 'rcl.canonical-f64.v0.1';
export const RCL_SEMANTIC_STATE_ROOT_V2_ALGORITHM = 'rcl.semantic-state-root.v2-candidate';

const F64_HEX = /^[0-9a-f]{16}$/u;
const NATIVE_HEAP_METADATA = new Set([
  '__rclKind', '__rclType', '__rclObjectId', '__rclFieldOffsets', '__rclPayloadOffsets',
]);

export function canonicalF64Hex(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError('RCL_CANONICAL_F64_FINITE_NUMBER_REQUIRED');
  }
  const normalized = Object.is(value, -0) ? 0 : value;
  const bytes = new ArrayBuffer(8);
  const view = new DataView(bytes);
  view.setFloat64(0, normalized, false);
  return view.getBigUint64(0, false).toString(16).padStart(16, '0');
}

export function f64FromCanonicalHex(hex) {
  if (typeof hex !== 'string' || !F64_HEX.test(hex)) {
    throw new TypeError('RCL_CANONICAL_F64_HEX_INVALID');
  }
  const bytes = new ArrayBuffer(8);
  const view = new DataView(bytes);
  view.setBigUint64(0, BigInt(`0x${hex}`), false);
  const value = view.getFloat64(0, false);
  if (!Number.isFinite(value)) throw new TypeError('RCL_CANONICAL_F64_NONFINITE_BITS_REJECTED');
  return Object.is(value, -0) ? 0 : value;
}

export function canonicalF64(value) {
  const hex = canonicalF64Hex(value);
  return Object.freeze({
    format: RCL_CANONICAL_F64_FORMAT,
    version: RCL_CANONICAL_F64_VERSION,
    ieee754Binary64Hex: hex,
    negativeZeroNormalized: Object.is(value, -0),
  });
}

function semanticValueV2(value) {
  if (typeof value === 'number') {
    return Object.freeze({ $rclF64: canonicalF64Hex(value) });
  }
  if (Array.isArray(value)) return value.map(semanticValueV2);
  if (!value || typeof value !== 'object') return value;
  const normalized = Object.fromEntries(Object.entries(value)
    .filter(([key]) => !NATIVE_HEAP_METADATA.has(key))
    .map(([key, item]) => [key, semanticValueV2(item)]));
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

function canonicalObject(value) {
  if (Array.isArray(value)) return value.map(canonicalObject);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalObject(value[key])]));
  }
  return value;
}

export function semanticStateCanonicalV2(value) {
  return JSON.stringify(canonicalObject(semanticValueV2(value)));
}

export function semanticStateRootV2(value) {
  return createHash('sha256').update(semanticStateCanonicalV2(value)).digest('hex');
}
