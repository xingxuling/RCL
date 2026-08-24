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
  UNTESTED: 'UNTESTED',
  REGRESSED: 'REGRESSED',
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

export const K400_TOTAL_CELLS = UNIVERSAL_ENVIRONMENTS.length * UNIVERSAL_PROGRAM_FAMILIES.length;

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

export function reportEvidenceRoot(report) {
  const { generatedAt: _generatedAt, reportRoot: _reportRoot, ...stableReport } = report ?? {};
  return evidenceRoot(stableReport);
}

export function campaignCellIdFor(environment, programFamily) {
  const environmentIndex = UNIVERSAL_ENVIRONMENTS.indexOf(environment);
  if (environmentIndex < 0) throw new Error(`RCL_STRESS_UNKNOWN_ENVIRONMENT:${environment}`);
  const programIndex = UNIVERSAL_PROGRAM_FAMILIES.indexOf(programFamily);
  if (programIndex < 0) throw new Error(`RCL_STRESS_UNKNOWN_PROGRAM_FAMILY:${programFamily}`);
  const ordinal = (environmentIndex * UNIVERSAL_PROGRAM_FAMILIES.length) + programIndex + 1;
  return `K${String(ordinal).padStart(3, '0')}`;
}

export function validateUniversalStressEvidence(evidence) {
  const errors = [];
  if (!evidence || evidence.schema !== 'rcl.universal-stress.evidence.v0.1') {
    errors.push(`schema:${evidence?.schema ?? 'missing'}`);
  }
  if (typeof evidence?.generation !== 'string' || evidence.generation.trim().length === 0) {
    errors.push('generation:missing');
  }
  if (!Array.isArray(evidence?.claims)) errors.push('claims:not-array');

  const matrix = buildUniversalStressMatrix();
  const matrixById = new Map(matrix.map((cell) => [cell.id, cell]));
  const seen = new Set();
  for (const [index, claim] of (Array.isArray(evidence?.claims) ? evidence.claims : []).entries()) {
    const prefix = `claims[${index}]`;
    if (!claim || typeof claim.id !== 'string') {
      errors.push(`${prefix}.id:missing`);
      continue;
    }
    if (seen.has(claim.id)) errors.push(`${prefix}.id:duplicate:${claim.id}`);
    seen.add(claim.id);
    const matrixCell = matrixById.get(claim.id);
    if (!matrixCell) {
      errors.push(`${prefix}.id:unknown:${claim.id}`);
      continue;
    }
    if (claim.environment !== undefined && claim.environment !== matrixCell.environment) {
      errors.push(`${prefix}.environment:mismatch:${claim.environment}`);
    }
    if (claim.programFamily !== undefined && claim.programFamily !== matrixCell.programFamily) {
      errors.push(`${prefix}.programFamily:mismatch:${claim.programFamily}`);
    }
    if (!Object.values(COVERAGE_MODE).includes(claim.coverageMode)) {
      errors.push(`${prefix}.coverageMode:unknown:${claim.coverageMode ?? 'missing'}`);
    }
    const unknownGates = Object.keys(claim.gates ?? {}).filter((gate) => !UNIVERSAL_STRESS_GATES.includes(gate));
    for (const gate of unknownGates) errors.push(`${prefix}.gates:unknown:${gate}`);
    for (const [gate, value] of Object.entries(claim.gates ?? {})) {
      const status = typeof value === 'string' ? value : value?.status;
      if (!Object.values(STRESS_STATUS).includes(status)) {
        errors.push(`${prefix}.gates.${gate}.status:unknown:${status ?? 'missing'}`);
      }
      const refs = typeof value === 'string' ? [] : value?.evidence;
      if (refs !== undefined && (!Array.isArray(refs) || refs.some((ref) => typeof ref !== 'string' || ref.length === 0))) {
        errors.push(`${prefix}.gates.${gate}.evidence:invalid`);
      }
    }
    if (claim.lastVerifiedSha !== undefined && claim.lastVerifiedSha !== null && !/^[0-9a-f]{40}$/.test(claim.lastVerifiedSha)) {
      errors.push(`${prefix}.lastVerifiedSha:invalid`);
    }
    if (claim.lastVerifiedDate !== undefined && claim.lastVerifiedDate !== null && !/^\d{4}-\d{2}-\d{2}$/.test(claim.lastVerifiedDate)) {
      errors.push(`${prefix}.lastVerifiedDate:invalid`);
    }
  }

  return {
    schema: 'rcl.universal-stress.evidence-validation.v0.1',
    ok: errors.length === 0,
    claimCount: Array.isArray(evidence?.claims) ? evidence.claims.length : 0,
    errors,
  };
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
      campaignId: campaignCellIdFor(environment, programFamily),
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
  if (cell.untested === true || cell.status === STRESS_STATUS.UNTESTED) {
    status = STRESS_STATUS.UNTESTED;
  } else if (cell.status === STRESS_STATUS.REGRESSED || cell.regression?.status === STRESS_STATUS.FAIL) {
    status = STRESS_STATUS.REGRESSED;
  } else if (required.some((gate) => gate.status === STRESS_STATUS.FAIL)) {
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
  const universalGrowthEligible =
    status === STRESS_STATUS.PASS &&
    specialCaseAudit.status === STRESS_STATUS.PASS &&
    !providerOnly;

  const reportWithoutRoot = {
    schema: 'rcl.universal-stress.cell.v0.1',
    id: cell.id ?? `${cell.environment}::${cell.programFamily}`,
    campaignId: campaignCellIdFor(cell.environment, cell.programFamily),
    environment: cell.environment,
    programFamily: cell.programFamily,
    coverageMode: cell.coverageMode,
    status,
    gates,
    gateStatus: Object.fromEntries(UNIVERSAL_STRESS_GATES.map((gate) => [gate, gates[gate].status])),
    evidence: [...new Set(UNIVERSAL_STRESS_GATES.flatMap((gate) => gates[gate].evidence))],
    lastVerifiedSha: cell.lastVerifiedSha ?? null,
    lastVerifiedDate: cell.lastVerifiedDate ?? null,
    knownLimits: Array.isArray(cell.knownLimits) ? [...cell.knownLimits] : [],
    relatedKillerTasks: Array.isArray(cell.relatedKillerTasks) ? [...cell.relatedKillerTasks] : [],
    requiredGenes: Array.isArray(cell.requiredGenes) ? [...cell.requiredGenes] : [],
    donorAdvantages: Array.isArray(cell.donorAdvantages) ? structuredClone(cell.donorAdvantages) : [],
    regression: cell.regression ?? null,
    providerOnly,
    nativeSemanticCredit,
    executableCredit,
    specialCaseAudit,
    universalGrowthEligible,
    authoritativeStateMutated: false,
  };

  return {
    ...reportWithoutRoot,
    evidenceRoot: evidenceRoot(reportWithoutRoot),
  };
}

export function auditK400Completion(reports) {
  const list = Array.isArray(reports) ? reports : [];
  const expected = buildUniversalStressMatrix();
  const expectedIds = new Set(expected.map((cell) => cell.id));
  const seenIds = new Set();
  const duplicateIds = [];
  const unknownIds = [];
  for (const report of list) {
    if (seenIds.has(report.id)) duplicateIds.push(report.id);
    seenIds.add(report.id);
    if (!expectedIds.has(report.id)) unknownIds.push(report.id);
  }
  const missingIds = expected.filter((cell) => !seenIds.has(cell.id)).map((cell) => cell.id);
  const statusCounts = Object.fromEntries(
    Object.values(STRESS_STATUS).map((status) => [status, list.filter((report) => report.status === status).length]),
  );
  const nonPass = list.filter((report) => report.status !== STRESS_STATUS.PASS);
  const gateBlockers = Object.fromEntries(UNIVERSAL_STRESS_GATES.map((gate) => [gate,
    list.filter((report) => report.gates?.[gate]?.status !== STRESS_STATUS.PASS).length,
  ]));
  const evidenceComplete =
    list.length === K400_TOTAL_CELLS &&
    missingIds.length === 0 &&
    duplicateIds.length === 0 &&
    unknownIds.length === 0 &&
    nonPass.length === 0;
  const universalGrowthComplete = evidenceComplete && list.every((report) => report.universalGrowthEligible === true);
  const prioritized = [...nonPass].sort((a, b) => {
    const rank = { REGRESSED: 0, FAIL: 1, BLOCKED: 2, UNVERIFIED: 3, UNTESTED: 4 };
    const statusDelta = (rank[a.status] ?? 5) - (rank[b.status] ?? 5);
    if (statusDelta !== 0) return statusDelta;
    const missingGateDelta = UNIVERSAL_STRESS_GATES.filter((gate) => a.gates?.[gate]?.status !== STRESS_STATUS.PASS).length
      - UNIVERSAL_STRESS_GATES.filter((gate) => b.gates?.[gate]?.status !== STRESS_STATUS.PASS).length;
    if (missingGateDelta !== 0) return missingGateDelta;
    return a.campaignId.localeCompare(b.campaignId);
  });

  return {
    schema: 'rcl.universal-stress.k400-completion.v0.1',
    verdict: universalGrowthComplete ? 'COMPLETE' : 'INCOMPLETE',
    evidenceComplete,
    universalGrowthComplete,
    totalCells: K400_TOTAL_CELLS,
    reportedCells: list.length,
    passedCells: statusCounts.PASS,
    remainingCells: K400_TOTAL_CELLS - statusCounts.PASS,
    statusCounts,
    gateBlockers,
    missingIds,
    duplicateIds: [...new Set(duplicateIds)],
    unknownIds: [...new Set(unknownIds)],
    nextPriority: prioritized.slice(0, 12).map((report) => ({
      campaignId: report.campaignId,
      id: report.id,
      status: report.status,
      blockingGates: UNIVERSAL_STRESS_GATES.filter((gate) => report.gates?.[gate]?.status !== STRESS_STATUS.PASS),
    })),
    rule: 'K400 is complete only when all 400 stable cells pass every non-compensatory gate without special-case or opaque-delegation growth credit.',
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
  const generalPassed = passed.filter((report) => report.specialCaseAudit?.status !== STRESS_STATUS.FAIL);
  const passRatio = reports.length === 0 ? 0 : generalPassed.length / reports.length;
  const expressRatio = reports.length === 0
    ? 0
    : reports.filter((report) => report.gates?.EXPRESS?.status === STRESS_STATUS.PASS).length / reports.length;
  const aiGenerateRatio = reports.length === 0
    ? 0
    : reports.filter((report) => report.gates?.AI_GENERATE?.status === STRESS_STATUS.PASS).length / reports.length;
  const matrixCoverage = totalMatrixCells === 0 ? 0 : reports.length / totalMatrixCells;
  const executablePassed = generalPassed.filter((report) => report.executableCredit).length;
  const nativePassed = generalPassed.filter((report) => report.nativeSemanticCredit).length;
  const opaquePassed = generalPassed.filter((report) => report.providerOnly).length;
  const competitiveWins = competitiveComparisons.filter((item) => item.rclScore >= item.referenceScore).length;
  const competitiveRatio = competitiveComparisons.length === 0 ? 0 : competitiveWins / competitiveComparisons.length;
  const kernelChangeRate = novelTaskTrials === 0 ? 1 : kernelChangesForNovelTasks / novelTaskTrials;

  let level = 'PRE-U0';
  if (reports.length > 0 && expressRatio >= 0.8) level = 'U0';
  if (level === 'U0' && expressRatio >= 0.8 && aiGenerateRatio >= 0.8) level = 'U1';
  if (level === 'U1' && passRatio >= 0.6 && executablePassed >= 3) level = 'U2';
  if (
    level === 'U2' &&
    generalPassed.length > 0 &&
    (nativePassed + generalPassed.filter((report) => report.coverageMode === COVERAGE_MODE.LOWERED_EXECUTION).length) / generalPassed.length >= 0.8 &&
    opaquePassed / generalPassed.length <= 0.2
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
      generalPassedCells: generalPassed.length,
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
    caveat: 'maturity is evidence-bound; special-case patches and opaque delegation do not receive universal-language growth credit',
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

  const allStressPassed =
    stressReports.length > 0 &&
    stressReports.every((report) => report.status === STRESS_STATUS.PASS && report.universalGrowthEligible === true);
  if (!allStressPassed || !evidenceSufficient) return 'EXPERIMENTAL_GENOME';
  return 'CANONICAL_RCL_GENOME';
}
