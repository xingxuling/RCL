import { runFrontierNaturalLawLabDemo, writeFrontierNaturalLawLabReports } from '../../src/frontier-natural-law-lab.mjs';

const outDir = process.argv[2] || 'output/frontier-natural-law-lab-v0.1';
const report = writeFrontierNaturalLawLabReports(outDir);
console.log(JSON.stringify({ ...runFrontierNaturalLawLabDemo(), report }, null, 2));
