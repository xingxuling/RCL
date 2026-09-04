import test from 'node:test';
import assert from 'node:assert/strict';
import { COVERAGE_MODE, STRESS_STATUS } from '../src/universal-program-stress.mjs';
import { buildK04ClaimFromDirectEvidence, summarizeK04Blockers } from '../src/universal-stress-k04-game-adapter.mjs';

function evidence() {
  return {
    schema: 'rcl.universal-stress.k04.direct-evidence.v0.1',
    evidenceRoot: 'a'.repeat(64),
    gameRuntime: { status: 'EXECUTED' },
    hostSimulation: {
      positive: { pass: true },
      preserveNegative: { pass: true },
      authorityNegative: { pass: true },
    },
    gates: {
      EXPRESS: 'PASS',
      COMPILE: 'PASS',
      LOWER: 'PASS',
      EXECUTE: 'PASS',
      CORRECT: 'PASS',
      ROBUST: 'PASS',
      PERFORMANCE: 'PASS',
      AI_GENERATE: 'UNVERIFIED',
      EVIDENCE: 'PASS',
    },
  };
}

test('K04 is blocked only by the independent AI generation gate in the first slice', () => {
  const input = evidence();
  const claim = buildK04ClaimFromDirectEvidence(input);
  assert.equal(claim.id, 'game-runtime::game');
  assert.equal(claim.status, STRESS_STATUS.BLOCKED);
  assert.equal(claim.coverageMode, COVERAGE_MODE.LOWERED_EXECUTION);
  assert.equal(claim.gates.EXECUTE.status, STRESS_STATUS.PASS);
  assert.equal(claim.gates.AI_GENERATE.status, STRESS_STATUS.UNVERIFIED);
  assert.equal(claim.specialCaseAudit.status, STRESS_STATUS.PASS);
  assert.deepEqual(summarizeK04Blockers(input), ['AI_GENERATE_UNVERIFIED']);
});

test('K04 cannot pass when host execution or negative controls are missing', () => {
  const input = evidence();
  input.gameRuntime.status = 'UNVERIFIED';
  input.hostSimulation.authorityNegative.pass = false;
  const claim = buildK04ClaimFromDirectEvidence(input);
  assert.equal(claim.status, STRESS_STATUS.BLOCKED);
  assert.deepEqual(summarizeK04Blockers(input), ['GAME_RUNTIME_NOT_EXECUTED', 'AUTHORITY_NEGATIVE_NOT_CLOSED', 'AI_GENERATE_UNVERIFIED']);
});

test('K04 admits a separately verified independent AI generation gate without relabeling direct evidence', () => {
  const input = evidence();
  const aiGenerateGate = {
    status: STRESS_STATUS.PASS,
    evidence: ['examples/universal-stress/k04-game-ai-generation-contract.v0.1.json', 'examples/universal-stress/evidence/k04-game-ai-generate/receipt.json', 'examples/universal-stress/evidence/k04-game-ai-generate/github-replay.json'],
    note: 'Three independent K04 game repairs restored canonical bytes and were hosted-replay bound.',
  };
  const claim = buildK04ClaimFromDirectEvidence(input, { aiGenerateGate });
  assert.equal(claim.status, STRESS_STATUS.PASS);
  assert.equal(claim.gates.AI_GENERATE.status, STRESS_STATUS.PASS);
  assert.deepEqual(summarizeK04Blockers(input, { aiGenerateGate }), []);
});
