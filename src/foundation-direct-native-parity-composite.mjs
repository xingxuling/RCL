import { createHash } from 'node:crypto';

export const FOUNDATION_DIRECT_NATIVE_PARITY_COMPOSITE_FORMAT = 'taowind.rcl-foundation-direct-native-parity-composite.v0.1';
export const FOUNDATION_DIRECT_NATIVE_PARITY_COMPOSITE_VERSION = '0.1.0';
export const FOUNDATION_COMPOSITE_RECEIPT_ROOT_ALGORITHM = 'rcl.foundation-composite-receipt-root.sha256.v0.1';

function asArray(value) { return Array.isArray(value) ? value : []; }
function canonicalJson(value) {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalJson(value[key])]));
  return value;
}
function sameJson(left, right) { return JSON.stringify(left) === JSON.stringify(right); }
function normalize(value, semanticValue) { return canonicalJson(semanticValue ? semanticValue(value) : value); }
function codeOf(error) { return error?.code ?? error?.payload?.code ?? 'RCL_FOUNDATION_DIRECT_NATIVE_EXECUTION_FAILED'; }
function messageOf(error) { return error?.message ?? error?.payload?.message ?? String(error); }
function filterLowering(lowering, predicate) {
  const lowered = asArray(lowering?.lowered).filter(predicate);
  return { ...lowering, lowered, summary:{ ...(lowering?.summary ?? {}), loweredCount:lowered.length } };
}
function compositeReceiptRoot(genericReceipt, livingReceipt) {
  const binding = canonicalJson({
    algorithm:FOUNDATION_COMPOSITE_RECEIPT_ROOT_ALGORITHM,
    generic:{ required:genericReceipt?.required===true, ok:genericReceipt?.ok===true, rootAlgorithm:genericReceipt?.rootAlgorithm??null, receiptRoot:genericReceipt?.receiptRoot??null },
    living:{ required:livingReceipt?.required===true, ok:livingReceipt?.ok===true, rootAlgorithm:livingReceipt?.rootAlgorithm??null, receiptRoot:livingReceipt?.receiptRoot??null },
  });
  return createHash('sha256').update(JSON.stringify(binding)).digest('hex');
}

async function resolveDeps(options) {
  const deps = { ...options };
  if (!deps.compileProgram) ({ compileReality:deps.compileProgram } = await import('./compiler.mjs'));
  if (!deps.compileDirectBytecode) ({ tryCompileFoundationRealityToBytecode:deps.compileDirectBytecode } = await import('./foundation-direct-bytecode.mjs'));
  if (!deps.runReference) ({ runReality:deps.runReference } = await import('./runtime.mjs'));
  if (!deps.runNative) ({ runNativeBytecode:deps.runNative } = await import('./native-vm.mjs'));
  if (!deps.semanticStateRoot || !deps.semanticValue) {
    const semantic = await import('./semantic-state-root.mjs');
    deps.semanticStateRoot ??= semantic.semanticStateRoot;
    deps.semanticValue ??= semantic.semanticValue;
  }
  if (!deps.verifyLineage || !deps.verifyGenericReceipt) {
    const generic = await import('./foundation-direct-native-parity.mjs');
    deps.verifyLineage ??= generic.verifyFoundationDirectLoweringLineage;
    deps.verifyGenericReceipt ??= generic.verifyFoundationDomainReceiptParity;
  }
  if (!deps.verifyLivingReceipt) {
    const living = await import('./foundation-living-staged-receipt.mjs');
    deps.verifyLivingReceipt = living.verifyLivingStagedReceiptParity;
  }
  return deps;
}

export async function verifyFoundationDirectNativeParityComposite(sourceOrProgram, options = {}) {
  const deps = await resolveDeps(options);
  const program = typeof sourceOrProgram === 'string' ? deps.compileProgram(sourceOrProgram) : sourceOrProgram;
  if (!program || typeof program !== 'object' || Array.isArray(program)) throw new TypeError('compiled RCL program object or source text is required');

  const compiled = await deps.compileDirectBytecode(program, options.directLowering ?? {});
  if (!compiled?.ok || !compiled.bytecode) {
    return {
      format:FOUNDATION_DIRECT_NATIVE_PARITY_COMPOSITE_FORMAT, version:FOUNDATION_DIRECT_NATIVE_PARITY_COMPOSITE_VERSION,
      status:'compile-blocked', verified:false, diagnostics:compiled?.diagnostics??[], lowering:compiled?.foundationDirectLowering??null,
      lineage:null, domainReceipt:null, parity:null, gaps:['direct-bytecode-not-available'], truthBoundary:truthBoundary(),
    };
  }

  const reference = await deps.runReference(program, options.referenceRuntime ?? {});
  let native;
  try {
    native = await deps.runNative(compiled.bytecode, { requireNativeStateRoot:true, ...(options.nativeRuntime ?? {}) });
  } catch (error) {
    const code = codeOf(error); const nativeMissing = code === 'RCL_NATIVE_VM_MISSING';
    return {
      format:FOUNDATION_DIRECT_NATIVE_PARITY_COMPOSITE_FORMAT, version:FOUNDATION_DIRECT_NATIVE_PARITY_COMPOSITE_VERSION,
      status:nativeMissing?'native-blocked':'native-failed', verified:false, diagnostics:[{code,message:messageOf(error)}],
      lowering:compiled.foundationDirectLowering??null, lineage:null, domainReceipt:null, parity:null,
      gaps:[nativeMissing?'native-vm-missing':'native-execution-failed'], truthBoundary:truthBoundary(),
    };
  }

  const lowering = compiled.foundationDirectLowering ?? { lowered:[], summary:{loweredCount:0} };
  const nonLivingLowering = filterLowering(lowering, item => item?.domain !== 'living');
  const referenceState = normalize(reference?.state ?? {}, deps.semanticValue);
  const nativeState = normalize(native?.state ?? {}, deps.semanticValue);
  const referenceRoot = deps.semanticStateRoot(reference?.state ?? {});
  const nativeRoot = native?.semanticStateRoot ?? deps.semanticStateRoot(native?.state ?? {});
  const lineage = deps.verifyLineage(lowering, native?.history, reference?.history);
  const genericReceipt = deps.verifyGenericReceipt(nonLivingLowering, reference?.history, native?.history, deps.semanticValue);
  const livingReceipt = deps.verifyLivingReceipt(lowering, reference?.history, native?.history, deps.semanticValue);
  const domainReceipt = {
    required:genericReceipt?.required===true || livingReceipt?.required===true,
    ok:genericReceipt?.ok===true && livingReceipt?.ok===true,
    generic:genericReceipt,
    living:livingReceipt,
    rootAlgorithm:FOUNDATION_COMPOSITE_RECEIPT_ROOT_ALGORITHM,
  };
  domainReceipt.receiptRoot = compositeReceiptRoot(genericReceipt, livingReceipt);

  const parity = {
    state:sameJson(nativeState,referenceState),
    semanticStateRoot:nativeRoot===referenceRoot,
    nativeStateRootVerified:native?.stateRootVerified===true,
    nativeStateRootParity:native?.stateRootParity===true,
    loweringLineage:lineage?.ok===true,
    domainReceipt:domainReceipt.ok,
  };
  const verified = Object.values(parity).every(Boolean);
  return {
    format:FOUNDATION_DIRECT_NATIVE_PARITY_COMPOSITE_FORMAT, version:FOUNDATION_DIRECT_NATIVE_PARITY_COMPOSITE_VERSION,
    status:verified?'native-verified':'parity-failed', verified, diagnostics:[], lowering, lineage, domainReceipt, parity,
    roots:{
      referenceSemanticStateRoot:referenceRoot,
      nativeSemanticStateRoot:nativeRoot,
      nativeStateRoot:native?.nativeStateRoot??null,
      foundationCompositeReceiptRoot:domainReceipt.receiptRoot,
      foundationCompositeReceiptRootAlgorithm:domainReceipt.rootAlgorithm,
      genericDomainReceiptRoot:genericReceipt?.receiptRoot??null,
      livingDomainReceiptRoot:livingReceipt?.receiptRoot??null,
    },
    gaps:verified?[]:Object.entries(parity).filter(([,ok])=>!ok).map(([name])=>name),
    truthBoundary:truthBoundary(),
  };
}

function truthBoundary() {
  return {
    compositeReceiptIntegratesLiving:true,
    genericReceiptRunsOnlyOnNonLivingLowering:true,
    livingReceiptRunsOnLivingLowering:true,
    legacyFoundationDirectNativeParityEntryPointReplaced:false,
    livingSenseOnlyReferenceGapRemainsFailClosed:true,
    receiptRootIsEvidenceBindingNotStandaloneProof:true,
    actualCNativeVmExecutionClaimedOnlyWhenRunNativeProvidesIt:true,
    fullHistoryParityClaimed:false,
  };
}
