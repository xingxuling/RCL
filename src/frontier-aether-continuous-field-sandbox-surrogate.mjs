import { createSeededRandom, runRealityCompilerSandbox, sha256 } from './reality-compiler-kernel.mjs';
import {
  buildContinuousFieldPayload,
  scoreContinuousFieldPayload,
  validateContinuousFieldPayload,
} from './frontier-continuous-field-scorer.mjs';
import { routeFrontierScorer } from './frontier-design-grammar-router.mjs';

export const RCL_FRONTIER_AETHER_SANDBOX_VERSION = '0.1.0-alpha.1';
export const RCL_FRONTIER_AETHER_SANDBOX_FORMAT = 'rcl.frontier-aether-continuous-field-sandbox-surrogate.v0.1';

export const AETHER_CONTINUOUS_FIELD_GRAMMAR = Object.freeze({
  id: 'aether_substrate_information_medium_continuous_field_v0_1',
  family: 'continuous_field',
  factors: ['distance', 'clock_phase', 'shield_condition'],
  nuisanceFactors: ['temperature', 'shared_environment', 'session'],
  targetTerms: ['distance_kernel', 'phase_kernel', 'distance:shield_condition'],
  response: 'cross_channel_residual_correlation',
  levelEncoding: 'continuous_plus_binary',
  expectedCellCount: null,
  declaredBeforeScoring: true,
});

export const AETHER_SANDBOX_SCENARIOS = Object.freeze({
  pure_null: Object.freeze({ expectedDetected: false, mode: 'null' }),
  shared_environment_only: Object.freeze({ expectedDetected: false, mode: 'shared_environment' }),
  ordinary_constant_leakage: Object.freeze({ expectedDetected: false, mode: 'constant_leakage', coupling: 0.58 }),
  wrong_lag_kernel: Object.freeze({ expectedDetected: false, mode: 'kernel', coupling: 0.95, lagSamples: 8 }),
  distance_only_coupling: Object.freeze({ expectedDetected: false, mode: 'distance_only', coupling: 0.72, lagSamples: 3 }),
  shield_only_coupling: Object.freeze({ expectedDetected: false, mode: 'shield_only', coupling: 0.62, lagSamples: 3 }),
  injected_preregistered_kernel: Object.freeze({ expectedDetected: true, mode: 'kernel', coupling: 1.15, lagSamples: 3 }),
});

function round(value, digits = 9) {
  const scale = 10 ** digits;
  return Math.round(Number(value) * scale) / scale;
}

function expectedKernel(distance, phase, shield, distanceScale = 4, shieldTransmission = 0.35) {
  const distanceTerm = Math.exp(-Number(distance) / Number(distanceScale));
  const phaseTerm = Math.cos(Number(phase));
  const shieldTerm = Number(shield) === 1 ? Number(shieldTransmission) : 1;
  return distanceTerm * phaseTerm * shieldTerm;
}

function injectLaggedCoupling(receiver, source, amplitude, lagSamples) {
  const lag = Math.max(0, Math.trunc(Number(lagSamples)));
  for (let i = 0; i + lag < receiver.length && i < source.length; i += 1) {
    receiver[i + lag] += Number(amplitude) * Number(source[i]);
  }
}

function buildSessionSeries(rng, scenario, distance, phase, shield, options = {}) {
  const samples = Math.max(96, Math.trunc(Number(options.samplesPerSession ?? 192)));
  const source = [];
  const receiver = [];
  const environment = [];
  let envState = 0;
  for (let i = 0; i < samples; i += 1) {
    envState = 0.72 * envState + rng.gaussian(0, 0.65);
    const env = envState;
    environment.push(env);
    source.push(rng.gaussian(0, 1) + 0.33 * env);
    receiver.push(rng.gaussian(0, 1) + 0.36 * env);
  }

  const targetLag = Math.trunc(Number(options.targetLagSamples ?? 3));
  const distanceScale = Number(options.distanceScale ?? 4);
  const shieldTransmission = Number(options.shieldTransmission ?? 0.35);
  if (scenario.mode === 'shared_environment') {
    for (let i = 0; i < samples; i += 1) {
      source[i] += 0.65 * environment[i];
      receiver[i] += 0.72 * environment[i];
    }
  } else if (scenario.mode === 'constant_leakage') {
    injectLaggedCoupling(receiver, source, Number(scenario.coupling), targetLag);
  } else if (scenario.mode === 'kernel') {
    const amplitude = Number(scenario.coupling) * expectedKernel(distance, phase, shield, distanceScale, shieldTransmission);
    injectLaggedCoupling(receiver, source, amplitude, Number(scenario.lagSamples ?? targetLag));
  } else if (scenario.mode === 'distance_only') {
    const amplitude = Number(scenario.coupling) * Math.exp(-Number(distance) / distanceScale);
    injectLaggedCoupling(receiver, source, amplitude, Number(scenario.lagSamples ?? targetLag));
  } else if (scenario.mode === 'shield_only') {
    const amplitude = Number(scenario.coupling) * (Number(shield) === 1 ? shieldTransmission : 1);
    injectLaggedCoupling(receiver, source, amplitude, Number(scenario.lagSamples ?? targetLag));
  }

  return {
    sampleRateHz: Number(options.sampleRateHz ?? 100),
    source: source.map((x) => round(x)),
    receiver: receiver.map((x) => round(x)),
    environment: environment.map((x) => round(x)),
  };
}

export function buildAetherContinuousFieldSandboxPayload(scenarioId, options = {}) {
  const scenario = AETHER_SANDBOX_SCENARIOS[scenarioId];
  if (!scenario) throw new Error(`unknown_aether_sandbox_scenario:${scenarioId}`);
  const seed = Math.trunc(Number(options.seed ?? 20260811));
  const sandbox = runRealityCompilerSandbox({
    seed,
    trials: Math.max(2, Math.trunc(Number(options.trials ?? 4))),
    steps: Math.max(24, Math.trunc(Number(options.steps ?? 80))),
  });
  const sandboxRoot = sha256(sandbox);
  const rngSeed = parseInt(sha256(`${sandboxRoot}:${scenarioId}:aether`).slice(0, 8), 16);
  const rng = createSeededRandom(rngSeed);
  const distances = options.distances ?? [1, 3, 6];
  const phases = options.phases ?? [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
  const shields = options.shields ?? [0, 1];
  const sessions = [];
  let index = 0;
  for (const distance of distances) {
    for (const clockPhaseRad of phases) {
      for (const shieldCondition of shields) {
        const series = buildSessionSeries(rng, scenario, distance, clockPhaseRad, shieldCondition, options);
        sessions.push({
          sessionId: `aether_${scenarioId}_${String(index + 1).padStart(3, '0')}`,
          distance,
          clockPhaseRad,
          shieldCondition,
          ...series,
          qualityFlags: [],
        });
        index += 1;
      }
    }
  }
  const payload = buildContinuousFieldPayload({
    id: `aether_${scenarioId}_continuous_field_payload_v0_1`,
    sessions,
    analysisPlan: {
      targetLagSamples: Math.trunc(Number(options.targetLagSamples ?? 3)),
      distanceScale: Number(options.distanceScale ?? 4),
      shieldTransmission: Number(options.shieldTransmission ?? 0.35),
      residualizeEnvironment: true,
      permutationCount: Math.max(199, Math.trunc(Number(options.permutationCount ?? 399))),
      permutationSeed: Math.trunc(Number(options.permutationSeed ?? 731901)),
      declaredBeforeScoring: true,
    },
    provenance: {
      evidenceClass: 'sandbox_surrogate_only_not_external_measurement',
      scenarioId,
      sandboxRoot,
      generator: 'rcl_frontier_aether_continuous_field_sandbox_surrogate_v0_1',
      candidateLabel: 'aether_substrate_information_medium',
    },
  });
  return { scenarioId, scenario, sandbox, sandboxRoot, payload };
}

export function runAetherContinuousFieldSandboxScenario(scenarioId, options = {}) {
  const built = buildAetherContinuousFieldSandboxPayload(scenarioId, options);
  const validation = validateContinuousFieldPayload(built.payload, AETHER_CONTINUOUS_FIELD_GRAMMAR);
  const directScore = scoreContinuousFieldPayload(
    built.payload,
    AETHER_CONTINUOUS_FIELD_GRAMMAR,
    options.scorerThresholds ?? {},
  );
  const routed = routeFrontierScorer(AETHER_CONTINUOUS_FIELD_GRAMMAR, built.payload, {
    continuousFieldThresholds: options.scorerThresholds ?? {},
  });
  const detected = directScore.detected === true;
  const classificationPass = validation.ok
    && directScore.ok
    && routed.ok
    && routed.route === 'preregistered_continuous_field_kernel_v0_1'
    && detected === built.scenario.expectedDetected;
  const result = {
    format: RCL_FRONTIER_AETHER_SANDBOX_FORMAT,
    version: RCL_FRONTIER_AETHER_SANDBOX_VERSION,
    scenarioId,
    classificationPass,
    expectedDetected: built.scenario.expectedDetected,
    detected,
    payloadValid: validation.ok,
    route: routed.route,
    routedOk: routed.ok,
    sessionCount: validation.sessionCount,
    targetLagSamples: directScore.targetLagSamples,
    kernelBeta: directScore.model?.kernelBeta ?? null,
    kernelCorrelation: directScore.model?.kernelCorrelation ?? null,
    r2: directScore.model?.r2 ?? null,
    empiricalP: directScore.permutation?.empiricalP ?? null,
    lagSearchUsed: directScore.lagSearchUsed,
    phaseSearchUsed: directScore.phaseSearchUsed,
    distanceScaleSearchUsed: directScore.distanceScaleSearchUsed,
    sandboxRoot: built.sandboxRoot,
    payloadRoot: built.payload.root,
    scoreRoot: directScore.root,
    routeRoot: routed.root,
    evidenceClass: 'aether_continuous_field_sandbox_surrogate_discriminability_only',
    externalRealityVerified: false,
    newNaturalLawVerified: false,
    magicVerified: false,
    root: null,
  };
  result.root = sha256({ ...result, root: undefined });
  return { built, validation, directScore, routed, result };
}

export function runAetherContinuousFieldSandboxPressureSuite(options = {}) {
  const runs = Object.keys(AETHER_SANDBOX_SCENARIOS).map((scenarioId) => runAetherContinuousFieldSandboxScenario(scenarioId, options).result);
  const suite = {
    format: 'rcl.frontier-aether-continuous-field-sandbox-pressure-suite.v0.1',
    version: RCL_FRONTIER_AETHER_SANDBOX_VERSION,
    scenarioCount: runs.length,
    passed: runs.filter((run) => run.classificationPass).length,
    allPayloadsValid: runs.every((run) => run.payloadValid),
    allRoutesContinuousField: runs.every((run) => run.route === 'preregistered_continuous_field_kernel_v0_1'),
    allClassificationsCorrect: runs.every((run) => run.classificationPass),
    noAdaptiveSearch: runs.every((run) => !run.lagSearchUsed && !run.phaseSearchUsed && !run.distanceScaleSearchUsed),
    aetherAnalysisRuntimeStatus: 'READY_CONTINUOUS_FIELD_SCORER_SANDBOX_VALIDATION_PENDING_EXTERNAL_INSTRUMENT',
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
