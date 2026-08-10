import { sha256 } from './reality-compiler-kernel.mjs';
import { buildUnknownLawExperimentSpec } from './frontier-unknown-law-experiment-spec.mjs';
import {
  buildKnownSoftwareInteractionControl,
  runFrontierExternalObservationPipeline,
} from './frontier-external-observation-contract.mjs';

export const RCL_FRONTIER_SPELL_SPATIAL_ACQUISITION_VERSION = '0.1.0-alpha.1';
export const RCL_FRONTIER_SPELL_SPATIAL_ACQUISITION_FORMAT = 'rcl.frontier-spell-spatial-acquisition-package.v0.1';

function stableRank(seed, value) {
  return sha256(`${seed}:${value}`);
}

function buildBalancedSchedule(samplesPerCell, seed) {
  const semanticCells = [
    { symbolCondition: 'control', spatialContext: 'control' },
    { symbolCondition: 'active', spatialContext: 'control' },
    { symbolCondition: 'control', spatialContext: 'active' },
    { symbolCondition: 'active', spatialContext: 'active' },
  ];
  const blindCodes = semanticCells
    .map((cell, i) => ({ ...cell, blindCode: `condition_${stableRank(seed, JSON.stringify(cell)).slice(0, 8)}`, index: i }))
    .sort((a, b) => a.blindCode.localeCompare(b.blindCode));
  const schedule = [];
  let n = 0;
  for (const cell of blindCodes) {
    for (let replicate = 0; replicate < samplesPerCell; replicate += 1) {
      schedule.push({
        observationId: `unknown_${String(n + 1).padStart(4, '0')}`,
        blindConditionCode: cell.blindCode,
        sessionBlock: replicate % 8,
        replicate,
        orderKey: stableRank(seed, `${cell.blindCode}:${replicate}`),
      });
      n += 1;
    }
  }
  schedule.sort((a, b) => a.orderKey.localeCompare(b.orderKey));
  return {
    semanticCells: blindCodes.map(({ orderKey, ...x }) => x),
    redactedSchedule: schedule.map(({ orderKey, ...x }, order) => ({ ...x, acquisitionOrder: order + 1 })),
  };
}

export function buildSpellSpatialAcquisitionPackage(options = {}) {
  const experimentSpec = buildUnknownLawExperimentSpec('spell_symbolic_control_protocol');
  const samplesPerCell = Math.max(24, Math.trunc(Number(options.samplesPerCell ?? 24)));
  const seed = Math.trunc(Number(options.randomizationSeed ?? 20260811));
  const { semanticCells, redactedSchedule } = buildBalancedSchedule(samplesPerCell, seed);
  const sealedConditionManifest = {
    format: 'rcl.frontier-sealed-condition-manifest.v0.1',
    mapping: semanticCells,
    revealPolicy: 'only_after_score_is_frozen',
    root: null,
  };
  sealedConditionManifest.root = sha256({ ...sealedConditionManifest, root: undefined });

  const calibrationManifest = {
    format: 'rcl.frontier-calibration-manifest.v0.1',
    status: 'UNBOUND',
    primaryInstrumentId: null,
    referenceId: null,
    measuredAt: null,
    method: null,
    tolerance: null,
    environmentalMonitorIds: [],
    requiredBeforeAcquisition: true,
    root: null,
  };
  calibrationManifest.root = sha256({ ...calibrationManifest, root: undefined });

  const rawRowSchema = {
    required: ['observationId', 'timestamp', 'instrumentId', 'session', 'blindConditionCode', 'response', 'qualityFlags'],
    responseType: 'finite_number',
    semanticLabelsForbidden: ['symbolCondition', 'spatialContext', 'expectedAnswer', 'scenarioTruth'],
  };

  const acquisitionManifest = {
    format: RCL_FRONTIER_SPELL_SPATIAL_ACQUISITION_FORMAT,
    version: RCL_FRONTIER_SPELL_SPATIAL_ACQUISITION_VERSION,
    id: 'spell_spatial_unknown_law_acquisition_v0_1',
    phase: 'Phase2B',
    experimentSpecRoot: experimentSpec.root,
    candidateRoot: experimentSpec.sourceCandidateRoot,
    designFamily: experimentSpec.designGrammar.family,
    samplesPerCell,
    totalObservations: redactedSchedule.length,
    randomizationSeed: seed,
    redactedSchedule,
    sealedConditionManifestRoot: sealedConditionManifest.root,
    calibrationManifest,
    rawRowSchema,
    instrumentBinding: {
      status: 'UNBOUND',
      primarySensorRequirement: experimentSpec.instrumentRequirements[0],
      timingRequirement: experimentSpec.instrumentRequirements[1],
      environmentalRequirements: experimentSpec.instrumentRequirements.slice(2),
    },
    acquisitionBoundary: {
      producerMustRunOutsideScorerProcess: true,
      rawFileMustExistBeforeRclIntake: true,
      rawFileMustBeRootBound: true,
      evaluatorMayNotReceiveSemanticMapping: true,
      unknownAcquisitionArmed: false,
    },
    status: 'READY_FOR_HARDWARE_BINDING_AND_KNOWN_CONTROL_DRY_RUN',
    externalRealityVerified: false,
    newNaturalLawVerified: false,
    magicVerified: false,
    root: null,
  };
  acquisitionManifest.root = sha256({ ...acquisitionManifest, root: undefined });
  return { acquisitionManifest, sealedConditionManifest, experimentSpec };
}

export function validateSpellSpatialAcquisitionPackage(bundle = {}) {
  const failures = [];
  const { acquisitionManifest: m, sealedConditionManifest: sealed } = bundle;
  if (!m || m.format !== RCL_FRONTIER_SPELL_SPATIAL_ACQUISITION_FORMAT) failures.push('unsupported_manifest');
  if (!sealed?.root) failures.push('missing_sealed_condition_manifest');
  if (m?.designFamily !== 'simple_2x2') failures.push('wrong_design_family');
  if (m?.totalObservations !== m?.samplesPerCell * 4) failures.push('unbalanced_total_observations');
  const counts = new Map();
  for (const row of m?.redactedSchedule ?? []) {
    counts.set(row.blindConditionCode, (counts.get(row.blindConditionCode) ?? 0) + 1);
    if ('symbolCondition' in row || 'spatialContext' in row) failures.push('semantic_label_leakage');
  }
  if (counts.size !== 4) failures.push('expected_four_blind_conditions');
  for (const count of counts.values()) if (count !== m.samplesPerCell) failures.push('unbalanced_condition_count');
  if (m?.acquisitionBoundary?.unknownAcquisitionArmed !== false) failures.push('unknown_acquisition_must_start_disarmed');
  if (m?.calibrationManifest?.status !== 'UNBOUND') failures.push('default_calibration_must_be_unbound');
  if (m?.externalRealityVerified !== false || m?.magicVerified !== false) failures.push('evidence_boundary_violation');
  const recomputedRoot = m ? sha256({ ...m, root: undefined }) : null;
  if (m && m.root !== recomputedRoot) failures.push('manifest_root_mismatch');
  const recomputedSealedRoot = sealed ? sha256({ ...sealed, root: undefined }) : null;
  if (sealed && sealed.root !== recomputedSealedRoot) failures.push('sealed_condition_root_mismatch');
  return { ok: failures.length === 0, failures: [...new Set(failures)].sort(), recomputedRoot, recomputedSealedRoot };
}

export function runSpellSpatialKnownControlDryRun(options = {}) {
  const bundle = buildSpellSpatialAcquisitionPackage(options);
  const validation = validateSpellSpatialAcquisitionPackage(bundle);
  const knownControl = buildKnownSoftwareInteractionControl({
    seed: Number(options.knownControlSeed ?? 20260811),
    samplesPerCell: bundle.acquisitionManifest.samplesPerCell,
    interaction: Number(options.knownControlInteraction ?? 1.2),
  });
  const pipeline = runFrontierExternalObservationPipeline(knownControl, {
    randomizationSeed: Number(options.blindSeed ?? 99173),
  });
  const result = {
    format: 'rcl.frontier-spell-spatial-known-control-dry-run.v0.1',
    version: RCL_FRONTIER_SPELL_SPATIAL_ACQUISITION_VERSION,
    packageRoot: bundle.acquisitionManifest.root,
    packageValid: validation.ok,
    knownControlDetected: pipeline.score?.detected === true,
    knownControlWinner: pipeline.score?.modelWinner ?? null,
    blindPipelineOk: pipeline.ok === true,
    unknownAcquisitionArmed: false,
    externalRealityVerified: false,
    newNaturalLawVerified: false,
    magicVerified: false,
    root: null,
  };
  result.root = sha256({ ...result, root: undefined });
  return { bundle, validation, pipeline, result };
}
