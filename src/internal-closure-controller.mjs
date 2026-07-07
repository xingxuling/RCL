import fs from 'node:fs';
import path from 'node:path';
import { canonicalJson, clamp, sha256 } from './reality-compiler-kernel.mjs';

export const RCL_INTERNAL_CLOSURE_VERSION = '0.44.0-alpha.1';
export const RCL_INTERNAL_CLOSURE_SPEC_FORMAT = 'rcl.internal-closure-spec.v0.44';
export const RCL_INTERNAL_CLOSURE_REPORT_FORMAT = 'rcl.internal-closure-report.v0.44';
export const RCL_INTERNAL_CLOSURE_TRACE_FORMAT = 'rcl.internal-closure-trace.v0.44';
export const RCL_INTERNAL_CLOSURE_BUNDLE_FORMAT = 'rcl.internal-closure-bundle.v0.44';

export const DEFAULT_INTERNAL_STATE = Object.freeze({
  coherence: 0.83,
  strategyGeneration: 0.92,
  executionConsistency: 0.61,
  emotionalNoise: 0.44,
  focusDepth: 0.78,
  identityStability: 0.72,
  systemOverbranching: 0.88,
  closureRate: 0.55,
});

export const DEFAULT_REALITY_PATHS = Object.freeze([
  Object.freeze({
    id: 'RCL_RNCS',
    name: 'RCL / RNCS Reality Compiler',
    role: 'primary_reality_kernel',
    execution: 0.85,
    resource: 0.70,
    speed: 0.75,
    feedback: 0.80,
    branchCost: 0.60,
    coherenceFit: 0.95,
    focusFit: 0.86,
    strategicValue: 0.96,
    externalLegibility: 0.70,
  }),
  Object.freeze({
    id: 'AETHER_FORGE_POCKET',
    name: 'Aether Forge Pocket',
    role: 'mobile_execution_entry',
    execution: 0.80,
    resource: 0.65,
    speed: 0.78,
    feedback: 0.75,
    branchCost: 0.55,
    coherenceFit: 0.86,
    focusFit: 0.78,
    strategicValue: 0.92,
    externalLegibility: 0.82,
  }),
  Object.freeze({
    id: 'AETHER_EARTH',
    name: 'AetherEarth / World Projection',
    role: 'visible_output_projection',
    execution: 0.55,
    resource: 0.50,
    speed: 0.40,
    feedback: 0.65,
    branchCost: 0.30,
    coherenceFit: 0.72,
    focusFit: 0.62,
    strategicValue: 0.76,
    externalLegibility: 0.76,
  }),
  Object.freeze({
    id: 'CITYU',
    name: 'CityU / Academic Constraint',
    role: 'external_constraint_watch',
    execution: 0.40,
    resource: 0.60,
    speed: 0.30,
    feedback: 0.45,
    branchCost: 0.20,
    coherenceFit: 0.58,
    focusFit: 0.45,
    strategicValue: 0.58,
    externalLegibility: 0.88,
  }),
]);

export function normalizeInternalState(state = {}) {
  const input = { ...DEFAULT_INTERNAL_STATE, ...state };
  return {
    coherence: clamp(input.coherence),
    strategyGeneration: clamp(input.strategyGeneration),
    executionConsistency: clamp(input.executionConsistency),
    emotionalNoise: clamp(input.emotionalNoise),
    focusDepth: clamp(input.focusDepth),
    identityStability: clamp(input.identityStability),
    systemOverbranching: clamp(input.systemOverbranching),
    closureRate: clamp(input.closureRate),
  };
}

export function normalizeRealityPath(path = {}) {
  const required = ['id', 'name'];
  for (const key of required) {
    if (!path[key]) throw new Error(`Reality path missing required field '${key}'.`);
  }
  return {
    id: String(path.id),
    name: String(path.name),
    role: String(path.role ?? 'candidate'),
    execution: clamp(path.execution),
    resource: clamp(path.resource),
    speed: clamp(path.speed),
    feedback: clamp(path.feedback),
    branchCost: clamp(path.branchCost),
    coherenceFit: clamp(path.coherenceFit ?? 0.5),
    focusFit: clamp(path.focusFit ?? 0.5),
    strategicValue: clamp(path.strategicValue ?? 0.5),
    externalLegibility: clamp(path.externalLegibility ?? 0.5),
  };
}

export function generationPressureOf(state = DEFAULT_INTERNAL_STATE) {
  const s = normalizeInternalState(state);
  return clamp((s.strategyGeneration * s.systemOverbranching) + 0.1 * s.emotionalNoise);
}

export function closurePressureOf(state = DEFAULT_INTERNAL_STATE) {
  const s = normalizeInternalState(state);
  return clamp((s.closureRate + s.executionConsistency + s.focusDepth + s.identityStability) / 4);
}

function geometricMean(values) {
  if (!values.length) return 0;
  return values.reduce((product, value) => product * Math.max(0.0001, value), 1) ** (1 / values.length);
}

export function computeClosureScore(path, internalState = DEFAULT_INTERNAL_STATE) {
  const p = normalizeRealityPath(path);
  const s = normalizeInternalState(internalState);
  const baseExecution = geometricMean([p.execution, p.resource, p.speed, p.feedback]);
  const internalFit = (
    s.coherence * p.coherenceFit +
    s.focusDepth * p.focusFit +
    s.identityStability * p.strategicValue +
    s.executionConsistency * p.execution
  ) / 4;
  const externalFeedback = (p.feedback + p.externalLegibility) / 2;
  const branchPenalty = p.branchCost * s.systemOverbranching * (1 - s.closureRate) * 0.45;
  const emotionalPenalty = s.emotionalNoise * 0.10;
  const raw = 0.45 * baseExecution + 0.40 * internalFit + 0.20 * externalFeedback - branchPenalty - emotionalPenalty;
  return clamp(raw);
}

export function evaluateClosurePaths(options = {}) {
  const internalState = normalizeInternalState(options.internalState);
  const paths = (options.paths ?? DEFAULT_REALITY_PATHS).map(normalizeRealityPath);
  const generationPressure = generationPressureOf(internalState);
  const closurePressure = closurePressureOf(internalState);
  const mode = closurePressure > generationPressure ? 'closure-dominant' : 'generation-dominant';
  const rows = paths.map(path => ({
    ...path,
    closureScore: computeClosureScore(path, internalState),
  })).sort((a, b) => b.closureScore - a.closureScore || a.id.localeCompare(b.id));
  const primary = rows[0];
  const secondary = rows.find(row => row.id !== primary.id && row.role === 'mobile_execution_entry' && row.closureScore >= primary.closureScore - 0.08)
    ?? rows.find(row => row.id !== primary.id && row.closureScore >= primary.closureScore - 0.04)
    ?? null;
  const annotated = rows.map(row => {
    let status = 'frozen';
    let reason = 'branching cost exceeds active closure budget';
    if (row.id === primary.id) {
      status = 'active-primary';
      reason = 'highest closure score; selected as primary convergence function';
    } else if (secondary && row.id === secondary.id) {
      status = 'warm-secondary';
      reason = 'close to primary score and useful as execution entry';
    } else if (row.role === 'external_constraint_watch') {
      status = 'constraint-watch';
      reason = 'external branch must be monitored, not used as primary convergence kernel';
    } else if (row.role === 'visible_output_projection') {
      status = 'frozen-output';
      reason = 'output projection waits for primary evidence closure';
    }
    return { ...row, status, reason };
  });
  return {
    format: RCL_INTERNAL_CLOSURE_REPORT_FORMAT,
    version: RCL_INTERNAL_CLOSURE_VERSION,
    internalState,
    generationPressure,
    closurePressure,
    mode,
    primary: annotated.find(row => row.status === 'active-primary'),
    secondary: annotated.find(row => row.status === 'warm-secondary') ?? null,
    rows: annotated,
    verdict: mode === 'closure-dominant'
      ? 'Internal state is already closure-dominant; preserve the primary convergence function.'
      : 'Internal state is generation-dominant; choose a primary convergence function and freeze nonessential branches.',
    root: sha256({ internalState, rows: annotated, generationPressure, closurePressure, mode }),
  };
}

export function applyClosureTick(internalState, activeRow) {
  const s = normalizeInternalState(internalState);
  const active = normalizeRealityPath(activeRow);
  const activeScore = clamp(activeRow.closureScore ?? computeClosureScore(active, s));
  return normalizeInternalState({
    coherence: s.coherence + 0.006 * active.coherenceFit * (1 - s.coherence),
    strategyGeneration: s.strategyGeneration - 0.004 * activeScore,
    executionConsistency: s.executionConsistency + 0.030 * active.execution * (1 - s.executionConsistency),
    emotionalNoise: s.emotionalNoise - 0.018 * active.feedback * s.emotionalNoise,
    focusDepth: s.focusDepth + 0.018 * active.focusFit * (1 - s.focusDepth),
    identityStability: s.identityStability + 0.012 * active.strategicValue * (1 - s.identityStability),
    systemOverbranching: s.systemOverbranching - 0.050 * activeScore * s.systemOverbranching,
    closureRate: s.closureRate + 0.040 * activeScore * (1 - s.closureRate),
  });
}

export function runInternalClosureCompile(options = {}) {
  const ticks = Number(options.ticks ?? 8);
  const paths = (options.paths ?? DEFAULT_REALITY_PATHS).map(normalizeRealityPath);
  let internalState = normalizeInternalState(options.internalState);
  const trace = [];
  for (let tick = 0; tick < ticks; tick += 1) {
    const evaluation = evaluateClosurePaths({ internalState, paths });
    trace.push({
      tick,
      internalState,
      generationPressure: evaluation.generationPressure,
      closurePressure: evaluation.closurePressure,
      mode: evaluation.mode,
      primaryId: evaluation.primary.id,
      primaryScore: evaluation.primary.closureScore,
      rows: evaluation.rows.map(row => ({ id: row.id, closureScore: row.closureScore, status: row.status })),
    });
    internalState = applyClosureTick(internalState, evaluation.primary);
  }
  const finalEvaluation = evaluateClosurePaths({ internalState, paths });
  const report = {
    format: RCL_INTERNAL_CLOSURE_TRACE_FORMAT,
    version: RCL_INTERNAL_CLOSURE_VERSION,
    ticks,
    input: {
      internalState: normalizeInternalState(options.internalState),
      paths,
    },
    trace,
    finalState: internalState,
    finalEvaluation,
    controlLaw: {
      invariant: 'closure_rate must exceed branch_generation pressure before external branches become primary actions',
      primaryLoop: finalEvaluation.primary.id,
      secondaryLoop: finalEvaluation.secondary?.id ?? null,
      frozenBranches: finalEvaluation.rows.filter(row => row.status.startsWith('frozen')).map(row => row.id),
      watchedConstraints: finalEvaluation.rows.filter(row => row.status === 'constraint-watch').map(row => row.id),
      decision: finalEvaluation.closurePressure > finalEvaluation.generationPressure
        ? 'primary trajectory has become closure-dominant'
        : 'primary trajectory selected, but active closure discipline is still required',
    },
  };
  return { ...report, root: sha256(report) };
}

export function buildInternalClosureSpec(overrides = {}) {
  const spec = {
    format: RCL_INTERNAL_CLOSURE_SPEC_FORMAT,
    version: RCL_INTERNAL_CLOSURE_VERSION,
    purpose: 'Compile an internal high-branching subject into a single primary reality convergence function.',
    stateVariables: Object.keys(DEFAULT_INTERNAL_STATE),
    pathVariables: ['execution', 'resource', 'speed', 'feedback', 'branchCost', 'coherenceFit', 'focusFit', 'strategicValue', 'externalLegibility'],
    scoring: 'closure_score = weighted(base_execution, internal_fit, external_feedback) - branch_penalty - emotional_penalty',
    invariant: 'closure_pressure > generation_pressure is the stable convergence condition',
    defaultInternalState: DEFAULT_INTERNAL_STATE,
    defaultPaths: DEFAULT_REALITY_PATHS,
    commands: [
      'rcl internal-closure-demo',
      'rcl internal-closure-run [input.json] [output-dir]',
      'rcl internal-closure-spec [output-dir]',
    ],
    ...overrides,
  };
  return { ...spec, root: sha256(spec) };
}

export function renderInternalClosureRcl(spec = buildInternalClosureSpec()) {
  const state = normalizeInternalState(spec.defaultInternalState);
  const evaluation = evaluateClosurePaths({ internalState: state, paths: spec.defaultPaths });
  return `reality InternalClosureController {\n` +
`  facet internal.coherence : Number = ${state.coherence}\n` +
`  facet internal.strategy_generation : Number = ${state.strategyGeneration}\n` +
`  facet internal.execution_consistency : Number = ${state.executionConsistency}\n` +
`  facet internal.emotional_noise : Number = ${state.emotionalNoise}\n` +
`  facet internal.focus_depth : Number = ${state.focusDepth}\n` +
`  facet internal.identity_stability : Number = ${state.identityStability}\n` +
`  facet internal.system_overbranching : Number = ${state.systemOverbranching}\n` +
`  facet internal.closure_rate : Number = ${state.closureRate}\n` +
`  facet pressure.generation : Number = ${evaluation.generationPressure}\n` +
`  facet pressure.closure : Number = ${evaluation.closurePressure}\n` +
`  facet selected.primary : Text = "${evaluation.primary.id}"\n` +
`  facet selected.secondary : Text = "${evaluation.secondary?.id ?? 'none'}"\n\n` +
`  subject controller {\n` +
`    facet authority : Number = 1\n` +
`    warrant internal.write on internal\n` +
`    warrant pressure.write on pressure\n` +
`    warrant selected.write on selected\n` +
`  }\n\n` +
`  emergence close_primary_path {\n` +
`    cause controller\n` +
`    when controller.authority == 1\n` +
`    needs internal.write on internal\n` +
`    needs pressure.write on pressure\n` +
`    needs selected.write on selected\n` +
`    alter pressure.generation <- internal.strategy_generation * internal.system_overbranching + 0.1 * internal.emotional_noise\n` +
`    alter pressure.closure <- (internal.closure_rate + internal.execution_consistency + internal.focus_depth + internal.identity_stability) / 4\n` +
`    alter internal.system_overbranching <- internal.system_overbranching - 0.03\n` +
`    alter internal.closure_rate <- internal.closure_rate + 0.03\n` +
`    preserve internal.coherence >= 0\n` +
`    preserve internal.coherence <= 1\n` +
`    preserve internal.strategy_generation >= 0\n` +
`    preserve internal.strategy_generation <= 1\n` +
`    preserve internal.system_overbranching >= 0\n` +
`    preserve internal.system_overbranching <= 1\n` +
`    preserve internal.closure_rate >= 0\n` +
`    preserve internal.closure_rate <= 1\n` +
`    witness "rcl:internal-closure-controller:v0.44"\n` +
`  }\n\n` +
`  foresee close_primary_path\n` +
`  realize close_primary_path\n` +
`}\n`;
}

export function runInternalClosureDemo() {
  const report = runInternalClosureCompile();
  return {
    ok: true,
    format: report.format,
    version: report.version,
    root: report.root,
    primaryLoop: report.controlLaw.primaryLoop,
    secondaryLoop: report.controlLaw.secondaryLoop,
    decision: report.controlLaw.decision,
    initialMode: report.trace[0]?.mode,
    finalMode: report.finalEvaluation.mode,
    finalState: report.finalState,
    finalRanking: report.finalEvaluation.rows.map(row => ({ id: row.id, score: row.closureScore, status: row.status })),
  };
}

export function readInternalClosureInput(inputPath) {
  if (!inputPath) return {};
  const file = path.resolve(inputPath);
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  return parsed;
}

export function writeInternalClosureReports(outputDir = 'output/v0.44/internal-closure', options = {}) {
  const target = path.resolve(outputDir);
  fs.mkdirSync(target, { recursive: true });
  const spec = buildInternalClosureSpec(options.specOverrides ?? {});
  const evaluation = evaluateClosurePaths(options);
  const trace = runInternalClosureCompile(options);
  const rcl = renderInternalClosureRcl(spec);
  const files = {
    'internal-closure-spec.json': spec,
    'internal-closure-evaluation.json': evaluation,
    'internal-closure-trace.json': trace,
    'internal-closure-controller.rcl': rcl,
    'internal-closure-input.json': {
      internalState: normalizeInternalState(options.internalState),
      paths: (options.paths ?? DEFAULT_REALITY_PATHS).map(normalizeRealityPath),
      ticks: Number(options.ticks ?? 8),
    },
  };
  const written = [];
  for (const [name, value] of Object.entries(files)) {
    const file = path.join(target, name);
    fs.writeFileSync(file, `${typeof value === 'string' ? value : JSON.stringify(value, null, 2)}\n`);
    written.push({ path: file, sha256: sha256(fs.readFileSync(file, 'utf8')) });
  }
  const bundle = {
    ok: true,
    format: RCL_INTERNAL_CLOSURE_BUNDLE_FORMAT,
    version: RCL_INTERNAL_CLOSURE_VERSION,
    outputDir: target,
    root: sha256({ spec, evaluation, trace }),
    files: written,
  };
  fs.writeFileSync(path.join(target, 'internal-closure-bundle.json'), `${JSON.stringify(bundle, null, 2)}\n`);
  return bundle;
}

export function internalClosureInputFromFileOrDefault(inputPath) {
  if (!inputPath) return {};
  return readInternalClosureInput(inputPath);
}

export function internalClosureCanonicalRoot(value) {
  return sha256(canonicalJson(value));
}
