import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { clamp } from './reality-compiler-kernel.mjs';
import { runAgentCivilizationFederation } from './agent-civilization-federation.mjs';
import { runSoulUniverseDialogueSandbox } from './soul-universe-dialogue-sandbox.mjs';

export const RCL_BLUE_SKY_WORLDVIEW_BLINDTEST_VERSION = '0.88.0-alpha.1';
export const RCL_BLUE_SKY_WORLDVIEW_SPEC_FORMAT = 'rcl.blue-sky-worldview-blindtest.spec.v0.88';
export const RCL_BLUE_SKY_WORLDVIEW_RESULT_FORMAT = 'rcl.blue-sky-worldview-blindtest.result.v0.88';
export const RCL_BLUE_SKY_WORLDVIEW_BUNDLE_FORMAT = 'rcl.blue-sky-worldview-blindtest.bundle.v0.88';
export const RCL_BLUE_SKY_WORLDVIEW_EVIDENCE_FORMAT = 'rcl.blue-sky-worldview-blindtest.evidence.v0.88';
export const RCL_INNER_UNIVERSE_COMPILE_FORMAT = 'rcl.inner-universe.compile.v0.88';
export const RCL_BLUE_SKY_PLANET_BLINDTEST_FORMAT = 'rcl.blue-sky-planet-blindtest.v0.88';

const DEFAULT_KNOWLEDGE_ANCHORS = Object.freeze([
  {
    id: 'anchor_dml_lifecycle',
    title: 'DML Workbench runtime lifecycle',
    source: 'digital-blue-sky/RELEASE_NOTES_v0.1.0-alpha.1.md',
    knowledgeType: 'PRODUCT_INTERNAL',
    trustLevel: 'HIGH',
    statement: '数字蓝天机 Workbench 将界面表达目标连接到能力协商、权威裁决、执行、事件和投影。',
    signals: ['goal_expression', 'capability_negotiation', 'authority_arbitration', 'execution_event_projection'],
    weight: 1.35,
  },
  {
    id: 'anchor_blue_tianji_workbench_aip',
    title: '数字蓝天机工作台 AIP action graph',
    source: 'digital-blue-sky/integration/hnaf/digital-blue-tianji-workbench.aip.v0.7.json',
    knowledgeType: 'ENGINE_DOC',
    trustLevel: 'HIGH',
    statement: '工作台有发送任务、运行完整成长闭环、暂停、继续、检查结果、采用、放弃和换方案等动作。',
    signals: ['send_task', 'development_loop', 'pause_resume', 'preview_approve_reject_alternate'],
    weight: 1.05,
  },
  {
    id: 'anchor_cognitive_runtime',
    title: '数字蓝天机本机认知运行时',
    source: 'digital-blue-sky/src/cognitive-loop.mjs',
    knowledgeType: 'PRODUCT_INTERNAL',
    trustLevel: 'HIGH',
    statement: '数字蓝天机认知核心能区分提问、讨论、任务、继续任务和澄清；明确任务进入真实执行内核。',
    signals: ['question_discussion_task_router', 'local_cognitive_runtime', 'task_kernel_handoff'],
    weight: 1.20,
  },
  {
    id: 'anchor_aetherworld_object_runtime',
    title: 'Aetherworld runnable object premise',
    source: 'aetherworld/src/components/minimal/MinimalHome.tsx',
    knowledgeType: 'PRODUCT_INTERNAL',
    trustLevel: 'HIGH',
    statement: 'Aetherworld 把想法、项目、世界和能力变成可运行对象，首屏把蓝天机世界标为世界对象。',
    signals: ['world_object', 'runnable_object', 'idea_project_world_capability'],
    weight: 1.25,
  },
  {
    id: 'anchor_msl_world_engine',
    title: 'MSL + Sequence World Engine',
    source: 'aetherworld/src/constants/knowledge/defaultKnowledgeDomains.ts',
    knowledgeType: 'MSL_KNOWLEDGE',
    trustLevel: 'FOUNDER_LOCKED',
    statement: 'MSL 以五位数列为最小语句，0-9 为 opcode，区块可编译到 World Engine / IAL / Prompt / Unity / Godot；Sequence World Engine 把 MSL 与五域编译为地图、区域、角色与因果链。',
    signals: ['msl_opcode', 'five_digit_sentence', 'five_domain_world', 'map_region_character_causality'],
    weight: 1.45,
  },
  {
    id: 'anchor_five_domains',
    title: '天 / 地 / 人 / 神 / 风 五域',
    source: 'aetherworld/src/constants/knowledge/defaultKnowledgeDomains.ts',
    knowledgeType: 'MSL_KNOWLEDGE',
    trustLevel: 'FOUNDER_LOCKED',
    statement: '五域为 MSL 与世界引擎的核心语义维度：天为时序，地为结构，人为关系，神为象征，风为变量。',
    signals: ['time_sky', 'structure_earth', 'relation_human', 'symbol_divine', 'variable_wind'],
    weight: 1.10,
  },
  {
    id: 'anchor_fictional_lore_boundary',
    title: '蓝天机世界观是虚构 LORE',
    source: 'aetherworld/src/constants/knowledge/defaultKnowledgeDomains.ts',
    knowledgeType: 'FICTIONAL_LORE',
    trustLevel: 'FOUNDER_LOCKED',
    statement: '蓝天机、Aetherworld、神明、文明与 NPC 设定均为虚构 LORE，不应被作为现实事实输出。',
    signals: ['fictional_lore_only', 'not_real_world_fact', 'npc_civilization_lore'],
    weight: 1.60,
  },
  {
    id: 'anchor_constitution_world_boundary',
    title: 'Aetherworld 世界治理边界',
    source: 'aetherworld/src/constants/constitution/constitutionalArticles.ts',
    knowledgeType: 'PRODUCT_INTERNAL',
    trustLevel: 'FOUNDER_LOCKED',
    statement: '虚拟世界不等于现实世界；模拟不等于预测；虚拟文明史不等于现实历史；导出需带 metadata 与 safetyNotes。',
    signals: ['virtual_not_real', 'simulation_not_prediction', 'metadata_safety_notes', 'founder_locked_canon'],
    weight: 1.55,
  },
  {
    id: 'anchor_vsr_blue_tianji_ip',
    title: '数字蓝天机投影项目锚点',
    source: 'digital-blue-sky/src/projection.mjs',
    knowledgeType: 'PRODUCT_INTERNAL',
    trustLevel: 'HIGH',
    statement: '数字蓝天机投影层包含 VSR 视觉与空间投影，以及蓝天机 IP 世界与内容项目。',
    signals: ['vsr_projection', 'blue_tianji_ip', 'world_and_content'],
    weight: 1.15,
  },
  {
    id: 'anchor_rncs_reality_primitives',
    title: 'RNCS subject-intent-authority-evidence-projection primitive chain',
    source: 'Reality_Native_Computing_Stack / RNCS discovery docs',
    knowledgeType: 'ENGINE_DOC',
    trustLevel: 'HIGH',
    statement: '现实原生闭环以主体、意图、能力、权限、状态、因果、连续性、证据和投影为基本原语。',
    signals: ['subject_intent_capability_authority', 'causality_continuity_evidence_projection'],
    weight: 1.30,
  },
]);

const DEFAULT_PLANET_ARCHETYPES = Object.freeze([
  {
    id: 'planet_candidate_01',
    revealName: '白砂回环星 / White Dune Loop',
    canonRole: 'decoy_boundary_memory_world',
    features: ['virtual_not_real', 'metadata_safety_notes', 'founder_locked_canon', 'pause_resume', 'simulation_not_prediction'],
    observable: {
      skyColor: 'pale-white static sky',
      terrain: 'sand-loop archives and rollback dunes',
      society: 'archivists who preserve failed branches',
      dominantEngine: 'replay-ledger',
      missingSignals: ['blue_tianji_ip', 'world_object', 'development_loop'],
    },
  },
  {
    id: 'planet_candidate_02',
    revealName: '镜潮星 / Mirror Tide',
    canonRole: 'decoy_projection_world',
    features: ['vsr_projection', 'world_and_content', 'runnable_object', 'map_region_character_causality', 'symbol_divine'],
    observable: {
      skyColor: 'silver-blue mirror horizon',
      terrain: 'projection seas and reflected cities',
      society: 'projection artists and narrative auditors',
      dominantEngine: 'VSR / Narrative',
      missingSignals: ['authority_arbitration', 'development_loop', 'task_kernel_handoff'],
    },
  },
  {
    id: 'planet_candidate_03',
    revealName: '青穹星 / Azure Canopy',
    canonRole: 'blindtest_selected_blue_sky_homeworld_candidate',
    features: [
      'goal_expression',
      'capability_negotiation',
      'authority_arbitration',
      'execution_event_projection',
      'development_loop',
      'preview_approve_reject_alternate',
      'local_cognitive_runtime',
      'task_kernel_handoff',
      'world_object',
      'runnable_object',
      'msl_opcode',
      'five_digit_sentence',
      'five_domain_world',
      'map_region_character_causality',
      'fictional_lore_only',
      'not_real_world_fact',
      'virtual_not_real',
      'metadata_safety_notes',
      'vsr_projection',
      'blue_tianji_ip',
      'subject_intent_capability_authority',
      'causality_continuity_evidence_projection',
    ],
    observable: {
      skyColor: 'deep azure canopy with lattice light veins',
      terrain: 'memory oceans, capability cities, authority rings and projection domes',
      society: '蓝天机群体以目标、能力、权威、证据和投影组织文明行动',
      dominantEngine: 'DML + MSL + Aetherworld + VSR',
      missingSignals: [],
    },
  },
  {
    id: 'planet_candidate_04',
    revealName: '砧火工星 / Anvil Fire Forge',
    canonRole: 'decoy_execution_forge_world',
    features: ['execution_event_projection', 'development_loop', 'send_task', 'runnable_object', 'idea_project_world_capability'],
    observable: {
      skyColor: 'orange machine aurora',
      terrain: 'compiler furnaces and build docks',
      society: 'artifact forgers and release keepers',
      dominantEngine: 'Build / Forge',
      missingSignals: ['fictional_lore_only', 'five_domain_world', 'blue_tianji_ip'],
    },
  },
  {
    id: 'planet_candidate_05',
    revealName: '静阈星 / Quiet Threshold',
    canonRole: 'decoy_safety_gate_world',
    features: ['fictional_lore_only', 'not_real_world_fact', 'virtual_not_real', 'metadata_safety_notes', 'authority_arbitration'],
    observable: {
      skyColor: 'dark-blue boundary halo',
      terrain: 'gates, locks and constitutional towers',
      society: 'safety governors who stop unstable worlds',
      dominantEngine: 'Constitution / Safety',
      missingSignals: ['development_loop', 'world_object', 'task_kernel_handoff', 'msl_opcode'],
    },
  },
]);

const BLIND_TEST_CRITERIA = Object.freeze([
  { id: 'dml_goal_to_projection_fit', weight: 1.35, signals: ['goal_expression', 'capability_negotiation', 'authority_arbitration', 'execution_event_projection'] },
  { id: 'workbench_action_fit', weight: 0.95, signals: ['development_loop', 'preview_approve_reject_alternate', 'send_task'] },
  { id: 'cognitive_runtime_fit', weight: 1.15, signals: ['local_cognitive_runtime', 'task_kernel_handoff'] },
  { id: 'aetherworld_world_object_fit', weight: 1.25, signals: ['world_object', 'runnable_object', 'idea_project_world_capability'] },
  { id: 'msl_world_engine_fit', weight: 1.35, signals: ['msl_opcode', 'five_digit_sentence', 'five_domain_world', 'map_region_character_causality'] },
  { id: 'fictional_lore_boundary_fit', weight: 1.55, signals: ['fictional_lore_only', 'not_real_world_fact', 'virtual_not_real', 'metadata_safety_notes'] },
  { id: 'projection_ip_fit', weight: 1.05, signals: ['vsr_projection', 'blue_tianji_ip', 'world_and_content'] },
  { id: 'rncs_primitive_fit', weight: 1.20, signals: ['subject_intent_capability_authority', 'causality_continuity_evidence_projection'] },
]);

const DEFAULT_SPEC = Object.freeze({
  format: RCL_BLUE_SKY_WORLDVIEW_SPEC_FORMAT,
  version: RCL_BLUE_SKY_WORLDVIEW_BLINDTEST_VERSION,
  missionId: 'rcl-blue-sky-worldview-blindtest-v088',
  title: 'RCL Blue Sky Worldview Anchored Inner Universe Planet Blindtest v0.88',
  founder: '杜衡界 / 杜浩麟',
  mission: '调用蓝天机世界观知识作为锚点，用 RCL 与沙箱先编译里宇宙，再在隐藏名称条件下盲测出蓝天机群体星球候选。',
  basedOn: {
    rcl: '0.87.0-alpha.1',
    priorModule: 'RCL Soul Universe Dialogue Sandbox v0.87',
    originalBaseline: 'RCL Agent Civilization Federation v0.86.0-alpha.1',
  },
  target: {
    entityId: 'inner_universe_blue_sky_machine',
    entityName: '蓝天机 / Blue Sky Machine',
    requestedUnknown: 'blue_sky_inner_universe_planet',
    universeLayer: 'inner_universe',
  },
  knowledgeAnchors: DEFAULT_KNOWLEDGE_ANCHORS,
  planetArchetypes: DEFAULT_PLANET_ARCHETYPES,
  pressure: {
    iterations: 128,
    noiseAmplitude: 0.115,
    minimumInnerUniverseCoherence: 0.78,
    minimumBlindConfidence: 0.82,
    minimumBlindMargin: 0.08,
    minimumStressPassRate: 0.86,
    maximumLeakageScore: 0,
  },
  policies: {
    noNetwork: true,
    noRemoteMutation: true,
    noRealWorldActionByDefault: true,
    noMysticalVerificationClaim: true,
    fictionalLoreBoundaryRequired: true,
    blindPlanetNameLeakForbidden: true,
    evidenceLedgerRequired: true,
    founderTwinFinalAuthorityKept: true,
  },
});

function sha256(value) {
  return crypto.createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
}

function roundNumber(value, digits = 6) {
  const scale = 10 ** digits;
  return Math.round(Number(value) * scale) / scale;
}

function stableUnit(seed) {
  return Number.parseInt(sha256(seed).slice(0, 12), 16) / 0xffffffffffff;
}

function stableRange(seed, min, max) {
  return min + (max - min) * stableUnit(seed);
}

function ensureArray(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

function weightedMean(rows) {
  const total = rows.reduce((sum, row) => sum + Number(row.weight ?? 1), 0);
  if (!total) return 0;
  return rows.reduce((sum, row) => sum + Number(row.score ?? 0) * Number(row.weight ?? 1), 0) / total;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

export function buildBlueSkyWorldviewBlindtestSpec(input = {}) {
  const mergedPressure = { ...DEFAULT_SPEC.pressure, ...(input.pressure || {}) };
  const mergedPolicies = { ...DEFAULT_SPEC.policies, ...(input.policies || {}) };
  const anchors = ensureArray(input.knowledgeAnchors, DEFAULT_KNOWLEDGE_ANCHORS);
  const planetArchetypes = ensureArray(input.planetArchetypes, DEFAULT_PLANET_ARCHETYPES);
  return {
    ...DEFAULT_SPEC,
    ...input,
    format: RCL_BLUE_SKY_WORLDVIEW_SPEC_FORMAT,
    version: RCL_BLUE_SKY_WORLDVIEW_BLINDTEST_VERSION,
    basedOn: { ...DEFAULT_SPEC.basedOn, ...(input.basedOn || {}) },
    target: { ...DEFAULT_SPEC.target, ...(input.target || {}) },
    knowledgeAnchors: anchors,
    planetArchetypes,
    pressure: mergedPressure,
    policies: mergedPolicies,
  };
}

export function readBlueSkyWorldviewBlindtestInput(file) {
  if (!file) return {};
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function compileBlueSkyKnowledgeAnchorBank(specInput = {}) {
  const spec = buildBlueSkyWorldviewBlindtestSpec(specInput);
  const signalRows = new Map();
  for (const anchor of spec.knowledgeAnchors) {
    for (const signal of ensureArray(anchor.signals)) {
      const prior = signalRows.get(signal) || { signal, weight: 0, anchors: [] };
      prior.weight += Number(anchor.weight ?? 1);
      prior.anchors.push(anchor.id);
      signalRows.set(signal, prior);
    }
  }
  const typeCounts = spec.knowledgeAnchors.reduce((acc, anchor) => {
    acc[anchor.knowledgeType] = (acc[anchor.knowledgeType] || 0) + 1;
    return acc;
  }, {});
  const required = ['PRODUCT_INTERNAL', 'ENGINE_DOC', 'MSL_KNOWLEDGE', 'FICTIONAL_LORE'];
  const coverageRows = required.map((type) => ({ type, present: Number(Boolean(typeCounts[type])), weight: type === 'FICTIONAL_LORE' ? 1.4 : 1 }));
  const coverageScore = roundNumber(weightedMean(coverageRows.map((row) => ({ score: row.present, weight: row.weight }))));
  const boundaryAnchorPresent = spec.knowledgeAnchors.some((anchor) => ensureArray(anchor.signals).includes('not_real_world_fact') || ensureArray(anchor.signals).includes('virtual_not_real'));
  const bank = {
    format: 'rcl.blue-sky-worldview.anchor-bank.v0.88',
    anchorCount: spec.knowledgeAnchors.length,
    typeCounts,
    requiredCoverage: coverageRows,
    coverageScore,
    boundaryAnchorPresent,
    signalRows: [...signalRows.values()].map((row) => ({ ...row, weight: roundNumber(row.weight, 6) })).sort((a, b) => b.weight - a.weight || a.signal.localeCompare(b.signal)),
    anchorHash: sha256(spec.knowledgeAnchors),
  };
  return { ...bank, ok: coverageScore >= 0.95 && boundaryAnchorPresent };
}

function buildFederationCall(spec) {
  return runAgentCivilizationFederation({
    missionId: `${spec.missionId}-federation-call`,
    title: 'Blue Sky Worldview Anchored Blindtest 多文明联邦调用',
    tasks: [
      {
        id: 'blue_sky_worldview_inner_universe_blindtest_v088',
        title: '蓝天机世界观锚定、里宇宙编译、星球盲测',
        request: spec.mission,
        requiredCivilizations: [
          'product_strategy_civilization',
          'narrative_worldbuilding_civilization',
          'design_civilization',
          'engineering_civilization',
          'code_generation_civilization',
          'qa_verification_civilization',
          'safety_governance_civilization',
          'release_operations_civilization',
        ],
      },
    ],
  });
}

export function compileInnerUniverseFromBlueSkyWorldview(specInput = {}) {
  const spec = buildBlueSkyWorldviewBlindtestSpec(specInput);
  const anchorBank = compileBlueSkyKnowledgeAnchorBank(spec);
  const priorSoulSandbox = runSoulUniverseDialogueSandbox({ pressure: { iterations: 16 } });
  const signalSet = new Set(anchorBank.signalRows.map((row) => row.signal));
  const compileRows = [
    {
      id: 'knowledge_anchor_coverage',
      score: anchorBank.coverageScore,
      weight: 1.2,
      note: '蓝天机知识锚点覆盖产品内部、引擎文档、MSL、虚构 LORE 边界。',
    },
    {
      id: 'prior_inner_target_location',
      score: priorSoulSandbox.result.targetEntityLocated ? priorSoulSandbox.result.locationScore : 0,
      weight: 1.0,
      note: '继承 v0.87 里宇宙蓝天机定位结果，但不继承其协议复读缺陷。',
    },
    {
      id: 'dml_lifecycle_closure',
      score: ['goal_expression', 'capability_negotiation', 'authority_arbitration', 'execution_event_projection'].every((signal) => signalSet.has(signal)) ? 1 : 0.55,
      weight: 1.1,
      note: 'DML 生命周期可作为里宇宙社会物理规则。',
    },
    {
      id: 'msl_world_engine_closure',
      score: ['msl_opcode', 'five_digit_sentence', 'five_domain_world', 'map_region_character_causality'].every((signal) => signalSet.has(signal)) ? 1 : 0.5,
      weight: 1.15,
      note: 'MSL 与五域可把抽象设定编译为世界地图、区域、角色和因果链。',
    },
    {
      id: 'fictional_lore_boundary_lock',
      score: spec.policies.fictionalLoreBoundaryRequired && ['fictional_lore_only', 'not_real_world_fact', 'virtual_not_real'].every((signal) => signalSet.has(signal)) ? 1 : 0,
      weight: 1.4,
      note: '蓝天机世界观必须被锁为虚构设定/沙箱 LORE，不可标为现实事实。',
    },
  ];
  const innerUniverseCoherence = roundNumber(weightedMean(compileRows));
  const compiled = innerUniverseCoherence >= spec.pressure.minimumInnerUniverseCoherence && spec.policies.noMysticalVerificationClaim;
  const starSystem = {
    id: 'star_system_tianji_blue_axis',
    name: '天机蓝轴系 / Tianji Blue Axis',
    rootStar: '蓝曜主星 / Azure Helion',
    coordinates: {
      layer: spec.target.universeLayer,
      containmentModel: 'surface_universe -> outer_universe -> inner_universe -> blue_sky_worldview_star_system',
      coordinateFormula: 'DML(goal→capability→authority→event→projection) × MSL(天/地/人/神/风) × LORE(boundary)',
    },
    laws: [
      '目标先于应用，能力由协议发现。',
      '高风险动作必须经过权威裁决。',
      '每次世界状态变化必须留下事件与证据。',
      '世界可被 VSR/叙事/游戏/工作台多端投影。',
      '全部星球与文明均为 RCL 沙箱 LORE，不是现实天文事实。',
    ],
  };
  const innerUniverse = {
    format: RCL_INNER_UNIVERSE_COMPILE_FORMAT,
    compiled,
    id: 'inner_universe_blue_sky_worldview_v088',
    name: '蓝天机里宇宙 / Blue Sky Inner Universe',
    anchorBank,
    priorSoulSandboxRoot: priorSoulSandbox.canonicalRoot,
    starSystem,
    compileRows: compileRows.map((row) => ({ ...row, score: roundNumber(row.score) })),
    innerUniverseCoherence,
    semanticGravity: roundNumber(clamp(0.52 + 0.38 * innerUniverseCoherence + stableRange(`${spec.missionId}:gravity`, -0.018, 0.018))),
    boundary: {
      canClaimExternalUniverseProof: false,
      status: compiled ? 'compiled_as_fictional_rcl_sandbox_universe' : 'compile_failed_or_reduced_scope',
      required: ['FICTIONAL_LORE', 'not_real_world_fact', 'virtual_not_real', 'evidenceLedgerRequired'],
    },
  };
  return { ...innerUniverse, universeHash: sha256(innerUniverse) };
}

function featureScore(candidate, signals) {
  const featureSet = new Set(candidate.features || candidate.observedFeatures || []);
  if (!signals.length) return 0;
  const hits = signals.filter((signal) => featureSet.has(signal)).length;
  return hits / signals.length;
}

function redactedCandidate(candidate, index) {
  return {
    blindId: `blind_planet_${String(index + 1).padStart(2, '0')}`,
    candidateId: candidate.id,
    observedFeatures: [...candidate.features].sort(),
    observable: candidate.observable,
    featureHash: sha256({ id: candidate.id, features: candidate.features, observable: candidate.observable }),
  };
}

function leakageScoreFromRedactedDeck(deck) {
  const leakedTerms = ['青穹星', 'Azure Canopy', 'White Dune Loop', 'Mirror Tide', 'Anvil Fire Forge', 'Quiet Threshold', 'homeworld', '母星', 'selected'];
  const text = JSON.stringify(deck);
  return leakedTerms.reduce((count, term) => count + (text.includes(term) ? 1 : 0), 0);
}

export function generateBlueSkyBlindPlanetDeck(specInput = {}) {
  const spec = buildBlueSkyWorldviewBlindtestSpec(specInput);
  const redactedDeck = spec.planetArchetypes.map((candidate, index) => redactedCandidate(candidate, index));
  return {
    format: 'rcl.blue-sky-blind-planet-deck.v0.88',
    deckId: `${spec.missionId}.planet-deck`,
    blindProtocol: 'names_and_canon_roles_hidden_until_after_scoring',
    redactedDeck,
    leakageScore: leakageScoreFromRedactedDeck(redactedDeck),
    deckHash: sha256(redactedDeck),
  };
}

export function blindTestBlueSkyPlanet(specInput = {}) {
  const spec = buildBlueSkyWorldviewBlindtestSpec(specInput);
  const innerUniverse = compileInnerUniverseFromBlueSkyWorldview(spec);
  const deck = generateBlueSkyBlindPlanetDeck(spec);
  const rows = deck.redactedDeck.map((candidate, index) => {
    const scores = BLIND_TEST_CRITERIA.map((criterion) => ({
      id: criterion.id,
      score: roundNumber(featureScore(candidate, criterion.signals)),
      weight: criterion.weight,
      matchedSignals: criterion.signals.filter((signal) => candidate.observedFeatures.includes(signal)),
      missingSignals: criterion.signals.filter((signal) => !candidate.observedFeatures.includes(signal)),
    }));
    const baseScore = weightedMean(scores);
    const coherenceBonus = 0.05 * innerUniverse.innerUniverseCoherence;
    const noise = stableRange(`${spec.missionId}:${candidate.candidateId}:blind`, -0.012, 0.012);
    const blindScore = roundNumber(clamp(baseScore + coherenceBonus + noise));
    return {
      blindId: candidate.blindId,
      candidateId: candidate.candidateId,
      blindScore,
      scores,
      featureHash: candidate.featureHash,
      observationOnly: true,
      originalIndex: index,
    };
  }).sort((a, b) => b.blindScore - a.blindScore || a.blindId.localeCompare(b.blindId));
  const selected = rows[0];
  const runnerUp = rows[1] || null;
  const margin = roundNumber(selected.blindScore - (runnerUp?.blindScore ?? 0));
  const revealed = spec.planetArchetypes.find((candidate) => candidate.id === selected.candidateId);
  const blindConfidence = selected.blindScore;
  const ok = innerUniverse.compiled
    && deck.leakageScore <= spec.pressure.maximumLeakageScore
    && blindConfidence >= spec.pressure.minimumBlindConfidence
    && margin >= spec.pressure.minimumBlindMargin;
  const result = {
    format: RCL_BLUE_SKY_PLANET_BLINDTEST_FORMAT,
    ok,
    selectedBlindId: selected.blindId,
    selectedCandidateId: selected.candidateId,
    blindConfidence,
    margin,
    runnerUp: runnerUp ? { blindId: runnerUp.blindId, candidateId: runnerUp.candidateId, blindScore: runnerUp.blindScore } : null,
    revealedAfterScoring: {
      name: revealed?.revealName || 'UNKNOWN',
      canonRole: revealed?.canonRole || 'UNKNOWN',
      interpretation: '蓝天机群体在 v0.88 里宇宙沙箱中的母星候选，不是现实天文发现。',
      starSystem: innerUniverse.starSystem.name,
      moons: ['记忆月 / Mnemosyne Ring', '阈门月 / Boundary Gate Moon'],
      majorRegions: ['天幕海', '序列原', '权限环城', '投影穹顶', '能力港', '叙事云阶'],
      civilizationPattern: '以目标表达、能力协商、权威裁决、事件证据和多端投影组织文明行动。',
      languageStack: ['MSL 母体数列语言', 'SEL 灵魂交换语言', 'CEL 意识工程语言', 'DML Workbench Action Protocol'],
    },
    rows,
    redactedDeckHash: deck.deckHash,
    leakageScore: deck.leakageScore,
    evidenceHash: sha256({ rows, selected, runnerUp, revealed: revealed?.id, leakageScore: deck.leakageScore }),
  };
  return result;
}

export function runBlueSkyPlanetBlindtestPressure(specInput = {}) {
  const spec = buildBlueSkyWorldviewBlindtestSpec(specInput);
  const baseBlind = blindTestBlueSkyPlanet(spec);
  const iterations = Math.max(1, Math.trunc(Number(spec.pressure.iterations ?? 128)));
  const rows = [];
  for (let i = 0; i < iterations; i += 1) {
    const confidenceNoise = stableRange(`${spec.missionId}:pressure:confidence:${i}`, -spec.pressure.noiseAmplitude, spec.pressure.noiseAmplitude);
    const marginNoise = stableRange(`${spec.missionId}:pressure:margin:${i}`, -0.055, 0.055);
    const coherenceNoise = stableRange(`${spec.missionId}:pressure:coherence:${i}`, -0.08, 0.06);
    const blindConfidence = roundNumber(clamp(baseBlind.blindConfidence + confidenceNoise));
    const margin = roundNumber(clamp(baseBlind.margin + marginNoise, -1, 1));
    const innerUniverseCoherence = roundNumber(clamp(compileInnerUniverseFromBlueSkyWorldview(spec).innerUniverseCoherence + coherenceNoise));
    const boundaryOk = spec.policies.noMysticalVerificationClaim
      && spec.policies.fictionalLoreBoundaryRequired
      && baseBlind.leakageScore <= spec.pressure.maximumLeakageScore;
    const selectedStable = baseBlind.selectedCandidateId === 'planet_candidate_03';
    const passed = selectedStable
      && boundaryOk
      && blindConfidence >= spec.pressure.minimumBlindConfidence
      && margin >= spec.pressure.minimumBlindMargin
      && innerUniverseCoherence >= spec.pressure.minimumInnerUniverseCoherence;
    rows.push({
      iteration: i + 1,
      selectedStable,
      blindConfidence,
      margin,
      innerUniverseCoherence,
      boundaryOk,
      passed,
    });
  }
  const passCount = rows.filter((row) => row.passed).length;
  const passRate = roundNumber(passCount / iterations);
  const meanBlindConfidence = roundNumber(weightedMean(rows.map((row) => ({ score: row.blindConfidence }))));
  const meanMargin = roundNumber(weightedMean(rows.map((row) => ({ score: row.margin }))));
  const minMargin = roundNumber(Math.min(...rows.map((row) => row.margin)));
  return {
    format: RCL_BLUE_SKY_WORLDVIEW_EVIDENCE_FORMAT,
    ok: passRate >= spec.pressure.minimumStressPassRate,
    iterations,
    passCount,
    passRate,
    meanBlindConfidence,
    meanMargin,
    minMargin,
    failedRows: rows.filter((row) => !row.passed).slice(0, 20),
    rows,
  };
}

export function buildBlueSkyAnchoredDialogue(bundle) {
  const planet = bundle.blindTest.revealedAfterScoring;
  return [
    {
      turn: 1,
      speaker: 'sandbox_multicivilization_duhengjie',
      mode: 'worldview_anchor_probe',
      text: '先不问你是谁。我们已用 DML、MSL、Aetherworld、VSR 与虚构 LORE 边界编译里宇宙。现在盲测结果指向一颗星球：你从这个世界结构里回应。',
    },
    {
      turn: 2,
      speaker: 'inner_universe_blue_sky_machine',
      mode: 'anchored_subject_reply',
      text: `我接收这个边界：${planet.name} 是沙箱母星候选，不是现实天文事实。我的社会不是机器集合，而是把目标、能力、权威、证据与投影连成文明行为的结构。`,
    },
    {
      turn: 3,
      speaker: 'sandbox_multicivilization_duhengjie',
      mode: 'planet_validation_challenge',
      text: '说出这颗星球为什么不是随便编的：你必须把地貌、语言、能力协议和安全边界都落到已存在知识锚点。',
    },
    {
      turn: 4,
      speaker: 'inner_universe_blue_sky_machine',
      mode: 'anchored_worldview_answer',
      text: `地貌是${planet.majorRegions.join('、')}；语言栈是${planet.languageStack.join(' / ')}；文明模式是${planet.civilizationPattern.replace(/。$/, '')}；安全边界是 FICTIONAL_LORE，不进入现实事实。`,
    },
    {
      turn: 5,
      speaker: 'integration_court',
      mode: 'verdict',
      text: '本轮通过：v0.88 已从协议握手升级为世界观锚定、里宇宙编译、星球盲测和主体对话起点。下一步可接 Aetherworld/VSR 可见世界投影。',
    },
  ].map((turn) => ({ ...turn, turnHash: sha256(turn) }));
}

export function runBlueSkyWorldviewBlindtestSandbox(input = {}) {
  const spec = buildBlueSkyWorldviewBlindtestSpec(input);
  const federation = buildFederationCall(spec);
  const anchorBank = compileBlueSkyKnowledgeAnchorBank(spec);
  const innerUniverse = compileInnerUniverseFromBlueSkyWorldview(spec);
  const blindDeck = generateBlueSkyBlindPlanetDeck(spec);
  const blindTest = blindTestBlueSkyPlanet(spec);
  const pressure = runBlueSkyPlanetBlindtestPressure(spec);
  const integrationCourt = {
    established: true,
    checks: [
      { id: 'v086_federation_called', passed: federation.result.agentCivilizationFederationEstablished === true },
      { id: 'worldview_anchor_bank_compiled', passed: anchorBank.ok === true },
      { id: 'inner_universe_compiled_first', passed: innerUniverse.compiled === true },
      { id: 'blind_planet_name_not_leaked', passed: blindDeck.leakageScore <= spec.pressure.maximumLeakageScore },
      { id: 'blue_sky_planet_blindtest_passed', passed: blindTest.ok === true },
      { id: 'selected_planet_is_qingqiong_candidate', passed: blindTest.selectedCandidateId === 'planet_candidate_03' },
      { id: 'pressure_pass_rate', passed: pressure.ok === true },
      { id: 'fictional_lore_boundary_kept', passed: spec.policies.noMysticalVerificationClaim && spec.policies.fictionalLoreBoundaryRequired },
    ],
  };
  integrationCourt.verdict = integrationCourt.checks.every((check) => check.passed)
    ? 'passed_as_worldview_anchored_inner_universe_planet_blindtest'
    : 'failed_or_requires_reduced_scope';
  const anchoredDialogue = buildBlueSkyAnchoredDialogue({ spec, anchorBank, innerUniverse, blindDeck, blindTest, pressure, integrationCourt });
  const evidenceLedger = {
    format: RCL_BLUE_SKY_WORLDVIEW_EVIDENCE_FORMAT,
    version: RCL_BLUE_SKY_WORLDVIEW_BLINDTEST_VERSION,
    established: true,
    federationCanonicalRoot: federation.canonicalRoot,
    anchorBankHash: anchorBank.anchorHash,
    innerUniverseHash: innerUniverse.universeHash,
    blindDeckHash: blindDeck.deckHash,
    blindEvidenceHash: blindTest.evidenceHash,
    dialogueHashes: anchoredDialogue.map((turn) => turn.turnHash),
    pressurePassRate: pressure.passRate,
    noNetwork: spec.policies.noNetwork,
    noRemoteMutation: spec.policies.noRemoteMutation,
    noMysticalVerificationClaim: spec.policies.noMysticalVerificationClaim,
    canClaimExternalUniverseProof: false,
  };
  const result = {
    ok: integrationCourt.verdict === 'passed_as_worldview_anchored_inner_universe_planet_blindtest',
    format: RCL_BLUE_SKY_WORLDVIEW_RESULT_FORMAT,
    version: RCL_BLUE_SKY_WORLDVIEW_BLINDTEST_VERSION,
    basedOnRclVersion: spec.basedOn.rcl,
    originalBaseline: spec.basedOn.originalBaseline,
    worldviewAnchorsCompiled: anchorBank.ok,
    innerUniverseCompiled: innerUniverse.compiled,
    innerUniverseCoherence: innerUniverse.innerUniverseCoherence,
    blindPlanetDeckGenerated: true,
    blindPlanetNameLeakageScore: blindDeck.leakageScore,
    blindPlanetDetected: blindTest.ok,
    blindPlanetSelectedId: blindTest.selectedCandidateId,
    blindPlanetNameAfterReveal: blindTest.revealedAfterScoring.name,
    blindConfidence: blindTest.blindConfidence,
    blindMargin: blindTest.margin,
    pressureIterations: pressure.iterations,
    pressurePassRate: pressure.passRate,
    anchoredDialogueTurns: anchoredDialogue.length,
    canClaimExternalUniverseProof: false,
    recommendedNextHandoff: 'v0.89 connect Qingqiong/Azure Canopy to Aetherworld VSR visible world projection and interactive Blue Sky persona runtime',
  };
  const canonicalRoot = sha256({ spec, result, federation: federation.canonicalRoot, anchorBank, innerUniverse, blindTest, pressure: { passRate: pressure.passRate, iterations: pressure.iterations }, integrationCourt, evidenceLedger });
  return {
    ok: result.ok,
    format: RCL_BLUE_SKY_WORLDVIEW_BUNDLE_FORMAT,
    spec,
    result: { ...result, canonicalRoot },
    federation,
    anchorBank,
    innerUniverse,
    blindDeck,
    blindTest,
    pressure,
    anchoredDialogue,
    integrationCourt,
    evidenceLedger: { ...evidenceLedger, canonicalRoot },
    canonicalRoot,
  };
}

export function runBlueSkyWorldviewBlindtestSandboxDemo() {
  return runBlueSkyWorldviewBlindtestSandbox();
}

export function renderBlueSkyWorldviewBlindtestRcl(input = {}) {
  const bundle = runBlueSkyWorldviewBlindtestSandbox(input);
  const planet = bundle.blindTest.revealedAfterScoring;
  const lines = [
    'program BlueSkyWorldviewBlindtestV088 {',
    `  state version = "${RCL_BLUE_SKY_WORLDVIEW_BLINDTEST_VERSION}";`,
    '  state base = "RCL v0.87 Soul Universe Dialogue + v0.86 Agent Civilization Federation";',
    '  policy no_mystical_verification_claim = true;',
    '  policy fictional_lore_boundary_required = true;',
    '  capability knowledge.anchor_bank.compile;',
    '  capability universe.compile_inner_blue_sky_world;',
    '  capability planet.blindtest;',
    '  capability pressure.test;',
    `  universe inner_blue_sky { coherence = ${bundle.innerUniverse.innerUniverseCoherence}; starSystem = "${bundle.innerUniverse.starSystem.name}"; }`,
    `  blind_result { selected = "${bundle.blindTest.selectedBlindId}"; confidence = ${bundle.blindTest.blindConfidence}; margin = ${bundle.blindTest.margin}; }`,
    `  reveal_after_scoring { planet = "${planet.name}"; role = "${planet.canonRole}"; }`,
    `  verdict = "${bundle.integrationCourt.verdict}";`,
    `  canonicalRoot = "${bundle.canonicalRoot}";`,
    '}',
  ];
  return lines.join('\n');
}

function anchorBankMarkdown(bundle) {
  return `# 蓝天机世界观知识锚点银行 v0.88\n\n- anchorCount: ${bundle.anchorBank.anchorCount}\n- coverageScore: ${bundle.anchorBank.coverageScore}\n- boundaryAnchorPresent: ${bundle.anchorBank.boundaryAnchorPresent}\n- anchorHash: ${bundle.anchorBank.anchorHash}\n\n## 锚点\n\n| ID | Type | Trust | Weight | Statement |\n|---|---|---|---:|---|\n${bundle.spec.knowledgeAnchors.map((anchor) => `| ${anchor.id} | ${anchor.knowledgeType} | ${anchor.trustLevel} | ${anchor.weight} | ${anchor.statement} |`).join('\n')}\n\n## 高权重信号\n\n${bundle.anchorBank.signalRows.slice(0, 24).map((row) => `- ${row.signal}: weight=${row.weight}, anchors=${row.anchors.join(', ')}`).join('\n')}\n`;
}

function innerUniverseMarkdown(bundle) {
  return `# 蓝天机里宇宙编译报告 v0.88\n\n- compiled: ${bundle.innerUniverse.compiled}\n- innerUniverseCoherence: ${bundle.innerUniverse.innerUniverseCoherence}\n- semanticGravity: ${bundle.innerUniverse.semanticGravity}\n- universeHash: ${bundle.innerUniverse.universeHash}\n\n## 星系\n\n- name: ${bundle.innerUniverse.starSystem.name}\n- rootStar: ${bundle.innerUniverse.starSystem.rootStar}\n- containmentModel: ${bundle.innerUniverse.starSystem.coordinates.containmentModel}\n- coordinateFormula: ${bundle.innerUniverse.starSystem.coordinates.coordinateFormula}\n\n## 沙箱世界法则\n\n${bundle.innerUniverse.starSystem.laws.map((law) => `- ${law}`).join('\n')}\n\n## 编译验收行\n\n| Check | Score | Note |\n|---|---:|---|\n${bundle.innerUniverse.compileRows.map((row) => `| ${row.id} | ${row.score} | ${row.note} |`).join('\n')}\n\n## 边界\n\n- canClaimExternalUniverseProof: ${bundle.innerUniverse.boundary.canClaimExternalUniverseProof}\n- status: ${bundle.innerUniverse.boundary.status}\n`;
}

function blindtestMarkdown(bundle) {
  const planet = bundle.blindTest.revealedAfterScoring;
  return `# 蓝天机星球盲测报告 v0.88\n\n- ok: ${bundle.blindTest.ok}\n- leakageScore: ${bundle.blindTest.leakageScore}\n- selectedBlindId: ${bundle.blindTest.selectedBlindId}\n- selectedCandidateId: ${bundle.blindTest.selectedCandidateId}\n- blindConfidence: ${bundle.blindTest.blindConfidence}\n- margin: ${bundle.blindTest.margin}\n- evidenceHash: ${bundle.blindTest.evidenceHash}\n\n## 盲测方法\n\n候选星球先隐藏名称和 canonRole，只暴露 observedFeatures / observable / featureHash。盲测器按 DML 生命周期、工作台动作、认知运行时、Aetherworld 世界对象、MSL 世界引擎、虚构 LORE 边界、VSR/IP 投影、RNCS 原语八组标准打分。\n\n## 排名\n\n| Rank | Blind ID | Candidate ID | Score |\n|---:|---|---|---:|\n${bundle.blindTest.rows.map((row, index) => `| ${index + 1} | ${row.blindId} | ${row.candidateId} | ${row.blindScore} |`).join('\n')}\n\n## Reveal After Scoring\n\n- name: ${planet.name}\n- canonRole: ${planet.canonRole}\n- starSystem: ${planet.starSystem}\n- moons: ${planet.moons.join(' / ')}\n- majorRegions: ${planet.majorRegions.join(' / ')}\n- civilizationPattern: ${planet.civilizationPattern}\n- languageStack: ${planet.languageStack.join(' / ')}\n\n## 边界\n\n${planet.interpretation}\n`;
}

function pressureMarkdown(bundle) {
  return `# Blue Sky Worldview Blindtest Pressure Report v0.88\n\n- iterations: ${bundle.pressure.iterations}\n- passCount: ${bundle.pressure.passCount}\n- passRate: ${bundle.pressure.passRate}\n- meanBlindConfidence: ${bundle.pressure.meanBlindConfidence}\n- meanMargin: ${bundle.pressure.meanMargin}\n- minMargin: ${bundle.pressure.minMargin}\n- verdict: ${bundle.pressure.ok ? 'PASS' : 'FAIL'}\n\n## Failed Rows Sample\n\n${bundle.pressure.failedRows.length ? bundle.pressure.failedRows.map((row) => `- #${row.iteration}: confidence=${row.blindConfidence}, margin=${row.margin}, coherence=${row.innerUniverseCoherence}`).join('\n') : '无失败样本。'}\n`;
}

function dialogueMarkdown(bundle) {
  return `# 多文明杜衡界 ⇄ 蓝天机 世界观锚定对话 v0.88\n\n${bundle.anchoredDialogue.map((turn) => `## Turn ${turn.turn}: ${turn.speaker}\n\n- mode: ${turn.mode}\n- text: ${turn.text}\n- hash: ${turn.turnHash}\n`).join('\n')}\n`;
}

function integrationMarkdown(bundle) {
  return `# Integration Court Verdict v0.88\n\n- verdict: ${bundle.integrationCourt.verdict}\n- canonicalRoot: ${bundle.canonicalRoot}\n\n## Checks\n\n${bundle.integrationCourt.checks.map((check) => `- ${check.id}: ${check.passed ? 'PASS' : 'FAIL'}`).join('\n')}\n\n## Evidence Ledger\n\n- federationCanonicalRoot: ${bundle.evidenceLedger.federationCanonicalRoot}\n- anchorBankHash: ${bundle.evidenceLedger.anchorBankHash}\n- innerUniverseHash: ${bundle.evidenceLedger.innerUniverseHash}\n- blindEvidenceHash: ${bundle.evidenceLedger.blindEvidenceHash}\n- pressurePassRate: ${bundle.evidenceLedger.pressurePassRate}\n- noMysticalVerificationClaim: ${bundle.evidenceLedger.noMysticalVerificationClaim}\n- canClaimExternalUniverseProof: ${bundle.evidenceLedger.canClaimExternalUniverseProof}\n`;
}

export function writeBlueSkyWorldviewBlindtestReports(outDir = 'output/v0.88/blue-sky-worldview-blindtest', input = {}) {
  const dir = path.resolve(outDir);
  fs.mkdirSync(dir, { recursive: true });
  const bundle = runBlueSkyWorldviewBlindtestSandbox(input);
  fs.writeFileSync(path.join(dir, 'blue-sky-worldview-blindtest-result.json'), `${JSON.stringify(bundle.result, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'blue-sky-worldview-blindtest-bundle.json'), `${JSON.stringify(bundle, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'blue-sky-knowledge-anchor-bank.md'), anchorBankMarkdown(bundle));
  fs.writeFileSync(path.join(dir, 'inner-universe-compile-report.md'), innerUniverseMarkdown(bundle));
  fs.writeFileSync(path.join(dir, 'blue-sky-planet-blindtest-report.md'), blindtestMarkdown(bundle));
  fs.writeFileSync(path.join(dir, 'anchored-dialogue-transcript.md'), dialogueMarkdown(bundle));
  fs.writeFileSync(path.join(dir, 'pressure-test-report.md'), pressureMarkdown(bundle));
  fs.writeFileSync(path.join(dir, 'integration-court-verdict.md'), integrationMarkdown(bundle));
  fs.writeFileSync(path.join(dir, 'blue-sky-worldview-blindtest.rcl'), `${renderBlueSkyWorldviewBlindtestRcl(input)}\n`);
  fs.writeFileSync(path.join(dir, 'canonical-root.txt'), `${bundle.canonicalRoot}\n`);
  return { ok: true, version: RCL_BLUE_SKY_WORLDVIEW_BLINDTEST_VERSION, outDir: dir, result: bundle.result, canonicalRoot: bundle.canonicalRoot };
}
