import fs from 'node:fs';
import path from 'node:path';
import { sha256 } from './reality-compiler-kernel.mjs';
import {
  runRealityProductEntryRuntime,
  normalizeRealityProductEntryRuntimeSpec,
  RCL_REALITY_PRODUCT_ENTRY_RUNTIME_RESULT_FORMAT,
} from './reality-product-entry-runtime.mjs';

export const RCL_RECURSIVE_FUTURE_RELEASE_PLANNER_VERSION = '0.66.0-alpha.1';
export const RCL_RECURSIVE_FUTURE_RELEASE_PLANNER_SPEC_FORMAT = 'rcl.recursive-future-release-planner-spec.v0.66';
export const RCL_RECURSIVE_FUTURE_RELEASE_PLANNER_RESULT_FORMAT = 'rcl.recursive-future-release-planner-result.v0.66';
export const RCL_RECURSIVE_FUTURE_RELEASE_PLANNER_BUNDLE_FORMAT = 'rcl.recursive-future-release-planner-bundle.v0.66';
export const RCL_FUTURE_RELEASE_PLAN_FORMAT = 'rcl.future-release-plan.v0.66';
export const RCL_RECURSIVE_RELEASE_ROADMAP_FORMAT = 'rcl.recursive-release-roadmap.v0.66';
export const RCL_RECURSIVE_PLANNING_LEDGER_FORMAT = 'rcl.recursive-planning-ledger.v0.66';
export const RCL_FUTURE_RELEASE_DOC_FORMAT = 'rcl.future-release-technical-document.v0.66';

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

function safeId(value, fallback = 'recursive-future-release') {
  return String(value ?? fallback)
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._:-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 140) || fallback;
}

function defaultSourceProductEntryRuntimeSpec() {
  return normalizeRealityProductEntryRuntimeSpec({
    id: 'rcl_recursive_future_release_planner_source_product_entry_v0',
    objective: 'Source v0.65 product entry sessions for recursive future release planning.',
  });
}

export const DEFAULT_RECURSIVE_FUTURE_RELEASE_PLANNER_SPEC = Object.freeze({
  format: RCL_RECURSIVE_FUTURE_RELEASE_PLANNER_SPEC_FORMAT,
  id: 'rcl_recursive_future_release_planner_default_v0',
  version: RCL_RECURSIVE_FUTURE_RELEASE_PLANNER_VERSION,
  objective: 'Compile v0.65 reality product entry runtime into a recursive future release planner that emits future releases, roadmap phases, acceptance gates, failure boundaries and self-upgrade seeds.',
  thresholds: {
    minFutureReleasePlans: 8,
    minRoadmapPhases: 6,
    minAveragePlanningScore: 0.95,
    requireEvidenceCarryForward: true,
    requireHumanGateCarryForward: true,
    requireRncsHandoffCarryForward: true,
    requireRecursiveSeed: true,
    requireNegativeReleaseGuard: true,
  },
  planningPolicy: {
    mode: 'product-entry-to-recursive-release-planning',
    releasePrinciple: 'every release must turn a prior product entry, evidence panel or capability feedback loop into a narrower next-version acceptance contract',
    recursionPolicy: 'each release produces at least one next-cycle seed and at least one explicit stop condition',
    authorityPolicy: 'future plans are not executable authority; they require human confirmation before any external action',
    nextHandoff: 'post-v0.66 cycle: evidence product shell, Aether Forge bridge, automation adapter, simulation runtime, real-world data ingestion, verification council, living artifact runtime and recursive governance kernel',
  },
  sourceRealityProductEntryRuntime: defaultSourceProductEntryRuntimeSpec(),
  futureReleaseCatalog: [
    {
      version: 'v0.67',
      id: 'evidence_product_shell_runtime',
      title: 'Evidence Product Shell Runtime',
      chineseTitle: '证据产品壳运行时',
      objective: 'Package RCL results as product-facing evidence shells with audit trails, rollback paths and shareable review cards.',
      capabilityDomain: 'productization',
    },
    {
      version: 'v0.68',
      id: 'aether_forge_pocket_product_bridge',
      title: 'Aether Forge Pocket Product Bridge',
      chineseTitle: '以太锻造口袋产品桥',
      objective: 'Bridge RCL product entries into Aether Forge Pocket-style mobile software creation, preview and delivery flows.',
      capabilityDomain: 'mobile-software-manufacturing',
    },
    {
      version: 'v0.69',
      id: 'experiment_automation_adapter',
      title: 'Experiment Automation Adapter',
      chineseTitle: '实验自动化适配器',
      objective: 'Transform experiment notebooks and prototype IR into automation-ready instrument, simulator and data collection tasks.',
      capabilityDomain: 'empirical-automation',
    },
    {
      version: 'v0.70',
      id: 'prototype_simulation_runtime',
      title: 'Prototype Simulation Runtime',
      chineseTitle: '原型模拟运行时',
      objective: 'Run prototype models in reproducible simulation loops before real-world execution or laboratory handoff.',
      capabilityDomain: 'prototype-simulation',
    },
    {
      version: 'v0.71',
      id: 'real_world_data_ingestion_layer',
      title: 'Real World Data Ingestion Layer',
      chineseTitle: '真实世界数据接入层',
      objective: 'Ingest public, local or experimental datasets into RCL evidence kernels with provenance, uncertainty and replay metadata.',
      capabilityDomain: 'empirical-data',
    },
    {
      version: 'v0.72',
      id: 'multi_agent_verification_council',
      title: 'Multi-Agent Verification Council',
      chineseTitle: '多智能体验证委员会',
      objective: 'Compile contradictory reviewers, tests and model critics into a deliberation graph for candidate rejection or promotion.',
      capabilityDomain: 'verification-governance',
    },
    {
      version: 'v0.73',
      id: 'living_artifact_runtime',
      title: 'Living Artifact Runtime',
      chineseTitle: '活体产物运行时',
      objective: 'Turn projects, experiments and products into long-lived artifacts with memory, evidence, versioned goals and feedback loops.',
      capabilityDomain: 'living-artifacts',
    },
    {
      version: 'v0.74',
      id: 'recursive_governance_kernel',
      title: 'Recursive Governance Kernel',
      chineseTitle: '递归治理内核',
      objective: 'Govern self-upgrading release plans with authority scopes, stop conditions, risk ledgers and human override contracts.',
      capabilityDomain: 'recursive-governance',
    },
  ],
});

export function normalizeRecursiveFutureReleasePlannerSpec(input = {}) {
  const base = JSON.parse(JSON.stringify(DEFAULT_RECURSIVE_FUTURE_RELEASE_PLANNER_SPEC));
  return {
    ...base,
    ...input,
    format: input.format ?? base.format,
    version: input.version ?? RCL_RECURSIVE_FUTURE_RELEASE_PLANNER_VERSION,
    thresholds: { ...base.thresholds, ...(input.thresholds ?? {}) },
    planningPolicy: { ...base.planningPolicy, ...(input.planningPolicy ?? {}) },
    futureReleaseCatalog: ensureArray(input.futureReleaseCatalog, base.futureReleaseCatalog),
    sourceRealityProductEntryRuntime: input.sourceRealityProductEntryRuntime ?? base.sourceRealityProductEntryRuntime,
  };
}

function sourceProductRuntimeFromSpec(sourceInput) {
  if (sourceInput?.ok && sourceInput?.result?.format === RCL_REALITY_PRODUCT_ENTRY_RUNTIME_RESULT_FORMAT) return sourceInput;
  return runRealityProductEntryRuntime(sourceInput ?? defaultSourceProductEntryRuntimeSpec());
}

function scoreReleasePlan(plan) {
  const checks = [
    plan.sourceEntryId,
    plan.deliverables.length >= 4,
    plan.acceptanceGates.length >= 4,
    plan.failureBoundaries.length >= 3,
    plan.evidenceCarryForward.length >= 3,
    plan.recursiveSeeds.length >= 2,
    plan.humanConfirmationRequired === true,
    plan.rncsHandoffReady === true,
  ];
  return round(checks.filter(Boolean).length / checks.length);
}

export function buildFutureReleasePlan(release, sourceEntry = {}, index = 0, spec = DEFAULT_RECURSIVE_FUTURE_RELEASE_PLANNER_SPEC) {
  const id = safeId(release.id ?? `future-release-${index + 1}`);
  const sourceEntryId = sourceEntry.id ?? sourceEntry.entryId ?? `source-entry-${index + 1}`;
  const plan = {
    format: RCL_FUTURE_RELEASE_PLAN_FORMAT,
    id,
    version: release.version,
    title: release.title,
    chineseTitle: release.chineseTitle,
    capabilityDomain: release.capabilityDomain,
    objective: release.objective,
    sourceEntryId,
    sourcePlanCardId: sourceEntry.planCard?.id ?? sourceEntry.planCardId ?? `${sourceEntryId}:plan-card`,
    sourceEvidencePanelId: sourceEntry.evidencePanel?.id ?? sourceEntry.evidencePanelId ?? `${sourceEntryId}:evidence-panel`,
    releaseType: 'recursive-future-release-plan',
    deliverables: [
      `${release.id}.module`,
      `${release.id}.cli`,
      `${release.id}.spec`,
      `${release.id}.technical-document`,
      `${release.id}.targeted-tests`,
    ],
    acceptanceGates: [
      'source product entry can be replayed',
      'plan card has explicit evidence and rollback surface',
      'release produces a machine-readable spec and natural-language technical document',
      'negative control or stop condition is explicit',
      'human confirmation gate is preserved before external execution',
    ],
    failureBoundaries: [
      'do not execute future release actions without human confirmation',
      'do not promote release if evidence panel cannot be traced to prior artifacts',
      'do not let recursive planning create unbounded self-upgrade authority',
    ],
    evidenceCarryForward: [
      sourceEntry.evidencePanel?.id ?? `${sourceEntryId}:evidence-panel`,
      sourceEntry.capabilityFeedbackWidget?.id ?? `${sourceEntryId}:capability-feedback`,
      sourceEntry.rncsHandoff?.id ?? `${sourceEntryId}:rncs-handoff`,
    ],
    recursiveSeeds: [
      `${id}:next-version-seed`,
      `${id}:stop-condition-seed`,
      `${id}:capability-feedback-seed`,
    ],
    humanConfirmationRequired: true,
    rncsHandoffReady: true,
    authorityPolicy: spec.planningPolicy.authorityPolicy,
  };
  return { ...plan, planningScore: scoreReleasePlan(plan) };
}

export function buildRecursiveReleaseRoadmap(plans = []) {
  const phases = [
    {
      id: 'phase-1-product-evidence-shell',
      title: 'Product Evidence Shell',
      chineseTitle: '产品证据壳',
      releases: ['v0.67'],
      objective: 'Make RCL output reviewable and product-facing.',
    },
    {
      id: 'phase-2-mobile-software-entry',
      title: 'Mobile Software Entry',
      chineseTitle: '移动软件入口',
      releases: ['v0.68'],
      objective: 'Connect RCL product entries to mobile software generation and preview flows.',
    },
    {
      id: 'phase-3-empirical-automation',
      title: 'Empirical Automation',
      chineseTitle: '实证自动化',
      releases: ['v0.69', 'v0.70'],
      objective: 'Turn experiments and prototypes into automated simulations and instrument-ready runs.',
    },
    {
      id: 'phase-4-reality-data-and-verification',
      title: 'Reality Data and Verification',
      chineseTitle: '现实数据与验证',
      releases: ['v0.71', 'v0.72'],
      objective: 'Ingest real-world data and establish multi-agent verification boundaries.',
    },
    {
      id: 'phase-5-living-artifacts',
      title: 'Living Artifacts',
      chineseTitle: '活体产物',
      releases: ['v0.73'],
      objective: 'Make projects, experiments and products persistent feedback-bearing artifacts.',
    },
    {
      id: 'phase-6-recursive-governance',
      title: 'Recursive Governance',
      chineseTitle: '递归治理',
      releases: ['v0.74'],
      objective: 'Constrain self-upgrade loops with authority, evidence, stop conditions and human override.',
    },
  ];
  const planByVersion = new Map(plans.map(p => [p.version, p]));
  return {
    format: RCL_RECURSIVE_RELEASE_ROADMAP_FORMAT,
    id: 'rcl-recursive-release-roadmap-v0.66',
    phaseCount: phases.length,
    phases: phases.map((phase, index) => ({
      ...phase,
      order: index + 1,
      planIds: phase.releases.map(v => planByVersion.get(v)?.id).filter(Boolean),
      ready: phase.releases.every(v => planByVersion.has(v)),
    })),
    dependencyEdges: plans.slice(1).map((plan, index) => ({
      from: plans[index].id,
      to: plan.id,
      relation: 'recursive-release-dependency',
    })),
    roadmapScore: plans.length >= 8 && phases.length >= 6 ? 1 : round((plans.length / 8 + phases.length / 6) / 2),
  };
}

export function buildRecursivePlanningLedger(plans = [], roadmap = buildRecursiveReleaseRoadmap(plans)) {
  const entries = plans.map((plan, index) => ({
    id: `${plan.id}:ledger-entry`,
    releaseVersion: plan.version,
    releaseId: plan.id,
    index,
    inputEvidence: plan.evidenceCarryForward,
    outputSeeds: plan.recursiveSeeds,
    stopConditions: plan.failureBoundaries,
    replayHash: sha256(JSON.stringify({ releaseId: plan.id, evidence: plan.evidenceCarryForward, seeds: plan.recursiveSeeds })),
  }));
  return {
    format: RCL_RECURSIVE_PLANNING_LEDGER_FORMAT,
    id: 'rcl-recursive-planning-ledger-v0.66',
    entries,
    entryCount: entries.length,
    roadmapId: roadmap.id,
    rootHash: sha256(JSON.stringify(entries.map(e => e.replayHash))),
    recursiveDepth: 3,
    governanceReady: entries.every(e => e.stopConditions.length >= 3),
    ledgerScore: entries.length >= 8 && entries.every(e => e.replayHash) ? 1 : round(entries.length / 8),
  };
}

export function evaluateRecursiveFutureReleasePlanner(spec, sourceBundle, plans, roadmap, ledger) {
  const thresholds = spec.thresholds;
  const scores = {
    averagePlanningScore: round(average(plans.map(p => p.planningScore))),
    roadmapScore: roadmap.roadmapScore,
    ledgerScore: ledger.ledgerScore,
    evidenceCarryForwardScore: plans.every(p => p.evidenceCarryForward.length >= 3) ? 1 : 0,
    humanGateScore: plans.every(p => p.humanConfirmationRequired) ? 1 : 0,
    recursionSeedScore: plans.every(p => p.recursiveSeeds.length >= 2) ? 1 : 0,
  };
  const recursiveFutureReleasePlannerEstablished =
    plans.length >= thresholds.minFutureReleasePlans &&
    roadmap.phaseCount >= thresholds.minRoadmapPhases &&
    scores.averagePlanningScore >= thresholds.minAveragePlanningScore &&
    (!thresholds.requireEvidenceCarryForward || scores.evidenceCarryForwardScore === 1) &&
    (!thresholds.requireHumanGateCarryForward || scores.humanGateScore === 1) &&
    (!thresholds.requireRecursiveSeed || scores.recursionSeedScore === 1) &&
    ledger.governanceReady === true;
  return {
    format: RCL_RECURSIVE_FUTURE_RELEASE_PLANNER_RESULT_FORMAT,
    ok: recursiveFutureReleasePlannerEstablished,
    recursiveFutureReleasePlannerEstablished,
    productEntrySourceReady: sourceBundle?.realityProductEntryRuntimeEstablished === true,
    futureReleasePlanCount: plans.length,
    roadmapPhaseCount: roadmap.phaseCount,
    recursivePlanningLedgerEntryCount: ledger.entryCount,
    recursiveDepth: ledger.recursiveDepth,
    governanceReady: ledger.governanceReady,
    evidenceCarryForwardReady: scores.evidenceCarryForwardScore === 1,
    humanConfirmationGateCarryForwardReady: scores.humanGateScore === 1,
    rncsHandoffCarryForwardReady: plans.every(p => p.rncsHandoffReady),
    nextCycleReady: recursiveFutureReleasePlannerEstablished,
    scores,
    rootHash: sha256(JSON.stringify({ plans, roadmap, ledger, scores })),
  };
}

export function renderFutureReleasePlanDocument(plan) {
  return `# ${plan.version} ${plan.title}（${plan.chineseTitle}）\n\n` +
    `**Format（格式）**: ${RCL_FUTURE_RELEASE_DOC_FORMAT}\n\n` +
    `## Objective（目标）\n\n${plan.objective}\n\n` +
    `## Source Entry（来源入口）\n\n- Source Entry ID（来源入口ID）: \`${plan.sourceEntryId}\`\n- Evidence Panel（证据面板）: \`${plan.sourceEvidencePanelId}\`\n\n` +
    `## Deliverables（交付物）\n\n${plan.deliverables.map(d => `- ${d}`).join('\n')}\n\n` +
    `## Acceptance Gates（验收闸门）\n\n${plan.acceptanceGates.map(g => `- ${g}`).join('\n')}\n\n` +
    `## Failure Boundaries（失败边界）\n\n${plan.failureBoundaries.map(f => `- ${f}`).join('\n')}\n\n` +
    `## Recursive Seeds（递归种子）\n\n${plan.recursiveSeeds.map(s => `- ${s}`).join('\n')}\n\n` +
    `## Score（评分）\n\n- Planning Score（规划分）: ${plan.planningScore}\n`;
}

export function renderRecursiveFutureReleasePlannerDocument(bundle) {
  const result = bundle.result;
  return `# RCL Recursive Future Release Planner v0.66（递归未来版本规划器）\n\n` +
    `## Status（状态）\n\n` +
    `- Established（成立）: ${result.recursiveFutureReleasePlannerEstablished}\n` +
    `- Future Release Plans（未来版本计划）: ${result.futureReleasePlanCount}\n` +
    `- Roadmap Phases（路线阶段）: ${result.roadmapPhaseCount}\n` +
    `- Recursive Ledger Entries（递归账本条目）: ${result.recursivePlanningLedgerEntryCount}\n` +
    `- Root Hash（根哈希）: \`${result.rootHash}\`\n\n` +
    `## Roadmap（路线图）\n\n${bundle.roadmap.phases.map(p => `### ${p.order}. ${p.title}（${p.chineseTitle}）\n\n- Releases（版本）: ${p.releases.join(', ')}\n- Objective（目标）: ${p.objective}\n- Ready（就绪）: ${p.ready}\n`).join('\n')}\n` +
    `## Scores（评分）\n\n${Object.entries(result.scores).map(([k, v]) => `- ${k}: ${v}`).join('\n')}\n`;
}

export function runRecursiveFutureReleasePlanner(input = {}) {
  const spec = normalizeRecursiveFutureReleasePlannerSpec(input);
  const sourceBundle = sourceProductRuntimeFromSpec(spec.sourceRealityProductEntryRuntime);
  const entries = ensureArray(sourceBundle.entries, []);
  const catalog = ensureArray(spec.futureReleaseCatalog, DEFAULT_RECURSIVE_FUTURE_RELEASE_PLANNER_SPEC.futureReleaseCatalog);
  const plans = catalog.map((release, index) => buildFutureReleasePlan(release, entries[index % Math.max(entries.length, 1)] ?? {}, index, spec));
  const roadmap = buildRecursiveReleaseRoadmap(plans);
  const ledger = buildRecursivePlanningLedger(plans, roadmap);
  const result = evaluateRecursiveFutureReleasePlanner(spec, sourceBundle, plans, roadmap, ledger);
  return {
    format: RCL_RECURSIVE_FUTURE_RELEASE_PLANNER_BUNDLE_FORMAT,
    ok: result.ok,
    recursiveFutureReleasePlannerEstablished: result.recursiveFutureReleasePlannerEstablished,
    spec,
    source: {
      format: sourceBundle.result?.format,
      rootHash: sourceBundle.result?.rootHash,
      entryCount: sourceBundle.result?.entryCount,
    },
    result,
    futureReleasePlans: plans,
    roadmap,
    ledger,
  };
}

export function buildRecursiveFutureReleasePlannerSpec(overrides = {}) {
  return normalizeRecursiveFutureReleasePlannerSpec(overrides);
}

export function renderRecursiveFutureReleasePlannerRcl(spec = buildRecursiveFutureReleasePlannerSpec()) {
  const normalized = normalizeRecursiveFutureReleasePlannerSpec(spec);
  return `recursive_future_release_planner ${normalized.id} {\n` +
    `  version = "${normalized.version}"\n` +
    `  objective = "${normalized.objective}"\n` +
    `  source = "v0.65 Reality Product Entry Runtime"\n` +
    `  next = "post-v0.66 recursive release cycle"\n` +
    `  require_evidence_carry_forward = ${normalized.thresholds.requireEvidenceCarryForward}\n` +
    `  require_human_gate = ${normalized.thresholds.requireHumanGateCarryForward}\n` +
    `}\n`;
}

export function runRecursiveFutureReleasePlannerDemo() {
  return runRecursiveFutureReleasePlanner();
}

export function readRecursiveFutureReleasePlannerInput(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function recursiveFutureReleasePlannerCanonicalRoot(bundle) {
  return sha256(JSON.stringify({
    result: bundle.result,
    futureReleasePlans: bundle.futureReleasePlans.map(p => ({ id: p.id, version: p.version, score: p.planningScore })),
    roadmap: bundle.roadmap,
    ledger: { entryCount: bundle.ledger.entryCount, rootHash: bundle.ledger.rootHash },
  }));
}

export function writeRecursiveFutureReleasePlannerReports(outDir, input = {}) {
  const bundle = runRecursiveFutureReleasePlanner(input);
  const dir = path.resolve(outDir);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'recursive-future-release-planner-result.json'), `${JSON.stringify(bundle.result, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'future-release-plans.json'), `${JSON.stringify(bundle.futureReleasePlans, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'recursive-release-roadmap.json'), `${JSON.stringify(bundle.roadmap, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'recursive-planning-ledger.json'), `${JSON.stringify(bundle.ledger, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'recursive-future-release-planner.rcl'), renderRecursiveFutureReleasePlannerRcl(bundle.spec));
  const docsDir = path.join(dir, 'future-release-docs');
  fs.mkdirSync(docsDir, { recursive: true });
  for (const plan of bundle.futureReleasePlans) {
    fs.writeFileSync(path.join(docsDir, `${plan.version.replace('v', 'v')}-${plan.id}.md`), renderFutureReleasePlanDocument(plan));
  }
  fs.writeFileSync(path.join(docsDir, 'recursive-future-release-planner.md'), renderRecursiveFutureReleasePlannerDocument(bundle));
  return {
    ok: true,
    dir,
    recursiveFutureReleasePlannerEstablished: bundle.recursiveFutureReleasePlannerEstablished,
    result: bundle.result,
    canonicalRoot: recursiveFutureReleasePlannerCanonicalRoot(bundle),
  };
}
