import { sha256 } from './reality-compiler-kernel.mjs';
import {
  runFrontierExternalObservationPipeline,
  validateFrontierExternalObservationContract,
} from './frontier-external-observation-contract.mjs';
import {
  validatePublicFactorialDataset,
  computeOrthogonalFactorialEffects,
} from './frontier-public-factorial-dataset.mjs';

export const RCL_FRONTIER_DESIGN_GRAMMAR_ROUTER_VERSION = '0.1.0-alpha.1';
export const RCL_FRONTIER_DESIGN_GRAMMAR_FORMAT = 'rcl.frontier-design-grammar.v0.1';
export const RCL_FRONTIER_SCORER_ROUTE_FORMAT = 'rcl.frontier-scorer-route.v0.1';

export const FRONTIER_DESIGN_FAMILIES = Object.freeze({
  SIMPLE_2X2: 'simple_2x2',
  FULL_FACTORIAL_2POWK: 'full_factorial_2powk',
  REPEATED_MEASURES: 'repeated_measures',
  CONTINUOUS_FIELD: 'continuous_field',
});

function uniqueStrings(xs = []) {
  return [...new Set((Array.isArray(xs) ? xs : []).map(String).filter(Boolean))].sort();
}

export function normalizeFrontierDesignGrammar(input = {}) {
  const family = String(input.family ?? '').trim();
  const factors = uniqueStrings(input.factors);
  const nuisanceFactors = uniqueStrings(input.nuisanceFactors);
  const targetTerms = uniqueStrings(input.targetTerms);
  const result = {
    format: RCL_FRONTIER_DESIGN_GRAMMAR_FORMAT,
    version: RCL_FRONTIER_DESIGN_GRAMMAR_ROUTER_VERSION,
    id: String(input.id ?? 'frontier_design').trim(),
    family,
    factors,
    nuisanceFactors,
    targetTerms,
    response: String(input.response ?? 'response').trim(),
    levelEncoding: String(input.levelEncoding ?? '').trim(),
    expectedCellCount: Number.isFinite(Number(input.expectedCellCount)) ? Number(input.expectedCellCount) : null,
    allowProjectionLoss: input.allowProjectionLoss === true,
    declaredBeforeScoring: input.declaredBeforeScoring !== false,
    root: null,
  };
  result.root = sha256({ ...result, root: undefined });
  return result;
}

export function validateFrontierDesignGrammar(grammarInput = {}, payload = null) {
  const grammar = normalizeFrontierDesignGrammar(grammarInput);
  const failures = [];
  const warnings = [];
  if (!Object.values(FRONTIER_DESIGN_FAMILIES).includes(grammar.family)) failures.push('unsupported_design_family');
  if (!grammar.declaredBeforeScoring) failures.push('design_grammar_must_be_declared_before_scoring');
  if (!grammar.factors.length) failures.push('missing_factors');
  if (!grammar.response) failures.push('missing_response');

  if (grammar.family === FRONTIER_DESIGN_FAMILIES.SIMPLE_2X2) {
    if (grammar.factors.length !== 2) failures.push('simple_2x2_requires_exactly_two_factors');
    if (grammar.nuisanceFactors.length > 0 && !grammar.allowProjectionLoss) failures.push('simple_2x2_forbids_declared_structured_nuisance_without_explicit_loss_override');
    if (grammar.expectedCellCount !== null && grammar.expectedCellCount !== 4) failures.push('simple_2x2_expected_cell_count_must_be_4');
    if (payload) {
      const contractValidation = validateFrontierExternalObservationContract(payload);
      if (!contractValidation.ok) failures.push('simple_2x2_payload_is_not_valid_external_observation_contract');
    }
  }

  if (grammar.family === FRONTIER_DESIGN_FAMILIES.FULL_FACTORIAL_2POWK) {
    if (grammar.factors.length < 2) failures.push('full_factorial_requires_at_least_two_factors');
    if (grammar.levelEncoding !== 'pm1') failures.push('full_factorial_v0_1_requires_pm1_encoding');
    const expected = 2 ** grammar.factors.length;
    if (grammar.expectedCellCount !== null && grammar.expectedCellCount !== expected) failures.push('full_factorial_expected_cell_count_mismatch');
    if (payload) {
      const fixtureValidation = validatePublicFactorialDataset(payload);
      if (!fixtureValidation.ok) failures.push('full_factorial_payload_not_supported_by_v0_1_fixture_adapter');
      if (fixtureValidation.ok && fixtureValidation.uniqueDesignCells !== expected) failures.push('full_factorial_payload_cell_count_mismatch');
    }
  }

  if (grammar.family === FRONTIER_DESIGN_FAMILIES.REPEATED_MEASURES) {
    failures.push('repeated_measures_scorer_not_implemented');
  }
  if (grammar.family === FRONTIER_DESIGN_FAMILIES.CONTINUOUS_FIELD) {
    failures.push('continuous_field_scorer_not_implemented');
  }

  if (grammar.allowProjectionLoss) warnings.push('projection_loss_override_enabled');
  const result = {
    ok: failures.length === 0,
    grammar,
    failures: [...new Set(failures)].sort(),
    warnings: [...new Set(warnings)].sort(),
    externalRealityVerified: false,
    root: null,
  };
  result.root = sha256({ ...result, root: undefined });
  return result;
}

export function routeFrontierScorer(grammarInput = {}, payload = null, options = {}) {
  const validation = validateFrontierDesignGrammar(grammarInput, payload);
  if (!validation.ok) {
    const blocked = {
      format: RCL_FRONTIER_SCORER_ROUTE_FORMAT,
      version: RCL_FRONTIER_DESIGN_GRAMMAR_ROUTER_VERSION,
      ok: false,
      status: 'BLOCKED',
      route: null,
      scorer: null,
      validation,
      reason: validation.failures[0] ?? 'invalid_design_grammar',
      fallbackUsed: false,
      externalRealityVerified: false,
      newNaturalLawVerified: false,
      magicVerified: false,
      root: null,
    };
    blocked.root = sha256({ ...blocked, root: undefined });
    return blocked;
  }

  const grammar = validation.grammar;
  let route;
  let score;
  if (grammar.family === FRONTIER_DESIGN_FAMILIES.SIMPLE_2X2) {
    route = 'frontier_symbolic_geometry_blind_2x2';
    score = runFrontierExternalObservationPipeline(payload, {
      randomizationSeed: Number(options.randomizationSeed ?? 314159),
    });
  } else if (grammar.family === FRONTIER_DESIGN_FAMILIES.FULL_FACTORIAL_2POWK) {
    route = 'orthogonal_full_factorial_2powk';
    score = computeOrthogonalFactorialEffects(payload);
  } else {
    throw new Error(`unreachable_design_family:${grammar.family}`);
  }

  const result = {
    format: RCL_FRONTIER_SCORER_ROUTE_FORMAT,
    version: RCL_FRONTIER_DESIGN_GRAMMAR_ROUTER_VERSION,
    ok: score?.ok === true,
    status: score?.ok === true ? 'ROUTED' : 'SCORER_FAILED',
    route,
    scorer: route,
    validation,
    score,
    fallbackUsed: false,
    designRoot: grammar.root,
    payloadRoot: sha256(payload),
    externalRealityVerified: false,
    newNaturalLawVerified: false,
    magicVerified: false,
    root: null,
  };
  result.root = sha256({ ...result, root: undefined });
  return result;
}

export function buildNistCeramicDesignGrammar() {
  return normalizeFrontierDesignGrammar({
    id: 'nist_ceramic_complete_2pow5',
    family: FRONTIER_DESIGN_FAMILIES.FULL_FACTORIAL_2POWK,
    factors: ['speed', 'rate', 'grit', 'direction', 'batch'],
    nuisanceFactors: [],
    targetTerms: ['speed_rate'],
    response: 'strength',
    levelEncoding: 'pm1',
    expectedCellCount: 32,
    declaredBeforeScoring: true,
  });
}

export function buildSimple2x2DesignGrammar() {
  return normalizeFrontierDesignGrammar({
    id: 'frontier_simple_symbol_geometry_2x2',
    family: FRONTIER_DESIGN_FAMILIES.SIMPLE_2X2,
    factors: ['symbolCondition', 'geometryCondition'],
    response: 'response',
    levelEncoding: 'active_control',
    expectedCellCount: 4,
    declaredBeforeScoring: true,
  });
}
