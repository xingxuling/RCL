import test from 'node:test';
import assert from 'node:assert/strict';
import { ProviderRuntimeV2Error } from '../src/provider-runtime-v2.mjs';
import {
  canonicalSha256,
} from '../adapters/sga-multiview-creative-lowering.mjs';
import {
  RCL_CREATIVE_PROVIDER_ACTOR,
  SGA_MULTIVIEW_PROVIDER_CAPABILITY,
  SGA_MULTIVIEW_PROVIDER_ID,
  SGA_MULTIVIEW_PROVIDER_TARGET,
  createSgaCreativeProviderRuntime,
  invokeSgaThroughRclCreativeProvider,
} from '../adapters/sga-multiview-provider-v2.mjs';

function candidate(profileId, index) {
  const core = {
    format: 'sga.multiview-candidate.v0.1',
    candidate_id: `candidate:${String(index).padStart(2, '0')}:${profileId}`,
    profile_id: profileId,
    goal: 'Generate bounded alternatives.',
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
    evaluation_questions: ['Is the boundary preserved?'],
    candidate_value: { strategy: profileId, operations: [`apply ${profileId}`] },
    evaluation_status: 'UNEVALUATED',
    authority: { candidate_only: true, may_execute: false, may_commit: false, may_promote: false },
  };
  return { ...core, candidate_root: canonicalSha256(core) };
}

function candidateSet() {
  const candidates = [candidate('specialization-preserving', 1), candidate('productive-synthesis', 2)];
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

test('RCL ProviderRuntime v2 invokes SGA candidate provider then lowers output into CreationProposal values', async () => {
  const expected = candidateSet();
  const runtime = createSgaCreativeProviderRuntime({ invokeGenerator: async request => {
    assert.equal(request.goal, 'Generate bounded alternatives.');
    return expected;
  }});
  const result = await invokeSgaThroughRclCreativeProvider(runtime, {
    goal: 'Generate bounded alternatives.',
    base_structure: { owner: 'specialist-a' },
  });

  assert.equal(result.providerReceipt.status, 'succeeded');
  assert.equal(result.providerReceipt.providerId, SGA_MULTIVIEW_PROVIDER_ID);
  assert.equal(result.providerReceipt.capability, SGA_MULTIVIEW_PROVIDER_CAPABILITY);
  assert.equal(result.providerReceipt.target, SGA_MULTIVIEW_PROVIDER_TARGET);
  assert.equal(result.providerReceipt.actor, RCL_CREATIVE_PROVIDER_ACTOR);
  assert.equal(result.lowering.proposalCount, 2);
  assert.deepEqual(result.lowering.candidateRoots, expected.candidates.map(item => item.candidate_root));
  assert.equal(result.lowering.proposals.every(item => item.kind === 'CreationProposal' && !Object.hasOwn(item, 'score')), true);
  assert.equal(result.authority.providerOwnsCreativeSemantics, false);
  assert.equal(result.authority.rclOwnsCreativeSemantics, true);
});

test('RCL ProviderRuntime policy denies direct SGA use by an unapproved actor', async () => {
  const runtime = createSgaCreativeProviderRuntime({ invokeGenerator: async () => candidateSet() });
  const receipt = await runtime.safeInvoke({
    providerId: SGA_MULTIVIEW_PROVIDER_ID,
    capability: SGA_MULTIVIEW_PROVIDER_CAPABILITY,
    target: SGA_MULTIVIEW_PROVIDER_TARGET,
    actor: 'intruder',
    mode: 'realize',
    input: { goal: 'x', base_structure: {} },
  });
  assert.equal(receipt.status, 'rejected');
  assert.equal(receipt.code, 'RCL_PROVIDER_V2_AUTHORITY_DENIED');
});

test('invalid SGA Provider output fails closed inside RCL ProviderRuntime', async () => {
  const runtime = createSgaCreativeProviderRuntime({ invokeGenerator: async () => ({ format: 'forged' }) });
  await assert.rejects(
    () => invokeSgaThroughRclCreativeProvider(runtime, { goal: 'x', base_structure: {} }),
    error => error instanceof ProviderRuntimeV2Error && error.code === 'RCL_PROVIDER_V2_HANDLER_FAILED',
  );
});

test('provider listing keeps SGA as provider implementation, not Creative Reality owner', () => {
  const runtime = createSgaCreativeProviderRuntime({ invokeGenerator: async () => candidateSet() });
  const listing = runtime.listProviders();
  assert.equal(listing.providerCount, 1);
  assert.equal(listing.providers[0].id, SGA_MULTIVIEW_PROVIDER_ID);
  assert.deepEqual(listing.providers[0].capabilities[0].effects, ['CandidateOnly']);
});
