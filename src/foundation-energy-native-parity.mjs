import { createHash } from 'node:crypto';
import { compileReality } from './compiler.mjs';
import { tryCompileFoundationRealityToBytecode } from './foundation-direct-bytecode.mjs';
import { runReality } from './runtime.mjs';
import { runNativeBytecode } from './native-vm.mjs';
import { semanticStateRoot, semanticValue } from './semantic-state-root.mjs';

export const FOUNDATION_ENERGY_NATIVE_PARITY_FORMAT = 'taowind.rcl-foundation-energy-native-parity.v0.1';
export const FOUNDATION_ENERGY_NATIVE_PARITY_VERSION = '0.1.0';
export const FOUNDATION_ENERGY_RECEIPT_ROOT_ALGORITHM = 'rcl.foundation-energy-receipt-root.sha256.v0.1';

function array(value) { return Array.isArray(value) ? value : []; }
function uniqueSorted(values) { return [...new Set(values.filter(Boolean))].sort(); }
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  }
  return value;
}
function same(left, right) { return JSON.stringify(canonical(left)) === JSON.stringify(canonical(right)); }
function normalize(value, semantic) { return canonical(semantic ? semantic(value) : value); }
function normalizeChanges(changes, semantic) {
  return array(changes)
    .filter(change => change?.target)
    .map(change => ({
      target: change.target,
      before: normalize(change.before, semantic),
      after: normalize(change.after, semantic),
    }))
    .sort((left, right) => left.target.localeCompare(right.target));
}
function sha256Canonical(value) {
  return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}
function truthBoundary() {
  return {
    boundedEnergySubsetOnly: true,
    stateIndependentAmountsRequired: true,
    literalEfficiencyRequired: true,
    disjointReservoirTopologyRequired: true,
    oneEnergizeDirectiveMapsToOneAtomicNativeTransaction: true,
    referenceReceiptAndNativeReceiptMustMatchExactly: true,
    canonicalRealCExecutionRequiredForVerifiedStatus: true,
    providerBridgeRemovedGlobally: false,
    allEnergyProgramsNativeClaimed: false,
    fullHistoryParityClaimed: false,
  };
}

export function energyReceiptRoot(report) {
  if (!report || typeof report !== 'object' || Array.isArray(report)) {
    throw new TypeError('Energy receipt parity report object is required');
  }
  return sha256Canonical({
    algorithm: FOUNDATION_ENERGY_RECEIPT_ROOT_ALGORITHM,
    required: report.required === true,
    ok: report.ok === true,
    declaredLoweredCount: Number(report.declaredLoweredCount ?? 0),
    referenceReceiptCount: Number(report.referenceReceiptCount ?? 0),
    nativeReceiptCount: Number(report.nativeReceiptCount ?? 0),
    referenceCoverageExact: report.referenceCoverageExact === true,
    nativeCoverageExact: report.nativeCoverageExact === true,
    entries: array(report.entries).map(entry => ({
      index: entry?.index ?? null,
      declaration: entry?.declaration ?? null,
      directiveIndex: entry?.directiveIndex ?? null,
      syntheticRule: entry?.syntheticRule ?? null,
      authorityClass: entry?.authorityClass ?? null,
      expectedTargets: array(entry?.expectedTargets),
      referenceTargets: array(entry?.referenceTargets),
      nativeTargets: array(entry?.nativeTargets),
      referenceChanges: array(entry?.referenceChanges),
      nativeChanges: array(entry?.nativeChanges),
      referenceWitnesses: array(entry?.referenceWitnesses),
      nativeWitnesses: array(entry?.nativeWitnesses),
      referenceBeforeRoot: entry?.referenceBeforeRoot ?? null,
      referenceAfterRoot: entry?.referenceAfterRoot ?? null,
      nativeBeforeRoot: entry?.nativeBeforeRoot ?? null,
      nativeAfterRoot: entry?.nativeAfterRoot ?? null,
      checks: canonical(entry?.checks ?? {}),
      ok: entry?.ok === true,
    })),
  });
}

export function verifyFoundationEnergyReceiptParity(lowering, referenceHistory, nativeHistory, semantic = semanticValue) {
  const lowered = array(lowering?.lowered);
  const references = array(referenceHistory);
  const natives = array(nativeHistory);
  const usedReferences = new Set();
  const usedNative = new Set();

  const entries = lowered.map((item, index) => {
    const referenceIndex = references.findIndex((record, candidateIndex) => (
      !usedReferences.has(candidateIndex)
      && record?.kind === 'DomainTransition'
      && record?.domainKind === 'energy'
      && record?.name === item?.declaration
    ));
    if (referenceIndex >= 0) usedReferences.add(referenceIndex);
    const reference = referenceIndex >= 0 ? references[referenceIndex] : null;

    const nativeIndexes = natives
      .map((record, candidateIndex) => ({ record, candidateIndex }))
      .filter(({ record, candidateIndex }) => (
        !usedNative.has(candidateIndex) && record?.rule === item?.syntheticRule
      ));
    const nativeMatch = nativeIndexes.length === 1 ? nativeIndexes[0] : null;
    if (nativeMatch) usedNative.add(nativeMatch.candidateIndex);
    const native = nativeMatch?.record ?? null;

    const expectedTargets = uniqueSorted(array(item?.stateTargets));
    const referenceChanges = normalizeChanges(reference?.changes, semantic);
    const nativeChanges = normalizeChanges(native?.changes, semantic);
    const referenceTargets = referenceChanges.map(change => change.target);
    const nativeTargets = nativeChanges.map(change => change.target);
    const referenceWitnesses = array(reference?.witnesses);
    const nativeWitnesses = array(native?.witnesses);

    const checks = {
      metadataShapeSupported:
        item?.domain === 'energy'
        && item?.directive === 'Energize'
        && item?.authorityClass === 'energy-budget-flow'
        && typeof item?.declaration === 'string'
        && Number.isInteger(Number(item?.directiveIndex))
        && typeof item?.syntheticRule === 'string'
        && typeof item?.witness === 'string'
        && Number(item?.flowCount ?? 0) > 0
        && expectedTargets.length > 0,
      exactReferenceReceipt: Boolean(reference),
      referenceAuthorityAligned:
        reference?.status === 'realized'
        && reference?.authorityClass === 'energy-budget-flow',
      exactNativeReceipt: Boolean(native) && nativeIndexes.length === 1,
      nativeStatusRealized: native?.status === 'realized',
      referenceTargetsExact: same(referenceTargets, expectedTargets),
      nativeTargetsExact: same(nativeTargets, expectedTargets),
      transitionValuesEquivalent: same(referenceChanges, nativeChanges),
      syntheticWitnessPresent: nativeWitnesses.includes(item?.witness),
      referenceWitnessesPreserved: referenceWitnesses.every(witness => nativeWitnesses.includes(witness)),
      boundaryRootsEquivalent:
        typeof reference?.beforeRoot === 'string'
        && reference.beforeRoot === native?.beforeRoot
        && typeof reference?.afterRoot === 'string'
        && reference.afterRoot === native?.afterRoot,
    };

    return {
      index,
      declaration: item?.declaration ?? null,
      directiveIndex: item?.directiveIndex ?? null,
      syntheticRule: item?.syntheticRule ?? null,
      authorityClass: item?.authorityClass ?? null,
      expectedTargets,
      referenceTargets,
      nativeTargets,
      referenceChanges,
      nativeChanges,
      referenceWitnesses,
      nativeWitnesses,
      referenceBeforeRoot: reference?.beforeRoot ?? null,
      referenceAfterRoot: reference?.afterRoot ?? null,
      nativeBeforeRoot: native?.beforeRoot ?? null,
      nativeAfterRoot: native?.afterRoot ?? null,
      referenceIndex,
      nativeIndex: nativeMatch?.candidateIndex ?? -1,
      checks,
      ok: Object.values(checks).every(Boolean),
    };
  });

  const relevantReferenceCount = references.filter(record => (
    record?.kind === 'DomainTransition' && record?.domainKind === 'energy'
  )).length;
  const relevantNativeCount = natives.filter(record => (
    lowered.some(item => record?.rule === item?.syntheticRule)
  )).length;
  const declaredLoweredCount = Number(lowering?.summary?.loweredDirectiveCount ?? lowered.length);
  const required = declaredLoweredCount > 0;
  const referenceCoverageExact = usedReferences.size === relevantReferenceCount
    && usedReferences.size === lowered.length;
  const nativeCoverageExact = usedNative.size === relevantNativeCount
    && usedNative.size === lowered.length;
  const ok = declaredLoweredCount === lowered.length
    && referenceCoverageExact
    && nativeCoverageExact
    && (!required || (entries.length > 0 && entries.every(entry => entry.ok)));

  const report = {
    required,
    ok,
    declaredLoweredCount,
    referenceReceiptCount: relevantReferenceCount,
    nativeReceiptCount: relevantNativeCount,
    referenceCoverageExact,
    nativeCoverageExact,
    entries,
  };
  return {
    ...report,
    rootAlgorithm: FOUNDATION_ENERGY_RECEIPT_ROOT_ALGORITHM,
    receiptRoot: energyReceiptRoot(report),
    truthBoundary: truthBoundary(),
  };
}

export async function verifyFoundationEnergyNativeParity(sourceOrProgram, options = {}) {
  const compileProgram = options.compileProgram ?? compileReality;
  const compileDirectBytecode = options.compileDirectBytecode ?? tryCompileFoundationRealityToBytecode;
  const runReference = options.runReference ?? runReality;
  const runNative = options.runNative ?? runNativeBytecode;
  const semanticRoot = options.semanticStateRoot ?? semanticStateRoot;
  const semantic = options.semanticValue ?? semanticValue;

  const program = typeof sourceOrProgram === 'string' ? compileProgram(sourceOrProgram) : sourceOrProgram;
  if (!program || typeof program !== 'object' || Array.isArray(program)) {
    throw new TypeError('compiled RCL program object or source text is required');
  }

  const compiled = await compileDirectBytecode(program, options.directLowering ?? {});
  const lowering = compiled?.foundationEnergyDirectLowering ?? null;
  if (!compiled?.ok || !compiled?.bytecode || !lowering || Number(lowering?.summary?.loweredDirectiveCount ?? 0) < 1) {
    return {
      format: FOUNDATION_ENERGY_NATIVE_PARITY_FORMAT,
      version: FOUNDATION_ENERGY_NATIVE_PARITY_VERSION,
      status: 'compile-blocked',
      verified: false,
      diagnostics: compiled?.diagnostics ?? [],
      lowering,
      receiptParity: null,
      parity: null,
      gaps: ['energy-direct-bytecode-not-available'],
      truthBoundary: truthBoundary(),
    };
  }

  const reference = await runReference(program, options.referenceRuntime ?? {});
  let native;
  try {
    native = await runNative(compiled.bytecode, {
      requireNativeStateRoot: true,
      ...(options.nativeRuntime ?? {}),
    });
  } catch (error) {
    return {
      format: FOUNDATION_ENERGY_NATIVE_PARITY_FORMAT,
      version: FOUNDATION_ENERGY_NATIVE_PARITY_VERSION,
      status: error?.code === 'RCL_NATIVE_VM_MISSING' ? 'native-blocked' : 'native-failed',
      verified: false,
      diagnostics: [{ code: error?.code ?? 'RCL_FOUNDATION_ENERGY_NATIVE_EXECUTION_FAILED', message: error?.message ?? String(error) }],
      lowering,
      receiptParity: null,
      parity: null,
      gaps: [error?.code === 'RCL_NATIVE_VM_MISSING' ? 'native-vm-missing' : 'native-execution-failed'],
      truthBoundary: truthBoundary(),
    };
  }

  const referenceState = normalize(reference?.state ?? {}, semantic);
  const nativeState = normalize(native?.state ?? {}, semantic);
  const referenceRoot = semanticRoot(reference?.state ?? {});
  const nativeRoot = native?.semanticStateRoot ?? semanticRoot(native?.state ?? {});
  const receiptParity = verifyFoundationEnergyReceiptParity(
    lowering,
    reference?.history,
    native?.history,
    semantic,
  );
  const executionAttestation = native?.nativeVmExecutionAttestation ?? null;
  const expectedBinarySha256 = options.expectedBinarySha256 ?? null;
  const executionBinarySha256 = executionAttestation?.materialization?.binarySha256 ?? null;
  const executionAttestationBound = Boolean(
    executionAttestation?.attestationRoot
    && (!expectedBinarySha256 || executionBinarySha256 === expectedBinarySha256)
  );

  const parity = {
    state: same(nativeState, referenceState),
    semanticStateRoot: nativeRoot === referenceRoot,
    nativeStateRootVerified: native?.stateRootVerified === true,
    nativeStateRootParity: native?.stateRootParity === true,
    energyReceipt: receiptParity.ok === true,
    nativeExecutionAttestation: executionAttestationBound,
  };
  const verified = Object.values(parity).every(Boolean);
  return {
    format: FOUNDATION_ENERGY_NATIVE_PARITY_FORMAT,
    version: FOUNDATION_ENERGY_NATIVE_PARITY_VERSION,
    status: verified ? 'native-verified' : 'parity-failed',
    verified,
    diagnostics: [],
    lowering,
    receiptParity,
    parity,
    roots: {
      referenceSemanticStateRoot: referenceRoot,
      nativeSemanticStateRoot: nativeRoot,
      energyReceiptRoot: receiptParity.receiptRoot,
      energyReceiptRootAlgorithm: receiptParity.rootAlgorithm,
      nativeVmExecutionAttestationRoot: executionAttestation?.attestationRoot ?? null,
    },
    nativeExecutionAttestation: executionAttestation,
    executionBinarySha256,
    finalState: native?.state ?? {},
    gaps: Object.entries(parity).filter(([, value]) => value !== true).map(([key]) => key),
    truthBoundary: truthBoundary(),
  };
}
