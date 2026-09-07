import test from 'node:test';
import assert from 'node:assert/strict';
import { createGenomeObservation } from '../src/genome-ir.mjs';
import { lowerGenomeObservationToGraph, verifyGenomeKnowledgeGraph } from '../src/genome-knowledge-graph.mjs';
import {
  createClinvarInterpretationBundle,
  createGwasAssociationBundle,
  createPopulationFrequencyBundle,
  mergeGenomePublicEvidenceBundle,
} from '../src/genome-public-evidence.mjs';

function baseGraph() {
  const observation = createGenomeObservation({
    observationId: 'fixture:public:variant',
    sampleRef: 'HG005',
    locus: { assembly: 'GRCh38', contig: 'chr1', start: 10177 },
    variant: { id: 'rs-fixture', ref: 'A', alt: 'G' },
    genotype: { alleles: [0, 1], phased: false },
    quality: { score: 99, filters: ['PASS'] },
    evidence: [{ id: 'e1', source: 'GIAB', sourceType: 'benchmark' }],
    claims: [],
    governance: { accessTier: 'public', consentBasis: 'public-reference-resource' },
  });
  return lowerGenomeObservationToGraph(observation);
}

test('Population-frequency bundle preserves aggregate context without diagnosing an individual', () => {
  const graph = baseGraph();
  const variant = graph.entities.find(item => item.kind === 'variant');
  const bundle = createPopulationFrequencyBundle({
    variantEntityId: variant.id,
    datasetId: 'gnomad-v4',
    datasetLabel: 'gnomAD v4 fixture',
    populationId: 'eas',
    populationLabel: 'East Asian aggregate',
    ancestryLabel: 'East Asian',
    alleleFrequency: 0.0125,
    alleleCount: 25,
    alleleNumber: 2000,
    referenceAssembly: 'GRCh38',
    source: 'gnomAD',
  });
  assert.equal(bundle.metadata.aggregateFrequencyNotIndividualDiagnosis, true);
  const merged = mergeGenomePublicEvidenceBundle(graph, bundle);
  assert.equal(verifyGenomeKnowledgeGraph(merged).ok, true);
  const relation = merged.relations.find(item => item.id.startsWith('frequency:'));
  assert.equal(relation.kind, 'derived-from-dataset');
  assert.equal(relation.context.alleleFrequency, 0.0125);
  assert.equal(relation.context.aggregateOnly, true);
});

test('GWAS bundle always creates ASSOCIATED evidence, never a causal edge', () => {
  const graph = baseGraph();
  const variant = graph.entities.find(item => item.kind === 'variant');
  const bundle = createGwasAssociationBundle({
    variantEntityId: variant.id,
    studyId: 'GCST-fixture',
    phenotypeId: 'EFO_0000001',
    phenotypeLabel: 'fixture trait',
    efoId: 'EFO_0000001',
    pValue: '1e-12',
    effectSize: 1.08,
    effectSizeType: 'odds-ratio',
    effectAllele: 'G',
    ancestry: 'East Asian',
    sampleSize: 50000,
    source: 'NHGRI-EBI GWAS Catalog',
  });
  assert.equal(bundle.metadata.causalClaimCreated, false);
  const association = bundle.relations.find(item => item.kind === 'associated-with');
  assert.equal(association.status, 'ASSOCIATED');
  assert.deepEqual(association.causalBasis, []);
  const merged = mergeGenomePublicEvidenceBundle(graph, bundle);
  assert.equal(verifyGenomeKnowledgeGraph(merged).ok, true);
  assert.ok(merged.entities.some(item => item.kind === 'study'));
  assert.ok(merged.entities.some(item => item.kind === 'phenotype'));
});

test('ClinVar bundle remains submitted interpretation evidence instead of automatic diagnostic truth', () => {
  const graph = baseGraph();
  const variant = graph.entities.find(item => item.kind === 'variant');
  const bundle = createClinvarInterpretationBundle({
    variantEntityId: variant.id,
    accession: 'VCV000000001-fixture',
    clinicalSignificance: 'Conflicting classifications of pathogenicity',
    reviewStatus: 'criteria provided, conflicting classifications',
    conditionNames: ['fixture condition'],
    source: 'ClinVar',
  });
  assert.equal(bundle.metadata.submittedInterpretationNotDiagnosticTruth, true);
  assert.equal(bundle.metadata.automaticDiagnosis, false);
  assert.equal(bundle.relations[0].status, 'DERIVED');
  assert.equal(bundle.relations[0].context.submittedInterpretationNotDiagnosticTruth, true);
  const merged = mergeGenomePublicEvidenceBundle(graph, bundle);
  assert.equal(verifyGenomeKnowledgeGraph(merged).ok, true);
  assert.ok(merged.entities.some(item => item.id === 'dataset:clinvar'));
});

test('Population frequency validation rejects impossible allele counts and frequencies', () => {
  const graph = baseGraph();
  const variant = graph.entities.find(item => item.kind === 'variant');
  assert.throws(() => createPopulationFrequencyBundle({
    variantEntityId: variant.id,
    alleleFrequency: 1.5,
  }), /between 0 and 1/);
  assert.throws(() => createPopulationFrequencyBundle({
    variantEntityId: variant.id,
    alleleFrequency: 0.2,
    alleleCount: 11,
    alleleNumber: 10,
  }), /cannot exceed alleleNumber/);
});
