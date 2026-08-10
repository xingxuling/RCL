import { createSeededRandom, runRealityCompilerSandbox, sha256 } from './reality-compiler-kernel.mjs';
import {
  buildGenericFullFactorialPayload,
  computeGenericOrthogonalFactorialEffects,
  validateGenericFullFactorialPayload,
} from './frontier-generic-factorial-scorer.mjs';
import { routeFrontierScorer } from './frontier-design-grammar-router.mjs';

export const RCL_FRONTIER_FORMATION_SANDBOX_VERSION = '0.1.0-alpha.1';
export const RCL_FRONTIER_FORMATION_SANDBOX_FORMAT = 'rcl.frontier-formation-factorial-sandbox-surrogate.v0.1';

export const FORMATION_FACTORIAL_GRAMMAR = Object.freeze({
  id: 'formation_spatial_constraint_array_2pow3_surrogate_v0_1',
  family: 'full_factorial_2powk',
  factors: ['boundary_mask', 'layout_topology', 'orientation'],
  nuisanceFactors: ['batch', 'room_session'],
  targetTerms: ['layout_topology', 'layout_topology:orientation', 'layout_topology:boundary_mask'],
  response: 'primary_sensor_residual',
  levelEncoding: 'pm1',
  expectedCellCount: 8,
  declaredBeforeScoring: true,
});

export const FORMATION_SANDBOX_SCENARIOS = Object.freeze({
  pure_null: Object.freeze({ expected: [], beta: {} }),
  orientation_boundary_main_only: Object.freeze({
    expected: [],
    beta: { orientation: 0.55, boundary_mask: 0.50 },
  }),
  layout_topology_main_only: Object.freeze({
    expected: ['layout_topology'],
    beta: { layout_topology: 0.60 },
  }),
  additive_all_main: Object.freeze({
    expected: ['layout_topology'],
    beta: { layout_topology: 0.55, orientation: 0.45, boundary_mask: 0.40 },
  }),
  topology_orientation_interaction: Object.freeze({
    expected: ['layout_topology:orientation'],
    beta: { 'layout_topology:orientation': 0.70 },
  }),
  topology_boundary_interaction: Object.freeze({
    expected: ['layout_topology:boundary_mask'],
    beta: { 'layout_topology:boundary_mask': 0.68 },
  }),
  dual_target_interaction: Object.freeze({
    expected: ['layout_topology:boundary_mask', 'layout_topology:orientation'],
    beta: { 'layout_topology:orientation': 0.72, 'layout_topology:boundary_mask': 0.66 },
  }),
});

function round(value, digits = 9) {
  const scale = 10 ** digits;
  return Math.round(Number(value) * scale) / scale;
}

function factorProduct(levels, term) {
  return String(term).split(':').reduce((product, name) => product * Number(levels[name]), 1);
}

function allCells() {
  const cells = [];
  for (const boundary_mask of [-1, 1]) {
    for (const layout_topology of [-1, 1]) {
      for (const orientation of [-1, 1]) {
        cells.push({ boundary_mask, layout_topology, orientation });
      }
    }
  }
  return cells;
}

function sameStringSet(a = [], b = []) {
  const aa = [...new Set(a.map(String))].sort();
  const bb = [...new Set(b.map(String))].sort();
  return aa.length === bb.length && aa.every((value, index) => value === bb[index]);
}

export function buildFormationFactorialSandboxPayload(scenarioId, options = {}) {
  const scenario = FORMATION_SANDBOX_SCENARIOS[scenarioId];
  if (!scenario) throw new Error(`unknown_formation_sandbox_scenario:${scenarioId}`);
  const seed = Math.trunc(Number(options.seed ?? 20260811));
  const replicatesPerCell = Math.max(16, Math.trunc(Number(options.replicatesPerCell ?? 16)));
  const noiseSigma = Math.max(0.01, Number(options.noiseSigma ?? 0.12));
  const nuisanceDrift = Math.max(0, Number(options.nuisanceDrift ?? 0.05));
  const sandbox = runRealityCompilerSandbox({
    seed,
    trials: Math.max(2, Math.trunc(Number(options.trials ?? 4))),
    steps: Math.max(24, Math.trunc(Number(options.steps ?? 80))),
  });
  const sandboxRoot = sha256(sandbox);
  const rngSeed = parseInt(sha256(`${sandboxRoot}:${scenarioId}:formation`).slice(0, 8), 16);
  const rng = createSeededRandom(rngSeed);
  const rows = [];
  let observationIndex = 0;
  for (const levels of allCells()) {
    for (let replicate = 0; replicate < replicatesPerCell; replicate += 1) {
      let response = 0;
      for (const [term, beta] of Object.entries(scenario.beta)) response += Number(beta) * factorProduct(levels, term);
      const batch = replicate % 4;
      const room_session = Math.floor(replicate / 4) % 4;
      response += nuisanceDrift * (batch - 1.5) + nuisanceDrift * 0.7 * (room_session - 1.5);
      response += rng.gaussian(0, noiseSigma);
      rows.push({
        observationId: `formation_${String(observationIndex + 1).padStart(4, '0')}`,
        factors: levels,
        nuisance: { batch, room_session },
        response: round(response),
      });
      observationIndex += 1;
    }
  }
  const payload = buildGenericFullFactorialPayload({
    id: `formation_${scenarioId}_sandbox_payload_v0_1`,
    factors: FORMATION_FACTORIAL_GRAMMAR.factors,
    responseName: FORMATION_FACTORIAL_GRAMMAR.response,
    rows,
    provenance: {
      evidenceClass: 'sandbox_surrogate_only_not_external_measurement',
      scenarioId,
      sandboxRoot,
      generator: 'rcl_frontier_formation_factorial_sandbox_surrogate_v0_1',
    },
    declaredBeforeScoring: true,
  });
  return { scenarioId, scenario, sandbox, sandboxRoot, payload, replicatesPerCell };
}

export function runFormationFactorialSandboxScenario(scenarioId, options = {}) {
  const built = buildFormationFactorialSandboxPayload(scenarioId, options);
  const validation = validateGenericFullFactorialPayload(built.payload, FORMATION_FACTORIAL_GRAMMAR);
  const directScore = computeGenericOrthogonalFactorialEffects(
    built.payload,
    FORMATION_FACTORIAL_GRAMMAR,
    options.factorialThresholds ?? {},
  );
  const routed = routeFrontierScorer(FORMATION_FACTORIAL_GRAMMAR, built.payload, {
    factorialThresholds: options.factorialThresholds ?? {},
  });
  const detected = directScore.detectedTargetTerms ?? [];
  const classificationPass = validation.ok
    && directScore.ok
    && routed.ok
    && routed.route === 'generic_orthogonal_full_factorial_2powk'
    && sameStringSet(detected, built.scenario.expected);
  const result = {
    format: RCL_FRONTIER_FORMATION_SANDBOX_FORMAT,
    version: RCL_FRONTIER_FORMATION_SANDBOX_VERSION,
    scenarioId,
    classificationPass,
    expectedDetectedTargetTerms: [...built.scenario.expected].sort(),
    detectedTargetTerms: [...detected].sort(),
    payloadValid: validation.ok,
    routedOk: routed.ok,
    route: routed.route,
    observationCount: built.payload.rows.length,
    uniqueDesignCells: validation.uniqueDesignCells,
    replicatesPerCell: validation.replicatesPerCell,
    targetDecisions: directScore.targetDecisions,
    sandboxRoot: built.sandboxRoot,
    payloadRoot: built.payload.root,
    scoreRoot: directScore.root,
    routeRoot: routed.root,
    evidenceClass: 'formation_full_factorial_sandbox_surrogate_discriminability_only',
    externalRealityVerified: false,
    newNaturalLawVerified: false,
    magicVerified: false,
    root: null,
  };
  result.root = sha256({ ...result, root: undefined });
  return { built, validation, directScore, routed, result };
}

export function runFormationFactorialSandboxPressureSuite(options = {}) {
  const runs = Object.keys(FORMATION_SANDBOX_SCENARIOS).map((scenarioId) => runFormationFactorialSandboxScenario(scenarioId, options).result);
  const suite = {
    format: 'rcl.frontier-formation-factorial-sandbox-pressure-suite.v0.1',
    version: RCL_FRONTIER_FORMATION_SANDBOX_VERSION,
    scenarioCount: runs.length,
    passed: runs.filter((run) => run.classificationPass).length,
    allPayloadsValid: runs.every((run) => run.payloadValid),
    allRoutesGenericFactorial: runs.every((run) => run.route === 'generic_orthogonal_full_factorial_2powk'),
    allClassificationsCorrect: runs.every((run) => run.classificationPass),
    formationAnalysisRuntimeStatus: 'READY_GENERIC_FULL_FACTORIAL_SCORER_SANDBOX_VALIDATION_PENDING_EXTERNAL_INSTRUMENT',
    runs,
    evidenceClass: 'sandbox_surrogate_only_not_external_measurement',
    externalRealityVerified: false,
    newNaturalLawVerified: false,
    magicVerified: false,
    root: null,
  };
  suite.root = sha256({ ...suite, root: undefined });
  return suite;
}
