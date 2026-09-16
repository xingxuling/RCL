import { createHash } from 'node:crypto';

export const FOUNDATION_LIVING_STAGED_RECEIPT_FORMAT = 'taowind.rcl-foundation-living-staged-receipt.v0.1';
export const FOUNDATION_LIVING_STAGED_RECEIPT_VERSION = '0.1.0';
export const FOUNDATION_LIVING_STAGED_RECEIPT_ROOT_ALGORITHM = 'rcl.foundation-living-staged-receipt-root.sha256.v0.1';

function asArray(value) { return Array.isArray(value) ? value : []; }
function unique(values) { return [...new Set(values)]; }
function sortedUnique(values) { return unique(values).sort(); }
function sameJson(left, right) { return JSON.stringify(left) === JSON.stringify(right); }
function canonicalJson(value) {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalJson(value[key])]));
  return value;
}
function normalize(value, semanticValue) { return canonicalJson(semanticValue ? semanticValue(value) : value); }
function receiptChanges(changes, semanticValue) {
  return asArray(changes)
    .filter(change => change?.target)
    .map(change => ({ target: change.target, before: normalize(change.before, semanticValue), after: normalize(change.after, semanticValue) }))
    .sort((a, b) => a.target.localeCompare(b.target));
}
function strictlyIncreasing(values) {
  for (let index = 1; index < values.length; index += 1) if (values[index] <= values[index - 1]) return false;
  return true;
}
function livingItems(lowering) { return asArray(lowering?.lowered).filter(item => item?.domain === 'living'); }
function stepKey(item) { return `${item?.directiveIndex ?? 'x'}|${item?.declaration ?? 'x'}|${item?.stepIndex ?? 'x'}`; }
function nativeMatchesFor(item, history) {
  return asArray(history).map((record, nativeIndex) => ({ record, nativeIndex })).filter(({ record }) => record?.rule === item?.syntheticRule);
}
function referenceCycleMatches(item, history) {
  if (item?.stage !== 'cycle') return [];
  return asArray(history).map((record, referenceIndex) => ({ record, referenceIndex })).filter(({ record }) =>
    record?.kind === 'DomainTransition'
    && record?.domainKind === 'living'
    && record?.name === item?.cycleName
    && Number(record?.step) === Number(item?.stepIndex)
    && record?.authorityClass === 'intrinsic-life-cycle');
}
function metadataComplete(item) {
  const stepIndex = Number(item?.stepIndex); const stepCount = Number(item?.stepCount);
  const stageIndex = Number(item?.stageIndex); const stageCount = Number(item?.stageCount);
  if (item?.domain !== 'living' || item?.directive !== 'Live' || item?.authorityClass !== 'intrinsic-life-cycle') return false;
  if (typeof item?.declaration !== 'string' || item?.sourceReality !== item.declaration) return false;
  if (typeof item?.syntheticRule !== 'string' || typeof item?.witness !== 'string' || !Array.isArray(item?.stateTargets)) return false;
  if (!Number.isInteger(Number(item?.directiveIndex))) return false;
  if (!Number.isInteger(stepIndex) || stepIndex < 1 || !Number.isInteger(stepCount) || stepCount < stepIndex) return false;
  if (!Number.isInteger(stageIndex) || stageIndex < 1 || !Number.isInteger(stageCount) || stageCount < stageIndex) return false;
  if (!Array.isArray(item?.changeModes) || !Array.isArray(item?.livingNeeds)) return false;
  if (item.stage === 'sense') return item.cycleIndex == null && item.cycleName == null && asArray(item.originalWitnesses).length === 0;
  if (item.stage === 'cycle') return Number.isInteger(Number(item.cycleIndex)) && Number(item.cycleIndex) >= 1
    && typeof item.cycleName === 'string' && Array.isArray(item.originalWitnesses);
  return false;
}
function groupSteps(items) {
  const groups = new Map();
  for (const item of items) {
    const key = stepKey(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return [...groups.entries()].map(([key, entries]) => ({ key, entries:[...entries].sort((a,b)=>Number(a.stageIndex)-Number(b.stageIndex)) }));
}
function stepShape(entries) {
  if (entries.length === 0) return { ok:true, stageCount:0, senseCount:0, cycleCount:0 };
  const stageCounts = unique(entries.map(item => Number(item.stageCount)));
  const expectedStageCount = entries[0]?.stageCount == null ? null : Number(entries[0].stageCount);
  const indexes = entries.map(item => Number(item.stageIndex));
  const expectedIndexes = entries.map((_, index) => index + 1);
  const senseEntries = entries.filter(item => item.stage === 'sense');
  const cycleEntries = entries.filter(item => item.stage === 'cycle');
  const cycleIndexes = cycleEntries.map(item => Number(item.cycleIndex));
  const cycleIndexOrder = [...cycleIndexes].sort((a,b)=>a-b);
  const checks = {
    oneStageCount: stageCounts.length === 1,
    declaredStageCountExact: expectedStageCount === entries.length,
    stageIndexesContiguous: sameJson(indexes, expectedIndexes),
    senseAtMostOnceAndFirst: senseEntries.length <= 1 && (senseEntries.length === 0 || Number(senseEntries[0].stageIndex) === 1),
    cycleIndexesStrictlyIncreasing: strictlyIncreasing(cycleIndexes),
    cycleIndexesOrdered: sameJson(cycleIndexes, cycleIndexOrder),
  };
  return { ok:Object.values(checks).every(Boolean), stageCount:entries.length, senseCount:senseEntries.length, cycleCount:cycleEntries.length, checks };
}
function relevantReferenceIndexes(items, history) {
  const cycleKeys = new Set(items.filter(item=>item.stage==='cycle').map(item=>`${item.cycleName}|${Number(item.stepIndex)}`));
  return asArray(history).map((record,index)=>({record,index})).filter(({record})=>
    record?.kind === 'DomainTransition'
    && record?.domainKind === 'living'
    && record?.authorityClass === 'intrinsic-life-cycle'
    && cycleKeys.has(`${record?.name}|${Number(record?.step)}`)).map(({index})=>index);
}
function livingSenseChanges(referenceRecords, semanticValue) {
  const partitions = referenceRecords.map(record => receiptChanges(asArray(record?.changes).filter(change => change?.source === 'living:sense'), semanticValue));
  if (partitions.length === 0) return { available:false, consistent:false, changes:[] };
  const first = partitions[0];
  return { available:true, consistent:partitions.every(partition => sameJson(partition, first)), changes:first };
}

export function livingStagedReceiptRoot(report) {
  if (!report || typeof report !== 'object' || Array.isArray(report)) throw new TypeError('Living staged receipt report object is required');
  const binding = {
    algorithm: FOUNDATION_LIVING_STAGED_RECEIPT_ROOT_ALGORITHM,
    required: report.required === true,
    ok: report.ok === true,
    declaredLivingLoweredCount: Number(report.declaredLivingLoweredCount ?? 0),
    observedLivingLoweringEntries: Number(report.observedLivingLoweringEntries ?? 0),
    metadataComplete: report.metadataComplete === true,
    stepShapeComplete: report.stepShapeComplete === true,
    referenceCoverageExact: report.referenceCoverageExact === true,
    nativeOrderPreserved: report.nativeOrderPreserved === true,
    stepContinuityPreserved: report.stepContinuityPreserved === true,
    entries: asArray(report.entries).map(entry => ({
      index:entry.index??null, declaration:entry.declaration??null, directiveIndex:entry.directiveIndex??null,
      stepIndex:entry.stepIndex??null, stepCount:entry.stepCount??null, stage:entry.stage??null,
      stageIndex:entry.stageIndex??null, stageCount:entry.stageCount??null, cycleIndex:entry.cycleIndex??null,
      cycleName:entry.cycleName??null, syntheticRule:entry.syntheticRule??null, witness:entry.witness??null,
      stateTargets:asArray(entry.stateTargets), originalWitnesses:asArray(entry.originalWitnesses), changeModes:asArray(entry.changeModes),
      referenceActive:entry.referenceActive===true, nativeActive:entry.nativeActive===true,
      referenceIndex:entry.referenceIndex??null, nativeIndex:entry.nativeIndex??null,
      referenceChanges:asArray(entry.referenceChanges), nativeChanges:asArray(entry.nativeChanges),
      referenceBeforeRoot:entry.referenceBeforeRoot??null, referenceAfterRoot:entry.referenceAfterRoot??null,
      nativeBeforeRoot:entry.nativeBeforeRoot??null, nativeAfterRoot:entry.nativeAfterRoot??null,
      checks:canonicalJson(entry.checks??{}), ok:entry.ok===true,
    })),
    steps: asArray(report.steps).map(step => ({ key:step.key, checks:canonicalJson(step.checks??{}), ok:step.ok===true })),
  };
  return createHash('sha256').update(JSON.stringify(canonicalJson(binding))).digest('hex');
}

export function verifyLivingStagedReceiptParity(lowering, referenceHistory, nativeHistory, semanticValue = value => value) {
  const items = livingItems(lowering);
  const declaredLoweredCount = Number(lowering?.summary?.livingLoweredStageCount ?? items.length);
  const required = declaredLoweredCount > 0 || items.length > 0;
  const metadataCompleteFlag = declaredLoweredCount === items.length && items.every(metadataComplete);
  const groups = groupSteps(items);
  const steps = groups.map(group => ({ key:group.key, ...stepShape(group.entries) }));
  const stepShapeComplete = steps.every(step => step.ok);
  const nativeIndexes = [];
  const consumedReferenceIndexes = new Set();
  const entries = [];
  let stepContinuityPreserved = true;

  for (const group of groups) {
    const activeReferenceByCycle = new Map();
    const activeReferenceRecords = [];
    for (const item of group.entries.filter(candidate => candidate.stage === 'cycle')) {
      const matches = referenceCycleMatches(item, referenceHistory);
      const match = matches.length === 1 ? matches[0] : null;
      activeReferenceByCycle.set(item.syntheticRule, { matches, match });
      if (match) { activeReferenceRecords.push(match.record); consumedReferenceIndexes.add(match.referenceIndex); }
    }
    const senseEvidence = livingSenseChanges(activeReferenceRecords, semanticValue);

    for (const item of group.entries) {
      const nativeMatches = nativeMatchesFor(item, nativeHistory);
      const nativeMatch = nativeMatches.length === 1 ? nativeMatches[0] : null;
      if (nativeMatch) nativeIndexes.push(nativeMatch.nativeIndex);
      const expectedTargets = sortedUnique(asArray(item.stateTargets).filter(Boolean));
      let reference = null; let referenceIndex = -1; let referenceChanges = []; let referenceActive = false;
      const checks = { metadataShapeSupported:metadataComplete(item) };

      if (item.stage === 'sense') {
        referenceChanges = senseEvidence.changes;
        referenceActive = senseEvidence.available;
        checks.referenceSenseEvidencePresent = senseEvidence.available;
        checks.referenceSenseEvidenceConsistent = senseEvidence.consistent;
        checks.exactNativeRecord = nativeMatches.length === 1;
        checks.nativeStatusRealized = nativeMatch?.record?.status === 'realized';
        checks.referenceTargetsExact = sameJson(sortedUnique(referenceChanges.map(change=>change.target)), expectedTargets);
        checks.nativeTargetsExact = sameJson(sortedUnique(asArray(nativeMatch?.record?.changes).map(change=>change?.target).filter(Boolean)), expectedTargets);
        checks.transitionValuesEquivalent = sameJson(referenceChanges, receiptChanges(nativeMatch?.record?.changes, semanticValue));
        checks.syntheticWitnessPresent = asArray(nativeMatch?.record?.witnesses).includes(item.witness);
      } else {
        const pair = activeReferenceByCycle.get(item.syntheticRule) ?? { matches:[], match:null };
        reference = pair.match?.record ?? null; referenceIndex = pair.match?.referenceIndex ?? -1; referenceActive = Boolean(reference);
        referenceChanges = receiptChanges(asArray(reference?.changes).filter(change=>change?.source !== 'living:sense'), semanticValue);
        const conditionallyInactive = !reference;
        checks.referenceCycleUnique = pair.matches.length <= 1;
        checks.referenceReceiptAligned = conditionallyInactive ? true : reference.status === 'realized'
          && reference.authorityClass === 'intrinsic-life-cycle'
          && Number(reference.step) === Number(item.stepIndex)
          && reference.name === item.cycleName;
        checks.exactNativeRecord = conditionallyInactive ? nativeMatches.length === 0 : nativeMatches.length === 1;
        checks.nativeStatusRealized = conditionallyInactive ? true : nativeMatch?.record?.status === 'realized';
        checks.referenceTargetsExact = conditionallyInactive ? true : sameJson(sortedUnique(referenceChanges.map(change=>change.target)), expectedTargets);
        checks.nativeTargetsExact = conditionallyInactive ? true : sameJson(sortedUnique(asArray(nativeMatch?.record?.changes).map(change=>change?.target).filter(Boolean)), expectedTargets);
        checks.transitionValuesEquivalent = conditionallyInactive ? true : sameJson(referenceChanges, receiptChanges(nativeMatch?.record?.changes, semanticValue));
        const nativeWitnesses = asArray(nativeMatch?.record?.witnesses);
        checks.syntheticWitnessPresent = conditionallyInactive ? true : nativeWitnesses.includes(item.witness);
        checks.originalWitnessesPreserved = conditionallyInactive ? true
          : sameJson(asArray(reference.witnesses), asArray(item.originalWitnesses))
            && asArray(item.originalWitnesses).every(witness => nativeWitnesses.includes(witness));
        checks.referenceBoundaryRootsPreserved = conditionallyInactive ? true
          : Boolean(reference.beforeRoot) && Boolean(reference.afterRoot)
            && nativeMatch?.record?.beforeRoot === reference.beforeRoot
            && nativeMatch?.record?.afterRoot === reference.afterRoot;
      }

      const nativeChanges = receiptChanges(nativeMatch?.record?.changes, semanticValue);
      entries.push({
        index:entries.length, declaration:item.declaration, directiveIndex:item.directiveIndex,
        stepIndex:item.stepIndex, stepCount:item.stepCount, stage:item.stage, stageIndex:item.stageIndex, stageCount:item.stageCount,
        cycleIndex:item.cycleIndex??null, cycleName:item.cycleName??null, syntheticRule:item.syntheticRule, witness:item.witness,
        stateTargets:asArray(item.stateTargets), originalWitnesses:asArray(item.originalWitnesses), changeModes:asArray(item.changeModes),
        referenceActive, nativeActive:Boolean(nativeMatch), referenceIndex, nativeIndex:nativeMatch?.nativeIndex??null,
        referenceChanges, nativeChanges,
        referenceBeforeRoot:reference?.beforeRoot??null, referenceAfterRoot:reference?.afterRoot??null,
        nativeBeforeRoot:nativeMatch?.record?.beforeRoot??null, nativeAfterRoot:nativeMatch?.record?.afterRoot??null,
        checks, ok:Object.values(checks).every(Boolean),
      });
    }

    const activeItems = group.entries.map(item => entries.find(entry => entry.syntheticRule === item.syntheticRule)).filter(entry => entry?.nativeActive);
    for (let index = 1; index < activeItems.length; index += 1) {
      const previous = activeItems[index - 1]; const current = activeItems[index];
      if (!previous.nativeAfterRoot || !current.nativeBeforeRoot || previous.nativeAfterRoot !== current.nativeBeforeRoot) stepContinuityPreserved = false;
    }
    const senseEntry = activeItems.find(entry=>entry.stage==='sense');
    const firstCycleEntry = activeItems.find(entry=>entry.stage==='cycle' && entry.referenceActive);
    if (senseEntry && firstCycleEntry && senseEntry.nativeAfterRoot !== firstCycleEntry.referenceBeforeRoot) stepContinuityPreserved = false;
  }

  const relevantReferences = relevantReferenceIndexes(items, referenceHistory);
  const referenceCoverageExact = relevantReferences.length === consumedReferenceIndexes.size
    && relevantReferences.every(index => consumedReferenceIndexes.has(index));
  const nativeOrderPreserved = strictlyIncreasing(nativeIndexes);
  const ok = metadataCompleteFlag && stepShapeComplete && referenceCoverageExact && nativeOrderPreserved && stepContinuityPreserved
    && (!required || (entries.length > 0 && entries.every(entry=>entry.ok)));
  const report = {
    format:FOUNDATION_LIVING_STAGED_RECEIPT_FORMAT,
    version:FOUNDATION_LIVING_STAGED_RECEIPT_VERSION,
    required, ok, declaredLivingLoweredCount:declaredLoweredCount, observedLivingLoweringEntries:items.length,
    metadataComplete:metadataCompleteFlag, stepShapeComplete, referenceCoverageExact, nativeOrderPreserved, stepContinuityPreserved,
    entries, steps,
    truthBoundary:{
      standaloneLivingReceiptEvidenceOnly:true,
      integratedIntoFoundationDirectNativeParity:false,
      senseEvidenceRequiresAtLeastOneActiveReferenceCyclePerStep:true,
      silentReferenceSenseOnlyStepCannotBeCertified:true,
      actualCNativeVmExecutionClaimed:false,
      fullHistoryParityClaimed:false,
    },
  };
  return { ...report, rootAlgorithm:FOUNDATION_LIVING_STAGED_RECEIPT_ROOT_ALGORITHM, receiptRoot:livingStagedReceiptRoot(report) };
}
