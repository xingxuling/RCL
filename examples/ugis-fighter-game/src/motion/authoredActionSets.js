import { ATTACKS } from '../gameRules.js';

const D = Math.PI / 180;
const r = (x = 0, y = 0, z = 0) => [x * D, y * D, z * D];
const active = id => Object.freeze([
  ATTACKS[id].activeStart / ATTACKS[id].duration,
  ATTACKS[id].activeEnd / ATTACKS[id].duration,
]);
const clip = (id, family, weaponMode, keyframes) => Object.freeze({
  id,
  family,
  weaponMode,
  source: 'taowind-authored-v0.3d',
  active: active(id),
  keyframes: Object.freeze(keyframes),
});

/*
 * Authored attack assets rather than shared procedural swing variants.
 * WanFeng is deliberately one-hand biased, off-axis, curved and continuous.
 * Kendo-inspired is deliberately two-hand biased, center-line, vertical/thrusting and decisive.
 */
export const WANFENG_AUTHORED_ACTIONS = Object.freeze({
  light1: clip('light1', 'wanfeng-outside-draw', 'one-hand-flow', [
    { t: 0.00, pose: {} },
    { t: 0.18, pose: { visualYaw: -0.34, bodyOffsetX: -0.08, bodyOffsetZ: -0.03,
      pelvis: r(4,-24,-4), chest: r(-8,-36,-8), shoulderR:r(-14,-12,-20), upperArmR:r(-58,-18,-74), forearmR:r(-42,5,-18),
      upperArmL:r(-24,12,34), forearmL:r(-54,0,-12), thighL:r(-14,0,5), thighR:r(10,0,-4), swordGrip:r(8,-12,-22) } },
    { t: 0.42, pose: { visualYaw: 0.48, bodyOffsetX: 0.11, bodyOffsetZ: 0.07,
      pelvis:r(-8,34,5), spine:r(6,24,3), chest:r(10,52,12), shoulderR:r(-16,14,16), upperArmR:r(-62,24,72), forearmR:r(-18,-4,16),
      upperArmL:r(-32,-8,-26), forearmL:r(-48,0,12), thighL:r(20,0,4), shinL:r(10), thighR:r(-12,0,-4), swordGrip:r(-5,12,18) } },
    { t: 0.68, pose: { visualYaw: 0.30, bodyOffsetX: 0.08, chest:r(4,36,8), upperArmR:r(-44,16,78), forearmR:r(-26,0,12) } },
    { t: 1.00, pose: { visualYaw: 0, bodyOffsetX: 0, bodyOffsetZ: 0 } },
  ]),
  light2: clip('light2', 'wanfeng-reverse-return', 'one-hand-flow', [
    { t: 0.00, pose: { visualYaw: 0.24, chest:r(2,28,6), upperArmR:r(-44,12,66), forearmR:r(-28,0,10) } },
    { t: 0.20, pose: { visualYaw: 0.54, bodyOffsetX: 0.13, pelvis:r(2,26,4), chest:r(-4,48,10), upperArmR:r(-54,20,76), forearmR:r(-36,0,14), swordGrip:r(0,8,18) } },
    { t: 0.46, pose: { visualYaw: -0.52, bodyOffsetX: -0.13, bodyOffsetZ: 0.08,
      pelvis:r(-5,-34,-4), chest:r(8,-56,-12), shoulderR:r(-14,-14,-12), upperArmR:r(-66,-24,-70), forearmR:r(-18,5,-12),
      upperArmL:r(-26,8,28), thighR:r(20,0,-4), shinR:r(10), thighL:r(-12,0,4), swordGrip:r(-4,-10,-18) } },
    { t: 0.72, pose: { visualYaw: -0.30, bodyOffsetX: -0.08, chest:r(3,-34,-7), upperArmR:r(-46,-14,-78), forearmR:r(-28,0,-10) } },
    { t: 1.00, pose: { visualYaw: 0, bodyOffsetX: 0, bodyOffsetZ: 0 } },
  ]),
  light3: clip('light3', 'wanfeng-turning-close', 'one-hand-flow', [
    { t: 0.00, pose: {} },
    { t: 0.20, pose: { visualYaw: -0.62, bodyOffsetX:-0.15, bodyOffsetY:-0.05, pelvis:r(8,-38,-6), chest:r(-12,-60,-10), upperArmR:r(-104,-8,-46), forearmR:r(-54,0,-10), thighL:r(-16,0,5), swordGrip:r(0,-14,-16) } },
    { t: 0.44, pose: { visualYaw: 0.72, bodyOffsetX:0.16, bodyOffsetZ:0.13,
      pelvis:r(-12,42,7), spine:r(10,34,4), chest:r(16,68,14), upperArmR:r(-52,18,64), forearmR:r(-12,0,12),
      upperArmL:r(-34,-12,-30), thighL:r(26,0,5), shinL:r(14), thighR:r(-18,0,-5) } },
    { t: 0.70, pose: { visualYaw:0.40, bodyOffsetX:0.09, chest:r(6,42,8), upperArmR:r(-38,10,82), forearmR:r(-24,0,10) } },
    { t:1.00, pose:{ visualYaw:0, bodyOffsetX:0, bodyOffsetY:0, bodyOffsetZ:0 } },
  ]),
  heavy: clip('heavy', 'wanfeng-wide-break', 'one-hand-power', [
    { t:0.00, pose:{} },
    { t:0.28, pose:{ visualYaw:-0.46, bodyOffsetX:-0.12, bodyOffsetY:-0.08, pelvis:r(12,-28,-6), chest:r(-18,-46,-10), upperArmR:r(-138,-10,-54), forearmR:r(-70,0,-8), upperArmL:r(-42,12,34), thighL:r(-20,0,6), thighR:r(14,0,-5) } },
    { t:0.52, pose:{ visualYaw:0.58, bodyOffsetX:0.12, bodyOffsetZ:0.10, pelvis:r(-14,36,6), chest:r(20,58,12), upperArmR:r(-46,18,54), forearmR:r(-14,0,8), thighL:r(24,0,4), shinL:r(12), thighR:r(-16,0,-4) } },
    { t:0.76, pose:{ visualYaw:0.24, bodyOffsetX:0.05, chest:r(8,28,6), upperArmR:r(-34,10,58), forearmR:r(-26,0,8) } },
    { t:1.00, pose:{ visualYaw:0, bodyOffsetX:0, bodyOffsetY:0, bodyOffsetZ:0 } },
  ]),
  skill_u: clip('skill_u', 'wanfeng-crossing-step', 'one-hand-flow', [
    { t:0.00, pose:{} },
    { t:0.16, pose:{ visualYaw:-0.38, bodyOffsetX:-0.12, bodyOffsetY:-0.06, pelvis:r(8,-24,-5), chest:r(-10,-40,-10), upperArmR:r(-60,-14,-76), forearmR:r(-34,0,-12), thighR:r(18,0,-5) } },
    { t:0.40, pose:{ visualYaw:0.64, bodyOffsetX:0.18, bodyOffsetZ:0.16, pelvis:r(-8,38,5), chest:r(12,62,14), upperArmR:r(-52,20,68), forearmR:r(-14,0,10), thighL:r(30,0,6), shinL:r(15) } },
    { t:0.70, pose:{ visualYaw:0.24, bodyOffsetX:0.08, chest:r(4,30,6), upperArmR:r(-36,10,78), forearmR:r(-24,0,10) } },
    { t:1.00, pose:{ visualYaw:0, bodyOffsetX:0, bodyOffsetY:0, bodyOffsetZ:0 } },
  ]),
  skill_i: clip('skill_i', 'wanfeng-circular-draw', 'one-hand-flow', [
    { t:0.00, pose:{} },
    { t:0.22, pose:{ visualYaw:0.52, bodyOffsetX:0.13, pelvis:r(2,32,5), chest:r(-4,54,12), upperArmR:r(-64,22,76), forearmR:r(-44,0,16), swordGrip:r(0,10,18) } },
    { t:0.45, pose:{ visualYaw:-0.72, bodyOffsetX:-0.18, bodyOffsetY:-0.04, pelvis:r(-8,-44,-6), chest:r(12,-72,-14), upperArmR:r(-58,-26,-72), forearmR:r(-18,0,-12), upperArmL:r(-30,12,36) } },
    { t:0.66, pose:{ visualYaw:0.68, bodyOffsetX:0.17, bodyOffsetZ:0.08, pelvis:r(-6,40,6), chest:r(10,68,14), upperArmR:r(-44,18,72), forearmR:r(-16,0,12) } },
    { t:1.00, pose:{ visualYaw:0, bodyOffsetX:0, bodyOffsetY:0, bodyOffsetZ:0 } },
  ]),
  skill_o: clip('skill_o', 'wanfeng-storm-silence', 'one-hand-power', [
    { t:0.00, pose:{} },
    { t:0.25, pose:{ visualYaw:-0.58, bodyOffsetX:-0.15, bodyOffsetY:-0.12, bodyOffsetZ:-0.04, pelvis:r(14,-36,-8), chest:r(-20,-60,-12), upperArmR:r(-140,-12,-48), forearmR:r(-66,0,-8), upperArmL:r(-48,14,40), thighL:r(-24,0,7), shinL:r(18), thighR:r(18,0,-6) } },
    { t:0.46, pose:{ visualYaw:0.88, bodyOffsetX:0.20, bodyOffsetZ:0.22, pelvis:r(-16,54,8), chest:r(24,84,16), upperArmR:r(-40,26,54), forearmR:r(-10,0,8), upperArmL:r(-32,-14,-30), thighL:r(34,0,6), shinL:r(18), thighR:r(-22,0,-5) } },
    { t:0.63, pose:{ visualYaw:0.42, bodyOffsetX:0.11, bodyOffsetZ:0.12, chest:r(10,48,10), upperArmR:r(-30,14,76), forearmR:r(-20,0,12) } },
    { t:0.82, pose:{ visualYaw:0.18, bodyOffsetX:0.04, bodyOffsetY:-0.03, chest:r(4,22,4), upperArmR:r(-34,8,48), forearmR:r(-30,0,8) } },
    { t:1.00, pose:{ visualYaw:0, bodyOffsetX:0, bodyOffsetY:0, bodyOffsetZ:0 } },
  ]),
});

export const KENDO_AUTHORED_ACTIONS = Object.freeze({
  kendo_light1: clip('kendo_light1', 'kendo-men-cut', 'two-hand-center', [
    { t:0.00, pose:{} },
    { t:0.26, pose:{ visualYaw:0, bodyOffsetY:-0.02, bodyOffsetZ:-0.03,
      pelvis:r(2,0,0), chest:r(-6,0,0), shoulderR:r(-16,0,-4), upperArmR:r(-142,0,-8), forearmR:r(-74,0,2), handR:r(0,0,-2),
      shoulderL:r(-16,0,4), upperArmL:r(-138,0,10), forearmL:r(-78,0,-2), handL:r(0,0,2), swordGrip:r(-8,0,0), thighL:r(-6,0,0), thighR:r(5,0,0) } },
    { t:0.48, pose:{ visualYaw:0, bodyOffsetZ:0.12, pelvis:r(-7,0,0), chest:r(10,0,0), upperArmR:r(-54,0,-6), forearmR:r(-18,0,0), upperArmL:r(-56,0,8), forearmL:r(-22,0,0), thighL:r(28,0,0), shinL:r(14), thighR:r(-16,0,0), swordGrip:r(1,0,0) } },
    { t:0.74, pose:{ visualYaw:0, bodyOffsetZ:0.06, chest:r(3,0,0), upperArmR:r(-68,0,-4), forearmR:r(-34,0,0), upperArmL:r(-66,0,5), forearmL:r(-38,0,0), swordGrip:r(2,0,0) } },
    { t:1.00, pose:{ visualYaw:0, bodyOffsetZ:0 } },
  ]),
  kendo_light2: clip('kendo_light2', 'kendo-kote-return', 'two-hand-center', [
    { t:0.00, pose:{} },
    { t:0.22, pose:{ visualYaw:0.02, bodyOffsetZ:-0.02, chest:r(-4,1,0), upperArmR:r(-98,2,-12), forearmR:r(-66,0,8), upperArmL:r(-94,-2,12), forearmL:r(-70,0,-8), swordGrip:r(-4,1,0) } },
    { t:0.46, pose:{ visualYaw:-0.03, bodyOffsetZ:0.10, pelvis:r(-5,-1,0), chest:r(8,-2,0), upperArmR:r(-50,-2,8), forearmR:r(-16,0,-4), upperArmL:r(-54,2,-10), forearmL:r(-22,0,4), thighL:r(24,0,0), shinL:r(12), thighR:r(-14,0,0), swordGrip:r(1,-1,0) } },
    { t:0.72, pose:{ visualYaw:0, bodyOffsetZ:0.05, chest:r(2,0,0), upperArmR:r(-64,0,-3), forearmR:r(-34,0,2), upperArmL:r(-62,0,4), forearmL:r(-38,0,-2) } },
    { t:1.00, pose:{ visualYaw:0, bodyOffsetZ:0 } },
  ]),
  kendo_light3: clip('kendo_light3', 'kendo-tsuki', 'two-hand-center', [
    { t:0.00, pose:{} },
    { t:0.20, pose:{ visualYaw:0, bodyOffsetY:-0.03, pelvis:r(3,0,0), chest:r(-5,0,0), upperArmR:r(-70,0,-4), forearmR:r(-70,0,2), upperArmL:r(-68,0,5), forearmL:r(-72,0,-2), swordGrip:r(6,0,0) } },
    { t:0.44, pose:{ visualYaw:0, bodyOffsetZ:0.18, pelvis:r(-10,0,0), chest:r(14,0,0), upperArmR:r(-88,0,0), forearmR:r(-5,0,0), upperArmL:r(-84,0,0), forearmL:r(-8,0,0), thighL:r(34,0,0), shinL:r(15), thighR:r(-20,0,0), swordGrip:r(12,0,0) } },
    { t:0.68, pose:{ visualYaw:0, bodyOffsetZ:0.10, chest:r(6,0,0), upperArmR:r(-78,0,0), forearmR:r(-20,0,0), upperArmL:r(-76,0,0), forearmL:r(-24,0,0), swordGrip:r(8,0,0) } },
    { t:1.00, pose:{ visualYaw:0, bodyOffsetZ:0 } },
  ]),
  kendo_heavy: clip('kendo_heavy', 'kendo-jodan-men', 'two-hand-center', [
    { t:0.00, pose:{} },
    { t:0.32, pose:{ visualYaw:0, bodyOffsetY:-0.04, bodyOffsetZ:-0.05, pelvis:r(5,0,0), chest:r(-10,0,0), shoulderR:r(-18,0,-5), upperArmR:r(-154,0,-10), forearmR:r(-82,0,0), shoulderL:r(-18,0,5), upperArmL:r(-150,0,10), forearmL:r(-86,0,0), swordGrip:r(-12,0,0), thighL:r(-10,0,0), thighR:r(8,0,0) } },
    { t:0.52, pose:{ visualYaw:0, bodyOffsetZ:0.16, pelvis:r(-11,0,0), chest:r(18,0,0), upperArmR:r(-44,0,-4), forearmR:r(-12,0,0), upperArmL:r(-46,0,5), forearmL:r(-16,0,0), thighL:r(32,0,0), shinL:r(16), thighR:r(-18,0,0), swordGrip:r(2,0,0) } },
    { t:0.78, pose:{ visualYaw:0, bodyOffsetZ:0.08, chest:r(6,0,0), upperArmR:r(-64,0,-3), forearmR:r(-32,0,0), upperArmL:r(-62,0,3), forearmL:r(-36,0,0), swordGrip:r(3,0,0) } },
    { t:1.00, pose:{ visualYaw:0, bodyOffsetZ:0 } },
  ]),
  kendo_skill_u: clip('kendo_skill_u', 'kendo-fumikomi-men', 'two-hand-center', [
    { t:0.00, pose:{} },
    { t:0.24, pose:{ visualYaw:0, bodyOffsetY:-0.05, bodyOffsetZ:-0.06, pelvis:r(6,0,0), chest:r(-10,0,0), upperArmR:r(-148,0,-8), forearmR:r(-78,0,0), upperArmL:r(-144,0,8), forearmL:r(-82,0,0), swordGrip:r(-10,0,0) } },
    { t:0.46, pose:{ visualYaw:0, bodyOffsetZ:0.24, pelvis:r(-12,0,0), chest:r(18,0,0), upperArmR:r(-42,0,-3), forearmR:r(-10,0,0), upperArmL:r(-44,0,4), forearmL:r(-14,0,0), thighL:r(38,0,0), shinL:r(18), thighR:r(-24,0,0), swordGrip:r(2,0,0) } },
    { t:0.72, pose:{ visualYaw:0, bodyOffsetZ:0.10, chest:r(5,0,0), upperArmR:r(-66,0,-3), forearmR:r(-34,0,0), upperArmL:r(-64,0,3), forearmL:r(-38,0,0) } },
    { t:1.00, pose:{ visualYaw:0, bodyOffsetZ:0 } },
  ]),
  kendo_skill_i: clip('kendo_skill_i', 'kendo-center-parry-return', 'two-hand-center', [
    { t:0.00, pose:{} },
    { t:0.24, pose:{ visualYaw:0.03, bodyOffsetZ:-0.03, pelvis:r(2,0,0), chest:r(-6,0,0), upperArmR:r(-88,3,-20), forearmR:r(-80,0,28), upperArmL:r(-84,-3,20), forearmL:r(-82,0,-28), swordGrip:r(8,2,0) } },
    { t:0.48, pose:{ visualYaw:-0.04, bodyOffsetZ:0.12, pelvis:r(-6,0,0), chest:r(10,0,0), upperArmR:r(-54,-3,8), forearmR:r(-16,0,-5), upperArmL:r(-56,3,-8), forearmL:r(-20,0,5), thighL:r(26,0,0), shinL:r(12), swordGrip:r(2,-2,0) } },
    { t:0.72, pose:{ visualYaw:0, bodyOffsetZ:0.06, chest:r(3,0,0), upperArmR:r(-66,0,-3), forearmR:r(-34,0,0), upperArmL:r(-64,0,3), forearmL:r(-38,0,0) } },
    { t:1.00, pose:{ visualYaw:0, bodyOffsetZ:0 } },
  ]),
  kendo_skill_o: clip('kendo_skill_o', 'kendo-one-beat-decision', 'two-hand-center', [
    { t:0.00, pose:{} },
    { t:0.28, pose:{ visualYaw:0, bodyOffsetY:-0.06, bodyOffsetZ:-0.08, pelvis:r(8,0,0), chest:r(-14,0,0), shoulderR:r(-18,0,-5), upperArmR:r(-158,0,-10), forearmR:r(-88,0,0), shoulderL:r(-18,0,5), upperArmL:r(-154,0,10), forearmL:r(-92,0,0), swordGrip:r(-14,0,0), thighL:r(-12,0,0), thighR:r(10,0,0) } },
    { t:0.50, pose:{ visualYaw:0, bodyOffsetZ:0.30, pelvis:r(-16,0,0), chest:r(24,0,0), upperArmR:r(-36,0,-2), forearmR:r(-6,0,0), upperArmL:r(-38,0,3), forearmL:r(-10,0,0), thighL:r(44,0,0), shinL:r(22), thighR:r(-28,0,0), swordGrip:r(4,0,0) } },
    { t:0.66, pose:{ visualYaw:0, bodyOffsetZ:0.18, chest:r(10,0,0), upperArmR:r(-54,0,-2), forearmR:r(-22,0,0), upperArmL:r(-52,0,2), forearmL:r(-26,0,0), swordGrip:r(4,0,0) } },
    { t:0.84, pose:{ visualYaw:0, bodyOffsetZ:0.09, chest:r(2,0,0), upperArmR:r(-68,0,-3), forearmR:r(-36,0,0), upperArmL:r(-66,0,3), forearmL:r(-40,0,0), swordGrip:r(2,0,0) } },
    { t:1.00, pose:{ visualYaw:0, bodyOffsetZ:0 } },
  ]),
});

export const AUTHORED_ACTION_CLIPS = Object.freeze({
  ...WANFENG_AUTHORED_ACTIONS,
  ...KENDO_AUTHORED_ACTIONS,
});
