import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  RCL_SANDBOX_COMPUTER_FILE_TRANSMISSION_VERSION,
  buildSandboxComputerTransmissionSpec,
  simulateSandboxComputerTransmission,
  judgeSandboxTransmission,
  runNegativeControlTransmission,
  runRenameInvariantTransmission,
  runSandboxComputerFileTransmissionProtocol,
  writeSandboxComputerFileTransmissionReports,
  renderSandboxComputerTransmissionRcl,
} from '../src/sandbox-computer-file-transmission-protocol.mjs';

test('v0.93 builds a sandbox computer transmission bundle', () => {
  const bundle = runSandboxComputerFileTransmissionProtocol();
  assert.equal(bundle.version, RCL_SANDBOX_COMPUTER_FILE_TRANSMISSION_VERSION);
  assert.equal(bundle.ok, true);
  assert.equal(bundle.result.canClaimSandboxFileTransmission, true);
  assert.equal(bundle.result.canClaimExternalUniverseFileChannel, false);
  assert.equal(bundle.result.canClaimFutureFileBackhaul, false);
});

test('lossless source-code probe round-trips with exact sha256', () => {
  const spec = buildSandboxComputerTransmissionSpec();
  const result = simulateSandboxComputerTransmission(spec);
  const judged = judgeSandboxTransmission(result, spec);
  assert.equal(judged.losslessHashPassRate, 1);
  const lossless = result.decoded.find(row => row.mode === 'lossless');
  assert.ok(lossless);
  assert.equal(lossless.exactHashMatches, true);
  assert.match(lossless.decodedText, /sampleTransfer/);
});

test('semantic Blue Sky slice translates to anchor-rich reconstruction', () => {
  const bundle = runSandboxComputerFileTransmissionProtocol();
  assert.ok(bundle.result.judge.semanticAnchorScore >= 0.82);
  const semantic = bundle.result.decoded.find(row => row.mode === 'semantic');
  assert.ok(semantic.translatedText.includes('命序界'));
  assert.ok(semantic.translatedText.includes('灰区'));
  assert.ok(semantic.translatedText.includes('万变'));
});

test('symbolic Imperium Aether slice preserves protocol structure', () => {
  const bundle = runSandboxComputerFileTransmissionProtocol();
  assert.ok(bundle.result.judge.symbolicProtocolScore >= 0.82);
  const symbolic = bundle.result.decoded.find(row => row.mode === 'symbolic');
  assert.ok(symbolic.translatedText.includes('White'));
  assert.ok(symbolic.translatedText.includes('Blue'));
  assert.ok(symbolic.translatedText.includes('Gold'));
});

test('blind manifest leaks no reveal name before scoring', () => {
  const bundle = runSandboxComputerFileTransmissionProtocol();
  assert.equal(bundle.result.leakage.leakageScore, 0);
  for (const row of bundle.result.blindManifest) {
    assert.doesNotMatch(JSON.stringify(row), /blue-sky-lore-judgment-slice|imperium-aether-language|sample\.mjs/);
  }
});

test('fixed agents transmit continuously and chunk order is shuffled', () => {
  const bundle = runSandboxComputerFileTransmissionProtocol();
  const agents = bundle.result.agentRegistry.map(agent => agent.id);
  assert.deepEqual(agents, ['SenderAgent', 'NoiseAgent', 'ReceiverAgent', 'DecoderAgent', 'JudgeAgent']);
  assert.ok(bundle.result.stepCount >= 12);
  assert.equal(bundle.result.judge.chunkOrderNotSequential, true);
});

test('negative control rejects tampered compressed chunks', () => {
  const negative = runNegativeControlTransmission();
  assert.equal(negative.ok, true);
  assert.equal(negative.negativeControlPassRate, 0);
});

test('renaming files does not affect reconstruction scores', () => {
  const rename = runRenameInvariantTransmission();
  assert.equal(rename.ok, true);
  assert.ok(rename.invariantScore >= 0.995);
});

test('reports write decoded files, transcript, and RCL spec', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-v093-'));
  const report = writeSandboxComputerFileTransmissionReports(dir);
  assert.equal(report.ok, true);
  assert.ok(fs.existsSync(path.join(dir, 'transmission-transcript.md')));
  assert.ok(fs.existsSync(path.join(dir, 'sandbox-computer-file-transmission.rcl')));
  assert.ok(fs.existsSync(path.join(dir, 'decoded')));
  const decoded = fs.readdirSync(path.join(dir, 'decoded'));
  assert.ok(decoded.length >= 3);
});

test('RCL source declares guards and evidence outputs', () => {
  const rcl = renderSandboxComputerTransmissionRcl(buildSandboxComputerTransmissionSpec());
  assert.match(rcl, /no_external_universe_proof/);
  assert.match(rcl, /require_hash_for_lossless/);
  assert.match(rcl, /Evidence|evidence_ledger/i);
});
