import assert from 'node:assert/strict';
import test from 'node:test';

import { demoSnapshots } from '../examples/ugis-threejs-arena/src/demoSnapshots.js';
import { demoTimeline } from '../examples/ugis-threejs-arena/src/demoTimeline.js';
import { realityRoot } from '../src/canonical.mjs';

function payloadWithoutRoot(snapshot) {
  const { root: _root, ...payload } = snapshot;
  return payload;
}

function positionDistance(a, b) {
  return Math.hypot(a.x_milli - b.x_milli, a.z_milli - b.z_milli);
}

test('UGIS Three.js provider snapshots are rooted, continuous and action-bound', () => {
  assert.equal(demoSnapshots.length, 3);
  const framesByExchange = new Map();
  for (const frame of demoTimeline.frames) {
    if (!framesByExchange.has(frame.exchange)) framesByExchange.set(frame.exchange, []);
    framesByExchange.get(frame.exchange).push(frame);
  }

  for (let index = 0; index < demoSnapshots.length; index += 1) {
    const snapshot = demoSnapshots[index];
    assert.equal(snapshot.format, 'rcl.ugis-threejs-provider-snapshot.v0.1');
    assert.equal(realityRoot(payloadWithoutRoot(snapshot)), snapshot.root);

    const frames = framesByExchange.get(snapshot.exchange);
    assert.equal(frames.length, 2);
    assert.deepEqual(snapshot.action_roots, frames.map(frame => frame.actionRoot).sort());
    assert.deepEqual(snapshot.plan_roots, frames.map(frame => frame.planRoot).sort());
    assert.equal(snapshot.regime, frames[0].regime);

    for (const phase of ['before', 'after']) {
      for (const nodeId of ['fighter:wanfeng', 'fighter:opponent']) {
        assert.ok(Number.isInteger(snapshot[phase][nodeId].x_milli));
        assert.ok(Number.isInteger(snapshot[phase][nodeId].z_milli));
      }
      assert.ok(
        positionDistance(snapshot[phase]['fighter:wanfeng'], snapshot[phase]['fighter:opponent']) >= 1120,
        `${phase} fighter separation must remain at least 1120 milli-units`,
      );
    }

    if (index > 0) {
      assert.deepEqual(demoSnapshots[index - 1].after, snapshot.before);
    }
  }
});
