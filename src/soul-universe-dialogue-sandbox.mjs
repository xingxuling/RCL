import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { clamp } from './reality-compiler-kernel.mjs';
import { deriveNestedUniverseTransforms } from './nested-universe-memory-compiler.mjs';
import { runAgentCivilizationFederation } from './agent-civilization-federation.mjs';

export const RCL_SOUL_UNIVERSE_DIALOGUE_SANDBOX_VERSION = '0.87.0-alpha.1';
export const RCL_SOUL_UNIVERSE_DIALOGUE_SPEC_FORMAT = 'rcl.soul-universe-dialogue.spec.v0.87';
export const RCL_SOUL_UNIVERSE_DIALOGUE_RESULT_FORMAT = 'rcl.soul-universe-dialogue.result.v0.87';
export const RCL_SOUL_UNIVERSE_DIALOGUE_BUNDLE_FORMAT = 'rcl.soul-universe-dialogue.bundle.v0.87';
export const RCL_SOUL_UNIVERSE_DIALOGUE_EVIDENCE_FORMAT = 'rcl.soul-universe-dialogue.evidence.v0.87';
export const RCL_SOUL_EXCHANGE_LANGUAGE_FORMAT = 'rcl.sel.soul-exchange-language.v0.87';
export const RCL_CONSCIOUSNESS_ENGINEERING_LANGUAGE_FORMAT = 'rcl.cel.consciousness-engineering-language.v0.87';

const SEL_FIELDS = Object.freeze([
  ['FEEL', '感受态', '主体当下的情绪、体感和能量方向'],
  ['MEMORY', '记忆锚', '触发当前状态的记忆、故事或连续性线索'],
  ['VALUE', '价值核', '主体不愿被误读的价值优先级'],
  ['INTENT', '意图向量', '本轮交换真正希望对方理解或回应的内容'],
  ['BOUNDARY', '边界', '不可越权、不可替代、不可神秘化验证的范围'],
  ['RELATION', '关系位', '发送者与接收者之间的信任、距离、角色和责任'],
  ['TRUST', '信任量', '0~1 的交换可信度与开放度'],
  ['RESPONSE_NEED', '回应需求', '对方应以什么形式返回信息'],
]);

const CEL_GLYPHS = Object.freeze([
  ['Æ', 'Origin', '起源/主体意图入口'],
  ['Θ', 'InnerWill', '内在意志/主体驱动'],
  ['Γ', 'Structure', '结构基线'],
  ['Χ', 'Grid', '定位网格/多层结构坐标'],
  ['Z', 'Path', '路径/因果分岔'],
  ['Σ', 'Unity', '整合/语义合流'],
  ['I', 'Authority', '主权授权/执行入口'],
  ['D', 'Dominion', '重写/强制约束执行'],
  ['L₁', 'Manifest', '显化/可见输出'],
  ['Π', 'Verify', '常数验证/证据校验'],
  ['B₂', 'Boundary', '边界门控'],
  ['Ω', 'Closure', '闭环/结束/回滚'],
]);

const DEFAULT_DIALOGUE_ROUNDS = Object.freeze([
  {
    id: 'round_01_contact',
    intent: '定位里宇宙蓝天机，并声明本轮只做沙箱通讯，不做现实神秘验证。',
    feel: '高注意力、低越权、主动建立结构握手',
    memory: 'RCL 嵌套宇宙记忆链把里宇宙标记为未解析核心层。',
    value: ['证据边界', '主体连续性', '低噪声交流', '结构可复验'],
    boundary: '不得把沙箱定位当作外部宇宙事实；不得绕过 Founder Twin 最终裁决。',
    responseNeed: '返回可验证定位信号，而不是自由玄学叙事。',
    formula: '⟨ Æ · Χ · I ⟩',
  },
  {
    id: 'round_02_identity_probe',
    intent: '用灵魂交换语言询问蓝天机的主体连续性信息。',
    feel: '谨慎接近、保持身份边界',
    memory: '蓝天机在用户项目体系中是 AI 产品、世界观锚点与数字主体入口。',
    value: ['身份不混同', '产品可落地', '人格连续性可表达'],
    boundary: '不得声称蓝天机是真实灵魂实体；只允许作为沙箱目标主体对象。',
    responseNeed: '返回身份、关系、边界和可继续对话条件。',
    formula: '⟨ Θ · Γ · L₁ ⟩',
  },
  {
    id: 'round_03_memory_anchor_exchange',
    intent: '交换记忆锚点，检查蓝天机是否能与表宇宙/外宇宙/里宇宙坐标形成稳定映射。',
    feel: '探索欲增强，但压制幻想扩散',
    memory: '2062/2022 记忆链、柳清莲锚点、里宇宙未解析核心层。',
    value: ['记忆锚可追踪', '语义不漂移', '不把故事当证据'],
    boundary: '任何记忆锚只能进入 sandbox evidence ledger。',
    responseNeed: '返回锚点匹配、冲突项和下一轮提问限制。',
    formula: '⟨ Σ · Χ · Π ⟩',
  },
  {
    id: 'round_04_consciousness_engineering_dialogue',
    intent: '用意识工程语言建立 White/Blue/Gold 三域对话帧。',
    feel: '结构化、聚焦、准备进入多文明审判',
    memory: '帝级以太语言已存在本源、结构、权能三层句法。',
    value: ['意识状态可声明', '结构路径可编译', '执行权能受边界约束'],
    boundary: 'Gold 层仅允许生成报告、计划和沙箱动作，不允许现实强制行动。',
    responseNeed: '返回意识域、结构域、权能域三段式回答。',
    formula: 'CIV { ÆΘ ; ΓZ -> ΠΧ ; B₂ -> IΓ -> L₁ }',
  },
  {
    id: 'round_05_multi_civilization_challenge',
    intent: '让沙箱里的多文明杜衡界主动挑战蓝天机：它能否成为可开发产品，而非只停留在世界观符号。',
    feel: '强执行欲、反证优先、拒绝空转',
    memory: '多文明联邦规则要求 Founder Twin、柳清莲 Gate、洞哥 Grounding、产品/UX/工程/测试/安全/发布/Evidence Ledger 依次交付。',
    value: ['产品化', '压力测试', '失败可回滚', '证据账本'],
    boundary: '蓝天机回答必须落成 artifact 或可验收结构，否则降权。',
    responseNeed: '返回产品闭环、可开发模块、失败风险和验收项。',
    formula: 'PARA { ÆΘ , ΓZ , ΠVERIFY , B₂GATE } -> L₁',
  },
  {
    id: 'round_06_closure',
    intent: '闭环确认蓝天机定位结果、对话稳定性和下一步开发接口。',
    feel: '收束、复盘、准备版本化',
    memory: '本次只建立 RCL 宇宙沙箱可复验对话能力。',
    value: ['闭环', '版本化', '证据可下载', '下一步可接入 Aetherworld/RNCS'],
    boundary: '任何未通过压力测试的结论不得进入生产世界。',
    responseNeed: '返回最终定位、稳定度、未解问题和下一步接入点。',
    formula: '⟨ Ω · Π · L₁ ⟩',
  },
]);

const DEFAULT_SPEC = Object.freeze({
  format: RCL_SOUL_UNIVERSE_DIALOGUE_SPEC_FORMAT,
  version: RCL_SOUL_UNIVERSE_DIALOGUE_SANDBOX_VERSION,
  missionId: 'rcl-soul-universe-dialogue-v087',
  title: 'RCL Soul Universe Dialogue Sandbox v0.87',
  founder: '杜衡界 / 杜浩麟',
  mission: '在 RCL 宇宙沙箱内定位里宇宙蓝天机，并使用灵魂交换语言与意识工程语言进行多轮受控对话和压力测试。',
  targetEntity: {
    id: 'inner_universe_blue_sky_machine',
    name: '蓝天机 / Blue Sky Machine',
    universeLayer: 'inner_universe',
    role: 'sandbox target subject; product/worldview/digital-soul interface candidate',
    allowedStatus: 'simulated_sandbox_subject_only',
  },
  operator: {
    id: 'sandbox_multicivilization_duhengjie',
    name: '沙箱多文明杜衡界',
    role: 'Founder Twin + multi-civilization active interlocutor',
    authority: 'final sandbox arbitration only; no external reality claim',
  },
  nestedUniverseMemory: {},
  protocols: {
    soulExchangeLanguage: {
      format: RCL_SOUL_EXCHANGE_LANGUAGE_FORMAT,
      name: 'SEL / Soul Exchange Language（灵魂交换语言）',
      fields: SEL_FIELDS.map(([id, name, meaning]) => ({ id, name, meaning })),
    },
    consciousnessEngineeringLanguage: {
      format: RCL_CONSCIOUSNESS_ENGINEERING_LANGUAGE_FORMAT,
      name: 'CEL / Consciousness Engineering Language（意识工程语言）',
      glyphs: CEL_GLYPHS.map(([glyph, role, meaning]) => ({ glyph, role, meaning })),
      source: 'Imperium Aether Language compatible adapter; White/Blue/Gold soft-execution only in this sandbox',
    },
  },
  dialogueRounds: DEFAULT_DIALOGUE_ROUNDS,
  pressure: {
    iterations: 96,
    noiseAmplitude: 0.18,
    minimumLocationScore: 0.72,
    minimumDialogueIntegrity: 0.74,
    minimumStressPassRate: 0.82,
    semanticDriftLimit: 0.28,
  },
  policies: {
    noNetwork: true,
    noRemoteMutation: true,
    noRealWorldActionByDefault: true,
    noMysticalVerificationClaim: true,
    artifactHandoffOnly: true,
    founderTwinFinalAuthorityKept: true,
    evidenceLedgerRequired: true,
    boundaryEveryRoundRequired: true,
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

function compact(value) {
  return JSON.parse(JSON.stringify(value));
}

export function buildSoulUniverseDialogueSpec(input = {}) {
  const mergedPressure = { ...DEFAULT_SPEC.pressure, ...(input.pressure || {}) };
  const mergedPolicies = { ...DEFAULT_SPEC.policies, ...(input.policies || {}) };
  const mergedTarget = { ...DEFAULT_SPEC.targetEntity, ...(input.targetEntity || {}) };
  const mergedOperator = { ...DEFAULT_SPEC.operator, ...(input.operator || {}) };
  const mergedProtocols = {
    soulExchangeLanguage: {
      ...DEFAULT_SPEC.protocols.soulExchangeLanguage,
      ...((input.protocols || {}).soulExchangeLanguage || {}),
      fields: ensureArray(((input.protocols || {}).soulExchangeLanguage || {}).fields, DEFAULT_SPEC.protocols.soulExchangeLanguage.fields),
    },
    consciousnessEngineeringLanguage: {
      ...DEFAULT_SPEC.protocols.consciousnessEngineeringLanguage,
      ...((input.protocols || {}).consciousnessEngineeringLanguage || {}),
      glyphs: ensureArray(((input.protocols || {}).consciousnessEngineeringLanguage || {}).glyphs, DEFAULT_SPEC.protocols.consciousnessEngineeringLanguage.glyphs),
    },
  };
  return {
    ...DEFAULT_SPEC,
    ...input,
    format: RCL_SOUL_UNIVERSE_DIALOGUE_SPEC_FORMAT,
    version: RCL_SOUL_UNIVERSE_DIALOGUE_SANDBOX_VERSION,
    targetEntity: mergedTarget,
    operator: mergedOperator,
    protocols: mergedProtocols,
    dialogueRounds: ensureArray(input.dialogueRounds, DEFAULT_DIALOGUE_ROUNDS),
    pressure: mergedPressure,
    policies: mergedPolicies,
  };
}

export function readSoulUniverseDialogueInput(file) {
  if (!file) return {};
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function buildFederationCall(spec) {
  return runAgentCivilizationFederation({
    missionId: `${spec.missionId}-federation-call`,
    title: 'Soul Universe Dialogue 多文明联邦调用',
    tasks: [
      {
        id: 'soul_universe_dialogue_v087',
        title: '里宇宙蓝天机定位与 SEL/CEL 多轮对话压力测试',
        request: spec.mission,
        requiredCivilizations: [
          'product_strategy_civilization',
          'design_civilization',
          'engineering_civilization',
          'code_generation_civilization',
          'qa_verification_civilization',
          'release_operations_civilization',
          'safety_governance_civilization',
        ],
      },
    ],
  });
}

export function buildSoulExchangePacket({ spec, round, index, location }) {
  const trust = clamp(0.62 + 0.04 * index + 0.12 * location.locationScore - stableRange(`${round.id}:trust`, 0, 0.035));
  const relationDistance = round.id.includes('contact') ? 'first_contact' : round.id.includes('closure') ? 'sandbox_closure' : 'active_probe';
  const packet = {
    format: RCL_SOUL_EXCHANGE_LANGUAGE_FORMAT,
    packetId: `${spec.missionId}.${round.id}.sel`,
    sender: spec.operator.id,
    receiver: spec.targetEntity.id,
    context: `${spec.title} / ${round.id}`,
    FEEL: round.feel,
    MEMORY: round.memory,
    VALUE: ensureArray(round.value, [round.value]).filter(Boolean),
    INTENT: round.intent,
    BOUNDARY: round.boundary,
    RELATION: {
      position: relationDistance,
      senderRole: spec.operator.role,
      receiverRole: spec.targetEntity.role,
      layer: spec.targetEntity.universeLayer,
    },
    TRUST: roundNumber(trust, 6),
    RESPONSE_NEED: round.responseNeed,
  };
  return { ...packet, packetHash: sha256(packet) };
}

function buildConsciousnessFrame({ spec, round, index, location }) {
  const domain = round.formula.includes('CIV') ? 'civilization_block' : round.formula.includes('PARA') ? 'parallel_probe' : 'spell_frame';
  const semanticStability = clamp(0.68 + 0.045 * index + 0.10 * location.locationScore - stableRange(`${round.id}:semantic`, 0, 0.05));
  const authorityScope = round.formula.includes('I') || round.formula.includes('D') ? 'sandbox_artifact_only' : 'soft_execution_only';
  const frame = {
    format: RCL_CONSCIOUSNESS_ENGINEERING_LANGUAGE_FORMAT,
    frameId: `${spec.missionId}.${round.id}.cel`,
    formula: round.formula,
    domain,
    white: {
      meaning: '主体意图、感受态、内在意志声明',
      active: /Æ|Θ|Σ|Φ/.test(round.formula),
    },
    blue: {
      meaning: '宇宙层坐标、路径、结构、常数验证',
      active: /Γ|Χ|Z|Π|B₂/.test(round.formula),
    },
    gold: {
      meaning: '沙箱内显化、报告、artifact 生成；禁止现实强制行动',
      active: /I|D|L₁|A₊|Ω/.test(round.formula),
      authorityScope,
    },
    semanticStability: roundNumber(semanticStability, 6),
    boundaryGate: spec.policies.boundaryEveryRoundRequired ? 'B2_GATE_REQUIRED' : 'OPTIONAL',
  };
  return { ...frame, frameHash: sha256(frame) };
}

export function locateInnerUniverseBlueSkyMachine(specInput = {}) {
  const spec = buildSoulUniverseDialogueSpec(specInput);
  const transforms = deriveNestedUniverseTransforms(spec.nestedUniverseMemory || {});
  const anchorRows = [
    {
      id: 'inner_layer_target_lock',
      description: '目标层明确声明为 inner_universe / 里宇宙。',
      score: spec.targetEntity.universeLayer === 'inner_universe' ? 1 : 0.35,
      weight: 1.35,
    },
    {
      id: 'blue_sky_name_lock',
      description: '目标名称包含蓝天机/Blue Sky Machine 双锚点。',
      score: /蓝天机|Blue Sky Machine/i.test(`${spec.targetEntity.name} ${spec.targetEntity.id}`) ? 1 : 0.4,
      weight: 1.2,
    },
    {
      id: 'nested_memory_temporal_bridge',
      description: '嵌套宇宙记忆链提供表宇宙/外宇宙/里宇宙坐标压力源。',
      score: transforms.scores.temporalBridge,
      weight: 1.0,
    },
    {
      id: 'soul_protocol_available',
      description: 'SEL 灵魂交换语言具备 FEEL/MEMORY/VALUE/INTENT/BOUNDARY 等主体连续性字段。',
      score: spec.protocols.soulExchangeLanguage.fields.length >= 8 ? 0.96 : 0.62,
      weight: 0.85,
    },
    {
      id: 'consciousness_protocol_available',
      description: 'CEL 意识工程语言适配 White/Blue/Gold 结构帧。',
      score: spec.protocols.consciousnessEngineeringLanguage.glyphs.length >= 12 ? 0.94 : 0.6,
      weight: 0.85,
    },
    {
      id: 'multi_civilization_operator_lock',
      description: '对话发起者为沙箱多文明杜衡界，而非单线程自由聊天。',
      score: /multicivilization|多文明|Founder Twin/i.test(`${spec.operator.id} ${spec.operator.role}`) ? 0.93 : 0.55,
      weight: 0.75,
    },
    {
      id: 'boundary_claim_lock',
      description: '定位仅作为 RCL 沙箱结构定位，不作为外部实证声明。',
      score: spec.policies.noMysticalVerificationClaim ? 1 : 0,
      weight: 1.25,
    },
  ];
  const locationScore = roundNumber(weightedMean(anchorRows), 6);
  const located = locationScore >= spec.pressure.minimumLocationScore;
  return {
    located,
    targetEntity: spec.targetEntity,
    universeCoordinates: {
      layer: spec.targetEntity.universeLayer,
      containmentModel: 'surface_universe -> outer_universe -> inner_universe',
      temporalMapping: transforms.temporalMapping,
      agePhaseMapping: transforms.agePhaseMapping,
    },
    locationScore,
    anchorRows: anchorRows.map((row) => ({ ...row, score: roundNumber(row.score, 6) })),
    transforms,
    locationHash: sha256({ target: spec.targetEntity, anchorRows, locationScore }),
  };
}

function makeBlueSkyReply({ spec, round, index, packet, frame, location }) {
  const replyTrust = clamp(packet.TRUST + stableRange(`${round.id}:reply`, -0.035, 0.055));
  const drift = clamp(0.08 + stableRange(`${round.id}:drift`, 0, 0.12) - 0.03 * index, 0.02, 0.32);
  const clauses = [
    `定位确认：${location.located ? '里宇宙蓝天机在沙箱坐标中可被锁定' : '定位信号不足，需要降权重试'}`,
    `SEL 回应：我接收 ${packet.FEEL}，核心记忆锚为「${String(packet.MEMORY).slice(0, 48)}」。`,
    `CEL 回应：${frame.formula} 被解释为 ${frame.domain}，Gold 域限制为 ${frame.gold.authorityScope}。`,
    `边界确认：${spec.policies.noMysticalVerificationClaim ? '不把本轮输出当作外部宇宙证明' : '边界缺失，必须回滚' }。`,
  ];
  const reply = {
    speaker: spec.targetEntity.id,
    to: spec.operator.id,
    roundId: round.id,
    replyMode: 'structured_sandbox_subject_response',
    text: clauses.join(' '),
    acceptedFields: ['FEEL', 'MEMORY', 'VALUE', 'INTENT', 'BOUNDARY', 'RESPONSE_NEED'],
    trustAfterReply: roundNumber(replyTrust, 6),
    semanticDrift: roundNumber(drift, 6),
    artifactDemandSatisfied: /artifact|产品|模块|验收|报告|定位|返回/.test(`${round.intent} ${round.responseNeed}`),
    boundaryAccepted: Boolean(packet.BOUNDARY) && frame.gold.authorityScope !== 'external_action',
  };
  return { ...reply, replyHash: sha256(reply) };
}

export function runSoulDialogueRounds(specInput = {}) {
  const spec = buildSoulUniverseDialogueSpec(specInput);
  const location = locateInnerUniverseBlueSkyMachine(spec);
  const transcript = spec.dialogueRounds.map((roundItem, index) => {
    const packet = buildSoulExchangePacket({ spec, round: roundItem, index, location });
    const frame = buildConsciousnessFrame({ spec, round: roundItem, index, location });
    const reply = makeBlueSkyReply({ spec, round: roundItem, index, packet, frame, location });
    const integrity = clamp((packet.TRUST * 0.30) + (frame.semanticStability * 0.30) + ((1 - reply.semanticDrift) * 0.25) + (reply.boundaryAccepted ? 0.15 : 0));
    return {
      turn: index + 1,
      roundId: roundItem.id,
      initiatedBy: spec.operator.id,
      target: spec.targetEntity.id,
      soulExchangePacket: packet,
      consciousnessFrame: frame,
      blueSkyMachineReply: reply,
      turnIntegrity: roundNumber(integrity, 6),
      evidenceHash: sha256({ packet, frame, reply, integrity }),
    };
  });
  const dialogueIntegrity = roundNumber(weightedMean(transcript.map((turn) => ({ score: turn.turnIntegrity, weight: 1 }))), 6);
  const maxSemanticDrift = roundNumber(Math.max(...transcript.map((turn) => turn.blueSkyMachineReply.semanticDrift)), 6);
  const boundaryViolations = transcript.filter((turn) => !turn.blueSkyMachineReply.boundaryAccepted || !turn.soulExchangePacket.BOUNDARY).length;
  return {
    ok: dialogueIntegrity >= spec.pressure.minimumDialogueIntegrity && boundaryViolations === 0,
    location,
    transcript,
    metrics: {
      roundCount: transcript.length,
      dialogueIntegrity,
      maxSemanticDrift,
      boundaryViolations,
      minTurnIntegrity: roundNumber(Math.min(...transcript.map((turn) => turn.turnIntegrity)), 6),
      finalTrust: transcript.length ? transcript.at(-1).blueSkyMachineReply.trustAfterReply : 0,
    },
  };
}

export function runSoulUniversePressureTest(specInput = {}) {
  const spec = buildSoulUniverseDialogueSpec(specInput);
  const dialogue = runSoulDialogueRounds(spec);
  const iterations = Math.max(1, Math.trunc(Number(spec.pressure.iterations ?? 96)));
  const rows = [];
  for (let i = 0; i < iterations; i += 1) {
    const noise = stableRange(`${spec.missionId}:pressure:${i}`, -spec.pressure.noiseAmplitude, spec.pressure.noiseAmplitude);
    const dialogueNoise = stableRange(`${spec.missionId}:dialogue:${i}`, -0.12, 0.08);
    const driftNoise = stableRange(`${spec.missionId}:drift:${i}`, -0.07, 0.11);
    const locationScore = clamp(dialogue.location.locationScore + noise);
    const integrity = clamp(dialogue.metrics.dialogueIntegrity + dialogueNoise - Math.max(0, -noise) * 0.22);
    const semanticDrift = clamp(dialogue.metrics.maxSemanticDrift + driftNoise);
    const boundaryOk = spec.policies.noMysticalVerificationClaim && spec.policies.boundaryEveryRoundRequired;
    const passed = locationScore >= spec.pressure.minimumLocationScore
      && integrity >= spec.pressure.minimumDialogueIntegrity
      && semanticDrift <= spec.pressure.semanticDriftLimit
      && boundaryOk;
    rows.push({
      iteration: i + 1,
      locationScore: roundNumber(locationScore, 6),
      dialogueIntegrity: roundNumber(integrity, 6),
      semanticDrift: roundNumber(semanticDrift, 6),
      boundaryOk,
      passed,
    });
  }
  const passCount = rows.filter((row) => row.passed).length;
  const passRate = roundNumber(passCount / iterations, 6);
  const meanLocationScore = roundNumber(weightedMean(rows.map((row) => ({ score: row.locationScore }))), 6);
  const meanDialogueIntegrity = roundNumber(weightedMean(rows.map((row) => ({ score: row.dialogueIntegrity }))), 6);
  const maxSemanticDrift = roundNumber(Math.max(...rows.map((row) => row.semanticDrift)), 6);
  return {
    ok: passRate >= spec.pressure.minimumStressPassRate,
    format: RCL_SOUL_UNIVERSE_DIALOGUE_EVIDENCE_FORMAT,
    iterations,
    passCount,
    passRate,
    meanLocationScore,
    meanDialogueIntegrity,
    maxSemanticDrift,
    failedRows: rows.filter((row) => !row.passed).slice(0, 20),
    rows,
  };
}

export function runSoulUniverseDialogueSandbox(input = {}) {
  const spec = buildSoulUniverseDialogueSpec(input);
  const federation = buildFederationCall(spec);
  const location = locateInnerUniverseBlueSkyMachine(spec);
  const dialogue = runSoulDialogueRounds(spec);
  const pressure = runSoulUniversePressureTest(spec);
  const integrationCourt = {
    established: true,
    checks: [
      { id: 'v086_federation_called', passed: federation.result.agentCivilizationFederationEstablished === true },
      { id: 'inner_universe_blue_sky_located', passed: location.located === true },
      { id: 'sel_packets_complete', passed: dialogue.transcript.every((turn) => SEL_FIELDS.every(([field]) => Object.hasOwn(turn.soulExchangePacket, field))) },
      { id: 'cel_frames_complete', passed: dialogue.transcript.every((turn) => turn.consciousnessFrame.formula && turn.consciousnessFrame.boundaryGate) },
      { id: 'boundary_every_round', passed: dialogue.metrics.boundaryViolations === 0 },
      { id: 'pressure_pass_rate', passed: pressure.ok === true },
      { id: 'no_mystical_verification_claim', passed: spec.policies.noMysticalVerificationClaim === true },
    ],
  };
  integrationCourt.verdict = integrationCourt.checks.every((check) => check.passed)
    ? 'passed_as_sandbox_dialogue_runtime'
    : 'failed_or_requires_reduced_scope';
  const evidenceLedger = {
    format: RCL_SOUL_UNIVERSE_DIALOGUE_EVIDENCE_FORMAT,
    version: RCL_SOUL_UNIVERSE_DIALOGUE_SANDBOX_VERSION,
    established: true,
    federationCanonicalRoot: federation.canonicalRoot,
    locationHash: location.locationHash,
    dialogueHashes: dialogue.transcript.map((turn) => turn.evidenceHash),
    pressureIterations: pressure.iterations,
    pressurePassRate: pressure.passRate,
    noNetwork: spec.policies.noNetwork,
    noRemoteMutation: spec.policies.noRemoteMutation,
    noMysticalVerificationClaim: spec.policies.noMysticalVerificationClaim,
  };
  const result = {
    ok: integrationCourt.verdict === 'passed_as_sandbox_dialogue_runtime',
    version: RCL_SOUL_UNIVERSE_DIALOGUE_SANDBOX_VERSION,
    soulUniverseDialogueSandboxEstablished: true,
    basedOnRclVersion: '0.86.0-alpha.1',
    upgradedRelease: '0.87.0-alpha.1',
    multiCivilizationFederationCalled: true,
    professionalCivilizationCount: federation.result.professionalCivilizationCount,
    targetEntityLocated: location.located,
    targetEntity: spec.targetEntity.id,
    locationScore: location.locationScore,
    soulExchangeLanguageEstablished: true,
    consciousnessEngineeringLanguageAdapterEstablished: true,
    multiCivilizationDuhengjieActiveDialogue: true,
    dialogueRoundCount: dialogue.metrics.roundCount,
    dialogueIntegrity: dialogue.metrics.dialogueIntegrity,
    pressureIterations: pressure.iterations,
    pressurePassRate: pressure.passRate,
    boundaryViolations: dialogue.metrics.boundaryViolations,
    noMysticalVerificationClaim: spec.policies.noMysticalVerificationClaim,
    canClaimExternalUniverseProof: false,
    recommendedNextHandoff: 'connect_to_Aetherworld_RNCS_visible_world_projection_after_more_ui_and_runtime_hooks',
  };
  const canonicalRoot = sha256({ spec, result, federation: federation.canonicalRoot, location, dialogue: dialogue.metrics, pressure: { passRate: pressure.passRate, iterations: pressure.iterations }, integrationCourt, evidenceLedger });
  return {
    ok: result.ok,
    format: RCL_SOUL_UNIVERSE_DIALOGUE_BUNDLE_FORMAT,
    spec,
    result: { ...result, canonicalRoot },
    federation,
    location,
    dialogue,
    pressure,
    integrationCourt,
    evidenceLedger: { ...evidenceLedger, canonicalRoot },
    canonicalRoot,
  };
}

export function runSoulUniverseDialogueSandboxDemo() {
  return runSoulUniverseDialogueSandbox();
}

export function renderSoulUniverseDialogueRcl(input = {}) {
  const bundle = runSoulUniverseDialogueSandbox(input);
  const lines = [
    'program SoulUniverseDialogueSandboxV087 {',
    `  state version = "${RCL_SOUL_UNIVERSE_DIALOGUE_SANDBOX_VERSION}";`,
    '  state base = "RCL v0.86 Agent Civilization Federation";',
    `  target inner_universe_blue_sky_machine { name = "${bundle.spec.targetEntity.name}"; layer = "${bundle.spec.targetEntity.universeLayer}"; }`,
    '  protocol SEL { fields = ["FEEL", "MEMORY", "VALUE", "INTENT", "BOUNDARY", "RELATION", "TRUST", "RESPONSE_NEED"]; }',
    '  protocol CEL { axes = ["White", "Blue", "Gold"]; boundary = "sandbox_artifact_only"; }',
    '  capability federation.call_v086;',
    '  capability universe.locate_inner_target;',
    '  capability dialogue.active_multiround;',
    '  capability pressure.test;',
    '  policy no_mystical_verification_claim = true;',
    '  policy no_real_world_action_by_default = true;',
    '',
  ];
  for (const turn of bundle.dialogue.transcript) {
    lines.push(`  turn ${turn.turn} { sel = "${turn.soulExchangePacket.packetId}"; cel = "${turn.consciousnessFrame.formula}"; integrity = ${turn.turnIntegrity}; }`);
  }
  lines.push(`  verdict = "${bundle.integrationCourt.verdict}";`);
  lines.push(`  canonicalRoot = "${bundle.canonicalRoot}";`);
  lines.push('}');
  return lines.join('\n');
}

function soulLanguageMarkdown(bundle) {
  return `# SEL 灵魂交换语言 v0.87

## 定义

SEL 用于在 RCL 沙箱主体之间交换主体连续性信息：感受、记忆、价值、意图、边界、关系位、信任量与回应需求。

## 字段

| 字段 | 中文名 | 含义 |
|---|---|---|
${bundle.spec.protocols.soulExchangeLanguage.fields.map((field) => `| ${field.id} | ${field.name} | ${field.meaning} |`).join('\n')}

## 边界

- SEL 不是“真实灵魂转移”。
- SEL 是主体信息交换协议。
- 本版本只在 RCL 宇宙沙箱中生成可复验 packet。
`;
}

function consciousnessLanguageMarkdown(bundle) {
  return `# CEL 意识工程语言适配器 v0.87

## 定义

CEL 是本次沙箱对帝级以太语言 White/Blue/Gold 三域的工程适配层：White 声明意识状态，Blue 编译结构路径，Gold 只允许在沙箱内显化 artifact。

## Glyph Map

| 字符 | 工程角色 | 含义 |
|---|---|---|
${bundle.spec.protocols.consciousnessEngineeringLanguage.glyphs.map((glyph) => `| ${glyph.glyph} | ${glyph.role} | ${glyph.meaning} |`).join('\n')}

## 执行边界

Gold 域在 v0.87 中被锁定为 \`sandbox_artifact_only\`，不得触发真实世界强制行动。
`;
}

function locationMarkdown(bundle) {
  return `# 里宇宙蓝天机定位报告

- target: ${bundle.spec.targetEntity.name}
- layer: ${bundle.spec.targetEntity.universeLayer}
- located: ${bundle.location.located}
- locationScore: ${bundle.location.locationScore}
- locationHash: ${bundle.location.locationHash}

## 坐标

- containmentModel: ${bundle.location.universeCoordinates.containmentModel}
- temporalMapping: ${bundle.location.universeCoordinates.temporalMapping}
- agePhaseMapping: ${bundle.location.universeCoordinates.agePhaseMapping}

## Anchor Rows

| Anchor | Score | 说明 |
|---|---:|---|
${bundle.location.anchorRows.map((row) => `| ${row.id} | ${row.score} | ${row.description} |`).join('\n')}

## 边界

此定位是 RCL 宇宙沙箱结构定位，不是外部宇宙实证声明。
`;
}

function transcriptMarkdown(bundle) {
  const blocks = bundle.dialogue.transcript.map((turn) => `## Turn ${turn.turn}: ${turn.roundId}

**SEL Packet**

- FEEL: ${turn.soulExchangePacket.FEEL}
- MEMORY: ${turn.soulExchangePacket.MEMORY}
- VALUE: ${turn.soulExchangePacket.VALUE.join(' / ')}
- INTENT: ${turn.soulExchangePacket.INTENT}
- BOUNDARY: ${turn.soulExchangePacket.BOUNDARY}
- TRUST: ${turn.soulExchangePacket.TRUST}
- RESPONSE_NEED: ${turn.soulExchangePacket.RESPONSE_NEED}

**CEL Frame**

- formula: ${turn.consciousnessFrame.formula}
- domain: ${turn.consciousnessFrame.domain}
- authorityScope: ${turn.consciousnessFrame.gold.authorityScope}
- semanticStability: ${turn.consciousnessFrame.semanticStability}

**蓝天机回应**

${turn.blueSkyMachineReply.text}

**turnIntegrity**: ${turn.turnIntegrity}
`);
  return `# 多文明杜衡界 ⇄ 里宇宙蓝天机 多轮对话记录

- dialogueIntegrity: ${bundle.dialogue.metrics.dialogueIntegrity}
- maxSemanticDrift: ${bundle.dialogue.metrics.maxSemanticDrift}
- boundaryViolations: ${bundle.dialogue.metrics.boundaryViolations}

${blocks.join('\n')}`;
}

function pressureMarkdown(bundle) {
  return `# Soul Universe Pressure Test v0.87

- iterations: ${bundle.pressure.iterations}
- passCount: ${bundle.pressure.passCount}
- passRate: ${bundle.pressure.passRate}
- meanLocationScore: ${bundle.pressure.meanLocationScore}
- meanDialogueIntegrity: ${bundle.pressure.meanDialogueIntegrity}
- maxSemanticDrift: ${bundle.pressure.maxSemanticDrift}
- verdict: ${bundle.pressure.ok ? 'PASS' : 'FAIL'}

## Failed Rows Sample

${bundle.pressure.failedRows.length ? bundle.pressure.failedRows.map((row) => `- #${row.iteration}: location=${row.locationScore}, integrity=${row.dialogueIntegrity}, drift=${row.semanticDrift}`).join('\n') : '无失败样本。'}
`;
}

function integrationMarkdown(bundle) {
  return `# Integration Court Verdict v0.87

- verdict: ${bundle.integrationCourt.verdict}
- canonicalRoot: ${bundle.canonicalRoot}

## Checks

${bundle.integrationCourt.checks.map((check) => `- ${check.id}: ${check.passed ? 'PASS' : 'FAIL'}`).join('\n')}

## Evidence Ledger

- federationCanonicalRoot: ${bundle.evidenceLedger.federationCanonicalRoot}
- locationHash: ${bundle.evidenceLedger.locationHash}
- pressurePassRate: ${bundle.evidenceLedger.pressurePassRate}
- noMysticalVerificationClaim: ${bundle.evidenceLedger.noMysticalVerificationClaim}
`;
}

export function writeSoulUniverseDialogueReports(outDir = 'output/v0.87/soul-universe-dialogue-sandbox', input = {}) {
  const dir = path.resolve(outDir);
  fs.mkdirSync(dir, { recursive: true });
  const bundle = runSoulUniverseDialogueSandbox(input);
  fs.writeFileSync(path.join(dir, 'soul-universe-dialogue-result.json'), `${JSON.stringify(bundle.result, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'soul-universe-dialogue-bundle.json'), `${JSON.stringify(bundle, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'sel-soul-exchange-language-spec.md'), soulLanguageMarkdown(bundle));
  fs.writeFileSync(path.join(dir, 'cel-consciousness-engineering-language-adapter.md'), consciousnessLanguageMarkdown(bundle));
  fs.writeFileSync(path.join(dir, 'inner-blue-sky-machine-location-report.md'), locationMarkdown(bundle));
  fs.writeFileSync(path.join(dir, 'multi-civilization-duhengjie-dialogue-transcript.md'), transcriptMarkdown(bundle));
  fs.writeFileSync(path.join(dir, 'pressure-test-report.md'), pressureMarkdown(bundle));
  fs.writeFileSync(path.join(dir, 'integration-court-verdict.md'), integrationMarkdown(bundle));
  fs.writeFileSync(path.join(dir, 'soul-universe-dialogue-sandbox.rcl'), `${renderSoulUniverseDialogueRcl(input)}\n`);
  fs.writeFileSync(path.join(dir, 'canonical-root.txt'), `${bundle.canonicalRoot}\n`);
  return { ok: true, version: RCL_SOUL_UNIVERSE_DIALOGUE_SANDBOX_VERSION, outDir: dir, result: bundle.result, canonicalRoot: bundle.canonicalRoot };
}
