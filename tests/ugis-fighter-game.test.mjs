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
import { MOTION_CLIPS } from '../examples/ugis-fighter-game/src/motion/motionClips.js';
import { KENDO_MOTION_CLIPS } from '../examples/ugis-fighter-game/src/motion/kendoMotionClips.js';
import { RIG_BONES, sampleFighterPose } from '../examples/ugis-fighter-game/src/motion/motionRuntime.js';
import { SFX_ASSETS } from '../examples/ugis-fighter-game/src/audio/sfx.js';
import {
  SWORD_STYLE_IDS,
  SWORD_STYLES,
  aiAttackFor,
  playerAttackFor,
} from '../examples/ugis-fighter-game/src/styles/swordStyles.js';
import {
  AI_DIFFICULTIES,
  chooseUgisRoute,
  directiveForRoute,
  explainRoute,
  getUgisAiDifficulty,
  resetUgisAiMemory,
  setUgisAiDifficulty,
} from '../examples/ugis-fighter-game/src/ugisAi.js';

const FALLBACK_MOTION = Object.freeze({ ...MOTION_CLIPS, ...KENDO_MOTION_CLIPS });

test('fighter game keeps the complete UGIS sword route catalog', () => {
  assert.equal(UGIS_ROUTES.length, 11);
  assert.equal(new Set(UGIS_ROUTES).size, 11);
  for (const route of UGIS_ROUTES) assert.ok(ROUTE_LABELS[route]);
});

test('all combat actions lower into a known UGIS tactical intent', () => {
  for (const attack of Object.values(ATTACKS)) {
    assert.ok(UGIS_ROUTES.includes(attack.routeIntent), attack.id);
    assert.ok(attack.duration > attack.activeEnd);
    assert.ok(attack.activeEnd > attack.activeStart);
    assert.ok(attack.range > 0 && attack.damage > 0);
  }
});

test('legacy motion catalogs still cover every combat action as a safe fallback', () => {
  assert.deepEqual(new Set(Object.keys(FALLBACK_MOTION)), new Set(Object.keys(ATTACKS)));
  for (const [id, attack] of Object.entries(ATTACKS)) {
    const motion = FALLBACK_MOTION[id];
    assert.ok(motion, id);
    assert.equal(motion.keyframes[0].t, 0, id);
    assert.equal(motion.keyframes.at(-1).t, 1, id);
    assert.ok(Math.abs(motion.active[0] - attack.activeStart / attack.duration) < 0.015, `${id} activeStart`);
    assert.ok(Math.abs(motion.active[1] - attack.activeEnd / attack.duration) < 0.015, `${id} activeEnd`);
  }
});

test('sword style registry maps every player slot and UGIS attack semantic to real actions', () => {
  assert.deepEqual(SWORD_STYLE_IDS, ['wanfeng', 'kendo']);
  for (const styleId of SWORD_STYLE_IDS) {
    const style = SWORD_STYLES[styleId];
    assert.equal(style.lightCombo.length, 3, styleId);
    for (let i = 0; i < 3; i += 1) assert.ok(ATTACKS[playerAttackFor(styleId, 'light', i)]);
    for (const slot of ['heavy', 'skill_u', 'skill_i', 'skill_o']) assert.ok(ATTACKS[playerAttackFor(styleId, slot)]);
    for (const semantic of ['thrust', 'heavy']) assert.ok(ATTACKS[aiAttackFor(styleId, semantic)]);
  }
});

test('rig exposes the complete pelvis-to-sword and pelvis-to-foot chain', () => {
  for (const bone of [
    'pelvis','spine','chest','head','shoulderL','upperArmL','forearmL','handL',
    'shoulderR','upperArmR','forearmR','handR','thighL','shinL','footL','thighR','shinR','footR','swordGrip',
  ]) assert.ok(RIG_BONES.includes(bone), bone);
});

test('authored WanFeng light1 still recruits the whole kinetic chain', () => {
  const fighter = createFighterLogic('player');
  fighter.action = 'light1';
  fighter.actionDuration = ATTACKS.light1.duration;
  fighter.actionTime = ATTACKS.light1.duration * 0.18;
  const anticipation = sampleFighterPose({ logic: fighter, elapsed: 1, styleId: 'wanfeng' });
  fighter.actionTime = ATTACKS.light1.duration * 0.42;
  const strike = sampleFighterPose({ logic: fighter, elapsed: 1, styleId: 'wanfeng' });
  assert.notEqual(anticipation.pelvis[1], strike.pelvis[1]);
  assert.notEqual(anticipation.chest[1], strike.chest[1]);
  assert.notEqual(anticipation.upperArmR[2], strike.upperArmR[2]);
  assert.ok(strike.swordGlow > 0.3);
});

test('presentation code never owns UGIS decisions or HP/Energy mutation', async () => {
  const files = [
    '../examples/ugis-fighter-game/src/motion/motionRuntime.js',
    '../examples/ugis-fighter-game/src/motion/authoredActionSets.js',
    '../examples/ugis-fighter-game/src/characters/FighterRigV2.jsx',
    '../examples/ugis-fighter-game/src/characters/SwordTipTrail.jsx',
    '../examples/ugis-fighter-game/src/HumanoidFighter.jsx',
  ];
  for (const file of files) {
    const text = await readFile(new URL(file, import.meta.url), 'utf8');
    for (const forbidden of ['chooseUgisRoute', '.hp =', '.energy =', 'applyDamage']) {
      assert.equal(text.includes(forbidden), false, `${file}: ${forbidden}`);
    }
  }
});

test('all external combat samples remain pinned CC0 assets', () => {
  assert.ok(Object.keys(SFX_ASSETS).length >= 7);
  for (const [name, asset] of Object.entries(SFX_ASSETS)) {
    assert.equal(asset.license, 'CC0-1.0', name);
    assert.match(asset.url, /^https:\/\/cdn\.jsdelivr\.net\/gh\//, name);
    assert.equal(asset.url.includes('@main/'), false, `${name} must pin a commit`);
  }
});

test('difficulty catalog separates fair play from Tianji research mode', () => {
  assert.deepEqual(Object.keys(AI_DIFFICULTIES), ['novice','normal','hard','master','tianji']);
  for (const id of ['novice','normal','hard','master']) {
    assert.equal(AI_DIFFICULTIES[id].telepathy, false, id);
    assert.ok(AI_DIFFICULTIES[id].reactionSteps[0] >= 1, id);
  }
  assert.equal(AI_DIFFICULTIES.tianji.telepathy, true);
});

test('Tianji preserves immediate interception while normal requires perception delay', () => {
  const baseline = { distance:2.25, selfHp:1000, selfEnergy:30, opponentGuard:false, ownHitstun:0 };
  setUgisAiDifficulty('tianji');
  resetUgisAiMemory();
  assert.equal(chooseUgisRoute({ ...baseline, opponentAction:'light1', tick:3 }), 'intercept_route');

  setUgisAiDifficulty('normal');
  resetUgisAiMemory();
  chooseUgisRoute({ ...baseline, opponentAction:null, tick:1 });
  assert.notEqual(chooseUgisRoute({ ...baseline, opponentAction:'light1', tick:3 }), 'intercept_route');
  assert.equal(chooseUgisRoute({ ...baseline, opponentAction:'light1', tick:6 }), 'intercept_route');
});

test('UGIS route directives stay high-level and coordinate-free', () => {
  setUgisAiDifficulty('tianji');
  resetUgisAiMemory();
  for (const route of UGIS_ROUTES) {
    const directive = directiveForRoute(route, { distance:2.4 });
    assert.ok(['approach','retreat','strafe','hold'].includes(directive.movement));
    assert.ok(['guard','dash','dash-back','thrust','heavy','hold'].includes(directive.action));
    assert.equal('x' in directive, false);
    assert.equal('z' in directive, false);
  }
});

test('fighter runtime remains bounded by shared resource limits', () => {
  const player = createFighterLogic('player');
  const enemy = createFighterLogic('enemy');
  assert.equal(player.hp, GAME_LIMITS.maxHp);
  assert.equal(enemy.hp, GAME_LIMITS.maxHp);
  assert.equal(observeRegime(4), 'free');
  assert.equal(observeRegime(2.2), 'contact');
  assert.equal(observeRegime(1.2), 'close');
  assert.equal(explainRoute(enemy.route).label, ROUTE_LABELS.hold_measure);
});

test('start flow keeps style selection and presentation now uses the V2 authored rig', async () => {
  const [app, start, shell, trail] = await Promise.all([
    readFile(new URL('../examples/ugis-fighter-game/src/App.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../examples/ugis-fighter-game/src/StartScreen.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../examples/ugis-fighter-game/src/HumanoidFighter.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../examples/ugis-fighter-game/src/characters/SwordTipTrail.jsx', import.meta.url), 'utf8'),
  ]);
  assert.ok(app.includes('gameStarted'));
  assert.ok(app.includes('playerStyleId') && app.includes('opponentStyleId'));
  assert.ok(start.includes('开始游戏') && start.includes('你的流派') && start.includes('对手流派'));
  assert.ok(shell.includes('FighterRigV2'));
  assert.equal(shell.includes('ringGeometry'), false);
  assert.equal(shell.includes('boxGeometry'), false);
  assert.ok(trail.includes('tip.getWorldPosition'));
});

test('player-facing HUD defaults to normal and keeps Tianji as explicit opt-in', async () => {
  const app = await readFile(new URL('../examples/ugis-fighter-game/src/App.jsx', import.meta.url), 'utf8');
  for (const forbidden of ['ActionRoot','BridgeRoot','PlanRoot','SnapshotRoot','Evidence Inspector']) {
    assert.equal(app.includes(forbidden), false, forbidden);
  }
  assert.ok(app.includes("useState('normal')"));
  assert.ok(app.includes('AI 难度'));
  assert.ok(app.includes('UGIS · {hud.aiRouteLabel}'));
  assert.equal(getUgisAiDifficulty().id, 'tianji');
});
