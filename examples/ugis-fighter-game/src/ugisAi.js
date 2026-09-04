import { ROUTE_LABELS, UGIS_ROUTES, observeRegime } from './gameRules.js';

export function hashNoise(seed) {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
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
  const regime = observeRegime(distance);
  const pressure = opponentAction ? 1 : 0;
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

export function directiveForRoute(route, observation = {}) {
  const distance = observation.distance ?? 3;
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

export function explainRoute(route) {
  if (!UGIS_ROUTES.includes(route)) return { id: 'unknown', label: '未知路线' };
  return { id: route, label: ROUTE_LABELS[route] };
}
