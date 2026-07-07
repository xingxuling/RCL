import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  DEFAULT_EMPIRICAL_GROUNDING_DATA,
  normalizeEmpiricalGroundingSpec,
  empiricalCalibrationToOriginCenter,
  buildEmpiricalHistoryConstraints,
  compileEmpiricalHoldoutFacts,
  evaluateEmpiricalHoldouts,
  runEmpiricalGroundingTest,
  buildEmpiricalGroundingSpec,
  renderEmpiricalGroundingRcl,
  writeEmpiricalGroundingReports,
  RCL_EMPIRICAL_GROUNDING_SPEC_FORMAT,
  RCL_EMPIRICAL_GROUNDING_RESULT_FORMAT,
} from '../src/empirical-grounding-layer.mjs';
import { compileReality } from '../src/index.mjs';

const cwd = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

function tempDir(name) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `rcl-${name}-`));
}

test('v0.48 normalizes empirical scientific calibration and holdout policy', () => {
  const spec = normalizeEmpiricalGroundingSpec(DEFAULT_EMPIRICAL_GROUNDING_DATA);
  assert.equal(spec.format, RCL_EMPIRICAL_GROUNDING_SPEC_FORMAT);
  assert.equal(spec.boundary, 'empirical_grounding_sandbox_not_external_proof');
  assert.ok(spec.calibration.constants.speedOfLightMPerS > 299000000);
  assert.ok(spec.calibration.cosmology.universeAgeGa > 13.7);
  assert.ok(spec.holdoutFacts.length >= 7);
});

test('v0.48 projects empirical data into a bounded sandbox origin center', () => {
  const center = empiricalCalibrationToOriginCenter(DEFAULT_EMPIRICAL_GROUNDING_DATA.calibration);
  for (const value of Object.values(center)) assert.ok(value >= 0 && value <= 1);
  assert.ok(center.densityFlatness > 0.98);
  assert.ok(center.expansionRate > 0.42 && center.expansionRate < 0.54);
});

test('v0.48 builds measured history constraints without using holdout facts', () => {
  const constraints = buildEmpiricalHistoryConstraints(DEFAULT_EMPIRICAL_GROUNDING_DATA);
  assert.ok(constraints.some(row => row.id === 'earth_formation' && row.min < 4.54 && row.max > 4.54));
  assert.equal(constraints.some(row => row.id === 'earth_year_days'), false);
});

test('v0.48 evaluates holdout facts as blind checks', () => {
  const predicted = {
    earth_year_days: 365.25,
    earth_day_hours: 23.9,
    sun_distance_km: 150196428,
    sun_light_time_min: 8.350022,
    earth_diameter_km: 12756,
    axial_tilt_deg: 23.4,
    moon_count: 1,
  };
  const evaluation = evaluateEmpiricalHoldouts(predicted, DEFAULT_EMPIRICAL_GROUNDING_DATA.holdoutFacts);
  assert.equal(evaluation.passed, true);
  assert.equal(evaluation.failedHoldouts.length, 0);
  assert.ok(evaluation.holdoutScore >= 0.99);
});

test('v0.48 empirical grounding passes calibrated cosmogenic + holdout validation', () => {
  const { result } = runEmpiricalGroundingTest(DEFAULT_EMPIRICAL_GROUNDING_DATA);
  assert.equal(result.format, RCL_EMPIRICAL_GROUNDING_RESULT_FORMAT);
  assert.equal(result.conclusionHolds, true);
  assert.equal(result.externalRealityVerified, false);
  assert.ok(result.empiricalGroundingScore >= result.threshold);
  assert.ok(result.holdoutScore >= result.holdoutThreshold);
  assert.equal(result.failedHoldouts.length, 0);
});

test('v0.48 renders compilable RCL and writes evidence reports', () => {
  const spec = buildEmpiricalGroundingSpec(DEFAULT_EMPIRICAL_GROUNDING_DATA);
  assert.equal(spec.validation.conclusionHolds, true);
  const rcl = renderEmpiricalGroundingRcl(spec);
  assert.match(rcl, /reality EmpiricalGroundingLayer/);
  assert.match(rcl, /validation\.external_reality_verified : Truth = false/);
  const compiled = compileReality(rcl);
  assert.match(compiled.programRoot, /^[0-9a-f]{64}$/);
  const dir = tempDir('empirical-grounding');
  const reports = writeEmpiricalGroundingReports(dir, DEFAULT_EMPIRICAL_GROUNDING_DATA);
  assert.equal(reports.ok, true);
  assert.equal(fs.existsSync(path.join(dir, 'empirical-grounding-result.json')), true);
  assert.equal(fs.existsSync(path.join(dir, 'empirical-grounding-layer.rcl')), true);
  assert.equal(fs.existsSync(path.join(dir, 'empirical-holdout-evaluation.json')), true);
});

test('v0.48 exposes CLI demo, run and spec commands', () => {
  const demoOut = execFileSync('node', ['src/cli.mjs', 'empirical-grounding-demo'], { cwd, encoding: 'utf8' });
  const demo = JSON.parse(demoOut);
  assert.equal(demo.ok, true);
  assert.equal(demo.externalRealityVerified, false);
  const runDir = tempDir('empirical-grounding-cli');
  const runOut = execFileSync('node', ['src/cli.mjs', 'empirical-grounding-run', 'examples/empirical-grounding/science-grounded-universe-sandbox.json', runDir], { cwd, encoding: 'utf8' });
  const run = JSON.parse(runOut);
  assert.equal(run.ok, true);
  assert.equal(fs.existsSync(path.join(runDir, 'empirical-grounding-bundle.json')), true);
  const specDir = tempDir('empirical-grounding-spec');
  const specOut = execFileSync('node', ['src/cli.mjs', 'empirical-grounding-spec', specDir], { cwd, encoding: 'utf8' });
  assert.equal(JSON.parse(specOut).ok, true);
  assert.equal(fs.existsSync(path.join(specDir, 'empirical-grounding-spec.json')), true);
});

test('v0.48 fails if holdout facts are made impossible', () => {
  const bad = structuredClone(DEFAULT_EMPIRICAL_GROUNDING_DATA);
  bad.holdoutFacts = bad.holdoutFacts.map(row => ({ ...row, min: row.expected * 2, max: row.expected * 2 + 1 }));
  const { result } = runEmpiricalGroundingTest(bad);
  assert.equal(result.conclusionHolds, false);
  assert.ok(result.failedHoldouts.length >= 3);
});
