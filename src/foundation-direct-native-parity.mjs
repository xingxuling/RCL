export const FOUNDATION_DIRECT_NATIVE_PARITY_FORMAT = 'taowind.rcl-foundation-direct-native-parity.v0.2';
export const FOUNDATION_DIRECT_NATIVE_PARITY_VERSION = '0.2.0';

function codeOf(error) {
  return error?.code ?? error?.payload?.code ?? 'RCL_FOUNDATION_DIRECT_NATIVE_EXECUTION_FAILED';
}

function messageOf(error) {
  return error?.message ?? error?.payload?.message ?? String(error);
}

function truthBoundary() {
  return {
    stateParityClaimedOnlyWhenVerified: true,
    semanticStateRootParityClaimedOnlyWhenVerified: true,
    nativeStateRootAuthorityRequired: true,
    loweringLineageClaimedOnlyWhenVerified: true,
    historyParityClaimed: false,
    domainReceiptParityClaimed: false,
    allFoundationDomainsNativeClaimed: false,
    providerBridgeRemovedGlobally: false,
  };
}

async function resolveDefaults(options) {
  const resolved = { ...options };
  if (!resolved.compileProgram) {
    const { compileReality } = await import('./compiler.mjs');
    resolved.compileProgram = compileReality;
  }
  if (!resolved.compileDirectBytecode) {
    const { tryCompileFoundationRealityToBytecode } = await import('./foundation-direct-bytecode.mjs');
    resolved.compileDirectBytecode = tryCompileFoundationRealityToBytecode;
  }
  if (!resolved.runReference) {
    const { runReality } = await import('./runtime.mjs');
    resolved.runReference = runReality;
  }
  if (!resolved.runNative) {
    const { runNativeBytecode } = await import('./native-vm.mjs');
    resolved.runNative = runNativeBytecode;
  }
  if (!resolved.semanticStateRoot || !resolved.semanticValue) {
    const semantic = await import('./semantic-state-root.mjs');
    resolved.semanticStateRoot ??= semantic.semanticStateRoot;
    resolved.semanticValue ??= semantic.semanticValue;
  }
  return resolved;
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function canonicalJson(value) {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalJson(value[key])]));
  }
  return value;
}

function normalizeState(value, semanticValue) {
  return canonicalJson(semanticValue ? semanticValue(value) : value);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function unique(values) {
  return [...new Set(values)];
}

export function verifyFoundationDirectLoweringLineage(lowering, nativeHistory) {
  const lowered = asArray(lowering?.lowered);
  const history = asArray(nativeHistory);
  const declaredLoweredCount = Number(lowering?.summary?.loweredCount ?? lowered.length);
  const metadataComplete = declaredLoweredCount === lowered.length;
  const ruleNames = lowered.map(item => item?.syntheticRule).filter(Boolean);
  const ruleIdentityUnique = ruleNames.length === unique(ruleNames).length;
  const entries = lowered.map((item, index) => {
    const syntheticRule = item?.syntheticRule ?? null;
    const witness = item?.witness ?? null;
    const stateTargets = unique(asArray(item?.stateTargets).filter(Boolean));
    const matchingRecords = syntheticRule ? history.filter(record => record?.rule === syntheticRule) : [];
    const record = matchingRecords.length === 1 ? matchingRecords[0] : null;
    const witnesses = asArray(record?.witnesses);
    const changeTargets = unique(asArray(record?.changes).map(change => change?.target).filter(Boolean));
    const checks = {
      syntheticRulePresent: Boolean(syntheticRule),
      exactNativeRecord: matchingRecords.length === 1,
      witnessPresent: Boolean(witness) && witnesses.includes(witness),
      stateTargetsCovered: stateTargets.every(target => changeTargets.includes(target)),
    };
    return {
      index,
      domain: item?.domain ?? null,
      declaration: item?.declaration ?? null,
      directive: item?.directive ?? null,
      syntheticRule,
      witness,
      stateTargets,
      nativeRecordCount: matchingRecords.length,
      nativeChangeTargets: changeTargets,
      checks,
      ok: Object.values(checks).every(Boolean),
    };
  });
  const required = declaredLoweredCount > 0;
  const ok = metadataComplete && ruleIdentityUnique && (!required || (entries.length > 0 && entries.every(item => item.ok)));
  return {
    required,
    ok,
    declaredLoweredCount,
    observedLoweringEntries: lowered.length,
    metadataComplete,
    ruleIdentityUnique,
    entries,
  };
}

export async function verifyFoundationDirectNativeParity(sourceOrProgram, options = {}) {
  const deps = await resolveDefaults(options);
  const program = typeof sourceOrProgram === 'string'
    ? deps.compileProgram(sourceOrProgram)
    : sourceOrProgram;

  if (!program || typeof program !== 'object' || Array.isArray(program)) {
    throw new TypeError('compiled RCL program object or source text is required');
  }

  const compiled = await deps.compileDirectBytecode(program, options.directLowering ?? {});
  if (!compiled?.ok || !compiled.bytecode) {
    return {
      format: FOUNDATION_DIRECT_NATIVE_PARITY_FORMAT,
      version: FOUNDATION_DIRECT_NATIVE_PARITY_VERSION,
      status: 'compile-blocked',
      verified: false,
      diagnostics: compiled?.diagnostics ?? [],
      lowering: compiled?.foundationDirectLowering ?? null,
      lineage: null,
      parity: null,
      gaps: ['direct-bytecode-not-available'],
      truthBoundary: truthBoundary(),
    };
  }

  const reference = await deps.runReference(program, options.referenceRuntime ?? {});
  let native;
  try {
    native = await deps.runNative(compiled.bytecode, {
      requireNativeStateRoot: true,
      ...(options.nativeRuntime ?? {}),
    });
  } catch (error) {
    const code = codeOf(error);
    const nativeMissing = code === 'RCL_NATIVE_VM_MISSING';
    return {
      format: FOUNDATION_DIRECT_NATIVE_PARITY_FORMAT,
      version: FOUNDATION_DIRECT_NATIVE_PARITY_VERSION,
      status: nativeMissing ? 'native-blocked' : 'native-failed',
      verified: false,
      diagnostics: [{
        code,
        message: messageOf(error),
      }],
      lowering: compiled.foundationDirectLowering ?? null,
      lineage: null,
      parity: null,
      gaps: [nativeMissing ? 'native-vm-missing' : 'native-execution-failed'],
      truthBoundary: truthBoundary(),
    };
  }

  const referenceState = normalizeState(reference?.state ?? {}, deps.semanticValue);
  const nativeState = normalizeState(native?.state ?? {}, deps.semanticValue);
  const referenceRoot = deps.semanticStateRoot(reference?.state ?? {});
  const nativeRoot = native?.semanticStateRoot ?? deps.semanticStateRoot(native?.state ?? {});
  const lineage = verifyFoundationDirectLoweringLineage(compiled.foundationDirectLowering, native?.history);
  const parity = {
    state: sameJson(nativeState, referenceState),
    semanticStateRoot: nativeRoot === referenceRoot,
    nativeStateRootVerified: native?.stateRootVerified === true,
    nativeStateRootParity: native?.stateRootParity === true,
    loweringLineage: lineage.ok,
  };
  const verified = Object.values(parity).every(Boolean);

  return {
    format: FOUNDATION_DIRECT_NATIVE_PARITY_FORMAT,
    version: FOUNDATION_DIRECT_NATIVE_PARITY_VERSION,
    status: verified ? 'native-verified' : 'parity-failed',
    verified,
    diagnostics: [],
    lowering: compiled.foundationDirectLowering ?? null,
    lineage,
    parity,
    roots: {
      referenceSemanticStateRoot: referenceRoot,
      nativeSemanticStateRoot: nativeRoot,
      nativeStateRoot: native?.nativeStateRoot ?? null,
    },
    gaps: verified ? [] : Object.entries(parity).filter(([, ok]) => !ok).map(([name]) => name),
    truthBoundary: truthBoundary(),
  };
}
