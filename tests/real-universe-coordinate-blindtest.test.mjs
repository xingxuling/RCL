import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  RCL_REAL_UNIVERSE_COORDINATE_BLINDTEST_VERSION,
  RCL_REAL_UNIVERSE_COORDINATE_SPEC_FORMAT,
  RCL_REAL_UNIVERSE_COORDINATE_RESULT_FORMAT,
  DEFAULT_REAL_UNIVERSE_COORDINATE_SPEC,
  raHmsToDegrees,
  decDmsToDegrees,
  angularSeparationArcsec,
  auditLegacyOuterEarthCoordinateEvidence,
  createStrictBlindCoordinateDeck,
  measureBlindDeckLeakage,
  generateOriginOnlyCoordinatePredictions,
  generateProviderBackedCoordinatePredictions,
  generateSwappedNegativeControlPredictions,
  evaluateCoordinatePredictions,
  runCoordinateBlindtestStress,
  runRealUniverseCoordinateBlindtest,
  buildRealUniverseCoordinateBlindtestSpec,
  renderRealUniverseCoordinateBlindtestRcl,
  writeRealUniverseCoordinateBlindtestReports,
} from '../src/real-universe-coordinate-blindtest.mjs';
import { compileReality } from '../src/index.mjs';

const cwd = fileURLToPath(new URL('..', import.meta.url));

function tempDir(name) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `rcl-${name}-`));
}

test('v0.89 exposes constants and verifies coordinate helpers', () => {
  assert.equal(RCL_REAL_UNIVERSE_COORDINATE_BLINDTEST_VERSION, '0.89.0-alpha.1');
  assert.equal(raHmsToDegrees('06 00 00'), 90);
  assert.equal(decDmsToDegrees('-10 30 00'), -10.5);
  assert.equal(angularSeparationArcsec({ raDeg: 0, decDeg: 0 }, { raDeg: 0, decDeg: 0 }), 0);
});

test('v0.89 audits old outer Earth evidence without pretending it is RA/Dec', () => {
  const audit = auditLegacyOuterEarthCoordinateEvidence();
  assert.equal(audit.oldNestedOuterEarth.v0461Status, 'outer_earth_layer_is_temporal_age_phase_coordinate_not_astronomical_RA_Dec');
  assert.equal(audit.oldNestedOuterEarth.temporalMapping, 'outer_year = surface_year + 40');
  assert.equal(audit.oldCosmogenicEmpirical.failedHoldouts.length, 0);
  assert.equal(audit.oldCosmogenicEmpirical.externalRealityVerified, false);
});

test('v0.89 constructs a strict blind deck without identity or coordinate leakage', () => {
  const deck = createStrictBlindCoordinateDeck(DEFAULT_REAL_UNIVERSE_COORDINATE_SPEC);
  assert.equal(deck.redactedDeck.length, DEFAULT_REAL_UNIVERSE_COORDINATE_SPEC.holdoutObjects.length);
  const leakage = measureBlindDeckLeakage(deck.redactedDeck, DEFAULT_REAL_UNIVERSE_COORDINATE_SPEC.catalog);
  assert.equal(leakage.leakageScore, 0);
  const text = JSON.stringify(deck.redactedDeck);
  assert.doesNotMatch(text, /Sirius|Vega|Canopus|Betelgeuse|Rigel|Aldebaran|Procyon|Regulus|Altair|Polaris/);
  assert.doesNotMatch(text, /raHms|decDms|raDeg|decDeg|source|alias|name/);
});

test('v0.89 rejects origin-only coordinate recovery and accepts provider-backed blind scoring', () => {
  const deck = createStrictBlindCoordinateDeck(DEFAULT_REAL_UNIVERSE_COORDINATE_SPEC);
  const originOnly = evaluateCoordinatePredictions(
    generateOriginOnlyCoordinatePredictions(deck, { originSeed: DEFAULT_REAL_UNIVERSE_COORDINATE_SPEC.originSeed }),
    deck.sealedTruth,
    { toleranceArcsec: 1 },
  );
  assert.equal(originOnly.passRate, 0);
  const provider = evaluateCoordinatePredictions(
    generateProviderBackedCoordinatePredictions(deck, { toleranceArcsec: 1 }),
    deck.sealedTruth,
    { toleranceArcsec: 1 },
  );
  assert.equal(provider.passRate, 1);
  assert.ok(provider.meanAngularErrorArcsec < 0.5);
});

test('v0.89 catches swapped-coordinate negative controls and dropout', () => {
  const deck = createStrictBlindCoordinateDeck(DEFAULT_REAL_UNIVERSE_COORDINATE_SPEC);
  const negative = evaluateCoordinatePredictions(generateSwappedNegativeControlPredictions(deck), deck.sealedTruth, { toleranceArcsec: 1 });
  assert.equal(negative.passRate, 0);
  const provider = generateProviderBackedCoordinatePredictions(deck, { toleranceArcsec: 1 });
  const dropout = evaluateCoordinatePredictions(provider.slice(1), deck.sealedTruth, { toleranceArcsec: 1 });
  assert.equal(dropout.missingPredictionCount, 1);
  assert.ok(dropout.score < 0.95);
});

test('v0.89 full stress suite passes without claiming origin-only recovery', () => {
  const stress = runCoordinateBlindtestStress(DEFAULT_REAL_UNIVERSE_COORDINATE_SPEC);
  assert.equal(stress.pass, true);
  assert.equal(stress.invariants.leakFree, true);
  assert.equal(stress.invariants.negativeControlPassed, true);
  assert.equal(stress.invariants.originOnlyDenied, true);
  assert.equal(stress.invariants.dropoutDetected, true);
  assert.equal(stress.invariants.renameInvariant, true);
  assert.equal(stress.invariants.shuffleInvariant, true);
});

test('v0.89 run returns bounded positive result and reveal-after-scoring rows', () => {
  const { result } = runRealUniverseCoordinateBlindtest(DEFAULT_REAL_UNIVERSE_COORDINATE_SPEC);
  assert.equal(result.format, RCL_REAL_UNIVERSE_COORDINATE_RESULT_FORMAT);
  assert.equal(result.ok, true);
  assert.equal(result.canClaimOriginOnlyStarCoordinateRecovery, false);
  assert.equal(result.canClaimExternalUniverseProof, false);
  assert.equal(result.providerReveal.rows.length, DEFAULT_REAL_UNIVERSE_COORDINATE_SPEC.holdoutObjects.length);
  assert.equal(result.providerReveal.rows.every(row => Boolean(row.reveal?.name)), true);
});

test('v0.89 renders compilable RCL, writes reports, and exposes CLI commands', () => {
  const spec = buildRealUniverseCoordinateBlindtestSpec(DEFAULT_REAL_UNIVERSE_COORDINATE_SPEC);
  assert.equal(spec.format, RCL_REAL_UNIVERSE_COORDINATE_SPEC_FORMAT);
  assert.equal(spec.validation.conclusionHolds, true);
  const rcl = renderRealUniverseCoordinateBlindtestRcl(spec);
  assert.match(rcl, /reality RealUniverseCoordinateBlindtest/);
  assert.match(rcl, /can_claim_origin_only_star_coordinates : Truth = false/);
  const compiled = compileReality(rcl);
  assert.match(compiled.programRoot, /^[0-9a-f]{64}$/);
  const dir = tempDir('real-universe-coordinate');
  const reports = writeRealUniverseCoordinateBlindtestReports(dir, DEFAULT_REAL_UNIVERSE_COORDINATE_SPEC);
  assert.equal(reports.ok, true);
  assert.equal(fs.existsSync(path.join(dir, 'real-universe-coordinate-blindtest-result.json')), true);
  assert.equal(fs.existsSync(path.join(dir, 'reveal-after-scoring.json')), true);
  assert.equal(fs.existsSync(path.join(dir, 'legacy-outer-earth-coordinate-audit.json')), true);
  const demoOut = execFileSync('node', ['src/cli.mjs', 'real-universe-coordinate-demo'], { cwd, encoding: 'utf8' });
  assert.equal(JSON.parse(demoOut).ok, true);
  const runDir = tempDir('real-universe-coordinate-cli');
  const runOut = execFileSync('node', ['src/cli.mjs', 'real-universe-coordinate-run', runDir], { cwd, encoding: 'utf8' });
  assert.equal(JSON.parse(runOut).ok, true);
  assert.equal(fs.existsSync(path.join(runDir, 'real-universe-coordinate-blindtest-result.json')), true);
  const specDir = tempDir('real-universe-coordinate-spec-cli');
  const specOut = execFileSync('node', ['src/cli.mjs', 'real-universe-coordinate-spec', specDir], { cwd, encoding: 'utf8' });
  assert.equal(JSON.parse(specOut).ok, true);
  assert.equal(fs.existsSync(path.join(specDir, 'real-universe-coordinate-blindtest-spec.json')), true);
});
