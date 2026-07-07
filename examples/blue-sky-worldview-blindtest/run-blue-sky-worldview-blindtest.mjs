import path from 'node:path';
import { writeBlueSkyWorldviewBlindtestReports, readBlueSkyWorldviewBlindtestInput } from '../../src/blue-sky-worldview-blindtest-sandbox.mjs';

const inputFile = process.argv[2] || 'examples/blue-sky-worldview-blindtest/default-blue-sky-worldview-blindtest.json';
const outDir = process.argv[3] || 'output/v0.88/blue-sky-worldview-blindtest';
const input = readBlueSkyWorldviewBlindtestInput(path.resolve(inputFile));
console.log(JSON.stringify(writeBlueSkyWorldviewBlindtestReports(outDir, input), null, 2));
