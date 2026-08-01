import { realityRoot } from './canonical.mjs';

export const RCL_DIFFERENTIAL_ABSORPTION_VERSION = '0.1.0-alpha.1';
export const RCL_EXECUTION_OBSERVATION_FORMAT = 'rcl.execution-observation.v0.1';
export const RCL_DIFFERENTIAL_ABSORPTION_REPORT_FORMAT = 'rcl.independent-differential-absorption-report.v0.1';

export class RCLDifferentialAbsorptionError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'RCLDifferentialAbsorptionError';
    this.code = code;
    this.details = details;
  }
}

function assertObject(value, code, message) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new RCLDifferentialAbsorptionError(code, message, { value });
  }
  return value;
}

function nonEmptyString(value, code, message) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new RCLDifferentialAbsorptionError(code, message, { value });
  }
  return value.trim();
}

function safeIdentifier(value, fallback = 'case') {
  const normalized = String(value ?? '')
    .trim()
    .replace(/[^A-Za-z0-9_]+/g, '_')
    .replace(/^([^A-Za-z_])/, '_$1')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized || fallback;
}

function positiveInteger(value, fallback, code, message) {
  const candidate = value ?? fallback;
  if (!Number.isInteger(candidate) || candidate <= 0) {
    throw new RCLDifferentialAbsorptionError(code, message, { value: candidate });
  }
  return candidate;
}

function normalizeError(error) {
  if (!error || typeof error !== 'object') {
    return Object.freeze({
      code: 'RCL_EXTERNAL_RUNTIME_ERROR',
      message: String(error),
      details: null,
    });
  }
  return Object.freeze({
    code: String(error.code ?? error.name ?? 'RCL_EXTERNAL_RUNTIME_ERROR'),
    message: String(error.message ?? error),
    details: error.details ?? null,
  });
}

function normalizeList(value) {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

export function createExecutionObservation(input = {}) {
  const raw = assertObject(input, 'RCL_DIFFERENTIAL_OBSERVATION_INVALID', 'Execution observation must be an object');
  const status = raw.status ?? (raw.error ? 'error' : 'ok');
  if (!['ok', 'error'].includes(status)) {
    throw new RCLDifferentialAbsorptionError(
      'RCL_DIFFERENTIAL_OBSERVATION_STATUS',
      "Execution observation status must be 'ok' or 'error'",
      { status },
    );
  }

  const semantic = {
    status,
    output: status === 'ok' ? (raw.output ?? null) : null,
    error: status === 'error' ? normalizeError(raw.error ?? raw) : null,
    effects: normalizeList(raw.effects),
    evidence: normalizeList(raw.evidence),
    resourceDelta: raw.resourceDelta ?? null,
    authority: raw.authority ?? null,
    exitCode: raw.exitCode ?? null,
  };
  const observation = {
    format: RCL_EXECUTION_OBSERVATION_FORMAT,
    ...semantic,
    receipts: normalizeList(raw.receipts),
    metadata: raw.metadata ?? null,
    semanticRoot: realityRoot(semantic),
  };
  return Object.freeze({ ...observation, root: realityRoot(observation) });
}

function normalizeExecutorResult(value) {
  if (value?.format === RCL_EXECUTION_OBSERVATION_FORMAT) {
    return createExecutionObservation(value);
  }
  return createExecutionObservation({ output: value });
}

function normalizeAdapter(adapter, role) {
  const raw = assertObject(adapter, 'RCL_DIFFERENTIAL_ADAPTER_INVALID', `${role} adapter must be an object`);
  if (typeof raw.execute !== 'function') {
    throw new RCLDifferentialAbsorptionError(
      'RCL_DIFFERENTIAL_ADAPTER_EXECUTE',
      `${role} adapter requires an execute function`,
      { role, executeType: typeof raw.execute },
    );
  }
  const descriptor = {
    id: safeIdentifier(nonEmptyString(raw.id, 'RCL_DIFFERENTIAL_ADAPTER_ID', `${role} adapter requires an id`), role),
    runtime: nonEmptyString(raw.runtime, 'RCL_DIFFERENTIAL_ADAPTER_RUNTIME', `${role} adapter requires a runtime identity`),
    artifactRoot: raw.artifactRoot ? String(raw.artifactRoot) : null,
    provenance: normalizeList(raw.provenance).map(String),
  };
  return Object.freeze({ ...descriptor, execute: raw.execute, root: realityRoot(descriptor) });
}

function normalizeCase(testCase, index) {
  const raw = assertObject(testCase, 'RCL_DIFFERENTIAL_CASE_INVALID', 'Differential case must be an object');
  return Object.freeze({
    id: safeIdentifier(raw.id ?? `case_${index + 1}`),
    input: raw.input ?? null,
    tags: normalizeList(raw.tags).map(String),
  });
}

function normalizeControl(control, index) {
  const raw = assertObject(control, 'RCL_DIFFERENTIAL_CONTROL_INVALID', 'Negative control must be an object');
  return Object.freeze({
    id: safeIdentifier(raw.id ?? `negative_control_${index + 1}`),
    adapter: normalizeAdapter(raw.adapter, `negative control '${raw.id ?? index + 1}'`),
    mustDifferCaseIds: normalizeList(raw.mustDifferCaseIds).map(safeIdentifier),
  });
}

async function withTimeout(promise, timeoutMs, context) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new RCLDifferentialAbsorptionError(
          'RCL_DIFFERENTIAL_EXECUTION_TIMEOUT',
          `Execution exceeded ${timeoutMs}ms`,
          context,
        )), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function executeOnce(adapter, testCase, repetition, timeoutMs) {
  const started = process.hrtime.bigint();
  let observation;
  try {
    const value = await withTimeout(
      Promise.resolve().then(() => adapter.execute(testCase.input, {
        caseId: testCase.id,
        repetition,
        adapter: { id: adapter.id, runtime: adapter.runtime, artifactRoot: adapter.artifactRoot },
      })),
      timeoutMs,
      { timeoutMs },
    );
    observation = normalizeExecutorResult(value);
  } catch (error) {
    observation = createExecutionObservation({ status: 'error', error });
  }
  const durationMs = Number(process.hrtime.bigint() - started) / 1_000_000;
  return Object.freeze({
    repetition,
    observation,
    durationMs: Number(durationMs.toFixed(3)),
    root: realityRoot({ repetition, observationRoot: observation.root }),
  });
}

async function executeAdapterCase(adapter, testCase, repeats, timeoutMs) {
  const runs = [];
  for (let repetition = 1; repetition <= repeats; repetition += 1) {
    runs.push(await executeOnce(adapter, testCase, repetition, timeoutMs));
  }
  const semanticRoots = runs.map(run => run.observation.semanticRoot);
  const deterministic = semanticRoots.every(root => root === semanticRoots[0]);
  const result = {
    adapter: { id: adapter.id, runtime: adapter.runtime, artifactRoot: adapter.artifactRoot, root: adapter.root },
    caseId: testCase.id,
    repeats,
    deterministic,
    semanticRoots,
    runs,
    primary: runs[0].observation,
  };
  return Object.freeze({ ...result, root: realityRoot({
    ...result,
    runs: runs.map(run => run.root),
    primary: runs[0].observation.root,
  }) });
}

function compareAdapterRuns(sourceRun, absorbedRun, requireDeterministicReplay) {
  const equivalent = sourceRun.primary.semanticRoot === absorbedRun.primary.semanticRoot;
  const replayPassed = !requireDeterministicReplay || (sourceRun.deterministic && absorbedRun.deterministic);
  const timeoutCodes = new Set(['RCL_DIFFERENTIAL_EXECUTION_TIMEOUT']);
  const infrastructureFailure = [sourceRun.primary, absorbedRun.primary]
    .some(observation => observation.status === 'error' && timeoutCodes.has(observation.error?.code));
  const comparison = {
    caseId: sourceRun.caseId,
    sourceSemanticRoot: sourceRun.primary.semanticRoot,
    absorbedSemanticRoot: absorbedRun.primary.semanticRoot,
    equivalent,
    sourceDeterministic: sourceRun.deterministic,
    absorbedDeterministic: absorbedRun.deterministic,
    replayPassed,
    infrastructureFailure,
    passed: equivalent && replayPassed && !infrastructureFailure,
  };
  return Object.freeze({ ...comparison, root: realityRoot(comparison) });
}

async function evaluateNegativeControl(control, cases, sourceRuns, repeats, timeoutMs, requireDeterministicReplay) {
  const comparisons = [];
  const controlRuns = [];
  for (let index = 0; index < cases.length; index += 1) {
    const testCase = cases[index];
    const run = await executeAdapterCase(control.adapter, testCase, repeats, timeoutMs);
    const comparison = compareAdapterRuns(sourceRuns[index], run, requireDeterministicReplay);
    controlRuns.push(run);
    comparisons.push(comparison);
  }

  const requiredCaseIds = control.mustDifferCaseIds.length > 0
    ? control.mustDifferCaseIds
    : cases.map(testCase => testCase.id);
  const detectedCaseIds = comparisons.filter(comparison => !comparison.passed).map(comparison => comparison.caseId);
  const missingDetections = requiredCaseIds.filter(caseId => !detectedCaseIds.includes(caseId));
  const report = {
    id: control.id,
    adapter: { id: control.adapter.id, runtime: control.adapter.runtime, root: control.adapter.root },
    requiredCaseIds,
    detectedCaseIds,
    missingDetections,
    detected: missingDetections.length === 0,
    comparisons,
    runs: controlRuns,
  };
  return Object.freeze({ ...report, root: realityRoot({
    ...report,
    comparisons: comparisons.map(comparison => comparison.root),
    runs: controlRuns.map(run => run.root),
  }) });
}

function coverageFromCases(caseReports) {
  const observations = caseReports.flatMap(report => [report.source.primary, report.absorbed.primary]);
  return Object.freeze({
    successObserved: observations.some(observation => observation.status === 'ok'),
    errorObserved: observations.some(observation => observation.status === 'error'),
    effectsObserved: observations.some(observation => observation.effects.length > 0),
    evidenceObserved: observations.some(observation => observation.evidence.length > 0),
    receiptsObserved: observations.some(observation => observation.receipts.length > 0),
    resourceDeltaObserved: observations.some(observation => observation.resourceDelta !== null),
    authorityObserved: observations.some(observation => observation.authority !== null),
  });
}

function evidenceScore({ independence, caseReports, controls, coverage }) {
  const dimensions = [
    independence.satisfied,
    caseReports.length > 0 && caseReports.every(report => report.comparison.equivalent),
    caseReports.length > 0 && caseReports.every(report => report.source.deterministic),
    caseReports.length > 0 && caseReports.every(report => report.absorbed.deterministic),
    controls.length > 0 && controls.every(control => control.detected),
    coverage.successObserved,
    coverage.errorObserved,
    coverage.effectsObserved,
    coverage.evidenceObserved,
    coverage.resourceDeltaObserved,
    coverage.authorityObserved,
  ];
  return Number((dimensions.filter(Boolean).length / dimensions.length).toFixed(6));
}

export async function runIndependentDifferentialAbsorption(input) {
  const raw = assertObject(input, 'RCL_DIFFERENTIAL_REQUEST_INVALID', 'Differential absorption request must be an object');
  const capability = safeIdentifier(nonEmptyString(raw.capability, 'RCL_DIFFERENTIAL_CAPABILITY', 'Capability id is required'));
  const source = normalizeAdapter(raw.source, 'source');
  const absorbed = normalizeAdapter(raw.absorbed, 'absorbed');
  const cases = normalizeList(raw.cases).map(normalizeCase);
  if (cases.length === 0) {
    throw new RCLDifferentialAbsorptionError('RCL_DIFFERENTIAL_CASES_REQUIRED', 'At least one differential case is required');
  }
  const repeats = positiveInteger(raw.repeats, 2, 'RCL_DIFFERENTIAL_REPEATS', 'Repeats must be a positive integer');
  const timeoutMs = positiveInteger(raw.timeoutMs, 5_000, 'RCL_DIFFERENTIAL_TIMEOUT', 'Timeout must be a positive integer');
  const requireDeterministicReplay = raw.requireDeterministicReplay !== false;
  const requireNegativeControl = raw.requireNegativeControl !== false;
  const controls = normalizeList(raw.negativeControls).map(normalizeControl);

  const independence = Object.freeze({
    sourceId: source.id,
    absorbedId: absorbed.id,
    sourceRuntime: source.runtime,
    absorbedRuntime: absorbed.runtime,
    descriptorRootsDistinct: source.root !== absorbed.root,
    executorReferencesDistinct: source.execute !== absorbed.execute,
    runtimesDistinct: source.runtime !== absorbed.runtime,
    satisfied: source.root !== absorbed.root && source.execute !== absorbed.execute,
    proofLevel: 'declared-separate-adapters',
    boundary: 'Distinct descriptors and function references are evidence of separation, not cryptographic proof of process or implementation independence.',
  });
  if (!independence.satisfied) {
    throw new RCLDifferentialAbsorptionError(
      'RCL_DIFFERENTIAL_INDEPENDENCE_REQUIRED',
      'Source and absorbed adapters must have distinct descriptors and execute function references',
      independence,
    );
  }

  const caseReports = [];
  const sourceRuns = [];
  for (const testCase of cases) {
    const sourceRun = await executeAdapterCase(source, testCase, repeats, timeoutMs);
    const absorbedRun = await executeAdapterCase(absorbed, testCase, repeats, timeoutMs);
    const comparison = compareAdapterRuns(sourceRun, absorbedRun, requireDeterministicReplay);
    sourceRuns.push(sourceRun);
    const caseReport = {
      id: testCase.id,
      inputRoot: realityRoot(testCase.input),
      tags: testCase.tags,
      source: sourceRun,
      absorbed: absorbedRun,
      comparison,
    };
    caseReports.push(Object.freeze({ ...caseReport, root: realityRoot({
      ...caseReport,
      source: sourceRun.root,
      absorbed: absorbedRun.root,
      comparison: comparison.root,
    }) }));
  }

  const controlReports = [];
  for (const control of controls) {
    controlReports.push(await evaluateNegativeControl(
      control,
      cases,
      sourceRuns,
      repeats,
      timeoutMs,
      requireDeterministicReplay,
    ));
  }

  const coverage = coverageFromCases(caseReports);
  const controlsPassed = !requireNegativeControl || (controlReports.length > 0 && controlReports.every(control => control.detected));
  const casesPassed = caseReports.every(report => report.comparison.passed);
  const score = evidenceScore({ independence, caseReports, controls: controlReports, coverage });
  const passed = independence.satisfied && casesPassed && controlsPassed;
  const report = {
    format: RCL_DIFFERENTIAL_ABSORPTION_REPORT_FORMAT,
    version: RCL_DIFFERENTIAL_ABSORPTION_VERSION,
    capability,
    evidenceKind: 'independent-differential-execution',
    passed,
    score,
    repeats,
    timeoutMs,
    requireDeterministicReplay,
    requireNegativeControl,
    independence,
    caseCount: caseReports.length,
    passedCaseCount: caseReports.filter(caseReport => caseReport.comparison.passed).length,
    failedCaseCount: caseReports.filter(caseReport => !caseReport.comparison.passed).length,
    cases: caseReports,
    negativeControls: controlReports,
    controlsPassed,
    coverage,
    promotionEligible: passed && score >= 0.8,
    boundary: 'This report compares independently invoked adapters in the current process. It does not prove external process isolation, compiler correctness, RBC lowering, or native-VM parity.',
  };
  return Object.freeze({ ...report, root: realityRoot({
    ...report,
    cases: caseReports.map(caseReport => caseReport.root),
    negativeControls: controlReports.map(control => control.root),
  }) });
}

export function attachIndependentDifferentialEvidence(metabolismReport, differentialReport) {
  const metabolism = assertObject(
    metabolismReport,
    'RCL_DIFFERENTIAL_METABOLISM_REPORT',
    'Capability metabolism report must be an object',
  );
  const differential = assertObject(
    differentialReport,
    'RCL_DIFFERENTIAL_REPORT',
    'Differential absorption report must be an object',
  );
  if (metabolism.format !== 'rcl.capability-metabolism-report.v0.1') {
    throw new RCLDifferentialAbsorptionError(
      'RCL_DIFFERENTIAL_METABOLISM_FORMAT',
      'Unsupported capability metabolism report format',
      { format: metabolism.format },
    );
  }
  if (differential.format !== RCL_DIFFERENTIAL_ABSORPTION_REPORT_FORMAT) {
    throw new RCLDifferentialAbsorptionError(
      'RCL_DIFFERENTIAL_REPORT_FORMAT',
      'Unsupported differential absorption report format',
      { format: differential.format },
    );
  }
  if (metabolism.capability !== differential.capability) {
    throw new RCLDifferentialAbsorptionError(
      'RCL_DIFFERENTIAL_CAPABILITY_MISMATCH',
      'Metabolism and differential reports must refer to the same capability',
      { metabolism: metabolism.capability, differential: differential.capability },
    );
  }

  const envelope = {
    format: 'rcl.capability-metabolism-evidence-envelope.v0.1',
    capability: metabolism.capability,
    metabolismReportRoot: metabolism.root,
    declaredEquivalenceRoot: metabolism.equivalence?.root ?? null,
    independentDifferentialRoot: differential.root,
    verificationTier: differential.passed ? 'independent-differential' : 'declared-only',
    promotionEligible: differential.promotionEligible === true,
    evidenceScore: differential.score,
    boundary: 'Independent differential evidence strengthens a metabolism candidate but does not by itself establish executable RCL bytecode or native-runtime verification.',
  };
  return Object.freeze({ ...envelope, root: realityRoot(envelope) });
}
