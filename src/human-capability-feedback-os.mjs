import fs from 'node:fs';
import path from 'node:path';
import { sha256 } from './reality-compiler-kernel.mjs';
import {
  runRncsExecutionBridgeV2,
  normalizeRncsExecutionBridgeV2Spec,
  RCL_RNCS_EXECUTION_PLAN_FORMAT,
} from './rncs-execution-bridge-v2.mjs';

export const RCL_HUMAN_CAPABILITY_FEEDBACK_OS_VERSION = '0.64.0-alpha.1';
export const RCL_HUMAN_CAPABILITY_FEEDBACK_OS_SPEC_FORMAT = 'rcl.human-capability-feedback-os-spec.v0.64';
export const RCL_HUMAN_CAPABILITY_FEEDBACK_OS_RESULT_FORMAT = 'rcl.human-capability-feedback-os-result.v0.64';
export const RCL_HUMAN_CAPABILITY_FEEDBACK_OS_BUNDLE_FORMAT = 'rcl.human-capability-feedback-os-bundle.v0.64';
export const RCL_HUMAN_CAPABILITY_PROFILE_FORMAT = 'rcl.human-capability-profile.v0.64';
export const RCL_CAPABILITY_FEEDBACK_LOOP_FORMAT = 'rcl.capability-feedback-loop.v0.64';
export const RCL_HUMAN_CAPABILITY_DOC_FORMAT = 'rcl.human-capability-feedback-os-technical-document.v0.64';

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

function safeId(value, fallback = 'human-capability') {
  return String(value ?? fallback)
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._:-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 140) || fallback;
}

function defaultSourceRncsBridgeSpec() {
  return normalizeRncsExecutionBridgeV2Spec({
    id: 'rcl_human_capability_feedback_os_source_bridge_v0',
    objective: 'Source v0.63 RNCS execution plans for human capability feedback compilation.',
  });
}

export const DEFAULT_HUMAN_CAPABILITY_FEEDBACK_OS_SPEC = Object.freeze({
  format: RCL_HUMAN_CAPABILITY_FEEDBACK_OS_SPEC_FORMAT,
  id: 'rcl_human_capability_feedback_os_default_v0',
  version: RCL_HUMAN_CAPABILITY_FEEDBACK_OS_VERSION,
  objective: 'Compile v0.63 RNCS execution plans into human capability profiles, feedback loops, growth ledgers, agency constraints and evidence-backed capability evolution.',
  thresholds: {
    minProfiles: 8,
    minFeedbackLoops: 8,
    minAverageFeedbackScore: 0.95,
    requireAgencyContract: true,
    requireEvidenceBinding: true,
    requireGrowthLedger: true,
    requireFailureToLearningMap: true,
    requireHumanAuthorityGate: true,
  },
  feedbackPolicy: {
    mode: 'rncs-execution-plan-to-human-capability-feedback',
    cadence: 'weekly-review-with-daily-evidence-capture',
    agencyPolicy: 'human remains final authority; RCL proposes capability deltas and next actions only',
    evidencePolicy: 'every capability delta must reference RNCS WAL, evidence writeback and replay root',
    failurePolicy: 'failed execution becomes learning evidence rather than identity judgment',
    nextHandoff: 'v0.65 Reality Product Entry Runtime',
  },
  sourceRncsBridge: defaultSourceRncsBridgeSpec(),
});

export function normalizeHumanCapabilityFeedbackOsSpec(input = {}) {
  const base = JSON.parse(JSON.stringify(DEFAULT_HUMAN_CAPABILITY_FEEDBACK_OS_SPEC));
  return {
    ...base,
    ...input,
    thresholds: { ...base.thresholds, ...(input.thresholds ?? {}) },
    feedbackPolicy: { ...base.feedbackPolicy, ...(input.feedbackPolicy ?? {}) },
    sourceRncsBridge: normalizeRncsExecutionBridgeV2Spec(input.sourceRncsBridge ?? base.sourceRncsBridge),
  };
}

function assertExecutionPlan(plan) {
  if (!plan || plan.format !== RCL_RNCS_EXECUTION_PLAN_FORMAT) {
    throw new TypeError('v0.64 expects a v0.63 RNCS execution plan');
  }
}

function capabilityDomainFor(plan) {
  const domain = plan.domain || '';
  if (domain.includes('substrate')) return 'material-memory-literacy';
  if (domain.includes('field')) return 'field-symbolic-control-literacy';
  if (domain.includes('record') || domain.includes('readout')) return 'record-readout-literacy';
  if (domain.includes('runtime')) return 'evidence-runtime-literacy';
  return 'general-reality-engineering-literacy';
}

function humanPracticeFor(plan) {
  const name = `${plan.technologyNodeName} ${plan.translation}`.toLowerCase();
  if (/silicate|水合|hydration|spectral|光谱/.test(name)) {
    return ['observe material state changes', 'document sensor readings', 'compare control group deltas'];
  }
  if (/qi|灵气|aether|以太|formation|阵法|field/.test(name)) {
    return ['separate metaphor from measurable coupling', 'design reversible field-like constraints', 'record contradiction pressure'];
  }
  if (/akashic|阿卡西|observer|观测|readout|读出/.test(name)) {
    return ['index events before interpretation', 'bind readout claims to evidence frames', 'keep null results visible'];
  }
  if (/experiment|notebook|runtime|bridge|日志/.test(name)) {
    return ['append evidence frames', 'replay results', 'promote or demote candidate mechanisms'];
  }
  return ['define the claim', 'run the smallest reversible test', 'record the feedback'];
}

export function buildHumanCapabilityProfile(plan, index = 0) {
  assertExecutionPlan(plan);
  const id = `capability-profile:${safeId(plan.technologyNodeId || plan.id)}`;
  const domain = capabilityDomainFor(plan);
  const practices = humanPracticeFor(plan);
  const evidenceBinding = {
    sourcePlanId: plan.id,
    technologyNodeId: plan.technologyNodeId,
    walRoots: ensureArray(plan.walEntries).map(w => w.walHash),
    evidenceWritebackRoot: plan.evidenceWriteback?.writebackRoot,
    recoveryRoot: plan.crashRecoveryPlan?.recoveryRoot,
    planRoot: plan.hashes?.planRoot,
  };
  const profileScore = round(average([
    plan.established ? 1 : 0,
    plan.readinessScore ?? 0,
    evidenceBinding.walRoots.length >= 5 ? 1 : 0,
    evidenceBinding.evidenceWritebackRoot ? 1 : 0,
    plan.authorizationBoundary?.humanAuthorityRequired ? 1 : 0,
    practices.length >= 3 ? 1 : 0,
  ]));
  const profile = {
    format: RCL_HUMAN_CAPABILITY_PROFILE_FORMAT,
    version: RCL_HUMAN_CAPABILITY_FEEDBACK_OS_VERSION,
    id,
    order: index,
    sourcePlanId: plan.id,
    technologyNodeName: plan.technologyNodeName,
    translation: plan.translation,
    capabilityDomain: domain,
    currentState: {
      level: 'candidate-practitioner',
      evidenceLiteracy: 'requires explicit ledger and replay',
      autonomy: 'human-authorized, reversible-first',
    },
    targetState: {
      level: 'evidence-backed operator',
      evidenceLiteracy: 'can interpret WAL, failure ledger and replay hash before action',
      autonomy: 'can propose next reversible experiment without bypassing authority',
    },
    practices,
    feedbackVariables: ['evidence_quality', 'execution_consistency', 'failure_learning_rate', 'rollback_discipline', 'candidate_promotion_accuracy'],
    agencyContract: {
      humanFinalAuthority: true,
      noIdentityJudgment: true,
      reversibleFirst: true,
      failureIsLearningEvidence: true,
    },
    evidenceBinding,
    profileScore,
    established: profileScore >= 0.95,
    hashes: {
      profileRoot: sha256(JSON.stringify({ id, evidenceBinding, practices, domain })),
      agencyRoot: sha256(JSON.stringify({ id, agencyContract: true, domain })),
    },
  };
  return profile;
}

export function buildCapabilityFeedbackLoop(profile, plan, index = 0) {
  assertExecutionPlan(plan);
  const loop = {
    format: RCL_CAPABILITY_FEEDBACK_LOOP_FORMAT,
    version: RCL_HUMAN_CAPABILITY_FEEDBACK_OS_VERSION,
    id: `feedback-loop:${safeId(profile.id)}`,
    order: index,
    profileId: profile.id,
    sourcePlanId: plan.id,
    cadence: 'observe -> act -> record -> reflect -> update',
    steps: [
      'observe current evidence state',
      'select one reversible micro-action from RNCS plan',
      'execute only inside authorization boundary',
      'append evidence frame and WAL result',
      'map failure or success into capability delta',
      'schedule next experiment or demote candidate',
    ],
    growthLedger: [
      { metric: 'evidence_quality', baseline: 0, target: 1, source: 'evidence frame completeness' },
      { metric: 'execution_consistency', baseline: 0, target: 1, source: 'WAL replay stability' },
      { metric: 'failure_learning_rate', baseline: 0, target: 1, source: 'failure ledger -> next action mapping' },
      { metric: 'rollback_discipline', baseline: 0, target: 1, source: 'rollback pointer use under uncertainty' },
    ],
    failureToLearningMap: ensureArray(plan.crashRecoveryPlan?.crashClasses).map(kind => ({
      failureClass: kind,
      learningAction: `record ${kind}, replay last verified checkpoint, update next micro-action`,
      identityImpact: 'none',
    })),
    authorityGate: plan.authorizationBoundary,
    evidenceInputs: profile.evidenceBinding,
    feedbackScore: round(average([
      profile.established ? 1 : 0,
      profile.agencyContract?.humanFinalAuthority ? 1 : 0,
      profile.evidenceBinding?.walRoots?.length >= 5 ? 1 : 0,
      ensureArray(plan.crashRecoveryPlan?.crashClasses).length >= 3 ? 1 : 0,
      plan.authorizationBoundary?.humanAuthorityRequired ? 1 : 0,
      profile.evidenceBinding?.evidenceWritebackRoot ? 1 : 0,
    ])),
  };
  return { ...loop, established: loop.feedbackScore >= 0.95, loopRoot: sha256(JSON.stringify(loop)) };
}

export function buildHumanCapabilityGraph(profiles = [], loops = []) {
  const edges = [];
  for (let i = 1; i < profiles.length; i += 1) {
    edges.push({ from: profiles[i - 1].id, to: profiles[i].id, kind: 'capability-stacks-into', hash: sha256(`${profiles[i - 1].id}->${profiles[i].id}`) });
  }
  for (const loop of loops) {
    edges.push({ from: loop.profileId, to: loop.id, kind: 'profile-feedback-loop', hash: sha256(`${loop.profileId}->${loop.id}`) });
  }
  const domains = Array.from(new Set(profiles.map(p => p.capabilityDomain))).sort();
  const graph = {
    format: 'rcl.human-capability-feedback-graph.v0.64',
    profileCount: profiles.length,
    feedbackLoopCount: loops.length,
    domainCount: domains.length,
    domains,
    edges,
    graphScore: round(average([
      profiles.length >= 8 ? 1 : 0,
      loops.length === profiles.length ? 1 : 0,
      domains.length >= 4 ? 1 : 0,
      edges.length >= profiles.length * 2 - 1 ? 1 : 0,
      profiles.every(p => p.established) ? 1 : 0,
      loops.every(l => l.established) ? 1 : 0,
    ])),
  };
  return { ...graph, graphRoot: sha256(JSON.stringify(graph)) };
}

export function buildCapabilityFeedbackRuntime(profiles = [], loops = [], graph = {}) {
  const runtime = {
    format: 'rcl.human-capability-feedback-runtime.v0.64',
    mode: 'human-in-loop-evidence-feedback',
    stateModel: ['capability_state', 'evidence_state', 'authority_state', 'failure_learning_state', 'next_action_state'],
    updateRule: 'capability_delta = evidence_quality × execution_consistency × feedback_learning × authority_integrity',
    prohibitedTransitions: ['self-approval of irreversible action', 'discarding null results', 'treating failure as identity defect', 'unlogged capability promotion'],
    profileRoots: profiles.map(p => p.hashes.profileRoot),
    loopRoots: loops.map(l => l.loopRoot),
    graphRoot: graph.graphRoot,
    runtimeScore: round(average([
      profiles.every(p => p.agencyContract?.humanFinalAuthority) ? 1 : 0,
      loops.every(l => l.failureToLearningMap.length >= 3) ? 1 : 0,
      graph.graphScore ?? 0,
      profiles.every(p => p.evidenceBinding?.evidenceWritebackRoot) ? 1 : 0,
      loops.every(l => l.established) ? 1 : 0,
    ])),
  };
  return { ...runtime, runtimeRoot: sha256(JSON.stringify(runtime)) };
}

export function evaluateHumanCapabilityFeedbackOs(input = {}) {
  const spec = normalizeHumanCapabilityFeedbackOsSpec(input);
  const source = runRncsExecutionBridgeV2(spec.sourceRncsBridge);
  const profiles = source.plans.map((plan, i) => buildHumanCapabilityProfile(plan, i));
  const loops = profiles.map((profile, i) => buildCapabilityFeedbackLoop(profile, source.plans[i], i));
  const graph = buildHumanCapabilityGraph(profiles, loops);
  const runtime = buildCapabilityFeedbackRuntime(profiles, loops, graph);
  const scores = {
    averageProfileScore: round(average(profiles.map(p => p.profileScore))),
    averageFeedbackScore: round(average(loops.map(l => l.feedbackScore))),
    graphScore: graph.graphScore,
    runtimeScore: runtime.runtimeScore,
  };
  const result = {
    format: RCL_HUMAN_CAPABILITY_FEEDBACK_OS_RESULT_FORMAT,
    version: RCL_HUMAN_CAPABILITY_FEEDBACK_OS_VERSION,
    id: spec.id,
    humanCapabilityFeedbackOsEstablished: profiles.length >= spec.thresholds.minProfiles
      && loops.length >= spec.thresholds.minFeedbackLoops
      && scores.averageFeedbackScore >= spec.thresholds.minAverageFeedbackScore
      && profiles.every(p => p.established)
      && loops.every(l => l.established)
      && runtime.runtimeScore >= 0.95,
    sourceRncsExecutionBridgeEstablished: source.rncsExecutionBridgeV2Established,
    profileCount: profiles.length,
    feedbackLoopCount: loops.length,
    growthLedgerCount: loops.reduce((n, l) => n + l.growthLedger.length, 0),
    failureLearningMapCount: loops.reduce((n, l) => n + l.failureToLearningMap.length, 0),
    capabilityDomainCount: graph.domainCount,
    evidenceBindingReady: profiles.every(p => Boolean(p.evidenceBinding?.evidenceWritebackRoot)),
    agencyContractsReady: profiles.every(p => p.agencyContract?.humanFinalAuthority === true),
    graphReady: graph.graphScore >= 0.95,
    runtimeReady: runtime.runtimeScore >= 0.95,
    scores,
  };
  return {
    ok: result.humanCapabilityFeedbackOsEstablished,
    spec,
    source,
    result,
    profiles,
    feedbackLoops: loops,
    graph,
    runtime,
  };
}

export function renderHumanCapabilityProfileDocument(profile, loop) {
  const lines = [];
  lines.push(`# ${profile.technologyNodeName}（${profile.translation}）Human Capability Profile（人类能力画像）`);
  lines.push('');
  lines.push(`**格式**：${RCL_HUMAN_CAPABILITY_DOC_FORMAT}`);
  lines.push(`**Capability Domain（能力域）**：${profile.capabilityDomain}`);
  lines.push(`**Established（成立）**：${profile.established}`);
  lines.push(`**Profile Score（画像分）**：${profile.profileScore}`);
  lines.push(`**Feedback Score（反馈分）**：${loop.feedbackScore}`);
  lines.push('');
  lines.push('## 1. Target Capability（目标能力）');
  lines.push(`- 当前：${profile.currentState.level}；${profile.currentState.evidenceLiteracy}`);
  lines.push(`- 目标：${profile.targetState.level}；${profile.targetState.evidenceLiteracy}`);
  lines.push('');
  lines.push('## 2. Practices（训练动作）');
  for (const p of profile.practices) lines.push(`- ${p}`);
  lines.push('');
  lines.push('## 3. Feedback Loop（反馈循环）');
  for (const step of loop.steps) lines.push(`- ${step}`);
  lines.push('');
  lines.push('## 4. Failure-to-Learning Map（失败到学习映射）');
  for (const row of loop.failureToLearningMap) lines.push(`- ${row.failureClass} → ${row.learningAction}`);
  lines.push('');
  lines.push('## 5. Evidence Binding（证据绑定）');
  lines.push(`- Source Plan（来源计划）：${profile.sourcePlanId}`);
  lines.push(`- WAL Roots（预写日志根）：${profile.evidenceBinding.walRoots.length}`);
  lines.push(`- Evidence Writeback Root（证据回写根）：${profile.evidenceBinding.evidenceWritebackRoot}`);
  lines.push('');
  return {
    format: RCL_HUMAN_CAPABILITY_DOC_FORMAT,
    id: `human-capability-doc:${safeId(profile.id)}`,
    title: `${profile.translation} Human Capability Profile（人类能力画像）`,
    markdown: lines.join('\n'),
  };
}

export function renderHumanCapabilityFeedbackOsDocument(bundle) {
  const lines = [];
  lines.push('# RCL Human Capability Feedback OS（RCL 人类能力反馈操作系统）');
  lines.push('');
  lines.push(`**格式**：${RCL_HUMAN_CAPABILITY_DOC_FORMAT}`);
  lines.push(`**Established（成立）**：${bundle.result.humanCapabilityFeedbackOsEstablished}`);
  lines.push(`**Profiles（能力画像数）**：${bundle.result.profileCount}`);
  lines.push(`**Feedback Loops（反馈循环数）**：${bundle.result.feedbackLoopCount}`);
  lines.push(`**Capability Domains（能力域数）**：${bundle.result.capabilityDomainCount}`);
  lines.push('');
  lines.push('## 1. Role（角色）');
  lines.push('v0.64 将 v0.63 RNCS 执行计划转译为人类能力画像、反馈循环、成长账本、失败学习映射与证据绑定，使 RCL 不只是执行现实任务，也能记录执行如何反过来改变人的能力。');
  lines.push('');
  lines.push('## 2. Capability Domains（能力域）');
  for (const d of bundle.graph.domains) lines.push(`- ${d}`);
  lines.push('');
  lines.push('## 3. Human Authority（人类权威）');
  lines.push('- 人类保持最终授权。');
  lines.push('- 失败不写入身份评价，只写入学习账本。');
  lines.push('- 所有能力提升必须绑定证据、WAL 与 replay hash。');
  lines.push('');
  lines.push('## 4. Next Handoff（下一步交接）');
  lines.push('- v0.65 Reality Product Entry Runtime（现实产品入口运行时）');
  lines.push('');
  return {
    format: RCL_HUMAN_CAPABILITY_DOC_FORMAT,
    id: 'human-capability-feedback-os:technical-document',
    title: 'RCL Human Capability Feedback OS（RCL 人类能力反馈操作系统）',
    markdown: lines.join('\n'),
  };
}

export function runHumanCapabilityFeedbackOs(input = {}) {
  const evaluation = evaluateHumanCapabilityFeedbackOs(input);
  const temp = { result: evaluation.result, profiles: evaluation.profiles, feedbackLoops: evaluation.feedbackLoops, graph: evaluation.graph, runtime: evaluation.runtime };
  const osDoc = renderHumanCapabilityFeedbackOsDocument(temp);
  const profileDocs = evaluation.profiles.map((profile, i) => renderHumanCapabilityProfileDocument(profile, evaluation.feedbackLoops[i]));
  const canonicalRoot = humanCapabilityFeedbackOsCanonicalRoot({
    result: evaluation.result,
    profileRoots: evaluation.profiles.map(p => p.hashes.profileRoot),
    loopRoots: evaluation.feedbackLoops.map(l => l.loopRoot),
    graphRoot: evaluation.graph.graphRoot,
    runtimeRoot: evaluation.runtime.runtimeRoot,
  });
  return {
    format: RCL_HUMAN_CAPABILITY_FEEDBACK_OS_BUNDLE_FORMAT,
    version: RCL_HUMAN_CAPABILITY_FEEDBACK_OS_VERSION,
    ok: evaluation.ok,
    humanCapabilityFeedbackOsEstablished: evaluation.result.humanCapabilityFeedbackOsEstablished,
    result: evaluation.result,
    profiles: evaluation.profiles,
    feedbackLoops: evaluation.feedbackLoops,
    graph: evaluation.graph,
    runtime: evaluation.runtime,
    documents: [osDoc, ...profileDocs],
    canonicalRoot,
  };
}

export function buildHumanCapabilityFeedbackOsSpec(overrides = {}) {
  return normalizeHumanCapabilityFeedbackOsSpec(overrides);
}

export function renderHumanCapabilityFeedbackOsRcl(input = {}) {
  const spec = normalizeHumanCapabilityFeedbackOsSpec(input);
  const bundle = runHumanCapabilityFeedbackOs(spec);
  return `reality HumanCapabilityFeedbackOS {\n  version = "${RCL_HUMAN_CAPABILITY_FEEDBACK_OS_VERSION}"\n  source = "v0.63 RNCS Execution Bridge v2"\n  profiles = ${bundle.result.profileCount}\n  feedback_loops = ${bundle.result.feedbackLoopCount}\n  capability_domains = ${bundle.result.capabilityDomainCount}\n  validation.established : Truth = ${bundle.result.humanCapabilityFeedbackOsEstablished}\n  validation.average_feedback_score = ${bundle.result.scores.averageFeedbackScore}\n  handoff.next = "v0.65 Reality Product Entry Runtime"\n}\n`;
}

export function runHumanCapabilityFeedbackOsDemo() {
  const bundle = runHumanCapabilityFeedbackOs();
  return {
    ok: bundle.ok,
    version: RCL_HUMAN_CAPABILITY_FEEDBACK_OS_VERSION,
    humanCapabilityFeedbackOsEstablished: bundle.humanCapabilityFeedbackOsEstablished,
    profileCount: bundle.result.profileCount,
    feedbackLoopCount: bundle.result.feedbackLoopCount,
    growthLedgerCount: bundle.result.growthLedgerCount,
    failureLearningMapCount: bundle.result.failureLearningMapCount,
    capabilityDomainCount: bundle.result.capabilityDomainCount,
    evidenceBindingReady: bundle.result.evidenceBindingReady,
    averageFeedbackScore: bundle.result.scores.averageFeedbackScore,
    canonicalRoot: bundle.canonicalRoot,
  };
}

export function readHumanCapabilityFeedbackOsInput(filePath) {
  return normalizeHumanCapabilityFeedbackOsSpec(JSON.parse(fs.readFileSync(filePath, 'utf8')));
}

export function writeHumanCapabilityFeedbackOsReports(outputDir, input = {}) {
  const spec = normalizeHumanCapabilityFeedbackOsSpec(input);
  const bundle = runHumanCapabilityFeedbackOs(spec);
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, 'human-capability-feedback-os-spec.json'), `${JSON.stringify(spec, null, 2)}\n`);
  fs.writeFileSync(path.join(outputDir, 'human-capability-feedback-os-result.json'), `${JSON.stringify(bundle.result, null, 2)}\n`);
  fs.writeFileSync(path.join(outputDir, 'human-capability-profiles.json'), `${JSON.stringify(bundle.profiles, null, 2)}\n`);
  fs.writeFileSync(path.join(outputDir, 'capability-feedback-loops.json'), `${JSON.stringify(bundle.feedbackLoops, null, 2)}\n`);
  fs.writeFileSync(path.join(outputDir, 'human-capability-graph.json'), `${JSON.stringify(bundle.graph, null, 2)}\n`);
  fs.writeFileSync(path.join(outputDir, 'human-capability-feedback-runtime.json'), `${JSON.stringify(bundle.runtime, null, 2)}\n`);
  fs.writeFileSync(path.join(outputDir, 'human-capability-feedback-os.rcl'), `${renderHumanCapabilityFeedbackOsRcl(spec)}\n`);
  const docDir = path.join(outputDir, 'human-capability-docs');
  fs.mkdirSync(docDir, { recursive: true });
  for (const doc of bundle.documents) {
    fs.writeFileSync(path.join(docDir, `${safeId(doc.id)}.md`), `${doc.markdown}\n`);
  }
  return {
    ok: bundle.ok,
    version: RCL_HUMAN_CAPABILITY_FEEDBACK_OS_VERSION,
    outputDir,
    humanCapabilityFeedbackOsEstablished: bundle.humanCapabilityFeedbackOsEstablished,
    profileCount: bundle.result.profileCount,
    feedbackLoopCount: bundle.result.feedbackLoopCount,
    growthLedgerCount: bundle.result.growthLedgerCount,
    failureLearningMapCount: bundle.result.failureLearningMapCount,
    documentCount: bundle.documents.length,
    canonicalRoot: bundle.canonicalRoot,
  };
}

export function humanCapabilityFeedbackOsCanonicalRoot(payload = {}) {
  return sha256(JSON.stringify(payload));
}
