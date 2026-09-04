const D = Math.PI / 180;
const r = (x = 0, y = 0, z = 0) => [x * D, y * D, z * D];
const clip = (id, active, keyframes) => Object.freeze({ id, active: Object.freeze(active), keyframes: Object.freeze(keyframes) });

// 剑道原型的动作语言故意和万风分开：更少横向 yaw/roll，更强调中心线、直入、短促收束。
export const KENDO_MOTION_CLIPS = Object.freeze({
  kendo_light1: clip('kendo_light1', [0.325, 0.55], [
    { t: 0.00, pose: {} },
    { t: 0.20, pose: {
      pelvis: r(2, 0, 0), spine: r(-3, 0, 0), chest: r(-5, 0, 0),
      upperArmR: r(-82, 0, -8), forearmR: r(-54, 0, 0), handR: r(0, 0, -3),
      upperArmL: r(-62, 0, 8), forearmL: r(-68, 0, 0), swordGrip: r(-2, 0, 0),
    }},
    { t: 0.44, pose: {
      pelvis: r(-5, 0, 0), spine: r(7, 0, 0), chest: r(10, 0, 0),
      upperArmR: r(-96, 0, 0), forearmR: r(-10, 0, 0), upperArmL: r(-80, 0, 2), forearmL: r(-22, 0, 0),
      thighL: r(22, 0, 0), thighR: r(-14, 0, 0),
    }},
    { t: 0.70, pose: { chest: r(3, 0, 0), upperArmR: r(-70, 0, 2), forearmR: r(-28, 0, 0) } },
    { t: 1.00, pose: {} },
  ]),

  kendo_light2: clip('kendo_light2', [0.341, 0.568], [
    { t: 0.00, pose: {} },
    { t: 0.22, pose: {
      pelvis: r(3, 0, 0), chest: r(-7, 0, 0), upperArmR: r(-108, 0, -4), forearmR: r(-58, 0, 0),
      upperArmL: r(-84, 0, 5), forearmL: r(-62, 0, 0),
    }},
    { t: 0.46, pose: {
      pelvis: r(-7, 0, 0), chest: r(12, 0, 0), upperArmR: r(-48, 0, 4), forearmR: r(-16, 0, 0),
      upperArmL: r(-52, 0, -2), forearmL: r(-34, 0, 0), thighL: r(20, 0, 0), thighR: r(-12, 0, 0),
    }},
    { t: 0.72, pose: { chest: r(5, 0, 0), upperArmR: r(-38, 0, 14), forearmR: r(-28, 0, 0) } },
    { t: 1.00, pose: {} },
  ]),

  kendo_light3: clip('kendo_light3', [0.333, 0.574], [
    { t: 0.00, pose: {} },
    { t: 0.24, pose: {
      pelvis: r(5, 0, 0), spine: r(-7, 0, 0), chest: r(-11, 0, 0),
      upperArmR: r(-124, 0, -5), forearmR: r(-64, 0, 0), upperArmL: r(-98, 0, 5), forearmL: r(-66, 0, 0),
    }},
    { t: 0.48, pose: {
      pelvis: r(-9, 0, 0), spine: r(11, 0, 0), chest: r(16, 0, 0),
      upperArmR: r(-44, 0, 3), forearmR: r(-14, 0, 0), upperArmL: r(-48, 0, -2), forearmL: r(-30, 0, 0),
      thighL: r(24, 0, 0), shinL: r(10, 0, 0), thighR: r(-15, 0, 0),
    }},
    { t: 0.74, pose: { chest: r(7, 0, 0), upperArmR: r(-34, 0, 18), forearmR: r(-26, 0, 0) } },
    { t: 1.00, pose: {} },
  ]),

  kendo_heavy: clip('kendo_heavy', [0.392, 0.595], [
    { t: 0.00, pose: {} },
    { t: 0.34, pose: {
      pelvis: r(8, 0, 0), spine: r(-10, 0, 0), chest: r(-15, 0, 0),
      upperArmR: r(-138, 0, -4), forearmR: r(-72, 0, 0), upperArmL: r(-118, 0, 4), forearmL: r(-72, 0, 0),
    }},
    { t: 0.52, pose: {
      pelvis: r(-11, 0, 0), spine: r(13, 0, 0), chest: r(19, 0, 0),
      upperArmR: r(-42, 0, 2), forearmR: r(-12, 0, 0), upperArmL: r(-46, 0, -2), forearmL: r(-26, 0, 0),
      thighL: r(22, 0, 0), thighR: r(-14, 0, 0),
    }},
    { t: 0.78, pose: { chest: r(7, 0, 0), upperArmR: r(-30, 0, 14), forearmR: r(-26, 0, 0) } },
    { t: 1.00, pose: {} },
  ]),

  kendo_skill_u: clip('kendo_skill_u', [0.313, 0.563], [
    { t: 0.00, pose: {} },
    { t: 0.20, pose: { pelvis: r(1, 0, 0), chest: r(-4, 0, 0), upperArmR: r(-78, 0, -5), forearmR: r(-50, 0, 0) } },
    { t: 0.43, pose: { pelvis: r(-7, 0, 0), chest: r(10, 0, 0), upperArmR: r(-100, 0, 0), forearmR: r(-6, 0, 0), thighL: r(28, 0, 0), thighR: r(-18, 0, 0) } },
    { t: 0.72, pose: { chest: r(3, 0, 0), upperArmR: r(-68, 0, 3), forearmR: r(-24, 0, 0) } },
    { t: 1.00, pose: {} },
  ]),

  kendo_skill_i: clip('kendo_skill_i', [0.368, 0.618], [
    { t: 0.00, pose: {} },
    { t: 0.25, pose: {
      pelvis: r(2, 0, 0), chest: r(-5, 0, 0), upperArmR: r(-88, 0, -10), forearmR: r(-76, 0, 12),
      upperArmL: r(-74, 0, 14), forearmL: r(-82, 0, -12), swordGrip: r(4, 0, -7),
    }},
    { t: 0.46, pose: {
      pelvis: r(-8, 0, 0), chest: r(13, 0, 0), upperArmR: r(-92, 0, 2), forearmR: r(-10, 0, 0),
      upperArmL: r(-72, 0, 0), forearmL: r(-22, 0, 0), thighL: r(18, 0, 0), thighR: r(-10, 0, 0),
    }},
    { t: 0.74, pose: { chest: r(4, 0, 0), upperArmR: r(-56, 0, 8), forearmR: r(-28, 0, 0) } },
    { t: 1.00, pose: {} },
  ]),

  kendo_skill_o: clip('kendo_skill_o', [0.375, 0.573], [
    { t: 0.00, pose: {} },
    { t: 0.32, pose: {
      pelvis: r(9, 0, 0), spine: r(-12, 0, 0), chest: r(-17, 0, 0),
      upperArmR: r(-142, 0, -2), forearmR: r(-76, 0, 0), upperArmL: r(-122, 0, 2), forearmL: r(-74, 0, 0),
    }},
    { t: 0.48, pose: {
      pelvis: r(-13, 0, 0), spine: r(15, 0, 0), chest: r(22, 0, 0),
      upperArmR: r(-40, 0, 0), forearmR: r(-8, 0, 0), upperArmL: r(-44, 0, 0), forearmL: r(-22, 0, 0),
      thighL: r(32, 0, 0), thighR: r(-20, 0, 0),
    }},
    { t: 0.68, pose: { pelvis: r(-5, 0, 0), chest: r(9, 0, 0), upperArmR: r(-28, 0, 10), forearmR: r(-24, 0, 0) } },
    { t: 0.82, pose: { pelvis: r(-3, 0, 0), chest: r(5, 0, 0), upperArmR: r(-28, 0, 8), forearmR: r(-28, 0, 0) } },
    { t: 1.00, pose: {} },
  ]),
});
