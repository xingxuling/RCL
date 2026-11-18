import { RCL_SEMANTIC_STATE_ROOT_V2_ALGORITHM, semanticStateRootV2 } from './canonical-f64.mjs';
import { createHash } from 'node:crypto';
import { RCL_SEMANTIC_STATE_ROOT_V2, semanticStateCanonicalV2Stable, semanticStateRootV2Stable } from './semantic-state-root-v2.mjs';
import { isProjectedAstLiteral, projectAstLiterals } from './compiler-primitives.mjs';
export { RCL_SEMANTIC_STATE_ROOT_V2, semanticStateRootV2Stable } from './semantic-state-root-v2.mjs';

export const RCL_NATIVE_STATE_ROOT_ALGORITHM = 'rcl.semantic-state-root.v1';
export const RCL_DEFAULT_NATIVE_STATE_ROOT_ALGORITHM = RCL_SEMANTIC_STATE_ROOT_V2;
export const RCL_SEMANTIC_STATE_ROOT_V3_CANDIDATE = 'rcl.semantic-state-root.v3-candidate';
export const RCL_NATIVE_STATE_ROOT_ALGORITHMS = Object.freeze([RCL_NATIVE_STATE_ROOT_ALGORITHM, RCL_SEMANTIC_STATE_ROOT_V2_ALGORITHM, RCL_SEMANTIC_STATE_ROOT_V2, RCL_SEMANTIC_STATE_ROOT_V3_CANDIDATE]);

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

export function semanticStateRootForAlgorithm(value, algorithm = RCL_NATIVE_STATE_ROOT_ALGORITHM) {
  if (algorithm === RCL_NATIVE_STATE_ROOT_ALGORITHM) return semanticStateRoot(value);
  if (algorithm === RCL_SEMANTIC_STATE_ROOT_V2_ALGORITHM) return semanticStateRootV2(value);
  if (algorithm === RCL_SEMANTIC_STATE_ROOT_V2) return semanticStateRootV2Stable(value);
  if (algorithm === RCL_SEMANTIC_STATE_ROOT_V3_CANDIDATE) {
    // Apply the existing input validation before copying; cloning alone would
    // evaluate accessors and could conceal forbidden values.
    semanticStateCanonicalV2Stable(value);
    const projection = projectAstLiterals(value);
    return createHash('sha256').update(RCL_SEMANTIC_STATE_ROOT_V3_CANDIDATE).update('\0')
      .update(semanticStateCanonicalV2Stable(projection), 'utf8').digest('hex');
  }
  throw new RCLSemanticStateRootError('RCL_NATIVE_STATE_ROOT_ALGORITHM_MISMATCH', 'Unsupported semantic state root algorithm', { algorithm });
}

// AST public JSON does not carry native literal spelling. A caller that relies
// on v2 as a complete representation can explicitly reject this projection.
function containsProjectedAst(value, rawRequired = false) {
  const pending = [value], seen = new WeakSet();
  while (pending.length) {
    const item = pending.pop();
    if (!item || typeof item !== 'object' || seen.has(item)) continue;
    seen.add(item);
    if (rawRequired) {
      if (isProjectedAstLiteral(item) && typeof item.literalText !== 'string') return true;
    } else if (!Array.isArray(item) && item.kind === 'FacetDecl' && item.value?.kind === 'LiteralExpr') return true;
    for (const child of Object.values(item)) if (child && typeof child === 'object') pending.push(child);
  }
  return false;
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
  if (options.expectedAlgorithm !== undefined && selectedAlgorithm !== options.expectedAlgorithm) {
    throw new RCLSemanticStateRootError('RCL_NATIVE_STATE_ROOT_ALGORITHM_MISMATCH', 'Native VM did not emit the requested root algorithm', { expected: options.expectedAlgorithm, actual: selectedAlgorithm });
  }
  if ([RCL_SEMANTIC_STATE_ROOT_V2, RCL_SEMANTIC_STATE_ROOT_V3_CANDIDATE].includes(selectedAlgorithm) && (!payload.state || typeof payload.state !== 'object' || Array.isArray(payload.state))) {
    throw new RCLSemanticStateRootError('RCL_NATIVE_STATE_ROOT_PAYLOAD', 'v2 native state must be an explicit object');
  }
  let computedStateRoot;
  try { computedStateRoot = semanticStateRootForAlgorithm(payload.state ?? {}, selectedAlgorithm); }
  catch (error) {
    if (selectedAlgorithm === RCL_SEMANTIC_STATE_ROOT_V3_CANDIDATE) {
      throw new RCLSemanticStateRootError('RCL_NATIVE_STATE_ROOT_V3_INVALID', error.message);
    }
    throw error;
  }
  if (nativeStateRoot !== null && nativeStateRoot !== computedStateRoot) {
    throw new RCLSemanticStateRootError('RCL_NATIVE_STATE_ROOT_MISMATCH', `Native state root ${nativeStateRoot} does not match semantic state root ${computedStateRoot}`, { nativeStateRoot, computedStateRoot });
  }
  if ([RCL_SEMANTIC_STATE_ROOT_V2, RCL_SEMANTIC_STATE_ROOT_V3_CANDIDATE].includes(selectedAlgorithm)) {
    for (const key of ['history', 'projections']) {
      if (payload[key] === undefined) continue;
      if (!Array.isArray(payload[key])) throw new RCLSemanticStateRootError('RCL_NATIVE_STATE_ROOT_PAYLOAD', 'Native ' + key + ' must be an array');
      for (const record of payload[key]) {
        if (!record || record.stateRootAlgorithm !== selectedAlgorithm
            || !/^[0-9a-f]{64}$/u.test(record.beforeRoot ?? '') || !/^[0-9a-f]{64}$/u.test(record.afterRoot ?? '')) {
          throw new RCLSemanticStateRootError('RCL_NATIVE_TRANSITION_ROOT_ALGORITHM_MISMATCH', 'Native transition roots must be explicitly bound to the selected algorithm');
        }
      }
    }
  }
  if (options.requireNativeRoot === true && nativeStateRoot === null) {
    throw new RCLSemanticStateRootError('RCL_NATIVE_STATE_ROOT_MISSING', 'Native VM did not emit a semantic state root', { expectedAlgorithm: RCL_NATIVE_STATE_ROOT_ALGORITHM });
  }
  if (options.rejectProjectedAst === true
      && containsProjectedAst([payload.state, payload.history, payload.projections], selectedAlgorithm === RCL_SEMANTIC_STATE_ROOT_V3_CANDIDATE)) {
    throw new RCLSemanticStateRootError('RCL_NATIVE_STATE_ROOT_AST_PROJECTION_LOSSY',
      'AstNode literal spelling is not bound by the selected state projection');
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
