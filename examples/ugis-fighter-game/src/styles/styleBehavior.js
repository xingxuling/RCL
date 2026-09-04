const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const profile = ({ locomotion, combo, attackPath, guard, flowAlternates = false }) => Object.freeze({
  locomotion:Object.freeze(locomotion), combo:Object.freeze(combo), attackPath:Object.freeze(attackPath),
  guard:Object.freeze(guard), flowAlternates,
});

export const STYLE_BEHAVIOR = Object.freeze({
  wanfeng: profile({
    locomotion:{ forwardScale:1.02, retreatScale:1.00, strafeScale:1.10, lateralCompression:1.00, approachOrbit:.20, guardOrbit:.08 },
    combo:{ queueFrom:.62, releaseAt:.84, bufferWindow:.28, resetWindow:.96 },
    attackPath:{ light1:.15, light2:-.20, light3:.12, heavy:-.08, skill_u:.24, skill_i:-.31, skill_o:.18 },
    guard:{ stanceYawDeg:13, bladeYawDeg:-16, openLine:1 }, flowAlternates:true,
  }),
  kendo: profile({
    locomotion:{ forwardScale:1.00, retreatScale:.93, strafeScale:.78, lateralCompression:.56, approachOrbit:0, guardOrbit:0 },
    combo:{ queueFrom:.84, releaseAt:.98, bufferWindow:.12, resetWindow:.58 },
    attackPath:{ kendo_light1:0,kendo_light2:0,kendo_light3:0,kendo_heavy:0,kendo_skill_u:0,kendo_skill_i:0,kendo_skill_o:0,ai_thrust:0,ai_heavy:0 },
    guard:{ stanceYawDeg:0, bladeYawDeg:0, openLine:0 },
  }),
  epee: profile({
    locomotion:{ forwardScale:1.08, retreatScale:1.06, strafeScale:.92, lateralCompression:.82, approachOrbit:0, guardOrbit:0 },
    combo:{ queueFrom:.70, releaseAt:.90, bufferWindow:.22, resetWindow:.76 },
    attackPath:{ epee_light1:0,epee_light2:0,epee_light3:0,epee_heavy:0,epee_skill_u:0,epee_skill_i:0,epee_skill_o:0 },
    guard:{ stanceYawDeg:-22, bladeYawDeg:2, openLine:.25 },
  }),
  destreza: profile({
    locomotion:{ forwardScale:.98, retreatScale:1.00, strafeScale:1.08, lateralCompression:.96, approachOrbit:.28, guardOrbit:.12 },
    combo:{ queueFrom:.68, releaseAt:.89, bufferWindow:.25, resetWindow:.88 },
    attackPath:{ destreza_light1:.14,destreza_light2:-.18,destreza_light3:.20,destreza_heavy:-.12,destreza_skill_u:.26,destreza_skill_i:-.24,destreza_skill_o:.18 },
    guard:{ stanceYawDeg:24, bladeYawDeg:-10, openLine:.85 }, flowAlternates:true,
  }),
  liechtenauer: profile({
    locomotion:{ forwardScale:.99, retreatScale:.91, strafeScale:.82, lateralCompression:.76, approachOrbit:.05, guardOrbit:.02 },
    combo:{ queueFrom:.76, releaseAt:.94, bufferWindow:.18, resetWindow:.72 },
    attackPath:{ liech_light1:.06,liech_light2:-.07,liech_light3:.05,liech_heavy:0,liech_skill_u:.08,liech_skill_i:-.08,liech_skill_o:0 },
    guard:{ stanceYawDeg:7, bladeYawDeg:-5, openLine:.35 }, flowAlternates:true,
  }),
  fiore: profile({
    locomotion:{ forwardScale:.95, retreatScale:.88, strafeScale:.74, lateralCompression:.72, approachOrbit:.04, guardOrbit:.03 },
    combo:{ queueFrom:.80, releaseAt:.95, bufferWindow:.17, resetWindow:.70 },
    attackPath:{ fiore_light1:-.05,fiore_light2:.04,fiore_light3:-.06,fiore_heavy:0,fiore_skill_u:.05,fiore_skill_i:-.05,fiore_skill_o:0 },
    guard:{ stanceYawDeg:10, bladeYawDeg:8, openLine:.45 }, flowAlternates:true,
  }),
  miaodao: profile({
    locomotion:{ forwardScale:.93, retreatScale:.86, strafeScale:.70, lateralCompression:.68, approachOrbit:0, guardOrbit:0 },
    combo:{ queueFrom:.82, releaseAt:.97, bufferWindow:.14, resetWindow:.64 },
    attackPath:{ miaodao_light1:.04,miaodao_light2:-.05,miaodao_light3:.04,miaodao_heavy:0,miaodao_skill_u:.03,miaodao_skill_i:-.06,miaodao_skill_o:0 },
    guard:{ stanceYawDeg:5, bladeYawDeg:-4, openLine:.20 }, flowAlternates:true,
  }),
});

export function getStyleBehavior(styleId = 'wanfeng') {
  return STYLE_BEHAVIOR[styleId] ?? STYLE_BEHAVIOR.wanfeng;
}

export function shapeMovement(styleId, { forward = 0, lateral = 0, flowSide = 1, guarding = false } = {}) {
  const locomotion = getStyleBehavior(styleId).locomotion;
  let shapedForward = forward;
  let shapedLateral = lateral;
  const side = flowSide >= 0 ? 1 : -1;
  const noDeliberateStrafe = Math.abs(lateral) < .18;

  if (forward > .18 && noDeliberateStrafe && locomotion.approachOrbit) {
    shapedLateral += locomotion.approachOrbit * side * forward;
  }
  if (guarding && Math.abs(shapedLateral) < .12 && locomotion.guardOrbit) {
    shapedLateral += locomotion.guardOrbit * side;
  }
  if (Math.abs(shapedLateral) > 0) {
    shapedLateral *= forward > .05 ? locomotion.lateralCompression : 1;
  }
  if (Math.abs(shapedForward) < .08 && Math.abs(shapedLateral) < .08) shapedLateral = 0;

  shapedForward = clamp(shapedForward, -1, 1);
  shapedLateral = clamp(shapedLateral, -1, 1);
  const magnitude = Math.hypot(shapedForward, shapedLateral);
  if (magnitude > 1) {
    shapedForward /= magnitude;
    shapedLateral /= magnitude;
  }

  const speedScale = shapedForward < -.05
    ? locomotion.retreatScale
    : Math.abs(shapedLateral) > Math.abs(shapedForward) * .72
      ? locomotion.strafeScale
      : locomotion.forwardScale;

  return Object.freeze({ forward:shapedForward, lateral:shapedLateral, speedScale });
}

export function attackLateralFactor(styleId, attackId, flowSide = 1, normalizedTime = .5) {
  const base = getStyleBehavior(styleId).attackPath[attackId] ?? 0;
  if (!base) return 0;
  const t = clamp(normalizedTime, 0, 1);
  return base * (flowSide >= 0 ? 1 : -1) * Math.sin(Math.PI * t);
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
  const behavior = getStyleBehavior(styleId);
  if (!behavior.flowAlternates) return 1;
  if (!attackId) return current >= 0 ? -1 : 1;
  return current >= 0 ? -1 : 1;
}
