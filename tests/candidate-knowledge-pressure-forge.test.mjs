import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  DEFAULT_CANDIDATE_PRESSURE_FORGE_SPEC,
  normalizeCandidatePressureForgeSpec,
  runCandidateKnowledgePressureForge,
  evaluateCandidatePressure,
  renderCandidateTechnicalDocument,
  buildCandidatePressureForgeSpec,
  renderCandidatePressureForgeRcl,
  writeCandidatePressureForgeReports,
  RCL_CANDIDATE_PRESSURE_FORGE_SPEC_FORMAT,
  RCL_CANDIDATE_PRESSURE_FORGE_RESULT_FORMAT,
} from '../src/candidate-knowledge-pressure-forge.mjs';
import { runUnknownKnowledgeCompiler } from '../src/unknown-knowledge-compiler.mjs';
import { compileReality } from '../src/index.mjs';

const cwd = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

function tempDir(name) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `rcl-${name}-`));
}

test('v0.53 normalizes candidate pressure forge spec with expanded corpus', () => {
  const spec = normalizeCandidatePressureForgeSpec(DEFAULT_CANDIDATE_PRESSURE_FORGE_SPEC);
  assert.equal(spec.format, RCL_CANDIDATE_PRESSURE_FORGE_SPEC_FORMAT);
  assert.ok(spec.unknownKnowledge.candidates.length >= 18);
  assert.ok(spec.pressure.minimumPromotedCount >= 10);
  assert.ok(spec.documentTemplate.sections.includes('机制假设'));
});

test('v0.53 pressure forge expands candidates and establishes documentation pipeline', () => {
  const bundle = runCandidateKnowledgePressureForge();
  assert.equal(bundle.result.format, RCL_CANDIDATE_PRESSURE_FORGE_RESULT_FORMAT);
  assert.equal(bundle.result.pressureForgeEstablished, true);
  assert.ok(bundle.result.candidateCount >= 18);
  assert.ok(bundle.result.promotedCount >= 10);
  assert.ok(bundle.result.documentCount >= 10);
  assert.ok(bundle.result.averagePressureScore >= 0.82);
  assert.equal(bundle.result.negativeControlsRejected, true);
});

test('v0.53 rejects negative controls while promoting technical candidates', () => {
  const bundle = runCandidateKnowledgePressureForge();
  assert.ok(bundle.result.rejectedCandidateIds.includes('omniscient_interstice_oracle'));
  assert.ok(bundle.result.rejectedCandidateIds.includes('zero_heat_infinite_memory_core'));
  assert.ok(bundle.result.rejectedCandidateIds.includes('unlimited_vacuum_energy_drive'));
  assert.ok(bundle.result.technicalDocumentIds.includes('silicate_leakage_replay_cell'));
  assert.ok(bundle.result.technicalDocumentIds.includes('interstice_null_channel_readout'));
});

test('v0.53 candidate pressure rows preserve pressure and document readiness dimensions', () => {
  const unknown = runUnknownKnowledgeCompiler(DEFAULT_CANDIDATE_PRESSURE_FORGE_SPEC.unknownKnowledge);
  const candidate = unknown.result.candidates.find(row => row.id === 'silicate_leakage_replay_cell');
  const pressure = evaluateCandidatePressure(candidate, DEFAULT_CANDIDATE_PRESSURE_FORGE_SPEC);
  assert.equal(pressure.technicalDocumentEligible, true);
  assert.ok(pressure.pressureScore >= 0.82);
  assert.ok(pressure.dimensions.falsifierDensityScore >= 1);
  assert.ok(pressure.dimensions.blindPredictionDensityScore >= 1);
});

test('v0.53 renders natural language technical documents from promoted candidates', () => {
  const bundle = runCandidateKnowledgePressureForge();
  const doc = bundle.documents.find(row => row.id === 'silicate_leakage_replay_cell');
  assert.ok(doc);
  assert.match(doc.markdown, /# Silicate leakage replay cell/);
  assert.match(doc.markdown, /## 机制假设/);
  assert.match(doc.markdown, /## 可反证条件/);
  assert.match(doc.markdown, /## 技术实现路径/);
  const manual = renderCandidateTechnicalDocument(
    bundle.unknown.result.candidates.find(row => row.id === 'spectral_hydration_readout_protocol'),
    bundle.pressures.find(row => row.id === 'spectral_hydration_readout_protocol'),
    bundle.spec,
  );
  assert.match(manual.markdown, /光|spectral|Spectral/);
});

test('v0.53 renders compilable RCL and writes reports plus markdown documents', () => {
  const spec = buildCandidatePressureForgeSpec();
  const rcl = renderCandidatePressureForgeRcl(spec);
  assert.match(rcl, /reality CandidateKnowledgePressureForge/);
  assert.match(rcl, /pressure_forge_established : Truth = true/);
  const compiled = compileReality(rcl);
  assert.match(compiled.programRoot, /^[0-9a-f]{64}$/);
  const dir = tempDir('candidate-pressure-forge');
  const reports = writeCandidatePressureForgeReports(dir);
  assert.equal(reports.ok, true);
  assert.equal(fs.existsSync(path.join(dir, 'candidate-pressure-forge-result.json')), true);
  assert.equal(fs.existsSync(path.join(dir, 'candidate-pressure-forge.rcl')), true);
  assert.equal(fs.existsSync(path.join(dir, 'candidate-technical-documents.json')), true);
  assert.ok(reports.documentFiles.length >= 10);
  assert.equal(fs.existsSync(path.join(dir, reports.documentFiles[0])), true);
});

test('v0.53 exposes CLI demo, run and spec commands', () => {
  const demoOut = execFileSync('node', ['src/cli.mjs', 'candidate-pressure-forge-demo'], { cwd, encoding: 'utf8' });
  const demo = JSON.parse(demoOut);
  assert.equal(demo.ok, true);
  assert.equal(demo.pressureForgeEstablished, true);
  const runDir = tempDir('candidate-pressure-forge-cli');
  const runOut = execFileSync('node', ['src/cli.mjs', 'candidate-pressure-forge-run', 'examples/candidate-pressure-forge/default-pressure-corpus.json', runDir], { cwd, encoding: 'utf8' });
  const run = JSON.parse(runOut);
  assert.equal(run.ok, true);
  assert.equal(fs.existsSync(path.join(runDir, 'candidate-pressure-forge-bundle.json')), true);
  assert.ok(fs.readdirSync(path.join(runDir, 'technical-docs')).length >= 10);
  const specDir = tempDir('candidate-pressure-forge-spec');
  const specOut = execFileSync('node', ['src/cli.mjs', 'candidate-pressure-forge-spec', specDir], { cwd, encoding: 'utf8' });
  assert.equal(JSON.parse(specOut).ok, true);
  assert.equal(fs.existsSync(path.join(specDir, 'candidate-pressure-forge-spec.json')), true);
});
