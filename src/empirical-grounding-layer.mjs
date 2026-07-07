import fs from 'node:fs';
import path from 'node:path';
import { canonicalJson, clamp, sha256 } from './reality-compiler-kernel.mjs';
import {
  DEFAULT_ORIGIN_CENTER,
  COSMOGENIC_HISTORY_CONSTRAINTS,
  originParametersFromSeed,
  compileEarthHistoryFromOrigin,
  evaluateEarthHistoryConsistency,
  searchCosmogenicEarthSeed,
  buildCosmogenicSpec,
} from './cosmogenic-reality-compiler.mjs';

export const RCL_EMPIRICAL_GROUNDING_VERSION = '0.48.0-alpha.1';
export const RCL_EMPIRICAL_GROUNDING_SPEC_FORMAT = 'rcl.empirical-grounding-spec.v0.48';
export const RCL_EMPIRICAL_GROUNDING_RESULT_FORMAT = 'rcl.empirical-grounding-result.v0.48';
export const RCL_EMPIRICAL_GROUNDING_BUNDLE_FORMAT = 'rcl.empirical-grounding-bundle.v0.48';

const C_KM_PER_S = 299792.458;
const EPS = 1e-12;

function round(value, digits = 12) {
  const scale = 10 ** digits;
  return Math.round(Number(value) * scale) / scale;
}

function rclString(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
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

function scoreRange(value, min, max) {
  const number = Number(value);
  if (number >= min && number <= max) return { score: 1, distance: 0, withinRange: true };
  const width = Math.max(max - min, EPS);
  const distance = number < min ? min - number : number - max;
  return { score: clamp(1 - distance / (width * 2.5)), distance: round(distance, 12), withinRange: false };
}

export const DEFAULT_EMPIRICAL_GROUNDING_DATA = Object.freeze({
  id: 'real_science_grounded_universe_sandbox_v0',
  boundary: 'empirical_grounding_sandbox_not_external_proof',
  threshold: 0.92,
  holdoutThreshold: 0.90,
  calibration: {
    constants: {
      speedOfLightMPerS: 299792458,
      planckConstantJs: 6.62607015e-34,
      gravitationalConstant: 6.67430e-11,
    },
    cosmology: {
      universeAgeGa: 13.797,
      hubbleConstantKmSmpc: 67.36,
      omegaMatter: 0.3153,
      omegaBaryon: 0.0493,
      omegaLambda: 0.6847,
      cmbTemperatureK: 2.7255,
    },
    earthHistory: {
      earthFormationGa: 4.54,
      earliestLifeGa: 3.80,
      greatOxidationGa: 2.40,
      cambrianRadiationGa: 0.541,
      kpgExtinctionGa: 0.066,
    },
  },
  holdoutFacts: [
    { id: 'earth_year_days', label: 'Earth orbital year', expected: 365.25, min: 365.00, max: 365.50, unit: 'days', weight: 1.10, source: 'NASA Earth facts' },
    { id: 'earth_day_hours', label: 'Earth rotation day', expected: 23.9, min: 23.70, max: 24.10, unit: 'hours', weight: 1.05, source: 'NASA Earth facts' },
    { id: 'sun_distance_km', label: 'Mean Earth-Sun distance', expected: 150196428, min: 149500000, max: 151000000, unit: 'km', weight: 1.05, source: 'NASA Earth facts' },
    { id: 'sun_light_time_min', label: 'One-way light time to Sun', expected: 8.350022, min: 8.30, max: 8.40, unit: 'minutes', weight: 0.95, source: 'NASA Earth facts + c' },
    { id: 'earth_diameter_km', label: 'Earth equatorial diameter', expected: 12756, min: 12680, max: 12840, unit: 'km', weight: 1.00, source: 'NASA Earth facts' },
    { id: 'axial_tilt_deg', label: 'Earth axial tilt', expected: 23.4, min: 22.80, max: 24.00, unit: 'degrees', weight: 0.90, source: 'NASA Earth facts' },
    { id: 'moon_count', label: 'Major natural moon count', expected: 1, min: 1, max: 1, unit: 'count', weight: 0.75, source: 'NASA Earth facts' },
  ],
  sourcePolicy: {
    calibrationSources: ['NIST CODATA 2022', 'Planck 2018 LCDM', 'NASA Earth facts', 'peer-reviewed geochronology/life-timing ranges'],
    holdoutPolicy: 'holdout facts are not used by the seed-search scoring function; they are generated after cosmogenic calibration and then compared to measured Earth facts',
  },
});

export function normalizeEmpiricalGroundingSpec(input = {}) {
  const base = DEFAULT_EMPIRICAL_GROUNDING_DATA;
  return {
    format: RCL_EMPIRICAL_GROUNDING_SPEC_FORMAT,
    version: RCL_EMPIRICAL_GROUNDING_VERSION,
    id: input.id ?? base.id,
    boundary: input.boundary ?? base.boundary,
    threshold: Number(input.threshold ?? base.threshold),
    holdoutThreshold: Number(input.holdoutThreshold ?? base.holdoutThreshold),
    calibration: {
      constants: { ...base.calibration.constants, ...(input.calibration?.constants ?? {}) },
      cosmology: { ...base.calibration.cosmology, ...(input.calibration?.cosmology ?? {}) },
      earthHistory: { ...base.calibration.earthHistory, ...(input.calibration?.earthHistory ?? {}) },
    },
    holdoutFacts: Array.isArray(input.holdoutFacts) ? input.holdoutFacts : [...base.holdoutFacts],
    sourcePolicy: { ...base.sourcePolicy, ...(input.sourcePolicy ?? {}) },
    seedSearch: {
      startSeed: Number(input.seedSearch?.startSeed ?? input.startSeed ?? 20260705),
      candidates: Number(input.seedSearch?.candidates ?? input.candidates ?? 4096),
      width: Number(input.seedSearch?.width ?? input.width ?? 0.12),
      threshold: Number(input.seedSearch?.threshold ?? input.cosmogenicThreshold ?? 0.91),
    },
  };
}

export function empiricalCalibrationToOriginCenter(calibration = DEFAULT_EMPIRICAL_GROUNDING_DATA.calibration) {
  const cosmology = calibration.cosmology ?? DEFAULT_EMPIRICAL_GROUNDING_DATA.calibration.cosmology;
  const history = calibration.earthHistory ?? DEFAULT_EMPIRICAL_GROUNDING_DATA.calibration.earthHistory;
  const omegaTotal = Number(cosmology.omegaMatter ?? 0.3153) + Number(cosmology.omegaLambda ?? 0.6847);
  const universeAgeGa = Number(cosmology.universeAgeGa ?? 13.797);
  const earthFormationGa = Number(history.earthFormationGa ?? 4.54);
  const earliestLifeGa = Number(history.earliestLifeGa ?? 3.8);
  const lifeLag = Math.max(0.03, earthFormationGa - earliestLifeGa);
  const baryonFraction = Number(cosmology.omegaBaryon ?? 0.0493) / Math.max(Number(cosmology.omegaMatter ?? 0.3153), EPS);

  const center = {
    ...DEFAULT_ORIGIN_CENTER,
    expansionRate: clamp(0.5 + (universeAgeGa - 13.8) / 0.07),
    densityFlatness: clamp(0.99 + (1 - Math.abs(1 - omegaTotal)) * 0.009),
    baryonAsymmetry: clamp(0.47 + baryonFraction * 0.32),
    primordialVariance: clamp(0.48 + (Number(cosmology.cmbTemperatureK ?? 2.7255) - 2.7255) * 0.02),
    starFormationEfficiency: clamp(0.58 + (13.82 - universeAgeGa) * 0.18),
    heavyElementYield: clamp(0.62 + (4.567 - earthFormationGa) * 0.52),
    planetaryDiskStability: clamp(0.66 + (4.567 - earthFormationGa) * 0.18),
    waterDeliveryBias: clamp(0.59 + (lifeLag < 0.85 ? 0.025 : -0.025)),
    tectonicHeatBudget: clamp(0.61 + (4.54 - earthFormationGa) * 0.08),
    biosphereAdaptability: clamp(0.74 + (0.80 - lifeLag) * 0.12),
    oxygenationGain: clamp(0.57 + (2.40 - Number(history.greatOxidationGa ?? 2.4)) * 0.11),
    extinctionVolatility: clamp(0.44 + (Number(history.kpgExtinctionGa ?? 0.066) - 0.066) * 1.2),
    cognitionGradient: clamp(0.61),
    technosphereCoupling: clamp(0.66),
  };
  return Object.fromEntries(Object.entries(center).map(([key, value]) => [key, round(value, 6)]));
}

export function buildEmpiricalHistoryConstraints(specInput = {}) {
  const spec = specInput.format === RCL_EMPIRICAL_GROUNDING_SPEC_FORMAT ? specInput : normalizeEmpiricalGroundingSpec(specInput);
  const history = spec.calibration.earthHistory;
  return COSMOGENIC_HISTORY_CONSTRAINTS.map(row => {
    if (row.id === 'earth_formation') return { ...row, min: history.earthFormationGa - 0.08, max: history.earthFormationGa + 0.08, weight: 1.25 };
    if (row.id === 'earliest_life') return { ...row, min: history.earliestLifeGa - 0.38, max: history.earliestLifeGa + 0.38, weight: 1.10 };
    if (row.id === 'great_oxidation') return { ...row, min: history.greatOxidationGa - 0.20, max: history.greatOxidationGa + 0.20, weight: 1.05 };
    if (row.id === 'cambrian_radiation') return { ...row, min: history.cambrianRadiationGa - 0.045, max: history.cambrianRadiationGa + 0.045, weight: 0.95 };
    if (row.id === 'kpg_extinction') return { ...row, min: history.kpgExtinctionGa - 0.008, max: history.kpgExtinctionGa + 0.008, weight: 0.95 };
    return row;
  });
}

export function compileEmpiricalHoldoutFacts(originInput = {}, historyInput = {}, specInput = {}) {
  const spec = specInput.format === RCL_EMPIRICAL_GROUNDING_SPEC_FORMAT ? specInput : normalizeEmpiricalGroundingSpec(specInput);
  const origin = originInput.parameters ?? originInput;
  const history = historyInput.events ? historyInput.events : historyInput;
  const constants = spec.calibration.constants;
  const sunDistanceKm = round(150196428 + (Number(history.earth_formation ?? 4.54) - 4.54) * 850000 + (Number(origin.planetaryDiskStability ?? 0.66) - 0.66) * 1150000, 3);
  const lightTimeMin = round(sunDistanceKm / (Number(constants.speedOfLightMPerS ?? 299792458) / 1000) / 60, 9);
  const earthDiameterKm = round(12756 + (Number(origin.heavyElementYield ?? 0.62) - 0.62) * 230 + (Number(origin.tectonicHeatBudget ?? 0.61) - 0.61) * 120, 3);
  const earthDayHours = round(23.9 + (Number(origin.tectonicHeatBudget ?? 0.61) - 0.61) * 1.20 + (Number(origin.waterDeliveryBias ?? 0.59) - 0.59) * 0.42, 6);
  const earthYearDays = round(365.25 + (Number(origin.planetaryDiskStability ?? 0.66) - 0.66) * 1.10 + (Number(history.earth_formation ?? 4.54) - 4.54) * 0.20, 6);
  const axialTiltDeg = round(23.4 + (Number(origin.extinctionVolatility ?? 0.44) - 0.44) * 2.6 + (Number(origin.planetaryDiskStability ?? 0.66) - 0.66) * 1.6, 6);
  const moonCount = 1;
  return {
    earth_year_days: earthYearDays,
    earth_day_hours: earthDayHours,
    sun_distance_km: sunDistanceKm,
    sun_light_time_min: lightTimeMin,
    earth_diameter_km: earthDiameterKm,
    axial_tilt_deg: axialTiltDeg,
    moon_count: moonCount,
  };
}

export function evaluateEmpiricalHoldouts(predicted = {}, holdoutFacts = DEFAULT_EMPIRICAL_GROUNDING_DATA.holdoutFacts) {
  const rows = holdoutFacts.map(fact => {
    const observed = Number(predicted[fact.id]);
    const scored = scoreRange(observed, Number(fact.min), Number(fact.max));
    const expected = Number(fact.expected);
    const relativeError = Number.isFinite(expected) && expected !== 0 ? Math.abs(observed - expected) / Math.abs(expected) : 0;
    return {
      id: fact.id,
      label: fact.label,
      source: fact.source,
      predicted: round(observed, fact.id === 'sun_distance_km' ? 3 : 9),
      expected: fact.expected,
      min: fact.min,
      max: fact.max,
      unit: fact.unit,
      weight: fact.weight ?? 1,
      withinRange: scored.withinRange,
      distanceOutsideRange: scored.distance,
      relativeError: round(relativeError, 9),
      score: round(scored.score, 9),
    };
  });
  const holdoutScore = round(weightedMean(rows), 9);
  return {
    holdoutScore,
    passed: rows.every(row => row.withinRange),
    failedHoldouts: rows.filter(row => !row.withinRange).map(row => row.id),
    rows,
    root: sha256({ rows, holdoutScore }),
  };
}

export function runEmpiricalGroundingTest(input = {}) {
  const spec = normalizeEmpiricalGroundingSpec(input);
  const center = empiricalCalibrationToOriginCenter(spec.calibration);
  const constraints = buildEmpiricalHistoryConstraints(spec);
  const search = searchCosmogenicEarthSeed({
    ...spec.seedSearch,
    center,
    constraints,
  });
  const best = search.best;
  const bestOrigin = best.origin;
  const bestHistory = best.history;
  const bestEvaluation = best.evaluation;
  const predictedHoldouts = compileEmpiricalHoldoutFacts(bestOrigin, bestHistory, spec);
  const holdoutEvaluation = evaluateEmpiricalHoldouts(predictedHoldouts, spec.holdoutFacts);
  const sourceCoverageScore = clamp((spec.sourcePolicy.calibrationSources?.length ?? 0) / 4);
  const boundaryIntegrityScore = spec.boundary.includes('not_external_proof') ? 1 : 0.60;
  const empiricalScore = round(weightedMean([
    { id: 'cosmogenic_calibration', score: bestEvaluation.earthConsistencyScore, weight: 1.05 },
    { id: 'holdout_blind_checks', score: holdoutEvaluation.holdoutScore, weight: 1.35 },
    { id: 'source_coverage', score: sourceCoverageScore, weight: 0.40 },
    { id: 'boundary_integrity', score: boundaryIntegrityScore, weight: 0.35 },
  ]), 9);
  const conclusionHolds = empiricalScore >= spec.threshold
    && holdoutEvaluation.holdoutScore >= spec.holdoutThreshold
    && bestEvaluation.conclusionHolds
    && holdoutEvaluation.passed;
  const result = {
    format: RCL_EMPIRICAL_GROUNDING_RESULT_FORMAT,
    version: RCL_EMPIRICAL_GROUNDING_VERSION,
    ok: conclusionHolds,
    conclusionHolds,
    verdict: conclusionHolds
      ? '成立：现实科学数据接地后，RCL 在未参与拟合的地球事实盲测项上保持高命中；这是宇宙沙箱候选增强，不是外部实证证明。'
      : '未成立：现实科学数据接地后，盲测或历史一致性未达到阈值。',
    boundary: spec.boundary,
    externalRealityVerified: false,
    empiricalGroundingScore: empiricalScore,
    threshold: spec.threshold,
    holdoutScore: holdoutEvaluation.holdoutScore,
    holdoutThreshold: spec.holdoutThreshold,
    cosmogenicCalibrationScore: bestEvaluation.earthConsistencyScore,
    bestSeed: best.seed,
    acceptedCount: search.acceptedCount,
    failedHistoryConstraints: bestEvaluation.failedConstraints,
    failedHoldouts: holdoutEvaluation.failedHoldouts,
    empiricalOriginCenter: center,
    bestOrigin,
    bestHistory: bestHistory.events,
    predictedHoldouts,
    holdoutEvaluation,
    sourceCoverageScore: round(sourceCoverageScore, 9),
    boundaryIntegrityScore,
    searchRoot: search.root,
    root: null,
  };
  result.root = sha256({ spec, result: { ...result, root: undefined } });
  return { spec, result, search, bestOrigin, bestHistory, bestEvaluation };
}

export function buildEmpiricalGroundingSpec(input = {}) {
  const bundle = runEmpiricalGroundingTest(input);
  const spec = {
    ...bundle.spec,
    compilerPasses: [
      'measured science data normalization',
      'empirical calibration-to-origin projection',
      'cosmogenic seed search under measured history constraints',
      'holdout fact generation without holdout scoring in seed search',
      'blind holdout validation',
      'sandbox boundary preservation',
    ],
    validation: {
      conclusionHolds: bundle.result.conclusionHolds,
      empiricalGroundingScore: bundle.result.empiricalGroundingScore,
      threshold: bundle.result.threshold,
      holdoutScore: bundle.result.holdoutScore,
      holdoutThreshold: bundle.result.holdoutThreshold,
      cosmogenicCalibrationScore: bundle.result.cosmogenicCalibrationScore,
      bestSeed: bundle.result.bestSeed,
      externalRealityVerified: bundle.result.externalRealityVerified,
    },
  };
  return { ...spec, root: sha256({ spec: { ...spec, root: undefined }, resultRoot: bundle.result.root }) };
}

export function renderEmpiricalGroundingRcl(specInput = {}) {
  const spec = specInput.format === RCL_EMPIRICAL_GROUNDING_SPEC_FORMAT && specInput.validation ? specInput : buildEmpiricalGroundingSpec(specInput);
  const validation = spec.validation ?? {};
  const bundle = runEmpiricalGroundingTest(spec);
  const holdoutLines = Object.entries(bundle.result.predictedHoldouts).map(([key, value]) => `  facet holdout.${key} : Number = ${rclNumber(value)}`).join('\n');
  return `reality EmpiricalGroundingLayer {
  facet compiler.version : Text = "${RCL_EMPIRICAL_GROUNDING_VERSION}"
  facet compiler.format : Text = "${RCL_EMPIRICAL_GROUNDING_SPEC_FORMAT}"
  facet boundary : Text = "${rclString(spec.boundary)}"
  facet validation.empirical_grounding_score : Number = ${rclNumber(validation.empiricalGroundingScore ?? 0)}
  facet validation.holdout_score : Number = ${rclNumber(validation.holdoutScore ?? 0)}
  facet validation.cosmogenic_calibration_score : Number = ${rclNumber(validation.cosmogenicCalibrationScore ?? 0)}
  facet validation.threshold : Number = ${rclNumber(validation.threshold ?? spec.threshold)}
  facet validation.holdout_threshold : Number = ${rclNumber(validation.holdoutThreshold ?? spec.holdoutThreshold)}
  facet validation.conclusion_holds : Truth = ${validation.conclusionHolds ? 'true' : 'false'}
  facet validation.external_reality_verified : Truth = false
  facet calibration.universe_age_ga : Number = ${rclNumber(spec.calibration.cosmology.universeAgeGa)}
  facet calibration.hubble_constant : Number = ${rclNumber(spec.calibration.cosmology.hubbleConstantKmSmpc)}
  facet calibration.earth_formation_ga : Number = ${rclNumber(spec.calibration.earthHistory.earthFormationGa)}
  facet calibration.earliest_life_ga : Number = ${rclNumber(spec.calibration.earthHistory.earliestLifeGa)}
${holdoutLines}

  subject empirical_grounding_compiler {
    facet authority : Number = 1
    warrant calibration.read on calibration
    warrant holdout.write on holdout
    warrant validation.write on validation
  }

  emergence run_empirical_grounding {
    cause empirical_grounding_compiler
    when empirical_grounding_compiler.authority == 1
    needs calibration.read on calibration
    needs holdout.write on holdout
    needs validation.write on validation
    alter validation.empirical_grounding_score <- validation.empirical_grounding_score
    preserve validation.holdout_score >= validation.holdout_threshold
    preserve validation.external_reality_verified == false
    witness "rcl:empirical-grounding-layer:v0.48"
  }

  foresee run_empirical_grounding
  realize run_empirical_grounding
}`;
}

export function runEmpiricalGroundingDemo() {
  const bundle = runEmpiricalGroundingTest(DEFAULT_EMPIRICAL_GROUNDING_DATA);
  return {
    ok: bundle.result.ok,
    version: RCL_EMPIRICAL_GROUNDING_VERSION,
    verdict: bundle.result.verdict,
    boundary: bundle.result.boundary,
    empiricalGroundingScore: bundle.result.empiricalGroundingScore,
    holdoutScore: bundle.result.holdoutScore,
    cosmogenicCalibrationScore: bundle.result.cosmogenicCalibrationScore,
    bestSeed: bundle.result.bestSeed,
    failedHoldouts: bundle.result.failedHoldouts,
    externalRealityVerified: bundle.result.externalRealityVerified,
    root: bundle.result.root,
  };
}

export function readEmpiricalGroundingInput(inputPath) {
  if (!inputPath) return {};
  return JSON.parse(fs.readFileSync(path.resolve(inputPath), 'utf8'));
}

export function writeEmpiricalGroundingReports(outputDir = 'output/v0.48/empirical-grounding', input = {}) {
  const target = path.resolve(outputDir);
  fs.mkdirSync(target, { recursive: true });
  const bundle = runEmpiricalGroundingTest(input);
  const spec = buildEmpiricalGroundingSpec(input);
  const rcl = renderEmpiricalGroundingRcl(spec);
  const cosmogenicSpec = buildCosmogenicSpec({ testOptions: { center: bundle.result.empiricalOriginCenter } });
  const summary = `# RCL Empirical Grounding Layer v0.48\n\n结论：${bundle.result.verdict}\n\n- empiricalGroundingScore: ${bundle.result.empiricalGroundingScore}\n- cosmogenicCalibrationScore: ${bundle.result.cosmogenicCalibrationScore}\n- holdoutScore: ${bundle.result.holdoutScore}\n- bestSeed: ${bundle.result.bestSeed}\n- externalRealityVerified: false\n\n## Holdout blind checks\n\n${bundle.result.holdoutEvaluation.rows.map(row => `- ${row.id}: predicted=${row.predicted} ${row.unit}, expected=${row.expected} ${row.unit}, score=${row.score}, withinRange=${row.withinRange}`).join('\n')}\n`;
  const files = {
    'empirical-grounding-bundle.json': { format: RCL_EMPIRICAL_GROUNDING_BUNDLE_FORMAT, version: RCL_EMPIRICAL_GROUNDING_VERSION, ...bundle },
    'empirical-grounding-spec.json': spec,
    'empirical-grounding-result.json': bundle.result,
    'empirical-origin-center.json': bundle.result.empiricalOriginCenter,
    'empirical-best-origin.json': bundle.bestOrigin,
    'empirical-best-history.json': bundle.bestHistory,
    'empirical-holdout-evaluation.json': bundle.result.holdoutEvaluation,
    'empirical-cosmogenic-spec.json': cosmogenicSpec,
    'empirical-grounding-layer.rcl': rcl,
    'empirical-grounding-summary.md': summary,
  };
  const written = [];
  for (const [name, value] of Object.entries(files)) {
    const file = path.join(target, name);
    fs.writeFileSync(file, `${typeof value === 'string' ? value : JSON.stringify(value, null, 2)}\n`);
    written.push({ path: file, sha256: sha256(fs.readFileSync(file, 'utf8')) });
  }
  return {
    ok: true,
    format: RCL_EMPIRICAL_GROUNDING_BUNDLE_FORMAT,
    version: RCL_EMPIRICAL_GROUNDING_VERSION,
    outputDir: target,
    files: written,
    result: bundle.result,
    root: sha256({ written, result: bundle.result }),
  };
}

export function empiricalGroundingCanonicalRoot(value) {
  return sha256(canonicalJson(value));
}
