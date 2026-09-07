import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGenomeObservation,
  genomeFoundationProjection,
  parseVcfVariantLine,
  verifyGenomeObservation,
} from '../src/genome-ir.mjs';

function fixture() {
  return {
    observationId: 'giab:HG005:chr1:10177:A:AC',
    sampleRef: 'HG005',
    locus: { assembly: 'GRCh38', contig: 'chr1', start: 10177 },
    variant: { id: 'rs367896724', ref: 'A', alt: 'AC' },
    genotype: { alleles: [0, 1], phased: false },
    quality: { score: 99.7, filters: ['PASS'], info: { source: 'fixture' } },
    evidence: [
      { id: 'e1', source: 'GIAB', sourceType: 'benchmark', accession: 'HG005', confidence: 0.99 },
    ],
    claims: [
      { id: 'c1', predicate: 'benchmark_status', object: 'example', status: 'OBSERVED', evidenceRefs: ['e1'], confidence: 0.99 },
    ],
    governance: { accessTier: 'public', consentBasis: 'public-reference-resource' },
  };
}

test('Genome IR creates a deterministic rooted observation', () => {
  const left = createGenomeObservation(fixture());
  const right = createGenomeObservation(fixture());
  assert.equal(left.observationRoot, right.observationRoot);
  assert.equal(verifyGenomeObservation(left).ok, true);
  assert.equal(left.variant.type, 'insertion');
  assert.deepEqual(left.foundation.domains, ['genetic', 'quantitative', 'knowledge', 'scientific']);
});

test('Genome IR projects into RCL foundation domains without upgrading association to causality', () => {
  const input = fixture();
  input.claims = [{ id: 'c1', predicate: 'trait_relation', object: 'example-trait', status: 'ASSOCIATED', evidenceRefs: ['e1'], confidence: 0.6 }];
  const observation = createGenomeObservation(input);
  const projection = genomeFoundationProjection(observation);
  assert.equal(projection.knowledge.claims[0].status, 'ASSOCIATED');
  assert.equal(projection.sourceRoot, observation.observationRoot);
  assert.equal(projection.authorityBoundary.accessTier, 'public');
});

test('Genome IR rejects an evidence-backed claim that references missing evidence', () => {
  const input = fixture();
  input.claims[0].status = 'CAUSAL';
  input.claims[0].evidenceRefs = ['missing'];
  assert.throws(() => createGenomeObservation(input), /unknown evidence/);
});

test('Genome IR parses a biallelic VCF record into the same rooted model', () => {
  const observation = parseVcfVariantLine(
    'chr20\t14370\trs6054257\tG\tA\t29\tPASS\tNS=3;DP=14\tGT:GQ\t0|1:48',
    { assembly: 'GRCh38', sampleRef: 'sample:public', governance: { accessTier: 'public' } },
  );
  assert.equal(observation.locus.start, 14370);
  assert.deepEqual(observation.variant.alts, ['A']);
  assert.deepEqual(observation.genotype.alleles, [0, 1]);
  assert.equal(observation.genotype.phased, true);
  assert.equal(observation.quality.info.DP, '14');
  assert.equal(verifyGenomeObservation(observation).ok, true);
});

test('Genome IR rejects forged roots', () => {
  const observation = createGenomeObservation(fixture());
  const forged = { ...observation, observationRoot: '0'.repeat(64) };
  assert.equal(verifyGenomeObservation(forged).ok, false);
});
