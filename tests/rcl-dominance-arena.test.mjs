import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CAPABILITY_SCORECARD_GATES,
  DOMINANCE_ARENA_MANIFEST_SCHEMA,
  STRESS_STATUS,
  buildCapabilityScorecard,
  buildProviderEvidenceComparisons,
  buildRclScorecard,
  evaluateDominanceArena,
  evaluateDominanceComparison,
  runArenaCommand,
  runRclDominanceArena,
  validateDominanceArenaManifest,
} from '../src/rcl-dominance-arena.mjs';

function claim({ ai = STRESS_STATUS.UNVERIFIED, overrides = {} } = {}) {
  const gates = Object.fromEntries(CAPABILITY_SCORECARD_GATES.map(gate => [
    gate,
    { status: STRESS_STATUS.PASS, evidence: [`receipt:${gate}`] },
  ]));
  gates.AI_GENERATE = { status: ai, evidence: ai === STRESS_STATUS.PASS ? ['receipt:ai'] : [] };
  return {
    id: 'compiler-runtime::self-hosting',
    status: ai === STRESS_STATUS.PASS ? STRESS_STATUS.PASS : STRESS_STATUS.BLOCKED,
    gates: { ...gates, ...overrides },
  };
}

test('capability scorecard passes K01 core gates while AI_GENERATE stays separate', () => {
  const scorecard = buildCapabilityScorecard(claim());
  assert.equal(scorecard.status, STRESS_STATUS.PASS);
  assert.equal(scorecard.passed, CAPABILITY_SCORECARD_GATES.length);
  assert.equal(scorecard.unverified, 0);
  assert.equal(scorecard.metric.excludedGate, 'AI_GENERATE');
});

test('AI_GENERATE only changes authorability, never compiler capability', () => {
  const scorecard = buildRclScorecard({
    id: 'compiler-runtime::self-hosting',
    task: { id: 'K01' },
    stressClaim: claim(),
    dominance: null,
  });
  assert.equal(scorecard.axes.capability.status, STRESS_STATUS.PASS);
  assert.equal(scorecard.axes.authorability.status, STRESS_STATUS.UNVERIFIED);
  assert.equal(scorecard.axes.dominance.status, STRESS_STATUS.UNVERIFIED);
  assert.equal(scorecard.legacyStressCellStatus, STRESS_STATUS.BLOCKED);
});

test('a failed core gate fails capability even when AI_GENERATE is unverified', () => {
  const scorecard = buildCapabilityScorecard(claim({
    overrides: { COMPILE: { status: STRESS_STATUS.FAIL, evidence: ['receipt:compile-failure'] } },
  }));
  assert.equal(scorecard.status, STRESS_STATUS.FAIL);
  assert.equal(scorecard.failed, 1);
});

test('dominance compares raw metrics without a compensating average', () => {
  const comparison = evaluateDominanceComparison({
    candidateId: 'rcl',
    referenceId: 'rust',
    metrics: {
      correctness: { candidate: 1, reference: 1, direction: 'higher-is-better', evidence: ['same-corpus'] },
      compileBuildSpeed: { candidate: 80, reference: 100, direction: 'lower-is-better', evidence: ['same-corpus'] },
      resourceEfficiency: { candidate: 0.7, reference: 0.8, direction: 'higher-is-better', evidence: ['same-corpus'] },
    },
  }, {
    requiredMetrics: ['correctness', 'compileBuildSpeed', 'resourceEfficiency'],
  });
  assert.equal(comparison.status, STRESS_STATUS.FAIL);
  assert.equal(comparison.metrics.find(metric => metric.id === 'resourceEfficiency').relation, 'LOSS');
});

test('dominance remains unverified when a required metric is not comparable', () => {
  const arena = evaluateDominanceArena({
    requiredMetrics: ['correctness', 'compileBuildSpeed'],
    comparisons: [{
      id: 'rcl-vs-rust',
      metrics: {
        correctness: { candidate: 1, reference: 1 },
        compileBuildSpeed: { comparable: false, reason: 'different corpus' },
      },
    }],
  });
  assert.equal(arena.status, STRESS_STATUS.UNVERIFIED);
  assert.equal(arena.comparisons[0].metrics[1].relation, 'UNVERIFIED');
});

test('a fully comparable non-compensatory comparison can pass', () => {
  const arena = evaluateDominanceArena({
    requiredMetrics: ['correctness', 'compileBuildSpeed'],
    comparisons: [{
      id: 'rcl-vs-reference',
      metrics: {
        correctness: { candidate: 1, reference: 1 },
        compileBuildSpeed: { candidate: 80, reference: 100, direction: 'lower-is-better' },
      },
    }],
  });
  assert.equal(arena.status, STRESS_STATUS.PASS);
  assert.equal(arena.comparableComparisons, 1);
});

test('manifest validation records an explicit comparison contract', () => {
  const manifest = validateDominanceArenaManifest({
    schema: DOMINANCE_ARENA_MANIFEST_SCHEMA,
    id: 'test-arena',
    track: 'compiler-toolchain',
    task: { id: 'fixture', name: 'fixture' },
    metrics: [{ id: 'compileBuildSpeed', direction: 'lower-is-better' }],
    requiredComparisonMetrics: ['compileBuildSpeed'],
    candidate: { command: [process.execPath, '-e', 'process.exit(0)'] },
    references: [],
    comparisons: [],
  });
  assert.equal(manifest.comparisons.length, 0);
  assert.equal(manifest.comparisonContract, null);
  assert.match(manifest.manifestRoot, /^[0-9a-f]{64}$/);
});

test('provider evidence comparison binds raw metrics to one input root', () => {
  const contract = {
    candidateId: 'rcl',
    referenceIds: ['rust'],
    candidateInputRootPath: 'inputRoot',
    referenceInputRootPath: 'inputRoot',
    metrics: {
      correctness: { candidatePath: 'metrics.correctness', referencePath: 'metrics.correctness' },
      compileBuildSpeed: { candidatePath: 'metrics.compileBuildSpeed', referencePath: 'metrics.compileBuildSpeed' },
    },
  };
  const candidate = {
    id: 'rcl',
    status: STRESS_STATUS.PASS,
    evidenceStatus: STRESS_STATUS.PASS,
    evidence: { evidenceRoot: 'candidate-root', inputRoot: 'same-root', metrics: { correctness: 1, compileBuildSpeed: 10 } },
    receipt: { receiptRoot: 'candidate-receipt' },
  };
  const reference = {
    id: 'rust',
    status: STRESS_STATUS.PASS,
    evidenceStatus: STRESS_STATUS.PASS,
    evidence: { evidenceRoot: 'reference-root', inputRoot: 'same-root', metrics: { correctness: 1, compileBuildSpeed: 20 } },
    receipt: { receiptRoot: 'reference-receipt' },
  };
  const comparisons = buildProviderEvidenceComparisons({
    contract,
    candidate,
    references: [reference],
    requiredMetrics: ['correctness', 'compileBuildSpeed'],
    metricSpecs: [
      { id: 'correctness', direction: 'higher-is-better' },
      { id: 'compileBuildSpeed', direction: 'lower-is-better' },
    ],
  });
  assert.equal(comparisons[0].inputRoots.candidate, 'same-root');
  assert.equal(comparisons[0].metrics.compileBuildSpeed.candidate, 10);
  assert.equal(evaluateDominanceArena({
    comparisons,
    requiredMetrics: ['correctness', 'compileBuildSpeed'],
  }).status, STRESS_STATUS.PASS);

  const mismatched = buildProviderEvidenceComparisons({
    contract,
    candidate,
    references: [{ ...reference, evidence: { ...reference.evidence, inputRoot: 'different-root' } }],
    requiredMetrics: ['correctness', 'compileBuildSpeed'],
  });
  assert.equal(mismatched[0].metrics.correctness.comparable, false);
  assert.equal(evaluateDominanceArena({
    comparisons: mismatched,
    requiredMetrics: ['correctness', 'compileBuildSpeed'],
  }).status, STRESS_STATUS.UNVERIFIED);
});

test('arena command records real execution and deterministic receipt identity', () => {
  const first = runArenaCommand([process.execPath, '-e', 'process.stdout.write("ok")']);
  const second = runArenaCommand([process.execPath, '-e', 'process.stdout.write("ok")']);
  assert.equal(first.status, STRESS_STATUS.PASS);
  assert.equal(first.stdoutTail, 'ok');
  assert.equal(first.receiptRoot, second.receiptRoot);
});

test('arena command fails closed on missing tools and timeouts', () => {
  const missing = runArenaCommand(['rcl-tool-that-does-not-exist-2026']);
  assert.equal(missing.status, STRESS_STATUS.BLOCKED);
  assert.equal(missing.failureType, 'TOOL_NOT_FOUND');

  const timeout = runArenaCommand([process.execPath, '-e', 'setTimeout(() => {}, 1000)'], { timeoutMs: 10 });
  assert.equal(timeout.status, STRESS_STATUS.BLOCKED);
  assert.equal(timeout.failureType, 'TIMEOUT');
});

test('arena runner executes a candidate without manufacturing dominance evidence', () => {
  const report = runRclDominanceArena({
    schema: DOMINANCE_ARENA_MANIFEST_SCHEMA,
    id: 'runtime-fixture',
    track: 'compiler-toolchain',
    task: { id: 'fixture', name: 'runtime fixture' },
    metrics: [{ id: 'compileBuildSpeed', direction: 'lower-is-better' }],
    requiredComparisonMetrics: ['compileBuildSpeed'],
    candidate: { command: [process.execPath, '-e', 'process.stdout.write("candidate")'] },
    references: [{
      id: 'missing-reference',
      command: ['rcl-tool-that-does-not-exist-2026'],
      optional: true,
      probeOnly: true,
    }],
    comparisons: [],
  });
  assert.equal(report.candidate.status, STRESS_STATUS.PASS);
  assert.equal(report.references[0].status, STRESS_STATUS.BLOCKED);
  assert.equal(report.sourceRevision.status, STRESS_STATUS.PASS);
  assert.match(report.sourceRevision.value, /^[0-9a-f]{40}$/);
  assert.equal(report.scorecard.axes.dominance.status, STRESS_STATUS.UNVERIFIED);
  assert.match(report.reportRoot, /^[0-9a-f]{64}$/);
});
