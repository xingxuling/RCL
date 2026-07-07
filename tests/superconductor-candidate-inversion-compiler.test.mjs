import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  runSuperconductorCandidateInversion,
  runSuperconductorCandidateInversionDemo,
  rankSuperconductorCandidates,
  runRenameInvarianceCheck,
  runSuperconductorPressureTest,
  buildSuperconductorCandidateInversionSpec,
  renderSuperconductorCandidateInversionRcl,
  writeSuperconductorCandidateInversionReports,
  deriveMaterialsFieldFromCosmogenicOrigin,
} from '../src/superconductor-candidate-inversion-compiler.mjs';

test('v0.92 demo compiles a candidate family but blocks lab and room-temperature claims', () => {
  const demo = runSuperconductorCandidateInversionDemo();
  assert.equal(demo.ok, true);
  assert.equal(demo.canClaimCandidateFamily, true);
  assert.equal(demo.canClaimRoomTemperatureAmbientSuperconductor, false);
  assert.equal(demo.canClaimLabRecipe, false);
  assert.match(demo.topCandidateFamily, /候选族|candidate family/i);
});

test('v0.92 material field derives from corrected v0.90 cosmogenic parameters', () => {
  const field = deriveMaterialsFieldFromCosmogenicOrigin();
  assert.ok(field.structuralSearchDepth > 0.6);
  assert.ok(field.validationDiscipline > 0.6);
  assert.equal(field.origin.technosphereCoupling, 0.66);
  assert.equal(field.origin.cognitionGradient, 0.61);
});

test('v0.92 blind ranking uses reveal-after-scoring and no redacted name leakage', () => {
  const ranking = rankSuperconductorCandidates();
  assert.equal(ranking.passed, true);
  assert.equal(ranking.leakageScore, 0);
  const text = JSON.stringify(ranking.blindDeck);
  assert.doesNotMatch(text, /LK-99|lead|apatite|hydride|boron|carbon|nickelate|cuprate|磷灰石|超氢/);
  assert.match(JSON.stringify(ranking.revealAfterScoring), /LK-99|hydride|boron|carbon|nickelate|cuprate|磷灰石|超氢/);
});

test('v0.92 negative controls fail target ranking', () => {
  const result = runSuperconductorCandidateInversion().result;
  assert.equal(result.ok, true);
  assert.ok(result.negativeControlMaxScore <= result.spec.thresholds.negativeControlMaxScore);
  const negatives = result.revealAfterScoring.filter(row => row.revealAfterScoring.class === 'negative_control');
  assert.equal(negatives.length, 2);
  for (const row of negatives) {
    assert.equal(row.evaluation.passedCandidateFamilyGate, false);
    assert.equal(row.evaluation.canClaimAmbientRoomTemp, false);
  }
});

test('v0.92 high-pressure reference is not allowed to become an ambient claim', () => {
  const result = runSuperconductorCandidateInversion().result;
  const highPressure = result.revealAfterScoring.find(row => row.revealAfterScoring.key === 'high_pressure_rare_earth_superhydride_reference');
  assert.ok(highPressure);
  assert.equal(highPressure.revealAfterScoring.class, 'reference_family');
  assert.equal(highPressure.evaluation.canClaimAmbientRoomTemp, false);
  assert.ok(highPressure.evaluation.pressurePenalty > 0.3);
});

test('v0.92 rename invariance blocks label-driven winners', () => {
  const check = runRenameInvarianceCheck();
  assert.equal(check.passed, true);
  assert.equal(check.sameTopKey, true);
  assert.equal(check.scoreDelta, 0);
});

test('v0.92 pressure perturbation keeps the same top candidate and controls pass', () => {
  const pressure = runSuperconductorPressureTest();
  assert.equal(pressure.passed, true);
  assert.equal(pressure.passRate, 1);
});

test('v0.92 spec and RCL include guard rails', () => {
  const spec = buildSuperconductorCandidateInversionSpec();
  const rcl = renderSuperconductorCandidateInversionRcl(spec);
  assert.equal(spec.validation.canClaimRoomTemperatureAmbientSuperconductor, false);
  assert.equal(spec.validation.canClaimLabRecipe, false);
  assert.match(rcl, /guard no_future_log_claim/);
  assert.match(rcl, /guard no_unverified_recipe/);
  assert.match(rcl, /guard no_room_temperature_ambient_superconductor_claim/);
});

test('v0.92 report writer emits whitepaper and evidence ledger', () => {
  const dir = path.resolve('output/test-v0.92-superconductor');
  fs.rmSync(dir, { recursive: true, force: true });
  const report = writeSuperconductorCandidateInversionReports(dir);
  assert.equal(report.ok, true);
  assert.ok(fs.existsSync(path.join(dir, 'superconductor-candidate-whitepaper.md')));
  assert.ok(fs.existsSync(path.join(dir, 'multicivilization-court.json')));
  assert.ok(fs.existsSync(path.join(dir, 'superconductor-candidate-inversion.rcl')));
});
