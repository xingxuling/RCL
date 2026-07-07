import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  DEFAULT_AKASHIC_RECORD_SPEC,
  normalizeAkashicRecordSpec,
  evaluateAkashicMechanism,
  runAkashicRecordCompiler,
  renderAkashicTechnicalDocument,
  renderAkashicRecordRcl,
  writeAkashicRecordReports,
  RCL_AKASHIC_RECORD_SPEC_FORMAT,
  RCL_AKASHIC_RECORD_RESULT_FORMAT,
} from '../src/akashic-record-compiler.mjs';

const cwd = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const bundle = runAkashicRecordCompiler();

function tempDir(name) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `rcl-${name}-`));
}

test('v0.56 normalizes Akashic record spec with mechanisms and negative controls', () => {
  const spec = normalizeAkashicRecordSpec(DEFAULT_AKASHIC_RECORD_SPEC);
  assert.equal(spec.format, RCL_AKASHIC_RECORD_SPEC_FORMAT);
  assert.ok(spec.mechanisms.length >= 10);
  assert.ok(spec.requiredNegativeControls.includes('omniscient_unfalsifiable_cosmic_library'));
  assert.ok(spec.thresholds.minPromotedCount >= 6);
});

test('v0.56 establishes finite Akashic mechanism family and rejects omniscience controls', () => {
  assert.equal(bundle.result.format, RCL_AKASHIC_RECORD_RESULT_FORMAT);
  assert.equal(bundle.result.akashicRecordEstablished, true);
  assert.equal(bundle.result.rclInternalized, true);
  assert.ok(bundle.result.promotedCount >= 6);
  assert.ok(bundle.result.recordClosureScore >= 0.68);
  assert.equal(bundle.result.negativeControlsRejected, true);
  assert.ok(bundle.result.rejectedMechanismIds.includes('omniscient_unfalsifiable_cosmic_library'));
  assert.ok(bundle.result.rejectedMechanismIds.includes('costless_past_future_exact_readout'));
  assert.ok(bundle.result.promotedMechanismIds.includes('akashic_substrate_memory_field'));
  assert.ok(bundle.result.promotedMechanismIds.includes('resonance_addressed_event_index'));
});

test('v0.56 decomposes Akashic Records into substrate, index, ledger and observer readout dimensions', () => {
  const spec = normalizeAkashicRecordSpec();
  const mechanism = spec.mechanisms.find(row => row.id === 'temporal_differential_trace_ledger');
  const row = evaluateAkashicMechanism(mechanism, spec);
  assert.equal(row.promoted, true);
  assert.ok(row.dimensions.ledgerTraceScore >= 0.50);
  assert.ok(row.dimensions.indexingScore >= 0.30);
  assert.ok(row.dimensions.falsifiabilityScore >= 0.58);
  const doc = renderAkashicTechnicalDocument(row, spec);
  assert.match(doc.markdown, /Temporal differential trace ledger/);
  assert.match(doc.markdown, /时间差分痕迹账本/);
  assert.match(doc.markdown, /Substrate Carrier（底层载体）/);
  assert.match(doc.markdown, /RCL Internalization（RCL 内化方式）/);
});

test('v0.56 renders RCL, writes reports and exposes CLI commands', () => {
  const rcl = renderAkashicRecordRcl();
  assert.match(rcl, /reality AkashicRecordCompiler/);
  assert.match(rcl, /validation.established : Truth = true/);
  const dir = tempDir('akashic-record');
  const reports = writeAkashicRecordReports(dir);
  assert.equal(reports.ok, true);
  assert.equal(fs.existsSync(path.join(dir, 'akashic-record-result.json')), true);
  assert.ok(fs.readdirSync(path.join(dir, 'technical-docs')).length >= 6);
  const demoOut = execFileSync('node', ['src/cli.mjs', 'akashic-record-demo'], { cwd, encoding: 'utf8' });
  const demo = JSON.parse(demoOut);
  assert.equal(demo.ok, true);
  assert.equal(demo.akashicRecordEstablished, true);
});
