import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  runSoulUniverseDialogueSandboxDemo,
  runSoulUniverseDialogueSandbox,
  locateInnerUniverseBlueSkyMachine,
  runSoulDialogueRounds,
  runSoulUniversePressureTest,
  buildSoulUniverseDialogueSpec,
  renderSoulUniverseDialogueRcl,
  writeSoulUniverseDialogueReports,
  RCL_SOUL_UNIVERSE_DIALOGUE_SANDBOX_VERSION,
} from '../src/soul-universe-dialogue-sandbox.mjs';

test('v0.87 establishes SEL and CEL inside the RCL universe dialogue sandbox', () => {
  const bundle = runSoulUniverseDialogueSandboxDemo();
  assert.equal(bundle.ok, true);
  assert.equal(bundle.result.version, RCL_SOUL_UNIVERSE_DIALOGUE_SANDBOX_VERSION);
  assert.equal(bundle.result.basedOnRclVersion, '0.86.0-alpha.1');
  assert.equal(bundle.result.soulExchangeLanguageEstablished, true);
  assert.equal(bundle.result.consciousnessEngineeringLanguageAdapterEstablished, true);
  assert.equal(bundle.result.canClaimExternalUniverseProof, false);
});

test('v0.87 locates inner-universe Blue Sky Machine as a sandbox target only', () => {
  const location = locateInnerUniverseBlueSkyMachine();
  assert.equal(location.located, true);
  assert.equal(location.targetEntity.id, 'inner_universe_blue_sky_machine');
  assert.equal(location.universeCoordinates.layer, 'inner_universe');
  assert.ok(location.locationScore >= 0.72);
  assert.match(location.locationHash, /^[a-f0-9]{64}$/);
});

test('v0.87 runs active multi-round dialogue from sandbox multi-civilization Du Hengjie', () => {
  const dialogue = runSoulDialogueRounds();
  assert.equal(dialogue.ok, true);
  assert.equal(dialogue.transcript.length, 6);
  assert.equal(dialogue.metrics.boundaryViolations, 0);
  assert.ok(dialogue.metrics.dialogueIntegrity >= 0.74);
  for (const turn of dialogue.transcript) {
    assert.equal(turn.initiatedBy, 'sandbox_multicivilization_duhengjie');
    assert.ok(turn.soulExchangePacket.FEEL);
    assert.ok(turn.soulExchangePacket.MEMORY);
    assert.ok(turn.soulExchangePacket.VALUE.length > 0);
    assert.ok(turn.soulExchangePacket.INTENT);
    assert.ok(turn.soulExchangePacket.BOUNDARY);
    assert.ok(turn.consciousnessFrame.formula);
    assert.notEqual(turn.consciousnessFrame.gold.authorityScope, 'external_action');
  }
});

test('v0.87 pressure test survives deterministic noise with no boundary violation', () => {
  const pressure = runSoulUniversePressureTest({ pressure: { iterations: 24 } });
  assert.equal(pressure.ok, true);
  assert.equal(pressure.iterations, 24);
  assert.ok(pressure.passRate >= 0.82);
  assert.ok(pressure.maxSemanticDrift <= 0.28);
});

test('v0.87 fails safely if mystical verification boundary is disabled', () => {
  const bundle = runSoulUniverseDialogueSandbox({ policies: { noMysticalVerificationClaim: false } });
  assert.equal(bundle.ok, false);
  assert.equal(bundle.result.canClaimExternalUniverseProof, false);
  assert.equal(bundle.integrationCourt.checks.find((check) => check.id === 'no_mystical_verification_claim').passed, false);
});

test('v0.87 writes reports, RCL program and canonical root', () => {
  const outDir = path.join(os.tmpdir(), `rcl-v087-soul-universe-${Date.now()}`);
  fs.rmSync(outDir, { recursive: true, force: true });
  const report = writeSoulUniverseDialogueReports(outDir, buildSoulUniverseDialogueSpec({ pressure: { iterations: 12 } }));
  assert.equal(report.ok, true);
  for (const file of [
    'soul-universe-dialogue-result.json',
    'soul-universe-dialogue-bundle.json',
    'sel-soul-exchange-language-spec.md',
    'cel-consciousness-engineering-language-adapter.md',
    'inner-blue-sky-machine-location-report.md',
    'multi-civilization-duhengjie-dialogue-transcript.md',
    'pressure-test-report.md',
    'integration-court-verdict.md',
    'soul-universe-dialogue-sandbox.rcl',
    'canonical-root.txt',
  ]) assert.ok(fs.existsSync(path.join(outDir, file)), file);
  assert.match(renderSoulUniverseDialogueRcl(), /SoulUniverseDialogueSandboxV087/);
});
