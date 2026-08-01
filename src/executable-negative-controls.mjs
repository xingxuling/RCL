import { realityRoot } from './canonical.mjs';
import {
  RCL_EXECUTION_OBSERVATION_FORMAT,
  createExecutionObservation,
  runIndependentDifferentialAbsorption,
} from './differential-absorption-runner.mjs';
import {
  RCL_EQUIVALENCE_CORPUS_FORMAT,
  RCL_CAPABILITY_CORPUS_FORMAT,
  safeIdentifier,
  uniqueStrings,
} from './equivalence-corpus-common.mjs';

export const RCL_EXECUTABLE_NEGATIVE_CONTROLS_VERSION = '0.1.0-alpha.1';
export const RCL_EXECUTABLE_NEGATIVE_CONTROL_SET_FORMAT =
  'rcl.executable-negative-control-set.v0.1';
export const RCL_CORPUS_DIFFERENTIAL_EXPERIMENT_FORMAT =
  'rcl.corpus-differential-experiment-report.v0.1';
export const RCL_ADAPTIVE_CAPABILITY_CORPUS_FORMAT =
  'rcl.adaptive-capability-equivalence-corpus.v0.1';

export class RCLExecutableNegativeControlError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'RCLExecutableNegativeControlError';
    this.code = code;
    this.details = details;
  }
}

function assertObject(value, code, message) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new RCLExecutableNegativeControlError(code, message, { value });
  }
  return value;
}

function clone(value) {
  if (value === undefined) return undefined;
  return structuredClone(value);
}

function withoutRoot(value) {
  const { root: _root, ...rest } = value;
  return rest;
}

export function verifyExecutableCorpusIntegrity(corpus) {
  const value = assertObject(
    corpus,
    'RCL_EXECUTABLE_CONTROL_CORPUS_INTEGRITY',
    'Capability corpus must be an object',
  );
  for (const testCase of value.cases ?? []) {
    const expected = realityRoot(withoutRoot(testCase));
    if (testCase.root !== expected) {
      throw new RCLExecutableNegativeControlError(
        'RCL_EXECUTABLE_CONTROL_CASE_INTEGRITY',
        `Corpus case '${testCase.id ?? 'unknown'}' root does not match its content`,
        { expectedRoot: expected, actualRoot: testCase.root },
      );
    }
  }
  for (const plan of value.mutationPlans ?? []) {
    const expected = realityRoot(withoutRoot(plan));
    if (plan.root !== expected) {
      throw new RCLExecutableNegativeControlError(
        'RCL_EXECUTABLE_CONTROL_PLAN_INTEGRITY',
        `Mutation plan '${plan.id ?? 'unknown'}' root does not match its content`,
        { expectedRoot: expected, actualRoot: plan.root },
      );
    }
  }
  const body = withoutRoot(value);
  const expectedCorpusRoot = realityRoot({
    ...body,
    cases: value.caseRoots ?? (value.cases ?? []).map(testCase => testCase.root),
    mutationPlans: value.mutationPlanRoots ?? (value.mutationPlans ?? []).map(plan => plan.root),
  });
  if (value.root !== expectedCorpusRoot) {
    throw new RCLExecutableNegativeControlError(
      'RCL_EXECUTABLE_CONTROL_CORPUS_INTEGRITY',
      'Capability corpus root does not match its cases, mutation plans, and metadata',
      { expectedRoot: expectedCorpusRoot, actualRoot: value.root },
    );
  }
  return Object.freeze({
    ok: true,
    corpusRoot: value.root,
    caseCount: (value.cases ?? []).length,
    mutationPlanCount: (value.mutationPlans ?? []).length,
  });
}

function selectCapabilityCorpus(input, capability = null) {
  const raw = assertObject(
    input,
    'RCL_EXECUTABLE_CONTROL_CORPUS_REQUIRED',
    'Executable negative controls require a corpus object',
  );
  if (
    raw.format === RCL_CAPABILITY_CORPUS_FORMAT
    || raw.format === RCL_ADAPTIVE_CAPABILITY_CORPUS_FORMAT
  ) {
    if (capability && safeIdentifier(capability) !== raw.capability) {
      throw new RCLExecutableNegativeControlError(
        'RCL_EXECUTABLE_CONTROL_CAPABILITY_MISMATCH',
        `Corpus capability '${raw.capability}' does not match '${safeIdentifier(capability)}'`,
      );
    }
    verifyExecutableCorpusIntegrity(raw);
    return raw;
  }
  if (raw.format !== RCL_EQUIVALENCE_CORPUS_FORMAT) {
    throw new RCLExecutableNegativeControlError(
      'RCL_EXECUTABLE_CONTROL_CORPUS_FORMAT',
      'Unsupported corpus format',
      { format: raw.format },
    );
  }
  if (!capability && raw.corpora.length !== 1) {
    throw new RCLExecutableNegativeControlError(
      'RCL_EXECUTABLE_CONTROL_CAPABILITY_SELECTION',
      'A capability id is required for a multi-capability corpus batch',
      { capabilities: raw.corpora.map(item => item.capability) },
    );
  }
  const selectedId = capability ? safeIdentifier(capability) : raw.corpora[0].capability;
  const corpus = raw.corpora.find(item => item.capability === selectedId);
  if (!corpus) {
    throw new RCLExecutableNegativeControlError(
      'RCL_EXECUTABLE_CONTROL_CAPABILITY_NOT_FOUND',
      `Capability '${selectedId}' is absent from the corpus batch`,
      { capabilities: raw.corpora.map(item => item.capability) },
    );
  }
  verifyExecutableCorpusIntegrity(corpus);
  return corpus;
}

function casesFromCorpus(corpus, options = {}) {
  const classifications = options.classifications
    ? new Set(options.classifications.map(String))
    : new Set(['valid', 'invalid', 'boundary', 'mutation-probe']);
  const includeObserve = options.includeObserve !== false;
  return corpus.cases
    .filter(testCase => classifications.has(testCase.classification))
    .filter(testCase => includeObserve || testCase.expected?.status !== 'observe')
    .map(testCase => Object.freeze({
      id: testCase.id,
      input: testCase.input,
      tags: uniqueStrings([
        ...(testCase.tags ?? []),
        `expected:${testCase.expected?.status ?? 'observe'}`,
        ...(testCase.targets ?? []).map(target => `target:${target}`),
      ]),
    }));
}

function normalizeAdapter(adapter, role) {
  const raw = assertObject(
    adapter,
    'RCL_EXECUTABLE_CONTROL_ADAPTER_INVALID',
    `${role} adapter must be an object`,
  );
  if (typeof raw.execute !== 'function') {
    throw new RCLExecutableNegativeControlError(
      'RCL_EXECUTABLE_CONTROL_ADAPTER_EXECUTE',
      `${role} adapter requires an execute function`,
      { executeType: typeof raw.execute },
    );
  }
  const descriptor = {
    id: safeIdentifier(raw.id ?? role),
    runtime: String(raw.runtime ?? `${role}-runtime`),
    artifactRoot: raw.artifactRoot ? String(raw.artifactRoot) : null,
    provenance: uniqueStrings(raw.provenance ?? []),
  };
  return Object.freeze({ ...descriptor, execute: raw.execute, root: realityRoot(descriptor) });
}

function normalizeObservation(value) {
  if (value?.format === RCL_EXECUTION_OBSERVATION_FORMAT) {
    return createExecutionObservation(value);
  }
  return createExecutionObservation({ output: value });
}

async function executeBaselineObservation(baseline, caseInput, context = {}) {
  try {
    const value = await baseline.execute(caseInput, {
      ...context,
      negativeControl: null,
    });
    return normalizeObservation(value);
  } catch (error) {
    return createExecutionObservation({ status: 'error', error });
  }
}

const ACCEPT_BYPASS_OPERATORS = new Set([
  'ignore_required',
  'ignore_type',
  'ignore_enum',
  'allow_additional_properties',
  'ignore_required_parameter',
  'ignore_required_body',
  'accept_undeclared_status',
  'ignore_not_null',
  'ignore_unique',
  'ignore_foreign_key',
]);

function setDecisionToAccept(output) {
  if (!output || typeof output !== 'object' || Array.isArray(output)) {
    return { changed: false, output };
  }
  const next = clone(output);
  let changed = false;
  for (const key of ['accepted', 'valid', 'ok']) {
    if (Object.hasOwn(next, key) && next[key] === false) {
      next[key] = true;
      changed = true;
    }
  }
  for (const key of ['decision', 'verdict']) {
    if (
      Object.hasOwn(next, key)
      && typeof next[key] === 'string'
      && ['reject', 'rejected', 'invalid', 'error'].includes(next[key].toLowerCase())
    ) {
      next[key] = 'accept';
      changed = true;
    }
  }
  if (
    typeof next.status === 'string'
    && ['reject', 'rejected', 'invalid', 'error'].includes(next.status.toLowerCase())
  ) {
    next.status = 'accepted';
    changed = true;
  }
  return { changed, output: next };
}

function applyAcceptBypass(observation, plan, context) {
  const accepted = observation.status === 'error'
    ? {
        changed: true,
        output: {
          decision: 'accept',
          bypassedError: observation.error,
        },
      }
    : setDecisionToAccept(observation.output);
  if (!accepted.changed) return observation;
  return createExecutionObservation({
    status: 'ok',
    output: accepted.output,
    effects: [
      ...observation.effects,
      {
        kind: 'negative-control-bypass',
        operator: plan.operator,
        target: plan.target,
        caseId: context.caseId,
      },
    ],
    evidence: [
      ...observation.evidence,
      {
        kind: 'executable-negative-control',
        mutationPlanRoot: plan.root,
        operator: plan.operator,
      },
    ],
    resourceDelta: observation.resourceDelta,
    authority: observation.authority,
    exitCode: 0,
    receipts: [
      ...observation.receipts,
      {
        kind: 'negative-control-runtime-receipt',
        mutationPlanRoot: plan.root,
        baselineObservationRoot: observation.root,
      },
    ],
    metadata: {
      mutationPlanRoot: plan.root,
      baselineSemanticRoot: observation.semanticRoot,
      changed: accepted.changed,
    },
  });
}

function defaultMutationHandler(plan) {
  if (ACCEPT_BYPASS_OPERATORS.has(plan.operator)) return applyAcceptBypass;
  return null;
}

function normalizePlan(plan) {
  const raw = assertObject(
    plan,
    'RCL_EXECUTABLE_CONTROL_PLAN_INVALID',
    'Mutation plan must be an object',
  );
  return Object.freeze({
    id: safeIdentifier(raw.id),
    capability: safeIdentifier(raw.capability),
    operator: safeIdentifier(raw.operator),
    target: String(raw.target ?? ''),
    description: String(raw.description ?? ''),
    expectedDetectionCaseIds: uniqueStrings(raw.expectedDetectionCaseIds ?? []).map(safeIdentifier),
    root: String(raw.root ?? realityRoot(raw)),
  });
}

export function synthesizeExecutableNegativeControls(input, options = {}) {
  const corpus = selectCapabilityCorpus(input, options.capability ?? null);
  const baseline = normalizeAdapter(
    options.baselineAdapter,
    'negative-control baseline',
  );
  const customHandlers = options.operatorHandlers ?? {};
  const caseIds = new Set(corpus.cases.map(testCase => testCase.id));
  const requiredPlanIds = [];
  const executablePlans = [];
  const blockedPlans = [];
  const negativeControls = [];

  for (const rawPlan of corpus.mutationPlans ?? []) {
    const plan = normalizePlan(rawPlan);
    requiredPlanIds.push(plan.id);
    const missingCaseIds = plan.expectedDetectionCaseIds.filter(id => !caseIds.has(id));
    const handler = customHandlers[plan.operator] ?? defaultMutationHandler(plan);
    const reasons = [];
    if (plan.expectedDetectionCaseIds.length === 0) reasons.push('no-detection-cases');
    if (missingCaseIds.length > 0) reasons.push('detection-case-missing-from-corpus');
    if (typeof handler !== 'function') reasons.push('operator-handler-unavailable');

    if (reasons.length > 0) {
      const blocked = Object.freeze({
        id: plan.id,
        planRoot: plan.root,
        operator: plan.operator,
        target: plan.target,
        reasons,
        missingCaseIds,
        root: realityRoot({
          id: plan.id,
          planRoot: plan.root,
          reasons,
          missingCaseIds,
        }),
      });
      blockedPlans.push(blocked);
      const descriptor = {
        id: `${baseline.id}_blocked_mutant_${plan.id}`,
        runtime: `${baseline.runtime}+rcl-negative-control/blocked`,
        artifactRoot: plan.root,
        provenance: uniqueStrings([
          ...baseline.provenance,
          `mutation-plan:${plan.root}`,
          `blocked-control:${blocked.root}`,
        ]),
      };
      const adapter = Object.freeze({
        ...descriptor,
        root: realityRoot(descriptor),
        async execute(caseInput, context = {}) {
          return executeBaselineObservation(baseline, caseInput, context);
        },
      });
      negativeControls.push(Object.freeze({
        id: plan.id,
        adapter,
        mustDifferCaseIds: plan.expectedDetectionCaseIds,
      }));
      continue;
    }

    const descriptor = {
      id: `${baseline.id}_mutant_${plan.id}`,
      runtime: `${baseline.runtime}+rcl-negative-control/${plan.operator}`,
      artifactRoot: plan.root,
      provenance: uniqueStrings([
        ...baseline.provenance,
        `mutation-plan:${plan.root}`,
        `baseline-adapter:${baseline.root}`,
      ]),
    };
    const adapter = Object.freeze({
      ...descriptor,
      root: realityRoot(descriptor),
      async execute(caseInput, context = {}) {
        const observation = await executeBaselineObservation(baseline, caseInput, context);
        if (!plan.expectedDetectionCaseIds.includes(safeIdentifier(context.caseId))) {
          return observation;
        }
        return handler(observation, plan, context);
      },
    });
    const control = Object.freeze({
      id: plan.id,
      adapter,
      mustDifferCaseIds: plan.expectedDetectionCaseIds,
    });
    negativeControls.push(control);
    executablePlans.push(Object.freeze({
      id: plan.id,
      planRoot: plan.root,
      operator: plan.operator,
      target: plan.target,
      adapterRoot: adapter.root,
      detectionCaseIds: plan.expectedDetectionCaseIds,
      root: realityRoot({
        id: plan.id,
        planRoot: plan.root,
        adapterRoot: adapter.root,
        detectionCaseIds: plan.expectedDetectionCaseIds,
      }),
    }));
  }

  const descriptor = {
    format: RCL_EXECUTABLE_NEGATIVE_CONTROL_SET_FORMAT,
    version: RCL_EXECUTABLE_NEGATIVE_CONTROLS_VERSION,
    capability: corpus.capability,
    capabilityCorpusRoot: corpus.root,
    baselineAdapter: {
      id: baseline.id,
      runtime: baseline.runtime,
      artifactRoot: baseline.artifactRoot,
      root: baseline.root,
    },
    requiredPlanIds,
    executablePlanIds: executablePlans.map(item => item.id),
    executablePlanRoots: executablePlans.map(item => item.root),
    blockedPlanIds: blockedPlans.map(item => item.id),
    blockedPlanRoots: blockedPlans.map(item => item.root),
    coverageComplete: blockedPlans.length === 0,
    proofLevel: 'operator-level-runtime-wrapper',
    boundary: 'Executable negative controls wrap one supplied baseline adapter in the current process. They mutate observable contract decisions according to content-addressed mutation plans; they are not source-code, AST, binary, or process-isolation mutations.',
  };
  return Object.freeze({
    ...descriptor,
    executablePlans,
    blockedPlans,
    negativeControls,
    root: realityRoot(descriptor),
  });
}

export async function runCorpusDifferentialExperiment(input) {
  const raw = assertObject(
    input,
    'RCL_CORPUS_EXPERIMENT_INVALID',
    'Corpus differential experiment request must be an object',
  );
  const corpus = selectCapabilityCorpus(raw.corpus, raw.capability ?? null);
  const source = normalizeAdapter(raw.source, 'source');
  const absorbed = normalizeAdapter(raw.absorbed, 'absorbed');
  const baseline = raw.negativeControlBaseline === 'source' ? source : absorbed;
  const controlSet = synthesizeExecutableNegativeControls(corpus, {
    capability: corpus.capability,
    baselineAdapter: baseline,
    operatorHandlers: raw.operatorHandlers,
  });
  const cases = casesFromCorpus(corpus, {
    includeObserve: raw.includeObserve !== false,
    classifications: raw.classifications,
  });
  const differential = await runIndependentDifferentialAbsorption({
    capability: corpus.capability,
    source,
    absorbed,
    cases,
    repeats: raw.repeats,
    timeoutMs: raw.timeoutMs,
    requireDeterministicReplay: raw.requireDeterministicReplay,
    requireNegativeControl: raw.requireNegativeControl,
    negativeControls: controlSet.negativeControls,
  });
  const body = {
    format: RCL_CORPUS_DIFFERENTIAL_EXPERIMENT_FORMAT,
    version: RCL_EXECUTABLE_NEGATIVE_CONTROLS_VERSION,
    capability: corpus.capability,
    capabilityCorpusRoot: corpus.root,
    controlSetRoot: controlSet.root,
    differentialRoot: differential.root,
    caseCount: cases.length,
    requiredNegativeControlCount: controlSet.requiredPlanIds.length,
    executableNegativeControlCount: controlSet.executablePlanIds.length,
    blockedNegativeControlCount: controlSet.blockedPlanIds.length,
    passed: differential.passed === true,
    promotionEligible: differential.promotionEligible === true,
    boundary: 'This experiment invokes supplied adapters and synthesized operator-level negative controls in the current process. Promotion remains bounded by the Differential Absorption and Native Promotion evidence contracts.',
  };
  return Object.freeze({
    ...body,
    corpus,
    controlSet,
    differential,
    root: realityRoot(body),
  });
}
