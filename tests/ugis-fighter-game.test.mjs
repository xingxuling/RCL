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
  chooseUgisRoute,
  directiveForRoute,
  explainRoute,
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

test('UGIS AI is deterministic for the same observation and changes across regimes', () => {
  const free = {
    distance: 5.2, selfHp: 1000, selfEnergy: 30, opponentAction: null,
    opponentGuard: false, ownHitstun: 0, tick: 8,
  };
  const a = chooseUgisRoute(free);
  const b = chooseUgisRoute({ ...free });
  assert.equal(a, b);
  assert.ok(['take_line', 'hold_measure', 'change_rhythm'].includes(a));

  const contact = chooseUgisRoute({ ...free, distance: 2.25, opponentAction: 'light1' });
  assert.equal(contact, 'intercept_route');

  const close = chooseUgisRoute({ ...free, distance: 1.2, tick: 12 });
  assert.ok(['close_resolution', 'flow_route'].includes(close));
});

test('route directives remain high-level game intents rather than world coordinates', () => {
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

test('player-facing game HUD does not expose research evidence roots', async () => {
  const app = await readFile(
    new URL('../examples/ugis-fighter-game/src/App.jsx', import.meta.url),
    'utf8',
  );
  for (const forbidden of ['ActionRoot', 'BridgeRoot', 'PlanRoot', 'SnapshotRoot', 'Evidence Inspector']) {
    assert.equal(app.includes(forbidden), false, forbidden);
  }
  assert.ok(app.includes('UGIS · {hud.aiRouteLabel}'));
  assert.ok(app.includes('不是回放了，这次可以自己打。'));
});
