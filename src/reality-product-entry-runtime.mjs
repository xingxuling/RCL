import fs from 'node:fs';
import path from 'node:path';
import { sha256 } from './reality-compiler-kernel.mjs';
import {
  runHumanCapabilityFeedbackOs,
  normalizeHumanCapabilityFeedbackOsSpec,
  RCL_HUMAN_CAPABILITY_PROFILE_FORMAT,
  RCL_CAPABILITY_FEEDBACK_LOOP_FORMAT,
} from './human-capability-feedback-os.mjs';

export const RCL_REALITY_PRODUCT_ENTRY_RUNTIME_VERSION = '0.65.0-alpha.1';
export const RCL_REALITY_PRODUCT_ENTRY_RUNTIME_SPEC_FORMAT = 'rcl.reality-product-entry-runtime-spec.v0.65';
export const RCL_REALITY_PRODUCT_ENTRY_RUNTIME_RESULT_FORMAT = 'rcl.reality-product-entry-runtime-result.v0.65';
export const RCL_REALITY_PRODUCT_ENTRY_RUNTIME_BUNDLE_FORMAT = 'rcl.reality-product-entry-runtime-bundle.v0.65';
export const RCL_REALITY_PRODUCT_ENTRY_FORMAT = 'rcl.reality-product-entry.v0.65';
export const RCL_REALITY_PRODUCT_PLAN_CARD_FORMAT = 'rcl.reality-product-plan-card.v0.65';
export const RCL_REALITY_PRODUCT_SESSION_FORMAT = 'rcl.reality-product-session.v0.65';
export const RCL_REALITY_PRODUCT_ENTRY_DOC_FORMAT = 'rcl.reality-product-entry-technical-document.v0.65';

function round(value, digits = 9) {
  const scale = 10 ** digits;
  return Math.round(Number(value) * scale) / scale;
}

function average(values) {
  const xs = values.map(Number).filter(Number.isFinite);
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

function ensureArray(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

function safeId(value, fallback = 'reality-product-entry') {
  return String(value ?? fallback)
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._:-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 140) || fallback;
}

function safeFileId(value, fallback = 'reality-product-entry') {
  return safeId(value, fallback).replace(/:+/g, '-').replace(/[. ]+$/g, '');
}

function defaultSourceHumanCapabilitySpec() {
  return normalizeHumanCapabilityFeedbackOsSpec({
    id: 'rcl_reality_product_entry_runtime_source_human_feedback_v0',
    objective: 'Source v0.64 human capability feedback loops for product entry runtime compilation.',
  });
}

export const DEFAULT_REALITY_PRODUCT_ENTRY_RUNTIME_SPEC = Object.freeze({
  format: RCL_REALITY_PRODUCT_ENTRY_RUNTIME_SPEC_FORMAT,
  id: 'rcl_reality_product_entry_runtime_default_v0',
  version: RCL_REALITY_PRODUCT_ENTRY_RUNTIME_VERSION,
  objective: 'Compile v0.64 human capability feedback loops into ordinary-user product entry surfaces: goal intake, plan card, execution preview, evidence panel, rollback affordance and capability feedback widget.',
  thresholds: {
    minEntries: 8,
    minPlanCards: 8,
    minAverageEntryScore: 0.95,
    requireHumanConfirmation: true,
    requireEvidencePanel: true,
    requireRollbackAffordance: true,
    requireCapabilityFeedbackWidget: true,
    requireRncsHandoff: true,
  },
  productPolicy: {
    mode: 'human-capability-feedback-to-reality-product-entry',
    userLevel: 'ordinary user does not need to understand RCL, RNCS, WAL or provider contracts',
    confirmationPolicy: 'no external action without explicit human confirmation',
    previewPolicy: 'every plan must expose impact, evidence source, rollback path and next feedback loop',
    feedbackPolicy: 'after action, product shows capability delta and next reversible step',
    nextHandoff: 'v0.66 Recursive Future Release Planner or product shell integration',
  },
  sourceHumanCapabilityFeedback: defaultSourceHumanCapabilitySpec(),
});

export function normalizeRealityProductEntryRuntimeSpec(input = {}) {
  const base = JSON.parse(JSON.stringify(DEFAULT_REALITY_PRODUCT_ENTRY_RUNTIME_SPEC));
  return {
    ...base,
    ...input,
    thresholds: { ...base.thresholds, ...(input.thresholds ?? {}) },
    productPolicy: { ...base.productPolicy, ...(input.productPolicy ?? {}) },
    sourceHumanCapabilityFeedback: normalizeHumanCapabilityFeedbackOsSpec(input.sourceHumanCapabilityFeedback ?? base.sourceHumanCapabilityFeedback),
  };
}

function assertProfile(profile) {
  if (!profile || profile.format !== RCL_HUMAN_CAPABILITY_PROFILE_FORMAT) {
    throw new TypeError('v0.65 expects a v0.64 Human Capability Profile');
  }
}

function assertLoop(loop) {
  if (!loop || loop.format !== RCL_CAPABILITY_FEEDBACK_LOOP_FORMAT) {
    throw new TypeError('v0.65 expects a v0.64 Capability Feedback Loop');
  }
}

function entryTitleFor(profile) {
  return `${profile.translation || profile.technologyNodeName} Product Entry（产品入口）`;
}

function userGoalTemplateFor(profile) {
  const name = `${profile.technologyNodeName} ${profile.translation}`.toLowerCase();
  if (/silicate|水合|hydration|spectral|光谱/.test(name)) {
    return '帮我把一个材料记忆候选机制转成最小可测实验，并记录证据。';
  }
  if (/qi|灵气|aether|以太|formation|阵法|field/.test(name)) {
    return '帮我把一个场/符号/空间约束概念转成可反证实验。';
  }
  if (/akashic|阿卡西|observer|观测|readout|读出/.test(name)) {
    return '帮我把一个记录/读出/观测结构转成可验证证据流程。';
  }
  if (/notebook|runtime|bridge|日志|execution/.test(name)) {
    return '帮我把实验或执行计划变成可回放的运行记录。';
  }
  return '帮我把这个候选机制转成下一步可执行计划。';
}

export function buildRealityProductEntry(profile, loop, index = 0) {
  assertProfile(profile);
  assertLoop(loop);
  const id = `product-entry:${safeId(profile.id || profile.technologyNodeName)}`;
  const evidenceRoots = [
    ...(profile.evidenceBinding?.walRoots ?? []),
    profile.evidenceBinding?.evidenceWritebackRoot,
    profile.evidenceBinding?.recoveryRoot,
    profile.evidenceBinding?.planRoot,
    loop.loopRoot,
  ].filter(Boolean);
  const entry = {
    format: RCL_REALITY_PRODUCT_ENTRY_FORMAT,
    version: RCL_REALITY_PRODUCT_ENTRY_RUNTIME_VERSION,
    id,
    order: index,
    title: entryTitleFor(profile),
    sourceProfileId: profile.id,
    sourceLoopId: loop.id,
    capabilityDomain: profile.capabilityDomain,
    userGoalTemplate: userGoalTemplateFor(profile),
    productSurfaces: {
      goalIntake: {
        label: 'Goal Intake（目标输入）',
        fields: ['goal', 'constraint', 'allowed_actions', 'rollback_preference', 'evidence_required'],
      },
      planCard: {
        label: 'Plan Card（计划卡）',
        shows: ['task_understanding', 'impact_area', 'steps', 'risks', 'evidence_sources', 'rollback_point'],
      },
      executionPreview: {
        label: 'Execution Preview（执行预览）',
        shows: ['provider_contracts', 'authorization_boundary', 'WAL_preview', 'expected_outputs'],
      },
      evidencePanel: {
        label: 'Evidence Panel（证据面板）',
        roots: evidenceRoots,
        shows: ['WAL_roots', 'replay_hash', 'evidence_writeback', 'failure_ledger'],
      },
      capabilityFeedbackWidget: {
        label: 'Capability Feedback（能力反馈）',
        metrics: loop.growthLedger.map(row => row.metric),
        noIdentityJudgment: profile.agencyContract?.noIdentityJudgment === true,
      },
    },
    authorityPolicy: {
      humanConfirmationRequired: true,
      reversibleFirst: true,
      externalActionRequiresExplicitConfirmation: true,
      noSilentProviderExecution: true,
    },
    entryScore: round(average([
      profile.established ? 1 : 0,
      loop.established ? 1 : 0,
      evidenceRoots.length >= 5 ? 1 : 0,
      profile.agencyContract?.humanFinalAuthority ? 1 : 0,
      profile.agencyContract?.reversibleFirst ? 1 : 0,
      loop.steps.length >= 5 ? 1 : 0,
      loop.growthLedger.length >= 4 ? 1 : 0,
    ])),
  };
  return {
    ...entry,
    established: entry.entryScore >= 0.95,
    entryRoot: sha256(JSON.stringify({ id, evidenceRoots, surfaces: entry.productSurfaces, authorityPolicy: entry.authorityPolicy })),
  };
}

export function buildRealityProductPlanCard(entry, profile, loop, index = 0) {
  assertProfile(profile);
  assertLoop(loop);
  const planCard = {
    format: RCL_REALITY_PRODUCT_PLAN_CARD_FORMAT,
    version: RCL_REALITY_PRODUCT_ENTRY_RUNTIME_VERSION,
    id: `plan-card:${safeId(entry.id)}`,
    order: index,
    entryId: entry.id,
    title: `Plan Card（计划卡）：${entry.title}`,
    taskUnderstanding: entry.userGoalTemplate,
    impactArea: [profile.capabilityDomain, profile.technologyNodeName, profile.translation],
    proposedSteps: loop.steps,
    risks: [
      '执行边界不清导致过度行动',
      '证据不足导致候选机制误升格',
      '用户未确认前不得触发外部 Provider',
      '失败结果必须进入学习账本而不是身份评价',
    ],
    acceptanceRules: [
      'Plan Card 必须显示证据来源',
      'Execution Preview 必须显示授权边界',
      'Evidence Panel 必须写入 WAL / replay root',
      'Capability Feedback 必须显示下一步能力反馈',
    ],
    rollbackPoint: profile.evidenceBinding?.recoveryRoot || loop.loopRoot,
    confirmationGate: {
      label: 'Human Confirmation Gate（人类确认闸门）',
      required: true,
      confirmText: '我理解影响范围、证据来源和回滚点，允许进入下一步。',
    },
  };
  return {
    ...planCard,
    established: planCard.proposedSteps.length >= 5 && Boolean(planCard.rollbackPoint) && planCard.confirmationGate.required,
    planCardRoot: sha256(JSON.stringify(planCard)),
  };
}

export function buildRealityProductSession(entry, planCard, profile, loop, index = 0) {
  const session = {
    format: RCL_REALITY_PRODUCT_SESSION_FORMAT,
    version: RCL_REALITY_PRODUCT_ENTRY_RUNTIME_VERSION,
    id: `product-session:${safeId(entry.id)}`,
    order: index,
    entryId: entry.id,
    planCardId: planCard.id,
    sessionFlow: [
      'open goal intake',
      'compile plan card',
      'preview execution boundary',
      'wait for human confirmation',
      'dispatch to RNCS bridge only after confirmation',
      'write evidence panel',
      'update capability feedback widget',
      'suggest next reversible action',
    ],
    uiStateModel: {
      goal: 'draft',
      plan: 'reviewable',
      execution: 'locked-until-confirmation',
      evidence: 'append-only',
      feedback: 'visible-after-evidence-writeback',
    },
    rncsHandoff: {
      sourceProfileId: profile.id,
      sourceLoopId: loop.id,
      authorizationBoundary: loop.authorityGate,
      evidenceInputs: loop.evidenceInputs,
      dispatchMode: 'explicit-confirmation-only',
    },
    productLoop: {
      input: 'human natural language goal',
      compile: 'plan card + execution preview',
      act: 'RNCS bridge handoff',
      verify: 'evidence panel + replay hash',
      learn: 'capability feedback widget',
    },
  };
  const score = round(average([
    entry.established ? 1 : 0,
    planCard.established ? 1 : 0,
    session.sessionFlow.length >= 8 ? 1 : 0,
    session.rncsHandoff.dispatchMode === 'explicit-confirmation-only' ? 1 : 0,
    session.productLoop.verify.includes('evidence') ? 1 : 0,
  ]));
  return { ...session, sessionScore: score, established: score >= 0.95, sessionRoot: sha256(JSON.stringify(session)) };
}

export function buildRealityProductEntryRuntime(entries = [], planCards = [], sessions = []) {
  const runtime = {
    format: 'rcl.reality-product-entry-runtime.v0.65',
    version: RCL_REALITY_PRODUCT_ENTRY_RUNTIME_VERSION,
    entryCount: entries.length,
    planCardCount: planCards.length,
    sessionCount: sessions.length,
    surfaces: ['Goal Intake（目标输入）', 'Plan Card（计划卡）', 'Execution Preview（执行预览）', 'Evidence Panel（证据面板）', 'Capability Feedback（能力反馈）'],
    productEntryRoots: entries.map(e => e.entryRoot),
    planCardRoots: planCards.map(p => p.planCardRoot),
    sessionRoots: sessions.map(s => s.sessionRoot),
    runtimeScore: round(average([
      entries.every(e => e.established) ? 1 : 0,
      planCards.every(p => p.established) ? 1 : 0,
      sessions.every(s => s.established) ? 1 : 0,
      entries.every(e => e.authorityPolicy?.humanConfirmationRequired) ? 1 : 0,
      entries.every(e => e.productSurfaces?.evidencePanel?.roots?.length >= 5) ? 1 : 0,
      sessions.every(s => s.productLoop?.learn?.includes('capability')) ? 1 : 0,
    ])),
  };
  return { ...runtime, runtimeRoot: sha256(JSON.stringify(runtime)) };
}

export function evaluateRealityProductEntryRuntime(input = {}) {
  const spec = normalizeRealityProductEntryRuntimeSpec(input);
  const source = runHumanCapabilityFeedbackOs(spec.sourceHumanCapabilityFeedback);
  const entries = source.profiles.map((profile, i) => buildRealityProductEntry(profile, source.feedbackLoops[i], i));
  const planCards = entries.map((entry, i) => buildRealityProductPlanCard(entry, source.profiles[i], source.feedbackLoops[i], i));
  const sessions = entries.map((entry, i) => buildRealityProductSession(entry, planCards[i], source.profiles[i], source.feedbackLoops[i], i));
  const runtime = buildRealityProductEntryRuntime(entries, planCards, sessions);
  const scores = {
    averageEntryScore: round(average(entries.map(e => e.entryScore))),
    averageSessionScore: round(average(sessions.map(s => s.sessionScore))),
    runtimeScore: runtime.runtimeScore,
  };
  const result = {
    format: RCL_REALITY_PRODUCT_ENTRY_RUNTIME_RESULT_FORMAT,
    version: RCL_REALITY_PRODUCT_ENTRY_RUNTIME_VERSION,
    id: spec.id,
    realityProductEntryRuntimeEstablished: entries.length >= spec.thresholds.minEntries
      && planCards.length >= spec.thresholds.minPlanCards
      && scores.averageEntryScore >= spec.thresholds.minAverageEntryScore
      && entries.every(e => e.established)
      && planCards.every(p => p.established)
      && sessions.every(s => s.established)
      && runtime.runtimeScore >= 0.95,
    sourceHumanCapabilityFeedbackEstablished: source.humanCapabilityFeedbackOsEstablished,
    entryCount: entries.length,
    planCardCount: planCards.length,
    sessionCount: sessions.length,
    productSurfaceCount: runtime.surfaces.length,
    evidencePanelCount: entries.filter(e => e.productSurfaces?.evidencePanel?.roots?.length >= 5).length,
    capabilityFeedbackWidgetCount: entries.filter(e => e.productSurfaces?.capabilityFeedbackWidget?.metrics?.length >= 4).length,
    humanConfirmationGateCount: planCards.filter(p => p.confirmationGate?.required).length,
    rncsHandoffReady: sessions.every(s => s.rncsHandoff?.dispatchMode === 'explicit-confirmation-only'),
    ordinaryUserEntryReady: true,
    scores,
  };
  return { ok: result.realityProductEntryRuntimeEstablished, spec, source, result, entries, planCards, sessions, runtime };
}

export function renderRealityProductEntryDocument(entry, planCard, session) {
  const lines = [];
  lines.push(`# ${entry.title}`);
  lines.push('');
  lines.push(`**格式**：${RCL_REALITY_PRODUCT_ENTRY_DOC_FORMAT}`);
  lines.push(`**Established（成立）**：${entry.established}`);
  lines.push(`**Entry Score（入口分）**：${entry.entryScore}`);
  lines.push(`**Capability Domain（能力域）**：${entry.capabilityDomain}`);
  lines.push('');
  lines.push('## 1. User Goal（用户目标）');
  lines.push(entry.userGoalTemplate);
  lines.push('');
  lines.push('## 2. Product Surfaces（产品界面）');
  for (const [key, surface] of Object.entries(entry.productSurfaces)) {
    lines.push(`- ${key}: ${surface.label}`);
  }
  lines.push('');
  lines.push('## 3. Plan Card（计划卡）');
  lines.push(`- Impact Area（影响范围）：${planCard.impactArea.join(' / ')}`);
  lines.push(`- Rollback Point（回滚点）：${planCard.rollbackPoint}`);
  lines.push(`- Confirmation（确认）：${planCard.confirmationGate.confirmText}`);
  lines.push('');
  lines.push('## 4. Session Flow（会话流程）');
  for (const step of session.sessionFlow) lines.push(`- ${step}`);
  lines.push('');
  lines.push('## 5. Evidence（证据）');
  lines.push(`- Evidence Roots（证据根）：${entry.productSurfaces.evidencePanel.roots.length}`);
  lines.push(`- Session Root（会话根）：${session.sessionRoot}`);
  lines.push('');
  return { format: RCL_REALITY_PRODUCT_ENTRY_DOC_FORMAT, id: `reality-product-entry-doc:${safeId(entry.id)}`, title: entry.title, markdown: lines.join('\n') };
}

export function renderRealityProductEntryRuntimeDocument(bundle) {
  const lines = [];
  lines.push('# RCL Reality Product Entry Runtime（RCL 现实产品入口运行时）');
  lines.push('');
  lines.push(`**格式**：${RCL_REALITY_PRODUCT_ENTRY_DOC_FORMAT}`);
  lines.push(`**Established（成立）**：${bundle.result.realityProductEntryRuntimeEstablished}`);
  lines.push(`**Entries（入口数）**：${bundle.result.entryCount}`);
  lines.push(`**Plan Cards（计划卡数）**：${bundle.result.planCardCount}`);
  lines.push(`**Sessions（会话数）**：${bundle.result.sessionCount}`);
  lines.push('');
  lines.push('## 1. Role（角色）');
  lines.push('v0.65 把 v0.64 的人类能力反馈循环包装成普通用户可用的产品入口：目标输入、计划卡、执行预览、证据面板、能力反馈。');
  lines.push('');
  lines.push('## 2. Product Loop（产品闭环）');
  lines.push('```text');
  lines.push('Human Goal（人类目标）');
  lines.push('→ Plan Card（计划卡）');
  lines.push('→ Execution Preview（执行预览）');
  lines.push('→ Human Confirmation（人类确认）');
  lines.push('→ RNCS Handoff（RNCS 交接）');
  lines.push('→ Evidence Panel（证据面板）');
  lines.push('→ Capability Feedback（能力反馈）');
  lines.push('```');
  lines.push('');
  lines.push('## 3. Safety Boundary（安全边界）');
  lines.push('- 无人类确认不触发外部 Provider。');
  lines.push('- 所有执行都显示影响范围、证据来源和回滚点。');
  lines.push('- 失败只进入学习账本，不进入身份评价。');
  lines.push('');
  lines.push('## 4. Next Handoff（下一步交接）');
  lines.push('- v0.66 Recursive Future Release Planner（递归未来版本规划器）或 Product Shell（产品外壳）集成。');
  lines.push('');
  return { format: RCL_REALITY_PRODUCT_ENTRY_DOC_FORMAT, id: 'reality-product-entry-runtime:technical-document', title: 'RCL Reality Product Entry Runtime（RCL 现实产品入口运行时）', markdown: lines.join('\n') };
}

export function runRealityProductEntryRuntime(input = {}) {
  const evaluation = evaluateRealityProductEntryRuntime(input);
  const runtimeDoc = renderRealityProductEntryRuntimeDocument(evaluation);
  const entryDocs = evaluation.entries.map((entry, i) => renderRealityProductEntryDocument(entry, evaluation.planCards[i], evaluation.sessions[i]));
  const canonicalRoot = realityProductEntryRuntimeCanonicalRoot({
    result: evaluation.result,
    entryRoots: evaluation.entries.map(e => e.entryRoot),
    planCardRoots: evaluation.planCards.map(p => p.planCardRoot),
    sessionRoots: evaluation.sessions.map(s => s.sessionRoot),
    runtimeRoot: evaluation.runtime.runtimeRoot,
  });
  return {
    format: RCL_REALITY_PRODUCT_ENTRY_RUNTIME_BUNDLE_FORMAT,
    version: RCL_REALITY_PRODUCT_ENTRY_RUNTIME_VERSION,
    ok: evaluation.ok,
    realityProductEntryRuntimeEstablished: evaluation.result.realityProductEntryRuntimeEstablished,
    result: evaluation.result,
    entries: evaluation.entries,
    planCards: evaluation.planCards,
    sessions: evaluation.sessions,
    runtime: evaluation.runtime,
    documents: [runtimeDoc, ...entryDocs],
    canonicalRoot,
  };
}

export function buildRealityProductEntryRuntimeSpec(overrides = {}) {
  return normalizeRealityProductEntryRuntimeSpec(overrides);
}

export function renderRealityProductEntryRuntimeRcl(input = {}) {
  const spec = normalizeRealityProductEntryRuntimeSpec(input);
  const bundle = runRealityProductEntryRuntime(spec);
  return `reality ProductEntryRuntime {\n  version = "${RCL_REALITY_PRODUCT_ENTRY_RUNTIME_VERSION}"\n  source = "v0.64 Human Capability Feedback OS"\n  entries = ${bundle.result.entryCount}\n  plan_cards = ${bundle.result.planCardCount}\n  sessions = ${bundle.result.sessionCount}\n  validation.established : Truth = ${bundle.result.realityProductEntryRuntimeEstablished}\n  validation.average_entry_score = ${bundle.result.scores.averageEntryScore}\n  surface.goal_intake = "Human natural language goal"\n  surface.plan_card = "Reviewable execution plan"\n  surface.evidence_panel = "WAL + replay + evidence roots"\n  handoff.next = "v0.66 Recursive Future Release Planner"\n}\n`;
}

export function runRealityProductEntryRuntimeDemo() {
  const bundle = runRealityProductEntryRuntime();
  return {
    ok: bundle.ok,
    version: RCL_REALITY_PRODUCT_ENTRY_RUNTIME_VERSION,
    realityProductEntryRuntimeEstablished: bundle.realityProductEntryRuntimeEstablished,
    entryCount: bundle.result.entryCount,
    planCardCount: bundle.result.planCardCount,
    sessionCount: bundle.result.sessionCount,
    evidencePanelCount: bundle.result.evidencePanelCount,
    capabilityFeedbackWidgetCount: bundle.result.capabilityFeedbackWidgetCount,
    humanConfirmationGateCount: bundle.result.humanConfirmationGateCount,
    rncsHandoffReady: bundle.result.rncsHandoffReady,
    ordinaryUserEntryReady: bundle.result.ordinaryUserEntryReady,
    averageEntryScore: bundle.result.scores.averageEntryScore,
    canonicalRoot: bundle.canonicalRoot,
  };
}

export function readRealityProductEntryRuntimeInput(filePath) {
  return normalizeRealityProductEntryRuntimeSpec(JSON.parse(fs.readFileSync(filePath, 'utf8')));
}

export function writeRealityProductEntryRuntimeReports(outputDir, input = {}) {
  const spec = normalizeRealityProductEntryRuntimeSpec(input);
  const bundle = runRealityProductEntryRuntime(spec);
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, 'reality-product-entry-runtime-spec.json'), `${JSON.stringify(spec, null, 2)}\n`);
  fs.writeFileSync(path.join(outputDir, 'reality-product-entry-runtime-result.json'), `${JSON.stringify(bundle.result, null, 2)}\n`);
  fs.writeFileSync(path.join(outputDir, 'product-entries.json'), `${JSON.stringify(bundle.entries, null, 2)}\n`);
  fs.writeFileSync(path.join(outputDir, 'plan-cards.json'), `${JSON.stringify(bundle.planCards, null, 2)}\n`);
  fs.writeFileSync(path.join(outputDir, 'product-sessions.json'), `${JSON.stringify(bundle.sessions, null, 2)}\n`);
  fs.writeFileSync(path.join(outputDir, 'product-entry-runtime.json'), `${JSON.stringify(bundle.runtime, null, 2)}\n`);
  fs.writeFileSync(path.join(outputDir, 'reality-product-entry-runtime.rcl'), `${renderRealityProductEntryRuntimeRcl(spec)}\n`);
  const docDir = path.join(outputDir, 'reality-product-entry-docs');
  fs.mkdirSync(docDir, { recursive: true });
  for (const doc of bundle.documents) {
    fs.writeFileSync(path.join(docDir, `${safeFileId(doc.id)}.md`), `${doc.markdown}\n`);
  }
  return {
    ok: bundle.ok,
    version: RCL_REALITY_PRODUCT_ENTRY_RUNTIME_VERSION,
    outputDir,
    realityProductEntryRuntimeEstablished: bundle.realityProductEntryRuntimeEstablished,
    entryCount: bundle.result.entryCount,
    planCardCount: bundle.result.planCardCount,
    sessionCount: bundle.result.sessionCount,
    documentCount: bundle.documents.length,
    canonicalRoot: bundle.canonicalRoot,
  };
}

export function realityProductEntryRuntimeCanonicalRoot(payload = {}) {
  return sha256(JSON.stringify(payload));
}
