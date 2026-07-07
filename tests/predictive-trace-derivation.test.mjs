import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  DEFAULT_PREDICTIVE_TRACE_SPEC,
  normalizePredictiveTraceSpec,
  deriveIntersticePhysicalTraces,
  scorePredictiveTracePressure,
  runPredictiveTraceDerivation,
  buildPredictiveTraceSpec,
  renderPredictiveTraceRcl,
  writePredictiveTraceReports,
  RCL_PREDICTIVE_TRACE_SPEC_FORMAT,
  RCL_PREDICTIVE_TRACE_RESULT_FORMAT,
} from '../src/predictive-trace-derivation.mjs';
import { runDirectedUnknownKnowledgeWisher } from '../src/directed-unknown-knowledge-wisher.mjs';
import { runEmpiricalGroundingTest } from '../src/empirical-grounding-layer.mjs';
import { compileReality } from '../src/index.mjs';

const cwd = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

function tempDir(name) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `rcl-${name}-`));
}

test('v0.51 normalizes predictive trace derivation spec', () => {
  const spec = normalizePredictiveTraceSpec(DEFAULT_PREDICTIVE_TRACE_SPEC);
  assert.equal(spec.format, RCL_PREDICTIVE_TRACE_SPEC_FORMAT);
  assert.equal(spec.criticalDimensionThreshold, 1);
  assert.ok(spec.keyDimensions.includes('empiricalSandboxHoldoutScore'));
  assert.ok(spec.traceTarget.requiredTraceFamilies.includes('observer_silence_null_channel'));
});

test('v0.51 derives physical byproduct traces from an established v0.50 target', () => {
  const directed = runDirectedUnknownKnowledgeWisher(DEFAULT_PREDICTIVE_TRACE_SPEC.directedWisher);
  const trace = deriveIntersticePhysicalTraces(directed, DEFAULT_PREDICTIVE_TRACE_SPEC);
  assert.equal(trace.sourceEstablished, true);
  assert.ok(trace.traces.length >= 8);
  assert.ok(trace.blindPredictions.every(row => row.failureCondition));
  assert.ok(trace.coveredFamilies.includes('bio_silicate_lattice_residue'));
  assert.ok(trace.coveredFamilies.includes('observer_silence_null_channel'));
});

test('v0.51 pressure scoring reaches full predictive dimensions', () => {
  const directed = runDirectedUnknownKnowledgeWisher(DEFAULT_PREDICTIVE_TRACE_SPEC.directedWisher);
  const empirical = runEmpiricalGroundingTest(DEFAULT_PREDICTIVE_TRACE_SPEC.empiricalGrounding);
  const trace = deriveIntersticePhysicalTraces(directed, DEFAULT_PREDICTIVE_TRACE_SPEC);
  const pressure = scorePredictiveTracePressure(trace, empirical, DEFAULT_PREDICTIVE_TRACE_SPEC);
  assert.equal(pressure.predictiveScore, 1);
  assert.equal(pressure.allKeyFullScore, true);
  assert.equal(Object.values(pressure.keyDimensions).every(score => score === 1), true);
});

test('v0.51 promotes candidate knowledge to predictive when every key dimension is full', () => {
  const { result } = runPredictiveTraceDerivation(DEFAULT_PREDICTIVE_TRACE_SPEC);
  assert.equal(result.format, RCL_PREDICTIVE_TRACE_RESULT_FORMAT);
  assert.equal(result.predictiveEstablished, true);
  assert.equal(result.transition, 'candidate_to_predictive');
  assert.equal(result.sandboxEndogenousPrediction, true);
  assert.equal(result.keyRows.every(row => row.full), true);
});

test('v0.51 blocks predictive promotion if the source directed wish is weakened', () => {
  const weak = runPredictiveTraceDerivation({
    directedWisher: {
      wish: {
        id: 'weak_source',
        requiredCandidateIds: ['unlimited_vacuum_energy_drive'],
        forbiddenCandidateIds: [],
        requiredAnchors: ['unlimited energy'],
        targetDomains: ['physics'],
        hardRequirements: {
          minimumPromotedCandidates: 1,
          minimumPredictions: 3,
          minimumExplicitFalsifiers: 3,
          requireNoForbiddenPromotions: false,
          requireObserverSilence: false,
        },
      },
    },
  });
  assert.equal(weak.result.predictiveEstablished, false);
  assert.ok(weak.result.keyRows.some(row => !row.full));
});

test('v0.51 renders compilable RCL and writes reports', () => {
  const spec = buildPredictiveTraceSpec(DEFAULT_PREDICTIVE_TRACE_SPEC);
  const rcl = renderPredictiveTraceRcl(spec);
  assert.match(rcl, /reality PredictiveTraceDerivation/);
  assert.match(rcl, /validation\.predictive_established : Truth = true/);
  const compiled = compileReality(rcl);
  assert.match(compiled.programRoot, /^[0-9a-f]{64}$/);
  const dir = tempDir('predictive-trace');
  const reports = writePredictiveTraceReports(dir, DEFAULT_PREDICTIVE_TRACE_SPEC);
  assert.equal(reports.ok, true);
  assert.equal(fs.existsSync(path.join(dir, 'predictive-trace-result.json')), true);
  assert.equal(fs.existsSync(path.join(dir, 'predictive-trace.rcl')), true);
  assert.equal(fs.existsSync(path.join(dir, 'predictive-trace-blind-predictions.json')), true);
});

test('v0.51 exposes CLI demo, run and spec commands', () => {
  const demoOut = execFileSync('node', ['src/cli.mjs', 'predictive-trace-demo'], { cwd, encoding: 'utf8' });
  const demo = JSON.parse(demoOut);
  assert.equal(demo.ok, true);
  assert.equal(demo.predictiveEstablished, true);
  assert.equal(demo.sandboxEndogenousPrediction, true);
  const runDir = tempDir('predictive-trace-cli');
  const runOut = execFileSync('node', ['src/cli.mjs', 'predictive-trace-run', 'examples/predictive-trace/default-predictive-trace.json', runDir], { cwd, encoding: 'utf8' });
  const run = JSON.parse(runOut);
  assert.equal(run.ok, true);
  assert.equal(run.result.predictiveEstablished, true);
  assert.equal(fs.existsSync(path.join(runDir, 'predictive-trace-bundle.json')), true);
  const specDir = tempDir('predictive-trace-spec');
  const specOut = execFileSync('node', ['src/cli.mjs', 'predictive-trace-spec', specDir], { cwd, encoding: 'utf8' });
  assert.equal(JSON.parse(specOut).ok, true);
  assert.equal(fs.existsSync(path.join(specDir, 'predictive-trace-spec.json')), true);
});
