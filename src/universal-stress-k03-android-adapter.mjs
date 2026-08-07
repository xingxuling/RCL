import fs from 'node:fs';
import { COVERAGE_MODE, STRESS_STATUS, evaluateStressCell } from './universal-program-stress.mjs';

export const K03_CELL_ID = 'android::mobile';

export function buildK03ClaimFromDirectEvidence(evidence) {
  if (!evidence || evidence.schema !== 'rcl.universal-stress.k03.direct-evidence.v0.1') {
    throw new Error('RCL_STRESS_K03_INVALID_EVIDENCE');
  }
  const gates = Object.fromEntries(Object.entries(evidence.gates ?? {}).map(([gate, status]) => [gate, {
    status,
    evidence: [evidence.evidenceRoot],
    note: `K03 direct evidence ${evidence.evidenceRoot}`,
  }]));
  return evaluateStressCell({
    id: K03_CELL_ID,
    environment: 'android',
    programFamily: 'mobile',
    coverageMode: COVERAGE_MODE.LOWERED_EXECUTION,
    gates,
    changes: [
      { id: 'native-view-projection', generalPrimitive: true, scope: ['android', 'browser', 'game-runtime', 'realtime-runtime'], justification: 'state-bound native view projection is reusable across interactive runtimes' },
      { id: 'lifecycle-state-restoration', generalPrimitive: true, scope: ['android', 'browser', 'game-runtime', 'embedded-runtime'], justification: 'authority state survives host lifecycle boundaries' },
      { id: 'transactional-mobile-interaction', generalPrimitive: true, scope: ['android', 'browser', 'automation-runtime', 'rncs-runtime'], justification: 'observations and governed commits remain RCL transactions' },
    ],
  });
}

export function loadK03Claim(filePath) {
  return buildK03ClaimFromDirectEvidence(JSON.parse(fs.readFileSync(filePath, 'utf8')));
}

export function summarizeK03Blockers(evidence) {
  const blockers = [];
  if (evidence.android?.build?.status !== 'BUILT') blockers.push('ANDROID_BUILD_NOT_VERIFIED');
  if (evidence.android?.runtime?.status !== 'EXECUTED') blockers.push('ANDROID_RUNTIME_NOT_VERIFIED');
  if (evidence.gates?.AI_GENERATE !== STRESS_STATUS.PASS) blockers.push('AI_GENERATE_UNVERIFIED');
  return blockers;
}
