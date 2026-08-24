import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSandboxInstrumentSurrogate,
  runSandboxSurrogateScenario,
  runSandboxSurrogatePressureSuite,
} from '../src/frontier-sandbox-instrument-surrogate.mjs';

test('sandbox surrogate builds a calibrated surrogate binding while keeping physical acquisition disarmed', () => {
  const x = buildSandboxInstrumentSurrogate();
  assert.equal(x.bindingBundle.contract.bindingStatus, 'BOUND_CALIBRATED');
  assert.equal(x.descriptor.sandboxAcquisitionEnabled, true);
  assert.equal(x.descriptor.unknownPhysicalAcquisitionArmed, false);
  assert.equal(x.descriptor.externalRealityVerified, false);
  assert.equal(x.descriptor.magicVerified, false);
});

test('pure-null sandbox world does not become an interaction claim', () => {
  const x = runSandboxSurrogateScenario('pure_null');
  assert.equal(x.result.rawValid, true);
  assert.equal(x.result.pipelineOk, true);
  assert.equal(x.result.detectedInteraction, false);
  assert.equal(x.result.classificationPass, true);
});

test('additive sandbox world is not upgraded to an interaction', () => {
  const x = runSandboxSurrogateScenario('additive_without_interaction');
  assert.equal(x.result.rawValid, true);
  assert.equal(x.result.pipelineOk, true);
  assert.equal(x.result.detectedInteraction, false);
  assert.equal(x.result.classificationPass, true);
});

test('injected interaction sandbox world is detected by the existing blind path', () => {
  const x = runSandboxSurrogateScenario('injected_symbol_spatial_interaction');
  assert.equal(x.result.rawValid, true);
  assert.equal(x.result.pipelineOk, true);
  assert.equal(x.result.detectedInteraction, true);
  assert.equal(x.result.classificationPass, true);
  assert.equal(x.result.externalRealityVerified, false);
  assert.equal(x.result.magicVerified, false);
});

test('sandbox surrogate pressure suite classifies all preregistered synthetic worlds and preserves evidence boundary', () => {
  const suite = runSandboxSurrogatePressureSuite();
  assert.equal(suite.scenarioCount, 6);
  assert.equal(suite.passed, 6);
  assert.equal(suite.allRawValid, true);
  assert.equal(suite.allPipelinesOk, true);
  assert.equal(suite.allClassificationsCorrect, true);
  assert.equal(suite.verdict, 'PASS_SANDBOX_SURROGATE_PROTOCOL_ONLY');
  assert.equal(suite.externalRealityVerified, false);
  assert.equal(suite.newNaturalLawVerified, false);
  assert.equal(suite.magicVerified, false);
});
