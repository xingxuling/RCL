import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import {
  DEFAULT_INTERSTICE_OBSERVER_SPEC,
  normalizeIntersticeObserverSpec,
  scoreIntersticeObserver,
  evaluateIntersticeObserverFalsifiability,
  compileIntersticeObserverModel,
  buildIntersticeObserverSpec,
  renderIntersticeObserverRcl,
  writeIntersticeObserverReports,
  RCL_INTERSTICE_OBSERVER_SPEC_FORMAT,
  RCL_INTERSTICE_OBSERVER_RESULT_FORMAT,
} from '../src/universe-interstice-observer-compiler.mjs';
import { compileReality } from '../src/index.mjs';

const cwd = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function tempDir(name) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `rcl-${name}-`));
}

test('v0.47 normalizes exactly eight universe interstice spaces with one observer each', () => {
  const spec = normalizeIntersticeObserverSpec(DEFAULT_INTERSTICE_OBSERVER_SPEC);
  assert.equal(spec.format, RCL_INTERSTICE_OBSERVER_SPEC_FORMAT);
  assert.equal(spec.requiredObserverCount, 8);
  assert.equal(spec.intersticeSpaces.length, 8);
  assert.equal(new Set(spec.intersticeSpaces.map(space => space.observer)).size, 8);
  assert.equal(spec.previousFalsifiabilityBaseline, 0.78);
});

test('v0.47 scores each observer as a falsifiable observer, not an empirical proof witness', () => {
  const spec = normalizeIntersticeObserverSpec(DEFAULT_INTERSTICE_OBSERVER_SPEC);
  const scored = spec.intersticeSpaces.map(scoreIntersticeObserver);
  assert.equal(scored.length, 8);
  assert.ok(scored.every(row => row.score >= 0.78));
  assert.ok(scored.every(row => row.falsifier && row.falsifier.length > 10));
});

test('v0.47 eight observers raise falsifiability above the v0.46 baseline', () => {
  const evaluation = evaluateIntersticeObserverFalsifiability(DEFAULT_INTERSTICE_OBSERVER_SPEC);
  assert.equal(evaluation.baseline, 0.78);
  assert.equal(evaluation.observerCount, 8);
  assert.equal(evaluation.coverageScore, 1);
  assert.equal(evaluation.passesBaseline, true);
  assert.ok(evaluation.overallFalsifiabilityScore > evaluation.baseline);
  assert.ok(evaluation.absoluteGain > 0.07);
  assert.ok(evaluation.residualReduction > 0.35);
});

test('v0.47 compiles interstice observers while preserving external proof boundary', () => {
  const { result } = compileIntersticeObserverModel(DEFAULT_INTERSTICE_OBSERVER_SPEC);
  assert.equal(result.format, RCL_INTERSTICE_OBSERVER_RESULT_FORMAT);
  assert.equal(result.conclusionHolds, true);
  assert.equal(result.externalRealityVerified, false);
  assert.ok(result.previousStructuralCoherenceScore >= 0.97);
  assert.ok(result.observerFalsifiabilityScore > 0.78);
  assert.ok(result.predictedEvents.length, 8);
  assert.match(result.verdict, /不等同于外部实证成立/);
});

test('v0.47 renders compilable RCL and report bundle', () => {
  const spec = buildIntersticeObserverSpec(DEFAULT_INTERSTICE_OBSERVER_SPEC);
  assert.equal(spec.validation.conclusionHolds, true);
  assert.match(spec.root, /^[0-9a-f]{64}$/);
  const rcl = renderIntersticeObserverRcl(spec);
  assert.match(rcl, /reality UniverseIntersticeObserverCompiler/);
  assert.match(rcl, /observer\.count/);
  const compiled = compileReality(rcl);
  assert.match(compiled.programRoot, /^[0-9a-f]{64}$/);
  const dir = tempDir('interstice-observer');
  const bundle = writeIntersticeObserverReports(dir, DEFAULT_INTERSTICE_OBSERVER_SPEC);
  assert.equal(bundle.ok, true);
  assert.equal(fs.existsSync(path.join(dir, 'interstice-observer-bundle.json')), true);
  assert.equal(fs.existsSync(path.join(dir, 'interstice-observer-compiler.rcl')), true);
  assert.equal(fs.existsSync(path.join(dir, 'interstice-observer-summary.md')), true);
});

test('v0.47 exposes CLI demo, run and spec commands', () => {
  const demoOut = execFileSync('node', ['src/cli.mjs', 'interstice-observer-demo'], { cwd, encoding: 'utf8' });
  const demo = JSON.parse(demoOut);
  assert.equal(demo.ok, true);
  assert.ok(demo.observerFalsifiabilityScore > demo.previousFalsifiabilityBaseline);
  const runDir = tempDir('interstice-observer-cli');
  const runOut = execFileSync('node', ['src/cli.mjs', 'interstice-observer-run', 'examples/interstice-observer/eight-observer-falsifiability.json', runDir], { cwd, encoding: 'utf8' });
  const run = JSON.parse(runOut);
  assert.equal(run.ok, true);
  assert.equal(fs.existsSync(path.join(runDir, 'interstice-observer-bundle.json')), true);
  const specDir = tempDir('interstice-observer-spec');
  const specOut = execFileSync('node', ['src/cli.mjs', 'interstice-observer-spec', specDir], { cwd, encoding: 'utf8' });
  assert.equal(JSON.parse(specOut).ok, true);
  assert.equal(fs.existsSync(path.join(specDir, 'interstice-observer-spec.json')), true);
});

test('v0.47 fails the baseline comparison when observer specificity is degraded', () => {
  const weak = structuredClone(DEFAULT_INTERSTICE_OBSERVER_SPEC);
  weak.intersticeSpaces = weak.intersticeSpaces.map(space => ({
    ...space,
    falsifierSpecificity: 0.52,
    observableAnchorStrength: 0.55,
    independence: 0.50,
    discriminativePower: 0.54,
    observableAnchors: ['weak_anchor'],
  }));
  const evaluation = evaluateIntersticeObserverFalsifiability(weak);
  assert.equal(evaluation.observerCount, 8);
  assert.equal(evaluation.passesBaseline, false);
  assert.ok(evaluation.overallFalsifiabilityScore < 0.78);
});
