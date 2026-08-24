import fs from 'node:fs';
import path from 'node:path';
import { canonicalJson, createSeededRandom, sha256 } from './reality-compiler-kernel.mjs';
import {
  buildFrontierSymbolicGeometryPreregistration,
  scoreFrontierSymbolicGeometryBlindDeck,
} from './frontier-symbolic-geometry-blindtest.mjs';

export const RCL_FRONTIER_EXTERNAL_OBSERVATION_VERSION = '0.1.0-alpha.1';
export const RCL_FRONTIER_EXTERNAL_OBSERVATION_CONTRACT_FORMAT = 'rcl.frontier-external-observation-contract.v0.1';
export const RCL_FRONTIER_EXTERNAL_OBSERVATION_VALIDATION_FORMAT = 'rcl.frontier-external-observation-validation.v0.1';
export const RCL_FRONTIER_EXTERNAL_OBSERVATION_BLIND_PACKAGE_FORMAT = 'rcl.frontier-external-observation-blind-package.v0.1';
export const RCL_FRONTIER_EXTERNAL_OBSERVATION_REVEAL_FORMAT = 'rcl.frontier-external-observation-reveal.v0.1';
export const RCL_FRONTIER_EXTERNAL_OBSERVATION_CONTROL_SUITE_FORMAT = 'rcl.frontier-external-observation-control-suite.v0.1';

const SUPPORTED_SOURCE_TYPES = new Set(['sensor', 'instrument', 'public_dataset', 'software_control', 'manual_observation']);
const CONDITION_VALUES = new Set(['active', 'control']);
const FORBIDDEN_SCORE_LEAK_FIELDS = new Set([
  'expectedInteractionDetected',
  'betaInteraction',
  'betaSymbol',
  'betaGeometry',
  'scenarioId',
  'truth',
  'sealedTruth',
  'activeLevel',
]);

function round(value, digits = 9) {
  const scale = 10 ** digits;
  return Math.round(Number(value) * scale) / scale;
}

function isIsoTimestamp(value) {
  if (typeof value !== 'string' || value.length < 10) return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function deepContainsForbiddenKey(value) {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some(deepContainsForbiddenKey);
  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN_SCORE_LEAK_FIELDS.has(key)) return true;
    if (deepContainsForbiddenKey(nested)) return true;
  }
  return false;
}

function normalizeRow(row, index) {
  return {
    observationId: String(row.observationId ?? `obs_${String(index + 1).padStart(4, '0')}`),
    timestamp: String(row.timestamp ?? ''),
    instrumentId: String(row.instrumentId ?? ''),
    session: Number(row.session ?? 0),
    symbolCondition: String(row.symbolCondition ?? ''),
    geometryCondition: String(row.geometryCondition ?? ''),
    response: Number(row.response),
    qualityFlags: Array.isArray(row.qualityFlags) ? [...row.qualityFlags].map(String).sort() : [],
  };
}

function normalizeProvenance(input = {}) {
  return {
    sourceType: String(input.sourceType ?? ''),
    sourceUri: String(input.sourceUri ?? ''),
    collector: String(input.collector ?? ''),
    acquiredAt: String(input.acquiredAt ?? ''),
    licenseOrPermission: String(input.licenseOrPermission ?? ''),
    acquisitionMethod: String(input.acquisitionMethod ?? ''),
  };
}

function normalizeCalibration(input = {}) {
  return {
    status: String(input.status ?? ''),
    referenceId: String(input.referenceId ?? ''),
    measuredAt: String(input.measuredAt ?? ''),
    method: String(input.method ?? ''),
    tolerance: Number(input.tolerance ?? NaN),
    notes: String(input.notes ?? ''),
  };
}

export function buildFrontierExternalObservationContract(input = {}) {
  const rows = (Array.isArray(input.rows) ? input.rows : []).map(normalizeRow);
  const provenance = normalizeProvenance(input.provenance);
  const calibration = normalizeCalibration(input.calibration);
  const rawPayload = { rows, provenance, calibration };
  const computedRawDataRoot = sha256(rawPayload);
  const contract = {
    format: RCL_FRONTIER_EXTERNAL_OBSERVATION_CONTRACT_FORMAT,
    version: RCL_FRONTIER_EXTERNAL_OBSERVATION_VERSION,
    id: String(input.id ?? `external_observation_${computedRawDataRoot.slice(0, 16)}`),
    purpose: String(input.purpose ?? 'Blind external observation intake for frontier symbolic × geometry interaction testing.'),
    provenance,
    calibration,
    rows,
    rawDataRoot: computedRawDataRoot,
    declaredRawDataRoot: input.declaredRawDataRoot ? String(input.declaredRawDataRoot) : null,
    immutableAfterSeal: true,
    semanticLabelsSealedFromEvaluator: true,
    externalRealityVerified: false,
    boundary: 'external_data_contract_does_not_imply_external_effect_verification',
    root: null,
  };
  contract.root = sha256({ ...contract, root: undefined });
  return contract;
}

export function validateFrontierExternalObservationContract(contractInput = {}) {
  const contract = contractInput.format === RCL_FRONTIER_EXTERNAL_OBSERVATION_CONTRACT_FORMAT
    ? contractInput
    : buildFrontierExternalObservationContract(contractInput);
  const failures = [];
  const warnings = [];

  if (!SUPPORTED_SOURCE_TYPES.has(contract.provenance?.sourceType)) failures.push('unsupported_or_missing_source_type');
  if (!contract.provenance?.sourceUri) failures.push('missing_source_uri');
  if (!contract.provenance?.collector) failures.push('missing_collector');
  if (!isIsoTimestamp(contract.provenance?.acquiredAt)) failures.push('invalid_provenance_acquired_at');
  if (!contract.provenance?.licenseOrPermission) failures.push('missing_license_or_permission');
  if (!contract.provenance?.acquisitionMethod) failures.push('missing_acquisition_method');

  if (contract.calibration?.status !== 'valid') failures.push('calibration_not_valid');
  if (!contract.calibration?.referenceId) failures.push('missing_calibration_reference');
  if (!isIsoTimestamp(contract.calibration?.measuredAt)) failures.push('invalid_calibration_timestamp');
  if (!contract.calibration?.method) failures.push('missing_calibration_method');
  if (!Number.isFinite(Number(contract.calibration?.tolerance)) || Number(contract.calibration?.tolerance) < 0) failures.push('invalid_calibration_tolerance');

  if (!Array.isArray(contract.rows) || contract.rows.length < 32) failures.push('insufficient_observations');
  const ids = new Set();
  const cells = new Map();
  for (const row of contract.rows ?? []) {
    if (!row.observationId || ids.has(row.observationId)) failures.push(`duplicate_or_missing_observation_id:${row.observationId ?? 'missing'}`);
    ids.add(row.observationId);
    if (!isIsoTimestamp(row.timestamp)) failures.push(`invalid_timestamp:${row.observationId}`);
    if (!row.instrumentId) failures.push(`missing_instrument_id:${row.observationId}`);
    if (!Number.isInteger(row.session) || row.session < 0) failures.push(`invalid_session:${row.observationId}`);
    if (!CONDITION_VALUES.has(row.symbolCondition)) failures.push(`invalid_symbol_condition:${row.observationId}`);
    if (!CONDITION_VALUES.has(row.geometryCondition)) failures.push(`invalid_geometry_condition:${row.observationId}`);
    if (!Number.isFinite(Number(row.response))) failures.push(`invalid_response:${row.observationId}`);
    const cell = `${row.symbolCondition}:${row.geometryCondition}`;
    cells.set(cell, (cells.get(cell) ?? 0) + 1);
    if (row.qualityFlags?.length) warnings.push(`quality_flags:${row.observationId}:${row.qualityFlags.join(',')}`);
  }
  for (const symbolCondition of CONDITION_VALUES) {
    for (const geometryCondition of CONDITION_VALUES) {
      const cell = `${symbolCondition}:${geometryCondition}`;
      if ((cells.get(cell) ?? 0) < 8) failures.push(`underfilled_factor_cell:${cell}`);
    }
  }

  const recomputedRawDataRoot = sha256({ rows: contract.rows, provenance: contract.provenance, calibration: contract.calibration });
  if (recomputedRawDataRoot !== contract.rawDataRoot) failures.push('raw_data_root_mismatch');
  if (contract.declaredRawDataRoot && contract.declaredRawDataRoot !== recomputedRawDataRoot) failures.push('declared_raw_data_root_mismatch');
  const recomputedContractRoot = sha256({ ...contract, root: undefined });
  if (contract.root && contract.root !== recomputedContractRoot) failures.push('contract_root_mismatch');
  if (deepContainsForbiddenKey({ rows: contract.rows })) failures.push('truth_or_model_parameter_leak_in_raw_rows');

  const result = {
    format: RCL_FRONTIER_EXTERNAL_OBSERVATION_VALIDATION_FORMAT,
    version: RCL_FRONTIER_EXTERNAL_OBSERVATION_VERSION,
    contractId: contract.id,
    ok: failures.length === 0,
    failures: [...new Set(failures)].sort(),
    warnings: [...new Set(warnings)].sort(),
    observationCount: contract.rows?.length ?? 0,
    factorCellCounts: Object.fromEntries([...cells.entries()].sort(([a], [b]) => a.localeCompare(b))),
    rawDataRoot: recomputedRawDataRoot,
    contractRoot: recomputedContractRoot,
    boundary: contract.boundary,
    externalRealityVerified: false,
    root: null,
  };
  result.root = sha256({ ...result, root: undefined });
  return result;
}

function blindMapping(seed, label) {
  const activeLevel = parseInt(sha256(`${seed}:${label}`).slice(0, 8), 16) % 2;
  return { activeLevel, controlLevel: activeLevel === 0 ? 1 : 0 };
}

function encodeCondition(condition, mapping) {
  return condition === 'active' ? mapping.activeLevel : mapping.controlLevel;
}

function stableShuffle(rows, seed) {
  return rows
    .map((row, index) => ({ row, rank: sha256(`${seed}:${index}:${canonicalJson(row)}`) }))
    .sort((a, b) => a.rank.localeCompare(b.rank))
    .map(item => item.row);
}

export function createFrontierExternalObservationBlindPackage(contractInput = {}, options = {}) {
  const contract = contractInput.format === RCL_FRONTIER_EXTERNAL_OBSERVATION_CONTRACT_FORMAT
    ? contractInput
    : buildFrontierExternalObservationContract(contractInput);
  const validation = validateFrontierExternalObservationContract(contract);
  if (!validation.ok) {
    return {
      format: RCL_FRONTIER_EXTERNAL_OBSERVATION_BLIND_PACKAGE_FORMAT,
      version: RCL_FRONTIER_EXTERNAL_OBSERVATION_VERSION,
      ok: false,
      validation,
      error: 'external_observation_contract_invalid',
      externalRealityVerified: false,
      root: sha256({ validation: validation.root, error: 'external_observation_contract_invalid' }),
    };
  }
  const seed = Number(options.randomizationSeed ?? 20260811);
  const symbolMapping = blindMapping(seed, 'symbol');
  const geometryMapping = blindMapping(seed, 'geometry');
  const rows = contract.rows.map(row => {
    const symbolFactor = encodeCondition(row.symbolCondition, symbolMapping);
    const geometryFactor = encodeCondition(row.geometryCondition, geometryMapping);
    return {
      observationId: row.observationId,
      symbolFactor,
      geometryFactor,
      interactionFactor: symbolFactor * geometryFactor,
      session: row.session,
      response: round(row.response),
    };
  });
  const preregistration = buildFrontierSymbolicGeometryPreregistration();
  const redactedDeck = {
    format: 'rcl.frontier-external-observation-redacted-deck.v0.1',
    version: RCL_FRONTIER_EXTERNAL_OBSERVATION_VERSION,
    id: `blind_external_${sha256(`${contract.root}:${seed}`).slice(0, 16)}`,
    preregistrationRoot: preregistration.root,
    externalObservationContractRoot: contract.root,
    rows: stableShuffle(rows, `${seed}:${contract.root}:shuffle`),
    semanticTermsPresent: false,
    sourceMetadataVisibleToEvaluator: false,
    boundary: 'evaluator_receives_anonymous_factor_codes_and_response_only',
    root: null,
  };
  redactedDeck.root = sha256({ ...redactedDeck, root: undefined });
  const sealedRandomizationManifest = {
    format: 'rcl.frontier-external-observation-randomization-manifest.v0.1',
    contractRoot: contract.root,
    deckRoot: redactedDeck.root,
    symbolMapping,
    geometryMapping,
    randomizationSeed: seed,
    rawDataRoot: contract.rawDataRoot,
    semanticLabels: ['active', 'control'],
    mustRemainSealedUntilAfterScoring: true,
    root: null,
  };
  sealedRandomizationManifest.root = sha256({ ...sealedRandomizationManifest, root: undefined });
  const result = {
    format: RCL_FRONTIER_EXTERNAL_OBSERVATION_BLIND_PACKAGE_FORMAT,
    version: RCL_FRONTIER_EXTERNAL_OBSERVATION_VERSION,
    ok: true,
    validation,
    preregistration,
    redactedDeck,
    sealedRandomizationManifest,
    contractRoot: contract.root,
    rawDataRoot: contract.rawDataRoot,
    externalRealityVerified: false,
    root: null,
  };
  result.root = sha256({ validation: validation.root, preregistration: preregistration.root, deck: redactedDeck.root, manifest: sealedRandomizationManifest.root });
  return result;
}

function semanticSign(mapping) {
  return mapping.activeLevel === 1 ? 1 : -1;
}

export function scoreFrontierExternalObservationBlindPackage(blindPackage) {
  if (!blindPackage?.ok) {
    return {
      ok: false,
      error: 'blind_package_invalid',
      externalRealityVerified: false,
      root: sha256({ error: 'blind_package_invalid', packageRoot: blindPackage?.root ?? null }),
    };
  }
  const score = scoreFrontierSymbolicGeometryBlindDeck(blindPackage.redactedDeck, blindPackage.preregistration);
  return {
    ...score,
    format: 'rcl.frontier-external-observation-blind-score.v0.1',
    sourceContractRoot: blindPackage.contractRoot,
    sourceRawDataRoot: blindPackage.rawDataRoot,
    scoringUsedSealedRandomizationManifest: false,
    externalRealityVerified: false,
    root: sha256({ scoreRoot: score.root, contractRoot: blindPackage.contractRoot, rawDataRoot: blindPackage.rawDataRoot }),
  };
}

export function revealFrontierExternalObservationResult(blindPackage, score) {
  if (!blindPackage?.ok || !score?.root) {
    return {
      format: RCL_FRONTIER_EXTERNAL_OBSERVATION_REVEAL_FORMAT,
      ok: false,
      error: 'cannot_reveal_invalid_blind_package_or_score',
      externalRealityVerified: false,
      root: sha256({ error: 'cannot_reveal_invalid_blind_package_or_score' }),
    };
  }
  const manifest = blindPackage.sealedRandomizationManifest;
  const signed = Number(score.interactionCoefficientBlindCoding ?? 0)
    * semanticSign(manifest.symbolMapping)
    * semanticSign(manifest.geometryMapping);
  const reveal = {
    format: RCL_FRONTIER_EXTERNAL_OBSERVATION_REVEAL_FORMAT,
    version: RCL_FRONTIER_EXTERNAL_OBSERVATION_VERSION,
    ok: true,
    contractRoot: blindPackage.contractRoot,
    rawDataRoot: blindPackage.rawDataRoot,
    scoreRoot: score.root,
    randomizationManifestRoot: manifest.root,
    semanticSignedInteraction: round(signed),
    detected: Boolean(score.detected),
    revealOccurredAfterScoring: true,
    evidenceClass: score.detected ? 'external_observation_candidate_residual' : 'external_observation_null_or_insufficient_residual',
    promotionRule: 'A detected external residual remains CANDIDATE until independent replication, instrument/systematics review and evidence-ledger court approval.',
    externalRealityVerified: false,
    root: null,
  };
  reveal.root = sha256({ ...reveal, root: undefined });
  return reveal;
}

export function runFrontierExternalObservationPipeline(contractInput = {}, options = {}) {
  const contract = contractInput.format === RCL_FRONTIER_EXTERNAL_OBSERVATION_CONTRACT_FORMAT
    ? contractInput
    : buildFrontierExternalObservationContract(contractInput);
  const blindPackage = createFrontierExternalObservationBlindPackage(contract, options);
  const score = scoreFrontierExternalObservationBlindPackage(blindPackage);
  const reveal = revealFrontierExternalObservationResult(blindPackage, score);
  const result = {
    format: 'rcl.frontier-external-observation-pipeline.v0.1',
    version: RCL_FRONTIER_EXTERNAL_OBSERVATION_VERSION,
    ok: blindPackage.ok === true && score?.root && reveal.ok === true,
    contract,
    validation: blindPackage.validation,
    blindPackage: blindPackage.ok ? {
      format: blindPackage.format,
      root: blindPackage.root,
      preregistrationRoot: blindPackage.preregistration.root,
      redactedDeck: blindPackage.redactedDeck,
      sealedRandomizationManifestRoot: blindPackage.sealedRandomizationManifest.root,
      rawDataRoot: blindPackage.rawDataRoot,
      contractRoot: blindPackage.contractRoot,
    } : blindPackage,
    score,
    reveal,
    externalRealityVerified: false,
    boundary: 'pipeline_ready_for_external_observation_intake_but_no_external_natural_law_claim_is_verified',
    root: null,
  };
  result.root = sha256({ contract: contract.root, blind: blindPackage.root, score: score.root, reveal: reveal.root });
  return result;
}

function isoFromIndex(index) {
  return new Date(Date.UTC(2026, 7, 11, 0, 0, index)).toISOString();
}

export function buildKnownSoftwareInteractionControl(options = {}) {
  const seed = Number(options.seed ?? 20260811);
  const samplesPerCell = Math.max(16, Number(options.samplesPerCell ?? 48));
  const interaction = Number(options.interaction ?? 1.2);
  const betaSymbol = Number(options.betaSymbol ?? 0.15);
  const betaGeometry = Number(options.betaGeometry ?? 0.1);
  const noiseSigma = Number(options.noiseSigma ?? 0.45);
  const rng = createSeededRandom(seed);
  const rows = [];
  let index = 0;
  for (const symbolCondition of ['control', 'active']) {
    for (const geometryCondition of ['control', 'active']) {
      for (let replicate = 0; replicate < samplesPerCell; replicate += 1) {
        const s = symbolCondition === 'active' ? 1 : 0;
        const g = geometryCondition === 'active' ? 1 : 0;
        const response = betaSymbol * s + betaGeometry * g + interaction * s * g + rng.gaussian(0, noiseSigma);
        rows.push({
          observationId: `sw_${String(index + 1).padStart(4, '0')}`,
          timestamp: isoFromIndex(index),
          instrumentId: 'known-software-control-v0.1',
          session: replicate % 8,
          symbolCondition,
          geometryCondition,
          response: round(response),
          qualityFlags: [],
        });
        index += 1;
      }
    }
  }
  return buildFrontierExternalObservationContract({
    id: 'known_software_interaction_control_v0_1',
    purpose: 'Known engineered software interaction used only to verify the external-observation contract and blind scoring plumbing.',
    provenance: {
      sourceType: 'software_control',
      sourceUri: 'rcl://frontier-known-software-control/v0.1',
      collector: 'RCL Frontier External Observation Contract',
      acquiredAt: '2026-08-11T00:00:00.000Z',
      licenseOrPermission: 'internal-test-data',
      acquisitionMethod: 'deterministic seeded software generator with preregistered interaction injection',
    },
    calibration: {
      status: 'valid',
      referenceId: 'software-control-reference-v0.1',
      measuredAt: '2026-08-11T00:00:00.000Z',
      method: 'deterministic seeded generator self-check',
      tolerance: 0,
      notes: 'This calibration is for software pipeline verification only and is not a physical instrument calibration.',
    },
    rows,
  });
}

export function buildKnownSoftwareAdditiveControl(options = {}) {
  return buildKnownSoftwareInteractionControl({ ...options, interaction: 0, betaSymbol: options.betaSymbol ?? 0.8, betaGeometry: options.betaGeometry ?? 0.8 });
}

export function runFrontierExternalObservationControlSuite(options = {}) {
  const positive = runFrontierExternalObservationPipeline(buildKnownSoftwareInteractionControl(options), { randomizationSeed: options.randomizationSeed ?? 77 });
  const additive = runFrontierExternalObservationPipeline(buildKnownSoftwareAdditiveControl(options), { randomizationSeed: options.randomizationSeed ?? 77 });

  const tampered = buildKnownSoftwareInteractionControl(options);
  const tamperedContract = JSON.parse(JSON.stringify(tampered));
  tamperedContract.rows[0].response += 10;
  const tamperedValidation = validateFrontierExternalObservationContract(tamperedContract);

  const missingCalibration = buildKnownSoftwareInteractionControl(options);
  const missingCalibrationContract = JSON.parse(JSON.stringify(missingCalibration));
  missingCalibrationContract.calibration.status = 'missing';
  missingCalibrationContract.rawDataRoot = sha256({
    rows: missingCalibrationContract.rows,
    provenance: missingCalibrationContract.provenance,
    calibration: missingCalibrationContract.calibration,
  });
  missingCalibrationContract.root = sha256({ ...missingCalibrationContract, root: undefined });
  const missingCalibrationValidation = validateFrontierExternalObservationContract(missingCalibrationContract);

  const result = {
    format: RCL_FRONTIER_EXTERNAL_OBSERVATION_CONTROL_SUITE_FORMAT,
    version: RCL_FRONTIER_EXTERNAL_OBSERVATION_VERSION,
    positiveInteractionDetected: positive.score.detected === true,
    additiveControlRejected: additive.score.detected === false,
    tamperRejected: tamperedValidation.ok === false && tamperedValidation.failures.includes('raw_data_root_mismatch'),
    missingCalibrationRejected: missingCalibrationValidation.ok === false && missingCalibrationValidation.failures.includes('calibration_not_valid'),
    blindScoreManifestIsolation: positive.score.scoringUsedSealedRandomizationManifest === false,
    externalRealityVerified: false,
    boundary: 'known_software_controls_validate_pipeline_integrity_only',
    root: null,
  };
  result.ok = result.positiveInteractionDetected
    && result.additiveControlRejected
    && result.tamperRejected
    && result.missingCalibrationRejected
    && result.blindScoreManifestIsolation;
  result.verdict = result.ok
    ? 'PASS / external observation intake, immutability, calibration gate, blinding and known software controls are coherent.'
    : 'FAIL / one or more external observation contract gates failed.';
  result.root = sha256({ ...result, root: undefined });
  return result;
}

export function loadFrontierExternalObservationContractFile(filePath) {
  const resolved = path.resolve(String(filePath));
  if (path.extname(resolved).toLowerCase() !== '.json') {
    throw new Error('frontier_external_observation_contract_requires_json');
  }
  const parsed = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  return parsed?.format === RCL_FRONTIER_EXTERNAL_OBSERVATION_CONTRACT_FORMAT
    ? parsed
    : buildFrontierExternalObservationContract(parsed);
}

export function runFrontierExternalObservationFile(filePath, options = {}) {
  const contract = loadFrontierExternalObservationContractFile(filePath);
  return runFrontierExternalObservationPipeline(contract, options);
}

export function renderFrontierExternalObservationContractRcl(controlSuite = runFrontierExternalObservationControlSuite()) {
  return [
    'reality FrontierExternalObservationContract {',
    `  version : Text = "${RCL_FRONTIER_EXTERNAL_OBSERVATION_VERSION}"`,
    `  intake.known_positive_control : Truth = ${controlSuite.positiveInteractionDetected}`,
    `  intake.additive_control_rejected : Truth = ${controlSuite.additiveControlRejected}`,
    `  integrity.tamper_rejected : Truth = ${controlSuite.tamperRejected}`,
    `  calibration.missing_rejected : Truth = ${controlSuite.missingCalibrationRejected}`,
    `  blind.manifest_isolated : Truth = ${controlSuite.blindScoreManifestIsolation}`,
    '  validation.external_reality_verified : Truth = false',
    `  root.hash : Text = "${controlSuite.root}"`,
    '}',
  ].join('\n');
}

export function writeFrontierExternalObservationContractReports(outputDir = 'output/frontier-external-observation-contract-v0.1', options = {}) {
  const dir = path.resolve(outputDir);
  fs.mkdirSync(dir, { recursive: true });
  const positiveContract = buildKnownSoftwareInteractionControl(options);
  const positivePipeline = runFrontierExternalObservationPipeline(positiveContract, { randomizationSeed: options.randomizationSeed ?? 77 });
  const additivePipeline = runFrontierExternalObservationPipeline(buildKnownSoftwareAdditiveControl(options), { randomizationSeed: options.randomizationSeed ?? 77 });
  const controlSuite = runFrontierExternalObservationControlSuite(options);
  fs.writeFileSync(path.join(dir, 'known-software-positive-contract.json'), `${JSON.stringify(positiveContract, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'known-software-positive-redacted-deck.json'), `${JSON.stringify(positivePipeline.blindPackage.redactedDeck, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'known-software-positive-blind-score.json'), `${JSON.stringify(positivePipeline.score, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'known-software-positive-reveal.json'), `${JSON.stringify(positivePipeline.reveal, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'known-software-additive-blind-score.json'), `${JSON.stringify(additivePipeline.score, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'control-suite.json'), `${JSON.stringify(controlSuite, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'frontier-external-observation-contract.rcl'), `${renderFrontierExternalObservationContractRcl(controlSuite)}\n`);
  fs.writeFileSync(path.join(dir, 'README.md'), [
    '# RCL Frontier External Observation Contract v0.1',
    '',
    `Verdict: **${controlSuite.verdict}**`,
    `Control suite PASS: **${controlSuite.ok}**`,
    'External reality verified: **false**',
    '',
    'This package closes the data-contract/blinding/integrity plumbing using known software controls. It is ready to accept real sensor, instrument or public-dataset observations, but no frontier natural-law claim is verified until such external data is collected and independently replicated.',
  ].join('\n') + '\n');
  return { ok: controlSuite.ok, outputDir: dir, root: controlSuite.root, externalRealityVerified: false };
}
