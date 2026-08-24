import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { sha256 } from './reality-compiler-kernel.mjs';
import {
  buildFrontierExternalObservationContract,
  runFrontierExternalObservationPipeline,
} from './frontier-external-observation-contract.mjs';

export const RCL_FRONTIER_INDEPENDENT_FILE_OBSERVATION_VERSION = '0.1.0-alpha.1';
export const RCL_FRONTIER_INDEPENDENT_FILE_FORMAT = 'rcl.frontier-independent-acquisition-file.v0.1';
export const RCL_FRONTIER_INDEPENDENT_FILE_RESULT_FORMAT = 'rcl.frontier-independent-file-observation-result.v0.1';

function isIso(value) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

export function validateIndependentAcquisitionFile(input = {}, options = {}) {
  const failures = [];
  const warnings = [];
  if (input.format !== RCL_FRONTIER_INDEPENDENT_FILE_FORMAT) failures.push('unsupported_file_format');
  if (input.producer?.importsRcl !== false) failures.push('producer_must_declare_no_rcl_imports');
  if (input.producer?.producerSourceBoundary !== 'node-builtins-only_no_rcl_imports') failures.push('producer_source_boundary_not_independent');
  if (!Number.isInteger(input.producer?.processId) || input.producer.processId <= 0) failures.push('invalid_producer_process_id');
  if (Number(input.producer?.processId) === process.pid) failures.push('producer_process_must_differ_from_rcl_intake_process');
  if (!isIso(input.producer?.startedAt) || !isIso(input.producer?.completedAt)) failures.push('invalid_producer_timestamps');
  if (isIso(input.producer?.startedAt) && isIso(input.producer?.completedAt) && Date.parse(input.producer.completedAt) < Date.parse(input.producer.startedAt)) failures.push('producer_completion_precedes_start');
  if (!input.producer?.hostFingerprint) failures.push('missing_host_fingerprint');
  if (!Array.isArray(input.rows) || input.rows.length < 32) failures.push('insufficient_rows');
  if (!input.provenance?.sourceUri) failures.push('missing_source_uri');
  if (options.requirePreexistingFile === true && !options.fileStat) failures.push('missing_preexisting_file_stat');
  if (options.fileStat && isIso(input.producer?.completedAt)) {
    const mtime = Number(options.fileStat.mtimeMs);
    if (Number.isFinite(mtime) && mtime + 2000 < Date.parse(input.producer.completedAt)) warnings.push('file_mtime_precedes_declared_completion');
  }
  const recomputedFileRoot = sha256({ ...input, fileRoot: undefined });
  if (input.fileRoot !== recomputedFileRoot) failures.push('independent_file_root_mismatch');
  const result = {
    ok: failures.length === 0,
    failures: [...new Set(failures)].sort(),
    warnings: [...new Set(warnings)].sort(),
    recomputedFileRoot,
    producerProcessId: input.producer?.processId ?? null,
    intakeProcessId: process.pid,
    sameProcess: Number(input.producer?.processId) === process.pid,
    producerCompletedAt: input.producer?.completedAt ?? null,
    externalRealityVerified: false,
    root: null,
  };
  result.root = sha256({ ...result, root: undefined });
  return result;
}

export function ingestIndependentAcquisitionObject(input = {}, options = {}) {
  const validation = validateIndependentAcquisitionFile(input, options);
  if (!validation.ok) {
    return {
      format: RCL_FRONTIER_INDEPENDENT_FILE_RESULT_FORMAT,
      version: RCL_FRONTIER_INDEPENDENT_FILE_OBSERVATION_VERSION,
      ok: false,
      validation,
      error: 'independent_acquisition_file_invalid',
      externalRealityVerified: false,
      root: sha256({ error: 'independent_acquisition_file_invalid', validation: validation.root }),
    };
  }
  const contract = buildFrontierExternalObservationContract({
    id: `independent_file_${String(input.study?.mode ?? 'unknown')}_v0_1`,
    purpose: 'Route a file fully produced by a separate acquisition process through the same provenance, calibration, immutable-root and blind-evaluation pipeline used by RCL frontier research.',
    provenance: {
      ...input.provenance,
      acquisitionMethod: `${input.provenance.acquisitionMethod}; producerProcessId=${input.producer.processId}; producerHostFingerprint=${input.producer.hostFingerprint}; independentFileRoot=${input.fileRoot}`,
    },
    calibration: input.calibration,
    rows: input.rows,
  });
  const pipeline = runFrontierExternalObservationPipeline(contract, {
    randomizationSeed: Number(options.randomizationSeed ?? 99173),
  });
  const result = {
    format: RCL_FRONTIER_INDEPENDENT_FILE_RESULT_FORMAT,
    version: RCL_FRONTIER_INDEPENDENT_FILE_OBSERVATION_VERSION,
    ok: pipeline.ok === true,
    validation,
    studyMode: input.study?.mode ?? null,
    declaredTruthClass: input.study?.truthClass ?? null,
    detected: pipeline.score?.detected ?? null,
    modelWinner: pipeline.score?.modelSelection?.winner ?? null,
    contractRoot: contract.root,
    rawDataRoot: contract.rawDataRoot,
    independentFileRoot: input.fileRoot,
    producerProcessId: input.producer.processId,
    intakeProcessId: process.pid,
    dataProducedBeforeRclRead: true,
    evidenceClass: 'separate_process_same_host_known_engineered_control',
    independenceBoundary: 'process_and_file_boundary_only_not_third_party_replication_or_independent_device',
    externalRealityVerified: false,
    newNaturalLawVerified: false,
    magicVerified: false,
    pipeline,
    root: null,
  };
  result.root = sha256({ ...result, root: undefined });
  return result;
}

export function ingestIndependentAcquisitionFile(filePath, options = {}) {
  const resolved = path.resolve(String(filePath));
  if (!fs.existsSync(resolved)) {
    return {
      format: RCL_FRONTIER_INDEPENDENT_FILE_RESULT_FORMAT,
      version: RCL_FRONTIER_INDEPENDENT_FILE_OBSERVATION_VERSION,
      ok: false,
      error: 'independent_acquisition_file_not_found',
      filePath: resolved,
      externalRealityVerified: false,
      root: sha256({ error: 'independent_acquisition_file_not_found', filePath: resolved }),
    };
  }
  const fileStat = fs.statSync(resolved);
  const input = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  const result = ingestIndependentAcquisitionObject(input, { ...options, requirePreexistingFile: true, fileStat });
  return {
    ...result,
    filePath: resolved,
    fileSizeBytes: fileStat.size,
    fileMtimeMs: fileStat.mtimeMs,
    root: sha256({ resultRoot: result.root, filePath: resolved, fileSizeBytes: fileStat.size }),
  };
}

export function runIndependentFileControlPair(interactionFile, additiveFile, options = {}) {
  const interaction = ingestIndependentAcquisitionFile(interactionFile, { ...options, randomizationSeed: Number(options.interactionSeed ?? 99173) });
  const additive = ingestIndependentAcquisitionFile(additiveFile, { ...options, randomizationSeed: Number(options.additiveSeed ?? 88121) });
  const ok = interaction.ok === true
    && interaction.detected === true
    && interaction.modelWinner === 'H_interaction'
    && additive.ok === true
    && additive.detected === false;
  const result = {
    format: 'rcl.frontier-independent-file-control-pair.v0.1',
    version: RCL_FRONTIER_INDEPENDENT_FILE_OBSERVATION_VERSION,
    ok,
    verdict: ok ? 'PASS_PHASE1C_SEPARATE_PROCESS_FILE_BOUNDARY' : 'FAIL_PHASE1C_SEPARATE_PROCESS_FILE_BOUNDARY',
    interactionDetected: interaction.detected,
    interactionWinner: interaction.modelWinner,
    additiveRejectedAsInteraction: additive.detected === false,
    additiveWinner: additive.modelWinner,
    producerProcessesDifferFromIntake: interaction.producerProcessId !== process.pid && additive.producerProcessId !== process.pid,
    externalRealityVerified: false,
    evidenceBoundary: 'validates_separate_process_preexisting_file_intake_not_unknown_natural_law_or_independent_replication',
    interaction,
    additive,
    root: null,
  };
  result.root = sha256({ ...result, root: undefined });
  return result;
}
