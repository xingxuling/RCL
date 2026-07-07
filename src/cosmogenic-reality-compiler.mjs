import fs from 'node:fs';
import path from 'node:path';
import { canonicalJson, clamp, createSeededRandom, sha256 } from './reality-compiler-kernel.mjs';

export const RCL_COSMOGENIC_COMPILER_VERSION = '0.45.0-alpha.1';
export const RCL_COSMOGENIC_SPEC_FORMAT = 'rcl.cosmogenic-reality-spec.v0.45';
export const RCL_COSMOGENIC_ORIGIN_FORMAT = 'rcl.cosmogenic-origin-parameters.v0.45';
export const RCL_COSMOGENIC_HISTORY_FORMAT = 'rcl.cosmogenic-earth-history.v0.45';
export const RCL_COSMOGENIC_TEST_FORMAT = 'rcl.cosmogenic-earth-consistency-test.v0.45';
export const RCL_COSMOGENIC_BUNDLE_FORMAT = 'rcl.cosmogenic-earth-compiler-bundle.v0.45';

const EPS = 1e-12;

export const DEFAULT_COSMOGENIC_TARGET = Object.freeze({
  id: 'earth_historical_consistency_coarse_v0',
  universeAgeGa: { min: 13.78, max: 13.82 },
  historyAxis: 'age_before_present_ga',
  threshold: 0.91,
  boundary: 'coarse_grained_historical_constraint_sandbox_not_particle_exact_cosmology',
});

export const COSMOGENIC_HISTORY_CONSTRAINTS = Object.freeze([
  Object.freeze({ id: 'universe_age', label: 'Universe age', min: 13.78, max: 13.82, weight: 1.25 }),
  Object.freeze({ id: 'first_stars', label: 'First star era', min: 13.45, max: 13.74, weight: 0.70 }),
  Object.freeze({ id: 'solar_system_formation', label: 'Solar system formation', min: 4.50, max: 4.65, weight: 1.15 }),
  Object.freeze({ id: 'earth_formation', label: 'Earth formation', min: 4.45, max: 4.58, weight: 1.15 }),
  Object.freeze({ id: 'stable_oceans', label: 'Stable liquid-water window', min: 3.80, max: 4.40, weight: 0.90 }),
  Object.freeze({ id: 'earliest_life', label: 'Earliest life window', min: 3.45, max: 4.10, weight: 1.05 }),
  Object.freeze({ id: 'great_oxidation', label: 'Great oxygenation window', min: 2.20, max: 2.60, weight: 1.00 }),
  Object.freeze({ id: 'eukaryotic_complexity', label: 'Eukaryotic complexity window', min: 1.55, max: 2.15, weight: 0.85 }),
  Object.freeze({ id: 'cambrian_radiation', label: 'Cambrian radiation', min: 0.50, max: 0.58, weight: 0.95 }),
  Object.freeze({ id: 'kpg_extinction', label: 'K-Pg extinction', min: 0.055, max: 0.075, weight: 0.90 }),
  Object.freeze({ id: 'homo_sapiens', label: 'Anatomically modern human window', min: 0.00020, max: 0.00035, weight: 0.75 }),
  Object.freeze({ id: 'industrial_technosphere', label: 'Industrial technosphere ignition', min: 0.00000015, max: 0.00000035, weight: 0.55 }),
]);

export const COSMOGENIC_CAUSAL_ORDER = Object.freeze([
  'universe_age',
  'first_stars',
  'solar_system_formation',
  'earth_formation',
  'stable_oceans',
  'earliest_life',
  'great_oxidation',
  'eukaryotic_complexity',
  'cambrian_radiation',
  'kpg_extinction',
  'homo_sapiens',
  'industrial_technosphere',
]);

export const DEFAULT_ORIGIN_CENTER = Object.freeze({
  expansionRate: 0.500,
  densityFlatness: 0.990,
  baryonAsymmetry: 0.520,
  primordialVariance: 0.480,
  starFormationEfficiency: 0.580,
  heavyElementYield: 0.620,
  planetaryDiskStability: 0.660,
  waterDeliveryBias: 0.590,
  tectonicHeatBudget: 0.610,
  biosphereAdaptability: 0.740,
  oxygenationGain: 0.570,
  extinctionVolatility: 0.440,
  cognitionGradient: 0.610,
  technosphereCoupling: 0.660,
});

function round(value, digits = 12) {
  const scale = 10 ** digits;
  return Math.round(Number(value) * scale) / scale;
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

export function normalizeOriginParameters(origin = {}) {
  const normalized = {};
  for (const [key, centerValue] of Object.entries(DEFAULT_ORIGIN_CENTER)) {
    normalized[key] = round(clamp(origin[key] ?? centerValue), 6);
  }
  return normalized;
}

export function originParametersFromSeed(seed = 20260705, options = {}) {
  const rng = createSeededRandom(Number(seed));
  const width = Number(options.width ?? 0.25);
  const center = normalizeOriginParameters(options.center ?? DEFAULT_ORIGIN_CENTER);
  const params = {};
  for (const [key, value] of Object.entries(center)) {
    const drift = rng.gaussian(0, width / 2.7) + (rng.random() - 0.5) * width;
    params[key] = round(clamp(value + drift), 6);
  }
  return {
    format: RCL_COSMOGENIC_ORIGIN_FORMAT,
    version: RCL_COSMOGENIC_COMPILER_VERSION,
    seed: Number(seed),
    width,
    parameters: normalizeOriginParameters(params),
  };
}

export function compileEarthHistoryFromOrigin(originInput = {}) {
  const origin = originInput.parameters ? normalizeOriginParameters(originInput.parameters) : normalizeOriginParameters(originInput);
  const p = origin;
  const universeAge = clamp(13.800 + (p.expansionRate - 0.5) * 0.070 + (p.densityFlatness - 0.99) * 0.160, 13.68, 13.94);
  const firstStarDelay = clamp(0.165 + (0.58 - p.starFormationEfficiency) * 0.120 + (0.48 - p.primordialVariance) * 0.090, 0.070, 0.360);
  const firstStars = universeAge - firstStarDelay;
  const solarSystemFormation = clamp(4.567 + (0.62 - p.heavyElementYield) * 0.145 + (0.58 - p.starFormationEfficiency) * 0.050 + (0.50 - p.baryonAsymmetry) * 0.040, 4.35, 4.82);
  const earthFormation = clamp(solarSystemFormation - clamp(0.028 + (p.planetaryDiskStability - 0.66) * 0.045, 0.010, 0.080), 4.32, 4.75);
  const stableOceans = clamp(earthFormation - clamp(0.300 + (0.59 - p.waterDeliveryBias) * 0.260 + (0.61 - p.tectonicHeatBudget) * 0.130, 0.080, 0.760), 3.55, 4.50);
  const earliestLife = clamp(stableOceans - clamp(0.260 + (0.74 - p.biosphereAdaptability) * 0.400 + (0.59 - p.waterDeliveryBias) * 0.150, 0.030, 0.680), 3.20, 4.28);
  const greatOxidation = clamp(2.400 + (0.57 - p.oxygenationGain) * 0.420 + (0.60 - p.biosphereAdaptability) * 0.160, 2.02, 2.86);
  const eukaryoticComplexity = clamp(1.800 + (0.57 - p.oxygenationGain) * 0.240 + (0.68 - p.biosphereAdaptability) * 0.280, 1.30, 2.35);
  const cambrianRadiation = clamp(0.541 + (0.50 - p.extinctionVolatility) * 0.045 + (0.68 - p.biosphereAdaptability) * 0.030, 0.440, 0.650);
  const kpgExtinction = clamp(0.066 + (p.extinctionVolatility - 0.44) * 0.024, 0.040, 0.095);
  const homoSapiens = clamp(0.000300 + (0.61 - p.cognitionGradient) * 0.000180 + (0.70 - p.biosphereAdaptability) * 0.000050, 0.000090, 0.000650);
  const industrialTechnosphere = clamp(0.000000250 + (0.66 - p.technosphereCoupling) * 0.000000180 + (0.61 - p.cognitionGradient) * 0.000000100, 0.000000060, 0.000000900);

  const events = {
    universe_age: round(universeAge, 9),
    first_stars: round(firstStars, 9),
    solar_system_formation: round(solarSystemFormation, 9),
    earth_formation: round(earthFormation, 9),
    stable_oceans: round(stableOceans, 9),
    earliest_life: round(earliestLife, 9),
    great_oxidation: round(greatOxidation, 9),
    eukaryotic_complexity: round(eukaryoticComplexity, 9),
    cambrian_radiation: round(cambrianRadiation, 9),
    kpg_extinction: round(kpgExtinction, 9),
    homo_sapiens: round(homoSapiens, 12),
    industrial_technosphere: round(industrialTechnosphere, 12),
  };

  const habitabilityVector = {
    heavyElementSufficiency: round(clamp((p.heavyElementYield + p.starFormationEfficiency + p.baryonAsymmetry) / 3), 6),
    rockyPlanetLikelihood: round(clamp((p.planetaryDiskStability + p.heavyElementYield + p.densityFlatness) / 3), 6),
    liquidWaterLikelihood: round(clamp((p.waterDeliveryBias + p.tectonicHeatBudget + p.planetaryDiskStability) / 3), 6),
    biospherePersistence: round(clamp((p.biosphereAdaptability + p.waterDeliveryBias + p.oxygenationGain + (1 - p.extinctionVolatility)) / 4), 6),
    cognitionAndTechnosphere: round(clamp((p.cognitionGradient + p.technosphereCoupling + p.biosphereAdaptability) / 3), 6),
  };

  return {
    format: RCL_COSMOGENIC_HISTORY_FORMAT,
    version: RCL_COSMOGENIC_COMPILER_VERSION,
    axis: DEFAULT_COSMOGENIC_TARGET.historyAxis,
    origin,
    events,
    habitabilityVector,
    root: sha256({ origin, events, habitabilityVector }),
  };
}

function scoreRange(value, min, max) {
  if (value >= min && value <= max) return { score: 1, distance: 0, inside: true };
  const width = Math.max(max - min, EPS);
  const distance = value < min ? min - value : value - max;
  return { score: clamp(1 - distance / (width * 2.5)), distance: round(distance, 12), inside: false };
}

function evaluateCausalOrder(events) {
  const checks = [];
  for (let index = 0; index < COSMOGENIC_CAUSAL_ORDER.length - 1; index += 1) {
    const older = COSMOGENIC_CAUSAL_ORDER[index];
    const younger = COSMOGENIC_CAUSAL_ORDER[index + 1];
    const ok = events[older] > events[younger];
    checks.push({ older, younger, ok, deltaGa: round(events[older] - events[younger], 12) });
  }
  const passed = checks.every(row => row.ok);
  return { passed, score: passed ? 1 : checks.filter(row => row.ok).length / checks.length, checks };
}

export function evaluateEarthHistoryConsistency(history, options = {}) {
  const constraints = options.constraints ?? COSMOGENIC_HISTORY_CONSTRAINTS;
  const rows = constraints.map(constraint => {
    const value = Number(history.events[constraint.id]);
    const scored = scoreRange(value, Number(constraint.min), Number(constraint.max));
    return {
      id: constraint.id,
      label: constraint.label,
      observedGaBeforePresent: round(value, constraint.id === 'industrial_technosphere' ? 12 : 9),
      min: constraint.min,
      max: constraint.max,
      weight: constraint.weight ?? 1,
      withinRange: scored.inside,
      distanceOutsideRangeGa: scored.distance,
      score: round(scored.score, 9),
    };
  });
  const order = evaluateCausalOrder(history.events);
  const habitabilityScore = weightedMean(Object.entries(history.habitabilityVector).map(([id, value]) => ({ id, score: value, weight: 1 })));
  const constraintScore = weightedMean(rows);
  const finalScore = round(constraintScore * 0.74 + order.score * 0.16 + habitabilityScore * 0.10, 9);
  const threshold = Number(options.threshold ?? DEFAULT_COSMOGENIC_TARGET.threshold);
  return {
    format: RCL_COSMOGENIC_TEST_FORMAT,
    version: RCL_COSMOGENIC_COMPILER_VERSION,
    target: DEFAULT_COSMOGENIC_TARGET,
    threshold,
    constraintScore: round(constraintScore, 9),
    causalOrderScore: round(order.score, 9),
    habitabilityScore: round(habitabilityScore, 9),
    earthConsistencyScore: finalScore,
    conclusionHolds: finalScore >= threshold && order.passed && rows.filter(row => !row.withinRange).length <= 1,
    failedConstraints: rows.filter(row => !row.withinRange).map(row => row.id),
    rows,
    causalOrder: order,
    root: sha256({ threshold, rows, order, habitabilityScore, finalScore }),
  };
}

export function searchCosmogenicEarthSeed(options = {}) {
  const startSeed = Number(options.startSeed ?? 20260705);
  const candidates = Number(options.candidates ?? 4096);
  const width = Number(options.width ?? 0.25);
  const threshold = Number(options.threshold ?? DEFAULT_COSMOGENIC_TARGET.threshold);
  let best = null;
  const accepted = [];

  const candidateSeeds = [startSeed, 4500001, 4500002, 4500003, 4500004, 4500005];
  for (let i = 0; i < candidates; i += 1) candidateSeeds.push(startSeed + i + 1);

  for (const seed of candidateSeeds) {
    const origin = originParametersFromSeed(seed, { width, center: options.center });
    const history = compileEarthHistoryFromOrigin(origin);
    const evaluation = evaluateEarthHistoryConsistency(history, { threshold, constraints: options.constraints });
    const candidate = { seed, origin, history, evaluation };
    if (!best || evaluation.earthConsistencyScore > best.evaluation.earthConsistencyScore) best = candidate;
    if (evaluation.conclusionHolds) accepted.push({ seed, score: evaluation.earthConsistencyScore, failedConstraints: evaluation.failedConstraints });
  }

  const result = {
    format: RCL_COSMOGENIC_TEST_FORMAT,
    version: RCL_COSMOGENIC_COMPILER_VERSION,
    hypothesis: 'origin parameters can be forward-compiled into an Earth-consistent coarse-grained history under explicit historical constraints',
    boundary: DEFAULT_COSMOGENIC_TARGET.boundary,
    search: { startSeed, candidates: candidateSeeds.length, width, threshold },
    acceptedCount: accepted.length,
    acceptedSeeds: accepted.slice(0, 12),
    best,
    conclusionHolds: Boolean(best?.evaluation.conclusionHolds),
  };
  return { ...result, root: sha256(result) };
}

export function runCosmogenicEarthTest(options = {}) {
  const search = searchCosmogenicEarthSeed(options);
  const verdict = search.conclusionHolds
    ? '成立：可以在粗粒度历史约束沙箱内找到原初参数种子，正向编译出地球一致事件链。'
    : '未成立：当前约束和搜索范围内没有找到稳定地球一致种子。';
  const payload = {
    ok: search.conclusionHolds,
    format: RCL_COSMOGENIC_TEST_FORMAT,
    version: RCL_COSMOGENIC_COMPILER_VERSION,
    verdict,
    boundary: search.boundary,
    bestSeed: search.best?.seed ?? null,
    bestScore: search.best?.evaluation.earthConsistencyScore ?? 0,
    acceptedCount: search.acceptedCount,
    bestHistory: search.best?.history.events ?? null,
    failedConstraints: search.best?.evaluation.failedConstraints ?? [],
    search,
  };
  return { ...payload, root: sha256(payload) };
}

export function buildCosmogenicSpec(overrides = {}) {
  const demo = runCosmogenicEarthTest(overrides.testOptions ?? {});
  const spec = {
    format: RCL_COSMOGENIC_SPEC_FORMAT,
    version: RCL_COSMOGENIC_COMPILER_VERSION,
    name: 'Cosmogenic Reality Compiler',
    premise: 'Define primordial universe parameters and compile a coarse-grained Earth-consistent historical trajectory.',
    boundary: DEFAULT_COSMOGENIC_TARGET.boundary,
    originParameters: Object.keys(DEFAULT_ORIGIN_CENTER),
    constraints: COSMOGENIC_HISTORY_CONSTRAINTS,
    causalOrder: COSMOGENIC_CAUSAL_ORDER,
    defaultTarget: DEFAULT_COSMOGENIC_TARGET,
    defaultVerdict: {
      conclusionHolds: demo.ok,
      bestSeed: demo.bestSeed,
      bestScore: demo.bestScore,
      failedConstraints: demo.failedConstraints,
    },
    compilerPasses: [
      'primordial parameter normalization',
      'cosmogenic forward event synthesis',
      'earth-history constraint validation',
      'causal order verification',
      'seed search and evidence root emission',
    ],
  };
  return { ...spec, root: sha256(spec) };
}

export function renderCosmogenicRcl(spec = buildCosmogenicSpec()) {
  const seed = spec.defaultVerdict.bestSeed ?? 20260705;
  const origin = originParametersFromSeed(seed);
  const history = compileEarthHistoryFromOrigin(origin);
  const evaluation = evaluateEarthHistoryConsistency(history);
  return `reality CosmogenicRealityCompiler {\n` +
`  facet origin.expansion_rate : Number = ${rclNumber(origin.parameters.expansionRate)}\n` +
`  facet origin.density_flatness : Number = ${rclNumber(origin.parameters.densityFlatness)}\n` +
`  facet origin.baryon_asymmetry : Number = ${rclNumber(origin.parameters.baryonAsymmetry)}\n` +
`  facet origin.primordial_variance : Number = ${rclNumber(origin.parameters.primordialVariance)}\n` +
`  facet origin.heavy_element_yield : Number = ${rclNumber(origin.parameters.heavyElementYield)}\n` +
`  facet origin.planetary_disk_stability : Number = ${rclNumber(origin.parameters.planetaryDiskStability)}\n` +
`  facet origin.water_delivery_bias : Number = ${rclNumber(origin.parameters.waterDeliveryBias)}\n` +
`  facet origin.biosphere_adaptability : Number = ${rclNumber(origin.parameters.biosphereAdaptability)}\n` +
`  facet origin.cognition_gradient : Number = ${rclNumber(origin.parameters.cognitionGradient)}\n` +
`  facet history.universe_age : Number = ${rclNumber(history.events.universe_age)}\n` +
`  facet history.earth_formation : Number = ${rclNumber(history.events.earth_formation)}\n` +
`  facet history.earliest_life : Number = ${rclNumber(history.events.earliest_life)}\n` +
`  facet history.great_oxidation : Number = ${rclNumber(history.events.great_oxidation)}\n` +
`  facet history.cambrian_radiation : Number = ${rclNumber(history.events.cambrian_radiation)}\n` +
`  facet history.industrial_technosphere : Number = ${rclNumber(history.events.industrial_technosphere)}\n` +
`  facet validation.earth_consistency : Number = ${rclNumber(evaluation.earthConsistencyScore)}\n` +
`  facet validation.threshold : Number = ${rclNumber(evaluation.threshold)}\n` +
`  facet validation.seed : Number = ${rclNumber(seed)}\n\n` +
`  subject compiler {\n` +
`    facet authority : Number = 1\n` +
`    warrant origin.read on origin\n` +
`    warrant history.write on history\n` +
`    warrant validation.write on validation\n` +
`  }\n\n` +
`  emergence compile_earth_consistent_history {\n` +
`    cause compiler\n` +
`    when compiler.authority == 1\n` +
`    needs origin.read on origin\n` +
`    needs history.write on history\n` +
`    needs validation.write on validation\n` +
`    alter validation.earth_consistency <- validation.earth_consistency\n` +
`    preserve origin.expansion_rate >= 0\n` +
`    preserve origin.expansion_rate <= 1\n` +
`    preserve origin.density_flatness >= 0\n` +
`    preserve origin.density_flatness <= 1\n` +
`    preserve history.universe_age >= 13\n` +
`    preserve history.earth_formation >= 4\n` +
`    preserve history.earliest_life >= 3\n` +
`    preserve validation.earth_consistency >= validation.threshold\n` +
`    witness "rcl:cosmogenic-reality-compiler:v0.45"\n` +
`  }\n\n` +
`  foresee compile_earth_consistent_history\n` +
`  realize compile_earth_consistent_history\n` +
`}\n`;
}

export function runCosmogenicDemo() {
  const report = runCosmogenicEarthTest({ candidates: 2048 });
  return {
    ok: report.ok,
    format: report.format,
    version: report.version,
    verdict: report.verdict,
    boundary: report.boundary,
    bestSeed: report.bestSeed,
    bestScore: report.bestScore,
    acceptedCount: report.acceptedCount,
    bestHistory: report.bestHistory,
    root: report.root,
  };
}

export function readCosmogenicInput(inputPath) {
  if (!inputPath) return {};
  const file = path.resolve(inputPath);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function writeCosmogenicReports(outputDir = 'output/v0.45/cosmogenic-reality', options = {}) {
  const target = path.resolve(outputDir);
  fs.mkdirSync(target, { recursive: true });
  const input = options.input ?? options;
  const testOptions = input.testOptions ?? input;
  const report = runCosmogenicEarthTest(testOptions);
  const spec = buildCosmogenicSpec({ testOptions });
  const rcl = renderCosmogenicRcl(spec);
  const bestOrigin = report.search.best.origin;
  const bestHistory = report.search.best.history;
  const bestEvaluation = report.search.best.evaluation;
  const files = {
    'cosmogenic-spec.json': spec,
    'cosmogenic-origin.json': bestOrigin,
    'cosmogenic-earth-history.json': bestHistory,
    'cosmogenic-earth-consistency-test.json': report,
    'cosmogenic-earth-evaluation.json': bestEvaluation,
    'cosmogenic-reality-compiler.rcl': rcl,
    'cosmogenic-input.json': input,
  };
  const written = [];
  for (const [name, value] of Object.entries(files)) {
    const file = path.join(target, name);
    fs.writeFileSync(file, `${typeof value === 'string' ? value : JSON.stringify(value, null, 2)}\n`);
    written.push({ path: file, sha256: sha256(fs.readFileSync(file, 'utf8')) });
  }
  const bundle = {
    ok: report.ok,
    format: RCL_COSMOGENIC_BUNDLE_FORMAT,
    version: RCL_COSMOGENIC_COMPILER_VERSION,
    outputDir: target,
    verdict: report.verdict,
    root: sha256({ spec, report, bestOrigin, bestHistory, bestEvaluation }),
    files: written,
  };
  fs.writeFileSync(path.join(target, 'cosmogenic-bundle.json'), `${JSON.stringify(bundle, null, 2)}\n`);
  return bundle;
}

export function cosmogenicCanonicalRoot(value) {
  return sha256(canonicalJson(value));
}
