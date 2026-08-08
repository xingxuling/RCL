import assert from 'node:assert/strict';
import test from 'node:test';
import { buildRbc13DomainUniversalStressCandidateCell } from '../src/rbc13-domain-universal-stress-probe.mjs';
import { STRESS_STATUS } from '../src/universal-program-stress.mjs';

const ROOT = 'a'.repeat(64);

function syntheticSuite() {
  const operationKeys = ['core.echo', 'quantity.make', 'quantitative.measure', 'knowledge.claim'];
  return {
    status: 'native-verified',
    verified: true,
    root: ROOT,
    hostRoot: ROOT,
    reports: operationKeys.map((operationKey) => ({
      operationKey,
      status: 'native-verified',
      verified: true,
      root: ROOT,
      caseCount: 1,
      verifiedCaseCount: 1,
      gates: Object.fromEntries([
        'G1_operationScopedDifferential',
        'G2_experimentalRbc13BytesDeterministic',
        'G3_currentNativeSourceMaterialized',
        'G4_candidateNativeHostBuilt',
        'G5_positiveSemanticEquivalence',
        'G6_negativeSemanticEquivalence',
        'G7_nativeReplayDeterministic',
        'G8_nativeSemanticStateRootEmittedAndVerified',
        'G9_semanticRootParity',
        'G10_allEvidenceRootsRecorded',
        'G11_noCaseSilentlySkipped',
        'G12_nativePromotionEvidenceTier',
      ].map((gate) => [gate, true])),
      operationDifferential: { controlsPassed: true },
    })),
  };
}

test('RBC13 promotion earns a reusable candidate cell but not universal growth credit', () => {
  const probe = buildRbc13DomainUniversalStressCandidateCell(syntheticSuite());

  assert.equal(probe.status, STRESS_STATUS.BLOCKED);
  assert.equal(probe.cell.status, STRESS_STATUS.BLOCKED);
  assert.equal(probe.cell.coverageMode, 'native-semantic');
  assert.equal(probe.cell.specialCaseAudit.status, STRESS_STATUS.PASS);
  assert.equal(probe.universalGrowthEligible, false);
  assert.equal(probe.cell.universalGrowthEligible, false);
  assert.equal(probe.cell.authoritativeStateMutated, false);
  assert.equal(probe.operationKeys.length, 4);
  assert.match(probe.root, /^[a-f0-9]{64}$/);
});

test('candidate probe refuses an incomplete native promotion suite', () => {
  const suite = syntheticSuite();
  suite.reports = suite.reports.slice(0, 3);
  assert.throws(
    () => buildRbc13DomainUniversalStressCandidateCell(suite),
    error => error?.code === 'RCL_RBC13_UNIVERSAL_STRESS_OPERATION_COVERAGE_REQUIRED',
  );
});
