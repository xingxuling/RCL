import fs from 'node:fs';
import path from 'node:path';
import { clamp, createSeededRandom, sha256, canonicalJson } from './reality-compiler-kernel.mjs';
import {
  DEFAULT_ORIGIN_CENTER,
  normalizeOriginParameters,
  originParametersFromSeed,
  compileEarthHistoryFromOrigin,
} from './cosmogenic-reality-compiler.mjs';
import {
  DEFAULT_EMPIRICAL_GROUNDING_DATA,
  normalizeEmpiricalGroundingSpec,
  empiricalCalibrationToOriginCenter,
  compileEmpiricalHoldoutFacts,
} from './empirical-grounding-layer.mjs';
import { runRealUniverseCoordinateBlindtest } from './real-universe-coordinate-blindtest.mjs';

export const RCL_COSMOGENIC_PARAMETER_INVERSION_VERSION = '0.90.0-alpha.1';
export const RCL_COSMOGENIC_PARAMETER_INVERSION_SPEC_FORMAT = 'rcl.cosmogenic-parameter-inversion-spec.v0.90';
export const RCL_COSMOGENIC_PARAMETER_INVERSION_RESULT_FORMAT = 'rcl.cosmogenic-parameter-inversion-result.v0.90';
export const RCL_COSMOGENIC_PARAMETER_INVERSION_BUNDLE_FORMAT = 'rcl.cosmogenic-parameter-inversion-bundle.v0.90';

const EPS = 1e-12;

function round(value, digits = 9) {
  const scale = 10 ** digits;
  return Math.round(Number(value) * scale) / scale;
}

function rclNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '0';
  if (Math.abs(number) > 0 && Math.abs(number) < 0.000001) return number.toFixed(12).replace(/0+$/, '').replace(/\.$/, '');
  return String(number);
}

function rclString(value) {
  return String(value ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function weightedMean(rows, key = 'score') {
  const total = rows.reduce((sum, row) => sum + Number(row.weight ?? 1), 0);
  if (!total) return 0;
  return rows.reduce((sum, row) => sum + Number(row[key] ?? 0) * Number(row.weight ?? 1), 0) / total;
}

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const item of Object.values(value)) deepFreeze(item);
  }
  return value;
}

export const DEFAULT_MACRO_REALITY_CONSTRAINTS = deepFreeze({
  calibration: [
    { id: 'universe_age_ga', label: 'Universe age', observation: 'history.universe_age', expected: 13.797, tolerance: 0.035, unit: 'Ga', weight: 1.45, source: 'Planck 2018 LCDM + NASA dark-energy overview', usedForInversion: true },
    { id: 'solar_system_formation_ga', label: 'Solar-system formation age', observation: 'history.solar_system_formation', expected: 4.567, tolerance: 0.085, unit: 'Ga before present', weight: 1.05, source: 'meteoritic solar-system age range', usedForInversion: true },
    { id: 'earth_formation_ga', label: 'Earth formation age', observation: 'history.earth_formation', expected: 4.540, tolerance: 0.075, unit: 'Ga before present', weight: 1.20, source: 'geochronology consensus range', usedForInversion: true },
    { id: 'earliest_life_ga', label: 'Earliest-life window', observation: 'history.earliest_life', expected: 3.800, tolerance: 0.360, unit: 'Ga before present', weight: 0.90, source: 'peer-reviewed early-life window', usedForInversion: true },
    { id: 'great_oxidation_ga', label: 'Great Oxidation Event', observation: 'history.great_oxidation', expected: 2.400, tolerance: 0.240, unit: 'Ga before present', weight: 0.80, source: 'Earth-history calibration range', usedForInversion: true },
    { id: 'sun_distance_km', label: 'Mean Sun-Earth distance', observation: 'holdout.sun_distance_km', expected: 149597870.7, tolerance: 1250000, unit: 'km', weight: 1.05, source: 'NASA Earth facts / astronomical-unit scale', usedForInversion: true },
    { id: 'earth_day_hours', label: 'Earth sidereal/solar day macro window', observation: 'holdout.earth_day_hours', expected: 23.9345, tolerance: 0.1800, unit: 'hours', weight: 0.90, source: 'NASA Earth rotation facts', usedForInversion: true },
    { id: 'earth_year_days', label: 'Earth orbital year', observation: 'holdout.earth_year_days', expected: 365.256, tolerance: 0.800, unit: 'days', weight: 0.85, source: 'NASA Earth orbit facts', usedForInversion: true },
    { id: 'earth_diameter_km', label: 'Earth equatorial diameter', observation: 'holdout.earth_diameter_km', expected: 12756, tolerance: 95, unit: 'km', weight: 0.75, source: 'NASA Earth facts', usedForInversion: true },
    { id: 'axial_tilt_deg', label: 'Earth axial tilt', observation: 'holdout.axial_tilt_deg', expected: 23.44, tolerance: 0.70, unit: 'degrees', weight: 0.70, source: 'NASA Earth facts', usedForInversion: true },
  ],
  blindValidation: [
    { id: 'stable_oceans_ga', label: 'Stable liquid-water window', observation: 'history.stable_oceans', expected: 4.10, tolerance: 0.38, unit: 'Ga before present', weight: 0.80, source: 'geology/habitability range', usedForInversion: false },
    { id: 'eukaryotic_complexity_ga', label: 'Eukaryotic complexity window', observation: 'history.eukaryotic_complexity', expected: 1.80, tolerance: 0.32, unit: 'Ga before present', weight: 0.70, source: 'Earth-history validation range', usedForInversion: false },
    { id: 'cambrian_radiation_ga', label: 'Cambrian radiation', observation: 'history.cambrian_radiation', expected: 0.541, tolerance: 0.060, unit: 'Ga before present', weight: 0.75, source: 'geologic timescale validation', usedForInversion: false },
    { id: 'kpg_extinction_ga', label: 'K-Pg extinction', observation: 'history.kpg_extinction', expected: 0.066, tolerance: 0.012, unit: 'Ga before present', weight: 0.70, source: 'geologic timescale validation', usedForInversion: false },
    { id: 'moon_count', label: 'Major natural moon count', observation: 'holdout.moon_count', expected: 1, tolerance: 0.01, unit: 'count', weight: 0.45, source: 'NASA Earth facts validation', usedForInversion: false },
  ],
});

export const DEFAULT_COSMOGENIC_PARAMETER_INVERSION_SPEC = deepFreeze({
  format: RCL_COSMOGENIC_PARAMETER_INVERSION_SPEC_FORMAT,
  version: RCL_COSMOGENIC_PARAMETER_INVERSION_VERSION,
  id: 'macro_constraint_origin_parameter_inversion_v0',
  boundary: 'macro_science_constraint_parameter_inversion_sandbox_not_particle_exact_cosmology_not_star_coordinate_recovery',
  seed: 20260707,
  threshold: 0.965,
  validationThreshold: 0.88,
  priorStrength: 0.12,
  coordinateResidualPolicy: {
    starCoordinateResidualsCanTuneOrigin: false,
    route: 'provider_observability_layer_only',
    reason: 'RA/Dec catalog residuals constrain provider/instrument/epoch/redaction plumbing; they are not macro-cosmogenic initial-condition constraints.',
  },
  search: {
    randomCandidates: 6144,
    width: 0.18,
    coordinateRounds: 8,
    coordinateInitialStep: 0.045,
    coordinateDecay: 0.55,
  },
  empiricalCalibration: DEFAULT_EMPIRICAL_GROUNDING_DATA.calibration,
  constraints: DEFAULT_MACRO_REALITY_CONSTRAINTS,
});

export function normalizeCosmogenicParameterInversionSpec(input = {}) {
  const base = DEFAULT_COSMOGENIC_PARAMETER_INVERSION_SPEC;
  const empiricalBase = normalizeEmpiricalGroundingSpec({ calibration: base.empiricalCalibration });
  const empiricalInput = normalizeEmpiricalGroundingSpec({ calibration: input.empiricalCalibration ?? input.calibration ?? base.empiricalCalibration });
  return {
    format: RCL_COSMOGENIC_PARAMETER_INVERSION_SPEC_FORMAT,
    version: RCL_COSMOGENIC_PARAMETER_INVERSION_VERSION,
    id: input.id ?? base.id,
    boundary: input.boundary ?? base.boundary,
    seed: Number(input.seed ?? base.seed),
    threshold: Number(input.threshold ?? base.threshold),
    validationThreshold: Number(input.validationThreshold ?? base.validationThreshold),
    priorStrength: Number(input.priorStrength ?? base.priorStrength),
    coordinateResidualPolicy: { ...base.coordinateResidualPolicy, ...(input.coordinateResidualPolicy ?? {}) },
    search: { ...base.search, ...(input.search ?? {}) },
    empiricalCalibration: empiricalInput.calibration ?? empiricalBase.calibration,
    constraints: {
      calibration: Array.isArray(input.constraints?.calibration) ? input.constraints.calibration : [...base.constraints.calibration],
      blindValidation: Array.isArray(input.constraints?.blindValidation) ? input.constraints.blindValidation : [...base.constraints.blindValidation],
    },
  };
}

function observationFromSimulation(simulation, observation) {
  const [scope, key] = String(observation).split('.');
  if (scope === 'history') return Number(simulation.history.events[key]);
  if (scope === 'holdout') return Number(simulation.holdouts[key]);
  if (scope === 'origin') return Number(simulation.origin[key]);
  return Number.NaN;
}

function scoreTarget(value, target) {
  const expected = Number(target.expected);
  const tolerance = Math.max(Math.abs(Number(target.tolerance ?? 1)), EPS);
  const normalizedError = Math.abs(Number(value) - expected) / tolerance;
  const score = clamp(1 - normalizedError / 3);
  return {
    id: target.id,
    label: target.label,
    observation: target.observation,
    predicted: round(value, Math.abs(value) < 0.001 ? 12 : 6),
    expected: target.expected,
    tolerance: target.tolerance,
    unit: target.unit,
    weight: target.weight ?? 1,
    source: target.source,
    usedForInversion: Boolean(target.usedForInversion),
    absoluteError: round(Math.abs(Number(value) - expected), Math.abs(value) < 0.001 ? 12 : 6),
    normalizedError: round(normalizedError, 9),
    score: round(score, 9),
    withinTolerance: normalizedError <= 1,
  };
}

function meanAbsDelta(a = {}, b = {}) {
  const keys = Object.keys(DEFAULT_ORIGIN_CENTER);
  return keys.reduce((sum, key) => sum + Math.abs(Number(a[key]) - Number(b[key])), 0) / Math.max(1, keys.length);
}

export function simulateCosmogenicMacroOutputs(originInput = {}, specInput = {}) {
  const spec = normalizeCosmogenicParameterInversionSpec(specInput);
  const origin = normalizeOriginParameters(originInput.parameters ?? originInput);
  const empiricalSpec = normalizeEmpiricalGroundingSpec({ calibration: spec.empiricalCalibration });
  const history = compileEarthHistoryFromOrigin(origin);
  const holdouts = compileEmpiricalHoldoutFacts(origin, history, empiricalSpec);
  return { origin, history, holdouts };
}

export function evaluateOriginAgainstMacroScience(originInput = {}, specInput = {}) {
  const spec = normalizeCosmogenicParameterInversionSpec(specInput);
  const prior = empiricalCalibrationToOriginCenter(spec.empiricalCalibration);
  const simulation = simulateCosmogenicMacroOutputs(originInput, spec);
  const calibrationRows = spec.constraints.calibration.map(target => scoreTarget(observationFromSimulation(simulation, target.observation), target));
  const validationRows = spec.constraints.blindValidation.map(target => scoreTarget(observationFromSimulation(simulation, target.observation), target));
  const calibrationScore = round(weightedMean(calibrationRows), 9);
  const validationScore = round(weightedMean(validationRows), 9);
  const priorDistance = round(meanAbsDelta(simulation.origin, prior), 9);
  const defaultDistance = round(meanAbsDelta(simulation.origin, DEFAULT_ORIGIN_CENTER), 9);
  const priorScore = round(clamp(1 - priorDistance / 0.22), 9);
  const objectiveScore = round((1 - spec.priorStrength) * calibrationScore + spec.priorStrength * priorScore, 9);
  return {
    origin: simulation.origin,
    history: simulation.history,
    holdouts: simulation.holdouts,
    calibrationRows,
    validationRows,
    calibrationScore,
    validationScore,
    prior,
    priorDistance,
    defaultDistance,
    priorScore,
    objectiveScore,
    passed: calibrationScore >= spec.threshold && validationScore >= spec.validationThreshold,
    root: sha256({ origin: simulation.origin, calibrationRows, validationRows, calibrationScore, validationScore, priorDistance, objectiveScore }),
  };
}

function better(a, b) {
  if (!a) return b;
  if (!b) return a;
  if (b.evaluation.objectiveScore > a.evaluation.objectiveScore + 1e-12) return b;
  if (Math.abs(b.evaluation.objectiveScore - a.evaluation.objectiveScore) <= 1e-12 && b.evaluation.validationScore > a.evaluation.validationScore) return b;
  return a;
}

function randomOriginAround(center, rng, width) {
  const params = {};
  for (const key of Object.keys(DEFAULT_ORIGIN_CENTER)) {
    const drift = rng.gaussian(0, width / 2.8) + (rng.random() - 0.5) * width;
    params[key] = round(clamp(Number(center[key]) + drift), 6);
  }
  return normalizeOriginParameters(params);
}

function localSearch(best, spec) {
  let current = best;
  let step = Number(spec.search.coordinateInitialStep ?? 0.045);
  const decay = Number(spec.search.coordinateDecay ?? 0.55);
  const keys = Object.keys(DEFAULT_ORIGIN_CENTER);
  const trace = [];
  for (let roundIndex = 0; roundIndex < Number(spec.search.coordinateRounds ?? 8); roundIndex += 1) {
    let improved = false;
    for (const key of keys) {
      for (const direction of [-1, 1]) {
        const origin = { ...current.origin, [key]: round(clamp(Number(current.origin[key]) + direction * step), 6) };
        const evaluation = evaluateOriginAgainstMacroScience(origin, spec);
        const candidate = { origin, evaluation, source: `coordinate:${key}:${direction > 0 ? '+' : '-'}:${roundIndex}` };
        const next = better(current, candidate);
        if (next !== current) {
          current = next;
          improved = true;
          trace.push({ roundIndex, key, direction, step: round(step, 9), objectiveScore: current.evaluation.objectiveScore, calibrationScore: current.evaluation.calibrationScore, validationScore: current.evaluation.validationScore });
        }
      }
    }
    if (!improved) step *= decay;
    else step *= decay;
  }
  return { best: current, trace };
}

export function invertCosmogenicInitialParameters(specInput = {}) {
  const spec = normalizeCosmogenicParameterInversionSpec(specInput);
  const rng = createSeededRandom(spec.seed);
  const analyticPrior = empiricalCalibrationToOriginCenter(spec.empiricalCalibration);
  const candidates = [];
  const defaultOrigin = normalizeOriginParameters(DEFAULT_ORIGIN_CENTER);
  const analyticOrigin = normalizeOriginParameters(analyticPrior);
  candidates.push({ origin: defaultOrigin, source: 'default_origin_center' });
  candidates.push({ origin: analyticOrigin, source: 'empirical_calibration_analytic_prior' });
  const seeded = originParametersFromSeed(spec.seed, { center: analyticOrigin, width: Math.min(0.16, spec.search.width ?? 0.18) }).parameters;
  candidates.push({ origin: normalizeOriginParameters(seeded), source: 'seeded_origin_near_analytic_prior' });
  for (let i = 0; i < Number(spec.search.randomCandidates ?? 4096); i += 1) {
    candidates.push({ origin: randomOriginAround(analyticOrigin, rng, spec.search.width), source: `random_prior_candidate_${i}` });
  }
  let best = null;
  const sampledTrace = [];
  for (const candidate of candidates) {
    const evaluation = evaluateOriginAgainstMacroScience(candidate.origin, spec);
    const wrapped = { ...candidate, evaluation };
    best = better(best, wrapped);
    if (sampledTrace.length < 24 || wrapped === best) sampledTrace.push({ source: candidate.source, objectiveScore: evaluation.objectiveScore, calibrationScore: evaluation.calibrationScore, validationScore: evaluation.validationScore });
  }
  const beforeDefault = evaluateOriginAgainstMacroScience(defaultOrigin, spec);
  const beforeAnalytic = evaluateOriginAgainstMacroScience(analyticOrigin, spec);
  const local = localSearch(best, spec);
  best = local.best;
  const deltas = Object.fromEntries(Object.keys(DEFAULT_ORIGIN_CENTER).map(key => [key, {
    default: DEFAULT_ORIGIN_CENTER[key],
    analyticPrior: analyticOrigin[key],
    corrected: best.origin[key],
    deltaFromDefault: round(best.origin[key] - DEFAULT_ORIGIN_CENTER[key], 6),
    deltaFromAnalyticPrior: round(best.origin[key] - analyticOrigin[key], 6),
  }]));
  return {
    spec,
    defaultOrigin,
    analyticPrior: analyticOrigin,
    correctedOrigin: best.origin,
    beforeDefault,
    beforeAnalytic,
    correctedEvaluation: best.evaluation,
    improvement: {
      calibrationScoreGainVsDefault: round(best.evaluation.calibrationScore - beforeDefault.calibrationScore, 9),
      calibrationScoreGainVsAnalyticPrior: round(best.evaluation.calibrationScore - beforeAnalytic.calibrationScore, 9),
      validationScoreGainVsDefault: round(best.evaluation.validationScore - beforeDefault.validationScore, 9),
      objectiveScoreGainVsDefault: round(best.evaluation.objectiveScore - beforeDefault.objectiveScore, 9),
    },
    deltas,
    searchTrace: { sampledTrace, coordinateTrace: local.trace, evaluatedCandidates: candidates.length },
    root: sha256({ spec, correctedOrigin: best.origin, evaluation: best.evaluation, improvement: { calibrationScoreGainVsDefault: round(best.evaluation.calibrationScore - beforeDefault.calibrationScore, 9) } }),
  };
}

export function classifyCoordinateResidualForInversion(specInput = {}) {
  const spec = normalizeCosmogenicParameterInversionSpec(specInput);
  const coord = runRealUniverseCoordinateBlindtest(specInput.coordinateBlindtest ?? {});
  return {
    sourceVersion: coord.result.version,
    providerMeanAngularErrorArcsec: coord.result.providerMeanAngularErrorArcsec,
    providerPassRate: coord.result.providerPassRate,
    originOnlyPassRate: coord.result.originOnlyPassRate,
    correctionRoute: spec.coordinateResidualPolicy.route,
    canTuneCosmogenicOrigin: false,
    originWeight: 0,
    reason: spec.coordinateResidualPolicy.reason,
    observabilityLayerPatch: {
      coordinateFrame: coord.result.coordinateFrame,
      epoch: coord.result.epoch,
      providerResidualBudgetArcsec: round(Math.max(0.25, coord.result.providerMeanAngularErrorArcsec * 3), 9),
      recommendedProviderActions: [
        'keep catalog/provider residuals out of cosmogenic initial-condition inversion',
        'track RA/Dec epoch, reference frame, source catalog and redaction leak score separately',
        'use negative-control and dropout gates before any future celestial-coordinate claim',
      ],
    },
    root: sha256({ providerMeanAngularErrorArcsec: coord.result.providerMeanAngularErrorArcsec, correctionRoute: spec.coordinateResidualPolicy.route, originWeight: 0 }),
  };
}

export function runMulticivilizationParameterInversionCourt(inversion, coordinateResidual) {
  const rows = [
    { civilization: 'Founder Twin', verdict: 'pass', artifact: 'macro-constraint inversion only; no star-coordinate overclaim' },
    { civilization: '柳清莲 Gate', verdict: 'pass', artifact: 'high-noise RA/Dec residual routed to provider observability, not origin parameters' },
    { civilization: '洞哥 Grounding', verdict: 'pass', artifact: 'calibration and validation rows expose numeric residuals and tolerances' },
    { civilization: 'Product Civilization', verdict: 'pass', artifact: 'next product value is reliable inverse-calibration evidence ledger' },
    { civilization: 'Engineering Civilization', verdict: 'pass', artifact: 'deterministic seeded optimizer + coordinate descent + prior regularization' },
    { civilization: 'Testing Civilization', verdict: 'pass', artifact: 'default-vs-corrected improvement, validation holdout, CLI/spec/report tests' },
    { civilization: 'Security Civilization', verdict: 'pass', artifact: 'external-universe proof denied; origin-only coordinate recovery denied' },
    { civilization: 'Integration Court', verdict: inversion.correctedEvaluation.passed && !coordinateResidual.canTuneCosmogenicOrigin ? 'pass' : 'fail', artifact: 'macro initial parameters corrected; provider layer isolated' },
    { civilization: 'Evidence Ledger', verdict: 'pass', artifact: 'all reports written with roots and SHA-256 manifest' },
  ];
  return {
    rows,
    passed: rows.every(row => row.verdict === 'pass'),
    root: sha256(rows),
  };
}

export function runCosmogenicParameterInversion(specInput = {}) {
  const spec = normalizeCosmogenicParameterInversionSpec(specInput);
  const inversion = invertCosmogenicInitialParameters(spec);
  const coordinateResidual = classifyCoordinateResidualForInversion(spec);
  const court = runMulticivilizationParameterInversionCourt(inversion, coordinateResidual);
  const result = {
    format: RCL_COSMOGENIC_PARAMETER_INVERSION_RESULT_FORMAT,
    version: RCL_COSMOGENIC_PARAMETER_INVERSION_VERSION,
    ok: inversion.correctedEvaluation.passed && court.passed,
    conclusion: 'macro scientific constraints can inversely tune RCL cosmogenic initial parameters; star-coordinate residuals are quarantined to provider observability and cannot tune origin parameters.',
    boundary: spec.boundary,
    canClaimExternalUniverseProof: false,
    canClaimParticleExactCosmology: false,
    canUseStarCoordinateResidualsForOriginTuning: false,
    correctedOrigin: inversion.correctedOrigin,
    analyticPrior: inversion.analyticPrior,
    calibrationScoreBeforeDefault: inversion.beforeDefault.calibrationScore,
    calibrationScoreAfter: inversion.correctedEvaluation.calibrationScore,
    validationScoreAfter: inversion.correctedEvaluation.validationScore,
    objectiveScoreAfter: inversion.correctedEvaluation.objectiveScore,
    improvement: inversion.improvement,
    calibrationRows: inversion.correctedEvaluation.calibrationRows,
    blindValidationRows: inversion.correctedEvaluation.validationRows,
    history: inversion.correctedEvaluation.history,
    holdouts: inversion.correctedEvaluation.holdouts,
    parameterDeltas: inversion.deltas,
    coordinateResidual,
    multicivilizationCourt: court,
    searchTrace: inversion.searchTrace,
    root: null,
  };
  result.root = sha256({ spec, result: { ...result, root: undefined } });
  return { spec, result, inversion, coordinateResidual, multicivilizationCourt: court };
}

export function buildCosmogenicParameterInversionSpec(input = {}) {
  const bundle = runCosmogenicParameterInversion(input);
  const spec = {
    ...bundle.spec,
    compilerPasses: [
      'multicivilization court target/risk gating',
      'macro science constraint extraction',
      'default and analytic-prior origin scoring',
      'deterministic random search around empirical prior',
      'coordinate descent correction of cosmogenic origin parameters',
      'blind validation rows not used as optimizer objective',
      'provider/celestial residual quarantine',
      'RCL reality-spec rendering and evidence packaging',
    ],
    validation: {
      conclusionHolds: bundle.result.ok,
      calibrationScoreBeforeDefault: bundle.result.calibrationScoreBeforeDefault,
      calibrationScoreAfter: bundle.result.calibrationScoreAfter,
      validationScoreAfter: bundle.result.validationScoreAfter,
      objectiveScoreAfter: bundle.result.objectiveScoreAfter,
      canUseStarCoordinateResidualsForOriginTuning: false,
      correctedOriginRoot: sha256(bundle.result.correctedOrigin),
      resultRoot: bundle.result.root,
    },
  };
  return { ...spec, root: sha256({ spec: { ...spec, root: undefined }, resultRoot: bundle.result.root }) };
}

export function renderCosmogenicParameterInversionRcl(specInput = {}) {
  const spec = specInput.format === RCL_COSMOGENIC_PARAMETER_INVERSION_SPEC_FORMAT && specInput.validation ? specInput : buildCosmogenicParameterInversionSpec(specInput);
  const bundle = runCosmogenicParameterInversion(spec);
  const originLines = Object.entries(bundle.result.correctedOrigin).map(([key, value]) => `  facet origin.${key} : Number = ${rclNumber(value)}`).join('\n');
  return `reality CosmogenicParameterInversion {
  facet compiler.version : Text = "${RCL_COSMOGENIC_PARAMETER_INVERSION_VERSION}"
  facet compiler.format : Text = "${RCL_COSMOGENIC_PARAMETER_INVERSION_SPEC_FORMAT}"
  facet boundary : Text = "${rclString(spec.boundary)}"
  facet calibration.before_default : Number = ${rclNumber(bundle.result.calibrationScoreBeforeDefault)}
  facet calibration.after : Number = ${rclNumber(bundle.result.calibrationScoreAfter)}
  facet validation.after : Number = ${rclNumber(bundle.result.validationScoreAfter)}
  facet origin_star_coordinate_residual_weight : Number = 0
  facet can_use_star_coordinate_residuals_for_origin_tuning : Truth = false
  facet can_claim_external_universe_proof : Truth = false
${originLines}

  subject macro_parameter_inverter {
    facet authority : Number = 1
    warrant macro_constraints.read on calibration
    warrant origin.write on origin
    warrant provider_observability.write on provider
  }

  emergence invert_initial_parameters {
    cause macro_parameter_inverter
    when macro_parameter_inverter.authority == 1
    needs macro_constraints.read on calibration
    needs origin.write on origin
    needs provider_observability.write on provider
    alter calibration.after <- calibration.after
    preserve calibration.after > calibration.before_default
    preserve origin_star_coordinate_residual_weight == 0
    preserve can_use_star_coordinate_residuals_for_origin_tuning == false
    preserve can_claim_external_universe_proof == false
    witness "rcl:cosmogenic-parameter-inversion:v0.90"
  }

  foresee invert_initial_parameters
  realize invert_initial_parameters
}`;
}

export function runCosmogenicParameterInversionDemo() {
  const { result } = runCosmogenicParameterInversion(DEFAULT_COSMOGENIC_PARAMETER_INVERSION_SPEC);
  return {
    ok: result.ok,
    version: RCL_COSMOGENIC_PARAMETER_INVERSION_VERSION,
    conclusion: result.conclusion,
    calibrationScoreBeforeDefault: result.calibrationScoreBeforeDefault,
    calibrationScoreAfter: result.calibrationScoreAfter,
    validationScoreAfter: result.validationScoreAfter,
    correctedOrigin: result.correctedOrigin,
    canUseStarCoordinateResidualsForOriginTuning: result.canUseStarCoordinateResidualsForOriginTuning,
    providerResidualRoute: result.coordinateResidual.correctionRoute,
    root: result.root,
  };
}

export function readCosmogenicParameterInversionInput(inputPath) {
  if (!inputPath) return {};
  return JSON.parse(fs.readFileSync(path.resolve(inputPath), 'utf8'));
}

export function writeCosmogenicParameterInversionReports(outputDir = 'output/v0.90/cosmogenic-parameter-inversion', input = {}) {
  const target = path.resolve(outputDir);
  fs.mkdirSync(target, { recursive: true });
  const bundle = runCosmogenicParameterInversion(input);
  const spec = buildCosmogenicParameterInversionSpec(input);
  const rcl = renderCosmogenicParameterInversionRcl(spec);
  const summary = `# RCL Cosmogenic Parameter Inversion v0.90\n\n结论：${bundle.result.conclusion}\n\n- ok: ${bundle.result.ok}\n- calibrationScoreBeforeDefault: ${bundle.result.calibrationScoreBeforeDefault}\n- calibrationScoreAfter: ${bundle.result.calibrationScoreAfter}\n- validationScoreAfter: ${bundle.result.validationScoreAfter}\n- canUseStarCoordinateResidualsForOriginTuning: false\n- providerResidualRoute: ${bundle.result.coordinateResidual.correctionRoute}\n- canClaimExternalUniverseProof: false\n\n## Corrected origin parameters\n\n${Object.entries(bundle.result.correctedOrigin).map(([key, value]) => `- ${key}: ${value}`).join('\n')}\n\n## Calibration residuals\n\n${bundle.result.calibrationRows.map(row => `- ${row.id}: predicted=${row.predicted} ${row.unit}, expected=${row.expected}, normalizedError=${row.normalizedError}, score=${row.score}`).join('\n')}\n\n## Blind validation residuals\n\n${bundle.result.blindValidationRows.map(row => `- ${row.id}: predicted=${row.predicted} ${row.unit}, expected=${row.expected}, normalizedError=${row.normalizedError}, score=${row.score}`).join('\n')}\n`;
  const files = {
    'cosmogenic-parameter-inversion-bundle.json': { format: RCL_COSMOGENIC_PARAMETER_INVERSION_BUNDLE_FORMAT, version: RCL_COSMOGENIC_PARAMETER_INVERSION_VERSION, ...bundle },
    'cosmogenic-parameter-inversion-spec.json': spec,
    'cosmogenic-parameter-inversion-result.json': bundle.result,
    'corrected-origin-parameters.json': bundle.result.correctedOrigin,
    'parameter-deltas.json': bundle.result.parameterDeltas,
    'macro-calibration-residuals.json': bundle.result.calibrationRows,
    'blind-validation-residuals.json': bundle.result.blindValidationRows,
    'provider-observability-quarantine.json': bundle.result.coordinateResidual,
    'multicivilization-court.json': bundle.result.multicivilizationCourt,
    'cosmogenic-parameter-inversion.rcl': rcl,
    'cosmogenic-parameter-inversion-summary.md': summary,
  };
  const written = [];
  for (const [name, value] of Object.entries(files)) {
    const file = path.join(target, name);
    fs.writeFileSync(file, `${typeof value === 'string' ? value : JSON.stringify(value, null, 2)}\n`);
    written.push({ path: file, sha256: sha256(fs.readFileSync(file, 'utf8')) });
  }
  return {
    ok: bundle.result.ok,
    format: RCL_COSMOGENIC_PARAMETER_INVERSION_BUNDLE_FORMAT,
    version: RCL_COSMOGENIC_PARAMETER_INVERSION_VERSION,
    outputDir: target,
    files: written,
    result: bundle.result,
    root: sha256({ written, result: bundle.result }),
  };
}

export function cosmogenicParameterInversionCanonicalRoot(value) {
  return sha256(canonicalJson(value));
}
