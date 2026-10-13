import {clone, rootHash, sealContent, verifyContentSeal, now, BranchError} from './canonical.mjs';
import {verifySimulation} from './simulation.mjs';
import {verifyExecutionReceipt} from './execution.mjs';
import {verifySeal} from './canonical.mjs';

export const PROPOSAL_FORMAT = 'reality-branch.merge-proposal.v0.2';
export const AUTH_REQUEST_FORMAT = 'reality-branch.authority-request.v0.2';
export const AUTH_DECISION_FORMAT = 'reality-branch.authority-decision.v0.2';

export function createMergeProposal(workspace, comparison, branchId = comparison.recommended_branch_id, {
  target_generation_root = null,
  actor = 'subject:owner',
  execution_receipt = null,
  require_authority = workspace.authority_policy?.required !== false,
} = {}) {
  if (comparison.workspace_root !== workspace.workspace_root || !verifySeal(comparison, 'comparison_root')) throw new BranchError('RBF_COMPARISON_INVALID');
  const branch = workspace.branches.find(item => item.branch_id === branchId);
  const row = comparison.rows.find(item => item.branch_id === branchId);
  if (!branch || !row) throw new BranchError('RBF_BRANCH_NOT_FOUND', branchId);
  if (!row.eligible) throw new BranchError('RBF_BRANCH_INELIGIBLE', branchId);
  const simulationView = clone(row);
  delete simulationView.score;
  delete simulationView.dominated_by;
  if (!verifySimulation(simulationView)) throw new BranchError('RBF_SIMULATION_INVALID', branchId);
  if (target_generation_root && target_generation_root !== workspace.base.generation_root) throw new BranchError('RBF_STALE_BASE', target_generation_root);
  if (execution_receipt) {
    if (!verifyExecutionReceipt(execution_receipt)) throw new BranchError('RBF_EXECUTION_RECEIPT_INVALID');
    if (execution_receipt.branch_id !== branchId || execution_receipt.status !== 'completed') throw new BranchError('RBF_EXECUTION_NOT_COMPLETED', branchId);
    if (execution_receipt.expected_final_state_root !== row.candidate_state_root) throw new BranchError('RBF_EXECUTION_STATE_MISMATCH');
  }
  const proposal = {
    format: PROPOSAL_FORMAT,
    version: '0.2.0-alpha.1',
    proposal_id: `merge:${rootHash({workspace: workspace.workspace_root, branch: branchId, comparison: comparison.comparison_root, execution: execution_receipt?.receipt_root ?? null}).slice(0, 24)}`,
    workspace_root: workspace.workspace_root,
    comparison_root: comparison.comparison_root,
    selected_branch_id: branchId,
    candidate_root: branch.candidate_root,
    simulation_root: row.simulation_root,
    execution_receipt_root: execution_receipt?.receipt_root ?? null,
    base: clone(workspace.base),
    actor,
    operations: clone(row.branch_chain.flatMap(id => workspace.branches.find(item => item.branch_id === id)?.operations ?? [])),
    expected_candidate_state_root: row.candidate_state_root,
    require_authority,
    status: 'proposed',
    created_at: now(),
    proposal_root: '',
  };
  return sealContent(proposal, 'proposal_root', ['created_at']);
}

export function verifyMergeProposal(proposal) {
  return proposal?.format === PROPOSAL_FORMAT && verifyContentSeal(proposal, 'proposal_root', ['created_at']);
}

export function createAuthorityRequest(proposal, {resolver = 'aaf:default', risk_class = 'medium', requested_scope = 'merge-selected-branch'} = {}) {
  if (!verifyMergeProposal(proposal)) throw new BranchError('RBF_PROPOSAL_TAMPERED');
  return sealContent({
    format: AUTH_REQUEST_FORMAT,
    version: '0.2.0-alpha.1',
    request_id: `authority-request:${rootHash({proposal: proposal.proposal_root, resolver, risk_class, requested_scope}).slice(0, 24)}`,
    proposal_root: proposal.proposal_root,
    actor: proposal.actor,
    resolver,
    risk_class,
    requested_scope,
    status: 'pending',
    requested_at: now(),
    request_root: '',
  }, 'request_root', ['requested_at']);
}

export function issueAuthorityDecision(request, {decision, authority_actor = 'authority:owner', reason = '', expires_at = null, conditions = []} = {}) {
  if (request?.format !== AUTH_REQUEST_FORMAT || !verifyContentSeal(request, 'request_root', ['requested_at'])) throw new BranchError('RBF_AUTHORITY_REQUEST_INVALID');
  if (!['approved', 'denied'].includes(decision)) throw new BranchError('RBF_AUTHORITY_DECISION_INVALID', String(decision));
  return sealContent({
    format: AUTH_DECISION_FORMAT,
    version: '0.2.0-alpha.1',
    decision_id: `authority-decision:${rootHash({request: request.request_root, decision, authority_actor, conditions}).slice(0, 24)}`,
    request_root: request.request_root,
    proposal_root: request.proposal_root,
    decision,
    authority_actor,
    reason,
    conditions: clone(conditions),
    expires_at,
    decided_at: now(),
    decision_root: '',
  }, 'decision_root', ['decided_at']);
}

export function verifyAuthorityDecision(decision, proposal, {at = new Date()} = {}) {
  if (!decision || decision.format !== AUTH_DECISION_FORMAT || !verifyContentSeal(decision, 'decision_root', ['decided_at'])) return false;
  if (!verifyMergeProposal(proposal)) return false;
  if (decision.proposal_root !== proposal.proposal_root || decision.decision !== 'approved') return false;
  if (decision.expires_at && new Date(decision.expires_at).getTime() < at.getTime()) return false;
  return true;
}
