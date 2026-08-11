import {
  COVERAGE_MODE,
  STRESS_STATUS,
  evaluateStressCell,
  evidenceRoot,
} from './universal-program-stress.mjs';

export const RBC13_DOMAIN_UNIVERSAL_STRESS_PROBE_FORMAT =
  'rcl.rbc13-domain-universal-stress-candidate-cell.v0.1';

const ADMITTED_OPERATION_KEYS = Object.freeze([
  'core.echo',
  'quantity.make',
  'quantitative.measure',
  'knowledge.claim',
]);

function evidence(label, roots) {
  return [label, ...roots.filter(Boolean)];
}

function assertNativeVerifiedSuite(suite) {
  if (!suite || suite.status !== 'native-verified' || suite.verified !== true) {
    const error = new Error('A native-verified RBC 1.3 Domain Organ suite is required for the candidate probe');
    error.code = 'RCL_RBC13_UNIVERSAL_STRESS_NATIVE_SUITE_REQUIRED';
    throw error;
  }
  if (!Array.isArray(suite.reports)
    || suite.reports.length !== ADMITTED_OPERATION_KEYS.length
    || suite.reports.some(report => report?.status !== 'native-verified' || report?.verified !== true)) {
    const error = new Error('The candidate probe requires native-verified reports for all four admitted operations');
    error.code = 'RCL_RBC13_UNIVERSAL_STRESS_OPERATION_COVERAGE_REQUIRED';
    throw error;
  }
}

export function buildRbc13DomainUniversalStressCandidateCell(suite, evidenceBundle = {}) {
  assertNativeVerifiedSuite(suite);
  const reports = suite.reports;
  const reportByOperation = new Map(reports.map(report => [report.operationKey, report]));
  if (ADMITTED_OPERATION_KEYS.some(operationKey => !reportByOperation.has(operationKey))) {
    const error = new Error('The candidate probe requires the complete four-operation admitted inventory');
    error.code = 'RCL_RBC13_UNIVERSAL_STRESS_OPERATION_INVENTORY_REQUIRED';
    throw error;
  }

  const reportRoots = ADMITTED_OPERATION_KEYS.map(operationKey => reportByOperation.get(operationKey).root);
  const allGatesPassed = reports.every(report => Object.values(report.gates ?? {}).every(Boolean));
  const allControlsPassed = reports.every(report => report.operationDifferential?.controlsPassed === true);
  const performanceVerified = evidenceBundle.performance?.status === 'VERIFIED'
    && evidenceBundle.performance?.measures?.allPathsExecuted === true
    && evidenceBundle.performance?.measures?.repeatedSamples === true
    && evidenceBundle.performance?.measures?.varianceRecorded === true;
  const aiStatus = evidenceBundle.aiGenerate?.status;
  const aiPassed = evidenceBundle.aiGenerate?.gate === 'PASS'
    && Number(evidenceBundle.aiGenerate?.successfulTrials ?? 0) >= Number(evidenceBundle.aiGenerate?.requiredTrials ?? 1);
  const cell = evaluateStressCell({
    id: 'wasm-vm::algorithm',
    environment: 'wasm-vm',
    programFamily: 'algorithm',
    coverageMode: COVERAGE_MODE.NATIVE_SEMANTIC,
    gates: {
      EXPRESS: {
        status: STRESS_STATUS.PASS,
        evidence: evidence('four-admitted-domain-operation-contract', reportRoots),
      },
      COMPILE: {
        status: allGatesPassed ? STRESS_STATUS.PASS : STRESS_STATUS.FAIL,
        evidence: evidence('candidate-native-host-built-from-current-source', [suite.hostRoot]),
      },
      LOWER: {
        status: allGatesPassed ? STRESS_STATUS.PASS : STRESS_STATUS.FAIL,
        evidence: evidence('experimental-rbc13-domain-call-opcode45', reportRoots),
      },
      EXECUTE: {
        status: STRESS_STATUS.PASS,
        evidence: evidence('independent-native-process-replay', [suite.root]),
      },
      CORRECT: {
        status: allGatesPassed ? STRESS_STATUS.PASS : STRESS_STATUS.FAIL,
        evidence: evidence('positive-and-negative-semantic-equivalence', reportRoots),
      },
      ROBUST: {
        status: allGatesPassed && allControlsPassed ? STRESS_STATUS.PASS : STRESS_STATUS.FAIL,
        evidence: evidence('negative-controls-and-fail-closed-domain-value-membrane', reportRoots),
      },
      PERFORMANCE: {
        status: performanceVerified ? STRESS_STATUS.PASS : STRESS_STATUS.UNVERIFIED,
        evidence: performanceVerified
          ? evidence('fixed-protocol-three-path-performance', [evidenceBundle.performance.root])
          : ['no-declared-three-path-performance-evidence-in-this-probe'],
        note: performanceVerified
          ? 'Repeated Primitive / Native Organ / Provider measurements exist; no competitive winner is claimed.'
          : 'Native execution is verified; performance evidence is not yet attached.',
      },
      AI_GENERATE: {
        status: aiPassed
          ? STRESS_STATUS.PASS
          : aiStatus === 'NEGATIVE_RESULT'
            ? STRESS_STATUS.FAIL
            : STRESS_STATUS.UNVERIFIED,
        evidence: aiPassed || aiStatus === 'NEGATIVE_RESULT'
          ? evidence('blind-json-schema-donor-experiment', [evidenceBundle.aiGenerate.root])
          : ['no-reproducible-ai-generation-contract-in-this-probe'],
        note: aiPassed
          ? 'One independent donor schema passed its declared generation and extraction contract.'
          : aiStatus === 'NEGATIVE_RESULT'
            ? 'The independent donor response was captured but failed the declared schema contract.'
            : 'The probe measures execution evidence only; it does not claim generative coverage.',
      },
      EVIDENCE: {
        status: STRESS_STATUS.PASS,
        evidence: evidence('rooted-native-promotion-reports', [suite.root, ...reportRoots]),
      },
    },
    changes: [{
      id: 'rbc13_domain_call_typed_organ_abi',
      kind: 'general-domain-organ-abi',
      scope: ['wasm-vm', 'linux', 'windows', 'compiler-runtime', 'simulation-runtime'],
      generalPrimitive: true,
      justification:
        'A typed domain-operation ABI and fail-closed value membrane are reusable primitives; this is not an environment- or task-specific patch.',
    }],
  });

  const report = {
    format: RBC13_DOMAIN_UNIVERSAL_STRESS_PROBE_FORMAT,
    version: '0.1.0-alpha.1',
    status: cell.status,
    candidate: true,
    suiteRoot: suite.root,
    operationKeys: ADMITTED_OPERATION_KEYS,
    operationReportRoots: reportRoots,
    performanceEvidenceRoot: evidenceBundle.performance?.root ?? null,
    aiGenerateEvidenceRoot: evidenceBundle.aiGenerate?.root ?? null,
    caseCount: reports.reduce((sum, reportItem) => sum + Number(reportItem.caseCount ?? 0), 0),
    verifiedCaseCount: reports.reduce((sum, reportItem) => sum + Number(reportItem.verifiedCaseCount ?? 0), 0),
    cell,
    universalGrowthEligible: cell.universalGrowthEligible,
    boundary:
      'This is one Universal Stress candidate cell. Its special-case audit passes because the ABI is declared as a reusable primitive. Performance evidence is measurement-only, and a failed AI_GENERATE donor gate fails the cell; neither result raises universal maturity or canonical RBC admission.',
  };
  return Object.freeze({
    ...report,
    root: evidenceRoot(report),
  });
}
