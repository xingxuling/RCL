import { ROUTE_LABELS, UGIS_ROUTES, observeRegime } from './gameRules.js';

export const AI_DIFFICULTIES = Object.freeze({
  novice: Object.freeze({
    id: 'novice', label: '新手', reactionSteps: [3, 4], commitmentSteps: [4, 5],
    errorRate: 0.26, hesitationRate: 0.34, attackCooldownSteps: [3, 4], telepathy: false,
    summary: '反应约 0.5–0.7 秒，会明显误判，也会犹豫。',
  }),
  normal: Object.freeze({
    id: 'normal', label: '普通', reactionSteps: [2, 3], commitmentSteps: [3, 4],
    errorRate: 0.12, hesitationRate: 0.18, attackCooldownSteps: [2, 3], telepathy: false,
    summary: '公平观察，反应约 0.34–0.51 秒，可以用假动作骗。',
  }),
  hard: Object.freeze({
    id: 'hard', label: '困难', reactionSteps: [1, 2], commitmentSteps: [2, 3],
    errorRate: 0.06, hesitationRate: 0.08, attackCooldownSteps: [1, 2], telepathy: false,
    summary: '反应快，会预测，但仍然只看得到可观察动作。',
  }),
  master: Object.freeze({
    id: 'master', label: '宗师', reactionSteps: [1, 1], commitmentSteps: [2, 2],
    errorRate: 0.02, hesitationRate: 0.03, attackCooldownSteps: [1, 1], telepathy: false,
    summary: '接近完整 UGIS，反应约 0.17 秒，极少失误。',
  }),
  tianji: Object.freeze({
    id: 'tianji', label: '天机', reactionSteps: [0, 0], commitmentSteps: [1, 1],
    errorRate: 0, hesitationRate: 0, attackCooldownSteps: [0, 0], telepathy: true,
    summary: '研究模式：读取当前内部攻击/格挡状态，不讲武德。',
  }),
});

let activeDifficultyId = 'normal';

function freshMemory() {
  return {
    rawThreat: false,
    pendingThreat: false,
    threatApplyTick: null,
    perceivedThreat: false,
    rawGuard: false,
    pendingGuard: false,
    guardApplyTick: null,
    perceivedGuard: false,
    lastRoute: 'hold_measure',
    commitUntilTick: -1,
    currentTick: 0,
    nextAttackTick: 0,
    directiveSerial: 0,
  };
}

let memory = freshMemory();

export function hashNoise(seed) {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function integerInRange([min, max], seed) {
  if (max <= min) return min;
  return min + Math.floor(hashNoise(seed) * (max - min + 1));
}

export function getUgisAiDifficulty() {
  return AI_DIFFICULTIES[activeDifficultyId];
}

export function resetUgisAiMemory() {
  memory = freshMemory();
}

export function setUgisAiDifficulty(id) {
  activeDifficultyId = AI_DIFFICULTIES[id] ? id : 'normal';
  resetUgisAiMemory();
  return getUgisAiDifficulty();
}

function delayedBoolean(kind, rawValue, tick, profile, seedOffset) {
  if (profile.telepathy) return Boolean(rawValue);

  const rawKey = kind === 'threat' ? 'rawThreat' : 'rawGuard';
  const pendingKey = kind === 'threat' ? 'pendingThreat' : 'pendingGuard';
  const applyKey = kind === 'threat' ? 'threatApplyTick' : 'guardApplyTick';
  const perceivedKey = kind === 'threat' ? 'perceivedThreat' : 'perceivedGuard';
  const raw = Boolean(rawValue);

  if (raw !== memory[rawKey]) {
    memory[rawKey] = raw;
    memory[pendingKey] = raw;
    const reactionSteps = integerInRange(profile.reactionSteps, tick * 13.7 + seedOffset);
    memory[applyKey] = tick + reactionSteps;
  }

  if (memory[applyKey] !== null && tick >= memory[applyKey]) {
    memory[perceivedKey] = memory[pendingKey];
    memory[applyKey] = null;
  }

  return memory[perceivedKey];
}

function chooseBaseRoute({ distance, selfHp, selfEnergy, pressure, opponentGuard, ownHitstun, tick }) {
  const regime = observeRegime(distance);
  const noise = hashNoise(tick + Math.round(distance * 100));

  if (ownHitstun > 0) return 'recover_axis';
  if (selfHp < 260 && distance < 2.2) return 'disengage_reentry';

  if (regime === 'free') {
    if (pressure && distance < 4.0) return 'intercept_route';
    if (noise < 0.22) return 'change_rhythm';
    if (distance > 4.6) return 'take_line';
    return noise < 0.52 ? 'hold_measure' : 'take_line';
  }

  if (regime === 'contact') {
    if (pressure) return 'intercept_route';
    if (opponentGuard) return noise < 0.5 ? 'change_rhythm' : 'flow_route';
    if (selfEnergy > 55 && noise > 0.7) return 'contact_control';
    return distance > 2.2 ? 'enter_close' : 'contact_control';
  }

  if (pressure && noise < 0.45) return 'intercept_route';
  if (selfEnergy < 18 && noise < 0.3) return 'disengage_reentry';
  return noise < 0.68 ? 'close_resolution' : 'flow_route';
}

function applyMistake(route, regime, tick, profile) {
  if (profile.errorRate <= 0) return route;
  const mistakeRoll = hashNoise(tick * 7.31 + profile.errorRate * 1000 + regime.length * 19);
  if (mistakeRoll >= profile.errorRate) return route;

  const pools = {
    free: ['hold_measure', 'change_rhythm', 'take_line'],
    contact: ['hold_measure', 'flow_route', 'enter_close', 'contact_control'],
    close: ['recover_axis', 'disengage_reentry', 'flow_route', 'close_resolution'],
  };
  const alternatives = pools[regime].filter(candidate => candidate !== route);
  return alternatives[Math.floor(hashNoise(tick * 3.17 + 41) * alternatives.length)] ?? route;
}

export function chooseUgisRoute(observation) {
  const {
    distance,
    selfHp,
    selfEnergy,
    opponentAction,
    opponentGuard,
    ownHitstun = 0,
    tick = 0,
  } = observation;
  const profile = getUgisAiDifficulty();
  const regime = observeRegime(distance);
  memory.currentTick = tick;

  const pressure = delayedBoolean('threat', Boolean(opponentAction), tick, profile, 17) ? 1 : 0;
  const perceivedGuard = delayedBoolean('guard', opponentGuard, tick, profile, 53);

  if (ownHitstun > 0) {
    memory.lastRoute = 'recover_axis';
    memory.commitUntilTick = tick;
    return 'recover_axis';
  }

  if (!profile.telepathy && tick < memory.commitUntilTick) return memory.lastRoute;

  let route = chooseBaseRoute({
    distance,
    selfHp,
    selfEnergy,
    pressure,
    opponentGuard: perceivedGuard,
    ownHitstun,
    tick,
  });
  route = applyMistake(route, regime, tick, profile);

  memory.lastRoute = route;
  memory.commitUntilTick = tick + integerInRange(profile.commitmentSteps, tick * 5.11 + 73);
  return route;
}

function baseDirective(route, distance) {
  switch (route) {
    case 'hold_measure':
      return { movement: distance < 3.4 ? 'retreat' : 'strafe', action: 'guard', commitment: 0.35 };
    case 'take_line':
      return { movement: 'approach', action: distance > 2.25 ? 'dash' : 'thrust', commitment: 0.8 };
    case 'intercept_route':
      return { movement: 'hold', action: distance < 2.35 ? 'thrust' : 'guard', commitment: 0.72 };
    case 'contact_control':
      return { movement: distance > 1.9 ? 'approach' : 'strafe', action: 'heavy', commitment: 0.82 };
    case 'enter_close':
      return { movement: 'approach', action: 'dash', commitment: 0.9 };
    case 'close_resolution':
      return { movement: 'approach', action: 'heavy', commitment: 0.95 };
    case 'disengage_reentry':
      return { movement: 'retreat', action: 'dash-back', commitment: 0.56 };
    case 'recover_axis':
      return { movement: 'retreat', action: 'guard', commitment: 0.25 };
    case 'regenerate_route':
      return { movement: 'strafe', action: 'guard', commitment: 0.34 };
    case 'change_rhythm':
      return { movement: 'strafe', action: distance < 2.35 ? 'thrust' : 'hold', commitment: 0.48 };
    case 'flow_route':
      return { movement: distance > 1.85 ? 'approach' : 'strafe', action: 'thrust', commitment: 0.7 };
    default:
      return { movement: 'hold', action: 'hold', commitment: 0.2 };
  }
}

export function directiveForRoute(route, observation = {}) {
  const distance = observation.distance ?? 3;
  const profile = getUgisAiDifficulty();
  const directive = baseDirective(route, distance);
  memory.directiveSerial += 1;

  if (profile.telepathy || !['thrust', 'heavy'].includes(directive.action)) return directive;

  if (memory.currentTick < memory.nextAttackTick) {
    return { ...directive, action: 'hold', commitment: Math.min(directive.commitment, 0.42) };
  }

  const hesitate = hashNoise(memory.currentTick * 9.19 + memory.directiveSerial * 3.07) < profile.hesitationRate;
  if (hesitate) {
    memory.nextAttackTick = memory.currentTick + 1;
    return { ...directive, action: 'hold', commitment: Math.min(directive.commitment, 0.4) };
  }

  memory.nextAttackTick = memory.currentTick + integerInRange(
    profile.attackCooldownSteps,
    memory.currentTick * 11.3 + memory.directiveSerial,
  );
  return directive;
}

export function explainRoute(route) {
  if (!UGIS_ROUTES.includes(route)) return { id: 'unknown', label: '未知路线' };
  return { id: route, label: ROUTE_LABELS[route] };
}
