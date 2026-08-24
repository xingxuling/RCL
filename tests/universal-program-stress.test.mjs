import test from 'node:test';
import assert from 'node:assert/strict';

import {
  COVERAGE_MODE,
  KILLER_TASKS_V01,
  STRESS_STATUS,
  UNIVERSAL_ENVIRONMENTS,
  UNIVERSAL_PROGRAM_FAMILIES,
  UNIVERSAL_STRESS_GATES,
  auditK400Completion,
  buildUniversalStressMatrix,
  campaignCellIdFor,
  canonicalJson,
  classifyUniversalMaturity,
  compareRegression,
  decideGenomeAdmission,
  detectSpecialCaseInflation,
  evaluateStressCell,
  evidenceRoot,
  findUnabsorbedAdvantages,
  reportEvidenceRoot,
  validateUniversalStressEvidence,
} from '../src/universal-program-stress.mjs';

function passGates() {
  return Object.fromEntries(
    UNIVERSAL_STRESS_GATES.map((gate) => [gate, { status: STRESS_STATUS.PASS, evidence: [`receipt:${gate}`] }]),
  );
}

function passingCell(overrides = {}) {
  return evaluateStressCell({
    id: 'test-cell',
    environment: 'linux',
    programFamily: 'cli',
    coverageMode: COVERAGE_MODE.NATIVE_SEMANTIC,
    gates: passGates(),
    changes: [{ id: 'general-state-transition', scope: ['linux', 'windows', 'android'], generalPrimitive: true }],
    ...overrides,
  });
}

test('canonical evidence root is key-order independent', () => {
  assert.equal(canonicalJson({ b: 2, a: 1 }), canonicalJson({ a: 1, b: 2 }));
  assert.equal(evidenceRoot({ b: 2, a: 1 }), evidenceRoot({ a: 1, b: 2 }));
});

test('report evidence root excludes volatile generation time and an existing root', () => {
  const report = { schema: 'rcl.universal-stress.report.v0.1', generatedAt: '2026-08-24T00:00:00.000Z', claims: [{ id: 'a' }] };
  const first = reportEvidenceRoot(report);
  assert.equal(reportEvidenceRoot({ ...report, generatedAt: '2026-08-25T00:00:00.000Z' }), first);
  assert.equal(reportEvidenceRoot({ ...report, reportRoot: 'stale' }), first);
  assert.notEqual(reportEvidenceRoot({ ...report, claims: [{ id: 'b' }] }), first);
});

test('universal matrix is permanently 20 x 20 = 400 cells', () => {
  assert.equal(UNIVERSAL_ENVIRONMENTS.length, 20);
  assert.equal(UNIVERSAL_PROGRAM_FAMILIES.length, 20);
  const matrix = buildUniversalStressMatrix();
  assert.equal(matrix.length, 400);
  assert.equal(new Set(matrix.map((cell) => cell.id)).size, 400);
  assert.equal(new Set(matrix.map((cell) => cell.campaignId)).size, 400);
  assert.equal(matrix[0].campaignId, 'K001');
  assert.equal(matrix.at(-1).campaignId, 'K400');
  assert.equal(campaignCellIdFor('browser', 'gui'), 'K063');
});

test('evidence validation rejects duplicate, unknown and coordinate-conflicting claims', () => {
  const validation = validateUniversalStressEvidence({
    schema: 'rcl.universal-stress.evidence.v0.1',
    generation: 'invalid-fixture',
    claims: [
      { id: 'browser::gui', environment: 'android', coverageMode: 'lowered-execution', gates: {} },
      { id: 'browser::gui', coverageMode: 'lowered-execution', gates: { TYPO: { status: 'PASS' } } },
      { id: 'unknown::cell', coverageMode: 'native-semantic', gates: {} },
    ],
  });
  assert.equal(validation.ok, false);
  assert.ok(validation.errors.includes('claims[0].environment:mismatch:android'));
  assert.ok(validation.errors.includes('claims[1].id:duplicate:browser::gui'));
  assert.ok(validation.errors.includes('claims[1].gates:unknown:TYPO'));
  assert.ok(validation.errors.includes('claims[2].id:unknown:unknown::cell'));
});

test('K400 completion cannot be inferred from a partial or provider-only matrix', () => {
  const partial = auditK400Completion([passingCell()]);
  assert.equal(partial.verdict, 'INCOMPLETE');
  assert.equal(partial.evidenceComplete, false);

  const allProvider = buildUniversalStressMatrix().map((cell) => evaluateStressCell({
    ...cell,
    coverageMode: COVERAGE_MODE.OPAQUE_DELEGATION,
    gates: passGates(),
    changes: [],
  }));
  const providerAudit = auditK400Completion(allProvider);
  assert.equal(providerAudit.evidenceComplete, true);
  assert.equal(providerAudit.universalGrowthComplete, false);
  assert.equal(providerAudit.verdict, 'INCOMPLETE');
});

test('K400 completion requires all stable cells and every non-compensatory gate', () => {
  const reports = buildUniversalStressMatrix().map((cell) => evaluateStressCell({
    ...cell,
    coverageMode: COVERAGE_MODE.NATIVE_SEMANTIC,
    gates: passGates(),
    changes: [],
  }));
  const completion = auditK400Completion(reports);
  assert.equal(completion.verdict, 'COMPLETE');
  assert.equal(completion.passedCells, 400);
  assert.equal(completion.remainingCells, 0);
  assert.deepEqual(completion.missingIds, []);
});

test('killer suite contains 12 cross-domain tasks', () => {
  assert.equal(KILLER_TASKS_V01.length, 12);
  assert.ok(new Set(KILLER_TASKS_V01.map((task) => task.environment)).size >= 10);
  assert.ok(new Set(KILLER_TASKS_V01.map((task) => task.programFamily)).size >= 10);
});

test('all nine gates are non-compensatory', () => {
  for (const failingGate of UNIVERSAL_STRESS_GATES) {
    const gates = passGates();
    gates[failingGate] = { status: STRESS_STATUS.FAIL, evidence: [`failure:${failingGate}`] };
    const report = passingCell({ id: `fail-${failingGate}`, gates });
    assert.equal(report.status, STRESS_STATUS.FAIL, failingGate);
  }
});

test('missing evidence gates block instead of silently passing', () => {
  const gates = passGates();
  delete gates.EVIDENCE;
  const report = passingCell({ gates });
  assert.equal(report.status, STRESS_STATUS.BLOCKED);
  assert.equal(report.gates.EVIDENCE.status, STRESS_STATUS.UNVERIFIED);
});

test('untested and regressed cells remain distinct from ordinary blocked evidence', () => {
  const untested = passingCell({ status: STRESS_STATUS.UNTESTED, untested: true });
  assert.equal(untested.status, STRESS_STATUS.UNTESTED);
  const regressed = passingCell({ regression: { status: STRESS_STATUS.FAIL, reason: 'old receipt no longer reproduces' } });
  assert.equal(regressed.status, STRESS_STATUS.REGRESSED);
  assert.equal(regressed.universalGrowthEligible, false);
});

test('cell reports carry dashboard metadata and aggregated evidence', () => {
  const report = passingCell({
    lastVerifiedSha: 'a'.repeat(40),
    lastVerifiedDate: '2026-08-23',
    knownLimits: ['device runtime unverified'],
    relatedKillerTasks: ['K03'],
    requiredGenes: ['native-ui'],
    donorAdvantages: [{ donor: 'Android', capability: 'device adaptation' }],
  });
  assert.equal(report.gateStatus.EXECUTE, STRESS_STATUS.PASS);
  assert.ok(report.evidence.includes('receipt:EXECUTE'));
  assert.deepEqual(report.relatedKillerTasks, ['K03']);
});

test('opaque delegation never receives native semantic or executable language credit', () => {
  const report = passingCell({ coverageMode: COVERAGE_MODE.OPAQUE_DELEGATION });
  assert.equal(report.status, STRESS_STATUS.PASS);
  assert.equal(report.providerOnly, true);
  assert.equal(report.nativeSemanticCredit, false);
  assert.equal(report.executableCredit, false);
});

test('lowered execution receives executable credit but not native semantic credit', () => {
  const report = passingCell({ coverageMode: COVERAGE_MODE.LOWERED_EXECUTION });
  assert.equal(report.executableCredit, true);
  assert.equal(report.nativeSemanticCredit, false);
  assert.equal(report.providerOnly, false);
});

test('task-specific special cases are rejected by the generality audit', () => {
  const audit = detectSpecialCaseInflation([
    { id: 'android_button_special', scope: ['android'], generalPrimitive: false },
  ]);
  assert.equal(audit.status, STRESS_STATUS.FAIL);
  assert.deepEqual(audit.specialCases, ['android_button_special']);
});

test('general primitives spanning multiple environments survive the generality audit', () => {
  const audit = detectSpecialCaseInflation([
    { id: 'reactive-event-graph', scope: ['browser', 'android', 'game-runtime'], generalPrimitive: true },
  ]);
  assert.equal(audit.status, STRESS_STATUS.PASS);
});

test('regression comparison blocks degraded old capabilities', () => {
  const regression = compareRegression(
    [{ id: 'old-a', score: 0.9 }, { id: 'old-b', score: 0.8 }],
    [{ id: 'old-a', score: 0.9 }, { id: 'old-b', score: 0.6 }],
  );
  assert.equal(regression.status, STRESS_STATUS.FAIL);
  assert.equal(regression.regressions.length, 1);
  assert.equal(regression.regressions[0].id, 'old-b');
});

test('persistent donor advantage becomes an UNABSORBED_ADVANTAGE', () => {
  const gaps = findUnabsorbedAdvantages([
    { donor: 'Rust', taskId: 'K06', donorScore: 0.95, rclScore: 0.7, generationsObserved: 3 },
    { donor: 'Python', taskId: 'K10', donorScore: 0.9, rclScore: 0.86, generationsObserved: 4 },
  ]);
  assert.equal(gaps.length, 1);
  assert.equal(gaps[0].donor, 'Rust');
  assert.equal(gaps[0].classification, 'UNABSORBED_ADVANTAGE');
});

test('genome admission has four explicit outcomes', () => {
  const pass = passingCell();

  assert.equal(decideGenomeAdmission({}), 'REJECT');
  assert.equal(
    decideGenomeAdmission({ implementationAdvantage: true, usesOpaqueDelegation: true, identityGenomePreserved: true }),
    'ORGAN_ONLY',
  );
  assert.equal(
    decideGenomeAdmission({
      semanticNovelty: true,
      identityGenomePreserved: true,
      stressReports: [pass],
      regression: { status: STRESS_STATUS.PASS },
      evidenceSufficient: false,
    }),
    'EXPERIMENTAL_GENOME',
  );
  assert.equal(
    decideGenomeAdmission({
      semanticNovelty: true,
      identityGenomePreserved: true,
      stressReports: [pass],
      regression: { status: STRESS_STATUS.PASS },
      evidenceSufficient: true,
    }),
    'CANONICAL_RCL_GENOME',
  );
});

test('identity genome violation always rejects a candidate gene', () => {
  const decision = decideGenomeAdmission({
    semanticNovelty: true,
    capabilityGain: true,
    identityGenomePreserved: false,
    stressReports: [passingCell()],
    regression: { status: STRESS_STATUS.PASS },
    evidenceSufficient: true,
  });
  assert.equal(decision, 'REJECT');
});

test('maturity classifier refuses to call opaque delegation native-general', () => {
  const reports = Array.from({ length: 12 }, (_, index) =>
    passingCell({
      id: `opaque-${index}`,
      coverageMode: COVERAGE_MODE.OPAQUE_DELEGATION,
      environment: KILLER_TASKS_V01[index].environment,
      programFamily: KILLER_TASKS_V01[index].programFamily,
    }),
  );
  const maturity = classifyUniversalMaturity({ evaluatedCells: reports });
  assert.equal(maturity.level, 'U1');
  assert.equal(maturity.metrics.opaquePassed, 12);
  assert.equal(maturity.metrics.nativePassed, 0);
});

test('maturity classifier can only reach U5 with broad evidence, competitiveness, low kernel churn and no unabsorbed advantages', () => {
  const allCells = buildUniversalStressMatrix().map((cell) =>
    evaluateStressCell({
      ...cell,
      coverageMode: COVERAGE_MODE.NATIVE_SEMANTIC,
      gates: passGates(),
      changes: [],
    }),
  );
  const maturity = classifyUniversalMaturity({
    evaluatedCells: allCells,
    novelTaskTrials: 100,
    kernelChangesForNovelTasks: 2,
    competitiveComparisons: Array.from({ length: 10 }, (_, index) => ({ id: index, rclScore: 0.9, referenceScore: 0.85 })),
    unabsorbedAdvantages: [],
  });
  assert.equal(maturity.level, 'U5');
});
