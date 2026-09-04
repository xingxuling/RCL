import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { ATTACKS, createFighterLogic } from '../examples/ugis-fighter-game/src/gameRules.js';
import {
  AUTHORED_ACTION_CLIPS,
  KENDO_AUTHORED_ACTIONS,
  WANFENG_AUTHORED_ACTIONS,
} from '../examples/ugis-fighter-game/src/motion/authoredActionSets.js';
import { EXPANDED_AUTHORED_ACTIONS } from '../examples/ugis-fighter-game/src/motion/expandedStyleAnimations.js';
import { sampleFighterPose } from '../examples/ugis-fighter-game/src/motion/motionRuntime.js';
import { SWORD_STYLES } from '../examples/ugis-fighter-game/src/styles/swordStyles.js';

const ALL_AUTHORED_ACTIONS = Object.freeze({
  ...AUTHORED_ACTION_CLIPS,
  ...EXPANDED_AUTHORED_ACTIONS,
});

const authoredIdsFor = style => [
  ...style.lightCombo,
  style.heavy,
  ...style.skills,
];

test('every player-facing style attack has a dedicated authored animation resource', () => {
  for (const [styleId, style] of Object.entries(SWORD_STYLES)) {
    for (const attackId of authoredIdsFor(style)) {
      const clip = ALL_AUTHORED_ACTIONS[attackId];
      assert.ok(clip, `${styleId}: ${attackId}`);
      assert.match(clip.source, /^taowind-authored-v0\.(3d|4)$/);
      assert.ok(clip.keyframes.length >= 5, attackId);
    }
  }
});

test('authored animation active windows remain locked to game-rule hit windows', () => {
  for (const [id, motion] of Object.entries(ALL_AUTHORED_ACTIONS)) {
    const attack = ATTACKS[id];
    assert.ok(attack, id);
    assert.ok(Math.abs(motion.active[0] - attack.activeStart / attack.duration) < 1e-9, `${id} start`);
    assert.ok(Math.abs(motion.active[1] - attack.activeEnd / attack.duration) < 1e-9, `${id} end`);
  }
});

test('WanFeng and Kendo authored sets use different weapon and movement languages', () => {
  for (const clip of Object.values(WANFENG_AUTHORED_ACTIONS)) {
    assert.match(clip.family, /^wanfeng-/);
    assert.match(clip.weaponMode, /^one-hand-/);
  }
  for (const clip of Object.values(KENDO_AUTHORED_ACTIONS)) {
    assert.match(clip.family, /^kendo-/);
    assert.equal(clip.weaponMode, 'two-hand-center');
  }
});

test('WanFeng strike visibly rotates and cuts off-axis while Kendo Men stays centered', () => {
  const wanfeng = createFighterLogic('player');
  wanfeng.action = 'light1';
  wanfeng.actionDuration = ATTACKS.light1.duration;
  wanfeng.actionTime = ATTACKS.light1.duration * 0.42;
  const wf = sampleFighterPose({ logic: wanfeng, elapsed: 0.5, styleId: 'wanfeng' });

  const kendo = createFighterLogic('player');
  kendo.action = 'kendo_light1';
  kendo.actionDuration = ATTACKS.kendo_light1.duration;
  kendo.actionTime = ATTACKS.kendo_light1.duration * 0.48;
  const kd = sampleFighterPose({ logic: kendo, elapsed: 0.5, styleId: 'kendo' });

  assert.ok(Math.abs(wf.visualYaw) > 0.35, `WanFeng visualYaw=${wf.visualYaw}`);
  assert.ok(Math.abs(wf.bodyOffsetX) > 0.07, `WanFeng x=${wf.bodyOffsetX}`);
  assert.ok(Math.abs(kd.visualYaw) < 0.02, `Kendo visualYaw=${kd.visualYaw}`);
  assert.ok(Math.abs(kd.bodyOffsetX) < 0.005, `Kendo x=${kd.bodyOffsetX}`);
  assert.equal(wf.weaponMode, 'one-hand-flow');
  assert.equal(kd.weaponMode, 'two-hand-center');
});

test('Kendo Men resource contains a real overhead chamber before the center cut', () => {
  const logic = createFighterLogic('player');
  logic.action = 'kendo_light1';
  logic.actionDuration = ATTACKS.kendo_light1.duration;

  logic.actionTime = logic.actionDuration * 0.26;
  const chamber = sampleFighterPose({ logic, elapsed: 0.3, styleId: 'kendo' });
  logic.actionTime = logic.actionDuration * 0.48;
  const cut = sampleFighterPose({ logic, elapsed: 0.3, styleId: 'kendo' });

  assert.ok(chamber.upperArmR[0] < -2.0, `right chamber=${chamber.upperArmR[0]}`);
  assert.ok(chamber.upperArmL[0] < -2.0, `left chamber=${chamber.upperArmL[0]}`);
  assert.ok(cut.upperArmR[0] > chamber.upperArmR[0] + 1.0);
  assert.ok(cut.upperArmL[0] > chamber.upperArmL[0] + 1.0);
});

test('real sword trail samples the animated sword tip instead of drawing a fake style glyph', async () => {
  const [trail, shell] = await Promise.all([
    readFile(new URL('../examples/ugis-fighter-game/src/characters/SwordTipTrail.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../examples/ugis-fighter-game/src/HumanoidFighter.jsx', import.meta.url), 'utf8'),
  ]);
  assert.ok(trail.includes('tip.getWorldPosition'));
  assert.ok(trail.includes('BufferGeometry'));
  assert.ok(trail.includes('Float32BufferAttribute'));
  assert.equal(shell.includes('ringGeometry'), false);
  assert.equal(shell.includes('boxGeometry'), false);
  assert.ok(shell.includes('FighterRigV2'));
  assert.ok(shell.includes('ExpandedStyleRig'));
});

test('V2 presentation consumes authored body translation and full-body yaw channels', async () => {
  const rig = await readFile(
    new URL('../examples/ugis-fighter-game/src/characters/FighterRigV2.jsx', import.meta.url),
    'utf8',
  );
  for (const channel of ['bodyOffsetX', 'bodyOffsetY', 'bodyOffsetZ', 'visualYaw']) {
    assert.ok(rig.includes(channel), channel);
  }
  for (const forbidden of ['chooseUgisRoute', '.hp =', '.energy =']) {
    assert.equal(rig.includes(forbidden), false, forbidden);
  }
});
