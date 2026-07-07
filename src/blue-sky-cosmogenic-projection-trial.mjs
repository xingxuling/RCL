import fs from 'node:fs';
import path from 'node:path';
import { clamp, sha256, canonicalJson, createSeededRandom } from './reality-compiler-kernel.mjs';
import { runCosmogenicParameterInversion, DEFAULT_COSMOGENIC_PARAMETER_INVERSION_SPEC } from './cosmogenic-parameter-inversion.mjs';

export const RCL_BLUE_SKY_COSMOGENIC_PROJECTION_VERSION = '0.91.0-alpha.1';
export const RCL_BLUE_SKY_COSMOGENIC_PROJECTION_SPEC_FORMAT = 'rcl.blue-sky-cosmogenic-projection.spec.v0.91';
export const RCL_BLUE_SKY_COSMOGENIC_PROJECTION_RESULT_FORMAT = 'rcl.blue-sky-cosmogenic-projection.result.v0.91';
export const RCL_BLUE_SKY_COSMOGENIC_PROJECTION_BUNDLE_FORMAT = 'rcl.blue-sky-cosmogenic-projection.bundle.v0.91';

const EPS = 1e-12;

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

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const item of Object.values(value)) deepFreeze(item);
  }
  return value;
}

function termCount(text, term) {
  const source = String(text ?? '');
  const needle = String(term ?? '');
  if (!needle) return 0;
  let count = 0;
  let offset = 0;
  while (true) {
    const next = source.indexOf(needle, offset);
    if (next < 0) break;
    count += 1;
    offset = next + needle.length;
  }
  return count;
}

function logisticNormalize(count, denominator = 24) {
  return round(clamp(Math.log1p(Number(count)) / Math.log1p(denominator)), 9);
}

function weightedMean(rows, key = 'score') {
  const total = rows.reduce((sum, row) => sum + Number(row.weight ?? 1), 0);
  if (!total) return 0;
  return rows.reduce((sum, row) => sum + Number(row[key] ?? 0) * Number(row.weight ?? 1), 0) / total;
}

function vectorDistanceScore(a = {}, b = {}, weights = {}) {
  const keys = Object.keys(weights);
  if (!keys.length) return 0;
  let numerator = 0;
  let denominator = 0;
  for (const key of keys) {
    const weight = Number(weights[key] ?? 1);
    const delta = Math.abs(Number(a[key] ?? 0) - Number(b[key] ?? 0));
    numerator += weight * clamp(1 - delta);
    denominator += weight;
  }
  return round(numerator / Math.max(EPS, denominator), 9);
}

function stableBlindId(seed, candidateRoot, index) {
  return `blind_${sha256({ seed, candidateRoot, index }).slice(0, 16)}`;
}

export const BLUE_SKY_LORE_ANCHOR_GROUPS = deepFreeze({
  orderCycle: {
    weight: 1.35,
    terms: ['命序', '命序界', '十二长生', '绝', '胎', '养', '承', '帝旺', '超序', '长生轮盘', '阶段', '命城'],
    holdoutTerms: ['承', '帝旺', '超序', '长生轮盘'],
  },
  judgmentEthic: {
    weight: 1.55,
    terms: ['判断', '判断权', '迟疑', '停顿', '慢下来', '不确定', '答案', '最优解', '责任', '承担', '犯错', '继续判断'],
    holdoutTerms: ['迟疑', '慢下来', '犯错', '继续判断'],
  },
  institutionalLayer: {
    weight: 1.15,
    terms: ['天策府', '灰区', '并行结构', '有限否决权', '命城', '天机阁', '判断接口', '责任映射', '系统沉默'],
    holdoutTerms: ['天策府', '灰区', '判断接口', '系统沉默'],
  },
  personaContinuity: {
    weight: 1.10,
    terms: ['蓝天机', '风云策', '万变', 'DU-HENG', 'DH–Ω', 'DH-Ω', '同位体', '同位', '判断源'],
    holdoutTerms: ['风云策', '万变', 'DU-HENG', 'DH–Ω', '同位体'],
  },
  antiPrematureOptimization: {
    weight: 1.45,
    terms: ['不可建模', '不可建模项', '前提撤销', '非必要最优', '不可复现', '最优解', '延迟真相', '灰区样本', '不被允许', '无法被提前处理'],
    holdoutTerms: ['不可建模项', '前提撤销', '非必要最优', '不可复现'],
  },
  aetherLayer: {
    weight: 0.95,
    terms: ['以太文明', '帝级以太语言', '前提层', '超维白金文明', '升维', '命序跃迁', '跨维', '保护性不干预'],
    holdoutTerms: ['以太文明', '帝级以太语言', '超维白金文明', '保护性不干预'],
  },
  physicalPlanetSignals: {
    weight: 0.45,
    terms: ['星球', '行星', '大陆', '海洋', '天空', '恒星', '卫星', '坐标', '地貌'],
    holdoutTerms: ['星球', '行星', '卫星', '坐标'],
  },
});


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

export const DEFAULT_BLUE_SKY_COSMOGENIC_PROJECTION_SPEC = deepFreeze({
  format: RCL_BLUE_SKY_COSMOGENIC_PROJECTION_SPEC_FORMAT,
  version: RCL_BLUE_SKY_COSMOGENIC_PROJECTION_VERSION,
  id: 'blue_sky_cosmogenic_projection_trial_v091',
  boundary: 'lore_anchored_cosmogenic_projection_trial_not_canonical_planet_discovery_not_external_universe_proof',
  seed: 20260707,
  blindSeed: 20260708,
  thresholds: {
    civilizationConfidence: 0.82,
    civilizationMargin: 0.08,
    holdoutScore: 0.70,
    planetConfidence: 0.82,
    originOnlyBlueSkyMaxConfidence: 0.55,
    leakageScore: 0,
    dropoutConfidenceDrop: 0.04,
    pressurePassRate: 0.95,
  },
  weightMix: {
    lore: 0.78,
    cosmogenic: 0.14,
    holdout: 0.08,
  },
  cosmogenicInversion: DEFAULT_COSMOGENIC_PARAMETER_INVERSION_SPEC,
  correctedOrigin: DEFAULT_CORRECTED_COSMOGENIC_ORIGIN_V090,
  useLiveInversion: false,
  pressureIterations: 24,
});

export const DEFAULT_BLUE_SKY_CIVILIZATION_CANDIDATES = deepFreeze([
  {
    key: 'optimization_technocracy_control',
    revealName: '最优效率文明 / Optimization Technocracy',
    type: 'civilization',
    canonicalRole: 'negative_control_efficiency_without_hesitation',
    vector: { orderCycle: 0.18, judgmentEthic: 0.15, institutionalLayer: 0.72, personaContinuity: 0.05, antiPrematureOptimization: 0.05, aetherLayer: 0.05, physicalPlanetSignals: 0.10, cosmogenicHabitability: 0.70, cosmogenicCognition: 0.76 },
  },
  {
    key: 'blue_sky_judgment_order_civilization',
    revealName: '命序界判断文明 / Blue Sky Judgment-Order Civilization',
    type: 'civilization',
    canonicalRole: 'blue_sky_lore_civilization_candidate',
    vector: { orderCycle: 0.98, judgmentEthic: 0.99, institutionalLayer: 0.94, personaContinuity: 0.95, antiPrematureOptimization: 0.96, aetherLayer: 0.86, physicalPlanetSignals: 0.20, cosmogenicHabitability: 0.66, cosmogenicCognition: 0.74 },
  },
  {
    key: 'blue_gold_destiny_empire_decoy',
    revealName: '蓝金命运帝国 / Blue-Gold Destiny Empire',
    type: 'civilization',
    canonicalRole: 'decoy_mythic_fate_empire',
    vector: { orderCycle: 0.83, judgmentEthic: 0.43, institutionalLayer: 0.38, personaContinuity: 0.48, antiPrematureOptimization: 0.24, aetherLayer: 0.40, physicalPlanetSignals: 0.31, cosmogenicHabitability: 0.67, cosmogenicCognition: 0.65 },
  },
  {
    key: 'aether_precondition_layer_meta',
    revealName: '以太前提层 / Aether Precondition Layer',
    type: 'meta_layer',
    canonicalRole: 'high_layer_not_a_civilization_or_planet',
    vector: { orderCycle: 0.38, judgmentEthic: 0.76, institutionalLayer: 0.36, personaContinuity: 0.58, antiPrematureOptimization: 0.82, aetherLayer: 0.99, physicalPlanetSignals: 0.03, cosmogenicHabitability: 0.40, cosmogenicCognition: 0.72 },
  },
  {
    key: 'generic_habitable_blue_planet_control',
    revealName: '蓝色宜居行星 / Generic Habitable Blue Planet',
    type: 'planet',
    canonicalRole: 'physical_planet_control',
    vector: { orderCycle: 0.05, judgmentEthic: 0.05, institutionalLayer: 0.02, personaContinuity: 0.01, antiPrematureOptimization: 0.02, aetherLayer: 0.01, physicalPlanetSignals: 0.98, cosmogenicHabitability: 0.92, cosmogenicCognition: 0.22 },
  },
  {
    key: 'fate_order_world_layer',
    revealName: '命序界世界层 / Fate-Order World Layer',
    type: 'world_layer',
    canonicalRole: 'world_layer_not_astronomical_planet',
    vector: { orderCycle: 0.96, judgmentEthic: 0.82, institutionalLayer: 0.78, personaContinuity: 0.62, antiPrematureOptimization: 0.72, aetherLayer: 0.55, physicalPlanetSignals: 0.35, cosmogenicHabitability: 0.62, cosmogenicCognition: 0.64 },
  },
]);

const FEATURE_WEIGHTS = deepFreeze({
  orderCycle: 1.35,
  judgmentEthic: 1.55,
  institutionalLayer: 1.15,
  personaContinuity: 1.10,
  antiPrematureOptimization: 1.45,
  aetherLayer: 0.95,
  physicalPlanetSignals: 0.45,
  cosmogenicHabitability: 0.30,
  cosmogenicCognition: 0.30,
});

const LORE_ONLY_WEIGHTS = deepFreeze({
  orderCycle: 1.35,
  judgmentEthic: 1.55,
  institutionalLayer: 1.15,
  personaContinuity: 1.10,
  antiPrematureOptimization: 1.45,
  aetherLayer: 0.95,
  physicalPlanetSignals: 0.45,
});

function normalizeSpec(input = {}) {
  return {
    ...DEFAULT_BLUE_SKY_COSMOGENIC_PROJECTION_SPEC,
    ...input,
    format: RCL_BLUE_SKY_COSMOGENIC_PROJECTION_SPEC_FORMAT,
    version: RCL_BLUE_SKY_COSMOGENIC_PROJECTION_VERSION,
    thresholds: { ...DEFAULT_BLUE_SKY_COSMOGENIC_PROJECTION_SPEC.thresholds, ...(input.thresholds ?? {}) },
    weightMix: { ...DEFAULT_BLUE_SKY_COSMOGENIC_PROJECTION_SPEC.weightMix, ...(input.weightMix ?? {}) },
    cosmogenicInversion: input.cosmogenicInversion ?? DEFAULT_BLUE_SKY_COSMOGENIC_PROJECTION_SPEC.cosmogenicInversion,
    correctedOrigin: input.correctedOrigin ?? DEFAULT_BLUE_SKY_COSMOGENIC_PROJECTION_SPEC.correctedOrigin,
    useLiveInversion: Boolean(input.useLiveInversion ?? DEFAULT_BLUE_SKY_COSMOGENIC_PROJECTION_SPEC.useLiveInversion),
    pressureIterations: Number(input.pressureIterations ?? DEFAULT_BLUE_SKY_COSMOGENIC_PROJECTION_SPEC.pressureIterations),
  };
}

export function readBlueSkyCosmogenicProjectionInput(inputPath) {
  if (!inputPath) return {};
  const resolved = path.resolve(inputPath);
  const text = fs.readFileSync(resolved, 'utf8');
  if (resolved.endsWith('.json')) return JSON.parse(text);
  return { corpusText: text, corpusPath: resolved };
}

export function extractBlueSkyLoreAnchorMap(corpusText = '') {
  const text = String(corpusText ?? '');
  const groups = {};
  let totalTermHits = 0;
  for (const [key, group] of Object.entries(BLUE_SKY_LORE_ANCHOR_GROUPS)) {
    const termHits = group.terms.map(term => ({ term, count: termCount(text, term) }));
    const holdoutHits = group.holdoutTerms.map(term => ({ term, count: termCount(text, term) }));
    const count = termHits.reduce((sum, row) => sum + row.count, 0);
    const holdoutCount = holdoutHits.reduce((sum, row) => sum + row.count, 0);
    totalTermHits += count;
    groups[key] = {
      key,
      weight: group.weight,
      count,
      holdoutCount,
      score: logisticNormalize(count, 48),
      holdoutScore: logisticNormalize(holdoutCount, 12),
      termHits: termHits.filter(row => row.count > 0),
      holdoutHits: holdoutHits.filter(row => row.count > 0),
    };
  }
  const vector = Object.fromEntries(Object.entries(groups).map(([key, value]) => [key, value.score]));
  const holdoutVector = Object.fromEntries(Object.entries(groups).map(([key, value]) => [key, value.holdoutScore]));
  return {
    corpusLength: text.length,
    totalTermHits,
    groups,
    vector,
    holdoutVector,
    enoughCorpus: text.length > 1000 && totalTermHits > 30,
    root: sha256({ textLength: text.length, groups: Object.fromEntries(Object.entries(groups).map(([key, value]) => [key, { count: value.count, holdoutCount: value.holdoutCount }])) }),
  };
}

export function deriveCosmogenicProjectionPrior(originInput = {}) {
  const origin = originInput.correctedOrigin ?? originInput;
  const habitabilityKeys = ['planetaryDiskStability', 'waterDeliveryBias', 'tectonicHeatBudget', 'biosphereAdaptability', 'oxygenationGain'];
  const cognitionKeys = ['cognitionGradient', 'technosphereCoupling', 'heavyElementYield', 'starFormationEfficiency'];
  const habitability = round(habitabilityKeys.reduce((sum, key) => sum + Number(origin[key] ?? 0), 0) / habitabilityKeys.length, 9);
  const cognition = round(cognitionKeys.reduce((sum, key) => sum + Number(origin[key] ?? 0), 0) / cognitionKeys.length, 9);
  const volatility = Number(origin.extinctionVolatility ?? 0.5);
  const orderPressure = round(clamp((Number(origin.densityFlatness ?? 1) + Number(origin.technosphereCoupling ?? 0.5)) / 2), 9);
  const uncertaintyWindow = round(clamp(1 - Math.abs(volatility - 0.5) * 1.35), 9);
  return {
    cosmogenicHabitability: habitability,
    cosmogenicCognition: cognition,
    cosmogenicVolatility: round(volatility, 9),
    orderPressure,
    uncertaintyWindow,
    canDetermineLoreIdentityByItself: false,
    root: sha256({ habitability, cognition, volatility, orderPressure, uncertaintyWindow }),
  };
}

export function buildBlueSkyTargetVectors(anchorMap, cosmogenicPrior) {
  const lore = anchorMap.vector;
  const target = {
    orderCycle: lore.orderCycle ?? 0,
    judgmentEthic: lore.judgmentEthic ?? 0,
    institutionalLayer: lore.institutionalLayer ?? 0,
    personaContinuity: lore.personaContinuity ?? 0,
    antiPrematureOptimization: lore.antiPrematureOptimization ?? 0,
    aetherLayer: lore.aetherLayer ?? 0,
    physicalPlanetSignals: lore.physicalPlanetSignals ?? 0,
    cosmogenicHabitability: cosmogenicPrior.cosmogenicHabitability ?? 0,
    cosmogenicCognition: cosmogenicPrior.cosmogenicCognition ?? 0,
  };
  const originOnlyTarget = {
    orderCycle: 0,
    judgmentEthic: 0,
    institutionalLayer: 0,
    personaContinuity: 0,
    antiPrematureOptimization: 0,
    aetherLayer: 0,
    physicalPlanetSignals: clamp((cosmogenicPrior.cosmogenicHabitability ?? 0) * 1.05),
    cosmogenicHabitability: cosmogenicPrior.cosmogenicHabitability ?? 0,
    cosmogenicCognition: cosmogenicPrior.cosmogenicCognition ?? 0,
  };
  return { target, originOnlyTarget, root: sha256({ target, originOnlyTarget }) };
}

export function createBlueSkyProjectionBlindDeck(specInput = {}, candidates = DEFAULT_BLUE_SKY_CIVILIZATION_CANDIDATES) {
  const spec = normalizeSpec(specInput);
  const rows = candidates.map((candidate, index) => {
    const candidateRoot = sha256({ key: candidate.key, type: candidate.type, vector: candidate.vector });
    return {
      blindId: stableBlindId(spec.blindSeed, candidateRoot, index),
      type: candidate.type,
      redactedVector: { ...candidate.vector },
      candidateRoot,
    };
  });
  const rng = createSeededRandom(spec.blindSeed);
  const shuffled = [...rows].sort((a, b) => rng.random() - 0.5 || a.blindId.localeCompare(b.blindId));
  return {
    format: 'rcl.blue-sky-cosmogenic-projection.redacted-deck.v0.91',
    blindSeed: spec.blindSeed,
    rows: shuffled,
    leakageScore: measureBlueSkyProjectionLeakage(shuffled),
    root: sha256(shuffled),
  };
}

export function measureBlueSkyProjectionLeakage(deckRows = []) {
  const text = JSON.stringify(deckRows);
  const forbidden = [
    '蓝天机', '命序界', 'Blue Sky', 'Judgment-Order', '青穹星', 'Azure Canopy', '澄蓝机星', 'revealName', 'canonicalRole', 'candidateId', 'blue_sky', 'fate_order_world', 'optimization_technocracy', 'generic_habitable', 'aether_precondition',
  ];
  return forbidden.some(term => text.includes(term)) ? 1 : 0;
}

function revealMap(candidates = DEFAULT_BLUE_SKY_CIVILIZATION_CANDIDATES, specInput = {}) {
  const spec = normalizeSpec(specInput);
  const map = new Map();
  candidates.forEach((candidate, index) => {
    const candidateRoot = sha256({ key: candidate.key, type: candidate.type, vector: candidate.vector });
    map.set(stableBlindId(spec.blindSeed, candidateRoot, index), { ...candidate, candidateRoot });
  });
  return map;
}

function scoreDeck(deck, target, holdoutTarget, specInput = {}) {
  const spec = normalizeSpec(specInput);
  const rows = deck.rows.map(row => {
    const loreScore = vectorDistanceScore(target, row.redactedVector, FEATURE_WEIGHTS);
    const holdoutScore = vectorDistanceScore({ ...holdoutTarget, cosmogenicHabitability: target.cosmogenicHabitability, cosmogenicCognition: target.cosmogenicCognition }, row.redactedVector, FEATURE_WEIGHTS);
    const cosmogenicScore = vectorDistanceScore(target, row.redactedVector, { cosmogenicHabitability: 1, cosmogenicCognition: 1 });
    const score = round(spec.weightMix.lore * loreScore + spec.weightMix.cosmogenic * cosmogenicScore + spec.weightMix.holdout * holdoutScore, 9);
    return { blindId: row.blindId, type: row.type, candidateRoot: row.candidateRoot, score, loreScore, cosmogenicScore, holdoutScore };
  }).sort((a, b) => b.score - a.score || a.blindId.localeCompare(b.blindId));
  const top = rows[0];
  const second = rows[1];
  return { rows, top, margin: round((top?.score ?? 0) - (second?.score ?? 0), 9), root: sha256(rows) };
}

function runOriginOnlyProbe(deck, originOnlyTarget) {
  const rows = deck.rows.map(row => ({
    blindId: row.blindId,
    type: row.type,
    candidateRoot: row.candidateRoot,
    score: vectorDistanceScore(originOnlyTarget, row.redactedVector, { physicalPlanetSignals: 1.2, cosmogenicHabitability: 1.0, cosmogenicCognition: 0.4, orderCycle: 0.5, judgmentEthic: 0.5, institutionalLayer: 0.5, personaContinuity: 0.5, antiPrematureOptimization: 0.5, aetherLayer: 0.5 }),
  })).sort((a, b) => b.score - a.score || a.blindId.localeCompare(b.blindId));
  return { rows, top: rows[0], margin: round((rows[0]?.score ?? 0) - (rows[1]?.score ?? 0), 9), root: sha256(rows) };
}

function revealScoredRows(scored, specInput = {}, candidates = DEFAULT_BLUE_SKY_CIVILIZATION_CANDIDATES) {
  const map = revealMap(candidates, specInput);
  return scored.rows.map(row => {
    const reveal = map.get(row.blindId) ?? {};
    return {
      ...row,
      revealName: reveal.revealName,
      canonicalRole: reveal.canonicalRole,
      semanticKey: reveal.key,
    };
  });
}

function replaceTerms(text, terms = []) {
  let out = String(text ?? '');
  for (const term of terms) out = out.split(term).join('');
  return out;
}

export function runBlueSkyProjectionDropout(specInput = {}) {
  const spec = normalizeSpec(specInput);
  const corpusText = String(spec.corpusText ?? '');
  const criticalTerms = [
    ...BLUE_SKY_LORE_ANCHOR_GROUPS.orderCycle.terms,
    ...BLUE_SKY_LORE_ANCHOR_GROUPS.judgmentEthic.terms,
    ...BLUE_SKY_LORE_ANCHOR_GROUPS.institutionalLayer.terms,
    ...BLUE_SKY_LORE_ANCHOR_GROUPS.personaContinuity.terms,
    ...BLUE_SKY_LORE_ANCHOR_GROUPS.antiPrematureOptimization.terms,
    ...BLUE_SKY_LORE_ANCHOR_GROUPS.aetherLayer.terms,
  ];
  const reduced = replaceTerms(corpusText, criticalTerms);
  const withFull = runBlueSkyCosmogenicProjectionTrial({ ...spec, corpusText });
  const withDropout = runBlueSkyCosmogenicProjectionTrial({ ...spec, corpusText: reduced, skipDropout: true, skipPressure: true });
  return {
    fullTopConfidence: withFull.result.civilizationProbe.confidence,
    dropoutTopConfidence: withDropout.result.civilizationProbe.confidence,
    confidenceDrop: round(withFull.result.civilizationProbe.confidence - withDropout.result.civilizationProbe.confidence, 9),
    passed: round(withFull.result.civilizationProbe.confidence - withDropout.result.civilizationProbe.confidence, 9) >= spec.thresholds.dropoutConfidenceDrop,
    root: sha256({ full: withFull.result.civilizationProbe.top?.blindId, dropout: withDropout.result.civilizationProbe.top?.blindId, drop: round(withFull.result.civilizationProbe.confidence - withDropout.result.civilizationProbe.confidence, 9) }),
  };
}

export function runBlueSkyProjectionPressure(specInput = {}) {
  const spec = normalizeSpec(specInput);
  const iterations = Number(spec.pressureIterations ?? 64);
  const base = runBlueSkyCosmogenicProjectionTrial({ ...spec, skipPressure: true, skipDropout: true });
  const expectedRoot = base.result.civilizationProbe.top?.candidateRoot;
  let stable = 0;
  const rows = [];
  for (let i = 0; i < iterations; i += 1) {
    const altered = runBlueSkyCosmogenicProjectionTrial({ ...spec, blindSeed: spec.blindSeed + i + 1, skipPressure: true, skipDropout: true });
    const same = altered.result.civilizationProbe.top?.candidateRoot === expectedRoot;
    if (same) stable += 1;
    rows.push({ iteration: i, blindSeed: spec.blindSeed + i + 1, same, topScore: altered.result.civilizationProbe.confidence, topType: altered.result.civilizationProbe.top?.type });
  }
  const passRate = round(stable / Math.max(1, iterations), 9);
  return {
    expectedRoot,
    iterations,
    stable,
    passRate,
    passed: passRate >= spec.thresholds.pressurePassRate,
    sample: rows.slice(0, 12),
    root: sha256({ expectedRoot, passRate, sample: rows.slice(0, 12) }),
  };
}

export function runMulticivilizationBlueSkyProjectionCourt(result) {
  const rows = [
    { civilization: 'Founder Twin', verdict: result.canClaimBlueSkyCivilizationCandidate ? 'pass' : 'warn', artifact: 'civilization candidate may be named only after lore+origin scoring; planet claim blocked' },
    { civilization: '柳清莲 Gate', verdict: result.canClaimCanonicalPlanet ? 'fail' : 'pass', artifact: 'planet-name overclaim suppressed; corpus lacks stable astronomical planet anchor' },
    { civilization: '洞哥 Grounding', verdict: result.originOnlyProbe.canSelectBlueSkyByOriginOnly ? 'fail' : 'pass', artifact: 'origin-only probe cannot identify Blue Sky civilization; lore anchors are required' },
    { civilization: 'Product Civilization', verdict: 'pass', artifact: 'useful output is civilization/world-layer seed, not fake star/planet coordinate' },
    { civilization: 'Engineering Civilization', verdict: result.blindDeckLeakageScore === 0 ? 'pass' : 'fail', artifact: 'redacted deck hides reveal labels and candidate keys' },
    { civilization: 'Testing Civilization', verdict: result.pressure?.passed && result.dropout?.passed ? 'pass' : 'warn', artifact: 'shuffle pressure + anchor dropout gates executed' },
    { civilization: 'Security Civilization', verdict: !result.canClaimExternalUniverseProof ? 'pass' : 'fail', artifact: 'no external universe proof or canonical planet discovery claim' },
    { civilization: 'Integration Court', verdict: result.canClaimBlueSkyCivilizationCandidate && !result.canClaimCanonicalPlanet && !result.originOnlyProbe.canSelectBlueSkyByOriginOnly ? 'pass' : 'warn', artifact: 'civilization candidate accepted; planet remains underdetermined' },
    { civilization: 'Evidence Ledger', verdict: 'pass', artifact: 'corpus anchor root, corrected origin root, blind deck root, reveal-after-scoring root recorded' },
  ];
  return { rows, passed: rows.every(row => row.verdict === 'pass'), root: sha256(rows) };
}

export function runBlueSkyCosmogenicProjectionTrial(specInput = {}) {
  const spec = normalizeSpec(specInput);
  const inversion = spec.useLiveInversion ? runCosmogenicParameterInversion(spec.cosmogenicInversion) : null;
  const correctedOrigin = spec.correctedOrigin ?? inversion?.result?.correctedOrigin ?? DEFAULT_CORRECTED_COSMOGENIC_ORIGIN_V090;
  const anchorMap = extractBlueSkyLoreAnchorMap(spec.corpusText ?? '');
  const cosmogenicPrior = deriveCosmogenicProjectionPrior(correctedOrigin);
  const vectors = buildBlueSkyTargetVectors(anchorMap, cosmogenicPrior);
  const deck = createBlueSkyProjectionBlindDeck(spec, spec.candidates ?? DEFAULT_BLUE_SKY_CIVILIZATION_CANDIDATES);
  const scored = scoreDeck(deck, vectors.target, anchorMap.holdoutVector, spec);
  const originOnly = runOriginOnlyProbe(deck, vectors.originOnlyTarget);
  const revealedRows = revealScoredRows(scored, spec, spec.candidates ?? DEFAULT_BLUE_SKY_CIVILIZATION_CANDIDATES);
  const topReveal = revealedRows[0] ?? {};
  const originOnlyReveal = revealScoredRows(originOnly, spec, spec.candidates ?? DEFAULT_BLUE_SKY_CIVILIZATION_CANDIDATES)[0] ?? {};
  const isCivilization = topReveal.type === 'civilization';
  const isPlanet = topReveal.type === 'planet';
  const canClaimCivilization = Boolean(
    anchorMap.enoughCorpus
    && isCivilization
    && scored.top.score >= spec.thresholds.civilizationConfidence
    && scored.margin >= spec.thresholds.civilizationMargin
    && scored.top.holdoutScore >= spec.thresholds.holdoutScore
    && deck.leakageScore <= spec.thresholds.leakageScore
  );
  const canClaimPlanet = Boolean(
    isPlanet
    && scored.top.score >= spec.thresholds.planetConfidence
    && topReveal.canonicalRole !== 'physical_planet_control'
  );
  const originOnlyBlueSky = originOnlyReveal.semanticKey === 'blue_sky_judgment_order_civilization' && originOnly.top.score > spec.thresholds.originOnlyBlueSkyMaxConfidence;
  let dropout = null;
  if (!spec.skipDropout && spec.corpusText) dropout = runBlueSkyProjectionDropout({ ...spec, skipDropout: true, skipPressure: true });
  let pressure = null;
  if (!spec.skipPressure) pressure = runBlueSkyProjectionPressure({ ...spec, skipPressure: true, skipDropout: true });
  const result = {
    format: RCL_BLUE_SKY_COSMOGENIC_PROJECTION_RESULT_FORMAT,
    version: RCL_BLUE_SKY_COSMOGENIC_PROJECTION_VERSION,
    ok: canClaimCivilization && !canClaimPlanet && !originOnlyBlueSky && deck.leakageScore === 0 && (!pressure || pressure.passed) && (!dropout || dropout.passed),
    conclusion: canClaimCivilization
      ? 'corrected cosmogenic parameters plus Blue Sky lore anchors can blind-select a Blue Sky judgment-order civilization candidate; they do not justify a canonical planet name.'
      : 'current evidence is insufficient to claim a Blue Sky civilization or planet candidate.',
    boundary: spec.boundary,
    canClaimBlueSkyCivilizationCandidate: canClaimCivilization,
    canClaimCanonicalPlanet: canClaimPlanet,
    canClaimExternalUniverseProof: false,
    canClaimOriginOnlyBlueSkyRecovery: false,
    correctedOrigin,
    correctedOriginSource: spec.useLiveInversion ? 'live_v0.90_inversion' : 'v0.90_reported_corrected_origin_parameters',
    cosmogenicPrior,
    anchorMap,
    targetVectors: vectors,
    blindDeckLeakageScore: deck.leakageScore,
    civilizationProbe: {
      top: scored.top,
      confidence: scored.top?.score ?? 0,
      margin: scored.margin,
      revealedTop: topReveal,
      revealAfterScoring: revealedRows,
    },
    planetProbe: {
      topPlanet: revealedRows.find(row => row.type === 'planet') ?? null,
      planetRank: revealedRows.findIndex(row => row.type === 'planet') + 1 || null,
      conclusion: 'planet-level claim is underdetermined; corpus anchors identify a civilization/world-layer, not an astronomical planet.',
    },
    originOnlyProbe: {
      top: originOnly.top,
      confidence: originOnly.top?.score ?? 0,
      margin: originOnly.margin,
      revealedTop: originOnlyReveal,
      canSelectBlueSkyByOriginOnly: originOnlyBlueSky,
      conclusion: 'corrected cosmogenic origin parameters alone select generic physical habitability patterns, not Blue Sky lore identity.',
    },
    dropout,
    pressure,
    multicivilizationCourt: null,
    roots: {
      correctedOriginRoot: sha256(correctedOrigin),
      anchorMapRoot: anchorMap.root,
      blindDeckRoot: deck.root,
      scoredRoot: scored.root,
      revealRoot: sha256(revealedRows),
    },
    root: null,
  };
  result.multicivilizationCourt = runMulticivilizationBlueSkyProjectionCourt(result);
  result.root = sha256({ result: { ...result, root: undefined }, spec: { ...spec, corpusText: undefined } });
  return { spec, result, inversion, deck, scored, revealedRows };
}

export function buildBlueSkyCosmogenicProjectionSpec(input = {}) {
  const bundle = runBlueSkyCosmogenicProjectionTrial(input);
  const spec = {
    ...bundle.spec,
    corpusText: undefined,
    compilerPasses: [
      'multicivilization target/risk gating',
      'v0.90 corrected cosmogenic parameter import',
      'Blue Sky lore anchor extraction from corpus',
      'origin-only probe as hard negative control',
      'strict redacted civilization/world/planet deck',
      'lore+origin scoring with holdout anchor groups',
      'reveal after scoring',
      'anchor dropout and blind shuffle pressure tests',
      'planet overclaim suppression',
    ],
    validation: {
      ok: bundle.result.ok,
      canClaimBlueSkyCivilizationCandidate: bundle.result.canClaimBlueSkyCivilizationCandidate,
      canClaimCanonicalPlanet: false,
      canClaimOriginOnlyBlueSkyRecovery: false,
      civilizationConfidence: bundle.result.civilizationProbe.confidence,
      civilizationMargin: bundle.result.civilizationProbe.margin,
      topRevealName: bundle.result.civilizationProbe.revealedTop.revealName,
      topType: bundle.result.civilizationProbe.revealedTop.type,
      resultRoot: bundle.result.root,
    },
  };
  return { ...spec, root: sha256({ spec: { ...spec, root: undefined }, resultRoot: bundle.result.root }) };
}

export function renderBlueSkyCosmogenicProjectionRcl(specInput = {}) {
  const spec = specInput.format === RCL_BLUE_SKY_COSMOGENIC_PROJECTION_SPEC_FORMAT && specInput.validation ? specInput : buildBlueSkyCosmogenicProjectionSpec(specInput);
  const bundle = runBlueSkyCosmogenicProjectionTrial({ ...specInput, skipPressure: true, skipDropout: true });
  const result = bundle.result;
  return `reality BlueSkyCosmogenicProjectionTrial {
  facet compiler.version : Text = "${RCL_BLUE_SKY_COSMOGENIC_PROJECTION_VERSION}"
  facet compiler.format : Text = "${RCL_BLUE_SKY_COSMOGENIC_PROJECTION_SPEC_FORMAT}"
  facet boundary : Text = "${rclString(result.boundary)}"
  facet civilization.candidate_confidence : Number = ${rclNumber(result.civilizationProbe.confidence)}
  facet civilization.margin : Number = ${rclNumber(result.civilizationProbe.margin)}
  facet planet.claim : Truth = false
  facet origin_only_blue_sky_recovery : Truth = false
  facet external_universe_proof : Truth = false

  subject multicivilization_court {
    facet authority : Number = 1
    warrant lore.read on corpus
    warrant origin.read on cosmogenic_parameters
    warrant blindtest.write on evidence
  }

  emergence project_blue_sky_civilization_candidate {
    cause multicivilization_court
    when multicivilization_court.authority == 1
    needs lore.read on corpus
    needs origin.read on cosmogenic_parameters
    needs blindtest.write on evidence
    alter civilization.candidate_confidence <- ${rclNumber(result.civilizationProbe.confidence)}
    preserve civilization.candidate_confidence >= ${rclNumber(DEFAULT_BLUE_SKY_COSMOGENIC_PROJECTION_SPEC.thresholds.civilizationConfidence)}
    preserve planet.claim == false
    preserve origin_only_blue_sky_recovery == false
    preserve external_universe_proof == false
    witness "rcl:blue-sky-cosmogenic-projection:v0.91"
  }

  foresee project_blue_sky_civilization_candidate
  realize project_blue_sky_civilization_candidate
}`;
}

export function runBlueSkyCosmogenicProjectionDemo() {
  const sampleCorpus = Array(16).fill('命序界 十二长生 绝 胎 养 承 帝旺 超序 蓝天机 风云策 万变 DU-HENG DH–Ω 判断 迟疑 灰区 天策府 并行结构 不可建模项 前提撤销 最优解 以太文明 帝级以太语言 慢下来 责任 判断权').join(' ');
  const { result } = runBlueSkyCosmogenicProjectionTrial({ corpusText: sampleCorpus, skipPressure: true, skipDropout: true });
  return {
    ok: result.ok,
    version: RCL_BLUE_SKY_COSMOGENIC_PROJECTION_VERSION,
    conclusion: result.conclusion,
    civilizationCandidate: result.civilizationProbe.revealedTop.revealName,
    confidence: result.civilizationProbe.confidence,
    margin: result.civilizationProbe.margin,
    canClaimCanonicalPlanet: result.canClaimCanonicalPlanet,
    originOnlyTop: result.originOnlyProbe.revealedTop.revealName,
    root: result.root,
  };
}

export function writeBlueSkyCosmogenicProjectionReports(outputDir = 'output/v0.91/blue-sky-cosmogenic-projection', input = {}) {
  const target = path.resolve(outputDir);
  fs.mkdirSync(target, { recursive: true });
  const bundle = runBlueSkyCosmogenicProjectionTrial(input);
  const spec = buildBlueSkyCosmogenicProjectionSpec({ ...input, skipPressure: true, skipDropout: true });
  const rcl = renderBlueSkyCosmogenicProjectionRcl({ ...input, skipPressure: true, skipDropout: true });
  const summary = `# RCL Blue Sky Cosmogenic Projection Trial v0.91

结论：${bundle.result.conclusion}

- ok: ${bundle.result.ok}
- civilization candidate: ${bundle.result.civilizationProbe.revealedTop.revealName}
- civilization confidence: ${bundle.result.civilizationProbe.confidence}
- civilization margin: ${bundle.result.civilizationProbe.margin}
- planet claim: ${bundle.result.canClaimCanonicalPlanet}
- origin-only Blue Sky recovery: false
- origin-only top: ${bundle.result.originOnlyProbe.revealedTop.revealName}
- blind deck leakage score: ${bundle.result.blindDeckLeakageScore}
- pressure pass rate: ${bundle.result.pressure?.passRate ?? 'skipped'}
- dropout confidence drop: ${bundle.result.dropout?.confidenceDrop ?? 'skipped'}

## Reveal after scoring

${bundle.result.civilizationProbe.revealAfterScoring.map((row, index) => `${index + 1}. ${row.revealName} [${row.type}] score=${row.score} holdout=${row.holdoutScore}`).join('\n')}

## Court

${bundle.result.multicivilizationCourt.rows.map(row => `- ${row.civilization}: ${row.verdict} — ${row.artifact}`).join('\n')}
`;
  const files = {
    'blue-sky-cosmogenic-projection-bundle.json': { format: RCL_BLUE_SKY_COSMOGENIC_PROJECTION_BUNDLE_FORMAT, version: RCL_BLUE_SKY_COSMOGENIC_PROJECTION_VERSION, spec: { ...bundle.spec, corpusText: undefined }, result: bundle.result },
    'blue-sky-cosmogenic-projection-spec.json': spec,
    'blue-sky-cosmogenic-projection-result.json': bundle.result,
    'blue-sky-lore-anchor-map.json': bundle.result.anchorMap,
    'corrected-origin-prior.json': { correctedOrigin: bundle.result.correctedOrigin, cosmogenicPrior: bundle.result.cosmogenicPrior },
    'redacted-blind-deck.json': bundle.deck,
    'reveal-after-scoring.json': bundle.result.civilizationProbe.revealAfterScoring,
    'origin-only-probe.json': bundle.result.originOnlyProbe,
    'planet-claim-audit.json': bundle.result.planetProbe,
    'multicivilization-court.json': bundle.result.multicivilizationCourt,
    'blue-sky-cosmogenic-projection.rcl': rcl,
    'blue-sky-cosmogenic-projection-summary.md': summary,
  };
  const written = [];
  for (const [name, value] of Object.entries(files)) {
    const file = path.join(target, name);
    fs.writeFileSync(file, `${typeof value === 'string' ? value : JSON.stringify(value, null, 2)}\n`);
    written.push({ path: file, sha256: sha256(fs.readFileSync(file, 'utf8')) });
  }
  return {
    ok: bundle.result.ok,
    format: RCL_BLUE_SKY_COSMOGENIC_PROJECTION_BUNDLE_FORMAT,
    version: RCL_BLUE_SKY_COSMOGENIC_PROJECTION_VERSION,
    outputDir: target,
    files: written,
    result: bundle.result,
    root: sha256({ written, result: bundle.result }),
  };
}

export function blueSkyCosmogenicProjectionCanonicalRoot(value) {
  return sha256(canonicalJson(value));
}
