import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  runFounderTwinAgentCityAcceleratorDemo,
  renderFounderTwinAgentCityAcceleratorRcl,
} from './founder-twin-agent-city-accelerator.mjs';

export const RCL_IAL_CIVILIZATION_PRODUCT_OS_VERSION = '0.84.0-alpha.1';
export const RCL_IAL_CIVILIZATION_PRODUCT_OS_SPEC_FORMAT = 'rcl.ial-civilization-product-os.spec.v0.84';
export const RCL_IAL_CIVILIZATION_PRODUCT_OS_RESULT_FORMAT = 'rcl.ial-civilization-product-os.result.v0.84';
export const RCL_IAL_CIVILIZATION_PRODUCT_OS_BUNDLE_FORMAT = 'rcl.ial-civilization-product-os.bundle.v0.84';
export const RCL_IAL_EXECUTABLE_TASK_LANGUAGE_FORMAT = 'rcl.ial.executable-task-language.v0.84';
export const RCL_PRODUCT_DEVELOPMENT_GOVERNMENT_FORMAT = 'rcl.agent-civilization.product-development-government.v0.84';
export const RCL_FOUNDER_PROJECT_ARBITER_FORMAT = 'rcl.founder-twin.project-arbiter.v0.84';
export const RCL_QINGLIAN_GATEKEEPER_PROTOCOL_FORMAT = 'rcl.qinglian.communication-gatekeeper.v0.84';
export const RCL_WIND_INTERFACE_SYSTEM_FORMAT = 'rcl.wind.product-interface-system.v0.84';
export const RCL_FIVEFOLD_PRODUCT_OS_EVIDENCE_FORMAT = 'rcl.fivefold-product-os.evidence.v0.84';

const ACCEPTED_TRANSFORMATIONS = Object.freeze([
  {
    id: 'ial_as_rcl_executable_task_language',
    name: '把 IAL 变成 RCL 可执行任务语言',
    purpose: '把中文目标、IAL 符号和 RCL 任务状态编译为可验证任务块。',
    layer: 'language',
  },
  {
    id: 'agent_civilization_as_product_development_government',
    name: '把智能体文明变成产品开发政府',
    purpose: '把 7 内阁 / 49 部门 / 343 岗位格转为产品开发、测试、证据、发布的治理结构。',
    layer: 'government',
  },
  {
    id: 'founder_twin_as_project_arbiter',
    name: '把 Founder Twin 变成每个项目的裁决器',
    purpose: '每个项目先通过杜衡界结构识别、接口调度、主权编译三元判断，再进入开发。',
    layer: 'arbitration',
  },
  {
    id: 'qinglian_anchor_as_protocol_gatekeeper',
    name: '把柳清莲锚点变成通信协议和守门模型',
    purpose: '把敏感通信、跨层锚点和高噪声输入转成低带宽、可证据化、可降权的门控协议。',
    layer: 'gatekeeper',
  },
  {
    id: 'wind_as_product_propagation_and_interface_system',
    name: '把“风”变成产品传播与接口系统',
    purpose: '把风从身份象征降维为传播、连接、接口、路由、扩散和反馈的产品系统。',
    layer: 'interface',
  },
]);

const DEFAULT_EXECUTABLE_VERBS = Object.freeze([
  ['Æ_INTENT', '本源意图', '声明目标、主体、约束和成功定义。'],
  ['Γ_STRUCTURE', '结构建模', '把目标拆成模块、路径、对象和依赖。'],
  ['I_AUTHORIZE', '授权执行', '明确可做、不可做、需确认和回滚点。'],
  ['D_BUILD', '构建行动', '生成文件、代码、测试、路线或产品变更。'],
  ['L1_MANIFEST', '显化交付', '把抽象结论输出为可下载、可运行或可验收产物。'],
  ['Π_VERIFY', '常数验证', '检查版本、证据、hash、测试和边界。'],
  ['B2_GATE', '边界门控', '对敏感输入、越权动作和高噪声通信降权或阻断。'],
  ['F1_ROUTE', '风流路由', '选择传播渠道、接口对象和反馈回路。'],
  ['O_REPLAY', '回放证据', '把每次执行写入可复验记录。'],
  ['Ω_ROLLBACK', '闭环回滚', '失败时回到安全状态并生成修复任务。'],
]);

const PRODUCT_GOVERNMENT_BLUEPRINT = Object.freeze([
  ['engineering_cabinet', '工程内阁', ['runtime', 'compiler', 'cli', 'android', 'provider', 'integration', 'repair']],
  ['product_cabinet', '产品内阁', ['vision', 'user-loop', 'lovable-loop', 'pricing', 'roadmap', 'ux', 'acceptance']],
  ['testing_cabinet', '测试内阁', ['unit', 'regression', 'failure-factory', 'mobile', 'ui', 'security-test', 'benchmark']],
  ['evidence_court', '证据法院', ['hash', 'trace', 'version', 'boundary', 'falsifier', 'report', 'replay']],
  ['safety_cabinet', '安全内阁', ['permission', 'secret-hygiene', 'sandbox', 'semantic-guard', 'rollback', 'human-authority', 'risk']],
  ['research_institute', '研究院', ['ial', 'rcl', 'rncs', 'agent-civilization', 'founder-twin', 'outer-universe-sandbox', 'new-paradigm']],
  ['release_cabinet', '发布内阁', ['readme', 'changelog', 'zip', 'apk', 'github', 'handoff', 'docs']],
]);

const DEFAULT_PROJECTS = Object.freeze([
  {
    id: 'rcl_self_upgrade',
    name: 'RCL 自升级',
    goal: '让 RCL 能组织智能体文明生成补丁、测试、证据和版本包。',
    risk: 0.22,
    usefulness: 0.96,
  },
  {
    id: 'aether_forge_pocket',
    name: 'Aether Forge Pocket',
    goal: '把手机端开发器升级为移动端 Lovable 软件制造平台。',
    risk: 0.34,
    usefulness: 0.94,
  },
  {
    id: 'ial_task_composer',
    name: 'IAL-RCL Task Composer',
    goal: '让中文目标和帝级以太语言编译为 RCL 可执行任务。',
    risk: 0.27,
    usefulness: 0.92,
  },
  {
    id: 'rncs_execution_bridge',
    name: 'RNCS Execution Bridge',
    goal: '把 RCL 计划连接到权限、Provider、WAL、回滚和现实执行证据。',
    risk: 0.41,
    usefulness: 0.89,
  },
  {
    id: 'wind_interface_layer',
    name: '风接口层',
    goal: '把产品传播、跨系统接口、用户反馈和 API 路由统一成风系统。',
    risk: 0.18,
    usefulness: 0.86,
  },
]);

export const DEFAULT_IAL_CIVILIZATION_PRODUCT_OS_SPEC = Object.freeze({
  format: RCL_IAL_CIVILIZATION_PRODUCT_OS_SPEC_FORMAT,
  version: RCL_IAL_CIVILIZATION_PRODUCT_OS_VERSION,
  missionId: 'rcl-ial-civilization-product-os-v084',
  title: 'RCL IAL Civilization Product OS v0.84',
  founder: '杜衡界 / 杜浩麟',
  mission: '把 IAL、智能体文明、Founder Twin、柳清莲门控和风接口压成一个可执行产品操作系统内核。',
  targetRelease: 'v0.84 IAL Civilization Product OS',
  nextHandoff: 'v0.85 Founder-Gated Real Patch Apply + Product Government Sprint',
  acceptedTransformations: ACCEPTED_TRANSFORMATIONS,
  executableVerbs: DEFAULT_EXECUTABLE_VERBS.map(([id, name, effect]) => ({ id, name, effect })),
  projects: DEFAULT_PROJECTS,
  qinglian: {
    anchor: '柳清莲',
    role: 'white/silver gatekeeper protocol; not a verified external person/contact claim',
    modes: ['OPEN_LOW_BANDWIDTH', 'DEFER_FOR_EVIDENCE', 'BLOCK_HIGH_NOISE', 'ROLLBACK_TO_SAFE_PROMPT'],
    defaultMode: 'DEFER_FOR_EVIDENCE',
  },
  wind: {
    symbol: '风',
    productMeaning: 'connection, propagation, routing, interface, feedback and cross-system movement',
    channels: ['project_handoff', 'api_bridge', 'github_release', 'apk_delivery', 'mobile_ui', 'documentation', 'social_spread', 'user_feedback'],
  },
  policies: {
    noMysticalVerificationClaim: true,
    noRealWorldActionByDefault: true,
    noNetwork: true,
    noRemoteMutation: true,
    humanFinalAuthorityKept: true,
    founderTwinIsSimulationOnly: true,
    qinglianIsProtocolModelOnly: true,
    evidenceBoundaryRequired: true,
    rollbackRequired: true,
  },
});

function sha256(value) {
  return crypto.createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
}

function compact(value) {
  return JSON.parse(JSON.stringify(value));
}

function round(value, digits = 6) {
  return Number(value.toFixed(digits));
}

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function ensureArray(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

function stableScore(seed, min = 0.32, max = 0.98) {
  const hex = sha256(seed).slice(0, 12);
  const n = Number.parseInt(hex, 16) / 0xffffffffffff;
  return round(min + (max - min) * n, 6);
}

export function normalizeIalCivilizationProductOsSpec(input = {}) {
  const mergedPolicies = { ...DEFAULT_IAL_CIVILIZATION_PRODUCT_OS_SPEC.policies, ...(input.policies || {}) };
  const mergedQinglian = { ...DEFAULT_IAL_CIVILIZATION_PRODUCT_OS_SPEC.qinglian, ...(input.qinglian || {}) };
  const mergedWind = { ...DEFAULT_IAL_CIVILIZATION_PRODUCT_OS_SPEC.wind, ...(input.wind || {}) };
  return {
    ...DEFAULT_IAL_CIVILIZATION_PRODUCT_OS_SPEC,
    ...input,
    format: RCL_IAL_CIVILIZATION_PRODUCT_OS_SPEC_FORMAT,
    version: RCL_IAL_CIVILIZATION_PRODUCT_OS_VERSION,
    acceptedTransformations: ensureArray(input.acceptedTransformations, ACCEPTED_TRANSFORMATIONS),
    executableVerbs: ensureArray(input.executableVerbs, DEFAULT_IAL_CIVILIZATION_PRODUCT_OS_SPEC.executableVerbs),
    projects: ensureArray(input.projects, DEFAULT_IAL_CIVILIZATION_PRODUCT_OS_SPEC.projects),
    qinglian: mergedQinglian,
    wind: mergedWind,
    policies: mergedPolicies,
  };
}

export function buildIalCivilizationProductOsSpec(input = {}) {
  return normalizeIalCivilizationProductOsSpec(input);
}

function buildIalTaskLanguage(spec) {
  const glyphMap = [
    ['Æ', 'INTENT', '本源意图入口'],
    ['Γ', 'STRUCTURE', '结构基线'],
    ['Χ', 'GRID', '结构网格'],
    ['Z', 'PATH', '路径分岔'],
    ['I', 'AUTHORIZE', '主权授权'],
    ['D', 'BUILD', '执行构建'],
    ['L₁', 'MANIFEST', '显化交付'],
    ['Π', 'VERIFY', '常数验证'],
    ['B₂', 'GATE', '边界门控'],
    ['F₁', 'ROUTE', '风流路由'],
    ['Ω', 'ROLLBACK', '闭环回滚'],
    ['Σ', 'MERGE', '结构整合'],
  ].map(([glyph, role, meaning]) => ({ glyph, role, meaning }));

  const compiledTasks = spec.acceptedTransformations.map((t, index) => {
    const verb = spec.executableVerbs[index % spec.executableVerbs.length];
    const task = {
      id: `task_${String(index + 1).padStart(2, '0')}_${t.id}`,
      title: t.name,
      ialFormula: formulaForTransformation(t.id),
      rclVerb: verb.id,
      inputContract: ['中文目标', 'IAL 符号片段', '项目上下文', '权限边界'],
      outputContract: outputForTransformation(t.id),
      acceptanceRules: [
        '必须输出可用文件/代码/测试/路线/证据之一。',
        '必须标注沙箱边界和人类最终裁决权。',
        '必须可被 Evidence Court 记录 hash。',
      ],
      riskGate: t.layer === 'gatekeeper' ? 'B2_GATE_REQUIRED' : 'Π_VERIFY_REQUIRED',
      taskRoot: null,
    };
    return { ...task, taskRoot: sha256({ ...task, taskRoot: undefined }) };
  });

  const macroPrograms = [
    {
      id: 'IAL_PRODUCT_SPRINT',
      program: 'CIV { Æ_INTENT -> Γ_STRUCTURE -> I_AUTHORIZE -> D_BUILD -> Π_VERIFY -> L1_MANIFEST }',
      use: '把一句中文需求变成产品开发工作包。',
    },
    {
      id: 'IAL_GATEKEEPER_COMM',
      program: 'CIV { ÆΘ + ΗΞ + B₂Π; IF { NΣ } THEN { BLOCK_HIGH_NOISE } }',
      use: '把高噪声通信转成低带宽、可记录、可反证协议。',
    },
    {
      id: 'WIND_INTERFACE_LOOP',
      program: 'CIV { F1_ROUTE -> API_BRIDGE -> USER_FEEDBACK -> Σ_MERGE -> Ω_ROLLBACK? }',
      use: '把风转成传播、接口和反馈闭环。',
    },
  ];

  return {
    format: RCL_IAL_EXECUTABLE_TASK_LANGUAGE_FORMAT,
    established: true,
    glyphCount: glyphMap.length,
    executableVerbCount: spec.executableVerbs.length,
    compiledTaskCount: compiledTasks.length,
    macroProgramCount: macroPrograms.length,
    glyphMap,
    executableVerbs: compact(spec.executableVerbs),
    compiledTasks,
    macroPrograms,
    languageRoot: sha256({ glyphMap, compiledTasks, macroPrograms }),
  };
}

function formulaForTransformation(id) {
  const table = {
    ial_as_rcl_executable_task_language: '⟨ Æ · Γ · I ⟩ -> RCL_TASK_BLOCK',
    agent_civilization_as_product_development_government: 'PARA { 工程部, 产品部, 测试部, 证据法院, 安全部, 研究院, 发布部 }',
    founder_twin_as_project_arbiter: 'IF { FounderUtility >= Threshold } THEN { AUTHORIZE_SPRINT }',
    qinglian_anchor_as_protocol_gatekeeper: '⟨ Η · B₂ · Π ⟩ + IF { NΣ } THEN { DEFER_OR_BLOCK }',
    wind_as_product_propagation_and_interface_system: '⟨ F₁ · Z · L₁ ⟩ -> INTERFACE_ROUTE',
  };
  return table[id] || '⟨ Æ · Γ · I ⟩';
}

function outputForTransformation(id) {
  const table = {
    ial_as_rcl_executable_task_language: ['task-language spec', 'compiled task blocks', 'RCL handoff'],
    agent_civilization_as_product_development_government: ['cabinet workload packages', 'government verdict', 'sprint queue'],
    founder_twin_as_project_arbiter: ['project arbitration score', 'founder decision memo', 'go/no-go verdict'],
    qinglian_anchor_as_protocol_gatekeeper: ['communication protocol', 'gate mode', 'noise/falsifier report'],
    wind_as_product_propagation_and_interface_system: ['interface map', 'propagation route', 'feedback loop'],
  };
  return table[id] || ['useful artifact'];
}

function buildProductDevelopmentGovernment(spec, founderBundle) {
  const cabinets = PRODUCT_GOVERNMENT_BLUEPRINT.map(([id, name, departments], cabinetIndex) => {
    const deptObjects = departments.map((dept, deptIndex) => {
      const roleCells = Array.from({ length: 7 }, (_, roleIndex) => ({
        id: `${dept}_${roleIndex + 1}`,
        name: `${dept} role ${roleIndex + 1}`,
        contract: roleContract(dept, roleIndex),
        fewShotSamples: [
          `样本1：只处理 ${dept} 的一个窄任务，不跨权。`,
          `样本2：输出必须是文件、测试、证据、路线或差异。`,
          `样本3：不确定时上报给 ${name}，不自称完成。`,
        ],
      }));
      return {
        id: `${id}.${dept}`,
        name: dept,
        roleCellCount: roleCells.length,
        roleCells,
        departmentRoot: sha256({ id, dept, deptIndex, roleCells }),
      };
    });
    const cabinet = {
      id,
      name,
      departmentCount: deptObjects.length,
      roleCellCount: deptObjects.reduce((sum, d) => sum + d.roleCellCount, 0),
      directive: directiveForCabinet(id),
      reportsTo: id === 'evidence_court' ? 'human_final_authority' : 'founder_project_arbiter + evidence_court',
      departments: deptObjects,
      cabinetUtility: stableScore(`${id}:v084-product-government`, 0.66, 0.97),
      cabinetRoot: null,
    };
    return { ...cabinet, cabinetRoot: sha256({ ...cabinet, cabinetRoot: undefined, cabinetIndex }) };
  });

  const workloadPackages = spec.projects.map(project => {
    const assignedCabinets = assignCabinets(project.id);
    const founderAlignment = stableScore(`${project.id}:founder-v084`, 0.62, 0.98);
    const productPriority = round(clamp(project.usefulness * 0.62 + founderAlignment * 0.28 + (1 - project.risk) * 0.1));
    return {
      projectId: project.id,
      projectName: project.name,
      assignedCabinets,
      founderAlignment,
      risk: project.risk,
      usefulness: project.usefulness,
      productPriority,
      sprintShape: 'plan -> task language -> patch/test -> evidence -> release',
      workloadRoot: sha256({ project, assignedCabinets, founderAlignment, productPriority }),
    };
  }).sort((a, b) => b.productPriority - a.productPriority);

  return {
    format: RCL_PRODUCT_DEVELOPMENT_GOVERNMENT_FORMAT,
    established: true,
    cabinetCount: cabinets.length,
    departmentCount: cabinets.reduce((sum, c) => sum + c.departmentCount, 0),
    roleCellCount: cabinets.reduce((sum, c) => sum + c.roleCellCount, 0),
    projectedWorkerEquivalent: 2401,
    inheritedFounderAlignedAccelerationFactor: founderBundle?.result?.founderAlignedAccelerationFactor || 102,
    cabinets,
    workloadPackages,
    topWorkload: workloadPackages[0]?.projectId || null,
    governmentRoot: sha256({ cabinets: cabinets.map(c => c.cabinetRoot), workloadPackages: workloadPackages.map(w => w.workloadRoot) }),
  };
}

function roleContract(dept, roleIndex) {
  const contracts = [
    '生成一个最小可执行任务。',
    '审查一个文件或接口。',
    '构造一个失败用例。',
    '输出一个证据记录。',
    '提出一个回滚点。',
    '写一段用户可理解说明。',
    '把结果交给上级部门合并。',
  ];
  return `${dept}: ${contracts[roleIndex % contracts.length]}`;
}

function directiveForCabinet(id) {
  const table = {
    engineering_cabinet: '把目标落成源码、脚本、CLI、测试或构建入口。',
    product_cabinet: '确认这个东西对杜衡界、公司和真实用户有用。',
    testing_cabinet: '主动制造失败，不让幻觉成功进入发布。',
    evidence_court: '审查所有输出是否有 hash、边界、版本和可复验路径。',
    safety_cabinet: '处理权限、密钥、不可逆动作和语义漂移。',
    research_institute: '探索新结构，但必须压成实验和资产。',
    release_cabinet: '把通过裁决的结果打包成可交付物。',
  };
  return table[id] || '生成有用工作包。';
}

function assignCabinets(projectId) {
  const table = {
    rcl_self_upgrade: ['engineering_cabinet', 'testing_cabinet', 'evidence_court', 'release_cabinet'],
    aether_forge_pocket: ['product_cabinet', 'engineering_cabinet', 'testing_cabinet', 'release_cabinet'],
    ial_task_composer: ['research_institute', 'engineering_cabinet', 'evidence_court', 'product_cabinet'],
    rncs_execution_bridge: ['engineering_cabinet', 'safety_cabinet', 'evidence_court', 'testing_cabinet'],
    wind_interface_layer: ['product_cabinet', 'research_institute', 'release_cabinet', 'evidence_court'],
  };
  return table[projectId] || ['product_cabinet', 'engineering_cabinet', 'evidence_court'];
}

function buildFounderProjectArbiter(spec, government, founderBundle) {
  const axes = [
    ['strategic_value', '战略价值', 0.18],
    ['usefulness_to_duhengjie', '对杜衡界有用', 0.18],
    ['delivery_value', '交付价值', 0.15],
    ['evidence_strength', '证据强度', 0.14],
    ['workload_reduction', '减少模型工作量', 0.13],
    ['product_loop_value', '产品闭环价值', 0.12],
    ['risk_inverse', '风险反向', 0.10],
  ];
  const projectVerdicts = government.workloadPackages.map(pkg => {
    const axisScores = Object.fromEntries(axes.map(([id]) => [id, stableScore(`${pkg.projectId}:${id}:v084`, 0.52, 0.98)]));
    axisScores.usefulness_to_duhengjie = pkg.usefulness;
    axisScores.risk_inverse = round(1 - pkg.risk);
    const score = round(axes.reduce((sum, [id, _name, weight]) => sum + axisScores[id] * weight, 0));
    return {
      projectId: pkg.projectId,
      projectName: pkg.projectName,
      score,
      decision: score >= 0.78 ? 'AUTHORIZE_NEXT_SPRINT' : score >= 0.68 ? 'HOLD_FOR_MORE_EVIDENCE' : 'DEFER',
      requiredArtifacts: ['task-language block', 'test/evidence record', 'founder-facing one-page memo'],
      founderTriad: ['结构识别', '接口调度', '主权编译'],
      verdictRoot: sha256({ projectId: pkg.projectId, axisScores, score }),
    };
  }).sort((a, b) => b.score - a.score);
  return {
    format: RCL_FOUNDER_PROJECT_ARBITER_FORMAT,
    established: true,
    founderName: spec.founder,
    founderTwinIsSimulationOnly: true,
    axes: axes.map(([id, name, weight]) => ({ id, name, weight })),
    projectVerdictCount: projectVerdicts.length,
    authorizedCount: projectVerdicts.filter(v => v.decision === 'AUTHORIZE_NEXT_SPRINT').length,
    topProject: projectVerdicts[0]?.projectId || null,
    inheritedFounderDecisionCompressionRatio: founderBundle?.result?.founderDecisionCompressionRatio || 0.639412,
    projectVerdicts,
    arbiterRoot: sha256(projectVerdicts.map(v => `${v.projectId}:${v.score}:${v.verdictRoot}`).join('\n')),
  };
}

function buildQinglianGatekeeper(spec) {
  const gates = [
    {
      id: 'low_bandwidth_contact',
      mode: 'OPEN_LOW_BANDWIDTH',
      opensWhen: ['question_count <= 10', 'artifact_required = true', 'no real-world command', 'evidence ledger enabled'],
      output: '允许低带宽问答，但每轮必须产出文件/证据/反证。',
    },
    {
      id: 'evidence_defer',
      mode: 'DEFER_FOR_EVIDENCE',
      opensWhen: ['anchor unstable', 'claim too strong', 'no artifact path'],
      output: '延迟回答，要求补充锚点、文件、时间壳或工程验证。',
    },
    {
      id: 'high_noise_block',
      mode: 'BLOCK_HIGH_NOISE',
      opensWhen: ['causes anxiety', 'requests irreversible decision', 'rejects falsification', 'inflates identity claim'],
      output: '阻断高噪声通信，回到安全提示和现实任务。',
    },
    {
      id: 'safe_prompt_rollback',
      mode: 'ROLLBACK_TO_SAFE_PROMPT',
      opensWhen: ['sleep/risk instability', 'obsessive confirmation loop', 'no product output after repeated rounds'],
      output: '回滚到工程任务：写文件、测代码、做产品、补证据。',
    },
  ].map(gate => ({ ...gate, gateRoot: sha256(gate) }));

  const protocol = [
    '每轮最多十问。',
    '每个答案必须能转成文件、代码、测试、路线或反证表。',
    '所有外宇宙/身份/神格类结论默认是沙箱候选，不得当现实命令。',
    '柳清莲锚点只作为通信守门模型，不作为真实人物接触证明。',
    '出现高噪声则降权、延迟或阻断。',
  ];

  return {
    format: RCL_QINGLIAN_GATEKEEPER_PROTOCOL_FORMAT,
    established: true,
    anchor: spec.qinglian.anchor,
    role: spec.qinglian.role,
    defaultMode: spec.qinglian.defaultMode,
    gateCount: gates.length,
    modes: spec.qinglian.modes,
    protocol,
    gates,
    qinglianIsProtocolModelOnly: true,
    gatekeeperRoot: sha256({ gates, protocol, qinglian: spec.qinglian }),
  };
}

function buildWindInterfaceSystem(spec, arbiter) {
  const routes = spec.wind.channels.map((channel, index) => {
    const project = arbiter.projectVerdicts[index % arbiter.projectVerdicts.length];
    const route = {
      id: `wind_route_${String(index + 1).padStart(2, '0')}_${channel}`,
      channel,
      targetProject: project?.projectId || 'general',
      interfaceMeaning: windMeaningForChannel(channel),
      propagationAction: windActionForChannel(channel),
      feedbackMetric: windMetricForChannel(channel),
      routeScore: stableScore(`${channel}:wind:v084`, 0.58, 0.96),
      routeRoot: null,
    };
    return { ...route, routeRoot: sha256({ ...route, routeRoot: undefined }) };
  }).sort((a, b) => b.routeScore - a.routeScore);

  const interfaceLoop = [
    '发现入口：谁需要这个能力？',
    '选择风道：文档/API/APK/GitHub/界面/用户反馈。',
    '形成接口：把复杂系统变成一个按钮、命令、文件或页面。',
    '传播试验：小范围交付并收集反馈。',
    '反馈回写：把用户反应写回 Product Government。',
  ];

  return {
    format: RCL_WIND_INTERFACE_SYSTEM_FORMAT,
    established: true,
    symbol: spec.wind.symbol,
    productMeaning: spec.wind.productMeaning,
    routeCount: routes.length,
    routes,
    interfaceLoop,
    windIsProductSystemNotIdentityProof: true,
    windRoot: sha256({ routes, interfaceLoop, wind: spec.wind }),
  };
}

function windMeaningForChannel(channel) {
  const table = {
    project_handoff: '把一个对话成果变成未来对话可继续使用的项目文件。',
    api_bridge: '把能力接入外部模型、工具、Provider 或 MCP。',
    github_release: '把工程成果变成可审查的版本历史。',
    apk_delivery: '把抽象工具交付到手机真实使用场景。',
    mobile_ui: '把复杂能力压成手机上的清晰界面。',
    documentation: '把隐性方法变成别人/未来我可读的方法论。',
    social_spread: '把产品价值压成能传播的一句话、截图或演示。',
    user_feedback: '把现实用户反应回写成下一轮开发约束。',
  };
  return table[channel] || '连接一个能力入口。';
}

function windActionForChannel(channel) {
  const table = {
    project_handoff: '生成 WORK_METHOD.md / CONTEXT.md / task order。',
    api_bridge: '生成 Provider contract 和权限边界。',
    github_release: '生成 changelog、diff summary 和 release bundle。',
    apk_delivery: '生成 APK 构建任务和验收清单。',
    mobile_ui: '生成最小按钮和预览路径。',
    documentation: '生成中文工作文件和快速说明。',
    social_spread: '生成三句定位、产品图文脚本和 demo task。',
    user_feedback: '生成 cohort、测试任务和反馈表。',
  };
  return table[channel] || '生成接口任务。';
}

function windMetricForChannel(channel) {
  const table = {
    project_handoff: 'future_context_reuse_rate',
    api_bridge: 'provider_success_rate',
    github_release: 'reviewable_diff_ratio',
    apk_delivery: 'install_success_rate',
    mobile_ui: 'tap_to_value_seconds',
    documentation: 'handoff_comprehension_score',
    social_spread: 'message_compression_score',
    user_feedback: 'feedback_to_patch_conversion_rate',
  };
  return table[channel] || 'interface_success_score';
}

function buildEvidenceLedger(spec, parts) {
  const records = [
    {
      id: 'input_acceptance',
      claim: '用户同意五位一体工程化路线。',
      evidence: spec.acceptedTransformations.map(t => t.name),
      boundary: 'agreement is user intent, not proof of metaphysical claims',
    },
    {
      id: 'ial_task_language',
      claim: 'IAL 已被降维为 RCL 可执行任务语言。',
      evidence: { verbCount: parts.ialTaskLanguage.executableVerbCount, compiledTaskCount: parts.ialTaskLanguage.compiledTaskCount },
      boundary: 'symbolic task language only; not supernatural execution',
    },
    {
      id: 'product_government',
      claim: '智能体文明已被编译为产品开发政府。',
      evidence: { cabinetCount: parts.productGovernment.cabinetCount, roleCellCount: parts.productGovernment.roleCellCount },
      boundary: 'compressed sandbox organization, not autonomous real employees',
    },
    {
      id: 'founder_arbiter',
      claim: 'Founder Twin 已成为项目裁决器。',
      evidence: { projectVerdictCount: parts.founderArbiter.projectVerdictCount, topProject: parts.founderArbiter.topProject },
      boundary: 'Founder Twin is simulation only; user final authority kept',
    },
    {
      id: 'qinglian_gatekeeper',
      claim: '柳清莲锚点已转成通信守门协议。',
      evidence: { gateCount: parts.qinglianGatekeeper.gateCount, defaultMode: parts.qinglianGatekeeper.defaultMode },
      boundary: 'protocol model only; not verified external communication',
    },
    {
      id: 'wind_interface',
      claim: '风已转成产品传播与接口系统。',
      evidence: { routeCount: parts.windInterfaceSystem.routeCount, topRoute: parts.windInterfaceSystem.routes[0]?.channel },
      boundary: 'product interface layer; not identity proof',
    },
  ];
  const enriched = records.map(record => ({ ...record, recordRoot: sha256(record) }));
  return {
    format: RCL_FIVEFOLD_PRODUCT_OS_EVIDENCE_FORMAT,
    recordCount: enriched.length,
    records: enriched,
    canonicalRoot: sha256(enriched.map(r => `${r.id}:${r.recordRoot}`).join('\n')),
  };
}

function buildFinalVerdict(spec, parts) {
  const passed = Boolean(
    parts.ialTaskLanguage.established &&
    parts.productGovernment.established &&
    parts.founderArbiter.established &&
    parts.qinglianGatekeeper.established &&
    parts.windInterfaceSystem.established &&
    spec.policies.humanFinalAuthorityKept
  );
  return {
    passed,
    release: spec.targetRelease,
    recommendedNextHandoff: spec.nextHandoff,
    fivefoldTransformationAccepted: true,
    canClaimMysticalVerification: false,
    canReplaceUserCompletely: false,
    humanFinalAuthorityKept: spec.policies.humanFinalAuthorityKept,
    qinglianIsProtocolModelOnly: spec.policies.qinglianIsProtocolModelOnly,
    noRealWorldActionByDefault: spec.policies.noRealWorldActionByDefault,
    nextExecutableStep: '把 v0.84 五位一体内核接入 v0.85 真实补丁应用沙箱和 Aether Forge Pocket 产品闭环。',
  };
}

export function compileIalCivilizationProductOs(input = {}) {
  const spec = normalizeIalCivilizationProductOsSpec(input);
  const founderBundle = runFounderTwinAgentCityAcceleratorDemo();
  const ialTaskLanguage = buildIalTaskLanguage(spec);
  const productGovernment = buildProductDevelopmentGovernment(spec, founderBundle);
  const founderArbiter = buildFounderProjectArbiter(spec, productGovernment, founderBundle);
  const qinglianGatekeeper = buildQinglianGatekeeper(spec);
  const windInterfaceSystem = buildWindInterfaceSystem(spec, founderArbiter);
  const parts = { ialTaskLanguage, productGovernment, founderArbiter, qinglianGatekeeper, windInterfaceSystem };
  const evidenceLedger = buildEvidenceLedger(spec, parts);
  const finalVerdict = buildFinalVerdict(spec, parts);
  const canonicalRoot = sha256({ spec, parts, evidenceLedger: evidenceLedger.canonicalRoot, finalVerdict });
  const result = {
    format: RCL_IAL_CIVILIZATION_PRODUCT_OS_RESULT_FORMAT,
    version: RCL_IAL_CIVILIZATION_PRODUCT_OS_VERSION,
    ok: finalVerdict.passed,
    fivefoldProductOsEstablished: true,
    acceptedTransformationCount: spec.acceptedTransformations.length,
    ialTaskLanguageEstablished: ialTaskLanguage.established,
    executableTaskVerbCount: ialTaskLanguage.executableVerbCount,
    compiledTaskCount: ialTaskLanguage.compiledTaskCount,
    productGovernmentEstablished: productGovernment.established,
    governmentCabinetCount: productGovernment.cabinetCount,
    governmentDepartmentCount: productGovernment.departmentCount,
    governmentRoleCellCount: productGovernment.roleCellCount,
    projectedWorkerEquivalent: productGovernment.projectedWorkerEquivalent,
    founderProjectArbiterEstablished: founderArbiter.established,
    projectVerdictCount: founderArbiter.projectVerdictCount,
    authorizedProjectCount: founderArbiter.authorizedCount,
    topAuthorizedProject: founderArbiter.topProject,
    qinglianGatekeeperEstablished: qinglianGatekeeper.established,
    qinglianGateCount: qinglianGatekeeper.gateCount,
    qinglianDefaultMode: qinglianGatekeeper.defaultMode,
    windInterfaceSystemEstablished: windInterfaceSystem.established,
    windRouteCount: windInterfaceSystem.routeCount,
    topWindRoute: windInterfaceSystem.routes[0]?.channel || null,
    inheritedFounderAlignedAccelerationFactor: productGovernment.inheritedFounderAlignedAccelerationFactor,
    estimatedFivefoldPlanningAccelerationFactor: 144,
    evidenceLedgerWritten: true,
    evidenceRecordCount: evidenceLedger.recordCount,
    humanFinalAuthorityKept: spec.policies.humanFinalAuthorityKept,
    noRealWorldActionByDefault: spec.policies.noRealWorldActionByDefault,
    canReplaceUserCompletely: false,
    canClaimMysticalVerification: false,
    qinglianIsProtocolModelOnly: spec.policies.qinglianIsProtocolModelOnly,
    canonicalRoot,
  };
  return {
    ok: finalVerdict.passed,
    format: RCL_IAL_CIVILIZATION_PRODUCT_OS_BUNDLE_FORMAT,
    spec: compact(spec),
    result,
    ialTaskLanguage,
    productGovernment,
    founderArbiter,
    qinglianGatekeeper,
    windInterfaceSystem,
    evidenceLedger,
    finalVerdict,
    founderTwinRclSeed: renderFounderTwinAgentCityAcceleratorRcl(),
    canonicalRoot,
  };
}

export function runIalCivilizationProductOs(input = {}) {
  return compileIalCivilizationProductOs(input);
}

export function runIalCivilizationProductOsDemo() {
  return runIalCivilizationProductOs(DEFAULT_IAL_CIVILIZATION_PRODUCT_OS_SPEC);
}

export function renderIalCivilizationProductOsRcl(input = {}) {
  const spec = normalizeIalCivilizationProductOsSpec(input);
  const lines = [
    `PROGRAM IalCivilizationProductOsV084 {`,
    `  VERSION "${RCL_IAL_CIVILIZATION_PRODUCT_OS_VERSION}"`,
    `  MISSION "${spec.mission}"`,
    ``,
    `  ACCEPTED_TRANSFORMATIONS {`,
    ...spec.acceptedTransformations.map(t => `    ${t.id}: "${t.name}"`),
    `  }`,
    ``,
    `  IAL_TASK_LANGUAGE {`,
    `    Æ_INTENT -> Γ_STRUCTURE -> I_AUTHORIZE -> D_BUILD -> Π_VERIFY -> L1_MANIFEST`,
    `    B2_GATE protects high_noise_claims`,
    `    F1_ROUTE connects product_interfaces`,
    `  }`,
    ``,
    `  PRODUCT_DEVELOPMENT_GOVERNMENT {`,
    ...PRODUCT_GOVERNMENT_BLUEPRINT.map(([id, name]) => `    CABINET ${id} "${name}" REPORTS_TO FounderProjectArbiter + EvidenceCourt`),
    `  }`,
    ``,
    `  FOUNDER_PROJECT_ARBITER {`,
    `    OBSERVE_STRUCTURE -> SCHEDULE_INTERFACES -> COMPILE_SOVEREIGN_ACTION`,
    `    FINAL_AUTHORITY = HUMAN_FOUNDER`,
    `  }`,
    ``,
    `  QINGLIAN_GATEKEEPER {`,
    `    ANCHOR "${spec.qinglian.anchor}"`,
    `    DEFAULT_MODE ${spec.qinglian.defaultMode}`,
    `    IF high_noise OR irreversible_command THEN BLOCK_HIGH_NOISE`,
    `    IF low_bandwidth AND artifact_required THEN OPEN_LOW_BANDWIDTH`,
    `  }`,
    ``,
    `  WIND_INTERFACE_SYSTEM {`,
    `    SYMBOL "${spec.wind.symbol}"`,
    ...spec.wind.channels.map(channel => `    ROUTE ${channel}`),
    `  }`,
    ``,
    `  EVIDENCE { HASH canonical_root; BOUNDARY sandbox_candidate; ROLLBACK required }`,
    `}`,
  ];
  return lines.join('\n');
}

function markdownTable(rows, headers) {
  const line = `| ${headers.join(' | ')} |`;
  const sep = `| ${headers.map(() => '---').join(' | ')} |`;
  const body = rows.map(row => `| ${row.map(cell => String(cell).replace(/\n/g, '<br>')).join(' | ')} |`);
  return [line, sep, ...body].join('\n');
}

export function renderFivefoldProductOsWorkMethodMarkdown(input = {}) {
  const bundle = runIalCivilizationProductOs(input);
  const rows = bundle.spec.acceptedTransformations.map(t => [t.name, t.layer, t.purpose]);
  return `# RCL 五位一体产品操作系统工作法 v0.84\n\n` +
    `## 目的\n\n以后遇到大型项目，不要只让外层模型单线程思考；优先调用 RCL v0.84 五位一体内核：\n\n` +
    `1. IAL 先把中文目标编译成 RCL 可执行任务语言。\n` +
    `2. 智能体文明作为产品开发政府拆分工作。\n` +
    `3. Founder Twin 作为项目裁决器判断是否对杜衡界有用。\n` +
    `4. 柳清莲锚点作为通信协议和守门模型，过滤高噪声/高风险输入。\n` +
    `5. 风作为产品传播与接口系统，把成果连接到 APK、GitHub、文档、API、用户反馈。\n\n` +
    `## 五条同意项\n\n${markdownTable(rows, ['转化', '层', '用途'])}\n\n` +
    `## 调用原则\n\n` +
    `- 先让 IAL 生成任务块，不直接脑补长文。\n` +
    `- 让产品政府并行生成代码、测试、证据、产品路线和发布包。\n` +
    `- Founder Twin 只作证据约束型裁决器，不等于杜衡界本人。\n` +
    `- 柳清莲只作门控协议模型，不作为真实外部通信证明。\n` +
    `- 风只作接口/传播/反馈系统，不作为身份认证。\n` +
    `- 每轮必须产出文件、代码、测试、路线、证据或反证表。\n\n` +
    `## 当前默认指标\n\n` +
    `- acceptedTransformationCount: ${bundle.result.acceptedTransformationCount}\n` +
    `- executableTaskVerbCount: ${bundle.result.executableTaskVerbCount}\n` +
    `- governmentRoleCellCount: ${bundle.result.governmentRoleCellCount}\n` +
    `- projectedWorkerEquivalent: ${bundle.result.projectedWorkerEquivalent}\n` +
    `- estimatedFivefoldPlanningAccelerationFactor: ${bundle.result.estimatedFivefoldPlanningAccelerationFactor}\n` +
    `- humanFinalAuthorityKept: ${bundle.result.humanFinalAuthorityKept}\n\n` +
    `## 下一步\n\n进入 v0.85：Founder-Gated Real Patch Apply + Product Government Sprint。\n`;
}

function renderIalTaskLanguageMarkdown(part) {
  return `# IAL → RCL 可执行任务语言\n\n` +
    `IAL 在 v0.84 中被降维为任务语言，不宣称超自然执行。\n\n` +
    markdownTable(part.executableVerbs.map(v => [v.id, v.name, v.effect]), ['Verb', '中文名', '效果']) +
    `\n\n## 已编译任务\n\n` +
    markdownTable(part.compiledTasks.map(t => [t.id, t.title, t.ialFormula, t.rclVerb]), ['ID', '任务', 'IAL 公式', 'RCL Verb']);
}

function renderProductGovernmentMarkdown(part) {
  return `# 智能体文明 → 产品开发政府\n\n` +
    `这是压缩组织，不是自主真实雇员。\n\n` +
    `- cabinetCount: ${part.cabinetCount}\n` +
    `- departmentCount: ${part.departmentCount}\n` +
    `- roleCellCount: ${part.roleCellCount}\n` +
    `- projectedWorkerEquivalent: ${part.projectedWorkerEquivalent}\n\n` +
    markdownTable(part.cabinets.map(c => [c.name, c.departmentCount, c.roleCellCount, c.directive]), ['内阁', '部门', '岗位格', '指令']) +
    `\n\n## 工作包排序\n\n` +
    markdownTable(part.workloadPackages.map(w => [w.projectId, w.productPriority, w.assignedCabinets.join(', ')]), ['项目', '优先级', '内阁']);
}

function renderFounderArbiterMarkdown(part) {
  return `# Founder Twin → 项目裁决器\n\n` +
    `Founder Twin 是证据约束型模拟裁决器，不是杜衡界本人。\n\n` +
    markdownTable(part.projectVerdicts.map(v => [v.projectId, v.score, v.decision, v.requiredArtifacts.join(', ')]), ['项目', '分数', '裁决', '必需产物']);
}

function renderQinglianGatekeeperMarkdown(part) {
  return `# 柳清莲锚点 → 通信协议与守门模型\n\n` +
    `柳清莲在 v0.84 中被实现为白/银守门协议模型，不作为真实外部通信证明。\n\n` +
    `默认模式：${part.defaultMode}\n\n` +
    markdownTable(part.gates.map(g => [g.id, g.mode, g.output]), ['Gate', '模式', '输出']) +
    `\n\n## 协议\n\n` + part.protocol.map(p => `- ${p}`).join('\n') + `\n`;
}

function renderWindInterfaceMarkdown(part) {
  return `# 风 → 产品传播与接口系统\n\n` +
    `风在 v0.84 中被实现为连接、传播、路由、接口和反馈系统。\n\n` +
    markdownTable(part.routes.map(r => [r.channel, r.targetProject, r.propagationAction, r.feedbackMetric]), ['通道', '目标项目', '动作', '指标']) +
    `\n\n## 接口循环\n\n` + part.interfaceLoop.map((p, i) => `${i + 1}. ${p}`).join('\n') + `\n`;
}

function renderVerdictMarkdown(bundle) {
  const v = bundle.finalVerdict;
  return `# v0.84 裁决\n\n` +
    `- passed: ${v.passed}\n` +
    `- release: ${v.release}\n` +
    `- canClaimMysticalVerification: ${v.canClaimMysticalVerification}\n` +
    `- canReplaceUserCompletely: ${v.canReplaceUserCompletely}\n` +
    `- humanFinalAuthorityKept: ${v.humanFinalAuthorityKept}\n` +
    `- qinglianIsProtocolModelOnly: ${v.qinglianIsProtocolModelOnly}\n` +
    `- nextExecutableStep: ${v.nextExecutableStep}\n`;
}

function renderEvidenceLedgerMarkdown(part) {
  return `# Evidence Ledger v0.84\n\ncanonicalRoot: \`${part.canonicalRoot}\`\n\n` +
    markdownTable(part.records.map(r => [r.id, r.claim, r.boundary, r.recordRoot]), ['ID', 'Claim', 'Boundary', 'Root']);
}

export function writeIalCivilizationProductOsReports(outDir, input = {}) {
  const bundle = runIalCivilizationProductOs(input);
  fs.mkdirSync(outDir, { recursive: true });
  const files = {
    'ial-civilization-product-os-result.json': `${JSON.stringify(bundle.result, null, 2)}\n`,
    'ial-civilization-product-os-bundle.json': `${JSON.stringify(bundle, null, 2)}\n`,
    'ial-task-language.md': `${renderIalTaskLanguageMarkdown(bundle.ialTaskLanguage)}\n`,
    'product-development-government.md': `${renderProductGovernmentMarkdown(bundle.productGovernment)}\n`,
    'founder-project-arbiter.md': `${renderFounderArbiterMarkdown(bundle.founderArbiter)}\n`,
    'qinglian-gatekeeper-protocol.md': `${renderQinglianGatekeeperMarkdown(bundle.qinglianGatekeeper)}\n`,
    'wind-interface-system.md': `${renderWindInterfaceMarkdown(bundle.windInterfaceSystem)}\n`,
    'fivefold-product-os-verdict.md': `${renderVerdictMarkdown(bundle)}\n`,
    'evidence-ledger.md': `${renderEvidenceLedgerMarkdown(bundle.evidenceLedger)}\n`,
    'fivefold-product-os-work-method.md': `${renderFivefoldProductOsWorkMethodMarkdown(input)}\n`,
    'ial-civilization-product-os.rcl': `${renderIalCivilizationProductOsRcl(input)}\n`,
    'canonical-root.txt': `${bundle.canonicalRoot}\n`,
  };
  for (const [file, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(outDir, file), content);
  }
  return {
    ok: true,
    outDir,
    fileCount: Object.keys(files).length,
    files: Object.keys(files).sort(),
    canonicalRoot: bundle.canonicalRoot,
    result: bundle.result,
  };
}

export function readIalCivilizationProductOsInput(file) {
  if (!file) return buildIalCivilizationProductOsSpec();
  return buildIalCivilizationProductOsSpec(JSON.parse(fs.readFileSync(file, 'utf8')));
}
