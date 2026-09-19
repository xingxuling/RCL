import crypto from 'node:crypto';

export const FOUNDATION_QUANTITATIVE_NATIVE_PARITY_FORMAT =
  'taowind.rcl-foundation-quantitative-native-parity.v0.1';
export const FOUNDATION_QUANTITATIVE_NATIVE_PARITY_VERSION = '0.1.0';
export const FOUNDATION_QUANTITATIVE_RECEIPT_ROOT_ALGORITHM =
  'rcl.foundation-quantitative-receipt-root.sha256.v0.1';
export const FOUNDATION_QUANTITATIVE_SEMANTIC_STATE_ROOT_ALGORITHM =
  'rcl.foundation-quantitative-semantic-state-root.sha256.v0.1';

function array(value) { return Array.isArray(value) ? value : []; }
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  }
  return value;
}
function sha256Canonical(value) {
  return crypto.createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}
function same(left, right) { return JSON.stringify(canonical(left)) === JSON.stringify(canonical(right)); }
function uniqueSorted(values) { return [...new Set(values)].sort(); }

function evidenceArray(value) {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {}
    return value.length > 0 ? [value] : [];
  }
  return [];
}

export function normalizeQuantitativeSemanticValue(value, semanticValue = item => item) {
  const resolved = semanticValue ? semanticValue(value) : value;
  if (resolved === undefined) return null;
  if (Array.isArray(resolved)) return resolved.map(item => normalizeQuantitativeSemanticValue(item, semanticValue));
  if (!resolved || typeof resolved !== 'object') return resolved;

  if (resolved.kind === 'Quantity') {
    return {
      kind: 'Quantity',
      type: resolved.type ?? null,
      value: resolved.value ?? null,
      unit: resolved.unit ?? null,
    };
  }
  if (resolved.kind === 'Measurement') {
    return {
      kind: 'Measurement',
      baseType: resolved.baseType ?? null,
      value: normalizeQuantitativeSemanticValue(resolved.value, semanticValue),
      uncertainty: normalizeQuantitativeSemanticValue(resolved.uncertainty, semanticValue),
      confidence: resolved.confidence ?? null,
      unit: resolved.unit ?? null,
      scale: resolved.scale ?? null,
      evidence: evidenceArray(resolved.evidence),
      calibratedBy: resolved.calibratedBy ?? null,
    };
  }
  return canonical(Object.fromEntries(
    Object.entries(resolved).map(([key, item]) => [key, normalizeQuantitativeSemanticValue(item, semanticValue)]),
  ));
}

function normalizeChanges(changes, expectedTargets, semanticValue) {
  const allowed = new Set(expectedTargets);
  return array(changes)
    .filter(change => allowed.has(change?.target))
    .map(change => ({
      target: change.target,
      before: normalizeQuantitativeSemanticValue(change.before, semanticValue),
      after: normalizeQuantitativeSemanticValue(change.after, semanticValue),
    }))
    .sort((a, b) => a.target.localeCompare(b.target));
}

export function quantitativeStateProjection(state, targets, semanticValue) {
  return Object.fromEntries(
    uniqueSorted(targets).map(target => [
      target,
      normalizeQuantitativeSemanticValue(state?.[target], semanticValue),
    ]),
  );
}

export function quantitativeSemanticStateRoot(state, targets, semanticValue) {
  return sha256Canonical({
    algorithm: FOUNDATION_QUANTITATIVE_SEMANTIC_STATE_ROOT_ALGORITHM,
    projection: quantitativeStateProjection(state, targets, semanticValue),
  });
}

export function verifyFoundationQuantitativeReceiptParity(lowering, referenceHistory, nativeHistory, semanticValue) {
  const lowered = array(lowering?.lowered).filter(item => item?.domain === 'quantitative');
  const references = array(referenceHistory);
  const natives = array(nativeHistory);
  const entries = [];

  for (const item of lowered) {
    const expectedTargets = uniqueSorted(item?.stateTargets ?? []);
    const referenceMatches = references.filter(record =>
      record?.kind === 'DomainTransition'
      && record?.domainKind === 'quantitative'
      && record?.name === item?.declaration
    );
    const nativeMatches = natives.filter(record => record?.rule === item?.syntheticRule);
    const reference = referenceMatches.length === 1 ? referenceMatches[0] : null;
    const native = nativeMatches.length === 1 ? nativeMatches[0] : null;
    const referenceChanges = normalizeChanges(reference?.changes, expectedTargets, semanticValue);
    const nativeChanges = normalizeChanges(native?.changes, expectedTargets, semanticValue);
    const referenceTargets = uniqueSorted(referenceChanges.map(change => change.target));
    const nativeTargets = uniqueSorted(nativeChanges.map(change => change.target));
    const measurementPaths = uniqueSorted(array(item?.measurementPaths));
    const referenceMeasurementPaths = uniqueSorted(array(reference?.measurements).map(measure => measure?.path).filter(Boolean));

    const checks = {
      loweringMetadataComplete: item?.directive === 'Quantify'
        && item?.authorityClass === 'measurement'
        && typeof item?.syntheticRule === 'string'
        && typeof item?.witness === 'string'
        && expectedTargets.length > 0,
      referenceIdentity: Boolean(reference)
        && reference?.status === 'realized'
        && reference?.authorityClass === 'evidentiary-measurement',
      referenceRecordUnique: referenceMatches.length === 1,
      nativeRecordUnique: nativeMatches.length === 1,
      nativeWitness: array(native?.witnesses).includes(item?.witness),
      targetCoverage: same(referenceTargets, expectedTargets) && same(nativeTargets, expectedTargets),
      measurementIdentity: measurementPaths.length === Number(item?.measurementCount ?? measurementPaths.length)
        && measurementPaths.every(path => referenceMeasurementPaths.includes(path)),
      changesParity: same(referenceChanges, nativeChanges),
    };

    const receiptBinding = {
      algorithm: FOUNDATION_QUANTITATIVE_RECEIPT_ROOT_ALGORITHM,
      domain: 'quantitative',
      declaration: item?.declaration ?? null,
      directive: item?.directive ?? null,
      syntheticRule: item?.syntheticRule ?? null,
      authorityClass: 'measurement',
      stateTargets: expectedTargets,
      measurementPaths,
    };
    const referenceReceiptRoot = sha256Canonical({ ...receiptBinding, changes: referenceChanges });
    const nativeReceiptRoot = sha256Canonical({ ...receiptBinding, changes: nativeChanges });
    checks.receiptRootParity = referenceReceiptRoot === nativeReceiptRoot;

    entries.push({
      domain: 'quantitative',
      declaration: item?.declaration ?? null,
      syntheticRule: item?.syntheticRule ?? null,
      expectedTargets,
      referenceChanges,
      nativeChanges,
      referenceReceiptRoot,
      nativeReceiptRoot,
      checks,
      ok: Object.values(checks).every(Boolean),
    });
  }

  const ok = lowered.length > 0 && entries.length === lowered.length && entries.every(entry => entry.ok);
  const receiptRoot = sha256Canonical({
    algorithm: FOUNDATION_QUANTITATIVE_RECEIPT_ROOT_ALGORITHM,
    entryRoots: entries.map(entry => entry.nativeReceiptRoot),
  });
  return {
    ok,
    required: lowered.length > 0,
    rootAlgorithm: FOUNDATION_QUANTITATIVE_RECEIPT_ROOT_ALGORITHM,
    receiptRoot,
    loweredCount: lowered.length,
    entries,
    truthBoundary: {
      quantitativeSemanticNormalizationIsExplicit: true,
      measurementEvidenceArrayAndCanonicalJsonTextAreEquivalentOnlyAfterNormalization: true,
      referenceAndNativeChangesMustMatchAfterQuantitativeSemanticNormalization: true,
      fullHistoryParityClaimed: false,
      providerBridgeRemovedGlobally: false,
    },
  };
}
