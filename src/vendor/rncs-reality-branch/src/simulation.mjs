import {clone, rootHash, sealContent, verifyContentSeal, now, BranchError} from './canonical.mjs';
import {compileBranch, getBranch} from './branching.mjs';
import {evaluatePredicate} from './operations.mjs';

export const SIM_FORMAT = 'reality-branch.simulation.v0.2';
const clamp = value => Math.max(0, Math.min(10000, Math.trunc(Number(value) || 0)));

function addMetrics(target, source = {}) {
  for (const key of ['benefit', 'cost', 'risk', 'confidence', 'duration']) target[key] = Number(target[key] ?? 0) + Number(source[key] ?? 0);
  return target;
}

function deriveBaseMetrics(branchChain) {
  const metrics = {benefit: 0, cost: 0, risk: 0, confidence: 6500, duration: 0};
  for (const branch of branchChain) {
    addMetrics(metrics, branch.predicted_metrics ?? {});
    for (const operation of branch.operations ?? []) {
      const impact = operation.impact ?? {};
      metrics.benefit += Number(impact.benefit ?? 500);
      metrics.cost += Number(impact.cost ?? 250);
      metrics.risk += Number(impact.risk ?? (operation.reversible === false ? 1200 : 250));
      metrics.confidence += Number(impact.confidence_delta ?? 0);
      metrics.duration += Number(impact.duration ?? 200);
    }
    for (const assumption of branch.assumptions ?? []) metrics.confidence -= Number(assumption.uncertainty ?? 200);
  }
  return metrics;
}

function constraintsForChain(chain) {
  return chain.flatMap(branch => Object.entries(branch.constraints ?? {}).map(([key, value]) => ({branch_id: branch.branch_id, key, value})));
}

function invariantsForChain(chain) {
  return chain.flatMap(branch => (branch.invariants ?? []).map(invariant => ({severity: 'hard', ...clone(invariant), branch_id: branch.branch_id})));
}

function evaluateMetricConstraints(metrics, constraints) {
  const violations = [];
  for (const constraint of constraints) {
    const {key, value, branch_id} = constraint;
    if (key === 'max_risk' && metrics.risk > value) violations.push({code: 'MAX_RISK_EXCEEDED', branch_id, actual: metrics.risk, limit: value, severity: 'hard'});
    else if (key === 'max_cost' && metrics.cost > value) violations.push({code: 'MAX_COST_EXCEEDED', branch_id, actual: metrics.cost, limit: value, severity: 'hard'});
    else if (key === 'max_duration' && metrics.duration > value) violations.push({code: 'MAX_DURATION_EXCEEDED', branch_id, actual: metrics.duration, limit: value, severity: 'hard'});
    else if (key === 'min_confidence' && metrics.confidence < value) violations.push({code: 'MIN_CONFIDENCE_NOT_MET', branch_id, actual: metrics.confidence, limit: value, severity: 'hard'});
    else if (key === 'min_benefit' && metrics.benefit < value) violations.push({code: 'MIN_BENEFIT_NOT_MET', branch_id, actual: metrics.benefit, limit: value, severity: 'hard'});
  }
  return violations;
}

function evaluateInvariants(state, invariants) {
  return invariants.map(invariant => ({...evaluatePredicate(state, invariant), code: invariant.code ?? 'INVARIANT_FAILED', severity: invariant.severity ?? 'hard', branch_id: invariant.branch_id})).filter(result => !result.passed);
}

function aggregateScenarioMetrics(scenarios) {
  const expected = {benefit: 0, cost: 0, risk: 0, confidence: 0, duration: 0};
  for (const scenario of scenarios) {
    for (const key of Object.keys(expected)) expected[key] += Math.trunc(scenario.metrics[key] * scenario.probability_bps / 10000);
  }
  const worst = {
    benefit: Math.min(...scenarios.map(item => item.metrics.benefit)),
    cost: Math.max(...scenarios.map(item => item.metrics.cost)),
    risk: Math.max(...scenarios.map(item => item.metrics.risk)),
    confidence: Math.min(...scenarios.map(item => item.metrics.confidence)),
    duration: Math.max(...scenarios.map(item => item.metrics.duration)),
  };
  const resilience = clamp(10000 - Math.trunc((worst.risk + worst.cost + worst.duration + (10000 - worst.confidence)) / 4));
  return {expected, worst, resilience};
}

export function simulateBranch(workspace, branchId, {adapter = null, scenarioAdapters = {}} = {}) {
  const compiled = compileBranch(workspace, branchId);
  const chain = compiled.branch_chain.map(id => getBranch(workspace, id));
  const baseMetrics = deriveBaseMetrics(chain);
  const constraints = constraintsForChain(chain);
  const invariants = invariantsForChain(chain);
  const scenarios = [];

  for (const scenario of workspace.scenarios) {
    const scenarioAdapter = scenarioAdapters[scenario.scenario_id] ?? adapter;
    const rawMetrics = scenarioAdapter
      ? scenarioAdapter({workspace: clone(workspace), branch_chain: clone(chain), candidate: clone(compiled.state), scenario: clone(scenario), base_metrics: clone(baseMetrics)})
      : addMetrics(clone(baseMetrics), scenario.metric_adjustments ?? {});
    const metrics = Object.fromEntries(Object.entries(rawMetrics).map(([key, value]) => [key, clamp(value)]));
    const violations = [...evaluateMetricConstraints(metrics, constraints), ...evaluateInvariants(compiled.state, invariants)];
    const scenarioResult = {
      scenario_id: scenario.scenario_id,
      label: scenario.label ?? scenario.scenario_id,
      probability_bps: scenario.probability_bps,
      metrics,
      eligible: !violations.some(item => item.severity === 'hard'),
      violations,
      model: scenarioAdapter ? 'external-adapter' : 'deterministic-scenario-v2',
      scenario_root: '',
    };
    scenarios.push(sealContent(scenarioResult, 'scenario_root'));
  }

  const aggregate = aggregateScenarioMetrics(scenarios);
  const result = {
    format: SIM_FORMAT,
    version: '0.2.0-alpha.1',
    simulation_id: `simulation:${rootHash({workspace: workspace.workspace_root, branch: getBranch(workspace, branchId).candidate_root, scenarios: workspace.scenarios}).slice(0, 24)}`,
    workspace_root: workspace.workspace_root,
    branch_id: branchId,
    branch_chain: compiled.branch_chain,
    branch_roots: compiled.branch_roots,
    base_generation_root: workspace.base.generation_root,
    candidate_state_root: compiled.state_root,
    candidate_diff: compiled.diff,
    scenarios,
    aggregate,
    eligible: scenarios.every(item => item.eligible),
    violations: scenarios.flatMap(item => item.violations.map(violation => ({scenario_id: item.scenario_id, ...violation}))),
    evidence: [
      {kind: 'candidate-state-root', root: compiled.state_root},
      ...compiled.branch_roots.map(root => ({kind: 'branch-root', root})),
      ...scenarios.map(item => ({kind: 'scenario-root', root: item.scenario_root})),
    ],
    simulated_at: now(),
    simulation_root: '',
  };
  return sealContent(result, 'simulation_root', ['simulated_at']);
}

export function verifySimulation(simulation) {
  return simulation?.format === SIM_FORMAT && verifyContentSeal(simulation, 'simulation_root', ['simulated_at']) && simulation.scenarios.every(item => verifyContentSeal(item, 'scenario_root'));
}

export function replaySimulation(workspace, simulation, options = {}) {
  if (simulation.workspace_root !== workspace.workspace_root) throw new BranchError('RBF_SIMULATION_WORKSPACE_MISMATCH');
  const replay = simulateBranch(workspace, simulation.branch_id, options);
  return {replay, deterministic: replay.simulation_root === simulation.simulation_root, candidate_state_match: replay.candidate_state_root === simulation.candidate_state_root};
}
