import { createSeededRandom, runRealityCompilerSandbox, sha256 } from './reality-compiler-kernel.mjs';
import {
  buildCalibrationReceipt,
  buildInstrumentBindingContract,
  buildRawAcquisitionTemplate,
  validateCompletedRawAcquisition,
} from './frontier-instrument-binding-contract.mjs';
import {
  buildFrontierExternalObservationContract,
  runFrontierExternalObservationPipeline,
} from './frontier-external-observation-contract.mjs';

export const RCL_FRONTIER_SANDBOX_SURROGATE_VERSION = '0.1.0-alpha.1';
export const RCL_FRONTIER_SANDBOX_SURROGATE_FORMAT = 'rcl.frontier-sandbox-instrument-surrogate.v0.1';
export const RCL_FRONTIER_SANDBOX_SURROGATE_RUN_FORMAT = 'rcl.frontier-sandbox-instrument-surrogate-run.v0.1';

export const SANDBOX_SURROGATE_SCENARIOS = Object.freeze({
  pure_null: Object.freeze({ symbol: 0, spatial: 0, interaction: 0, sessionDrift: 0, expectedInteraction: false }),
  symbol_main_only: Object.freeze({ symbol: 1.2, spatial: 0, interaction: 0, sessionDrift: 0, expectedInteraction: false }),
  spatial_main_only: Object.freeze({ symbol: 0, spatial: 1.1, interaction: 0, sessionDrift: 0, expectedInteraction: false }),
  additive_without_interaction: Object.freeze({ symbol: 1.0, spatial: 0.9, interaction: 0, sessionDrift: 0, expectedInteraction: false }),
  shared_session_drift: Object.freeze({ symbol: 0, spatial: 0, interaction: 0, sessionDrift: 0.22, expectedInteraction: false }),
  injected_symbol_spatial_interaction: Object.freeze({ symbol: 0.35, spatial: 0.30, interaction: 1.65, sessionDrift: 0.04, expectedInteraction: true }),
});

function round(value, digits = 9) {
  const scale = 10 ** digits;
  return Math.round(Number(value) * scale) / scale;
}

function buildSandboxCalibration(instrumentId, seed) {
  return buildCalibrationReceipt({
    status: 'valid',
    instrumentId,
    referenceId: 'rcl_reality_compiler_sandbox_zero_reference_v0_1',
    measuredAt: '2026-08-11T00:00:00.000Z',
    method: 'deterministic_sandbox_null_reference_and_seeded_noise_check',
    tolerance: 0.05,
    unit: 'normalized_residual',
    rawCalibrationRoot: sha256({ instrumentId, seed, reference: 'sandbox_zero_reference' }),
  });
}

export function buildSandboxInstrumentSurrogate(options = {}) {
  const seed = Math.trunc(Number(options.seed ?? 20260811));
  const instrumentId = String(options.instrumentId ?? 'rcl_sandbox_surrogate_sensor_v0_1');
  const sandbox = runRealityCompilerSandbox({
    seed,
    trials: Math.max(2, Math.trunc(Number(options.trials ?? 4))),
    steps: Math.max(24, Math.trunc(Number(options.steps ?? 80))),
  });
  const sandboxRoot = sha256(sandbox);
  const calibration = buildSandboxCalibration(instrumentId, seed);
  const bindingBundle = buildInstrumentBindingContract({
    samplesPerCell: options.samplesPerCell ?? 24,
    randomizationSeed: options.randomizationSeed ?? seed,
    instrument: {
      instrumentId,
      sensorType: 'rcl_reality_compiler_sandbox_surrogate',
      unit: 'normalized_residual',
      samplingMode: 'one_sandbox_observation_per_redacted_schedule_slot',
      exportFormat: 'json',
      passiveMeasurementOnly: true,
      deviceFingerprint: sha256({
        kind: 'sandbox_surrogate_not_physical_device',
        sandboxRoot,
        version: RCL_FRONTIER_SANDBOX_SURROGATE_VERSION,
      }),
    },
    calibration,
  });
  const descriptor = {
    format: RCL_FRONTIER_SANDBOX_SURROGATE_FORMAT,
    version: RCL_FRONTIER_SANDBOX_SURROGATE_VERSION,
    evidenceClass: 'sandbox_surrogate_only_not_external_measurement',
    sandboxRoot,
    instrumentBindingRoot: bindingBundle.contract.root,
    calibrationRoot: calibration.root,
    sandboxAcquisitionEnabled: true,
    unknownPhysicalAcquisitionArmed: false,
    externalRealityVerified: false,
    newNaturalLawVerified: false,
    magicVerified: false,
    root: null,
  };
  descriptor.root = sha256({ ...descriptor, root: undefined });
  return { descriptor, sandbox, sandboxRoot, bindingBundle };
}

function semanticLookup(bindingBundle) {
  const mapping = bindingBundle.basePackage?.sealedConditionManifest?.mapping ?? [];
  return new Map(mapping.map((row) => [row.blindCode, row]));
}

function responseForScenario(rng, scenario, semantic, session) {
  const s = semantic.symbolCondition === 'active' ? 1 : 0;
  const g = semantic.spatialContext === 'active' ? 1 : 0;
  const sessionTerm = Number(scenario.sessionDrift ?? 0) * ((Number(session) % 4) - 1.5);
  const noise = rng.gaussian(0, 0.18);
  return round(
    Number(scenario.symbol ?? 0) * s
    + Number(scenario.spatial ?? 0) * g
    + Number(scenario.interaction ?? 0) * s * g
    + sessionTerm
    + noise,
  );
}

export function runSandboxSurrogateScenario(scenarioId, options = {}) {
  const scenario = SANDBOX_SURROGATE_SCENARIOS[scenarioId];
  if (!scenario) throw new Error(`unknown_sandbox_surrogate_scenario:${scenarioId}`);

  const surrogate = buildSandboxInstrumentSurrogate(options);
  const { bindingBundle, sandboxRoot } = surrogate;
  const raw = buildRawAcquisitionTemplate(bindingBundle);
  const lookup = semanticLookup(bindingBundle);
  const rngSeed = parseInt(sha256(`${sandboxRoot}:${scenarioId}`).slice(0, 8), 16);
  const rng = createSeededRandom(rngSeed);
  const baseTime = Date.parse('2026-08-11T00:10:00.000Z');

  raw.rows = raw.rows.map((row, index) => {
    const semantic = lookup.get(row.blindConditionCode);
    if (!semantic) throw new Error(`missing_private_semantic_mapping:${row.blindConditionCode}`);
    return {
      ...row,
      timestamp: new Date(baseTime + index * 1000).toISOString(),
      response: responseForScenario(rng, scenario, semantic, row.session),
      qualityFlags: [],
    };
  });
  raw.producedOutsideRclScorerProcess = false;
  raw.externalRealityVerified = false;
  raw.newNaturalLawVerified = false;
  raw.magicVerified = false;
  raw.root = sha256({ ...raw, root: undefined });

  const rawValidation = validateCompletedRawAcquisition(raw, bindingBundle);

  const contractRows = raw.rows.map((row) => {
    const semantic = lookup.get(row.blindConditionCode);
    return {
      observationId: row.observationId,
      timestamp: row.timestamp,
      instrumentId: row.instrumentId,
      session: row.session,
      symbolCondition: semantic.symbolCondition,
      geometryCondition: semantic.spatialContext,
      response: row.response,
      qualityFlags: row.qualityFlags,
    };
  });

  const observationContract = buildFrontierExternalObservationContract({
    id: `sandbox_surrogate_${scenarioId}_v0_1`,
    purpose: 'Sandbox-only surrogate acquisition for exercising the same blind scorer and evidence plumbing before a real passive instrument is available.',
    provenance: {
      sourceType: 'software_control',
      sourceUri: `rcl://frontier/sandbox-surrogate/${scenarioId}`,
      collector: 'RCL Frontier Sandbox Instrument Surrogate v0.1',
      acquiredAt: '2026-08-11T00:10:00.000Z',
      licenseOrPermission: 'internal_research_fixture',
      acquisitionMethod: 'Reality Compiler Sandbox seeded surrogate; private semantic mapping is used only to synthesize the collector-side condition and is re-blinded before scoring.',
    },
    calibration: {
      status: 'valid',
      referenceId: bindingBundle.contract.calibration.referenceId,
      measuredAt: bindingBundle.contract.calibration.measuredAt,
      method: bindingBundle.contract.calibration.method,
      tolerance: bindingBundle.contract.calibration.tolerance,
      notes: 'sandbox surrogate calibration; not a physical calibration receipt',
    },
    rows: contractRows,
  });

  const pipeline = runFrontierExternalObservationPipeline(observationContract, {
    randomizationSeed: Number(options.blindSeed ?? 99173),
  });
  const detected = pipeline.score?.detected === true;
  const expected = scenario.expectedInteraction === true;
  const classificationPass = detected === expected;

  const result = {
    format: RCL_FRONTIER_SANDBOX_SURROGATE_RUN_FORMAT,
    version: RCL_FRONTIER_SANDBOX_SURROGATE_VERSION,
    scenarioId,
    evidenceClass: 'sandbox_surrogate_only_not_external_measurement',
    sandboxRoot,
    surrogateDescriptorRoot: surrogate.descriptor.root,
    bindingRoot: bindingBundle.contract.root,
    rawRoot: raw.root,
    rawValid: rawValidation.ok,
    pipelineOk: pipeline.ok === true,
    modelWinner: pipeline.score?.modelWinner ?? null,
    detectedInteraction: detected,
    expectedInteraction: expected,
    classificationPass,
    semanticSignedInteraction: pipeline.reveal?.semanticSignedInteraction ?? null,
    sandboxAcquisitionEnabled: true,
    unknownPhysicalAcquisitionArmed: false,
    externalRealityVerified: false,
    newNaturalLawVerified: false,
    magicVerified: false,
    root: null,
  };
  result.root = sha256({ ...result, root: undefined });
  return { surrogate, raw, rawValidation, observationContract, pipeline, result };
}

export function runSandboxSurrogatePressureSuite(options = {}) {
  const runs = Object.keys(SANDBOX_SURROGATE_SCENARIOS).map((scenarioId) => runSandboxSurrogateScenario(scenarioId, options).result);
  const suite = {
    format: 'rcl.frontier-sandbox-instrument-surrogate-pressure-suite.v0.1',
    version: RCL_FRONTIER_SANDBOX_SURROGATE_VERSION,
    scenarioCount: runs.length,
    passed: runs.filter((x) => x.rawValid && x.pipelineOk && x.classificationPass).length,
    allRawValid: runs.every((x) => x.rawValid),
    allPipelinesOk: runs.every((x) => x.pipelineOk),
    allClassificationsCorrect: runs.every((x) => x.classificationPass),
    runs,
    verdict: null,
    evidenceClass: 'sandbox_surrogate_only_not_external_measurement',
    externalRealityVerified: false,
    newNaturalLawVerified: false,
    magicVerified: false,
    root: null,
  };
  suite.verdict = suite.passed === suite.scenarioCount
    ? 'PASS_SANDBOX_SURROGATE_PROTOCOL_ONLY'
    : 'FAIL_SANDBOX_SURROGATE_PROTOCOL';
  suite.root = sha256({ ...suite, root: undefined });
  return suite;
}
