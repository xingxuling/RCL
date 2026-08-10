import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSpellSpatialAcquisitionPackage,
  validateSpellSpatialAcquisitionPackage,
  runSpellSpatialKnownControlDryRun,
} from '../src/frontier-spell-spatial-acquisition-package.mjs';

test('Phase2B manifest is balanced, redacted and disarmed by default', () => {
  const bundle = buildSpellSpatialAcquisitionPackage({ samplesPerCell: 24, randomizationSeed: 1234 });
  const v = validateSpellSpatialAcquisitionPackage(bundle);
  assert.equal(v.ok, true);
  assert.equal(bundle.acquisitionManifest.totalObservations, 96);
  assert.equal(bundle.acquisitionManifest.acquisitionBoundary.unknownAcquisitionArmed, false);
  assert.equal(bundle.acquisitionManifest.calibrationManifest.status, 'UNBOUND');
  for (const row of bundle.acquisitionManifest.redactedSchedule) {
    assert.equal('symbolCondition' in row, false);
    assert.equal('spatialContext' in row, false);
  }
});

test('same seed produces deterministic acquisition package root', () => {
  const a = buildSpellSpatialAcquisitionPackage({ randomizationSeed: 4444 });
  const b = buildSpellSpatialAcquisitionPackage({ randomizationSeed: 4444 });
  assert.equal(a.acquisitionManifest.root, b.acquisitionManifest.root);
  assert.equal(a.sealedConditionManifest.root, b.sealedConditionManifest.root);
});

test('different seed changes blind schedule root', () => {
  const a = buildSpellSpatialAcquisitionPackage({ randomizationSeed: 4444 });
  const b = buildSpellSpatialAcquisitionPackage({ randomizationSeed: 4445 });
  assert.notEqual(a.acquisitionManifest.root, b.acquisitionManifest.root);
});

test('manifest tamper is rejected', () => {
  const bundle = buildSpellSpatialAcquisitionPackage();
  bundle.acquisitionManifest.totalObservations += 1;
  const v = validateSpellSpatialAcquisitionPackage(bundle);
  assert.equal(v.ok, false);
  assert.ok(v.failures.includes('unbalanced_total_observations'));
  assert.ok(v.failures.includes('manifest_root_mismatch'));
});

test('known ordinary interaction dry run traverses existing blind pipeline without arming unknown acquisition', () => {
  const run = runSpellSpatialKnownControlDryRun({ samplesPerCell: 24 });
  assert.equal(run.result.packageValid, true);
  assert.equal(run.result.blindPipelineOk, true);
  assert.equal(run.result.knownControlDetected, true);
  assert.equal(run.result.unknownAcquisitionArmed, false);
  assert.equal(run.result.magicVerified, false);
});
