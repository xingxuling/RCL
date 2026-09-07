import test from 'node:test';
import assert from 'node:assert/strict';
import { createGenomeObservation } from '../src/genome-ir.mjs';
import {
  createGenomeGraphEvidence,
  createGenomeKnowledgeGraph,
  createVepAnnotationBundle,
  lowerGenomeObservationToGraph,
  mergeGenomeGraphBundle,
  verifyGenomeKnowledgeGraph,
} from '../src/genome-knowledge-graph.mjs';

function observation(claimStatus = 'ASSOCIATED') {
  return createGenomeObservation({
    observationId: 'public:fixture:1',
    sampleRef: 'HG005',
    locus: { assembly: 'GRCh38', contig: 'chr1', start: 10177 },
    variant: { id: 'rs367896724', ref: 'A', alt: 'AC' },
    genotype: { alleles: [0, 1], phased: false },
    quality: { score: 99.7, filters: ['PASS'] },
    evidence: [{ id: 'gwas:e1', source: 'GWAS Catalog', sourceType: 'association', accession: 'GCST-fixture', confidence: 0.88 }],
    claims: [{
      id: 'trait:c1',
      predicate: 'trait_relation',
      object: 'fixture-trait',
      status: claimStatus,
      evidenceRefs: ['gwas:e1'],
      confidence: 0.72,
    }],
    governance: { accessTier: 'public', consentBasis: 'public-reference-resource' },
  });
}

test('Genome Knowledge Graph lowers a rooted observation without upgrading association to causality', () => {
  const graph = lowerGenomeObservationToGraph(observation());
  assert.equal(verifyGenomeKnowledgeGraph(graph).ok, true);
  assert.ok(graph.entities.some(item => item.kind === 'variant'));
  assert.ok(graph.entities.some(item => item.kind === 'sample'));
  assert.ok(graph.entities.some(item => item.kind === 'phenotype'));
  const relation = graph.relations.find(item => item.kind === 'associated-with');
  assert.equal(relation.status, 'ASSOCIATED');
  assert.match(graph.graphRoot, /^[a-f0-9]{64}$/);
});

test('A generic trait claim marked CAUSAL in Genome IR is downgraded until an explicit causes edge has causal basis', () => {
  const graph = lowerGenomeObservationToGraph(observation('CAUSAL'));
  const relation = graph.relations.find(item => item.kind === 'associated-with');
  assert.equal(relation.status, 'ASSOCIATED');
  assert.equal(relation.context.downgradedFrom, 'CAUSAL');
});

test('Explicit causal graph edges require evidence and a declared causal basis', () => {
  const entities = [
    { id: 'variant:v1', kind: 'variant', referenceAssembly: 'GRCh38' },
    { id: 'phenotype:p1', kind: 'phenotype', label: 'fixture phenotype' },
  ];
  const evidence = [createGenomeGraphEvidence({
    id: 'evidence:experiment:1',
    source: 'fixture-experiment',
    sourceType: 'experimental',
  })];
  assert.throws(() => createGenomeKnowledgeGraph({
    graphId: 'causal-without-basis',
    referenceAssemblies: ['GRCh38'],
    entities,
    evidence,
    relations: [{
      id: 'r1', from: 'variant:v1', to: 'phenotype:p1', kind: 'causes', status: 'CAUSAL', evidenceRefs: ['evidence:experiment:1'],
    }],
  }), /requires explicit causalBasis/);

  const graph = createGenomeKnowledgeGraph({
    graphId: 'causal-with-basis',
    referenceAssemblies: ['GRCh38'],
    entities,
    evidence,
    relations: [{
      id: 'r1', from: 'variant:v1', to: 'phenotype:p1', kind: 'causes', status: 'CAUSAL',
      evidenceRefs: ['evidence:experiment:1'],
      causalBasis: [{ method: 'bounded-experimental-intervention', result: 'fixture-only' }],
    }],
  });
  assert.equal(verifyGenomeKnowledgeGraph(graph).ok, true);
});

test('VEP annotation bundles extend variant graphs with gene and transcript consequence edges', () => {
  const base = lowerGenomeObservationToGraph(observation());
  const variant = base.entities.find(item => item.kind === 'variant');
  const bundle = createVepAnnotationBundle({
    variantEntityId: variant.id,
    referenceAssembly: 'GRCh38',
    providerVersion: 'fixture',
    annotations: [{
      geneId: 'ENSG000001',
      geneSymbol: 'FIX1',
      transcriptId: 'ENST000001',
      consequence: 'missense_variant',
      impact: 'MODERATE',
      confidence: 0.9,
    }],
  });
  const merged = mergeGenomeGraphBundle(base, bundle);
  assert.equal(verifyGenomeKnowledgeGraph(merged).ok, true);
  assert.ok(merged.entities.some(item => item.id === 'gene:ENSG000001'));
  assert.ok(merged.entities.some(item => item.id === 'transcript:ENST000001'));
  assert.ok(merged.relations.some(item => item.kind === 'maps-to-gene'));
  assert.ok(merged.relations.some(item => item.kind === 'transcript-consequence'));
});

test('Genome Knowledge Graph rejects forged roots', () => {
  const graph = lowerGenomeObservationToGraph(observation());
  assert.equal(verifyGenomeKnowledgeGraph({ ...graph, graphRoot: '0'.repeat(64) }).ok, false);
});
