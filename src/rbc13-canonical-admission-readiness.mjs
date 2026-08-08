import { createHash } from 'node:crypto';

export const RBC13_CANONICAL_ADMISSION_READINESS_FORMAT = 'rcl.rbc13-canonical-admission-readiness.v0.1';
export const RBC13_CANONICAL_ADMISSION_GATE_KEYS = Object.freeze([
  'A1_numberEncodingV2',
  'A2_nativePromotionInventory',
  'A3_legacyRegressionClosure',
  'A4_positiveSemanticEquivalence',
  'A5_negativeSemanticEquivalence',
  'A6_deterministicReplay',
  'A7_semanticRootEvidence',
  'A8_authorityAndEvidenceBoundary',
  'A9_performanceEvidence',
  'A10_aiGenerateDonor',
  'A11_selfhostAndVersionContract',
  'A12_universalStressAdmissionCell',
]);

function sha256(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function gate(key, passed, evidence, blocker = null) {
  return Object.freeze({ key, passed: passed === true, evidence: [...evidence].filter(Boolean), blocker });
}

function allNativeReports(native) {
  return native?.status === 'native-verified'
    && native?.verified === true
    && Array.isArray(native?.reports)
    && native.reports.length === 4;
}

export function buildRbc13CanonicalAdmissionReadiness(input = {}) {
  const number = input.number ?? {};
  const native = input.native ?? {};
  const performance = input.performance ?? {};
  const aiGenerate = input.aiGenerate ?? {};
  const aiThreshold = input.aiThreshold ?? {};
  const universal = input.universal ?? {};
  const growthCell = input.growthCell ?? {};
  const legacy = input.legacy ?? {};
  const legacyClosure = input.legacyClosure ?? {};
  const selfhost = input.selfhost ?? {};
  const versionContract = input.versionContract ?? {};
  const numberRequirements = number.requirements ?? {};
  const nativeReports = native.reports ?? [];
  const allNative = allNativeReports(native);
  const allNativeGates = nativeReports.length === 4 && nativeReports.every(report => Object.values(report.gates ?? {}).every(Boolean));
  const allPositive = nativeReports.length === 4 && nativeReports.every(report => report.gates?.G5_positiveSemanticEquivalence === true);
  const allNegative = nativeReports.length === 4 && nativeReports.every(report => report.gates?.G6_negativeSemanticEquivalence === true);
  const allReplay = nativeReports.length === 4 && nativeReports.every(report => report.gates?.G7_nativeReplayDeterministic === true);
  const allRoots = nativeReports.length === 4 && nativeReports.every(report => report.gates?.G8_nativeSemanticStateRootEmittedAndVerified === true && report.gates?.G9_semanticRootParity === true);
  const authorityBoundary = allNative && nativeReports.every(report => report.gates?.G10_allEvidenceRootsRecorded === true && report.gates?.G12_nativePromotionEvidenceTier === true)
    && native.canonicalAdmission !== true;
  const performancePass = performance.status === 'VERIFIED'
    && performance.measures?.allPathsExecuted === true
    && performance.measures?.repeatedSamples === true
    && performance.measures?.varianceRecorded === true
    && performance.measures?.rssProxyRecorded === true;
  const hasAiThreshold = Object.keys(aiThreshold).length > 0;
  const aiPass = hasAiThreshold
    ? aiThreshold.status === 'VERIFIED'
      && aiThreshold.summary?.allTiersReachedL4 === true
      && Number(aiThreshold.summary?.humanInterventions ?? 0) === 0
    : aiGenerate.status === 'CANDIDATE'
      && aiGenerate.gate === 'PASS'
      && Number(aiGenerate.successfulTrials ?? 0) >= Number(aiGenerate.requiredTrials ?? 1);
  const hasGrowthCell = Object.keys(growthCell).length > 0;
  const universalPass = hasGrowthCell
    ? growthCell.status === 'VERIFIED' && growthCell.universalGrowthEligible === true
    : universal.status === 'PASS' && universal.universalGrowthEligible === true;
  const hasLegacyClosure = Object.keys(legacyClosure).length > 0;
  const legacyClosurePass = hasLegacyClosure
    ? legacyClosure.status === 'VERIFIED'
      && legacyClosure.checks?.expectedInventoryAuthoritative === true
      && legacyClosure.checks?.noMissingCases === true
      && legacyClosure.checks?.noDuplicateReceiptRoots === true
      && legacyClosure.checks?.noStaleReceipts === true
      && legacyClosure.checks?.noAlteredReceipts === true
      && legacyClosure.checks?.replayRootConsistency === true
      && legacyClosure.checks?.rbc11Verified === true
      && legacyClosure.checks?.rbc12Verified === true
    : true;
  const gates = {
    A1_numberEncodingV2: gate('A1_numberEncodingV2', number.status === 'VERIFIED' && Object.values(numberRequirements).every(Boolean), [number.root, number.corpusRoot], number.status === 'VERIFIED' ? null : 'Number v2 corpus or requirements are incomplete'),
    A2_nativePromotionInventory: gate('A2_nativePromotionInventory', allNative && allNativeGates, [native.root, ...(native.reportRoots ?? [])], allNative ? null : 'Four-operation Native Promotion is not fully verified'),
    A3_legacyRegressionClosure: gate('A3_legacyRegressionClosure', legacyClosurePass && legacy.v1FocusedStatus === 'VERIFIED' && legacy.fullSuiteStatus === 'VERIFIED', [legacyClosure.root, legacy.v1FocusedRoot, legacy.fullSuiteRoot], legacyClosurePass && legacy.fullSuiteStatus === 'VERIFIED' ? null : 'Legacy receipt closure or full-suite regression is not VERIFIED'),
    A4_positiveSemanticEquivalence: gate('A4_positiveSemanticEquivalence', allPositive, nativeReports.map(report => report.root), allPositive ? null : 'At least one positive operation differential is incomplete'),
    A5_negativeSemanticEquivalence: gate('A5_negativeSemanticEquivalence', allNegative, nativeReports.map(report => report.root), allNegative ? null : 'At least one negative/error semantic differential is incomplete'),
    A6_deterministicReplay: gate('A6_deterministicReplay', allReplay, nativeReports.map(report => report.root), allReplay ? null : 'Native replay determinism is incomplete'),
    A7_semanticRootEvidence: gate('A7_semanticRootEvidence', allRoots, nativeReports.map(report => report.root), allRoots ? null : 'Native semantic state-root emission/parity is incomplete'),
    A8_authorityAndEvidenceBoundary: gate('A8_authorityAndEvidenceBoundary', authorityBoundary, [native.root, versionContract.root], authorityBoundary ? null : 'Evidence roots/tier boundary or canonical isolation is incomplete'),
    A9_performanceEvidence: gate('A9_performanceEvidence', performancePass, [performance.root, performance.hostRoot], performancePass ? null : 'Three-path performance evidence is incomplete'),
    A10_aiGenerateDonor: gate('A10_aiGenerateDonor', aiPass, hasAiThreshold ? [aiThreshold.root, aiThreshold.protocol?.promptRoot, aiThreshold.donorSpec?.root] : [aiGenerate.root, aiGenerate.responseRoot, aiGenerate.corpus?.root], aiPass ? null : `AI_GENERATE donor status is ${hasAiThreshold ? aiThreshold.status ?? 'missing' : aiGenerate.status ?? 'missing'}`),
      A11_selfhostAndVersionContract: gate('A11_selfhostAndVersionContract', selfhost.fixedpointStatus === 'VERIFIED' && selfhost.examplesStatus === 'VERIFIED' && selfhost.stage40Status === 'VERIFIED' && versionContract.status === 'VERIFIED', [selfhost.fixedpointRoot, selfhost.examplesRoot, selfhost.stage40Root, versionContract.root], selfhost.fixedpointStatus === 'VERIFIED' && selfhost.examplesStatus === 'VERIFIED' && selfhost.stage40Status === 'VERIFIED' && versionContract.status === 'VERIFIED' ? null : 'Selfhost or version-contract evidence is incomplete'),
    A12_universalStressAdmissionCell: gate('A12_universalStressAdmissionCell', universalPass, hasGrowthCell ? [growthCell.root] : [universal.root], universalPass ? null : `Universal Stress cell is ${hasGrowthCell ? growthCell.status ?? 'missing' : universal.status ?? 'missing'}`),
  };
  const blockingGates = RBC13_CANONICAL_ADMISSION_GATE_KEYS.filter(key => !gates[key].passed);
  const canonicalReady = blockingGates.length === 0;
  const report = {
    format: RBC13_CANONICAL_ADMISSION_READINESS_FORMAT,
    version: '0.1.0-alpha.1',
    verdict: canonicalReady ? 'VERIFIED' : 'BLOCKED',
    canonicalReady,
    canonicalAdmission: false,
    gates,
    blockingGates,
    requiredBeforeCanonicalAdmission: [
      'Resolve every blocking gate without mutating the v1 contract in place.',
      'Re-run the full current-source/native/legacy/selfhost evidence matrix on the final proposed roots.',
      'Obtain separate Integration Court approval for canonical language and version-contract changes.',
    ],
    boundary: 'Readiness is a proposal input, not a canonical activation. A VERIFIED candidate evidence set would still require an explicit governance admission commit.',
  };
  return Object.freeze({ ...report, root: sha256(report) });
}
