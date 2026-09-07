import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildGenomePublicSourceCatalog,
  buildGenomeToolCatalog,
  createGenomeProviderDefinition,
  createGenomeProviderRequest,
  planGenomeToolchain,
} from '../src/genome-provider-contract.mjs';
import { createProviderRuntimeV2 } from '../src/provider-runtime-v2.mjs';


test('Genome provider catalog preserves official-source roles and rooted determinism', () => {
  const left = buildGenomePublicSourceCatalog();
  const right = buildGenomePublicSourceCatalog();
  assert.equal(left.root, right.root);
  assert.deepEqual(
    left.sources.map(source => source.id),
    ['giab', 'igsr-1000g', 'clinvar', 'gwas-catalog', 'gnomad'],
  );
  assert.equal(left.sources.find(source => source.id === 'gwas-catalog').sourceKind, 'association-evidence');
  assert.equal(left.policy.associationIsNotCausality, true);
});


test('Genome tool catalog reuses mature open-source infrastructure instead of reimplementing genomic file stacks', () => {
  const catalog = buildGenomeToolCatalog();
  const repos = new Set(catalog.tools.map(tool => tool.repository));
  assert.ok(repos.has('samtools/htslib'));
  assert.ok(repos.has('samtools/bcftools'));
  assert.ok(repos.has('pysam-developers/pysam'));
  assert.ok(repos.has('brentp/cyvcf2'));
  assert.ok(repos.has('Ensembl/ensembl-vep'));
  assert.equal(catalog.policy.vendorHeavyParsers, false);
});


test('Genome toolchain selects htslib, bcftools and VEP for normalized annotated VCF lowering', () => {
  const plan = planGenomeToolchain({
    inputFormat: 'VCF',
    sourceId: 'igsr-1000g',
    operations: ['normalize', 'split-multiallelic', 'functional-annotation'],
  });
  assert.deepEqual(plan.steps.map(step => step.toolId), ['htslib', 'bcftools', 'ensembl-vep']);
  assert.equal(plan.outputContract, 'rcl.genome-observation.v0.1');
  assert.ok(plan.invariants.includes('association-not-causality'));
});


test('Genome provider requests fail closed for protected or unknown data without explicit authority', () => {
  assert.throws(() => createGenomeProviderRequest({
    requestId: 'private-vcf',
    operation: 'genomics.variant.query',
    format: 'VCF',
    accessTier: 'private',
  }), /requires explicit authorityRequired/);

  const accepted = createGenomeProviderRequest({
    requestId: 'private-vcf',
    operation: 'genomics.variant.query',
    format: 'VCF',
    accessTier: 'private',
    authorityRequired: ['subject.genome.read'],
    payloadRef: 'private:subject-genome',
    limits: { maxRecords: 100, maxBytes: 1000000 },
  });
  assert.equal(accepted.governance.safePublic, false);
  assert.deepEqual(accepted.governance.authorityRequired, ['subject.genome.read']);
});


test('Genome provider definitions plug into ProviderRuntimeV2 and emit rooted receipts', async () => {
  const provider = createGenomeProviderDefinition({
    id: 'genome.fixture',
    version: '1.0.0-test',
    capabilities: [{ capability: 'variant.normalize', target: 'genome.fixture', modes: ['realize', 'foresee'] }],
    invoke: async input => ({ normalized: true, input }),
    simulate: async input => ({ normalized: false, simulated: true, input }),
  });
  const runtime = createProviderRuntimeV2({
    providers: [provider],
    policy: { subjects: { researcher: ['genome.fixture.variant.normalize@genome.fixture'] } },
  });
  const receipt = await runtime.invoke({
    providerId: 'genome.fixture',
    capability: 'variant.normalize',
    target: 'genome.fixture',
    actor: 'researcher',
    input: { record: 'chr1:1:A:G' },
  });
  assert.equal(receipt.status, 'succeeded');
  assert.equal(receipt.output.normalized, true);
  assert.match(receipt.root, /^[a-f0-9]{64}$/);
});
