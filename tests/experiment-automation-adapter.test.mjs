import test from 'node:test';
import assert from 'node:assert/strict';
import {
  runExperimentAutomationAdapterDemo,
  runExperimentAutomationAdapter,
  buildExperimentAutomationAdapterSpec,
  renderExperimentAutomationAdapterRcl,
} from '../src/experiment-automation-adapter.mjs';

test('v0.69 demo establishes experiment automation adapter', () => {
  const bundle = runExperimentAutomationAdapterDemo();
  assert.equal(bundle.ok, true);
  assert.equal(bundle.result.experimentAutomationAdapterEstablished, true);
  assert.equal(bundle.result.automationAdapterCount, 8);
  assert.equal(bundle.result.taskQueueCount, 8);
  assert.equal(bundle.result.schedulerPlanCount, 8);
  assert.equal(bundle.result.failureRecoveryCount, 8);
  assert.equal(bundle.result.evidenceWritebackCount, 8);
  assert.equal(bundle.result.averageAutomationScore, 1);
  assert.equal(bundle.result.prototypeSimulationHandoffReady, true);
});

test('v0.69 adapters include safety gates and dry run support', () => {
  const bundle = runExperimentAutomationAdapter({});
  for (const adapter of bundle.adapters) {
    assert.equal(adapter.automationScore, 1);
    assert.equal(adapter.humanControl.humanKillSwitch, true);
    assert.equal(adapter.humanControl.destructiveAutomationDisabledByDefault, true);
    assert.ok(adapter.deviceAdapters.every(item => item.dryRunSupported === true));
    assert.ok(adapter.schedulerPlan.stopConditions.includes('human-kill-switch'));
    assert.equal(adapter.evidenceWriteback.writebackReady, true);
    assert.ok(adapter.taskQueue.queueHash);
  }
});

test('v0.69 spec renders RCL automation contract', () => {
  const spec = buildExperimentAutomationAdapterSpec();
  const rcl = renderExperimentAutomationAdapterRcl(spec);
  assert.match(rcl, /ExperimentAutomationAdapterV069/);
  assert.match(rcl, /humanKillSwitchRequired/);
  assert.match(rcl, /Prototype Simulation Runtime/);
});
