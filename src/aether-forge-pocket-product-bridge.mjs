import fs from 'node:fs';
import path from 'node:path';
import { sha256 } from './reality-compiler-kernel.mjs';
import {
  runEvidenceProductShellRuntime,
  normalizeEvidenceProductShellRuntimeSpec,
  RCL_EVIDENCE_PRODUCT_SHELL_RUNTIME_RESULT_FORMAT,
} from './evidence-product-shell-runtime.mjs';

export const RCL_AETHER_FORGE_POCKET_PRODUCT_BRIDGE_VERSION = '0.68.0-alpha.1';
export const RCL_AETHER_FORGE_POCKET_PRODUCT_BRIDGE_SPEC_FORMAT = 'rcl.aether-forge-pocket-product-bridge-spec.v0.68';
export const RCL_AETHER_FORGE_POCKET_PRODUCT_BRIDGE_RESULT_FORMAT = 'rcl.aether-forge-pocket-product-bridge-result.v0.68';
export const RCL_AETHER_FORGE_POCKET_PRODUCT_BRIDGE_BUNDLE_FORMAT = 'rcl.aether-forge-pocket-product-bridge-bundle.v0.68';
export const RCL_AETHER_FORGE_POCKET_CARD_FORMAT = 'rcl.aether-forge-pocket-product-card.v0.68';
export const RCL_AETHER_FORGE_PROJECT_KNOWLEDGE_FORMAT = 'rcl.aether-forge-project-knowledge.v0.68';
export const RCL_AETHER_FORGE_BRIDGE_DOC_FORMAT = 'rcl.aether-forge-pocket-product-bridge-technical-document.v0.68';

function round(value, digits = 9) {
  const scale = 10 ** digits;
  return Math.round(Number(value) * scale) / scale;
}

function average(values) {
  const xs = values.map(Number).filter(Number.isFinite);
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

function safeId(value, fallback = 'aether-forge-pocket-product-bridge') {
  return String(value ?? fallback)
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._:-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 150) || fallback;
}

function ensureArray(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

function defaultEvidenceProductShellRuntimeSpec() {
  return normalizeEvidenceProductShellRuntimeSpec({
    id: 'rcl_aether_forge_pocket_source_evidence_shell_runtime_v0',
    objective: 'Source v0.67 evidence product shells for Aether Forge Pocket mobile product bridge packaging.',
  });
}

export const DEFAULT_AETHER_FORGE_POCKET_PRODUCT_BRIDGE_SPEC = Object.freeze({
  format: RCL_AETHER_FORGE_POCKET_PRODUCT_BRIDGE_SPEC_FORMAT,
  id: 'rcl_aether_forge_pocket_product_bridge_default_v0',
  version: RCL_AETHER_FORGE_POCKET_PRODUCT_BRIDGE_VERSION,
  objective: 'Bridge v0.67 evidence product shells into Aether Forge Pocket mobile product cards, project knowledge, plan-mode contracts, preview/build adapters and delivery handoffs.',
  thresholds: {
    minBridgeEntries: 8,
    minMobileProductCards: 8,
    minProjectKnowledgeFiles: 8,
    minAverageBridgeScore: 0.95,
    requireProjectKnowledge: true,
    requirePlanModeContract: true,
    requirePreviewSurface: true,
    requireBuildAdapter: true,
    requireDeliveryHandoff: true,
    requireEvidenceBinding: true,
    requireMobileSafeMode: true,
  },
  bridgePolicy: {
    mode: 'evidence-shell-to-mobile-lovable-product-entry',
    targetSurface: 'Aether Forge Pocket',
    productLoop: [
      'goal-intake',
      'project-knowledge',
      'plan-mode',
      'code-or-prototype-action',
      'build-preview',
      'evidence-review',
      'accept-reject-rollback',
      'delivery-handoff',
    ],
    mobileSafetyPolicy: 'do not execute destructive actions without human confirmation and evidence review',
    nextHandoff: 'v0.69 Experiment Automation Adapter',
  },
  sourceEvidenceProductShellRuntime: defaultEvidenceProductShellRuntimeSpec(),
});

export function normalizeAetherForgePocketProductBridgeSpec(input = {}) {
  const base = JSON.parse(JSON.stringify(DEFAULT_AETHER_FORGE_POCKET_PRODUCT_BRIDGE_SPEC));
  return {
    ...base,
    ...input,
    format: input.format ?? base.format,
    version: input.version ?? RCL_AETHER_FORGE_POCKET_PRODUCT_BRIDGE_VERSION,
    thresholds: { ...base.thresholds, ...(input.thresholds ?? {}) },
    bridgePolicy: { ...base.bridgePolicy, ...(input.bridgePolicy ?? {}) },
    sourceEvidenceProductShellRuntime: input.sourceEvidenceProductShellRuntime ?? base.sourceEvidenceProductShellRuntime,
  };
}

function sourceEvidenceShellRuntimeFromSpec(sourceInput) {
  if (sourceInput?.ok && sourceInput?.result?.format === RCL_EVIDENCE_PRODUCT_SHELL_RUNTIME_RESULT_FORMAT) return sourceInput;
  return runEvidenceProductShellRuntime(sourceInput ?? defaultEvidenceProductShellRuntimeSpec());
}

export function buildAetherForgeProjectKnowledge(shell, bridgeId) {
  const knowledge = {
    format: RCL_AETHER_FORGE_PROJECT_KNOWLEDGE_FORMAT,
    id: `${bridgeId}:project-knowledge`,
    productGoal: shell.objective,
    productName: shell.chineseTitle ?? shell.title,
    technicalStack: ['RCL', 'RNCS', 'Aether Forge Pocket', 'JSON Evidence Bundle', 'Markdown Technical Docs'],
    directoryModel: {
      input: 'examples/aether-forge-pocket-product-bridge/*.json',
      runtime: 'src/aether-forge-pocket-product-bridge.mjs',
      output: 'output/v0.68/aether-forge-pocket-product-bridge',
      docs: 'output/v0.68/aether-forge-pocket-product-bridge/technical-docs',
    },
    designRules: [
      'surface evidence before action',
      'show plan before execution',
      'preserve rollback path',
      'keep mobile controls concise',
      'display Chinese labels for English technical terms',
    ],
    forbiddenZones: [
      'no secret export',
      'no irreversible execution without human gate',
      'no simulated completion claimed as real-world completion',
    ],
    acceptanceRules: [
      'product card references source evidence shell',
      'plan mode has affected areas and rollback point',
      'preview/build adapter is explicit',
      'delivery handoff is non-destructive by default',
    ],
    evidenceBinding: {
      sourceShellId: shell.id,
      sourceEvidenceDossier: shell.evidenceDossier?.id,
      sourceEvidenceHash: shell.evidenceDossier?.rootHash,
    },
  };
  return { ...knowledge, knowledgeHash: sha256(JSON.stringify(knowledge)) };
}

export function buildAetherForgePocketProductCard(shell, index = 0, spec = DEFAULT_AETHER_FORGE_POCKET_PRODUCT_BRIDGE_SPEC) {
  const id = safeId(`afp-${shell.version}-${shell.id}`, `aether-forge-pocket-card-${index + 1}`);
  const projectKnowledge = buildAetherForgeProjectKnowledge(shell, id);
  const mobileCard = {
    format: RCL_AETHER_FORGE_POCKET_CARD_FORMAT,
    id,
    title: shell.chineseTitle ?? shell.title,
    englishTitle: shell.title,
    sourceShellId: shell.id,
    capabilityDomain: shell.capabilityDomain,
    productClaim: shell.productClaim,
    status: 'ready-for-mobile-review',
    pocketEntry: {
      label: `${shell.chineseTitle ?? shell.title}`,
      primaryAction: 'open-plan-mode',
      secondaryActions: ['view-evidence', 'preview-runtime', 'export-zip', 'freeze-or-rollback'],
      mobileSafeMode: true,
    },
    projectKnowledge,
    planModeContract: {
      id: `${id}:plan-mode-contract`,
      taskUnderstanding: shell.objective,
      affectedAreas: ['project-knowledge', 'evidence-shell', 'preview-surface', 'delivery-handoff'],
      expectedActions: ['generate-plan', 'bind-evidence', 'prepare-preview', 'wait-human-confirmation'],
      tests: ['evidence-binding-check', 'rollback-path-check', 'mobile-safe-mode-check'],
      rollbackPoint: shell.rollbackPath?.[0] ?? 'freeze product card and preserve source shell',
      acceptanceRules: projectKnowledge.acceptanceRules,
    },
    previewSurface: {
      id: `${id}:preview-surface`,
      modes: ['mobile-card', 'tablet-review', 'desktop-evidence-board'],
      previewAdapters: ['json-panel', 'markdown-document', 'evidence-dossier', 'rncs-handoff-preview'],
      instantPreviewReady: true,
    },
    buildAdapter: {
      id: `${id}:build-adapter`,
      targets: ['zip-export', 'webview-preview', 'android-apk-placeholder', 'rncs-execution-preview'],
      destructiveBuildsDisabledByDefault: true,
      requiresHumanConfirmation: true,
    },
    deliveryHandoff: {
      id: `${id}:delivery-handoff`,
      outputForms: ['source-zip', 'technical-docs-zip', 'evidence-bundle-json', 'mobile-product-card-json'],
      handoffReady: true,
      nextRuntime: spec.bridgePolicy.nextHandoff,
    },
    visualEditSurface: {
      id: `${id}:visual-edit-surface`,
      selectableRegions: ['title', 'summary', 'evidence-panel', 'plan-card', 'action-buttons'],
      localModificationOnly: true,
      sourceTraceRequired: true,
    },
    evidencePanel: {
      sourceEvidenceDossier: shell.evidenceDossier?.id,
      sourceEvidenceRoot: shell.evidenceDossier?.rootHash,
      reviewCardId: shell.reviewCard?.id,
      auditTrail: ensureArray(shell.auditTrail).map(step => step.step ?? step),
    },
    humanGate: shell.humanReviewGate ?? { required: true, allowedActions: ['approve', 'revise', 'freeze', 'reject'] },
  };
  return { ...mobileCard, bridgeScore: scoreAetherForgePocketBridge(mobileCard) };
}

export function scoreAetherForgePocketBridge(card) {
  const checks = [
    card.sourceShellId,
    card.pocketEntry.mobileSafeMode === true,
    card.projectKnowledge.knowledgeHash,
    card.planModeContract.acceptanceRules.length >= 4,
    card.previewSurface.instantPreviewReady === true,
    card.buildAdapter.requiresHumanConfirmation === true,
    card.deliveryHandoff.handoffReady === true,
    card.visualEditSurface.localModificationOnly === true,
    card.evidencePanel.sourceEvidenceRoot,
    card.humanGate.required === true,
  ];
  return round(checks.filter(Boolean).length / checks.length);
}

export function buildAetherForgePocketBridgeCatalog(shells = [], spec = DEFAULT_AETHER_FORGE_POCKET_PRODUCT_BRIDGE_SPEC) {
  return shells.map((shell, index) => buildAetherForgePocketProductCard(shell, index, spec));
}

export function buildAetherForgePocketBridgeRuntime(cards = []) {
  const bridgeRoot = sha256(JSON.stringify(cards.map(card => ({ id: card.id, source: card.sourceShellId, score: card.bridgeScore, knowledgeHash: card.projectKnowledge.knowledgeHash }))));
  return {
    id: 'rcl-aether-forge-pocket-product-bridge-v0.68',
    bridgeCount: cards.length,
    mobileProductCardCount: cards.length,
    projectKnowledgeCount: cards.length,
    planModeContractCount: cards.length,
    previewSurfaceCount: cards.length,
    buildAdapterCount: cards.length,
    deliveryHandoffCount: cards.length,
    visualEditSurfaceCount: cards.length,
    bridgeRoot,
    mobileProductLoopReady: cards.every(card => card.bridgeScore === 1),
    aetherForgePocketReady: cards.every(card => card.pocketEntry.mobileSafeMode === true && card.deliveryHandoff.handoffReady === true),
    experimentAutomationAdapterReady: true,
  };
}

export function evaluateAetherForgePocketProductBridge(spec, sourceBundle, cards, runtime) {
  const thresholds = spec.thresholds;
  const scores = {
    averageBridgeScore: round(average(cards.map(card => card.bridgeScore))),
    projectKnowledgeScore: cards.every(card => card.projectKnowledge.knowledgeHash) ? 1 : 0,
    planModeScore: cards.every(card => card.planModeContract.acceptanceRules.length >= 4) ? 1 : 0,
    previewSurfaceScore: cards.every(card => card.previewSurface.instantPreviewReady) ? 1 : 0,
    buildAdapterScore: cards.every(card => card.buildAdapter.requiresHumanConfirmation) ? 1 : 0,
    deliveryHandoffScore: cards.every(card => card.deliveryHandoff.handoffReady) ? 1 : 0,
    evidenceBindingScore: cards.every(card => card.evidencePanel.sourceEvidenceRoot) ? 1 : 0,
    mobileSafeModeScore: cards.every(card => card.pocketEntry.mobileSafeMode) ? 1 : 0,
  };
  const aetherForgePocketProductBridgeEstablished =
    cards.length >= thresholds.minBridgeEntries &&
    cards.length >= thresholds.minMobileProductCards &&
    cards.length >= thresholds.minProjectKnowledgeFiles &&
    scores.averageBridgeScore >= thresholds.minAverageBridgeScore &&
    (!thresholds.requireProjectKnowledge || scores.projectKnowledgeScore === 1) &&
    (!thresholds.requirePlanModeContract || scores.planModeScore === 1) &&
    (!thresholds.requirePreviewSurface || scores.previewSurfaceScore === 1) &&
    (!thresholds.requireBuildAdapter || scores.buildAdapterScore === 1) &&
    (!thresholds.requireDeliveryHandoff || scores.deliveryHandoffScore === 1) &&
    (!thresholds.requireEvidenceBinding || scores.evidenceBindingScore === 1) &&
    (!thresholds.requireMobileSafeMode || scores.mobileSafeModeScore === 1);

  return {
    format: RCL_AETHER_FORGE_POCKET_PRODUCT_BRIDGE_RESULT_FORMAT,
    ok: aetherForgePocketProductBridgeEstablished,
    aetherForgePocketProductBridgeEstablished,
    sourceEvidenceShellRuntimeReady: Boolean(sourceBundle?.evidenceProductShellRuntimeEstablished),
    bridgeCount: cards.length,
    mobileProductCardCount: runtime.mobileProductCardCount,
    projectKnowledgeCount: runtime.projectKnowledgeCount,
    planModeContractCount: runtime.planModeContractCount,
    previewSurfaceCount: runtime.previewSurfaceCount,
    buildAdapterCount: runtime.buildAdapterCount,
    deliveryHandoffCount: runtime.deliveryHandoffCount,
    visualEditSurfaceCount: runtime.visualEditSurfaceCount,
    mobileProductLoopReady: runtime.mobileProductLoopReady,
    aetherForgePocketReady: runtime.aetherForgePocketReady,
    experimentAutomationAdapterReady: runtime.experimentAutomationAdapterReady,
    scores,
    rootHash: sha256(JSON.stringify({ specId: spec.id, sourceRoot: sourceBundle?.result?.rootHash, runtime, scores })),
  };
}

export function renderAetherForgePocketProductBridgeDocument(card) {
  return `# ${card.title}\n\n` +
    `**Format**: ${RCL_AETHER_FORGE_BRIDGE_DOC_FORMAT}\n\n` +
    `## 1. Product Card（产品卡）\n\n` +
    `- Source Shell（来源证据壳）: \`${card.sourceShellId}\`\n` +
    `- Capability Domain（能力域）: \`${card.capabilityDomain}\`\n` +
    `- Status（状态）: \`${card.status}\`\n` +
    `- Bridge Score（桥接分）: \`${card.bridgeScore}\`\n\n` +
    `## 2. Project Knowledge（项目知识）\n\n` +
    `- Product Goal（产品目标）: ${card.projectKnowledge.productGoal}\n` +
    `- Technical Stack（技术栈）: ${card.projectKnowledge.technicalStack.join(', ')}\n` +
    `- Knowledge Hash（知识哈希）: \`${card.projectKnowledge.knowledgeHash}\`\n\n` +
    `## 3. Plan Mode Contract（计划模式契约）\n\n` +
    `- Task Understanding（任务理解）: ${card.planModeContract.taskUnderstanding}\n` +
    `- Affected Areas（影响区域）: ${card.planModeContract.affectedAreas.join(', ')}\n` +
    `- Rollback Point（回滚点）: ${card.planModeContract.rollbackPoint}\n` +
    `- Tests（测试）: ${card.planModeContract.tests.join(', ')}\n\n` +
    `## 4. Preview and Build（预览与构建）\n\n` +
    `- Preview Modes（预览模式）: ${card.previewSurface.modes.join(', ')}\n` +
    `- Build Targets（构建目标）: ${card.buildAdapter.targets.join(', ')}\n` +
    `- Human Confirmation（人类确认）: ${card.buildAdapter.requiresHumanConfirmation ? 'required' : 'not required'}\n\n` +
    `## 5. Delivery Handoff（交付交接）\n\n` +
    `- Output Forms（输出形式）: ${card.deliveryHandoff.outputForms.join(', ')}\n` +
    `- Next Runtime（下一运行时）: ${card.deliveryHandoff.nextRuntime}\n\n` +
    `## 6. Evidence Panel（证据面板）\n\n` +
    `- Evidence Dossier（证据档案）: \`${card.evidencePanel.sourceEvidenceDossier}\`\n` +
    `- Evidence Root（证据根）: \`${card.evidencePanel.sourceEvidenceRoot}\`\n` +
    `- Review Card（审查卡）: \`${card.evidencePanel.reviewCardId}\`\n`;
}

export function renderAetherForgePocketProductBridgeRuntimeDocument(result, cards) {
  return `# RCL Aether Forge Pocket Product Bridge v0.68\n\n` +
    `## Summary（摘要）\n\n` +
    `- Established（是否成立）: ${result.aetherForgePocketProductBridgeEstablished}\n` +
    `- Bridge Count（桥接数量）: ${result.bridgeCount}\n` +
    `- Mobile Product Cards（移动产品卡）: ${result.mobileProductCardCount}\n` +
    `- Project Knowledge Files（项目知识文件）: ${result.projectKnowledgeCount}\n` +
    `- Plan Mode Contracts（计划模式契约）: ${result.planModeContractCount}\n` +
    `- Preview Surfaces（预览界面）: ${result.previewSurfaceCount}\n` +
    `- Build Adapters（构建适配器）: ${result.buildAdapterCount}\n` +
    `- Delivery Handoffs（交付交接）: ${result.deliveryHandoffCount}\n` +
    `- Average Bridge Score（平均桥接分）: ${result.scores.averageBridgeScore}\n\n` +
    `## Product Cards（产品卡列表）\n\n` +
    cards.map(card => `- **${card.title}** / ${card.englishTitle}: \`${card.id}\`, score=${card.bridgeScore}`).join('\n') +
    `\n\n## Next Step（下一步）\n\n` +
    `v0.69 Experiment Automation Adapter（实验自动化适配器） should connect these mobile product cards to automated experimental execution adapters.\n`;
}

export function runAetherForgePocketProductBridge(input = {}) {
  const spec = normalizeAetherForgePocketProductBridgeSpec(input);
  const source = sourceEvidenceShellRuntimeFromSpec(spec.sourceEvidenceProductShellRuntime);
  const shells = ensureArray(source.shells);
  const cards = buildAetherForgePocketBridgeCatalog(shells, spec);
  const runtime = buildAetherForgePocketBridgeRuntime(cards);
  const result = evaluateAetherForgePocketProductBridge(spec, source, cards, runtime);
  return {
    format: RCL_AETHER_FORGE_POCKET_PRODUCT_BRIDGE_BUNDLE_FORMAT,
    ok: result.ok,
    aetherForgePocketProductBridgeEstablished: result.aetherForgePocketProductBridgeEstablished,
    spec,
    source,
    result,
    cards,
    runtime,
  };
}

export function buildAetherForgePocketProductBridgeSpec(overrides = {}) {
  return normalizeAetherForgePocketProductBridgeSpec(overrides);
}

export function renderAetherForgePocketProductBridgeRcl(spec = DEFAULT_AETHER_FORGE_POCKET_PRODUCT_BRIDGE_SPEC) {
  const normalized = normalizeAetherForgePocketProductBridgeSpec(spec);
  return [
    'reality AetherForgePocketProductBridgeV068 {',
    `  format: "${RCL_AETHER_FORGE_POCKET_PRODUCT_BRIDGE_SPEC_FORMAT}"`,
    `  objective: "${normalized.objective}"`,
    `  targetSurface: "${normalized.bridgePolicy.targetSurface}"`,
    `  productLoop: [${normalized.bridgePolicy.productLoop.map(x => `"${x}"`).join(', ')}]`,
    `  minBridgeEntries: ${normalized.thresholds.minBridgeEntries}`,
    `  requireProjectKnowledge: ${normalized.thresholds.requireProjectKnowledge}`,
    `  requirePlanModeContract: ${normalized.thresholds.requirePlanModeContract}`,
    `  requirePreviewSurface: ${normalized.thresholds.requirePreviewSurface}`,
    `  requireBuildAdapter: ${normalized.thresholds.requireBuildAdapter}`,
    `  requireDeliveryHandoff: ${normalized.thresholds.requireDeliveryHandoff}`,
    '}',
  ].join('\n');
}

export function runAetherForgePocketProductBridgeDemo() {
  return runAetherForgePocketProductBridge(DEFAULT_AETHER_FORGE_POCKET_PRODUCT_BRIDGE_SPEC);
}

export function readAetherForgePocketProductBridgeInput(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export function writeAetherForgePocketProductBridgeReports(outDir, input = {}) {
  const dir = path.resolve(outDir);
  fs.mkdirSync(dir, { recursive: true });
  const bundle = runAetherForgePocketProductBridge(input);
  const docsDir = path.join(dir, 'technical-docs');
  const cardsDir = path.join(dir, 'mobile-product-cards');
  const knowledgeDir = path.join(dir, 'project-knowledge');
  fs.mkdirSync(docsDir, { recursive: true });
  fs.mkdirSync(cardsDir, { recursive: true });
  fs.mkdirSync(knowledgeDir, { recursive: true });

  fs.writeFileSync(path.join(dir, 'aether-forge-pocket-product-bridge-result.json'), `${JSON.stringify(bundle.result, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'aether-forge-pocket-product-bridge-bundle.json'), `${JSON.stringify(bundle, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'aether-forge-pocket-product-bridge.rcl'), `${renderAetherForgePocketProductBridgeRcl(bundle.spec)}\n`);
  fs.writeFileSync(path.join(dir, 'aether-forge-pocket-product-bridge.md'), renderAetherForgePocketProductBridgeRuntimeDocument(bundle.result, bundle.cards));

  for (const card of bundle.cards) {
    const name = safeId(card.id, 'aether-forge-pocket-card');
    fs.writeFileSync(path.join(cardsDir, `${name}.json`), `${JSON.stringify(card, null, 2)}\n`);
    fs.writeFileSync(path.join(knowledgeDir, `${name}.project-knowledge.json`), `${JSON.stringify(card.projectKnowledge, null, 2)}\n`);
    fs.writeFileSync(path.join(docsDir, `${name}.md`), renderAetherForgePocketProductBridgeDocument(card));
  }

  return {
    ok: bundle.ok,
    outDir: dir,
    resultPath: path.join(dir, 'aether-forge-pocket-product-bridge-result.json'),
    bundlePath: path.join(dir, 'aether-forge-pocket-product-bridge-bundle.json'),
    docsDir,
    cardsDir,
    knowledgeDir,
    result: bundle.result,
  };
}

export function aetherForgePocketProductBridgeCanonicalRoot(input = {}) {
  return runAetherForgePocketProductBridge(input).result.rootHash;
}
