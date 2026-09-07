import { realityRoot } from './canonical.mjs';
import { getGenomePublicSource, planGenomeToolchain } from './genome-provider-contract.mjs';

export const RCL_GENOME_STUDY_BOOTSTRAP_VERSION = '0.1.0';
export const RCL_GENOME_STUDY_BOOTSTRAP_FORMAT = 'rcl.genome-study-bootstrap.v0.1';
export const RCL_GENOME_STUDY_STAGE_FORMAT = 'rcl.genome-study-stage.v0.1';

export const DEFAULT_PUBLIC_GENOME_STUDY = Object.freeze({
  studyId: 'human-biology-compiler-public-bootstrap-hg005',
  objective: 'Validate the end-to-end evidence pipeline on a public high-quality human reference sample before any private genome is introduced.',
  sample: Object.freeze({
    sampleRef: 'HG005',
    populationContext: 'Han Chinese reference trio member',
    primarySourceId: 'giab',
    accessTier: 'public',
    referenceAssembly: 'GRCh38',
  }),
  budgets: Object.freeze({
    manifestFirst: true,
    maxInitialVariantRecords: 10000,
    maxInitialBytes: 50 * 1024 * 1024,
    wholeGenomeDownloadAllowed: false,
  }),
});

function stage(sequence, id, owner, action, inputs, outputs, invariants = [], stopIf = []) {
  return Object.freeze({
    format: RCL_GENOME_STUDY_STAGE_FORMAT,
    sequence,
    id,
    owner,
    action,
    inputs: Object.freeze([...inputs]),
    outputs: Object.freeze([...outputs]),
    invariants: Object.freeze([...invariants]),
    stopIf: Object.freeze([...stopIf]),
  });
}

export function buildPublicGenomeStudyBootstrap(input = {}) {
  const base = DEFAULT_PUBLIC_GENOME_STUDY;
  const sample = { ...base.sample, ...(input.sample ?? {}) };
  const budgets = { ...base.budgets, ...(input.budgets ?? {}) };
  if (String(sample.accessTier).toLowerCase() !== 'public') {
    throw new TypeError('Public Genome Study Bootstrap accepts only public sample sources');
  }
  if (budgets.wholeGenomeDownloadAllowed === true && input.explicitWholeGenomeDownloadAuthorization !== true) {
    throw new TypeError('Whole-genome download requires explicitWholeGenomeDownloadAuthorization=true');
  }
  const primary = getGenomePublicSource(sample.primarySourceId ?? 'giab');
  if (primary.accessTier !== 'public') throw new TypeError('Primary genome bootstrap source must be public');

  const sourceCatalog = [
    primary,
    getGenomePublicSource('igsr-1000g'),
    getGenomePublicSource('gnomad'),
    getGenomePublicSource('gwas-catalog'),
    getGenomePublicSource('clinvar'),
  ];
  const toolchain = planGenomeToolchain({
    inputFormat: 'VCF',
    sourceId: primary.id,
    operations: ['normalize', 'split-multiallelic', 'functional-annotation'],
  });

  const stages = [
    stage(1, 'source-authority', 'rcl', 'verify-public-source-authority',
      [primary.id, sample.sampleRef], ['public-source-authority-receipt'],
      ['access-tier-public', 'source-provenance-explicit'], ['source-not-public', 'sample-not-declared']),
    stage(2, 'manifest-discovery', 'provider', 'discover-source-manifest',
      [primary.id, sample.sampleRef], ['bounded-source-manifest'],
      ['manifest-first', 'no-implicit-whole-genome-download'], ['manifest-missing', 'sample-not-found']),
    stage(3, 'bounded-variant-slice', 'provider', 'select-bounded-variant-slice',
      ['bounded-source-manifest'], ['bounded-vcf-slice'],
      ['record-budget-enforced', 'byte-budget-enforced', 'reference-assembly-explicit'], ['budget-exceeded', 'assembly-mismatch']),
    stage(4, 'variant-normalization', 'provider', 'normalize-variants',
      ['bounded-vcf-slice'], ['normalized-vcf-records'],
      ['left-normalization-provider-receipt', 'multiallelic-policy-explicit'], ['normalization-failure']),
    stage(5, 'genome-ir', 'rcl', 'lower-to-genome-ir',
      ['normalized-vcf-records'], ['rcl.genome-observation.v0.1'],
      ['observation-rooted', 'evidence-bound', 'governance-bound'], ['invalid-coordinate', 'invalid-genotype', 'missing-provenance']),
    stage(6, 'functional-annotation', 'provider', 'annotate-gene-transcript-consequence',
      ['rcl.genome-observation.v0.1'], ['rcl.genome-annotation-bundle.v0.1'],
      ['provider-version-receipted', 'annotation-is-derived-not-causal'], ['annotation-provider-gap']),
    stage(7, 'knowledge-graph', 'rcl', 'compile-genome-knowledge-graph',
      ['rcl.genome-observation.v0.1', 'rcl.genome-annotation-bundle.v0.1'], ['rcl.genome-knowledge-graph.v0.1'],
      ['association-not-causality', 'causal-edge-requires-explicit-basis', 'graph-rooted'], ['causality-boundary-violation', 'missing-evidence-edge']),
    stage(8, 'population-context', 'provider', 'attach-population-frequency-context',
      ['rcl.genome-knowledge-graph.v0.1', 'igsr-1000g', 'gnomad'], ['population-frequency-evidence'],
      ['ancestry-context-explicit', 'aggregate-frequency-not-individual-diagnosis'], ['population-context-unavailable']),
    stage(9, 'association-context', 'provider', 'attach-association-evidence',
      ['rcl.genome-knowledge-graph.v0.1', 'gwas-catalog'], ['association-evidence'],
      ['association-status-preserved', 'effect-and-study-context-explicit'], ['association-source-unavailable']),
    stage(10, 'interpretation-context', 'provider', 'attach-public-variant-interpretation-evidence',
      ['rcl.genome-knowledge-graph.v0.1', 'clinvar'], ['interpretation-evidence'],
      ['submitted-interpretation-not-diagnostic-truth', 'review-status-preserved'], ['interpretation-source-unavailable']),
    stage(11, 'rncs-evidence', 'rncs', 'register-governed-candidate-evidence-graph',
      ['rcl.genome-knowledge-graph.v0.1'], ['rncs.genome-evidence-proposal'],
      ['proposal-only', 'no-auto-authorize', 'no-auto-commit'], ['rncs-verification-failure']),
    stage(12, 'next-action', 'ugis', 'select-minimum-sufficient-research-route',
      ['open-uncertainties', 'candidate-research-actions'], ['ugis.genomics-next-action'],
      ['authority-before-reachability', 'minimum-sufficient-route', 'explicit-stop-rule'], ['no-eligible-route']),
    stage(13, 'research-artifact', 'dwac', 'synthesize-source-bound-genomics-report',
      ['rcl.genome-knowledge-graph.v0.1', 'rncs.genome-evidence-proposal', 'ugis.genomics-next-action'], ['artifact.genomics.research.report'],
      ['source-provenance-bound', 'confounders-explicit', 'limitations-explicit', 'candidate-only'], ['grounding-gap']),
  ];

  const payload = {
    format: RCL_GENOME_STUDY_BOOTSTRAP_FORMAT,
    version: RCL_GENOME_STUDY_BOOTSTRAP_VERSION,
    status: 'CANDIDATE',
    studyId: input.studyId ?? base.studyId,
    objective: input.objective ?? base.objective,
    sample,
    budgets,
    sources: sourceCatalog.map(source => ({
      id: source.id,
      role: source.sourceKind,
      accessTier: source.accessTier,
      landingPage: source.landingPage,
    })),
    toolchain,
    stages,
    globalInvariants: Object.freeze([
      'public-data-only-until-explicit-private-phase',
      'manifest-first-large-data-access',
      'reference-assembly-explicit',
      'source-and-tool-version-provenance',
      'association-not-causality',
      'no-medical-diagnosis-from-pipeline-output',
      'candidate-only-until-evidence-promotion-gate',
    ]),
    completionGate: Object.freeze({
      required: Object.freeze([
        'all-selected-input-roots-verified',
        'no-unresolved-data-authority-gap',
        'all-relation-evidence-refs-resolve',
        'no-association-causality-violation',
        'source-bound-research-artifact-produced',
      ]),
      automaticCanonicalPromotion: false,
    }),
  };
  return Object.freeze({ ...payload, studyRoot: realityRoot(payload) });
}

export function publicGenomeStudySummary(study = buildPublicGenomeStudyBootstrap()) {
  if (!study || study.format !== RCL_GENOME_STUDY_BOOTSTRAP_FORMAT) throw new TypeError('Invalid public genome study bootstrap');
  return Object.freeze({
    studyId: study.studyId,
    studyRoot: study.studyRoot,
    sampleRef: study.sample.sampleRef,
    referenceAssembly: study.sample.referenceAssembly,
    sourceCount: study.sources.length,
    stageCount: study.stages.length,
    firstStage: study.stages[0]?.id ?? null,
    lastStage: study.stages.at(-1)?.id ?? null,
    wholeGenomeDownloadAllowed: study.budgets.wholeGenomeDownloadAllowed,
    automaticCanonicalPromotion: study.completionGate.automaticCanonicalPromotion,
  });
}
