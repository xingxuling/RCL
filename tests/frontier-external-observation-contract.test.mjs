import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  buildFrontierExternalObservationContract,
  buildKnownSoftwareInteractionControl,
  createFrontierExternalObservationBlindPackage,
  runFrontierExternalObservationControlSuite,
  runFrontierExternalObservationPipeline,
  validateFrontierExternalObservationContract,
  writeFrontierExternalObservationContractReports,
  loadFrontierExternalObservationContractFile,
  runFrontierExternalObservationFile,
} from '../src/frontier-external-observation-contract.mjs';

test('known software control produces a valid immutable external observation contract', () => {
  const contract = buildKnownSoftwareInteractionControl();
  const validation = validateFrontierExternalObservationContract(contract);
  assert.equal(validation.ok, true);
  assert.equal(validation.observationCount, 192);
  assert.equal(validation.failures.length, 0);
});

test('raw row tampering is rejected by the immutable raw data root', () => {
  const contract = buildKnownSoftwareInteractionControl();
  const tampered = JSON.parse(JSON.stringify(contract));
  tampered.rows[0].response += 1;
  const validation = validateFrontierExternalObservationContract(tampered);
  assert.equal(validation.ok, false);
  assert.ok(validation.failures.includes('raw_data_root_mismatch'));
});

test('missing calibration blocks external observation intake', () => {
  const contract = buildKnownSoftwareInteractionControl();
  const rebuilt = buildFrontierExternalObservationContract({
    ...contract,
    calibration: { ...contract.calibration, status: 'missing' },
  });
  const validation = validateFrontierExternalObservationContract(rebuilt);
  assert.equal(validation.ok, false);
  assert.ok(validation.failures.includes('calibration_not_valid'));
});

test('blind package hides semantic labels and source metadata from evaluator', () => {
  const packageResult = createFrontierExternalObservationBlindPackage(buildKnownSoftwareInteractionControl(), { randomizationSeed: 7 });
  assert.equal(packageResult.ok, true);
  const deckText = JSON.stringify(packageResult.redactedDeck);
  assert.equal(deckText.includes('symbolCondition'), false);
  assert.equal(deckText.includes('geometryCondition'), false);
  assert.equal(deckText.includes('active'), false);
  assert.equal(deckText.includes('collector'), false);
  assert.equal(packageResult.redactedDeck.sourceMetadataVisibleToEvaluator, false);
});

test('known software interaction passes the blind pipeline but remains non-physical evidence', () => {
  const pipeline = runFrontierExternalObservationPipeline(buildKnownSoftwareInteractionControl(), { randomizationSeed: 7 });
  assert.equal(pipeline.ok, true);
  assert.equal(pipeline.score.detected, true);
  assert.equal(pipeline.score.scoringUsedSealedRandomizationManifest, false);
  assert.equal(pipeline.reveal.revealOccurredAfterScoring, true);
  assert.equal(pipeline.externalRealityVerified, false);
});

test('control suite detects engineered interaction, rejects additive control and enforces integrity gates', () => {
  const suite = runFrontierExternalObservationControlSuite();
  assert.equal(suite.ok, true);
  assert.equal(suite.positiveInteractionDetected, true);
  assert.equal(suite.additiveControlRejected, true);
  assert.equal(suite.tamperRejected, true);
  assert.equal(suite.missingCalibrationRejected, true);
  assert.equal(suite.blindScoreManifestIsolation, true);
  assert.equal(suite.externalRealityVerified, false);
});

test('sealed JSON contract can be loaded and run through the external observation file path', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-frontier-external-file-'));
  const file = path.join(dir, 'external-observation.json');
  const contract = buildKnownSoftwareInteractionControl();
  fs.writeFileSync(file, `${JSON.stringify(contract, null, 2)}\n`);
  const loaded = loadFrontierExternalObservationContractFile(file);
  assert.equal(loaded.root, contract.root);
  const pipeline = runFrontierExternalObservationFile(file, { randomizationSeed: 11 });
  assert.equal(pipeline.ok, true);
  assert.equal(pipeline.externalRealityVerified, false);
});

test('report writer emits contract, blind evidence, controls and RCL projection', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-frontier-external-observation-'));
  const report = writeFrontierExternalObservationContractReports(dir);
  assert.equal(report.ok, true);
  for (const file of [
    'known-software-positive-contract.json',
    'known-software-positive-redacted-deck.json',
    'known-software-positive-blind-score.json',
    'known-software-positive-reveal.json',
    'known-software-additive-blind-score.json',
    'control-suite.json',
    'frontier-external-observation-contract.rcl',
    'README.md',
  ]) assert.ok(fs.existsSync(path.join(dir, file)), file);
});
