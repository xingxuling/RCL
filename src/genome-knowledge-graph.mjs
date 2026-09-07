import { realityRoot } from './canonical.mjs';
import { verifyGenomeObservation } from './genome-ir.mjs';

export const RCL_GENOME_KNOWLEDGE_GRAPH_VERSION = '0.1.0';
export const RCL_GENOME_KNOWLEDGE_GRAPH_FORMAT = 'rcl.genome-knowledge-graph.v0.1';
export const RCL_GENOME_ANNOTATION_BUNDLE_FORMAT = 'rcl.genome-annotation-bundle.v0.1';

export const RCL_GENOME_ENTITY_KINDS = Object.freeze([
  'sample', 'variant', 'genomic-feature', 'gene', 'transcript', 'protein',
  'pathway', 'phenotype', 'population', 'study', 'evidence', 'dataset',
]);

export const RCL_GENOME_RELATION_KINDS = Object.freeze([
  'observed-in', 'overlaps', 'maps-to-gene', 'transcript-consequence',
  'encodes', 'participates-in', 'associated-with', 'supports', 'contradicts',
  'causes', 'member-of-population', 'reported-by-study', 'derived-from-dataset',
]);

export const RCL_GENOME_RELATION_STATUSES = Object.freeze([
  'OBSERVED', 'DERIVED', 'ASSOCIATED', 'CAUSAL', 'PREDICTED', 'CONTRADICTED', 'UNKNOWN',
]);

const ENTITY_KINDS = new Set(RCL_GENOME_ENTITY_KINDS);
const RELATION_KINDS = new Set(RCL_GENOME_RELATION_KINDS);
const RELATION_STATUSES = new Set(RCL_GENOME_RELATION_STATUSES);

export function createGenomeEntity(input = {}) {
  assertObject(input, 'genome entity');
  const kind = nonEmptyString(input.kind, 'genome entity kind');
  if (!ENTITY_KINDS.has(kind)) throw new TypeError(`Unsupported genome entity kind '${kind}'`);
  return Object.freeze({
    id: nonEmptyString(input.id, 'genome entity id'),
    kind,
    label: input.label == null ? null : nonEmptyString(input.label, 'genome entity label'),
    referenceAssembly: input.referenceAssembly ?? null,
    identifiers: normalizePlainObject(input.identifiers ?? {}, 'genome entity identifiers'),
    attributes: normalizePlainObject(input.attributes ?? {}, 'genome entity attributes'),
    sourceRefs: Object.freeze(uniqueStrings(input.sourceRefs ?? [], 'genome entity sourceRefs')),
  });
}

export function createGenomeGraphEvidence(input = {}) {
  assertObject(input, 'genome graph evidence');
  return Object.freeze({
    id: nonEmptyString(input.id, 'genome graph evidence id'),
    source: nonEmptyString(input.source, 'genome graph evidence source'),
    sourceType: nonEmptyString(input.sourceType ?? 'dataset', 'genome graph evidence sourceType'),
    recordRef: input.recordRef ?? null,
    accession: input.accession ?? null,
    provenanceClass: nonEmptyString(input.provenanceClass ?? 'declared', 'genome graph evidence provenanceClass'),
    confidence: optionalConfidence(input.confidence, 'genome graph evidence confidence'),
    payloadRoot: input.payloadRoot ?? null,
    metadata: normalizePlainObject(input.metadata ?? {}, 'genome graph evidence metadata'),
  });
}

export function createGenomeRelation(input = {}, { entityIds = new Set(), evidenceIds = new Set() } = {}) {
  assertObject(input, 'genome relation');
  const kind = nonEmptyString(input.kind, 'genome relation kind');
  if (!RELATION_KINDS.has(kind)) throw new TypeError(`Unsupported genome relation kind '${kind}'`);
  const status = nonEmptyString(input.status ?? defaultRelationStatus(kind), 'genome relation status').toUpperCase();
  if (!RELATION_STATUSES.has(status)) throw new TypeError(`Unsupported genome relation status '${status}'`);
  const from = nonEmptyString(input.from, 'genome relation from');
  const to = nonEmptyString(input.to, 'genome relation to');
  if (entityIds.size && !entityIds.has(from)) throw new TypeError(`Genome relation references unknown from entity '${from}'`);
  if (entityIds.size && !entityIds.has(to)) throw new TypeError(`Genome relation references unknown to entity '${to}'`);
  const evidenceRefs = uniqueStrings(input.evidenceRefs ?? [], 'genome relation evidenceRefs');
  for (const ref of evidenceRefs) if (evidenceIds.size && !evidenceIds.has(ref)) throw new TypeError(`Genome relation references unknown evidence '${ref}'`);

  if (kind === 'associated-with' && status === 'CAUSAL') {
    throw new TypeError('Genome association relation cannot be upgraded to CAUSAL; use an explicit causes relation with causal basis');
  }
  if (status === 'CAUSAL') {
    if (kind !== 'causes') throw new TypeError(`CAUSAL status requires relation kind 'causes', received '${kind}'`);
    if (evidenceRefs.length === 0) throw new TypeError('CAUSAL genome relation requires evidenceRefs');
    if (!Array.isArray(input.causalBasis) || input.causalBasis.length === 0) throw new TypeError('CAUSAL genome relation requires explicit causalBasis');
  }
  if (['ASSOCIATED', 'CONTRADICTED'].includes(status) && evidenceRefs.length === 0) {
    throw new TypeError(`${status} genome relation requires evidenceRefs`);
  }

  return Object.freeze({
    id: nonEmptyString(input.id, 'genome relation id'),
    from,
    to,
    kind,
    status,
    confidence: optionalConfidence(input.confidence, 'genome relation confidence'),
    evidenceRefs: Object.freeze(evidenceRefs),
    causalBasis: Object.freeze((input.causalBasis ?? []).map(item => structuredClone(item))),
    context: normalizePlainObject(input.context ?? {}, 'genome relation context'),
  });
}

export function createGenomeKnowledgeGraph(input = {}) {
  assertObject(input, 'genome knowledge graph');
  const entities = (input.entities ?? []).map(createGenomeEntity);
  ensureUniqueIds(entities, 'genome entities');
  const evidence = (input.evidence ?? []).map(createGenomeGraphEvidence);
  ensureUniqueIds(evidence, 'genome graph evidence');
  const entityIds = new Set(entities.map(item => item.id));
  const evidenceIds = new Set(evidence.map(item => item.id));
  const relations = (input.relations ?? []).map(item => createGenomeRelation(item, { entityIds, evidenceIds }));
  ensureUniqueIds(relations, 'genome relations');

  const payload = {
    format: input.format ?? RCL_GENOME_KNOWLEDGE_GRAPH_FORMAT,
    version: input.version ?? RCL_GENOME_KNOWLEDGE_GRAPH_VERSION,
    graphId: nonEmptyString(input.graphId, 'genome knowledge graph graphId'),
    referenceAssemblies: Object.freeze(uniqueStrings(input.referenceAssemblies ?? [], 'genome graph referenceAssemblies')),
    entities: Object.freeze(entities),
    relations: Object.freeze(relations),
    evidence: Object.freeze(evidence),
    sourceObservationRoots: Object.freeze(uniqueStrings(input.sourceObservationRoots ?? [], 'genome graph sourceObservationRoots')),
    governance: Object.freeze({
      accessTiers: Object.freeze(uniqueStrings(input.governance?.accessTiers ?? ['public'], 'genome graph governance accessTiers')),
      authorityRequired: Object.freeze(uniqueStrings(input.governance?.authorityRequired ?? [], 'genome graph governance authorityRequired')),
      candidateOnly: input.governance?.candidateOnly !== false,
      associationNotCausality: true,
    }),
  };
  const graph = Object.freeze({ ...payload, graphRoot: input.graphRoot ?? realityRoot(payload) });
  const verification = verifyGenomeKnowledgeGraph(graph);
  if (!verification.ok) throw new TypeError(`invalid Genome Knowledge Graph: ${verification.reason ?? 'verification failed'}`);
  return graph;
}

export function verifyGenomeKnowledgeGraph(graph) {
  if (!graph || typeof graph !== 'object' || Array.isArray(graph)) return { ok: false, reason: 'genome graph must be an object' };
  try {
    const { graphRoot, ...payload } = graph;
    const normalized = createGenomeKnowledgeGraphUnchecked(payload);
    const entityIds = new Set(normalized.entities.map(item => item.id));
    const evidenceIds = new Set(normalized.evidence.map(item => item.id));
    const checks = {
      format: normalized.format === RCL_GENOME_KNOWLEDGE_GRAPH_FORMAT,
      version: normalized.version === RCL_GENOME_KNOWLEDGE_GRAPH_VERSION,
      root: typeof graphRoot === 'string' && graphRoot === realityRoot(payload),
      entityRefs: normalized.relations.every(item => entityIds.has(item.from) && entityIds.has(item.to)),
      evidenceRefs: normalized.relations.every(item => item.evidenceRefs.every(ref => evidenceIds.has(ref))),
      associationBoundary: normalized.relations.every(item => !(item.kind === 'associated-with' && item.status === 'CAUSAL')),
      causalBoundary: normalized.relations.every(item => item.status !== 'CAUSAL' || (item.kind === 'causes' && item.evidenceRefs.length > 0 && item.causalBasis.length > 0)),
    };
    return { ok: Object.values(checks).every(Boolean), checks, expectedRoot: realityRoot(payload), actualRoot: graphRoot ?? null };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
}

export function lowerGenomeObservationToGraph(observation, options = {}) {
  const check = verifyGenomeObservation(observation);
  if (!check.ok) throw new TypeError(`Cannot lower invalid Genome IR observation: ${check.reason ?? 'verification failed'}`);
  const variantId = options.variantEntityId ?? `variant:${observation.observationRoot.slice(0, 24)}`;
  const sampleId = options.sampleEntityId ?? `sample:${observation.sampleRef}`;
  const entities = [
    createGenomeEntity({
      id: sampleId,
      kind: 'sample',
      label: observation.sampleRef,
      sourceRefs: [observation.observationRoot],
      attributes: { specimenRef: observation.specimenRef, accessTier: observation.governance.accessTier },
    }),
    createGenomeEntity({
      id: variantId,
      kind: 'variant',
      label: observation.variant.id ?? `${observation.locus.contig}:${observation.locus.start}:${observation.variant.ref}:${observation.variant.alts.join(',')}`,
      referenceAssembly: observation.locus.assembly,
      identifiers: { variantId: observation.variant.id },
      attributes: { locus: observation.locus, variant: observation.variant, genotype: observation.genotype, quality: observation.quality },
      sourceRefs: [observation.observationRoot],
    }),
  ];
  const evidence = observation.evidence.map(item => createGenomeGraphEvidence({
    id: `${observation.observationRoot.slice(0, 12)}:${item.id}`,
    source: item.source,
    sourceType: item.sourceType,
    recordRef: item.recordRef,
    accession: item.accession,
    provenanceClass: item.provenanceClass,
    confidence: item.confidence,
    payloadRoot: observation.observationRoot,
  }));
  const evidenceMap = new Map(observation.evidence.map((item, index) => [item.id, evidence[index].id]));
  const relations = [{
    id: `observed-in:${observation.observationRoot.slice(0, 24)}`,
    from: variantId,
    to: sampleId,
    kind: 'observed-in',
    status: 'OBSERVED',
    evidenceRefs: evidence.map(item => item.id),
    confidence: observation.quality?.score == null ? null : 1,
  }];

  const extraEntities = [];
  for (const claim of observation.claims) {
    if (claim.predicate === 'trait_relation' || claim.predicate === 'associated_with') {
      const phenotypeId = `phenotype:${String(claim.object)}`;
      if (!extraEntities.some(item => item.id === phenotypeId)) extraEntities.push(createGenomeEntity({ id: phenotypeId, kind: 'phenotype', label: String(claim.object) }));
      relations.push({
        id: `claim:${observation.observationRoot.slice(0, 12)}:${claim.id}`,
        from: variantId,
        to: phenotypeId,
        kind: 'associated-with',
        status: claim.status === 'CAUSAL' ? 'ASSOCIATED' : claim.status,
        confidence: claim.confidence,
        evidenceRefs: claim.evidenceRefs.map(ref => evidenceMap.get(ref)).filter(Boolean),
        context: claim.status === 'CAUSAL' ? { downgradedFrom: 'CAUSAL', reason: 'Genome IR trait_relation is not sufficient to establish an explicit causes edge' } : {},
      });
    }
  }

  return createGenomeKnowledgeGraph({
    graphId: options.graphId ?? `genome-observation-graph:${observation.observationId}`,
    referenceAssemblies: [observation.locus.assembly],
    entities: [...entities, ...extraEntities],
    relations,
    evidence,
    sourceObservationRoots: [observation.observationRoot],
    governance: {
      accessTiers: [observation.governance.accessTier],
      authorityRequired: observation.governance.authorityRequired,
      candidateOnly: true,
    },
  });
}

export function createVepAnnotationBundle(input = {}) {
  assertObject(input, 'VEP annotation bundle');
  const variantEntityId = nonEmptyString(input.variantEntityId, 'VEP variantEntityId');
  const sourceRef = nonEmptyString(input.sourceRef ?? 'Ensembl-VEP', 'VEP sourceRef');
  const rows = Array.isArray(input.annotations) ? input.annotations : [];
  const entities = [];
  const relations = [];
  const evidence = [createGenomeGraphEvidence({
    id: `evidence:vep:${realityRoot({ sourceRef, variantEntityId, rows }).slice(0, 20)}`,
    source: sourceRef,
    sourceType: 'functional-annotation-provider',
    provenanceClass: 'provider-output',
    payloadRoot: realityRoot(rows),
    metadata: { providerVersion: input.providerVersion ?? null, referenceAssembly: input.referenceAssembly ?? null },
  })];
  const evidenceId = evidence[0].id;

  rows.forEach((row, index) => {
    assertObject(row, `VEP annotation[${index}]`);
    const geneId = row.geneId ? `gene:${row.geneId}` : null;
    const transcriptId = row.transcriptId ? `transcript:${row.transcriptId}` : null;
    if (geneId && !entities.some(item => item.id === geneId)) entities.push(createGenomeEntity({
      id: geneId,
      kind: 'gene',
      label: row.geneSymbol ?? row.geneId,
      referenceAssembly: input.referenceAssembly ?? null,
      identifiers: { ensemblGene: row.geneId, symbol: row.geneSymbol ?? null },
      sourceRefs: [sourceRef],
    }));
    if (transcriptId && !entities.some(item => item.id === transcriptId)) entities.push(createGenomeEntity({
      id: transcriptId,
      kind: 'transcript',
      label: row.transcriptId,
      referenceAssembly: input.referenceAssembly ?? null,
      identifiers: { ensemblTranscript: row.transcriptId },
      attributes: { biotype: row.biotype ?? null },
      sourceRefs: [sourceRef],
    }));
    if (geneId) relations.push({
      id: `vep:gene:${index + 1}:${geneId}`,
      from: variantEntityId,
      to: geneId,
      kind: 'maps-to-gene',
      status: 'DERIVED',
      evidenceRefs: [evidenceId],
      confidence: row.confidence ?? null,
      context: { consequence: row.consequence ?? null },
    });
    if (transcriptId) relations.push({
      id: `vep:transcript:${index + 1}:${transcriptId}`,
      from: variantEntityId,
      to: transcriptId,
      kind: 'transcript-consequence',
      status: 'DERIVED',
      evidenceRefs: [evidenceId],
      confidence: row.confidence ?? null,
      context: { consequence: row.consequence ?? null, impact: row.impact ?? null },
    });
  });

  const payload = {
    format: RCL_GENOME_ANNOTATION_BUNDLE_FORMAT,
    version: RCL_GENOME_KNOWLEDGE_GRAPH_VERSION,
    variantEntityId,
    referenceAssembly: input.referenceAssembly ?? null,
    entities,
    relations,
    evidence,
    sourceRef,
  };
  return Object.freeze({ ...payload, bundleRoot: realityRoot(payload) });
}

export function mergeGenomeGraphBundle(graph, bundle) {
  const check = verifyGenomeKnowledgeGraph(graph);
  if (!check.ok) throw new TypeError('Cannot merge annotation bundle into invalid Genome Knowledge Graph');
  if (!bundle || bundle.format !== RCL_GENOME_ANNOTATION_BUNDLE_FORMAT) throw new TypeError('Invalid Genome annotation bundle');
  if (!graph.entities.some(item => item.id === bundle.variantEntityId)) throw new TypeError(`Annotation bundle variant '${bundle.variantEntityId}' is absent from graph`);
  return createGenomeKnowledgeGraph({
    graphId: graph.graphId,
    referenceAssemblies: [...graph.referenceAssemblies, ...(bundle.referenceAssembly ? [bundle.referenceAssembly] : [])],
    entities: uniqueById([...graph.entities, ...bundle.entities]),
    evidence: uniqueById([...graph.evidence, ...bundle.evidence]),
    relations: uniqueById([...graph.relations, ...bundle.relations]),
    sourceObservationRoots: graph.sourceObservationRoots,
    governance: graph.governance,
  });
}

function createGenomeKnowledgeGraphUnchecked(input = {}) {
  const entities = (input.entities ?? []).map(createGenomeEntity);
  ensureUniqueIds(entities, 'genome entities');
  const evidence = (input.evidence ?? []).map(createGenomeGraphEvidence);
  ensureUniqueIds(evidence, 'genome graph evidence');
  const entityIds = new Set(entities.map(item => item.id));
  const evidenceIds = new Set(evidence.map(item => item.id));
  const relations = (input.relations ?? []).map(item => createGenomeRelation(item, { entityIds, evidenceIds }));
  ensureUniqueIds(relations, 'genome relations');
  return {
    format: input.format ?? RCL_GENOME_KNOWLEDGE_GRAPH_FORMAT,
    version: input.version ?? RCL_GENOME_KNOWLEDGE_GRAPH_VERSION,
    graphId: nonEmptyString(input.graphId, 'genome knowledge graph graphId'),
    referenceAssemblies: Object.freeze(uniqueStrings(input.referenceAssemblies ?? [], 'genome graph referenceAssemblies')),
    entities: Object.freeze(entities),
    relations: Object.freeze(relations),
    evidence: Object.freeze(evidence),
    sourceObservationRoots: Object.freeze(uniqueStrings(input.sourceObservationRoots ?? [], 'genome graph sourceObservationRoots')),
    governance: Object.freeze({
      accessTiers: Object.freeze(uniqueStrings(input.governance?.accessTiers ?? ['public'], 'genome graph governance accessTiers')),
      authorityRequired: Object.freeze(uniqueStrings(input.governance?.authorityRequired ?? [], 'genome graph governance authorityRequired')),
      candidateOnly: input.governance?.candidateOnly !== false,
      associationNotCausality: true,
    }),
  };
}

function defaultRelationStatus(kind) {
  if (kind === 'associated-with') return 'ASSOCIATED';
  if (kind === 'causes') return 'CAUSAL';
  if (['maps-to-gene', 'transcript-consequence', 'encodes', 'participates-in'].includes(kind)) return 'DERIVED';
  return 'OBSERVED';
}

function ensureUniqueIds(values, label) {
  const ids = values.map(item => item.id);
  if (new Set(ids).size !== ids.length) throw new TypeError(`${label} must have unique ids`);
}

function uniqueById(values) {
  const map = new Map();
  for (const value of values) if (!map.has(value.id)) map.set(value.id, structuredClone(value));
  return [...map.values()];
}

function uniqueStrings(values, label) {
  if (!Array.isArray(values)) throw new TypeError(`${label} must be an array`);
  return [...new Set(values.map((value, index) => nonEmptyString(String(value), `${label}[${index}]`)))];
}

function normalizePlainObject(value, label) {
  assertObject(value, label);
  return structuredClone(value);
}

function optionalConfidence(value, label) {
  if (value == null) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 1) throw new RangeError(`${label} must be between 0 and 1`);
  return number;
}

function assertObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${label} must be an object`);
}

function nonEmptyString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${label} must be a non-empty string`);
  return value.trim();
}
