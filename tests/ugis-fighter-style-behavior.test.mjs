import assert from 'node:assert/strict';
import test from 'node:test';

import { ATTACKS, createFighterLogic } from '../examples/ugis-fighter-game/src/gameRules.js';
import { sampleFighterPose } from '../examples/ugis-fighter-game/src/motion/motionRuntime.js';
import {
  STYLE_BEHAVIOR,
  attackLateralFactor,
  canQueueCombo,
  comboPolicy,
  shapeMovement,
  shouldReleaseQueuedCombo,
} from '../examples/ugis-fighter-game/src/styles/styleBehavior.js';

test('WanFeng forward pressure naturally creates orbit while Kendo stays on center line', () => {
  const wanfeng = shapeMovement('wanfeng', { forward: 1, lateral: 0, flowSide: 1 });
  const kendo = shapeMovement('kendo', { forward: 1, lateral: 0, flowSide: 1 });

  assert.ok(wanfeng.forward > 0.9);
  assert.ok(Math.abs(wanfeng.lateral) >= 0.15, `WanFeng lateral=${wanfeng.lateral}`);
  assert.equal(kendo.lateral, 0);
  assert.ok(wanfeng.speedScale >= kendo.speedScale);
});

test('Kendo deliberately compresses lateral input while WanFeng preserves side movement', () => {
  const wanfeng = shapeMovement('wanfeng', { forward: 0.55, lateral: 0.7, flowSide: -1 });
  const kendo = shapeMovement('kendo', { forward: 0.55, lateral: 0.7, flowSide: -1 });

  assert.ok(Math.abs(wanfeng.lateral) > Math.abs(kendo.lateral) + 0.2);
  assert.ok(STYLE_BEHAVIOR.wanfeng.locomotion.strafeScale > STYLE_BEHAVIOR.kendo.locomotion.strafeScale);
});

test('WanFeng attack root motion curves laterally while Kendo attack root motion stays straight', () => {
  const wanfengMid = attackLateralFactor('wanfeng', 'light1', 1, 0.5);
  const wanfengOpposite = attackLateralFactor('wanfeng', 'light1', -1, 0.5);
  const kendoMid = attackLateralFactor('kendo', 'kendo_light1', 1, 0.5);

  assert.ok(Math.abs(wanfengMid) > 0.1);
  assert.equal(Math.sign(wanfengMid), -Math.sign(wanfengOpposite));
  assert.equal(kendoMid, 0);
});

test('WanFeng combo rhythm opens earlier and releases earlier than Kendo', () => {
  const wanfeng = comboPolicy('wanfeng');
  const kendo = comboPolicy('kendo');

  assert.ok(wanfeng.queueFrom < kendo.queueFrom);
  assert.ok(wanfeng.releaseAt < kendo.releaseAt);
  assert.ok(wanfeng.bufferWindow > kendo.bufferWindow);
  assert.ok(wanfeng.resetWindow > kendo.resetWindow);

  assert.equal(canQueueCombo('wanfeng', 0.7), true);
  assert.equal(canQueueCombo('kendo', 0.7), false);
  assert.equal(shouldReleaseQueuedCombo('wanfeng', 0.86), true);
  assert.equal(shouldReleaseQueuedCombo('kendo', 0.86), false);
});

test('guard silhouettes remain style-specific even without trail effects', () => {
  const wanfeng = createFighterLogic('player');
  wanfeng.guard = true;
  wanfeng.styleId = 'wanfeng';
  const wanfengPose = sampleFighterPose({ logic: wanfeng, elapsed: 1.2, styleId: 'wanfeng' });

  const kendo = createFighterLogic('player');
  kendo.guard = true;
  kendo.styleId = 'kendo';
  const kendoPose = sampleFighterPose({ logic: kendo, elapsed: 1.2, styleId: 'kendo' });

  assert.ok(Math.abs(wanfengPose.chest[1]) > Math.abs(kendoPose.chest[1]) + 0.15);
  assert.ok(Math.abs(wanfengPose.swordGrip[1]) > Math.abs(kendoPose.swordGrip[1]) + 0.1);
  assert.equal(wanfengPose.guardFx, true);
  assert.equal(kendoPose.guardFx, true);
});

test('locomotion body language differs before any attack starts', () => {
  const wanfengIdle = createFighterLogic('player');
  wanfengIdle.styleId = 'wanfeng';
  wanfengIdle.moveMagnitude = 0;
  wanfengIdle.grounded = true;
  const wanfengIdlePose = sampleFighterPose({ logic: wanfengIdle, elapsed: 0.31, styleId: 'wanfeng' });

  const wanfeng = createFighterLogic('player');
  wanfeng.styleId = 'wanfeng';
  wanfeng.moveMagnitude = 1;
  wanfeng.moveIntent = 'strafe';
  wanfeng.grounded = true;
  const wanfengPose = sampleFighterPose({ logic: wanfeng, elapsed: 0.31, styleId: 'wanfeng' });

  const kendoIdle = createFighterLogic('player');
  kendoIdle.styleId = 'kendo';
  kendoIdle.moveMagnitude = 0;
  kendoIdle.grounded = true;
  const kendoIdlePose = sampleFighterPose({ logic: kendoIdle, elapsed: 0.31, styleId: 'kendo' });

  const kendo = createFighterLogic('player');
  kendo.styleId = 'kendo';
  kendo.moveMagnitude = 1;
  kendo.moveIntent = 'strafe';
  kendo.grounded = true;
  const kendoPose = sampleFighterPose({ logic: kendo, elapsed: 0.31, styleId: 'kendo' });

  const wanfengRollDelta = Math.abs(wanfengPose.pelvis[2] - wanfengIdlePose.pelvis[2]);
  const kendoRollDelta = Math.abs(kendoPose.pelvis[2] - kendoIdlePose.pelvis[2]);
  const wanfengYawDelta = Math.abs(wanfengPose.chest[1] - wanfengIdlePose.chest[1]);
  const kendoYawDelta = Math.abs(kendoPose.chest[1] - kendoIdlePose.chest[1]);

  assert.ok(wanfengRollDelta > kendoRollDelta * 1.7, `roll delta ${wanfengRollDelta} vs ${kendoRollDelta}`);
  assert.ok(wanfengYawDelta > kendoYawDelta + 0.02, `yaw delta ${wanfengYawDelta} vs ${kendoYawDelta}`);
});

test('style behavior references only existing attack ids', () => {
  for (const [styleId, behavior] of Object.entries(STYLE_BEHAVIOR)) {
    for (const attackId of Object.keys(behavior.attackPath)) {
      assert.ok(ATTACKS[attackId], `${styleId}: ${attackId}`);
    }
  }
});
