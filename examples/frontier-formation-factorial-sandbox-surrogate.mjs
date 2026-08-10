import { runFormationFactorialSandboxPressureSuite } from '../src/frontier-formation-factorial-sandbox-surrogate.mjs';

const suite = runFormationFactorialSandboxPressureSuite();
console.log(JSON.stringify({
  scenarioCount: suite.scenarioCount,
  passed: suite.passed,
  allPayloadsValid: suite.allPayloadsValid,
  allRoutesGenericFactorial: suite.allRoutesGenericFactorial,
  allClassificationsCorrect: suite.allClassificationsCorrect,
  formationAnalysisRuntimeStatus: suite.formationAnalysisRuntimeStatus,
  externalRealityVerified: suite.externalRealityVerified,
  newNaturalLawVerified: suite.newNaturalLawVerified,
  magicVerified: suite.magicVerified,
  runs: suite.runs.map((run) => ({
    scenarioId: run.scenarioId,
    expectedDetectedTargetTerms: run.expectedDetectedTargetTerms,
    detectedTargetTerms: run.detectedTargetTerms,
    classificationPass: run.classificationPass,
    route: run.route,
    observationCount: run.observationCount,
    root: run.root,
  })),
  root: suite.root,
}, null, 2));
