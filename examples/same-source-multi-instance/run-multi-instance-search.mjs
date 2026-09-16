import fs from 'node:fs';
import { readSameSourceMultiInstanceInput, writeSameSourceMultiInstanceReports } from '../../src/same-source-multi-instance-runtime.mjs';

const inputPath = process.argv[2] || 'examples/same-source-multi-instance/default-multi-instance-search.json';
const holdoutPath = process.argv[3] || '';
const outDir = process.argv[4] || 'output/v0.95/same-source-multi-instance';
const input = readSameSourceMultiInstanceInput(inputPath);
const holdout = holdoutPath ? JSON.parse(fs.readFileSync(holdoutPath, 'utf8')) : null;
console.log(JSON.stringify(writeSameSourceMultiInstanceReports(outDir, input, holdout), null, 2));
