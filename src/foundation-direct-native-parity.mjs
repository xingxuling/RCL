import {
  FOUNDATION_DIRECT_NATIVE_PARITY_FORMAT as FOUNDATION_DIRECT_NATIVE_PARITY_GENERIC_FORMAT,
  FOUNDATION_DIRECT_NATIVE_PARITY_VERSION as FOUNDATION_DIRECT_NATIVE_PARITY_GENERIC_VERSION,
  FOUNDATION_DOMAIN_RECEIPT_ROOT_ALGORITHM,
  foundationDomainReceiptRoot,
  verifyFoundationDirectLoweringLineage,
  verifyFoundationDomainReceiptParity,
  verifyFoundationDirectNativeParity as verifyFoundationDirectNativeParityGeneric,
} from './foundation-direct-native-parity-generic.mjs';
import {
  FOUNDATION_DIRECT_NATIVE_PARITY_COMPOSITE_FORMAT,
  FOUNDATION_DIRECT_NATIVE_PARITY_COMPOSITE_VERSION,
  FOUNDATION_COMPOSITE_RECEIPT_ROOT_ALGORITHM,
  verifyFoundationDirectNativeParityComposite,
} from './foundation-direct-native-parity-composite.mjs';

export const FOUNDATION_DIRECT_NATIVE_PARITY_FORMAT = 'taowind.rcl-foundation-direct-native-parity.v0.9';
export const FOUNDATION_DIRECT_NATIVE_PARITY_VERSION = '0.9.0';

export {
  FOUNDATION_DIRECT_NATIVE_PARITY_GENERIC_FORMAT,
  FOUNDATION_DIRECT_NATIVE_PARITY_GENERIC_VERSION,
  FOUNDATION_DOMAIN_RECEIPT_ROOT_ALGORITHM,
  FOUNDATION_DIRECT_NATIVE_PARITY_COMPOSITE_FORMAT,
  FOUNDATION_DIRECT_NATIVE_PARITY_COMPOSITE_VERSION,
  FOUNDATION_COMPOSITE_RECEIPT_ROOT_ALGORITHM,
  foundationDomainReceiptRoot,
  verifyFoundationDirectLoweringLineage,
  verifyFoundationDomainReceiptParity,
  verifyFoundationDirectNativeParityGeneric,
  verifyFoundationDirectNativeParityComposite,
};

function hasLivingLowering(lowering) {
  return Array.isArray(lowering?.lowered) && lowering.lowered.some(item => item?.domain === 'living');
}

export async function verifyFoundationDirectNativeParity(sourceOrProgram, options = {}) {
  const { verifyFoundationDirectNativeParityAttested } = await import('./foundation-direct-native-parity-attested.mjs');
  const result = await verifyFoundationDirectNativeParityAttested(sourceOrProgram, options);
  const hasLiving = hasLivingLowering(result?.lowering);
  const genericReceipt = result?.domainReceipt?.generic ?? null;
  const genericLineage = result?.lineage?.generic ?? null;
  const normalized = {
    ...result,
    format: FOUNDATION_DIRECT_NATIVE_PARITY_FORMAT,
    version: FOUNDATION_DIRECT_NATIVE_PARITY_VERSION,
    truthBoundary: {
      ...(result?.truthBoundary ?? {}),
      legacyFoundationDirectNativeParityEntryPointReplaced: true,
      genericVerifierStillAvailableExplicitly: true,
      defaultEntryPointUsesCompositeParity: true,
      defaultEntryPointRequiresNativeExecutionAttestation: true,
      defaultFoundationParityEntryPointPromotedToAttested: true,
      nonLivingCompatibilityProjection: !hasLiving,
    },
  };
  if (!hasLiving) {
    normalized.lineage = genericLineage ?? result?.lineage ?? null;
    normalized.domainReceipt = genericReceipt ?? result?.domainReceipt ?? null;
    normalized.roots = {
      ...(result?.roots ?? {}),
      foundationDomainReceiptRoot: genericReceipt?.receiptRoot ?? result?.roots?.genericDomainReceiptRoot ?? null,
      foundationDomainReceiptRootAlgorithm: genericReceipt?.rootAlgorithm ?? null,
    };
  }
  return normalized;
}
