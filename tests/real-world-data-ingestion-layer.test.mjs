import test from 'node:test';
import assert from 'node:assert/strict';
import {
  runRealWorldDataIngestionLayerDemo,
  runRealWorldDataIngestionLayer,
  buildRealWorldDataIngestionLayerSpec,
  renderRealWorldDataIngestionLayerRcl,
} from '../src/real-world-data-ingestion-layer.mjs';

test('real world data ingestion layer demo establishes v0.71 runtime', () => {
  const bundle = runRealWorldDataIngestionLayerDemo();
  assert.equal(bundle.ok, true);
  assert.equal(bundle.result.realWorldDataIngestionLayerEstablished, true);
  assert.equal(bundle.result.ingestionChannelCount, 8);
  assert.equal(bundle.result.dataSourceContractCount, 8);
  assert.equal(bundle.result.validationPipelineCount, 8);
  assert.equal(bundle.result.cleaningPipelineCount, 8);
  assert.equal(bundle.result.blindSplitCount, 8);
  assert.equal(bundle.result.evidenceBindingCount, 8);
  assert.equal(bundle.result.writebackRouteCount, 8);
  assert.equal(bundle.result.humanConsentGateCount, 8);
  assert.equal(bundle.result.averageIngestionScore, 1);
  assert.equal(bundle.result.multiAgentVerificationHandoffReady, true);
});

test('real world data ingestion channels include blind holdout and evidence binding', () => {
  const bundle = runRealWorldDataIngestionLayer({});
  assert.equal(bundle.channels.length, 8);
  for (const channel of bundle.channels) {
    assert.ok(channel.dataSourceContract.sourceTypes.length >= 6);
    assert.ok(channel.validationRules.length >= 6);
    assert.ok(channel.cleaningPipeline.length >= 5);
    assert.ok(channel.blindSplitPolicy.holdoutRatio > 0);
    assert.ok(channel.evidenceBinding.bindingFrames.includes('blind-split-ledger'));
    assert.equal(channel.writebackRoute.requiresHumanConsent, true);
    assert.equal(channel.ingestionScore, 1);
  }
});

test('real world data ingestion spec renders RCL declaration', () => {
  const spec = buildRealWorldDataIngestionLayerSpec({});
  const rcl = renderRealWorldDataIngestionLayerRcl(spec);
  assert.match(rcl, /RealWorldDataIngestionLayerV071/);
  assert.match(rcl, /blindHoldoutRatio/);
  assert.match(rcl, /v0\.72 Multi-Agent Verification Council/);
});
