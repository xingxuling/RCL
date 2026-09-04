import { MOTION_CLIPS } from './motionClips.js';

const D = Math.PI / 180;
const r = (x = 0, y = 0, z = 0) => [x * D, y * D, z * D];

export const RIG_BONES = Object.freeze([
  'pelvis', 'spine', 'chest', 'head',
  'shoulderL', 'upperArmL', 'forearmL', 'handL',
  'shoulderR', 'upperArmR', 'forearmR', 'handR',
  'thighL', 'shinL', 'footL', 'thighR', 'shinR', 'footR', 'swordGrip',
]);

function clonePose(pose) {
  const out = {};
  for (const bone of RIG_BONES) out[bone] = [...(pose[bone] ?? [0, 0, 0])];
  out.bodyOffsetY = pose.bodyOffsetY ?? 0;
  out.swordGlow = pose.swordGlow ?? 0;
  out.guardFx = Boolean(pose.guardFx);
  return out;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function ease(t) {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

function mergeRotation(base, patch) {
  if (!patch) return [...base];
  return [
    patch[0] ?? base[0],
    patch[1] ?? base[1],
    patch[2] ?? base[2],
  ];
}

function applyPatch(base, patch) {
  const out = clonePose(base);
  for (const bone of RIG_BONES) {
    if (patch[bone]) out[bone] = mergeRotation(out[bone], patch[bone]);
  }
  if (typeof patch.bodyOffsetY === 'number') out.bodyOffsetY = patch.bodyOffsetY;
  if (typeof patch.swordGlow === 'number') out.swordGlow = patch.swordGlow;
  if (typeof patch.guardFx === 'boolean') out.guardFx = patch.guardFx;
  return out;
}

function interpolatePose(a, b, t) {
  const k = ease(t);
  const out = {};
  for (const bone of RIG_BONES) {
    const ar = a[bone] ?? [0, 0, 0];
    const br = b[bone] ?? ar;
    out[bone] = [lerp(ar[0], br[0], k), lerp(ar[1], br[1], k), lerp(ar[2], br[2], k)];
  }
  out.bodyOffsetY = lerp(a.bodyOffsetY ?? 0, b.bodyOffsetY ?? 0, k);
  out.swordGlow = lerp(a.swordGlow ?? 0, b.swordGlow ?? 0, k);
  out.guardFx = k < 0.5 ? Boolean(a.guardFx) : Boolean(b.guardFx);
  return out;
}

function basePose(enemy = false) {
  if (enemy) {
    return {
      pelvis: r(0, 0, 0), spine: r(-1, 0, 0), chest: r(-2, 0, 0), head: r(0, 0, 0),
      shoulderL: r(-3, 0, 3), upperArmL: r(-38, 0, 12), forearmL: r(-58, 0, -5), handL: r(0, 0, 0),
      shoulderR: r(-3, 0, -3), upperArmR: r(-40, 0, -12), forearmR: r(-58, 0, 5), handR: r(0, 0, 0),
      thighL: r(-2, 0, 1), shinL: r(4, 0, 0), footL: r(-2, 0, 0),
      thighR: r(2, 0, -1), shinR: r(4, 0, 0), footR: r(-2, 0, 0),
      swordGrip: r(-2, 0, 0), bodyOffsetY: 0, swordGlow: 0, guardFx: false,
    };
  }
  return {
    pelvis: r(0, -5, -1), spine: r(-1, 3, 0), chest: r(-2, 8, 2), head: r(0, -4, 0),
    shoulderL: r(-5, 2, 6), upperArmL: r(-32, 5, 18), forearmL: r(-62, 0, -6), handL: r(0, 0, 0),
    shoulderR: r(-5, -2, -5), upperArmR: r(-46, -6, -20), forearmR: r(-56, 0, 8), handR: r(0, 0, -4),
    thighL: r(-4, 0, 2), shinL: r(7, 0, 0), footL: r(-3, 0, 0),
    thighR: r(4, 0, -2), shinR: r(7, 0, 0), footR: r(-3, 0, 0),
    swordGrip: r(0, 0, -3), bodyOffsetY: 0, swordGlow: 0, guardFx: false,
  };
}

function sampleClip(clip, normalizedTime, base) {
  if (!clip?.keyframes?.length) return clonePose(base);
  const t = Math.max(0, Math.min(1, normalizedTime));
  let left = clip.keyframes[0];
  let right = clip.keyframes[clip.keyframes.length - 1];
  for (let i = 0; i < clip.keyframes.length - 1; i += 1) {
    const a = clip.keyframes[i];
    const b = clip.keyframes[i + 1];
    if (t >= a.t && t <= b.t) {
      left = a;
      right = b;
      break;
    }
  }
  const span = Math.max(1e-6, right.t - left.t);
  const localT = Math.max(0, Math.min(1, (t - left.t) / span));
  return interpolatePose(applyPatch(base, left.pose), applyPatch(base, right.pose), localT);
}

function applyLocomotion(pose, logic, elapsed, enemy) {
  if (!logic.grounded) {
    pose.bodyOffsetY = -0.04;
    pose.thighL = r(-26, 0, 3);
    pose.thighR = r(-20, 0, -3);
    pose.shinL = r(34, 0, 0);
    pose.shinR = r(28, 0, 0);
    return pose;
  }

  const magnitude = Math.max(0, Math.min(1, logic.moveMagnitude || 0));
  if (magnitude <= 0.02) {
    const breath = Math.sin(elapsed * 2.15);
    pose.spine[0] += breath * 0.006;
    pose.chest[0] += breath * 0.01;
    pose.chest[2] += Math.sin(elapsed * 1.65 + 0.4) * 0.006;
    pose.head[1] += Math.sin(elapsed * 0.8) * 0.01;
    pose.swordGrip[2] += Math.sin(elapsed * 1.7) * 0.012;
    return pose;
  }

  const phase = elapsed * (enemy ? 7.6 : 8.2);
  const intent = logic.moveIntent || 'forward';
  const stride = Math.sin(phase) * magnitude;
  const plant = Math.sin(phase * 2) * 0.5 + 0.5;
  const strideScale = intent === 'strafe' ? 0.38 : intent === 'retreat' ? -0.72 : 0.82;
  const leg = stride * strideScale;

  pose.pelvis[0] += Math.abs(Math.sin(phase)) * 0.035 * magnitude;
  pose.pelvis[2] += (intent === 'strafe' ? Math.sin(phase) * 0.055 : 0);
  pose.chest[2] -= pose.pelvis[2] * 0.55;
  pose.thighL[0] += leg;
  pose.thighR[0] -= leg;
  pose.shinL[0] += Math.max(0, -leg) * 0.8;
  pose.shinR[0] += Math.max(0, leg) * 0.8;
  pose.footL[0] -= Math.max(0, leg) * 0.25;
  pose.footR[0] -= Math.max(0, -leg) * 0.25;
  pose.bodyOffsetY = -0.025 * Math.abs(Math.sin(phase * 2)) * magnitude;

  if (plant < 0.18) {
    pose.footL[0] *= 0.35;
    pose.shinL[0] *= 0.7;
  } else if (plant > 0.82) {
    pose.footR[0] *= 0.35;
    pose.shinR[0] *= 0.7;
  }

  return pose;
}

function guardPose(enemy = false) {
  return {
    pelvis: r(2, enemy ? 0 : -4, 0), spine: r(-3, enemy ? 0 : 3, 0), chest: r(-5, enemy ? 0 : 6, 0),
    shoulderR: r(-12, -2, -12), upperArmR: r(-82, -5, -34), forearmR: r(-82, 0, 20), handR: r(2, 0, -8),
    shoulderL: r(-10, 3, 11), upperArmL: r(-72, 8, 34), forearmL: r(-86, 0, -18), handL: r(0, 0, 6),
    swordGrip: r(4, 0, -10), guardFx: true,
  };
}

function hitPose(enemy, heavy) {
  const side = enemy ? -1 : 1;
  return heavy ? {
    pelvis: r(-10, 8 * side, 4 * side), spine: r(12, 14 * side, -4 * side), chest: r(18, 24 * side, -8 * side), head: r(10, 18 * side, -7 * side),
    upperArmR: r(-8, 12 * side, 34 * side), forearmR: r(-18, 0, 10 * side), upperArmL: r(12, -8 * side, -30 * side), forearmL: r(-12, 0, -8 * side),
  } : {
    pelvis: r(-3, 4 * side, 1 * side), spine: r(5, 8 * side, -2 * side), chest: r(8, 14 * side, -4 * side), head: r(4, 10 * side, -3 * side),
    upperArmR: r(-20, 5 * side, 18 * side), upperArmL: r(-16, -4 * side, -15 * side),
  };
}

export function sampleFighterPose({ logic, elapsed = 0, enemy = false }) {
  const base = applyLocomotion(clonePose(basePose(enemy)), logic, elapsed, enemy);

  if (logic.guard) {
    const guarded = applyPatch(base, guardPose(enemy));
    guarded.swordGlow = 0.12;
    return guarded;
  }

  if (logic.hitstun > 0) {
    const heavy = logic.hitstun > 0.32 || logic.lastDamage > 80;
    const hit = applyPatch(base, hitPose(enemy, heavy));
    hit.swordGlow = 0.05;
    return hit;
  }

  if (logic.action === 'dash') {
    const dash = clonePose(base);
    dash.pelvis[0] -= 0.13;
    dash.spine[0] -= 0.08;
    dash.chest[0] -= 0.12;
    dash.upperArmR = r(-54, -6, -28);
    dash.forearmR = r(-42, 0, 8);
    dash.upperArmL = r(18, 6, 30);
    dash.forearmL = r(-20, 0, -4);
    dash.thighL = r(24, 0, 2);
    dash.thighR = r(-20, 0, -2);
    dash.bodyOffsetY = -0.05;
    dash.swordGlow = 0.2;
    return dash;
  }

  const clip = logic.action ? MOTION_CLIPS[logic.action] : null;
  if (clip) {
    const p = Math.max(0, Math.min(1, logic.actionTime / Math.max(0.001, logic.actionDuration || 1)));
    const pose = sampleClip(clip, p, base);
    const [a, b] = clip.active;
    pose.swordGlow = p >= a && p <= b ? (logic.action.startsWith('skill_') ? 1 : 0.4) : 0.08;
    return pose;
  }

  return base;
}
