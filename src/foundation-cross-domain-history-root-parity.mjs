import { createHash } from 'node:crypto';

export const FOUNDATION_CROSS_DOMAIN_HISTORY_ROOT_PARITY_FORMAT = 'taowind.rcl-foundation-cross-domain-history-root-parity.v0.1';
export const FOUNDATION_CROSS_DOMAIN_HISTORY_ROOT_PARITY_VERSION = '0.1.0';
export const FOUNDATION_CROSS_DOMAIN_HISTORY_ROOT_ALGORITHM = 'rcl.foundation-cross-domain-history-root.sha256.v0.1';

const SUPPORTED_DOMAINS = Object.freeze(['perception', 'physical', 'neural']);

function asArray(value) { return Array.isArray(value) ? value : []; }
function canonicalJson(value) {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalJson(value[key])]));
  }
  return value;
}
function sameJson(left, right) { return JSON.stringify(canonicalJson(left)) === JSON.stringify(canonicalJson(right)); }
function sha256(value) { return createHash('sha256').update(JSON.stringify(canonicalJson(value))).digest('hex'); }
function unique(values) { return [...new Set(values)]; }
function isSha256(value) { return typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value); }

function entryIdentity(entry, sequence) {
  return {
    sequence,
    loweringIndex: Number(entry?.index ?? sequence),
    domain: entry?.domain ?? null,
    declaration: entry?.declaration ?? null,
    directive: entry?.directive ?? null,
    directiveIndex: Number(entry?.directiveIndex ?? -1),
  };
}

function semanticEntry(entry, sequence, side) {
  const identity = entryIdentity(entry, sequence);
  const active = side === 'reference' ? entry?.referenceActive === true : entry?.nativeActive === true;
  const beforeRoot = side === 'reference' ? entry?.referenceBeforeRoot ?? null : entry?.nativeBeforeRoot ?? null;
  const afterRoot = side === 'reference' ? entry?.referenceAfterRoot ?? null : entry?.nativeAfterRoot ?? null;
  const changes = side === 'reference' ? asArray(entry?.referenceChanges) : asArray(entry?.nativeChanges);
  return canonicalJson({ ...identity, active, beforeRoot, afterRoot, changes });
}

function entryParity(entry) {
  const referenceActive = entry?.referenceActive === true;
  const nativeActive = entry?.nativeActive === true;
  if (referenceActive !== nativeActive) return false;
  if (!referenceActive) {
    return asArray(entry?.referenceChanges).length === 0 && asArray(entry?.nativeChanges).length === 0;
  }
  return isSha256(entry?.referenceBeforeRoot)
    && isSha256(entry?.referenceAfterRoot)
    && isSha256(entry?.nativeBeforeRoot)
    && isSha256(entry?.nativeAfterRoot)
    && entry.referenceBeforeRoot === entry.nativeBeforeRoot
    && entry.referenceAfterRoot === entry.nativeAfterRoot
    && sameJson(entry.referenceChanges, entry.nativeChanges);
}

function continuity(entries) {
  const active = entries.filter(entry => entry?.active === true);
  for (let index = 1; index < active.length; index += 1) {
    if (active[index - 1]?.afterRoot !== active[index]?.beforeRoot) return false;
  }
  return true;
}

function historyRoot(domains, entries) {
  return sha256({
    algorithm: FOUNDATION_CROSS_DOMAIN_HISTORY_ROOT_ALGORITHM,
    domains,
    entries,
  });
}

export function verifyFoundationCrossDomainHistoryRootParity(domainReceipt) {
  const allEntries = asArray(domainReceipt?.entries);
  const entries = allEntries.filter(entry => SUPPORTED_DOMAINS.includes(entry?.domain));
  const domains = unique(entries.map(entry => entry?.domain).filter(Boolean));
  const required = domains.length >= 2;
  const truthBoundary = {
    boundedRelevantDirectHistoryOnly: true,
    supportedDomains: [...SUPPORTED_DOMAINS],
    stagedGeneticHistoryExcluded: true,
    livingStagedHistoryExcluded: true,
    unrelatedRuntimeHistoryExcluded: true,
    contiguousScopedHistoryRequired: true,
    crossDomainHistoryRootIsEvidenceBindingNotStandaloneProof: true,
    fullHistoryParityClaimed: false,
  };

  if (!required) {
    return {
      format: FOUNDATION_CROSS_DOMAIN_HISTORY_ROOT_PARITY_FORMAT,
      version: FOUNDATION_CROSS_DOMAIN_HISTORY_ROOT_PARITY_VERSION,
      required: false,
      ok: true,
      rootAlgorithm: FOUNDATION_CROSS_DOMAIN_HISTORY_ROOT_ALGORITHM,
      domains,
      domainCount: domains.length,
      entryCount: entries.length,
      referenceHistoryRoot: null,
      nativeHistoryRoot: null,
      rootsEqual: null,
      checks: {
        crossDomainScopePresent: false,
      },
      entries: [],
      truthBoundary,
    };
  }

  const referenceEntries = entries.map((entry, index) => semanticEntry(entry, index, 'reference'));
  const nativeEntries = entries.map((entry, index) => semanticEntry(entry, index, 'native'));
  const perEntry = entries.map((entry, index) => ({
    index,
    domain: entry?.domain ?? null,
    declaration: entry?.declaration ?? null,
    directive: entry?.directive ?? null,
    referenceActive: entry?.referenceActive === true,
    nativeActive: entry?.nativeActive === true,
    boundaryAndTransitionParity: entryParity(entry),
  }));
  const referenceHistoryRoot = historyRoot(domains, referenceEntries);
  const nativeHistoryRoot = historyRoot(domains, nativeEntries);
  const checks = {
    crossDomainScopePresent: domains.length >= 2,
    sourceDomainReceiptVerified: domainReceipt?.ok === true,
    referenceOrderPreserved: domainReceipt?.referenceOrderPreserved === true,
    nativeOrderPreserved: domainReceipt?.nativeOrderPreserved === true,
    everyScopedEntryVerified: entries.every(entry => entry?.ok === true),
    everyBoundaryAndTransitionExact: perEntry.every(entry => entry.boundaryAndTransitionParity),
    referenceContinuityPreserved: continuity(referenceEntries),
    nativeContinuityPreserved: continuity(nativeEntries),
    rootsEqual: referenceHistoryRoot === nativeHistoryRoot,
  };
  const ok = Object.values(checks).every(Boolean);
  return {
    format: FOUNDATION_CROSS_DOMAIN_HISTORY_ROOT_PARITY_FORMAT,
    version: FOUNDATION_CROSS_DOMAIN_HISTORY_ROOT_PARITY_VERSION,
    required: true,
    ok,
    rootAlgorithm: FOUNDATION_CROSS_DOMAIN_HISTORY_ROOT_ALGORITHM,
    domains,
    domainCount: domains.length,
    entryCount: entries.length,
    referenceHistoryRoot,
    nativeHistoryRoot,
    rootsEqual: checks.rootsEqual,
    checks,
    entries: perEntry,
    truthBoundary,
  };
}
