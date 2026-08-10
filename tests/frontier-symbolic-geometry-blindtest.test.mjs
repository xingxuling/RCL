import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  buildFrontierSymbolicGeometryPreregistration,
  generateFrontierSymbolicGeometryBlindDeck,
  runFrontierSymbolicGeometryBlindtest,
  runFrontierSymbolicGeometryPressureSuite,
  writeFrontierSymbolicGeometryBlindtestReports,
  FRONTIER_SYMBOLIC_GEOMETRY_PRESSURE_SCENARIOS,
} from '../src/frontier-symbolic-geometry-blindtest.mjs';

test('preregistration freezes null, candidate, thresholds and lane roots before deck generation', () => {
  const prereg = buildFrontierSymbolicGeometryPreregistration();
  assert.equal(prereg.frozenBeforeDeckGeneration, true);
  assert.ok(prereg.candidateModel.includes('betaSG'));
  assert.ok(prereg.nullModel.includes('betaSG = 0'));
  assert.ok(prereg.laneRoots.spell_symbolic_control_protocol);
  assert.ok(prereg.laneRoots.formation_spatial_constraint_array);
  assert.equal(prereg.externalRealityVerified, false);
});

test('redacted deck hides semantic factor meaning and truth until after scoring', () => {
  const deck = generateFrontierSymbolicGeometryBlindDeck();
  const text = JSON.stringify(deck.redactedDeck);
  assert.equal(text.includes('symbolActiveBlindLevel'), false);
  assert.equal(text.includes('geometryActiveBlindLevel'), false);
  assert.equal(text.includes('betaInteraction'), false);
  assert.equal(text.includes('injected_symbol_geometry_interaction'), false);
  assert.equal(deck.redactedDeck.semanticTermsPresent, false);
});

test('injected interaction is detected and revealed only after blind scoring', () => {
  const scenario = FRONTIER_SYMBOLIC_GEOMETRY_PRESSURE_SCENARIOS.find(row => row.id === 'injected_symbol_geometry_interaction');
  const bundle = runFrontierSymbolicGeometryBlindtest({}, scenario);
  assert.equal(bundle.ok, true);
  assert.equal(bundle.blindScore.detected, true);
  assert.equal(bundle.blindScore.modelSelection.winner, 'H_interaction');
  assert.equal(bundle.blindScore.scoringUsedSealedTruth, false);
  assert.equal(bundle.reveal.revealOccurredAfterScoring, true);
  assert.equal(bundle.reveal.classificationCorrect, true);
  assert.equal(bundle.externalRealityVerified, false);
});

test('pressure suite rejects null and additive controls while detecting injected interaction', () => {
  const suite = runFrontierSymbolicGeometryPressureSuite();
  assert.equal(suite.ok, true);
  assert.equal(suite.passRate, 1);
  assert.equal(suite.allNegativeControlsRejected, true);
  assert.equal(suite.injectedPositiveDetected, true);
  assert.equal(suite.leakageFree, true);
  assert.equal(suite.externalRealityVerified, false);
});

test('blindtest is deterministic at fixed seed', () => {
  const a = runFrontierSymbolicGeometryPressureSuite({ seed: 77 });
  const b = runFrontierSymbolicGeometryPressureSuite({ seed: 77 });
  assert.equal(a.root, b.root);
  assert.deepEqual(a.rows, b.rows);
});

test('report writer emits preregistration, redacted deck, score, reveal and RCL evidence', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-frontier-symbolic-geometry-'));
  const report = writeFrontierSymbolicGeometryBlindtestReports(dir);
  assert.equal(report.ok, true);
  for (const file of [
    'preregistration.json',
    'pressure-suite.json',
    'positive-control-redacted-deck.json',
    'positive-control-blind-score.json',
    'positive-control-reveal.json',
    'frontier-symbolic-geometry-blindtest.rcl',
    'README.md',
  ]) assert.ok(fs.existsSync(path.join(dir, file)), file);
});
