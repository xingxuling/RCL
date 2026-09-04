#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { evidenceRoot } from '../src/universal-program-stress.mjs';
import {
  K04_GAME_SOURCE_PATH,
  K04_GAME_SPEC_PATH,
  verifyK04GameCandidate,
} from './verify-k04-game-candidate.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const sourcePath = path.resolve(process.argv[2] ?? K04_GAME_SOURCE_PATH);
const specPath = path.resolve(process.argv[3] ?? K04_GAME_SPEC_PATH);
const outputPath = path.resolve(process.argv[4] ?? path.join(ROOT, 'examples', 'universal-stress', 'evidence', 'k04-game-runtime-v0.1.json'));

const verification = verifyK04GameCandidate({ sourcePath, specPath });
const report = {
  format: 'rcl.k04.game-runtime-evidence.v0.1',
  status: verification.status,
  coverageMode: 'lowered-execution',
  sourceSha256: verification.sourceSha256,
  manifestRoot: verification.manifestRoot,
  checks: verification.checks,
  evidenceBoundary: 'This receipt covers one deterministic JavaScript fixed-step 2D game runtime and its Canvas projection. It does not claim native Godot/Unity/console parity, browser execution, arbitrary game generation or universal K400 completion.',
  reportRoot: null,
};
report.reportRoot = evidenceRoot({ ...report, reportRoot: undefined });
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ status: report.status, manifestRoot: report.manifestRoot, reportRoot: report.reportRoot, outputPath }, null, 2));
if (report.status !== 'PASS') process.exitCode = 1;
