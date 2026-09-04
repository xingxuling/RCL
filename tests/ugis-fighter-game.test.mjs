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

const ALL_MOTION_CLIPS = Object.freeze({ ...MOTION_CLIPS, ...KENDO_MOTION_CLIPS });

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

test('v0.3 motion catalogs cover every combat action and preserve game-rule active windows', () => {
  assert.deepEqual(new Set(Object.keys(ALL_MOTION_CLIPS)), new Set(Object.keys(ATTACKS)));
  for (const [id, attack] of Object.entries(ATTACKS)) {
    const motion = ALL_MOTION_CLIPS[id];
    assert.ok(motion, id);
    assert.ok(motion.keyframes.length >= 4, id);
    assert.equal(motion.keyframes[0].t, 0, id);
    assert.equal(motion.keyframes.at(-1).t, 1, id);
    for (let i = 1; i < motion.keyframes.length; i += 1) {
      assert.ok(motion.keyframes[i].t > motion.keyframes[i - 1].t, `${id} keyframe ${i}`);
    }
    assert.ok(Math.abs(motion.active[0] - attack.activeStart / attack.duration) < 0.015, `${id} activeStart`);
    assert.ok(Math.abs(motion.active[1] - attack.activeEnd / attack.duration) < 0.015, `${id} activeEnd`);
  }
});

test('sword style registry maps every player slot and UGIS attack semantic to real actions', () => {
  assert.deepEqual(SWORD_STYLE_IDS, ['wanfeng', 'kendo']);
  for (const styleId of SWORD_STYLE_IDS) {
    const style = SWORD_STYLES[styleId];
    assert.equal(style.lightCombo.length, 3, styleId);
    for (let i = 0; i < 3; i += 1) assert.ok(ATTACKS[playerAttackFor(styleId, 'light', i)], `${styleId} light ${i}`);
    for (const slot of ['heavy', 'skill_u', 'skill_i', 'skill_o']) {
      assert.ok(ATTACKS[playerAttackFor(styleId, slot)], `${styleId} ${slot}`);
    }
    for (const semantic of ['thrust', 'heavy']) assert.ok(ATTACKS[aiAttackFor(styleId, semantic)], `${styleId} ai ${semantic}`);
  }
});

test('WanFeng and Kendo-inspired sword paths remain mechanically distinct in presentation', () => {
  const wanfeng = createFighterLogic('player');
  wanfeng.action = 'light1';
  wanfeng.actionDuration = ATTACKS.light1.duration;
  wanfeng.actionTime = ATTACKS.light1.duration * 0.46;
  const wanfengPose = sampleFighterPose({ logic: wanfeng, elapsed: 1, enemy: false });

  const kendo = createFighterLogic('player');
  kendo.action = 'kendo_light1';
  kendo.actionDuration = ATTACKS.kendo_light1.duration;
  kendo.actionTime = ATTACKS.kendo_light1.duration * 0.44;
  const kendoPose = sampleFighterPose({ logic: kendo, elapsed: 1, enemy: true });

  assert.ok(Math.abs(wanfengPose.chest[1]) > Math.abs(kendoPose.chest[1]) + 0.18, 'WanFeng should visibly turn off center line');
  assert.ok(Math.abs(kendoPose.chest[1]) < 0.05, 'Kendo-inspired strike should stay near center line');
});

test('v0.3 rig exposes a full pelvis-to-sword and pelvis-to-foot chain', () => {
  for (const bone of [
    'pelvis', 'spine', 'chest', 'head',
    'shoulderL', 'upperArmL', 'forearmL', 'handL',
    'shoulderR', 'upperArmR', 'forearmR', 'handR',
    'thighL', 'shinL', 'footL', 'thighR', 'shinR', 'footR', 'swordGrip',
  ]) {
    assert.ok(RIG_BONES.includes(bone), bone);
  }
  assert.equal(new Set(RIG_BONES).size, RIG_BONES.length);
});

test('Light1 pose visibly recruits pelvis/chest before sword arm instead of arm-only animation', () => {
  const fighter = createFighterLogic('player');
  fighter.action = 'light1';
  fighter.actionDuration = ATTACKS.light1.duration;
  fighter.grounded = true;
  fighter.moveMagnitude = 0;

  fighter.actionTime = ATTACKS.light1.duration * 0.22;
  const anticipation = sampleFighterPose({ logic: fighter, elapsed: 1, enemy: false });
  fighter.actionTime = ATTACKS.light1.duration * 0.46;
  const strike = sampleFighterPose({ logic: fighter, elapsed: 1, enemy: false });

  assert.notEqual(anticipation.pelvis[1], strike.pelvis[1]);
  assert.notEqual(anticipation.chest[1], strike.chest[1]);
  assert.notEqual(anticipation.upperArmR[2], strike.upperArmR[2]);
  assert.ok(strike.swordGlow > 0.3);
});

test('motion and rig presentation code do not own UGIS decisions or resource mutation', async () => {
  const files = [
    '../examples/ugis-fighter-game/src/motion/motionRuntime.js',
    '../examples/ugis-fighter-game/src/motion/motionClips.js',
    '../examples/ugis-fighter-game/src/motion/kendoMotionClips.js',
    '../examples/ugis-fighter-game/src/characters/FighterRig.jsx',
    '../examples/ugis-fighter-game/src/HumanoidFighter.jsx',
  ];
  for (const file of files) {
    const text = await readFile(new URL(file, import.meta.url), 'utf8');
    for (const forbidden of ['chooseUgisRoute', '.hp =', '.energy =', 'applyDamage']) {
      assert.equal(text.includes(forbidden), false, `${file}: ${forbidden}`);
    }
  }
});

test('all external combat samples are pinned CC0 assets', () => {
  assert.ok(Object.keys(SFX_ASSETS).length >= 7);
  for (const [name, asset] of Object.entries(SFX_ASSETS)) {
    assert.equal(asset.license, 'CC0-1.0', name);
    assert.match(asset.url, /^https:\/\/cdn\.jsdelivr\.net\/gh\//, name);
    assert.equal(asset.url.includes('@main/'), false, `${name} must pin a commit`);
    assert.ok(asset.source.length > 8, name);
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

test('start flow exposes player/opponent sword-style selection before battle', async () => {
  const [app, start, pathCue] = await Promise.all([
    readFile(new URL('../examples/ugis-fighter-game/src/App.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../examples/ugis-fighter-game/src/StartScreen.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../examples/ugis-fighter-game/src/HumanoidFighter.jsx', import.meta.url), 'utf8'),
  ]);
  assert.ok(app.includes('gameStarted'));
  assert.ok(app.includes('playerStyleId'));
  assert.ok(app.includes('opponentStyleId'));
  assert.ok(start.includes('开始游戏'));
  assert.ok(start.includes('你的流派'));
  assert.ok(start.includes('对手流派'));
  assert.ok(pathCue.includes('ringGeometry'), 'WanFeng should expose an arc path cue');
  assert.ok(pathCue.includes('boxGeometry'), 'Kendo-inspired should expose a center-line path cue');
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
  assert.ok(app.includes('UGIS · {hud.aiRouteLabel}'));
  assert.equal(getUgisAiDifficulty().id, 'tianji');
});
