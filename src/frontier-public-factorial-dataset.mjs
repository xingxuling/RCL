import fs from 'node:fs';
import path from 'node:path';
import { sha256 } from './reality-compiler-kernel.mjs';
import {
  buildFrontierExternalObservationContract,
  runFrontierExternalObservationPipeline,
} from './frontier-external-observation-contract.mjs';

export const RCL_FRONTIER_PUBLIC_FACTORIAL_VERSION = '0.1.0-alpha.1';
export const RCL_FRONTIER_PUBLIC_FACTORIAL_FORMAT = 'rcl.frontier-public-factorial-dataset.v0.1';

const FACTORS = ['speed', 'rate', 'grit', 'direction', 'batch'];
const PUBLISHED_SS_HOLDOUT = Object.freeze({
  speed: 894.33,
  rate: 3497.20,
  speed_rate: 4872.57,
  grit: 12663.96,
  direction: 315132.65,
  batch: 33653.91,
});

function round(value, digits = 9) {
  const scale = 10 ** digits;
  return Math.round(Number(value) * scale) / scale;
}

function termKey(indices) {
  return indices.map(i => FACTORS[i]).join('_');
}

function combinations(n) {
  const out = [];
  for (let mask = 1; mask < (1 << n); mask += 1) {
    const indices = [];
    for (let i = 0; i < n; i += 1) if (mask & (1 << i)) indices.push(i);
    out.push(indices);
  }
  return out;
}

export function validatePublicFactorialDataset(dataset = {}) {
  const failures = [];
  if (dataset.format !== 'rcl.frontier-public-dataset-fixture.v0.1') failures.push('unsupported_fixture_format');
  if (dataset.datasetId !== 'nist-ceramic-strength-2pow5') failures.push('unexpected_dataset_id');
  if (!Array.isArray(dataset.rows) || dataset.rows.length !== 32) failures.push('expected_32_rows');
  const cells = new Set();
  for (const row of dataset.rows ?? []) {
    if (!Array.isArray(row) || row.length !== 8) {
      failures.push('invalid_row_shape');
      continue;
    }
    const levels = row.slice(1, 6);
    if (levels.some(v => ![-1, 1].includes(Number(v)))) failures.push(`non_binary_factor_level:${row[0]}`);
    if (!Number.isFinite(Number(row[6]))) failures.push(`invalid_strength:${row[0]}`);
    cells.add(levels.join(','));
  }
  if (cells.size !== 32) failures.push('design_not_complete_2pow5');
  const result = {
    ok: failures.length === 0,
    failures: [...new Set(failures)].sort(),
    rowCount: dataset.rows?.length ?? 0,
    uniqueDesignCells: cells.size,
    sourcePage: dataset.source?.page ?? null,
    sourcePublisher: dataset.source?.publisher ?? null,
    externalRealityVerified: false,
    root: null,
  };
  result.root = sha256({ ...result, root: undefined });
  return result;
}

export function computeOrthogonalFactorialEffects(dataset = {}) {
  const validation = validatePublicFactorialDataset(dataset);
  if (!validation.ok) return { ok: false, validation, externalRealityVerified: false, root: sha256({ validation: validation.root }) };
  const n = dataset.rows.length;
  const terms = {};
  for (const indices of combinations(5)) {
    let weighted = 0;
    for (const row of dataset.rows) {
      const x = row.slice(1, 6).map(Number);
      const y = Number(row[6]);
      let product = 1;
      for (const index of indices) product *= x[index];
      weighted += y * product;
    }
    const beta = weighted / n;
    terms[termKey(indices)] = {
      order: indices.length,
      beta: round(beta),
      effect: round(2 * beta),
      sumSquares: round(n * beta * beta),
    };
  }
  const mean = dataset.rows.reduce((sum, row) => sum + Number(row[6]), 0) / n;
  const result = {
    format: 'rcl.frontier-public-factorial-orthogonal-effects.v0.1',
    version: RCL_FRONTIER_PUBLIC_FACTORIAL_VERSION,
    ok: true,
    design: 'complete_2pow5_orthogonal_pm1',
    observationCount: n,
    responseMean: round(mean),
    terms,
    externalRealityVerified: false,
    root: null,
  };
  result.root = sha256({ ...result, root: undefined });
  return result;
}

export function verifyNistPublishedEffectHoldout(effectResult = {}) {
  const actual = {
    speed: effectResult.terms?.speed?.sumSquares,
    rate: effectResult.terms?.rate?.sumSquares,
    speed_rate: effectResult.terms?.speed_rate?.sumSquares,
    grit: effectResult.terms?.grit?.sumSquares,
    direction: effectResult.terms?.direction?.sumSquares,
    batch: effectResult.terms?.batch?.sumSquares,
  };
  const comparisons = Object.fromEntries(Object.entries(PUBLISHED_SS_HOLDOUT).map(([key, expected]) => {
    const observed = Number(actual[key]);
    const absError = Math.abs(observed - expected);
    return [key, { expected, observed: round(observed, 6), absError: round(absError, 6), pass: absError <= 0.01 }];
  }));
  const ok = Object.values(comparisons).every(item => item.pass);
  const result = {
    format: 'rcl.frontier-public-factorial-published-holdout-verification.v0.1',
    version: RCL_FRONTIER_PUBLIC_FACTORIAL_VERSION,
    ok,
    comparisons,
    holdoutWasVisibleToBlindScorer: false,
    boundary: 'published_summary_used_only_after_effect_computation_for_external_reproduction_check',
    externalRealityVerified: false,
    root: null,
  };
  result.root = sha256({ ...result, root: undefined });
  return result;
}

export function mapNistCeramicToExternalObservationContract(dataset = {}, options = {}) {
  const validation = validatePublicFactorialDataset(dataset);
  if (!validation.ok) return { ok: false, validation, externalRealityVerified: false, root: sha256({ validation: validation.root }) };
  const importedAt = String(options.importedAt ?? '2026-08-11T00:00:00.000Z');
  const rows = dataset.rows.map(row => ({
    observationId: `nist_ceramic_${String(row[0]).padStart(2, '0')}`,
    timestamp: importedAt,
    instrumentId: 'nist-published-ceramic-strength-table',
    session: Number(row[7]),
    symbolCondition: Number(row[1]) === 1 ? 'active' : 'control',
    geometryCondition: Number(row[2]) === 1 ? 'active' : 'control',
    response: Number(row[6]),
    qualityFlags: [
      `nuisance:grit=${row[3]}`,
      `nuisance:direction=${row[4]}`,
      `nuisance:batch=${row[5]}`,
      `publishedRunOrder=${row[7]}`,
    ],
  }));
  const contract = buildFrontierExternalObservationContract({
    id: 'nist_ceramic_strength_speed_rate_projection_v0_1',
    purpose: 'Project the official NIST 2^5 ceramic-strength factorial dataset onto the existing 2x2 speed × feed-rate blind interface without exposing NIST published interaction conclusions to the scorer.',
    provenance: {
      sourceType: 'public_dataset',
      sourceUri: dataset.source.page,
      collector: dataset.source.publisher,
      acquiredAt: importedAt,
      licenseOrPermission: 'public NIST e-Handbook dataset; source attribution retained',
      acquisitionMethod: 'verbatim numeric transcription of the 32-row design table published on the official NIST e-Handbook page; speed→symbolFactor, rate→geometryFactor; grit/direction/batch retained as nuisance flags',
    },
    calibration: {
      status: 'valid',
      referenceId: 'nist-published-table-integrity-v0.1',
      measuredAt: importedAt,
      method: 'dataset integrity/reference calibration against the official published 32-row table; no instrument recalibration claim',
      tolerance: 0,
      notes: 'The original response is a published mean over 15 repetitions. This adapter verifies dataset integrity, not the original laboratory instrument calibration.',
    },
    rows,
  });
  return {
    ok: true,
    validation,
    contract,
    sourceDatasetRoot: sha256(dataset),
    publishedHoldoutIncludedInContract: false,
    externalRealityVerified: false,
    root: sha256({ contract: contract.root, sourceDatasetRoot: sha256(dataset) }),
  };
}

export function runNistCeramicPublicDatasetCheck(dataset = {}, options = {}) {
  const mapped = mapNistCeramicToExternalObservationContract(dataset, options);
  if (!mapped.ok) return mapped;
  const blind2x2 = runFrontierExternalObservationPipeline(mapped.contract, { randomizationSeed: Number(options.randomizationSeed ?? 2187) });
  const factorial = computeOrthogonalFactorialEffects(dataset);
  const holdout = verifyNistPublishedEffectHoldout(factorial);
  const currentGenericScorerReproducesPublishedSpeedRateInteraction = blind2x2.score?.detected === true && blind2x2.score?.modelSelection?.winner === 'H_interaction';
  const factorialEngineReproducesPublishedSummary = holdout.ok === true;
  const result = {
    format: RCL_FRONTIER_PUBLIC_FACTORIAL_FORMAT,
    version: RCL_FRONTIER_PUBLIC_FACTORIAL_VERSION,
    ok: mapped.ok === true && blind2x2.ok === true && factorial.ok === true && holdout.ok === true,
    verdict: holdout.ok
      ? 'PASS_PHASE1D_PUBLIC_DATASET_INGEST_WITH_GENERIC_SCORER_NEGATIVE_RESULT'
      : 'FAIL_PHASE1D_PUBLIC_DATASET_REPRODUCTION',
    datasetId: dataset.datasetId,
    mapped,
    blind2x2: {
      ok: blind2x2.ok,
      detected: blind2x2.score?.detected ?? null,
      modelWinner: blind2x2.score?.modelSelection?.winner ?? null,
      bicMargin: blind2x2.score?.modelSelection?.bicMargin ?? null,
      interactionDelta: blind2x2.score?.metrics?.interactionDelta ?? null,
      standardizedInteraction: blind2x2.score?.metrics?.standardizedInteraction ?? null,
      root: blind2x2.root,
    },
    factorial,
    publishedHoldout: holdout,
    currentGenericScorerReproducesPublishedSpeedRateInteraction,
    factorialEngineReproducesPublishedSummary,
    methodologicalFinding: currentGenericScorerReproducesPublishedSpeedRateInteraction
      ? 'generic_2x2_scorer_reproduced_public_interaction'
      : 'generic_2x2_scorer_missed_public_interaction_due_to_structured_nuisance_variation_do_not_relax_thresholds_use_factorial_structure',
    evidenceClass: 'independent_public_nist_scientific_dataset_reproduction_check',
    externalRealityVerified: false,
    newNaturalLawVerified: false,
    magicVerified: false,
    root: null,
  };
  result.root = sha256({ ...result, root: undefined });
  return result;
}

export function loadAndRunNistCeramicPublicDataset(filePath, options = {}) {
  const resolved = path.resolve(String(filePath));
  const dataset = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  const result = runNistCeramicPublicDatasetCheck(dataset, options);
  return { ...result, filePath: resolved, fileSizeBytes: fs.statSync(resolved).size, root: sha256({ result: result.root, filePath: resolved }) };
}
