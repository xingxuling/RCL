import { sha256 } from './reality-compiler-kernel.mjs';
import {
  FRONTIER_DESIGN_FAMILIES,
  normalizeFrontierDesignGrammar,
  validateFrontierDesignGrammar,
  routeFrontierScorer,
} from './frontier-design-grammar-router.mjs';

export const RCL_FRONTIER_PREREG_ANALYSIS_VERSION = '0.1.0-alpha.1';
export const RCL_FRONTIER_PREREG_ANALYSIS_FORMAT = 'rcl.frontier-preregistered-analysis-contract.v0.1';
export const RCL_FRONTIER_PREREG_RESULT_FORMAT = 'rcl.frontier-preregistered-analysis-result.v0.1';

function routeNameForFamily(family) {
  if (family === FRONTIER_DESIGN_FAMILIES.SIMPLE_2X2) return 'frontier_symbolic_geometry_blind_2x2';
  if (family === FRONTIER_DESIGN_FAMILIES.FULL_FACTORIAL_2POWK) return 'orthogonal_full_factorial_2powk';
  return null;
}

function normalizeAnalysisPlan(input = {}, grammar) {
  return {
    primaryTargets: [...new Set((input.primaryTargets ?? grammar.targetTerms ?? []).map(String))].sort(),
    decisionPolicy: String(input.decisionPolicy ?? 'use_registered_scorer_defaults_without_post_score_relaxation'),
    holdoutPolicy: String(input.holdoutPolicy ?? 'withhold_expected_answer_until_after_score'),
    randomizationSeed: Number.isFinite(Number(input.randomizationSeed)) ? Number(input.randomizationSeed) : 314159,
    missingDataPolicy: String(input.missingDataPolicy ?? 'block_if_required_design_cells_are_missing'),
    fallbackPolicy: 'forbidden',
    declaredBeforeScoring: input.declaredBeforeScoring !== false,
  };
}

export function sealFrontierPreregisteredAnalysisContract(input = {}) {
  const grammar = normalizeFrontierDesignGrammar(input.designGrammar ?? {});
  const designValidation = validateFrontierDesignGrammar(grammar, input.payload ?? null);
  const route = routeNameForFamily(grammar.family);
  const failures = [];
  if (!designValidation.ok) failures.push(...designValidation.failures);
  if (!route) failures.push('no_registered_scorer_for_design_family');
  const analysisPlan = normalizeAnalysisPlan(input.analysisPlan ?? {}, grammar);
  if (!analysisPlan.declaredBeforeScoring) failures.push('analysis_plan_must_be_declared_before_scoring');
  if (failures.length) {
    const blocked = {
      format: RCL_FRONTIER_PREREG_ANALYSIS_FORMAT,
      version: RCL_FRONTIER_PREREG_ANALYSIS_VERSION,
      ok: false,
      status: 'BLOCKED',
      failures: [...new Set(failures)].sort(),
      designValidation,
      externalRealityVerified: false,
      root: null,
    };
    blocked.root = sha256({ ...blocked, root: undefined });
    return blocked;
  }

  const contract = {
    format: RCL_FRONTIER_PREREG_ANALYSIS_FORMAT,
    version: RCL_FRONTIER_PREREG_ANALYSIS_VERSION,
    ok: true,
    status: 'SEALED',
    studyId: String(input.studyId ?? 'frontier_preregistered_study'),
    designGrammar: grammar,
    designRoot: grammar.root,
    payload: input.payload,
    payloadRoot: sha256(input.payload),
    registeredRoute: route,
    analysisPlan,
    analysisPlanRoot: sha256(analysisPlan),
    evidenceBoundary: String(input.evidenceBoundary ?? 'analysis_preregistration_only_no_external_new_law_claim'),
    externalRealityVerified: false,
    newNaturalLawVerified: false,
    magicVerified: false,
    root: null,
  };
  contract.root = sha256({ ...contract, root: undefined });
  return contract;
}

export function validateFrontierPreregisteredAnalysisContract(contract = {}) {
  const failures = [];
  if (contract.format !== RCL_FRONTIER_PREREG_ANALYSIS_FORMAT) failures.push('unsupported_preregistered_analysis_format');
  if (contract.status !== 'SEALED') failures.push('analysis_contract_not_sealed');
  const grammar = normalizeFrontierDesignGrammar(contract.designGrammar ?? {});
  if (contract.designRoot !== grammar.root) failures.push('design_root_mismatch');
  if (contract.payloadRoot !== sha256(contract.payload)) failures.push('payload_root_mismatch');
  if (contract.analysisPlanRoot !== sha256(contract.analysisPlan)) failures.push('analysis_plan_root_mismatch');
  if (contract.registeredRoute !== routeNameForFamily(grammar.family)) failures.push('registered_route_mismatch');
  if (contract.analysisPlan?.fallbackPolicy !== 'forbidden') failures.push('fallback_policy_must_remain_forbidden');
  if (contract.analysisPlan?.declaredBeforeScoring !== true) failures.push('analysis_plan_not_preregistered');
  const designValidation = validateFrontierDesignGrammar(grammar, contract.payload ?? null);
  if (!designValidation.ok) failures.push(...designValidation.failures.map(x => `design:${x}`));
  const recomputedRoot = sha256({ ...contract, root: undefined });
  if (contract.root !== recomputedRoot) failures.push('contract_root_mismatch');
  const result = {
    ok: failures.length === 0,
    failures: [...new Set(failures)].sort(),
    designValidation,
    recomputedRoot,
    externalRealityVerified: false,
    root: null,
  };
  result.root = sha256({ ...result, root: undefined });
  return result;
}

export function runFrontierPreregisteredAnalysis(contract = {}) {
  const validation = validateFrontierPreregisteredAnalysisContract(contract);
  if (!validation.ok) {
    const rejected = {
      format: RCL_FRONTIER_PREREG_RESULT_FORMAT,
      version: RCL_FRONTIER_PREREG_ANALYSIS_VERSION,
      ok: false,
      status: 'REJECTED_BEFORE_SCORE',
      validation,
      scoreExecuted: false,
      externalRealityVerified: false,
      root: null,
    };
    rejected.root = sha256({ ...rejected, root: undefined });
    return rejected;
  }

  const routed = routeFrontierScorer(contract.designGrammar, contract.payload, {
    randomizationSeed: contract.analysisPlan.randomizationSeed,
  });
  const routeMatches = routed.route === contract.registeredRoute;
  const ok = routed.ok === true && routeMatches && routed.fallbackUsed === false;
  const result = {
    format: RCL_FRONTIER_PREREG_RESULT_FORMAT,
    version: RCL_FRONTIER_PREREG_ANALYSIS_VERSION,
    ok,
    status: ok ? 'SCORED_UNDER_SEALED_PLAN' : 'SCORER_OR_ROUTE_FAILURE',
    contractRoot: contract.root,
    designRoot: contract.designRoot,
    analysisPlanRoot: contract.analysisPlanRoot,
    payloadRoot: contract.payloadRoot,
    registeredRoute: contract.registeredRoute,
    executedRoute: routed.route,
    routeMatches,
    fallbackUsed: routed.fallbackUsed,
    scoreExecuted: true,
    routed,
    externalRealityVerified: false,
    newNaturalLawVerified: false,
    magicVerified: false,
    root: null,
  };
  result.root = sha256({ ...result, root: undefined });
  return result;
}
