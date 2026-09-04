const D = Math.PI / 180;
const r = (x = 0, y = 0, z = 0) => [x * D, y * D, z * D];

function clip(id, active, keyframes) {
  return Object.freeze({ id, active: Object.freeze(active), keyframes: Object.freeze(keyframes) });
}

export const MOTION_CLIPS = Object.freeze({
  light1: clip('light1', [0.333, 0.571], [
    { t: 0.00, pose: {} },
    { t: 0.22, pose: {
      pelvis: r(2, -13, 1), spine: r(-2, -10, -1), chest: r(-4, -18, -3),
      shoulderR: r(-8, -4, -9), upperArmR: r(-42, -10, -48), forearmR: r(-46, 4, -8), handR: r(3, 0, -14),
      shoulderL: r(-5, 5, 6), upperArmL: r(-28, 8, 24), forearmL: r(-64, 0, -8),
      thighL: r(-12, 0, 2), thighR: r(10, 0, -2),
      swordGrip: r(4, 0, -18),
    }},
    { t: 0.46, pose: {
      pelvis: r(-4, 18, -2), spine: r(2, 15, 2), chest: r(3, 28, 5),
      shoulderR: r(-14, 8, 6), upperArmR: r(-64, 18, 46), forearmR: r(-18, -5, 5), handR: r(-4, 0, 12),
      shoulderL: r(-7, -4, -6), upperArmL: r(-36, -8, -18), forearmL: r(-54, 0, 8),
      thighL: r(17, 0, 2), shinL: r(8, 0, 0), thighR: r(-10, 0, -2),
      swordGrip: r(-3, 0, 10),
    }},
    { t: 0.72, pose: {
      pelvis: r(-2, 12, -1), spine: r(1, 12, 1), chest: r(2, 21, 4),
      shoulderR: r(-8, 6, 8), upperArmR: r(-46, 12, 62), forearmR: r(-28, 0, 8),
      thighL: r(9, 0, 1), thighR: r(-5, 0, -1),
    }},
    { t: 1.00, pose: {} },
  ]),

  light2: clip('light2', [0.326, 0.587], [
    { t: 0.00, pose: { chest: r(0, 18, 2), upperArmR: r(-44, 10, 52), forearmR: r(-32, 0, 6) } },
    { t: 0.24, pose: {
      pelvis: r(1, 14, 0), spine: r(0, 12, 0), chest: r(-2, 24, 2),
      upperArmR: r(-52, 12, 58), forearmR: r(-36, 0, 8), handR: r(0, 0, 14),
    }},
    { t: 0.48, pose: {
      pelvis: r(-3, -20, 1), spine: r(1, -17, 0), chest: r(3, -30, -4),
      upperArmR: r(-62, -18, -48), forearmR: r(-20, 3, -6), handR: r(-3, 0, -10),
      upperArmL: r(-30, 6, 18), forearmL: r(-58, 0, -6),
    }},
    { t: 0.76, pose: { chest: r(1, -18, -3), upperArmR: r(-48, -12, -58), forearmR: r(-30, 0, -8) } },
    { t: 1.00, pose: {} },
  ]),

  light3: clip('light3', [0.321, 0.589], [
    { t: 0.00, pose: {} },
    { t: 0.24, pose: {
      pelvis: r(3, -10, 0), spine: r(-6, -8, 0), chest: r(-10, -14, 0),
      upperArmR: r(-112, 6, -22), forearmR: r(-48, 0, -8), upperArmL: r(-82, -6, 18), forearmL: r(-72, 0, 5),
      swordGrip: r(0, 0, -8),
    }},
    { t: 0.48, pose: {
      pelvis: r(-8, 22, -2), spine: r(8, 18, 2), chest: r(13, 32, 4),
      upperArmR: r(-58, 10, 52), forearmR: r(-16, 0, 6), handR: r(-5, 0, 10),
      thighL: r(24, 0, 2), shinL: r(12, 0, 0), thighR: r(-14, 0, -2),
    }},
    { t: 0.72, pose: { pelvis: r(-3, 15, 0), chest: r(4, 20, 2), upperArmR: r(-42, 6, 66), forearmR: r(-28, 0, 9) } },
    { t: 1.00, pose: {} },
  ]),

  heavy: clip('heavy', [0.397, 0.590], [
    { t: 0.00, pose: {} },
    { t: 0.32, pose: {
      pelvis: r(8, -5, 0), spine: r(-10, -4, 0), chest: r(-15, -6, 0),
      shoulderR: r(-14, 0, -8), upperArmR: r(-132, 0, -14), forearmR: r(-66, 0, 0),
      shoulderL: r(-12, 0, 7), upperArmL: r(-112, 0, 18), forearmL: r(-72, 0, 0),
      swordGrip: r(-5, 0, 0),
    }},
    { t: 0.51, pose: {
      pelvis: r(-10, 8, 0), spine: r(12, 8, 0), chest: r(18, 12, 0),
      upperArmR: r(-52, 4, 12), forearmR: r(-20, 0, 0), upperArmL: r(-54, -4, -8), forearmL: r(-36, 0, 0),
      thighL: r(20, 0, 0), shinL: r(10, 0, 0), thighR: r(-12, 0, 0),
    }},
    { t: 0.74, pose: { chest: r(8, 10, 0), upperArmR: r(-34, 4, 28), forearmR: r(-26, 0, 4) } },
    { t: 1.00, pose: {} },
  ]),

  skill_u: clip('skill_u', [0.260, 0.540], [
    { t: 0.00, pose: {} },
    { t: 0.20, pose: { pelvis: r(6, -14, 0), chest: r(-7, -22, -3), upperArmR: r(-50, -8, -62), forearmR: r(-30, 0, -8) } },
    { t: 0.44, pose: { pelvis: r(-6, 24, 0), chest: r(8, 38, 5), upperArmR: r(-58, 15, 58), forearmR: r(-16, 0, 4), thighL: r(26, 0, 3), thighR: r(-18, 0, -3) } },
    { t: 0.70, pose: { chest: r(2, 20, 2), upperArmR: r(-42, 8, 70), forearmR: r(-26, 0, 8) } },
    { t: 1.00, pose: {} },
  ]),

  skill_i: clip('skill_i', [0.333, 0.639], [
    { t: 0.00, pose: {} },
    { t: 0.25, pose: { pelvis: r(0, -12, 0), chest: r(-2, -32, 0), upperArmR: r(-58, -18, -66), forearmR: r(-42, 0, -8) } },
    { t: 0.48, pose: { pelvis: r(-4, 12, 0), chest: r(4, 42, 3), upperArmR: r(-58, 18, 48), forearmR: r(-24, 0, 4), upperArmL: r(-42, -12, -24) } },
    { t: 0.67, pose: { pelvis: r(2, -14, 0), chest: r(2, -30, -3), upperArmR: r(-46, -12, -70), forearmR: r(-30, 0, -6) } },
    { t: 1.00, pose: {} },
  ]),

  skill_o: clip('skill_o', [0.373, 0.598], [
    { t: 0.00, pose: {} },
    { t: 0.30, pose: {
      pelvis: r(9, 0, 0), spine: r(-12, 0, 0), chest: r(-18, 0, 0),
      upperArmR: r(-126, 0, -16), forearmR: r(-58, 0, 0), upperArmL: r(-102, 0, 16), forearmL: r(-66, 0, 0),
      thighL: r(-8, 0, 0), thighR: r(9, 0, 0),
    }},
    { t: 0.48, pose: {
      pelvis: r(-12, 14, 0), spine: r(14, 12, 0), chest: r(20, 18, 0),
      upperArmR: r(-46, 8, 20), forearmR: r(-18, 0, 0), upperArmL: r(-50, -5, -10), forearmL: r(-30, 0, 0),
      thighL: r(30, 0, 0), shinL: r(14, 0, 0), thighR: r(-18, 0, 0),
    }},
    { t: 0.64, pose: { pelvis: r(-4, 10, 0), chest: r(8, 14, 0), upperArmR: r(-30, 6, 38), forearmR: r(-24, 0, 4) } },
    { t: 0.80, pose: { pelvis: r(-2, 6, 0), chest: r(4, 8, 0), upperArmR: r(-28, 4, 28), forearmR: r(-30, 0, 4) } },
    { t: 1.00, pose: {} },
  ]),

  ai_thrust: clip('ai_thrust', [0.320, 0.580], [
    { t: 0.00, pose: {} },
    { t: 0.22, pose: { pelvis: r(2, 0, 0), chest: r(-3, 0, 0), upperArmR: r(-74, 0, -8), forearmR: r(-54, 0, 0), upperArmL: r(-58, 0, 10), forearmL: r(-64, 0, 0) } },
    { t: 0.46, pose: { pelvis: r(-6, 0, 0), chest: r(8, 0, 0), upperArmR: r(-88, 0, 0), forearmR: r(-6, 0, 0), upperArmL: r(-72, 0, 4), forearmL: r(-20, 0, 0), thighL: r(24, 0, 0), thighR: r(-14, 0, 0) } },
    { t: 0.72, pose: { chest: r(2, 0, 0), upperArmR: r(-68, 0, 4), forearmR: r(-22, 0, 0) } },
    { t: 1.00, pose: {} },
  ]),

  ai_heavy: clip('ai_heavy', [0.395, 0.632], [
    { t: 0.00, pose: {} },
    { t: 0.32, pose: { pelvis: r(6, 0, 0), chest: r(-12, 0, 0), upperArmR: r(-124, 0, -8), forearmR: r(-62, 0, 0), upperArmL: r(-100, 0, 8), forearmL: r(-64, 0, 0) } },
    { t: 0.52, pose: { pelvis: r(-8, 0, 0), chest: r(14, 0, 0), upperArmR: r(-48, 0, 4), forearmR: r(-16, 0, 0), upperArmL: r(-52, 0, -2), forearmL: r(-34, 0, 0), thighL: r(20, 0, 0), thighR: r(-12, 0, 0) } },
    { t: 0.76, pose: { chest: r(6, 0, 0), upperArmR: r(-36, 0, 20), forearmR: r(-26, 0, 2) } },
    { t: 1.00, pose: {} },
  ]),
});

export const MOTION_ACTION_IDS = Object.freeze(Object.keys(MOTION_CLIPS));
