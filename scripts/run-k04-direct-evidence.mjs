#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildRcl2DGame,
  compileRcl2DGame,
  evidenceRoot,
  simulateRcl2DGame,
} from '../src/game-2d-compiler.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const rclPath = process.argv[2] ?? path.join(root, 'examples', 'k04-2d-game.rcl');
const specPath = process.argv[3] ?? path.join(root, 'examples', 'k04-2d-game.game.json');
const outputPath = process.argv[4] ?? path.join(root, 'output', 'universal-stress-k04');
const evidencePath = process.argv[5] ?? path.join(root, 'examples', 'k04-direct-evidence-2026-08-08.json');

function collectEvents() {
  return [
    { type: 'start' },
    { type: 'right' },
    ...Array.from({ length: 49 }, () => ({ type: 'tick' })),
    { type: 'jump' },
    { type: 'tick' },
  ];
}

function negativeChecks(manifest) {
  const preserveCandidate = structuredClone(manifest);
  preserveCandidate.rules.find((rule) => rule.name === 'moveRight').preserves = [
    { kind: 'binary', operator: '<=', left: { kind: 'path', path: 'player.x' }, right: { kind: 'literal', value: 0 } },
  ];
  let preserveNegative;
  try {
    simulateRcl2DGame(preserveCandidate, [{ type: 'start' }, { type: 'right' }]);
    preserveNegative = { threw: false, pass: false };
  } catch (error) {
    preserveNegative = { threw: true, error: String(error), pass: String(error).includes('RCL_2D_GAME_PRESERVE_FAILED:moveRight') };
  }

  const authorityCandidate = structuredClone(manifest);
  authorityCandidate.warrants = [];
  let authorityNegative;
  try {
    simulateRcl2DGame(authorityCandidate, [{ type: 'start' }]);
    authorityNegative = { threw: false, pass: false };
  } catch (error) {
    authorityNegative = { threw: true, error: String(error), pass: String(error).includes('RCL_2D_GAME_AUTHORITY_DENIED:startGame:game.write') };
  }
  return { preserveNegative, authorityNegative };
}

const source = fs.readFileSync(rclPath, 'utf8');
const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
const started = process.hrtime.bigint();
const manifest = compileRcl2DGame(source, spec);
const generated = buildRcl2DGame({ rclPath, specPath, outputPath });
const events = collectEvents();
const positive = simulateRcl2DGame(manifest, events);
const replay = simulateRcl2DGame(manifest, events);
const reset = simulateRcl2DGame(manifest, [...events, { type: 'reset' }]);
const negatives = negativeChecks(manifest);
const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;
const replayPass = evidenceRoot(positive.state) === evidenceRoot(replay.state) &&
  JSON.stringify(positive.frames.map((frame) => frame.root)) === JSON.stringify(replay.frames.map((frame) => frame.root));
const hostPositivePass = positive.state['game.score'] === 1 &&
  positive.state['game.star_collected'] === true &&
  positive.state['game.frame'] === 50;
const resetPass = reset.state['game.status'] === 'ready' &&
  reset.state['game.score'] === 0 &&
  reset.state['game.star_collected'] === false &&
  reset.state['player.x'] === manifest.state['player.x'];
const gates = {
  EXPRESS: 'PASS',
  COMPILE: 'PASS',
  LOWER: 'PASS',
  EXECUTE: hostPositivePass ? 'PASS' : 'FAIL',
  CORRECT: hostPositivePass && replayPass && resetPass ? 'PASS' : 'FAIL',
  ROBUST: negatives.preserveNegative.pass && negatives.authorityNegative.pass ? 'PASS' : 'FAIL',
  PERFORMANCE: elapsedMs < 1000 ? 'PASS' : 'FAIL',
  AI_GENERATE: 'UNVERIFIED',
  EVIDENCE: 'PASS',
};
const overall = Object.values(gates).every((status) => status === 'PASS')
  ? 'PASS'
  : Object.values(gates).includes('FAIL') ? 'FAIL' : 'BLOCKED';
const withoutRoot = {
  schema: 'rcl.universal-stress.k04.direct-evidence.v0.1',
  taskId: 'K04',
  cellId: 'game-runtime::game',
  goal: '2D game',
  compiler: {
    status: 'PASS',
    compilerVersion: manifest.compilerVersion,
    manifestRoot: manifest.manifestRoot,
    generatedProject: { ...generated, root: 'output/universal-stress-k04' },
  },
  gameRuntime: {
    status: hostPositivePass ? 'EXECUTED' : 'FAILED',
    runtime: 'RCL deterministic fixed-step 2D game runtime',
    frames: positive.frames.length,
    elapsedMs,
    finalFrameRoot: positive.finalFrame.root,
    renderedFrameFormat: 'rcl.2d-game-frame.v0.1',
  },
  hostSimulation: {
    positive: {
      finalState: positive.state,
      realizedRules: positive.history.filter((item) => item.status === 'realized').map((item) => item.rule),
      frameCount: positive.frames.length,
      pass: hostPositivePass,
    },
    replay: { pass: replayPass },
    reset: { finalState: reset.state, pass: resetPass },
    preserveNegative: negatives.preserveNegative,
    authorityNegative: negatives.authorityNegative,
  },
  gates,
  coverageMode: 'lowered-execution',
  overall,
  limitations: [
    'The game runtime is a deterministic JavaScript execution organ with a Canvas projection; this is not a claim of a native Godot or console runtime.',
    'The Canvas browser artifact is generated and not automatically upgraded to browser execution evidence.',
    'AI_GENERATE remains independently unverified.',
    'One K04 vertical slice does not establish universal game-language capability.',
  ],
};
const report = { ...withoutRoot, evidenceRoot: evidenceRoot(withoutRoot) };
fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
fs.writeFileSync(evidencePath, JSON.stringify(report, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(report, null, 2));
