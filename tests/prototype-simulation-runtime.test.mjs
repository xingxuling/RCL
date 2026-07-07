import test from 'node:test';
import assert from 'node:assert/strict';
import {
  runPrototypeSimulationRuntimeDemo,
  runPrototypeSimulationRuntime,
  buildPrototypeSimulationRuntimeSpec,
  renderPrototypeSimulationRuntimeRcl,
} from '../src/prototype-simulation-runtime.mjs';

test('v0.70 demo establishes prototype simulation runtime', () => {
  const bundle = runPrototypeSimulationRuntimeDemo();
  assert.equal(bundle.ok, true);
  assert.equal(bundle.result.prototypeSimulationRuntimeEstablished, true);
  assert.equal(bundle.result.simulationScenarioCount, 8);
  assert.equal(bundle.result.perturbationModelCount, 8);
  assert.equal(bundle.result.failurePredictionCount, 8);
  assert.equal(bundle.result.evidenceForecastCount, 8);
  assert.equal(bundle.result.executionRecommendationCount, 8);
  assert.equal(bundle.result.realWorldDataIngestionHandoffReady, true);
  assert.equal(bundle.result.averageSimulationScore, 1);
});

test('v0.70 scenarios include bounded simulation and no direct real run', () => {
  const bundle = runPrototypeSimulationRuntime({});
  for (const scenario of bundle.scenarios) {
    assert.equal(scenario.simulationScore, 1);
    assert.ok(scenario.stateVariables.length >= 7);
    assert.ok(scenario.controls.includes('blank-control'));
    assert.ok(scenario.perturbationModel.perturbationHash);
    assert.ok(scenario.evidenceForecast.forecastHash);
    assert.equal(scenario.executionRecommendation.realRunAllowed, false);
    assert.equal(scenario.executionRecommendation.realRunRequiresHumanApproval, true);
    assert.equal(scenario.realWorldDataHandoff.ready, true);
  }
});

test('v0.70 spec renders RCL simulation contract', () => {
  const spec = buildPrototypeSimulationRuntimeSpec();
  const rcl = renderPrototypeSimulationRuntimeRcl(spec);
  assert.match(rcl, /PrototypeSimulationRuntimeV070/);
  assert.match(rcl, /humanApprovalBeforeRealRun/);
  assert.match(rcl, /Real World Data Ingestion Layer/);
});
