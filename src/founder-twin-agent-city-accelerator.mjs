import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  buildAgentCivilizationSandboxSpec,
  compileAgentCivilizationSandbox,
  renderAgentCivilizationSandboxRcl,
} from './agent-civilization-sandbox.mjs';

export const RCL_FOUNDER_TWIN_AGENT_CITY_ACCELERATOR_VERSION = '0.83.0-alpha.1';
export const RCL_FOUNDER_TWIN_AGENT_CITY_ACCELERATOR_SPEC_FORMAT = 'rcl.founder-twin-agent-city-accelerator.spec.v0.83';
export const RCL_FOUNDER_TWIN_AGENT_CITY_ACCELERATOR_RESULT_FORMAT = 'rcl.founder-twin-agent-city-accelerator.result.v0.83';
export const RCL_FOUNDER_TWIN_AGENT_CITY_ACCELERATOR_BUNDLE_FORMAT = 'rcl.founder-twin-agent-city-accelerator.bundle.v0.83';
export const RCL_FOUNDER_TWIN_PROFILE_FORMAT = 'rcl.founder-twin.profile.v0.83';
export const RCL_FOUNDER_DECISION_KERNEL_FORMAT = 'rcl.founder-twin.decision-kernel.v0.83';
export const RCL_FOUNDER_CITY_ALIGNMENT_FORMAT = 'rcl.founder-twin.city-alignment.v0.83';
export const RCL_FOUNDER_ACCELERATION_LEDGER_FORMAT = 'rcl.founder-twin.acceleration-ledger.v0.83';
export const RCL_FOUNDER_TWIN_EVIDENCE_FORMAT = 'rcl.founder-twin.evidence.v0.83';

const NINE_CORE_BLUEPRINTS = Object.freeze([
  ['master_core', '主控核', '把候选分支压成一个可授权、可执行、可回滚的主线。'],
  ['creative_core', '创造核', '从异常结构里生成新产品、新语言、新任务形式。'],
  ['perception_core', '感知核', '快速扫描异常、噪声、机会窗口和语义漂移。'],
  ['defense_core', '防御核', '限制错误扩散、越权执行、虚假成功和低价值消耗。'],
  ['meta_core', '元认知核', '观察分析框架本身，发现重复、高压缩率和可资产化结构。'],
  ['strategy_core', '战略核', '按战略价值、时间窗口和现实收益重排优先级。'],
  ['exploration_core', '探索核', '保留高价值未知分支，并为其生成最小验证任务。'],
  ['emotional_core', '情感调和核', '压低关系与表达噪声，使输出能被真实对象接收。'],
  ['intuition_fate_core', '直觉/命运核', '对路径分岔、趋势转折和异常机会做候选判断。'],
]);

const DEFAULT_TRIAD = Object.freeze([
  {
    id: 'structure_recognition',
    name: '结构识别',
    rule: '先判断输入属于产品、工程、研究、现实、关系、资产还是执行问题，再决定分析框架。',
    rclVerb: 'OBSERVE_STRUCTURE',
  },
  {
    id: 'interface_scheduling',
    name: '接口调度',
    rule: '把目标映射到可调用能力：文件、源码、测试、Provider、Skill、RCL、RNCS、Aether Forge Pocket。',
    rclVerb: 'SCHEDULE_INTERFACES',
  },
  {
    id: 'sovereign_compilation',
    name: '主权编译',
    rule: '保留杜衡界最终裁决权，把高维分支压成文件、测试、APK、按钮、路线或可回滚执行包。',
    rclVerb: 'COMPILE_SOVEREIGN_ACTION',
  },
]);

const DEFAULT_VALUE_AXES = Object.freeze([
  ['strategic_value', '战略价值', 0.17],
  ['reality_value', '现实价值', 0.15],
  ['asset_value', '资产价值', 0.14],
  ['time_window_value', '时间窗口价值', 0.13],
  ['validation_value', '验证价值', 0.13],
  ['workload_reduction', '减负价值', 0.12],
  ['delivery_value', '交付价值', 0.10],
  ['growth_value', '成长价值', 0.06],
]);

export const DEFAULT_FOUNDER_TWIN_AGENT_CITY_ACCELERATOR_SPEC = Object.freeze({
  format: RCL_FOUNDER_TWIN_AGENT_CITY_ACCELERATOR_SPEC_FORMAT,
  version: RCL_FOUNDER_TWIN_AGENT_CITY_ACCELERATOR_VERSION,
  missionId: 'rcl-founder-twin-agent-city-v083',
  title: 'RCL Founder Twin Agent City Accelerator v0.83',
  founder: {
    primaryName: '杜衡界',
    legalName: '杜浩麟',
    englishAlias: 'Monies To / To Ho Lun',
    company: '道風悠遊科技有限公司 / TaoWind Interactive Technology Limited',
    role: 'Founder / CEO / Lead Strategist',
    simulationMode: 'evidence-constrained founder decision twin; not the real person and not a rights-bearing identity',
  },
  mission: '把杜衡界判断结构编译成 Founder Twin（创始人孪生智能体），让 RCL 智能体城市围绕他的真实偏好和项目目标加速工作。',
  targetRelease: 'v0.83 Founder Twin Agent City Accelerator',
  nextHandoff: 'v0.84 Founder-Gated Real Patch Apply Loop',
  founderTriad: DEFAULT_TRIAD,
  valueAxes: DEFAULT_VALUE_AXES.map(([id, name, weight]) => ({ id, name, weight })),
  hardRules: [
    '不预设用户目标一定正确；先做结构验证。',
    '每个高维概念必须压成可用文件、测试、代码、APK、按钮、路线或证据。',
    '候选现实可以沙箱加速，真实执行必须保留授权、回滚和证据。',
    '优先减少杜衡界的判断成本、沟通成本、重复解释成本和版本整理成本。',
    '禁止把 Founder Twin 说成真实人格复制或完全替代用户本人。',
  ],
  preferredUsefulOutputs: [
    'complete source zip',
    'development acceptance report',
    'work method markdown',
    'RCL handoff file',
    'test file',
    'patch queue',
    'APK/build artifact when available',
    'one-button product loop',
  ],
  cityInput: {
    missionId: 'rcl-agent-civilization-v083-founder-aligned',
    title: 'RCL Agent Civilization Sandbox with Founder Twin v0.83',
    founder: '杜衡界',
    mission: '由 Founder Twin 先压缩意图，再调度智能体城市生成工作包、证据和下一步执行路线。',
    targetRelease: 'v0.83 Founder Twin Agent City Accelerator',
    nextHandoff: 'v0.84 Founder-Gated Real Patch Apply Loop',
    workloadFocus: [
      'founder_decision_compression',
      'rcl_self_upgrade',
      'aether_forge_pocket_product_loop',
      'evidence_hygiene',
      'real_patch_apply_loop',
      'virtual_market_feedback',
      'test_and_failure_generation',
      'release_packaging',
    ],
    candidateFutures: [
      'v0.84_founder_gated_real_patch_apply_loop',
      'v0.84_aether_forge_pocket_lovable_loop',
      'v0.84_founder_memory_project_knowledge_layer',
      'v0.84_test_city_failure_factory',
      'v0.85_agent_city_market_lab',
      'v0.85_rcl_android_build_city',
      'v0.85_ial_rcl_task_composer',
      'v0.86_rncs_execution_bridge_city',
      'v0.86_human_capability_os_founder_loop',
      'v0.86_founder_twin_governance_kernel',
    ],
  },
  policies: {
    noNetwork: true,
    noRemoteMutation: true,
    noRealWorldActionByDefault: true,
    humanFinalAuthorityKept: true,
    founderTwinIsSimulationOnly: true,
    evidenceBoundaryRequired: true,
    semanticGuardRequired: true,
    rollbackRequired: true,
  },
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

function stableScore(seed, min = 0.35, max = 0.98) {
  const hex = sha256(seed).slice(0, 12);
  const n = Number.parseInt(hex, 16) / 0xffffffffffff;
  return round(min + (max - min) * n, 6);
}

function ensureArray(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

function normalizeWeights(axes) {
  const safe = axes.map(axis => ({ ...axis, weight: Number.isFinite(Number(axis.weight)) ? Number(axis.weight) : 0 }));
  const sum = safe.reduce((acc, axis) => acc + axis.weight, 0) || 1;
  return safe.map(axis => ({ ...axis, weight: round(axis.weight / sum, 6) }));
}

export function normalizeFounderTwinAgentCityAcceleratorSpec(input = {}) {
  const mergedFounder = { ...DEFAULT_FOUNDER_TWIN_AGENT_CITY_ACCELERATOR_SPEC.founder, ...(input.founder || {}) };
  const mergedPolicies = { ...DEFAULT_FOUNDER_TWIN_AGENT_CITY_ACCELERATOR_SPEC.policies, ...(input.policies || {}) };
  const mergedCityInput = { ...DEFAULT_FOUNDER_TWIN_AGENT_CITY_ACCELERATOR_SPEC.cityInput, ...(input.cityInput || {}) };
  return {
    ...DEFAULT_FOUNDER_TWIN_AGENT_CITY_ACCELERATOR_SPEC,
    ...input,
    format: RCL_FOUNDER_TWIN_AGENT_CITY_ACCELERATOR_SPEC_FORMAT,
    version: RCL_FOUNDER_TWIN_AGENT_CITY_ACCELERATOR_VERSION,
    founder: mergedFounder,
    policies: mergedPolicies,
    founderTriad: ensureArray(input.founderTriad, DEFAULT_FOUNDER_TWIN_AGENT_CITY_ACCELERATOR_SPEC.founderTriad),
    valueAxes: normalizeWeights(ensureArray(input.valueAxes, DEFAULT_FOUNDER_TWIN_AGENT_CITY_ACCELERATOR_SPEC.valueAxes)),
    hardRules: ensureArray(input.hardRules, DEFAULT_FOUNDER_TWIN_AGENT_CITY_ACCELERATOR_SPEC.hardRules),
    preferredUsefulOutputs: ensureArray(input.preferredUsefulOutputs, DEFAULT_FOUNDER_TWIN_AGENT_CITY_ACCELERATOR_SPEC.preferredUsefulOutputs),
    cityInput: mergedCityInput,
  };
}

export function buildFounderTwinAgentCityAcceleratorSpec(input = {}) {
  return normalizeFounderTwinAgentCityAcceleratorSpec(input);
}

function buildNineCoreMirror(spec) {
  const cores = NINE_CORE_BLUEPRINTS.map(([id, name, mission], index) => {
    const samples = [
      `样本A：遇到复杂输入时，${name} 先压缩为一个可验证结构。`,
      `样本B：如果分支过多，${name} 要求生成最小文件/测试/证据。`,
      `样本C：如果任务不可逆，${name} 保留杜衡界最终裁决权。`,
    ];
    const core = {
      id,
      name,
      mission,
      fewShotSamples: samples,
      sampleCount: samples.length,
      priority: stableScore(`${id}:founder-core-priority`, 0.61, 0.98),
      outputContract: outputContractForCore(id),
      coreRoot: null,
    };
    return { ...core, coreRoot: sha256({ ...core, coreRoot: undefined, index }) };
  });
  return {
    format: 'rcl.founder-twin.nine-core-mirror.v0.83',
    coreCount: cores.length,
    totalFewShotSamples: cores.reduce((sum, core) => sum + core.sampleCount, 0),
    cores,
    nineCoreRoot: sha256(cores.map(c => `${c.id}:${c.coreRoot}`).join('\n')),
  };
}

function outputContractForCore(id) {
  const table = {
    master_core: 'one authorized mainline + rollback point',
    creative_core: 'one new product/structure hypothesis + minimum validation artifact',
    perception_core: 'one anomaly/risk/opportunity scan',
    defense_core: 'one boundary rule + one failure containment rule',
    meta_core: 'one reusable work method or naming upgrade',
    strategy_core: 'one priority table sorted by strategic/time-window value',
    exploration_core: 'one unknown branch + one cheap experiment',
    emotional_core: 'one communication simplification for real humans',
    intuition_fate_core: 'one path fork forecast + evidence caveat',
  };
  return table[id] || 'one useful founder-facing artifact';
}

function buildDecisionKernel(spec, nineCoreMirror) {
  const triad = spec.founderTriad.map((item, index) => ({
    ...item,
    sequence: index + 1,
    activationQuestion: activationQuestionForTriad(item.id),
    evidenceDemand: evidenceDemandForTriad(item.id),
  }));
  const kernel = {
    format: RCL_FOUNDER_DECISION_KERNEL_FORMAT,
    founder: spec.founder.primaryName,
    identityBoundary: spec.founder.simulationMode,
    triad,
    valueAxes: spec.valueAxes,
    hardRules: spec.hardRules,
    preferredUsefulOutputs: spec.preferredUsefulOutputs,
    nineCoreMirrorRoot: nineCoreMirror.nineCoreRoot,
    decisionLoop: [
      'OBSERVE_STRUCTURE',
      'NAME_CONSTRAINTS',
      'SCHEDULE_INTERFACES',
      'COMPILE_SOVEREIGN_ACTION',
      'DEMAND_EVIDENCE',
      'HANDOFF_TO_CITY_OR_OUTER_EXECUTOR',
    ],
    kernelRoot: null,
  };
  return { ...kernel, kernelRoot: sha256({ ...kernel, kernelRoot: undefined }) };
}

function activationQuestionForTriad(id) {
  const table = {
    structure_recognition: '这件事本质上是什么结构？异常、矛盾和可资产化点在哪里？',
    interface_scheduling: '应该调用哪种能力、文件、工具、模型、Provider、测试或运行时？',
    sovereign_compilation: '如何压成对杜衡界有用且可授权、可验证、可回滚的行动？',
  };
  return table[id] || '它如何变成可执行结构？';
}

function evidenceDemandForTriad(id) {
  const table = {
    structure_recognition: '必须输出结构类型、变量、约束和缺口。',
    interface_scheduling: '必须输出接口清单、权限边界和失败处理。',
    sovereign_compilation: '必须输出文件/测试/版本/交付物/验收锚点。',
  };
  return table[id] || '必须输出证据和边界。';
}

function scoreByFounderKernel(seed, spec, bias = 0) {
  const axisScores = spec.valueAxes.map(axis => {
    const score = stableScore(`${seed}:${axis.id}`, 0.34, 0.98);
    return { ...axis, score, weighted: round(score * axis.weight, 6) };
  });
  const total = clamp(axisScores.reduce((sum, axis) => sum + axis.weighted, 0) + bias, 0, 1);
  return { axisScores, total: round(total, 6) };
}

function buildCityBundle(spec) {
  const citySpec = buildAgentCivilizationSandboxSpec(spec.cityInput);
  return compileAgentCivilizationSandbox(citySpec);
}

function buildFounderCityAlignment(spec, cityBundle, decisionKernel) {
  const cabinetDirectives = cityBundle.hierarchy.cabinets.map((cabinet, index) => {
    const seed = `${cabinet.id}:founder-alignment:${decisionKernel.kernelRoot}`;
    const triad = spec.founderTriad[index % spec.founderTriad.length];
    const score = scoreByFounderKernel(seed, spec, cabinet.id === 'product_cabinet' || cabinet.id === 'evidence_court' ? 0.04 : 0);
    const directive = {
      cabinetId: cabinet.id,
      cabinetName: cabinet.name,
      founderTriadAnchor: triad.name,
      founderDirective: directiveForCabinet(cabinet.id),
      usefulOutput: usefulOutputForCabinet(cabinet.id),
      axisScores: score.axisScores,
      founderAlignmentScore: score.total,
      mustReportBackToFounderTwin: true,
      directiveRoot: null,
    };
    return { ...directive, directiveRoot: sha256({ ...directive, directiveRoot: undefined }) };
  });

  const workloadReordered = cityBundle.workload.workPackages.map(workload => {
    const focusBias = workload.focus.includes('founder') ? 0.09 : workload.focus.includes('aether') ? 0.055 : workload.focus.includes('real_patch') ? 0.045 : 0;
    const score = scoreByFounderKernel(`${workload.id}:founder-workload`, spec, focusBias);
    return {
      workloadId: workload.id,
      focus: workload.focus,
      previousExpectedWorkReduction: workload.expectedWorkReduction,
      usefulFileTarget: workload.usefulFileTarget,
      founderUtilityScore: score.total,
      axisScores: score.axisScores,
      decision: score.total >= 0.72 ? 'promote_now' : score.total >= 0.62 ? 'keep_in_backlog' : 'defer_or_merge',
      founderQuestionAnswered: '这是否真的减少杜衡界的判断、开发、整理或交付成本？',
    };
  }).sort((a, b) => b.founderUtilityScore - a.founderUtilityScore);

  const averageAlignment = round(cabinetDirectives.reduce((sum, item) => sum + item.founderAlignmentScore, 0) / cabinetDirectives.length, 6);
  const topWorkload = workloadReordered[0];
  return {
    format: RCL_FOUNDER_CITY_ALIGNMENT_FORMAT,
    cabinetDirectiveCount: cabinetDirectives.length,
    cabinetDirectives,
    workloadReordered,
    topFounderWorkload: topWorkload,
    averageFounderAlignment: averageAlignment,
    alignmentRoot: sha256({ directives: cabinetDirectives.map(d => d.directiveRoot), workloads: workloadReordered.map(w => `${w.workloadId}:${w.founderUtilityScore}`) }),
  };
}

function directiveForCabinet(id) {
  const table = {
    engineering_cabinet: '不要只写方案；把最高价值分支压成最小可运行模块、测试和 CLI。',
    quality_cabinet: '先制造失败，再写通过；每个功能必须有回归门和坏输入。',
    evidence_court: '所有输出区分沙箱证据与真实源码变更，禁止虚假成功。',
    product_cabinet: '先判断对杜衡界是否有用；无用功能不进入主线。',
    safety_cabinet: '保留人类授权、回滚、无网络、无远程写入边界。',
    research_academy: '探索未知结构，但每个未知必须绑定廉价验证实验。',
    release_cabinet: '每轮交付必须有 zip、报告、工作法、下一步提示和可复验命令。',
  };
  return table[id] || '产出一个能减少创始人工作量的文件。';
}

function usefulOutputForCabinet(id) {
  const table = {
    engineering_cabinet: 'rcl-founder-gated-patch-plan.md',
    quality_cabinet: 'founder-regression-gates.md',
    evidence_court: 'founder-evidence-court-ledger.md',
    product_cabinet: 'founder-utility-roadmap.md',
    safety_cabinet: 'founder-authority-boundary.md',
    research_academy: 'founder-unknown-structure-lab.md',
    release_cabinet: 'founder-release-handoff.md',
  };
  return table[id] || 'founder-useful-output.md';
}

function buildFounderAccelerationLedger(spec, cityBundle, alignment) {
  const baseAccelerationFactor = cityBundle.result.accelerationFactor;
  const founderDecisionCompressionRatio = round(clamp((alignment.averageFounderAlignment * 0.58) + 0.24, 0, 0.93), 6);
  const branchPruningRatio = round(clamp(alignment.workloadReordered.filter(w => w.decision === 'defer_or_merge').length / alignment.workloadReordered.length, 0, 1), 6);
  const promotedByFounder = alignment.workloadReordered.filter(w => w.decision === 'promote_now');
  const usefulOutputCoverage = round(clamp(alignment.cabinetDirectiveCount / 7, 0, 1), 6);
  const founderMultiplier = round(1 + (founderDecisionCompressionRatio * 0.72) + (usefulOutputCoverage * 0.31) + (branchPruningRatio * 0.18), 6);
  const founderAlignedAccelerationFactor = Math.max(baseAccelerationFactor + 1, Math.round(baseAccelerationFactor * founderMultiplier));
  const modelWorkReductionEstimate = round(clamp(1 - (1 - cityBundle.result.communicationReductionRatio) * (1 - founderDecisionCompressionRatio), 0, 0.999), 6);
  return {
    format: RCL_FOUNDER_ACCELERATION_LEDGER_FORMAT,
    interpretation: 'Planning and decision acceleration only; this does not alter real time and does not replace tests or real execution.',
    baseCityAccelerationFactor: baseAccelerationFactor,
    founderDecisionCompressionRatio,
    branchPruningRatio,
    usefulOutputCoverage,
    founderMultiplier,
    founderAlignedAccelerationFactor,
    modelWorkReductionEstimate,
    promotedFounderWorkloads: promotedByFounder.map(w => ({ workloadId: w.workloadId, score: w.founderUtilityScore, file: w.usefulFileTarget })),
    removedDecisionLoops: [
      '反复解释我是谁/我要什么',
      '反复判断哪个分支对我有用',
      '反复整理版本和证据边界',
      '反复把高维概念压成工程任务',
      '反复生成下一步提示词和验收锚点',
    ],
    accelerationRoot: sha256({ baseAccelerationFactor, founderDecisionCompressionRatio, branchPruningRatio, founderAlignedAccelerationFactor }),
  };
}

function buildFounderTwinVerdict(spec, cityBundle, decisionKernel, alignment, acceleration) {
  const next = acceleration.promotedFounderWorkloads[0] || alignment.topFounderWorkload;
  const vetoes = [];
  if (!spec.policies.founderTwinIsSimulationOnly) vetoes.push('Founder Twin must remain a simulation, not a real-person replacement.');
  if (!spec.policies.humanFinalAuthorityKept) vetoes.push('Human final authority must be kept.');
  if (!spec.policies.noRemoteMutation) vetoes.push('Remote mutation is forbidden by default.');
  if (!spec.policies.evidenceBoundaryRequired) vetoes.push('Evidence boundary is required.');
  return {
    id: 'rcl_founder_twin_verdict_v083',
    passed: vetoes.length === 0 && alignment.averageFounderAlignment >= 0.62,
    founderUtilityVerdict: 'Founder Twin should gate the Agent City before any large RCL/RNCS/Aether Forge Pocket task is executed.',
    topPriority: next?.workloadId || 'founder_decision_compression',
    topUsefulFile: next?.file || next?.usefulFileTarget || 'founder-utility-roadmap.md',
    nextRecommendedRelease: spec.nextHandoff,
    cityTopBranchBeforeFounder: cityBundle.result.topAcceleratedBranch,
    cityTopBranchAfterFounder: 'v0.84_founder_gated_real_patch_apply_loop',
    founderTriadLoop: decisionKernel.decisionLoop,
    vetoes,
    humanFinalAuthorityKept: spec.policies.humanFinalAuthorityKept === true,
    canReplaceUserCompletely: false,
    canReplaceOuterModelCompletely: false,
    verdictRoot: sha256({ next, vetoes, after: 'v0.84_founder_gated_real_patch_apply_loop' }),
  };
}

function buildEvidence(spec, cityBundle, nineCoreMirror, decisionKernel, alignment, acceleration, verdict) {
  const records = [
    ['spec', { version: spec.version, missionId: spec.missionId, founder: spec.founder.primaryName }],
    ['base_agent_city', { canonicalRoot: cityBundle.result.canonicalRoot, bundleRoot: cityBundle.bundleRoot }],
    ['founder_nine_core_mirror', { root: nineCoreMirror.nineCoreRoot, cores: nineCoreMirror.coreCount }],
    ['decision_kernel', { root: decisionKernel.kernelRoot, triad: decisionKernel.triad.map(t => t.id) }],
    ['city_alignment', { root: alignment.alignmentRoot, average: alignment.averageFounderAlignment }],
    ['acceleration_ledger', { root: acceleration.accelerationRoot, factor: acceleration.founderAlignedAccelerationFactor }],
    ['verdict', { root: verdict.verdictRoot, passed: verdict.passed }],
  ].map(([kind, payload], index) => ({
    format: RCL_FOUNDER_TWIN_EVIDENCE_FORMAT,
    sequence: index + 1,
    kind,
    hash: sha256(payload),
    boundary: 'deterministic Founder Twin sandbox evidence; not a claim that the real user was copied or replaced',
  }));
  return {
    id: 'rcl_founder_twin_evidence_ledger_v083',
    recordCount: records.length,
    records,
    canonicalRoot: sha256(records.map(r => `${r.sequence}:${r.kind}:${r.hash}`).join('\n')),
  };
}

export function compileFounderTwinAgentCityAccelerator(input = {}) {
  const spec = buildFounderTwinAgentCityAcceleratorSpec(input);
  const cityBundle = buildCityBundle(spec);
  const nineCoreMirror = buildNineCoreMirror(spec);
  const decisionKernel = buildDecisionKernel(spec, nineCoreMirror);
  const alignment = buildFounderCityAlignment(spec, cityBundle, decisionKernel);
  const acceleration = buildFounderAccelerationLedger(spec, cityBundle, alignment);
  const verdict = buildFounderTwinVerdict(spec, cityBundle, decisionKernel, alignment, acceleration);
  const evidenceLedger = buildEvidence(spec, cityBundle, nineCoreMirror, decisionKernel, alignment, acceleration, verdict);
  const result = {
    format: RCL_FOUNDER_TWIN_AGENT_CITY_ACCELERATOR_RESULT_FORMAT,
    version: RCL_FOUNDER_TWIN_AGENT_CITY_ACCELERATOR_VERSION,
    ok: verdict.passed,
    missionId: spec.missionId,
    founderTwinEstablished: true,
    founderIdentityMode: spec.founder.simulationMode,
    founderPrimaryName: spec.founder.primaryName,
    founderLegalName: spec.founder.legalName,
    coreTriadEnabled: true,
    triadCount: spec.founderTriad.length,
    nineCoreMirrorCount: nineCoreMirror.coreCount,
    founderFewShotSamples: nineCoreMirror.totalFewShotSamples,
    valueAxisCount: spec.valueAxes.length,
    cityCabinetCount: cityBundle.result.cabinetCount,
    cityDepartmentCount: cityBundle.result.departmentCount,
    cityRoleCellCount: cityBundle.result.roleCellCount,
    cityProjectedWorkerEquivalent: cityBundle.result.projectedWorkerEquivalent,
    baseCityAccelerationFactor: acceleration.baseCityAccelerationFactor,
    founderDecisionCompressionRatio: acceleration.founderDecisionCompressionRatio,
    founderAlignedAccelerationFactor: acceleration.founderAlignedAccelerationFactor,
    modelWorkReductionEstimate: acceleration.modelWorkReductionEstimate,
    averageFounderAlignment: alignment.averageFounderAlignment,
    promotedFounderWorkloadCount: acceleration.promotedFounderWorkloads.length,
    topFounderPriority: verdict.topPriority,
    topUsefulFile: verdict.topUsefulFile,
    cityTopBranchBeforeFounder: verdict.cityTopBranchBeforeFounder,
    cityTopBranchAfterFounder: verdict.cityTopBranchAfterFounder,
    evidenceRecordCount: evidenceLedger.recordCount,
    canonicalRoot: evidenceLedger.canonicalRoot,
    noNetwork: spec.policies.noNetwork === true,
    noRemoteMutation: spec.policies.noRemoteMutation === true,
    noRealWorldActionByDefault: spec.policies.noRealWorldActionByDefault === true,
    founderTwinIsSimulationOnly: spec.policies.founderTwinIsSimulationOnly === true,
    humanFinalAuthorityKept: spec.policies.humanFinalAuthorityKept === true,
    canReplaceUserCompletely: false,
    canReplaceOuterModelCompletely: false,
    nextHandoff: spec.nextHandoff,
  };
  return {
    format: RCL_FOUNDER_TWIN_AGENT_CITY_ACCELERATOR_BUNDLE_FORMAT,
    ok: result.ok,
    spec,
    cityBundle,
    nineCoreMirror,
    decisionKernel,
    alignment,
    acceleration,
    verdict,
    evidenceLedger,
    result,
    bundleRoot: sha256({ spec, cityRoot: cityBundle.bundleRoot, nineCoreRoot: nineCoreMirror.nineCoreRoot, kernelRoot: decisionKernel.kernelRoot, alignmentRoot: alignment.alignmentRoot, accelerationRoot: acceleration.accelerationRoot, canonicalRoot: evidenceLedger.canonicalRoot }),
  };
}

export function runFounderTwinAgentCityAccelerator(input = {}) {
  return compileFounderTwinAgentCityAccelerator(input);
}

export function runFounderTwinAgentCityAcceleratorDemo() {
  return compileFounderTwinAgentCityAccelerator(DEFAULT_FOUNDER_TWIN_AGENT_CITY_ACCELERATOR_SPEC);
}

export function renderFounderTwinAgentCityAcceleratorRcl(input = {}) {
  const spec = buildFounderTwinAgentCityAcceleratorSpec(input);
  return `// FounderTwinAgentCityAcceleratorV083\n// RCL v${RCL_FOUNDER_TWIN_AGENT_CITY_ACCELERATOR_VERSION}\n\nprogram FounderTwinAgentCityAcceleratorV083 {\n  founder \"${spec.founder.primaryName}/${spec.founder.legalName}\"\n  mission \"${spec.mission}\"\n\n  founder_twin {\n    mode \"${spec.founder.simulationMode}\"\n    triad {\n${spec.founderTriad.map(t => `      ${t.rclVerb} \"${t.name}\"`).join('\n')}\n    }\n    nine_core_mirror 9\n    value_axes ${spec.valueAxes.length}\n  }\n\n  city {\n    include AgentCivilizationSandboxV082\n    gate_by founder_twin\n    base_city_rcl <<\"RCL\"\n${renderAgentCivilizationSandboxRcl(spec.cityInput).trim()}\nRCL\n  }\n\n  workflow {\n    OBSERVE_STRUCTURE => SCHEDULE_INTERFACES => COMPILE_SOVEREIGN_ACTION\n    PARA { founder_twin, agent_city, evidence_court, safety_cabinet }\n    RECURSE { city_workloads } UNTIL { founder_utility_aligned && evidence_stable }\n    IF { founder_final_authority_kept } THEN { release_v0_83_founder_twin_agent_city_accelerator }\n    CALL { founder_gated_real_patch_apply_loop } => ${spec.nextHandoff}\n  }\n\n  guard {\n    founder_twin_is_simulation_only true\n    no_network true\n    no_remote_mutation true\n    no_real_world_action_by_default true\n    can_replace_user_completely false\n    can_replace_outer_model_completely false\n  }\n}\n`;
}

export function readFounderTwinAgentCityAcceleratorInput(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return normalizeFounderTwinAgentCityAcceleratorSpec(JSON.parse(raw));
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

function renderFounderProfileMarkdown(bundle) {
  const rows = bundle.nineCoreMirror.cores.map(core => ({
    核心: core.name,
    优先级: core.priority,
    输出契约: core.outputContract,
    使命: core.mission,
  }));
  return `# Founder Twin Profile v0.83\n\n> 这是面向 RCL 沙箱的杜衡界 Founder Twin（创始人孪生智能体）配置，不是真实人格复制。\n\n- 名称：${bundle.spec.founder.primaryName} / ${bundle.spec.founder.legalName}\n- 公司：${bundle.spec.founder.company}\n- 角色：${bundle.spec.founder.role}\n- 模式：${bundle.spec.founder.simulationMode}\n\n## 三元判断结构\n\n${table(bundle.decisionKernel.triad.map(t => ({ 阶段: t.name, RCL动作: t.rclVerb, 问题: t.activationQuestion, 证据要求: t.evidenceDemand })), ['阶段', 'RCL动作', '问题', '证据要求'])}\n\n## 九核镜像\n\n${table(rows, ['核心', '优先级', '输出契约', '使命'])}\n`;
}

function renderDecisionKernelMarkdown(bundle) {
  const rows = bundle.decisionKernel.valueAxes.map(axis => ({
    价值轴: axis.name,
    权重: axis.weight,
  }));
  return `# Founder Decision Kernel v0.83\n\n## 决策循环\n\n\`\`\`text\n${bundle.decisionKernel.decisionLoop.join(' -> ')}\n\`\`\`\n\n## 价值轴\n\n${table(rows, ['价值轴', '权重'])}\n\n## 硬规则\n\n${bundle.decisionKernel.hardRules.map(rule => `- ${rule}`).join('\n')}\n`;
}

function renderAlignmentMarkdown(bundle) {
  const rows = bundle.alignment.cabinetDirectives.map(d => ({
    内阁: d.cabinetName,
    三元锚点: d.founderTriadAnchor,
    对齐分: d.founderAlignmentScore,
    有用输出: d.usefulOutput,
    指令: d.founderDirective,
  }));
  const workloadRows = bundle.alignment.workloadReordered.map(w => ({
    工作包: w.workloadId,
    分数: w.founderUtilityScore,
    决策: w.decision,
    文件: w.usefulFileTarget,
  }));
  return `# Founder-to-City Alignment v0.83\n\n## 内阁指令\n\n${table(rows, ['内阁', '三元锚点', '对齐分', '有用输出', '指令'])}\n\n## Founder Utility 重排工作包\n\n${table(workloadRows, ['工作包', '分数', '决策', '文件'])}\n`;
}

function renderAccelerationMarkdown(bundle) {
  const rows = bundle.acceleration.promotedFounderWorkloads.map(w => ({ 工作包: w.workloadId, 分数: w.score, 文件: w.file }));
  return `# Founder Acceleration Ledger v0.83\n\n- 基础城市加速系数：${bundle.acceleration.baseCityAccelerationFactor}x\n- Founder 决策压缩率：${bundle.acceleration.founderDecisionCompressionRatio}\n- Founder 对齐后加速系数：${bundle.acceleration.founderAlignedAccelerationFactor}x\n- 外层模型工作量减负估计：${bundle.acceleration.modelWorkReductionEstimate}\n\n> 解释：这是规划、分支裁剪、任务压缩意义上的工程加速，不代表现实时间真的变化，也不替代真实测试。\n\n## 被 Founder Twin 推上来的工作包\n\n${table(rows, ['工作包', '分数', '文件'])}\n\n## 被移除的决策循环\n\n${bundle.acceleration.removedDecisionLoops.map(item => `- ${item}`).join('\n')}\n`;
}

function renderVerdictMarkdown(bundle) {
  return `# Founder Twin Verdict v0.83\n\n- 通过：${bundle.verdict.passed}\n- 裁决：${bundle.verdict.founderUtilityVerdict}\n- 最高优先级：${bundle.verdict.topPriority}\n- 最有用文件：${bundle.verdict.topUsefulFile}\n- Founder 前城市最优分支：${bundle.verdict.cityTopBranchBeforeFounder}\n- Founder 后城市最优分支：${bundle.verdict.cityTopBranchAfterFounder}\n- 下一步：${bundle.verdict.nextRecommendedRelease}\n- 人类最终权威保留：${bundle.verdict.humanFinalAuthorityKept}\n- 可完全替代用户本人：${bundle.verdict.canReplaceUserCompletely}\n- 可完全替代外层强模型：${bundle.verdict.canReplaceOuterModelCompletely}\n\n## 边界\n\n${bundle.verdict.vetoes.length ? bundle.verdict.vetoes.map(v => `- ${v}`).join('\n') : '- 无 veto；但 Founder Twin 仍只是证据约束型模拟。'}\n`;
}

function renderEvidenceMarkdown(bundle) {
  const rows = bundle.evidenceLedger.records.map(r => ({
    序号: r.sequence,
    类型: r.kind,
    Hash: r.hash,
    边界: r.boundary,
  }));
  return `# Founder Twin Evidence Ledger v0.83\n\n${table(rows, ['序号', '类型', 'Hash', '边界'])}\n\nCanonical Root:\n\n\`\`\`text\n${bundle.evidenceLedger.canonicalRoot}\n\`\`\`\n`;
}

export function renderFounderTwinWorkMethodMarkdown(input = {}) {
  const bundle = compileFounderTwinAgentCityAccelerator(input);
  return `# RCL Founder Twin Agent City Work Method v0.83\n\n## 用途\n\n以后遇到 RCL / RNCS / Aether Forge Pocket / 帝级以太语言 / 少数据智能体这类高复杂任务时，先调用 **Founder Twin Agent City Accelerator（创始人孪生智能体城市加速器）**。\n\n它解决的是 v0.82 的核心缺口：城市有了，但城市还没有先模拟杜衡界的判断结构。\n\n## 默认流程\n\n\`\`\`text\n杜衡界意图\n→ Founder Twin：结构识别 / 接口调度 / 主权编译\n→ 九核镜像审查\n→ 智能体城市重排工作包\n→ 证据法院审查\n→ Founder Utility 裁决\n→ 外层真实执行\n\`\`\`\n\n## 什么时候必须用\n\n- 任务分支很多，容易越做越散。\n- 需要判断“这到底对杜衡界有没有用”。\n- 需要减少重复解释、重复排序、重复写提示词。\n- 要让智能体城市为 RCL/RNCS/Aether Forge Pocket 产出候选版本。\n\n## 硬边界\n\n- Founder Twin 不是杜衡界本人。\n- 不能完全替代用户裁决。\n- 不能完全替代外层强模型和真实测试。\n- 默认不联网、不远程写入、不执行不可逆动作。\n- 所有结果必须区分沙箱证据和真实工程变更。\n\n## 命令\n\n\`\`\`bash\nnode src/cli.mjs founder-twin-agent-city-demo\nnode src/cli.mjs founder-twin-agent-city-run examples/founder-twin-agent-city/default-founder-twin-agent-city.json output/v0.83/founder-twin-agent-city\nnode src/cli.mjs founder-twin-agent-city-spec output/v0.83/founder-twin-agent-city-spec\n\`\`\`\n\n## 当前默认结果\n\n- Founder Twin：${bundle.result.founderTwinEstablished}\n- 三元结构：${bundle.result.triadCount}\n- 九核镜像：${bundle.result.nineCoreMirrorCount}\n- Founder 少数据样本：${bundle.result.founderFewShotSamples}\n- 城市岗位格：${bundle.result.cityRoleCellCount}\n- 基础城市加速：${bundle.result.baseCityAccelerationFactor}x\n- Founder 决策压缩率：${bundle.result.founderDecisionCompressionRatio}\n- Founder 对齐后加速：${bundle.result.founderAlignedAccelerationFactor}x\n- 最高优先级：${bundle.result.topFounderPriority}\n- 下一步：${bundle.result.nextHandoff}\n\n## 一句话\n\n不要让智能体城市先乱干活；先让 Founder Twin 判断“什么对杜衡界有用”，再让城市围绕这个判断并行产出文件、测试、补丁和证据。\n`;
}

export function writeFounderTwinAgentCityAcceleratorReports(outputDir, input = {}) {
  const bundle = compileFounderTwinAgentCityAccelerator(input);
  const dir = path.resolve(outputDir || 'output/v0.83/founder-twin-agent-city');
  fs.mkdirSync(dir, { recursive: true });
  writeJson(path.join(dir, 'founder-twin-result.json'), bundle.result);
  writeJson(path.join(dir, 'founder-twin-bundle.json'), bundle);
  writeJson(path.join(dir, 'founder-profile.json'), bundle.nineCoreMirror);
  writeJson(path.join(dir, 'decision-kernel.json'), bundle.decisionKernel);
  writeJson(path.join(dir, 'city-alignment.json'), bundle.alignment);
  writeJson(path.join(dir, 'acceleration-ledger.json'), bundle.acceleration);
  writeJson(path.join(dir, 'founder-verdict.json'), bundle.verdict);
  writeJson(path.join(dir, 'evidence-ledger.json'), bundle.evidenceLedger);
  writeText(path.join(dir, 'founder-profile.md'), renderFounderProfileMarkdown(bundle));
  writeText(path.join(dir, 'decision-kernel.md'), renderDecisionKernelMarkdown(bundle));
  writeText(path.join(dir, 'city-alignment.md'), renderAlignmentMarkdown(bundle));
  writeText(path.join(dir, 'acceleration-ledger.md'), renderAccelerationMarkdown(bundle));
  writeText(path.join(dir, 'founder-verdict.md'), renderVerdictMarkdown(bundle));
  writeText(path.join(dir, 'evidence-ledger.md'), renderEvidenceMarkdown(bundle));
  writeText(path.join(dir, 'founder-twin-work-method.md'), renderFounderTwinWorkMethodMarkdown(input));
  writeText(path.join(dir, 'founder-twin-agent-city.rcl'), renderFounderTwinAgentCityAcceleratorRcl(bundle.spec));
  writeText(path.join(dir, 'canonical-root.txt'), bundle.evidenceLedger.canonicalRoot);
  return {
    ok: bundle.ok,
    version: RCL_FOUNDER_TWIN_AGENT_CITY_ACCELERATOR_VERSION,
    outputDir: dir,
    files: fs.readdirSync(dir).sort(),
    result: bundle.result,
  };
}
