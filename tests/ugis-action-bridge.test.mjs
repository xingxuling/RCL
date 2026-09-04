import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { realityRoot } from '../src/canonical.mjs';
import {
  createRclUgisActionBridge,
  rclUgisActionBridgeToProviderCall,
  verifyRclUgisActionBridge,
  verifyUgisActionIr,
} from '../src/ugis-action-bridge.mjs';

const fixture = JSON.parse(await readFile(
  new URL('./fixtures/ugis-action-ir-hold-measure.json', import.meta.url),
  'utf8',
));

test('Python UGIS ActionRoot matches RCL realityRoot', () => {
  const { root, ...payload } = fixture;
  assert.equal(root, '282785e8df9bfd9e528fd07f91f3c1c76dc17d01d390b23dc0c84c39abc05719');
  assert.equal(realityRoot(payload), root);
  assert.equal(verifyUgisActionIr(fixture).ok, true);
});

test('tampered UGIS Action IR is rejected', () => {
  const altered = structuredClone(fixture);
  altered.intent.locomotion.magnitude_milli += 1;
  assert.equal(verifyUgisActionIr(altered).ok, false);
});

test('RCL bridge preserves UGIS semantic ownership and evidence root', () => {
  const bridge = createRclUgisActionBridge(fixture, {
    actorNode: 'scene:fighter-a',
    targetNode: 'scene:fighter-b',
  });
  assert.equal(bridge.semantic_owner, 'UGIS');
  assert.equal(bridge.rcl_role, 'reality-transition-provider-envelope');
  assert.equal(bridge.source_action_root, fixture.root);
  assert.equal(bridge.host_call.host, 'threejs');
  assert.equal(bridge.host_call.input.actionRoot, fixture.root);
  assert.equal(verifyRclUgisActionBridge(bridge).ok, true);
  for (const required of [
    'competition-resolution-only',
    'no-anatomical-targeting',
    'no-harm-optimization',
  ]) {
    assert.ok(bridge.preserves.includes(required));
  }
});

test('bridge root is deterministic and provider call remains evidence-linked', () => {
  const a = createRclUgisActionBridge(fixture, {
    actorNode: 'scene:fighter-a',
    targetNode: 'scene:fighter-b',
  });
  const b = createRclUgisActionBridge(fixture, {
    actorNode: 'scene:fighter-a',
    targetNode: 'scene:fighter-b',
  });
  assert.equal(a.root, b.root);
  const call = rclUgisActionBridgeToProviderCall(a);
  assert.equal(call.sourceActionRoot, fixture.root);
  assert.equal(call.evidenceRoot, a.root);
  assert.equal(call.capability, 'threejs.applyActionIntent');
  assert.deepEqual(call.input.animationTags, ['stance.live', 'locomotion.measure-hold']);
});
