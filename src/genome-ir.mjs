import { realityRoot } from './canonical.mjs';

export const RCL_GENOME_IR_FORMAT = 'rcl.genome-observation.v0.1';
export const RCL_GENOME_IR_VERSION = '0.1.0';
export const RCL_GENOME_COORDINATE_SYSTEM = '1-based-closed';
export const RCL_GENOME_ACCESS_TIERS = Object.freeze(['public', 'controlled', 'private', 'synthetic', 'unknown']);
export const RCL_GENOME_CLAIM_STATUSES = Object.freeze(['OBSERVED', 'ASSOCIATED', 'CAUSAL', 'PREDICTED', 'CONTRADICTED', 'UNKNOWN']);
export const RCL_GENOME_FOUNDATION_BINDING = Object.freeze({
  domains: Object.freeze(['genetic', 'quantitative', 'knowledge', 'scientific']),
  crossDomainAxes: Object.freeze(['causality-evidence', 'authority-boundary']),
});

export function normalizeGenomeLocus(input = {}) {
  assertObject(input, 'genome locus');
  const start = positiveSafeInteger(input.start ?? input.position, 'genome locus start');
  const end = input.end == null ? start : positiveSafeInteger(input.end, 'genome locus end');
  if (end < start) throw new RangeError('genome locus end must be greater than or equal to start');
  return Object.freeze({
    assembly: nonEmptyString(input.assembly, 'genome locus assembly'),
    contig: nonEmptyString(input.contig ?? input.chromosome, 'genome locus contig'),
    start,
    end,
    coordinateSystem: input.coordinateSystem ?? RCL_GENOME_COORDINATE_SYSTEM,
  });
}

export function normalizeGenomeVariant(input = {}) {
  assertObject(input, 'genome variant');
  const ref = alleleString(input.ref, 'genome variant ref');
  const altsInput = input.alts ?? (input.alt == null ? null : [input.alt]);
  if (!Array.isArray(altsInput) || altsInput.length === 0) throw new TypeError('genome variant alts must be a non-empty array');
  const alts = altsInput.map((value, index) => alleleString(value, `genome variant alts[${index}]`));
  if (new Set(alts).size !== alts.length) throw new TypeError('genome variant alts must not contain duplicates');
  if (alts.some(alt => alt === ref)) throw new TypeError('genome variant alternate allele must differ from ref');
  return Object.freeze({
    id: optionalString(input.id),
    ref,
    alts: Object.freeze(alts),
    type: input.type == null ? inferVariantType(ref, alts) : nonEmptyString(input.type, 'genome variant type'),
  });
}

export function normalizeGenomeGenotype(input, { altCount = 1 } = {}) {
  if (input == null) return null;
  assertObject(input, 'genome genotype');
  if (!Array.isArray(input.alleles) || input.alleles.length === 0) throw new TypeError('genome genotype alleles must be a non-empty array');
  const alleles = input.alleles.map((value, index) => {
    if (value == null || value === '.') return null;
    if (!Number.isSafeInteger(value) || value < 0 || value > altCount) throw new RangeError(`genome genotype alleles[${index}] must be null or an integer between 0 and ${altCount}`);
    return value;
  });
  return Object.freeze({
    alleles: Object.freeze(alleles),
    phased: Boolean(input.phased),
    ploidy: alleles.length,
    phaseSet: optionalString(input.phaseSet),
  });
}

export function normalizeGenomeEvidence(input = {}, index = 0) {
  assertObject(input, `genome evidence[${index}]`);
  return Object.freeze({
    id: nonEmptyString(input.id ?? `evidence:${index + 1}`, `genome evidence[${index}].id`),
    source: nonEmptyString(input.source, `genome evidence[${index}].source`),
    sourceType: nonEmptyString(input.sourceType ?? 'dataset', `genome evidence[${index}].sourceType`),
    accession: optionalString(input.accession),
    uri: optionalString(input.uri),
    recordRef: optionalString(input.recordRef),
    provenanceClass: nonEmptyString(input.provenanceClass ?? 'declared', `genome evidence[${index}].provenanceClass`),
    confidence: optionalConfidence(input.confidence, `genome evidence[${index}].confidence`),
  });
}

export function normalizeGenomeClaim(input = {}, evidenceIds = new Set(), index = 0) {
  assertObject(input, `genome claim[${index}]`);
  const status = nonEmptyString(input.status ?? 'UNKNOWN', `genome claim[${index}].status`).toUpperCase();
  if (!RCL_GENOME_CLAIM_STATUSES.includes(status)) throw new TypeError(`genome claim[${index}].status is unsupported: ${status}`);
  const evidenceRefs = stringArray(input.evidenceRefs ?? [], `genome claim[${index}].evidenceRefs`);
  for (const ref of evidenceRefs) if (!evidenceIds.has(ref)) throw new TypeError(`genome claim[${index}] references unknown evidence '${ref}'`);
  if (['ASSOCIATED', 'CAUSAL', 'CONTRADICTED'].includes(status) && evidenceRefs.length === 0) {
    throw new TypeError(`genome claim[${index}] with status ${status} requires evidenceRefs`);
  }
  return Object.freeze({
    id: nonEmptyString(input.id ?? `claim:${index + 1}`, `genome claim[${index}].id`),
    subject: nonEmptyString(input.subject ?? 'variant', `genome claim[${index}].subject`),
    predicate: nonEmptyString(input.predicate, `genome claim[${index}].predicate`),
    object: normalizeClaimObject(input.object),
    status,
    confidence: optionalConfidence(input.confidence, `genome claim[${index}].confidence`),
    evidenceRefs: Object.freeze(evidenceRefs),
  });
}

export function normalizeGenomeGovernance(input = {}) {
  assertObject(input, 'genome governance');
  const accessTier = nonEmptyString(input.accessTier ?? 'unknown', 'genome governance accessTier').toLowerCase();
  if (!RCL_GENOME_ACCESS_TIERS.includes(accessTier)) throw new TypeError(`genome governance accessTier is unsupported: ${accessTier}`);
  return Object.freeze({
    accessTier,
    consentBasis: optionalString(input.consentBasis),
    subjectRisk: nonEmptyString(input.subjectRisk ?? 'genomic-identifiability', 'genome governance subjectRisk'),
    authorityRequired: Object.freeze(stringArray(input.authorityRequired ?? [], 'genome governance authorityRequired')),
  });
}

export function createGenomeObservation(input = {}) {
  assertObject(input, 'genome observation');
  const locus = normalizeGenomeLocus(input.locus ?? input.reference ?? {});
  const variant = normalizeGenomeVariant(input.variant ?? {});
  const genotype = normalizeGenomeGenotype(input.genotype, { altCount: variant.alts.length });
  const evidence = (input.evidence ?? []).map((item, index) => normalizeGenomeEvidence(item, index));
  ensureUniqueIds(evidence, 'genome evidence');
  const evidenceIds = new Set(evidence.map(item => item.id));
  const claims = (input.claims ?? []).map((item, index) => normalizeGenomeClaim(item, evidenceIds, index));
  ensureUniqueIds(claims, 'genome claims');
  const payload = {
    format: input.format ?? RCL_GENOME_IR_FORMAT,
    version: input.version ?? RCL_GENOME_IR_VERSION,
    observationId: nonEmptyString(input.observationId, 'genome observation observationId'),
    sampleRef: nonEmptyString(input.sampleRef, 'genome observation sampleRef'),
    specimenRef: optionalString(input.specimenRef),
    locus,
    variant,
    genotype,
    quality: normalizeGenomeQuality(input.quality ?? {}),
    evidence: Object.freeze(evidence),
    claims: Object.freeze(claims),
    governance: normalizeGenomeGovernance(input.governance ?? {}),
    foundation: normalizeFoundationBinding(input.foundation),
  };
  const observation = Object.freeze({ ...payload, observationRoot: input.observationRoot ?? realityRoot(payload) });
  const verification = verifyGenomeObservation(observation);
  if (!verification.ok) throw new TypeError(`invalid Genome IR observation: ${verification.reason ?? Object.entries(verification.checks ?? {}).filter(([, value]) => !value).map(([key]) => key).join(',')}`);
  return observation;
}

export function verifyGenomeObservation(observation) {
  if (!observation || typeof observation !== 'object' || Array.isArray(observation)) return { ok: false, reason: 'genome observation must be an object' };
  try {
    const { observationRoot, ...payload } = observation;
    const normalized = createGenomeObservationUnchecked(payload);
    const checks = {
      format: normalized.format === RCL_GENOME_IR_FORMAT,
      version: normalized.version === RCL_GENOME_IR_VERSION,
      root: typeof observationRoot === 'string' && observationRoot === realityRoot(payload),
      coordinateSystem: normalized.locus.coordinateSystem === RCL_GENOME_COORDINATE_SYSTEM,
      evidenceReferences: claimEvidenceReferencesValid(normalized),
      foundation: sameStringArray(normalized.foundation.domains, RCL_GENOME_FOUNDATION_BINDING.domains)
        && sameStringArray(normalized.foundation.crossDomainAxes, RCL_GENOME_FOUNDATION_BINDING.crossDomainAxes),
      privacyDeclared: RCL_GENOME_ACCESS_TIERS.includes(normalized.governance.accessTier),
    };
    return { ok: Object.values(checks).every(Boolean), checks, expectedRoot: realityRoot(payload), actualRoot: observationRoot ?? null };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
}

export function genomeFoundationProjection(observation) {
  const verification = verifyGenomeObservation(observation);
  if (!verification.ok) throw new TypeError(`cannot project invalid Genome IR observation: ${verification.reason ?? 'verification failed'}`);
  return Object.freeze({
    sourceRoot: observation.observationRoot,
    domains: Object.freeze([...observation.foundation.domains]),
    crossDomainAxes: Object.freeze([...observation.foundation.crossDomainAxes]),
    genetic: Object.freeze({ locus: observation.locus, variant: observation.variant, genotype: observation.genotype }),
    quantitative: Object.freeze({ quality: observation.quality, evidenceCount: observation.evidence.length }),
    knowledge: Object.freeze({ claims: observation.claims }),
    scientific: Object.freeze({ evidence: observation.evidence }),
    authorityBoundary: observation.governance,
  });
}

export function parseVcfVariantLine(line, { assembly, sampleRef, observationId, governance, evidence = [] } = {}) {
  const text = nonEmptyString(line, 'VCF line');
  if (text.startsWith('#')) throw new TypeError('VCF header lines are not variant records');
  const fields = text.split('\t');
  if (fields.length < 8) throw new TypeError('VCF variant line must contain at least 8 tab-separated columns');
  const [contig, positionText, id, ref, altText, qualText, filterText, infoText, formatText, sampleText] = fields;
  const alts = altText.split(',');
  const genotype = parseVcfGenotype(formatText, sampleText, alts.length);
  const info = parseVcfInfo(infoText);
  const mergedEvidence = [
    ...evidence,
    {
      id: 'evidence:vcf-record',
      source: 'VCF',
      sourceType: 'variant-record',
      recordRef: id && id !== '.' ? id : `${contig}:${positionText}:${ref}:${altText}`,
      provenanceClass: 'parsed-source-record',
    },
  ];
  return createGenomeObservation({
    observationId: observationId ?? `vcf:${contig}:${positionText}:${ref}:${altText}`,
    sampleRef: sampleRef ?? 'sample:unknown',
    locus: { assembly, contig, start: Number(positionText) },
    variant: { id: id === '.' ? null : id, ref, alts },
    genotype,
    quality: {
      score: qualText === '.' ? null : Number(qualText),
      filters: filterText === '.' ? [] : filterText.split(';').filter(Boolean),
      info,
    },
    evidence: mergedEvidence,
    governance,
  });
}

function createGenomeObservationUnchecked(input = {}) {
  assertObject(input, 'genome observation');
  const locus = normalizeGenomeLocus(input.locus ?? {});
  const variant = normalizeGenomeVariant(input.variant ?? {});
  const genotype = normalizeGenomeGenotype(input.genotype, { altCount: variant.alts.length });
  const evidence = (input.evidence ?? []).map((item, index) => normalizeGenomeEvidence(item, index));
  ensureUniqueIds(evidence, 'genome evidence');
  const evidenceIds = new Set(evidence.map(item => item.id));
  const claims = (input.claims ?? []).map((item, index) => normalizeGenomeClaim(item, evidenceIds, index));
  ensureUniqueIds(claims, 'genome claims');
  return {
    format: input.format ?? RCL_GENOME_IR_FORMAT,
    version: input.version ?? RCL_GENOME_IR_VERSION,
    observationId: nonEmptyString(input.observationId, 'genome observation observationId'),
    sampleRef: nonEmptyString(input.sampleRef, 'genome observation sampleRef'),
    specimenRef: optionalString(input.specimenRef),
    locus,
    variant,
    genotype,
    quality: normalizeGenomeQuality(input.quality ?? {}),
    evidence: Object.freeze(evidence),
    claims: Object.freeze(claims),
    governance: normalizeGenomeGovernance(input.governance ?? {}),
    foundation: normalizeFoundationBinding(input.foundation),
  };
}

function normalizeGenomeQuality(input = {}) {
  assertObject(input, 'genome quality');
  const score = input.score == null ? null : finiteNumber(input.score, 'genome quality score');
  return Object.freeze({
    score,
    filters: Object.freeze(stringArray(input.filters ?? [], 'genome quality filters')),
    info: normalizePlainObject(input.info ?? {}, 'genome quality info'),
  });
}

function normalizeFoundationBinding(input) {
  if (input == null) return RCL_GENOME_FOUNDATION_BINDING;
  assertObject(input, 'genome foundation binding');
  const domains = stringArray(input.domains ?? [], 'genome foundation domains');
  const crossDomainAxes = stringArray(input.crossDomainAxes ?? [], 'genome foundation crossDomainAxes');
  if (!sameStringArray(domains, RCL_GENOME_FOUNDATION_BINDING.domains) || !sameStringArray(crossDomainAxes, RCL_GENOME_FOUNDATION_BINDING.crossDomainAxes)) {
    throw new TypeError('genome foundation binding must preserve the canonical Genome IR domain and axis mapping');
  }
  return RCL_GENOME_FOUNDATION_BINDING;
}

function parseVcfGenotype(formatText, sampleText, altCount) {
  if (!formatText || !sampleText) return null;
  const keys = formatText.split(':');
  const values = sampleText.split(':');
  const gtIndex = keys.indexOf('GT');
  if (gtIndex < 0 || values[gtIndex] == null) return null;
  const raw = values[gtIndex];
  const phased = raw.includes('|');
  const parts = raw.split(phased ? '|' : '/');
  const alleles = parts.map(value => value === '.' ? null : Number(value));
  return normalizeGenomeGenotype({ alleles, phased }, { altCount });
}

function parseVcfInfo(infoText) {
  if (!infoText || infoText === '.') return Object.freeze({});
  const entries = infoText.split(';').filter(Boolean).map(item => {
    const index = item.indexOf('=');
    if (index < 0) return [item, true];
    return [item.slice(0, index), item.slice(index + 1)];
  });
  return Object.freeze(Object.fromEntries(entries));
}

function inferVariantType(ref, alts) {
  const types = new Set(alts.map(alt => {
    if (alt.startsWith('<') && alt.endsWith('>')) return 'symbolic';
    if (ref.length === 1 && alt.length === 1) return 'snv';
    if (ref.length === alt.length) return 'mnv';
    if (ref.length < alt.length) return 'insertion';
    return 'deletion';
  }));
  return types.size === 1 ? [...types][0] : 'mixed';
}

function claimEvidenceReferencesValid(observation) {
  const ids = new Set(observation.evidence.map(item => item.id));
  return observation.claims.every(claim => claim.evidenceRefs.every(ref => ids.has(ref)));
}

function normalizeClaimObject(value) {
  if (value === undefined) throw new TypeError('genome claim object is required');
  if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) return value;
  if (Array.isArray(value)) return Object.freeze(value.map(normalizeClaimObject));
  if (typeof value === 'object') return normalizePlainObject(value, 'genome claim object');
  throw new TypeError(`genome claim object has unsupported type: ${typeof value}`);
}

function normalizePlainObject(value, label) {
  assertObject(value, label);
  return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, item]) => [nonEmptyString(key, `${label} key`), normalizePlainValue(item, `${label}.${key}`)])));
}

function normalizePlainValue(value, label) {
  if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) {
    if (typeof value === 'number' && !Number.isFinite(value)) throw new TypeError(`${label} must be finite`);
    return value;
  }
  if (Array.isArray(value)) return Object.freeze(value.map((item, index) => normalizePlainValue(item, `${label}[${index}]`)));
  if (typeof value === 'object') return normalizePlainObject(value, label);
  throw new TypeError(`${label} has unsupported type: ${typeof value}`);
}

function ensureUniqueIds(items, label) {
  const ids = items.map(item => item.id);
  if (new Set(ids).size !== ids.length) throw new TypeError(`${label} ids must be unique`);
}

function sameStringArray(left, right) {
  return Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((value, index) => value === right[index]);
}

function alleleString(value, label) {
  const text = nonEmptyString(value, label).toUpperCase();
  if (/\s/.test(text)) throw new TypeError(`${label} must not contain whitespace`);
  return text;
}

function stringArray(value, label) {
  if (!Array.isArray(value)) throw new TypeError(`${label} must be an array`);
  return value.map((item, index) => nonEmptyString(item, `${label}[${index}]`));
}

function optionalString(value) {
  if (value == null) return null;
  return nonEmptyString(value, 'optional string');
}

function nonEmptyString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${label} must be a non-empty string`);
  return value.trim();
}

function positiveSafeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value <= 0) throw new RangeError(`${label} must be a positive safe integer`);
  return value;
}

function finiteNumber(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`${label} must be a finite number`);
  return value;
}

function optionalConfidence(value, label) {
  if (value == null) return null;
  const number = finiteNumber(value, label);
  if (number < 0 || number > 1) throw new RangeError(`${label} must be between 0 and 1`);
  return number;
}

function assertObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${label} must be an object`);
}
