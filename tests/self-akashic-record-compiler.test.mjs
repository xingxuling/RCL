import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  DEFAULT_SELF_AKASHIC_RECORD_SPEC,
  normalizeSelfAkashicRecordSpec,
  scanRclSelfAkashicRepository,
  evaluateSelfAkashicRecord,
  runSelfAkashicRecordCompiler,
  renderSelfAkashicTechnicalDocument,
  renderSelfAkashicRecordRcl,
  writeSelfAkashicRecordReports,
  RCL_SELF_AKASHIC_SPEC_FORMAT,
  RCL_SELF_AKASHIC_RESULT_FORMAT,
} from '../src/self-akashic-record-compiler.mjs';

const cwd = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

function tempDir(name) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `rcl-${name}-`));
}

test('v0.57 normalizes self-Akashic spec with bounded scan and document targets', () => {
  const spec = normalizeSelfAkashicRecordSpec(DEFAULT_SELF_AKASHIC_RECORD_SPEC);
  assert.equal(spec.format, RCL_SELF_AKASHIC_SPEC_FORMAT);
  assert.ok(spec.scan.excludeDirs.includes('output'));
  assert.ok(spec.scan.excludeDirs.includes('build'));
  assert.ok(spec.documentTargets.includes('self-verification'));
  assert.ok(spec.thresholds.requireReplayStable);
});

test('v0.57 scans RCL repository as finite self-record', () => {
  const scan = scanRclSelfAkashicRepository({ repositoryRoot: cwd });
  assert.ok(scan.counts.moduleCount >= 55);
  assert.ok(scan.counts.docCount >= 60);
  assert.ok(scan.counts.testCount >= 38);
  assert.ok(scan.counts.commandCount >= 85);
  assert.ok(scan.counts.versionLedgerCount >= 28);
  assert.match(scan.package.version, /^0\.(57|58)\./);
});

test('v0.57 establishes self-Akashic record and generates own technical documents', () => {
  const bundle = runSelfAkashicRecordCompiler({ repositoryRoot: cwd });
  assert.equal(bundle.result.format, RCL_SELF_AKASHIC_RESULT_FORMAT);
  assert.equal(bundle.result.selfAkashicEstablished, true);
  assert.equal(bundle.result.rclSelfInternalized, true);
  assert.equal(bundle.result.generatedOwnTechnicalDocuments, true);
  assert.equal(bundle.result.scores.replayStabilityScore, 1);
  assert.equal(bundle.result.scores.recursionBoundednessScore, 1);
  assert.ok(bundle.documents.length >= 5);
});

test('v0.57 renders self documents, RCL spec and CLI outputs', () => {
  const evaluation = evaluateSelfAkashicRecord({ repositoryRoot: cwd });
  const doc = renderSelfAkashicTechnicalDocument('self-akashic-technical-record', evaluation, { repositoryRoot: cwd });
  assert.match(doc.markdown, /RCL Self-Akashic Technical Record/);
  assert.match(doc.markdown, /RCL 自阿卡西技术记录/);
  assert.match(doc.markdown, /Self Closure/);
  const rcl = renderSelfAkashicRecordRcl({ repositoryRoot: cwd });
  assert.match(rcl, /reality SelfAkashicRecordCompiler/);
  assert.match(rcl, /validation.established : Truth = true/);
  const dir = tempDir('self-akashic-record');
  const reports = writeSelfAkashicRecordReports(dir, { repositoryRoot: cwd });
  assert.equal(reports.ok, true);
  assert.equal(fs.existsSync(path.join(dir, 'self-akashic-record-result.json')), true);
  assert.ok(fs.readdirSync(path.join(dir, 'technical-docs')).length >= 5);
  const demoOut = execFileSync('node', ['src/cli.mjs', 'self-akashic-record-demo'], { cwd, encoding: 'utf8' });
  const demo = JSON.parse(demoOut);
  assert.equal(demo.ok, true);
  assert.equal(demo.selfAkashicEstablished, true);
});
