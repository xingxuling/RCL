import { realityRoot } from './canonical.mjs';
import { createMutationPlan, uniqueStrings } from './equivalence-corpus-common.mjs';
import { verifyExecutableCorpusIntegrity } from './executable-negative-controls.mjs';
import {
  RCL_ADAPTIVE_CAPABILITY_CORPUS_FORMAT,
  RCL_ADAPTIVE_CORPUS_CYCLE_FORMAT,
  RCL_ADAPTIVE_CORPUS_VERSION,
  RCLAdaptiveCorpusError,
  adaptiveAssertObject,
  selectAdaptiveCapabilityCorpus,
  unwrapAdaptiveDifferential,
  createAdaptiveGap,
  adaptiveCaseInputRoot,
  createAdaptiveSupplementalCase,
} from './adaptive-corpus-shared.mjs';

export function analyzeCorpusFeedback(input) {
  const raw = adaptiveAssertObject(
    input,
    'RCL_ADAPTIVE_ANALYSIS_INVALID',
    'Adaptive corpus analysis request must be an object',
  );
  const corpus = selectAdaptiveCapabilityCorpus(raw.corpus, raw.capability ?? null);
  const differential = unwrapAdaptiveDifferential(raw.feedback);
  if (differential.capability !== corpus.capability) {
    throw new RCLAdaptiveCorpusError(
      'RCL_ADAPTIVE_DIFFERENTIAL_CAPABILITY_MISMATCH',
      'Corpus and differential feedback must refer to the same capability',
      { corpus: corpus.capability, differential: differential.capability },
    );
  }
  const iteration = Number.isInteger(raw.iteration) && raw.iteration > 0 ? raw.iteration : 1;
  const maxSupplementalCases = Number.isInteger(raw.maxSupplementalCases)
    ? Math.max(0, raw.maxSupplementalCases)
    : 32;
  const gaps = [];
  const supplementalCases = [];
  const bindings = [];
  const existingInputRoots = new Set(corpus.cases.map(adaptiveCaseInputRoot));
  const controlById = new Map((differential.negativeControls ?? []).map(control => [control.id, control]));

  for (const caseReport of differential.cases ?? []) {
    if (caseReport.comparison?.infrastructureFailure) {
      gaps.push(createAdaptiveGap('infrastructure-failure', { caseId: caseReport.id }));
    }
    if (caseReport.comparison?.equivalent !== true) {
      gaps.push(createAdaptiveGap('candidate-semantic-mismatch', { caseId: caseReport.id }));
    }
    if (caseReport.source?.deterministic !== true || caseReport.absorbed?.deterministic !== true) {
      gaps.push(createAdaptiveGap('nondeterministic-replay', {
        caseId: caseReport.id,
        sourceDeterministic: caseReport.source?.deterministic === true,
        absorbedDeterministic: caseReport.absorbed?.deterministic === true,
      }));
    }
  }

  let sequence = 0;
  for (const plan of corpus.mutationPlans ?? []) {
    const control = controlById.get(plan.id);
    const unbound = (plan.expectedDetectionCaseIds ?? []).length === 0;
    const undetected = control ? control.detected !== true : true;
    if (unbound) {
      gaps.push(createAdaptiveGap('mutation-plan-unbound', {
        mutationPlanId: plan.id,
        mutationPlanRoot: plan.root,
      }));
    }
    if (!control) {
      gaps.push(createAdaptiveGap('mutation-plan-unexecuted', {
        mutationPlanId: plan.id,
        mutationPlanRoot: plan.root,
      }));
    } else if (control.detected !== true) {
      gaps.push(createAdaptiveGap('mutation-undetected', {
        mutationPlanId: plan.id,
        missingDetectionCaseIds: control.missingDetections ?? [],
      }));
    }
    if ((!unbound && !undetected) || supplementalCases.length >= maxSupplementalCases) continue;
    sequence += 1;
    const supplemental = createAdaptiveSupplementalCase(corpus, plan, iteration, sequence);
    if (!supplemental) {
      gaps.push(createAdaptiveGap('adaptive-generator-unavailable', {
        mutationPlanId: plan.id,
        operator: plan.operator,
      }));
      continue;
    }
    if (existingInputRoots.has(adaptiveCaseInputRoot(supplemental))) {
      gaps.push(createAdaptiveGap('adaptive-case-duplicate', {
        mutationPlanId: plan.id,
        proposedCaseId: supplemental.id,
      }));
      continue;
    }
    existingInputRoots.add(adaptiveCaseInputRoot(supplemental));
    supplementalCases.push(supplemental);
    const binding = {
      mutationPlanId: plan.id,
      mutationPlanRoot: plan.root,
      previousDetectionCaseIds: plan.expectedDetectionCaseIds ?? [],
      supplementalDetectionCaseIds: [supplemental.id],
    };
    bindings.push(Object.freeze({ ...binding, root: realityRoot(binding) }));
  }

  const status = gaps.length === 0
    ? 'sufficient'
    : supplementalCases.length > 0
      ? 'adaptation-proposed'
      : 'blocked';
  const body = {
    format: RCL_ADAPTIVE_CORPUS_CYCLE_FORMAT,
    version: RCL_ADAPTIVE_CORPUS_VERSION,
    capability: corpus.capability,
    iteration,
    baseCorpusRoot: corpus.root,
    differentialRoot: differential.root,
    status,
    needsAdaptation: gaps.length > 0,
    requiresReexecution: supplementalCases.length > 0,
    gapCount: gaps.length,
    gapRoots: gaps.map(gap => gap.root),
    supplementalCaseCount: supplementalCases.length,
    supplementalCaseRoots: supplementalCases.map(testCase => testCase.root),
    bindingCount: bindings.length,
    bindingRoots: bindings.map(binding => binding.root),
    boundary: 'Adaptive analysis proposes deterministic probes from failed or uncovered mutation evidence. A proposed revision is not stronger evidence until both adapters rerun it.',
  };
  return Object.freeze({
    ...body,
    gaps,
    supplementalCases,
    bindings,
    root: realityRoot(body),
  });
}

export function materializeAdaptiveCorpusRevision(input) {
  const raw = adaptiveAssertObject(
    input,
    'RCL_ADAPTIVE_REVISION_INVALID',
    'Adaptive corpus revision request must be an object',
  );
  const corpus = selectAdaptiveCapabilityCorpus(raw.corpus, raw.capability ?? null);
  const cycle = adaptiveAssertObject(
    raw.cycle,
    'RCL_ADAPTIVE_CYCLE_REQUIRED',
    'Adaptive corpus revision requires a cycle report',
  );
  if (cycle.format !== RCL_ADAPTIVE_CORPUS_CYCLE_FORMAT) {
    throw new RCLAdaptiveCorpusError(
      'RCL_ADAPTIVE_CYCLE_FORMAT',
      'Unsupported adaptive cycle format',
      { format: cycle.format },
    );
  }
  const {
    root: cycleRoot,
    gaps: _gaps,
    supplementalCases: _cases,
    bindings: _bindings,
    ...cycleBody
  } = cycle;
  const expectedCycleRoot = realityRoot(cycleBody);
  if (cycleRoot !== expectedCycleRoot) {
    throw new RCLAdaptiveCorpusError(
      'RCL_ADAPTIVE_CYCLE_INTEGRITY',
      'Adaptive cycle root does not match its content-addressed summary',
      { expectedRoot: expectedCycleRoot, actualRoot: cycleRoot },
    );
  }
  if (cycle.baseCorpusRoot !== corpus.root || cycle.capability !== corpus.capability) {
    throw new RCLAdaptiveCorpusError(
      'RCL_ADAPTIVE_CYCLE_BINDING',
      'Adaptive cycle is not bound to the supplied corpus',
      { expectedCorpusRoot: corpus.root, actualCorpusRoot: cycle.baseCorpusRoot },
    );
  }

  const bindingByPlan = new Map(cycle.bindings.map(binding => [binding.mutationPlanId, binding]));
  const cases = [...corpus.cases];
  const caseIds = new Set(cases.map(testCase => testCase.id));
  for (const supplemental of cycle.supplementalCases) {
    if (!caseIds.has(supplemental.id)) {
      cases.push(supplemental);
      caseIds.add(supplemental.id);
    }
  }
  const originalCaseIds = new Set(corpus.cases.map(testCase => testCase.id));
  const mutationPlans = (corpus.mutationPlans ?? []).map(plan => {
    const binding = bindingByPlan.get(plan.id);
    if (!binding) return plan;
    return createMutationPlan({
      id: plan.id,
      capability: plan.capability,
      operator: plan.operator,
      target: plan.target,
      description: plan.description,
      expectedDetectionCaseIds: uniqueStrings([
        ...(plan.expectedDetectionCaseIds ?? []).filter(id => originalCaseIds.has(id)),
        ...binding.supplementalDetectionCaseIds,
      ]),
    });
  });
  const body = {
    format: RCL_ADAPTIVE_CAPABILITY_CORPUS_FORMAT,
    version: RCL_ADAPTIVE_CORPUS_VERSION,
    capability: corpus.capability,
    specRoot: corpus.specRoot,
    sourceIdentity: corpus.sourceIdentity,
    frontend: corpus.frontend,
    baseCorpusRoot: corpus.root,
    adaptationCycleRoot: cycle.root,
    iteration: cycle.iteration,
    caseCount: cases.length,
    caseRoots: cases.map(testCase => testCase.root),
    mutationPlanCount: mutationPlans.length,
    mutationPlanRoots: mutationPlans.map(plan => plan.root),
    diagnostics: [
      ...(corpus.diagnostics ?? []),
      {
        level: 'info',
        code: 'RCL_ADAPTIVE_CORPUS_REEXECUTION_REQUIRED',
        message: 'Adaptive supplemental cases and mutation bindings require a fresh differential execution.',
        cycleRoot: cycle.root,
      },
    ],
    coverage: {
      ...(corpus.coverage ?? {}),
      adaptiveIteration: cycle.iteration,
      supplementalCaseCount: cycle.supplementalCaseCount,
      priorCaseCount: corpus.caseCount,
    },
    boundary: 'This adaptive revision extends a content-addressed corpus. It carries no new runtime result or equivalence verdict until reexecuted.',
  };
  const revision = Object.freeze({
    ...body,
    cases,
    mutationPlans,
    root: realityRoot({
      ...body,
      cases: body.caseRoots,
      mutationPlans: body.mutationPlanRoots,
    }),
  });
  verifyExecutableCorpusIntegrity(revision);
  return revision;
}
