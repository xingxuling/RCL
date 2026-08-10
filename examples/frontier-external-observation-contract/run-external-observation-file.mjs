import { runFrontierExternalObservationFile } from '../../src/frontier-external-observation-contract.mjs';

const inputFile = process.argv[2];
if (!inputFile) {
  console.error('usage: node examples/frontier-external-observation-contract/run-external-observation-file.mjs <contract.json>');
  process.exit(2);
}
const randomizationSeed = Number(process.argv[3] ?? 20260811);
const result = runFrontierExternalObservationFile(inputFile, { randomizationSeed });
console.log(JSON.stringify({
  ok: result.ok,
  validation: result.validation,
  score: result.score,
  reveal: result.reveal,
  externalRealityVerified: result.externalRealityVerified,
  root: result.root,
}, null, 2));
