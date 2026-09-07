import { realityRoot } from './canonical.mjs';
import {
  createGenomeEntity,
  createGenomeGraphEvidence,
  createGenomeKnowledgeGraph,
  verifyGenomeKnowledgeGraph,
} from './genome-knowledge-graph.mjs';

export const RCL_GENOME_PUBLIC_EVIDENCE_VERSION = '0.1.0';
export const RCL_GENOME_PUBLIC_EVIDENCE_BUNDLE_FORMAT = 'rcl.genome-public-evidence-bundle.v0.1';

export function createPopulationFrequencyBundle(input = {}) {
  assertObject(input, 'population frequency input');
  const variantEntityId = nonEmptyString(input.variantEntityId, 'population frequency variantEntityId');
  const datasetId = nonEmptyString(input.datasetId ?? 'gnomad', 'population frequency datasetId');
  const populationId = nonEmptyString(input.populationId ?? 'global', 'population frequency populationId');
  const alleleFrequency = unitInterval(input.alleleFrequency, 'population frequency alleleFrequency');
  const alleleCount = nonNegativeIntegerOrNull(input.alleleCount, 'population frequency alleleCount');
  const alleleNumber = positiveIntegerOrNull(input.alleleNumber, 'population frequency alleleNumber');
  if (alleleCount != null && alleleNumber != null && alleleCount > alleleNumber) {
    throw new RangeError('population frequency alleleCount cannot exceed alleleNumber');
  }
  const source = nonEmptyString(input.source ?? datasetId, 'population frequency source');
  const evidence = createGenomeGraphEvidence({
    id: input.evidenceId ?? `evidence:${datasetId}:${populationId}:${realityRoot({ variantEntityId, alleleFrequency, alleleCount, alleleNumber }).slice(0, 16)}`,
    source,
    sourceType: 'population-frequency',
    accession: input.accession ?? null,
    recordRef: input.recordRef ?? null,
    provenanceClass: input.provenanceClass ?? 'public-aggregate-resource',
    confidence: input.confidence ?? null,
    payloadRoot: input.payloadRoot ?? null,
    metadata: {
      datasetId,
      datasetVersion: input.datasetVersion ?? null,
      referenceAssembly: input.referenceAssembly ?? null,
      query: structuredClone(input.query ?? {}),
    },
  });
  const datasetEntity = createGenomeEntity({
    id: `dataset:${datasetId}`,
    kind: 'dataset',
    label: input.datasetLabel ?? datasetId,
    referenceAssembly: input.referenceAssembly ?? null,
    identifiers: { dataset: datasetId, version: input.datasetVersion ?? null },
    sourceRefs: [source],
  });
  const populationEntity = createGenomeEntity({
    id: `population:${datasetId}:${populationId}`,
    kind: 'population',
    label: input.populationLabel ?? populationId,
    attributes: {
      populationId,
      ancestryLabel: input.ancestryLabel ?? null,
      datasetId,
    },
    sourceRefs: [source],
  });
  return bundle({
    bundleId: input.bundleId ?? `population-frequency:${datasetId}:${populationId}`,
    sourceKind: 'population-frequency',
    variantEntityId,
    entities: [datasetEntity, populationEntity],
    evidence: [evidence],
    relations: [
      {
        id: `frequency:${datasetId}:${populationId}:${realityRoot({ variantEntityId, alleleFrequency }).slice(0, 16)}`,
        from: variantEntityId,
        to: datasetEntity.id,
        kind: 'derived-from-dataset',
        status: 'OBSERVED',
        confidence: input.confidence ?? null,
        evidenceRefs: [evidence.id],
        causalBasis: [],
        context: {
          populationEntityId: populationEntity.id,
          alleleFrequency,
          alleleCount,
          alleleNumber,
          homozygoteCount: nonNegativeIntegerOrNull(input.homozygoteCount, 'population frequency homozygoteCount'),
          ancestryLabel: input.ancestryLabel ?? null,
          aggregateOnly: true,
        },
      },
    ],
    metadata: {
      associationNotCausality: true,
      aggregateFrequencyNotIndividualDiagnosis: true,
    },
  });
}

export function createGwasAssociationBundle(input = {}) {
  assertObject(input, 'GWAS association input');
  const variantEntityId = nonEmptyString(input.variantEntityId, 'GWAS variantEntityId');
  const studyId = nonEmptyString(input.studyId, 'GWAS studyId');
  const phenotypeId = nonEmptyString(input.phenotypeId, 'GWAS phenotypeId');
  const source = nonEmptyString(input.source ?? 'NHGRI-EBI GWAS Catalog', 'GWAS source');
  const evidence = createGenomeGraphEvidence({
    id: input.evidenceId ?? `evidence:gwas:${studyId}:${realityRoot({ variantEntityId, phenotypeId, recordRef: input.recordRef ?? null }).slice(0, 16)}`,
    source,
    sourceType: 'association-evidence',
    accession: input.accession ?? studyId,
    recordRef: input.recordRef ?? null,
    provenanceClass: input.provenanceClass ?? 'public-curated-resource',
    confidence: input.confidence ?? null,
    payloadRoot: input.payloadRoot ?? null,
    metadata: {
      catalogVersion: input.catalogVersion ?? null,
      referenceAssembly: input.referenceAssembly ?? null,
      retrievedAt: input.retrievedAt ?? null,
    },
  });
  const studyEntity = createGenomeEntity({
    id: `study:${studyId}`,
    kind: 'study',
    label: input.studyLabel ?? studyId,
    identifiers: { studyId, pubmedId: input.pubmedId ?? null },
    attributes: {
      ancestry: input.ancestry ?? null,
      sampleSize: positiveIntegerOrNull(input.sampleSize, 'GWAS sampleSize'),
    },
    sourceRefs: [source],
  });
  const phenotypeEntity = createGenomeEntity({
    id: `phenotype:${phenotypeId}`,
    kind: 'phenotype',
    label: input.phenotypeLabel ?? phenotypeId,
    identifiers: { phenotypeId, efoId: input.efoId ?? null },
    sourceRefs: [source],
  });
  const associationId = `gwas-association:${studyId}:${realityRoot({ variantEntityId, phenotypeId, effectAllele: input.effectAllele ?? null }).slice(0, 16)}`;
  return bundle({
    bundleId: input.bundleId ?? associationId,
    sourceKind: 'association-evidence',
    variantEntityId,
    entities: [studyEntity, phenotypeEntity],
    evidence: [evidence],
    relations: [
      {
        id: associationId,
        from: variantEntityId,
        to: phenotypeEntity.id,
        kind: 'associated-with',
        status: 'ASSOCIATED',
        confidence: input.confidence ?? null,
        evidenceRefs: [evidence.id],
        causalBasis: [],
        context: {
          studyEntityId: studyEntity.id,
          pValue: finiteNumberOrStringOrNull(input.pValue, 'GWAS pValue'),
          effectSize: finiteNumberOrNull(input.effectSize, 'GWAS effectSize'),
          effectSizeType: input.effectSizeType ?? null,
          effectAllele: input.effectAllele ?? null,
          otherAllele: input.otherAllele ?? null,
          ancestry: input.ancestry ?? null,
          sampleSize: input.sampleSize ?? null,
        },
      },
      {
        id: `reported-by:${studyId}:${variantEntityId}`,
        from: variantEntityId,
        to: studyEntity.id,
        kind: 'reported-by-study',
        status: 'OBSERVED',
        confidence: input.confidence ?? null,
        evidenceRefs: [evidence.id],
        causalBasis: [],
        context: { associationRelationId: associationId },
      },
    ],
    metadata: {
      associationNotCausality: true,
      causalClaimCreated: false,
    },
  });
}

export function createClinvarInterpretationBundle(input = {}) {
  assertObject(input, 'ClinVar interpretation input');
  const variantEntityId = nonEmptyString(input.variantEntityId, 'ClinVar variantEntityId');
  const accession = nonEmptyString(input.accession, 'ClinVar accession');
  const significance = nonEmptyString(input.clinicalSignificance ?? input.significance, 'ClinVar clinicalSignificance');
  const source = nonEmptyString(input.source ?? 'ClinVar', 'ClinVar source');
  const datasetEntity = createGenomeEntity({
    id: 'dataset:clinvar',
    kind: 'dataset',
    label: 'ClinVar',
    identifiers: { accession },
    attributes: { release: input.release ?? null },
    sourceRefs: [source],
  });
  const evidence = createGenomeGraphEvidence({
    id: input.evidenceId ?? `evidence:clinvar:${accession}`,
    source,
    sourceType: 'submitted-variant-interpretation',
    accession,
    recordRef: input.recordRef ?? accession,
    provenanceClass: input.provenanceClass ?? 'public-aggregate-resource',
    confidence: input.confidence ?? null,
    payloadRoot: input.payloadRoot ?? null,
    metadata: {
      reviewStatus: input.reviewStatus ?? null,
      submitterCount: nonNegativeIntegerOrNull(input.submitterCount, 'ClinVar submitterCount'),
      lastEvaluated: input.lastEvaluated ?? null,
    },
  });
  return bundle({
    bundleId: input.bundleId ?? `clinvar:${accession}`,
    sourceKind: 'submitted-variant-interpretation',
    variantEntityId,
    entities: [datasetEntity],
    evidence: [evidence],
    relations: [{
      id: `clinvar-context:${accession}:${variantEntityId}`,
      from: variantEntityId,
      to: datasetEntity.id,
      kind: 'derived-from-dataset',
      status: 'DERIVED',
      confidence: input.confidence ?? null,
      evidenceRefs: [evidence.id],
      causalBasis: [],
      context: {
        clinicalSignificance: significance,
        reviewStatus: input.reviewStatus ?? null,
        conditionNames: Array.isArray(input.conditionNames) ? [...input.conditionNames].map(String) : [],
        submittedInterpretationNotDiagnosticTruth: true,
      },
    }],
    metadata: {
      associationNotCausality: true,
      submittedInterpretationNotDiagnosticTruth: true,
      automaticDiagnosis: false,
    },
  });
}

export function mergeGenomePublicEvidenceBundle(graph, extension) {
  const check = verifyGenomeKnowledgeGraph(graph);
  if (!check.ok) throw new TypeError('Cannot merge public evidence into invalid Genome Knowledge Graph');
  if (!extension || extension.format !== RCL_GENOME_PUBLIC_EVIDENCE_BUNDLE_FORMAT) throw new TypeError('Invalid Genome public evidence bundle');
  if (!graph.entities.some(item => item.id === extension.variantEntityId)) throw new TypeError(`Public evidence variant '${extension.variantEntityId}' is absent from graph`);
  return createGenomeKnowledgeGraph({
    graphId: graph.graphId,
    referenceAssemblies: [...graph.referenceAssemblies, ...(extension.referenceAssembly ? [extension.referenceAssembly] : [])],
    entities: uniqueById([...graph.entities, ...extension.entities]),
    evidence: uniqueById([...graph.evidence, ...extension.evidence]),
    relations: uniqueById([...graph.relations, ...extension.relations]),
    sourceObservationRoots: graph.sourceObservationRoots,
    governance: graph.governance,
  });
}

function bundle({ bundleId, sourceKind, variantEntityId, entities, relations, evidence, metadata = {}, referenceAssembly = null }) {
  const payload = {
    format: RCL_GENOME_PUBLIC_EVIDENCE_BUNDLE_FORMAT,
    version: RCL_GENOME_PUBLIC_EVIDENCE_VERSION,
    bundleId,
    sourceKind,
    variantEntityId,
    referenceAssembly,
    entities: entities.map(item => structuredClone(item)),
    relations: relations.map(item => structuredClone(item)),
    evidence: evidence.map(item => structuredClone(item)),
    metadata: structuredClone(metadata),
  };
  return Object.freeze({ ...payload, bundleRoot: realityRoot(payload) });
}

function uniqueById(values) {
  const map = new Map();
  for (const item of values) if (!map.has(item.id)) map.set(item.id, structuredClone(item));
  return [...map.values()];
}

function assertObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${label} must be an object`);
}

function nonEmptyString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${label} must be a non-empty string`);
  return value.trim();
}

function unitInterval(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 1) throw new RangeError(`${label} must be between 0 and 1`);
  return number;
}

function nonNegativeIntegerOrNull(value, label) {
  if (value == null) return null;
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError(`${label} must be a non-negative safe integer`);
  return value;
}

function positiveIntegerOrNull(value, label) {
  if (value == null) return null;
  if (!Number.isSafeInteger(value) || value <= 0) throw new RangeError(`${label} must be a positive safe integer`);
  return value;
}

function finiteNumberOrNull(value, label) {
  if (value == null) return null;
  const number = Number(value);
  if (!Number.isFinite(number)) throw new RangeError(`${label} must be finite`);
  return number;
}

function finiteNumberOrStringOrNull(value, label) {
  if (value == null) return null;
  if (typeof value === 'string' && value.trim()) return value.trim();
  return finiteNumberOrNull(value, label);
}
