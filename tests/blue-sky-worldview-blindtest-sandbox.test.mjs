import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  RCL_BLUE_SKY_WORLDVIEW_BLINDTEST_VERSION,
  buildBlueSkyWorldviewBlindtestSpec,
  compileBlueSkyKnowledgeAnchorBank,
  compileInnerUniverseFromBlueSkyWorldview,
  generateBlueSkyBlindPlanetDeck,
  blindTestBlueSkyPlanet,
  runBlueSkyPlanetBlindtestPressure,
  runBlueSkyWorldviewBlindtestSandbox,
  renderBlueSkyWorldviewBlindtestRcl,
  writeBlueSkyWorldviewBlindtestReports,
} from '../src/blue-sky-worldview-blindtest-sandbox.mjs';

test('v0.88 compiles Blue Sky worldview anchors before planet blindtesting', () => {
  const spec = buildBlueSkyWorldviewBlindtestSpec();
  assert.equal(spec.version, RCL_BLUE_SKY_WORLDVIEW_BLINDTEST_VERSION);
  const bank = compileBlueSkyKnowledgeAnchorBank(spec);
  assert.equal(bank.ok, true);
  assert.ok(bank.anchorCount >= 10);
  assert.equal(bank.boundaryAnchorPresent, true);
  assert.ok(bank.typeCounts.PRODUCT_INTERNAL >= 1);
  assert.ok(bank.typeCounts.MSL_KNOWLEDGE >= 1);
  assert.ok(bank.typeCounts.FICTIONAL_LORE >= 1);
});

test('v0.88 compiles inner universe from worldview anchors first', () => {
  const universe = compileInnerUniverseFromBlueSkyWorldview();
  assert.equal(universe.compiled, true);
  assert.equal(universe.boundary.canClaimExternalUniverseProof, false);
  assert.equal(universe.starSystem.name, '天机蓝轴系 / Tianji Blue Axis');
  assert.ok(universe.innerUniverseCoherence >= 0.78);
  assert.match(universe.universeHash, /^[a-f0-9]{64}$/);
});

test('v0.88 blind planet deck does not leak planet names or selected role', () => {
  const deck = generateBlueSkyBlindPlanetDeck();
  assert.equal(deck.leakageScore, 0);
  const redacted = JSON.stringify(deck.redactedDeck);
  assert.ok(!redacted.includes('青穹星'));
  assert.ok(!redacted.includes('Azure Canopy'));
  assert.ok(!redacted.includes('homeworld'));
  assert.ok(!redacted.includes('selected'));
});

test('v0.88 blindtest selects Qingqiong/Azure Canopy only after scoring', () => {
  const result = blindTestBlueSkyPlanet();
  assert.equal(result.ok, true);
  assert.equal(result.selectedCandidateId, 'planet_candidate_03');
  assert.equal(result.revealedAfterScoring.name, '青穹星 / Azure Canopy');
  assert.ok(result.blindConfidence >= 0.82);
  assert.ok(result.margin >= 0.08);
  assert.equal(result.leakageScore, 0);
});

test('v0.88 pressure test keeps the blind result stable under deterministic noise', () => {
  const pressure = runBlueSkyPlanetBlindtestPressure({ pressure: { iterations: 32 } });
  assert.equal(pressure.ok, true);
  assert.equal(pressure.iterations, 32);
  assert.ok(pressure.passRate >= 0.86);
  assert.equal(pressure.failedRows.length, 0);
});

test('v0.88 full sandbox calls federation, compiles universe, blindtests planet and writes reports', () => {
  const bundle = runBlueSkyWorldviewBlindtestSandbox({ pressure: { iterations: 16 } });
  assert.equal(bundle.ok, true);
  assert.equal(bundle.result.version, RCL_BLUE_SKY_WORLDVIEW_BLINDTEST_VERSION);
  assert.equal(bundle.result.worldviewAnchorsCompiled, true);
  assert.equal(bundle.result.innerUniverseCompiled, true);
  assert.equal(bundle.result.blindPlanetDetected, true);
  assert.equal(bundle.result.canClaimExternalUniverseProof, false);
  assert.equal(bundle.integrationCourt.verdict, 'passed_as_worldview_anchored_inner_universe_planet_blindtest');

  const outDir = path.join(os.tmpdir(), `rcl-v088-blue-sky-${Date.now()}`);
  fs.rmSync(outDir, { recursive: true, force: true });
  const report = writeBlueSkyWorldviewBlindtestReports(outDir, { pressure: { iterations: 12 } });
  assert.equal(report.ok, true);
  for (const file of [
    'blue-sky-worldview-blindtest-result.json',
    'blue-sky-worldview-blindtest-bundle.json',
    'blue-sky-knowledge-anchor-bank.md',
    'inner-universe-compile-report.md',
    'blue-sky-planet-blindtest-report.md',
    'anchored-dialogue-transcript.md',
    'pressure-test-report.md',
    'integration-court-verdict.md',
    'blue-sky-worldview-blindtest.rcl',
    'canonical-root.txt',
  ]) assert.ok(fs.existsSync(path.join(outDir, file)), file);
  assert.match(renderBlueSkyWorldviewBlindtestRcl(), /BlueSkyWorldviewBlindtestV088/);
});
