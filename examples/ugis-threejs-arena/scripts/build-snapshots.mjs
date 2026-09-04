import assert from 'node:assert/strict';

import { realityRoot } from '../../../src/canonical.mjs';
import { demoSnapshots } from '../src/demoSnapshots.js';
import { demoTimeline } from '../src/demoTimeline.js';

const START = Object.freeze({
  'fighter:wanfeng': Object.freeze({ x_milli: -2150, z_milli: 350 }),
  'fighter:opponent': Object.freeze({ x_milli: 2150, z_milli: -350 }),
});
const SIDE_SIGN = Object.freeze({
  'fighter:wanfeng': 1,
  'fighter:opponent': -1,
});
const MIN_SEPARATION_MILLI = 1120;

function normalized(x, z) {
  const length = Math.hypot(x, z);
  return length < 1e-9 ? { x: 0, z: -1 } : { x: x / length, z: z / length };
}

function directionVector(direction, actor, target, sideSign) {
  const forward = normalized(target.x_milli - actor.x_milli, target.z_milli - actor.z_milli);
  const right = { x: -forward.z * sideSign, z: forward.x * sideSign };
  let vector;
  switch (direction) {
    case 'forward':
      return forward;
    case 'forward-angle':
      vector = { x: forward.x + 0.34 * right.x, z: forward.z + 0.34 * right.z };
      break;
    case 'backward':
      return { x: -forward.x, z: -forward.z };
    case 'backward-then-forward':
      vector = { x: -0.35 * forward.x + 0.18 * right.x, z: -0.35 * forward.z + 0.18 * right.z };
      break;
    case 'lateral':
      return right;
    case 'adaptive':
      vector = { x: 0.45 * forward.x + 0.55 * right.x, z: 0.45 * forward.z + 0.55 * right.z };
      break;
    case 'variable':
      vector = { x: 0.30 * forward.x + 0.70 * right.x, z: 0.30 * forward.z + 0.70 * right.z };
      break;
    case 'track':
    case 'neutral':
    default:
      return { x: 0, z: 0 };
  }
  return normalized(vector.x, vector.z);
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function candidatePosition(frame, actor, target) {
  const direction = directionVector(
    frame.motion.direction,
    actor,
    target,
    SIDE_SIGN[frame.actorNode],
  );
  const magnitude = clamp(frame.motion.magnitudeMilli, 0, 1200);
  const distanceMilli = magnitude * 1.55;
  return {
    x_milli: clamp(Math.round(actor.x_milli + direction.x * distanceMilli), -4700, 4700),
    z_milli: clamp(Math.round(actor.z_milli + direction.z * distanceMilli), -3600, 3600),
  };
}

function preservePairSeparation(wanfeng, opponent) {
  const dx = wanfeng.x_milli - opponent.x_milli;
  const dz = wanfeng.z_milli - opponent.z_milli;
  const distance = Math.hypot(dx, dz);
  if (distance >= MIN_SEPARATION_MILLI || distance < 1e-9) return [wanfeng, opponent];

  const push = (MIN_SEPARATION_MILLI - distance) / 2;
  const ux = dx / distance;
  const uz = dz / distance;
  return [
    {
      x_milli: Math.round(wanfeng.x_milli + ux * push),
      z_milli: Math.round(wanfeng.z_milli + uz * push),
    },
    {
      x_milli: Math.round(opponent.x_milli - ux * push),
      z_milli: Math.round(opponent.z_milli - uz * push),
    },
  ];
}

function clonePosition(position) {
  return { x_milli: position.x_milli, z_milli: position.z_milli };
}

export function buildProviderSnapshots(frames = demoTimeline.frames) {
  const grouped = new Map();
  for (const frame of frames) {
    if (!grouped.has(frame.exchange)) grouped.set(frame.exchange, []);
    grouped.get(frame.exchange).push(frame);
  }

  let positions = {
    'fighter:wanfeng': clonePosition(START['fighter:wanfeng']),
    'fighter:opponent': clonePosition(START['fighter:opponent']),
  };
  const snapshots = [];

  for (const exchange of [...grouped.keys()].sort((a, b) => a - b)) {
    const actions = grouped.get(exchange);
    assert.equal(actions.length, 2, `exchange ${exchange} must contain two actions`);
    const byActor = Object.fromEntries(actions.map(frame => [frame.actorNode, frame]));
    const before = {
      'fighter:wanfeng': clonePosition(positions['fighter:wanfeng']),
      'fighter:opponent': clonePosition(positions['fighter:opponent']),
    };

    let wanfengAfter = candidatePosition(
      byActor['fighter:wanfeng'],
      before['fighter:wanfeng'],
      before['fighter:opponent'],
    );
    let opponentAfter = candidatePosition(
      byActor['fighter:opponent'],
      before['fighter:opponent'],
      before['fighter:wanfeng'],
    );
    [wanfengAfter, opponentAfter] = preservePairSeparation(wanfengAfter, opponentAfter);

    const payload = {
      format: 'rcl.ugis-threejs-provider-snapshot.v0.1',
      exchange,
      regime: actions[0].regime,
      before,
      after: {
        'fighter:wanfeng': wanfengAfter,
        'fighter:opponent': opponentAfter,
      },
      action_roots: actions.map(frame => frame.actionRoot).sort(),
      plan_roots: actions.map(frame => frame.planRoot).sort(),
    };
    snapshots.push({ ...payload, root: realityRoot(payload) });
    positions = payload.after;
  }
  return snapshots;
}

const built = buildProviderSnapshots();
if (process.argv.includes('--check')) {
  assert.deepEqual(built, demoSnapshots);
  console.log(JSON.stringify({
    ok: true,
    snapshots: built.length,
    roots: built.map(snapshot => snapshot.root),
  }, null, 2));
} else {
  console.log(JSON.stringify(built, null, 2));
}
