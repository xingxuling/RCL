import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  ATTACKS,
  GAME_LIMITS,
  ROUTE_LABELS,
  UGIS_ROUTES,
  createFighterLogic,
  observeRegime,
} from '../examples/ugis-fighter-game/src/gameRules.js';
import {
  AI_DIFFICULTIES,
  chooseUgisRoute,
  directiveForRoute,
  explainRoute,
  getUgisAiDifficulty,
  resetUgisAiMemory,
  setUgisAiDifficulty,
} from '../examples/ugis-fighter-game/src/ugisAi.js';

test('fighter game keeps the complete UGIS sword route catalog', () => {
  assert.equal(UGIS_ROUTES.length, 11);
  assert.equal(new Set(UGIS_ROUTES).size, 11);
  for (const route of UGIS_ROUTES) {
    assert.equal(typeof ROUTE_LABELS[route], 'string');
    assert.ok(ROUTE_LABELS[route].length > 0);
  }
});

test('all combat actions lower into a known UGIS tactical intent', () => {
  for (const attack of Object.values(ATTACKS)) {
    assert.ok(UGIS_ROUTES.includes(attack.routeIntent), attack.id);
    assert.ok(attack.duration > attack.activeEnd);
    assert.ok(attack.activeEnd > attack.activeStart);
    assert.ok(attack.range > 0);
    assert.ok(attack.damage > 0);
  }
});

test('difficulty catalog separates fair play from Tianji research mode', () => {
  assert.deepEqual(Object.keys(AI_DIFFICULTIES), ['novice', 'normal', 'hard', 'master', 'tianji']);
  for (const id of ['novice', 'normal', 'hard', 'master']) {
    const profile = AI_DIFFICULTIES[id];
    assert.equal(profile.telepathy, false, id);
    assert.ok(profile.reactionSteps[0] >= 1, id);
    assert.ok(profile.commitmentSteps[0] >= 2, id);
  }
  assert.equal(AI_DIFFICULTIES.tianji.telepathy, true);
  assert.deepEqual(AI_DIFFICULTIES.tianji.reactionSteps, [0, 0]);
});

test('Tianji preserves immediate research-AI interception behavior', () => {
  setUgisAiDifficulty('tianji');
  resetUgisAiMemory();
  const contact = chooseUgisRoute({
    distance: 2.25,
    selfHp: 1000,
    selfEnergy: 30,
    opponentAction: 'light1',
    opponentGuard: false,
    ownHitstun: 0,
    tick: 3,
  });
  assert.equal(contact, 'intercept_route');
});

test('normal difficulty cannot react to a fresh attack instantly but can react after perception delay', () => {
  setUgisAiDifficulty('normal');
  resetUgisAiMemory();
  const baseline = {
    distance: 2.25,
    selfHp: 1000,
    selfEnergy: 30,
    opponentGuard: false,
    ownHitstun: 0,
  };

  chooseUgisRoute({ ...baseline, opponentAction: null, tick: 1 });
  const immediate = chooseUgisRoute({ ...baseline, opponentAction: 'light1', tick: 3 });
  assert.notEqual(immediate, 'intercept_route');

  const delayed = chooseUgisRoute({ ...baseline, opponentAction: 'light1', tick: 6 });
  assert.equal(delayed, 'intercept_route');
});

test('normal difficulty commits to a route instead of frame-perfectly changing its mind', () => {
  setUgisAiDifficulty('normal');
  resetUgisAiMemory();
  const first = chooseUgisRoute({
    distance: 5.2, selfHp: 1000, selfEnergy: 30, opponentAction: null,
    opponentGuard: false, ownHitstun: 0, tick: 1,
  });
  const second = chooseUgisRoute({
    distance: 1.15, selfHp: 1000, selfEnergy: 30, opponentAction: 'heavy',
    opponentGuard: true, ownHitstun: 0, tick: 2,
  });
  assert.equal(second, first);
});

test('UGIS AI remains deterministic for the same difficulty, observation, and reset state', () => {
  const observation = {
    distance: 5.2, selfHp: 1000, selfEnergy: 30, opponentAction: null,
    opponentGuard: false, ownHitstun: 0, tick: 8,
  };
  setUgisAiDifficulty('normal');
  resetUgisAiMemory();
  const a = chooseUgisRoute(observation);
  resetUgisAiMemory();
  const b = chooseUgisRoute({ ...observation });
  assert.equal(a, b);
  assert.ok(UGIS_ROUTES.includes(a));
});

test('route directives remain high-level game intents rather than world coordinates', () => {
  setUgisAiDifficulty('tianji');
  resetUgisAiMemory();
  for (const route of UGIS_ROUTES) {
    const directive = directiveForRoute(route, { distance: 2.4 });
    assert.ok(['approach', 'retreat', 'strafe', 'hold'].includes(directive.movement));
    assert.ok(['guard', 'dash', 'dash-back', 'thrust', 'heavy', 'hold'].includes(directive.action));
    assert.equal('x' in directive, false);
    assert.equal('z' in directive, false);
  }
});

test('fighter runtime starts bounded and uses the same basic resource limits', () => {
  const player = createFighterLogic('player');
  const enemy = createFighterLogic('enemy');
  assert.equal(player.hp, GAME_LIMITS.maxHp);
  assert.equal(enemy.hp, GAME_LIMITS.maxHp);
  assert.ok(player.energy >= 0 && player.energy <= GAME_LIMITS.maxEnergy);
  assert.ok(enemy.energy >= 0 && enemy.energy <= GAME_LIMITS.maxEnergy);
  assert.equal(observeRegime(4), 'free');
  assert.equal(observeRegime(2.2), 'contact');
  assert.equal(observeRegime(1.2), 'close');
  assert.equal(explainRoute(enemy.route).label, ROUTE_LABELS.hold_measure);
});

test('player-facing HUD defaults to normal and keeps Tianji as an explicit opt-in', async () => {
  const app = await readFile(
    new URL('../examples/ugis-fighter-game/src/App.jsx', import.meta.url),
    'utf8',
  );
  for (const forbidden of ['ActionRoot', 'BridgeRoot', 'PlanRoot', 'SnapshotRoot', 'Evidence Inspector']) {
    assert.equal(app.includes(forbidden), false, forbidden);
  }
  assert.ok(app.includes("useState('normal')"));
  assert.ok(app.includes('AI 难度'));
  assert.ok(app.includes('天机'));
  assert.ok(app.includes('UGIS · {hud.aiRouteLabel}'));
  assert.equal(getUgisAiDifficulty().id, 'tianji');
});
