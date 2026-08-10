import { runAetherContinuousFieldSandboxPressureSuite } from '../src/frontier-aether-continuous-field-sandbox-surrogate.mjs';

const suite = runAetherContinuousFieldSandboxPressureSuite();
console.log(JSON.stringify({
  scenarioCount: suite.scenarioCount,
  passed: suite.passed,
  allPayloadsValid: suite.allPayloadsValid,
  allRoutesContinuousField: suite.allRoutesContinuousField,
  allClassificationsCorrect: suite.allClassificationsCorrect,
  noAdaptiveSearch: suite.noAdaptiveSearch,
  aetherAnalysisRuntimeStatus: suite.aetherAnalysisRuntimeStatus,
  externalRealityVerified: suite.externalRealityVerified,
  newNaturalLawVerified: suite.newNaturalLawVerified,
  magicVerified: suite.magicVerified,
  runs: suite.runs.map((run) => ({
    scenarioId: run.scenarioId,
    expectedDetected: run.expectedDetected,
    detected: run.detected,
    classificationPass: run.classificationPass,
    kernelBeta: run.kernelBeta,
    kernelCorrelation: run.kernelCorrelation,
    r2: run.r2,
    empiricalP: run.empiricalP,
    route: run.route,
    root: run.root,
  })),
  root: suite.root,
}, null, 2));
