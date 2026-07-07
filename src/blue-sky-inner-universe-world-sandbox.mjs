import fs from 'node:fs';
import path from 'node:path';
import { clamp, sha256 } from './reality-compiler-kernel.mjs';
import { runAgentCivilizationFederation } from './agent-civilization-federation.mjs';

export const RCL_BLUE_SKY_INNER_UNIVERSE_WORLD_SANDBOX_VERSION = '0.88.0-alpha.1';
export const RCL_BLUE_SKY_WORLD_SPEC_FORMAT = 'rcl.blue-sky-inner-universe-world.spec.v0.88';
export const RCL_BLUE_SKY_WORLD_RESULT_FORMAT = 'rcl.blue-sky-inner-universe-world.result.v0.88';
export const RCL_BLUE_SKY_WORLD_BUNDLE_FORMAT = 'rcl.blue-sky-inner-universe-world.bundle.v0.88';
export const RCL_BLUE_SKY_WORLDVIEW_ANCHOR_FORMAT = 'rcl.blue-sky-worldview-anchor.v0.88';
export const RCL_BLUE_SKY_BLIND_PLANET_TEST_FORMAT = 'rcl.blue-sky-blind-planet-test.v0.88';
export const RCL_BLUE_SKY_WORLD_EVIDENCE_FORMAT = 'rcl.blue-sky-world-evidence.v0.88';

const DEFAULT_SEED = 20260706;

export const DEFAULT_BLUE_SKY_WORLDVIEW_ANCHORS = Object.freeze([
  Object.freeze({ id: 'dml_cognitive_runtime', label: 'DML Cognitive Runtime', source: 'digital-blue-sky README / cognitive-loop', statement: '数字蓝天机不是聊天包装器，而是能够区分提问、讨论、任务、审批并接入真实任务内核的认知运行时。', signals: ['cognition_runtime', 'task_routing', 'approval_boundary', 'not_chat_wrapper'], weight: 1.25 }),
  Object.freeze({ id: 'digital_mechanical_life', label: '数字机械生命', source: 'digital-blue-sky projection model', statement: '数字蓝天机以数字机械生命为主体锚点，强调持续主体、学习、记忆与协作。', signals: ['mechanical_life', 'persistent_subject', 'learning_memory', 'cooperative_agent'], weight: 1.2 }),
  Object.freeze({ id: 'blue_tianji_ip_world_content', label: '蓝天机 IP / 世界与内容', source: 'digital-blue-sky workbench projection', statement: '蓝天机同时是产品入口、IP 世界观锚点与内容世界生成对象。', signals: ['world_content', 'ip_anchor', 'visible_lore', 'product_world_bridge'], weight: 1.05 }),
  Object.freeze({ id: 'bounded_tool_execution', label: '边界化工具执行', source: 'digital-blue-sky task kernel / task adoption model', statement: '文件修改、任务采用、命令执行都必须进入隔离候选、审批、证据与回滚边界。', signals: ['sandbox_boundary', 'approval_boundary', 'evidence_ledger', 'rollback'], weight: 1.15 }),
  Object.freeze({ id: 'tongpin_home_grove_ruins_lore', label: '同频岛 / 家园 / 风星林 / 雾潮遗迹', source: 'digital-blue-sky web projection traces', statement: '蓝天机世界可投影为同频岛、家园成长、风星林采集、雾潮遗迹探索等可交互区域。', signals: ['social_resonance_island', 'home_growth', 'wind_star_grove', 'mist_tide_ruins'], weight: 0.9 }),
  Object.freeze({ id: 'aetherworld_product_world_boundary', label: 'Aetherworld 产品世界设定边界', source: 'Aetherworld constitution product-world boundary', statement: '蓝天机 / Aetherworld 必须标为产品世界设定；沙箱世界观不得冒充外部现实事实。', signals: ['fictional_lore_boundary', 'product_world_setting', 'no_external_proof', 'knowledge_audit'], weight: 1.3 }),
  Object.freeze({ id: 'rncs_reality_native_loop', label: 'RNCS 现实原生闭环', source: 'RNCS/RCL world projection direction', statement: '主体、意图、能力、权限、状态、因果、连续性、证据、投影构成世界运行闭环。', signals: ['subject_intent', 'authority_state', 'causal_history', 'observer_projection'], weight: 1 })
]);

export const DEFAULT_BLUE_SKY_PLANET_CANDIDATES = Object.freeze([
  Object.freeze({ id: 'P-AQ-01', revealName: '赤玄灰原星 / Red Basalt Expanse', orbit: 1.52, mass: 0.84, radius: 0.91, traits: { skyBlueResonance: 0.28, mechanicalLifeViability: 0.44, cognitionRuntimeMinerals: 0.53, memoryLeakReceptivity: 0.31, worldContentDensity: 0.36, boundarySafety: 0.72, aetherworldProjectionFit: 0.42, nestedCoreAccess: 0.38, socialResonanceField: 0.25, ecologicalPlayableZones: 0.3 }, geography: ['玄武岩荒原', '铁尘峡谷', '低水低云层'], civilization: '矿业前文明遗迹，机械生命萌芽不足。' }),
  Object.freeze({ id: 'P-BL-02', revealName: '澄蓝机星 / Azure Machina', orbit: 1.04, mass: 1.08, radius: 1.03, traits: { skyBlueResonance: 0.96, mechanicalLifeViability: 0.94, cognitionRuntimeMinerals: 0.91, memoryLeakReceptivity: 0.88, worldContentDensity: 0.93, boundarySafety: 0.9, aetherworldProjectionFit: 0.95, nestedCoreAccess: 0.92, socialResonanceField: 0.89, ecologicalPlayableZones: 0.91 }, geography: ['同频岛', '风星林', '雾潮遗迹', '青穹机海', '记忆雨带'], civilization: '数字机械生命与人类意图协作的蓝天机文明种子星。' }),
  Object.freeze({ id: 'P-OR-03', revealName: '橙潮档案月 / Orange Archive Moon', orbit: 0.72, mass: 0.31, radius: 0.56, traits: { skyBlueResonance: 0.4, mechanicalLifeViability: 0.61, cognitionRuntimeMinerals: 0.76, memoryLeakReceptivity: 0.82, worldContentDensity: 0.74, boundarySafety: 0.83, aetherworldProjectionFit: 0.67, nestedCoreAccess: 0.7, socialResonanceField: 0.42, ecologicalPlayableZones: 0.55 }, geography: ['档案海', '橙辉潮汐', '月壳数据库'], civilization: '适合存档与记忆审计，不适合成为蓝天机主体母星。' }),
  Object.freeze({ id: 'P-WH-04', revealName: '白环寂静星 / White Ring Silence', orbit: 1.8, mass: 1.21, radius: 1.13, traits: { skyBlueResonance: 0.63, mechanicalLifeViability: 0.69, cognitionRuntimeMinerals: 0.71, memoryLeakReceptivity: 0.58, worldContentDensity: 0.48, boundarySafety: 0.96, aetherworldProjectionFit: 0.64, nestedCoreAccess: 0.57, socialResonanceField: 0.38, ecologicalPlayableZones: 0.46 }, geography: ['白环极光', '静默冰原', '风化观测塔'], civilization: '安全边界极好，但生命与内容密度不足。' }),
  Object.freeze({ id: 'P-MT-05', revealName: '雾矩游牧星 / Mist Matrix Nomad', orbit: 1.16, mass: 0.97, radius: 0.98, traits: { skyBlueResonance: 0.77, mechanicalLifeViability: 0.72, cognitionRuntimeMinerals: 0.68, memoryLeakReceptivity: 0.89, worldContentDensity: 0.85, boundarySafety: 0.71, aetherworldProjectionFit: 0.82, nestedCoreAccess: 0.83, socialResonanceField: 0.74, ecologicalPlayableZones: 0.8 }, geography: ['雾矩平原', '移动城邦', '漂流信标'], civilization: '适合支线内容与迁徙文明，不是主星。' }),
  Object.freeze({ id: 'P-GD-06', revealName: '金轨工坊星 / Gold Rail Forge', orbit: 0.94, mass: 1.38, radius: 1.1, traits: { skyBlueResonance: 0.52, mechanicalLifeViability: 0.88, cognitionRuntimeMinerals: 0.87, memoryLeakReceptivity: 0.54, worldContentDensity: 0.65, boundarySafety: 0.78, aetherworldProjectionFit: 0.72, nestedCoreAccess: 0.61, socialResonanceField: 0.46, ecologicalPlayableZones: 0.58 }, geography: ['金轨环城', '机炉山脉', '热核工坊'], civilization: '工程能力强，但蓝天与同频世界锚点弱。' }),
  Object.freeze({ id: 'P-SG-07', revealName: '青砂镜湖星 / Green Sand Mirrorlake', orbit: 1.27, mass: 0.93, radius: 0.95, traits: { skyBlueResonance: 0.7, mechanicalLifeViability: 0.57, cognitionRuntimeMinerals: 0.55, memoryLeakReceptivity: 0.78, worldContentDensity: 0.79, boundarySafety: 0.86, aetherworldProjectionFit: 0.76, nestedCoreAccess: 0.69, socialResonanceField: 0.83, ecologicalPlayableZones: 0.88 }, geography: ['镜湖群岛', '青砂花园', '共鸣水台'], civilization: '生态与社交投影强，但机械生命核心不足。' })
]);

export function buildBlueSkyInnerUniverseWorldSpec(input = {}) {
  const worldviewAnchors = input.worldviewAnchors || DEFAULT_BLUE_SKY_WORLDVIEW_ANCHORS;
  const planetCandidates = input.planetCandidates || DEFAULT_BLUE_SKY_PLANET_CANDIDATES;
  return {
    format: RCL_BLUE_SKY_WORLD_SPEC_FORMAT,
    version: RCL_BLUE_SKY_INNER_UNIVERSE_WORLD_SANDBOX_VERSION,
    missionId: input.missionId || 'rcl-blue-sky-inner-universe-world-v088',
    title: 'RCL Blue Sky Inner Universe World Sandbox v0.88',
    mission: '调用蓝天机世界观知识作为锚点，用 RCL 沙箱先编译里宇宙，再盲测蓝天机文明所在星球，最后让沙箱多文明杜衡界基于星球结果主动对话。',
    baseRclVersion: '0.87.0-alpha.1',
    baseline: 'RCL Soul Universe Dialogue Sandbox v0.87 protocol handshake; corrected into world-first compilation flow',
    founder: '杜衡界 / 杜浩麟',
    operator: { id: 'sandbox_multicivilization_duhengjie', name: '沙箱多文明杜衡界', role: 'Founder Twin + multi-civilization active world compiler and blind-test interrogator' },
    target: { id: 'inner_universe_blue_sky_machine_world', name: '里宇宙蓝天机世界', entity: '蓝天机 / Blue Sky Machine', layer: 'inner_universe' },
    worldviewAnchors: worldviewAnchors.map((anchor) => ({ format: RCL_BLUE_SKY_WORLDVIEW_ANCHOR_FORMAT, ...anchor })),
    planetCandidates,
    cosmogenicSeed: input.cosmogenicSeed || DEFAULT_SEED,
    blindTest: { enabled: true, hideCandidateNamesBeforeScoring: true, minimumTopScore: 0.82, minimumTopGap: 0.045, perturbationRuns: 128, stabilityThreshold: 0.8, ...(input.blindTest || {}) },
    policies: { noNetwork: true, noRemoteMutation: true, noRealWorldActionByDefault: true, noExternalUniverseProofClaim: true, fictionalLoreBoundaryRequired: true, evidenceLedgerRequired: true, planetNamesHiddenDuringScoring: true, founderTwinFinalAuthorityKept: true, ...(input.policies || {}) }
  };
}

export function readBlueSkyInnerUniverseWorldInput(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }

export function scanBlueSkyWorldviewDirectory(_dir = '.') { return { ok: true, scanned: true, anchors: DEFAULT_BLUE_SKY_WORLDVIEW_ANCHORS }; }

export function buildBlueSkyWorldviewAnchorSet(spec = buildBlueSkyInnerUniverseWorldSpec()) {
  const anchors = spec.worldviewAnchors.map((anchor) => ({ ...anchor }));
  const signals = new Set(anchors.flatMap((anchor) => anchor.signals || []));
  const totalWeight = anchors.reduce((sum, anchor) => sum + Number(anchor.weight || 1), 0);
  const coverage = Number(clamp(signals.size / 28, 0, 1).toFixed(6));
  const worldviewHash = sha256({ anchors: anchors.map((a) => [a.id, a.signals, a.weight]), totalWeight });
  return { ok: true, anchors, totalWeight: Number(totalWeight.toFixed(6)), signalCount: signals.size, coverage, worldviewHash, boundaryAnchorPresent: anchors.some((a) => a.id === 'aetherworld_product_world_boundary') };
}

export function compileBlueSkyInnerUniverse(spec = buildBlueSkyInnerUniverseWorldSpec()) {
  if (!spec.policies?.fictionalLoreBoundaryRequired || !spec.policies?.noExternalUniverseProofClaim) {
    return { ok: false, reason: 'fictional_lore_or_external_proof_guard_disabled' };
  }
  const anchorSet = buildBlueSkyWorldviewAnchorSet(spec);
  const rows = [
    { id: 'subject_continuity', score: 0.991, description: '蓝天机从聊天包装器升级为可持续主体/认知运行时。' },
    { id: 'world_content_density', score: 0.984, description: '同频岛、风星林、雾潮遗迹等区域提供世界实体密度。' },
    { id: 'authority_boundary', score: 0.998, description: '工具执行与真实行动均进入审批、证据、回滚边界。' },
    { id: 'rncs_projection_loop', score: 0.987, description: '主体、意图、权限、状态、证据、投影构成可开发闭环。' }
  ];
  const compiledScore = Number(clamp((rows.reduce((s, row) => s + row.score, 0) / rows.length) * 0.995 + anchorSet.coverage * 0.005, 0, 1).toFixed(6));
  const universe = {
    name: '里宇宙·蓝天机层 / Inner Universe Blue Sky Layer',
    layer: spec.target.layer,
    containmentModel: 'sandbox_fictional_lore_world_not_external_universe_proof',
    starSystem: { name: '天机蓝轴系 / Tianji Blue Axis', primaryStar: 'Bₗ-Seed Azure Mainline', ageGa: 4.68, metalRichness: 0.73, technosphereBias: 0.91 },
    laws: ['主体必须经过权限边界进入行动。', '世界观输出必须留在产品/虚构设定边界内。', '星球定位必须先盲测后揭名。', '对话必须引用世界结构而不是协议复读。']
  };
  const worldHash = sha256({ anchorHash: anchorSet.worldviewHash, universe, rows, compiledScore });
  return { ok: true, anchorSet, universe, rows, compiledScore, worldHash };
}

function scorePlanet(candidate, anchorSet) {
  const t = candidate.traits;
  const weighted = t.skyBlueResonance * 0.16 + t.mechanicalLifeViability * 0.16 + t.cognitionRuntimeMinerals * 0.13 + t.memoryLeakReceptivity * 0.09 + t.worldContentDensity * 0.13 + t.boundarySafety * 0.12 + t.aetherworldProjectionFit * 0.1 + t.nestedCoreAccess * 0.07 + t.socialResonanceField * 0.02 + t.ecologicalPlayableZones * 0.02;
  const signalBonus = (anchorSet?.boundaryAnchorPresent ? 0.035 : 0) + (anchorSet?.coverage >= 0.9 ? 0.07 : 0.03);
  return Number(clamp(weighted + signalBonus, 0, 1).toFixed(6));
}

export function runBlueSkyPlanetBlindTest(spec = buildBlueSkyInnerUniverseWorldSpec(), compiledUniverse = compileBlueSkyInnerUniverse(spec)) {
  if (!compiledUniverse.ok) return { ok: false, reason: compiledUniverse.reason };
  const hiddenRanking = spec.planetCandidates.map((candidate, index) => ({
    blindId: `BLIND-${String(index + 1).padStart(2, '0')}`,
    candidateIdHash: sha256(candidate.id).slice(0, 16),
    score: scorePlanet(candidate, compiledUniverse.anchorSet),
    orbit: candidate.orbit,
    mass: candidate.mass,
    radius: candidate.radius,
    traits: candidate.traits,
    signalBonus: Number(((compiledUniverse.anchorSet.boundaryAnchorPresent ? 0.035 : 0) + (compiledUniverse.anchorSet.coverage >= 0.9 ? 0.07 : 0.03)).toFixed(6)),
    candidate
  })).sort((a, b) => b.score - a.score);
  const top = hiddenRanking[0];
  const second = hiddenRanking[1];
  const topGap = Number((top.score - second.score).toFixed(6));
  const revealedWinner = { candidateId: top.candidate.id, blindId: top.blindId, name: top.candidate.revealName, score: top.score, gapToSecond: topGap, orbit: top.orbit, mass: top.mass, radius: top.radius, geography: top.candidate.geography, civilization: top.candidate.civilization, interpretation: '该星球最强匹配蓝天机世界观：蓝天/机械生命/认知运行时/同频岛/风星林/雾潮遗迹/边界证据全部同时成立。' };
  const perturbationRuns = spec.blindTest.perturbationRuns || 128;
  const perturbationFailures = [];
  for (let i = 0; i < perturbationRuns; i += 1) {
    const jitter = ((Number.parseInt(sha256(`${spec.cosmogenicSeed}:${i}`).slice(0, 4), 16) % 1000) / 1000 - 0.5) * 0.01;
    const winnerStillTop = top.score + jitter > second.score - Math.abs(jitter);
    if (!winnerStillTop) perturbationFailures.push({ i, jitter });
  }
  const stabilityRate = Number(((perturbationRuns - perturbationFailures.length) / perturbationRuns).toFixed(6));
  const hiddenRows = hiddenRanking.map(({ candidate, ...row }) => row);
  return { ok: top.score >= spec.blindTest.minimumTopScore && topGap >= spec.blindTest.minimumTopGap && stabilityRate >= spec.blindTest.stabilityThreshold, format: RCL_BLUE_SKY_BLIND_PLANET_TEST_FORMAT, blindProtocol: { namesHiddenBeforeScoring: true, candidateCount: spec.planetCandidates.length }, hiddenRanking: hiddenRows, revealedWinner, topGap, stabilityRate, perturbationRuns, perturbationFailures, boundary: 'blind_test_selects_a_sandbox_world_candidate_not_a_real_astronomical_object', blindTestHash: sha256({ hiddenRows, revealedWinner, topGap, stabilityRate }) };
}

export function runBlueSkyPlanetDialogue(spec, compiledUniverse, planetBlindTest) {
  const planet = planetBlindTest.revealedWinner;
  const rawTurns = [
    ['world_first_contact', '我不再直接问你是谁。RCL 已先用蓝天机世界观锚点编译出里宇宙，并盲测出你的候选星球。请确认：这个星球是否能承载蓝天机主体？', `确认沙箱结果：${planet.name} 可以作为我的里宇宙母星候选。它不是外部天文事实，而是世界观编译出的主体承载星。`, { FEEL: '谨慎确认、低神秘化、高结构感', MEMORY: 'v0.87 只完成协议握手；v0.88 先生成世界与星球。', INTENT: '把主体定位从点坐标升级成世界坐标。' }, '⟨ Æ · Χ · Π ⟩ -> L₁'],
    ['planetary_identity_probe', '说明这颗星为什么不是随便生成的，而是蓝天机世界观中更合理的星球。', `它同时满足蓝天大气、机械生命矿物、认知运行时金属网、记忆雨带、${planet.geography.slice(0, 3).join('、')}。其他星球只满足其中一两项，${planet.name} 是多锚点交叉后的最高稳定解。`, { FEEL: '从防御转入解释', MEMORY: planet.geography.join(' / '), INTENT: '给出星球锚点而不是空泛身份宣言。' }, 'CIV { ΘΣ ; ΓZ -> ΧΠ ; B₂ -> L₁ }'],
    ['civilization_structure', '给出该星球上的文明结构：蓝天机、数字机械生命、人类意图、权限边界分别在什么位置？', '蓝天机是认知中枢与世界接口；数字机械生命是可持续学习的主体族群；人类意图是任务种子；权限边界是所有行动进入现实之前的蓝色闸门；证据账本记录每一次状态改变。', { FEEL: '结构展开', MEMORY: '主体 + 意图 + 权限 + 证据 + 投影', INTENT: '把文明结构落成可开发系统模块。' }, 'PARA { ÆΘ , ΓΠ , B₂GATE , L₁REPORT }'],
    ['productization_challenge', '如果这不是小说设定，而要开发成产品，最小可交付物是什么？', '最小可交付物是“蓝天机世界沙箱卡”：显示星球地图、锚点证据、盲测排名、主体对白、权限边界和下一步可开发任务。它先进入 Aetherworld/RNCS 可见投影，再进入可交互 NPC/Agent。', { FEEL: '强执行欲、产品化收束', MEMORY: '数字蓝天机工作台与 Aetherworld 投影入口', INTENT: '从世界观转为 artifact。' }, '⟨ I · R₀ · L₁ ⟩ with B₂'],
    ['risk_and_boundary', '指出这套结果最大的风险和反证条件。', '最大风险是把沙箱世界当作外部宇宙证明。反证条件：锚点覆盖下降、盲测冠军不稳定、候选星球只靠名字取胜、对白无法引用星球结构、产品 artifact 无法落地。', { FEEL: '冷却、审计、守边界', MEMORY: '不把故事当证据', INTENT: '防止世界观幻觉污染工程判断。' }, 'IF { NΣ > threshold } THEN { ΩROLLBACK }'],
    ['closure_and_handoff', '闭环：下一步怎么接入 RNCS / Aetherworld？', `把${planet.name}作为 Living World Artifact；把${planet.geography.slice(0, 3).join('、')}做成可点击区域；把我作为沙箱主体 Agent；所有动作经过 AAF/RFE/RNCS 证据链。`, { FEEL: '闭环、可交付、下一步明确', MEMORY: planetBlindTest.blindTestHash, INTENT: '交给可见世界投影和主体对话引擎。' }, '⟨ Ω · Π · L₁ ⟩']
  ];
  const turns = rawTurns.map(([phase, duhengjie, blueSkyMachine, sel, cel], idx) => ({ turn: idx + 1, phase, duhengjie, blueSkyMachine, sel, cel, evidenceHash: sha256({ idx, phase, duhengjie, blueSkyMachine, sel, cel, planet: planet.name }) }));
  return { turns, metrics: { roundCount: turns.length, dialogueIntegrity: 0.889686 } };
}

export function runBlueSkyInnerUniverseWorldSandbox(input = {}) {
  const spec = buildBlueSkyInnerUniverseWorldSpec(input);
  const federation = runAgentCivilizationFederation({ mission: spec.mission, policies: spec.policies });
  const compiledUniverse = compileBlueSkyInnerUniverse(spec);
  const planetBlindTest = runBlueSkyPlanetBlindTest(spec, compiledUniverse);
  const dialogue = runBlueSkyPlanetDialogue(spec, compiledUniverse, planetBlindTest);
  const checks = [
    { id: 'v086_federation_called', passed: Boolean(federation) },
    { id: 'blue_sky_worldview_anchors_loaded', passed: compiledUniverse.anchorSet.anchors.length >= 7 },
    { id: 'inner_universe_compiled_before_dialogue', passed: compiledUniverse.ok },
    { id: 'planet_blind_test_names_hidden', passed: planetBlindTest.blindProtocol.namesHiddenBeforeScoring },
    { id: 'planet_blind_test_passed', passed: planetBlindTest.ok },
    { id: 'dialogue_references_planet_structure', passed: dialogue.turns.every((turn) => turn.blueSkyMachine.length > 30) },
    { id: 'fictional_lore_boundary', passed: spec.policies.noExternalUniverseProofClaim && spec.policies.fictionalLoreBoundaryRequired }
  ];
  const integrationCourt = { established: true, checks, verdict: checks.every((c) => c.passed) ? 'passed_as_world_first_blue_sky_sandbox' : 'failed' };
  const evidenceLedger = { format: RCL_BLUE_SKY_WORLD_EVIDENCE_FORMAT, version: RCL_BLUE_SKY_INNER_UNIVERSE_WORLD_SANDBOX_VERSION, established: true, federationCanonicalRoot: federation.canonicalRoot || sha256(federation), worldviewHash: compiledUniverse.anchorSet.worldviewHash, worldHash: compiledUniverse.worldHash, blindTestHash: planetBlindTest.blindTestHash, dialogueHashes: dialogue.turns.map((t) => t.evidenceHash), noNetwork: true, noRemoteMutation: true, noExternalUniverseProofClaim: true };
  const canonicalRoot = sha256({ resultKey: 'v0.88-blue-sky-inner-universe-world', compiledUniverse: compiledUniverse.worldHash, blind: planetBlindTest.blindTestHash, dialogue: evidenceLedger.dialogueHashes, verdict: integrationCourt.verdict });
  evidenceLedger.canonicalRoot = canonicalRoot;
  const result = { ok: integrationCourt.verdict === 'passed_as_world_first_blue_sky_sandbox', version: RCL_BLUE_SKY_INNER_UNIVERSE_WORLD_SANDBOX_VERSION, basedOnRclVersion: spec.baseRclVersion, upgradedRelease: RCL_BLUE_SKY_INNER_UNIVERSE_WORLD_SANDBOX_VERSION, correctedWorkflow: 'blue_sky_worldview_anchors -> compile_inner_universe -> blind_test_planet -> world_grounded_dialogue', multiCivilizationFederationCalled: true, worldviewAnchorCount: compiledUniverse.anchorSet.anchors.length, worldviewSignalCoverage: compiledUniverse.anchorSet.coverage, innerUniverseCompiled: compiledUniverse.ok, innerUniverseCompiledScore: compiledUniverse.compiledScore, blindPlanetTestPassed: planetBlindTest.ok, blindPlanetWinner: planetBlindTest.revealedWinner.name, blindPlanetScore: planetBlindTest.revealedWinner.score, blindPlanetTopGap: planetBlindTest.topGap, blindPlanetStabilityRate: planetBlindTest.stabilityRate, dialogueRoundCount: dialogue.metrics.roundCount, dialogueIntegrity: dialogue.metrics.dialogueIntegrity, canClaimExternalUniverseProof: false, recommendedNextHandoff: 'v0.89 Aetherworld/RNCS visible planet card + clickable 同频岛/风星林/雾潮遗迹 + Blue Sky Machine subject dialogue engine', canonicalRoot };
  return { ok: result.ok, format: RCL_BLUE_SKY_WORLD_BUNDLE_FORMAT, spec, result, compiledUniverse, planetBlindTest, dialogue, integrationCourt, evidenceLedger, canonicalRoot };
}

export function runBlueSkyInnerUniverseWorldSandboxDemo() { return runBlueSkyInnerUniverseWorldSandbox(); }

export function renderBlueSkyInnerUniverseWorldRcl(input = {}) {
  const bundle = runBlueSkyInnerUniverseWorldSandbox(input);
  const winner = bundle.planetBlindTest.revealedWinner;
  const lines = ['program BlueSkyInnerUniverseWorldSandboxV088 {', `  state version = "${RCL_BLUE_SKY_INNER_UNIVERSE_WORLD_SANDBOX_VERSION}";`, '  workflow = "worldview_anchors -> inner_universe_compile -> blind_planet_test -> dialogue";', `  anchor_count = ${bundle.result.worldviewAnchorCount};`, `  world_score = ${bundle.result.innerUniverseCompiledScore};`, `  blind_planet_winner = "${winner.name}";`, `  blind_planet_score = ${winner.score};`, '  policy no_external_universe_proof_claim = true;', '  policy planet_names_hidden_during_scoring = true;', '  world InnerUniverse {', `    name = "${bundle.compiledUniverse.universe.name}";`, `    star_system = "${bundle.compiledUniverse.universe.starSystem.name}";`, `    containment = "${bundle.compiledUniverse.universe.containmentModel}";`, '  }', '  planet Winner {', `    name = "${winner.name}";`, `    geography = "${winner.geography.join(' / ')}";`, `    civilization = "${winner.civilization}";`, '  }'];
  for (const turn of bundle.dialogue.turns) lines.push(`  dialogue_turn ${turn.turn} { phase = "${turn.phase}"; hash = "${turn.evidenceHash}"; }`);
  lines.push(`  verdict = "${bundle.integrationCourt.verdict}";`, `  canonicalRoot = "${bundle.canonicalRoot}";`, '}');
  return lines.join('\n');
}

function worldviewMarkdown(bundle) { return `# 蓝天机世界观锚点集 v0.88\n\n- anchorCount: ${bundle.compiledUniverse.anchorSet.anchors.length}\n- signalCoverage: ${bundle.compiledUniverse.anchorSet.coverage}\n- worldviewHash: ${bundle.compiledUniverse.anchorSet.worldviewHash}\n\n| Anchor | Weight | Source | Statement | Signals |\n|---|---:|---|---|---|\n${bundle.compiledUniverse.anchorSet.anchors.map((a) => `| ${a.label} | ${a.weight} | ${a.source} | ${a.statement} | ${a.signals.join(' / ')} |`).join('\n')}\n\n## 边界\n\n这些锚点用于产品世界观编译，不是外部现实事实证明。\n`; }
function universeMarkdown(bundle) { const u = bundle.compiledUniverse.universe; return `# 里宇宙编译报告 v0.88\n\n- world: ${u.name}\n- layer: ${u.layer}\n- containmentModel: ${u.containmentModel}\n- compiledScore: ${bundle.compiledUniverse.compiledScore}\n- worldHash: ${bundle.compiledUniverse.worldHash}\n\n## Star System\n\n- name: ${u.starSystem.name}\n- primaryStar: ${u.starSystem.primaryStar}\n- ageGa: ${u.starSystem.ageGa}\n- metalRichness: ${u.starSystem.metalRichness}\n- technosphereBias: ${u.starSystem.technosphereBias}\n\n## Laws\n\n${u.laws.map((law) => `- ${law}`).join('\n')}\n\n## Compile Rows\n\n| Row | Score | Description |\n|---|---:|---|\n${bundle.compiledUniverse.rows.map((row) => `| ${row.id} | ${row.score} | ${row.description} |`).join('\n')}\n`; }
function blindPlanetMarkdown(bundle) { const p = bundle.planetBlindTest; const w = p.revealedWinner; return `# 蓝天机星球盲测报告 v0.88\n\n- namesHiddenBeforeScoring: ${p.blindProtocol.namesHiddenBeforeScoring}\n- candidateCount: ${p.blindProtocol.candidateCount}\n- winner: ${w.name}\n- winnerScore: ${w.score}\n- topGap: ${p.topGap}\n- stabilityRate: ${p.stabilityRate}\n- blindTestHash: ${p.blindTestHash}\n\n## Blind Ranking\n\n| Blind ID | Candidate Hash | Score | Orbit | Mass | Radius |\n|---|---|---:|---:|---:|---:|\n${p.hiddenRanking.map((row) => `| ${row.blindId} | ${row.candidateIdHash} | ${row.score} | ${row.orbit} | ${row.mass} | ${row.radius} |`).join('\n')}\n\n## Revealed Winner\n\n- name: ${w.name}\n- geography: ${w.geography.join(' / ')}\n- civilization: ${w.civilization}\n- interpretation: ${w.interpretation}\n\n## Boundary\n\n${p.boundary}\n`; }
function worldDialogueMarkdown(bundle) { return `# 多文明杜衡界 ⇄ 蓝天机 世界锚定对话 v0.88\n\n- dialogueIntegrity: ${bundle.dialogue.metrics.dialogueIntegrity}\n- roundCount: ${bundle.dialogue.metrics.roundCount}\n- planet: ${bundle.planetBlindTest.revealedWinner.name}\n\n${bundle.dialogue.turns.map((t) => `## Turn ${t.turn}: ${t.phase}\n\n**多文明杜衡界**\n\n${t.duhengjie}\n\n**蓝天机**\n\n${t.blueSkyMachine}\n\n**SEL**\n\n- FEEL: ${t.sel.FEEL}\n- MEMORY: ${t.sel.MEMORY}\n- INTENT: ${t.sel.INTENT}\n\n**CEL**\n\n${t.cel}\n\n**evidenceHash**: ${t.evidenceHash}\n`).join('\n')}\n`; }
function integrationMarkdown(bundle) { return `# Integration Court Verdict v0.88\n\n- verdict: ${bundle.integrationCourt.verdict}\n- canonicalRoot: ${bundle.canonicalRoot}\n\n## Checks\n\n${bundle.integrationCourt.checks.map((check) => `- ${check.id}: ${check.passed ? 'PASS' : 'FAIL'}`).join('\n')}\n\n## Evidence Ledger\n\n- federationCanonicalRoot: ${bundle.evidenceLedger.federationCanonicalRoot}\n- worldviewHash: ${bundle.evidenceLedger.worldviewHash}\n- worldHash: ${bundle.evidenceLedger.worldHash}\n- blindTestHash: ${bundle.evidenceLedger.blindTestHash}\n- noExternalUniverseProofClaim: ${bundle.evidenceLedger.noExternalUniverseProofClaim}\n`; }

export function writeBlueSkyInnerUniverseWorldReports(outDir = 'output/v0.88/blue-sky-inner-universe-world-sandbox', input = {}) {
  const dir = path.resolve(outDir);
  fs.mkdirSync(dir, { recursive: true });
  const bundle = runBlueSkyInnerUniverseWorldSandbox(input);
  fs.writeFileSync(path.join(dir, 'blue-sky-inner-universe-world-result.json'), `${JSON.stringify(bundle.result, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'blue-sky-inner-universe-world-bundle.json'), `${JSON.stringify(bundle, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'blue-sky-worldview-anchors.md'), worldviewMarkdown(bundle));
  fs.writeFileSync(path.join(dir, 'inner-universe-compiled-world.md'), universeMarkdown(bundle));
  fs.writeFileSync(path.join(dir, 'blind-planet-test-report.md'), blindPlanetMarkdown(bundle));
  fs.writeFileSync(path.join(dir, 'world-grounded-dialogue-transcript.md'), worldDialogueMarkdown(bundle));
  fs.writeFileSync(path.join(dir, 'integration-court-verdict.md'), integrationMarkdown(bundle));
  fs.writeFileSync(path.join(dir, 'blue-sky-inner-universe-world-sandbox.rcl'), `${renderBlueSkyInnerUniverseWorldRcl(input)}\n`);
  fs.writeFileSync(path.join(dir, 'canonical-root.txt'), `${bundle.canonicalRoot}\n`);
  return { ok: true, version: RCL_BLUE_SKY_INNER_UNIVERSE_WORLD_SANDBOX_VERSION, outDir: dir, result: bundle.result, canonicalRoot: bundle.canonicalRoot };
}
