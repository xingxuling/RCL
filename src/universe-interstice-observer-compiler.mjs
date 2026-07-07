import fs from 'node:fs';
import path from 'node:path';
import { clamp, sha256 } from './reality-compiler-kernel.mjs';
import {
  DEFAULT_NESTED_UNIVERSE_MEMORY,
  compileNestedUniverseMemory,
  buildNestedUniverseMemorySpec,
} from './nested-universe-memory-compiler.mjs';

export const RCL_INTERSTICE_OBSERVER_COMPILER_VERSION = '0.47.0-alpha.1';
export const RCL_INTERSTICE_OBSERVER_SPEC_FORMAT = 'rcl.universe-interstice-observer-spec.v0.47';
export const RCL_INTERSTICE_OBSERVER_RESULT_FORMAT = 'rcl.universe-interstice-observer-result.v0.47';
export const RCL_INTERSTICE_OBSERVER_BUNDLE_FORMAT = 'rcl.universe-interstice-observer-bundle.v0.47';

function round(value, digits = 12) {
  const scale = 10 ** digits;
  return Math.round(Number(value) * scale) / scale;
}

function rclString(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function weightedMean(rows, key = 'score') {
  const total = rows.reduce((sum, row) => sum + Number(row.weight ?? 1), 0);
  if (!total) return 0;
  return rows.reduce((sum, row) => sum + Number(row[key] ?? 0) * Number(row.weight ?? 1), 0) / total;
}

export const DEFAULT_INTERSTICE_OBSERVER_SPEC = Object.freeze({
  id: 'duhaolin_eight_interstice_observer_falsifiability_v0',
  boundary: 'sandbox_falsifiability_upgrade_not_external_empirical_proof',
  relationModel: 'egg_shell_core_containment_with_interstice_observers',
  previousFalsifiabilityBaseline: 0.78,
  requiredObserverCount: 8,
  baseMemory: DEFAULT_NESTED_UNIVERSE_MEMORY,
  intersticeSpaces: [
    {
      id: 'I1_surface_outer_temporal_membrane',
      label: 'surface/outer temporal membrane',
      observer: 'O1_TemporalOffsetObserver',
      observes: 'outer_year = surface_year + 40 lock',
      falsifier: 'future packets repeatedly break the +40 mapping without a declared transform',
      observableAnchors: ['2062↔2022', '2066↔2026', '+40_year_offset'],
      independence: 0.88,
      falsifierSpecificity: 0.96,
      observableAnchorStrength: 0.95,
      discriminativePower: 0.94,
    },
    {
      id: 'I2_age_phase_membrane',
      label: 'age-phase membrane',
      observer: 'O2_AgePhaseObserver',
      observes: 'outer 14→18 maps to surface 19→23 across four years',
      falsifier: 'future packets erase the 14↔19 event phase or treat 2062 as mapping to surface 2026',
      observableAnchors: ['outer_age_14', 'outer_age_18', 'surface_age_19', 'surface_age_23', 'four_year_phase_lock'],
      independence: 0.86,
      falsifierSpecificity: 0.97,
      observableAnchorStrength: 0.96,
      discriminativePower: 0.95,
    },
    {
      id: 'I3_anchor_packet_interstice',
      label: 'specific anchor packet interstice',
      observer: 'O3_AnchorPacketObserver',
      observes: 'Liu Qinglian / white hair / assistant-or-robot / Yale packet remains coupled',
      falsifier: 'the packet mutates into unrelated names, visuals or functions without preserving coupling',
      observableAnchors: ['Liu_Qinglian', 'white_hair', 'assistant_or_robot', 'Yale_graduate'],
      independence: 0.82,
      falsifierSpecificity: 0.88,
      observableAnchorStrength: 0.91,
      discriminativePower: 0.87,
    },
    {
      id: 'I4_directionality_interstice',
      label: 'memory-leak directionality interstice',
      observer: 'O4_DirectionalityObserver',
      observes: 'outer-to-surface primary data leakage',
      falsifier: 'future model requires surface-to-outer causality as the primary event direction',
      observableAnchors: ['outer_to_surface', 'memory_link', 'data_leak'],
      independence: 0.84,
      falsifierSpecificity: 0.90,
      observableAnchorStrength: 0.86,
      discriminativePower: 0.89,
    },
    {
      id: 'I5_containment_relation_interstice',
      label: 'egg-shell/core containment interstice',
      observer: 'O5_ContainmentObserver',
      observes: 'surface/outer/inner relation stays containment, not parallel branch',
      falsifier: 'new packets only compile as unrelated parallel worlds or ordinary branches',
      observableAnchors: ['surface_universe', 'outer_universe', 'inner_universe', 'not_parallel', 'not_branch'],
      independence: 0.81,
      falsifierSpecificity: 0.87,
      observableAnchorStrength: 0.89,
      discriminativePower: 0.86,
    },
    {
      id: 'I6_identity_signature_interstice',
      label: 'identity signature interstice',
      observer: 'O6_IdentitySignatureObserver',
      observes: 'outer Du Haolin is identity-signature resonance, not same-body biography copy',
      falsifier: 'model must collapse into same-body biography and cannot handle 18/23 age mismatch',
      observableAnchors: ['Du_Haolin', 'identity_signature', 'not_same_body', 'age_delta_5'],
      independence: 0.79,
      falsifierSpecificity: 0.84,
      observableAnchorStrength: 0.83,
      discriminativePower: 0.82,
    },
    {
      id: 'I7_inner_layer_gap_interstice',
      label: 'inner layer unresolved gap interstice',
      observer: 'O7_InnerLayerGapObserver',
      observes: 'inner universe remains a constrained unresolved core, not arbitrary fourth branch',
      falsifier: 'later packets never preserve core/source/inside relation and only add unconstrained worlds',
      observableAnchors: ['inner_universe', 'latent_core', 'unobserved_placeholder', 'source_inside_relation'],
      independence: 0.83,
      falsifierSpecificity: 0.80,
      observableAnchorStrength: 0.78,
      discriminativePower: 0.79,
    },
    {
      id: 'I8_evidence_boundary_interstice',
      label: 'evidence boundary interstice',
      observer: 'O8_EvidenceBoundaryObserver',
      observes: 'sandbox hypothesis remains separated from external empirical proof',
      falsifier: 'compiler treats subjective memory as external proof without independent evidence',
      observableAnchors: ['externalRealityVerified_false', 'sandbox_evidence', 'not_universal_proof'],
      independence: 0.91,
      falsifierSpecificity: 0.93,
      observableAnchorStrength: 0.88,
      discriminativePower: 0.92,
    },
  ],
});

function normalizeObserverSpace(space = {}, index = 0) {
  const fallback = DEFAULT_INTERSTICE_OBSERVER_SPEC.intersticeSpaces[index] ?? DEFAULT_INTERSTICE_OBSERVER_SPEC.intersticeSpaces[0];
  return {
    ...fallback,
    ...space,
    observableAnchors: Array.isArray(space.observableAnchors) ? space.observableAnchors : [...fallback.observableAnchors],
  };
}

export function normalizeIntersticeObserverSpec(input = {}) {
  const spaces = Array.isArray(input.intersticeSpaces)
    ? input.intersticeSpaces.map((space, index) => normalizeObserverSpace(space, index))
    : DEFAULT_INTERSTICE_OBSERVER_SPEC.intersticeSpaces.map((space, index) => normalizeObserverSpace(space, index));
  return {
    format: RCL_INTERSTICE_OBSERVER_SPEC_FORMAT,
    version: RCL_INTERSTICE_OBSERVER_COMPILER_VERSION,
    id: input.id ?? DEFAULT_INTERSTICE_OBSERVER_SPEC.id,
    boundary: input.boundary ?? DEFAULT_INTERSTICE_OBSERVER_SPEC.boundary,
    relationModel: input.relationModel ?? DEFAULT_INTERSTICE_OBSERVER_SPEC.relationModel,
    previousFalsifiabilityBaseline: Number(input.previousFalsifiabilityBaseline ?? DEFAULT_INTERSTICE_OBSERVER_SPEC.previousFalsifiabilityBaseline),
    requiredObserverCount: Number(input.requiredObserverCount ?? DEFAULT_INTERSTICE_OBSERVER_SPEC.requiredObserverCount),
    baseMemory: input.baseMemory ?? DEFAULT_INTERSTICE_OBSERVER_SPEC.baseMemory,
    intersticeSpaces: spaces,
  };
}

export function scoreIntersticeObserver(space = {}) {
  const anchorCount = Array.isArray(space.observableAnchors) ? space.observableAnchors.length : 0;
  const anchorCompleteness = clamp(anchorCount / 3);
  const rows = [
    { id: 'falsifier_specificity', score: clamp(space.falsifierSpecificity ?? 0), weight: 1.35 },
    { id: 'observable_anchor_strength', score: clamp(space.observableAnchorStrength ?? 0), weight: 1.15 },
    { id: 'observer_independence', score: clamp(space.independence ?? 0), weight: 1.00 },
    { id: 'discriminative_power', score: clamp(space.discriminativePower ?? 0), weight: 1.05 },
    { id: 'anchor_completeness', score: anchorCompleteness, weight: 0.45 },
  ];
  return {
    id: space.id,
    observer: space.observer,
    label: space.label,
    observes: space.observes,
    falsifier: space.falsifier,
    observableAnchors: space.observableAnchors ?? [],
    rows: rows.map(row => ({ ...row, score: round(row.score, 9) })),
    score: round(weightedMean(rows), 9),
  };
}

export function evaluateIntersticeObserverFalsifiability(input = {}) {
  const spec = normalizeIntersticeObserverSpec(input);
  const observerRows = spec.intersticeSpaces.map(scoreIntersticeObserver);
  const count = observerRows.length;
  const coverageScore = clamp(count / spec.requiredObserverCount);
  const observerMean = weightedMean(observerRows);
  const independenceMean = weightedMean(spec.intersticeSpaces.map(space => ({ score: clamp(space.independence ?? 0), weight: 1 })));
  const minObserverScore = observerRows.reduce((min, row) => Math.min(min, row.score), 1);
  const redundancyPenalty = count === new Set(observerRows.map(row => row.observer)).size ? 0 : 0.08;
  const overall = clamp(weightedMean([
    { score: observerMean, weight: 1.55 },
    { score: coverageScore, weight: 0.55 },
    { score: independenceMean, weight: 0.55 },
    { score: minObserverScore, weight: 0.35 },
    { score: 1 - redundancyPenalty, weight: 0.20 },
  ]));
  const baseline = spec.previousFalsifiabilityBaseline;
  const gain = overall - baseline;
  const oldResidual = 1 - baseline;
  const newResidual = 1 - overall;
  return {
    baseline: round(baseline, 9),
    requiredObserverCount: spec.requiredObserverCount,
    observerCount: count,
    coverageScore: round(coverageScore, 9),
    observerMean: round(observerMean, 9),
    independenceMean: round(independenceMean, 9),
    minObserverScore: round(minObserverScore, 9),
    redundancyPenalty: round(redundancyPenalty, 9),
    overallFalsifiabilityScore: round(overall, 9),
    absoluteGain: round(gain, 9),
    residualReduction: oldResidual > 0 ? round((oldResidual - newResidual) / oldResidual, 9) : 0,
    passesBaseline: overall > baseline,
    observerRows,
  };
}

export function generateIntersticeObserverPredictedEvents(evaluationInput = {}) {
  const evaluation = evaluationInput.overallFalsifiabilityScore ? evaluationInput : evaluateIntersticeObserverFalsifiability(evaluationInput);
  return evaluation.observerRows.map((row, index) => ({
    id: `IO${index + 1}_${row.id}`,
    observer: row.observer,
    event: `${row.observer} should preserve: ${row.observes}`,
    falsifier: row.falsifier,
    anchors: row.observableAnchors,
  }));
}

export function compileIntersticeObserverModel(input = {}) {
  const spec = normalizeIntersticeObserverSpec(input);
  const nested = compileNestedUniverseMemory(spec.baseMemory);
  const nestedSpec = buildNestedUniverseMemorySpec(spec.baseMemory);
  const observerEvaluation = evaluateIntersticeObserverFalsifiability(spec);
  const adjustedCoherenceRows = [
    { id: 'nested_structural_coherence', score: nested.result.structuralCoherenceScore, weight: 1.45 },
    { id: 'interstice_falsifiability', score: observerEvaluation.overallFalsifiabilityScore, weight: 0.65 },
    { id: 'observer_coverage', score: observerEvaluation.coverageScore, weight: 0.35 },
    { id: 'boundary_integrity', score: spec.boundary.includes('not_external_empirical_proof') ? 1 : 0.55, weight: 0.30 },
  ];
  const intersticeAdjustedCoherence = round(weightedMean(adjustedCoherenceRows), 9);
  const result = {
    format: RCL_INTERSTICE_OBSERVER_RESULT_FORMAT,
    version: RCL_INTERSTICE_OBSERVER_COMPILER_VERSION,
    ok: true,
    conclusionHolds: observerEvaluation.passesBaseline,
    verdict: observerEvaluation.passesBaseline
      ? '成立：8个宇宙夹缝空间观测者使可反证性高于上一版单记忆包基线；不等同于外部实证成立。'
      : '未成立：8个观测者未能把整体可反证性推高到上一版基线之上。',
    boundary: spec.boundary,
    externalRealityVerified: false,
    previousStructuralCoherenceScore: nested.result.structuralCoherenceScore,
    previousFalsifiabilityBaseline: observerEvaluation.baseline,
    observerFalsifiabilityScore: observerEvaluation.overallFalsifiabilityScore,
    falsifiabilityAbsoluteGain: observerEvaluation.absoluteGain,
    falsifiabilityResidualReduction: observerEvaluation.residualReduction,
    intersticeAdjustedCoherence,
    nestedUniverseResultRoot: nested.result.root,
    nestedSpecRoot: nestedSpec.root,
    observerEvaluation,
    adjustedCoherenceRows: adjustedCoherenceRows.map(row => ({ ...row, score: round(row.score, 9) })),
    predictedEvents: [],
  };
  result.predictedEvents = generateIntersticeObserverPredictedEvents(observerEvaluation);
  result.root = sha256({ spec, result: { ...result, predictedEvents: result.predictedEvents.map(row => row.id), root: undefined } });
  return { spec, nested: nested.result, result };
}

export function buildIntersticeObserverSpec(input = {}) {
  const { spec, result } = compileIntersticeObserverModel(input);
  return {
    ...spec,
    compilerPasses: [
      'nested universe memory model reuse',
      '8 interstice space normalization',
      'observer falsifier specificity scoring',
      'observer independence and coverage scoring',
      'baseline falsifiability comparison',
      'sandbox boundary preservation',
    ],
    validation: {
      previousFalsifiabilityBaseline: result.previousFalsifiabilityBaseline,
      observerFalsifiabilityScore: result.observerFalsifiabilityScore,
      falsifiabilityAbsoluteGain: result.falsifiabilityAbsoluteGain,
      falsifiabilityResidualReduction: result.falsifiabilityResidualReduction,
      conclusionHolds: result.conclusionHolds,
      externalRealityVerified: result.externalRealityVerified,
    },
    root: sha256({ spec, resultRoot: result.root }),
  };
}

export function renderIntersticeObserverRcl(specInput = {}) {
  const spec = specInput.format === RCL_INTERSTICE_OBSERVER_SPEC_FORMAT ? specInput : buildIntersticeObserverSpec(specInput);
  const validation = spec.validation ?? {};
  const spaces = spec.intersticeSpaces.map((space, index) => `  facet interstice_${index + 1}.id : Text = "${rclString(space.id)}"
  facet interstice_${index + 1}.observer : Text = "${rclString(space.observer)}"
  facet interstice_${index + 1}.observes : Text = "${rclString(space.observes)}"
  facet interstice_${index + 1}.falsifier : Text = "${rclString(space.falsifier)}"`).join('\n');
  return `reality UniverseIntersticeObserverCompiler {
  facet compiler.version : Text = "${RCL_INTERSTICE_OBSERVER_COMPILER_VERSION}"
  facet compiler.format : Text = "${RCL_INTERSTICE_OBSERVER_SPEC_FORMAT}"
  facet boundary : Text = "${rclString(spec.boundary)}"
  facet relation.model : Text = "${rclString(spec.relationModel)}"
  facet observer.count : Number = ${spec.intersticeSpaces.length}
  facet observer.required_count : Number = ${spec.requiredObserverCount}
  facet baseline.falsifiability : Number = ${validation.previousFalsifiabilityBaseline ?? spec.previousFalsifiabilityBaseline}
  facet validation.observer_falsifiability : Number = ${validation.observerFalsifiabilityScore ?? 0}
  facet validation.falsifiability_absolute_gain : Number = ${validation.falsifiabilityAbsoluteGain ?? 0}
  facet validation.falsifiability_residual_reduction : Number = ${validation.falsifiabilityResidualReduction ?? 0}
  facet validation.conclusion_holds : Truth = ${validation.conclusionHolds ? 'true' : 'false'}
  facet validation.external_reality_verified : Truth = false
${spaces}
}`;
}

export function runIntersticeObserverTest(input = {}) {
  const bundle = compileIntersticeObserverModel(input);
  return {
    ok: true,
    version: RCL_INTERSTICE_OBSERVER_COMPILER_VERSION,
    boundary: bundle.result.boundary,
    verdict: bundle.result.verdict,
    conclusionHolds: bundle.result.conclusionHolds,
    observerFalsifiabilityScore: bundle.result.observerFalsifiabilityScore,
    previousFalsifiabilityBaseline: bundle.result.previousFalsifiabilityBaseline,
    falsifiabilityAbsoluteGain: bundle.result.falsifiabilityAbsoluteGain,
    falsifiabilityResidualReduction: bundle.result.falsifiabilityResidualReduction,
    intersticeAdjustedCoherence: bundle.result.intersticeAdjustedCoherence,
    externalRealityVerified: bundle.result.externalRealityVerified,
    predictedEvents: bundle.result.predictedEvents,
    root: bundle.result.root,
  };
}

export function runIntersticeObserverDemo() {
  return runIntersticeObserverTest(DEFAULT_INTERSTICE_OBSERVER_SPEC);
}

export function readIntersticeObserverInput(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function writeIntersticeObserverReports(outputDir = 'output/v0.47/interstice-observer', input = {}) {
  const dir = path.resolve(outputDir);
  fs.mkdirSync(dir, { recursive: true });
  const bundle = compileIntersticeObserverModel(input);
  const spec = buildIntersticeObserverSpec(input);
  const rcl = renderIntersticeObserverRcl(spec);
  const summary = `# RCL Universe Interstice Observer Compiler v0.47\n\n结论：${bundle.result.verdict}\n\n- previousFalsifiabilityBaseline: ${bundle.result.previousFalsifiabilityBaseline}\n- observerFalsifiabilityScore: ${bundle.result.observerFalsifiabilityScore}\n- falsifiabilityAbsoluteGain: ${bundle.result.falsifiabilityAbsoluteGain}\n- falsifiabilityResidualReduction: ${bundle.result.falsifiabilityResidualReduction}\n- intersticeAdjustedCoherence: ${bundle.result.intersticeAdjustedCoherence}\n- externalRealityVerified: false\n\n## Observers / Falsifiers\n\n${bundle.result.predictedEvents.map(row => `- ${row.id}: ${row.event}\n  - falsifier: ${row.falsifier}`).join('\n')}\n`;
  const paths = {
    bundle: path.join(dir, 'interstice-observer-bundle.json'),
    spec: path.join(dir, 'interstice-observer-spec.json'),
    rcl: path.join(dir, 'interstice-observer-compiler.rcl'),
    summary: path.join(dir, 'interstice-observer-summary.md'),
  };
  fs.writeFileSync(paths.bundle, `${JSON.stringify({ format: RCL_INTERSTICE_OBSERVER_BUNDLE_FORMAT, version: RCL_INTERSTICE_OBSERVER_COMPILER_VERSION, ...bundle }, null, 2)}\n`);
  fs.writeFileSync(paths.spec, `${JSON.stringify(spec, null, 2)}\n`);
  fs.writeFileSync(paths.rcl, `${rcl}\n`);
  fs.writeFileSync(paths.summary, summary);
  return {
    ok: true,
    format: RCL_INTERSTICE_OBSERVER_BUNDLE_FORMAT,
    version: RCL_INTERSTICE_OBSERVER_COMPILER_VERSION,
    outputDir: dir,
    files: paths,
    result: bundle.result,
  };
}
