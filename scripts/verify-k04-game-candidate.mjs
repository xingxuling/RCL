#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  compileRcl2DGame,
  evidenceRoot,
  simulateRcl2DGame,
} from '../src/game-2d-compiler.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const K04_GAME_SOURCE_PATH = path.join(ROOT, 'examples', 'k04-2d-game.rcl');
export const K04_GAME_SPEC_PATH = path.join(ROOT, 'examples', 'k04-2d-game.game.json');

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function events() {
  return [
    { type: 'start' },
    { type: 'right' },
    ...Array.from({ length: 49 }, () => ({ type: 'tick' })),
    { type: 'jump' },
    { type: 'tick' },
  ];
}

function check(pass, details = null) {
  return { pass: pass === true, ...(details === null ? {} : { details }) };
}

function expectedPositiveState(state) {
  return state['game.status'] === 'running'
    && state['game.score'] === 1
    && state['game.frame'] === 50
    && state['game.star_collected'] === true
    && state['player.x'] === 224
    && state['player.y'] === 124
    && state['player.vx'] === 4
    && state['player.vy'] === -10.5
    && state['player.grounded'] === false;
}

export function verifyK04GameCandidate({ sourcePath, specPath = K04_GAME_SPEC_PATH } = {}) {
  const started = process.hrtime.bigint();
  const checks = {
    express: check(false),
    compile: check(false),
    lower: check(false),
    execute: check(false),
    correct: check(false),
    robust: check(false),
    performance: check(false),
    evidence: check(false),
  };
  let manifestRoot = null;
  let error = null;
  try {
    const source = fs.readFileSync(path.resolve(sourcePath), 'utf8');
    const spec = JSON.parse(fs.readFileSync(path.resolve(specPath), 'utf8'));
    const manifest = compileRcl2DGame(source, spec);
    manifestRoot = manifest.manifestRoot;
    checks.express = check(
      manifest.program === 'K04StarRunner'
        && manifest.rules.length === 7
        && Object.keys(manifest.state).includes('player.x'),
      { program: manifest.program, ruleCount: manifest.rules.length },
    );
    checks.compile = check(
      manifest.schema === 'rcl.2d-game-runtime-manifest.v0.1'
        && /^[0-9a-f]{64}$/u.test(manifest.manifestRoot),
      { schema: manifest.schema, manifestRoot: manifest.manifestRoot },
    );
    checks.lower = check(
      manifest.metadata.coverageMode === 'lowered-execution'
        && manifest.metadata.semantics.includes('fixed-step 2D physics')
        && manifest.metadata.semantics.includes('scene projection'),
      { coverageMode: manifest.metadata.coverageMode },
    );

    const workload = events();
    const positive = simulateRcl2DGame(manifest, workload);
    const replay = simulateRcl2DGame(manifest, workload);
    const reset = simulateRcl2DGame(manifest, [...workload, { type: 'reset' }]);
    const exactPositive = expectedPositiveState(positive.state);
    const replayPass = evidenceRoot(positive.state) === evidenceRoot(replay.state)
      && JSON.stringify(positive.frames.map((frame) => frame.root)) === JSON.stringify(replay.frames.map((frame) => frame.root));
    const resetPass = reset.state['game.status'] === 'ready'
      && reset.state['game.score'] === 0
      && reset.state['game.frame'] === 0
      && reset.state['game.star_collected'] === false
      && reset.state['player.x'] === manifest.state['player.x']
      && reset.state['player.y'] === manifest.state['player.y'];
    checks.execute = check(exactPositive, { state: positive.state, frameCount: positive.frames.length });
    checks.correct = check(exactPositive && replayPass && resetPass, { replayPass, resetPass, finalFrameRoot: positive.finalFrame.root });

    const preserveCandidate = structuredClone(manifest);
    preserveCandidate.rules.find((rule) => rule.name === 'moveRight').preserves = [
      { kind: 'binary', operator: '<=', left: { kind: 'path', path: 'player.x' }, right: { kind: 'literal', value: 0 } },
    ];
    let preserveNegative = false;
    try {
      simulateRcl2DGame(preserveCandidate, [{ type: 'start' }, { type: 'right' }]);
    } catch (candidateError) {
      preserveNegative = String(candidateError).includes('RCL_2D_GAME_PRESERVE_FAILED:moveRight');
    }
    const authorityCandidate = structuredClone(manifest);
    authorityCandidate.warrants = [];
    let authorityNegative = false;
    try {
      simulateRcl2DGame(authorityCandidate, [{ type: 'start' }]);
    } catch (candidateError) {
      authorityNegative = String(candidateError).includes('RCL_2D_GAME_AUTHORITY_DENIED:startGame:game.write');
    }
    checks.robust = check(preserveNegative && authorityNegative, { preserveNegative, authorityNegative });
    checks.evidence = check(
      positive.finalFrame?.format === undefined
        ? typeof positive.finalFrame?.root === 'string'
        : positive.finalFrame.format === 'rcl.2d-game-frame.v0.1',
      { finalFrameRoot: positive.finalFrame.root },
    );
  } catch (candidateError) {
    error = String(candidateError?.stack ?? candidateError);
  }
  const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;
  checks.performance = check(elapsedMs < 1000, { budgetMs: 1000 });
  const status = Object.values(checks).every((item) => item.pass) ? 'PASS' : 'FAIL';
  const report = {
    schema: 'rcl.k04.game-candidate-verification.v0.1',
    status,
    sourceSha256: sourcePath && fs.existsSync(path.resolve(sourcePath)) ? sha256(fs.readFileSync(path.resolve(sourcePath))) : null,
    manifestRoot,
    elapsedMs,
    checks,
    error,
    reportRoot: null,
  };
  report.reportRoot = evidenceRoot({ ...report, elapsedMs: undefined, reportRoot: undefined });
  return report;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const result = verifyK04GameCandidate({ sourcePath: process.argv[2] ?? K04_GAME_SOURCE_PATH, specPath: process.argv[3] ?? K04_GAME_SPEC_PATH });
  console.log(JSON.stringify(result, null, 2));
  if (result.status !== 'PASS') process.exitCode = 1;
}
