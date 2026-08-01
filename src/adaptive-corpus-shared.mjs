import { realityRoot } from './canonical.mjs';
import {
  RCL_EQUIVALENCE_CORPUS_FORMAT,
  RCL_CAPABILITY_CORPUS_FORMAT,
  createCorpusCase,
  safeIdentifier,
  uniqueStrings,
} from './equivalence-corpus-common.mjs';
import {
  RCL_ADAPTIVE_CAPABILITY_CORPUS_FORMAT,
  RCL_CORPUS_DIFFERENTIAL_EXPERIMENT_FORMAT,
  verifyExecutableCorpusIntegrity,
} from './executable-negative-controls.mjs';

export { RCL_ADAPTIVE_CAPABILITY_CORPUS_FORMAT };
export const RCL_ADAPTIVE_CORPUS_VERSION = '0.1.0-alpha.1';
export const RCL_ADAPTIVE_CORPUS_CYCLE_FORMAT = 'rcl.adaptive-corpus-cycle.v0.1';
export const RCL_ADAPTIVE_CORPUS_LOOP_FORMAT = 'rcl.adaptive-corpus-loop-report.v0.1';

export class RCLAdaptiveCorpusError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'RCLAdaptiveCorpusError';
    this.code = code;
    this.details = details;
  }
}

export function adaptiveAssertObject(value, code, message) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new RCLAdaptiveCorpusError(code, message, { value });
  }
  return value;
}

export function selectAdaptiveCapabilityCorpus(input, capability = null) {
  const raw = adaptiveAssertObject(
    input,
    'RCL_ADAPTIVE_CORPUS_REQUIRED',
    'Adaptive loop requires a corpus object',
  );
  if (
    raw.format === RCL_CAPABILITY_CORPUS_FORMAT
    || raw.format === RCL_ADAPTIVE_CAPABILITY_CORPUS_FORMAT
  ) {
    if (capability && safeIdentifier(capability) !== raw.capability) {
      throw new RCLAdaptiveCorpusError(
        'RCL_ADAPTIVE_CAPABILITY_MISMATCH',
        `Corpus capability '${raw.capability}' does not match '${safeIdentifier(capability)}'`,
      );
    }
    verifyExecutableCorpusIntegrity(raw);
    return raw;
  }
  if (raw.format !== RCL_EQUIVALENCE_CORPUS_FORMAT) {
    throw new RCLAdaptiveCorpusError(
      'RCL_ADAPTIVE_CORPUS_FORMAT',
      'Unsupported corpus format',
      { format: raw.format },
    );
  }
  if (!capability && raw.corpora.length !== 1) {
    throw new RCLAdaptiveCorpusError(
      'RCL_ADAPTIVE_CAPABILITY_SELECTION',
      'A capability id is required for a multi-capability corpus batch',
      { capabilities: raw.corpora.map(item => item.capability) },
    );
  }
  const selectedId = capability ? safeIdentifier(capability) : raw.corpora[0].capability;
  const corpus = raw.corpora.find(item => item.capability === selectedId);
  if (!corpus) {
    throw new RCLAdaptiveCorpusError(
      'RCL_ADAPTIVE_CAPABILITY_NOT_FOUND',
      `Capability '${selectedId}' is absent from the corpus batch`,
    );
  }
  verifyExecutableCorpusIntegrity(corpus);
  return corpus;
}

export function unwrapAdaptiveDifferential(input) {
  const raw = adaptiveAssertObject(
    input,
    'RCL_ADAPTIVE_DIFFERENTIAL_REQUIRED',
    'Adaptive analysis requires a differential or corpus experiment report',
  );
  if (raw.format === RCL_CORPUS_DIFFERENTIAL_EXPERIMENT_FORMAT) return raw.differential;
  if (raw.format === 'rcl.independent-differential-absorption-report.v0.1') return raw;
  throw new RCLAdaptiveCorpusError(
    'RCL_ADAPTIVE_DIFFERENTIAL_FORMAT',
    'Unsupported differential feedback format',
    { format: raw.format },
  );
}

export function createAdaptiveGap(kind, details = {}) {
  const body = { kind, ...details };
  return Object.freeze({ ...body, root: realityRoot(body) });
}

export function adaptiveCaseInputRoot(testCase) {
  return realityRoot(testCase.input ?? null);
}

function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function findSeedCase(corpus, plan) {
  for (const id of plan.expectedDetectionCaseIds ?? []) {
    const match = corpus.cases.find(testCase => testCase.id === id);
    if (match) return match;
  }
  return corpus.cases.find(testCase => testCase.classification === 'valid')
    ?? corpus.cases.find(testCase => testCase.classification === 'boundary')
    ?? corpus.cases[0]
    ?? null;
}

function setNestedProperty(root, path, value) {
  const parts = String(path).split('.').filter(Boolean);
  if (parts.length === 0) return false;
  let current = root;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const part = parts[index];
    if (!current || typeof current !== 'object' || Array.isArray(current)) return false;
    if (!current[part] || typeof current[part] !== 'object' || Array.isArray(current[part])) {
      current[part] = {};
    }
    current = current[part];
  }
  if (!current || typeof current !== 'object' || Array.isArray(current)) return false;
  current[parts.at(-1)] = value;
  return true;
}

function adaptiveInputForPlan(plan, seedInput, iteration) {
  const input = clone(seedInput ?? null);
  const operator = plan.operator;
  const target = plan.target;
  const object = input && typeof input === 'object' && !Array.isArray(input) ? input : {};

  if (operator === 'ignore_required') {
    delete object[target];
    return object;
  }
  if (operator === 'ignore_type') {
    object[target] = { __adaptive_wrong_type__: iteration };
    return object;
  }
  if (operator === 'ignore_enum') {
    object[target] = `__adaptive_outside_enum_${iteration}__`;
    return object;
  }
  if (operator === 'allow_additional_properties') {
    object[`__adaptive_unexpected_${iteration}__`] = true;
    return object;
  }
  if (operator === 'ignore_required_parameter') {
    const [location, name] = target.split(':');
    if (object.parameters?.[location]) delete object.parameters[location][name];
    return object;
  }
  if (operator === 'ignore_required_body') {
    object.requestBody = null;
    return object;
  }
  if (operator === 'accept_undeclared_status') {
    return {
      kind: 'openapi-contract-probe',
      mode: 'response',
      method: object.method ?? 'GET',
      pathTemplate: object.pathTemplate ?? '/',
      status: `59${iteration % 10}`,
      responseBody: null,
    };
  }
  if (operator === 'ignore_not_null') {
    if (object.row && typeof object.row === 'object') object.row[target] = null;
    else setNestedProperty(object, target, null);
    return object;
  }
  if (operator === 'ignore_unique') {
    const row = clone(object.row ?? object.statements?.[0]?.row ?? {});
    return {
      kind: 'sql-transaction-probe',
      operation: 'transaction',
      table: object.table,
      statements: [
        { operation: 'insert', row: clone(row) },
        { operation: 'insert', row: clone(row) },
        { operation: 'insert', row: clone(row) },
      ],
    };
  }
  if (operator === 'ignore_foreign_key') {
    if (object.row && typeof object.row === 'object') {
      object.row[target] = `__adaptive_missing_reference_${iteration}__`;
    } else {
      setNestedProperty(object, target, `__adaptive_missing_reference_${iteration}__`);
    }
    return object;
  }
  return null;
}

function expectedForPlan(plan, seed) {
  if (plan.operator === 'accept_undeclared_status') {
    return {
      status: 'observe',
      reason: 'Adaptive probe for an undeclared response status; the source adapter must supply the contract verdict.',
    };
  }
  if (seed?.expected?.status === 'reject') return seed.expected;
  return {
    status: 'reject',
    reason: `Adaptive negative-control probe for ${plan.operator} on '${plan.target}'.`,
    errorClass: plan.operator,
  };
}

export function createAdaptiveSupplementalCase(corpus, plan, iteration, sequence) {
  const seed = findSeedCase(corpus, plan);
  const input = adaptiveInputForPlan(plan, seed?.input, iteration);
  if (input === null) return null;
  const expected = expectedForPlan(plan, seed);
  return createCorpusCase({
    id: `${corpus.capability}_adaptive_${plan.operator}_${plan.target}_${iteration}_${sequence}`,
    capability: corpus.capability,
    classification: expected.status === 'observe' ? 'mutation-probe' : 'invalid',
    input,
    expected,
    targets: uniqueStrings([
      ...(seed?.targets ?? []),
      `adaptive:${plan.operator}:${plan.target}`,
    ]),
    tags: uniqueStrings([
      ...(seed?.tags ?? []),
      'adaptive-corpus',
      `iteration:${iteration}`,
      `mutation-plan:${plan.id}`,
    ]),
    provenance: uniqueStrings([
      corpus.root,
      plan.root,
      ...(seed?.provenance ?? []),
    ]),
  });
}
