const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export const STYLE_BEHAVIOR = Object.freeze({
  wanfeng: Object.freeze({
    locomotion: Object.freeze({
      forwardScale: 1.02,
      retreatScale: 1.00,
      strafeScale: 1.10,
      lateralCompression: 1.00,
      approachOrbit: 0.20,
      guardOrbit: 0.08,
    }),
    combo: Object.freeze({
      queueFrom: 0.62,
      releaseAt: 0.84,
      bufferWindow: 0.28,
      resetWindow: 0.96,
    }),
    attackPath: Object.freeze({
      light1: 0.15,
      light2: -0.20,
      light3: 0.12,
      heavy: -0.08,
      skill_u: 0.24,
      skill_i: -0.31,
      skill_o: 0.18,
    }),
    guard: Object.freeze({ stanceYawDeg: 13, bladeYawDeg: -16, openLine: 1 }),
  }),
  kendo: Object.freeze({
    locomotion: Object.freeze({
      forwardScale: 1.00,
      retreatScale: 0.93,
      strafeScale: 0.78,
      lateralCompression: 0.56,
      approachOrbit: 0.00,
      guardOrbit: 0.00,
    }),
    combo: Object.freeze({
      queueFrom: 0.84,
      releaseAt: 0.98,
      bufferWindow: 0.12,
      resetWindow: 0.58,
    }),
    attackPath: Object.freeze({
      kendo_light1: 0,
      kendo_light2: 0,
      kendo_light3: 0,
      kendo_heavy: 0,
      kendo_skill_u: 0,
      kendo_skill_i: 0,
      kendo_skill_o: 0,
      ai_thrust: 0,
      ai_heavy: 0,
    }),
    guard: Object.freeze({ stanceYawDeg: 0, bladeYawDeg: 0, openLine: 0 }),
  }),
});

export function getStyleBehavior(styleId = 'wanfeng') {
  return STYLE_BEHAVIOR[styleId] ?? STYLE_BEHAVIOR.wanfeng;
}

export function shapeMovement(styleId, {
  forward = 0,
  lateral = 0,
  flowSide = 1,
  guarding = false,
} = {}) {
  const behavior = getStyleBehavior(styleId);
  const locomotion = behavior.locomotion;
  let shapedForward = forward;
  let shapedLateral = lateral;

  if (styleId === 'wanfeng') {
    const noDeliberateStrafe = Math.abs(lateral) < 0.18;
    if (forward > 0.18 && noDeliberateStrafe) {
      shapedLateral += locomotion.approachOrbit * (flowSide >= 0 ? 1 : -1) * forward;
    }
    if (guarding && Math.abs(shapedLateral) < 0.12) {
      shapedLateral += locomotion.guardOrbit * (flowSide >= 0 ? 1 : -1);
    }
  } else if (styleId === 'kendo') {
    shapedLateral *= forward > 0.05 ? locomotion.lateralCompression : locomotion.strafeScale;
    if (Math.abs(shapedForward) < 0.08 && Math.abs(shapedLateral) < 0.12) shapedLateral = 0;
  }

  shapedForward = clamp(shapedForward, -1, 1);
  shapedLateral = clamp(shapedLateral, -1, 1);
  const magnitude = Math.hypot(shapedForward, shapedLateral);
  if (magnitude > 1) {
    shapedForward /= magnitude;
    shapedLateral /= magnitude;
  }

  const speedScale = shapedForward < -0.05
    ? locomotion.retreatScale
    : Math.abs(shapedLateral) > Math.abs(shapedForward) * 0.72
      ? locomotion.strafeScale
      : locomotion.forwardScale;

  return Object.freeze({
    forward: shapedForward,
    lateral: shapedLateral,
    speedScale,
  });
}

export function attackLateralFactor(styleId, attackId, flowSide = 1, normalizedTime = 0.5) {
  const behavior = getStyleBehavior(styleId);
  const base = behavior.attackPath[attackId] ?? 0;
  if (!base) return 0;
  const t = clamp(normalizedTime, 0, 1);
  const envelope = Math.sin(Math.PI * t);
  return base * (flowSide >= 0 ? 1 : -1) * envelope;
}

export function comboPolicy(styleId = 'wanfeng') {
  return getStyleBehavior(styleId).combo;
}

export function canQueueCombo(styleId, normalizedTime) {
  return normalizedTime >= comboPolicy(styleId).queueFrom;
}

export function shouldReleaseQueuedCombo(styleId, normalizedTime) {
  return normalizedTime >= comboPolicy(styleId).releaseAt;
}

export function nextFlowSide(styleId, current = 1, attackId = '') {
  if (styleId !== 'wanfeng') return 1;
  if (attackId.startsWith('light') || attackId.startsWith('skill_')) return current >= 0 ? -1 : 1;
  return current >= 0 ? 1 : -1;
}
