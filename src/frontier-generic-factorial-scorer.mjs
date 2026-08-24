import { sha256 } from './reality-compiler-kernel.mjs';

export const RCL_FRONTIER_GENERIC_FACTORIAL_VERSION = '0.1.0-alpha.1';
export const RCL_FRONTIER_GENERIC_FACTORIAL_PAYLOAD_FORMAT = 'rcl.frontier-generic-full-factorial-payload.v0.1';
export const RCL_FRONTIER_GENERIC_FACTORIAL_SCORE_FORMAT = 'rcl.frontier-generic-full-factorial-score.v0.1';

function round(value, digits = 9) {
  const scale = 10 ** digits;
  return Math.round(Number(value) * scale) / scale;
}

function uniqueStrings(xs = []) {
  return [...new Set((Array.isArray(xs) ? xs : []).map(String).filter(Boolean))];
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

function termKey(factors, indices) {
  return indices.map((i) => factors[i]).join(':');
}

function canonicalTargetTerm(termName, factors) {
  const names = String(termName).split(':').filter(Boolean);
  const factorIndex = new Map(factors.map((name, index) => [name, index]));
  if (names.some((name) => !factorIndex.has(name))) return String(termName);
  return [...names].sort((a, b) => factorIndex.get(a) - factorIndex.get(b)).join(':');
}

function canonicalCellKey(factors, levels = {}) {
  return factors.map((factor) => `${factor}=${Number(levels[factor])}`).join('|');
}

export function buildGenericFullFactorialPayload(input = {}) {
  const factors = uniqueStrings(input.factors);
  const rows = (Array.isArray(input.rows) ? input.rows : []).map((row, index) => ({
    observationId: String(row.observationId ?? `factorial_${String(index + 1).padStart(4, '0')}`),
    factors: Object.fromEntries(factors.map((factor) => [factor, Number(row.factors?.[factor])])),
    nuisance: row.nuisance && typeof row.nuisance === 'object' ? { ...row.nuisance } : {},
    response: Number(row.response),
  }));
  const payload = {
    format: RCL_FRONTIER_GENERIC_FACTORIAL_PAYLOAD_FORMAT,
    version: RCL_FRONTIER_GENERIC_FACTORIAL_VERSION,
    id: String(input.id ?? 'generic_full_factorial_payload'),
    factors,
    responseName: String(input.responseName ?? 'response'),
    levelEncoding: 'pm1',
    rows,
    provenance: input.provenance && typeof input.provenance === 'object' ? { ...input.provenance } : {},
    declaredBeforeScoring: input.declaredBeforeScoring !== false,
    externalRealityVerified: false,
    newNaturalLawVerified: false,
    magicVerified: false,
    root: null,
  };
  payload.root = sha256({ ...payload, root: undefined });
  return payload;
}

export function validateGenericFullFactorialPayload(payload = {}, grammar = null) {
  const failures = [];
  if (payload.format !== RCL_FRONTIER_GENERIC_FACTORIAL_PAYLOAD_FORMAT) failures.push('unsupported_generic_factorial_payload_format');
  if (!payload.declaredBeforeScoring) failures.push('payload_must_be_declared_before_scoring');
  if (!Array.isArray(payload.factors) || payload.factors.length < 2) failures.push('factorial_requires_at_least_two_factors');
  if (payload.levelEncoding !== 'pm1') failures.push('generic_factorial_requires_pm1_encoding');
  if (!Array.isArray(payload.rows) || payload.rows.length === 0) failures.push('missing_factorial_rows');
  const factors = Array.isArray(payload.factors) ? payload.factors.map(String) : [];
  const ids = new Set();
  const cellCounts = new Map();
  for (const row of payload.rows ?? []) {
    if (!row.observationId || ids.has(row.observationId)) failures.push('duplicate_or_missing_observation_id');
    ids.add(row.observationId);
    for (const factor of factors) {
      if (![-1, 1].includes(Number(row.factors?.[factor]))) failures.push(`invalid_pm1_level:${factor}:${row.observationId}`);
    }
    if (!Number.isFinite(Number(row.response))) failures.push(`invalid_response:${row.observationId}`);
    const key = canonicalCellKey(factors, row.factors);
    cellCounts.set(key, (cellCounts.get(key) ?? 0) + 1);
  }
  const expectedCells = factors.length ? 2 ** factors.length : 0;
  if (cellCounts.size !== expectedCells) failures.push('incomplete_full_factorial_design');
  const replicateCounts = [...cellCounts.values()];
  const balanced = replicateCounts.length > 0 && replicateCounts.every((count) => count === replicateCounts[0]);
  if (!balanced) failures.push('unbalanced_factorial_replication');
  if (grammar) {
    const grammarFactors = uniqueStrings(grammar.factors).sort();
    const payloadFactors = [...factors].sort();
    if (grammar.family !== 'full_factorial_2powk') failures.push('grammar_family_mismatch');
    if (grammar.levelEncoding !== 'pm1') failures.push('grammar_level_encoding_mismatch');
    if (grammarFactors.join('|') !== payloadFactors.join('|')) failures.push('grammar_factor_membership_mismatch');
    if (Number(grammar.expectedCellCount) !== expectedCells) failures.push('grammar_expected_cell_count_mismatch');
  }
  const recomputedRoot = payload.format === RCL_FRONTIER_GENERIC_FACTORIAL_PAYLOAD_FORMAT
    ? sha256({ ...payload, root: undefined })
    : null;
  if (payload.root && recomputedRoot !== payload.root) failures.push('generic_factorial_payload_root_mismatch');
  const result = {
    ok: failures.length === 0,
    failures: [...new Set(failures)].sort(),
    factors,
    observationCount: payload.rows?.length ?? 0,
    uniqueDesignCells: cellCounts.size,
    expectedDesignCells: expectedCells,
    replicatesPerCell: balanced && replicateCounts.length ? replicateCounts[0] : null,
    balanced,
    externalRealityVerified: false,
    root: null,
  };
  result.root = sha256({ ...result, root: undefined });
  return result;
}

export function computeGenericOrthogonalFactorialEffects(payload = {}, grammar = null, options = {}) {
  const validation = validateGenericFullFactorialPayload(payload, grammar);
  if (!validation.ok) {
    return {
      format: RCL_FRONTIER_GENERIC_FACTORIAL_SCORE_FORMAT,
      version: RCL_FRONTIER_GENERIC_FACTORIAL_VERSION,
      ok: false,
      validation,
      externalRealityVerified: false,
      newNaturalLawVerified: false,
      magicVerified: false,
      root: sha256({ validation: validation.root, error: 'invalid_generic_factorial_payload' }),
    };
  }
  const factors = validation.factors;
  const n = payload.rows.length;
  const terms = {};
  for (const indices of combinations(factors.length)) {
    let weighted = 0;
    for (const row of payload.rows) {
      let product = 1;
      for (const index of indices) product *= Number(row.factors[factors[index]]);
      weighted += Number(row.response) * product;
    }
    const beta = weighted / n;
    const effect = 2 * beta;
    terms[termKey(factors, indices)] = {
      order: indices.length,
      beta: round(beta),
      effect: round(effect),
      sumSquares: round(n * beta * beta),
    };
  }
  const responseMean = payload.rows.reduce((sum, row) => sum + Number(row.response), 0) / n;
  const fitted = payload.rows.map((row) => {
    let value = responseMean;
    for (const [key, term] of Object.entries(terms)) {
      const names = key.split(':');
      let product = 1;
      for (const name of names) product *= Number(row.factors[name]);
      value += Number(term.beta) * product;
    }
    return value;
  });
  const residuals = payload.rows.map((row, index) => Number(row.response) - fitted[index]);
  const residualVariance = residuals.length > 1
    ? residuals.reduce((sum, value) => sum + value * value, 0) / (residuals.length - 1)
    : 0;
  const residualSd = Math.sqrt(Math.max(0, residualVariance));
  const minAbsEffect = Number(options.minAbsEffect ?? 0.35);
  const minStandardizedEffect = Number(options.minStandardizedEffect ?? 2.0);
  const targetTerms = uniqueStrings(grammar?.targetTerms ?? []);
  const targetDecisions = Object.fromEntries(targetTerms.map((termName) => {
    const canonical = canonicalTargetTerm(termName, factors);
    const term = terms[canonical] ?? null;
    const standardizedEffect = term && residualSd > 1e-12 ? Math.abs(Number(term.effect)) / residualSd : (term ? Infinity : 0);
    const detected = Boolean(term)
      && Math.abs(Number(term.effect)) >= minAbsEffect
      && standardizedEffect >= minStandardizedEffect;
    return [termName, {
      canonicalTerm: canonical,
      found: Boolean(term),
      effect: term?.effect ?? null,
      sumSquares: term?.sumSquares ?? null,
      standardizedEffect: Number.isFinite(standardizedEffect) ? round(standardizedEffect) : 'Infinity',
      detected,
    }];
  }));
  const score = {
    format: RCL_FRONTIER_GENERIC_FACTORIAL_SCORE_FORMAT,
    version: RCL_FRONTIER_GENERIC_FACTORIAL_VERSION,
    ok: true,
    design: `complete_2pow${factors.length}_orthogonal_pm1`,
    observationCount: n,
    responseMean: round(responseMean),
    residualSd: round(residualSd),
    terms,
    thresholds: { minAbsEffect, minStandardizedEffect },
    targetTerms,
    targetDecisions,
    detectedTargetTerms: Object.entries(targetDecisions).filter(([, decision]) => decision.detected).map(([name]) => name),
    externalRealityVerified: false,
    newNaturalLawVerified: false,
    magicVerified: false,
    root: null,
  };
  score.root = sha256({ ...score, root: undefined });
  return score;
}
