import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  RCL_COSMOGENIC_COMPILER_VERSION,
  RCL_COSMOGENIC_SPEC_FORMAT,
  RCL_COSMOGENIC_TEST_FORMAT,
  DEFAULT_COSMOGENIC_TARGET,
  originParametersFromSeed,
  compileEarthHistoryFromOrigin,
  evaluateEarthHistoryConsistency,
  searchCosmogenicEarthSeed,
  runCosmogenicEarthTest,
  buildCosmogenicSpec,
  renderCosmogenicRcl,
  writeCosmogenicReports,
  compileReality,
} from '../src/index.mjs';

const cwd = fileURLToPath(new URL('..', import.meta.url));

function tempDir(name) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `rcl-${name}-`));
}

test('v0.45 exposes cosmogenic compiler constants and compilable RCL projection', () => {
  assert.equal(RCL_COSMOGENIC_COMPILER_VERSION, '0.45.0-alpha.1');
  const spec = buildCosmogenicSpec({ testOptions: { candidates: 512 } });
  assert.equal(spec.format, RCL_COSMOGENIC_SPEC_FORMAT);
  assert.match(spec.root, /^[0-9a-f]{64}$/);
  assert.ok(spec.compilerPasses.includes('cosmogenic forward event synthesis'));
  const rcl = renderCosmogenicRcl(spec);
  assert.match(rcl, /reality CosmogenicRealityCompiler/);
  assert.match(rcl, /validation\.earth_consistency/);
  const compiled = compileReality(rcl);
  assert.match(compiled.programRoot, /^[0-9a-f]{64}$/);
});

test('v0.45 compiles origin parameters into a causally ordered Earth history', () => {
  const origin = originParametersFromSeed(4500001, { width: 0.02 });
  const history = compileEarthHistoryFromOrigin(origin);
  assert.ok(history.events.universe_age > history.events.first_stars);
  assert.ok(history.events.first_stars > history.events.solar_system_formation);
  assert.ok(history.events.earth_formation > history.events.earliest_life);
  assert.ok(history.events.cambrian_radiation > history.events.kpg_extinction);
  const evaluation = evaluateEarthHistoryConsistency(history);
  assert.equal(evaluation.format, RCL_COSMOGENIC_TEST_FORMAT);
  assert.ok(evaluation.earthConsistencyScore >= DEFAULT_COSMOGENIC_TARGET.threshold);
  assert.equal(evaluation.causalOrder.passed, true);
});

test('v0.45 seed search verifies the cosmogenic conclusion under coarse-grained constraints', () => {
  const first = searchCosmogenicEarthSeed({ startSeed: 20260705, candidates: 1024 });
  const second = searchCosmogenicEarthSeed({ startSeed: 20260705, candidates: 1024 });
  assert.equal(first.root, second.root);
  assert.equal(first.conclusionHolds, true);
  assert.ok(first.acceptedCount > 0);
  assert.ok(first.best.evaluation.earthConsistencyScore >= DEFAULT_COSMOGENIC_TARGET.threshold);
  assert.equal(first.best.evaluation.causalOrder.passed, true);
});

test('v0.45 runCosmogenicEarthTest returns a positive but bounded verdict', () => {
  const report = runCosmogenicEarthTest({ candidates: 1024 });
  assert.equal(report.ok, true);
  assert.match(report.boundary, /coarse_grained/);
  assert.match(report.verdict, /成立/);
  assert.ok(report.bestHistory.earth_formation > report.bestHistory.earliest_life);
});

test('v0.45 writes cosmogenic reports and CLI commands', () => {
  const dir = tempDir('cosmogenic-reports');
  const bundle = writeCosmogenicReports(dir, { candidates: 512 });
  assert.equal(bundle.ok, true);
  assert.equal(fs.existsSync(path.join(dir, 'cosmogenic-bundle.json')), true);
  assert.equal(fs.existsSync(path.join(dir, 'cosmogenic-reality-compiler.rcl')), true);
  const demoOut = execFileSync('node', ['src/cli.mjs', 'cosmogenic-demo'], { cwd, encoding: 'utf8' });
  assert.equal(JSON.parse(demoOut).ok, true);
  const runDir = tempDir('cosmogenic-cli');
  const runOut = execFileSync('node', ['src/cli.mjs', 'cosmogenic-run', runDir], { cwd, encoding: 'utf8' });
  assert.equal(JSON.parse(runOut).ok, true);
  assert.equal(fs.existsSync(path.join(runDir, 'cosmogenic-bundle.json')), true);
  const specDir = tempDir('cosmogenic-spec');
  const specOut = execFileSync('node', ['src/cli.mjs', 'cosmogenic-spec', specDir], { cwd, encoding: 'utf8' });
  assert.equal(JSON.parse(specOut).ok, true);
  assert.equal(fs.existsSync(path.join(specDir, 'cosmogenic-spec.json')), true);
});
