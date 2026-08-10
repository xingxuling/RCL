import fs from 'node:fs';
import path from 'node:path';
import { sha256 } from './reality-compiler-kernel.mjs';
import { buildSpellSpatialAcquisitionPackage } from './frontier-spell-spatial-acquisition-package.mjs';

export const RCL_FRONTIER_INSTRUMENT_BINDING_VERSION = '0.1.0-alpha.1';
export const RCL_FRONTIER_INSTRUMENT_BINDING_FORMAT = 'rcl.frontier-instrument-binding-contract.v0.1';
export const RCL_FRONTIER_CALIBRATION_RECEIPT_FORMAT = 'rcl.frontier-calibration-receipt.v0.1';
export const RCL_FRONTIER_RAW_ACQUISITION_FORMAT = 'rcl.frontier-spell-spatial-raw-acquisition.v0.1';

function isIso(value) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

export function buildCalibrationReceipt(input = {}) {
  const receipt = {
    format: RCL_FRONTIER_CALIBRATION_RECEIPT_FORMAT,
    version: RCL_FRONTIER_INSTRUMENT_BINDING_VERSION,
    status: String(input.status ?? 'invalid'),
    instrumentId: String(input.instrumentId ?? ''),
    referenceId: String(input.referenceId ?? ''),
    measuredAt: String(input.measuredAt ?? ''),
    method: String(input.method ?? ''),
    tolerance: Number.isFinite(Number(input.tolerance)) ? Number(input.tolerance) : null,
    unit: String(input.unit ?? ''),
    rawCalibrationRoot: String(input.rawCalibrationRoot ?? ''),
    root: null,
  };
  receipt.root = sha256({ ...receipt, root: undefined });
  return receipt;
}

export function validateCalibrationReceipt(receipt = {}) {
  const failures = [];
  if (receipt.format !== RCL_FRONTIER_CALIBRATION_RECEIPT_FORMAT) failures.push('unsupported_calibration_format');
  if (receipt.status !== 'valid') failures.push('calibration_status_not_valid');
  if (!receipt.instrumentId) failures.push('missing_instrument_id');
  if (!receipt.referenceId) failures.push('missing_reference_id');
  if (!isIso(receipt.measuredAt)) failures.push('invalid_measured_at');
  if (!receipt.method) failures.push('missing_method');
  if (!Number.isFinite(receipt.tolerance) || receipt.tolerance <= 0) failures.push('invalid_tolerance');
  if (!receipt.unit) failures.push('missing_unit');
  if (!receipt.rawCalibrationRoot) failures.push('missing_raw_calibration_root');
  const recomputedRoot = sha256({ ...receipt, root: undefined });
  if (receipt.root !== recomputedRoot) failures.push('calibration_root_mismatch');
  return { ok: failures.length === 0, failures: [...new Set(failures)].sort(), recomputedRoot };
}

export function buildInstrumentBindingContract(input = {}) {
  const basePackage = buildSpellSpatialAcquisitionPackage({
    samplesPerCell: input.samplesPerCell ?? 24,
    randomizationSeed: input.randomizationSeed ?? 20260811,
  });
  const calibration = input.calibration?.format === RCL_FRONTIER_CALIBRATION_RECEIPT_FORMAT
    ? input.calibration
    : buildCalibrationReceipt(input.calibration ?? {});
  const calibrationValidation = validateCalibrationReceipt(calibration);
  const contract = {
    format: RCL_FRONTIER_INSTRUMENT_BINDING_FORMAT,
    version: RCL_FRONTIER_INSTRUMENT_BINDING_VERSION,
    id: String(input.id ?? 'spell_spatial_instrument_binding_v0_1'),
    phase: 'Phase2C',
    acquisitionManifestRoot: basePackage.acquisitionManifest.root,
    sealedConditionManifestRoot: basePackage.sealedConditionManifest.root,
    instrument: {
      instrumentId: String(input.instrument?.instrumentId ?? ''),
      sensorType: String(input.instrument?.sensorType ?? ''),
      unit: String(input.instrument?.unit ?? ''),
      samplingMode: String(input.instrument?.samplingMode ?? 'single_numeric_response_per_schedule_slot'),
      exportFormat: String(input.instrument?.exportFormat ?? 'json'),
      passiveMeasurementOnly: input.instrument?.passiveMeasurementOnly !== false,
      deviceFingerprint: String(input.instrument?.deviceFingerprint ?? ''),
    },
    calibration,
    calibrationRoot: calibration.root,
    calibrationValid: calibrationValidation.ok,
    bindingStatus: calibrationValidation.ok ? 'BOUND_CALIBRATED' : 'BLOCKED_INVALID_CALIBRATION',
    unknownAcquisitionArmed: false,
    rawAcquisitionFormat: RCL_FRONTIER_RAW_ACQUISITION_FORMAT,
    scheduleObservationCount: basePackage.acquisitionManifest.totalObservations,
    externalRealityVerified: false,
    newNaturalLawVerified: false,
    magicVerified: false,
    root: null,
  };
  contract.root = sha256({ ...contract, root: undefined });
  return { contract, calibrationValidation, basePackage };
}

export function validateInstrumentBindingContract(bundle = {}) {
  const failures = [];
  const c = bundle.contract;
  if (!c || c.format !== RCL_FRONTIER_INSTRUMENT_BINDING_FORMAT) failures.push('unsupported_binding_format');
  if (!c?.instrument?.instrumentId) failures.push('missing_instrument_id');
  if (!c?.instrument?.sensorType) failures.push('missing_sensor_type');
  if (!c?.instrument?.unit) failures.push('missing_instrument_unit');
  if (!c?.instrument?.deviceFingerprint) failures.push('missing_device_fingerprint');
  if (c?.instrument?.passiveMeasurementOnly !== true) failures.push('phase2c_requires_passive_measurement_only');
  const cal = validateCalibrationReceipt(c?.calibration ?? {});
  if (!cal.ok) failures.push(...cal.failures.map((x) => `calibration:${x}`));
  if (c?.unknownAcquisitionArmed !== false) failures.push('unknown_acquisition_must_remain_disarmed');
  if (c?.externalRealityVerified !== false || c?.magicVerified !== false) failures.push('evidence_boundary_violation');
  const recomputedRoot = c ? sha256({ ...c, root: undefined }) : null;
  if (c && c.root !== recomputedRoot) failures.push('binding_root_mismatch');
  return { ok: failures.length === 0, failures: [...new Set(failures)].sort(), recomputedRoot };
}

export function buildRawAcquisitionTemplate(bundle) {
  const validation = validateInstrumentBindingContract(bundle);
  if (!validation.ok) throw new Error(`instrument_binding_invalid:${validation.failures.join(',')}`);
  const c = bundle.contract;
  const schedule = bundle.basePackage.acquisitionManifest.redactedSchedule;
  const rows = schedule.map((slot) => ({
    observationId: slot.observationId,
    timestamp: null,
    instrumentId: c.instrument.instrumentId,
    session: slot.sessionBlock,
    blindConditionCode: slot.blindConditionCode,
    response: null,
    qualityFlags: [],
  }));
  const raw = {
    format: RCL_FRONTIER_RAW_ACQUISITION_FORMAT,
    version: RCL_FRONTIER_INSTRUMENT_BINDING_VERSION,
    bindingRoot: c.root,
    acquisitionManifestRoot: c.acquisitionManifestRoot,
    instrumentId: c.instrument.instrumentId,
    calibrationRoot: c.calibrationRoot,
    rows,
    producedOutsideRclScorerProcess: true,
    externalRealityVerified: false,
    newNaturalLawVerified: false,
    magicVerified: false,
    root: null,
  };
  raw.root = sha256({ ...raw, root: undefined });
  return raw;
}

export function validateCompletedRawAcquisition(raw = {}, bundle = {}) {
  const failures = [];
  const bindingValidation = validateInstrumentBindingContract(bundle);
  if (!bindingValidation.ok) failures.push('binding_invalid');
  if (raw.format !== RCL_FRONTIER_RAW_ACQUISITION_FORMAT) failures.push('unsupported_raw_format');
  if (raw.bindingRoot !== bundle.contract?.root) failures.push('binding_root_mismatch');
  if (raw.instrumentId !== bundle.contract?.instrument?.instrumentId) failures.push('instrument_id_mismatch');
  if (raw.calibrationRoot !== bundle.contract?.calibrationRoot) failures.push('calibration_root_mismatch');
  const expected = new Map((bundle.basePackage?.acquisitionManifest?.redactedSchedule ?? []).map((x) => [x.observationId, x]));
  if (!Array.isArray(raw.rows) || raw.rows.length !== expected.size) failures.push('raw_row_count_mismatch');
  const seen = new Set();
  for (const row of raw.rows ?? []) {
    if (seen.has(row.observationId)) failures.push('duplicate_observation_id');
    seen.add(row.observationId);
    const slot = expected.get(row.observationId);
    if (!slot) failures.push('unexpected_observation_id');
    if (slot && row.blindConditionCode !== slot.blindConditionCode) failures.push('blind_condition_code_mismatch');
    if (!isIso(row.timestamp)) failures.push('invalid_timestamp');
    if (row.instrumentId !== raw.instrumentId) failures.push('row_instrument_id_mismatch');
    if (!Number.isFinite(Number(row.response))) failures.push('non_numeric_response');
    if ('symbolCondition' in row || 'spatialContext' in row || 'expectedAnswer' in row) failures.push('semantic_label_leakage');
  }
  for (const id of expected.keys()) if (!seen.has(id)) failures.push('missing_observation_id');
  const recomputedRoot = sha256({ ...raw, root: undefined });
  if (raw.root !== recomputedRoot) failures.push('raw_root_mismatch');
  if (raw.externalRealityVerified !== false || raw.magicVerified !== false) failures.push('evidence_boundary_violation');
  return { ok: failures.length === 0, failures: [...new Set(failures)].sort(), recomputedRoot };
}

export function exportInstrumentBindingBundle(outputDir, bundle) {
  const validation = validateInstrumentBindingContract(bundle);
  if (!validation.ok) throw new Error(`instrument_binding_invalid:${validation.failures.join(',')}`);
  fs.mkdirSync(outputDir, { recursive: true });
  const rawTemplate = buildRawAcquisitionTemplate(bundle);
  const files = {
    binding: path.join(outputDir, 'instrument-binding.json'),
    calibration: path.join(outputDir, 'calibration-receipt.json'),
    schedule: path.join(outputDir, 'redacted-schedule.json'),
    rawTemplate: path.join(outputDir, 'raw-acquisition-template.json'),
    privateManifest: path.join(outputDir, 'sealed-condition-manifest.private.json'),
  };
  fs.writeFileSync(files.binding, JSON.stringify(bundle.contract, null, 2));
  fs.writeFileSync(files.calibration, JSON.stringify(bundle.contract.calibration, null, 2));
  fs.writeFileSync(files.schedule, JSON.stringify(bundle.basePackage.acquisitionManifest.redactedSchedule, null, 2));
  fs.writeFileSync(files.rawTemplate, JSON.stringify(rawTemplate, null, 2));
  fs.writeFileSync(files.privateManifest, JSON.stringify(bundle.basePackage.sealedConditionManifest, null, 2));
  return { files, rawTemplateRoot: rawTemplate.root, bindingRoot: bundle.contract.root };
}
