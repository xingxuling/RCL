import test from 'node:test';
import assert from 'node:assert/strict';
import { RCLRuntimeError } from '../src/errors.mjs';
import { isCreationProposal, isCreation } from '../src/creative-proposal-api.mjs';
import {
  SgaCreativeLoweringError,
  canonicalSha256,
  lowerSgaMultiviewToCreationProposals,
  scoreSgaCreationProposal,
  verifySgaMultiviewCandidateSet,
} from '../adapters/sga-multiview-creative-lowering.mjs';

function candidate(profileId, index) {
  const core = {
    format: 'sga.multiview-candidate.v0.1',
    candidate_id: `candidate:${String(index).padStart(2, '0')}:${profileId}`,
    profile_id: profileId,
    goal: 'Preserve specialist ownership while generating alternatives.',
    source_root: '1'.repeat(64),
    base_structure_root: '2'.repeat(64),
    source_operators: ['Productive Synthesis Operator'],
    intent: `candidate view ${profileId}`,
    structural_moves: ['preserve owner', `apply ${profileId}`],
    preservation_requirements: ['canonical-owner-boundary'],
    constraints: ['candidate-only'],
    known_conflicts: [],
    conflict_policy: profileId,
    coordination_risks: ['coordination cost'],
    evaluation_questions: ['Does it preserve the declared invariant?'],
    candidate_value: {
      goal: 'Preserve specialist ownership while generating alternatives.',
      strategy: profileId,
      base_structure: { owner: 'specialist-a' },
      operations: ['preserve owner', `apply ${profileId}`],
    },
    evaluation_status: 'UNEVALUATED',
    authority: {
      candidate_only: true,
      may_execute: false,
      may_commit: false,
      may_promote: false,
    },
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
    rcl_lowering: {
      target: 'RCL creative-reality / Create<T>',
      status: 'CANDIDATE_MAPPING_ONLY',
      rule: 'SGA supplies candidate values; RCL owns governed Creation semantics, scoring and selection.',
    },
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

test('verified SGA candidate set lowers to unscored RCL CreationProposal values with provenance intact', () => {
  const source = candidateSet();
  const verified = verifySgaMultiviewCandidateSet(source);
  const lowered = lowerSgaMultiviewToCreationProposals(source);

  assert.equal(verified.valid, true);
  assert.equal(lowered.proposalCount, 2);
  assert.equal(lowered.setRoot, source.set_root);
  assert.deepEqual(lowered.candidateRoots, source.candidates.map(item => item.candidate_root));
  assert.equal(lowered.authority.selectionPerformed, false);

  for (const [index, proposal] of lowered.proposals.entries()) {
    assert.equal(isCreationProposal(proposal), true);
    assert.equal(isCreation(proposal), false);
    assert.equal(Object.hasOwn(proposal, 'score'), false);
    assert.ok(proposal.evidence.includes(`sga:candidate-root:${source.candidates[index].candidate_root}`));
    assert.ok(proposal.basedOn.includes(`sga:profile:${source.candidates[index].profile_id}`));
    assert.equal(JSON.parse(proposal.value).strategy, source.candidates[index].profile_id);
  }
});

test('tampered SGA candidate root fails closed before RCL proposal creation', () => {
  const source = candidateSet();
  source.candidates[0].candidate_value.strategy = 'silent-owner-replacement';
  assert.throws(
    () => lowerSgaMultiviewToCreationProposals(source),
    error => error instanceof SgaCreativeLoweringError && error.code === 'SGA_CANDIDATE_ROOT_MISMATCH',
  );
});

test('SGA candidate cannot smuggle evaluator-owned scores through the lowering', () => {
  const source = candidateSet();
  source.candidates[0].score = 0.99;
  source.candidates[0].candidate_root = canonicalSha256(
    Object.fromEntries(Object.entries(source.candidates[0]).filter(([key]) => key !== 'candidate_root')),
  );
  const core = Object.fromEntries(Object.entries(source).filter(([key]) => key !== 'set_root'));
  source.set_root = canonicalSha256(core);
  assert.throws(
    () => lowerSgaMultiviewToCreationProposals(source),
    error => error instanceof SgaCreativeLoweringError && error.code === 'SGA_EVALUATOR_JUDGMENT_LEAK',
  );
});

test('SGA candidate generator is forbidden from self-scoring its own proposal', () => {
  const proposal = lowerSgaMultiviewToCreationProposals(candidateSet()).proposals[0];
  assert.throws(
    () => scoreSgaCreationProposal(proposal, {
      organ_id: 'sga-multiview',
      evidence_root: 'a'.repeat(64),
      scores: { novelty: 0.8, utility: 0.7, feasibility: 0.9, risk: 0.1 },
    }),
    error => error instanceof SgaCreativeLoweringError && error.code === 'SGA_SELF_EVALUATION_FORBIDDEN',
  );
});

test('independent evaluator receipt explicitly scores the proposal and adds evaluator provenance', () => {
  const proposal = lowerSgaMultiviewToCreationProposals(candidateSet()).proposals[0];
  const scored = scoreSgaCreationProposal(proposal, {
    organ_id: 'integration-fixture-evaluator',
    evidence_root: 'b'.repeat(64),
    scores: { novelty: 0.8, utility: 0.9, feasibility: 0.7, risk: 0.2 },
  });

  assert.equal(isCreation(scored), true);
  assert.equal(scored.score, 0.815);
  assert.ok(scored.evidence.includes(`evaluator:integration-fixture-evaluator:${'b'.repeat(64)}`));
  assert.ok(scored.basedOn.includes('evaluator:integration-fixture-evaluator'));
  assert.ok(scored.evidence.some(item => item.startsWith('sga:candidate-root:')));
});

test('incomplete evaluator scores fail at the RCL score boundary', () => {
  const proposal = lowerSgaMultiviewToCreationProposals(candidateSet()).proposals[0];
  assert.throws(
    () => scoreSgaCreationProposal(proposal, {
      organ_id: 'integration-fixture-evaluator',
      evidence_root: 'c'.repeat(64),
      scores: { novelty: 0.8, utility: 0.9, feasibility: 0.7 },
    }),
    error => error instanceof RCLRuntimeError && error.code === 'RCL_CREATION_SCORE_REQUIRED',
  );
});
