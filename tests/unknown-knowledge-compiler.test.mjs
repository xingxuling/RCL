import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  DEFAULT_UNKNOWN_KNOWLEDGE_SPEC,
  normalizeUnknownKnowledgeSpec,
  extractUnknownKnowledgeStructure,
  scoreUnknownKnowledgeCandidate,
  generateUnknownKnowledgePredictions,
  compileUnknownKnowledgeCandidate,
  runUnknownKnowledgeCompiler,
  buildUnknownKnowledgeSpec,
  renderUnknownKnowledgeRcl,
  writeUnknownKnowledgeReports,
  RCL_UNKNOWN_KNOWLEDGE_SPEC_FORMAT,
  RCL_UNKNOWN_KNOWLEDGE_RESULT_FORMAT,
} from '../src/unknown-knowledge-compiler.mjs';
import { compileReality } from '../src/index.mjs';

const cwd = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

function tempDir(name) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `rcl-${name}-`));
}

test('v0.49 normalizes unknown knowledge compiler spec', () => {
  const spec = normalizeUnknownKnowledgeSpec(DEFAULT_UNKNOWN_KNOWLEDGE_SPEC);
  assert.equal(spec.format, RCL_UNKNOWN_KNOWLEDGE_SPEC_FORMAT);
  assert.equal(spec.boundary, 'candidate_knowledge_not_truth_claim');
  assert.ok(spec.candidates.length >= 4);
  assert.ok(spec.locks.minimumPredictions >= 3);
});

test('v0.49 extracts anchors, domains, numbers and falsifiers from unknown text', () => {
  const structure = extractUnknownKnowledgeStructure(DEFAULT_UNKNOWN_KNOWLEDGE_SPEC.candidates[1]);
  assert.equal(structure.id, 'outer_surface_memory_leak_anchor');
  assert.ok(structure.domains.some(row => row.domain === 'anomaly'));
  assert.ok(structure.years.includes(2062));
  assert.ok(structure.years.includes(2022));
  assert.ok(structure.anchorTerms.includes('柳清莲'));
  assert.ok(structure.explicitFalsifiers.length >= 3);
});

test('v0.49 scores testable candidates above unbounded non-falsifiable claims', () => {
  const good = scoreUnknownKnowledgeCandidate(DEFAULT_UNKNOWN_KNOWLEDGE_SPEC.candidates[0]);
  const bad = scoreUnknownKnowledgeCandidate(DEFAULT_UNKNOWN_KNOWLEDGE_SPEC.candidates[3]);
  assert.ok(good.scores.falsifiabilityScore > bad.scores.falsifiabilityScore);
  assert.ok(good.scores.empiricalCompatibilityScore > bad.scores.empiricalCompatibilityScore);
  assert.ok(good.scores.candidateKnowledgeScore > bad.scores.candidateKnowledgeScore);
});

test('v0.49 generates holdout-style predictions with failure conditions', () => {
  const structure = extractUnknownKnowledgeStructure(DEFAULT_UNKNOWN_KNOWLEDGE_SPEC.candidates[0]);
  const predictions = generateUnknownKnowledgePredictions(structure);
  assert.ok(predictions.length >= 3);
  assert.ok(predictions.every(row => row.failureCondition && row.status === 'pending_observation'));
});

test('v0.49 compiles individual candidates and rejects unlimited vacuum drive', () => {
  const good = compileUnknownKnowledgeCandidate(DEFAULT_UNKNOWN_KNOWLEDGE_SPEC.candidates[0], DEFAULT_UNKNOWN_KNOWLEDGE_SPEC);
  const bad = compileUnknownKnowledgeCandidate(DEFAULT_UNKNOWN_KNOWLEDGE_SPEC.candidates[3], DEFAULT_UNKNOWN_KNOWLEDGE_SPEC);
  assert.equal(good.externalRealityVerified, false);
  assert.equal(good.promoted, true);
  assert.equal(bad.promoted, false);
  assert.match(bad.status, /rejected|speculative/);
});

test('v0.49 run promotes at least one candidate while preserving truth boundary', () => {
  const { result } = runUnknownKnowledgeCompiler(DEFAULT_UNKNOWN_KNOWLEDGE_SPEC);
  assert.equal(result.format, RCL_UNKNOWN_KNOWLEDGE_RESULT_FORMAT);
  assert.equal(result.conclusionHolds, true);
  assert.equal(result.externalRealityVerified, false);
  assert.ok(result.promotedCount >= 1);
  assert.ok(result.aggregateLockScore >= 0.70);
  assert.ok(result.rejectedCandidateIds.includes('unlimited_vacuum_energy_drive'));
});

test('v0.49 renders compilable RCL and writes evidence reports', () => {
  const spec = buildUnknownKnowledgeSpec(DEFAULT_UNKNOWN_KNOWLEDGE_SPEC);
  const rcl = renderUnknownKnowledgeRcl(spec);
  assert.match(rcl, /reality UnknownKnowledgeCompiler/);
  assert.match(rcl, /validation\.external_reality_verified : Truth = false/);
  const compiled = compileReality(rcl);
  assert.match(compiled.programRoot, /^[0-9a-f]{64}$/);
  const dir = tempDir('unknown-knowledge');
  const reports = writeUnknownKnowledgeReports(dir, DEFAULT_UNKNOWN_KNOWLEDGE_SPEC);
  assert.equal(reports.ok, true);
  assert.equal(fs.existsSync(path.join(dir, 'unknown-knowledge-result.json')), true);
  assert.equal(fs.existsSync(path.join(dir, 'unknown-knowledge-compiler.rcl')), true);
  assert.equal(fs.existsSync(path.join(dir, 'unknown-knowledge-predictions.json')), true);
});

test('v0.49 exposes CLI demo, run and spec commands', () => {
  const demoOut = execFileSync('node', ['src/cli.mjs', 'unknown-knowledge-demo'], { cwd, encoding: 'utf8' });
  const demo = JSON.parse(demoOut);
  assert.equal(demo.ok, true);
  assert.equal(demo.externalRealityVerified, false);
  const runDir = tempDir('unknown-knowledge-cli');
  const runOut = execFileSync('node', ['src/cli.mjs', 'unknown-knowledge-run', 'examples/unknown-knowledge/default-unknown-corpus.json', runDir], { cwd, encoding: 'utf8' });
  const run = JSON.parse(runOut);
  assert.equal(run.ok, true);
  assert.equal(fs.existsSync(path.join(runDir, 'unknown-knowledge-bundle.json')), true);
  const specDir = tempDir('unknown-knowledge-spec');
  const specOut = execFileSync('node', ['src/cli.mjs', 'unknown-knowledge-spec', specDir], { cwd, encoding: 'utf8' });
  assert.equal(JSON.parse(specOut).ok, true);
  assert.equal(fs.existsSync(path.join(specDir, 'unknown-knowledge-spec.json')), true);
});
