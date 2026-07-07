import test from 'node:test';
import assert from 'node:assert/strict';
import {
  runAetherForgePocketProductBridgeDemo,
  runAetherForgePocketProductBridge,
  buildAetherForgePocketProductBridgeSpec,
  renderAetherForgePocketProductBridgeRcl,
} from '../src/aether-forge-pocket-product-bridge.mjs';

test('v0.68 demo establishes Aether Forge Pocket product bridge', () => {
  const bundle = runAetherForgePocketProductBridgeDemo();
  assert.equal(bundle.ok, true);
  assert.equal(bundle.result.aetherForgePocketProductBridgeEstablished, true);
  assert.equal(bundle.result.bridgeCount, 8);
  assert.equal(bundle.result.mobileProductCardCount, 8);
  assert.equal(bundle.result.projectKnowledgeCount, 8);
  assert.equal(bundle.result.planModeContractCount, 8);
  assert.equal(bundle.result.previewSurfaceCount, 8);
  assert.equal(bundle.result.buildAdapterCount, 8);
  assert.equal(bundle.result.deliveryHandoffCount, 8);
  assert.equal(bundle.result.scores.averageBridgeScore, 1);
});

test('v0.68 product cards preserve evidence and human gates', () => {
  const bundle = runAetherForgePocketProductBridge({});
  for (const card of bundle.cards) {
    assert.equal(card.bridgeScore, 1);
    assert.ok(card.projectKnowledge.knowledgeHash);
    assert.ok(card.evidencePanel.sourceEvidenceRoot);
    assert.equal(card.pocketEntry.mobileSafeMode, true);
    assert.equal(card.buildAdapter.requiresHumanConfirmation, true);
    assert.equal(card.deliveryHandoff.handoffReady, true);
    assert.equal(card.visualEditSurface.localModificationOnly, true);
  }
});

test('v0.68 spec renders RCL bridge contract', () => {
  const spec = buildAetherForgePocketProductBridgeSpec();
  const rcl = renderAetherForgePocketProductBridgeRcl(spec);
  assert.match(rcl, /AetherForgePocketProductBridgeV068/);
  assert.match(rcl, /requireProjectKnowledge/);
  assert.match(rcl, /requireDeliveryHandoff/);
});
