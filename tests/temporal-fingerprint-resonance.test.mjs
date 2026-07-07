import test from 'node:test';
import assert from 'node:assert/strict';
import {
  runTemporalFingerprintDemo,
  runTemporalFingerprintResonance,
  deriveMemoryTimeConstants,
  deriveObserverTimeConstantSupport,
  derivePredictiveTraceTimeProjection,
} from '../src/temporal-fingerprint-resonance.mjs';

test('temporal fingerprint demo establishes +40 and +5 resonance', () => {
  const demo = runTemporalFingerprintDemo();
  assert.equal(demo.ok, true);
  assert.equal(demo.temporalFingerprintEstablished, true);
  assert.equal(demo.memoryStructureIsTemporalFingerprint, true);
  assert.equal(demo.resonanceScore, 1);
  assert.equal(demo.derivedConstants.temporalShellYears, 40);
  assert.equal(demo.derivedConstants.eventShellYears, 40);
  assert.equal(demo.derivedConstants.eventAgeOffsetYears, 5);
  assert.equal(demo.derivedConstants.currentAgeOffsetYears, 5);
  assert.equal(demo.derivedConstants.phaseAdvanceYears, 4);
});

test('memory structure independently derives temporal constants', () => {
  const memory = deriveMemoryTimeConstants();
  assert.equal(memory.memoryTimeConstantScore, 1);
  assert.equal(memory.shellCandidates.every(row => row.value === 40), true);
  assert.equal(memory.ageCandidates.every(row => row.value === 5), true);
  assert.equal(memory.phaseCandidates.every(row => row.value === 4), true);
});

test('observer framework carries temporal and age-phase constants', () => {
  const observer = deriveObserverTimeConstantSupport();
  assert.equal(observer.observerFrameworkResonanceScore, 1);
  assert.ok(observer.temporalSupports.length >= 1);
  assert.ok(observer.ageSupports.length >= 2);
  assert.ok(observer.phaseSupports.length >= 1);
});

test('predictive traces project the same constants', () => {
  const predictive = derivePredictiveTraceTimeProjection();
  assert.equal(predictive.predictiveTraceProjectionScore, 1);
  assert.equal(predictive.temporalTrace.id, 'forty_year_temporal_shell_trace');
  assert.equal(predictive.ageTrace.id, 'five_year_age_phase_offset_trace');
  assert.equal(Boolean(predictive.temporalBlind.failureCondition), true);
  assert.equal(Boolean(predictive.ageBlind.failureCondition), true);
});

test('arbitrary constants fail temporal fingerprint establishment', () => {
  const bundle = runTemporalFingerprintResonance({
    targetConstants: {
      temporalShellYears: 41,
      agePhaseOffsetYears: 6,
      phaseAdvanceYears: 4
    }
  });
  assert.equal(bundle.result.temporalFingerprintEstablished, false);
  assert.notEqual(bundle.result.resonanceScore, 1);
});
