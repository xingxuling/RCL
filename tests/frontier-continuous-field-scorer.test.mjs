import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildContinuousFieldPayload,
  scoreContinuousFieldPayload,
  validateContinuousFieldPayload,
} from '../src/frontier-continuous-field-scorer.mjs';
import {
  AETHER_CONTINUOUS_FIELD_GRAMMAR,
  buildAetherContinuousFieldSandboxPayload,
} from '../src/frontier-aether-continuous-field-sandbox-surrogate.mjs';

test('continuous-field payload validates preregistered coverage and frozen analysis plan', () => {
  const built = buildAetherContinuousFieldSandboxPayload('pure_null');
  const validation = validateContinuousFieldPayload(built.payload, AETHER_CONTINUOUS_FIELD_GRAMMAR);
  assert.equal(validation.ok, true);
  assert.equal(validation.sessionCount, 24);
  assert.equal(validation.distanceLevels, 3);
  assert.equal(validation.phaseLevels, 4);
  assert.equal(validation.shieldLevels, 2);
});

test('continuous-field payload root rejects post-build timeseries mutation', () => {
  const built = buildAetherContinuousFieldSandboxPayload('pure_null');
  const tampered = structuredClone(built.payload);
  tampered.sessions[0].receiver[0] += 1;
  const validation = validateContinuousFieldPayload(tampered, AETHER_CONTINUOUS_FIELD_GRAMMAR);
  assert.equal(validation.ok, false);
  assert.equal(validation.failures.includes('continuous_field_payload_root_mismatch'), true);
});

test('continuous-field scorer does not search lag phase or distance scale after seeing data', () => {
  const built = buildAetherContinuousFieldSandboxPayload('injected_preregistered_kernel');
  const score = scoreContinuousFieldPayload(built.payload, AETHER_CONTINUOUS_FIELD_GRAMMAR);
  assert.equal(score.ok, true);
  assert.equal(score.lagSearchUsed, false);
  assert.equal(score.phaseSearchUsed, false);
  assert.equal(score.distanceScaleSearchUsed, false);
});

test('continuous-field scorer detects the preregistered injected transfer kernel', () => {
  const built = buildAetherContinuousFieldSandboxPayload('injected_preregistered_kernel');
  const score = scoreContinuousFieldPayload(built.payload, AETHER_CONTINUOUS_FIELD_GRAMMAR);
  assert.equal(score.ok, true);
  assert.equal(score.detected, true);
  assert.ok(score.model.kernelCorrelation >= 0.6);
  assert.ok(score.model.r2 >= 0.35);
  assert.ok(score.permutation.empiricalP <= 0.02);
});

test('manual payload with analysis search enabled is fail-closed', () => {
  const built = buildAetherContinuousFieldSandboxPayload('pure_null');
  const mutated = structuredClone(built.payload);
  mutated.analysisPlan.lagSearchForbidden = false;
  mutated.root = null;
  const rebuilt = buildContinuousFieldPayload(mutated);
  rebuilt.analysisPlan.lagSearchForbidden = false;
  rebuilt.root = null;
  const validation = validateContinuousFieldPayload(rebuilt, AETHER_CONTINUOUS_FIELD_GRAMMAR);
  assert.equal(validation.ok, false);
  assert.equal(validation.failures.includes('lag_search_must_be_forbidden'), true);
});
