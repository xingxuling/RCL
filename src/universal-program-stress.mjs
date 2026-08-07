import { createHash } from 'node:crypto';

export const UNIVERSAL_STRESS_GATES = Object.freeze([
  'EXPRESS',
  'COMPILE',
  'LOWER',
  'EXECUTE',
  'CORRECT',
  'ROBUST',
  'PERFORMANCE',
  'AI_GENERATE',
  'EVIDENCE',
]);

export const STRESS_STATUS = Object.freeze({
  PASS: 'PASS',
  FAIL: 'FAIL',
  BLOCKED: 'BLOCKED',
  UNVERIFIED: 'UNVERIFIED',
});

export const COVERAGE_MODE = Object.freeze({
  NATIVE_SEMANTIC: 'native-semantic',
  LOWERED_EXECUTION: 'lowered-execution',
  OPAQUE_DELEGATION: 'opaque-delegation',
});

export const UNIVERSAL_ENVIRONMENTS = Object.freeze([
  'wasm-vm',
  'linux',
  'windows',
  'browser',
  'android',
  'server',
  'serverless',
  'database',
  'gpu',
  'game-runtime',
  'scientific-runtime',
  'ai-runtime',
  'distributed-runtime',
  'realtime-runtime',
  'embedded-runtime',
  'dataflow-runtime',
  'compiler-runtime',
  'automation-runtime',
  'simulation-runtime',
  'rncs-runtime',
]);

export const UNIVERSAL_PROGRAM_FAMILIES = Object.freeze([
  'algorithm',
  'cli',
  'gui',
  'web',
  'mobile',
  'database',
  'compiler',
  'game',
  'simulation',
  'distributed',
  'realtime',
  'scientific',
  'machine-learning',
  'agent',
  'media',
  'automation',
  'security-sensitive',
  'reactive',
  'self-hosting',
  'mixed-paradigm',
]);

export const KILLER_TASKS_V01 = Object.freeze([
  { id: 'K01', environment: 'compiler-runtime', programFamily: 'self-hosting', name: 'self-hosting compiler' },
  { id: 'K02', environment: 'browser', programFamily: 'web', name: 'complete web application' },
  { id: 'K03', environment: 'android', programFamily: 'mobile', name: 'native Android application' },
  { id: 'K04', environment: 'game-runtime', programFamily: 'game', name: '2D game' },
  { id: 'K05', environment: 'database', programFamily: 'database', name: 'database service' },
  { id: 'K06', environment: 'distributed-runtime', programFamily: 'distributed', name: 'distributed actor service' },
  { id: 'K07', environment: 'gpu', programFamily: 'scientific', name: 'GPU numerical program' },
  { id: 'K08', environment: 'ai-runtime', programFamily: 'machine-learning', name: 'ML training and inference' },
  { id: 'K09', environment: 'realtime-runtime', programFamily: 'realtime', name: 'real-time event system' },
  { id: 'K10', environment: 'scientific-runtime', programFamily: 'scientific', name: 'scientific computing program' },
  { id: 'K11', environment: 'automation-runtime', programFamily: 'agent', name: 'agent tool runtime' },
  { id: 'K12', environment: 'rncs-runtime', programFamily: 'security-sensitive', name: 'RNCS candidate reality transaction' },
]);

function sortForCanonicalJson(value) {
  if (Array.isArray(value)) return value.map(sortForCanonicalJson);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, sortForCanonicalJson(value[key])]),
    );
  }
  return value;
}

export function canonicalJson(value) {
  return JSON.stringify(sortForCanonicalJson(value));
}

export function evidenceRoot(value) {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

function normalizeGateResult(gate, raw) {
  if (typeof raw === 'string') {
    return { gate, status: raw, evidence: [] };
  }
  if (!raw) {
    return { gate, status: STRESS_STATUS.UNVERIFIED, evidence: [] };
  }
  return {
    gate,
    status: raw.status ?? STRESS_STATUS.UNVERIFIED,
    evidence: Array.isArray(raw.evidence) ? [...raw.evidence] : [],
    note: raw.note ?? null,
    metric: raw.metric ?? null,
  };
}

export function buildUniversalStressMatrix() {
  return UNIVERSAL_ENVIRONMENTS.flatMap((environment) =>
    UNIVERSAL_PROGRAM_FAMILIES.map((programFamily) => ({
      id: `${environment}::${programFamily}`,
      environment,
      programFamily,
      status: STRESS_STATUS.UNVERIFIED,
    })),
  );
}

export function evaluateStressCell(cell) {
  if (!UNIVERSAL_ENVIRONMENTS.includes(cell.environment)) {
    throw new Error(`RCL_STRESS_UNKNOWN_ENVIRONMENT:${cell.environment}`);
  }
  if (!UNIVERSAL_PROGRAM_FAMILIES.includes(cell.programFamily)) {
    throw new Error(`RCL_STRESS_UNKNOWN_PROGRAM_FAMILY:${cell.programFamily}`);
  }
  if (!Object.values(COVERAGE_MODE).includes(cell.coverageMode)) {
    throw new Error(`RCL_STRESS_UNKNOWN_COVERAGE_MODE:${cell.coverageMode}`);
  }

  const gates = Object.fromEntries(
    UNIVERSAL_STRESS_GATES.map((gate) => [gate, normalizeGateResult(gate, cell.gates?.[gate])]),
  );
  const required = UNIVERSAL_STRESS_GATES.map((gate) => gates[gate]);

  let status = STRESS_STATUS.PASS;
  if (required.some((gate) => gate.status === STRESS_STATUS.FAIL)) {
    status = STRESS_STATUS.FAIL;
  } else if (required.some((gate) => gate.status !== STRESS_STATUS.PASS)) {
    status = STRESS_STATUS.BLOCKED;
  }

  const providerOnly = cell.coverageMode === COVERAGE_MODE.OPAQUE_DELEGATION;
  const nativeSemanticCredit = cell.coverageMode === COVERAGE_MODE.NATIVE_SEMANTIC;
  const executableCredit =
    cell.coverageMode === COVERAGE_MODE.NATIVE_SEMANTIC ||
    cell.coverageMode === COVERAGE_MODE.LOWERED_EXECUTION;

  const specialCaseAudit = detectSpecialCaseInflation(cell.changes ?? []);
  const reportWithoutRoot = {
    schema: 'rcl.universal-stress.cell.v0.1',
    id: cell.id ?? `${cell.environment}::${cell.programFamily}`,
    environment: cell.environment,
    programFamily: cell.programFamily,
    coverageMode: cell.coverageMode,
    status,
    gates,
    providerOnly,
    nativeSemanticCredit,
    executableCredit,
    specialCaseAudit,
    authoritativeStateMutated: false,
  };

  return {
    ...reportWithoutRoot,
    evidenceRoot: evidenceRoot(reportWithoutRoot),
  };
}

export function detectSpecialCaseInflation(changes) {
  const normalized = changes.map((change, index) => ({
    id: change.id ?? `change-${index + 1}`,
    kind: change.kind ?? 'unknown',
    scope: Array.isArray(change.scope) ? [...change.scope] : [],
    generalPrimitive: change.generalPrimitive === true,
    justification: change.justification ?? null,
  }));
  const specialCases = normalized.filter((change) => !change.generalPrimitive && change.scope.length <= 1);
  return {
    status: specialCases.length === 0 ? STRESS_STATUS.PASS : STRESS_STATUS.FAIL,
    specialCaseCount: specialCases.length,
    specialCases: specialCases.map((change) => change.id),
    rule: 'environment-specific or task-specific patches do not count as universal capability growth',
  };
}

export function compareRegression(before, after, tolerance = 0) {
  const previous = new Map(before.map((item) => [item.id, Number(item.score ?? 0)]));
  const regressions = [];
  for (const item of after) {
    if (!previous.has(item.id)) continue;
    const delta = Number(item.score ?? 0) - previous.get(item.id);
    if (delta < -Math.abs(tolerance)) {
      regressions.push({ id: item.id, before: previous.get(item.id), after: Number(item.score ?? 0), delta });
    }
  }
  return {
    status: regressions.length === 0 ? STRESS_STATUS.PASS : STRESS_STATUS.FAIL,
    regressions,
  };
}

export function findUnabsorbedAdvantages(comparisons, { margin = 0.1, minGenerations = 2 } = {}) {
  return comparisons
    .filter((comparison) => {
      const advantage = Number(comparison.donorScore ?? 0) - Number(comparison.rclScore ?? 0);
      return advantage > margin && Number(comparison.generationsObserved ?? 0) >= minGenerations;
    })
    .map((comparison) => ({
      ...comparison,
      advantage: Number(comparison.donorScore ?? 0) - Number(comparison.rclScore ?? 0),
      classification: 'UNABSORBED_ADVANTAGE',
    }));
}

export function classifyUniversalMaturity({
  evaluatedCells = [],
  totalMatrixCells = UNIVERSAL_ENVIRONMENTS.length * UNIVERSAL_PROGRAM_FAMILIES.length,
  novelTaskTrials = 0,
  kernelChangesForNovelTasks = 0,
  competitiveComparisons = [],
  unabsorbedAdvantages = [],
} = {}) {
  const reports = evaluatedCells;
  const passed = reports.filter((report) => report.status === STRESS_STATUS.PASS);
  const passRatio = reports.length === 0 ? 0 : passed.length / reports.length;
  const expressRatio = reports.length === 0
    ? 0
    : reports.filter((report) => report.gates?.EXPRESS?.status === STRESS_STATUS.PASS).length / reports.length;
  const aiGenerateRatio = reports.length === 0
    ? 0
    : reports.filter((report) => report.gates?.AI_GENERATE?.status === STRESS_STATUS.PASS).length / reports.length;
  const matrixCoverage = totalMatrixCells === 0 ? 0 : reports.length / totalMatrixCells;
  const executablePassed = passed.filter((report) => report.executableCredit).length;
  const nativePassed = passed.filter((report) => report.nativeSemanticCredit).length;
  const opaquePassed = passed.filter((report) => report.providerOnly).length;
  const competitiveWins = competitiveComparisons.filter((item) => item.rclScore >= item.referenceScore).length;
  const competitiveRatio = competitiveComparisons.length === 0 ? 0 : competitiveWins / competitiveComparisons.length;
  const kernelChangeRate = novelTaskTrials === 0 ? 1 : kernelChangesForNovelTasks / novelTaskTrials;

  let level = 'PRE-U0';
  if (reports.length > 0 && expressRatio >= 0.8) level = 'U0';
  if (level === 'U0' && expressRatio >= 0.8 && aiGenerateRatio >= 0.8) level = 'U1';
  if (level === 'U1' && passRatio >= 0.6 && executablePassed >= 3) level = 'U2';
  if (
    level === 'U2' &&
    passed.length > 0 &&
    (nativePassed + passed.filter((report) => report.coverageMode === COVERAGE_MODE.LOWERED_EXECUTION).length) / passed.length >= 0.8 &&
    opaquePassed / passed.length <= 0.2
  ) level = 'U3';
  if (level === 'U3' && competitiveComparisons.length >= 5 && competitiveRatio >= 0.8) level = 'U4';
  if (
    level === 'U4' &&
    matrixCoverage >= 0.8 &&
    novelTaskTrials >= 10 &&
    kernelChangeRate <= 0.05 &&
    unabsorbedAdvantages.length === 0
  ) level = 'U5';

  return {
    schema: 'rcl.universal-stress.maturity.v0.1',
    level,
    metrics: {
      evaluatedCells: reports.length,
      passedCells: passed.length,
      passRatio,
      expressRatio,
      aiGenerateRatio,
      matrixCoverage,
      executablePassed,
      nativePassed,
      opaquePassed,
      competitiveRatio,
      kernelChangeRate,
      unabsorbedAdvantages: unabsorbedAdvantages.length,
    },
    caveat: 'maturity is evidence-bound; unexecuted or opaque-delegated claims do not receive native-language credit',
  };
}

export function decideGenomeAdmission({
  semanticNovelty = false,
  capabilityGain = false,
  implementationAdvantage = false,
  usesOpaqueDelegation = false,
  stressReports = [],
  regression = { status: STRESS_STATUS.UNVERIFIED },
  evidenceSufficient = false,
  identityGenomePreserved = false,
} = {}) {
  if (!semanticNovelty && !capabilityGain && !implementationAdvantage) return 'REJECT';
  if (regression.status === STRESS_STATUS.FAIL || !identityGenomePreserved) return 'REJECT';
  if (usesOpaqueDelegation && !semanticNovelty && !capabilityGain) return 'ORGAN_ONLY';

  const allStressPassed = stressReports.length > 0 && stressReports.every((report) => report.status === STRESS_STATUS.PASS);
  if (!allStressPassed || !evidenceSufficient) return 'EXPERIMENTAL_GENOME';
  return 'CANONICAL_RCL_GENOME';
}
