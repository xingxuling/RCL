import {clone, rootHash, sealContent, verifyContentSeal, now, BranchError} from './canonical.mjs';
import {compileBranch, branchChain} from './branching.mjs';
import {applyOperation} from './operations.mjs';
import {verifySimulation} from './simulation.mjs';

export const PLAN_FORMAT = 'reality-branch.execution-plan.v0.2';
export const RECEIPT_FORMAT = 'reality-branch.execution-receipt.v0.2';

export function createExecutionPlan(workspace, simulation, {mode = 'sandbox', actor = 'subject:owner'} = {}) {
  if (!verifySimulation(simulation) || simulation.workspace_root !== workspace.workspace_root) throw new BranchError('RBF_SIMULATION_INVALID', simulation.branch_id);
  if (!simulation.eligible) throw new BranchError('RBF_BRANCH_INELIGIBLE', simulation.branch_id);
  const compiled = compileBranch(workspace, simulation.branch_id);
  const chain = branchChain(workspace, simulation.branch_id);
  let state = clone(workspace.base_state);
  const steps = [];
  let index = 0;
  for (const branch of chain) {
    for (const operation of branch.operations) {
      const result = applyOperation(state, operation, {capture: true});
      const step = {
        step_id: `step:${String(++index).padStart(4, '0')}`,
        branch_id: branch.branch_id,
        operation: clone(operation),
        capability_id: operation.capability_id ?? 'rbf.state.mutate',
        expected_before_state_root: result.receipt.before_state_root,
        expected_after_state_root: result.receipt.after_state_root,
        rollback_operation: result.receipt.inverse,
      };
      steps.push(step);
      state = result.state;
    }
  }
  const plan = {
    format: PLAN_FORMAT,
    version: '0.2.0-alpha.1',
    plan_id: `execution:${rootHash({workspace: workspace.workspace_root, simulation: simulation.simulation_root, mode, actor}).slice(0, 24)}`,
    workspace_root: workspace.workspace_root,
    simulation_root: simulation.simulation_root,
    branch_id: simulation.branch_id,
    actor,
    mode,
    base_generation_root: workspace.base.generation_root,
    initial_state_root: rootHash(workspace.base_state),
    expected_final_state_root: compiled.state_root,
    steps,
    created_at: now(),
    plan_root: '',
  };
  return sealContent(plan, 'plan_root', ['created_at']);
}

export function verifyExecutionPlan(plan) {
  return plan?.format === PLAN_FORMAT && verifyContentSeal(plan, 'plan_root', ['created_at']);
}

export async function executePlan(baseState, plan, {providers = {}, failAtStep = null} = {}) {
  if (!verifyExecutionPlan(plan)) throw new BranchError('RBF_EXECUTION_PLAN_INVALID');
  if (rootHash(baseState) !== plan.initial_state_root) throw new BranchError('RBF_EXECUTION_BASE_MISMATCH');
  const snapshot = clone(baseState);
  let state = clone(baseState);
  const stepReceipts = [];
  const appliedProviderSteps = [];
  const rollbackReceipts = [];
  let failure = null;

  for (const step of plan.steps) {
    try {
      if (failAtStep && step.step_id === failAtStep) throw new BranchError('RBF_EXECUTION_INJECTED_FAILURE', step.step_id);
      if (rootHash(state) !== step.expected_before_state_root) throw new BranchError('RBF_EXECUTION_STEP_BASE_MISMATCH', step.step_id);
      const providerEntry = providers[step.capability_id];
      const executeProvider = typeof providerEntry === 'function' ? providerEntry : providerEntry?.execute;
      let providerEvidence = [];
      let providerReceipt = null;
      if (executeProvider) {
        const result = await executeProvider({step: clone(step), state: clone(state), mode: plan.mode});
        if (result?.ok === false) throw new BranchError(result.code ?? 'RBF_PROVIDER_REJECTED', step.step_id, result);
        providerEvidence = clone(result?.evidence ?? []);
        providerReceipt = clone(result?.receipt ?? null);
        appliedProviderSteps.push({step: clone(step), providerEntry, providerReceipt});
      }
      const applied = applyOperation(state, step.operation, {capture: true});
      state = applied.state;
      if (rootHash(state) !== step.expected_after_state_root) throw new BranchError('RBF_EXECUTION_STEP_RESULT_MISMATCH', step.step_id);
      stepReceipts.push({step_id: step.step_id, capability_id: step.capability_id, status: 'applied', before_state_root: applied.receipt.before_state_root, after_state_root: applied.receipt.after_state_root, provider_evidence: providerEvidence, provider_receipt: providerReceipt});
    } catch (error) {
      failure = {step_id: step.step_id, code: error.code ?? 'RBF_EXECUTION_FAILED', message: error.message};
      break;
    }
  }

  const completed = !failure && rootHash(state) === plan.expected_final_state_root;
  let rollbackComplete = true;
  if (!completed) {
    for (const applied of [...appliedProviderSteps].reverse()) {
      const rollbackProvider = typeof applied.providerEntry === 'object' ? applied.providerEntry?.rollback : null;
      if (!rollbackProvider) {
        rollbackReceipts.push({step_id: applied.step.step_id, capability_id: applied.step.capability_id, status: 'not-supported'});
        rollbackComplete = false;
        continue;
      }
      try {
        const result = await rollbackProvider({step: clone(applied.step), provider_receipt: clone(applied.providerReceipt), mode: plan.mode});
        const ok = result?.ok !== false;
        rollbackReceipts.push({step_id: applied.step.step_id, capability_id: applied.step.capability_id, status: ok ? 'rolled-back' : 'failed', evidence: clone(result?.evidence ?? [])});
        if (!ok) rollbackComplete = false;
      } catch (error) {
        rollbackComplete = false;
        rollbackReceipts.push({step_id: applied.step.step_id, capability_id: applied.step.capability_id, status: 'failed', code: error.code ?? 'RBF_PROVIDER_ROLLBACK_FAILED', message: error.message});
      }
    }
    state = snapshot;
  }
  const receipt = {
    format: RECEIPT_FORMAT,
    version: '0.2.0-alpha.1',
    receipt_id: `receipt:${rootHash({plan: plan.plan_root, steps: stepReceipts, failure}).slice(0, 24)}`,
    plan_root: plan.plan_root,
    branch_id: plan.branch_id,
    status: completed ? 'completed' : rollbackComplete ? 'rolled_back' : 'rollback_incomplete',
    step_receipts: stepReceipts,
    failure,
    rollback: completed ? null : {performed: true, complete: rollbackComplete, restored_state_root: rootHash(snapshot), provider_rollbacks: rollbackReceipts},
    final_state_root: rootHash(state),
    expected_final_state_root: plan.expected_final_state_root,
    executed_at: now(),
    receipt_root: '',
  };
  return {state, receipt: sealContent(receipt, 'receipt_root', ['executed_at'])};
}

export function verifyExecutionReceipt(receipt) {
  return receipt?.format === RECEIPT_FORMAT && verifyContentSeal(receipt, 'receipt_root', ['executed_at']);
}
