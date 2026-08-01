import { realityRoot } from './canonical.mjs';
import {
  RCL_EQUIVALENCE_CORPUS_VERSION,
  RCL_EQUIVALENCE_CORPUS_FORMAT,
  RCL_CAPABILITY_CORPUS_FORMAT,
  RCL_EQUIVALENCE_CASE_FORMAT,
  RCL_MUTATION_PLAN_FORMAT,
  RCLEquivalenceCorpusError,
  assertObject,
  finalizeCorpusBatch,
  safeIdentifier,
  uniqueStrings,
} from './equivalence-corpus-common.mjs';
import { forgeJsonSchemaCapabilityCorpus } from './json-schema-equivalence-forge.mjs';
import { forgeOpenApiCapabilityCorpus } from './openapi-equivalence-forge.mjs';
import { forgeSqlCapabilityCorpus } from './sql-equivalence-forge.mjs';

export {
  RCL_EQUIVALENCE_CORPUS_VERSION,
  RCL_EQUIVALENCE_CORPUS_FORMAT,
  RCL_CAPABILITY_CORPUS_FORMAT,
  RCL_EQUIVALENCE_CASE_FORMAT,
  RCL_MUTATION_PLAN_FORMAT,
  RCLEquivalenceCorpusError,
  forgeJsonSchemaCapabilityCorpus,
  forgeOpenApiCapabilityCorpus,
  forgeSqlCapabilityCorpus,
};

function frontendForSpec(spec, explicit = null) {
  if (explicit) return explicit;
  const ecosystem = String(spec.source?.ecosystem ?? '').toLowerCase().replace(/_/g, '-');
  if (ecosystem === 'json-schema') return 'json-schema';
  if (ecosystem === 'openapi') return 'openapi';
  if (ecosystem === 'sql') return 'sql-ddl';
  throw new RCLEquivalenceCorpusError(
    'RCL_CORPUS_FRONTEND_UNSUPPORTED',
    `No equivalence corpus forge is registered for ecosystem '${spec.source?.ecosystem ?? 'unknown'}'`,
    { ecosystem: spec.source?.ecosystem },
  );
}

function normalizeBundle(input) {
  const raw = assertObject(input, 'RCL_CORPUS_INPUT_INVALID', 'Equivalence corpus input must be a source bundle or capability specification');
  if (raw.format === 'rcl.source-capability-bundle.v0.1') return raw;
  if (raw.format === 'rcl.external-capability-spec.v0.1' || (raw.id && raw.source && raw.semantics)) {
    const specRoot = String(raw.root ?? realityRoot(raw));
    const spec = Object.freeze({ ...raw, root: specRoot });
    const frontend = frontendForSpec(spec);
    const body = {
      format: 'rcl.source-capability-bundle.v0.1',
      version: 'synthetic-single-spec',
      frontend,
      sourceVersion: String(spec.source?.version ?? 'unknown'),
      sourceRoot: String(spec.source?.referenceRoot ?? specRoot),
      capabilityCount: 1,
      capabilityRoots: [specRoot],
      capabilities: [spec],
      diagnostics: [],
      coverage: { syntheticSingleSpec: true },
      boundary: 'Synthetic source bundle created from one capability specification for corpus generation.',
    };
    return Object.freeze({ ...body, root: realityRoot({ ...body, capabilities: [specRoot] }) });
  }
  throw new RCLEquivalenceCorpusError(
    'RCL_CORPUS_SOURCE_BUNDLE_REQUIRED',
    'Expected rcl.source-capability-bundle.v0.1 or an external capability specification',
    { format: raw.format },
  );
}

function forgeOne(spec, frontend, options) {
  const selected = frontendForSpec(spec, frontend);
  if (selected === 'json-schema') return forgeJsonSchemaCapabilityCorpus(spec, options);
  if (selected === 'openapi') return forgeOpenApiCapabilityCorpus(spec, options);
  if (selected === 'sql-ddl') return forgeSqlCapabilityCorpus(spec, options);
  throw new RCLEquivalenceCorpusError('RCL_CORPUS_FRONTEND_UNSUPPORTED', 'Unsupported corpus frontend', { frontend: selected });
}

export function forgeEquivalenceCorpus(input, options = {}) {
  const bundle = normalizeBundle(input);
  if (!Array.isArray(bundle.capabilities) || bundle.capabilities.length === 0) {
    throw new RCLEquivalenceCorpusError(
      'RCL_CORPUS_CAPABILITIES_REQUIRED',
      'Source capability bundle must contain at least one capability',
    );
  }
  const corpora = bundle.capabilities.map(spec => forgeOne(spec, bundle.frontend, options));
  return finalizeCorpusBatch({
    bundle,
    corpora,
    diagnostics: [...(bundle.diagnostics ?? [])],
  });
}

function selectCapabilityCorpus(input, capability = null) {
  const raw = assertObject(input, 'RCL_CORPUS_DIFFERENTIAL_INPUT', 'Corpus conversion requires a corpus object');
  if (raw.format === RCL_CAPABILITY_CORPUS_FORMAT) {
    if (capability && safeIdentifier(capability) !== raw.capability) {
      throw new RCLEquivalenceCorpusError(
        'RCL_CORPUS_CAPABILITY_NOT_FOUND',
        `Capability corpus '${raw.capability}' does not match requested '${safeIdentifier(capability)}'`,
      );
    }
    return raw;
  }
  if (raw.format !== RCL_EQUIVALENCE_CORPUS_FORMAT) {
    throw new RCLEquivalenceCorpusError('RCL_CORPUS_FORMAT', 'Unsupported corpus format', { format: raw.format });
  }
  if (!capability && raw.corpora.length !== 1) {
    throw new RCLEquivalenceCorpusError(
      'RCL_CORPUS_CAPABILITY_SELECTION_REQUIRED',
      'A capability id is required when a batch contains multiple capability corpora',
      { capabilities: raw.corpora.map(corpus => corpus.capability) },
    );
  }
  const selectedId = capability ? safeIdentifier(capability) : raw.corpora[0].capability;
  const corpus = raw.corpora.find(item => item.capability === selectedId);
  if (!corpus) {
    throw new RCLEquivalenceCorpusError(
      'RCL_CORPUS_CAPABILITY_NOT_FOUND',
      `Capability '${selectedId}' is not present in the corpus batch`,
      { capabilities: raw.corpora.map(item => item.capability) },
    );
  }
  return corpus;
}

export function differentialCasesFromCorpus(input, options = {}) {
  const corpus = selectCapabilityCorpus(input, options.capability ?? null);
  const classifications = options.classifications
    ? new Set(options.classifications.map(String))
    : new Set(['valid', 'invalid', 'boundary', 'mutation-probe']);
  const includeObserve = options.includeObserve !== false;
  return corpus.cases
    .filter(testCase => classifications.has(testCase.classification))
    .filter(testCase => includeObserve || testCase.expected.status !== 'observe')
    .map(testCase => Object.freeze({
      id: testCase.id,
      input: testCase.input,
      tags: uniqueStrings([
        ...testCase.tags,
        `expected:${testCase.expected.status}`,
        ...testCase.targets.map(target => `target:${target}`),
      ]),
    }));
}

export function createDifferentialExperimentPlan(input, options = {}) {
  const corpus = selectCapabilityCorpus(input, options.capability ?? null);
  const cases = differentialCasesFromCorpus(corpus, options);
  const body = {
    format: 'rcl.differential-experiment-plan.v0.1',
    version: RCL_EQUIVALENCE_CORPUS_VERSION,
    capability: corpus.capability,
    capabilityCorpusRoot: corpus.root,
    caseCount: cases.length,
    cases,
    mutationPlans: corpus.mutationPlans.map(plan => ({
      id: plan.id,
      operator: plan.operator,
      target: plan.target,
      expectedDetectionCaseIds: plan.expectedDetectionCaseIds,
      implementationRequired: true,
      root: plan.root,
    })),
    executionRequirements: {
      sourceAdapterRequired: true,
      absorbedAdapterRequired: true,
      distinctAdapterDescriptorsRequired: true,
      negativeControlImplementationsRequired: corpus.mutationPlanCount > 0,
      deterministicReplayRecommended: true,
    },
    boundary: 'This is an execution plan, not a differential report. It contains no sourceOutput, absorbedOutput, adapter receipt, or equivalence verdict.',
  };
  return Object.freeze({ ...body, root: realityRoot(body) });
}
