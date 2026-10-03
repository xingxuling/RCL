import { createHash } from 'node:crypto';
import { canonicalF64Hex } from './canonical-f64.mjs';

export const RCL_SEMANTIC_STATE_ROOT_V2 = 'rcl.semantic-state-root.v2';
const HEAP_METADATA = new Set([
  '__rclKind', '__rclType', '__rclObjectId', '__rclFieldOffsets', '__rclPayloadOffsets', '__rclRecord', '__rclUnion',
]);
const UNPAIRED_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u;

function scalarText(value) {
  if (UNPAIRED_SURROGATE.test(value)) throw new TypeError('RCL_STATE_ROOT_V2_UNICODE_SCALAR_REQUIRED');
  return value;
}

function hasNativeLayout(descriptors, depth) {
  // The outer object is the facet map. Its keys are always semantic, even
  // when a user names a facet after a native layout field.
  if (depth === 0) return false;
  const kind = descriptors.__rclKind?.value;
  if (kind === 'Ref') return typeof descriptors.__rclRefType?.value === 'string'
    && typeof descriptors.__rclRefKind?.value === 'string'
    && typeof descriptors.__rclRefObjectId?.value === 'number';
  return ['Record', 'TypedRecord', 'Union'].includes(kind)
    && typeof descriptors.__rclType?.value === 'string';
}

function canonicalNode(value, ancestors, depth) {
  if (depth > 256) throw new TypeError('RCL_STATE_ROOT_V2_DEPTH_LIMIT');
  if (value === null) return ['null'];
  if (typeof value === 'number') return ['number', canonicalF64Hex(value)];
  if (typeof value === 'string') return ['text', scalarText(value)];
  if (typeof value === 'boolean') return ['truth', value];
  if (typeof value !== 'object') throw new TypeError('RCL_STATE_ROOT_V2_JSON_VALUE_REQUIRED');
  if (ancestors.has(value)) throw new TypeError('RCL_STATE_ROOT_V2_CYCLE_REJECTED');
  if (Object.getOwnPropertySymbols(value).length) throw new TypeError('RCL_STATE_ROOT_V2_SYMBOL_KEY_REJECTED');
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Object.values(descriptors).some(d => !('value' in d))) {
    throw new TypeError('RCL_STATE_ROOT_V2_ACCESSOR_REJECTED');
  }
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      const items = [];
      for (let i = 0; i < value.length; i++) {
        if (!descriptors[i]) throw new TypeError('RCL_STATE_ROOT_V2_SPARSE_SEQUENCE_REJECTED');
        items.push(canonicalNode(descriptors[i].value, ancestors, depth + 1));
      }
      if (Object.keys(descriptors).some(k => k !== 'length' && !/^(0|[1-9][0-9]*)$/u.test(k))) {
        throw new TypeError('RCL_STATE_ROOT_V2_SEQUENCE_PROPERTY_REJECTED');
      }
      return ['sequence', items];
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== null && prototype !== Object.prototype) throw new TypeError('RCL_STATE_ROOT_V2_RECORD_REQUIRED');
    const nativeLayout = hasNativeLayout(descriptors, depth);
    const entries = Object.entries(descriptors).filter(([key, d]) => d.enumerable && !(nativeLayout && HEAP_METADATA.has(key)));
    if (depth > 0 && descriptors.kind?.value === 'Intent' && Array.isArray(descriptors.slots?.value)) {
      const slots = descriptors.slots.value;
      if (Object.getOwnPropertySymbols(slots).length) throw new TypeError('RCL_STATE_ROOT_V2_SYMBOL_KEY_REJECTED');
      const slotDescriptors = Object.getOwnPropertyDescriptors(slots);
      if (Object.values(slotDescriptors).some(d => !('value' in d))) throw new TypeError('RCL_STATE_ROOT_V2_ACCESSOR_REJECTED');
      if (Object.keys(slotDescriptors).some(k => k !== 'length' && !/^(0|[1-9][0-9]*)$/u.test(k))) {
        throw new TypeError('RCL_STATE_ROOT_V2_SEQUENCE_PROPERTY_REJECTED');
      }
      const slotValues = Array.from({ length: slots.length }, (_, i) => {
        if (!slotDescriptors[i]) throw new TypeError('RCL_STATE_ROOT_V2_SPARSE_SEQUENCE_REJECTED');
        return slotDescriptors[i].value;
      });
      if (slotValues.length % 2 === 0 && slotValues.every((v, i) => i % 2 ? true : typeof v === 'string')) {
        const keys = slotValues.filter((_, i) => i % 2 === 0);
        if (new Set(keys).size !== keys.length) throw new TypeError('RCL_STATE_ROOT_V2_DUPLICATE_SLOT_REJECTED');
        const normalized = Object.fromEntries(Array.from({ length: slotValues.length / 2 }, (_, i) => [slotValues[2 * i], slotValues[2 * i + 1]]));
        const slotEntry = entries.find(([key]) => key === 'slots');
        if (slotEntry) slotEntry[1] = { ...slotEntry[1], value: normalized };
      }
    }
    entries.sort(([a], [b]) => Buffer.compare(Buffer.from(scalarText(a), 'utf8'), Buffer.from(scalarText(b), 'utf8')));
    return ['record', entries.map(([key, d]) => [scalarText(key), canonicalNode(d.value, ancestors, depth + 1)])];
  } finally {
    ancestors.delete(value);
  }
}

export function semanticStateCanonicalV2Stable(value) {
  return JSON.stringify(canonicalNode(value, new Set(), 0));
}

export function semanticStateRootV2Stable(value) {
  return createHash('sha256').update(semanticStateCanonicalV2Stable(value), 'utf8').digest('hex');
}
