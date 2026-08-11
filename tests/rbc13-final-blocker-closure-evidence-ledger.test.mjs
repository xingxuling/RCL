import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildRbc13FinalBlockerClosureEvidenceLedger,
  renderRbc13FinalBlockerClosureEvidenceLedger,
  renderRbc13PolybodyParityEvidence,
} from '../src/rbc13-final-blocker-closure-evidence-ledger.mjs';

function nativeReport() {
  return {
    root: 'operation-root',
    gates: {
      G1_operationDeclared: true,
      G2_candidateOrganRegistered: true,
      G3_currentSourceMaterialized: true,
      G4_nativeProcessExecuted: true,
      G5_positiveSemanticEquivalence: true,
      G6_negativeSemanticEquivalence: true,
      G7_nativeReplayDeterministic: true,
      G8_nativeSemanticStateRootEmittedAndVerified: true,
      G9_semanticRootParity: true,
      G10_allEvidenceRootsRecorded: true,
      G11_noProviderFallback: true,
      G12_nativePromotionEvidenceTier: true,
    },
  };
}

function graphCases() {
  return Array.from({ length: 7 }, (_, index) => ({
    id: `case-${index}`,
    class: 'bounded',
    js: { status: 'ok', semanticRoot: `root-${index}` },
    semanticRootParity: true,
    resultOrErrorParity: true,
    statusParity: true,
  }));
}

function fixture() {
  return {
    branch: 'research/rbc13-domain-call-salvage-v0.1',
    sourceHead: 'source-head',
    number: {
      status: 'VERIFIED',
      root: 'number-root',
      corpusRoot: 'number-corpus-root',
      caseCount: 11000,
      requirements: {
        n1UniqueCanonicalEncoding: true,
        n2JsCByteParity: true,
        n3RoundTrip: true,
        n4FiniteAndEdgeCoverage: true,
        n5VersionIsolation: true,
      },
    },
    native: {
      status: 'native-verified',
      verified: true,
      root: 'native-root',
      reportRoots: ['r1', 'r2', 'r3', 'r4'],
      canonicalAdmission: false,
      reports: [nativeReport(), nativeReport(), nativeReport(), nativeReport()],
    },
    performance: {
      status: 'VERIFIED',
      root: 'performance-root',
      measures: {
        allPathsExecuted: true,
        repeatedSamples: true,
        varianceRecorded: true,
        rssProxyRecorded: true,
      },
      paths: { primitive: [], 'native-organ': [], provider: [] },
    },
    aiCompatibility: {
      status: 'NEGATIVE_RESULT',
      root: 'compatibility-root',
      corpus: {
        root: 'corpus-root',
        caseCount: 100,
        classificationCounts: { positive: 40, negative: 40, boundary: 20 },
        mutationControls: [{ id: 'required' }],
      },
      donor: { root: 'donor-root' },
      oracle: { implementation: 'Ajv2020', dependency: 'ajv@8.20.0', sharedCandidateImports: false },
      summary: {
        humanRepairs: 0,
        automaticRepairs: 0,
        bestAcl: 'ACL2',
        aclByModel: { medium: 'ACL2' },
        nativePromotionVerifiedModels: [],
        assimilationMonotonic: 'NOT_ESTABLISHED',
      },
      formalA10: { status: 'NEGATIVE_RESULT', requiresNativePromotion: true },
      strictGrowthAssessment: { globalLevel: 'Level 2 VERIFIED', nextLevel: 'Level 3 CANDIDATE/BLOCKED' },
    },
    wasmGrowthCell: {
      status: 'VERIFIED',
      root: 'wasm-root',
      operationKey: 'wasm-vm::algorithm::graph-traversal',
      universalGrowthEligible: true,
      canonicalAdmission: false,
      nativeC: { status: 'VERIFIED', hostRoot: 'c-host-root' },
      wasm: { status: 'VERIFIED', moduleRoot: 'wasm-module-root' },
      reference: { status: 'VERIFIED' },
      cases: graphCases(),
      coverage: {},
      wasmAbi: { failClosed: true, negativeControls: [{ id: 'invalid-pointer', detected: true }] },
      replay: { status: 'VERIFIED' },
      workload: { semantics: 'bounded traversal' },
      universalStress: { status: 'VERIFIED' },
    },
    legacyClosure: {
      status: 'VERIFIED',
      root: 'legacy-root',
      expectedInventoryRoot: 'inventory-root',
      summary: {
        expectedCaseCount: 6,
        verifiedReceiptCount: 6,
        missing: [],
        duplicate: [],
        stale: [],
        altered: [],
        replayMismatches: [],
        rbc11Verified: true,
        rbc12Verified: true,
      },
      checks: {
        expectedInventoryAuthoritative: true,
        noMissingCases: true,
        noDuplicateReceiptRoots: true,
        noStaleReceipts: true,
        noAlteredReceipts: true,
        replayRootConsistency: true,
        rbc11Verified: true,
        rbc12Verified: true,
      },
    },
    fullSuite: { status: 'VERIFIED', total: 10, pass: 8, fail: 0, skipped: 2, cancelled: 0 },
    versionContract: { status: 'VERIFIED', contracts: {} },
    selfhost: {
      fixedpointStatus: 'VERIFIED',
      examplesReport: { ok: true, artifactParity: true, eligibleCount: 17, failureCount: 0 },
      stage40Report: { stageStatus: 'STAGE40_VERIFIED', checks: { one: true, two: true } },
    },
  };
}

test('final blocker ledger keeps formal A10 negative and A12 polybody parity explicit', () => {
  const report = buildRbc13FinalBlockerClosureEvidenceLedger(fixture());
  assert.equal(report.status, 'BLOCKED');
  assert.deepEqual(report.blockingGates, ['A10_aiGenerateDonor']);
  assert.equal(report.a10.formalA10.status, 'NEGATIVE_RESULT');
  assert.equal(report.a12.crossBodyParity, true);
  assert.equal(report.fullSuite.fail, 0);
  assert.match(renderRbc13FinalBlockerClosureEvidenceLedger(report), /A10 Compatibility Surface/);
  assert.match(renderRbc13PolybodyParityEvidence(report), /Canonical permission: \*\*false\*\*/);
});
