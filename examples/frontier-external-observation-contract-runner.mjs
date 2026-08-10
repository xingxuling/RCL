import {
  runFrontierExternalObservationControlSuite,
  writeFrontierExternalObservationContractReports,
} from '../src/frontier-external-observation-contract.mjs';

const outDir = process.argv[2] || 'output/frontier-external-observation-contract-v0.1';
const report = writeFrontierExternalObservationContractReports(outDir);
console.log(JSON.stringify({ ...runFrontierExternalObservationControlSuite(), report }, null, 2));
