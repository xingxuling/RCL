import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import {
  STRESS_STATUS,
  UNIVERSAL_STRESS_GATES,
  evidenceRoot,
} from './universal-program-stress.mjs';

export { STRESS_STATUS };

export const DOMINANCE_ARENA_MANIFEST_SCHEMA = 'rcl.dominance-arena.manifest.v0.1';
export const DOMINANCE_ARENA_REPORT_SCHEMA = 'rcl.dominance-arena.report.v0.1';
export const RCL_SCORECARD_SCHEMA = 'rcl.program-scorecard.v0.1';

export const CAPABILITY_SCORECARD_GATES = Object.freeze(
  UNIVERSAL_STRESS_GATES.filter(gate => gate !== 'AI_GENERATE'),
);

export const DOMINANCE_METRIC_DIRECTIONS = Object.freeze({
  expressiveness: 'higher-is-better',
  correctness: 'higher-is-better',
  runtimePerformance: 'higher-is-better',
  resourceEfficiency: 'higher-is-better',
  compileBuildSpeed: 'lower-is-better',
  concurrencyScale: 'higher-is-better',
  programComplexity: 'lower-is-better',
  humanDevelopmentCost: 'lower-is-better',
  aiDevelopmentCost: 'lower-is-better',
  changeCost: 'lower-is-better',
});

const STATUS_VALUES = new Set(Object.values(STRESS_STATUS));

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function finiteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function tail(value, max = 4000) {
  return String(value ?? '').slice(-max);
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function readPath(value, dottedPath) {
  return String(dottedPath ?? '')
    .split('.')
    .filter(Boolean)
    .reduce((current, key) => current == null ? undefined : current[key], value);
}

function collapseStatuses(statuses) {
  if (statuses.some(status => status === STRESS_STATUS.FAIL)) return STRESS_STATUS.FAIL;
  if (statuses.some(status => status === STRESS_STATUS.BLOCKED)) return STRESS_STATUS.BLOCKED;
  if (statuses.some(status => status !== STRESS_STATUS.PASS)) return STRESS_STATUS.UNVERIFIED;
  return STRESS_STATUS.PASS;
}

function normalizeGateStatus(gate, raw) {
  const status = typeof raw === 'string' ? raw : raw?.status;
  if (!STATUS_VALUES.has(status)) {
    return {
      gate,
      status: STRESS_STATUS.UNVERIFIED,
      evidence: [],
      note: 'gate is missing or has an unsupported status',
      metric: null,
    };
  }
  return {
    gate,
    status,
    evidence: Array.isArray(raw?.evidence) ? [...raw.evidence] : [],
    note: raw?.note ?? null,
    metric: raw?.metric ?? null,
  };
}

function axisResult(axis, status, details = {}) {
  return {
    axis,
    status,
    evidence: unique(details.evidence ?? []),
    note: details.note ?? null,
    passed: Number(details.passed ?? 0),
    required: Number(details.required ?? 0),
    unverified: Number(details.unverified ?? 0),
    failed: Number(details.failed ?? 0),
    metric: details.metric ?? null,
  };
}

export function buildCapabilityScorecard(stressClaim) {
  const gates = stressClaim?.gates ?? {};
  const normalized = CAPABILITY_SCORECARD_GATES.map(gate => normalizeGateStatus(gate, gates[gate]));
  const statuses = normalized.map(gate => gate.status);
  const evidence = normalized.flatMap(gate => gate.evidence);
  return axisResult('capability', collapseStatuses(statuses), {
    evidence,
    passed: statuses.filter(status => status === STRESS_STATUS.PASS).length,
    required: normalized.length,
    unverified: statuses.filter(status => status === STRESS_STATUS.UNVERIFIED).length,
    failed: statuses.filter(status => status === STRESS_STATUS.FAIL).length,
    note: 'Capability excludes AI_GENERATE. AI authoring evidence is reported on the separate authorability axis.',
    metric: {
      excludedGate: 'AI_GENERATE',
      gates: normalized,
    },
  });
}

export function buildAuthorabilityScorecard(stressClaim) {
  const gate = normalizeGateStatus('AI_GENERATE', stressClaim?.gates?.AI_GENERATE);
  return axisResult('authorability', gate.status, {
    evidence: gate.evidence,
    passed: gate.status === STRESS_STATUS.PASS ? 1 : 0,
    required: 1,
    unverified: gate.status === STRESS_STATUS.UNVERIFIED ? 1 : 0,
    failed: gate.status === STRESS_STATUS.FAIL ? 1 : 0,
    note: 'AI_GENERATE is an authorability gate and never downgrades already evidenced language capability.',
    metric: { gate },
  });
}

function normalizeMetricSpec(id, raw = {}) {
  const direction = raw.direction ?? DOMINANCE_METRIC_DIRECTIONS[id] ?? 'higher-is-better';
  if (!['higher-is-better', 'lower-is-better'].includes(direction)) {
    throw new Error(`RCL_DOMINANCE_METRIC_DIRECTION:${id}`);
  }
  return {
    id,
    direction,
    unit: raw.unit ?? null,
    required: raw.required !== false,
    description: raw.description ?? null,
  };
}

function normalizeCommand(raw, label) {
  if (!Array.isArray(raw) || raw.length === 0 || raw.some(part => typeof part !== 'string' || part.length === 0)) {
    throw new Error(`RCL_DOMINANCE_COMMAND_INVALID:${label}`);
  }
  return [...raw];
}

function normalizeRunner(raw, label, defaultRole) {
  if (!raw || typeof raw !== 'object') throw new Error(`RCL_DOMINANCE_RUNNER_INVALID:${label}`);
  return {
    id: raw.id ?? label,
    role: raw.role ?? defaultRole,
    command: normalizeCommand(raw.command, label),
    cwd: raw.cwd ?? '.',
    timeoutMs: Number(raw.timeoutMs ?? 120_000),
    evidenceFile: raw.evidenceFile ?? null,
    artifactPaths: Array.isArray(raw.artifactPaths) ? [...raw.artifactPaths] : [],
    metricPaths: raw.metricPaths && typeof raw.metricPaths === 'object' ? structuredClone(raw.metricPaths) : {},
    optional: raw.optional === true,
    probeOnly: raw.probeOnly === true,
    notes: Array.isArray(raw.notes) ? [...raw.notes] : [],
  };
}

export function validateDominanceArenaManifest(input) {
  if (!input || input.schema !== DOMINANCE_ARENA_MANIFEST_SCHEMA) {
    throw new Error(`RCL_DOMINANCE_MANIFEST_SCHEMA:${input?.schema ?? 'missing'}`);
  }
  if (typeof input.id !== 'string' || input.id.length === 0) throw new Error('RCL_DOMINANCE_MANIFEST_ID');
  if (typeof input.track !== 'string' || input.track.length === 0) throw new Error('RCL_DOMINANCE_MANIFEST_TRACK');
  if (!input.task || typeof input.task !== 'object' || typeof input.task.id !== 'string') {
    throw new Error('RCL_DOMINANCE_MANIFEST_TASK');
  }
  const metrics = Array.isArray(input.metrics)
    ? input.metrics.map(metric => {
      if (!metric || typeof metric.id !== 'string' || metric.id.length === 0) {
        throw new Error('RCL_DOMINANCE_MANIFEST_METRIC_ID');
      }
      return normalizeMetricSpec(metric.id, metric);
    })
    : [];
  if (metrics.length === 0) throw new Error('RCL_DOMINANCE_MANIFEST_METRICS');
  const metricIds = new Set(metrics.map(metric => metric.id));
  const requiredComparisonMetrics = Array.isArray(input.requiredComparisonMetrics)
    ? [...input.requiredComparisonMetrics]
    : metrics.filter(metric => metric.required).map(metric => metric.id);
  for (const id of requiredComparisonMetrics) {
    if (!metricIds.has(id)) throw new Error(`RCL_DOMINANCE_REQUIRED_METRIC_UNKNOWN:${id}`);
  }
  const normalized = {
    schema: input.schema,
    id: input.id,
    track: input.track,
    task: structuredClone(input.task),
    corpus: Array.isArray(input.corpus) ? [...input.corpus] : [],
    metrics,
    requiredComparisonMetrics,
    comparisons: Array.isArray(input.comparisons) ? structuredClone(input.comparisons) : [],
    comparisonPolicy: input.comparisonPolicy ? structuredClone(input.comparisonPolicy) : {
      status: STRESS_STATUS.UNVERIFIED,
      reason: 'No comparable reference result has been attached.',
    },
    candidate: normalizeRunner(input.candidate, 'candidate', 'candidate'),
    references: Array.isArray(input.references)
      ? input.references.map((reference, index) => normalizeRunner(reference, `reference-${index + 1}`, 'reference'))
      : [],
    notes: Array.isArray(input.notes) ? [...input.notes] : [],
  };
  return {
    ...normalized,
    manifestRoot: evidenceRoot(normalized),
  };
}

function captureArtifact(repositoryRoot, artifactPath) {
  const absolutePath = path.resolve(repositoryRoot, artifactPath);
  if (!fs.existsSync(absolutePath)) {
    return {
      path: artifactPath,
      exists: false,
      bytes: null,
      sha256: null,
      status: STRESS_STATUS.UNVERIFIED,
    };
  }
  const stat = fs.statSync(absolutePath);
  if (!stat.isFile()) {
    return {
      path: artifactPath,
      exists: false,
      bytes: null,
      sha256: null,
      status: STRESS_STATUS.FAIL,
      failureType: 'ARTIFACT_NOT_FILE',
    };
  }
  const bytes = fs.readFileSync(absolutePath);
  return {
    path: artifactPath,
    exists: true,
    bytes: bytes.length,
    sha256: sha256(bytes),
    status: STRESS_STATUS.PASS,
  };
}

export function runArenaCommand(command, {
  cwd = process.cwd(),
  timeoutMs = 120_000,
  env = {},
  maxBuffer = 8 * 1024 * 1024,
} = {}) {
  const [executable, ...args] = normalizeCommand(command, 'runtime');
  const started = process.hrtime.bigint();
  const result = spawnSync(executable, args, {
    cwd,
    env: { ...process.env, ...env },
    encoding: 'utf8',
    timeout: timeoutMs,
    maxBuffer,
    windowsHide: true,
  });
  const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;
  const errorCode = result.error?.code ?? null;
  let failureType = null;
  if (errorCode === 'ETIMEDOUT') failureType = 'TIMEOUT';
  else if (errorCode === 'ENOENT') failureType = 'TOOL_NOT_FOUND';
  else if (result.signal) failureType = `SIGNAL_${result.signal}`;
  else if (result.status !== 0) failureType = 'NON_ZERO_EXIT';

  const status = result.status === 0 && !result.error
    ? STRESS_STATUS.PASS
    : failureType === 'TIMEOUT' || failureType === 'TOOL_NOT_FOUND'
      ? STRESS_STATUS.BLOCKED
      : STRESS_STATUS.FAIL;
  const stdout = String(result.stdout ?? '');
  const stderr = String(result.stderr ?? '');
  const receipt = {
    schema: 'rcl.dominance-arena.command-receipt.v0.1',
    command: [executable, ...args],
    cwd,
    status,
    exitCode: result.status ?? null,
    signal: result.signal ?? null,
    failureType,
    elapsedMs: Number(elapsedMs.toFixed(3)),
    stdoutTail: tail(stdout),
    stderrTail: tail(stderr),
    stdoutSha256: sha256(stdout),
    stderrSha256: sha256(stderr),
  };
  return {
    ...receipt,
    receiptRoot: evidenceRoot({
      ...receipt,
      elapsedMs: undefined,
      stdoutTail: undefined,
      stderrTail: undefined,
    }),
  };
}

function readEvidence(repositoryRoot, evidenceFile) {
  if (!evidenceFile) return { value: null, status: STRESS_STATUS.UNVERIFIED, error: null };
  const absolutePath = path.resolve(repositoryRoot, evidenceFile);
  if (!fs.existsSync(absolutePath)) return { value: null, status: STRESS_STATUS.UNVERIFIED, error: 'EVIDENCE_FILE_MISSING' };
  try {
    return { value: JSON.parse(fs.readFileSync(absolutePath, 'utf8')), status: STRESS_STATUS.PASS, error: null };
  } catch (error) {
    return { value: null, status: STRESS_STATUS.FAIL, error: `EVIDENCE_JSON_INVALID:${error.message}` };
  }
}

function collectMetrics(provider, receipt, evidence) {
  return Object.fromEntries(Object.entries(provider.metricPaths ?? {}).map(([id, descriptor]) => {
    const source = descriptor?.source === 'evidence' ? evidence : receipt;
    const value = readPath(source, descriptor?.path);
    return [id, {
      id,
      value: finiteNumber(value) ? value : null,
      unit: descriptor?.unit ?? null,
      direction: descriptor?.direction ?? DOMINANCE_METRIC_DIRECTIONS[id] ?? null,
      status: finiteNumber(value) ? STRESS_STATUS.PASS : STRESS_STATUS.UNVERIFIED,
      source: descriptor?.source ?? 'receipt',
      path: descriptor?.path ?? null,
    }];
  }));
}

function runProvider(provider, repositoryRoot) {
  const cwd = path.resolve(repositoryRoot, provider.cwd);
  const receipt = runArenaCommand(provider.command, {
    cwd,
    timeoutMs: provider.timeoutMs,
  });
  const artifactPaths = unique([
    ...provider.artifactPaths,
    ...(provider.evidenceFile ? [provider.evidenceFile] : []),
  ]);
  const artifacts = artifactPaths.map(artifactPath => captureArtifact(repositoryRoot, artifactPath));
  const evidence = readEvidence(repositoryRoot, provider.evidenceFile);
  const metrics = collectMetrics(provider, receipt, evidence.value);
  const status = receipt.status === STRESS_STATUS.PASS && evidence.status !== STRESS_STATUS.FAIL
    ? STRESS_STATUS.PASS
    : receipt.status;
  return {
    id: provider.id,
    role: provider.role,
    optional: provider.optional,
    probeOnly: provider.probeOnly,
    notes: provider.notes,
    receipt,
    status,
    evidenceFile: provider.evidenceFile,
    evidenceStatus: evidence.status,
    evidenceError: evidence.error,
    evidence: evidence.value,
    artifacts,
    metrics,
  };
}

function normalizeComparisonMetric(id, raw, metricSpec) {
  if (!raw || raw.comparable === false) {
    return {
      id,
      status: STRESS_STATUS.UNVERIFIED,
      relation: 'UNVERIFIED',
      reason: raw?.reason ?? 'metric is not comparable',
      direction: raw?.direction ?? metricSpec?.direction ?? null,
      candidate: raw?.candidate ?? null,
      reference: raw?.reference ?? null,
      evidence: Array.isArray(raw?.evidence) ? [...raw.evidence] : [],
    };
  }
  const candidate = Number(raw.candidate);
  const reference = Number(raw.reference);
  if (!finiteNumber(candidate) || !finiteNumber(reference)) {
    return {
      id,
      status: STRESS_STATUS.UNVERIFIED,
      relation: 'UNVERIFIED',
      reason: 'candidate and reference values must both be finite numbers',
      direction: raw.direction ?? metricSpec?.direction ?? null,
      candidate: raw.candidate ?? null,
      reference: raw.reference ?? null,
      evidence: Array.isArray(raw.evidence) ? [...raw.evidence] : [],
    };
  }
  const direction = raw.direction ?? metricSpec?.direction ?? DOMINANCE_METRIC_DIRECTIONS[id] ?? 'higher-is-better';
  const margin = Number(raw.margin ?? 0);
  if (!['higher-is-better', 'lower-is-better'].includes(direction) || !finiteNumber(margin) || margin < 0) {
    throw new Error(`RCL_DOMINANCE_COMPARISON_METRIC_INVALID:${id}`);
  }
  const delta = candidate - reference;
  const win = direction === 'higher-is-better'
    ? candidate >= reference + margin && candidate > reference
    : candidate <= reference - margin && candidate < reference;
  const loss = direction === 'higher-is-better'
    ? candidate < reference - margin
    : candidate > reference + margin;
  const relation = win ? 'WIN' : loss ? 'LOSS' : 'TIE';
  return {
    id,
    status: relation === 'LOSS' ? STRESS_STATUS.FAIL : STRESS_STATUS.PASS,
    relation,
    direction,
    margin,
    candidate,
    reference,
    delta,
    evidence: Array.isArray(raw.evidence) ? [...raw.evidence] : [],
  };
}

export function evaluateDominanceComparison(comparison, {
  requiredMetrics = [],
  metricSpecs = [],
} = {}) {
  const specById = new Map(metricSpecs.map(metric => [metric.id, metric]));
  const metricIds = requiredMetrics.length > 0
    ? requiredMetrics
    : Object.keys(comparison?.metrics ?? {});
  const metrics = metricIds.map(id => normalizeComparisonMetric(id, comparison?.metrics?.[id], specById.get(id)));
  const relations = metrics.map(metric => metric.relation);
  const status = relations.includes('LOSS')
    ? STRESS_STATUS.FAIL
    : metrics.length === 0 || relations.includes('UNVERIFIED')
      ? STRESS_STATUS.UNVERIFIED
      : relations.includes('WIN') ? STRESS_STATUS.PASS : STRESS_STATUS.UNVERIFIED;
  return {
    id: comparison?.id ?? `${comparison?.candidateId ?? 'candidate'}::${comparison?.referenceId ?? 'reference'}`,
    candidateId: comparison?.candidateId ?? null,
    referenceId: comparison?.referenceId ?? null,
    status,
    metrics,
    evidence: unique(metrics.flatMap(metric => metric.evidence)),
    note: comparison?.note ?? null,
  };
}

export function evaluateDominanceArena({ comparisons = [], requiredMetrics = [], metricSpecs = [] } = {}) {
  const normalized = comparisons.map(comparison => evaluateDominanceComparison(comparison, {
    requiredMetrics,
    metricSpecs,
  }));
  const status = normalized.length === 0
    ? STRESS_STATUS.UNVERIFIED
    : normalized.some(comparison => comparison.status === STRESS_STATUS.FAIL)
      ? STRESS_STATUS.FAIL
      : normalized.every(comparison => comparison.status === STRESS_STATUS.PASS)
        ? STRESS_STATUS.PASS
        : STRESS_STATUS.UNVERIFIED;
  return {
    status,
    comparisons: normalized,
    comparableComparisons: normalized.filter(comparison => comparison.status === STRESS_STATUS.PASS).length,
    totalComparisons: normalized.length,
    note: status === STRESS_STATUS.UNVERIFIED
      ? 'Dominance requires raw, comparable results for every required metric; no partial or weighted score is promoted.'
      : 'Dominance is based on non-compensatory raw metric comparisons.',
  };
}

export function buildDominanceScorecard(dominance = null) {
  return axisResult('dominance', dominance?.status ?? STRESS_STATUS.UNVERIFIED, {
    evidence: dominance?.comparisons?.flatMap(comparison => comparison.evidence ?? []) ?? [],
    passed: dominance?.comparisons?.filter(comparison => comparison.status === STRESS_STATUS.PASS).length ?? 0,
    required: dominance?.totalComparisons ?? 0,
    unverified: dominance?.comparisons?.filter(comparison => comparison.status === STRESS_STATUS.UNVERIFIED).length ?? 0,
    failed: dominance?.comparisons?.filter(comparison => comparison.status === STRESS_STATUS.FAIL).length ?? 0,
    note: dominance?.note ?? 'No comparable arena result has been attached.',
    metric: dominance,
  });
}

export function buildRclScorecard({ id, task, stressClaim = null, dominance = null } = {}) {
  const capability = buildCapabilityScorecard(stressClaim);
  const authorability = buildAuthorabilityScorecard(stressClaim);
  const dominanceAxis = buildDominanceScorecard(dominance);
  const scorecardWithoutRoot = {
    schema: RCL_SCORECARD_SCHEMA,
    id: id ?? task?.id ?? 'rcl-program',
    task: task ?? null,
    legacyStressCellStatus: stressClaim?.status ?? STRESS_STATUS.UNVERIFIED,
    axes: {
      capability,
      dominance: dominanceAxis,
      authorability,
    },
    boundary: [
      'Capability is evaluated without AI_GENERATE so an unverified authoring trial cannot erase direct compiler/runtime evidence.',
      'Dominance requires comparable raw results and never uses a weighted average to hide a losing metric.',
      'Authorability remains independently unverified until its declared trials have evidence-bearing receipts.',
    ],
  };
  return {
    ...scorecardWithoutRoot,
    scorecardRoot: evidenceRoot(scorecardWithoutRoot),
  };
}

export function runRclDominanceArena(manifestInput, { repositoryRoot = process.cwd() } = {}) {
  const manifest = validateDominanceArenaManifest(manifestInput);
  const sourceRevisionReceipt = runArenaCommand(['git', 'rev-parse', 'HEAD'], {
    cwd: repositoryRoot,
    timeoutMs: 10_000,
  });
  const sourceRevision = sourceRevisionReceipt.status === STRESS_STATUS.PASS
    ? sourceRevisionReceipt.stdoutTail.trim().split(/\s+/)[0] || null
    : null;
  const candidate = runProvider(manifest.candidate, repositoryRoot);
  const references = manifest.references.map(reference => runProvider(reference, repositoryRoot));
  const comparisons = Array.isArray(manifest.comparisons) ? manifest.comparisons : [];
  const dominance = evaluateDominanceArena({
    comparisons,
    requiredMetrics: manifest.requiredComparisonMetrics,
    metricSpecs: manifest.metrics,
  });
  const stressClaim = candidate.evidence?.claim ?? null;
  const scorecard = buildRclScorecard({
    id: `${manifest.track}::${manifest.task.id}`,
    task: manifest.task,
    stressClaim,
    dominance,
  });
  const reportWithoutRoot = {
    schema: DOMINANCE_ARENA_REPORT_SCHEMA,
    arena: {
      id: manifest.id,
      track: manifest.track,
      task: manifest.task,
      manifestRoot: manifest.manifestRoot,
      corpus: manifest.corpus,
    },
    sourceRevision: {
      value: sourceRevision,
      status: sourceRevision ? STRESS_STATUS.PASS : STRESS_STATUS.UNVERIFIED,
      receiptRoot: sourceRevisionReceipt.receiptRoot,
    },
    candidate,
    references,
    dominance,
    scorecard,
    comparisonPolicy: manifest.comparisonPolicy,
    notes: manifest.notes,
    evidenceBoundary: [
      'A successful command receipt proves execution of the declared probe, not competitive superiority.',
      'Reference version probes are not comparison results and do not contribute dominance credit.',
      'Missing tools, timeouts, missing artifacts and non-comparable corpora remain visible as BLOCKED or UNVERIFIED.',
    ],
  };
  return {
    ...reportWithoutRoot,
    reportRoot: evidenceRoot(reportWithoutRoot),
  };
}
