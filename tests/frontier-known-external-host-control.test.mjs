import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {
  acquireKnownExternalHostTimingContract,
  runKnownExternalHostTimingControl,
  runKnownExternalHostAdditiveControl,
  writeKnownExternalHostControlReports,
} from '../src/frontier-known-external-host-control.mjs';
import { validateFrontierExternalObservationContract } from '../src/frontier-external-observation-contract.mjs';

test('real host timing acquisition yields a valid root-bound external observation contract', () => {
  const acquired = acquireKnownExternalHostTimingContract({ samplesPerCell: 8, interactionDelayMs: 8 });
  const validation = validateFrontierExternalObservationContract(acquired.contract);
  assert.equal(validation.ok, true);
  assert.equal(validation.observationCount, 32);
  assert.equal(acquired.externalRealityVerified, false);
});

test('real host known interaction is detected through the same blind pipeline', () => {
  const result = runKnownExternalHostTimingControl({ samplesPerCell: 10, interactionDelayMs: 8 });
  assert.equal(result.pipeline.ok, true);
  assert.equal(result.detected, true);
  assert.equal(result.modelWinner, 'H_interaction');
  assert.equal(result.externalRealityVerified, false);
});

test('real host additive-only control is not promoted to interaction', () => {
  const result = runKnownExternalHostAdditiveControl({ samplesPerCell: 10, symbolDelayMs: 4, geometryDelayMs: 6 });
  assert.equal(result.pipeline.ok, true);
  assert.equal(result.detected, false);
  assert.equal(result.externalRealityVerified, false);
});

test('report writer preserves real host contract, blind score and evidence boundary', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-frontier-host-control-'));
  const report = writeKnownExternalHostControlReports(dir, { samplesPerCell: 10, interactionDelayMs: 8, symbolDelayMs: 4, geometryDelayMs: 6 });
  assert.equal(report.ok, true);
  for (const file of ['host-control-suite.json', 'positive-contract.json', 'positive-blind-score.json', 'positive-reveal.json', 'additive-contract.json', 'additive-blind-score.json', 'README.md']) {
    assert.ok(fs.existsSync(path.join(dir, file)), file);
  }
  const summary = JSON.parse(fs.readFileSync(path.join(dir, 'host-control-suite.json'), 'utf8'));
  assert.equal(summary.realMeasurementsCollected, true);
  assert.equal(summary.externalRealityVerified, false);
});
