import test from 'node:test';
import assert from 'node:assert/strict';
import {
  runAetherContinuousFieldSandboxScenario,
  runAetherContinuousFieldSandboxPressureSuite,
} from '../src/frontier-aether-continuous-field-sandbox-surrogate.mjs';

test('aether surrogate rejects pure null', () => {
  const run = runAetherContinuousFieldSandboxScenario('pure_null').result;
  assert.equal(run.classificationPass, true);
  assert.equal(run.detected, false);
  assert.equal(run.route, 'preregistered_continuous_field_kernel_v0_1');
});

test('aether surrogate rejects shared environment after preregistered residualization', () => {
  const run = runAetherContinuousFieldSandboxScenario('shared_environment_only').result;
  assert.equal(run.classificationPass, true);
  assert.equal(run.detected, false);
});

test('aether surrogate rejects ordinary constant leakage that does not follow the distance phase shield kernel', () => {
  const run = runAetherContinuousFieldSandboxScenario('ordinary_constant_leakage').result;
  assert.equal(run.classificationPass, true);
  assert.equal(run.detected, false);
});

test('aether surrogate rejects a matching kernel injected at the wrong preregistered lag', () => {
  const run = runAetherContinuousFieldSandboxScenario('wrong_lag_kernel').result;
  assert.equal(run.classificationPass, true);
  assert.equal(run.detected, false);
  assert.equal(run.targetLagSamples, 3);
  assert.equal(run.lagSearchUsed, false);
});

test('aether surrogate detects only the injected preregistered kernel world', () => {
  const run = runAetherContinuousFieldSandboxScenario('injected_preregistered_kernel').result;
  assert.equal(run.classificationPass, true);
  assert.equal(run.detected, true);
  assert.ok(run.kernelCorrelation >= 0.6);
  assert.ok(run.empiricalP <= 0.02);
});

test('aether pressure suite classifies all seven worlds and preserves evidence boundary', () => {
  const suite = runAetherContinuousFieldSandboxPressureSuite();
  assert.equal(suite.scenarioCount, 7);
  assert.equal(suite.passed, 7);
  assert.equal(suite.allPayloadsValid, true);
  assert.equal(suite.allRoutesContinuousField, true);
  assert.equal(suite.allClassificationsCorrect, true);
  assert.equal(suite.noAdaptiveSearch, true);
  assert.equal(suite.externalRealityVerified, false);
  assert.equal(suite.newNaturalLawVerified, false);
  assert.equal(suite.magicVerified, false);
});
