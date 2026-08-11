import {
  RCL_NATIVE_STATE_ROOT_ALGORITHM,
  semanticStateRoot,
  verifyNativeSemanticStateRoot,
} from './semantic-state-root.mjs';
import {
  RCL_NATIVE_STATE_ROOT_ALGORITHM_V2,
  semanticStateRootV2,
} from './semantic-state-root-v2.mjs';

export const RCL_SEMANTIC_STATE_ROOT_MIGRATION_V2_FORMAT = 'rcl.semantic-state-root-migration.v2';

export function migrateVerifiedV1ReceiptToV2(payload) {
  const verifiedV1 = verifyNativeSemanticStateRoot({
    ...payload,
    stateRootAlgorithm: payload?.stateRootAlgorithm ?? RCL_NATIVE_STATE_ROOT_ALGORITHM,
    stateRoot: payload?.stateRoot ?? semanticStateRoot(payload?.state ?? {}),
  }, { requireNativeRoot: true });
  const v2Root = semanticStateRootV2(verifiedV1.state);
  return Object.freeze({
    format: RCL_SEMANTIC_STATE_ROOT_MIGRATION_V2_FORMAT,
    fromAlgorithm: RCL_NATIVE_STATE_ROOT_ALGORITHM,
    toAlgorithm: RCL_NATIVE_STATE_ROOT_ALGORITHM_V2,
    v1Root: verifiedV1.stateRoot,
    v2Root,
    state: verifiedV1.state,
    v1Verified: verifiedV1.stateRootVerified,
    v2Verified: false,
    canonicalAdmission: false,
    boundary: 'Migration derives a separately versioned v2 root from a verified v1 receipt; it does not rewrite or reinterpret the v1 root.',
  });
}
