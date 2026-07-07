import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  RCL_AUTONOMOUS_SANDBOX_FILE_EMISSION_VERSION,
  DEFAULT_AUTONOMOUS_SANDBOX_VFS,
  buildAutonomousSandboxFileEmissionSpec,
  discoverAutonomousVirtualFiles,
  simulateAutonomousSandboxFileEmission,
  judgeAutonomousSandboxFileEmission,
  runAutonomousEmissionNegativeControl,
  runAutonomousEmissionRenameInvariant,
  runAutonomousSandboxFileEmissionProtocol,
  renderAutonomousSandboxFileEmissionRcl,
  writeAutonomousSandboxFileEmissionReports,
} from '../src/autonomous-sandbox-file-emission-protocol.mjs';

test('v0.94 builds autonomous sandbox file emission bundle', () => {
  const bundle = runAutonomousSandboxFileEmissionProtocol();
  assert.equal(bundle.version, RCL_AUTONOMOUS_SANDBOX_FILE_EMISSION_VERSION);
  assert.equal(bundle.ok, true);
  assert.equal(bundle.result.canClaimAutonomousSandboxFileEmission, true);
  assert.equal(bundle.result.canClaimExternalUniverseFileChannel, false);
  assert.equal(bundle.result.canClaimBackgroundAgentRuntime, false);
  assert.equal(bundle.result.canClaimHostFilesystemUpload, false);
});

test('agents discover all visible VFS files without user preselection', () => {
  const spec = buildAutonomousSandboxFileEmissionSpec();
  const discovered = discoverAutonomousVirtualFiles(spec);
  const result = simulateAutonomousSandboxFileEmission(spec);
  const judge = judgeAutonomousSandboxFileEmission(result, spec);
  assert.equal(discovered.length, DEFAULT_AUTONOMOUS_SANDBOX_VFS.files.length);
  assert.equal(judge.manualPreselectionCount, 0);
  assert.equal(judge.allVisibleFilesTransmitted, true);
  assert.equal(judge.autonomousSelectionRate, 1);
});

test('first experiment does not filter by file extension inside virtual FS', () => {
  const result = simulateAutonomousSandboxFileEmission();
  const revealedModes = new Set(result.decoded.map(row => row.mode));
  const revealedPaths = result.decoded.map(row => row.revealAfterScoring.virtualPath);
  assert.ok(revealedPaths.some(p => p.endsWith('.rclpack')));
  assert.ok(revealedPaths.some(p => p.endsWith('.trace.json')));
  assert.ok(revealedPaths.some(p => p.endsWith('.rcl')));
  assert.ok(revealedModes.has('opaque'));
  assert.ok(revealedModes.has('symbolic'));
});

test('all autonomously emitted files round-trip with exact hash', () => {
  const result = simulateAutonomousSandboxFileEmission();
  const judge = judgeAutonomousSandboxFileEmission(result);
  assert.equal(judge.hashPassRate, 1);
  for (const row of result.decoded) assert.equal(row.exactHashMatches, true);
});

test('semantic and symbolic files are translated after autonomous upload', () => {
  const bundle = runAutonomousSandboxFileEmissionProtocol();
  assert.ok(bundle.result.judge.semanticTranslationCount >= 2);
  const semantic = bundle.result.decoded.find(row => row.mode === 'semantic' && row.translatedText.includes('蓝天机'));
  const symbolic = bundle.result.decoded.find(row => row.mode === 'symbolic' && row.translatedText.includes('White'));
  assert.ok(semantic);
  assert.ok(symbolic);
});

test('blind deck leaks no virtual path before reveal', () => {
  const result = simulateAutonomousSandboxFileEmission();
  assert.equal(result.leakage.leakageScore, 0);
  for (const row of result.blindDeck) {
    assert.doesNotMatch(JSON.stringify(row), /autonomous-emission-kernel|unsolicited-blue-sky|imperium-civ-block|debug-replay-runtime|unknown-signal|multicivilization-note/);
  }
});

test('fixed agents are proactive and not user-request gated', () => {
  const bundle = runAutonomousSandboxFileEmissionProtocol();
  const agents = bundle.result.agentRegistry.map(agent => agent.id);
  assert.deepEqual(agents, ['AutonomousScoutAgent', 'AutonomousSenderAgent', 'NoiseAgent', 'ReceiverAgent', 'DecoderTranslatorAgent', 'JudgeAgent']);
  assert.ok(bundle.result.senderIntentLog.length >= DEFAULT_AUTONOMOUS_SANDBOX_VFS.files.length);
  assert.ok(bundle.result.senderIntentLog.every(row => row.action === 'emit_without_user_prompt'));
});

test('negative control rejects tampered autonomous payload', () => {
  const negative = runAutonomousEmissionNegativeControl();
  assert.equal(negative.ok, true);
  assert.equal(negative.negativeControlPassRate, 0);
});

test('renaming virtual paths does not affect autonomous scoring', () => {
  const rename = runAutonomousEmissionRenameInvariant();
  assert.equal(rename.ok, true);
  assert.ok(rename.invariantScore >= 0.995);
});

test('reports write transcript, evidence ledger, decoded files, and RCL spec', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-v094-'));
  const report = writeAutonomousSandboxFileEmissionReports(dir);
  assert.equal(report.ok, true);
  assert.ok(fs.existsSync(path.join(dir, 'transmission-transcript.md')));
  assert.ok(fs.existsSync(path.join(dir, 'evidence-ledger.json')));
  assert.ok(fs.existsSync(path.join(dir, 'autonomous-sandbox-file-emission.rcl')));
  const decoded = fs.readdirSync(path.join(dir, 'decoded'));
  assert.ok(decoded.length >= DEFAULT_AUTONOMOUS_SANDBOX_VFS.files.length);
});

test('RCL source states open VFS discovery and host FS boundary', () => {
  const rcl = renderAutonomousSandboxFileEmissionRcl(buildAutonomousSandboxFileEmissionSpec());
  assert.match(rcl, /all_discoverable_visible_file_cells/);
  assert.match(rcl, /type_whitelist = none/);
  assert.match(rcl, /no_host_filesystem_access/);
});
