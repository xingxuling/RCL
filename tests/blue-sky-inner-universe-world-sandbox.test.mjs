import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  RCL_BLUE_SKY_INNER_UNIVERSE_WORLD_SANDBOX_VERSION,
  buildBlueSkyInnerUniverseWorldSpec,
  buildBlueSkyWorldviewAnchorSet,
  compileBlueSkyInnerUniverse,
  runBlueSkyPlanetBlindTest,
  runBlueSkyInnerUniverseWorldSandbox,
  renderBlueSkyInnerUniverseWorldRcl,
  writeBlueSkyInnerUniverseWorldReports,
} from '../src/blue-sky-inner-universe-world-sandbox.mjs';

test('v0.88 loads Blue Sky worldview anchors before compiling the inner universe', () => {
  const spec = buildBlueSkyInnerUniverseWorldSpec();
  assert.equal(spec.version, RCL_BLUE_SKY_INNER_UNIVERSE_WORLD_SANDBOX_VERSION);
  const anchors = buildBlueSkyWorldviewAnchorSet(spec);
  assert.equal(anchors.ok, true);
  assert.equal(anchors.anchors.length, 7);
  assert.equal(anchors.boundaryAnchorPresent, true);
  assert.ok(anchors.coverage >= 0.9);
});

test('v0.88 compiles a lore-bounded inner universe before planet blindtest', () => {
  const universe = compileBlueSkyInnerUniverse();
  assert.equal(universe.ok, true);
  assert.equal(universe.universe.containmentModel, 'sandbox_fictional_lore_world_not_external_universe_proof');
  assert.equal(universe.universe.starSystem.name, '天机蓝轴系 / Tianji Blue Axis');
  assert.ok(universe.compiledScore >= 0.98);
});

test('v0.88 blind-tests planet candidates without leaking names before scoring', () => {
  const spec = buildBlueSkyInnerUniverseWorldSpec();
  const universe = compileBlueSkyInnerUniverse(spec);
  const blind = runBlueSkyPlanetBlindTest(spec, universe);
  assert.equal(blind.ok, true);
  assert.equal(blind.blindProtocol.namesHiddenBeforeScoring, true);
  assert.equal(blind.revealedWinner.name, '澄蓝机星 / Azure Machina');
  assert.equal(blind.revealedWinner.score, 1);
  assert.ok(blind.topGap >= 0.04);
  assert.equal(blind.stabilityRate, 1);
  const hidden = JSON.stringify(blind.hiddenRanking);
  assert.ok(!hidden.includes('澄蓝机星'));
  assert.ok(!hidden.includes('Azure Machina'));
});

test('v0.88 runs world-grounded dialogue instead of v0.87 protocol echo', () => {
  const bundle = runBlueSkyInnerUniverseWorldSandbox();
  assert.equal(bundle.ok, true);
  assert.equal(bundle.result.correctedWorkflow, 'blue_sky_worldview_anchors -> compile_inner_universe -> blind_test_planet -> world_grounded_dialogue');
  assert.equal(bundle.result.canClaimExternalUniverseProof, false);
  assert.equal(bundle.result.blindPlanetWinner, '澄蓝机星 / Azure Machina');
  assert.equal(bundle.dialogue.turns.length, 6);
  assert.ok(bundle.dialogue.turns.some((turn) => turn.blueSkyMachine.includes('同频岛')));
  assert.ok(bundle.dialogue.turns.some((turn) => turn.blueSkyMachine.includes('Aetherworld/RNCS')));
  assert.equal(bundle.integrationCourt.verdict, 'passed_as_world_first_blue_sky_sandbox');
});

test('v0.88 fails safely when fictional lore guard is disabled', () => {
  const unsafe = compileBlueSkyInnerUniverse(buildBlueSkyInnerUniverseWorldSpec({ policies: { fictionalLoreBoundaryRequired: false } }));
  assert.equal(unsafe.ok, false);
  assert.equal(unsafe.reason, 'fictional_lore_or_external_proof_guard_disabled');
});

test('v0.88 writes reports, transcript, RCL and canonical root', () => {
  const outDir = path.join(os.tmpdir(), `rcl-v088-blue-sky-world-${Date.now()}`);
  fs.rmSync(outDir, { recursive: true, force: true });
  const report = writeBlueSkyInnerUniverseWorldReports(outDir);
  assert.equal(report.ok, true);
  for (const file of [
    'blue-sky-inner-universe-world-result.json',
    'blue-sky-inner-universe-world-bundle.json',
    'blue-sky-worldview-anchors.md',
    'inner-universe-compiled-world.md',
    'blind-planet-test-report.md',
    'world-grounded-dialogue-transcript.md',
    'integration-court-verdict.md',
    'blue-sky-inner-universe-world-sandbox.rcl',
    'canonical-root.txt',
  ]) assert.ok(fs.existsSync(path.join(outDir, file)), file);
  assert.match(renderBlueSkyInnerUniverseWorldRcl(), /BlueSkyInnerUniverseWorldSandboxV088/);
});
