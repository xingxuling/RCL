import fs from 'node:fs';
import { COVERAGE_MODE, STRESS_STATUS, evaluateStressCell } from './universal-program-stress.mjs';

export const K04_CELL_ID = 'game-runtime::game';

export function buildK04ClaimFromDirectEvidence(evidence) {
  if (!evidence || evidence.schema !== 'rcl.universal-stress.k04.direct-evidence.v0.1') {
    throw new Error('RCL_STRESS_K04_INVALID_EVIDENCE');
  }
  const gates = Object.fromEntries(Object.entries(evidence.gates ?? {}).map(([gate, status]) => [gate, {
    status,
    evidence: [evidence.evidenceRoot],
    note: 'K04 direct evidence ' + evidence.evidenceRoot,
  }]));
  return evaluateStressCell({
    id: K04_CELL_ID,
    environment: 'game-runtime',
    programFamily: 'game',
    coverageMode: COVERAGE_MODE.LOWERED_EXECUTION,
    gates,
    changes: [
      {
        id: 'fixed-step-2d-physics',
        generalPrimitive: true,
        scope: ['game-runtime', 'realtime-runtime', 'embedded-runtime', 'simulation-runtime'],
        justification: 'fixed-step state integration is reusable beyond one game',
      },
      {
        id: 'transactional-input-and-collision',
        generalPrimitive: true,
        scope: ['game-runtime', 'browser', 'android', 'rncs-runtime'],
        justification: 'input, collision and governed state commit share an interactive runtime contract',
      },
      {
        id: 'scene-projection',
        generalPrimitive: true,
        scope: ['game-runtime', 'browser', 'rncs-runtime', 'simulation-runtime'],
        justification: 'state-bound 2D scene projection is not game-title-specific',
      },
    ],
  });
}

export function loadK04Claim(filePath) {
  return buildK04ClaimFromDirectEvidence(JSON.parse(fs.readFileSync(filePath, 'utf8')));
}

export function summarizeK04Blockers(evidence) {
  const blockers = [];
  if (evidence.gameRuntime?.status !== 'EXECUTED') blockers.push('GAME_RUNTIME_NOT_EXECUTED');
  if (evidence.hostSimulation?.positive?.pass !== true) blockers.push('POSITIVE_REPLAY_NOT_CLOSED');
  if (evidence.hostSimulation?.preserveNegative?.pass !== true) blockers.push('PRESERVE_NEGATIVE_NOT_CLOSED');
  if (evidence.hostSimulation?.authorityNegative?.pass !== true) blockers.push('AUTHORITY_NEGATIVE_NOT_CLOSED');
  if (evidence.gates?.AI_GENERATE !== STRESS_STATUS.PASS) blockers.push('AI_GENERATE_UNVERIFIED');
  return blockers;
}
