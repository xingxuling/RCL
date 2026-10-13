import {clone, rootHash, sealContent, verifyContentSeal, now, BranchError, assertHexRoot} from './canonical.mjs';
import {applyOperations, diffStates, getPath, hasPath, pathsOverlap} from './operations.mjs';

export const WORKSPACE_FORMAT = 'reality-branch.workspace.v0.2';
export const BRANCH_FORMAT = 'reality-branch.candidate.v0.2';

export function branchPayload(branch) {
  const payload = clone(branch);
  delete payload.candidate_root;
  delete payload.last_simulation_root;
  return payload;
}

export function sealBranch(branch) {
  const out = {
    format: BRANCH_FORMAT,
    version: '0.2.0-alpha.1',
    label: branch.label ?? branch.branch_id,
    hypothesis: branch.hypothesis ?? '',
    assumptions: [],
    operations: [],
    constraints: {},
    invariants: [],
    tags: [],
    ...clone(branch),
  };
  out.candidate_root = rootHash(branchPayload(out));
  return out;
}

export function createBranch({branch_id, parent_branch_id = 'branch:main', label = '', hypothesis = '', assumptions = [], operations = [], constraints = {}, invariants = [], tags = [], predicted_metrics = {}} = {}) {
  if (!branch_id) throw new BranchError('RBF_BRANCH_ID_REQUIRED');
  return sealBranch({branch_id, parent_branch_id, label: label || branch_id, hypothesis, assumptions, operations, constraints, invariants, tags, predicted_metrics});
}

const DEFAULT_WEIGHTS = {benefit: 3500, confidence: 1500, resilience: 1500, risk: 2000, cost: 1000, duration: 500};
const DEFAULT_SCENARIOS = [
  {scenario_id: 'scenario:baseline', label: '基准情景', probability_bps: 6000, metric_adjustments: {}},
  {scenario_id: 'scenario:adverse', label: '不利情景', probability_bps: 2500, metric_adjustments: {benefit: -1200, confidence: -1500, risk: 1800, cost: 900, duration: 1000}},
  {scenario_id: 'scenario:upside', label: '有利情景', probability_bps: 1500, metric_adjustments: {benefit: 1200, confidence: 600, risk: -500, cost: -300, duration: -400}},
];

export function createWorkspace({
  reality_id = 'reality:default',
  base_generation = 0,
  base_generation_root = '0'.repeat(64),
  base_branch_id = 'branch:main',
  project_root = '0'.repeat(64),
  base_state = {},
  branches = [],
  weights = DEFAULT_WEIGHTS,
  scenarios = DEFAULT_SCENARIOS,
  authority_policy = {required: true, resolver: 'aaf:default'},
  metadata = {},
} = {}) {
  assertHexRoot(base_generation_root, 'RBF_BASE_GENERATION_ROOT_INVALID');
  assertHexRoot(project_root, 'RBF_PROJECT_ROOT_INVALID');
  const normalizedBranches = branches.map(branch => sealBranch(branch));
  const workspace = {
    format: WORKSPACE_FORMAT,
    version: '0.2.0-alpha.1',
    workspace_id: `workspace:${rootHash({reality_id, base_generation_root, project_root}).slice(0, 24)}`,
    base: {reality_id, generation: base_generation, generation_root: base_generation_root, branch_id: base_branch_id, project_root},
    base_state: clone(base_state),
    branches: normalizedBranches,
    weights: clone(weights),
    scenarios: clone(scenarios),
    authority_policy: clone(authority_policy),
    metadata: clone(metadata),
    created_at: now(),
    workspace_root: '',
  };
  return sealContent(workspace, 'workspace_root', ['created_at']);
}

function detectCycles(workspace) {
  const map = new Map(workspace.branches.map(branch => [branch.branch_id, branch]));
  const errors = [];
  for (const branch of workspace.branches) {
    const seen = new Set([branch.branch_id]);
    let parent = branch.parent_branch_id;
    while (parent !== workspace.base.branch_id) {
      if (seen.has(parent)) { errors.push(`BRANCH_CYCLE:${branch.branch_id}`); break; }
      seen.add(parent);
      const next = map.get(parent);
      if (!next) break;
      parent = next.parent_branch_id;
    }
  }
  return errors;
}

export function validateWorkspace(workspace) {
  const errors = [];
  if (workspace?.format !== WORKSPACE_FORMAT) errors.push('FORMAT_INVALID');
  if (!verifyContentSeal(workspace, 'workspace_root', ['created_at'])) errors.push('WORKSPACE_ROOT_MISMATCH');
  const ids = new Set();
  const availableParents = new Set([workspace?.base?.branch_id, ...(workspace?.branches ?? []).map(branch => branch.branch_id)]);
  for (const branch of workspace?.branches ?? []) {
    if (ids.has(branch.branch_id)) errors.push(`DUPLICATE_BRANCH:${branch.branch_id}`);
    ids.add(branch.branch_id);
    if (branch.format !== BRANCH_FORMAT) errors.push(`BRANCH_FORMAT_INVALID:${branch.branch_id}`);
    if (rootHash(branchPayload(branch)) !== branch.candidate_root) errors.push(`CANDIDATE_ROOT_MISMATCH:${branch.branch_id}`);
    if (!availableParents.has(branch.parent_branch_id)) errors.push(`PARENT_BRANCH_NOT_FOUND:${branch.branch_id}`);
    if (branch.parent_branch_id === branch.branch_id) errors.push(`BRANCH_SELF_PARENT:${branch.branch_id}`);
  }
  errors.push(...detectCycles(workspace));
  const probability = (workspace?.scenarios ?? []).reduce((sum, scenario) => sum + Number(scenario.probability_bps ?? 0), 0);
  if (probability !== 10000) errors.push(`SCENARIO_PROBABILITY_INVALID:${probability}`);
  return {valid: errors.length === 0, errors, workspace_root: workspace?.workspace_root, branch_count: workspace?.branches?.length ?? 0};
}

export function getBranch(workspace, branchId) {
  const branch = workspace.branches.find(item => item.branch_id === branchId);
  if (!branch) throw new BranchError('RBF_BRANCH_NOT_FOUND', branchId);
  return branch;
}

export function branchChain(workspace, branchId) {
  const chain = [];
  let current = getBranch(workspace, branchId);
  const seen = new Set();
  while (current) {
    if (seen.has(current.branch_id)) throw new BranchError('RBF_BRANCH_CYCLE', current.branch_id);
    seen.add(current.branch_id);
    chain.unshift(current);
    if (current.parent_branch_id === workspace.base.branch_id) break;
    current = getBranch(workspace, current.parent_branch_id);
  }
  return chain;
}

export function compileBranch(workspace, branchId) {
  const validation = validateWorkspace(workspace);
  if (!validation.valid) throw new BranchError('RBF_WORKSPACE_INVALID', validation.errors.join(','), validation);
  const chain = branchChain(workspace, branchId);
  let state = clone(workspace.base_state);
  const operationReceipts = [];
  for (const branch of chain) {
    const result = applyOperations(state, branch.operations, {capture: true});
    state = result.state;
    operationReceipts.push(...result.receipts.map(receipt => ({...receipt, branch_id: branch.branch_id})));
  }
  return {
    branch_id: branchId,
    branch_chain: chain.map(branch => branch.branch_id),
    branch_roots: chain.map(branch => branch.candidate_root),
    state,
    state_root: rootHash(state),
    diff: diffStates(workspace.base_state, state),
    operation_receipts: operationReceipts,
  };
}

export function detectBranchConflicts(workspace, branchAId, branchBId) {
  const a = branchChain(workspace, branchAId).flatMap(branch => branch.operations.map(operation => ({...operation, source_branch_id: branch.branch_id})));
  const b = branchChain(workspace, branchBId).flatMap(branch => branch.operations.map(operation => ({...operation, source_branch_id: branch.branch_id})));
  const conflicts = [];
  for (const left of a) for (const right of b) {
    if (!pathsOverlap(left.path, right.path)) continue;
    const sameOperation = rootHash({op: left.op, path: left.path, value: left.value}) === rootHash({op: right.op, path: right.path, value: right.value});
    if (!sameOperation) conflicts.push({code: 'OVERLAPPING_WRITE', path_a: left.path, path_b: right.path, branch_a: left.source_branch_id, branch_b: right.source_branch_id});
  }
  return {branch_a: branchAId, branch_b: branchBId, conflict_count: conflicts.length, conflicts, compatible: conflicts.length === 0};
}

export function rebaseWorkspace(workspace, {new_base_state, new_generation, new_generation_root, strategy = 'detect'} = {}) {
  assertHexRoot(new_generation_root, 'RBF_BASE_GENERATION_ROOT_INVALID');
  const changed = diffStates(workspace.base_state, new_base_state);
  const conflicts = [];
  for (const branch of workspace.branches) {
    for (const operation of branch.operations) {
      for (const change of changed) {
        if (!pathsOverlap(operation.path, change.path)) continue;
        conflicts.push({branch_id: branch.branch_id, operation_id: operation.operation_id ?? null, operation_path: operation.path, base_change_path: change.path, old_value: clone(change.before), new_value: clone(change.after), code: 'BASE_DRIFT_OVERLAP'});
      }
    }
  }
  if (strategy === 'reject' && conflicts.length) throw new BranchError('RBF_REBASE_CONFLICT', String(conflicts.length), {conflicts});
  const rebased = createWorkspace({
    reality_id: workspace.base.reality_id,
    base_generation: new_generation,
    base_generation_root: new_generation_root,
    base_branch_id: workspace.base.branch_id,
    project_root: workspace.base.project_root,
    base_state: new_base_state,
    branches: workspace.branches,
    weights: workspace.weights,
    scenarios: workspace.scenarios,
    authority_policy: workspace.authority_policy,
    metadata: {...workspace.metadata, rebased_from_workspace_root: workspace.workspace_root, rebase_conflict_count: conflicts.length},
  });
  return {workspace: rebased, clean: conflicts.length === 0, conflicts, changed_base_paths: changed.map(change => change.path)};
}

export function inspectPathDrift(workspace, branchId, path) {
  const compiled = compileBranch(workspace, branchId);
  return {path, base_exists: hasPath(workspace.base_state, path), base_value: clone(getPath(workspace.base_state, path)), candidate_exists: hasPath(compiled.state, path), candidate_value: clone(getPath(compiled.state, path))};
}
