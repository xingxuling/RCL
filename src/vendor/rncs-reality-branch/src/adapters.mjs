import {clone, rootHash, sealContent, now, BranchError} from './canonical.mjs';
import {verifyMergeProposal, verifyAuthorityDecision} from './authority.mjs';
import {applyOperations} from './operations.mjs';

export function applyMergeProposal(baseState, proposal, {
  current_generation_root = null,
  authority_decision = null,
} = {}) {
  if (!verifyMergeProposal(proposal)) throw new BranchError('RBF_PROPOSAL_TAMPERED');
  if (current_generation_root && current_generation_root !== proposal.base.generation_root) throw new BranchError('RBF_STALE_BASE', current_generation_root);
  if (proposal.require_authority && !verifyAuthorityDecision(authority_decision, proposal)) throw new BranchError('RBF_AUTHORITY_REQUIRED');
  const state = applyOperations(baseState, proposal.operations);
  const stateRoot = rootHash(state);
  if (stateRoot !== proposal.expected_candidate_state_root) throw new BranchError('RBF_CANDIDATE_STATE_MISMATCH', stateRoot);
  return {
    state,
    state_root: stateRoot,
    merge_evidence: {
      proposal_root: proposal.proposal_root,
      comparison_root: proposal.comparison_root,
      simulation_root: proposal.simulation_root,
      execution_receipt_root: proposal.execution_receipt_root,
      candidate_root: proposal.candidate_root,
      authority_decision_root: authority_decision?.decision_root ?? null,
    },
  };
}

export function createTransitionDraft(workspace, proposal, {authority_decision = null} = {}) {
  if (!verifyMergeProposal(proposal)) throw new BranchError('RBF_PROPOSAL_TAMPERED');
  if (proposal.require_authority && !verifyAuthorityDecision(authority_decision, proposal)) throw new BranchError('RBF_AUTHORITY_REQUIRED');
  const evidenceItems = [
    {kind: 'branch-workspace', root: workspace.workspace_root},
    {kind: 'simulation', root: proposal.simulation_root},
    {kind: 'merge-proposal', root: proposal.proposal_root},
  ];
  if (proposal.execution_receipt_root) evidenceItems.push({kind: 'execution-receipt', root: proposal.execution_receipt_root});
  if (authority_decision?.decision_root) evidenceItems.push({kind: 'authority-decision', root: authority_decision.decision_root});
  return sealContent({
    format: 'rncs.reality-transition-envelope.v0.2',
    version: '0.2.0-alpha.1',
    transition_id: `transition:${proposal.proposal_id}`,
    phase: 'authorized',
    subject: {subject_id: proposal.actor},
    intent: {intent_id: `intent:adopt:${proposal.selected_branch_id}`, goal: `采纳候选现实分支 ${proposal.selected_branch_id}`},
    capability_plan: {plan_id: `plan:${proposal.proposal_id}`, steps: [{capability_id: 'rbf.branch.merge', phase: 'transaction'}]},
    authority: {status: proposal.require_authority ? 'approved' : 'not-required', resolver: workspace.authority_policy?.resolver ?? 'aaf:default', decision_root: authority_decision?.decision_root ?? null},
    candidate_change: {base_generation: workspace.base.generation, base_generation_root: workspace.base.generation_root, branch_id: workspace.base.branch_id, operations: clone(proposal.operations), expected_state_root: proposal.expected_candidate_state_root},
    causality: {reasons: [{kind: 'branch-comparison', root: proposal.comparison_root}]},
    continuity: {reality_id: workspace.base.reality_id},
    evidence: {items: evidenceItems},
    projections: [],
    extensions: {rbf: {selected_branch_id: proposal.selected_branch_id, workspace_root: workspace.workspace_root}},
    created_at: now(),
    envelope_root: '',
  }, 'envelope_root', ['created_at']);
}

export function createRfeCommitReceipt(transitionDraft, {
  new_generation,
  new_generation_root,
  committed_by = 'rfe:default',
  storage_receipt_root = null,
} = {}) {
  if (!transitionDraft?.envelope_root) throw new BranchError('RBF_TRANSITION_INVALID');
  if (!Number.isSafeInteger(new_generation) || new_generation < 0) throw new BranchError('RBF_GENERATION_INVALID');
  if (typeof new_generation_root !== 'string' || !/^[0-9a-f]{64}$/.test(new_generation_root)) throw new BranchError('RBF_GENERATION_ROOT_INVALID');
  return sealContent({
    format: 'reality-branch.rfe-commit-receipt.v0.2',
    version: '0.2.0-alpha.1',
    receipt_id: `rfe-commit:${rootHash({transition: transitionDraft.envelope_root, new_generation, new_generation_root}).slice(0, 24)}`,
    transition_root: transitionDraft.envelope_root,
    previous_generation_root: transitionDraft.candidate_change.base_generation_root,
    new_generation,
    new_generation_root,
    committed_by,
    storage_receipt_root,
    committed_at: now(),
    commit_receipt_root: '',
  }, 'commit_receipt_root', ['committed_at']);
}

export function createStudioProjection(workspace, comparison = null) {
  const rows = comparison?.rows ?? [];
  return {
    format: 'reality-studio.branch-panel.v0.2',
    workspace_id: workspace.workspace_id,
    workspace_root: workspace.workspace_root,
    base: clone(workspace.base),
    branches: workspace.branches.map(branch => {
      const row = rows.find(item => item.branch_id === branch.branch_id);
      return {
        branch_id: branch.branch_id,
        parent_branch_id: branch.parent_branch_id,
        label: branch.label,
        hypothesis: branch.hypothesis,
        candidate_root: branch.candidate_root,
        eligible: row?.eligible ?? null,
        score: row?.score ?? null,
        expected_metrics: row?.aggregate?.expected ?? null,
        resilience: row?.aggregate?.resilience ?? null,
      };
    }),
    recommended_branch_id: comparison?.recommended_branch_id ?? null,
    recommendation_stability_bps: comparison?.recommendation_stability_bps ?? null,
  };
}
