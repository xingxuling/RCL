export const UGIS_ROUTES = Object.freeze([
  'hold_measure',
  'take_line',
  'intercept_route',
  'contact_control',
  'enter_close',
  'close_resolution',
  'disengage_reentry',
  'recover_axis',
  'regenerate_route',
  'change_rhythm',
  'flow_route',
]);

export const ROUTE_LABELS = Object.freeze({
  hold_measure: '守间合',
  take_line: '取线进位',
  intercept_route: '截路',
  contact_control: '接触控线',
  enter_close: '压缩入近域',
  close_resolution: '近域收束',
  disengage_reentry: '脱线再入',
  recover_axis: '归轴复位',
  regenerate_route: '断处生路',
  change_rhythm: '换节奏',
  flow_route: '流路连续',
});

export const ATTACKS = Object.freeze({
  light1: {
    id: 'light1', label: '风切·一', duration: 0.42, activeStart: 0.14, activeEnd: 0.24,
    damage: 48, range: 1.72, arcDeg: 95, knockback: 0.34, hitstun: 0.24,
    move: 0.24, energyCost: 0, energyGain: 8, hitstop: 0.055, routeIntent: 'take_line',
  },
  light2: {
    id: 'light2', label: '风切·二', duration: 0.46, activeStart: 0.15, activeEnd: 0.27,
    damage: 54, range: 1.78, arcDeg: 105, knockback: 0.38, hitstun: 0.26,
    move: 0.28, energyCost: 0, energyGain: 9, hitstop: 0.06, routeIntent: 'flow_route',
  },
  light3: {
    id: 'light3', label: '风切·三', duration: 0.56, activeStart: 0.18, activeEnd: 0.33,
    damage: 72, range: 1.88, arcDeg: 120, knockback: 0.62, hitstun: 0.34,
    move: 0.32, energyCost: 0, energyGain: 12, hitstop: 0.075, routeIntent: 'close_resolution',
  },
  heavy: {
    id: 'heavy', label: '破势重斩', duration: 0.78, activeStart: 0.31, activeEnd: 0.46,
    damage: 108, range: 2.02, arcDeg: 105, knockback: 0.92, hitstun: 0.48,
    move: 0.18, energyCost: 0, energyGain: 14, hitstop: 0.095, routeIntent: 'contact_control',
  },
  skill_u: {
    id: 'skill_u', label: '风吹皆动', duration: 0.5, activeStart: 0.13, activeEnd: 0.27,
    damage: 82, range: 2.18, arcDeg: 90, knockback: 0.5, hitstun: 0.34,
    move: 0.52, energyCost: 18, energyGain: 0, hitstop: 0.08, routeIntent: 'intercept_route',
  },
  skill_i: {
    id: 'skill_i', label: '万风皆引', duration: 0.72, activeStart: 0.24, activeEnd: 0.46,
    damage: 112, range: 2.28, arcDeg: 150, knockback: 0.78, hitstun: 0.45,
    move: 0.4, energyCost: 30, energyGain: 0, hitstop: 0.11, routeIntent: 'contact_control',
  },
  skill_o: {
    id: 'skill_o', label: '暴风终无声', duration: 1.02, activeStart: 0.38, activeEnd: 0.61,
    damage: 182, range: 2.72, arcDeg: 120, knockback: 1.34, hitstun: 0.72,
    move: 0.86, energyCost: 68, energyGain: 0, hitstop: 0.16, routeIntent: 'close_resolution',
  },
  ai_thrust: {
    id: 'ai_thrust', label: '取线突进', duration: 0.5, activeStart: 0.16, activeEnd: 0.29,
    damage: 58, range: 2.0, arcDeg: 70, knockback: 0.42, hitstun: 0.28,
    move: 0.42, energyCost: 0, energyGain: 8, hitstop: 0.06, routeIntent: 'take_line',
  },
  ai_heavy: {
    id: 'ai_heavy', label: '近域重斩', duration: 0.76, activeStart: 0.3, activeEnd: 0.48,
    damage: 96, range: 1.98, arcDeg: 110, knockback: 0.86, hitstun: 0.46,
    move: 0.2, energyCost: 0, energyGain: 10, hitstop: 0.09, routeIntent: 'close_resolution',
  },
});

export const GAME_LIMITS = Object.freeze({
  maxHp: 1000,
  maxEnergy: 100,
  moveSpeed: 3.6,
  strafeSpeed: 3.15,
  dashDistance: 1.42,
  dashDuration: 0.18,
  dashCooldown: 0.5,
  jumpVelocity: 5.2,
  gravity: 13.5,
  arenaRadius: 6.25,
  minSeparation: 0.78,
  guardDamageScale: 0.18,
  guardKnockbackScale: 0.28,
  guardEnergyGain: 5,
});

export function createFighterLogic(role = 'player') {
  return {
    role,
    hp: GAME_LIMITS.maxHp,
    energy: role === 'player' ? 45 : 30,
    action: null,
    actionTime: 0,
    actionHit: false,
    actionDirX: 0,
    actionDirZ: 1,
    guard: false,
    hitstun: 0,
    invuln: 0,
    dashCooldown: 0,
    verticalVelocity: 0,
    grounded: true,
    comboStep: 0,
    comboTimer: 0,
    flash: 0,
    route: role === 'player' ? 'flow_route' : 'hold_measure',
    routeLabel: role === 'player' ? ROUTE_LABELS.flow_route : ROUTE_LABELS.hold_measure,
    lastDamage: 0,
    lastActionLabel: '待机',
    moveMagnitude: 0,
  };
}

export function attackCanStart(fighter, attackId) {
  const attack = ATTACKS[attackId];
  if (!attack) return false;
  if (fighter.hitstun > 0 || fighter.action) return false;
  return fighter.energy >= attack.energyCost;
}

export function observeRegime(distance) {
  if (distance > 3.25) return 'free';
  if (distance > 1.72) return 'contact';
  return 'close';
}

export function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}
