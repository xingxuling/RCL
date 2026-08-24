import { sha256 } from './reality-compiler-kernel.mjs';
import { runFrontierNaturalLawLab } from './frontier-natural-law-lab.mjs';

export const RCL_FRONTIER_UNKNOWN_LAW_SPEC_VERSION = '0.1.0-alpha.1';
export const RCL_FRONTIER_UNKNOWN_LAW_SPEC_FORMAT = 'rcl.frontier-unknown-law-experiment-spec.v0.1';
export const RCL_FRONTIER_UNKNOWN_LAW_PORTFOLIO_FORMAT = 'rcl.frontier-unknown-law-experiment-portfolio.v0.1';

const PRIMARY_LANES = Object.freeze([
  'spell_symbolic_control_protocol',
  'formation_spatial_constraint_array',
  'aether_substrate_information_medium',
]);

const COMMON_BOUNDARY = Object.freeze({
  evidenceClass: 'preregistered_unknown_law_experiment_spec_not_result',
  externalRealityVerified: false,
  newNaturalLawVerified: false,
  magicVerified: false,
  destructivePhysicalExperimentDisabled: true,
  humanExperimentDisabled: true,
  postScoreThresholdRelaxationForbidden: true,
  negativeResultsAreValid: true,
});

const TEMPLATES = Object.freeze({
  spell_symbolic_control_protocol: {
    title: 'Symbolic Control × Spatial Context Blind Physical-Residue Study',
    question: 'Do preregistered symbolic programs produce a repeatable physical residue only when paired with the declared spatial context, beyond syntax-matched nulls, layout controls, drift and ordinary channels?',
    designGrammar: {
      family: 'simple_2x2',
      factors: ['symbol_program', 'spatial_context'],
      nuisanceFactors: [],
      response: 'primary_sensor_residual',
      levelEncoding: 'binary_blinded',
      expectedCellCount: 4,
      targetTerms: ['symbol_program:spatial_context'],
      declaredBeforeScoring: true,
    },
    analysisRuntimeStatus: 'READY_EXISTING_SIMPLE_2X2_SCORER',
    primaryVariable: {
      id: 'primary_sensor_residual',
      definition: 'Preselected single physical sensor channel residual after calibration and ordinary-channel subtraction.',
      unitPolicy: 'instrument_native_si_or_traceable_unit',
      freezeRule: 'sensor channel and transformation must be fixed before acquisition; secondary channels cannot promote the claim',
    },
    secondaryVariables: ['temperature_drift', 'clock_drift', 'rf_background', 'vibration_proxy'],
    instrumentRequirements: [
      'one predeclared primary calibrated sensor with raw export',
      'independent monotonic timestamp source',
      'environmental temperature logger',
      'ordinary-channel monitor appropriate to the selected sensor',
      'automated or blinded condition scheduler that does not expose semantic labels to evaluator',
    ],
    nullHypothesis: 'The symbol×spatial interaction term is zero after syntax-matched symbol controls, randomized/rotated spatial controls, environmental nuisance terms and declared ordinary channels are accounted for.',
    ordinaryModels: [
      'sensor noise and drift',
      'timing leakage',
      'electromagnetic or optical cross-talk',
      'layout-dependent ordinary geometry',
      'software/metadata leakage',
    ],
    acquisition: {
      mode: 'independent_process_or_device_preexisting_file',
      minimumPerCell: 24,
      randomization: 'blocked_random_order_with_sealed_manifest',
      blinding: 'collector may know setup; evaluator receives anonymous factor codes only',
      rawDataRule: 'raw file is finalized and rooted before RCL intake',
      calibrationRule: 'calibration record must predate scored acquisition',
    },
    stopConditions: [
      'fixed preregistered sample target reached',
      'calibration invalid or sensor saturation occurs',
      'condition-label leakage or randomization manifest exposure occurs',
      'undeclared ordinary actuation/cross-talk channel is discovered',
      'raw data integrity/root mismatch occurs',
    ],
  },
  formation_spatial_constraint_array: {
    title: 'Spatial Constraint Array Factorial Residue Study',
    question: 'Do layout topology, orientation and boundary masking produce a structure-specific physical residual that survives matched-material and ordinary-geometry controls?',
    designGrammar: {
      family: 'full_factorial_2powk',
      factors: ['layout_topology', 'orientation', 'boundary_mask'],
      nuisanceFactors: ['batch', 'room_session'],
      response: 'primary_sensor_residual',
      levelEncoding: 'pm1',
      expectedCellCount: 8,
      targetTerms: ['layout_topology', 'layout_topology:orientation', 'layout_topology:boundary_mask'],
      declaredBeforeScoring: true,
    },
    analysisRuntimeStatus: 'BLOCKED_PENDING_GENERIC_FULL_FACTORIAL_PAYLOAD_ADAPTER',
    primaryVariable: {
      id: 'primary_sensor_residual',
      definition: 'Preselected calibrated physical sensor response associated with array state after matched-material baseline subtraction.',
      unitPolicy: 'instrument_native_si_or_traceable_unit',
      freezeRule: 'primary channel fixed before data collection; exploratory channels remain non-promotional',
    },
    secondaryVariables: ['temperature_drift', 'position_error', 'orientation_error', 'ambient_field_background'],
    instrumentRequirements: [
      'precision layout jig with logged geometry tolerances',
      'calibrated primary sensor',
      'orientation encoder or fixed mechanical reference',
      'environment/background monitor appropriate to the sensor',
      'blind condition labels and immutable raw export',
    ],
    nullHypothesis: 'All observed differences are explained by ordinary geometry, orientation, material placement, environment and measurement noise; no preregistered layout-specific residual remains.',
    ordinaryModels: [
      'ordinary boundary-condition geometry',
      'material placement and mass distribution',
      'ambient-field gradients',
      'sensor-position coupling',
      'batch/session drift',
    ],
    acquisition: {
      mode: 'independent_process_or_device_preexisting_file',
      minimumPerFactorialCell: 16,
      randomization: 'randomized_full_factorial_order_with_session_blocking',
      blinding: 'evaluator receives factor codes and nuisance block ids but not semantic labels',
      rawDataRule: 'complete design table and raw response file rooted before scoring',
      calibrationRule: 'geometry and sensor calibration records are part of provenance',
    },
    stopConditions: [
      'fixed factorial replication target reached',
      'missing factorial cell or broken randomization',
      'geometry tolerance exceeds preregistered bound',
      'sensor calibration fails',
      'ordinary geometry explanation is found that was omitted from preregistration',
    ],
  },
  aether_substrate_information_medium: {
    title: 'Latent Information-Transfer Medium Distance/Phase Study',
    question: 'After excluding clock drift, shared environment and ordinary communication channels, does a preregistered distance/phase transfer kernel explain reproducible residual correlation between isolated source and receiver streams?',
    designGrammar: {
      family: 'continuous_field',
      factors: ['distance', 'clock_phase', 'shield_condition'],
      nuisanceFactors: ['temperature', 'rf_background', 'session'],
      response: 'cross_channel_residual_correlation',
      levelEncoding: 'continuous_plus_binary',
      expectedCellCount: null,
      targetTerms: ['distance_kernel', 'phase_kernel', 'distance:shield_condition'],
      declaredBeforeScoring: true,
    },
    analysisRuntimeStatus: 'BLOCKED_PENDING_CONTINUOUS_FIELD_SCORER',
    primaryVariable: {
      id: 'cross_channel_residual_correlation',
      definition: 'Holdout correlation/coherence residual between isolated source and receiver time series after preregistered clock, leakage and shared-environment models.',
      unitPolicy: 'dimensionless_correlation_or_coherence_with_declared_frequency_band',
      freezeRule: 'frequency band, lag window and kernel family fixed before reveal',
    },
    secondaryVariables: ['clock_offset', 'temperature', 'rf_background', 'packet_or_metadata_leakage_audit'],
    instrumentRequirements: [
      'two independently clocked acquisition devices or processes',
      'traceable timing calibration and clock-drift characterization',
      'RF/network leakage audit appropriate to the setup',
      'environmental monitors at source and receiver',
      'immutable raw time-series export before RCL scoring',
    ],
    nullHypothesis: 'All cross-channel correlation is explained by clock alignment error, common environment, software/network leakage, analysis flexibility or chance under the preregistered null ensemble.',
    ordinaryModels: [
      'clock drift and aliasing',
      'shared environmental forcing',
      'electromagnetic/acoustic/optical leakage',
      'network or file metadata leakage',
      'multiple-comparison and lag-search artifacts',
    ],
    acquisition: {
      mode: 'independent_devices_preexisting_time_series_files',
      minimumSessions: 12,
      randomization: 'sealed source-condition schedule independent of receiver/evaluator',
      blinding: 'receiver and evaluator do not receive source condition or timing labels until scoring is frozen',
      rawDataRule: 'source and receiver raw files sealed separately before synchronization metadata is revealed',
      calibrationRule: 'clock model and environmental monitors must be validated before each session',
    },
    stopConditions: [
      'dedicated continuous-field scorer is not preregistered and machine-available',
      'timing uncertainty exceeds preregistered lag resolution',
      'any ordinary communication/leakage path remains unbounded',
      'source/receiver file roots mismatch',
      'fixed preregistered session count is reached',
    ],
  },
});

let CANDIDATE_ROOT_CACHE = null;
function candidateRoots() {
  if (CANDIDATE_ROOT_CACHE) return CANDIDATE_ROOT_CACHE;
  const lab = runFrontierNaturalLawLab();
  CANDIDATE_ROOT_CACHE = new Map(lab.lanes.map((lane) => [lane.id, lane.root]));
  return CANDIDATE_ROOT_CACHE;
}

export function buildUnknownLawExperimentSpec(laneId, overrides = {}, roots = null) {
  const template = TEMPLATES[laneId];
  if (!template) throw new Error(`unsupported_unknown_law_lane:${laneId}`);
  const rootMap = roots ?? candidateRoots();
  const sourceCandidateRoot = rootMap.get(laneId) ?? null;
  const spec = {
    format: RCL_FRONTIER_UNKNOWN_LAW_SPEC_FORMAT,
    version: RCL_FRONTIER_UNKNOWN_LAW_SPEC_VERSION,
    id: `${laneId}_experiment_spec_v0_1`,
    laneId,
    sourceCandidateRoot,
    ...template,
    ...overrides,
    boundary: { ...COMMON_BOUNDARY, ...(overrides.boundary ?? {}) },
    promotionGates: [
      'analysis design and null hypothesis sealed before scored acquisition',
      'raw observations generated outside the scorer process and root-bound before intake',
      'declared known positive control passes the same acquisition/evidence path',
      'negative/null controls are retained and scored without story-based exclusions',
      'candidate residual survives preregistered ordinary-model controls',
      'at least two independent acquisitions reproduce the directional result before external support status',
      'independent third-party or genuinely separate-device replication required before any strong natural-law claim',
    ],
    root: null,
  };
  spec.root = sha256({ ...spec, root: undefined });
  return spec;
}

export function validateUnknownLawExperimentSpec(spec = {}) {
  const failures = [];
  if (spec.format !== RCL_FRONTIER_UNKNOWN_LAW_SPEC_FORMAT) failures.push('unsupported_format');
  if (!PRIMARY_LANES.includes(spec.laneId)) failures.push('unsupported_lane');
  if (!spec.sourceCandidateRoot) failures.push('missing_source_candidate_root');
  if (!spec.designGrammar?.family) failures.push('missing_design_grammar');
  if (!spec.primaryVariable?.id) failures.push('missing_primary_variable');
  if (!spec.nullHypothesis) failures.push('missing_null_hypothesis');
  if (!Array.isArray(spec.ordinaryModels) || spec.ordinaryModels.length < 3) failures.push('insufficient_ordinary_models');
  if (!Array.isArray(spec.instrumentRequirements) || spec.instrumentRequirements.length < 3) failures.push('insufficient_instrument_requirements');
  if (!Array.isArray(spec.stopConditions) || spec.stopConditions.length < 3) failures.push('insufficient_stop_conditions');
  if (!Array.isArray(spec.promotionGates) || spec.promotionGates.length < 5) failures.push('insufficient_promotion_gates');
  if (spec.boundary?.externalRealityVerified !== false) failures.push('external_reality_must_remain_false');
  if (spec.boundary?.magicVerified !== false) failures.push('magic_verified_must_remain_false');
  const recomputedRoot = sha256({ ...spec, root: undefined });
  if (spec.root !== recomputedRoot) failures.push('spec_root_mismatch');
  return { ok: failures.length === 0, failures: [...new Set(failures)].sort(), recomputedRoot };
}

export function buildDefaultUnknownLawExperimentPortfolio() {
  const roots = candidateRoots();
  const specs = PRIMARY_LANES.map((laneId) => buildUnknownLawExperimentSpec(laneId, {}, roots));
  const executableNow = specs.filter((s) => s.analysisRuntimeStatus.startsWith('READY_')).map((s) => s.laneId);
  const blocked = specs.filter((s) => s.analysisRuntimeStatus.startsWith('BLOCKED_')).map((s) => ({ laneId: s.laneId, reason: s.analysisRuntimeStatus }));
  const portfolio = {
    format: RCL_FRONTIER_UNKNOWN_LAW_PORTFOLIO_FORMAT,
    version: RCL_FRONTIER_UNKNOWN_LAW_SPEC_VERSION,
    id: 'rcl_frontier_unknown_law_experiment_portfolio_v0_1',
    phase: 'Phase2A',
    objective: 'Compile the first frontier candidate mechanisms into preregistered, measurable, independently acquired experiment specifications without promoting any candidate to external truth.',
    specs,
    executableNow,
    blocked,
    firstRecommendedStudy: 'spell_symbolic_control_protocol',
    nextInfrastructureNeeds: [
      'generic full-factorial payload adapter for non-NIST studies',
      'dedicated continuous-field scorer with preregistered lag/frequency policy',
      'independent-device acquisition adapter and calibration manifest',
    ],
    boundary: COMMON_BOUNDARY,
    root: null,
  };
  portfolio.root = sha256({ ...portfolio, root: undefined });
  return portfolio;
}
