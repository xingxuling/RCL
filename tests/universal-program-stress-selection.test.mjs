import test from 'node:test';
import assert from 'node:assert/strict';

import {
  COVERAGE_MODE,
  STRESS_STATUS,
  UNIVERSAL_STRESS_GATES,
  decideGenomeAdmission,
  evaluateStressCell,
} from '../src/universal-program-stress.mjs';

function passGates() {
  return Object.fromEntries(
    UNIVERSAL_STRESS_GATES.map((gate) => [gate, { status: STRESS_STATUS.PASS, evidence: [`receipt:${gate}`] }]),
  );
}

test('a task-specific patch may pass the task but receives no universal growth credit', () => {
  const report = evaluateStressCell({
    id: 'android::gui',
    environment: 'android',
    programFamily: 'gui',
    coverageMode: COVERAGE_MODE.NATIVE_SEMANTIC,
    gates: passGates(),
    changes: [{ id: 'android_button_special', scope: ['android'], generalPrimitive: false }],
  });

  assert.equal(report.status, STRESS_STATUS.PASS);
  assert.equal(report.specialCaseAudit.status, STRESS_STATUS.FAIL);
  assert.equal(report.universalGrowthEligible, false);
});

test('special-case success cannot promote a gene into the canonical RCL genome', () => {
  const report = evaluateStressCell({
    id: 'android::gui',
    environment: 'android',
    programFamily: 'gui',
    coverageMode: COVERAGE_MODE.NATIVE_SEMANTIC,
    gates: passGates(),
    changes: [{ id: 'android_button_special', scope: ['android'], generalPrimitive: false }],
  });

  const decision = decideGenomeAdmission({
    semanticNovelty: true,
    capabilityGain: true,
    stressReports: [report],
    regression: { status: STRESS_STATUS.PASS },
    evidenceSufficient: true,
    identityGenomePreserved: true,
  });

  assert.equal(decision, 'EXPERIMENTAL_GENOME');
});
