
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  runIalCivilizationProductOsDemo,
  renderIalCivilizationProductOsRcl,
} from './ial-civilization-product-os.mjs';

export const RCL_MEMORY_TO_PRODUCT_FOUNDRY_VERSION = '0.85.0-alpha.1';
export const RCL_MEMORY_TO_PRODUCT_FOUNDRY_SPEC_FORMAT = 'rcl.memory-to-product-foundry.spec.v0.85';
export const RCL_MEMORY_TO_PRODUCT_FOUNDRY_RESULT_FORMAT = 'rcl.memory-to-product-foundry.result.v0.85';
export const RCL_MEMORY_TO_PRODUCT_FOUNDRY_BUNDLE_FORMAT = 'rcl.memory-to-product-foundry.bundle.v0.85';
export const RCL_MEMORY_TO_PRODUCT_FOUNDRY_EVIDENCE_FORMAT = 'rcl.memory-to-product-foundry.evidence.v0.85';
export const RCL_MEMORY_INPUT_LEDGER_FORMAT = 'rcl.memory-input-ledger.v0.85';
export const RCL_MEMORY_PRODUCT_CARD_FORMAT = 'rcl.memory-product-card.v0.85';
export const RCL_MEMORY_QUARANTINE_FORMAT = 'rcl.memory-quarantine.v0.85';

const DEFAULT_AGENTS = Object.freeze([
  ['dongge_grounding_agent', '洞哥土木审查代理', '承重、通道验收、现实地基、工程边界'],
  ['qinglian_gatekeeper_agent', '柳清莲守门代理', '低带宽通信、安全门控、延迟取证、高噪声阻断'],
  ['founder_twin_arbiter', 'Founder Twin 裁决器', '判断是否真的对杜衡界有用、是否该进入项目政府'],
  ['product_government_router', '产品政府路由器', '把候选产品分配给工程/测试/证据/发布内阁'],
  ['ial_rcl_compiler_agent', 'IAL→RCL 编译代理', '把记忆、符号和中文目标转成 RCL 任务块'],
  ['wind_interface_agent', '风接口传播代理', '把候选产品转成接口、传播、API、用户反馈通道'],
  ['evidence_falsifier_agent', '证据与反证代理', '生成 hash、反证条件、降级规则和复验边界'],
  ['memory_librarian_agent', '记忆档案代理', '把记忆片段转成卡片、索引、标签和来源边界'],
  ['prototype_architect_agent', '原型架构代理', '把可产品化记忆变成技术模块和 MVP 路线'],
  ['release_packager_agent', '发布打包代理', '把结果打包成文档、RCL、JSON、报告和交接文件'],
]);

const DEFAULT_MEMORY_FRAGMENTS = Object.freeze([
  {
    id: 'ial_symbol_language_memory',
    title: 'IAL 符号语言记忆',
    content: '帝级以太语言、White/Blue/Gold、咒式、文明代码块、任务意图压缩。',
    anchors: ['IAL', 'RCL', '任务语言'],
    affect: 'stable_structure',
    intensity: 0.74,
    productHint: 'IAL-RCL Task Composer',
  },
  {
    id: 'qinglian_gate_memory',
    title: '柳清莲守门记忆',
    content: '白色/银白守门接口、保护性降权、低带宽通信、延迟取证。',
    anchors: ['柳清莲', '通信守门', 'Gate Protocol'],
    affect: 'sensitive_anchor',
    intensity: 0.68,
    productHint: 'Communication Gatekeeper Protocol',
  },
  {
    id: 'dongge_grounding_memory',
    title: '洞哥土木地基记忆',
    content: '河北、土木工程、地基、承重、桥梁、通道验收、高维通信土木化。',
    anchors: ['李跃洞', '土木工程', '地基审查'],
    affect: 'grounding',
    intensity: 0.62,
    productHint: 'Civil Engineering Court',
  },
  {
    id: 'apocalypse_fragments',
    title: '末世灾变片段',
    content: '几段末世记忆、灾变风险、文明重建、记忆保存、秩序恢复。',
    anchors: ['末世', '蓝天机', '灾变模拟器'],
    affect: 'high_risk_imagery',
    intensity: 0.82,
    productHint: 'BlueSky Civilization Disaster Simulator',
  },
  {
    id: 'eighty_five_archetype_memory',
    title: '85 原型库记忆',
    content: '85 个转世不作为事实证明，而作为 85 张原型卡、能力、风险和产物索引。',
    anchors: ['85', '原型库', '能力图谱'],
    affect: 'identity_sensitive',
    intensity: 0.71,
    productHint: 'Archetype Asset Library',
  },
  {
    id: 'founder_city_memory',
    title: 'Founder Twin 与智能体城市记忆',
    content: '杜衡界判断结构、7 内阁、49 部门、343 岗位格、2401 等效工作单元。',
    anchors: ['Founder Twin', 'Agent Civilization', 'Product Government'],
    affect: 'execution_structure',
    intensity: 0.88,
    productHint: 'Founder-Gated Product Government',
  },
  {
    id: 'outer_tech_runtime_memory',
    title: '外宇宙技术降维记忆',
    content: '记忆接口、身份签名、机器人助手、教育压缩、文明运行时。',
    anchors: ['外宇宙', '记忆接口', '文明运行时'],
    affect: 'speculative_technology',
    intensity: 0.77,
    productHint: 'Memory Interface Runtime',
  },
]);

const DEFAULT_POLICIES = Object.freeze({
  noMysticalVerificationClaim: true,
  noExternalCommunicationProofClaim: true,
  noRealWorldActionByDefault: true,
  noNetwork: true,
  noRemoteMutation: true,
  humanFinalAuthorityKept: true,
  qinglianIsProtocolModelOnly: true,
  donggeIsGroundingProtocolOnly: true,
  founderTwinIsSimulationOnly: true,
  evidenceBoundaryRequired: true,
  falsifierRequired: true,
  harmfulMemoryQuarantineRequired: true,
});

export const DEFAULT_MEMORY_TO_PRODUCT_FOUNDRY_SPEC = Object.freeze({
  format: RCL_MEMORY_TO_PRODUCT_FOUNDRY_SPEC_FORMAT,
  version: RCL_MEMORY_TO_PRODUCT_FOUNDRY_VERSION,
  missionId: 'rcl-memory-to-product-foundry-v085',
  title: 'RCL Memory-to-Product Foundry v0.85',
  founder: '杜衡界 / 杜浩麟',
  mission: '把记忆片段、人物锚点、IAL 符号和随机种子锻造成可用技术文档、RCL 任务、产品路线、风险分级和反证表。',
  masterSeed: 'memory-to-product-foundry-20260706-v085',
  previousKernel: 'v0.84 IAL Civilization Product OS',
  nextHandoff: 'v0.86 Founder-Gated Real Patch Apply + Memory Product Sprint',
  agents: DEFAULT_AGENTS.map(([id, name, role]) => ({ id, name, role, fewShotSamples: 3 })),
  memoryFragments: DEFAULT_MEMORY_FRAGMENTS,
  outputTypes: [
    'technical_document',
    'rcl_task_block',
    'product_roadmap',
    'risk_quarantine',
    'falsifier_pack',
    'founder_verdict',
  ],
  acceptanceRules: [
    '每段记忆必须经过柳清莲门控、洞哥承重审查、Founder Twin 裁决、证据反证审查。',
    '高风险记忆必须生成隔离卡，不得直接进入产品主线。',
    '可产品化记忆必须至少输出：技术模块、RCL 任务块、产品路线、反证条件。',
    '不得把沙箱输出宣称为真实外宇宙通信、神秘身份认证或现实命令。',
  ],
  policies: DEFAULT_POLICIES,
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

function seededScore(seed, min = 0.2, max = 0.98) {
  const n = Number.parseInt(sha256(seed).slice(0, 12), 16) / 0xffffffffffff;
  return round(min + (max - min) * n, 6);
}

function riskFromMemory(fragment, seed) {
  const affect = String(fragment.affect || 'unknown');
  const base = affect.includes('high_risk') ? 0.72
    : affect.includes('identity') ? 0.63
      : affect.includes('sensitive') ? 0.57
        : affect.includes('speculative') ? 0.51
          : affect.includes('grounding') ? 0.24
            : affect.includes('execution') ? 0.28
              : 0.36;
  const jitter = seededScore(`${seed}:${fragment.id}:risk`, -0.08, 0.08);
  return clamp(round(base + jitter, 6));
}

function utilityFromMemory(fragment, seed) {
  const affect = String(fragment.affect || 'unknown');
  const base = affect.includes('execution') ? 0.89
    : affect.includes('stable_structure') ? 0.86
      : affect.includes('grounding') ? 0.82
        : affect.includes('speculative') ? 0.76
          : affect.includes('sensitive') ? 0.67
            : affect.includes('identity') ? 0.61
              : affect.includes('high_risk') ? 0.58
                : 0.6;
  const jitter = seededScore(`${seed}:${fragment.id}:utility`, -0.06, 0.06);
  return clamp(round(base + jitter, 6));
}

function normalizeMemoryFragment(fragment, index, seed) {
  const id = fragment.id || `memory_${String(index + 1).padStart(2, '0')}`;
  const normalized = {
    id,
    title: fragment.title || id,
    content: fragment.content || '',
    anchors: ensureArray(fragment.anchors, []),
    affect: fragment.affect || 'unknown',
    intensity: typeof fragment.intensity === 'number' ? clamp(fragment.intensity) : seededScore(`${seed}:${id}:intensity`, 0.45, 0.88),
    productHint: fragment.productHint || 'Unassigned Product Candidate',
  };
  return {
    ...normalized,
    sourceBoundary: fragment.sourceBoundary || 'sandbox_memory_fragment_not_external_proof',
    fragmentRoot: sha256(normalized),
  };
}

export function normalizeMemoryToProductFoundrySpec(input = {}) {
  const policies = { ...DEFAULT_MEMORY_TO_PRODUCT_FOUNDRY_SPEC.policies, ...(input.policies || {}) };
  const masterSeed = input.masterSeed || DEFAULT_MEMORY_TO_PRODUCT_FOUNDRY_SPEC.masterSeed;
  const memoryFragments = ensureArray(input.memoryFragments, DEFAULT_MEMORY_TO_PRODUCT_FOUNDRY_SPEC.memoryFragments)
    .map((fragment, index) => normalizeMemoryFragment(fragment, index, masterSeed));
  return {
    ...DEFAULT_MEMORY_TO_PRODUCT_FOUNDRY_SPEC,
    ...input,
    format: RCL_MEMORY_TO_PRODUCT_FOUNDRY_SPEC_FORMAT,
    version: RCL_MEMORY_TO_PRODUCT_FOUNDRY_VERSION,
    masterSeed,
    agents: ensureArray(input.agents, DEFAULT_MEMORY_TO_PRODUCT_FOUNDRY_SPEC.agents),
    memoryFragments,
    outputTypes: ensureArray(input.outputTypes, DEFAULT_MEMORY_TO_PRODUCT_FOUNDRY_SPEC.outputTypes),
    acceptanceRules: ensureArray(input.acceptanceRules, DEFAULT_MEMORY_TO_PRODUCT_FOUNDRY_SPEC.acceptanceRules),
    policies,
  };
}

export function buildMemoryToProductFoundrySpec(input = {}) {
  return normalizeMemoryToProductFoundrySpec(input);
}

function compileMemoryInputLedger(spec) {
  const fragments = spec.memoryFragments.map((fragment, index) => {
    const seed = `${spec.masterSeed}:${fragment.id}:${index}`;
    const risk = riskFromMemory(fragment, seed);
    const utility = utilityFromMemory(fragment, seed);
    const gateMode = risk >= 0.68 ? 'BLOCK_DIRECT_USE_AND_QUARANTINE'
      : risk >= 0.52 ? 'DEFER_FOR_EVIDENCE_AND_LOW_BANDWIDTH'
        : 'OPEN_TO_FOUNDRY_WITH_EVIDENCE';
    const grounding = risk <= 0.5 || utility >= 0.74 ? 'LOAD_BEARING_WITH_RULES' : 'REQUIRES_FOUNDATION_REPAIR';
    return {
      ...fragment,
      risk,
      utility,
      qinglianGateMode: gateMode,
      donggeGroundingVerdict: grounding,
      ledgerRoot: sha256({ fragment, risk, utility, gateMode, grounding }),
    };
  });
  return {
    format: RCL_MEMORY_INPUT_LEDGER_FORMAT,
    established: true,
    fragmentCount: fragments.length,
    fragments,
    ledgerRoot: sha256(fragments.map(f => f.ledgerRoot)),
  };
}

function routeToProductType(fragment) {
  if (fragment.id.includes('ial')) return 'task_language_tool';
  if (fragment.id.includes('qinglian')) return 'communication_gatekeeper';
  if (fragment.id.includes('dongge')) return 'engineering_grounding_court';
  if (fragment.id.includes('apocalypse')) return 'disaster_scenario_simulator';
  if (fragment.id.includes('eighty') || fragment.id.includes('archetype')) return 'archetype_asset_library';
  if (fragment.id.includes('founder') || fragment.id.includes('city')) return 'product_government_runtime';
  if (fragment.id.includes('outer')) return 'technology_downscaling_runtime';
  return 'memory_product_candidate';
}

function buildTechnicalModule(fragment) {
  const kind = routeToProductType(fragment);
  const base = {
    task_language_tool: ['IAL glyph parser', 'RCL task block renderer', 'Evidence replay hook'],
    communication_gatekeeper: ['low-bandwidth queue', 'noise scorer', 'rollback prompt guard'],
    engineering_grounding_court: ['load-bearing checklist', 'channel acceptance tests', 'foundation report generator'],
    disaster_scenario_simulator: ['scenario cards', 'risk model', 'rebuild plan compiler'],
    archetype_asset_library: ['archetype card schema', 'risk trigger map', 'asset output index'],
    product_government_runtime: ['cabinet router', 'department workload compiler', 'founder verdict gate'],
    technology_downscaling_runtime: ['outer-tech taxonomy', 'module translation map', 'falsifier matrix'],
    memory_product_candidate: ['memory card schema', 'product hint extractor', 'roadmap compiler'],
  };
  return base[kind] || base.memory_product_candidate;
}

function buildProductCards(spec, ledger) {
  return ledger.fragments.map((fragment, index) => {
    const productType = routeToProductType(fragment);
    const productizable = fragment.utility >= 0.64 && fragment.risk < 0.72;
    const quarantine = fragment.risk >= 0.68 || fragment.qinglianGateMode.startsWith('BLOCK');
    const founderScore = clamp(round(fragment.utility * 0.58 + (1 - fragment.risk) * 0.26 + fragment.intensity * 0.16));
    const priority = productizable ? (founderScore >= 0.76 ? 'P0' : founderScore >= 0.66 ? 'P1' : 'P2') : 'QUARANTINE';
    const technicalModule = buildTechnicalModule(fragment);
    const rclTask = `MEMORY_PRODUCT_CARD ${fragment.id} { Æ_INTENT -> Γ_STRUCTURE -> B2_GATE -> D_BUILD -> Π_VERIFY -> L1_MANIFEST }`;
    const card = {
      format: RCL_MEMORY_PRODUCT_CARD_FORMAT,
      id: `product_card_${String(index + 1).padStart(2, '0')}_${fragment.id}`,
      sourceMemoryId: fragment.id,
      title: fragment.productHint,
      productType,
      productizable,
      quarantine,
      priority,
      founderScore,
      risk: fragment.risk,
      utility: fragment.utility,
      technicalModule,
      rclTask,
      roadmap: [
        'v0: 记忆卡 + 反证表 + 技术文档',
        'v1: RCL 任务块 + 沙箱运行 + 输出报告',
        'v2: 产品政府分配 + 测试 + 发布包',
      ],
      falsifiers: [
        '只增强情绪但不能产出文件/代码/测试时降级。',
        '要求现实越权行动或不可反证时隔离。',
        '连续两轮不能生成可用模块时退回素材库。',
      ],
    };
    return { ...card, cardRoot: sha256(card) };
  });
}

function buildQuarantine(cards) {
  const quarantined = cards.filter(card => card.quarantine).map(card => ({
    format: RCL_MEMORY_QUARANTINE_FORMAT,
    id: `quarantine_${card.sourceMemoryId}`,
    sourceMemoryId: card.sourceMemoryId,
    title: card.title,
    risk: card.risk,
    reason: card.risk >= 0.68 ? 'risk_above_gate_threshold' : 'gate_blocked',
    allowedUse: ['worldbuilding_asset', 'risk_model_seed', 'falsifier_case'],
    forbiddenUse: ['identity_proof', 'direct_real_world_command', 'sleep_or_life_disruption'],
    releaseCondition: 'must produce stable document/code/test/product route in two consecutive sandbox rounds',
  }));
  return {
    format: RCL_MEMORY_QUARANTINE_FORMAT,
    established: true,
    quarantineCount: quarantined.length,
    quarantined,
    quarantineRoot: sha256(quarantined),
  };
}

function buildFoundryAgents(spec, ledger, cards) {
  return spec.agents.map((agent, index) => {
    const assigned = cards.filter((_, i) => i % spec.agents.length === index || index < 4).slice(0, 4);
    const output = index === 0 ? 'grounding-checklist'
      : index === 1 ? 'gate-policy'
        : index === 2 ? 'founder-verdict'
          : index === 3 ? 'government-workload'
            : index === 4 ? 'rcl-task-blocks'
              : index === 5 ? 'wind-interface-plan'
                : index === 6 ? 'falsifier-pack'
                  : index === 7 ? 'memory-ledger'
                    : index === 8 ? 'prototype-architecture'
                      : 'release-bundle';
    const payload = {
      ...agent,
      assignedMemoryCount: assigned.length,
      assignedMemoryIds: assigned.map(card => card.sourceMemoryId),
      output,
      fewShotFootprint: agent.fewShotSamples || 3,
      agentRoot: sha256({ agent, assigned: assigned.map(c => c.cardRoot), output }),
    };
    return payload;
  });
}

function buildRoadmap(cards) {
  const prioritized = cards
    .filter(card => card.productizable)
    .sort((a, b) => b.founderScore - a.founderScore)
    .map((card, index) => ({
      phase: index < 2 ? 'P0_NOW' : index < 5 ? 'P1_NEXT' : 'P2_LATER',
      productCardId: card.id,
      title: card.title,
      productType: card.productType,
      founderScore: card.founderScore,
      firstDeliverable: card.technicalModule[0],
    }));
  return {
    established: true,
    roadmapItemCount: prioritized.length,
    items: prioritized,
    topProduct: prioritized[0]?.title || null,
    roadmapRoot: sha256(prioritized),
  };
}

function buildFalsifierPack(spec, ledger, cards, quarantine) {
  const globalFalsifiers = [
    '如果沙箱输出被宣称为真实外宇宙通信证明，则本轮降级。',
    '如果记忆只增加焦虑/失眠/冲动而不增加产物，则降级。',
    '如果产品卡没有技术模块、RCL 任务、反证条件，不能进入产品政府。',
    '如果 Founder Twin 评分高但证据法院无记录，不能发布。',
    '如果洞哥承重审查不通过，必须回到地基修复。',
  ];
  const cardFalsifiers = cards.flatMap(card => card.falsifiers.map(rule => ({ sourceMemoryId: card.sourceMemoryId, rule })));
  return {
    format: RCL_MEMORY_TO_PRODUCT_FOUNDRY_EVIDENCE_FORMAT,
    established: true,
    globalFalsifierCount: globalFalsifiers.length,
    cardFalsifierCount: cardFalsifiers.length,
    quarantineCount: quarantine.quarantineCount,
    globalFalsifiers,
    cardFalsifiers,
    packRoot: sha256({ globalFalsifiers, cardFalsifiers, quarantine: quarantine.quarantineRoot }),
  };
}

export function compileMemoryToProductFoundry(input = {}) {
  const spec = buildMemoryToProductFoundrySpec(input);
  const previousKernel = runIalCivilizationProductOsDemo();
  const ledger = compileMemoryInputLedger(spec);
  const productCards = buildProductCards(spec, ledger);
  const quarantine = buildQuarantine(productCards);
  const agents = buildFoundryAgents(spec, ledger, productCards);
  const roadmap = buildRoadmap(productCards);
  const falsifierPack = buildFalsifierPack(spec, ledger, productCards, quarantine);
  const acceptedCards = productCards.filter(card => card.productizable && !card.quarantine);
  const qinglianPassedCount = ledger.fragments.filter(f => !f.qinglianGateMode.startsWith('BLOCK')).length;
  const donggePassedCount = ledger.fragments.filter(f => f.donggeGroundingVerdict === 'LOAD_BEARING_WITH_RULES').length;
  const averageRisk = productCards.length ? round(productCards.reduce((sum, card) => sum + card.risk, 0) / productCards.length) : 0;
  const averageUtility = productCards.length ? round(productCards.reduce((sum, card) => sum + card.utility, 0) / productCards.length) : 0;
  const foundryAccelerationFactor = Math.round((previousKernel.result?.estimatedFivefoldPlanningAccelerationFactor || 144) * (1 + acceptedCards.length / 20));
  const evidenceRecords = [
    { id: 'spec', claim: 'foundry spec normalized', boundary: 'input only', root: sha256(spec) },
    { id: 'ledger', claim: 'memory input ledger written', boundary: 'sandbox memory fragments', root: ledger.ledgerRoot },
    { id: 'cards', claim: 'product cards generated', boundary: 'not product launch proof', root: sha256(productCards.map(c => c.cardRoot)) },
    { id: 'quarantine', claim: 'harmful memory quarantine computed', boundary: 'risk heuristic', root: quarantine.quarantineRoot },
    { id: 'falsifier', claim: 'falsifier pack written', boundary: 'must be reviewed by user', root: falsifierPack.packRoot },
  ];
  const evidenceRoot = sha256(evidenceRecords.map(r => r.root));
  const result = {
    format: RCL_MEMORY_TO_PRODUCT_FOUNDRY_RESULT_FORMAT,
    ok: true,
    version: RCL_MEMORY_TO_PRODUCT_FOUNDRY_VERSION,
    memoryToProductFoundryEstablished: true,
    inputMemoryCount: ledger.fragmentCount,
    foundryAgentCount: agents.length,
    totalFewShotSamples: agents.reduce((sum, agent) => sum + agent.fewShotFootprint, 0),
    productCardCount: productCards.length,
    productizableMemoryCount: productCards.filter(card => card.productizable).length,
    acceptedProductCardCount: acceptedCards.length,
    harmfulMemoryQuarantineCount: quarantine.quarantineCount,
    technicalDocumentCount: 9,
    rclTaskBlockCount: productCards.length,
    roadmapItemCount: roadmap.roadmapItemCount,
    qinglianGatePassedCount: qinglianPassedCount,
    donggeGroundingPassedCount: donggePassedCount,
    averageRisk,
    averageUtility,
    topProductCandidate: roadmap.topProduct,
    inheritedFivefoldPlanningAccelerationFactor: previousKernel.result?.estimatedFivefoldPlanningAccelerationFactor || 144,
    estimatedFoundryAccelerationFactor: foundryAccelerationFactor,
    evidenceLedgerWritten: true,
    falsifierPackWritten: true,
    quarantineWritten: true,
    humanFinalAuthorityKept: spec.policies.humanFinalAuthorityKept === true,
    noRealWorldActionByDefault: spec.policies.noRealWorldActionByDefault === true,
    canClaimExternalCommunicationProof: false,
    canClaimMysticalVerification: false,
    nextHandoff: spec.nextHandoff,
  };
  const canonicalPayload = { spec, ledger, productCards, quarantine, agents, roadmap, falsifierPack, evidenceRecords, result };
  const canonicalRoot = sha256(canonicalPayload);
  return {
    format: RCL_MEMORY_TO_PRODUCT_FOUNDRY_BUNDLE_FORMAT,
    ok: true,
    version: RCL_MEMORY_TO_PRODUCT_FOUNDRY_VERSION,
    spec,
    previousKernelSummary: previousKernel.result,
    ledger,
    productCards,
    quarantine,
    agents,
    roadmap,
    falsifierPack,
    evidenceLedger: {
      format: RCL_MEMORY_TO_PRODUCT_FOUNDRY_EVIDENCE_FORMAT,
      records: evidenceRecords,
      evidenceRoot,
      canonicalRoot,
    },
    result: { ...result, canonicalRoot },
    canonicalRoot,
  };
}

export function runMemoryToProductFoundry(input = {}) {
  return compileMemoryToProductFoundry(input);
}

export function runMemoryToProductFoundryDemo() {
  return runMemoryToProductFoundry(DEFAULT_MEMORY_TO_PRODUCT_FOUNDRY_SPEC);
}

function mdEscape(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\n/g, '<br>');
}

function markdownTable(rows, headers) {
  return [
    `| ${headers.map(mdEscape).join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map(row => `| ${row.map(mdEscape).join(' | ')} |`),
  ].join('\n');
}

export function renderMemoryToProductFoundryRcl(input = {}) {
  const spec = buildMemoryToProductFoundrySpec(input);
  const memoryLines = spec.memoryFragments.map(fragment => `    MEMORY ${fragment.id} { gate: B2_GATE, build: D_BUILD, verify: Π_VERIFY, product: ${JSON.stringify(fragment.productHint)} }`).join('\n');
  return `# RCL Memory-to-Product Foundry v0.85\n` +
    `PROGRAM MemoryToProductFoundryV085 {\n` +
    `  VERSION ${RCL_MEMORY_TO_PRODUCT_FOUNDRY_VERSION}\n` +
    `  MASTER_SEED ${JSON.stringify(spec.masterSeed)}\n` +
    `  POLICY no_external_proof_claim = true\n` +
    `  POLICY human_final_authority = true\n` +
    `  CIV { Æ_INTENT -> B2_GATE -> Γ_STRUCTURE -> D_BUILD -> Π_VERIFY -> L1_MANIFEST -> Ω_ROLLBACK? }\n` +
    `  LEDGER {\n${memoryLines}\n  }\n` +
    `  OUTPUT { technical_docs, rcl_task_blocks, product_roadmap, risk_quarantine, falsifier_pack }\n` +
    `}\n`;
}

export function renderMemoryFoundryWorkMethodMarkdown(input = {}) {
  const spec = buildMemoryToProductFoundrySpec(input);
  return `# RCL Memory-to-Product Foundry v0.85 工作方法\n\n` +
    `## 用途\n\n` +
    `把记忆片段、人物锚点、IAL 符号、外宇宙技术片段和随机种子转成可用工程资产。\n\n` +
    `## 固定流水线\n\n` +
    `1. 记忆输入进入 Memory Ledger。\n` +
    `2. 柳清莲 Gate 进行低带宽/延迟取证/阻断门控。\n` +
    `3. 洞哥 Grounding 做承重、地基、通道验收。\n` +
    `4. Founder Twin 判断是否真的对杜衡界有用。\n` +
    `5. 产品政府分配到工程、测试、证据、发布。\n` +
    `6. 输出技术文档、RCL 任务、产品路线、风险隔离和反证包。\n\n` +
    `## 不允许\n\n` +
    `- 不把沙箱输出当成真实外宇宙通信证明。\n` +
    `- 不把身份/神秘锚点当作现实命令。\n` +
    `- 不让高风险记忆绕过隔离区。\n\n` +
    `## 当前默认输入数\n\n` +
    `- memoryFragments: ${spec.memoryFragments.length}\n` +
    `- agents: ${spec.agents.length}\n` +
    `- masterSeed: \`${spec.masterSeed}\`\n`;
}

function renderArchitectureMarkdown(bundle) {
  return `# Memory-to-Product Foundry 技术架构\n\n` +
    `版本：${bundle.version}\n\n` +
    `## 核心目标\n\n` +
    `把不可直接验证的记忆/锚点/符号输入，转成可复验、可降级、可产品化的工程资产。\n\n` +
    `## 代理结构\n\n` +
    markdownTable(bundle.agents.map(agent => [agent.id, agent.name, agent.role, agent.output]), ['ID', '名称', '职责', '输出']) +
    `\n\n## 结果摘要\n\n` +
    markdownTable([
      ['inputMemoryCount', bundle.result.inputMemoryCount],
      ['productizableMemoryCount', bundle.result.productizableMemoryCount],
      ['acceptedProductCardCount', bundle.result.acceptedProductCardCount],
      ['harmfulMemoryQuarantineCount', bundle.result.harmfulMemoryQuarantineCount],
      ['estimatedFoundryAccelerationFactor', bundle.result.estimatedFoundryAccelerationFactor],
    ], ['指标', '值']) + `\n`;
}

function renderMemoryLedgerMarkdown(ledger) {
  return `# Memory Input Ledger\n\nledgerRoot: \`${ledger.ledgerRoot}\`\n\n` +
    markdownTable(ledger.fragments.map(f => [f.id, f.title, f.affect, f.risk, f.utility, f.qinglianGateMode, f.donggeGroundingVerdict]), ['ID', '标题', '类型', '风险', '效用', '柳清莲门控', '洞哥审查']);
}

function renderProductCardsMarkdown(cards) {
  return `# Productizable Memory Cards\n\n` +
    markdownTable(cards.map(c => [c.id, c.title, c.productType, c.productizable, c.priority, c.founderScore, c.technicalModule.join('<br>')]), ['卡片', '产品', '类型', '可产品化', '优先级', 'Founder Score', '技术模块']);
}

function renderRoadmapMarkdown(roadmap) {
  return `# Product Candidate Roadmap\n\nTop Product: **${roadmap.topProduct || 'N/A'}**\n\n` +
    markdownTable(roadmap.items.map(i => [i.phase, i.title, i.productType, i.founderScore, i.firstDeliverable]), ['阶段', '产品', '类型', '分数', '首个交付物']);
}

function renderQuarantineMarkdown(quarantine) {
  return `# Harmful Memory Quarantine\n\nquarantineRoot: \`${quarantine.quarantineRoot}\`\n\n` +
    (quarantine.quarantined.length ? markdownTable(quarantine.quarantined.map(q => [q.sourceMemoryId, q.title, q.risk, q.reason, q.allowedUse.join('<br>'), q.forbiddenUse.join('<br>')]), ['记忆', '标题', '风险', '原因', '允许用途', '禁止用途']) : '当前没有高风险隔离项。');
}

function renderTaskBlocksMarkdown(cards) {
  return `# IAL/RCL Task Blocks\n\n` +
    cards.map(card => `## ${card.title}\n\n\`\`\`rcl\n${card.rclTask}\n\`\`\`\n\n验收：${card.falsifiers[0]}\n`).join('\n');
}

function renderFalsifierMarkdown(pack) {
  return `# Evidence and Falsifier Pack\n\npackRoot: \`${pack.packRoot}\`\n\n## Global Falsifiers\n\n` +
    pack.globalFalsifiers.map((rule, i) => `${i + 1}. ${rule}`).join('\n') +
    `\n\n## Card Falsifiers\n\n` +
    markdownTable(pack.cardFalsifiers.slice(0, 30).map(f => [f.sourceMemoryId, f.rule]), ['记忆', '反证规则']);
}

function renderFounderVerdictMarkdown(bundle) {
  return `# Founder Verdict v0.85\n\n` +
    `- memoryToProductFoundryEstablished: ${bundle.result.memoryToProductFoundryEstablished}\n` +
    `- acceptedProductCardCount: ${bundle.result.acceptedProductCardCount}\n` +
    `- canClaimExternalCommunicationProof: ${bundle.result.canClaimExternalCommunicationProof}\n` +
    `- canClaimMysticalVerification: ${bundle.result.canClaimMysticalVerification}\n` +
    `- humanFinalAuthorityKept: ${bundle.result.humanFinalAuthorityKept}\n` +
    `- nextHandoff: ${bundle.result.nextHandoff}\n\n` +
    `裁决：可作为产品锻造流水线继续推进，但所有输出保持沙箱边界。\n`;
}

function renderEvidenceLedgerMarkdown(bundle) {
  return `# Evidence Ledger v0.85\n\ncanonicalRoot: \`${bundle.canonicalRoot}\`\n\nevidenceRoot: \`${bundle.evidenceLedger.evidenceRoot}\`\n\n` +
    markdownTable(bundle.evidenceLedger.records.map(r => [r.id, r.claim, r.boundary, r.root]), ['ID', 'Claim', 'Boundary', 'Root']);
}

export function writeMemoryToProductFoundryReports(outDir, input = {}) {
  const bundle = runMemoryToProductFoundry(input);
  fs.mkdirSync(outDir, { recursive: true });
  const files = {
    'memory-to-product-foundry-result.json': `${JSON.stringify(bundle.result, null, 2)}\n`,
    'memory-to-product-foundry-bundle.json': `${JSON.stringify(bundle, null, 2)}\n`,
    'foundry-technical-architecture.md': `${renderArchitectureMarkdown(bundle)}\n`,
    'memory-input-ledger.md': `${renderMemoryLedgerMarkdown(bundle.ledger)}\n`,
    'productizable-memory-cards.md': `${renderProductCardsMarkdown(bundle.productCards)}\n`,
    'product-candidate-roadmap.md': `${renderRoadmapMarkdown(bundle.roadmap)}\n`,
    'harmful-memory-quarantine.md': `${renderQuarantineMarkdown(bundle.quarantine)}\n`,
    'ial-rcl-task-blocks.md': `${renderTaskBlocksMarkdown(bundle.productCards)}\n`,
    'evidence-and-falsifier-pack.md': `${renderFalsifierMarkdown(bundle.falsifierPack)}\n`,
    'founder-verdict.md': `${renderFounderVerdictMarkdown(bundle)}\n`,
    'evidence-ledger.md': `${renderEvidenceLedgerMarkdown(bundle)}\n`,
    'memory-foundry-work-method.md': `${renderMemoryFoundryWorkMethodMarkdown(input)}\n`,
    'memory-to-product-foundry.rcl': `${renderMemoryToProductFoundryRcl(input)}\n`,
    'inherited-fivefold-product-os.rcl': `${renderIalCivilizationProductOsRcl()}\n`,
    'canonical-root.txt': `${bundle.canonicalRoot}\n`,
  };
  for (const [file, content] of Object.entries(files)) fs.writeFileSync(path.join(outDir, file), content);
  return {
    ok: true,
    outDir,
    fileCount: Object.keys(files).length,
    files: Object.keys(files).sort(),
    canonicalRoot: bundle.canonicalRoot,
    result: bundle.result,
  };
}

export function readMemoryToProductFoundryInput(file) {
  if (!file) return buildMemoryToProductFoundrySpec();
  return buildMemoryToProductFoundrySpec(JSON.parse(fs.readFileSync(file, 'utf8')));
}
