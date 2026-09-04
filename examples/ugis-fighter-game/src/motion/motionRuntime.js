import { AUTHORED_ACTION_CLIPS } from './authoredActionSets.js';
import { MOTION_CLIPS } from './motionClips.js';
import { KENDO_MOTION_CLIPS } from './kendoMotionClips.js';

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
  out.bodyOffsetX = pose.bodyOffsetX ?? 0;
  out.bodyOffsetY = pose.bodyOffsetY ?? 0;
  out.bodyOffsetZ = pose.bodyOffsetZ ?? 0;
  out.visualYaw = pose.visualYaw ?? 0;
  out.swordGlow = pose.swordGlow ?? 0;
  out.guardFx = Boolean(pose.guardFx);
  out.weaponMode = pose.weaponMode ?? null;
  out.actionFamily = pose.actionFamily ?? null;
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
  return [patch[0] ?? base[0], patch[1] ?? base[1], patch[2] ?? base[2]];
}

function applyPatch(base, patch) {
  const out = clonePose(base);
  for (const bone of RIG_BONES) {
    if (patch[bone]) out[bone] = mergeRotation(out[bone], patch[bone]);
  }
  for (const key of ['bodyOffsetX', 'bodyOffsetY', 'bodyOffsetZ', 'visualYaw', 'swordGlow']) {
    if (typeof patch[key] === 'number') out[key] = patch[key];
  }
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
  out.bodyOffsetX = lerp(a.bodyOffsetX ?? 0, b.bodyOffsetX ?? 0, k);
  out.bodyOffsetY = lerp(a.bodyOffsetY ?? 0, b.bodyOffsetY ?? 0, k);
  out.bodyOffsetZ = lerp(a.bodyOffsetZ ?? 0, b.bodyOffsetZ ?? 0, k);
  out.visualYaw = lerp(a.visualYaw ?? 0, b.visualYaw ?? 0, k);
  out.swordGlow = lerp(a.swordGlow ?? 0, b.swordGlow ?? 0, k);
  out.guardFx = k < 0.5 ? Boolean(a.guardFx) : Boolean(b.guardFx);
  out.weaponMode = k < 0.5 ? a.weaponMode : b.weaponMode;
  out.actionFamily = k < 0.5 ? a.actionFamily : b.actionFamily;
  return out;
}

function wanfengBasePose() {
  return {
    pelvis: r(0, -7, -2), spine: r(-1, 4, 0), chest: r(-2, 10, 3), head: r(0, -5, 0),
    shoulderL: r(-5, 3, 7), upperArmL: r(-31, 7, 20), forearmL: r(-62, 0, -6), handL: r(0, 0, 0),
    shoulderR: r(-5, -3, -6), upperArmR: r(-47, -7, -22), forearmR: r(-56, 0, 9), handR: r(0, 0, -5),
    thighL: r(-5, 0, 3), shinL: r(8, 0, 0), footL: r(-3, 0, 0),
    thighR: r(5, 0, -3), shinR: r(8, 0, 0), footR: r(-3, 0, 0),
    swordGrip: r(0, 0, -4), bodyOffsetX: 0, bodyOffsetY: 0, bodyOffsetZ: 0, visualYaw: 0,
    swordGlow: 0, guardFx: false, weaponMode: 'one-hand-flow', actionFamily: null,
  };
}

function kendoBasePose() {
  return {
    pelvis: r(0, 0, 0), spine: r(-2, 0, 0), chest: r(-3, 0, 0), head: r(0, 0, 0),
    shoulderL: r(-3, 0, 3), upperArmL: r(-46, 1, 15), forearmL: r(-70, 0, -7), handL: r(0, 0, 1),
    shoulderR: r(-3, 0, -3), upperArmR: r(-48, -1, -15), forearmR: r(-70, 0, 7), handR: r(0, 0, -1),
    thighL: r(-2, 0, 1), shinL: r(5, 0, 0), footL: r(-2, 0, 0),
    thighR: r(2, 0, -1), shinR: r(5, 0, 0), footR: r(-2, 0, 0),
    swordGrip: r(-3, 0, 0), bodyOffsetX: 0, bodyOffsetY: 0, bodyOffsetZ: 0, visualYaw: 0,
    swordGlow: 0, guardFx: false, weaponMode: 'two-hand-center', actionFamily: null,
  };
}

function basePose(styleId = 'wanfeng') {
  return styleId === 'kendo' ? kendoBasePose() : wanfengBasePose();
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
  const sampled = interpolatePose(applyPatch(base, left.pose), applyPatch(base, right.pose), localT);
  sampled.weaponMode = clip.weaponMode ?? sampled.weaponMode;
  sampled.actionFamily = clip.family ?? null;
  return sampled;
}

function applyWanFengLocomotion(pose, logic, elapsed, magnitude) {
  const phase = elapsed * 8.45;
  const intent = logic.moveIntent || 'forward';
  const stride = Math.sin(phase) * magnitude;
  const plant = Math.sin(phase * 2) * 0.5 + 0.5;
  const strideScale = intent === 'strafe' ? 0.48 : intent === 'retreat' ? -0.76 : 0.88;
  const leg = stride * strideScale;

  pose.pelvis[0] += Math.abs(Math.sin(phase)) * 0.042 * magnitude;
  pose.pelvis[1] += stride * (intent === 'strafe' ? 0.075 : 0.045);
  pose.pelvis[2] += (intent === 'strafe' ? Math.sin(phase) * 0.082 : Math.sin(phase) * 0.026) * magnitude;
  pose.chest[1] -= pose.pelvis[1] * 0.58;
  pose.chest[2] -= pose.pelvis[2] * 0.68;
  pose.head[1] += Math.sin(phase * 0.5) * 0.025;
  pose.thighL[0] += leg;
  pose.thighR[0] -= leg;
  pose.shinL[0] += Math.max(0, -leg) * 0.86;
  pose.shinR[0] += Math.max(0, leg) * 0.86;
  pose.footL[0] -= Math.max(0, leg) * 0.28;
  pose.footR[0] -= Math.max(0, -leg) * 0.28;
  pose.bodyOffsetY = -0.03 * Math.abs(Math.sin(phase * 2)) * magnitude;

  if (plant < 0.18) {
    pose.footL[0] *= 0.32;
    pose.shinL[0] *= 0.68;
  } else if (plant > 0.82) {
    pose.footR[0] *= 0.32;
    pose.shinR[0] *= 0.68;
  }
  return pose;
}

function applyKendoLocomotion(pose, logic, elapsed, magnitude) {
  const phase = elapsed * 7.15;
  const intent = logic.moveIntent || 'forward';
  const stride = Math.sin(phase) * magnitude;
  const plant = Math.sin(phase * 2) * 0.5 + 0.5;
  const strideScale = intent === 'strafe' ? 0.22 : intent === 'retreat' ? -0.58 : 0.69;
  const leg = stride * strideScale;

  pose.pelvis[0] += Math.abs(Math.sin(phase)) * 0.022 * magnitude;
  pose.pelvis[2] += (intent === 'strafe' ? Math.sin(phase) * 0.022 : 0);
  pose.chest[2] -= pose.pelvis[2] * 0.36;
  pose.thighL[0] += leg;
  pose.thighR[0] -= leg;
  pose.shinL[0] += Math.max(0, -leg) * 0.72;
  pose.shinR[0] += Math.max(0, leg) * 0.72;
  pose.footL[0] -= Math.max(0, leg) * 0.18;
  pose.footR[0] -= Math.max(0, -leg) * 0.18;
  pose.bodyOffsetY = -0.014 * Math.abs(Math.sin(phase * 2)) * magnitude;

  if (plant < 0.16) {
    pose.footL[0] *= 0.42;
    pose.shinL[0] *= 0.78;
  } else if (plant > 0.84) {
    pose.footR[0] *= 0.42;
    pose.shinR[0] *= 0.78;
  }
  return pose;
}

function applyLocomotion(pose, logic, elapsed, styleId) {
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
    const breath = Math.sin(elapsed * (styleId === 'kendo' ? 1.72 : 2.15));
    pose.spine[0] += breath * (styleId === 'kendo' ? 0.003 : 0.006);
    pose.chest[0] += breath * (styleId === 'kendo' ? 0.005 : 0.01);
    pose.chest[2] += Math.sin(elapsed * 1.65 + 0.4) * (styleId === 'kendo' ? 0.002 : 0.006);
    pose.head[1] += Math.sin(elapsed * 0.8) * (styleId === 'kendo' ? 0.003 : 0.01);
    pose.swordGrip[2] += Math.sin(elapsed * 1.7) * (styleId === 'kendo' ? 0.003 : 0.012);
    return pose;
  }

  return styleId === 'kendo'
    ? applyKendoLocomotion(pose, logic, elapsed, magnitude)
    : applyWanFengLocomotion(pose, logic, elapsed, magnitude);
}

function wanfengGuardPose() {
  return {
    pelvis: r(2, -12, -2), spine: r(-3, 6, 1), chest: r(-5, 14, 4), visualYaw: -0.14,
    shoulderR: r(-12, -3, -14), upperArmR: r(-80, -8, -38), forearmR: r(-80, 0, 22), handR: r(2, 0, -10),
    shoulderL: r(-10, 4, 12), upperArmL: r(-70, 10, 38), forearmL: r(-84, 0, -20), handL: r(0, 0, 7),
    swordGrip: r(4, -12, -12), guardFx: true,
  };
}

function kendoGuardPose() {
  return {
    pelvis: r(1, 0, 0), spine: r(-3, 0, 0), chest: r(-5, 0, 0), head: r(0, 0, 0), visualYaw: 0,
    shoulderR: r(-10, 0, -5), upperArmR: r(-76, 0, -18), forearmR: r(-92, 0, 28), handR: r(3, 0, -4),
    shoulderL: r(-10, 0, 5), upperArmL: r(-70, 0, 20), forearmL: r(-88, 0, -24), handL: r(2, 0, 4),
    swordGrip: r(2, 0, -2), guardFx: true,
  };
}

function guardPose(styleId) {
  return styleId === 'kendo' ? kendoGuardPose() : wanfengGuardPose();
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

export function sampleFighterPose({ logic, elapsed = 0, enemy = false, styleId }) {
  const resolvedStyleId = styleId ?? (enemy ? 'kendo' : 'wanfeng');
  const base = applyLocomotion(clonePose(basePose(resolvedStyleId)), logic, elapsed, resolvedStyleId);

  if (logic.guard) {
    const guarded = applyPatch(base, guardPose(resolvedStyleId));
    guarded.swordGlow = resolvedStyleId === 'kendo' ? 0.08 : 0.16;
    guarded.weaponMode = resolvedStyleId === 'kendo' ? 'two-hand-center' : 'one-hand-flow';
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
    if (resolvedStyleId === 'kendo') {
      dash.pelvis[0] -= 0.09;
      dash.spine[0] -= 0.04;
      dash.chest[0] -= 0.05;
      dash.upperArmR = r(-58, 0, -12);
      dash.forearmR = r(-62, 0, 10);
      dash.upperArmL = r(-48, 0, 12);
      dash.forearmL = r(-64, 0, -10);
      dash.thighL = r(18, 0, 1);
      dash.thighR = r(-15, 0, -1);
      dash.bodyOffsetY = -0.035;
      dash.swordGlow = 0.12;
      dash.weaponMode = 'two-hand-center';
    } else {
      dash.pelvis[0] -= 0.13;
      dash.pelvis[1] += 0.07 * (logic.flowSide || 1);
      dash.spine[0] -= 0.08;
      dash.chest[0] -= 0.12;
      dash.chest[1] -= 0.06 * (logic.flowSide || 1);
      dash.upperArmR = r(-54, -6, -28);
      dash.forearmR = r(-42, 0, 8);
      dash.upperArmL = r(18, 6, 30);
      dash.forearmL = r(-20, 0, -4);
      dash.thighL = r(24, 0, 2);
      dash.thighR = r(-20, 0, -2);
      dash.bodyOffsetY = -0.05;
      dash.visualYaw = 0.14 * (logic.flowSide || 1);
      dash.swordGlow = 0.22;
      dash.weaponMode = 'one-hand-flow';
    }
    return dash;
  }

  const clip = logic.action
    ? (AUTHORED_ACTION_CLIPS[logic.action] ?? MOTION_CLIPS[logic.action] ?? KENDO_MOTION_CLIPS[logic.action])
    : null;
  if (clip) {
    const p = Math.max(0, Math.min(1, logic.actionTime / Math.max(0.001, logic.actionDuration || 1)));
    const pose = sampleClip(clip, p, base);
    const [a, b] = clip.active;
    const isSkill = logic.action.startsWith('skill_') || logic.action.startsWith('kendo_skill_');
    pose.swordGlow = p >= a && p <= b ? (isSkill ? 1 : 0.5) : 0.08;
    return pose;
  }

  return base;
}
