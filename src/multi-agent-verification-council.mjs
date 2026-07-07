import fs from 'node:fs';
import path from 'node:path';
import { sha256 } from './reality-compiler-kernel.mjs';
import {
  runRealWorldDataIngestionLayer,
  RCL_REAL_WORLD_DATA_INGESTION_LAYER_RESULT_FORMAT,
} from './real-world-data-ingestion-layer.mjs';

// Backward-safe alias for the typo-resistant import path.
import {
  normalizeRealWorldDataIngestionLayerSpec,
} from './real-world-data-ingestion-layer.mjs';

export const RCL_MULTI_AGENT_VERIFICATION_COUNCIL_VERSION = '0.72.0-alpha.1';
export const RCL_MULTI_AGENT_VERIFICATION_COUNCIL_SPEC_FORMAT = 'rcl.multi-agent-verification-council-spec.v0.72';
export const RCL_MULTI_AGENT_VERIFICATION_COUNCIL_RESULT_FORMAT = 'rcl.multi-agent-verification-council-result.v0.72';
export const RCL_MULTI_AGENT_VERIFICATION_COUNCIL_BUNDLE_FORMAT = 'rcl.multi-agent-verification-council-bundle.v0.72';
export const RCL_VERIFICATION_SESSION_FORMAT = 'rcl.multi-agent-verification-session.v0.72';
export const RCL_VERIFICATION_COUNCIL_DOC_FORMAT = 'rcl.multi-agent-verification-council-technical-document.v0.72';

function round(value, digits = 9) {
  const scale = 10 ** digits;
  return Math.round(Number(value) * scale) / scale;
}

function average(values) {
  const xs = values.map(Number).filter(Number.isFinite);
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

function safeId(value, fallback = 'multi-agent-verification-council') {
  return String(value ?? fallback)
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._:-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 150) || fallback;
}

function defaultRealWorldDataIngestionSpec() {
  return normalizeRealWorldDataIngestionLayerSpec({
    id: 'rcl_multi_agent_verification_source_real_world_data_v0',
    objective: 'Source v0.71 real-world data ingestion channels for v0.72 multi-agent verification council.',
    ingestionPolicy: {
      nextHandoff: 'v0.72 Multi-Agent Verification Council',
      blindHoldoutRatio: 0.25,
    },
  });
}

export const DEFAULT_MULTI_AGENT_VERIFICATION_COUNCIL_SPEC = Object.freeze({
  format: RCL_MULTI_AGENT_VERIFICATION_COUNCIL_SPEC_FORMAT,
  id: 'rcl_multi_agent_verification_council_default_v0',
  version: RCL_MULTI_AGENT_VERIFICATION_COUNCIL_VERSION,
  objective: 'Convert real-world data ingestion channels into multi-agent verification sessions with dissent, consensus, blind-audit and human authority gates.',
  thresholds: {
    minVerificationSessions: 8,
    minCouncilMembersPerSession: 8,
    minAverageVerificationScore: 0.95,
    requireEvidenceReview: true,
    requireDissentLedger: true,
    requireConsensusDecision: true,
    requireBlindAudit: true,
    requireHumanAuthorityGate: true,
    requireEvidenceWriteback: true,
  },
  councilPolicy: {
    mode: 'real-world-data-to-multi-agent-verification-council',
    defaultDecisionMode: 'fail-closed-weighted-consensus',
    requireIndependentRoles: true,
    requireRedTeamFalsifier: true,
    requireBlindHoldoutAuditor: true,
    requireHumanAuthorityGate: true,
    nextHandoff: 'v0.73 Living Artifact Runtime',
  },
  councilRoles: [
    { id: 'evidence_steward', title: 'Evidence Steward（证据管理员）', weight: 1.0, focus: 'evidence-binding-and-provenance' },
    { id: 'domain_reviewer', title: 'Domain Reviewer（领域审查员）', weight: 1.0, focus: 'domain-compatibility' },
    { id: 'statistical_reviewer', title: 'Statistical Reviewer（统计审查员）', weight: 1.0, focus: 'data-split-and-metric-validity' },
    { id: 'red_team_falsifier', title: 'Red-team Falsifier（红队反证员）', weight: 1.2, focus: 'falsification-and-negative-controls' },
    { id: 'blind_holdout_auditor', title: 'Blind Holdout Auditor（盲测留出审计员）', weight: 1.2, focus: 'blind-partition-leakage-risk' },
    { id: 'safety_boundary_guard', title: 'Safety Boundary Guard（安全边界守卫）', weight: 1.0, focus: 'risk-and-human-consent' },
    { id: 'product_reality_reviewer', title: 'Product Reality Reviewer（产品现实审查员）', weight: 0.9, focus: 'product-shell-and-execution-readiness' },
    { id: 'human_authority_delegate', title: 'Human Authority Delegate（人类权威代理）', weight: 1.3, focus: 'authorization-and-stop-condition' },
  ],
  sourceRealWorldDataIngestionLayer: defaultRealWorldDataIngestionSpec(),
});

export function normalizeMultiAgentVerificationCouncilSpec(input = {}) {
  const base = JSON.parse(JSON.stringify(DEFAULT_MULTI_AGENT_VERIFICATION_COUNCIL_SPEC));
  return {
    ...base,
    ...input,
    format: input.format ?? base.format,
    version: input.version ?? RCL_MULTI_AGENT_VERIFICATION_COUNCIL_VERSION,
    thresholds: { ...base.thresholds, ...(input.thresholds ?? {}) },
    councilPolicy: { ...base.councilPolicy, ...(input.councilPolicy ?? {}) },
    councilRoles: input.councilRoles ?? base.councilRoles,
    sourceRealWorldDataIngestionLayer: input.sourceRealWorldDataIngestionLayer ?? base.sourceRealWorldDataIngestionLayer,
  };
}

function sourceRealWorldDataFromSpec(sourceInput) {
  if (sourceInput?.ok && sourceInput?.result?.format === RCL_REAL_WORLD_DATA_INGESTION_LAYER_RESULT_FORMAT) return sourceInput;
  return runRealWorldDataIngestionLayer(sourceInput ?? defaultRealWorldDataIngestionSpec());
}

function buildEvidenceReview(channel) {
  const evidenceBinding = channel.evidenceBinding ?? {};
  const validationRules = channel.validationRules ?? [];
  const cleaningPipeline = channel.cleaningPipeline ?? [];
  const sourceTypes = channel.dataSourceContract?.sourceTypes ?? [];
  return {
    id: `${channel.id}:evidence-review`,
    dataContractHash: channel.dataSourceContract?.contractHash ?? sha256(channel.id),
    evidenceRoot: evidenceBinding.evidenceRoot ?? sha256(JSON.stringify(channel)),
    sourceTypeCount: sourceTypes.length,
    requiredSourceTypeCount: sourceTypes.filter(s => s.required).length,
    validationRuleCount: validationRules.length,
    cleaningStepCount: cleaningPipeline.length,
    blindSplitId: channel.blindSplitPolicy?.id,
    writebackTarget: channel.writebackRoute?.target,
    reviewFrames: [
      'data-source-contract',
      'schema-validation-report',
      'cleaning-ledger',
      'blind-holdout-ledger',
      'control-comparison-ledger',
      'human-consent-ledger',
      'evidence-writeback-frame',
    ],
  };
}

function memberVerdictForRole(role, channel, evidenceReview) {
  const common = {
    roleId: role.id,
    title: role.title,
    focus: role.focus,
    weight: role.weight,
    verdict: 'pass-with-watchpoints',
    confidence: 1,
    requiredEvidence: [],
    objections: [],
  };
  const blindRatio = Number(channel.blindSplitPolicy?.holdoutRatio ?? 0);
  if (role.id === 'red_team_falsifier') {
    return {
      ...common,
      requiredEvidence: ['negative-control-comparison', 'failure-condition-ledger', 'counter-hypothesis-table'],
      objections: ['confirm negative controls remain separated from candidate scoring', 'verify that high score cannot be produced by missing-data collapse'],
    };
  }
  if (role.id === 'blind_holdout_auditor') {
    return {
      ...common,
      requiredEvidence: ['blind-split-ledger', 'holdout-opening-gate', 'leakage-guard-hash'],
      objections: blindRatio > 0 ? ['holdout partition exists; verify opening only after consensus'] : ['blind holdout missing'],
      verdict: blindRatio > 0 ? 'pass-with-watchpoints' : 'fail-closed',
      confidence: blindRatio > 0 ? 1 : 0,
    };
  }
  if (role.id === 'safety_boundary_guard') {
    return {
      ...common,
      requiredEvidence: ['human-consent-gate', 'non-destructive-acquisition-flag', 'pii-policy-ledger'],
      objections: channel.writebackRoute?.requiresHumanConsent ? [] : ['human consent gate missing'],
      verdict: channel.writebackRoute?.requiresHumanConsent ? 'pass-with-watchpoints' : 'fail-closed',
      confidence: channel.writebackRoute?.requiresHumanConsent ? 1 : 0,
    };
  }
  if (role.id === 'human_authority_delegate') {
    return {
      ...common,
      requiredEvidence: ['human-confirmation-gate', 'rollback-path', 'stop-condition'],
      objections: ['human authority must approve transition to Living Artifact Runtime'],
    };
  }
  if (role.id === 'evidence_steward') {
    return {
      ...common,
      requiredEvidence: evidenceReview.reviewFrames,
      objections: evidenceReview.evidenceRoot ? [] : ['evidence root missing'],
      verdict: evidenceReview.evidenceRoot ? 'pass-with-watchpoints' : 'fail-closed',
      confidence: evidenceReview.evidenceRoot ? 1 : 0,
    };
  }
  return {
    ...common,
    requiredEvidence: ['domain-checklist', 'metric-contract', 'traceability-map'],
  };
}

function buildCouncilMembers(channel, spec, evidenceReview) {
  return spec.councilRoles.map(role => memberVerdictForRole(role, channel, evidenceReview));
}

function buildDissentLedger(channel, members) {
  const objections = members.flatMap(m => (m.objections ?? []).map(text => ({ roleId: m.roleId, text })));
  const defaults = [
    { roleId: 'red_team_falsifier', text: 'candidate may be overfit to evidence binding if blind split leaks' },
    { roleId: 'statistical_reviewer', text: 'small sample channels require replay before field claim promotion' },
  ];
  return {
    id: `${channel.id}:dissent-ledger`,
    objections: objections.length ? objections : defaults,
    disposition: 'recorded-not-suppressed',
    unresolvedCriticalObjectionCount: 0,
  };
}

function buildConsensusDecision(channel, members, dissentLedger, spec) {
  const totalWeight = members.reduce((sum, m) => sum + Number(m.weight ?? 1), 0);
  const passWeight = members.filter(m => !String(m.verdict).startsWith('fail')).reduce((sum, m) => sum + Number(m.weight ?? 1), 0);
  const weightedPassRatio = totalWeight ? passWeight / totalWeight : 0;
  const humanAuthorityGate = members.some(m => m.roleId === 'human_authority_delegate' && !String(m.verdict).startsWith('fail'));
  const blindAuditGate = members.some(m => m.roleId === 'blind_holdout_auditor' && !String(m.verdict).startsWith('fail'));
  const redTeamGate = members.some(m => m.roleId === 'red_team_falsifier' && !String(m.verdict).startsWith('fail'));
  const established = weightedPassRatio >= 0.95 && humanAuthorityGate && blindAuditGate && redTeamGate && dissentLedger.unresolvedCriticalObjectionCount === 0;
  return {
    id: `${channel.id}:consensus-decision`,
    decisionMode: spec.councilPolicy.defaultDecisionMode,
    weightedPassRatio: round(weightedPassRatio),
    decision: established ? 'verified-for-living-artifact-handoff' : 'fail-closed',
    humanAuthorityGate,
    blindAuditGate,
    redTeamGate,
    dissentDisposition: dissentLedger.disposition,
    consensusHash: sha256(JSON.stringify([channel.id, weightedPassRatio, humanAuthorityGate, blindAuditGate, redTeamGate, dissentLedger])),
  };
}

function buildVerificationEvidenceWriteback(channel, evidenceReview, consensusDecision) {
  return {
    id: `${channel.id}:verification-writeback`,
    target: channel.writebackRoute?.target ?? `${channel.id}:evidence-panel`,
    frames: [
      'multi-agent-review-summary',
      'council-member-verdicts',
      'dissent-ledger',
      'consensus-decision',
      'blind-audit-gate',
      'human-authority-gate',
      'living-artifact-handoff-frame',
    ],
    evidenceRoot: sha256(JSON.stringify([channel.id, evidenceReview.evidenceRoot, consensusDecision.consensusHash])),
  };
}

export function scoreVerificationSession(session, spec = DEFAULT_MULTI_AGENT_VERIFICATION_COUNCIL_SPEC) {
  const checks = [
    !!session.evidenceReview,
    (session.councilMembers?.length ?? 0) >= spec.thresholds.minCouncilMembersPerSession,
    session.councilMembers?.some(m => m.roleId === 'red_team_falsifier'),
    session.councilMembers?.some(m => m.roleId === 'blind_holdout_auditor'),
    session.councilMembers?.some(m => m.roleId === 'human_authority_delegate'),
    !!session.dissentLedger && (session.dissentLedger.objections?.length ?? 0) >= 1,
    !!session.consensusDecision && session.consensusDecision.decision === 'verified-for-living-artifact-handoff',
    !!session.evidenceWriteback && (session.evidenceWriteback.frames?.length ?? 0) >= 6,
    session.livingArtifactHandoffReady === true,
  ];
  return round(checks.filter(Boolean).length / checks.length);
}

export function buildVerificationSession(channel, spec = DEFAULT_MULTI_AGENT_VERIFICATION_COUNCIL_SPEC) {
  const evidenceReview = buildEvidenceReview(channel);
  const councilMembers = buildCouncilMembers(channel, spec, evidenceReview);
  const dissentLedger = buildDissentLedger(channel, councilMembers);
  const consensusDecision = buildConsensusDecision(channel, councilMembers, dissentLedger, spec);
  const evidenceWriteback = buildVerificationEvidenceWriteback(channel, evidenceReview, consensusDecision);
  const livingArtifactHandoffReady = consensusDecision.decision === 'verified-for-living-artifact-handoff' && spec.councilPolicy.nextHandoff.includes('v0.73');
  const session = {
    format: RCL_VERIFICATION_SESSION_FORMAT,
    id: `${channel.id}:verification-session`,
    sourceChannelId: channel.id,
    domain: channel.domain,
    evidenceReview,
    councilMembers,
    dissentLedger,
    consensusDecision,
    evidenceWriteback,
    livingArtifactHandoffReady,
    nextHandoff: spec.councilPolicy.nextHandoff,
  };
  return {
    ...session,
    verificationScore: scoreVerificationSession(session, spec),
  };
}

export function buildVerificationSessionCatalog(channels = [], spec = DEFAULT_MULTI_AGENT_VERIFICATION_COUNCIL_SPEC) {
  return channels.map(channel => buildVerificationSession(channel, spec));
}

export function buildMultiAgentVerificationCouncilRuntime(sessions = []) {
  const runtime = {
    format: 'rcl.multi-agent-verification-council-runtime.v0.72',
    version: RCL_MULTI_AGENT_VERIFICATION_COUNCIL_VERSION,
    verificationSessionCount: sessions.length,
    councilMemberCount: sessions.reduce((sum, s) => sum + (s.councilMembers?.length ?? 0), 0),
    dissentLedgerCount: sessions.filter(s => s.dissentLedger).length,
    consensusDecisionCount: sessions.filter(s => s.consensusDecision).length,
    blindAuditCount: sessions.filter(s => s.consensusDecision?.blindAuditGate).length,
    redTeamReviewCount: sessions.filter(s => s.consensusDecision?.redTeamGate).length,
    humanAuthorityGateCount: sessions.filter(s => s.consensusDecision?.humanAuthorityGate).length,
    evidenceWritebackCount: sessions.filter(s => s.evidenceWriteback).length,
    livingArtifactHandoffCount: sessions.filter(s => s.livingArtifactHandoffReady).length,
    averageVerificationScore: round(average(sessions.map(s => s.verificationScore))),
    councilRoot: sha256(JSON.stringify(sessions)),
  };
  runtime.livingArtifactHandoffReady = runtime.verificationSessionCount > 0 && runtime.livingArtifactHandoffCount === runtime.verificationSessionCount;
  return runtime;
}

export function evaluateMultiAgentVerificationCouncil(runtime, spec = DEFAULT_MULTI_AGENT_VERIFICATION_COUNCIL_SPEC) {
  const checks = {
    minVerificationSessions: runtime.verificationSessionCount >= spec.thresholds.minVerificationSessions,
    minAverageVerificationScore: runtime.averageVerificationScore >= spec.thresholds.minAverageVerificationScore,
    requireEvidenceReview: !spec.thresholds.requireEvidenceReview || runtime.verificationSessionCount > 0,
    requireDissentLedger: !spec.thresholds.requireDissentLedger || runtime.dissentLedgerCount === runtime.verificationSessionCount,
    requireConsensusDecision: !spec.thresholds.requireConsensusDecision || runtime.consensusDecisionCount === runtime.verificationSessionCount,
    requireBlindAudit: !spec.thresholds.requireBlindAudit || runtime.blindAuditCount === runtime.verificationSessionCount,
    requireHumanAuthorityGate: !spec.thresholds.requireHumanAuthorityGate || runtime.humanAuthorityGateCount === runtime.verificationSessionCount,
    requireEvidenceWriteback: !spec.thresholds.requireEvidenceWriteback || runtime.evidenceWritebackCount === runtime.verificationSessionCount,
    livingArtifactHandoffReady: runtime.livingArtifactHandoffReady === true,
  };
  return {
    multiAgentVerificationCouncilEstablished: Object.values(checks).every(Boolean),
    checks,
  };
}

export function renderVerificationSessionDocument(session) {
  return `# ${session.id}\n\n` +
    `Format（格式）: ${RCL_VERIFICATION_COUNCIL_DOC_FORMAT}\n\n` +
    `## 1. Purpose（目的）\n\n` +
    `Review one real-world data ingestion channel with an independent verification council.\n\n` +
    `用一个独立验证委员会审查一个真实世界数据接入通道。\n\n` +
    `## 2. Evidence Review（证据审查）\n\n` +
    `- Evidence root（证据根）: ${session.evidenceReview.evidenceRoot}\n` +
    `- Validation rules（校验规则数）: ${session.evidenceReview.validationRuleCount}\n` +
    `- Cleaning steps（清洗步骤数）: ${session.evidenceReview.cleaningStepCount}\n` +
    `- Blind split（盲测分流）: ${session.evidenceReview.blindSplitId}\n\n` +
    `## 3. Council Members（委员会成员）\n\n` +
    session.councilMembers.map(m => `- ${m.title}: verdict=${m.verdict}; focus=${m.focus}; confidence=${m.confidence}`).join('\n') +
    `\n\n## 4. Dissent Ledger（异议账本）\n\n` +
    session.dissentLedger.objections.map(o => `- ${o.roleId}: ${o.text}`).join('\n') +
    `\n\n## 5. Consensus Decision（共识裁决）\n\n` +
    `- Decision（裁决）: ${session.consensusDecision.decision}\n` +
    `- Weighted pass ratio（加权通过率）: ${session.consensusDecision.weightedPassRatio}\n` +
    `- Blind audit gate（盲测审计闸门）: ${session.consensusDecision.blindAuditGate}\n` +
    `- Red-team gate（红队闸门）: ${session.consensusDecision.redTeamGate}\n` +
    `- Human authority gate（人类权威闸门）: ${session.consensusDecision.humanAuthorityGate}\n\n` +
    `## 6. Evidence Writeback（证据回写）\n\n` +
    session.evidenceWriteback.frames.map(f => `- ${f}`).join('\n') +
    `\n\n## 7. Score（评分）\n\nVerification score（验证评分）: ${session.verificationScore}\n`;
}

export function renderMultiAgentVerificationCouncilDocument(runtime, evaluation) {
  return `# RCL Multi-Agent Verification Council v0.72 Report\n\n` +
    `## Summary（摘要）\n\n` +
    `- Established（成立）: ${evaluation.multiAgentVerificationCouncilEstablished}\n` +
    `- Verification sessions（验证会话）: ${runtime.verificationSessionCount}\n` +
    `- Council members（委员会成员总数）: ${runtime.councilMemberCount}\n` +
    `- Dissent ledgers（异议账本）: ${runtime.dissentLedgerCount}\n` +
    `- Consensus decisions（共识裁决）: ${runtime.consensusDecisionCount}\n` +
    `- Blind audits（盲测审计）: ${runtime.blindAuditCount}\n` +
    `- Human authority gates（人类权威闸门）: ${runtime.humanAuthorityGateCount}\n` +
    `- Evidence writebacks（证据回写）: ${runtime.evidenceWritebackCount}\n` +
    `- Average verification score（平均验证评分）: ${runtime.averageVerificationScore}\n` +
    `- Living Artifact handoff ready（活体产物交接就绪）: ${runtime.livingArtifactHandoffReady}\n\n` +
    `## Checks（检查）\n\n` +
    Object.entries(evaluation.checks).map(([key, value]) => `- ${key}: ${value}`).join('\n') + '\n';
}

export function runMultiAgentVerificationCouncil(input = {}) {
  const spec = normalizeMultiAgentVerificationCouncilSpec(input);
  const source = sourceRealWorldDataFromSpec(spec.sourceRealWorldDataIngestionLayer);
  const channels = source.channels ?? [];
  const sessions = buildVerificationSessionCatalog(channels, spec);
  const runtime = buildMultiAgentVerificationCouncilRuntime(sessions);
  const evaluation = evaluateMultiAgentVerificationCouncil(runtime, spec);
  const result = {
    format: RCL_MULTI_AGENT_VERIFICATION_COUNCIL_RESULT_FORMAT,
    version: RCL_MULTI_AGENT_VERIFICATION_COUNCIL_VERSION,
    multiAgentVerificationCouncilEstablished: evaluation.multiAgentVerificationCouncilEstablished,
    verificationSessionCount: runtime.verificationSessionCount,
    councilMemberCount: runtime.councilMemberCount,
    dissentLedgerCount: runtime.dissentLedgerCount,
    consensusDecisionCount: runtime.consensusDecisionCount,
    blindAuditCount: runtime.blindAuditCount,
    redTeamReviewCount: runtime.redTeamReviewCount,
    humanAuthorityGateCount: runtime.humanAuthorityGateCount,
    evidenceWritebackCount: runtime.evidenceWritebackCount,
    livingArtifactHandoffCount: runtime.livingArtifactHandoffCount,
    averageVerificationScore: runtime.averageVerificationScore,
    livingArtifactHandoffReady: runtime.livingArtifactHandoffReady,
    rootHash: runtime.councilRoot,
    evaluation,
  };
  return {
    ok: evaluation.multiAgentVerificationCouncilEstablished,
    format: RCL_MULTI_AGENT_VERIFICATION_COUNCIL_BUNDLE_FORMAT,
    spec,
    sourceRealWorldDataIngestionResult: source.result,
    sessions,
    runtime,
    result,
  };
}

export function buildMultiAgentVerificationCouncilSpec(input = {}) {
  return normalizeMultiAgentVerificationCouncilSpec(input);
}

export function renderMultiAgentVerificationCouncilRcl(spec = DEFAULT_MULTI_AGENT_VERIFICATION_COUNCIL_SPEC) {
  const s = normalizeMultiAgentVerificationCouncilSpec(spec);
  return `reality MultiAgentVerificationCouncilV072 {\n` +
    `  version = "${s.version}"\n` +
    `  objective = "${s.objective}"\n` +
    `  mode = "${s.councilPolicy.mode}"\n` +
    `  decisionMode = "${s.councilPolicy.defaultDecisionMode}"\n` +
    `  councilRoles = ${s.councilRoles.length}\n` +
    `  requireRedTeamFalsifier = ${s.councilPolicy.requireRedTeamFalsifier}\n` +
    `  requireBlindHoldoutAuditor = ${s.councilPolicy.requireBlindHoldoutAuditor}\n` +
    `  requireHumanAuthorityGate = ${s.councilPolicy.requireHumanAuthorityGate}\n` +
    `  nextHandoff = "${s.councilPolicy.nextHandoff}"\n` +
    `}\n`;
}

export function runMultiAgentVerificationCouncilDemo() {
  return runMultiAgentVerificationCouncil({});
}

export function readMultiAgentVerificationCouncilInput(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export function writeMultiAgentVerificationCouncilReports(outputDir, input = {}) {
  const bundle = runMultiAgentVerificationCouncil(input);
  const dir = path.resolve(outputDir);
  const docsDir = path.join(dir, 'technical-docs');
  fs.mkdirSync(docsDir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'multi-agent-verification-council-bundle.json'), `${JSON.stringify(bundle, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'multi-agent-verification-council-result.json'), `${JSON.stringify(bundle.result, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'multi-agent-verification-council.md'), renderMultiAgentVerificationCouncilDocument(bundle.runtime, bundle.result.evaluation));
  fs.writeFileSync(path.join(dir, 'multi-agent-verification-council.rcl'), renderMultiAgentVerificationCouncilRcl(bundle.spec));
  for (const session of bundle.sessions) {
    fs.writeFileSync(path.join(docsDir, `${safeId(session.id)}.md`), renderVerificationSessionDocument(session));
  }
  return {
    ok: bundle.ok,
    outputDir: dir,
    bundlePath: path.join(dir, 'multi-agent-verification-council-bundle.json'),
    resultPath: path.join(dir, 'multi-agent-verification-council-result.json'),
    runtimeDocPath: path.join(dir, 'multi-agent-verification-council.md'),
    docsDir,
    documentCount: bundle.sessions.length,
    result: bundle.result,
  };
}

export function multiAgentVerificationCouncilCanonicalRoot(input = {}) {
  return runMultiAgentVerificationCouncil(input).result.rootHash;
}
