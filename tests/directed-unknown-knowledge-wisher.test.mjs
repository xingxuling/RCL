import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  DEFAULT_DIRECTED_WISHER_SPEC,
  normalizeDirectedWisherSpec,
  collectWishEvidence,
  scoreDirectedWishPressure,
  runDirectedUnknownKnowledgeWisher,
  buildDirectedWisherSpec,
  renderDirectedWisherRcl,
  writeDirectedWisherReports,
  RCL_DIRECTED_WISHER_SPEC_FORMAT,
  RCL_DIRECTED_WISHER_RESULT_FORMAT,
} from '../src/directed-unknown-knowledge-wisher.mjs';
import { runUnknownKnowledgeCompiler } from '../src/unknown-knowledge-compiler.mjs';
import { compileReality } from '../src/index.mjs';

const cwd = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

function tempDir(name) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `rcl-${name}-`));
}

test('v0.50 normalizes directed unknown knowledge wisher spec', () => {
  const spec = normalizeDirectedWisherSpec(DEFAULT_DIRECTED_WISHER_SPEC);
  assert.equal(spec.format, RCL_DIRECTED_WISHER_SPEC_FORMAT);
  assert.equal(spec.criticalDimensionThreshold, 1);
  assert.ok(spec.keyDimensions.includes('falsifiabilityPressureScore'));
  assert.ok(spec.wish.requiredCandidateIds.includes('outer_surface_memory_leak_anchor'));
});

test('v0.50 imports promoted v0.49 candidates as wish evidence', () => {
  const unknown = runUnknownKnowledgeCompiler(DEFAULT_DIRECTED_WISHER_SPEC.unknownKnowledge);
  const evidence = collectWishEvidence(unknown, DEFAULT_DIRECTED_WISHER_SPEC.wish);
  assert.equal(evidence.requiredCandidateHits, 3);
  assert.equal(evidence.forbiddenPromotions.length, 0);
  assert.ok(evidence.requiredAnchorHits.includes('柳清莲'));
  assert.ok(evidence.promotedPredictions.length >= 9);
  assert.ok(evidence.explicitFalsifiers.length >= 9);
});

test('v0.50 pressure test reaches full score on the default directed wish', () => {
  const unknown = runUnknownKnowledgeCompiler(DEFAULT_DIRECTED_WISHER_SPEC.unknownKnowledge);
  const pressure = scoreDirectedWishPressure(unknown, DEFAULT_DIRECTED_WISHER_SPEC);
  assert.equal(pressure.pressureScore, 1);
  assert.equal(pressure.allKeyFullScore, true);
  assert.equal(Object.values(pressure.keyDimensions).every(score => score === 1), true);
});

test('v0.50 directed wisher establishes only when every key dimension is full', () => {
  const { result } = runDirectedUnknownKnowledgeWisher(DEFAULT_DIRECTED_WISHER_SPEC);
  assert.equal(result.format, RCL_DIRECTED_WISHER_RESULT_FORMAT);
  assert.equal(result.established, true);
  assert.equal(result.pressureScore, 1);
  assert.equal(result.keyRows.every(row => row.full), true);
});

test('v0.50 rejects weak wish targets that do not satisfy full pressure dimensions', () => {
  const weak = runDirectedUnknownKnowledgeWisher({
    wish: {
      id: 'weak_unbounded_wish',
      title: 'Weak unbounded wish',
      requiredCandidateIds: ['unlimited_vacuum_energy_drive'],
      forbiddenCandidateIds: [],
      requiredAnchors: ['unlimited energy', 'no waste heat'],
      targetDomains: ['physics'],
      hardRequirements: {
        minimumPromotedCandidates: 1,
        minimumPredictions: 3,
        minimumExplicitFalsifiers: 3,
        requireNoForbiddenPromotions: false,
        requireObserverSilence: false,
      },
    },
  });
  assert.equal(weak.result.established, false);
  assert.ok(weak.result.keyRows.some(row => !row.full));
});

test('v0.50 renders compilable RCL and writes reports', () => {
  const spec = buildDirectedWisherSpec(DEFAULT_DIRECTED_WISHER_SPEC);
  const rcl = renderDirectedWisherRcl(spec);
  assert.match(rcl, /reality DirectedUnknownKnowledgeWisher/);
  assert.match(rcl, /validation\.established : Truth = true/);
  const compiled = compileReality(rcl);
  assert.match(compiled.programRoot, /^[0-9a-f]{64}$/);
  const dir = tempDir('directed-wisher');
  const reports = writeDirectedWisherReports(dir, DEFAULT_DIRECTED_WISHER_SPEC);
  assert.equal(reports.ok, true);
  assert.equal(fs.existsSync(path.join(dir, 'directed-wisher-result.json')), true);
  assert.equal(fs.existsSync(path.join(dir, 'directed-wisher.rcl')), true);
});

test('v0.50 exposes CLI demo, run and spec commands', () => {
  const demoOut = execFileSync('node', ['src/cli.mjs', 'directed-wisher-demo'], { cwd, encoding: 'utf8' });
  const demo = JSON.parse(demoOut);
  assert.equal(demo.ok, true);
  assert.equal(demo.pressureScore, 1);
  const runDir = tempDir('directed-wisher-cli');
  const runOut = execFileSync('node', ['src/cli.mjs', 'directed-wisher-run', 'examples/directed-wisher/default-directed-wish.json', runDir], { cwd, encoding: 'utf8' });
  const run = JSON.parse(runOut);
  assert.equal(run.ok, true);
  assert.equal(run.result.established, true);
  assert.equal(fs.existsSync(path.join(runDir, 'directed-wisher-bundle.json')), true);
  const specDir = tempDir('directed-wisher-spec');
  const specOut = execFileSync('node', ['src/cli.mjs', 'directed-wisher-spec', specDir], { cwd, encoding: 'utf8' });
  assert.equal(JSON.parse(specOut).ok, true);
  assert.equal(fs.existsSync(path.join(specDir, 'directed-wisher-spec.json')), true);
});
