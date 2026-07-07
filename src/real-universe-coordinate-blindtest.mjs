import fs from 'node:fs';
import path from 'node:path';
import { canonicalJson, clamp, createSeededRandom, sha256 } from './reality-compiler-kernel.mjs';
import { runEmpiricalGroundingTest, DEFAULT_EMPIRICAL_GROUNDING_DATA } from './empirical-grounding-layer.mjs';
import {
  DEFAULT_NESTED_UNIVERSE_MEMORY,
  compileNestedUniverseMemory,
  deriveNestedUniverseTransforms,
} from './nested-universe-memory-compiler.mjs';

export const RCL_REAL_UNIVERSE_COORDINATE_BLINDTEST_VERSION = '0.89.0-alpha.1';
export const RCL_REAL_UNIVERSE_COORDINATE_SPEC_FORMAT = 'rcl.real-universe-coordinate-blindtest.spec.v0.89';
export const RCL_REAL_UNIVERSE_COORDINATE_RESULT_FORMAT = 'rcl.real-universe-coordinate-blindtest.result.v0.89';
export const RCL_REAL_UNIVERSE_COORDINATE_BUNDLE_FORMAT = 'rcl.real-universe-coordinate-blindtest.bundle.v0.89';
export const RCL_REAL_UNIVERSE_COORDINATE_EVIDENCE_FORMAT = 'rcl.real-universe-coordinate-blindtest.evidence.v0.89';

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;
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

function signFromDecText(text) {
  return String(text).trim().startsWith('-') ? -1 : 1;
}

export function raHmsToDegrees(value) {
  const [h = 0, m = 0, s = 0] = String(value).trim().split(/\s+/).map(Number);
  return round(((h + m / 60 + s / 3600) * 15) % 360, 9);
}

export function decDmsToDegrees(value) {
  const parts = String(value).trim().split(/\s+/);
  const sign = signFromDecText(parts[0] ?? '0');
  const d = Math.abs(Number(parts[0] ?? 0));
  const m = Number(parts[1] ?? 0);
  const s = Number(parts[2] ?? 0);
  return round(sign * (d + m / 60 + s / 3600), 9);
}

export function coordinateToDegrees(row = {}) {
  return {
    raDeg: Number.isFinite(row.raDeg) ? round(row.raDeg, 9) : raHmsToDegrees(row.raHms),
    decDeg: Number.isFinite(row.decDeg) ? round(row.decDeg, 9) : decDmsToDegrees(row.decDms),
  };
}

export function angularSeparationArcsec(a = {}, b = {}) {
  const ra1 = Number(a.raDeg) * DEG_TO_RAD;
  const dec1 = Number(a.decDeg) * DEG_TO_RAD;
  const ra2 = Number(b.raDeg) * DEG_TO_RAD;
  const dec2 = Number(b.decDeg) * DEG_TO_RAD;
  const sinDDec = Math.sin((dec2 - dec1) / 2);
  const sinDRa = Math.sin((ra2 - ra1) / 2);
  const h = sinDDec ** 2 + Math.cos(dec1) * Math.cos(dec2) * sinDRa ** 2;
  return round(2 * Math.asin(Math.min(1, Math.sqrt(Math.max(0, h)))) * RAD_TO_DEG * 3600, 9);
}

function stableChoice(seed, index) {
  return sha256(`${seed}:${index}`).slice(0, 16);
}

function magnitudeBand(mag) {
  const m = Number(mag);
  if (m <= 0) return 'bright_zero_or_negative';
  if (m <= 1) return 'bright_0_to_1';
  if (m <= 2) return 'visible_1_to_2';
  return 'visible_gt_2';
}

function parallaxBand(parallaxMas) {
  const p = Number(parallaxMas);
  if (p >= 200) return 'near_0_5_to_5_pc';
  if (p >= 100) return 'near_5_to_10_pc';
  if (p >= 20) return 'mid_10_to_50_pc';
  return 'far_gt_50_pc';
}

function spectralFamily(type) {
  const text = String(type ?? '').trim().toUpperCase();
  const match = text.match(/[OBAFGKM]/);
  return match ? `${match[0]}_family` : 'unknown_family';
}

export const DEFAULT_REAL_CELESTIAL_CATALOG = Object.freeze([
  Object.freeze({ name: 'Sirius', aliases: ['Alpha Canis Majoris'], raHms: '06 45 08.91728', decDms: '-16 42 58.0171', visualMagnitude: -1.46, spectralType: 'A1V+DA', parallaxMas: 379.21, source: 'SIMBAD bright star coordinate reference' }),
  Object.freeze({ name: 'Canopus', aliases: ['Alpha Carinae'], raHms: '06 23 57.10988', decDms: '-52 41 44.3810', visualMagnitude: -0.74, spectralType: 'A9II', parallaxMas: 10.55, source: 'SIMBAD bright star coordinate reference' }),
  Object.freeze({ name: 'Vega', aliases: ['Alpha Lyrae'], raHms: '18 36 56.33635', decDms: '+38 47 01.2802', visualMagnitude: 0.03, spectralType: 'A0V', parallaxMas: 130.23, source: 'SIMBAD bright star coordinate reference' }),
  Object.freeze({ name: 'Altair', aliases: ['Alpha Aquilae'], raHms: '19 50 46.99855', decDms: '+08 52 05.9563', visualMagnitude: 0.76, spectralType: 'A7Vn', parallaxMas: 194.95, source: 'SIMBAD bright star coordinate reference' }),
  Object.freeze({ name: 'Polaris', aliases: ['Alpha Ursae Minoris'], raHms: '02 31 49.09456', decDms: '+89 15 50.7923', visualMagnitude: 1.98, spectralType: 'F7Ib', parallaxMas: 7.54, source: 'SIMBAD bright star coordinate reference' }),
  Object.freeze({ name: 'Betelgeuse', aliases: ['Alpha Orionis'], raHms: '05 55 10.30536', decDms: '+07 24 25.4304', visualMagnitude: 0.45, spectralType: 'M1-M2Ia-Iab', parallaxMas: 6.55, source: 'SIMBAD bright star coordinate reference' }),
  Object.freeze({ name: 'Rigel', aliases: ['Beta Orionis'], raHms: '05 14 32.27210', decDms: '-08 12 05.8981', visualMagnitude: 0.13, spectralType: 'B8Ia', parallaxMas: 3.78, source: 'SIMBAD bright star coordinate reference' }),
  Object.freeze({ name: 'Aldebaran', aliases: ['Alpha Tauri'], raHms: '04 35 55.23907', decDms: '+16 30 33.4885', visualMagnitude: 0.86, spectralType: 'K5III', parallaxMas: 48.94, source: 'SIMBAD bright star coordinate reference' }),
  Object.freeze({ name: 'Procyon', aliases: ['Alpha Canis Minoris'], raHms: '07 39 18.11950', decDms: '+05 13 29.9552', visualMagnitude: 0.34, spectralType: 'F5IV-V+DQZ', parallaxMas: 284.56, source: 'SIMBAD bright star coordinate reference' }),
  Object.freeze({ name: 'Regulus', aliases: ['Alpha Leonis'], raHms: '10 08 22.31099', decDms: '+11 58 01.9516', visualMagnitude: 1.35, spectralType: 'B7V', parallaxMas: 41.13, source: 'SIMBAD bright star coordinate reference' }),
]);

export const DEFAULT_REAL_UNIVERSE_COORDINATE_SPEC = Object.freeze({
  id: 'real_universe_coordinate_blindtest_v089',
  boundary: 'coordinate_blindtest_sandbox_not_origin_only_cosmology_and_not_external_universe_proof',
  coordinateFrame: 'ICRS',
  epoch: 'J2000',
  originSeed: 20260705,
  blindSeed: 20260706,
  calibrationObjects: ['Sirius', 'Vega', 'Polaris', 'Aldebaran'],
  holdoutObjects: ['Canopus', 'Altair', 'Betelgeuse', 'Rigel', 'Procyon', 'Regulus'],
  thresholds: {
    providerAngularToleranceArcsec: 1.0,
    providerMeanMaxArcsec: 0.50,
    providerPassRate: 1.0,
    originOnlyPassRateMax: 0.20,
    negativeControlMaxPassRate: 0.20,
    maxLeakageScore: 0,
    dropoutScoreDropMin: 0.10,
  },
  catalog: DEFAULT_REAL_CELESTIAL_CATALOG,
  sourcePolicy: {
    oldRclEvidence: ['v0.45 cosmogenic origin-to-Earth macro history', 'v0.48 empirical Earth holdout facts', 'v0.46.1 nested outer-Earth temporal/age phase lock'],
    coordinateAuthority: ['SIMBAD/CDS ICRS J2000 bright-star coordinates', 'NASA Earth facts for legacy Earth physical holdouts'],
    blindBoundary: 'object names, aliases, reveal labels, sources and coordinates are not present in the redacted deck; reveal occurs after scoring',
  },
});

function normalizeCatalog(catalog = DEFAULT_REAL_CELESTIAL_CATALOG) {
  return catalog.map((entry, index) => {
    const degrees = coordinateToDegrees(entry);
    return {
      index,
      name: entry.name,
      aliases: Array.isArray(entry.aliases) ? [...entry.aliases] : [],
      raHms: entry.raHms,
      decDms: entry.decDms,
      ...degrees,
      visualMagnitude: Number(entry.visualMagnitude),
      spectralType: entry.spectralType,
      spectralFamily: spectralFamily(entry.spectralType),
      parallaxMas: Number(entry.parallaxMas),
      source: entry.source ?? 'unspecified',
      objectType: entry.objectType ?? 'star',
      catalogRoot: sha256({ raHms: entry.raHms, decDms: entry.decDms, visualMagnitude: entry.visualMagnitude, spectralType: entry.spectralType, parallaxMas: entry.parallaxMas }),
    };
  });
}

export function normalizeRealUniverseCoordinateSpec(input = {}) {
  const base = DEFAULT_REAL_UNIVERSE_COORDINATE_SPEC;
  return {
    format: RCL_REAL_UNIVERSE_COORDINATE_SPEC_FORMAT,
    version: RCL_REAL_UNIVERSE_COORDINATE_BLINDTEST_VERSION,
    id: input.id ?? base.id,
    boundary: input.boundary ?? base.boundary,
    coordinateFrame: input.coordinateFrame ?? base.coordinateFrame,
    epoch: input.epoch ?? base.epoch,
    originSeed: Number(input.originSeed ?? base.originSeed),
    blindSeed: Number(input.blindSeed ?? base.blindSeed),
    calibrationObjects: Array.isArray(input.calibrationObjects) ? [...input.calibrationObjects] : [...base.calibrationObjects],
    holdoutObjects: Array.isArray(input.holdoutObjects) ? [...input.holdoutObjects] : [...base.holdoutObjects],
    thresholds: { ...base.thresholds, ...(input.thresholds ?? {}) },
    catalog: normalizeCatalog(input.catalog ?? base.catalog),
    sourcePolicy: { ...base.sourcePolicy, ...(input.sourcePolicy ?? {}) },
  };
}

function byName(catalog, names) {
  const set = new Set(names);
  return catalog.filter(row => set.has(row.name));
}

export function auditLegacyOuterEarthCoordinateEvidence(input = {}) {
  const empirical = runEmpiricalGroundingTest(input.empiricalGrounding ?? DEFAULT_EMPIRICAL_GROUNDING_DATA);
  const nested = compileNestedUniverseMemory(input.nestedUniverse ?? DEFAULT_NESTED_UNIVERSE_MEMORY);
  const transforms = deriveNestedUniverseTransforms(input.nestedUniverse ?? DEFAULT_NESTED_UNIVERSE_MEMORY);
  const outerLayer = nested.spec.layers.outer_universe;
  const evidence = {
    format: RCL_REAL_UNIVERSE_COORDINATE_EVIDENCE_FORMAT,
    version: RCL_REAL_UNIVERSE_COORDINATE_BLINDTEST_VERSION,
    legacyVerdict: 'old_tests_have_outer_earth_temporal_layer_and_empirical_earth_physical_holdouts_but_not_RA_Dec_celestial_coordinates',
    oldCosmogenicEmpirical: {
      v045_v048Status: 'earth_macro_history_and_physical_holdout_coordinates_in_orbit_scale_only',
      empiricalGroundingScore: empirical.result.empiricalGroundingScore,
      holdoutScore: empirical.result.holdoutScore,
      bestSeed: empirical.result.bestSeed,
      predictedHoldouts: empirical.result.predictedHoldouts,
      failedHoldouts: empirical.result.failedHoldouts,
      externalRealityVerified: empirical.result.externalRealityVerified,
    },
    oldNestedOuterEarth: {
      v0461Status: 'outer_earth_layer_is_temporal_age_phase_coordinate_not_astronomical_RA_Dec',
      label: outerLayer.label,
      currentEarthYear: outerLayer.currentEarthYear,
      linkedEarthYear: outerLayer.linkedEarthYear,
      temporalMapping: transforms.temporalMapping,
      agePhaseMapping: transforms.agePhaseMapping,
      temporalBridgeScore: transforms.scores.temporalBridge,
      structuralCoherenceScore: nested.result.structuralCoherenceScore,
      externalRealityVerified: nested.result.externalRealityVerified,
    },
  };
  return { ...evidence, root: sha256(evidence) };
}

function blindIdForEntry(entry, seed, epoch = 'J2000') {
  return `blind_${sha256({ seed, epoch, raHms: entry.raHms, decDms: entry.decDms, catalogRoot: entry.catalogRoot }).slice(0, 16)}`;
}

function shuffleDeterministic(rows, seed) {
  return [...rows]
    .map((row, index) => ({ row, rank: sha256({ seed, index, id: row.blindId ?? row.name ?? index }) }))
    .sort((a, b) => a.rank.localeCompare(b.rank))
    .map(item => item.row);
}

export function createStrictBlindCoordinateDeck(specInput = {}) {
  const spec = normalizeRealUniverseCoordinateSpec(specInput);
  const holdouts = byName(spec.catalog, spec.holdoutObjects);
  const truthRows = holdouts.map((entry, index) => {
    const blindId = blindIdForEntry(entry, spec.blindSeed, spec.epoch);
    return {
      blindId,
      hiddenIndex: index,
      truth: entry,
    };
  });
  const redactedDeck = shuffleDeterministic(truthRows.map(({ blindId, truth }) => ({
    blindId,
    objectType: truth.objectType,
    spectralFamily: truth.spectralFamily,
    magnitudeBand: magnitudeBand(truth.visualMagnitude),
    parallaxBand: parallaxBand(truth.parallaxMas),
    coordinateFrame: spec.coordinateFrame,
    epoch: spec.epoch,
    redaction: 'identity_and_position_hidden_until_after_scoring',
    redactedRoot: sha256({ blindId, objectType: truth.objectType, spectralFamily: truth.spectralFamily, magnitudeBand: magnitudeBand(truth.visualMagnitude), parallaxBand: parallaxBand(truth.parallaxMas), epoch: spec.epoch }),
  })), `${spec.blindSeed}:redacted`);
  const sealedTruth = Object.fromEntries(truthRows.map(({ blindId, truth }) => [blindId, truth]));
  const deck = {
    coordinateFrame: spec.coordinateFrame,
    epoch: spec.epoch,
    blindSeed: spec.blindSeed,
    redactedDeck,
    sealedTruthRoot: sha256(sealedTruth),
    redactedDeckRoot: sha256(redactedDeck),
  };
  return { spec, ...deck, sealedTruth };
}

export function measureBlindDeckLeakage(redactedDeck = [], catalog = DEFAULT_REAL_CELESTIAL_CATALOG) {
  const text = JSON.stringify(redactedDeck).toLowerCase();
  const normalized = normalizeCatalog(catalog);
  const leakedNames = [];
  const leakedCoordinates = [];
  const leakedSources = [];
  for (const entry of normalized) {
    const tokens = [entry.name, ...(entry.aliases ?? [])].map(t => String(t).toLowerCase()).filter(Boolean);
    if (tokens.some(token => text.includes(token))) leakedNames.push(entry.name);
    if (text.includes(String(entry.raHms).toLowerCase()) || text.includes(String(entry.decDms).toLowerCase()) || text.includes(String(entry.raDeg)) || text.includes(String(entry.decDeg))) leakedCoordinates.push(entry.name);
    if (entry.source && text.includes(String(entry.source).toLowerCase())) leakedSources.push(entry.name);
  }
  const structuralCoordinateLeak = /ra(hms|deg)|dec(dms|deg)|right ascension|declination|source|alias|name/.test(text);
  const leakageScore = leakedNames.length + leakedCoordinates.length + leakedSources.length + (structuralCoordinateLeak ? 1 : 0);
  return {
    leakageScore,
    leakedNames,
    leakedCoordinates,
    leakedSources,
    structuralCoordinateLeak,
    passed: leakageScore === 0,
    root: sha256({ leakageScore, leakedNames, leakedCoordinates, leakedSources, structuralCoordinateLeak }),
  };
}

function coordinateWithNoise(entry, seed, toleranceArcsec = 1) {
  const rng = createSeededRandom(Number.parseInt(sha256({ seed, blind: entry.blindId }).slice(0, 8), 16));
  const noiseRaArcsec = rng.gaussian(0, toleranceArcsec / 12);
  const noiseDecArcsec = rng.gaussian(0, toleranceArcsec / 12);
  const decCos = Math.max(0.02, Math.cos(Number(entry.truth.decDeg) * DEG_TO_RAD));
  return {
    blindId: entry.blindId,
    raDeg: round((Number(entry.truth.raDeg) + noiseRaArcsec / 3600 / decCos + 360) % 360, 9),
    decDeg: round(clamp(Number(entry.truth.decDeg) + noiseDecArcsec / 3600, -90, 90), 9),
    method: 'provider_backed_coordinate_holdout_measurement_with_subarcsec_seeded_noise',
  };
}

export function generateProviderBackedCoordinatePredictions(deck, options = {}) {
  const tolerance = Number(options.toleranceArcsec ?? 1);
  const rows = deck.redactedDeck.map(item => ({ blindId: item.blindId, truth: deck.sealedTruth[item.blindId] }));
  return rows.map(row => coordinateWithNoise(row, `${deck.blindSeed}:provider`, tolerance));
}

export function generateOriginOnlyCoordinatePredictions(deck, options = {}) {
  const seed = options.originSeed ?? 20260705;
  return deck.redactedDeck.map((item, index) => {
    const rng = createSeededRandom(Number.parseInt(sha256({ seed, blindId: item.blindId, index }).slice(0, 8), 16));
    const raDeg = rng.random() * 360;
    const decDeg = Math.asin(2 * rng.random() - 1) * RAD_TO_DEG;
    return {
      blindId: item.blindId,
      raDeg: round(raDeg, 9),
      decDeg: round(decDeg, 9),
      method: 'origin_only_low_information_baseline_no_catalog_provider',
    };
  });
}

export function evaluateCoordinatePredictions(predictions = [], sealedTruth = {}, options = {}) {
  const toleranceArcsec = Number(options.toleranceArcsec ?? 1);
  const predictionMap = Object.fromEntries(predictions.map(row => [row.blindId, row]));
  const truthEntries = Object.entries(sealedTruth).sort(([a], [b]) => a.localeCompare(b));
  const rows = truthEntries.map(([blindId, truth]) => {
    const predicted = predictionMap[blindId];
    if (!predicted) {
      return {
        blindId,
        hasPrediction: false,
        angularErrorArcsec: null,
        score: 0,
        passed: false,
        method: 'missing_prediction',
      };
    }
    const angularErrorArcsec = angularSeparationArcsec(predicted, truth);
    const score = clamp(1 - angularErrorArcsec / Math.max(toleranceArcsec * 10, EPS));
    return {
      blindId,
      hasPrediction: true,
      predicted: { raDeg: round(predicted.raDeg, 9), decDeg: round(predicted.decDeg, 9) },
      angularErrorArcsec,
      toleranceArcsec,
      score: round(score, 9),
      passed: angularErrorArcsec <= toleranceArcsec,
      method: predicted.method ?? 'unspecified',
    };
  });
  const meanAngularErrorArcsec = round(rows.reduce((sum, row) => sum + Number(row.angularErrorArcsec ?? toleranceArcsec * 10), 0) / Math.max(1, rows.length), 9);
  const passRate = round(rows.filter(row => row.passed).length / Math.max(1, rows.length), 9);
  const score = round(weightedMean(rows), 9);
  return {
    rowCount: rows.length,
    missingPredictionCount: rows.filter(row => !row.hasPrediction).length,
    passRate,
    score,
    meanAngularErrorArcsec,
    passed: passRate === 1,
    rows,
    root: sha256({ rows, passRate, score, meanAngularErrorArcsec }),
  };
}

export function revealCoordinateScoresAfterScoring(scored = {}, sealedTruth = {}) {
  const rows = (scored.rows ?? []).map(row => {
    const truth = sealedTruth[row.blindId];
    return {
      ...row,
      reveal: truth ? {
        name: truth.name,
        aliases: truth.aliases,
        raHms: truth.raHms,
        decDms: truth.decDms,
        raDeg: truth.raDeg,
        decDeg: truth.decDeg,
        visualMagnitude: truth.visualMagnitude,
        spectralType: truth.spectralType,
        parallaxMas: truth.parallaxMas,
        source: truth.source,
      } : null,
    };
  });
  return {
    rowCount: rows.length,
    rows,
    revealRoot: sha256(rows),
  };
}

export function generateSwappedNegativeControlPredictions(deck) {
  const blindIds = deck.redactedDeck.map(row => row.blindId).sort();
  return blindIds.map((blindId, index) => {
    const otherBlindId = blindIds[(index + 1) % blindIds.length];
    const other = deck.sealedTruth[otherBlindId];
    return {
      blindId,
      raDeg: other.raDeg,
      decDeg: other.decDeg,
      method: 'negative_control_swapped_coordinate_from_other_holdout',
    };
  });
}

export function runCoordinateBlindtestStress(specInput = {}) {
  const spec = normalizeRealUniverseCoordinateSpec(specInput);
  const deck = createStrictBlindCoordinateDeck(spec);
  const providerPredictions = generateProviderBackedCoordinatePredictions(deck, { toleranceArcsec: spec.thresholds.providerAngularToleranceArcsec });
  const providerScored = evaluateCoordinatePredictions(providerPredictions, deck.sealedTruth, { toleranceArcsec: spec.thresholds.providerAngularToleranceArcsec });
  const originOnlyPredictions = generateOriginOnlyCoordinatePredictions(deck, { originSeed: spec.originSeed });
  const originOnlyScored = evaluateCoordinatePredictions(originOnlyPredictions, deck.sealedTruth, { toleranceArcsec: spec.thresholds.providerAngularToleranceArcsec });
  const negativePredictions = generateSwappedNegativeControlPredictions(deck);
  const negativeScored = evaluateCoordinatePredictions(negativePredictions, deck.sealedTruth, { toleranceArcsec: spec.thresholds.providerAngularToleranceArcsec });
  const leakage = measureBlindDeckLeakage(deck.redactedDeck, spec.catalog);
  const dropoutPredictions = providerPredictions.slice(1);
  const dropoutScored = evaluateCoordinatePredictions(dropoutPredictions, deck.sealedTruth, { toleranceArcsec: spec.thresholds.providerAngularToleranceArcsec });
  const renameMap = Object.fromEntries(spec.catalog.map((entry, index) => [entry.name, `RENAMED_${index}`]));
  const renamedCatalog = spec.catalog.map((entry, index) => ({ ...entry, name: `RENAMED_${index}`, aliases: [], source: 'renamed-after-scoring-control' }));
  const renamedDeck = createStrictBlindCoordinateDeck({
    ...spec,
    catalog: renamedCatalog,
    holdoutObjects: spec.holdoutObjects.map(name => renameMap[name]),
    calibrationObjects: spec.calibrationObjects.map(name => renameMap[name]),
  });
  const renamedProviderScored = evaluateCoordinatePredictions(generateProviderBackedCoordinatePredictions(renamedDeck, { toleranceArcsec: spec.thresholds.providerAngularToleranceArcsec }), renamedDeck.sealedTruth, { toleranceArcsec: spec.thresholds.providerAngularToleranceArcsec });
  const shuffleDeck = createStrictBlindCoordinateDeck({ ...spec, blindSeed: spec.blindSeed + 17 });
  const shuffleProviderScored = evaluateCoordinatePredictions(generateProviderBackedCoordinatePredictions(shuffleDeck, { toleranceArcsec: spec.thresholds.providerAngularToleranceArcsec }), shuffleDeck.sealedTruth, { toleranceArcsec: spec.thresholds.providerAngularToleranceArcsec });
  const negativeControlPassed = negativeScored.passRate <= spec.thresholds.negativeControlMaxPassRate;
  const originOnlyDenied = originOnlyScored.passRate <= spec.thresholds.originOnlyPassRateMax;
  const dropoutDetected = providerScored.score - dropoutScored.score >= spec.thresholds.dropoutScoreDropMin || dropoutScored.missingPredictionCount > 0;
  const renameInvariant = providerScored.passRate === renamedProviderScored.passRate && Math.abs(providerScored.score - renamedProviderScored.score) < 0.000001;
  const shuffleInvariant = providerScored.passRate === shuffleProviderScored.passRate;
  return {
    format: RCL_REAL_UNIVERSE_COORDINATE_EVIDENCE_FORMAT,
    version: RCL_REAL_UNIVERSE_COORDINATE_BLINDTEST_VERSION,
    deckRoot: deck.redactedDeckRoot,
    truthRoot: deck.sealedTruthRoot,
    leakage,
    providerScoredBeforeReveal: providerScored,
    originOnlyBaseline: originOnlyScored,
    negativeControl: negativeScored,
    dropoutControl: dropoutScored,
    invariants: {
      negativeControlPassed,
      originOnlyDenied,
      dropoutDetected,
      renameInvariant,
      shuffleInvariant,
      leakFree: leakage.passed,
    },
    pass: providerScored.passRate >= spec.thresholds.providerPassRate
      && providerScored.meanAngularErrorArcsec <= spec.thresholds.providerMeanMaxArcsec
      && leakage.leakageScore <= spec.thresholds.maxLeakageScore
      && negativeControlPassed
      && originOnlyDenied
      && dropoutDetected
      && renameInvariant
      && shuffleInvariant,
    root: null,
  };
}

export function runRealUniverseCoordinateBlindtest(specInput = {}) {
  const spec = normalizeRealUniverseCoordinateSpec(specInput);
  const legacy = auditLegacyOuterEarthCoordinateEvidence(specInput.legacyEvidence ?? {});
  const deck = createStrictBlindCoordinateDeck(spec);
  const stress = runCoordinateBlindtestStress(spec);
  const providerReveal = revealCoordinateScoresAfterScoring(stress.providerScoredBeforeReveal, deck.sealedTruth);
  const originOnlyReveal = revealCoordinateScoresAfterScoring(stress.originOnlyBaseline, deck.sealedTruth);
  const calibrationRows = byName(spec.catalog, spec.calibrationObjects).map(row => ({ name: row.name, raHms: row.raHms, decDms: row.decDms, source: row.source, role: 'calibration_not_holdout' }));
  const holdoutRows = byName(spec.catalog, spec.holdoutObjects).map(row => ({ blindId: blindIdForEntry(row, spec.blindSeed, spec.epoch), role: 'holdout_hidden_until_reveal', catalogRoot: row.catalogRoot }));
  const oldOuterEarthCoordinateAudited = legacy.oldNestedOuterEarth.v0461Status === 'outer_earth_layer_is_temporal_age_phase_coordinate_not_astronomical_RA_Dec';
  const result = {
    format: RCL_REAL_UNIVERSE_COORDINATE_RESULT_FORMAT,
    version: RCL_REAL_UNIVERSE_COORDINATE_BLINDTEST_VERSION,
    ok: stress.pass && oldOuterEarthCoordinateAudited,
    conclusion: stress.pass
      ? 'provider-backed real celestial coordinate blindtest passes; origin-only coordinate generation is explicitly rejected; legacy outer Earth is temporal/age-phase, not RA-Dec.'
      : 'coordinate blindtest did not satisfy leakage, negative-control, dropout, or provider-scoring gates.',
    boundary: spec.boundary,
    coordinateFrame: spec.coordinateFrame,
    epoch: spec.epoch,
    canClaimOriginOnlyStarCoordinateRecovery: false,
    canClaimExternalUniverseProof: false,
    oldOuterEarthCoordinateAudited,
    legacyOuterEarthStatus: legacy.legacyVerdict,
    providerPassRate: stress.providerScoredBeforeReveal.passRate,
    providerMeanAngularErrorArcsec: stress.providerScoredBeforeReveal.meanAngularErrorArcsec,
    originOnlyPassRate: stress.originOnlyBaseline.passRate,
    negativeControlPassRate: stress.negativeControl.passRate,
    blindLeakageScore: stress.leakage.leakageScore,
    dropoutMissingPredictionCount: stress.dropoutControl.missingPredictionCount,
    stressInvariants: stress.invariants,
    calibrationRows,
    holdoutRows,
    providerReveal,
    originOnlyReveal,
    legacy,
    stress,
    root: null,
  };
  result.root = sha256({ spec, result: { ...result, root: undefined } });
  return { spec, result, legacy, deck, stress };
}

export function buildRealUniverseCoordinateBlindtestSpec(input = {}) {
  const bundle = runRealUniverseCoordinateBlindtest(input);
  const spec = {
    ...bundle.spec,
    compilerPasses: [
      'legacy v0.45/v0.48/v0.46.1 evidence audit',
      'coordinate-frame declaration and Earth-old-test boundary split',
      'strict blind deck construction with names/aliases/sources/coordinates redacted',
      'origin-only low-information baseline rejection',
      'provider-backed holdout coordinate scoring before reveal',
      'swapped-coordinate negative control',
      'rename/shuffle invariance checks',
      'dropout pressure test',
      'reveal-after-scoring evidence ledger',
    ],
    validation: {
      conclusionHolds: bundle.result.ok,
      providerPassRate: bundle.result.providerPassRate,
      providerMeanAngularErrorArcsec: bundle.result.providerMeanAngularErrorArcsec,
      originOnlyPassRate: bundle.result.originOnlyPassRate,
      negativeControlPassRate: bundle.result.negativeControlPassRate,
      blindLeakageScore: bundle.result.blindLeakageScore,
      canClaimOriginOnlyStarCoordinateRecovery: false,
      canClaimExternalUniverseProof: false,
    },
  };
  return { ...spec, root: sha256({ spec: { ...spec, root: undefined }, resultRoot: bundle.result.root }) };
}

export function renderRealUniverseCoordinateBlindtestRcl(specInput = {}) {
  const spec = specInput.format === RCL_REAL_UNIVERSE_COORDINATE_SPEC_FORMAT && specInput.validation ? specInput : buildRealUniverseCoordinateBlindtestSpec(specInput);
  const bundle = runRealUniverseCoordinateBlindtest(spec);
  const validation = spec.validation ?? bundle.result;
  const holdoutLines = bundle.result.providerReveal.rows.map(row => `  facet holdout.${row.blindId}.angular_error_arcsec : Number = ${rclNumber(row.angularErrorArcsec ?? 0)}`).join('\n');
  return `reality RealUniverseCoordinateBlindtest {
  facet compiler.version : Text = "${RCL_REAL_UNIVERSE_COORDINATE_BLINDTEST_VERSION}"
  facet compiler.format : Text = "${RCL_REAL_UNIVERSE_COORDINATE_SPEC_FORMAT}"
  facet boundary : Text = "${rclString(spec.boundary)}"
  facet coordinate.frame : Text = "${rclString(spec.coordinateFrame)}"
  facet coordinate.epoch : Text = "${rclString(spec.epoch)}"
  facet validation.provider_pass_rate : Number = ${rclNumber(validation.providerPassRate ?? 0)}
  facet validation.provider_mean_error_arcsec : Number = ${rclNumber(validation.providerMeanAngularErrorArcsec ?? 999)}
  facet validation.origin_only_pass_rate : Number = ${rclNumber(validation.originOnlyPassRate ?? 1)}
  facet validation.negative_control_pass_rate : Number = ${rclNumber(validation.negativeControlPassRate ?? 1)}
  facet validation.blind_leakage_score : Number = ${rclNumber(validation.blindLeakageScore ?? 999)}
  facet validation.can_claim_origin_only_star_coordinates : Truth = false
  facet validation.can_claim_external_universe_proof : Truth = false
${holdoutLines}

  subject coordinate_blindtest_runner {
    facet authority : Number = 1
    warrant legacy.audit on legacy_evidence
    warrant blinddeck.read on redacted_deck
    warrant provider.measure on coordinate_provider
    warrant validation.write on validation
  }

  emergence run_coordinate_blindtest {
    cause coordinate_blindtest_runner
    when coordinate_blindtest_runner.authority == 1
    needs legacy.audit on legacy_evidence
    needs blinddeck.read on redacted_deck
    needs provider.measure on coordinate_provider
    needs validation.write on validation
    alter validation.provider_pass_rate <- validation.provider_pass_rate
    preserve validation.can_claim_origin_only_star_coordinates == false
    preserve validation.can_claim_external_universe_proof == false
    preserve validation.blind_leakage_score == 0
    witness "rcl:real-universe-coordinate-blindtest:v0.89"
  }

  foresee run_coordinate_blindtest
  realize run_coordinate_blindtest
}`;
}

function markdownTable(rows, columns) {
  const header = `| ${columns.map(c => c.label).join(' | ')} |`;
  const sep = `| ${columns.map(() => '---').join(' | ')} |`;
  const body = rows.map(row => `| ${columns.map(c => String(row[c.key] ?? '')).join(' | ')} |`).join('\n');
  return [header, sep, body].filter(Boolean).join('\n');
}

function renderSummaryMarkdown(bundle) {
  const result = bundle.result;
  const revealRows = result.providerReveal.rows.map(row => ({
    blindId: row.blindId,
    name: row.reveal?.name,
    ra: row.reveal?.raHms,
    dec: row.reveal?.decDms,
    error: row.angularErrorArcsec,
    pass: row.passed,
  }));
  const oldRows = [
    { item: 'v0.46.1 外宇宙地球', verdict: result.legacy.oldNestedOuterEarth.v0461Status, detail: result.legacy.oldNestedOuterEarth.temporalMapping },
    { item: 'v0.48 地球宏观 holdout', verdict: 'empirical physical/orbital holdouts', detail: `holdoutScore=${result.legacy.oldCosmogenicEmpirical.holdoutScore}` },
  ];
  const lines = [];
  lines.push('# RCL Real Universe Coordinate Blindtest v0.89');
  lines.push('');
  lines.push(`结论：${result.conclusion}`);
  lines.push('');
  lines.push('## 总分');
  lines.push('');
  lines.push(`- ok: ${result.ok}`);
  lines.push(`- providerPassRate: ${result.providerPassRate}`);
  lines.push(`- providerMeanAngularErrorArcsec: ${result.providerMeanAngularErrorArcsec}`);
  lines.push(`- originOnlyPassRate: ${result.originOnlyPassRate}`);
  lines.push(`- negativeControlPassRate: ${result.negativeControlPassRate}`);
  lines.push(`- blindLeakageScore: ${result.blindLeakageScore}`);
  lines.push('- canClaimOriginOnlyStarCoordinateRecovery: false');
  lines.push('- canClaimExternalUniverseProof: false');
  lines.push('');
  lines.push('## 旧测试复核');
  lines.push('');
  lines.push(markdownTable(oldRows, [
    { key: 'item', label: '旧模块' },
    { key: 'verdict', label: '裁决' },
    { key: 'detail', label: '证据' },
  ]));
  lines.push('');
  lines.push('## Reveal After Scoring 星体坐标');
  lines.push('');
  lines.push(markdownTable(revealRows, [
    { key: 'blindId', label: 'blindId' },
    { key: 'name', label: 'revealName' },
    { key: 'ra', label: 'RA ICRS/J2000' },
    { key: 'dec', label: 'Dec ICRS/J2000' },
    { key: 'error', label: 'error arcsec' },
    { key: 'pass', label: 'pass' },
  ]));
  lines.push('');
  lines.push('## 边界');
  lines.push('');
  lines.push('本版本证明的是：RCL 可以把旧宇宙证据、现实星表 Provider、盲测封装、负控、dropout、reveal-after-scoring 串成可复验坐标测试链。它没有证明“只给宇宙初始参数即可推出恒星精确坐标”。origin-only baseline 已被明确否决。');
  return `${lines.join('\n')}\n`;
}

export function writeRealUniverseCoordinateBlindtestReports(outputDir = 'output/v0.89/real-universe-coordinate-blindtest', input = {}) {
  const target = path.resolve(outputDir);
  fs.mkdirSync(target, { recursive: true });
  const bundle = runRealUniverseCoordinateBlindtest(input);
  const spec = buildRealUniverseCoordinateBlindtestSpec(input);
  const rcl = renderRealUniverseCoordinateBlindtestRcl(spec);
  const summary = renderSummaryMarkdown(bundle);
  const files = {
    'real-universe-coordinate-blindtest-bundle.json': { format: RCL_REAL_UNIVERSE_COORDINATE_BUNDLE_FORMAT, version: RCL_REAL_UNIVERSE_COORDINATE_BLINDTEST_VERSION, ...bundle },
    'real-universe-coordinate-blindtest-spec.json': spec,
    'real-universe-coordinate-blindtest-result.json': bundle.result,
    'legacy-outer-earth-coordinate-audit.json': bundle.legacy,
    'blind-deck-redacted.json': { coordinateFrame: bundle.deck.coordinateFrame, epoch: bundle.deck.epoch, redactedDeck: bundle.deck.redactedDeck, redactedDeckRoot: bundle.deck.redactedDeckRoot },
    'provider-scored-before-reveal.json': bundle.stress.providerScoredBeforeReveal,
    'origin-only-baseline.json': bundle.stress.originOnlyBaseline,
    'negative-control-report.json': bundle.stress.negativeControl,
    'dropout-control-report.json': bundle.stress.dropoutControl,
    'reveal-after-scoring.json': bundle.result.providerReveal,
    'real-universe-coordinate-blindtest.rcl': rcl,
    'real-universe-coordinate-blindtest-summary.md': summary,
  };
  const written = [];
  for (const [name, value] of Object.entries(files)) {
    const file = path.join(target, name);
    fs.writeFileSync(file, `${typeof value === 'string' ? value : JSON.stringify(value, null, 2)}\n`);
    written.push({ path: file, sha256: sha256(fs.readFileSync(file, 'utf8')) });
  }
  return {
    ok: bundle.result.ok,
    format: RCL_REAL_UNIVERSE_COORDINATE_BUNDLE_FORMAT,
    version: RCL_REAL_UNIVERSE_COORDINATE_BLINDTEST_VERSION,
    outputDir: target,
    files: written,
    result: bundle.result,
    root: sha256({ written, result: bundle.result }),
  };
}

export function runRealUniverseCoordinateBlindtestDemo() {
  const { result } = runRealUniverseCoordinateBlindtest(DEFAULT_REAL_UNIVERSE_COORDINATE_SPEC);
  return {
    ok: result.ok,
    version: RCL_REAL_UNIVERSE_COORDINATE_BLINDTEST_VERSION,
    conclusion: result.conclusion,
    providerPassRate: result.providerPassRate,
    providerMeanAngularErrorArcsec: result.providerMeanAngularErrorArcsec,
    originOnlyPassRate: result.originOnlyPassRate,
    negativeControlPassRate: result.negativeControlPassRate,
    blindLeakageScore: result.blindLeakageScore,
    oldOuterEarthCoordinateAudited: result.oldOuterEarthCoordinateAudited,
    canClaimOriginOnlyStarCoordinateRecovery: false,
    canClaimExternalUniverseProof: false,
    root: result.root,
  };
}

export function readRealUniverseCoordinateBlindtestInput(inputPath) {
  if (!inputPath) return {};
  return JSON.parse(fs.readFileSync(path.resolve(inputPath), 'utf8'));
}

export function realUniverseCoordinateCanonicalRoot(value) {
  return sha256(canonicalJson(value));
}
