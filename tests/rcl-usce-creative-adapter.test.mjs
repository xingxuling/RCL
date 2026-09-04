import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RCL_USCE_CREATIVE_CAPABILITY,
  RclUsceCreativeAdapterError,
  creativeProviderHandshake,
  handleCreativeAdapterRequest,
  invokeCreativeCandidate,
} from '../adapters/rcl-usce-creative-adapter.mjs';
import { canonicalSha256 } from '../adapters/sga-multiview-creative-lowering.mjs';

function candidate(profileId, index) {
  const core = {
    format: 'sga.multiview-candidate.v0.1',
    candidate_id: `candidate:${String(index).padStart(2, '0')}:${profileId}`,
    profile_id: profileId,
    goal: 'Generate candidate structure.',
    source_root: '1'.repeat(64),
    base_structure_root: '2'.repeat(64),
    source_operators: ['Productive Synthesis Operator'],
    intent: profileId,
    structural_moves: [`apply ${profileId}`],
    preservation_requirements: ['canonical-owner-boundary'],
    constraints: ['candidate-only'],
    known_conflicts: [],
    conflict_policy: profileId,
    coordination_risks: ['coordination-cost'],
    evaluation_questions: ['Does the proposal preserve the owner boundary?'],
    candidate_value: { strategy: profileId, operations: [`apply ${profileId}`] },
    evaluation_status: 'UNEVALUATED',
    authority: { candidate_only: true, may_execute: false, may_commit: false, may_promote: false },
  };
  return { ...core, candidate_root: canonicalSha256(core) };
}

function candidateSet() {
  const candidates = [candidate('specialization-preserving', 1), candidate('semantic-fork', 2)];
  const core = {
    format: 'sga.multiview-candidate-set.v0.1',
    version: '0.1.0-alpha.1',
    source_root: '1'.repeat(64),
    base_structure_root: '2'.repeat(64),
    candidate_count: candidates.length,
    candidates,
    rcl_lowering: { target: 'RCL creative-reality / Create<T>', status: 'CANDIDATE_MAPPING_ONLY', rule: 'candidate-only' },
    evaluation_boundary: {
      scores_emitted: false,
      aesthetic_judgment_emitted: false,
      scientific_verdict_emitted: false,
      future_probability_emitted: false,
      artifact_acceptance_emitted: false,
    },
    authority: {
      candidate_only: true,
      may_execute: false,
      may_commit_rcl_evidence: false,
      may_commit_rncs_state: false,
      may_promote_world_fact: false,
      may_promote_organ: false,
    },
  };
  return { ...core, set_root: canonicalSha256(core) };
}

const REQUEST = {
  goal: 'Generate candidate structure.',
  base_structure: { owner: 'specialist-a' },
  invariants: ['canonical-owner-boundary'],
  candidate_budget: 2,
};

test('handshake exposes only the bounded RCL creative candidate capability', () => {
  const handshake = creativeProviderHandshake();
  assert.equal(handshake.status, 'REACHABLE');
  assert.equal(handshake.organ_id, 'rcl');
  assert.deepEqual(handshake.capabilities, [RCL_USCE_CREATIVE_CAPABILITY]);
  assert.equal(handshake.authority_boundary.provider_owns_creative_semantics, false);
  assert.equal(handshake.authority_boundary.rcl_owns_creative_semantics, true);
  assert.equal(handshake.authority_boundary.may_score_automatically, false);
});

test('invoke returns only unscored CreationProposal values and candidate roots', async () => {
  const source = candidateSet();
  const result = await invokeCreativeCandidate(REQUEST, { invokeGenerator: async request => {
    assert.equal(request.goal, REQUEST.goal);
    return source;
  }});

  assert.equal(result.status, 'CANDIDATE');
  assert.equal(result.capability_id, RCL_USCE_CREATIVE_CAPABILITY);
  assert.equal(result.candidate_set.set_root, source.set_root);
  assert.deepEqual(result.candidate_set.candidate_roots, source.candidates.map(item => item.candidate_root));
  assert.equal(result.proposals.length, 2);
  assert.equal(result.proposals.every(item => item.kind === 'CreationProposal' && !Object.hasOwn(item, 'score')), true);
  assert.equal(result.evaluation_status, 'UNEVALUATED');
  assert.equal(result.scoring_performed, false);
  assert.equal(result.selection_performed, false);
  assert.equal(result.canonical_promotion_performed, false);
  assert.equal(result.rcl_evidence_commit_performed, false);
  assert.equal(result.rncs_commit_performed, false);
});

test('adapter action rejects unknown capability instead of silently routing', async () => {
  await assert.rejects(
    () => handleCreativeAdapterRequest({ action: 'invoke', capability_id: 'creative.score.self', payload: REQUEST }),
    error => error instanceof RclUsceCreativeAdapterError && error.code === 'RCL_CREATIVE_CAPABILITY_UNSUPPORTED',
  );
});

test('creative request requires explicit goal and base structure', async () => {
  await assert.rejects(
    () => invokeCreativeCandidate({ goal: '', base_structure: {} }, { invokeGenerator: async () => candidateSet() }),
    error => error instanceof RclUsceCreativeAdapterError && error.code === 'RCL_CREATIVE_GOAL_REQUIRED',
  );
  await assert.rejects(
    () => invokeCreativeCandidate({ goal: 'x' }, { invokeGenerator: async () => candidateSet() }),
    error => error instanceof RclUsceCreativeAdapterError && error.code === 'RCL_CREATIVE_BASE_STRUCTURE_REQUIRED',
  );
});

test('provider output with evaluator score leakage is rejected before USCE result formation', async () => {
  const source = candidateSet();
  source.candidates[0].score = 1;
  source.candidates[0].candidate_root = canonicalSha256(
    Object.fromEntries(Object.entries(source.candidates[0]).filter(([key]) => key !== 'candidate_root')),
  );
  const core = Object.fromEntries(Object.entries(source).filter(([key]) => key !== 'set_root'));
  source.set_root = canonicalSha256(core);
  await assert.rejects(
    () => invokeCreativeCandidate(REQUEST, { invokeGenerator: async () => source }),
    /evaluator-owned field 'score'/,
  );
});
