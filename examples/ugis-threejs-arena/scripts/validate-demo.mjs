import { demoTimeline } from '../src/demoTimeline.js';

const HEX_ROOT = /^[0-9a-f]{64}$/;
const REQUIRED_ACTORS = new Set(['fighter:wanfeng', 'fighter:opponent']);
const REQUIRED_REGIMES = new Set(['free', 'contact', 'close']);
const ROUTES = new Set([
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

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(demoTimeline.format === 'rcl.ugis-threejs-browser-projection.v0.1', 'unexpected timeline format');
assert(Array.isArray(demoTimeline.frames) && demoTimeline.frames.length > 0, 'timeline must contain frames');

const grouped = new Map();
const seenActionRoots = new Set();
const seenRegimes = new Set();
for (const frame of demoTimeline.frames) {
  assert(Number.isInteger(frame.exchange) && frame.exchange >= 0, 'exchange must be a non-negative integer');
  assert(REQUIRED_ACTORS.has(frame.actorNode), `unknown actor node: ${frame.actorNode}`);
  assert(REQUIRED_ACTORS.has(frame.targetNode) && frame.targetNode !== frame.actorNode, 'target node must be the other fighter');
  assert(REQUIRED_REGIMES.has(frame.regime), `unknown regime: ${frame.regime}`);
  assert(ROUTES.has(frame.routeId), `unknown UGIS route: ${frame.routeId}`);
  assert(Number.isInteger(frame.motion?.magnitudeMilli), 'motion magnitude must use fixed-point integer milli units');
  assert(typeof frame.motion?.direction === 'string' && frame.motion.direction.length > 0, 'motion direction is required');
  assert(Array.isArray(frame.animationTags) && frame.animationTags.length > 0, 'animation tags are required');
  for (const [label, root] of [
    ['ActionRoot', frame.actionRoot],
    ['BridgeRoot', frame.bridgeRoot],
    ['PlanRoot', frame.planRoot],
  ]) {
    assert(HEX_ROOT.test(root), `${label} must be a 64-character lowercase SHA-256 root`);
  }
  assert(!seenActionRoots.has(frame.actionRoot), `duplicate ActionRoot: ${frame.actionRoot}`);
  seenActionRoots.add(frame.actionRoot);
  seenRegimes.add(frame.regime);
  if (!grouped.has(frame.exchange)) grouped.set(frame.exchange, []);
  grouped.get(frame.exchange).push(frame);
}

for (const [exchange, frames] of grouped) {
  assert(frames.length === 2, `exchange ${exchange} must contain exactly two actions`);
  assert(new Set(frames.map(frame => frame.actorNode)).size === 2, `exchange ${exchange} must contain both fighters`);
  assert(frames[0].regime === frames[1].regime, `exchange ${exchange} fighters must share one regime`);
}

for (const regime of REQUIRED_REGIMES) {
  assert(seenRegimes.has(regime), `demo must cover regime: ${regime}`);
}

console.log(JSON.stringify({
  ok: true,
  format: demoTimeline.format,
  exchanges: [...grouped.keys()].sort((a, b) => a - b),
  frames: demoTimeline.frames.length,
  regimes: [...seenRegimes].sort(),
  actionRoots: seenActionRoots.size,
}, null, 2));
