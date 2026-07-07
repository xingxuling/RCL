import fs from 'node:fs';
import path from 'node:path';
import { sha256 } from './reality-compiler-kernel.mjs';
import {
  runRecursiveFutureReleasePlanner,
  normalizeRecursiveFutureReleasePlannerSpec,
  RCL_RECURSIVE_FUTURE_RELEASE_PLANNER_RESULT_FORMAT,
} from './recursive-future-release-planner.mjs';

export const RCL_EVIDENCE_PRODUCT_SHELL_RUNTIME_VERSION = '0.67.0-alpha.1';
export const RCL_EVIDENCE_PRODUCT_SHELL_RUNTIME_SPEC_FORMAT = 'rcl.evidence-product-shell-runtime-spec.v0.67';
export const RCL_EVIDENCE_PRODUCT_SHELL_RUNTIME_RESULT_FORMAT = 'rcl.evidence-product-shell-runtime-result.v0.67';
export const RCL_EVIDENCE_PRODUCT_SHELL_RUNTIME_BUNDLE_FORMAT = 'rcl.evidence-product-shell-runtime-bundle.v0.67';
export const RCL_EVIDENCE_PRODUCT_SHELL_FORMAT = 'rcl.evidence-product-shell.v0.67';
export const RCL_EVIDENCE_REVIEW_CARD_FORMAT = 'rcl.evidence-review-card.v0.67';
export const RCL_EVIDENCE_PRODUCT_DOC_FORMAT = 'rcl.evidence-product-shell-technical-document.v0.67';

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

function safeId(value, fallback = 'evidence-product-shell') {
  return String(value ?? fallback)
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._:-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 140) || fallback;
}

function defaultRecursiveFutureReleasePlannerSpec() {
  return normalizeRecursiveFutureReleasePlannerSpec({
    id: 'rcl_evidence_product_shell_source_recursive_planner_v0',
    objective: 'Source v0.66 recursive future release plans for evidence product shell packaging.',
  });
}

export const DEFAULT_EVIDENCE_PRODUCT_SHELL_RUNTIME_SPEC = Object.freeze({
  format: RCL_EVIDENCE_PRODUCT_SHELL_RUNTIME_SPEC_FORMAT,
  id: 'rcl_evidence_product_shell_runtime_default_v0',
  version: RCL_EVIDENCE_PRODUCT_SHELL_RUNTIME_VERSION,
  objective: 'Compile v0.66 recursive future release plans into product-facing evidence shells with review cards, evidence panels, demo surfaces, rollback paths, audit trails and shareable release dossiers.',
  thresholds: {
    minShells: 8,
    minReviewCards: 8,
    minAverageShellScore: 0.95,
    requireAuditTrail: true,
    requireRollbackPath: true,
    requireHumanReviewGate: true,
    requireEvidenceDossier: true,
    requireShareableSurface: true,
    requireNegativeClaimGuard: true,
  },
  shellPolicy: {
    mode: 'future-release-plan-to-product-facing-evidence-shell',
    publicClaimPolicy: 'only claim what can be traced to source evidence, acceptance gates and human confirmation boundaries',
    reviewPolicy: 'each shell must be understandable by a non-RCL user while preserving machine-readable audit provenance',
    riskPolicy: 'each shell must expose what is ready, what is simulated, what is not externally executed and what needs human authorization',
    nextHandoff: 'v0.68 Aether Forge Pocket Product Bridge',
  },
  sourceRecursiveFutureReleasePlanner: defaultRecursiveFutureReleasePlannerSpec(),
});

export function normalizeEvidenceProductShellRuntimeSpec(input = {}) {
  const base = JSON.parse(JSON.stringify(DEFAULT_EVIDENCE_PRODUCT_SHELL_RUNTIME_SPEC));
  return {
    ...base,
    ...input,
    format: input.format ?? base.format,
    version: input.version ?? RCL_EVIDENCE_PRODUCT_SHELL_RUNTIME_VERSION,
    thresholds: { ...base.thresholds, ...(input.thresholds ?? {}) },
    shellPolicy: { ...base.shellPolicy, ...(input.shellPolicy ?? {}) },
    sourceRecursiveFutureReleasePlanner: input.sourceRecursiveFutureReleasePlanner ?? base.sourceRecursiveFutureReleasePlanner,
  };
}

function sourceRecursivePlannerFromSpec(sourceInput) {
  if (sourceInput?.ok && sourceInput?.result?.format === RCL_RECURSIVE_FUTURE_RELEASE_PLANNER_RESULT_FORMAT) return sourceInput;
  return runRecursiveFutureReleasePlanner(sourceInput ?? defaultRecursiveFutureReleasePlannerSpec());
}

function scoreEvidenceProductShell(shell) {
  const checks = [
    shell.sourceReleasePlanId,
    shell.productClaim.length > 20,
    shell.evidenceDossier.items.length >= 4,
    shell.reviewCard.humanReadableSummary.length > 30,
    shell.reviewCard.machineReadableEvidence.length >= 4,
    shell.demoSurface.entryPoints.length >= 3,
    shell.auditTrail.length >= 4,
    shell.rollbackPath.length >= 3,
    shell.riskBoundaries.length >= 3,
    shell.humanReviewGate.required === true,
    shell.negativeClaimGuard.blockedClaims.length >= 3,
    shell.shareableSurface.ready === true,
  ];
  return round(checks.filter(Boolean).length / checks.length);
}

export function buildEvidenceReviewCard(plan, shellId) {
  return {
    format: RCL_EVIDENCE_REVIEW_CARD_FORMAT,
    id: `${shellId}:review-card`,
    title: `${plan.version} ${plan.title}`,
    chineseTitle: plan.chineseTitle,
    humanReadableSummary: `${plan.chineseTitle} packages the ${plan.version} future-release plan into a reviewable product shell with explicit evidence, acceptance gates, rollback boundaries and human confirmation before execution.`,
    machineReadableEvidence: [
      { type: 'source-release-plan', id: plan.id, version: plan.version },
      { type: 'source-evidence-panel', id: plan.sourceEvidencePanelId },
      { type: 'acceptance-gates', count: plan.acceptanceGates.length },
      { type: 'recursive-seeds', count: plan.recursiveSeeds.length },
      { type: 'planning-score', value: plan.planningScore },
    ],
    decisionOptions: [
      'approve-for-next-release-planning',
      'request-more-evidence',
      'freeze-shell',
      'reject-claim',
    ],
  };
}

export function buildEvidenceProductShell(plan, index = 0, spec = DEFAULT_EVIDENCE_PRODUCT_SHELL_RUNTIME_SPEC) {
  const id = safeId(`${plan.version}-${plan.id}`, `evidence-product-shell-${index + 1}`);
  const reviewCard = buildEvidenceReviewCard(plan, id);
  const shell = {
    format: RCL_EVIDENCE_PRODUCT_SHELL_FORMAT,
    id,
    version: plan.version,
    title: plan.title,
    chineseTitle: plan.chineseTitle,
    sourceReleasePlanId: plan.id,
    sourcePlanCardId: plan.sourcePlanCardId,
    sourceEvidencePanelId: plan.sourceEvidencePanelId,
    capabilityDomain: plan.capabilityDomain,
    productClaim: `${plan.chineseTitle} is a product-facing evidence shell for ${plan.objective}`,
    objective: plan.objective,
    reviewCard,
    evidenceDossier: {
      id: `${id}:evidence-dossier`,
      items: [
        ...plan.evidenceCarryForward.map(e => ({ type: 'carried-forward-evidence', id: e })),
        { type: 'acceptance-gates', values: plan.acceptanceGates },
        { type: 'failure-boundaries', values: plan.failureBoundaries },
        { type: 'recursive-seeds', values: plan.recursiveSeeds },
      ],
      rootHash: sha256(JSON.stringify({ evidence: plan.evidenceCarryForward, gates: plan.acceptanceGates, failures: plan.failureBoundaries, seeds: plan.recursiveSeeds })),
    },
    demoSurface: {
      id: `${id}:demo-surface`,
      entryPoints: [
        'overview-card',
        'evidence-panel',
        'acceptance-gate-list',
        'rollback-path-view',
        'human-confirmation-view',
      ],
      nonExecutionMode: true,
      previewReady: true,
    },
    auditTrail: [
      { step: 'ingest-source-plan', source: plan.id },
      { step: 'bind-evidence-dossier', source: `${id}:evidence-dossier` },
      { step: 'create-human-review-card', source: reviewCard.id },
      { step: 'attach-rollback-path', source: `${id}:rollback-path` },
      { step: 'seal-shareable-shell', source: id },
    ],
    rollbackPath: [
      'freeze shell and preserve source plan',
      'revert public claim to source objective only',
      'require additional evidence before reactivation',
      'keep audit trail and root hash unchanged',
    ],
    riskBoundaries: [
      'this shell is a review surface, not autonomous execution authority',
      'do not present simulated readiness as real-world completion',
      'do not bypass human confirmation or source evidence review',
    ],
    negativeClaimGuard: {
      enabled: spec.thresholds.requireNegativeClaimGuard,
      blockedClaims: [
        'externally executed without authorization',
        'verified by real world deployment when only shell evidence exists',
        'risk free or irreversible action approved automatically',
      ],
    },
    humanReviewGate: {
      required: true,
      gateId: `${id}:human-review-gate`,
      allowedActions: ['approve', 'revise', 'freeze', 'reject'],
    },
    shareableSurface: {
      ready: true,
      audience: ['founder', 'engineer', 'reviewer', 'investor', 'operator'],
      redactionPolicy: 'hide secrets, preserve hashes, show evidence lineage',
    },
  };
  return { ...shell, shellScore: scoreEvidenceProductShell(shell) };
}

export function buildEvidenceProductShellCatalog(plans = [], spec = DEFAULT_EVIDENCE_PRODUCT_SHELL_RUNTIME_SPEC) {
  return plans.map((plan, index) => buildEvidenceProductShell(plan, index, spec));
}

export function buildEvidenceProductShellRuntime(shells = []) {
  const cards = shells.map(shell => shell.reviewCard);
  const auditRoot = sha256(JSON.stringify(shells.map(s => ({ id: s.id, evidence: s.evidenceDossier.rootHash, score: s.shellScore }))));
  return {
    id: 'rcl-evidence-product-shell-runtime-v0.67',
    shellCount: shells.length,
    reviewCardCount: cards.length,
    evidenceDossierCount: shells.length,
    demoSurfaceCount: shells.length,
    auditRoot,
    shellsReady: shells.every(s => s.shellScore === 1),
    humanReviewReady: shells.every(s => s.humanReviewGate.required),
    shareableSurfaceReady: shells.every(s => s.shareableSurface.ready),
  };
}

export function evaluateEvidenceProductShellRuntime(spec, sourceBundle, shells, runtime) {
  const thresholds = spec.thresholds;
  const scores = {
    averageShellScore: round(average(shells.map(s => s.shellScore))),
    auditTrailScore: shells.every(s => s.auditTrail.length >= 4) ? 1 : 0,
    rollbackPathScore: shells.every(s => s.rollbackPath.length >= 3) ? 1 : 0,
    reviewCardScore: shells.every(s => s.reviewCard.machineReadableEvidence.length >= 4) ? 1 : 0,
    evidenceDossierScore: shells.every(s => s.evidenceDossier.rootHash) ? 1 : 0,
    shareableSurfaceScore: shells.every(s => s.shareableSurface.ready) ? 1 : 0,
    negativeClaimGuardScore: shells.every(s => s.negativeClaimGuard.blockedClaims.length >= 3) ? 1 : 0,
  };
  const evidenceProductShellRuntimeEstablished =
    shells.length >= thresholds.minShells &&
    shells.length >= thresholds.minReviewCards &&
    scores.averageShellScore >= thresholds.minAverageShellScore &&
    (!thresholds.requireAuditTrail || scores.auditTrailScore === 1) &&
    (!thresholds.requireRollbackPath || scores.rollbackPathScore === 1) &&
    (!thresholds.requireHumanReviewGate || runtime.humanReviewReady === true) &&
    (!thresholds.requireEvidenceDossier || scores.evidenceDossierScore === 1) &&
    (!thresholds.requireShareableSurface || scores.shareableSurfaceScore === 1) &&
    (!thresholds.requireNegativeClaimGuard || scores.negativeClaimGuardScore === 1);
  return {
    format: RCL_EVIDENCE_PRODUCT_SHELL_RUNTIME_RESULT_FORMAT,
    ok: evidenceProductShellRuntimeEstablished,
    evidenceProductShellRuntimeEstablished,
    sourceRecursivePlannerReady: sourceBundle?.recursiveFutureReleasePlannerEstablished === true,
    shellCount: shells.length,
    reviewCardCount: shells.length,
    evidenceDossierCount: runtime.evidenceDossierCount,
    demoSurfaceCount: runtime.demoSurfaceCount,
    humanReviewGateCount: shells.filter(s => s.humanReviewGate.required).length,
    shareableSurfaceCount: shells.filter(s => s.shareableSurface.ready).length,
    auditRoot: runtime.auditRoot,
    negativeClaimGuardReady: scores.negativeClaimGuardScore === 1,
    aetherForgeBridgeReady: evidenceProductShellRuntimeEstablished,
    scores,
    rootHash: sha256(JSON.stringify({ runtime, scores, shellIds: shells.map(s => s.id) })),
  };
}

export function renderEvidenceProductShellDocument(shell) {
  return `# ${shell.version} ${shell.title}（${shell.chineseTitle}）\n\n` +
    `**Format（格式）**: ${RCL_EVIDENCE_PRODUCT_DOC_FORMAT}\n\n` +
    `## Product Claim（产品主张）\n\n${shell.productClaim}\n\n` +
    `## Source（来源）\n\n- Source Release Plan（来源版本计划）: \`${shell.sourceReleasePlanId}\`\n- Evidence Panel（证据面板）: \`${shell.sourceEvidencePanelId}\`\n\n` +
    `## Evidence Dossier（证据档案）\n\n- Dossier ID（档案ID）: \`${shell.evidenceDossier.id}\`\n- Root Hash（根哈希）: \`${shell.evidenceDossier.rootHash}\`\n\n` +
    `## Review Card（审查卡）\n\n${shell.reviewCard.humanReadableSummary}\n\n` +
    `## Demo Surface（演示界面）\n\n${shell.demoSurface.entryPoints.map(e => `- ${e}`).join('\n')}\n\n` +
    `## Rollback Path（回滚路径）\n\n${shell.rollbackPath.map(r => `- ${r}`).join('\n')}\n\n` +
    `## Risk Boundaries（风险边界）\n\n${shell.riskBoundaries.map(r => `- ${r}`).join('\n')}\n\n` +
    `## Score（评分）\n\n- Shell Score（产品壳分）: ${shell.shellScore}\n`;
}

export function renderEvidenceProductShellRuntimeDocument(bundle) {
  const result = bundle.result;
  return `# RCL Evidence Product Shell Runtime v0.67（证据产品壳运行时）\n\n` +
    `## Status（状态）\n\n` +
    `- Established（成立）: ${result.evidenceProductShellRuntimeEstablished}\n` +
    `- Shells（产品壳）: ${result.shellCount}\n` +
    `- Review Cards（审查卡）: ${result.reviewCardCount}\n` +
    `- Evidence Dossiers（证据档案）: ${result.evidenceDossierCount}\n` +
    `- Demo Surfaces（演示界面）: ${result.demoSurfaceCount}\n` +
    `- Root Hash（根哈希）: \`${result.rootHash}\`\n\n` +
    `## Shell List（产品壳列表）\n\n${bundle.shells.map(s => `- ${s.version} ${s.title}（${s.chineseTitle}）: ${s.shellScore}`).join('\n')}\n\n` +
    `## Scores（评分）\n\n${Object.entries(result.scores).map(([k, v]) => `- ${k}: ${v}`).join('\n')}\n`;
}

export function runEvidenceProductShellRuntime(input = {}) {
  const spec = normalizeEvidenceProductShellRuntimeSpec(input);
  const sourceBundle = sourceRecursivePlannerFromSpec(spec.sourceRecursiveFutureReleasePlanner);
  const plans = ensureArray(sourceBundle.futureReleasePlans, []);
  const shells = buildEvidenceProductShellCatalog(plans, spec);
  const runtime = buildEvidenceProductShellRuntime(shells);
  const result = evaluateEvidenceProductShellRuntime(spec, sourceBundle, shells, runtime);
  return {
    format: RCL_EVIDENCE_PRODUCT_SHELL_RUNTIME_BUNDLE_FORMAT,
    ok: result.ok,
    evidenceProductShellRuntimeEstablished: result.evidenceProductShellRuntimeEstablished,
    spec,
    source: {
      format: sourceBundle.result?.format,
      rootHash: sourceBundle.result?.rootHash,
      futureReleasePlanCount: sourceBundle.result?.futureReleasePlanCount,
    },
    result,
    shells,
    runtime,
  };
}

export function buildEvidenceProductShellRuntimeSpec(overrides = {}) {
  return normalizeEvidenceProductShellRuntimeSpec(overrides);
}

export function renderEvidenceProductShellRuntimeRcl(spec = buildEvidenceProductShellRuntimeSpec()) {
  const normalized = normalizeEvidenceProductShellRuntimeSpec(spec);
  return `evidence_product_shell_runtime ${normalized.id} {\n` +
    `  version = "${normalized.version}"\n` +
    `  objective = "${normalized.objective}"\n` +
    `  source = "v0.66 Recursive Future Release Planner"\n` +
    `  next = "v0.68 Aether Forge Pocket Product Bridge"\n` +
    `  require_audit_trail = ${normalized.thresholds.requireAuditTrail}\n` +
    `  require_human_review_gate = ${normalized.thresholds.requireHumanReviewGate}\n` +
    `}\n`;
}

export function runEvidenceProductShellRuntimeDemo() {
  return runEvidenceProductShellRuntime();
}

export function readEvidenceProductShellRuntimeInput(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function evidenceProductShellRuntimeCanonicalRoot(bundle) {
  return sha256(JSON.stringify({
    result: bundle.result,
    shells: bundle.shells.map(s => ({ id: s.id, score: s.shellScore, evidence: s.evidenceDossier.rootHash })),
    runtime: { auditRoot: bundle.runtime.auditRoot, shellCount: bundle.runtime.shellCount },
  }));
}

export function writeEvidenceProductShellRuntimeReports(outDir, input = {}) {
  const bundle = runEvidenceProductShellRuntime(input);
  const dir = path.resolve(outDir);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'evidence-product-shell-runtime-result.json'), `${JSON.stringify(bundle.result, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'evidence-product-shells.json'), `${JSON.stringify(bundle.shells, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'evidence-product-shell-runtime.json'), `${JSON.stringify(bundle.runtime, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'evidence-product-shell-runtime.rcl'), renderEvidenceProductShellRuntimeRcl(bundle.spec));
  const docsDir = path.join(dir, 'evidence-product-shell-docs');
  fs.mkdirSync(docsDir, { recursive: true });
  for (const shell of bundle.shells) {
    fs.writeFileSync(path.join(docsDir, `${shell.version}-${shell.id}.md`), renderEvidenceProductShellDocument(shell));
  }
  fs.writeFileSync(path.join(docsDir, 'evidence-product-shell-runtime.md'), renderEvidenceProductShellRuntimeDocument(bundle));
  return {
    ok: true,
    dir,
    evidenceProductShellRuntimeEstablished: bundle.evidenceProductShellRuntimeEstablished,
    result: bundle.result,
    canonicalRoot: evidenceProductShellRuntimeCanonicalRoot(bundle),
  };
}
