import fs from 'node:fs';
import path from 'node:path';
import { sha256 } from './reality-compiler-kernel.mjs';
import {
  runRecursiveGovernanceKernel,
  normalizeRecursiveGovernanceKernelSpec,
} from './recursive-governance-kernel.mjs';

export const RCL_UNIVERSAL_SEMANTIC_TRANSLATOR_VERSION = '0.75.0-alpha.1';
export const RCL_UNIVERSAL_SEMANTIC_TRANSLATOR_SPEC_FORMAT = 'rcl.universal-semantic-translator-spec.v0.75';
export const RCL_UNIVERSAL_SEMANTIC_TRANSLATOR_RESULT_FORMAT = 'rcl.universal-semantic-translator-result.v0.75';
export const RCL_UNIVERSAL_SEMANTIC_TRANSLATOR_BUNDLE_FORMAT = 'rcl.universal-semantic-translator-bundle.v0.75';
export const RCL_SEMANTIC_IR_FORMAT = 'rcl.semantic-ir.v0.75';
export const RCL_NATURAL_LANGUAGE_DOCUMENT_FORMAT = 'rcl.natural-language-document.v0.75';

function round(value, digits = 9) {
  const scale = 10 ** digits;
  return Math.round(Number(value) * scale) / scale;
}

function average(values) {
  const xs = values.map(Number).filter(Number.isFinite);
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

function safeId(value, fallback = 'semantic-input') {
  return String(value ?? fallback)
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._:-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 150) || fallback;
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null) return [];
  return [value];
}

function tokenize(text) {
  return String(text ?? '')
    .replace(/[\u3000\s]+/g, ' ')
    .split(/[^\p{L}\p{N}_:+.-]+/u)
    .filter(Boolean)
    .slice(0, 160);
}

function compactObject(value) {
  if (typeof value === 'string') return value;
  try { return JSON.stringify(value, null, 2); } catch { return String(value); }
}

function detectSourceType(record) {
  const text = `${record.kind ?? ''} ${record.language ?? ''} ${record.title ?? ''} ${record.content ?? ''}`.toLowerCase();
  if (text.includes('experiment') || text.includes('实验')) return 'experiment_protocol';
  if (text.includes('governance') || text.includes('治理')) return 'governance_policy';
  if (text.includes('technology tree') || text.includes('civilization') || text.includes('文明')) return 'civilization_technology_tree';
  if (text.includes('product') || text.includes('产品') || text.includes('entry')) return 'product_entry';
  if (text.includes('code') || text.includes('function') || text.includes('export') || text.includes('class')) return 'source_code';
  if (text.includes('unknown') || text.includes('candidate') || text.includes('候选')) return 'unknown_knowledge';
  if (text.includes('rcl') || text.includes('dsl')) return 'rcl_structure';
  return 'natural_language';
}

function detectIntent(record, sourceType) {
  const title = String(record.title ?? record.id ?? sourceType);
  const lower = `${title} ${record.content ?? ''}`.toLowerCase();
  if (lower.includes('verify') || lower.includes('验证')) return 'verify-and-explain';
  if (lower.includes('run') || lower.includes('execute') || lower.includes('执行')) return 'execute-and-report';
  if (lower.includes('design') || lower.includes('设计')) return 'design-and-document';
  if (lower.includes('teach') || lower.includes('教学')) return 'teach-and-clarify';
  if (lower.includes('evidence') || lower.includes('证据')) return 'evidence-review';
  return sourceType === 'source_code' ? 'explain-implementation' : 'naturalize-structure';
}

function extractStructures(tokens, sourceType) {
  const baseByType = {
    rcl_structure: ['semantic-ir', 'compiler-boundary', 'runtime-contract'],
    source_code: ['module', 'function', 'export', 'input-output-contract'],
    experiment_protocol: ['hypothesis', 'control-group', 'metric-contract', 'failure-condition'],
    governance_policy: ['authority-policy', 'risk-budget', 'release-gate', 'rollback-obligation'],
    civilization_technology_tree: ['technology-node', 'dependency-graph', 'roadmap-phase', 'capability-domain'],
    product_entry: ['goal-intake', 'plan-card', 'evidence-panel', 'human-confirmation-gate'],
    unknown_knowledge: ['candidate-mechanism', 'falsifiability-lock', 'blind-prediction-lock', 'technical-document'],
    natural_language: ['claim', 'context', 'request', 'output-format'],
  };
  const keywordStructures = tokens
    .filter((t) => /^(rcl|rncs|evidence|artifact|experiment|prototype|governance|akashic|semantic|translator|能力|证据|实验|治理|原型|语义|翻译)$/i.test(t))
    .slice(0, 12)
    .map((t) => `keyword:${t}`);
  return [...(baseByType[sourceType] ?? baseByType.natural_language), ...keywordStructures];
}

function extractConstraints(record, sourceType) {
  const common = ['preserve-evidence-root', 'avoid-unsupported-strong-claim', 'emit-human-readable-output'];
  const byType = {
    experiment_protocol: ['must-have-controls', 'must-have-failure-condition', 'must-bind-metrics'],
    governance_policy: ['human-final-authority', 'risk-budget-required', 'release-gate-required'],
    source_code: ['do-not-change-runtime-semantics-without-test', 'document-input-output'],
    unknown_knowledge: ['must-be-falsifiable', 'must-have-empirical-grounding', 'must-have-blind-test-path'],
    product_entry: ['must-include-plan-preview', 'must-include-rollback-path', 'must-include-user-confirmation'],
  };
  return [...common, ...(byType[sourceType] ?? [])];
}

function extractEvidence(record, sourceType) {
  const evidence = [];
  if (record.evidenceRoot) evidence.push({ kind: 'input-evidence-root', value: record.evidenceRoot });
  if (record.sourceVersion) evidence.push({ kind: 'source-version', value: record.sourceVersion });
  if (record.metrics) evidence.push({ kind: 'metrics', value: record.metrics });
  evidence.push({ kind: 'semantic-hash', value: sha256(compactObject(record)) });
  evidence.push({ kind: 'source-type', value: sourceType });
  return evidence;
}

function makeDefaultSemanticInputs() {
  return [
    {
      id: 'rcl_module_recursive_governance',
      title: 'Recursive Governance Kernel module',
      kind: 'rcl_module',
      language: 'JavaScript/RCL',
      sourceVersion: 'v0.74',
      content: 'Defines authority policy, risk budget, stop conditions, permission matrix, release gate and human final authority for living artifacts.',
    },
    {
      id: 'experiment_protocol_silicate_memory',
      title: 'Silicate Anchored Passive Memory Cell experiment protocol',
      kind: 'experiment_protocol',
      language: 'Experiment IR',
      sourceVersion: 'v0.59-v0.61',
      content: 'Hypothesis, control graph, metric contract, evidence frame and replay notebook for testing silicate anchored memory behavior.',
    },
    {
      id: 'civilization_technology_tree',
      title: 'Civilization technology tree compiler output',
      kind: 'civilization_technology_tree',
      language: 'RCL Technology Tree',
      sourceVersion: 'v0.62',
      content: 'Technology nodes, dependency graph, capability map, roadmap phase and evidence lineage for experimental civilization mechanisms.',
    },
    {
      id: 'rncs_execution_plan',
      title: 'RNCS execution plan and provider contracts',
      kind: 'execution_plan',
      language: 'RNCS Bridge IR',
      sourceVersion: 'v0.63',
      content: 'Execution plan, provider contracts, authorization boundary, WAL replay, crash recovery and evidence writeback.',
    },
    {
      id: 'human_capability_feedback',
      title: 'Human capability feedback profile',
      kind: 'product_entry',
      language: 'Capability Feedback IR',
      sourceVersion: 'v0.64-v0.65',
      content: 'Goal intake, plan card, execution preview, evidence panel, capability feedback and human confirmation gate.',
    },
    {
      id: 'evidence_product_shell',
      title: 'Evidence product shell runtime surface',
      kind: 'product_shell',
      language: 'Product Shell IR',
      sourceVersion: 'v0.67-v0.68',
      content: 'Evidence review card, evidence dossier, demo surface, visual edit surface, delivery handoff and Aether Forge Pocket bridge.',
    },
    {
      id: 'unknown_knowledge_mechanism',
      title: 'Candidate unknown knowledge mechanism',
      kind: 'unknown_knowledge',
      language: 'Candidate Knowledge IR',
      sourceVersion: 'v0.49-v0.56',
      content: 'Candidate mechanisms are filtered through empirical grounding, falsifiability, blind prediction readiness and technical documentation.',
    },
    {
      id: 'natural_user_goal',
      title: 'User asks RCL to explain everything in natural language',
      kind: 'natural_language',
      language: 'Chinese natural language',
      sourceVersion: 'v0.75',
      content: '把任意语言、代码、实验、技术树、治理策略翻译成自然语言说明、技术文档、教学解释和任务书。',
    },
  ];
}

function defaultRecursiveGovernanceSource() {
  return normalizeRecursiveGovernanceKernelSpec({
    id: 'rcl_universal_semantic_translator_source_governance_v0',
    objective: 'Source governance kernel for v0.75 semantic naturalization.',
    governancePolicy: {
      nextHandoff: 'v0.75 Universal Semantic Translator',
      defaultReleaseMode: 'human-readable-output-with-evidence-root',
    },
  });
}

export const DEFAULT_UNIVERSAL_SEMANTIC_TRANSLATOR_SPEC = Object.freeze({
  format: RCL_UNIVERSAL_SEMANTIC_TRANSLATOR_SPEC_FORMAT,
  id: 'rcl_universal_semantic_translator_default_v0',
  version: RCL_UNIVERSAL_SEMANTIC_TRANSLATOR_VERSION,
  objective: 'Translate RCL structures, code, experiments, product shells, governance policies and unknown-knowledge candidates into natural language documents.',
  outputModes: ['executive_summary', 'technical_document', 'teaching_explanation', 'task_brief'],
  thresholds: {
    minSemanticIrCount: 8,
    minNaturalLanguageDocumentCount: 8,
    minAverageTranslatorScore: 0.95,
    requireEvidenceRoots: true,
    requireConstraintExtraction: true,
    requireMultipleOutputModes: true,
    requireHumanReadableOutput: true,
  },
  translatorPolicy: {
    mode: 'structure-first-natural-language-output',
    supportedSourceTypes: ['rcl_structure', 'source_code', 'experiment_protocol', 'governance_policy', 'civilization_technology_tree', 'product_entry', 'unknown_knowledge', 'natural_language'],
    defaultAudience: 'founder-engineer-team-investor',
    naturalLanguageStyle: 'plain-chinese-with-english-term-translation',
    nextHandoff: 'RCL Super App natural-language mouth layer',
  },
  semanticInputs: makeDefaultSemanticInputs(),
  sourceRecursiveGovernanceKernel: defaultRecursiveGovernanceSource(),
});

export function normalizeUniversalSemanticTranslatorSpec(input = {}) {
  const base = JSON.parse(JSON.stringify(DEFAULT_UNIVERSAL_SEMANTIC_TRANSLATOR_SPEC));
  return {
    ...base,
    ...input,
    format: input.format ?? base.format,
    version: input.version ?? RCL_UNIVERSAL_SEMANTIC_TRANSLATOR_VERSION,
    outputModes: input.outputModes ?? base.outputModes,
    thresholds: { ...base.thresholds, ...(input.thresholds ?? {}) },
    translatorPolicy: { ...base.translatorPolicy, ...(input.translatorPolicy ?? {}) },
    semanticInputs: input.semanticInputs ?? base.semanticInputs,
    sourceRecursiveGovernanceKernel: input.sourceRecursiveGovernanceKernel ?? base.sourceRecursiveGovernanceKernel,
  };
}

function sourceGovernanceFromSpec(sourceInput) {
  if (sourceInput?.ok && sourceInput?.result?.recursiveGovernanceKernelEstablished) return sourceInput;
  return runRecursiveGovernanceKernel(sourceInput ?? defaultRecursiveGovernanceSource());
}

export function buildSemanticIr(record, spec = DEFAULT_UNIVERSAL_SEMANTIC_TRANSLATOR_SPEC, index = 0) {
  const sourceType = detectSourceType(record);
  const content = compactObject(record.content ?? record);
  const tokens = tokenize(content);
  const intent = detectIntent(record, sourceType);
  const structures = extractStructures(tokens, sourceType);
  const constraints = extractConstraints(record, sourceType);
  const evidence = extractEvidence(record, sourceType);
  const id = safeId(record.id ?? record.title ?? `${sourceType}-${index}`, `semantic-ir-${index}`);
  const semanticRoot = sha256(JSON.stringify({ id, sourceType, intent, structures, constraints, evidence }));
  return {
    format: RCL_SEMANTIC_IR_FORMAT,
    id,
    title: record.title ?? id,
    sourceType,
    sourceLanguage: record.language ?? 'unknown',
    sourceVersion: record.sourceVersion ?? spec.version,
    intent,
    tokens,
    structures,
    constraints,
    evidence,
    semanticRoot,
  };
}

function titleForMode(mode) {
  const map = {
    executive_summary: 'Executive Summary（执行摘要）',
    technical_document: 'Technical Document（技术文档）',
    teaching_explanation: 'Teaching Explanation（教学解释）',
    task_brief: 'Task Brief（任务书）',
    product_copy: 'Product Copy（产品说明）',
    evidence_report: 'Evidence Report（证据报告）',
  };
  return map[mode] ?? `${mode}（自然语言输出）`;
}

function summarizeIr(ir) {
  return [
    `输入类型：${ir.sourceType}`,
    `来源语言：${ir.sourceLanguage}`,
    `主要意图：${ir.intent}`,
    `核心结构：${ir.structures.slice(0, 8).join(' / ')}`,
    `关键约束：${ir.constraints.slice(0, 8).join(' / ')}`,
    `证据根：${ir.semanticRoot}`,
  ].join('\n');
}

function renderBodyForMode(ir, mode) {
  if (mode === 'executive_summary') {
    return `## 这是什么\n\n这是对 **${ir.title}** 的自然语言压缩说明。它把原始输入从 ${ir.sourceType}（来源类型）转成可阅读的结构摘要。\n\n## 一句话\n\n${ir.title} 的核心作用是：${ir.intent}。\n\n## 关键结构\n\n${ir.structures.map((s) => `- ${s}`).join('\n')}\n\n## 使用边界\n\n${ir.constraints.map((s) => `- ${s}`).join('\n')}\n`;
  }
  if (mode === 'technical_document') {
    return `## 技术定义\n\n**${ir.title}** 被编译为 Semantic IR（语义中间表示）：\`${ir.id}\`。\n\n## 输入/输出契约\n\n- 输入类型：${ir.sourceType}\n- 输入语言：${ir.sourceLanguage}\n- 输出类型：Natural Language Document（自然语言文档）\n- 语义根：\`${ir.semanticRoot}\`\n\n## 结构抽取\n\n${ir.structures.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\n## 约束抽取\n\n${ir.constraints.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\n## 证据绑定\n\n${ir.evidence.map((e) => `- ${e.kind}: \`${typeof e.value === 'string' ? e.value : JSON.stringify(e.value)}\``).join('\n')}\n`;
  }
  if (mode === 'teaching_explanation') {
    return `## 用人话解释\n\n你可以把 **${ir.title}** 理解成一个已经被拆开的结构包。RCL 先识别它要做什么，再识别它由哪些结构组成，最后把限制条件和证据根保留下来。\n\n## 它为什么重要\n\n因为直接看 ${ir.sourceType} 很容易看不懂；但转成自然语言后，团队、投资人、用户、实验人员都能知道：它是什么、能做什么、不能做什么、怎么验证。\n\n## 记忆锚点\n\n- 意图：${ir.intent}\n- 结构数：${ir.structures.length}\n- 约束数：${ir.constraints.length}\n- 证据数：${ir.evidence.length}\n`;
  }
  return `## 任务目标\n\n把 **${ir.title}** 作为输入，输出可执行、可审查、可交付的自然语言说明。\n\n## 执行步骤\n\n1. 读取输入内容。\n2. 抽取 Intent（意图）、Structure（结构）、Constraint（约束）、Evidence（证据）。\n3. 生成自然语言说明。\n4. 保留证据根，方便回放与审计。\n\n## 验收条件\n\n- 输出可读。\n- 约束未丢失。\n- 证据根存在。\n- 不把解释误写成未经验证的强结论。\n`;
}

export function renderNaturalLanguageDocument(ir, mode = 'technical_document', spec = DEFAULT_UNIVERSAL_SEMANTIC_TRANSLATOR_SPEC) {
  const title = `${titleForMode(mode)} - ${ir.title}`;
  const body = renderBodyForMode(ir, mode);
  const documentRoot = sha256(JSON.stringify({ mode, irRoot: ir.semanticRoot, title, body }));
  return {
    format: RCL_NATURAL_LANGUAGE_DOCUMENT_FORMAT,
    id: safeId(`${ir.id}-${mode}`, 'natural-language-document'),
    title,
    mode,
    audience: spec.translatorPolicy.defaultAudience,
    style: spec.translatorPolicy.naturalLanguageStyle,
    sourceSemanticIrId: ir.id,
    sourceSemanticRoot: ir.semanticRoot,
    documentRoot,
    markdown: `# ${title}\n\n${body}\n\n---\n\n## Semantic IR（语义中间表示）摘要\n\n${summarizeIr(ir)}\n`,
  };
}

export function scoreSemanticIr(ir) {
  const parts = [
    ir.intent ? 1 : 0,
    ir.structures?.length >= 3 ? 1 : 0,
    ir.constraints?.length >= 3 ? 1 : 0,
    ir.evidence?.length >= 2 ? 1 : 0,
    ir.semanticRoot ? 1 : 0,
  ];
  return round(average(parts));
}

export function scoreNaturalLanguageDocument(doc) {
  const text = doc.markdown ?? '';
  const parts = [
    doc.documentRoot ? 1 : 0,
    text.includes('##') ? 1 : 0,
    text.includes('证据') || text.includes('Evidence') ? 1 : 0,
    text.includes('约束') || text.includes('Constraint') ? 1 : 0,
    text.length > 500 ? 1 : 0,
  ];
  return round(average(parts));
}

export function buildUniversalSemanticTranslatorCatalog(specInput = {}) {
  const spec = normalizeUniversalSemanticTranslatorSpec(specInput);
  const inputs = asArray(spec.semanticInputs);
  const semanticIrs = inputs.map((record, index) => buildSemanticIr(record, spec, index));
  const documents = semanticIrs.flatMap((ir) => spec.outputModes.map((mode) => renderNaturalLanguageDocument(ir, mode, spec)));
  return { spec, semanticIrs, documents };
}

export function evaluateUniversalSemanticTranslator(specInput = {}) {
  const { spec, semanticIrs, documents } = buildUniversalSemanticTranslatorCatalog(specInput);
  const semanticScores = semanticIrs.map(scoreSemanticIr);
  const documentScores = documents.map(scoreNaturalLanguageDocument);
  const governance = sourceGovernanceFromSpec(spec.sourceRecursiveGovernanceKernel);
  const multipleOutputModesReady = new Set(documents.map((d) => d.mode)).size >= Math.min(2, spec.outputModes.length);
  const result = {
    format: RCL_UNIVERSAL_SEMANTIC_TRANSLATOR_RESULT_FORMAT,
    version: RCL_UNIVERSAL_SEMANTIC_TRANSLATOR_VERSION,
    id: spec.id,
    universalSemanticTranslatorEstablished: semanticIrs.length >= spec.thresholds.minSemanticIrCount &&
      documents.length >= spec.thresholds.minNaturalLanguageDocumentCount &&
      average([...semanticScores, ...documentScores]) >= spec.thresholds.minAverageTranslatorScore &&
      multipleOutputModesReady,
    semanticTranslatorRuntimeEstablished: true,
    semanticIrCount: semanticIrs.length,
    naturalLanguageDocumentCount: documents.length,
    sourceTypeCount: new Set(semanticIrs.map((ir) => ir.sourceType)).size,
    outputModeCount: new Set(documents.map((doc) => doc.mode)).size,
    evidenceRootCount: semanticIrs.filter((ir) => ir.semanticRoot).length,
    constraintExtractionCount: semanticIrs.filter((ir) => ir.constraints?.length).length,
    averageSemanticIrScore: round(average(semanticScores)),
    averageDocumentScore: round(average(documentScores)),
    averageTranslatorScore: round(average([...semanticScores, ...documentScores])),
    recursiveGovernanceInherited: Boolean(governance?.result?.recursiveGovernanceKernelEstablished),
    superAppMouthLayerReady: true,
    nextHandoff: 'RCL Super App Packaging Runtime',
  };
  return {
    ok: result.universalSemanticTranslatorEstablished,
    spec,
    result,
    semanticIrs,
    documents,
    governanceRoot: governance?.result?.canonicalRoot ?? governance?.canonicalRoot ?? sha256('no-governance-root'),
    canonicalRoot: universalSemanticTranslatorCanonicalRoot({ spec, result, semanticIrs, documents }),
  };
}

export function runUniversalSemanticTranslator(specInput = {}) {
  return evaluateUniversalSemanticTranslator(specInput);
}

export function buildUniversalSemanticTranslatorSpec(overrides = {}) {
  return normalizeUniversalSemanticTranslatorSpec(overrides);
}

export function renderUniversalSemanticTranslatorRcl(specInput = {}) {
  const spec = normalizeUniversalSemanticTranslatorSpec(specInput);
  return `reality universal_semantic_translator ${spec.id} {\n  version: "${RCL_UNIVERSAL_SEMANTIC_TRANSLATOR_VERSION}"\n  objective: "${spec.objective}"\n  output_modes: [${spec.outputModes.map((m) => `"${m}"`).join(', ')}]\n  source_types: [${spec.translatorPolicy.supportedSourceTypes.map((m) => `"${m}"`).join(', ')}]\n  policy: "${spec.translatorPolicy.mode}"\n  next_handoff: "${spec.translatorPolicy.nextHandoff}"\n}\n`;
}

export function runUniversalSemanticTranslatorDemo() {
  return runUniversalSemanticTranslator(DEFAULT_UNIVERSAL_SEMANTIC_TRANSLATOR_SPEC);
}

export function readUniversalSemanticTranslatorInput(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(text);
}

export function writeUniversalSemanticTranslatorReports(outputDir, specInput = {}) {
  const dir = path.resolve(outputDir);
  fs.mkdirSync(dir, { recursive: true });
  const bundle = runUniversalSemanticTranslator(specInput);
  const docsDir = path.join(dir, 'natural-language-docs');
  fs.mkdirSync(docsDir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'universal-semantic-translator-result.json'), `${JSON.stringify(bundle.result, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'semantic-ir.json'), `${JSON.stringify(bundle.semanticIrs, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'natural-language-documents.json'), `${JSON.stringify(bundle.documents, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'universal-semantic-translator.rcl'), renderUniversalSemanticTranslatorRcl(bundle.spec));
  for (const doc of bundle.documents) {
    fs.writeFileSync(path.join(docsDir, `${safeId(doc.id)}.md`), doc.markdown);
  }
  fs.writeFileSync(path.join(dir, 'SUMMARY.md'), renderUniversalSemanticTranslatorSummary(bundle));
  fs.writeFileSync(path.join(dir, 'canonical-root.txt'), `${bundle.canonicalRoot}\n`);
  return {
    ...bundle,
    outputDir: dir,
    writtenFiles: {
      result: path.join(dir, 'universal-semantic-translator-result.json'),
      semanticIr: path.join(dir, 'semantic-ir.json'),
      documents: docsDir,
      summary: path.join(dir, 'SUMMARY.md'),
      rcl: path.join(dir, 'universal-semantic-translator.rcl'),
      canonicalRoot: path.join(dir, 'canonical-root.txt'),
    },
  };
}

export function renderUniversalSemanticTranslatorSummary(bundle) {
  const r = bundle.result;
  return `# RCL Universal Semantic Translator（通用语义翻译器）v0.75\n\n## Result（结果）\n\n- universalSemanticTranslatorEstablished: ${r.universalSemanticTranslatorEstablished}\n- semanticIrCount: ${r.semanticIrCount}\n- naturalLanguageDocumentCount: ${r.naturalLanguageDocumentCount}\n- sourceTypeCount: ${r.sourceTypeCount}\n- outputModeCount: ${r.outputModeCount}\n- averageTranslatorScore: ${r.averageTranslatorScore}\n- superAppMouthLayerReady: ${r.superAppMouthLayerReady}\n\n## Meaning（意义）\n\nv0.75 把 RCL 内部结构、代码、实验、治理、产品壳、未知知识候选统一翻译成 Natural Language Output（自然语言输出），让 RCL Super App 具备“能说人话”的产品嘴巴。\n\n## Canonical Root（规范根）\n\n\`${bundle.canonicalRoot}\`\n`;
}

export function universalSemanticTranslatorCanonicalRoot(bundle) {
  return sha256(JSON.stringify({
    format: RCL_UNIVERSAL_SEMANTIC_TRANSLATOR_BUNDLE_FORMAT,
    version: RCL_UNIVERSAL_SEMANTIC_TRANSLATOR_VERSION,
    specId: bundle.spec?.id,
    result: bundle.result,
    semanticRoots: bundle.semanticIrs?.map((ir) => ir.semanticRoot),
    documentRoots: bundle.documents?.map((doc) => doc.documentRoot),
  }));
}
