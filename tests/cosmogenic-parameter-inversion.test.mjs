import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  RCL_COSMOGENIC_PARAMETER_INVERSION_VERSION,
  RCL_COSMOGENIC_PARAMETER_INVERSION_SPEC_FORMAT,
  RCL_COSMOGENIC_PARAMETER_INVERSION_RESULT_FORMAT,
  DEFAULT_COSMOGENIC_PARAMETER_INVERSION_SPEC,
  evaluateOriginAgainstMacroScience,
  invertCosmogenicInitialParameters,
  classifyCoordinateResidualForInversion,
  runCosmogenicParameterInversion,
  buildCosmogenicParameterInversionSpec,
  renderCosmogenicParameterInversionRcl,
  writeCosmogenicParameterInversionReports,
} from '../src/cosmogenic-parameter-inversion.mjs';
import { DEFAULT_ORIGIN_CENTER } from '../src/cosmogenic-reality-compiler.mjs';
import { compileReality } from '../src/index.mjs';

const cwd = fileURLToPath(new URL('..', import.meta.url));

function tempDir(name) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `rcl-${name}-`));
}

test('v0.90 exposes version and evaluates default origin baseline', () => {
  assert.equal(RCL_COSMOGENIC_PARAMETER_INVERSION_VERSION, '0.90.0-alpha.1');
  const baseline = evaluateOriginAgainstMacroScience(DEFAULT_ORIGIN_CENTER, DEFAULT_COSMOGENIC_PARAMETER_INVERSION_SPEC);
  assert.ok(baseline.calibrationScore > 0.90);
  assert.ok(baseline.validationScore > 0.80);
  assert.equal(baseline.passed, false);
});

test('v0.90 inverts macro constraints and improves over default origin', () => {
  const inversion = invertCosmogenicInitialParameters(DEFAULT_COSMOGENIC_PARAMETER_INVERSION_SPEC);
  assert.ok(inversion.correctedEvaluation.calibrationScore > inversion.beforeDefault.calibrationScore);
  assert.ok(inversion.correctedEvaluation.calibrationScore >= DEFAULT_COSMOGENIC_PARAMETER_INVERSION_SPEC.threshold);
  assert.ok(inversion.correctedEvaluation.validationScore >= DEFAULT_COSMOGENIC_PARAMETER_INVERSION_SPEC.validationThreshold);
  assert.ok(inversion.improvement.calibrationScoreGainVsDefault > 0.015);
  const changed = Object.values(inversion.deltas).filter(row => Math.abs(row.deltaFromDefault) > 0.00001);
  assert.ok(changed.length >= 8);
});

test('v0.90 quarantines celestial coordinate residuals outside origin tuning', () => {
  const residual = classifyCoordinateResidualForInversion(DEFAULT_COSMOGENIC_PARAMETER_INVERSION_SPEC);
  assert.equal(residual.canTuneCosmogenicOrigin, false);
  assert.equal(residual.originWeight, 0);
  assert.equal(residual.correctionRoute, 'provider_observability_layer_only');
  assert.ok(residual.providerPassRate >= 1);
});

test('v0.90 full run returns corrected origin and multicivilization pass', () => {
  const { result } = runCosmogenicParameterInversion(DEFAULT_COSMOGENIC_PARAMETER_INVERSION_SPEC);
  assert.equal(result.format, RCL_COSMOGENIC_PARAMETER_INVERSION_RESULT_FORMAT);
  assert.equal(result.ok, true);
  assert.equal(result.canClaimExternalUniverseProof, false);
  assert.equal(result.canClaimParticleExactCosmology, false);
  assert.equal(result.canUseStarCoordinateResidualsForOriginTuning, false);
  assert.equal(result.multicivilizationCourt.passed, true);
  assert.equal(result.coordinateResidual.originWeight, 0);
  assert.ok(result.calibrationScoreAfter > result.calibrationScoreBeforeDefault);
  assert.equal(result.calibrationRows.every(row => row.usedForInversion), true);
  assert.equal(result.blindValidationRows.every(row => !row.usedForInversion), true);
});

test('v0.90 renders compilable RCL and writes reports', () => {
  const spec = buildCosmogenicParameterInversionSpec(DEFAULT_COSMOGENIC_PARAMETER_INVERSION_SPEC);
  assert.equal(spec.format, RCL_COSMOGENIC_PARAMETER_INVERSION_SPEC_FORMAT);
  assert.equal(spec.validation.conclusionHolds, true);
  const rcl = renderCosmogenicParameterInversionRcl(spec);
  assert.match(rcl, /reality CosmogenicParameterInversion/);
  assert.match(rcl, /origin_star_coordinate_residual_weight : Number = 0/);
  const compiled = compileReality(rcl);
  assert.match(compiled.programRoot, /^[0-9a-f]{64}$/);
  const dir = tempDir('cosmogenic-parameter-inversion');
  const reports = writeCosmogenicParameterInversionReports(dir, DEFAULT_COSMOGENIC_PARAMETER_INVERSION_SPEC);
  assert.equal(reports.ok, true);
  for (const file of ['cosmogenic-parameter-inversion-result.json', 'corrected-origin-parameters.json', 'provider-observability-quarantine.json', 'multicivilization-court.json']) {
    assert.equal(fs.existsSync(path.join(dir, file)), true);
  }
});

test('v0.90 exposes CLI demo/run/spec commands', () => {
  const demoOut = execFileSync('node', ['src/cli.mjs', 'cosmogenic-parameter-inversion-demo'], { cwd, encoding: 'utf8' });
  assert.equal(JSON.parse(demoOut).ok, true);
  const runDir = tempDir('cosmogenic-parameter-inversion-cli');
  const runOut = execFileSync('node', ['src/cli.mjs', 'cosmogenic-parameter-inversion-run', runDir], { cwd, encoding: 'utf8' });
  assert.equal(JSON.parse(runOut).ok, true);
  assert.equal(fs.existsSync(path.join(runDir, 'cosmogenic-parameter-inversion-result.json')), true);
  const specDir = tempDir('cosmogenic-parameter-inversion-spec-cli');
  const specOut = execFileSync('node', ['src/cli.mjs', 'cosmogenic-parameter-inversion-spec', specDir], { cwd, encoding: 'utf8' });
  assert.equal(JSON.parse(specOut).ok, true);
  assert.equal(fs.existsSync(path.join(specDir, 'cosmogenic-parameter-inversion-spec.json')), true);
});
