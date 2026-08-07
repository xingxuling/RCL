import fs from 'node:fs';
import { COVERAGE_MODE, STRESS_STATUS, evaluateStressCell } from './universal-program-stress.mjs';

export function buildK02ClaimFromDirectEvidence(evidence) {
  if (!evidence || evidence.schema !== 'rcl.universal-stress.k02.direct-evidence.v0.2') {
    throw new Error('RCL_STRESS_K02_INVALID_EVIDENCE');
  }
  const gates = Object.fromEntries(Object.entries(evidence.gates ?? {}).map(([gate, status]) => [gate, {
    status,
    evidence: [evidence.evidenceRoot],
    note: `K02 direct evidence ${evidence.evidenceRoot}`,
  }]));
  return evaluateStressCell({
    id: 'browser::web',
    environment: 'browser',
    programFamily: 'web',
    coverageMode: COVERAGE_MODE.LOWERED_EXECUTION,
    gates,
    changes: [
      { id: 'structured-ui-tree', generalPrimitive: true, scope: ['browser', 'android', 'game-runtime'], justification: 'typed UI trees generalize beyond Web' },
      { id: 'event-state-binding', generalPrimitive: true, scope: ['browser', 'android', 'game-runtime', 'realtime-runtime'], justification: 'event observations and governed state transitions are environment-independent' },
      { id: 'transactional-interaction-lowering', generalPrimitive: true, scope: ['browser', 'android', 'automation-runtime'], justification: 'authority/preserve/witness semantics survive UI lowering' },
    ],
  });
}

export function loadK02Claim(path) {
  return buildK02ClaimFromDirectEvidence(JSON.parse(fs.readFileSync(path, 'utf8')));
}
