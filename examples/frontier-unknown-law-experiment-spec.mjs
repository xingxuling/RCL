import { buildDefaultUnknownLawExperimentPortfolio } from '../src/frontier-unknown-law-experiment-spec.mjs';

const portfolio = buildDefaultUnknownLawExperimentPortfolio();
console.log(JSON.stringify({
  phase: portfolio.phase,
  firstRecommendedStudy: portfolio.firstRecommendedStudy,
  executableNow: portfolio.executableNow,
  blocked: portfolio.blocked,
  specs: portfolio.specs.map((s) => ({
    laneId: s.laneId,
    title: s.title,
    designFamily: s.designGrammar.family,
    analysisRuntimeStatus: s.analysisRuntimeStatus,
    primaryVariable: s.primaryVariable.id,
    nullHypothesis: s.nullHypothesis,
    sourceCandidateRoot: s.sourceCandidateRoot,
    root: s.root,
  })),
  root: portfolio.root,
}, null, 2));
