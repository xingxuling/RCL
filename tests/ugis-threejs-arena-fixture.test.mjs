import assert from 'node:assert/strict';
import test from 'node:test';

import { demoTimeline } from '../examples/ugis-threejs-arena/src/demoTimeline.js';

const HEX_ROOT = /^[0-9a-f]{64}$/;
const ROUTES = new Set([
  'hold_measure', 'take_line', 'intercept_route', 'contact_control', 'enter_close',
  'close_resolution', 'disengage_reentry', 'recover_axis', 'regenerate_route',
  'change_rhythm', 'flow_route',
]);

test('UGIS Three.js arena fixture preserves pair/regime/root invariants', () => {
  assert.equal(demoTimeline.format, 'rcl.ugis-threejs-browser-projection.v0.1');
  assert.ok(Array.isArray(demoTimeline.frames));
  assert.ok(demoTimeline.frames.length >= 6);

  const grouped = new Map();
  const regimes = new Set();
  const roots = new Set();

  for (const frame of demoTimeline.frames) {
    assert.ok(Number.isInteger(frame.exchange));
    assert.ok(['fighter:wanfeng', 'fighter:opponent'].includes(frame.actorNode));
    assert.ok(['fighter:wanfeng', 'fighter:opponent'].includes(frame.targetNode));
    assert.notEqual(frame.actorNode, frame.targetNode);
    assert.ok(['free', 'contact', 'close'].includes(frame.regime));
    assert.ok(ROUTES.has(frame.routeId));
    assert.ok(Number.isInteger(frame.motion?.magnitudeMilli));
    assert.ok(Array.isArray(frame.animationTags) && frame.animationTags.length > 0);
    for (const root of [frame.actionRoot, frame.bridgeRoot, frame.planRoot]) {
      assert.match(root, HEX_ROOT);
    }
    assert.equal(roots.has(frame.actionRoot), false, `duplicate ActionRoot ${frame.actionRoot}`);
    roots.add(frame.actionRoot);
    regimes.add(frame.regime);
    if (!grouped.has(frame.exchange)) grouped.set(frame.exchange, []);
    grouped.get(frame.exchange).push(frame);
  }

  for (const [exchange, frames] of grouped) {
    assert.equal(frames.length, 2, `exchange ${exchange} must contain exactly two actions`);
    assert.equal(new Set(frames.map(frame => frame.actorNode)).size, 2);
    assert.equal(frames[0].regime, frames[1].regime);
  }

  assert.deepEqual([...regimes].sort(), ['close', 'contact', 'free']);
});
