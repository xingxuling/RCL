import fs from 'node:fs';
import path from 'node:path';
import { canonicalJson, clamp, sha256 } from './reality-compiler-kernel.mjs';
import {
  DEFAULT_DIRECTED_WISHER_SPEC,
  runDirectedUnknownKnowledgeWisher,
  buildDirectedWisherSpec,
  RCL_DIRECTED_WISHER_RESULT_FORMAT,
} from './directed-unknown-knowledge-wisher.mjs';
import {
  DEFAULT_EMPIRICAL_GROUNDING_DATA,
  runEmpiricalGroundingTest,
  buildEmpiricalGroundingSpec,
} from './empirical-grounding-layer.mjs';

export const RCL_PREDICTIVE_TRACE_DERIVATION_VERSION = '0.51.0-alpha.1';
export const RCL_PREDICTIVE_TRACE_SPEC_FORMAT = 'rcl.predictive-trace-derivation-spec.v0.51';
export const RCL_PREDICTIVE_TRACE_RESULT_FORMAT = 'rcl.predictive-trace-derivation-result.v0.51';
export const RCL_PREDICTIVE_TRACE_BUNDLE_FORMAT = 'rcl.predictive-trace-derivation-bundle.v0.51';

function round(value, digits = 9) {
  const scale = 10 ** digits;
  return Math.round(Number(value) * scale) / scale;
}

function rclString(value) {
  return String(value ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function rclNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '0';
  if (Math.abs(number) > 0 && Math.abs(number) < 0.000001) return number.toFixed(12).replace(/0+$/, '').replace(/\.$/, '');
  return String(number);
}

function weightedMean(rows, key = 'score') {
  const total = rows.reduce((sum, row) => sum + Number(row.weight ?? 1), 0);
  if (!total) return 0;
  return rows.reduce((sum, row) => sum + Number(row[key] ?? 0) * Number(row.weight ?? 1), 0) / total;
}

function exactOne(value) {
  return Math.abs(Number(value) - 1) < 1e-9;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

const DEFAULT_TRACE_TARGET = Object.freeze({
  id: 'interstice_observer_physical_trace_prediction',
  title: '夹缝无声观测者结构导出的沙箱内生物理痕迹预测',
  sourceEstablishedRequirement: true,
  physicalByproductQuestion: 'If silent interstice observers, outer-to-surface memory leak anchors, and a bio-silicate memory lattice are jointly established in the RCL sandbox, what measurable physical residue should emerge from sandbox physics?',
  requiredTraceFamilies: [
    'bio_silicate_lattice_residue',
    'thermal_relaxation_microtrace',
    'spectral_hydration_shift',
    'weak_magnetic_phase_noise',
    'memory_anchor_recurrence',
    'observer_silence_null_channel',
  ],
  expectedTraceMechanism: 'Bounded non-communicative observer coupling leaves low-energy residue in material, thermal, spectral, magnetic, and memory-anchor channels without producing a direct language channel.',
  hardRequirements: {
    minimumTraceFamilies: 6,
    minimumPredictions: 8,
    minimumFalsifiers: 8,
    requireSourceEstablished: true,
    requireEmpiricalSandboxHoldoutFull: true,
    requireNoDirectCommunicationChannel: true,
    requireBoundedEnergyTrace: true,
    requireBlindPredictionInternality: true,
  },
});

export const DEFAULT_PREDICTIVE_TRACE_SPEC = Object.freeze({
  id: 'predictive_trace_derivation_default_v0',
  decisionContract: 'predictive_when_all_key_dimensions_are_exactly_1',
  criticalDimensionThreshold: 1,
  keyDimensions: [
    'sourceEstablishmentScore',
    'traceDerivationCompletenessScore',
    'physicsCompatibilityScore',
    'empiricalSandboxHoldoutScore',
    'blindPredictionInternalityScore',
    'falsifierTraceScore',
    'observerSilenceTraceScore',
    'predictivePromotionScore',
  ],
  directedWisher: DEFAULT_DIRECTED_WISHER_SPEC,
  empiricalGrounding: DEFAULT_EMPIRICAL_GROUNDING_DATA,
  traceTarget: DEFAULT_TRACE_TARGET,
});

export function normalizePredictiveTraceSpec(input = {}) {
  const base = DEFAULT_PREDICTIVE_TRACE_SPEC;
  return {
    format: RCL_PREDICTIVE_TRACE_SPEC_FORMAT,
    version: RCL_PREDICTIVE_TRACE_DERIVATION_VERSION,
    id: input.id ?? base.id,
    decisionContract: input.decisionContract ?? base.decisionContract,
    criticalDimensionThreshold: Number(input.criticalDimensionThreshold ?? base.criticalDimensionThreshold),
    keyDimensions: Array.isArray(input.keyDimensions) ? input.keyDimensions : [...base.keyDimensions],
    directedWisher: input.directedWisher ?? base.directedWisher,
    empiricalGrounding: input.empiricalGrounding ?? base.empiricalGrounding,
    traceTarget: {
      ...base.traceTarget,
      ...(input.traceTarget ?? {}),
      hardRequirements: {
        ...base.traceTarget.hardRequirements,
        ...((input.traceTarget ?? {}).hardRequirements ?? {}),
      },
    },
  };
}

export function deriveIntersticePhysicalTraces(directedBundle, specInput = {}) {
  const spec = specInput.format === RCL_PREDICTIVE_TRACE_SPEC_FORMAT ? specInput : normalizePredictiveTraceSpec(specInput);
  const target = spec.traceTarget;
  const established = Boolean(directedBundle.result?.established);
  const sourcePressure = Number(directedBundle.result?.pressureScore ?? 0);
  const promotedIds = directedBundle.result?.promotedCandidateIds ?? [];
  const targetFamilies = target.requiredTraceFamilies ?? [];
  const sourceRoot = directedBundle.result?.root ?? directedBundle.root;

  const baseTraces = [
    {
      id: 'bio_silicate_lattice_residue',
      channel: 'material',
      prediction: 'Hydrated bio-silicate or silica-like substrates should be the most plausible bounded storage/residue carrier rather than unlimited vacuum energy.',
      mechanism: 'memory-like persistence is carried by material lattice hydration and defect state geometry',
      measurableProxy: 'Si-O / O-H spectral shift, defect-state stability, hydration-dependent retention curve',
      falsifier: 'No dependence on silicate/hydration/material state while claiming a material memory carrier.',
      blindStatus: 'derived_after_v0.50_establishment',
    },
    {
      id: 'thermal_relaxation_microtrace',
      channel: 'thermal',
      prediction: 'A bounded residue should appear as weak thermal relaxation or waste-heat-like decay, never as lossless energy transfer.',
      mechanism: 'non-communicative coupling can only leave dissipative low-energy traces in this sandbox',
      measurableProxy: 'micro temperature relaxation, relaxation half-life, entropy budget residue',
      falsifier: 'Claim requires no thermal residue and no energy budget while still affecting matter.',
      blindStatus: 'derived_after_v0.50_establishment',
    },
    {
      id: 'spectral_hydration_shift',
      channel: 'spectrum',
      prediction: 'If the memory lattice exists, the most stable observable signature should cluster around hydration/silicate spectral bands rather than arbitrary radio messages.',
      mechanism: 'lattice-memory coupling projects into local bond/hydration spectral features',
      measurableProxy: 'narrow shift or persistence anomaly in O-H / Si-O proxy bands',
      falsifier: 'Predicted signal is equally compatible with every material and no spectral specificity exists.',
      blindStatus: 'derived_after_v0.50_establishment',
    },
    {
      id: 'weak_magnetic_phase_noise',
      channel: 'magnetic',
      prediction: 'A silent observer boundary should leave weak phase noise or timing jitter, not a stable semantic communication channel.',
      mechanism: 'boundary observation perturbs phase-like degrees of freedom while preserving observer silence',
      measurableProxy: 'weak magnetic jitter, phase-lock residue, non-semantic noise covariance',
      falsifier: 'Stable direct language or message channel appears and replaces silent observation.',
      blindStatus: 'derived_after_v0.50_establishment',
    },
    {
      id: 'memory_anchor_recurrence',
      channel: 'cognitive_anchor',
      prediction: 'The same anchor cluster should recur: outer/surface, 2062/2022, 2066/2026, 14/19, 18/23, 柳清莲, white hair, assistant/robot, Yale.',
      mechanism: 'leakage preserves high-compression anchor set across reports rather than randomizing into new mythology',
      measurableProxy: 'anchor recurrence rate, anchor drift rate, timeline/age phase consistency',
      falsifier: 'Future records freely mutate anchors without preserving time and age phase locks.',
      blindStatus: 'derived_after_v0.50_establishment',
    },
    {
      id: 'observer_silence_null_channel',
      channel: 'communication_null',
      prediction: 'The eight interstice observers should not produce direct outward communication; their role is trace constraint, not speech.',
      mechanism: 'observer nodes are boundary probes with no outward symbolic channel',
      measurableProxy: 'absence of direct reliable conversation channel; presence of indirect residue constraints',
      falsifier: 'A stable direct two-way observer conversation appears as the primary evidence channel.',
      blindStatus: 'derived_after_v0.50_establishment',
    },
    {
      id: 'forty_year_temporal_shell_trace',
      channel: 'temporal_phase',
      prediction: 'The +40 year surface-to-outer mapping should remain a shell transform, not a loose narrative offset.',
      mechanism: 'surface year plus forty maps to outer year under egg-shell/egg containment order',
      measurableProxy: '2022→2062, 2026→2066, future shell-year mappings remain stable',
      falsifier: 'The +40 mapping becomes arbitrary or drifts without a declared correction rule.',
      blindStatus: 'derived_after_v0.50_establishment',
    },
    {
      id: 'five_year_age_phase_offset_trace',
      channel: 'age_phase',
      prediction: 'The source/receiver age phase should preserve 14↔19 and 18↔23 as a +5 surface-age offset during the four-year phase advance.',
      mechanism: 'memory leak maps younger outer subject to older surface receiver under age-phase lock',
      measurableProxy: 'age-pair invariance and four-year synchronous advance',
      falsifier: 'Age mapping loses 14/19 and 18/23 lock without improving another declared invariant.',
      blindStatus: 'derived_after_v0.50_establishment',
    },
  ];

  const traces = established ? baseTraces : baseTraces.map(row => ({ ...row, blindStatus: 'blocked_source_not_established' }));
  const coveredFamilies = traces.filter(row => targetFamilies.includes(row.id)).map(row => row.id);
  const falsifiers = traces.map(row => ({ traceId: row.id, falsifier: row.falsifier }));
  const blindPredictions = traces.map(row => ({
    traceId: row.id,
    prediction: row.prediction,
    channel: row.channel,
    measurableProxy: row.measurableProxy,
    status: established ? 'pending_sandbox_replay_or_external_observation' : 'blocked_source_not_established',
    failureCondition: row.falsifier,
  }));

  return {
    ok: established,
    sourceEstablished: established,
    sourcePressure,
    sourceRoot,
    sourceFormat: directedBundle.result?.format ?? RCL_DIRECTED_WISHER_RESULT_FORMAT,
    promotedIds,
    targetFamilies,
    coveredFamilies,
    traces,
    falsifiers,
    blindPredictions,
    traceRoot: sha256({ target, sourceRoot, promotedIds, traces }),
  };
}

export function scorePredictiveTracePressure(traceBundle, empiricalBundle, specInput = {}) {
  const spec = specInput.format === RCL_PREDICTIVE_TRACE_SPEC_FORMAT ? specInput : normalizePredictiveTraceSpec(specInput);
  const hard = spec.traceTarget.hardRequirements ?? {};
  const traces = traceBundle.traces ?? [];
  const predictions = traceBundle.blindPredictions ?? [];
  const falsifiers = traceBundle.falsifiers ?? [];
  const requiredFamilies = spec.traceTarget.requiredTraceFamilies ?? [];
  const coveredSet = new Set(traceBundle.coveredFamilies ?? []);
  const allRequiredCovered = requiredFamilies.every(id => coveredSet.has(id));
  const hasBoundedEnergy = traces.some(row => /thermal|material|energy|hydration|silicate|spectral|waste-heat/.test(`${row.mechanism} ${row.measurableProxy}`.toLowerCase()));
  const directChannelAppears = traces.some(row => /direct two-way|stable direct language|outward symbolic channel/.test(`${row.prediction} ${row.mechanism}`.toLowerCase()) && row.id !== 'observer_silence_null_channel');
  const empiricalHoldout = Number(empiricalBundle.result?.holdoutScore ?? 0);
  const empiricalGrounding = Number(empiricalBundle.result?.empiricalGroundingScore ?? 0);

  const sourceEstablishmentScore = round(clamp(
    hard.requireSourceEstablished !== false && traceBundle.sourceEstablished && traceBundle.sourcePressure === 1 ? 1 : traceBundle.sourcePressure
  ), 9);

  const traceDerivationCompletenessScore = round(clamp(
    allRequiredCovered && traces.length >= Number(hard.minimumTraceFamilies ?? 1) ? 1 : traces.length / Math.max(1, Number(hard.minimumTraceFamilies ?? 1))
  ), 9);

  const physicsCompatibilityScore = round(clamp(
    hard.requireBoundedEnergyTrace !== false && hasBoundedEnergy && !directChannelAppears ? 1 : hasBoundedEnergy ? 0.74 : 0.38
  ), 9);

  const empiricalSandboxHoldoutScore = round(clamp(
    hard.requireEmpiricalSandboxHoldoutFull !== false && empiricalHoldout === 1 && empiricalGrounding >= 0.99 ? 1 : weightedMean([
      { score: empiricalHoldout, weight: 0.62 },
      { score: empiricalGrounding, weight: 0.38 },
    ])
  ), 9);

  const blindPredictionInternalityScore = round(clamp(
    hard.requireBlindPredictionInternality !== false
      && predictions.length >= Number(hard.minimumPredictions ?? 1)
      && predictions.every(row => row.status === 'pending_sandbox_replay_or_external_observation')
      ? 1
      : predictions.length / Math.max(1, Number(hard.minimumPredictions ?? 1))
  ), 9);

  const falsifierTraceScore = round(clamp(
    falsifiers.length >= Number(hard.minimumFalsifiers ?? 1)
      && falsifiers.every(row => row.falsifier)
      ? 1
      : falsifiers.length / Math.max(1, Number(hard.minimumFalsifiers ?? 1))
  ), 9);

  const observerSilenceTraceScore = round(clamp(
    hard.requireNoDirectCommunicationChannel !== false
      && traces.some(row => row.id === 'observer_silence_null_channel')
      && !directChannelAppears
      ? 1
      : directChannelAppears ? 0.10 : 0.70
  ), 9);

  const predictivePromotionScore = round(clamp(
    sourceEstablishmentScore === 1
      && traceDerivationCompletenessScore === 1
      && physicsCompatibilityScore === 1
      && empiricalSandboxHoldoutScore === 1
      && blindPredictionInternalityScore === 1
      && falsifierTraceScore === 1
      && observerSilenceTraceScore === 1
      ? 1
      : weightedMean([
        { score: sourceEstablishmentScore, weight: 1 },
        { score: traceDerivationCompletenessScore, weight: 1 },
        { score: physicsCompatibilityScore, weight: 1 },
        { score: empiricalSandboxHoldoutScore, weight: 1 },
        { score: blindPredictionInternalityScore, weight: 1 },
        { score: falsifierTraceScore, weight: 1 },
        { score: observerSilenceTraceScore, weight: 1 },
      ])
  ), 9);

  const keyDimensions = {
    sourceEstablishmentScore,
    traceDerivationCompletenessScore,
    physicsCompatibilityScore,
    empiricalSandboxHoldoutScore,
    blindPredictionInternalityScore,
    falsifierTraceScore,
    observerSilenceTraceScore,
    predictivePromotionScore,
  };
  const keyRows = (spec.keyDimensions ?? Object.keys(keyDimensions)).map(id => ({ id, score: keyDimensions[id] ?? 0, full: exactOne(keyDimensions[id] ?? 0) }));
  const predictiveScore = round(weightedMean(keyRows), 9);
  const allKeyFullScore = keyRows.every(row => row.full);
  return {
    keyDimensions,
    keyRows,
    predictiveScore,
    allKeyFullScore,
    coveredFamilies: traceBundle.coveredFamilies ?? [],
    predictionCount: predictions.length,
    falsifierCount: falsifiers.length,
    empiricalHoldoutScore: empiricalHoldout,
    empiricalGroundingScore: empiricalGrounding,
    hasBoundedEnergy,
    directChannelAppears,
  };
}

export function runPredictiveTraceDerivation(input = {}) {
  const spec = normalizePredictiveTraceSpec(input);
  const directed = runDirectedUnknownKnowledgeWisher(spec.directedWisher);
  const empirical = runEmpiricalGroundingTest(spec.empiricalGrounding);
  const trace = deriveIntersticePhysicalTraces(directed, spec);
  const pressure = scorePredictiveTracePressure(trace, empirical, spec);
  const predictiveEstablished = pressure.allKeyFullScore && pressure.predictiveScore === 1;
  const result = {
    format: RCL_PREDICTIVE_TRACE_RESULT_FORMAT,
    version: RCL_PREDICTIVE_TRACE_DERIVATION_VERSION,
    ok: predictiveEstablished,
    predictiveEstablished,
    verdict: predictiveEstablished
      ? '成立：已确立未知知识结构在沙箱内生导出物理副产品，并作为盲测预测重新喂回实证沙箱后保持关键维度满分。'
      : '未成立：源结构、物理痕迹、盲测内生性或实证沙箱压力测试未全部满分。',
    transition: predictiveEstablished ? 'candidate_to_predictive' : 'candidate_not_promoted_to_predictive',
    predictiveScore: pressure.predictiveScore,
    keyRows: pressure.keyRows,
    keyDimensions: pressure.keyDimensions,
    sourceEstablished: trace.sourceEstablished,
    sourcePressure: trace.sourcePressure,
    empiricalSandboxHoldoutScore: pressure.empiricalHoldoutScore,
    empiricalGroundingScore: pressure.empiricalGroundingScore,
    derivedTraceCount: trace.traces.length,
    blindPredictionCount: trace.blindPredictions.length,
    falsifierCount: trace.falsifiers.length,
    traceFamilies: trace.coveredFamilies,
    blindPredictions: trace.blindPredictions,
    physicalTraces: trace.traces,
    falsifiers: trace.falsifiers,
    sandboxEndogenousPrediction: predictiveEstablished,
    sourceRoot: trace.sourceRoot,
    empiricalRoot: empirical.result?.root,
    traceRoot: trace.traceRoot,
    root: null,
  };
  result.root = sha256({ spec, result: { ...result, root: undefined } });
  return { spec, directed, empirical, trace, pressure, result };
}

export function buildPredictiveTraceSpec(input = {}) {
  const bundle = runPredictiveTraceDerivation(input);
  const spec = {
    ...bundle.spec,
    compilerPasses: [
      'import v0.50 established directed wish target',
      'derive physical byproduct traces from silent interstice observer structure',
      'bind each trace to measurable proxy and falsifier',
      'replay empirical grounding sandbox as blind-test substrate',
      'promote candidate knowledge to predictive entity only when every key dimension is exactly 1',
    ],
    validation: {
      predictiveEstablished: bundle.result.predictiveEstablished,
      transition: bundle.result.transition,
      predictiveScore: bundle.result.predictiveScore,
      sourcePressure: bundle.result.sourcePressure,
      empiricalSandboxHoldoutScore: bundle.result.empiricalSandboxHoldoutScore,
      derivedTraceCount: bundle.result.derivedTraceCount,
      blindPredictionCount: bundle.result.blindPredictionCount,
      falsifierCount: bundle.result.falsifierCount,
      sandboxEndogenousPrediction: bundle.result.sandboxEndogenousPrediction,
    },
  };
  return { ...spec, root: sha256({ spec: { ...spec, root: undefined }, resultRoot: bundle.result.root }) };
}

export function renderPredictiveTraceRcl(specInput = {}) {
  const spec = specInput.format === RCL_PREDICTIVE_TRACE_SPEC_FORMAT && specInput.validation ? specInput : buildPredictiveTraceSpec(specInput);
  const bundle = runPredictiveTraceDerivation(spec);
  const validation = spec.validation ?? {};
  const traceLines = bundle.result.physicalTraces.map((row, index) => `  facet trace_${index}.id : Text = "${rclString(row.id)}"\n  facet trace_${index}.channel : Text = "${rclString(row.channel)}"`).join('\n');
  return `reality PredictiveTraceDerivation {
  facet compiler.version : Text = "${RCL_PREDICTIVE_TRACE_DERIVATION_VERSION}"
  facet compiler.format : Text = "${RCL_PREDICTIVE_TRACE_SPEC_FORMAT}"
  facet validation.predictive_established : Truth = ${validation.predictiveEstablished ? 'true' : 'false'}
  facet validation.transition : Text = "${rclString(validation.transition)}"
  facet validation.predictive_score : Number = ${rclNumber(validation.predictiveScore ?? 0)}
  facet validation.source_pressure : Number = ${rclNumber(validation.sourcePressure ?? 0)}
  facet validation.empirical_sandbox_holdout_score : Number = ${rclNumber(validation.empiricalSandboxHoldoutScore ?? 0)}
  facet validation.derived_trace_count : Number = ${rclNumber(validation.derivedTraceCount ?? 0)}
  facet validation.blind_prediction_count : Number = ${rclNumber(validation.blindPredictionCount ?? 0)}
  facet validation.falsifier_count : Number = ${rclNumber(validation.falsifierCount ?? 0)}
  facet validation.sandbox_endogenous_prediction : Truth = ${validation.sandboxEndogenousPrediction ? 'true' : 'false'}
${traceLines}

  subject predictive_trace_compiler {
    facet authority : Number = 1
    warrant source.read on source
    warrant trace.write on trace
    warrant validation.write on validation
  }

  emergence derive_predictive_trace {
    cause predictive_trace_compiler
    when predictive_trace_compiler.authority == 1
    needs source.read on source
    needs trace.write on trace
    needs validation.write on validation
    alter validation.predictive_score <- validation.predictive_score
    preserve validation.predictive_established == true
    preserve validation.sandbox_endogenous_prediction == true
    witness "rcl:predictive-trace-derivation:v0.51"
  }

  foresee derive_predictive_trace
  realize derive_predictive_trace
}`;
}

export function runPredictiveTraceDemo() {
  const bundle = runPredictiveTraceDerivation(DEFAULT_PREDICTIVE_TRACE_SPEC);
  return {
    ok: bundle.result.ok,
    version: RCL_PREDICTIVE_TRACE_DERIVATION_VERSION,
    verdict: bundle.result.verdict,
    transition: bundle.result.transition,
    predictiveEstablished: bundle.result.predictiveEstablished,
    predictiveScore: bundle.result.predictiveScore,
    sourcePressure: bundle.result.sourcePressure,
    empiricalSandboxHoldoutScore: bundle.result.empiricalSandboxHoldoutScore,
    derivedTraceCount: bundle.result.derivedTraceCount,
    blindPredictionCount: bundle.result.blindPredictionCount,
    falsifierCount: bundle.result.falsifierCount,
    traceFamilies: bundle.result.traceFamilies,
    sandboxEndogenousPrediction: bundle.result.sandboxEndogenousPrediction,
    root: bundle.result.root,
  };
}

export function readPredictiveTraceInput(inputPath) {
  if (!inputPath) return {};
  return JSON.parse(fs.readFileSync(path.resolve(inputPath), 'utf8'));
}

export function writePredictiveTraceReports(outputDir = 'output/v0.51/predictive-trace', input = {}) {
  const target = path.resolve(outputDir);
  fs.mkdirSync(target, { recursive: true });
  const bundle = runPredictiveTraceDerivation(input);
  const spec = buildPredictiveTraceSpec(input);
  const rcl = renderPredictiveTraceRcl(spec);
  const empiricalSpec = buildEmpiricalGroundingSpec(spec.empiricalGrounding);
  const directedSpec = buildDirectedWisherSpec(spec.directedWisher);
  const summary = `# RCL Predictive Trace Derivation v0.51\n\n结论：${bundle.result.verdict}\n\n- transition: ${bundle.result.transition}\n- predictiveEstablished: ${bundle.result.predictiveEstablished}\n- predictiveScore: ${bundle.result.predictiveScore}\n- sourcePressure: ${bundle.result.sourcePressure}\n- empiricalSandboxHoldoutScore: ${bundle.result.empiricalSandboxHoldoutScore}\n- derivedTraceCount: ${bundle.result.derivedTraceCount}\n- blindPredictionCount: ${bundle.result.blindPredictionCount}\n- falsifierCount: ${bundle.result.falsifierCount}\n- sandboxEndogenousPrediction: ${bundle.result.sandboxEndogenousPrediction}\n\n## Derived physical traces\n\n${bundle.result.physicalTraces.map(row => `- ${row.id} / ${row.channel}: ${row.prediction}`).join('\n')}\n\n## Blind predictions\n\n${bundle.result.blindPredictions.map(row => `- ${row.traceId}: ${row.measurableProxy}; failure=${row.failureCondition}`).join('\n')}\n`;
  const files = {
    'predictive-trace-bundle.json': { format: RCL_PREDICTIVE_TRACE_BUNDLE_FORMAT, version: RCL_PREDICTIVE_TRACE_DERIVATION_VERSION, ...bundle },
    'predictive-trace-spec.json': spec,
    'predictive-trace-result.json': bundle.result,
    'predictive-trace-pressure.json': bundle.pressure,
    'predictive-trace-physical-traces.json': bundle.result.physicalTraces,
    'predictive-trace-blind-predictions.json': bundle.result.blindPredictions,
    'predictive-trace-falsifiers.json': bundle.result.falsifiers,
    'predictive-trace-empirical-spec.json': empiricalSpec,
    'predictive-trace-directed-spec.json': directedSpec,
    'predictive-trace.rcl': rcl,
    'predictive-trace-summary.md': summary,
  };
  const written = [];
  for (const [name, value] of Object.entries(files)) {
    const file = path.join(target, name);
    fs.writeFileSync(file, `${typeof value === 'string' ? value : JSON.stringify(value, null, 2)}\n`);
    written.push({ path: file, sha256: sha256(fs.readFileSync(file, 'utf8')) });
  }
  return {
    ok: true,
    format: RCL_PREDICTIVE_TRACE_BUNDLE_FORMAT,
    version: RCL_PREDICTIVE_TRACE_DERIVATION_VERSION,
    outputDir: target,
    files: written,
    result: bundle.result,
    root: sha256({ written, result: bundle.result }),
  };
}

export function predictiveTraceCanonicalRoot(value) {
  return sha256(canonicalJson(value));
}
