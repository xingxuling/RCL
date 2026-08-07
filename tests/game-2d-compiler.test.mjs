import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  compileRcl2DGameFromProgram,
  emitRcl2DGameHtml,
  evidenceRoot,
  renderRcl2DGameFrame,
  simulateRcl2DGame,
} from '../src/game-2d-compiler.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SPEC = JSON.parse(fs.readFileSync(path.join(ROOT, 'examples/k04-2d-game.game.json'), 'utf8'));

const lit = (value) => ({ kind: 'LiteralExpr', value });
const pathExpr = (value) => ({ kind: 'PathExpr', path: value });
const bin = (operator, left, right) => ({ kind: 'BinaryExpr', operator, left, right });
const alter = (target, expression) => ({ target, expression });

function makeProgram() {
  const values = {
    'game.status': 'ready',
    'game.score': 0,
    'game.frame': 0,
    'game.last_action': 'boot',
    'game.star_collected': false,
    'game.star_x': 220,
    'game.star_y': 124,
    'player.x': 24,
    'player.y': 136,
    'player.vx': 0,
    'player.vy': 0,
    'player.grounded': true,
  };
  const facets = Object.entries(values).map(([facetPath, value]) => ({
    path: facetPath,
    value: lit(value),
    valueType: typeof value === 'number' ? 'Number' : typeof value === 'boolean' ? 'Truth' : 'Text',
    deferred: false,
  }));
  const needs = [{ capability: 'game.write', target: 'game' }];
  const rule = (name, when, alters, preserves = []) => ({
    name,
    kind: 'Emergence',
    cause: 'player',
    when,
    needs,
    alters,
    preserves,
    witnesses: ['rcl:test:' + name],
    calls: [],
  });
  return {
    name: 'K04StarRunner',
    programRoot: 'test-program-root',
    facets,
    warrants: [{ subject: 'player', capability: 'game.write', target: 'game' }],
    rules: [
      rule('startGame', bin('==', pathExpr('game.status'), lit('ready')), [
        alter('game.status', lit('running')),
        alter('game.last_action', lit('start')),
      ], [bin('>=', pathExpr('game.score'), lit(0))]),
      rule('moveRight', bin('==', pathExpr('game.status'), lit('running')), [
        alter('player.vx', lit(4)),
        alter('game.last_action', lit('right')),
      ], [bin('>=', pathExpr('player.x'), lit(0))]),
      rule('jump', bin('==', pathExpr('player.grounded'), lit(true)), [
        alter('player.vy', lit(-12)),
        alter('player.grounded', lit(false)),
        alter('game.last_action', lit('jump')),
      ], [bin('<=', pathExpr('player.vy'), lit(0))]),
      rule('advanceFrame', bin('==', pathExpr('game.status'), lit('running')), [
        alter('game.frame', bin('+', pathExpr('game.frame'), lit(1))),
        alter('game.last_action', lit('tick')),
      ], [bin('>=', pathExpr('game.frame'), lit(0))]),
      rule('collectStar', bin('>=', pathExpr('player.x'), pathExpr('game.star_x')), [
        alter('game.score', bin('+', pathExpr('game.score'), lit(1))),
        alter('game.star_collected', lit(true)),
        alter('game.last_action', lit('collect')),
      ], [bin('>=', pathExpr('game.score'), lit(0))]),
      rule('resetGame', bin('>=', pathExpr('game.score'), lit(0)), [
        alter('game.status', lit('ready')),
        alter('game.score', lit(0)),
        alter('game.frame', lit(0)),
        alter('game.last_action', lit('reset')),
        alter('game.star_collected', lit(false)),
        alter('player.x', lit(24)),
        alter('player.y', lit(136)),
        alter('player.vx', lit(0)),
        alter('player.vy', lit(0)),
        alter('player.grounded', lit(true)),
      ], [bin('>=', pathExpr('game.score'), lit(0))]),
    ],
  };
}

function collectEvents() {
  return [
    { type: 'start' },
    { type: 'right' },
    ...Array.from({ length: 49 }, () => ({ type: 'tick' })),
    { type: 'jump' },
    { type: 'tick' },
  ];
}

test('K04 compiles RCL-owned game state, authority and rules into a rooted runtime manifest', () => {
  const manifest = compileRcl2DGameFromProgram(makeProgram(), SPEC);
  assert.equal(manifest.schema, 'rcl.2d-game-runtime-manifest.v0.1');
  assert.equal(manifest.program, 'K04StarRunner');
  assert.equal(manifest.rules.length, 6);
  assert.deepEqual(manifest.warrants, [{ subject: 'player', capability: 'game.write', target: 'game' }]);
  assert.match(manifest.manifestRoot, /^[0-9a-f]{64}$/u);
});

test('K04 fixed-step runtime executes movement, jump, collision and collection', () => {
  const manifest = compileRcl2DGameFromProgram(makeProgram(), SPEC);
  const result = simulateRcl2DGame(manifest, collectEvents());
  assert.equal(result.state['game.status'], 'running');
  assert.equal(result.state['game.score'], 1);
  assert.equal(result.state['game.star_collected'], true);
  assert.equal(result.state['game.frame'], 50);
  assert.ok(result.history.some((item) => item.rule === 'collectStar' && item.status === 'realized'));
  assert.equal(result.frames.length, collectEvents().length + 1);
  assert.equal(result.finalFrame.svg.includes('svg'), true);
});

test('K04 reset restores a deterministic initial world state', () => {
  const manifest = compileRcl2DGameFromProgram(makeProgram(), SPEC);
  const result = simulateRcl2DGame(manifest, [...collectEvents(), { type: 'reset' }]);
  assert.equal(result.state['game.status'], 'ready');
  assert.equal(result.state['game.score'], 0);
  assert.equal(result.state['game.frame'], 0);
  assert.equal(result.state['game.star_collected'], false);
  assert.equal(result.state['player.x'], manifest.state['player.x']);
  assert.equal(result.state['player.y'], manifest.state['player.y']);
});

test('K04 replay produces the same frame roots', () => {
  const manifest = compileRcl2DGameFromProgram(makeProgram(), SPEC);
  const first = simulateRcl2DGame(manifest, collectEvents());
  const second = simulateRcl2DGame(manifest, collectEvents());
  assert.equal(evidenceRoot(first.state), evidenceRoot(second.state));
  assert.deepEqual(first.frames.map((frame) => frame.root), second.frames.map((frame) => frame.root));
});

test('K04 preserve failure closes without committing candidate state', () => {
  const manifest = compileRcl2DGameFromProgram(makeProgram(), SPEC);
  const candidate = structuredClone(manifest);
  candidate.rules.find((rule) => rule.name === 'moveRight').preserves = [
    { kind: 'binary', operator: '<=', left: { kind: 'path', path: 'player.x' }, right: { kind: 'literal', value: 0 } },
  ];
  assert.throws(() => simulateRcl2DGame(candidate, [{ type: 'start' }, { type: 'right' }]), /RCL_2D_GAME_PRESERVE_FAILED:moveRight/u);
});

test('K04 authority failure closes before any rule commit', () => {
  const manifest = compileRcl2DGameFromProgram(makeProgram(), SPEC);
  const candidate = structuredClone(manifest);
  candidate.warrants = [];
  assert.throws(() => simulateRcl2DGame(candidate, [{ type: 'start' }]), /RCL_2D_GAME_AUTHORITY_DENIED:startGame:game.write/u);
});

test('K04 emits a standalone Canvas game artifact with a rooted manifest', () => {
  const manifest = compileRcl2DGameFromProgram(makeProgram(), SPEC);
  const html = emitRcl2DGameHtml(manifest);
  assert.match(html, /<canvas id="rcl-game"/u);
  assert.match(html, /const manifest=/u);
  assert.match(html, new RegExp(manifest.manifestRoot));
});

test('K04 rejects a scene binding that is not present in RCL state', () => {
  const invalid = structuredClone(SPEC);
  invalid.player.state.x = 'player.missing';
  assert.throws(() => compileRcl2DGameFromProgram(makeProgram(), invalid), /RCL_2D_GAME_UNKNOWN_STATE:player.missing/u);
});
