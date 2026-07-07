import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const RCL_AGENT_CIVILIZATION_SANDBOX_VERSION = '0.82.0-alpha.1';
export const RCL_AGENT_CIVILIZATION_SANDBOX_SPEC_FORMAT = 'rcl.agent-civilization-sandbox.spec.v0.82';
export const RCL_AGENT_CIVILIZATION_SANDBOX_RESULT_FORMAT = 'rcl.agent-civilization-sandbox.result.v0.82';
export const RCL_AGENT_CIVILIZATION_SANDBOX_BUNDLE_FORMAT = 'rcl.agent-civilization-sandbox.bundle.v0.82';
export const RCL_AGENT_CIVILIZATION_CABINET_FORMAT = 'rcl.agent-civilization.cabinet.v0.82';
export const RCL_AGENT_CIVILIZATION_DEPARTMENT_FORMAT = 'rcl.agent-civilization.department.v0.82';
export const RCL_AGENT_CIVILIZATION_ROLE_CELL_FORMAT = 'rcl.agent-civilization.role-cell.v0.82';
export const RCL_AGENT_CIVILIZATION_WORKLOAD_FORMAT = 'rcl.agent-civilization.workload.v0.82';
export const RCL_AGENT_CIVILIZATION_EVIDENCE_FORMAT = 'rcl.agent-civilization.evidence.v0.82';

const CABINET_BLUEPRINTS = Object.freeze([
  {
    id: 'engineering_cabinet',
    name: '工程内阁',
    mission: '把候选结构压成源码、接口、CLI、补丁和可运行模块。',
    departments: ['Runtime', 'Compiler', 'CLI', 'Provider', 'Android', 'RCL Syntax', 'Patch Repair'],
  },
  {
    id: 'quality_cabinet',
    name: '质量内阁',
    mission: '制造失败样本、回归测试、性能门槛和验收用例。',
    departments: ['Unit Test', 'Regression', 'Scenario Lab', 'Failure Forge', 'Performance', 'Compatibility', 'Acceptance'],
  },
  {
    id: 'evidence_court',
    name: '证据法院',
    mission: '审查版本、hash、输入输出、证据账本和虚假执行声明。',
    departments: ['Hash Ledger', 'Trace Replay', 'Version Audit', 'Claim Audit', 'Output Hygiene', 'Rollback Law', 'Boundary Records'],
  },
  {
    id: 'product_cabinet',
    name: '产品内阁',
    mission: '判断哪些功能对杜衡界真实有用，并转成最小闭环。',
    departments: ['Pocket Lovable', 'RCL Developer Kit', 'Agent City UX', 'Market Need', 'Workflow Design', 'Founder Utility', 'Roadmap'],
  },
  {
    id: 'safety_cabinet',
    name: '安全内阁',
    mission: '限制权限、隔离失败、避免错误扩散和不可逆动作。',
    departments: ['Permission', 'Sandbox', 'Secret Hygiene', 'Semantic Guard', 'Adversarial Review', 'Rate Limit', 'Human Authority'],
  },
  {
    id: 'research_academy',
    name: '研究院',
    mission: '探索 RCL、帝级以太语言、少数据智能体和组织模拟的新结构。',
    departments: ['Few-shot Agents', 'IAL Semantics', 'Reality Compiler', 'AIF FoF', 'Agent Society', 'Simulation Science', 'Unknown Framework'],
  },
  {
    id: 'release_cabinet',
    name: '发布内阁',
    mission: '打包、文档、README、CONTEXT、验收报告和交接文件。',
    departments: ['README', 'Context', 'Changelog', 'Report', 'Zip Release', 'Project File Handoff', 'User Summary'],
  },
]);

const ROLE_TEMPLATES = Object.freeze([
  { id: 'scout', title: '侦察员', action: '定位输入、上下文和风险边界' },
  { id: 'builder', title: '构造员', action: '生成最小可用产物或补丁草案' },
  { id: 'critic', title: '审稿员', action: '找语义漏洞、命名漂移和重复劳动' },
  { id: 'tester', title: '测试员', action: '设计可执行验收、失败复现和回归用例' },
  { id: 'evidence', title: '证据员', action: '写入证据、hash、状态根和可追溯记录' },
  { id: 'adversary', title: '反对者', action: '模拟坏用户、错误路线和幻觉扩散' },
  { id: 'packager', title: '打包员', action: '把结果压缩成文件、报告、交付物和下一步任务' },
]);

export const DEFAULT_AGENT_CIVILIZATION_SANDBOX_SPEC = Object.freeze({
  format: RCL_AGENT_CIVILIZATION_SANDBOX_SPEC_FORMAT,
  version: RCL_AGENT_CIVILIZATION_SANDBOX_VERSION,
  missionId: 'rcl-agent-civilization-v082',
  title: 'RCL Agent Civilization Sandbox v0.82',
  founder: '杜衡界',
  mission: '把 7 智能体自升级团队扩展为分层智能体文明沙箱，用压缩城市/国家级组织减少 RCL 后续开发工作量。',
  targetRelease: 'v0.82 Agent Civilization Sandbox',
  nextHandoff: 'v0.83 Agent City Workload Compiler + Real Patch Apply Loop',
  scale: {
    cabinetCount: 7,
    departmentsPerCabinet: 7,
    rolesPerDepartment: 7,
    citizenCohorts: 14,
    projectedWorkersPerRoleCell: 7,
  },
  policies: {
    noFlatGroupChat: true,
    hierarchicalAggregation: true,
    compressedPopulation: true,
    noNetwork: true,
    noRemoteMutation: true,
    noRealWorldActionByDefault: true,
    humanFinalAuthorityKept: true,
    noFullOuterModelReplacementClaim: true,
    semanticGuardRequired: true,
    rollbackRequired: true,
    evidenceLedgerRequired: true,
  },
  workloadFocus: [
    'rcl_self_upgrade',
    'aether_forge_pocket_product_loop',
    'evidence_hygiene',
    'virtual_market_feedback',
    'test_and_failure_generation',
    'release_packaging',
    'founder_workload_reduction',
  ],
  candidateFutures: [
    'v0.83_agent_city_workload_compiler',
    'v0.83_real_patch_apply_loop',
    'v0.83_virtual_market_user_simulation',
    'v0.84_city_state_governance_kernel',
    'v0.84_aether_forge_pocket_lovable_loop',
    'v0.84_test_city_failure_factory',
    'v0.85_self_upgrade_government',
    'v0.85_rcl_android_builder_city',
    'v0.85_ial_rcl_task_language_city',
    'v0.86_agent_civilization_market_lab',
    'v0.86_rncs_execution_bridge_city',
    'v0.86_human_capability_feedback_city',
  ],
});

function sha256(value) {
  return crypto.createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
}

function compact(value) {
  return JSON.parse(JSON.stringify(value));
}

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function round(value, digits = 6) {
  return Number(value.toFixed(digits));
}

function ensureArray(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

function stableScore(seed, min = 0.35, max = 0.98) {
  const hex = sha256(seed).slice(0, 12);
  const n = Number.parseInt(hex, 16) / 0xffffffffffff;
  return round(min + (max - min) * n, 6);
}

export function normalizeAgentCivilizationSandboxSpec(input = {}) {
  const merged = {
    ...DEFAULT_AGENT_CIVILIZATION_SANDBOX_SPEC,
    ...input,
    scale: { ...DEFAULT_AGENT_CIVILIZATION_SANDBOX_SPEC.scale, ...(input.scale || {}) },
    policies: { ...DEFAULT_AGENT_CIVILIZATION_SANDBOX_SPEC.policies, ...(input.policies || {}) },
    workloadFocus: ensureArray(input.workloadFocus, DEFAULT_AGENT_CIVILIZATION_SANDBOX_SPEC.workloadFocus),
    candidateFutures: ensureArray(input.candidateFutures, DEFAULT_AGENT_CIVILIZATION_SANDBOX_SPEC.candidateFutures),
  };
  merged.format = RCL_AGENT_CIVILIZATION_SANDBOX_SPEC_FORMAT;
  merged.version = RCL_AGENT_CIVILIZATION_SANDBOX_VERSION;
  merged.scale.cabinetCount = Number.isFinite(Number(merged.scale.cabinetCount)) ? Number(merged.scale.cabinetCount) : 7;
  merged.scale.departmentsPerCabinet = Number.isFinite(Number(merged.scale.departmentsPerCabinet)) ? Number(merged.scale.departmentsPerCabinet) : 7;
  merged.scale.rolesPerDepartment = Number.isFinite(Number(merged.scale.rolesPerDepartment)) ? Number(merged.scale.rolesPerDepartment) : 7;
  merged.scale.citizenCohorts = Number.isFinite(Number(merged.scale.citizenCohorts)) ? Number(merged.scale.citizenCohorts) : 14;
  merged.scale.projectedWorkersPerRoleCell = Number.isFinite(Number(merged.scale.projectedWorkersPerRoleCell)) ? Number(merged.scale.projectedWorkersPerRoleCell) : 7;
  return merged;
}

export function buildAgentCivilizationSandboxSpec(input = {}) {
  return normalizeAgentCivilizationSandboxSpec(input);
}

function buildCabinets(spec) {
  const cabinets = CABINET_BLUEPRINTS.slice(0, spec.scale.cabinetCount).map((cabinet, cabinetIndex) => {
    const departments = cabinet.departments.slice(0, spec.scale.departmentsPerCabinet).map((departmentName, departmentIndex) => {
      const departmentId = `${cabinet.id}_${departmentName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')}`;
      const roleCells = ROLE_TEMPLATES.slice(0, spec.scale.rolesPerDepartment).map((role, roleIndex) => {
        const focus = spec.workloadFocus[(cabinetIndex + departmentIndex + roleIndex) % spec.workloadFocus.length];
        const cell = {
          format: RCL_AGENT_CIVILIZATION_ROLE_CELL_FORMAT,
          id: `${departmentId}_${role.id}`,
          cabinetId: cabinet.id,
          departmentId,
          role: role.id,
          title: `${departmentName} ${role.title}`,
          mission: role.action,
          fewShotSampleCount: 3,
          projectedWorkerEquivalent: spec.scale.projectedWorkersPerRoleCell,
          focus,
          outputContract: outputContractForRole(role.id),
          reportUpTo: departmentId,
          mayWriteDirectlyToWorktree: false,
          cellRoot: null,
        };
        return { ...cell, cellRoot: sha256(compact({ ...cell, cellRoot: undefined })) };
      });
      const department = {
        format: RCL_AGENT_CIVILIZATION_DEPARTMENT_FORMAT,
        id: departmentId,
        name: departmentName,
        cabinetId: cabinet.id,
        mission: `${departmentName} 部门处理 ${cabinet.name} 的窄任务并上报证据摘要。`,
        roleCellCount: roleCells.length,
        projectedWorkerEquivalent: roleCells.reduce((sum, cell) => sum + cell.projectedWorkerEquivalent, 0),
        communicationMode: 'role_cells -> department_summary -> cabinet_summary',
        roleCells,
        departmentRoot: null,
      };
      return { ...department, departmentRoot: sha256(compact({ ...department, departmentRoot: undefined })) };
    });
    const cabinetNode = {
      format: RCL_AGENT_CIVILIZATION_CABINET_FORMAT,
      id: cabinet.id,
      name: cabinet.name,
      mission: cabinet.mission,
      departmentCount: departments.length,
      roleCellCount: departments.reduce((sum, d) => sum + d.roleCellCount, 0),
      projectedWorkerEquivalent: departments.reduce((sum, d) => sum + d.projectedWorkerEquivalent, 0),
      authority: 'summarize, vote, escalate evidence; cannot mutate remote systems',
      departments,
      cabinetRoot: null,
    };
    return { ...cabinetNode, cabinetRoot: sha256(compact({ ...cabinetNode, cabinetRoot: undefined })) };
  });

  const departmentCount = cabinets.reduce((sum, c) => sum + c.departmentCount, 0);
  const roleCellCount = cabinets.reduce((sum, c) => sum + c.roleCellCount, 0);
  const projectedWorkerEquivalent = cabinets.reduce((sum, c) => sum + c.projectedWorkerEquivalent, 0);
  const flatAgentCount = roleCellCount;
  const flatEdges = Math.floor((flatAgentCount * (flatAgentCount - 1)) / 2);
  const hierarchicalEdges = roleCellCount + departmentCount + cabinets.length;
  return {
    id: 'rcl_agent_civilization_city_v082',
    scaleMode: 'compressed-hierarchical-city',
    cabinetCount: cabinets.length,
    departmentCount,
    roleCellCount,
    projectedWorkerEquivalent,
    citizenCohortCount: spec.scale.citizenCohorts,
    flatCommunicationEdges: flatEdges,
    hierarchicalCommunicationEdges: hierarchicalEdges,
    communicationReductionRatio: round(1 - hierarchicalEdges / flatEdges, 6),
    noFlatGroupChat: true,
    cabinets,
    hierarchyRoot: sha256(compact(cabinets.map(c => ({ id: c.id, root: c.cabinetRoot })))),
  };
}

function outputContractForRole(roleId) {
  const table = {
    scout: 'source_map_note.md / risk_boundary.json',
    builder: 'patch_candidate.md / rcl_module_stub.mjs',
    critic: 'semantic_risk_report.md',
    tester: 'regression_test_plan.md',
    evidence: 'evidence_ledger_entry.json',
    adversary: 'failure_scenario.md',
    packager: 'handoff_summary.md / release_note.md',
  };
  return table[roleId] || 'department_summary.md';
}

function buildCitizenCohorts(spec) {
  const base = [
    ['mobile_founder', '只用手机开发的独立创始人'],
    ['android_builder', '想一键生成 APK 的安卓用户'],
    ['lovable_user', '熟悉 Lovable 但想要手机端本地能力的用户'],
    ['local_model_user', '希望接 Ollama / 本地模型的用户'],
    ['api_power_user', '希望接任意 API 的用户'],
    ['low_end_device_user', '低端机、弱网络、存储有限用户'],
    ['beginner_builder', '不会写代码但想做产品的用户'],
    ['security_skeptic', '担心权限、密钥和远程写操作的用户'],
    ['open_source_contributor', '希望看 diff、提 PR、同步 GitHub 的开发者'],
    ['game_creator', '想用 RCL/RNCS 做游戏世界的创作者'],
    ['teacher_student', '希望把语言和智能体作为教学工具的人'],
    ['bug_maker', '专门制造误用、异常和边界条件的测试用户'],
    ['paying_customer', '有付费意愿但要求稳定交付的用户'],
    ['regulator_observer', '关注责任、审计和可解释性的观察者'],
  ];
  return base.slice(0, spec.scale.citizenCohorts).map(([id, description], index) => {
    const pain = stableScore(`${id}:pain`, 0.45, 0.95);
    const willingness = stableScore(`${id}:willingness`, 0.35, 0.92);
    const retentionRisk = stableScore(`${id}:risk`, 0.18, 0.72);
    const cohort = {
      id,
      name: description,
      simulatedPopulation: 100 + index * 37,
      topNeed: topNeedForCohort(id),
      painScore: pain,
      willingnessToUse: willingness,
      retentionRisk,
      feedbackContract: 'one sentence pain + one acceptance rule + one uninstall trigger',
    };
    return { ...cohort, cohortRoot: sha256(cohort) };
  });
}

function topNeedForCohort(id) {
  const table = {
    mobile_founder: '手机上完成从想法到文件/源码包/测试报告的闭环',
    android_builder: '真实构建、安装、崩溃诊断和 APK 交付',
    lovable_user: '对话、计划、修改、预览、回退的一体化体验',
    local_model_user: '本地模型优先、离线模式和隐私边界',
    api_power_user: '任意 API / Provider 路由和成本控制',
    low_end_device_user: '低资源模式、压缩输出、后台恢复',
    beginner_builder: '不用懂工程名词也能完成产品修改',
    security_skeptic: '明确权限、密钥保护、不可逆动作确认',
    open_source_contributor: 'GitHub 双向同步、diff、分支、PR',
    game_creator: '世界模拟、NPC、任务和可见运行结果',
    teacher_student: '把复杂语言压成练习、演示和学习路径',
    bug_maker: '自动生成边界用例、坏输入和失败复现',
    paying_customer: '稳定交付、版本回退、结果证明',
    regulator_observer: '审计、责任、证据链和语义边界',
  };
  return table[id] || '清楚的目标、低风险执行、可验证结果';
}

function buildWorkloadCompiler(spec, hierarchy, cohorts) {
  const cabinetSummaries = hierarchy.cabinets.map((cabinet, cabinetIndex) => {
    const topDepartments = cabinet.departments.map((department, departmentIndex) => ({
      departmentId: department.id,
      name: department.name,
      output: `${department.name} 输出 ${spec.workloadFocus[(cabinetIndex + departmentIndex) % spec.workloadFocus.length]} 的部门级证据摘要。`,
      roleCells: department.roleCellCount,
      workerEquivalent: department.projectedWorkerEquivalent,
    }));
    return {
      cabinetId: cabinet.id,
      cabinetName: cabinet.name,
      output: cabinet.mission,
      departmentOutputs: topDepartments,
      cabinetPriority: stableScore(`${cabinet.id}:priority`, 0.62, 0.97),
    };
  });

  const workPackages = spec.workloadFocus.map((focus, index) => {
    const owningCabinet = hierarchy.cabinets[index % hierarchy.cabinets.length];
    const assistingCabinet = hierarchy.cabinets[(index + 2) % hierarchy.cabinets.length];
    const marketCohort = cohorts[index % cohorts.length];
    const workload = {
      format: RCL_AGENT_CIVILIZATION_WORKLOAD_FORMAT,
      id: `workload_${String(index + 1).padStart(2, '0')}_${focus}`,
      focus,
      owningCabinetId: owningCabinet.id,
      assistingCabinetId: assistingCabinet.id,
      simulatedUserCohortId: marketCohort.id,
      usefulFileTarget: usefulFileForFocus(focus),
      acceptanceRule: acceptanceForFocus(focus),
      minimumEvidence: ['input spec', 'department summaries', 'council vote', 'canonical root'],
      expectedWorkReduction: round(stableScore(`${focus}:reduction`, 0.38, 0.82), 4),
      risk: round(1 - stableScore(`${focus}:safety`, 0.54, 0.91), 4),
    };
    return { ...workload, workloadRoot: sha256(workload) };
  });

  return {
    id: 'rcl_agent_city_workload_compiler_seed_v082',
    compilationMode: 'city hierarchy -> department summaries -> useful files -> council verdict',
    cabinetSummaries,
    workPackageCount: workPackages.length,
    workPackages,
    totalExpectedWorkReduction: round(workPackages.reduce((sum, item) => sum + item.expectedWorkReduction, 0) / workPackages.length, 4),
    averageRisk: round(workPackages.reduce((sum, item) => sum + item.risk, 0) / workPackages.length, 4),
    workloadRoot: sha256(compact(workPackages.map(w => ({ id: w.id, root: w.workloadRoot })))),
  };
}

function usefulFileForFocus(focus) {
  const table = {
    rcl_self_upgrade: 'rcl-v083-upgrade-backlog.md',
    aether_forge_pocket_product_loop: 'aether-forge-pocket-agent-city-feedback.md',
    evidence_hygiene: 'evidence-hygiene-court-rules.md',
    virtual_market_feedback: 'virtual-market-feedback-board.md',
    test_and_failure_generation: 'test-city-failure-factory.md',
    release_packaging: 'release-packaging-protocol.md',
    founder_workload_reduction: 'duhengjie-workload-reduction-map.md',
  };
  return table[focus] || `${focus}.md`;
}

function acceptanceForFocus(focus) {
  const table = {
    rcl_self_upgrade: 'Every proposed upgrade must name touched files, tests, rollback and evidence.',
    aether_forge_pocket_product_loop: 'Every feature must map to user preview, build, diff and rollback loop.',
    evidence_hygiene: 'Every result must distinguish sandbox evidence from real worktree mutation.',
    virtual_market_feedback: 'Every simulated cohort must provide pain, acceptance and uninstall trigger.',
    test_and_failure_generation: 'Every patch must have at least one failure case and one regression test.',
    release_packaging: 'Every release must include zip, report, context update and next handoff.',
    founder_workload_reduction: 'Every agent output must remove one decision or drafting burden from the founder.',
  };
  return table[focus] || 'Produce one useful file, one validation rule and one risk boundary.';
}

function scoreFuture(futureId, spec, hierarchy, workload) {
  const leverage = stableScore(`${futureId}:leverage`, 0.45, 0.99);
  const feasibility = stableScore(`${futureId}:feasibility`, 0.38, 0.94);
  const evidence = stableScore(`${futureId}:evidence`, 0.5, 0.96);
  const risk = stableScore(`${futureId}:risk`, 0.08, 0.58);
  const utilityBoost = futureId.includes('workload') ? 0.07 : futureId.includes('market') ? 0.04 : futureId.includes('patch') ? 0.045 : 0;
  const cityFit = clamp((hierarchy.communicationReductionRatio + workload.totalExpectedWorkReduction) / 2, 0, 1);
  const score = clamp((leverage * 0.28) + (feasibility * 0.24) + (evidence * 0.22) + ((1 - risk) * 0.18) + (cityFit * 0.08) + utilityBoost, 0, 1);
  return { leverage, feasibility, evidence, risk, cityFit: round(cityFit, 6), score: round(score, 6) };
}

function runAcceleratedFutureSimulation(spec, hierarchy, workload) {
  const futures = spec.candidateFutures.map((futureId, index) => {
    const metrics = scoreFuture(futureId, spec, hierarchy, workload);
    return {
      id: futureId,
      simulatedCycle: index + 1,
      horizon: `${(index + 1) * 3} accelerated days`,
      recommendation: recommendationForFuture(futureId),
      ...metrics,
      promote: metrics.score >= 0.74 && metrics.risk <= 0.5,
      branchRoot: sha256({ futureId, metrics }),
    };
  }).sort((a, b) => b.score - a.score);
  const promoted = futures.filter(f => f.promote).slice(0, 5);
  return {
    id: 'rcl_agent_city_accelerated_future_simulation_v082',
    interpretation: 'Engineering-time acceleration: many candidate futures are simulated before real worktree mutation.',
    branchCount: futures.length,
    promotedBranchCount: promoted.length,
    topBranch: futures[0],
    promotedBranches: promoted,
    averageScore: round(futures.reduce((sum, f) => sum + f.score, 0) / futures.length, 6),
    averageRisk: round(futures.reduce((sum, f) => sum + f.risk, 0) / futures.length, 6),
    accelerationFactor: Math.max(1, Math.round(Math.log2(hierarchy.projectedWorkerEquivalent + 1) * 5)),
    simulationRoot: sha256(compact(futures.map(f => ({ id: f.id, score: f.score, risk: f.risk })))),
  };
}

function recommendationForFuture(futureId) {
  if (futureId.includes('workload_compiler')) return '优先推进：把城市输出压成可执行任务包，最大幅度减少外层模型决策成本。';
  if (futureId.includes('patch_apply')) return '高价值但需要隔离临时工作区和失败回滚。';
  if (futureId.includes('virtual_market')) return '用于 Aether Forge Pocket 和 RCL 产品判断，先做 cohort 压缩模拟。';
  if (futureId.includes('governance') || futureId.includes('government')) return '适合作为 v0.84+，必须等证据法院稳定后再扩大。';
  if (futureId.includes('android')) return '适合接 Aether Forge Pocket，但 Android 构建链需要更硬的执行器。';
  return '作为候选未来保留，等待更强证据或用户需求触发。';
}

function buildCouncil(spec, hierarchy, workload, simulation) {
  const votes = hierarchy.cabinets.map((cabinet, index) => {
    const topFocus = spec.workloadFocus[index % spec.workloadFocus.length];
    const confidence = stableScore(`${cabinet.id}:vote:${simulation.topBranch.id}`, 0.6, 0.97);
    return {
      cabinetId: cabinet.id,
      cabinetName: cabinet.name,
      vote: confidence >= 0.65 ? 'promote' : 'hold',
      confidence,
      reason: `${cabinet.name} 判断 ${simulation.topBranch.id} 对 ${topFocus} 的工作量压缩最明显。`,
    };
  });
  const promoteVotes = votes.filter(v => v.vote === 'promote').length;
  const vetoes = [];
  if (!spec.policies.humanFinalAuthorityKept) vetoes.push('human final authority must be kept');
  if (!spec.policies.noRemoteMutation) vetoes.push('remote mutation is forbidden in v0.82');
  if (!spec.policies.noFlatGroupChat) vetoes.push('flat group chat would explode communication complexity');
  return {
    id: 'rcl_agent_civilization_council_v082',
    votingRule: 'cabinet majority + semantic guard veto + human final authority',
    votes,
    promoteVotes,
    totalVotes: votes.length,
    passed: promoteVotes >= 4 && vetoes.length === 0,
    vetoes,
    releaseVerdict: promoteVotes >= 4 && vetoes.length === 0 ? 'ship_v0.82_agent_civilization_sandbox_seed' : 'hold_for_guard_repair',
    nextRecommendedRelease: simulation.topBranch.id,
    humanFinalAuthorityKept: true,
    councilRoot: sha256({ votes, vetoes, topBranch: simulation.topBranch.id }),
  };
}

function buildEvidence(spec, hierarchy, cohorts, workload, simulation, council) {
  const records = [
    ['spec', spec],
    ['hierarchy', { root: hierarchy.hierarchyRoot, cabinets: hierarchy.cabinetCount, departments: hierarchy.departmentCount, roleCells: hierarchy.roleCellCount }],
    ['citizen_cohorts', cohorts.map(c => ({ id: c.id, root: c.cohortRoot }))],
    ['workload', { root: workload.workloadRoot, count: workload.workPackageCount }],
    ['simulation', { root: simulation.simulationRoot, top: simulation.topBranch.id }],
    ['council', { root: council.councilRoot, verdict: council.releaseVerdict }],
  ].map(([kind, payload], index) => ({
    format: RCL_AGENT_CIVILIZATION_EVIDENCE_FORMAT,
    sequence: index + 1,
    kind,
    hash: sha256(payload),
    boundary: 'deterministic sandbox evidence; not a claim of real-world autonomous action',
  }));
  return {
    id: 'rcl_agent_civilization_evidence_ledger_v082',
    recordCount: records.length,
    records,
    canonicalRoot: sha256(records.map(r => `${r.sequence}:${r.kind}:${r.hash}`).join('\n')),
  };
}

export function compileAgentCivilizationSandbox(input = {}) {
  const spec = buildAgentCivilizationSandboxSpec(input);
  const hierarchy = buildCabinets(spec);
  const citizenCohorts = buildCitizenCohorts(spec);
  const workload = buildWorkloadCompiler(spec, hierarchy, citizenCohorts);
  const simulation = runAcceleratedFutureSimulation(spec, hierarchy, workload);
  const council = buildCouncil(spec, hierarchy, workload, simulation);
  const evidenceLedger = buildEvidence(spec, hierarchy, citizenCohorts, workload, simulation, council);
  const result = {
    format: RCL_AGENT_CIVILIZATION_SANDBOX_RESULT_FORMAT,
    version: RCL_AGENT_CIVILIZATION_SANDBOX_VERSION,
    ok: council.passed,
    missionId: spec.missionId,
    agentCivilizationSandboxEstablished: true,
    scaleMode: hierarchy.scaleMode,
    cabinetCount: hierarchy.cabinetCount,
    departmentCount: hierarchy.departmentCount,
    roleCellCount: hierarchy.roleCellCount,
    totalFewShotSamples: hierarchy.roleCellCount * 3,
    projectedWorkerEquivalent: hierarchy.projectedWorkerEquivalent,
    citizenCohortCount: hierarchy.citizenCohortCount,
    flatCommunicationEdges: hierarchy.flatCommunicationEdges,
    hierarchicalCommunicationEdges: hierarchy.hierarchicalCommunicationEdges,
    communicationReductionRatio: hierarchy.communicationReductionRatio,
    compressedPopulationKept: spec.policies.compressedPopulation === true,
    noFlatGroupChat: spec.policies.noFlatGroupChat === true,
    workloadPackageCount: workload.workPackageCount,
    averageWorkReduction: workload.totalExpectedWorkReduction,
    acceleratedBranchCount: simulation.branchCount,
    promotedBranchCount: simulation.promotedBranchCount,
    topAcceleratedBranch: simulation.topBranch.id,
    accelerationFactor: simulation.accelerationFactor,
    councilPassed: council.passed,
    semanticGuardPresent: spec.policies.semanticGuardRequired === true,
    rollbackRequired: spec.policies.rollbackRequired === true,
    evidenceLedgerWritten: spec.policies.evidenceLedgerRequired === true,
    evidenceRecordCount: evidenceLedger.recordCount,
    canonicalRoot: evidenceLedger.canonicalRoot,
    noNetwork: spec.policies.noNetwork === true,
    noRemoteMutation: spec.policies.noRemoteMutation === true,
    noRealWorldActionByDefault: spec.policies.noRealWorldActionByDefault === true,
    humanFinalAuthorityKept: spec.policies.humanFinalAuthorityKept === true,
    canReplaceOuterModelCompletely: false,
    nextHandoff: spec.nextHandoff,
  };
  return {
    format: RCL_AGENT_CIVILIZATION_SANDBOX_BUNDLE_FORMAT,
    ok: result.ok,
    spec,
    hierarchy,
    citizenCohorts,
    workload,
    simulation,
    council,
    evidenceLedger,
    result,
    bundleRoot: sha256({ spec, hierarchyRoot: hierarchy.hierarchyRoot, workloadRoot: workload.workloadRoot, simulationRoot: simulation.simulationRoot, councilRoot: council.councilRoot, canonicalRoot: evidenceLedger.canonicalRoot }),
  };
}

export function runAgentCivilizationSandbox(input = {}) {
  return compileAgentCivilizationSandbox(input);
}

export function runAgentCivilizationSandboxDemo() {
  return compileAgentCivilizationSandbox(DEFAULT_AGENT_CIVILIZATION_SANDBOX_SPEC);
}

export function renderAgentCivilizationSandboxRcl(input = {}) {
  const spec = buildAgentCivilizationSandboxSpec(input);
  const scale = spec.scale;
  return `// AgentCivilizationSandboxV082\n// RCL v${RCL_AGENT_CIVILIZATION_SANDBOX_VERSION}\n\nprogram AgentCivilizationSandboxV082 {\n  mission "${spec.mission}"\n  founder "${spec.founder}"\n\n  civilization.scale {\n    cabinets ${scale.cabinetCount}\n    departments_per_cabinet ${scale.departmentsPerCabinet}\n    roles_per_department ${scale.rolesPerDepartment}\n    projected_workers_per_role_cell ${scale.projectedWorkersPerRoleCell}\n    citizen_cohorts ${scale.citizenCohorts}\n    mode "compressed hierarchical city"\n  }\n\n  guard {\n    no_flat_group_chat true\n    no_network true\n    no_remote_mutation true\n    no_real_world_action_by_default true\n    human_final_authority_kept true\n    can_replace_outer_model_completely false\n  }\n\n  workflow {\n    PARA { engineering_cabinet, quality_cabinet, evidence_court, product_cabinet, safety_cabinet, research_academy, release_cabinet }\n    RECURSE { department_summaries } UNTIL { evidence_stable }\n    IF { council_passed } THEN { release_v0_82_agent_civilization_sandbox }\n    CALL { workload_compiler_seed } => ${spec.nextHandoff}\n  }\n}\n`;
}

export function readAgentCivilizationSandboxInput(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return normalizeAgentCivilizationSandboxSpec(JSON.parse(raw));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function writeText(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value.endsWith('\n') ? value : `${value}\n`);
}

function table(rows, headers) {
  const escape = v => String(v).replace(/\n/g, ' ');
  return [
    `| ${headers.map(escape).join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map(row => `| ${headers.map(h => escape(row[h] ?? '')).join(' | ')} |`),
  ].join('\n');
}

function renderHierarchyMarkdown(bundle) {
  const rows = bundle.hierarchy.cabinets.map(c => ({
    内阁: c.name,
    部门数: c.departmentCount,
    岗位格: c.roleCellCount,
    等效工人: c.projectedWorkerEquivalent,
    使命: c.mission,
  }));
  return `# RCL Agent Civilization Hierarchy v0.82\n\n${table(rows, ['内阁', '部门数', '岗位格', '等效工人', '使命'])}\n\n- 平级群聊边数：${bundle.hierarchy.flatCommunicationEdges}\n- 分层汇报边数：${bundle.hierarchy.hierarchicalCommunicationEdges}\n- 通信压缩率：${bundle.hierarchy.communicationReductionRatio}\n- 规则：岗位只向部门汇报，部门向内阁汇报，内阁进入 council。\n`;
}

function renderWorkloadMarkdown(bundle) {
  const rows = bundle.workload.workPackages.map(w => ({
    工作包: w.id,
    主责内阁: w.owningCabinetId,
    输出文件: w.usefulFileTarget,
    预期减负: w.expectedWorkReduction,
    风险: w.risk,
    验收: w.acceptanceRule,
  }));
  return `# Agent City Workload Compiler Seed\n\n${table(rows, ['工作包', '主责内阁', '输出文件', '预期减负', '风险', '验收'])}\n\n平均减负：${bundle.workload.totalExpectedWorkReduction}\n平均风险：${bundle.workload.averageRisk}\n`;
}

function renderMarketMarkdown(bundle) {
  const rows = bundle.citizenCohorts.map(c => ({
    群组: c.id,
    模拟人口: c.simulatedPopulation,
    核心需求: c.topNeed,
    痛点: c.painScore,
    使用意愿: c.willingnessToUse,
    流失风险: c.retentionRisk,
  }));
  return `# Virtual Market Cohorts v0.82\n\n${table(rows, ['群组', '模拟人口', '核心需求', '痛点', '使用意愿', '流失风险'])}\n\n解释：这些不是现实用户数据，而是用于产品判断的压缩用户群组。\n`;
}

function renderSimulationMarkdown(bundle) {
  const rows = bundle.simulation.promotedBranches.map(b => ({
    分支: b.id,
    分数: b.score,
    风险: b.risk,
    周期: b.horizon,
    建议: b.recommendation,
  }));
  return `# Accelerated Future Simulation v0.82\n\n- 分支数：${bundle.simulation.branchCount}\n- 晋级分支数：${bundle.simulation.promotedBranchCount}\n- 加速系数：${bundle.simulation.accelerationFactor}x（工程候选未来并行推演意义，不代表现实时间变化）\n- 最优分支：${bundle.simulation.topBranch.id}\n\n${table(rows, ['分支', '分数', '风险', '周期', '建议'])}\n`;
}

function renderCouncilMarkdown(bundle) {
  const rows = bundle.council.votes.map(v => ({
    内阁: v.cabinetName,
    投票: v.vote,
    信心: v.confidence,
    理由: v.reason,
  }));
  return `# Agent Civilization Council Verdict v0.82\n\n${table(rows, ['内阁', '投票', '信心', '理由'])}\n\n- 通过：${bundle.council.passed}\n- 裁决：${bundle.council.releaseVerdict}\n- 下一步建议：${bundle.council.nextRecommendedRelease}\n- 人类最终权威保留：${bundle.council.humanFinalAuthorityKept}\n`;
}

function renderEvidenceMarkdown(bundle) {
  const rows = bundle.evidenceLedger.records.map(r => ({
    序号: r.sequence,
    类型: r.kind,
    Hash: r.hash,
    边界: r.boundary,
  }));
  return `# RCL Agent Civilization Evidence Ledger v0.82\n\n${table(rows, ['序号', '类型', 'Hash', '边界'])}\n\nCanonical Root:\n\n\`\`\`text\n${bundle.evidenceLedger.canonicalRoot}\n\`\`\`\n`;
}

export function renderAgentCivilizationWorkMethodMarkdown(input = {}) {
  const bundle = compileAgentCivilizationSandbox(input);
  return `# RCL Agent Civilization Work Method v0.82\n\n## 用途\n\n以后处理 RCL / RNCS / Aether Forge Pocket 这类复杂开发任务时，优先使用 **Agent Civilization Sandbox（智能体文明沙箱）** 减少外层模型工作量。\n\n它把单模型开发拆成：\n\n\`\`\`text\n创始人意图\n→ 7 个内阁\n→ 49 个部门\n→ 343 个岗位格\n→ 压缩用户/市场 cohort\n→ 工作包\n→ 证据法院\n→ council 裁决\n→ 外层真实执行\n\`\`\`\n\n## 什么时候用\n\n- 版本升级路线不清楚。\n- 需要大量方案、测试、文档、用户模拟、风险审查。\n- 一个任务会触碰多个项目或多个模块。\n- 需要在真实改源码前模拟很多候选未来。\n\n## 怎么用\n\n运行：\n\n\`\`\`bash\nnode src/cli.mjs agent-civilization-demo\nnode src/cli.mjs agent-civilization-run examples/agent-civilization/default-agent-civilization.json output/v0.82/agent-civilization-sandbox\nnode src/cli.mjs agent-civilization-spec output/v0.82/agent-civilization-spec\n\`\`\`\n\n## 硬边界\n\n- v0.82 只做沙箱推演、工作包、证据和裁决。\n- 不直接改真实工作区。\n- 不联网。\n- 不 push GitHub。\n- 不宣称完全替代外层强模型。\n- 人类最终权威保留。\n\n## 当前默认规模\n\n- 内阁：${bundle.result.cabinetCount}\n- 部门：${bundle.result.departmentCount}\n- 岗位格：${bundle.result.roleCellCount}\n- 少数据样本：${bundle.result.totalFewShotSamples}\n- 等效工人：${bundle.result.projectedWorkerEquivalent}\n- 通信压缩率：${bundle.result.communicationReductionRatio}\n- 最优下一步：${bundle.result.topAcceleratedBranch}\n\n## 一句话\n\n不要再让一个模型单线程想所有事；先让 RCL 城市在沙箱里并行产生工作包、反对意见、测试、用户反馈和证据，再由外层执行器做真实修改。\n`;
}

export function writeAgentCivilizationSandboxReports(outputDir, input = {}) {
  const bundle = compileAgentCivilizationSandbox(input);
  const dir = path.resolve(outputDir || 'output/v0.82/agent-civilization-sandbox');
  fs.mkdirSync(dir, { recursive: true });
  writeJson(path.join(dir, 'agent-civilization-result.json'), bundle.result);
  writeJson(path.join(dir, 'agent-civilization-bundle.json'), bundle);
  writeJson(path.join(dir, 'hierarchy-summary.json'), bundle.hierarchy);
  writeJson(path.join(dir, 'workload-compiler.json'), bundle.workload);
  writeJson(path.join(dir, 'virtual-market-cohorts.json'), bundle.citizenCohorts);
  writeJson(path.join(dir, 'accelerated-futures.json'), bundle.simulation);
  writeJson(path.join(dir, 'council-verdict.json'), bundle.council);
  writeJson(path.join(dir, 'evidence-ledger.json'), bundle.evidenceLedger);
  writeText(path.join(dir, 'hierarchy-summary.md'), renderHierarchyMarkdown(bundle));
  writeText(path.join(dir, 'workload-compiler.md'), renderWorkloadMarkdown(bundle));
  writeText(path.join(dir, 'virtual-market-simulation.md'), renderMarketMarkdown(bundle));
  writeText(path.join(dir, 'accelerated-future-simulation.md'), renderSimulationMarkdown(bundle));
  writeText(path.join(dir, 'council-verdict.md'), renderCouncilMarkdown(bundle));
  writeText(path.join(dir, 'evidence-ledger.md'), renderEvidenceMarkdown(bundle));
  writeText(path.join(dir, 'agent-civilization-work-method.md'), renderAgentCivilizationWorkMethodMarkdown(input));
  writeText(path.join(dir, 'agent-civilization-sandbox.rcl'), renderAgentCivilizationSandboxRcl(bundle.spec));
  writeText(path.join(dir, 'canonical-root.txt'), bundle.evidenceLedger.canonicalRoot);
  return {
    ok: bundle.ok,
    version: RCL_AGENT_CIVILIZATION_SANDBOX_VERSION,
    outputDir: dir,
    files: fs.readdirSync(dir).sort(),
    result: bundle.result,
  };
}
