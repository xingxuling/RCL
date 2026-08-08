import assert from 'node:assert/strict';
import test from 'node:test';
import { buildRbc13CanonicalAdmissionReadiness } from '../src/rbc13-canonical-admission-readiness.mjs';

const ROOT = 'a'.repeat(64);

function nativeReport() {
  return {
    root: ROOT,
    gates: {
      G5_positiveSemanticEquivalence: true,
      G6_negativeSemanticEquivalence: true,
      G7_nativeReplayDeterministic: true,
      G8_nativeSemanticStateRootEmittedAndVerified: true,
      G9_semanticRootParity: true,
      G10_allEvidenceRootsRecorded: true,
      G12_nativePromotionEvidenceTier: true,
    },
  };
}

function input(overrides = {}) {
  return {
    number: { status: 'VERIFIED', root: ROOT, corpusRoot: ROOT, requirements: { n1: true, n2: true, n3: true, n4: true, n5: true } },
    native: { status: 'native-verified', verified: true, root: ROOT, reportRoots: [ROOT], reports: [nativeReport(), nativeReport(), nativeReport(), nativeReport()], canonicalAdmission: false },
    performance: { status: 'VERIFIED', root: ROOT, hostRoot: ROOT, measures: { allPathsExecuted: true, repeatedSamples: true, varianceRecorded: true, rssProxyRecorded: true } },
    aiGenerate: { status: 'CANDIDATE', gate: 'PASS', root: ROOT, successfulTrials: 1, requiredTrials: 1 },
    universal: { status: 'PASS', universalGrowthEligible: true, root: ROOT },
    legacy: { v1FocusedStatus: 'VERIFIED', fullSuiteStatus: 'VERIFIED' },
    selfhost: { fixedpointStatus: 'VERIFIED', examplesStatus: 'VERIFIED', stage40Status: 'VERIFIED' },
    versionContract: { status: 'VERIFIED', root: ROOT },
    ...overrides,
  };
}

test('canonical admission readiness is conjunctive and remains isolated', () => {
  const report = buildRbc13CanonicalAdmissionReadiness(input());
  assert.equal(report.verdict, 'VERIFIED');
  assert.equal(report.canonicalReady, true);
  assert.equal(report.canonicalAdmission, false);
  assert.deepEqual(report.blockingGates, []);
});

test('a negative donor result blocks admission even when native evidence passes', () => {
  const report = buildRbc13CanonicalAdmissionReadiness(input({
    aiGenerate: { status: 'NEGATIVE_RESULT', gate: 'FAIL', root: ROOT, successfulTrials: 0, requiredTrials: 1 },
    universal: { status: 'FAIL', universalGrowthEligible: false, root: ROOT },
  }));
  assert.equal(report.verdict, 'BLOCKED');
  assert.equal(report.canonicalReady, false);
  assert.deepEqual(report.blockingGates, ['A10_aiGenerateDonor', 'A12_universalStressAdmissionCell']);
});

test('legacy full-suite drift remains a named admission blocker', () => {
  const report = buildRbc13CanonicalAdmissionReadiness(input({ legacy: { v1FocusedStatus: 'VERIFIED', fullSuiteStatus: 'BLOCKED' } }));
  assert.equal(report.gates.A3_legacyRegressionClosure.passed, false);
  assert.equal(report.blockingGates.includes('A3_legacyRegressionClosure'), true);
});
