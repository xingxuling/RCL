import { createHash } from 'node:crypto';
import { semanticValue } from './semantic-state-root.mjs';

export const FOUNDATION_KNOWLEDGE_NATIVE_PARITY_FORMAT = 'taowind.rcl-foundation-knowledge-native-parity.v0.3';
export const FOUNDATION_KNOWLEDGE_NATIVE_PARITY_VERSION = '0.3.0';
export const FOUNDATION_KNOWLEDGE_RECEIPT_ROOT_ALGORITHM = 'rcl.foundation-knowledge-receipt-root.sha256.v0.2';

function array(value) { return Array.isArray(value) ? value : []; }
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
function uniqueSorted(values) { return [...new Set(values.filter(Boolean))].sort(); }
function sha256Canonical(value) {
  return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}
function isSha256(value) { return typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value); }

function truthBoundary() {
  return {
    boundedSingleClaimKnowledgeSubsetOnly: false,
    boundedPrimitiveMultiClaimKnowledgeSubsetOnly: true,
    maxBoundedClaimCount: 4,
    referenceSequentialClaimFormationRootsMustBePreserved: true,
    oneLearnDirectiveMapsToOneSyntheticNativeTransaction: true,
    referenceReceiptAndNativeReceiptMustMatchExactly: true,
    nativePreLearnBoundaryMustMatchReferencePreLearnBoundary: true,
    providerBridgeRemovedGlobally: false,
    allKnowledgeProgramsNativeClaimed: false,
    fullHistoryParityClaimed: false,
  };
}

function formedRootEntries(item, expectedTargets) {
  const explicit = array(item?.formedAtRoots)
    .filter(entry => typeof entry?.path === 'string' && typeof entry?.root === 'string')
    .map(entry => ({ path: entry.path, root: entry.root }));
  if (explicit.length > 0) return explicit;
  return expectedTargets.map(path => ({ path, root: item?.formedAtRoot ?? null }));
}

export function knowledgeReceiptRoot(report) {
  if (!report || typeof report !== 'object' || Array.isArray(report)) {
    throw new TypeError('Knowledge receipt parity report object is required');
  }
  return sha256Canonical({
    algorithm: FOUNDATION_KNOWLEDGE_RECEIPT_ROOT_ALGORITHM,
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
      claimCount: entry?.claimCount ?? null,
      claimPaths: array(entry?.claimPaths),
      formedAtRoot: entry?.formedAtRoot ?? null,
      formedAtRoots: array(entry?.formedAtRoots),
      expectedTargets: array(entry?.expectedTargets),
      referenceTargets: array(entry?.referenceTargets),
      nativeTargets: array(entry?.nativeTargets),
      referenceChanges: array(entry?.referenceChanges),
      nativeChanges: array(entry?.nativeChanges),
      referenceKnowledgeClaims: array(entry?.referenceKnowledgeClaims),
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

export function verifyFoundationKnowledgeReceiptParity(lowering, referenceHistory, nativeHistory, semantic = semanticValue) {
  const lowered = array(lowering?.lowered);
  const references = array(referenceHistory);
  const natives = array(nativeHistory);
  const usedReferences = new Set();
  const usedNative = new Set();

  const entries = lowered.map((item, index) => {
    const referenceIndex = references.findIndex((record, candidateIndex) => (
      !usedReferences.has(candidateIndex)
      && record?.kind === 'DomainTransition'
      && record?.domainKind === 'knowledge'
      && record?.name === item?.declaration
    ));
    if (referenceIndex >= 0) usedReferences.add(referenceIndex);
    const reference = referenceIndex >= 0 ? references[referenceIndex] : null;

    const nativeMatches = natives
      .map((record, candidateIndex) => ({ record, candidateIndex }))
      .filter(({ record, candidateIndex }) => (
        !usedNative.has(candidateIndex) && record?.rule === item?.syntheticRule
      ));
    const nativeMatch = nativeMatches.length === 1 ? nativeMatches[0] : null;
    if (nativeMatch) usedNative.add(nativeMatch.candidateIndex);
    const native = nativeMatch?.record ?? null;

    const expectedTargets = uniqueSorted(array(item?.stateTargets).length
      ? item.stateTargets
      : (array(item?.claimPaths).length ? item.claimPaths : [item?.claimPath]));
    const claimPaths = uniqueSorted(array(item?.claimPaths).length ? item.claimPaths : expectedTargets);
    const formedAtRoots = formedRootEntries(item, expectedTargets).sort((left, right) => left.path.localeCompare(right.path));
    const formedRootMap = new Map(formedAtRoots.map(entry => [entry.path, entry.root]));
    const referenceChanges = normalizeChanges(reference?.changes, semantic);
    const nativeChanges = normalizeChanges(native?.changes, semantic);
    const referenceTargets = referenceChanges.map(change => change.target);
    const nativeTargets = nativeChanges.map(change => change.target);
    const referenceKnowledgeClaims = array(reference?.knowledgeClaims).map(claim => canonical(claim));
    const referenceKnowledgeClaimPaths = uniqueSorted(referenceKnowledgeClaims.map(claim => claim?.path));
    const nativeWitnesses = array(native?.witnesses);

    const referenceClaimsAligned = expectedTargets.every(target => {
      const referenceClaim = referenceKnowledgeClaims.find(claim => claim?.path === target) ?? null;
      const referenceAfter = referenceChanges.find(change => change.target === target)?.after ?? null;
      return Boolean(referenceClaim)
        && referenceClaim?.confidence === referenceAfter?.confidence
        && same(referenceClaim?.evidence, referenceAfter?.evidence)
        && referenceClaim?.source === referenceAfter?.source
        && referenceClaim?.status === referenceAfter?.status;
    });
    const formedAtRootsRetained = expectedTargets.every(target => {
      const expectedRoot = formedRootMap.get(target);
      const referenceAfter = referenceChanges.find(change => change.target === target)?.after ?? null;
      const nativeAfter = nativeChanges.find(change => change.target === target)?.after ?? null;
      return isSha256(expectedRoot)
        && referenceAfter?.formedAtRoot === expectedRoot
        && nativeAfter?.formedAtRoot === expectedRoot;
    });

    const checks = {
      metadataShapeSupported:
        item?.domain === 'knowledge'
        && item?.directive === 'Learn'
        && item?.authorityClass === 'epistemic'
        && typeof item?.declaration === 'string'
        && Number.isInteger(Number(item?.directiveIndex))
        && typeof item?.syntheticRule === 'string'
        && Number(item?.claimCount ?? 0) >= 1
        && Number(item?.claimCount ?? 0) <= 4
        && Number(item?.claimCount ?? 0) === expectedTargets.length
        && claimPaths.length === expectedTargets.length
        && same(claimPaths, expectedTargets)
        && formedAtRoots.length === expectedTargets.length
        && same(formedAtRoots.map(entry => entry.path), expectedTargets)
        && formedAtRoots.every(entry => isSha256(entry.root))
        && typeof item?.witness === 'string'
        && isSha256(item?.formedAtRoot)
        && item.formedAtRoot === formedRootMap.get(item?.claimPaths?.[0] ?? item?.claimPath),
      exactReferenceReceipt: Boolean(reference),
      referenceStatusRealized: reference?.status === 'realized',
      exactNativeReceipt: Boolean(native) && nativeMatches.length === 1,
      nativeStatusRealized: native?.status === 'realized',
      referenceTargetsExact: same(referenceTargets, expectedTargets),
      nativeTargetsExact: same(nativeTargets, expectedTargets),
      transitionValuesEquivalent: same(referenceChanges, nativeChanges),
      referenceKnowledgeClaimsExact: same(referenceKnowledgeClaimPaths, expectedTargets),
      referenceKnowledgeClaimsAligned: referenceClaimsAligned,
      formedAtRootsRetained,
      syntheticWitnessPresent: nativeWitnesses.includes(item?.witness),
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
      claimCount: item?.claimCount ?? null,
      claimPaths,
      formedAtRoot: item?.formedAtRoot ?? null,
      formedAtRoots,
      expectedTargets,
      referenceTargets,
      nativeTargets,
      referenceChanges,
      nativeChanges,
      referenceKnowledgeClaims,
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
    record?.kind === 'DomainTransition' && record?.domainKind === 'knowledge'
  )).length;
  const relevantNativeCount = natives.filter(record => (
    lowered.some(item => record?.rule === item?.syntheticRule)
  )).length;
  const declaredLoweredCount = Number(lowering?.summary?.consumedDirectiveCount ?? lowered.length);
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
    rootAlgorithm: FOUNDATION_KNOWLEDGE_RECEIPT_ROOT_ALGORITHM,
    receiptRoot: knowledgeReceiptRoot(report),
    truthBoundary: truthBoundary(),
  };
}
