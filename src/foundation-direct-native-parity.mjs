import { createHash } from 'node:crypto';

export const FOUNDATION_DIRECT_NATIVE_PARITY_FORMAT = 'taowind.rcl-foundation-direct-native-parity.v0.7';
export const FOUNDATION_DIRECT_NATIVE_PARITY_VERSION = '0.7.1';
export const FOUNDATION_DOMAIN_RECEIPT_ROOT_ALGORITHM = 'rcl.foundation-domain-receipt-root.sha256.v0.4';

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
    domainReceiptParityClaimedOnlyWhenVerified: true,
    domainReceiptRootIsEvidenceBindingNotStandaloneProof: true,
    physicalInactiveStepRequiresReferenceAndNativeAbsence: true,
    neuralInactivePathwayRequiresReferenceAndNativeAbsence: true,
    geneticStagedReceiptRequiresTwoOrderedNativeTransactions: true,
    geneticStageContinuityRootRequired: true,
    fullHistoryParityClaimed: false,
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

function sameJson(left, right) { return JSON.stringify(left) === JSON.stringify(right); }
function canonicalJson(value) {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalJson(value[key])]));
  return value;
}
function normalizeState(value, semanticValue) { return canonicalJson(semanticValue ? semanticValue(value) : value); }
function normalizeReceiptValue(value, semanticValue) { return canonicalJson(semanticValue ? semanticValue(value) : value); }
function asArray(value) { return Array.isArray(value) ? value : []; }
function unique(values) { return [...new Set(values)]; }
function sortedUnique(values) { return unique(values).sort(); }
function receiptChanges(changes, semanticValue) {
  return asArray(changes)
    .filter(change => change?.target)
    .map(change => ({ target: change.target, before: normalizeReceiptValue(change.before, semanticValue), after: normalizeReceiptValue(change.after, semanticValue) }))
    .sort((left, right) => left.target.localeCompare(right.target));
}
function strictlyIncreasing(values) {
  for (let index = 1; index < values.length; index += 1) if (values[index] <= values[index - 1]) return false;
  return true;
}

function referenceDomainKind(item) {
  if (item?.domain === 'perception') return 'perceptual';
  if (item?.domain === 'physical') return 'physical';
  if (item?.domain === 'neural') return 'neural';
  if (item?.domain === 'genetic') return 'genetic';
  return null;
}
function referenceIdentityMatches(item, record) {
  if (!record || record.kind !== 'DomainTransition') return false;
  const expectedKind = referenceDomainKind(item);
  if (!expectedKind || record.domainKind !== expectedKind || record.name !== item?.declaration) return false;
  if (item?.domain === 'physical' || item?.domain === 'neural') return Number(record.step) === Number(item?.stepIndex);
  if (item?.domain === 'genetic') return Number(record.generation) === Number(item?.generationIndex);
  return true;
}
function geneticPairKey(item) {
  return `${item?.directiveIndex ?? 'x'}|${item?.declaration ?? 'x'}|${item?.generationIndex ?? 'x'}`;
}
function pairReferenceReceipts(lowered, referenceHistory) {
  const history = asArray(referenceHistory);
  const used = new Set();
  const sharedGenetic = new Map();
  const matches = lowered.map(item => {
    let referenceIndex = -1;
    if (item?.domain === 'genetic') {
      const key = geneticPairKey(item);
      if (sharedGenetic.has(key)) referenceIndex = sharedGenetic.get(key);
      else {
        referenceIndex = history.findIndex((record, index) => !used.has(index) && referenceIdentityMatches(item, record));
        if (referenceIndex >= 0) { used.add(referenceIndex); sharedGenetic.set(key, referenceIndex); }
      }
    } else {
      referenceIndex = history.findIndex((record, index) => !used.has(index) && referenceIdentityMatches(item, record));
      if (referenceIndex >= 0) used.add(referenceIndex);
    }
    return { record: referenceIndex >= 0 ? history[referenceIndex] : null, referenceIndex };
  });
  const relevantKinds = new Set(lowered.map(referenceDomainKind).filter(Boolean));
  const relevantReferenceIndexes = history
    .map((record, index) => ({ record, index }))
    .filter(({ record }) => record?.kind === 'DomainTransition' && relevantKinds.has(record?.domainKind))
    .map(({ index }) => index);
  const consumedRelevantIndexes = [...used].filter(index => relevantReferenceIndexes.includes(index));
  const matchedReferenceIndexes = unique(matches.map(item => item.referenceIndex).filter(index => index >= 0));
  return {
    matches,
    relevantReferenceCount: relevantReferenceIndexes.length,
    consumedReferenceCount: consumedRelevantIndexes.length,
    referenceCoverageExact: consumedRelevantIndexes.length === relevantReferenceIndexes.length,
    referenceOrderPreserved: strictlyIncreasing(matchedReferenceIndexes),
  };
}

function metadataCompleteForItem(item) {
  const base = typeof item?.declaration === 'string'
    && typeof item?.syntheticRule === 'string'
    && typeof item?.witness === 'string'
    && Array.isArray(item?.stateTargets)
    && Number.isInteger(Number(item?.directiveIndex));
  if (!base) return false;
  if (item.domain === 'perception') {
    return item.directive === 'Observe'
      && Object.prototype.hasOwnProperty.call(item, 'observer')
      && Object.prototype.hasOwnProperty.call(item, 'sourceReality')
      && item.authorityClass === 'observation';
  }
  if (item.domain === 'physical') {
    const stepIndex = Number(item.stepIndex); const stepCount = Number(item.stepCount);
    return item.directive === 'Advance' && item.authorityClass === 'natural-law'
      && Object.prototype.hasOwnProperty.call(item, 'sourceReality')
      && Object.prototype.hasOwnProperty.call(item, 'dtExpression')
      && Array.isArray(item.originalWitnesses)
      && Number.isInteger(stepIndex) && stepIndex >= 1
      && Number.isInteger(stepCount) && stepCount >= stepIndex;
  }
  if (item.domain === 'neural') {
    const stepIndex = Number(item.stepIndex); const stepCount = Number(item.stepCount); const pathwayIndex = Number(item.pathwayIndex);
    return item.directive === 'Propagate' && item.authorityClass === 'intrinsic-neural-dynamics'
      && Object.prototype.hasOwnProperty.call(item, 'sourceReality')
      && Array.isArray(item.originalWitnesses) && Array.isArray(item.changeModes)
      && Number.isInteger(stepIndex) && stepIndex >= 1
      && Number.isInteger(stepCount) && stepCount >= stepIndex
      && Number.isInteger(pathwayIndex) && pathwayIndex >= 1;
  }
  if (item.domain === 'genetic') {
    const generationIndex = Number(item.generationIndex); const generationCount = Number(item.generationCount);
    const stageIndex = Number(item.stageIndex); const stageCount = Number(item.stageCount);
    return item.directive === 'Inherit' && item.authorityClass === 'lineage-transformation'
      && item.sourceReality === item.declaration
      && Array.isArray(item.originalWitnesses)
      && ['mutation', 'expression'].includes(item.stage)
      && Number.isInteger(stageIndex) && stageIndex >= 1 && stageCount === 2 && stageIndex <= stageCount
      && Number.isInteger(generationIndex) && generationIndex >= 1
      && Number.isInteger(generationCount) && generationCount >= generationIndex
      && typeof item.finalStage === 'boolean'
      && (item.stage !== 'expression' || (item.finalStage === true && Array.isArray(item.generationStateTargets)));
  }
  return false;
}

function physicalReferenceAligned(item, reference) {
  if (!reference) return false;
  return reference.domainKind === 'physical' && reference.name === item.declaration && reference.status === 'realized'
    && reference.authorityClass === 'natural-law' && Number(reference.step) === Number(item.stepIndex)
    && Object.prototype.hasOwnProperty.call(reference, 'dt') && sameJson(asArray(reference.witnesses), asArray(item.originalWitnesses));
}
function perceptionReferenceAligned(item, reference) {
  return Boolean(reference) && reference.domainKind === 'perceptual' && reference.name === item?.declaration && reference.status === 'realized'
    && reference.authorityClass === 'observation' && (reference.observer ?? null) === (item?.observer ?? null)
    && (reference.sourceReality ?? null) === (item?.sourceReality ?? null);
}
function neuralReferenceAligned(item, reference) {
  if (!reference) return false;
  return reference.domainKind === 'neural' && reference.name === item.declaration && reference.status === 'realized'
    && reference.authorityClass === 'intrinsic-neural-dynamics' && Number(reference.step) === Number(item.stepIndex)
    && sameJson(asArray(reference.witnesses), asArray(item.originalWitnesses));
}
function geneticReferenceAligned(item, reference) {
  if (!reference) return false;
  return reference.domainKind === 'genetic' && reference.name === item.declaration && reference.status === 'realized'
    && reference.authorityClass === 'lineage-transformation' && Number(reference.generation) === Number(item.generationIndex)
    && sameJson(asArray(reference.witnesses), asArray(item.originalWitnesses));
}
function geneticReferenceStageChanges(item, reference) {
  const source = item?.stage === 'mutation' ? 'genetic:mutation' : 'genetic:expression';
  return asArray(reference?.changes).filter(change => change?.source === source);
}
function geneticReferencePartitionComplete(reference) {
  return asArray(reference?.changes).every(change => ['genetic:mutation', 'genetic:expression'].includes(change?.source));
}
function nativeMatchesFor(item, nativeRecords) {
  return asArray(nativeRecords).map((record, nativeIndex) => ({ record, nativeIndex })).filter(({ record }) => record?.rule === item?.syntheticRule);
}
function siblingGeneticItem(lowered, item, stage) {
  return asArray(lowered).find(candidate => candidate?.domain === 'genetic'
    && candidate?.directiveIndex === item?.directiveIndex
    && candidate?.declaration === item?.declaration
    && Number(candidate?.generationIndex) === Number(item?.generationIndex)
    && candidate?.stage === stage) ?? null;
}

export function foundationDomainReceiptRoot(report) {
  if (!report || typeof report !== 'object' || Array.isArray(report)) throw new TypeError('Foundation domain receipt report object is required');
  const binding = {
    algorithm: FOUNDATION_DOMAIN_RECEIPT_ROOT_ALGORITHM,
    required: report.required === true,
    ok: report.ok === true,
    declaredLoweredCount: Number(report.declaredLoweredCount ?? 0),
    observedLoweringEntries: Number(report.observedLoweringEntries ?? 0),
    referenceReceiptCount: Number(report.referenceReceiptCount ?? 0),
    activeReferenceReceiptCount: Number(report.activeReferenceReceiptCount ?? 0),
    metadataComplete: report.metadataComplete === true,
    referenceCoverageExact: report.referenceCoverageExact === true,
    referenceOrderPreserved: report.referenceOrderPreserved === true,
    nativeOrderPreserved: report.nativeOrderPreserved === true,
    entries: asArray(report.entries).map(entry => ({
      index: entry?.index ?? null,
      domain: entry?.domain ?? null,
      declaration: entry?.declaration ?? null,
      directive: entry?.directive ?? null,
      directiveIndex: entry?.directiveIndex ?? null,
      syntheticRule: entry?.syntheticRule ?? null,
      authorityClass: entry?.authorityClass ?? null,
      observer: entry?.observer ?? null,
      sourceReality: entry?.sourceReality ?? null,
      stepIndex: entry?.stepIndex ?? null,
      stepCount: entry?.stepCount ?? null,
      pathwayIndex: entry?.pathwayIndex ?? null,
      generationIndex: entry?.generationIndex ?? null,
      generationCount: entry?.generationCount ?? null,
      stage: entry?.stage ?? null,
      stageIndex: entry?.stageIndex ?? null,
      stageCount: entry?.stageCount ?? null,
      finalStage: entry?.finalStage === true,
      changeModes: asArray(entry?.changeModes),
      originalWitnesses: asArray(entry?.originalWitnesses),
      referenceActive: entry?.referenceActive === true,
      nativeActive: entry?.nativeActive === true,
      referenceIndex: entry?.referenceIndex ?? null,
      referenceStep: entry?.referenceStep ?? null,
      referenceGeneration: entry?.referenceGeneration ?? null,
      referenceDt: entry?.referenceDt ?? null,
      referenceWitnesses: asArray(entry?.referenceWitnesses),
      nativeWitnesses: asArray(entry?.nativeWitnesses),
      expectedTargets: asArray(entry?.expectedTargets),
      referenceTargets: asArray(entry?.referenceTargets),
      nativeTargets: asArray(entry?.nativeTargets),
      referenceChanges: asArray(entry?.referenceChanges),
      nativeChanges: asArray(entry?.nativeChanges),
      referenceBeforeRoot: entry?.referenceBeforeRoot ?? null,
      referenceAfterRoot: entry?.referenceAfterRoot ?? null,
      nativeBeforeRoot: entry?.nativeBeforeRoot ?? null,
      nativeAfterRoot: entry?.nativeAfterRoot ?? null,
      siblingNativeBeforeRoot: entry?.siblingNativeBeforeRoot ?? null,
      siblingNativeAfterRoot: entry?.siblingNativeAfterRoot ?? null,
      nativeRecordCount: Number(entry?.nativeRecordCount ?? 0),
      checks: canonicalJson(entry?.checks ?? {}),
      ok: entry?.ok === true,
    })),
  };
  return createHash('sha256').update(JSON.stringify(canonicalJson(binding))).digest('hex');
}

export function verifyFoundationDirectLoweringLineage(lowering, nativeHistory, referenceHistory = null) {
  const lowered = asArray(lowering?.lowered); const history = asArray(nativeHistory);
  const referenceAvailable = Array.isArray(referenceHistory);
  const references = referenceAvailable ? pairReferenceReceipts(lowered, referenceHistory) : null;
  const declaredLoweredCount = Number(lowering?.summary?.loweredCount ?? lowered.length);
  const metadataComplete = declaredLoweredCount === lowered.length;
  const ruleNames = lowered.map(item => item?.syntheticRule).filter(Boolean);
  const ruleIdentityUnique = ruleNames.length === unique(ruleNames).length;
  const entries = lowered.map((item, index) => {
    const syntheticRule = item?.syntheticRule ?? null; const witness = item?.witness ?? null;
    const stateTargets = unique(asArray(item?.stateTargets).filter(Boolean));
    const matchingRecords = syntheticRule ? history.filter(record => record?.rule === syntheticRule) : [];
    const record = matchingRecords.length === 1 ? matchingRecords[0] : null;
    const witnesses = asArray(record?.witnesses);
    const changeTargets = unique(asArray(record?.changes).map(change => change?.target).filter(Boolean));
    const reference = references?.matches?.[index]?.record ?? null;
    const conditionallyInactive = ['physical', 'neural'].includes(item?.domain) && referenceAvailable && reference === null;
    const conditionalReferenceDomain = ['physical', 'neural'].includes(item?.domain);
    const geneticReferenceRequired = item?.domain === 'genetic';
    const checks = {
      syntheticRulePresent: Boolean(syntheticRule),
      referenceExecutionEvidencePresent: conditionalReferenceDomain
        ? referenceAvailable
        : geneticReferenceRequired
          ? referenceAvailable && Boolean(reference)
          : true,
      exactNativeRecord: conditionallyInactive ? matchingRecords.length === 0 : matchingRecords.length === 1,
      witnessPresent: conditionallyInactive ? true : Boolean(witness) && witnesses.includes(witness),
      stateTargetsCovered: conditionallyInactive ? true : stateTargets.every(target => changeTargets.includes(target)),
      inactiveStepAligned: !['physical', 'neural'].includes(item?.domain) || !conditionallyInactive || matchingRecords.length === 0,
    };
    return { index, domain:item?.domain??null, declaration:item?.declaration??null, directive:item?.directive??null, syntheticRule, witness, stateTargets,
      referenceActive:Boolean(reference), nativeRecordCount:matchingRecords.length, nativeChangeTargets:changeTargets, checks, ok:Object.values(checks).every(Boolean) };
  });
  const required = declaredLoweredCount > 0;
  const ok = metadataComplete && ruleIdentityUnique && (!required || (entries.length > 0 && entries.every(item => item.ok)));
  return { required, ok, declaredLoweredCount, observedLoweringEntries:lowered.length, metadataComplete, ruleIdentityUnique,
    referenceExecutionEvidenceAvailable:referenceAvailable, entries };
}

export function verifyFoundationDomainReceiptParity(lowering, referenceHistory, nativeHistory, semanticValue = value => value) {
  const lowered = asArray(lowering?.lowered);
  const referenceReceipts = pairReferenceReceipts(lowered, referenceHistory);
  const nativeRecords = asArray(nativeHistory);
  const declaredLoweredCount = Number(lowering?.summary?.loweredCount ?? lowered.length);
  const required = declaredLoweredCount > 0;
  const metadataComplete = declaredLoweredCount === lowered.length && lowered.every(metadataCompleteForItem);
  const nativeIndexes = [];

  const entries = lowered.map((item, index) => {
    const referenceMatch = referenceReceipts.matches[index] ?? { record:null, referenceIndex:-1 };
    const reference = referenceMatch.record;
    const nativeMatches = nativeMatchesFor(item, nativeRecords);
    const nativeMatch = nativeMatches.length === 1 ? nativeMatches[0] : null;
    if (nativeMatch) nativeIndexes.push(nativeMatch.nativeIndex);

    const conditionallyInactive = ['physical', 'neural'].includes(item?.domain) && reference === null;
    const expectedTargets = sortedUnique(asArray(item?.stateTargets).filter(Boolean));
    const stageReferenceChanges = item?.domain === 'genetic' ? geneticReferenceStageChanges(item, reference) : asArray(reference?.changes);
    const referenceTargets = sortedUnique(stageReferenceChanges.map(change => change?.target).filter(Boolean));
    const nativeTargets = sortedUnique(asArray(nativeMatch?.record?.changes).map(change => change?.target).filter(Boolean));
    const referenceChanges = receiptChanges(stageReferenceChanges, semanticValue);
    const nativeChanges = receiptChanges(nativeMatch?.record?.changes, semanticValue);
    const referenceWitnesses = asArray(reference?.witnesses);
    const nativeWitnesses = asArray(nativeMatch?.record?.witnesses);

    const mutationItem = item?.domain === 'genetic' ? siblingGeneticItem(lowered, item, 'mutation') : null;
    const expressionItem = item?.domain === 'genetic' ? siblingGeneticItem(lowered, item, 'expression') : null;
    const mutationMatches = mutationItem ? nativeMatchesFor(mutationItem, nativeRecords) : [];
    const expressionMatches = expressionItem ? nativeMatchesFor(expressionItem, nativeRecords) : [];
    const mutationNative = mutationMatches.length === 1 ? mutationMatches[0].record : null;
    const expressionNative = expressionMatches.length === 1 ? expressionMatches[0].record : null;
    const geneticPairExact = item?.domain !== 'genetic' || (mutationMatches.length === 1 && expressionMatches.length === 1);
    const geneticContinuity = item?.domain !== 'genetic' || (Boolean(mutationNative?.afterRoot) && mutationNative.afterRoot === expressionNative?.beforeRoot);
    const geneticBoundary = item?.domain !== 'genetic' || (item.stage === 'mutation'
      ? Boolean(reference?.beforeRoot) && nativeMatch?.record?.beforeRoot === reference.beforeRoot
      : Boolean(reference?.afterRoot) && nativeMatch?.record?.afterRoot === reference.afterRoot);
    const geneticPartition = item?.domain !== 'genetic' || geneticReferencePartitionComplete(reference);

    const checks = {
      metadataShapeSupported: metadataCompleteForItem(item),
      referenceReceiptAligned: conditionallyInactive ? true
        : item?.domain === 'physical' ? physicalReferenceAligned(item, reference)
          : item?.domain === 'neural' ? neuralReferenceAligned(item, reference)
            : item?.domain === 'genetic' ? geneticReferenceAligned(item, reference)
              : perceptionReferenceAligned(item, reference),
      exactNativeRecord: conditionallyInactive ? nativeMatches.length === 0 : nativeMatches.length === 1,
      nativeStatusRealized: conditionallyInactive ? true : nativeMatch?.record?.status === 'realized',
      referenceTargetsExact: conditionallyInactive ? true : sameJson(referenceTargets, expectedTargets),
      nativeTargetsExact: conditionallyInactive ? true : sameJson(nativeTargets, expectedTargets),
      transitionValuesEquivalent: conditionallyInactive ? true : sameJson(referenceChanges, nativeChanges),
      witnessPresent: conditionallyInactive ? true : nativeWitnesses.includes(item?.witness),
      originalWitnessesPreserved: ['physical','neural'].includes(item?.domain) && !conditionallyInactive
        ? sameJson(referenceWitnesses, asArray(item?.originalWitnesses)) && asArray(item?.originalWitnesses).every(witness => nativeWitnesses.includes(witness))
        : item?.domain === 'genetic' && item?.finalStage === true
          ? sameJson(referenceWitnesses, asArray(item?.originalWitnesses)) && asArray(item?.originalWitnesses).every(witness => nativeWitnesses.includes(witness))
          : true,
      inactiveStepAligned: !['physical','neural'].includes(item?.domain) || !conditionallyInactive || nativeMatches.length === 0,
      geneticStagePairExact: geneticPairExact,
      geneticStageContinuityRoot: geneticContinuity,
      geneticReferenceBoundaryRoot: geneticBoundary,
      geneticReferencePartitionComplete: geneticPartition,
    };
    return {
      index, domain:item?.domain??null, declaration:item?.declaration??null, directive:item?.directive??null,
      directiveIndex:item?.directiveIndex??null, syntheticRule:item?.syntheticRule??null, authorityClass:item?.authorityClass??null,
      observer:item?.observer??null, sourceReality:item?.sourceReality??null, stepIndex:item?.stepIndex??null, stepCount:item?.stepCount??null,
      pathwayIndex:item?.pathwayIndex??null, generationIndex:item?.generationIndex??null, generationCount:item?.generationCount??null,
      stage:item?.stage??null, stageIndex:item?.stageIndex??null, stageCount:item?.stageCount??null, finalStage:item?.finalStage===true,
      changeModes:asArray(item?.changeModes), originalWitnesses:asArray(item?.originalWitnesses),
      referenceActive:Boolean(reference), nativeActive:Boolean(nativeMatch), referenceIndex:referenceMatch.referenceIndex,
      referenceStep:reference?.step??null, referenceGeneration:reference?.generation??null,
      referenceDt:Object.prototype.hasOwnProperty.call(reference??{},'dt') ? normalizeReceiptValue(reference.dt,semanticValue) : null,
      referenceWitnesses, nativeWitnesses, expectedTargets, referenceTargets, nativeTargets, referenceChanges, nativeChanges,
      referenceBeforeRoot:reference?.beforeRoot??null, referenceAfterRoot:reference?.afterRoot??null,
      nativeBeforeRoot:nativeMatch?.record?.beforeRoot??null, nativeAfterRoot:nativeMatch?.record?.afterRoot??null,
      siblingNativeBeforeRoot:item?.domain==='genetic' ? expressionNative?.beforeRoot??null : null,
      siblingNativeAfterRoot:item?.domain==='genetic' ? mutationNative?.afterRoot??null : null,
      nativeRecordCount:nativeMatches.length, checks, ok:Object.values(checks).every(Boolean),
    };
  });

  const nativeOrderPreserved = strictlyIncreasing(nativeIndexes);
  const activeReferenceReceiptCount = new Set(entries.filter(item => item.referenceActive && item.referenceIndex >= 0).map(item => item.referenceIndex)).size;
  const ok = metadataComplete && referenceReceipts.referenceCoverageExact && referenceReceipts.referenceOrderPreserved && nativeOrderPreserved
    && (!required || (entries.length > 0 && entries.every(item => item.ok)));
  const report = {
    required, ok, declaredLoweredCount, observedLoweringEntries:lowered.length,
    referenceReceiptCount:referenceReceipts.relevantReferenceCount, activeReferenceReceiptCount,
    metadataComplete, referenceCoverageExact:referenceReceipts.referenceCoverageExact,
    referenceOrderPreserved:referenceReceipts.referenceOrderPreserved, nativeOrderPreserved, entries,
  };
  return { ...report, rootAlgorithm:FOUNDATION_DOMAIN_RECEIPT_ROOT_ALGORITHM, receiptRoot:foundationDomainReceiptRoot(report) };
}

export async function verifyFoundationDirectNativeParity(sourceOrProgram, options = {}) {
  const deps = await resolveDefaults(options);
  const program = typeof sourceOrProgram === 'string' ? deps.compileProgram(sourceOrProgram) : sourceOrProgram;
  if (!program || typeof program !== 'object' || Array.isArray(program)) throw new TypeError('compiled RCL program object or source text is required');

  const compiled = await deps.compileDirectBytecode(program, options.directLowering ?? {});
  if (!compiled?.ok || !compiled.bytecode) {
    return { format:FOUNDATION_DIRECT_NATIVE_PARITY_FORMAT, version:FOUNDATION_DIRECT_NATIVE_PARITY_VERSION, status:'compile-blocked', verified:false,
      diagnostics:compiled?.diagnostics??[], lowering:compiled?.foundationDirectLowering??null, lineage:null, domainReceipt:null, parity:null,
      gaps:['direct-bytecode-not-available'], truthBoundary:truthBoundary() };
  }

  const reference = await deps.runReference(program, options.referenceRuntime ?? {});
  let native;
  try {
    native = await deps.runNative(compiled.bytecode, { requireNativeStateRoot:true, ...(options.nativeRuntime ?? {}) });
  } catch (error) {
    const code = codeOf(error); const nativeMissing = code === 'RCL_NATIVE_VM_MISSING';
    return { format:FOUNDATION_DIRECT_NATIVE_PARITY_FORMAT, version:FOUNDATION_DIRECT_NATIVE_PARITY_VERSION,
      status:nativeMissing?'native-blocked':'native-failed', verified:false, diagnostics:[{code,message:messageOf(error)}],
      lowering:compiled.foundationDirectLowering??null, lineage:null, domainReceipt:null, parity:null,
      gaps:[nativeMissing?'native-vm-missing':'native-execution-failed'], truthBoundary:truthBoundary() };
  }

  const referenceState = normalizeState(reference?.state ?? {}, deps.semanticValue);
  const nativeState = normalizeState(native?.state ?? {}, deps.semanticValue);
  const referenceRoot = deps.semanticStateRoot(reference?.state ?? {});
  const nativeRoot = native?.semanticStateRoot ?? deps.semanticStateRoot(native?.state ?? {});
  const lineage = verifyFoundationDirectLoweringLineage(compiled.foundationDirectLowering, native?.history, reference?.history);
  const domainReceipt = verifyFoundationDomainReceiptParity(compiled.foundationDirectLowering, reference?.history, native?.history, deps.semanticValue);
  const parity = {
    state:sameJson(nativeState,referenceState), semanticStateRoot:nativeRoot===referenceRoot,
    nativeStateRootVerified:native?.stateRootVerified===true, nativeStateRootParity:native?.stateRootParity===true,
    loweringLineage:lineage.ok, domainReceipt:domainReceipt.ok,
  };
  const verified = Object.values(parity).every(Boolean);
  return {
    format:FOUNDATION_DIRECT_NATIVE_PARITY_FORMAT, version:FOUNDATION_DIRECT_NATIVE_PARITY_VERSION,
    status:verified?'native-verified':'parity-failed', verified, diagnostics:[], lowering:compiled.foundationDirectLowering??null,
    lineage, domainReceipt, parity,
    roots:{ referenceSemanticStateRoot:referenceRoot, nativeSemanticStateRoot:nativeRoot, nativeStateRoot:native?.nativeStateRoot??null,
      foundationDomainReceiptRoot:domainReceipt.receiptRoot, foundationDomainReceiptRootAlgorithm:domainReceipt.rootAlgorithm },
    gaps:verified?[]:Object.entries(parity).filter(([,ok])=>!ok).map(([name])=>name), truthBoundary:truthBoundary(),
  };
}
