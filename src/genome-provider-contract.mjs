import { realityRoot } from './canonical.mjs';

export const RCL_GENOME_PROVIDER_CONTRACT_VERSION = '0.1.0';
export const RCL_GENOME_PROVIDER_CONTRACT_FORMAT = 'rcl.genome-provider-contract.v0.1';
export const RCL_GENOME_SOURCE_CATALOG_FORMAT = 'rcl.genome-source-catalog.v0.1';
export const RCL_GENOME_TOOL_CATALOG_FORMAT = 'rcl.genome-tool-catalog.v0.1';
export const RCL_GENOME_TOOLCHAIN_PLAN_FORMAT = 'rcl.genome-toolchain-plan.v0.1';
export const RCL_GENOME_PROVIDER_REQUEST_FORMAT = 'rcl.genome-provider-request.v0.1';

const SAFE_PUBLIC_TIERS = new Set(['public', 'synthetic']);
const KNOWN_ACCESS_TIERS = new Set(['public', 'controlled', 'private', 'synthetic', 'unknown']);
const KNOWN_FORMATS = new Set(['FASTQ', 'SAM', 'BAM', 'CRAM', 'VCF', 'BCF', 'TSV', 'XML', 'JSON', 'HAIL']);

const PUBLIC_SOURCES = Object.freeze([
  Object.freeze({
    id: 'giab',
    name: 'Genome in a Bottle',
    owner: 'NIST Genome in a Bottle Consortium',
    sourceKind: 'benchmark-reference',
    accessTier: 'public',
    consentClass: 'open-reference-resource',
    referenceAssemblies: Object.freeze(['GRCh37', 'GRCh38', 'T2T/HG002']),
    dataKinds: Object.freeze(['FASTQ', 'BAM', 'CRAM', 'VCF', 'benchmark']),
    transports: Object.freeze(['NCBI-FTP', 'AWS-S3', 'NCBI-SRA']),
    landingPage: 'https://www.nist.gov/programs-projects/genome-bottle',
    notes: 'Benchmark genomes and truth sets. Prefer manifest discovery before downloading large sequence files.',
  }),
  Object.freeze({
    id: 'igsr-1000g',
    name: 'International Genome Sample Resource / 1000 Genomes',
    owner: 'EMBL-EBI IGSR',
    sourceKind: 'population-reference',
    accessTier: 'public',
    consentClass: 'open-consented-research-resource',
    referenceAssemblies: Object.freeze(['GRCh37', 'GRCh38']),
    dataKinds: Object.freeze(['FASTQ', 'BAM', 'CRAM', 'VCF', 'pedigree', 'population-metadata']),
    transports: Object.freeze(['Globus', 'FTP', 'ENA', 'AWS-S3']),
    landingPage: 'https://www.internationalgenome.org/data/',
    notes: 'Use data-collection manifests and reuse statements. The 30x collection contains 3,202 samples on GRCh38.',
  }),
  Object.freeze({
    id: 'clinvar',
    name: 'ClinVar',
    owner: 'NCBI',
    sourceKind: 'variant-interpretation',
    accessTier: 'public',
    consentClass: 'public-aggregate-resource',
    referenceAssemblies: Object.freeze(['GRCh37', 'GRCh38']),
    dataKinds: Object.freeze(['VCF', 'XML', 'TSV', 'API']),
    transports: Object.freeze(['HTTPS', 'NCBI-FTP', 'NCBI-EUtils']),
    landingPage: 'https://www.ncbi.nlm.nih.gov/clinvar/docs/access/',
    notes: 'ClinVar assertions are submitted interpretations, not automatic diagnoses or independently verified truth.',
  }),
  Object.freeze({
    id: 'gwas-catalog',
    name: 'NHGRI-EBI GWAS Catalog',
    owner: 'NHGRI / EMBL-EBI',
    sourceKind: 'association-evidence',
    accessTier: 'public',
    consentClass: 'public-curated-resource',
    referenceAssemblies: Object.freeze(['study-dependent']),
    dataKinds: Object.freeze(['JSON', 'TSV', 'summary-statistics']),
    transports: Object.freeze(['REST-v2', 'FTP', 'HTTPS']),
    landingPage: 'https://www.ebi.ac.uk/gwas/docs/api',
    notes: 'Association evidence must remain ASSOCIATED unless independent causal evidence is attached.',
  }),
  Object.freeze({
    id: 'gnomad',
    name: 'Genome Aggregation Database',
    owner: 'gnomAD / Broad Institute',
    sourceKind: 'population-frequency',
    accessTier: 'public',
    consentClass: 'public-aggregate-resource',
    referenceAssemblies: Object.freeze(['GRCh37', 'GRCh38']),
    dataKinds: Object.freeze(['VCF', 'HAIL', 'API']),
    transports: Object.freeze(['HTTPS', 'cloud-public-dataset', 'API', 'toolbox']),
    landingPage: 'https://gnomad.broadinstitute.org/downloads',
    notes: 'Prefer bounded API/toolbox queries for targeted research; full releases are very large.',
  }),
]);

const OPEN_SOURCE_TOOLS = Object.freeze([
  Object.freeze({
    id: 'htslib',
    repository: 'samtools/htslib',
    sourceUrl: 'https://github.com/samtools/htslib',
    role: 'native-genomic-io',
    formats: Object.freeze(['SAM', 'BAM', 'CRAM', 'VCF', 'BCF']),
    capabilities: Object.freeze(['genomics.io.read', 'genomics.io.write', 'genomics.index.read', 'genomics.stream.region']),
    boundary: 'external-open-source-provider',
  }),
  Object.freeze({
    id: 'bcftools',
    repository: 'samtools/bcftools',
    sourceUrl: 'https://github.com/samtools/bcftools',
    role: 'variant-normalization-and-query',
    formats: Object.freeze(['VCF', 'BCF']),
    capabilities: Object.freeze(['genomics.variant.normalize', 'genomics.variant.split-multiallelic', 'genomics.variant.filter', 'genomics.variant.query', 'genomics.variant.consensus']),
    boundary: 'external-open-source-provider',
  }),
  Object.freeze({
    id: 'pysam',
    repository: 'pysam-developers/pysam',
    sourceUrl: 'https://github.com/pysam-developers/pysam',
    role: 'python-htslib-binding',
    formats: Object.freeze(['SAM', 'BAM', 'CRAM', 'VCF', 'BCF']),
    capabilities: Object.freeze(['genomics.python.stream', 'genomics.python.region-query', 'genomics.python.variant-iteration']),
    boundary: 'external-open-source-provider',
  }),
  Object.freeze({
    id: 'cyvcf2',
    repository: 'brentp/cyvcf2',
    sourceUrl: 'https://github.com/brentp/cyvcf2',
    role: 'fast-python-vcf-reader',
    formats: Object.freeze(['VCF', 'BCF']),
    capabilities: Object.freeze(['genomics.python.variant-iteration', 'genomics.python.genotype-query']),
    boundary: 'external-open-source-provider',
  }),
  Object.freeze({
    id: 'ensembl-vep',
    repository: 'Ensembl/ensembl-vep',
    sourceUrl: 'https://github.com/Ensembl/ensembl-vep',
    role: 'functional-variant-annotation',
    formats: Object.freeze(['VCF']),
    capabilities: Object.freeze(['genomics.variant.functional-annotation', 'genomics.variant.transcript-consequence', 'genomics.variant.gene-mapping']),
    boundary: 'external-open-source-provider',
  }),
]);

export function buildGenomePublicSourceCatalog() {
  const payload = {
    format: RCL_GENOME_SOURCE_CATALOG_FORMAT,
    version: RCL_GENOME_PROVIDER_CONTRACT_VERSION,
    policy: {
      defaultAccess: 'public-only',
      protectedDataRequiresAuthority: true,
      associationIsNotCausality: true,
      manifestFirstForLargeDatasets: true,
    },
    sources: PUBLIC_SOURCES.map(source => structuredClone(source)),
  };
  return Object.freeze({ ...payload, root: realityRoot(payload) });
}

export function buildGenomeToolCatalog() {
  const payload = {
    format: RCL_GENOME_TOOL_CATALOG_FORMAT,
    version: RCL_GENOME_PROVIDER_CONTRACT_VERSION,
    policy: {
      vendorHeavyParsers: false,
      preferMatureOpenSourceProviders: true,
      preserveToolVersionInReceipts: true,
      neverUpgradeClaimsFromToolOutputAlone: true,
    },
    tools: OPEN_SOURCE_TOOLS.map(tool => structuredClone(tool)),
  };
  return Object.freeze({ ...payload, root: realityRoot(payload) });
}

export function getGenomePublicSource(sourceId) {
  const source = PUBLIC_SOURCES.find(item => item.id === sourceId);
  if (!source) throw new TypeError(`Unknown genome public source '${sourceId}'`);
  return structuredClone(source);
}

export function getGenomeTool(toolId) {
  const tool = OPEN_SOURCE_TOOLS.find(item => item.id === toolId);
  if (!tool) throw new TypeError(`Unknown genome tool '${toolId}'`);
  return structuredClone(tool);
}

export function createGenomeProviderRequest(input = {}) {
  assertObject(input, 'genome provider request');
  const source = input.sourceId ? getGenomePublicSource(input.sourceId) : null;
  const accessTier = nonEmptyString(input.accessTier ?? source?.accessTier ?? 'unknown', 'genome provider request accessTier').toLowerCase();
  if (!KNOWN_ACCESS_TIERS.has(accessTier)) throw new TypeError(`Unsupported genome access tier '${accessTier}'`);
  const operation = nonEmptyString(input.operation, 'genome provider request operation');
  const format = input.format == null ? null : nonEmptyString(input.format, 'genome provider request format').toUpperCase();
  if (format && !KNOWN_FORMATS.has(format)) throw new TypeError(`Unsupported genome provider format '${format}'`);
  const authorityRequired = [...new Set((input.authorityRequired ?? []).map(String))];
  const payload = {
    format: RCL_GENOME_PROVIDER_REQUEST_FORMAT,
    version: RCL_GENOME_PROVIDER_CONTRACT_VERSION,
    requestId: nonEmptyString(input.requestId ?? `genome:${operation}`, 'genome provider request requestId'),
    sourceId: source?.id ?? input.sourceId ?? null,
    operation,
    inputFormat: format,
    accessTier,
    payloadRef: input.payloadRef ?? null,
    query: structuredClone(input.query ?? {}),
    limits: {
      maxRecords: positiveIntegerOrNull(input.limits?.maxRecords),
      maxBytes: positiveIntegerOrNull(input.limits?.maxBytes),
      region: input.limits?.region ?? null,
    },
    governance: {
      safePublic: SAFE_PUBLIC_TIERS.has(accessTier),
      authorityRequired,
      networkAllowed: input.networkAllowed === true,
      exportAllowed: input.exportAllowed === true,
    },
  };
  if (!payload.governance.safePublic && authorityRequired.length === 0) {
    throw new TypeError(`Genome access tier '${accessTier}' requires explicit authorityRequired scopes`);
  }
  return Object.freeze({ ...payload, requestRoot: realityRoot(payload) });
}

export function planGenomeToolchain(input = {}) {
  assertObject(input, 'genome toolchain request');
  const sourceFormat = nonEmptyString(input.inputFormat ?? 'VCF', 'genome toolchain inputFormat').toUpperCase();
  if (!KNOWN_FORMATS.has(sourceFormat)) throw new TypeError(`Unsupported genome input format '${sourceFormat}'`);
  const operations = [...new Set((input.operations ?? ['parse']).map(value => nonEmptyString(value, 'genome toolchain operation')))];
  const steps = [];
  const add = (toolId, capability, reason) => {
    if (!steps.some(step => step.toolId === toolId && step.capability === capability)) {
      steps.push({ sequence: steps.length + 1, toolId, capability, reason, providerBoundary: 'external-open-source-provider' });
    }
  };

  if (['SAM', 'BAM', 'CRAM', 'VCF', 'BCF'].includes(sourceFormat)) {
    add('htslib', 'genomics.io.read', `mature native ${sourceFormat} I/O`);
  }
  if (operations.some(op => ['normalize', 'left-align', 'split-multiallelic', 'filter', 'query'].includes(op))) {
    add('bcftools', 'genomics.variant.normalize', 'variant normalization/query should reuse bcftools rather than reimplement edge cases in RCL');
  }
  if (operations.some(op => ['python-stream', 'region-query', 'genotype-query'].includes(op))) {
    const preferred = input.pythonProvider === 'cyvcf2' ? 'cyvcf2' : 'pysam';
    add(preferred, preferred === 'cyvcf2' ? 'genomics.python.variant-iteration' : 'genomics.python.stream', 'bounded Python integration layer');
  }
  if (operations.some(op => ['annotate', 'functional-annotation', 'gene-map', 'transcript-consequence'].includes(op))) {
    add('ensembl-vep', 'genomics.variant.functional-annotation', 'functional consequence annotation should remain an external evidence-bearing provider');
  }

  if (steps.length === 0) {
    steps.push({ sequence: 1, toolId: 'rcl-genome-ir', capability: 'genomics.ir.accept-normalized-record', reason: 'input is already normalized for Genome IR', providerBoundary: 'rcl-native' });
  }

  const payload = {
    format: RCL_GENOME_TOOLCHAIN_PLAN_FORMAT,
    version: RCL_GENOME_PROVIDER_CONTRACT_VERSION,
    inputFormat: sourceFormat,
    operations,
    sourceId: input.sourceId ?? null,
    steps,
    invariants: [
      'reference-assembly-explicit',
      'source-provenance-preserved',
      'tool-version-recorded-in-provider-receipt',
      'association-not-causality',
      'protected-data-authority-gated',
    ],
    outputContract: 'rcl.genome-observation.v0.1',
  };
  return Object.freeze({ ...payload, planRoot: realityRoot(payload) });
}

export function createGenomeProviderDefinition(input = {}) {
  assertObject(input, 'genome provider definition');
  const id = nonEmptyString(input.id, 'genome provider id');
  const capabilities = (input.capabilities ?? []).map((capability, index) => ({
    capability: nonEmptyString(typeof capability === 'string' ? capability : capability.capability, `genome provider capability[${index}]`),
    target: typeof capability === 'string' ? id : capability.target ?? id,
    modes: typeof capability === 'string' ? ['realize', 'foresee'] : capability.modes ?? ['realize', 'foresee'],
    effects: typeof capability === 'string' ? [] : capability.effects ?? [],
  }));
  if (capabilities.length === 0) throw new TypeError('genome provider definition requires at least one capability');
  if (typeof input.invoke !== 'function' && typeof input.simulate !== 'function') throw new TypeError('genome provider definition requires invoke or simulate');
  return Object.freeze({
    id,
    version: input.version ?? '0.0.0-local',
    description: input.description ?? 'Genome provider bound through Bio-RCL',
    capabilities: Object.freeze(capabilities),
    invoke: input.invoke,
    simulate: input.simulate,
    timeoutMs: input.timeoutMs,
    maxConcurrent: input.maxConcurrent,
    requestBytesLimit: input.requestBytesLimit,
    responseBytesLimit: input.responseBytesLimit,
  });
}

function assertObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${label} must be an object`);
}

function nonEmptyString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${label} must be a non-empty string`);
  return value.trim();
}

function positiveIntegerOrNull(value) {
  if (value == null) return null;
  if (!Number.isSafeInteger(value) || value <= 0) throw new RangeError('genome provider limit must be a positive safe integer');
  return value;
}
