import { loadAndRunNistCeramicPublicDataset } from '../../src/frontier-public-factorial-dataset.mjs';

const file = process.argv[2] || 'data/frontier-public-datasets/nist-ceramic-2pow5.json';
const result = loadAndRunNistCeramicPublicDataset(file);
console.log(JSON.stringify({
  ok: result.ok,
  verdict: result.verdict,
  datasetId: result.datasetId,
  generic2x2Detected: result.blind2x2.detected,
  generic2x2Winner: result.blind2x2.modelWinner,
  factorialSpeedRateSS: result.factorial.terms.speed_rate.sumSquares,
  publishedHoldoutPass: result.publishedHoldout.ok,
  methodologicalFinding: result.methodologicalFinding,
  externalRealityVerified: result.externalRealityVerified,
  root: result.root,
}, null, 2));
