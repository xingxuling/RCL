import fs from 'node:fs';
import path from 'node:path';
import { canonicalJson, createSeededRandom, sha256 } from './reality-compiler-kernel.mjs';
import { runFrontierNaturalLawLab } from './frontier-natural-law-lab.mjs';

export const RCL_FRONTIER_SYMBOLIC_GEOMETRY_BLINDTEST_VERSION = '0.1.0-alpha.1';
export const RCL_FRONTIER_SYMBOLIC_GEOMETRY_BLINDTEST_SPEC_FORMAT = 'rcl.frontier-symbolic-geometry-blindtest.spec.v0.1';
export const RCL_FRONTIER_SYMBOLIC_GEOMETRY_BLINDTEST_DECK_FORMAT = 'rcl.frontier-symbolic-geometry-blindtest.deck.v0.1';
export const RCL_FRONTIER_SYMBOLIC_GEOMETRY_BLINDTEST_SCORE_FORMAT = 'rcl.frontier-symbolic-geometry-blindtest.score.v0.1';
export const RCL_FRONTIER_SYMBOLIC_GEOMETRY_BLINDTEST_BUNDLE_FORMAT = 'rcl.frontier-symbolic-geometry-blindtest.bundle.v0.1';
export const RCL_FRONTIER_SYMBOLIC_GEOMETRY_PRESSURE_FORMAT = 'rcl.frontier-symbolic-geometry-pressure-suite.v0.1';

const EPS = 1e-12;

function round(value, digits = 9) {
  const scale = 10 ** digits;
  return Math.round(Number(value) * scale) / scale;
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + Number(value), 0) / values.length : 0;
}

function sampleVariance(values) {
  if (values.length <= 1) return 0;
  const m = mean(values);
  return values.reduce((sum, value) => sum + (Number(value) - m) ** 2, 0) / (values.length - 1);
}

function stableBool(seedText) {
  return parseInt(sha256(seedText).slice(0, 8), 16) % 2 === 1;
}

function shuffled(rows, seed) {
  return rows
    .map((row, index) => ({ row, rank: sha256(`${seed}:${index}:${canonicalJson(row)}`) }))
    .sort((a, b) => a.rank.localeCompare(b.rank))
    .map(item => item.row);
}

function solveLinearSystem(matrix, vector) {
  const n = matrix.length;
  const aug = matrix.map((row, i) => [...row.map(Number), Number(vector[i])]);
  for (let col = 0; col < n; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < n; row += 1) {
      if (Math.abs(aug[row][col]) > Math.abs(aug[pivot][col])) pivot = row;
    }
    if (Math.abs(aug[pivot][col]) < EPS) return null;
    if (pivot !== col) [aug[col], aug[pivot]] = [aug[pivot], aug[col]];
    const divisor = aug[col][col];
    for (let j = col; j <= n; j += 1) aug[col][j] /= divisor;
    for (let row = 0; row < n; row += 1) {
      if (row === col) continue;
      const factor = aug[row][col];
      for (let j = col; j <= n; j += 1) aug[row][j] -= factor * aug[col][j];
    }
  }
  return aug.map(row => row[n]);
}

function fitLinearModel(rows, featureNames) {
  const p = featureNames.length + 1;
  const xtx = Array.from({ length: p }, () => Array(p).fill(0));
  const xty = Array(p).fill(0);
  for (const row of rows) {
    const x = [1, ...featureNames.map(name => Number(row[name]))];
    const y = Number(row.response);
    for (let i = 0; i < p; i += 1) {
      xty[i] += x[i] * y;
      for (let j = 0; j < p; j += 1) xtx[i][j] += x[i] * x[j];
    }
  }
  const beta = solveLinearSystem(xtx, xty);
  if (!beta) return { ok: false, featureNames, coefficients: null, sse: Infinity, bic: Infinity };
  let sse = 0;
  for (const row of rows) {
    const x = [1, ...featureNames.map(name => Number(row[name]))];
    const predicted = x.reduce((sum, value, i) => sum + value * beta[i], 0);
    sse += (Number(row.response) - predicted) ** 2;
  }
  const n = Math.max(1, rows.length);
  const k = p;
  const mse = sse / n;
  const bic = n * Math.log(Math.max(EPS, mse)) + k * Math.log(n);
  return {
    ok: true,
    featureNames,
    coefficients: {
      intercept: round(beta[0]),
      ...Object.fromEntries(featureNames.map((name, index) => [name, round(beta[index + 1])])),
    },
    sse: round(sse),
    mse: round(mse),
    bic: round(bic),
  };
}

function modelSuite(rows) {
  const models = [
    { id: 'H0_null', features: [] },
    { id: 'H_symbol_main', features: ['symbolFactor'] },
    { id: 'H_geometry_main', features: ['geometryFactor'] },
    { id: 'H_additive', features: ['symbolFactor', 'geometryFactor'] },
    { id: 'H_interaction', features: ['symbolFactor', 'geometryFactor', 'interactionFactor'] },
  ].map(model => ({ id: model.id, ...fitLinearModel(rows, model.features) }));
  const sorted = [...models].sort((a, b) => a.bic - b.bic || a.id.localeCompare(b.id));
  const winner = sorted[0];
  const runnerUp = sorted[1] ?? null;
  return {
    models,
    winner: winner?.id ?? null,
    winnerBic: winner?.bic ?? null,
    bicMargin: runnerUp ? round(runnerUp.bic - winner.bic) : null,
  };
}

function cellStats(rows) {
  const groups = new Map();
  for (const row of rows) {
    const key = `${row.symbolFactor}${row.geometryFactor}`;
    const bucket = groups.get(key) ?? [];
    bucket.push(Number(row.response));
    groups.set(key, bucket);
  }
  const result = {};
  for (const key of ['00', '10', '01', '11']) {
    const values = groups.get(key) ?? [];
    result[key] = {
      n: values.length,
      mean: round(mean(values)),
      variance: round(sampleVariance(values)),
    };
  }
  return result;
}

function interactionMetrics(rows) {
  const cells = cellStats(rows);
  const interactionDelta = cells['11'].mean - cells['10'].mean - cells['01'].mean + cells['00'].mean;
  const variances = ['00', '10', '01', '11'].map(key => cells[key].variance).filter(Number.isFinite);
  const pooledSd = Math.sqrt(Math.max(EPS, mean(variances)));
  return {
    cells,
    interactionDelta: round(interactionDelta),
    absoluteInteractionDelta: round(Math.abs(interactionDelta)),
    pooledWithinCellSd: round(pooledSd),
    standardizedInteraction: round(Math.abs(interactionDelta) / pooledSd),
  };
}

export const DEFAULT_FRONTIER_SYMBOLIC_GEOMETRY_BLINDTEST_SPEC = Object.freeze({
  format: RCL_FRONTIER_SYMBOLIC_GEOMETRY_BLINDTEST_SPEC_FORMAT,
  id: 'frontier_symbolic_geometry_blindtest_v0_1',
  version: RCL_FRONTIER_SYMBOLIC_GEOMETRY_BLINDTEST_VERSION,
  boundary: 'computational_blindtest_only_not_external_magic_or_natural_law_evidence',
  seed: 20260811,
  samplesPerCell: 64,
  noiseSigma: 1,
  nuisanceSessionDriftSigma: 0.15,
  preregistration: {
    researchQuestion: 'Does a symbol-program factor and a spatial-constraint factor exhibit a specific non-additive interaction that survives blind factor coding and additive/main-effect controls?',
    candidateModel: 'y = beta0 + betaS*S + betaG*G + betaSG*(S*G) + nuisance + epsilon',
    nullModel: 'betaSG = 0; symbol and geometry may have zero, independent or additive effects but no interaction term.',
    decisiveResidual: 'A blinded interaction model wins preregistered model selection and the absolute difference-in-differences exceeds both raw and standardized thresholds.',
    requiredNegativeControls: ['pure_null', 'symbol_main_only', 'geometry_main_only', 'additive_without_interaction', 'shared_session_drift'],
    requiredPositiveControl: 'injected_symbol_geometry_interaction',
    thresholds: {
      minAbsInteractionDelta: 0.35,
      minStandardizedInteraction: 0.45,
      minInteractionBicMargin: 2,
      maxLeakageScore: 0,
    },
  },
  defaultScenario: {
    id: 'injected_symbol_geometry_interaction',
    betaSymbol: 0.2,
    betaGeometry: 0.2,
    betaInteraction: 0.9,
    sharedDrift: 0,
  },
});

export function normalizeFrontierSymbolicGeometryBlindtestSpec(input = {}) {
  const base = JSON.parse(JSON.stringify(DEFAULT_FRONTIER_SYMBOLIC_GEOMETRY_BLINDTEST_SPEC));
  return {
    ...base,
    ...input,
    preregistration: {
      ...base.preregistration,
      ...(input.preregistration ?? {}),
      thresholds: {
        ...base.preregistration.thresholds,
        ...(input.preregistration?.thresholds ?? {}),
      },
    },
    defaultScenario: { ...base.defaultScenario, ...(input.defaultScenario ?? {}) },
  };
}

let frontierPrerequisiteCache = null;

function assertFrontierLanePrerequisites() {
  if (frontierPrerequisiteCache) return frontierPrerequisiteCache;
  const lab = runFrontierNaturalLawLab({ sandbox: { trials: 2, steps: 30 } });
  const required = ['spell_symbolic_control_protocol', 'formation_spatial_constraint_array'];
  const byId = new Map(lab.lanes.map(lane => [lane.id, lane]));
  const missing = required.filter(id => !byId.has(id));
  frontierPrerequisiteCache = {
    ok: missing.length === 0,
    required,
    missing,
    roots: Object.fromEntries(required.map(id => [id, byId.get(id)?.root ?? null])),
    labRoot: lab.root,
    externalRealityVerified: false,
  };
  return frontierPrerequisiteCache;
}

export function buildFrontierSymbolicGeometryPreregistration(input = {}) {
  const spec = normalizeFrontierSymbolicGeometryBlindtestSpec(input);
  const prerequisites = assertFrontierLanePrerequisites();
  const preregistration = {
    format: 'rcl.frontier-symbolic-geometry-preregistration.v0.1',
    id: `${spec.id}.preregistration`,
    researchQuestion: spec.preregistration.researchQuestion,
    candidateModel: spec.preregistration.candidateModel,
    nullModel: spec.preregistration.nullModel,
    decisiveResidual: spec.preregistration.decisiveResidual,
    requiredNegativeControls: [...spec.preregistration.requiredNegativeControls],
    requiredPositiveControl: spec.preregistration.requiredPositiveControl,
    thresholds: { ...spec.preregistration.thresholds },
    laneRoots: prerequisites.roots,
    sourceLabRoot: prerequisites.labRoot,
    boundary: spec.boundary,
    frozenBeforeDeckGeneration: true,
    externalRealityVerified: false,
    root: null,
  };
  preregistration.root = sha256({ ...preregistration, root: undefined });
  return preregistration;
}

function scenarioRow(id, betaSymbol, betaGeometry, betaInteraction, sharedDrift = 0) {
  return { id, betaSymbol, betaGeometry, betaInteraction, sharedDrift };
}

export const FRONTIER_SYMBOLIC_GEOMETRY_PRESSURE_SCENARIOS = Object.freeze([
  scenarioRow('pure_null', 0, 0, 0, 0),
  scenarioRow('symbol_main_only', 0.9, 0, 0, 0),
  scenarioRow('geometry_main_only', 0, 0.9, 0, 0),
  scenarioRow('additive_without_interaction', 0.65, 0.65, 0, 0),
  scenarioRow('shared_session_drift', 0, 0, 0, 0.75),
  scenarioRow('injected_symbol_geometry_interaction', 0.2, 0.2, 0.9, 0),
]);

function semanticLevel(blindLevel, activeBlindLevel) {
  return Number(blindLevel) === Number(activeBlindLevel) ? 1 : 0;
}

export function generateFrontierSymbolicGeometryBlindDeck(input = {}, scenarioInput = null) {
  const spec = normalizeFrontierSymbolicGeometryBlindtestSpec(input);
  const preregistration = buildFrontierSymbolicGeometryPreregistration(spec);
  const scenario = { ...spec.defaultScenario, ...(scenarioInput ?? {}) };
  const seed = Number(spec.seed);
  const samplesPerCell = Math.max(16, Math.trunc(Number(spec.samplesPerCell)));
  const rng = createSeededRandom(seed + parseInt(sha256(scenario.id).slice(0, 8), 16));
  const symbolActiveBlindLevel = stableBool(`${seed}:${scenario.id}:symbol`) ? 1 : 0;
  const geometryActiveBlindLevel = stableBool(`${seed}:${scenario.id}:geometry`) ? 1 : 0;
  const rows = [];
  let observation = 0;
  for (let symbolFactor = 0; symbolFactor <= 1; symbolFactor += 1) {
    for (let geometryFactor = 0; geometryFactor <= 1; geometryFactor += 1) {
      for (let replicate = 0; replicate < samplesPerCell; replicate += 1) {
        const semanticSymbol = semanticLevel(symbolFactor, symbolActiveBlindLevel);
        const semanticGeometry = semanticLevel(geometryFactor, geometryActiveBlindLevel);
        const session = replicate % 8;
        const sessionDrift = Number(scenario.sharedDrift ?? 0) !== 0
          ? Number(scenario.sharedDrift) * Math.sin((2 * Math.PI * session) / 8)
          : rng.gaussian(0, Number(spec.nuisanceSessionDriftSigma));
        const response = Number(scenario.betaSymbol) * semanticSymbol
          + Number(scenario.betaGeometry) * semanticGeometry
          + Number(scenario.betaInteraction) * semanticSymbol * semanticGeometry
          + sessionDrift
          + rng.gaussian(0, Number(spec.noiseSigma));
        rows.push({
          observationId: `obs_${String(observation + 1).padStart(4, '0')}`,
          symbolFactor,
          geometryFactor,
          interactionFactor: symbolFactor * geometryFactor,
          session,
          response: round(response),
        });
        observation += 1;
      }
    }
  }
  const redactedRows = shuffled(rows, `${seed}:${scenario.id}:shuffle`);
  const redactedDeck = {
    format: RCL_FRONTIER_SYMBOLIC_GEOMETRY_BLINDTEST_DECK_FORMAT,
    version: RCL_FRONTIER_SYMBOLIC_GEOMETRY_BLINDTEST_VERSION,
    id: `${spec.id}.blind_${sha256(`${spec.seed}:${scenario.id}`).slice(0, 12)}`,
    preregistrationRoot: preregistration.root,
    protocol: 'factor_semantics_and_scenario_truth_sealed_until_after_scoring',
    rows: redactedRows,
    semanticTermsPresent: false,
    boundary: spec.boundary,
    root: null,
  };
  redactedDeck.root = sha256({ ...redactedDeck, root: undefined });
  const sealedTruth = {
    format: 'rcl.frontier-symbolic-geometry-sealed-truth.v0.1',
    scenario,
    symbolActiveBlindLevel,
    geometryActiveBlindLevel,
    expectedInteractionDetected: Number(scenario.betaInteraction) !== 0,
    deckRoot: redactedDeck.root,
    root: null,
  };
  sealedTruth.root = sha256({ ...sealedTruth, root: undefined });
  return {
    spec,
    preregistration,
    redactedDeck,
    sealedTruth,
    boundary: spec.boundary,
    externalRealityVerified: false,
    root: sha256({ preregistration: preregistration.root, deck: redactedDeck.root, truth: sealedTruth.root }),
  };
}

function leakageScore(deck) {
  const banned = [
    'betaInteraction', 'betaSymbol', 'betaGeometry', 'sharedDrift',
    'scenarioId', 'injected_symbol_geometry_interaction',
    'symbolActiveBlindLevel', 'geometryActiveBlindLevel', 'expectedInteractionDetected',
    'sealedTruth', 'truthRoot',
  ];
  const text = JSON.stringify(deck);
  return banned.reduce((score, term) => score + (text.includes(term) ? 1 : 0), 0);
}

export function scoreFrontierSymbolicGeometryBlindDeck(redactedDeck, preregistration) {
  const thresholds = preregistration.thresholds;
  const metrics = interactionMetrics(redactedDeck.rows);
  const suite = modelSuite(redactedDeck.rows);
  const leakage = leakageScore(redactedDeck);
  const interactionModel = suite.models.find(model => model.id === 'H_interaction');
  const detected = suite.winner === 'H_interaction'
    && suite.bicMargin >= Number(thresholds.minInteractionBicMargin)
    && metrics.absoluteInteractionDelta >= Number(thresholds.minAbsInteractionDelta)
    && metrics.standardizedInteraction >= Number(thresholds.minStandardizedInteraction)
    && leakage <= Number(thresholds.maxLeakageScore);
  const result = {
    format: RCL_FRONTIER_SYMBOLIC_GEOMETRY_BLINDTEST_SCORE_FORMAT,
    version: RCL_FRONTIER_SYMBOLIC_GEOMETRY_BLINDTEST_VERSION,
    preregistrationRoot: preregistration.root,
    deckRoot: redactedDeck.root,
    leakageScore: leakage,
    metrics,
    modelSelection: suite,
    interactionCoefficientBlindCoding: interactionModel?.coefficients?.interactionFactor ?? null,
    detected,
    scoringUsedSealedTruth: false,
    boundary: preregistration.boundary,
    externalRealityVerified: false,
    root: null,
  };
  result.root = sha256({ ...result, root: undefined });
  return result;
}

function semanticInteractionSign(sealedTruth) {
  const symbolSign = sealedTruth.symbolActiveBlindLevel === 1 ? 1 : -1;
  const geometrySign = sealedTruth.geometryActiveBlindLevel === 1 ? 1 : -1;
  return symbolSign * geometrySign;
}

export function revealFrontierSymbolicGeometryBlindtest(deckBundle, blindScore) {
  const truth = deckBundle.sealedTruth;
  const semanticSignedInteraction = round(Number(blindScore.interactionCoefficientBlindCoding ?? 0) * semanticInteractionSign(truth));
  const semanticDirectionConsistent = truth.scenario.betaInteraction === 0
    ? Math.abs(semanticSignedInteraction) < deckBundle.preregistration.thresholds.minAbsInteractionDelta
    : Math.sign(semanticSignedInteraction) === Math.sign(Number(truth.scenario.betaInteraction));
  const expected = truth.expectedInteractionDetected;
  const classificationCorrect = blindScore.detected === expected;
  const reveal = {
    format: 'rcl.frontier-symbolic-geometry-reveal.v0.1',
    scenarioId: truth.scenario.id,
    expectedInteractionDetected: expected,
    detected: blindScore.detected,
    classificationCorrect,
    symbolActiveBlindLevel: truth.symbolActiveBlindLevel,
    geometryActiveBlindLevel: truth.geometryActiveBlindLevel,
    semanticSignedInteraction,
    semanticDirectionConsistent,
    truthRoot: truth.root,
    scoreRoot: blindScore.root,
    revealOccurredAfterScoring: true,
    boundary: deckBundle.boundary,
    externalRealityVerified: false,
    root: null,
  };
  reveal.root = sha256({ ...reveal, root: undefined });
  return reveal;
}

export function runFrontierSymbolicGeometryBlindtest(input = {}, scenarioInput = null) {
  const deckBundle = generateFrontierSymbolicGeometryBlindDeck(input, scenarioInput);
  const blindScore = scoreFrontierSymbolicGeometryBlindDeck(deckBundle.redactedDeck, deckBundle.preregistration);
  const reveal = revealFrontierSymbolicGeometryBlindtest(deckBundle, blindScore);
  const prerequisites = assertFrontierLanePrerequisites();
  const ok = prerequisites.ok
    && blindScore.leakageScore === 0
    && reveal.revealOccurredAfterScoring
    && reveal.classificationCorrect;
  const bundle = {
    format: RCL_FRONTIER_SYMBOLIC_GEOMETRY_BLINDTEST_BUNDLE_FORMAT,
    version: RCL_FRONTIER_SYMBOLIC_GEOMETRY_BLINDTEST_VERSION,
    ok,
    verdict: ok
      ? 'PASS / computational blind protocol classified the preregistered synthetic scenario correctly.'
      : 'FAIL / computational blind protocol did not satisfy preregistered classification or leakage gates.',
    prerequisites,
    preregistration: deckBundle.preregistration,
    redactedDeck: deckBundle.redactedDeck,
    blindScore,
    reveal,
    boundary: deckBundle.boundary,
    externalRealityVerified: false,
    root: null,
  };
  bundle.root = sha256({
    prerequisites: prerequisites.labRoot,
    preregistration: bundle.preregistration.root,
    deck: bundle.redactedDeck.root,
    score: bundle.blindScore.root,
    reveal: bundle.reveal.root,
  });
  return bundle;
}

export function runFrontierSymbolicGeometryPressureSuite(input = {}) {
  const rows = FRONTIER_SYMBOLIC_GEOMETRY_PRESSURE_SCENARIOS.map(scenario => {
    const bundle = runFrontierSymbolicGeometryBlindtest(input, scenario);
    return {
      scenarioId: scenario.id,
      expectedInteractionDetected: scenario.betaInteraction !== 0,
      detected: bundle.blindScore.detected,
      classificationCorrect: bundle.reveal.classificationCorrect,
      semanticDirectionConsistent: bundle.reveal.semanticDirectionConsistent,
      leakageScore: bundle.blindScore.leakageScore,
      winner: bundle.blindScore.modelSelection.winner,
      bicMargin: bundle.blindScore.modelSelection.bicMargin,
      interactionDelta: bundle.blindScore.metrics.interactionDelta,
      standardizedInteraction: bundle.blindScore.metrics.standardizedInteraction,
      root: bundle.root,
    };
  });
  const passCount = rows.filter(row => row.classificationCorrect && row.leakageScore === 0).length;
  const positive = rows.find(row => row.scenarioId === 'injected_symbol_geometry_interaction');
  const negativeControls = rows.filter(row => row.scenarioId !== 'injected_symbol_geometry_interaction');
  const result = {
    format: RCL_FRONTIER_SYMBOLIC_GEOMETRY_PRESSURE_FORMAT,
    version: RCL_FRONTIER_SYMBOLIC_GEOMETRY_BLINDTEST_VERSION,
    scenarioCount: rows.length,
    passCount,
    passRate: round(passCount / Math.max(1, rows.length)),
    allNegativeControlsRejected: negativeControls.every(row => row.detected === false),
    injectedPositiveDetected: positive?.detected === true,
    leakageFree: rows.every(row => row.leakageScore === 0),
    externalRealityVerified: false,
    rows,
    root: null,
  };
  result.ok = result.passRate === 1
    && result.allNegativeControlsRejected
    && result.injectedPositiveDetected
    && result.leakageFree;
  result.verdict = result.ok
    ? 'PASS / all preregistered synthetic pressure scenarios classified correctly.'
    : 'FAIL / one or more synthetic negative or positive controls were misclassified.';
  result.boundary = 'synthetic_pressure_suite_only_not_external_effect_evidence';
  result.root = sha256({ ...result, root: undefined });
  return result;
}

export function renderFrontierSymbolicGeometryRcl(input = {}) {
  const suite = runFrontierSymbolicGeometryPressureSuite(input);
  return [
    'reality FrontierSymbolicGeometryBlindtest {',
    `  version : Text = "${RCL_FRONTIER_SYMBOLIC_GEOMETRY_BLINDTEST_VERSION}"`,
    `  pressure.pass_rate : Number = ${suite.passRate}`,
    `  pressure.negative_controls_rejected : Truth = ${suite.allNegativeControlsRejected}`,
    `  pressure.injected_positive_detected : Truth = ${suite.injectedPositiveDetected}`,
    `  audit.leakage_free : Truth = ${suite.leakageFree}`,
    '  validation.external_reality_verified : Truth = false',
    `  root.hash : Text = "${suite.root}"`,
    '}',
  ].join('\n');
}

export function writeFrontierSymbolicGeometryBlindtestReports(outputDir = 'output/frontier-symbolic-geometry-blindtest-v0.1', input = {}) {
  const dir = path.resolve(outputDir);
  fs.mkdirSync(dir, { recursive: true });
  const preregistration = buildFrontierSymbolicGeometryPreregistration(input);
  const pressure = runFrontierSymbolicGeometryPressureSuite(input);
  const positive = runFrontierSymbolicGeometryBlindtest(input, FRONTIER_SYMBOLIC_GEOMETRY_PRESSURE_SCENARIOS.find(row => row.id === 'injected_symbol_geometry_interaction'));
  fs.writeFileSync(path.join(dir, 'preregistration.json'), `${JSON.stringify(preregistration, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'pressure-suite.json'), `${JSON.stringify(pressure, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'positive-control-redacted-deck.json'), `${JSON.stringify(positive.redactedDeck, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'positive-control-blind-score.json'), `${JSON.stringify(positive.blindScore, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'positive-control-reveal.json'), `${JSON.stringify(positive.reveal, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'frontier-symbolic-geometry-blindtest.rcl'), `${renderFrontierSymbolicGeometryRcl(input)}\n`);
  const readme = [
    '# RCL Frontier Symbolic × Geometry Blindtest v0.1',
    '',
    `Verdict: **${pressure.verdict}**`,
    `Pass rate: **${pressure.passRate}**`,
    `Negative controls rejected: **${pressure.allNegativeControlsRejected}**`,
    `Injected interaction detected: **${pressure.injectedPositiveDetected}**`,
    `Leakage free: **${pressure.leakageFree}**`,
    `External reality verified: **false**`,
    '',
    'This package validates the blind computational protocol and its ability to distinguish a synthetic interaction from preregistered null/additive controls. It does not validate a physical magic effect.',
  ].join('\n');
  fs.writeFileSync(path.join(dir, 'README.md'), `${readme}\n`);
  return {
    ok: pressure.ok,
    outputDir: dir,
    pressureRoot: pressure.root,
    preregistrationRoot: preregistration.root,
    externalRealityVerified: false,
  };
}
