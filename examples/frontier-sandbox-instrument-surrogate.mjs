import { runSandboxSurrogatePressureSuite } from '../src/frontier-sandbox-instrument-surrogate.mjs';

const suite = runSandboxSurrogatePressureSuite();
console.log(JSON.stringify({
  verdict: suite.verdict,
  scenarioCount: suite.scenarioCount,
  passed: suite.passed,
  allRawValid: suite.allRawValid,
  allPipelinesOk: suite.allPipelinesOk,
  allClassificationsCorrect: suite.allClassificationsCorrect,
  externalRealityVerified: suite.externalRealityVerified,
  newNaturalLawVerified: suite.newNaturalLawVerified,
  magicVerified: suite.magicVerified,
  runs: suite.runs.map((x) => ({
    scenarioId: x.scenarioId,
    modelWinner: x.modelWinner,
    detectedInteraction: x.detectedInteraction,
    expectedInteraction: x.expectedInteraction,
    classificationPass: x.classificationPass,
    root: x.root,
  })),
  root: suite.root,
}, null, 2));
