import {clone, seal, rootHash, BranchError} from './canonical.mjs';
import {simulateBranch, verifySimulation} from './simulation.mjs';
import {detectBranchConflicts} from './branching.mjs';

export const COMPARISON_FORMAT = 'reality-branch.comparison.v0.2';

function score(simulation, weights) {
  const metrics = simulation.aggregate.expected;
  return Math.trunc((
    metrics.benefit * weights.benefit
    + metrics.confidence * weights.confidence
    + simulation.aggregate.resilience * weights.resilience
    - metrics.risk * weights.risk
    - metrics.cost * weights.cost
    - metrics.duration * weights.duration
  ) / 10000);
}

function dominates(a, b) {
  const am = a.aggregate.expected;
  const bm = b.aggregate.expected;
  return am.benefit >= bm.benefit
    && am.confidence >= bm.confidence
    && a.aggregate.resilience >= b.aggregate.resilience
    && am.risk <= bm.risk
    && am.cost <= bm.cost
    && am.duration <= bm.duration
    && (am.benefit > bm.benefit || am.confidence > bm.confidence || a.aggregate.resilience > b.aggregate.resilience || am.risk < bm.risk || am.cost < bm.cost || am.duration < bm.duration);
}

function normalizedProfiles(baseWeights) {
  return [
    {profile_id: 'profile:balanced', weights: baseWeights},
    {profile_id: 'profile:safety', weights: {...baseWeights, risk: baseWeights.risk + 2000, resilience: baseWeights.resilience + 1000, benefit: Math.max(0, baseWeights.benefit - 1500), duration: Math.max(0, baseWeights.duration - 500)}},
    {profile_id: 'profile:speed', weights: {...baseWeights, duration: baseWeights.duration + 2000, benefit: baseWeights.benefit + 500, risk: Math.max(0, baseWeights.risk - 1000), resilience: Math.max(0, baseWeights.resilience - 500)}},
    {profile_id: 'profile:cost', weights: {...baseWeights, cost: baseWeights.cost + 2500, benefit: Math.max(0, baseWeights.benefit - 1000), resilience: Math.max(0, baseWeights.resilience - 500)}},
  ];
}

export function compareBranches(workspace, results = null, {weightProfiles = null} = {}) {
  const simulations = results ?? workspace.branches.map(branch => simulateBranch(workspace, branch.branch_id));
  for (const simulation of simulations) {
    if (simulation.workspace_root !== workspace.workspace_root || !verifySimulation(simulation)) throw new BranchError('RBF_SIMULATION_INVALID', simulation.branch_id);
  }

  const rows = simulations.map(simulation => ({
    ...clone(simulation),
    score: simulation.eligible ? score(simulation, workspace.weights) : -999999999,
    dominated_by: [],
  }));
  for (const a of rows) for (const b of rows) if (a !== b && dominates(b, a)) a.dominated_by.push(b.branch_id);
  rows.sort((a, b) => b.score - a.score || Buffer.compare(Buffer.from(a.branch_id), Buffer.from(b.branch_id)));

  const profiles = weightProfiles ?? normalizedProfiles(workspace.weights);
  const sensitivity = profiles.map(profile => {
    const ranking = rows.map(row => ({branch_id: row.branch_id, score: row.eligible ? score(row, profile.weights) : -999999999})).sort((a, b) => b.score - a.score || a.branch_id.localeCompare(b.branch_id));
    return {profile_id: profile.profile_id, recommended_branch_id: ranking.find(item => item.score > -999999999)?.branch_id ?? null, ranking};
  });
  const recommendationCounts = Object.fromEntries(rows.map(row => [row.branch_id, sensitivity.filter(item => item.recommended_branch_id === row.branch_id).length]));
  const recommendedBranchId = rows.find(row => row.eligible)?.branch_id ?? null;
  const recommendationStabilityBps = recommendedBranchId ? Math.trunc((recommendationCounts[recommendedBranchId] ?? 0) * 10000 / sensitivity.length) : 0;

  const conflictMatrix = [];
  for (let i = 0; i < workspace.branches.length; i++) for (let j = i + 1; j < workspace.branches.length; j++) {
    conflictMatrix.push(detectBranchConflicts(workspace, workspace.branches[i].branch_id, workspace.branches[j].branch_id));
  }

  return seal({
    format: COMPARISON_FORMAT,
    version: '0.2.0-alpha.1',
    workspace_root: workspace.workspace_root,
    weights: clone(workspace.weights),
    rows,
    pareto_frontier: rows.filter(row => row.eligible && !row.dominated_by.length).map(row => row.branch_id),
    recommended_branch_id: recommendedBranchId,
    recommendation_stability_bps: recommendationStabilityBps,
    sensitivity,
    conflict_matrix: conflictMatrix,
    comparison_root: '',
  }, 'comparison_root');
}

export function explainRecommendation(comparison) {
  const selected = comparison.rows.find(row => row.branch_id === comparison.recommended_branch_id);
  if (!selected) return {recommended_branch_id: null, reasons: ['没有符合硬约束的候选分支']};
  const metrics = selected.aggregate.expected;
  return {
    recommended_branch_id: selected.branch_id,
    score: selected.score,
    stability_bps: comparison.recommendation_stability_bps,
    reasons: [
      `预期收益 ${metrics.benefit}`,
      `预期风险 ${metrics.risk}`,
      `预期成本 ${metrics.cost}`,
      `韧性 ${selected.aggregate.resilience}`,
      `位于Pareto前沿：${comparison.pareto_frontier.includes(selected.branch_id) ? '是' : '否'}`,
    ],
    explanation_root: rootHash({branch_id: selected.branch_id, score: selected.score, metrics, stability_bps: comparison.recommendation_stability_bps}),
  };
}
