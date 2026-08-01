import { realityRoot } from './canonical.mjs';
import { runCorpusDifferentialExperiment } from './executable-negative-controls.mjs';
import {
  RCL_ADAPTIVE_CAPABILITY_CORPUS_FORMAT,
  RCL_ADAPTIVE_CORPUS_VERSION,
  RCL_ADAPTIVE_CORPUS_CYCLE_FORMAT,
  RCL_ADAPTIVE_CORPUS_LOOP_FORMAT,
  RCLAdaptiveCorpusError,
  adaptiveAssertObject,
  selectAdaptiveCapabilityCorpus,
} from './adaptive-corpus-shared.mjs';
import {
  analyzeCorpusFeedback,
  materializeAdaptiveCorpusRevision,
} from './adaptive-corpus-feedback.mjs';

export {
  RCL_ADAPTIVE_CAPABILITY_CORPUS_FORMAT,
  RCL_ADAPTIVE_CORPUS_VERSION,
  RCL_ADAPTIVE_CORPUS_CYCLE_FORMAT,
  RCL_ADAPTIVE_CORPUS_LOOP_FORMAT,
  RCLAdaptiveCorpusError,
  analyzeCorpusFeedback,
  materializeAdaptiveCorpusRevision,
};

export async function runAdaptiveCorpusLoop(input) {
  const raw = adaptiveAssertObject(
    input,
    'RCL_ADAPTIVE_LOOP_INVALID',
    'Adaptive corpus loop request must be an object',
  );
  const maxIterations = Number.isInteger(raw.maxIterations)
    ? Math.max(1, Math.min(raw.maxIterations, 8))
    : 3;
  let corpus = selectAdaptiveCapabilityCorpus(raw.corpus, raw.capability ?? null);
  const iterations = [];
  let finalExperiment = null;
  let finalCycle = null;
  let status = 'max-iterations';

  for (let iteration = 1; iteration <= maxIterations; iteration += 1) {
    const experiment = await runCorpusDifferentialExperiment({
      corpus,
      capability: corpus.capability,
      source: raw.source,
      absorbed: raw.absorbed,
      negativeControlBaseline: raw.negativeControlBaseline,
      operatorHandlers: raw.operatorHandlers,
      includeObserve: raw.includeObserve,
      classifications: raw.classifications,
      repeats: raw.repeats,
      timeoutMs: raw.timeoutMs,
      requireDeterministicReplay: raw.requireDeterministicReplay,
      requireNegativeControl: raw.requireNegativeControl,
    });
    const cycle = analyzeCorpusFeedback({
      corpus,
      feedback: experiment,
      iteration,
      maxSupplementalCases: raw.maxSupplementalCasesPerIteration,
    });
    const record = {
      iteration,
      corpusRoot: corpus.root,
      experimentRoot: experiment.root,
      differentialRoot: experiment.differential.root,
      cycleRoot: cycle.root,
      cycleStatus: cycle.status,
      passed: experiment.passed,
      promotionEligible: experiment.promotionEligible,
    };
    iterations.push(Object.freeze({ ...record, root: realityRoot(record) }));
    finalExperiment = experiment;
    finalCycle = cycle;

    if (cycle.status === 'sufficient') {
      status = experiment.promotionEligible ? 'converged' : 'stable-but-not-promotion-eligible';
      break;
    }
    if (!cycle.requiresReexecution) {
      status = 'blocked';
      break;
    }
    corpus = materializeAdaptiveCorpusRevision({ corpus, cycle });
  }

  const body = {
    format: RCL_ADAPTIVE_CORPUS_LOOP_FORMAT,
    version: RCL_ADAPTIVE_CORPUS_VERSION,
    capability: corpus.capability,
    status,
    maxIterations,
    iterationCount: iterations.length,
    iterationRoots: iterations.map(item => item.root),
    finalCorpusRoot: corpus.root,
    finalExperimentRoot: finalExperiment?.root ?? null,
    finalDifferentialRoot: finalExperiment?.differential?.root ?? null,
    finalCycleRoot: finalCycle?.root ?? null,
    converged: status === 'converged',
    promotionEligible: finalExperiment?.promotionEligible === true && finalCycle?.status === 'sufficient',
    boundary: 'The adaptive loop changes test corpus structure, not the absorbed implementation. Convergence is bounded to supplied adapters, operator-level mutants, generated cases, iteration budget, and current-process execution.',
  };
  return Object.freeze({
    ...body,
    corpus,
    finalExperiment,
    finalCycle,
    iterations,
    root: realityRoot(body),
  });
}
