import path from 'node:path';
import { writeSoulUniverseDialogueReports, readSoulUniverseDialogueInput } from '../../src/soul-universe-dialogue-sandbox.mjs';

const inputFile = process.argv[2] || 'examples/soul-universe-dialogue/default-soul-universe-dialogue.json';
const outDir = process.argv[3] || 'output/v0.87/soul-universe-dialogue-sandbox';
const input = readSoulUniverseDialogueInput(path.resolve(inputFile));
console.log(JSON.stringify(writeSoulUniverseDialogueReports(outDir, input), null, 2));
