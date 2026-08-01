import { realityRoot } from './canonical.mjs';

export const RCL_EQUIVALENCE_CORPUS_VERSION = '0.1.0-alpha.1';
export const RCL_EQUIVALENCE_CORPUS_FORMAT = 'rcl.equivalence-corpus.v0.1';
export const RCL_CAPABILITY_CORPUS_FORMAT = 'rcl.capability-equivalence-corpus.v0.1';
export const RCL_EQUIVALENCE_CASE_FORMAT = 'rcl.equivalence-corpus-case.v0.1';
export const RCL_MUTATION_PLAN_FORMAT = 'rcl.equivalence-mutation-plan.v0.1';

export class RCLEquivalenceCorpusError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'RCLEquivalenceCorpusError';
    this.code = code;
    this.details = details;
  }
}

export function assertObject(value, code, message) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new RCLEquivalenceCorpusError(code, message, { value });
  }
  return value;
}

export function safeIdentifier(value, fallback = 'corpus_case') {
  const normalized = String(value ?? '')
    .trim()
    .replace(/[^A-Za-z0-9_]+/g, '_')
    .replace(/^([^A-Za-z_])/, '_$1')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
  return normalized || fallback;
}

export function uniqueStrings(values = []) {
  return [...new Set(values.map(value => String(value).trim()).filter(Boolean))];
}

export function parseJsonLiteral(value, fallback = undefined) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function normalizeExpected(expected = {}) {
  const raw = expected && typeof expected === 'object' && !Array.isArray(expected)
    ? expected
    : { status: expected };
  const status = String(raw.status ?? 'observe');
  if (!['accept', 'reject', 'observe'].includes(status)) {
    throw new RCLEquivalenceCorpusError(
      'RCL_CORPUS_EXPECTED_STATUS',
      "Corpus case expected status must be 'accept', 'reject', or 'observe'",
      { status },
    );
  }
  return Object.freeze({
    status,
    reason: raw.reason ? String(raw.reason) : null,
    errorClass: raw.errorClass ? String(raw.errorClass) : null,
  });
}

export function createCorpusCase(input) {
  const raw = assertObject(input, 'RCL_CORPUS_CASE_INVALID', 'Corpus case must be an object');
  const classification = String(raw.classification ?? 'boundary');
  if (!['valid', 'invalid', 'boundary', 'mutation-probe'].includes(classification)) {
    throw new RCLEquivalenceCorpusError(
      'RCL_CORPUS_CASE_CLASSIFICATION',
      'Unsupported corpus case classification',
      { classification },
    );
  }
  const body = {
    format: RCL_EQUIVALENCE_CASE_FORMAT,
    id: safeIdentifier(raw.id),
    capability: safeIdentifier(raw.capability),
    classification,
    input: raw.input ?? null,
    expected: normalizeExpected(raw.expected),
    targets: uniqueStrings(raw.targets ?? []),
    tags: uniqueStrings([classification, ...(raw.tags ?? [])]),
    provenance: uniqueStrings(raw.provenance ?? []),
  };
  return Object.freeze({ ...body, root: realityRoot(body) });
}

export function createMutationPlan(input) {
  const raw = assertObject(input, 'RCL_CORPUS_MUTATION_INVALID', 'Mutation plan must be an object');
  const body = {
    format: RCL_MUTATION_PLAN_FORMAT,
    id: safeIdentifier(raw.id),
    capability: safeIdentifier(raw.capability),
    operator: safeIdentifier(raw.operator),
    target: String(raw.target ?? ''),
    description: String(raw.description ?? ''),
    expectedDetectionCaseIds: uniqueStrings(raw.expectedDetectionCaseIds ?? []).map(safeIdentifier),
    implementationRequired: true,
  };
  return Object.freeze({ ...body, root: realityRoot(body) });
}

export function finalizeCapabilityCorpus({ spec, frontend, cases, mutationPlans = [], diagnostics = [], coverage = {} }) {
  assertObject(spec, 'RCL_CORPUS_SPEC_REQUIRED', 'Capability corpus requires a capability specification');
  const normalizedCases = cases.map(caseItem => (
    caseItem?.format === RCL_EQUIVALENCE_CASE_FORMAT ? caseItem : createCorpusCase(caseItem)
  ));
  const normalizedPlans = mutationPlans.map(plan => (
    plan?.format === RCL_MUTATION_PLAN_FORMAT ? plan : createMutationPlan(plan)
  ));
  const body = {
    format: RCL_CAPABILITY_CORPUS_FORMAT,
    version: RCL_EQUIVALENCE_CORPUS_VERSION,
    capability: safeIdentifier(spec.id),
    specRoot: String(spec.root ?? realityRoot(spec)),
    sourceIdentity: `${spec.source?.ecosystem ?? frontend}:${spec.source?.construct ?? 'unknown'}@${spec.source?.version ?? 'unknown'}`,
    frontend,
    caseCount: normalizedCases.length,
    caseRoots: normalizedCases.map(testCase => testCase.root),
    cases: normalizedCases,
    mutationPlanCount: normalizedPlans.length,
    mutationPlanRoots: normalizedPlans.map(plan => plan.root),
    mutationPlans: normalizedPlans,
    diagnostics,
    coverage,
    boundary: 'Generated corpus cases are deterministic experiment inputs and expected semantic classes. They are not source-runtime outputs, absorbed-runtime outputs, or equivalence proof.',
  };
  return Object.freeze({ ...body, root: realityRoot({
    ...body,
    cases: body.caseRoots,
    mutationPlans: body.mutationPlanRoots,
  }) });
}

export function finalizeCorpusBatch({ bundle, corpora, diagnostics = [] }) {
  const body = {
    format: RCL_EQUIVALENCE_CORPUS_FORMAT,
    version: RCL_EQUIVALENCE_CORPUS_VERSION,
    frontend: String(bundle.frontend ?? 'generic'),
    sourceRoot: String(bundle.sourceRoot ?? ''),
    sourceBundleRoot: String(bundle.root ?? realityRoot(bundle)),
    capabilityCount: corpora.length,
    capabilityCorpusRoots: corpora.map(corpus => corpus.root),
    caseCount: corpora.reduce((sum, corpus) => sum + corpus.caseCount, 0),
    mutationPlanCount: corpora.reduce((sum, corpus) => sum + corpus.mutationPlanCount, 0),
    corpora,
    diagnostics,
    boundary: 'This batch forges candidate differential inputs from source-extracted semantic contracts. Independent adapters must execute them before any equivalence or native-promotion claim.',
  };
  return Object.freeze({ ...body, root: realityRoot({
    ...body,
    corpora: body.capabilityCorpusRoots,
  }) });
}
