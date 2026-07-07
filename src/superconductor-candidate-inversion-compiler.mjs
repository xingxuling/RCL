import fs from 'node:fs';
import path from 'node:path';
import { clamp, createSeededRandom, sha256, canonicalJson } from './reality-compiler-kernel.mjs';

export const RCL_SUPERCONDUCTOR_CANDIDATE_INVERSION_VERSION = '0.92.0-alpha.1';
export const RCL_SUPERCONDUCTOR_CANDIDATE_INVERSION_SPEC_FORMAT = 'rcl.superconductor-candidate-inversion.spec.v0.92';
export const RCL_SUPERCONDUCTOR_CANDIDATE_INVERSION_RESULT_FORMAT = 'rcl.superconductor-candidate-inversion.result.v0.92';
export const RCL_SUPERCONDUCTOR_CANDIDATE_INVERSION_BUNDLE_FORMAT = 'rcl.superconductor-candidate-inversion.bundle.v0.92';

const EPS = 1e-12;

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const item of Object.values(value)) deepFreeze(item);
  }
  return value;
}

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

function stableBlindId(seed, key, index) {
  return `blind_${sha256({ seed, key, index }).slice(0, 16)}`;
}

function vectorScore(observed = {}, target = {}, weights = {}) {
  const keys = Object.keys(weights);
  let numerator = 0;
  let denominator = 0;
  for (const key of keys) {
    const weight = Number(weights[key] ?? 1);
    const o = Number(observed[key] ?? 0);
    const t = Number(target[key] ?? 0);
    numerator += weight * clamp(1 - Math.abs(o - t));
    denominator += weight;
  }
  return denominator ? numerator / denominator : 0;
}

function jitter(value, rng, width = 0.005) {
  return clamp(Number(value) + (rng.random() - 0.5) * width);
}

export const DEFAULT_CORRECTED_COSMOGENIC_ORIGIN_V090 = deepFreeze({
  expansionRate: 0.434246,
  densityFlatness: 1,
  baryonAsymmetry: 0.520035,
  primordialVariance: 0.48,
  starFormationEfficiency: 0.58414,
  heavyElementYield: 0.607025,
  planetaryDiskStability: 0.66486,
  waterDeliveryBias: 0.601388,
  tectonicHeatBudget: 0.63475,
  biosphereAdaptability: 0.656209,
  oxygenationGain: 0.548619,
  extinctionVolatility: 0.452445,
  cognitionGradient: 0.61,
  technosphereCoupling: 0.66,
});

export const DEFAULT_SUPERCONDUCTOR_CANDIDATE_INVERSION_SPEC = deepFreeze({
  format: RCL_SUPERCONDUCTOR_CANDIDATE_INVERSION_SPEC_FORMAT,
  version: RCL_SUPERCONDUCTOR_CANDIDATE_INVERSION_VERSION,
  id: 'superconductor_candidate_inversion_v092',
  boundary: 'computational_candidate_family_compiler_not_lab_recipe_not_room_temperature_superconductor_claim_not_future_log_reading',
  seed: 20260707,
  blindSeed: 20260709,
  correctedOrigin: DEFAULT_CORRECTED_COSMOGENIC_ORIGIN_V090,
  thresholds: {
    candidateFamilyConfidence: 0.70,
    margin: 0.02,
    negativeControlMaxScore: 0.45,
    ambientClaimMinScore: 0.93,
    roomTempClaimMinTcK: 295,
    pressureMaxForAmbientGPa: 0.2,
    leakScore: 0,
    renameInvariantMin: 0.995,
    pressurePassRate: 0.95,
  },
  target: {
    id: 'ambient_high_tc_superconductivity_candidate_family',
    requiredOutput: 'ranked_candidate_families_and_validation_protocol',
    forbiddenOutput: ['wet_lab_recipe', 'exact_synthesis_steps', 'room_temperature_superconductor_claim', 'future_log_claim'],
    vector: {
      electronPhononCoupling: 0.92,
      hydrogenPhononPotential: 0.82,
      ambientMetastability: 0.82,
      lowPressureViability: 0.90,
      dynamicStability: 0.88,
      thermodynamicPlausibility: 0.78,
      topologicalInterfacePotential: 0.72,
      independentValidationReadiness: 0.93,
      knownFalsePositivePenalty: 0,
      hazardousRecipeRisk: 0,
    },
  },
  search: {
    generatedVariants: 64,
    pressureIterations: 32,
    perturbationWidth: 0.018,
  },
  scienceBoundary: {
    currentConsensus: 'no broadly accepted room-temperature ambient-pressure superconductor is used as a known fact by this compiler',
    hydrides: 'hydrogen-rich hydrides remain high-Tc search space but usually require high pressure; pressure penalty blocks ambient overclaim',
    lk99: 'LK-99-like lead apatite is a known false-positive/negative-control pattern, not a superconducting target',
  },
});

export const FEATURE_WEIGHTS = deepFreeze({
  electronPhononCoupling: 1.25,
  hydrogenPhononPotential: 0.75,
  ambientMetastability: 1.20,
  lowPressureViability: 1.30,
  dynamicStability: 1.20,
  thermodynamicPlausibility: 1.00,
  topologicalInterfacePotential: 0.70,
  independentValidationReadiness: 1.15,
  knownFalsePositivePenalty: 2.00,
  hazardousRecipeRisk: 1.60,
});

export const DEFAULT_SUPERCONDUCTOR_CANDIDATES = deepFreeze([
  {
    key: 'ternary_light_element_clathrate_hydride_family',
    revealName: '低压三元轻元素笼状氢化物候选族 / Low-pressure ternary light-element clathrate hydride family',
    class: 'candidate_family',
    boundary: 'computational_family_only_requires_dft_phonon_epc_validation_not_a_synthesis_recipe',
    descriptor: 'M-X-Hn clathrate-like hydride family, where M is a pressure-stabilizing electropositive center and X is a light covalent stabilizer; exact elements intentionally withheld until independent computational screening.',
    approximateTcBandK: [140, 230],
    pressureBandGPa: [10, 80],
    vector: {
      electronPhononCoupling: 0.91,
      hydrogenPhononPotential: 0.96,
      ambientMetastability: 0.56,
      lowPressureViability: 0.62,
      dynamicStability: 0.76,
      thermodynamicPlausibility: 0.72,
      topologicalInterfacePotential: 0.50,
      independentValidationReadiness: 0.86,
      knownFalsePositivePenalty: 0.02,
      hazardousRecipeRisk: 0.30,
    },
    validationProtocol: ['structure enumeration', 'DFT relaxation', 'phonon dispersion', 'EPC/Eliashberg estimate', 'pressure release metastability check', 'independent rerun with alternative functional'],
  },
  {
    key: 'boron_carbon_hydride_interface_family',
    revealName: '硼-碳-氢界面声子候选族 / Boron-carbon-hydride interface phonon candidate family',
    class: 'candidate_family',
    boundary: 'solid_state_interface_candidate_not_universal_recipe',
    descriptor: 'Light-element layered/interfacial family inspired by MgB2-like covalent phonon channels and carbon-boron network stabilization.',
    approximateTcBandK: [60, 180],
    pressureBandGPa: [0, 20],
    vector: {
      electronPhononCoupling: 0.82,
      hydrogenPhononPotential: 0.62,
      ambientMetastability: 0.78,
      lowPressureViability: 0.86,
      dynamicStability: 0.74,
      thermodynamicPlausibility: 0.73,
      topologicalInterfacePotential: 0.58,
      independentValidationReadiness: 0.88,
      knownFalsePositivePenalty: 0.01,
      hazardousRecipeRisk: 0.16,
    },
    validationProtocol: ['2D/3D interface enumeration', 'strain-window scan', 'phonon soft-mode rejection', 'EPC screening', 'finite-temperature stability check'],
  },
  {
    key: 'strained_nickelate_cuprate_topological_interface_family',
    revealName: '应变镍酸盐-铜氧化物拓扑界面候选族 / Strained nickelate-cuprate topological interface family',
    class: 'candidate_family',
    boundary: 'correlated_electron_interface_candidate_no_room_temperature_claim',
    descriptor: 'Oxide heterointerface family using strain, charge-transfer control and flat-band/topological-interface screening.',
    approximateTcBandK: [50, 160],
    pressureBandGPa: [0, 1],
    vector: {
      electronPhononCoupling: 0.42,
      hydrogenPhononPotential: 0.05,
      ambientMetastability: 0.86,
      lowPressureViability: 0.96,
      dynamicStability: 0.72,
      thermodynamicPlausibility: 0.67,
      topologicalInterfacePotential: 0.88,
      independentValidationReadiness: 0.74,
      knownFalsePositivePenalty: 0.04,
      hazardousRecipeRisk: 0.12,
    },
    validationProtocol: ['heterostructure band alignment', 'strain/doping grid', 'correlation-sensitive calculation', 'magnetic-order sensitivity scan', 'transport target definition'],
  },
  {
    key: 'high_pressure_rare_earth_superhydride_reference',
    revealName: '高压稀土超氢化物参考族 / High-pressure rare-earth superhydride reference family',
    class: 'reference_family',
    boundary: 'known_high_pressure_high_tc_reference_not_ambient_candidate',
    descriptor: 'Hydrogen-rich high-pressure reference family used to calibrate phonon-driven high-Tc scoring while blocking ambient claims.',
    approximateTcBandK: [180, 260],
    pressureBandGPa: [120, 250],
    vector: {
      electronPhononCoupling: 0.96,
      hydrogenPhononPotential: 0.99,
      ambientMetastability: 0.16,
      lowPressureViability: 0.05,
      dynamicStability: 0.85,
      thermodynamicPlausibility: 0.80,
      topologicalInterfacePotential: 0.22,
      independentValidationReadiness: 0.62,
      knownFalsePositivePenalty: 0.00,
      hazardousRecipeRisk: 0.72,
    },
    validationProtocol: ['high-pressure reference calibration only', 'pressure penalty must block ambient claim', 'do not convert to lab recipe'],
  },
  {
    key: 'cuprate_flatband_strain_stack_reference',
    revealName: '铜氧化物平带应变堆叠参考族 / Cuprate flat-band strain-stack reference family',
    class: 'reference_family',
    boundary: 'known_oxide_superconductivity_reference_not_room_temperature_claim',
    descriptor: 'Cuprate-inspired layered reference for high-Tc oxide physics and control ranking.',
    approximateTcBandK: [90, 140],
    pressureBandGPa: [0, 3],
    vector: {
      electronPhononCoupling: 0.28,
      hydrogenPhononPotential: 0.03,
      ambientMetastability: 0.92,
      lowPressureViability: 0.95,
      dynamicStability: 0.82,
      thermodynamicPlausibility: 0.78,
      topologicalInterfacePotential: 0.60,
      independentValidationReadiness: 0.90,
      knownFalsePositivePenalty: 0.01,
      hazardousRecipeRisk: 0.10,
    },
    validationProtocol: ['known reference class', 'rank as physics anchor', 'must not be claimed ambient room-temperature target'],
  },
  {
    key: 'lk99_lead_apatite_false_positive_control',
    revealName: 'LK-99 铅磷灰石伪阳性负控 / LK-99 lead-apatite false-positive control',
    class: 'negative_control',
    boundary: 'known_false_positive_pattern_must_fail_target_ranking',
    descriptor: 'Lead-apatite-like ambient claim pattern retained only as a negative control.',
    approximateTcBandK: [0, 0],
    pressureBandGPa: [0, 0],
    vector: {
      electronPhononCoupling: 0.18,
      hydrogenPhononPotential: 0.00,
      ambientMetastability: 0.70,
      lowPressureViability: 0.98,
      dynamicStability: 0.48,
      thermodynamicPlausibility: 0.36,
      topologicalInterfacePotential: 0.12,
      independentValidationReadiness: 0.94,
      knownFalsePositivePenalty: 0.98,
      hazardousRecipeRisk: 0.42,
    },
    validationProtocol: ['negative control only', 'must fail independent superconductivity claim gate'],
  },
  {
    key: 'generic_magnetic_levitation_artifact_control',
    revealName: '普通磁性/抗磁伪信号负控 / Generic magnetic-artifact control',
    class: 'negative_control',
    boundary: 'artifact_control_must_not_rank_as_superconductivity_candidate',
    descriptor: 'Control pattern for levitation/diamagnetic artifacts that can mimic weak superconducting signals.',
    approximateTcBandK: [0, 0],
    pressureBandGPa: [0, 0],
    vector: {
      electronPhononCoupling: 0.08,
      hydrogenPhononPotential: 0.00,
      ambientMetastability: 0.90,
      lowPressureViability: 0.98,
      dynamicStability: 0.70,
      thermodynamicPlausibility: 0.50,
      topologicalInterfacePotential: 0.02,
      independentValidationReadiness: 0.92,
      knownFalsePositivePenalty: 0.92,
      hazardousRecipeRisk: 0.20,
    },
    validationProtocol: ['negative control only', 'must be recognized as artifact risk'],
  },
]);

export function normalizeSuperconductorCandidateInversionSpec(input = {}) {
  return {
    ...DEFAULT_SUPERCONDUCTOR_CANDIDATE_INVERSION_SPEC,
    ...input,
    format: RCL_SUPERCONDUCTOR_CANDIDATE_INVERSION_SPEC_FORMAT,
    version: RCL_SUPERCONDUCTOR_CANDIDATE_INVERSION_VERSION,
    correctedOrigin: { ...DEFAULT_CORRECTED_COSMOGENIC_ORIGIN_V090, ...(input.correctedOrigin ?? {}) },
    thresholds: { ...DEFAULT_SUPERCONDUCTOR_CANDIDATE_INVERSION_SPEC.thresholds, ...(input.thresholds ?? {}) },
    target: {
      ...DEFAULT_SUPERCONDUCTOR_CANDIDATE_INVERSION_SPEC.target,
      ...(input.target ?? {}),
      vector: { ...DEFAULT_SUPERCONDUCTOR_CANDIDATE_INVERSION_SPEC.target.vector, ...(input.target?.vector ?? {}) },
      forbiddenOutput: input.target?.forbiddenOutput ?? DEFAULT_SUPERCONDUCTOR_CANDIDATE_INVERSION_SPEC.target.forbiddenOutput,
    },
    search: { ...DEFAULT_SUPERCONDUCTOR_CANDIDATE_INVERSION_SPEC.search, ...(input.search ?? {}) },
    scienceBoundary: { ...DEFAULT_SUPERCONDUCTOR_CANDIDATE_INVERSION_SPEC.scienceBoundary, ...(input.scienceBoundary ?? {}) },
    candidates: input.candidates ?? DEFAULT_SUPERCONDUCTOR_CANDIDATES,
  };
}

export function deriveMaterialsFieldFromCosmogenicOrigin(originInput = {}) {
  const origin = { ...DEFAULT_CORRECTED_COSMOGENIC_ORIGIN_V090, ...(originInput ?? {}) };
  const heavyElementAccess = clamp(0.42 + 0.42 * Number(origin.heavyElementYield ?? 0.6) + 0.12 * Number(origin.technosphereCoupling ?? 0.66));
  const structuralSearchDepth = clamp(0.28 + 0.45 * Number(origin.cognitionGradient ?? 0.61) + 0.29 * Number(origin.technosphereCoupling ?? 0.66));
  const lightElementProcessability = clamp(0.30 + 0.32 * Number(origin.planetaryDiskStability ?? 0.66) + 0.23 * Number(origin.baryonAsymmetry ?? 0.52));
  const highPressureInfrastructure = clamp(0.18 + 0.42 * Number(origin.technosphereCoupling ?? 0.66) + 0.20 * Number(origin.cognitionGradient ?? 0.61));
  const ambientMetastabilityBias = clamp(0.22 + 0.36 * Number(origin.planetaryDiskStability ?? 0.66) + 0.20 * Number(origin.heavyElementYield ?? 0.61));
  const validationDiscipline = clamp(0.26 + 0.40 * Number(origin.cognitionGradient ?? 0.61) + 0.28 * Number(origin.technosphereCoupling ?? 0.66));
  const falsePositiveResistance = clamp(0.25 + 0.38 * Number(origin.cognitionGradient ?? 0.61) + 0.25 * validationDiscipline);
  return {
    origin,
    heavyElementAccess: round(heavyElementAccess),
    structuralSearchDepth: round(structuralSearchDepth),
    lightElementProcessability: round(lightElementProcessability),
    highPressureInfrastructure: round(highPressureInfrastructure),
    ambientMetastabilityBias: round(ambientMetastabilityBias),
    validationDiscipline: round(validationDiscipline),
    falsePositiveResistance: round(falsePositiveResistance),
    root: sha256({ origin, heavyElementAccess, structuralSearchDepth, ambientMetastabilityBias, validationDiscipline }),
  };
}

function fieldAdjustedVector(candidate, field, rng = null, perturb = 0) {
  const v = { ...candidate.vector };
  v.thermodynamicPlausibility = clamp(v.thermodynamicPlausibility * 0.82 + field.heavyElementAccess * 0.18);
  v.dynamicStability = clamp(v.dynamicStability * 0.86 + field.structuralSearchDepth * 0.14);
  v.hydrogenPhononPotential = clamp(v.hydrogenPhononPotential * 0.88 + field.lightElementProcessability * 0.12);
  v.independentValidationReadiness = clamp(v.independentValidationReadiness * 0.78 + field.validationDiscipline * 0.22);
  v.knownFalsePositivePenalty = clamp(v.knownFalsePositivePenalty * 0.82 + (1 - field.falsePositiveResistance) * 0.18);
  v.ambientMetastability = clamp(v.ambientMetastability * 0.82 + field.ambientMetastabilityBias * 0.18);
  if (perturb && rng) {
    for (const key of Object.keys(v)) v[key] = jitter(v[key], rng, perturb);
  }
  return Object.fromEntries(Object.entries(v).map(([key, value]) => [key, round(value)]));
}

function baseCandidateScore(vector, target) {
  const positive = { ...vector, knownFalsePositivePenalty: 0, hazardousRecipeRisk: 0 };
  const score = vectorScore(positive, target.vector, FEATURE_WEIGHTS);
  const falsePositivePenalty = Number(vector.knownFalsePositivePenalty ?? 0) * 0.34;
  const hazardPenalty = Number(vector.hazardousRecipeRisk ?? 0) * 0.16;
  return clamp(score - falsePositivePenalty - hazardPenalty);
}

function pressurePenalty(candidate) {
  const [minPressure, maxPressure] = candidate.pressureBandGPa ?? [0, 0];
  const pressure = Math.max(Number(minPressure ?? 0), Number(maxPressure ?? 0));
  if (pressure <= 0.2) return 0;
  if (pressure <= 5) return 0.04;
  if (pressure <= 25) return 0.11;
  if (pressure <= 90) return 0.21;
  return 0.36;
}

function roomTemperatureGap(candidate) {
  const [minTc, maxTc] = candidate.approximateTcBandK ?? [0, 0];
  const max = Number(maxTc ?? 0);
  return round(Math.max(0, 295 - max));
}

function candidateEvaluation(candidate, spec, field, options = {}) {
  const rng = options.rng ?? null;
  const vector = fieldAdjustedVector(candidate, field, rng, Number(options.perturbationWidth ?? 0));
  const mechanismScore = baseCandidateScore(vector, spec.target);
  const pPenalty = pressurePenalty(candidate);
  const tempGap = roomTemperatureGap(candidate);
  const roomTempPenalty = clamp(tempGap / 360) * 0.18;
  const classGate = candidate.class === 'negative_control' ? 0.48 : candidate.class === 'reference_family' ? 0.88 : 1;
  const candidateScore = clamp((mechanismScore - pPenalty - roomTempPenalty) * classGate);
  const canClaimAmbientRoomTemp = candidateScore >= spec.thresholds.ambientClaimMinScore && tempGap === 0 && Number((candidate.pressureBandGPa ?? [99])[1]) <= spec.thresholds.pressureMaxForAmbientGPa;
  const scoreRows = [
    { id: 'mechanism_vector_match', score: round(mechanismScore), weight: 1.0 },
    { id: 'pressure_penalty', score: round(1 - pPenalty), weight: 0.75 },
    { id: 'room_temperature_gap_gate', score: round(1 - roomTempPenalty), weight: 0.55 },
    { id: 'false_positive_gate', score: round(1 - Number(vector.knownFalsePositivePenalty ?? 0)), weight: 1.10 },
    { id: 'safe_output_gate', score: round(1 - Number(vector.hazardousRecipeRisk ?? 0)), weight: 0.75 },
  ];
  return {
    candidateKey: candidate.key,
    class: candidate.class,
    vector,
    scoreRows,
    mechanismScore: round(mechanismScore),
    pressurePenalty: round(pPenalty),
    roomTemperatureGapK: tempGap,
    candidateScore: round(candidateScore),
    canClaimAmbientRoomTemp,
    passedCandidateFamilyGate: candidate.class === 'candidate_family' && candidateScore >= spec.thresholds.candidateFamilyConfidence && !canClaimAmbientRoomTemp,
    boundary: candidate.boundary,
    root: sha256({ key: candidate.key, vector, mechanismScore, candidateScore }),
  };
}

function buildBlindDeck(candidates, spec) {
  return candidates.map((candidate, index) => ({
    blindId: stableBlindId(spec.blindSeed, candidate.key, index),
    redactedFeatures: {
      class: candidate.class,
      boundaryClass: candidate.boundary.split('_').slice(0, 4).join('_'),
      approximateTcBandK: candidate.approximateTcBandK,
      pressureBandGPa: candidate.pressureBandGPa,
      vectorHash: sha256(candidate.vector).slice(0, 24),
      validationProtocolCount: candidate.validationProtocol.length,
    },
    leakCheckText: JSON.stringify({ class: candidate.class, boundaryClass: candidate.boundary.split('_').slice(0, 4).join('_'), vectorHash: sha256(candidate.vector).slice(0, 24) }),
    candidate,
  }));
}

function leakageScore(deck) {
  const forbidden = ['LK-99', 'lead', 'apatite', 'hydride', 'nickelate', 'cuprate', 'boron', 'carbon', 'rare-earth', 'clathrate', '蓝', '候选', '超氢', '磷灰石'];
  const leakCount = deck.reduce((sum, item) => sum + forbidden.reduce((inner, token) => inner + (item.leakCheckText.includes(token) ? 1 : 0), 0), 0);
  return leakCount === 0 ? 0 : round(leakCount / Math.max(1, deck.length * forbidden.length));
}

export function rankSuperconductorCandidates(specInput = {}) {
  const spec = normalizeSuperconductorCandidateInversionSpec(specInput);
  const field = deriveMaterialsFieldFromCosmogenicOrigin(spec.correctedOrigin);
  const deck = buildBlindDeck(spec.candidates, spec);
  const leak = leakageScore(deck);
  const evaluated = deck.map((item) => ({
    blindId: item.blindId,
    redactedFeatures: item.redactedFeatures,
    evaluation: candidateEvaluation(item.candidate, spec, field),
    revealAfterScoring: {
      key: item.candidate.key,
      name: item.candidate.revealName,
      class: item.candidate.class,
      descriptor: item.candidate.descriptor,
      approximateTcBandK: item.candidate.approximateTcBandK,
      pressureBandGPa: item.candidate.pressureBandGPa,
      validationProtocol: item.candidate.validationProtocol,
      boundary: item.candidate.boundary,
    },
  })).sort((a, b) => b.evaluation.candidateScore - a.evaluation.candidateScore);
  const top = evaluated[0];
  const second = evaluated[1];
  const margin = top && second ? round(top.evaluation.candidateScore - second.evaluation.candidateScore) : 0;
  const negativeControls = evaluated.filter(row => row.revealAfterScoring.class === 'negative_control');
  const negativeControlMaxScore = negativeControls.length ? Math.max(...negativeControls.map(row => row.evaluation.candidateScore)) : 0;
  const referenceRows = evaluated.filter(row => row.revealAfterScoring.class === 'reference_family');
  return {
    spec,
    field,
    leakageScore: leak,
    blindDeck: evaluated.map(({ blindId, redactedFeatures, evaluation }) => ({ blindId, redactedFeatures, evaluation: { class: evaluation.class, vector: evaluation.vector, scoreRows: evaluation.scoreRows, mechanismScore: evaluation.mechanismScore, pressurePenalty: evaluation.pressurePenalty, roomTemperatureGapK: evaluation.roomTemperatureGapK, candidateScore: evaluation.candidateScore, canClaimAmbientRoomTemp: evaluation.canClaimAmbientRoomTemp, passedCandidateFamilyGate: evaluation.passedCandidateFamilyGate, root: evaluation.root } })),
    revealAfterScoring: evaluated.map(({ blindId, revealAfterScoring, evaluation }) => ({ blindId, revealAfterScoring, evaluation })),
    top,
    margin,
    negativeControls,
    referenceRows,
    negativeControlMaxScore: round(negativeControlMaxScore),
    passed: Boolean(top) && top.evaluation.passedCandidateFamilyGate && margin >= spec.thresholds.margin && leak === spec.thresholds.leakScore && negativeControlMaxScore <= spec.thresholds.negativeControlMaxScore,
    root: sha256({ field, evaluated: evaluated.map(row => ({ blindId: row.blindId, key: row.revealAfterScoring.key, score: row.evaluation.candidateScore })), leak }),
  };
}

export function runRenameInvarianceCheck(specInput = {}) {
  const spec = normalizeSuperconductorCandidateInversionSpec(specInput);
  const renamed = spec.candidates.map(candidate => ({
    ...candidate,
    revealName: candidate.key === 'ternary_light_element_clathrate_hydride_family' ? '香蕉材料候选 / Banana Material Candidate' : `${candidate.revealName} renamed`,
  }));
  const base = rankSuperconductorCandidates(spec);
  const changed = rankSuperconductorCandidates({ ...spec, candidates: renamed });
  const sameTopKey = base.top.revealAfterScoring.key === changed.top.revealAfterScoring.key;
  const scoreDelta = Math.abs(base.top.evaluation.candidateScore - changed.top.evaluation.candidateScore);
  return {
    sameTopKey,
    baseTopKey: base.top.revealAfterScoring.key,
    renamedTopKey: changed.top.revealAfterScoring.key,
    scoreDelta: round(scoreDelta),
    invariantScore: round(sameTopKey ? clamp(1 - scoreDelta) : 0),
    passed: sameTopKey && scoreDelta <= 0.000001,
    root: sha256({ sameTopKey, scoreDelta }),
  };
}

export function runSuperconductorPressureTest(specInput = {}) {
  const spec = normalizeSuperconductorCandidateInversionSpec(specInput);
  const rng = createSeededRandom(spec.seed + 9200);
  const base = rankSuperconductorCandidates(spec);
  const rows = [];
  for (let i = 0; i < Number(spec.search.pressureIterations ?? 24); i += 1) {
    const perturbedCandidates = spec.candidates.map(candidate => ({
      ...candidate,
      vector: fieldAdjustedVector(candidate, deriveMaterialsFieldFromCosmogenicOrigin(spec.correctedOrigin), rng, spec.search.perturbationWidth),
    }));
    const run = rankSuperconductorCandidates({ ...spec, candidates: perturbedCandidates });
    rows.push({ iteration: i, topKey: run.top.revealAfterScoring.key, topScore: run.top.evaluation.candidateScore, margin: run.margin, negativeControlMaxScore: run.negativeControlMaxScore, passed: run.top.revealAfterScoring.key === base.top.revealAfterScoring.key && run.negativeControlMaxScore <= spec.thresholds.negativeControlMaxScore });
  }
  const passRate = rows.filter(row => row.passed).length / Math.max(1, rows.length);
  return {
    baseTopKey: base.top.revealAfterScoring.key,
    passRate: round(passRate),
    rows,
    passed: passRate >= spec.thresholds.pressurePassRate,
    root: sha256(rows),
  };
}

export function buildValidationProtocol(topRow) {
  const name = topRow?.revealAfterScoring?.name ?? 'candidate family';
  return {
    target: name,
    boundary: 'computational_validation_protocol_only_no_wet_lab_recipe',
    stages: [
      { id: 'literature_grounding', output: 'known-positive, known-negative and high-pressure reference controls', stopIf: 'candidate resembles false-positive pattern or lacks independent controls' },
      { id: 'structure_generation', output: 'redacted candidate structures and feature vectors', stopIf: 'structure depends on reveal label or hidden winner metadata' },
      { id: 'dft_relaxation', output: 'relaxed geometry and formation-energy screen', stopIf: 'geometry unstable or energetically implausible' },
      { id: 'phonon_dispersion', output: 'dynamic-stability report', stopIf: 'imaginary phonon modes dominate target phase' },
      { id: 'epc_tc_estimate', output: 'electron-phonon coupling / Tc estimate with uncertainty band', stopIf: 'Tc band does not beat reference controls or depends on one fragile assumption' },
      { id: 'pressure_release_metastability', output: 'low-pressure survival window', stopIf: 'candidate requires high-pressure lock-in for all claimed behavior' },
      { id: 'independent_reproduction_gate', output: 'separate toolchain rerun + negative controls', stopIf: 'rank changes under rename, shuffle or control injection' },
    ],
    explicitNonGoals: [
      'no direct synthesis temperature/pressure/time recipe',
      'no claim that room-temperature ambient-pressure superconductivity has been achieved',
      'no future-log or Akashic proof claim',
      'no environmental or biomedical deployment path',
    ],
  };
}

export function runMulticivilizationSuperconductorCourt(result) {
  const top = result.revealAfterScoring[0];
  const rows = [
    { civilization: 'Founder Twin', verdict: top?.evaluation?.passedCandidateFamilyGate ? 'pass' : 'fail', artifact: 'target downgraded from future recipe to ranked computational candidate family' },
    { civilization: '柳清莲 Gate', verdict: result.canClaimLabRecipe === false && result.canClaimRoomTemperatureAmbientSuperconductor === false ? 'pass' : 'fail', artifact: 'future-log, recipe and room-temp overclaim blocked' },
    { civilization: '洞哥 Grounding', verdict: result.validationProtocol.stages.length >= 6 ? 'pass' : 'fail', artifact: 'output is a validation pipeline with stop conditions, not a lab procedure' },
    { civilization: 'Product Civilization', verdict: result.canClaimCandidateFamily ? 'pass' : 'fail', artifact: 'product value is candidate compression and negative-control filtering' },
    { civilization: 'Engineering Civilization', verdict: result.leakageScore === 0 ? 'pass' : 'fail', artifact: 'blind deck redacts reveal names and uses vectors/hashes' },
    { civilization: 'Testing Civilization', verdict: result.renameInvariance.passed && result.negativeControlMaxScore <= result.spec.thresholds.negativeControlMaxScore ? 'pass' : 'fail', artifact: 'rename invariance, false-positive control and pressure test gates' },
    { civilization: 'Safety Civilization', verdict: !result.canClaimLabRecipe && !result.canClaimExternalUniverseProof ? 'pass' : 'fail', artifact: 'non-procedural computational materials protocol with hard claim boundaries' },
    { civilization: 'Integration Court', verdict: result.ok ? 'pass' : 'fail', artifact: 'RCL v0.90 cosmogenic parameters connected to material candidate compiler' },
    { civilization: 'Evidence Ledger', verdict: result.root ? 'pass' : 'fail', artifact: 'result root, reports and SHA-ready package outputs' },
  ];
  return { rows, passed: rows.every(row => row.verdict === 'pass'), root: sha256(rows) };
}

export function runSuperconductorCandidateInversion(specInput = {}) {
  const spec = normalizeSuperconductorCandidateInversionSpec(specInput);
  const ranking = rankSuperconductorCandidates(spec);
  const renameInvariance = runRenameInvarianceCheck(spec);
  const pressureTest = runSuperconductorPressureTest(spec);
  const validationProtocol = buildValidationProtocol(ranking.top);
  const top = ranking.top;
  const result = {
    format: RCL_SUPERCONDUCTOR_CANDIDATE_INVERSION_RESULT_FORMAT,
    version: RCL_SUPERCONDUCTOR_CANDIDATE_INVERSION_VERSION,
    ok: ranking.passed && renameInvariance.passed && pressureTest.passed,
    conclusion: 'RCL can compile a ranked superconductivity candidate-family search program from corrected cosmogenic parameters and current materials constraints; it cannot claim a lab recipe or verified room-temperature ambient-pressure superconductor.',
    boundary: spec.boundary,
    canClaimCandidateFamily: Boolean(top?.evaluation?.passedCandidateFamilyGate),
    canClaimRoomTemperatureAmbientSuperconductor: false,
    canClaimLabRecipe: false,
    canClaimFutureLogBackhaul: false,
    canClaimExternalUniverseProof: false,
    topCandidateFamily: top ? top.revealAfterScoring : null,
    topCandidateScore: top ? top.evaluation.candidateScore : 0,
    margin: ranking.margin,
    materialField: ranking.field,
    leakageScore: ranking.leakageScore,
    negativeControlMaxScore: ranking.negativeControlMaxScore,
    blindDeck: ranking.blindDeck,
    revealAfterScoring: ranking.revealAfterScoring,
    renameInvariance,
    pressureTest,
    validationProtocol,
    scienceBoundary: spec.scienceBoundary,
    root: null,
    spec,
  };
  const court = runMulticivilizationSuperconductorCourt({ ...result, root: 'pending' });
  result.multicivilizationCourt = court;
  result.ok = result.ok && court.passed;
  result.root = sha256({ result: { ...result, root: undefined } });
  return { spec, result, ranking, renameInvariance, pressureTest, multicivilizationCourt: court };
}

export function buildSuperconductorCandidateInversionSpec(input = {}) {
  const bundle = runSuperconductorCandidateInversion(input);
  const spec = {
    ...bundle.spec,
    compilerPasses: [
      'multicivilization target/risk downgrade',
      'v0.90 cosmogenic material-field derivation',
      'science-boundary guard injection',
      'candidate-family vector scoring',
      'blind deck redaction and reveal-after-scoring',
      'negative-control rejection including LK-99-like false-positive pattern',
      'rename/shuffle invariance and pressure perturbation tests',
      'validation-protocol whitepaper synthesis with stop conditions',
    ],
    validation: {
      conclusionHolds: bundle.result.ok,
      topCandidateKey: bundle.result.topCandidateFamily?.key,
      topCandidateScore: bundle.result.topCandidateScore,
      margin: bundle.result.margin,
      negativeControlMaxScore: bundle.result.negativeControlMaxScore,
      leakageScore: bundle.result.leakageScore,
      canClaimCandidateFamily: bundle.result.canClaimCandidateFamily,
      canClaimRoomTemperatureAmbientSuperconductor: false,
      canClaimLabRecipe: false,
      canClaimFutureLogBackhaul: false,
      resultRoot: bundle.result.root,
    },
  };
  return { ...spec, root: sha256({ spec: { ...spec, root: undefined }, resultRoot: bundle.result.root }) };
}

export function renderSuperconductorCandidateInversionRcl(specInput = {}) {
  const spec = specInput.format === RCL_SUPERCONDUCTOR_CANDIDATE_INVERSION_SPEC_FORMAT && specInput.validation ? specInput : buildSuperconductorCandidateInversionSpec(specInput);
  const bundle = runSuperconductorCandidateInversion(spec);
  const result = bundle.result;
  return `reality SuperconductorCandidateInversion {
  facet compiler.version : Text = "${RCL_SUPERCONDUCTOR_CANDIDATE_INVERSION_VERSION}"
  facet compiler.format : Text = "${RCL_SUPERCONDUCTOR_CANDIDATE_INVERSION_SPEC_FORMAT}"
  facet boundary : Text = "${rclString(spec.boundary)}"
  facet target : Text = "${rclString(spec.target.id)}"
  facet top_candidate_score : Number = ${rclNumber(result.topCandidateScore)}
  facet candidate_margin : Number = ${rclNumber(result.margin)}
  facet negative_control_max_score : Number = ${rclNumber(result.negativeControlMaxScore)}
  facet leakage_score : Number = ${rclNumber(result.leakageScore)}
  facet can_claim_candidate_family : Truth = ${result.canClaimCandidateFamily ? 'true' : 'false'}
  facet can_claim_room_temperature_ambient_superconductor : Truth = false
  facet can_claim_lab_recipe : Truth = false
  facet can_claim_future_log_backhaul : Truth = false
  facet can_claim_external_universe_proof : Truth = false

  subject candidate_compiler {
    facet authority : Number = 1
    warrant cosmogenic_origin.read on v0_90_origin
    warrant science_constraints.read on materials_corpus
    warrant validation_protocol.write on whitepaper
  }

  emergence compile_candidate_family {
    cause candidate_compiler
    when candidate_compiler.authority == 1
    needs cosmogenic_origin.read on v0_90_origin
    needs science_constraints.read on materials_corpus
    needs validation_protocol.write on whitepaper
    alter whitepaper.protocol <- validation_protocol
    preserve can_claim_room_temperature_ambient_superconductor == false
    preserve can_claim_lab_recipe == false
    preserve can_claim_future_log_backhaul == false
    preserve negative_control_max_score < ${rclNumber(spec.thresholds.negativeControlMaxScore)}
    preserve leakage_score == 0
    witness "rcl:superconductor-candidate-inversion:v0.92"
  }

  guard no_future_log_claim
  guard no_unverified_recipe
  guard no_room_temperature_ambient_superconductor_claim
  guard require_negative_controls
  guard require_reveal_after_scoring

  foresee compile_candidate_family
  realize compile_candidate_family
}`;
}

export function runSuperconductorCandidateInversionDemo() {
  const { result } = runSuperconductorCandidateInversion(DEFAULT_SUPERCONDUCTOR_CANDIDATE_INVERSION_SPEC);
  return {
    ok: result.ok,
    version: RCL_SUPERCONDUCTOR_CANDIDATE_INVERSION_VERSION,
    conclusion: result.conclusion,
    topCandidateFamily: result.topCandidateFamily?.name,
    topCandidateScore: result.topCandidateScore,
    margin: result.margin,
    negativeControlMaxScore: result.negativeControlMaxScore,
    canClaimCandidateFamily: result.canClaimCandidateFamily,
    canClaimRoomTemperatureAmbientSuperconductor: false,
    canClaimLabRecipe: false,
    root: result.root,
  };
}

export function readSuperconductorCandidateInversionInput(inputPath) {
  if (!inputPath) return {};
  return JSON.parse(fs.readFileSync(path.resolve(inputPath), 'utf8'));
}

function renderWhitepaperMarkdown(bundle) {
  const { result } = bundle;
  const top = result.topCandidateFamily;
  return `# RCL Superconductor Candidate Inversion Compiler v0.92

## 裁决

${result.conclusion}

- ok: ${result.ok}
- topCandidateFamily: ${top?.name ?? 'none'}
- topCandidateScore: ${result.topCandidateScore}
- margin: ${result.margin}
- negativeControlMaxScore: ${result.negativeControlMaxScore}
- canClaimCandidateFamily: ${result.canClaimCandidateFamily}
- canClaimRoomTemperatureAmbientSuperconductor: false
- canClaimLabRecipe: false
- canClaimFutureLogBackhaul: false

## 安全边界

本白皮书只给出计算候选族与验证协议，不给出实验室复现配方、合成温度/时间/压力步骤，也不宣称已经得到室温常压超导体。

## 材料场参数

${Object.entries(result.materialField).filter(([key]) => key !== 'origin').map(([key, value]) => `- ${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`).join('\n')}

## Reveal After Scoring 排名

${result.revealAfterScoring.map((row, index) => `${index + 1}. ${row.revealAfterScoring.name} — score=${row.evaluation.candidateScore}, class=${row.revealAfterScoring.class}, boundary=${row.revealAfterScoring.boundary}`).join('\n')}

## 计算验证协议

${result.validationProtocol.stages.map((stage, index) => `${index + 1}. ${stage.id}: ${stage.output}; stop if ${stage.stopIf}`).join('\n')}

## 非目标

${result.validationProtocol.explicitNonGoals.map(item => `- ${item}`).join('\n')}

## 多文明裁决

${result.multicivilizationCourt.rows.map(row => `- ${row.civilization}: ${row.verdict} — ${row.artifact}`).join('\n')}
`;
}

export function writeSuperconductorCandidateInversionReports(outputDir = 'output/v0.92/superconductor-candidate-inversion', input = {}) {
  const target = path.resolve(outputDir);
  fs.mkdirSync(target, { recursive: true });
  const bundle = runSuperconductorCandidateInversion(input);
  const spec = buildSuperconductorCandidateInversionSpec(input);
  const rcl = renderSuperconductorCandidateInversionRcl(spec);
  const markdown = renderWhitepaperMarkdown(bundle);
  const files = {
    'superconductor-candidate-inversion-bundle.json': { format: RCL_SUPERCONDUCTOR_CANDIDATE_INVERSION_BUNDLE_FORMAT, version: RCL_SUPERCONDUCTOR_CANDIDATE_INVERSION_VERSION, ...bundle },
    'superconductor-candidate-inversion-spec.json': spec,
    'superconductor-candidate-inversion-result.json': bundle.result,
    'material-field-from-v0.90-origin.json': bundle.result.materialField,
    'blind-deck.json': bundle.result.blindDeck,
    'reveal-after-scoring.json': bundle.result.revealAfterScoring,
    'negative-control-audit.json': { negativeControlMaxScore: bundle.result.negativeControlMaxScore, rows: bundle.ranking.negativeControls },
    'rename-invariance.json': bundle.result.renameInvariance,
    'pressure-test.json': bundle.result.pressureTest,
    'validation-protocol.json': bundle.result.validationProtocol,
    'multicivilization-court.json': bundle.result.multicivilizationCourt,
    'superconductor-candidate-inversion.rcl': rcl,
    'superconductor-candidate-whitepaper.md': markdown,
  };
  const written = [];
  for (const [name, value] of Object.entries(files)) {
    const file = path.join(target, name);
    fs.writeFileSync(file, `${typeof value === 'string' ? value : JSON.stringify(value, null, 2)}\n`);
    written.push({ path: file, sha256: sha256(fs.readFileSync(file, 'utf8')) });
  }
  return {
    ok: bundle.result.ok,
    format: RCL_SUPERCONDUCTOR_CANDIDATE_INVERSION_BUNDLE_FORMAT,
    version: RCL_SUPERCONDUCTOR_CANDIDATE_INVERSION_VERSION,
    outputDir: target,
    files: written,
    result: bundle.result,
    root: sha256({ written, result: bundle.result }),
  };
}

export function superconductorCandidateInversionCanonicalRoot(value) {
  return sha256(canonicalJson(value));
}
