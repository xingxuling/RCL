import fs from 'node:fs';
import path from 'node:path';
import { sha256, clamp } from './reality-compiler-kernel.mjs';
import {
  scanRclSelfAkashicRepository,
  evaluateSelfAkashicRecord,
  normalizeSelfAkashicRecordSpec,
} from './self-akashic-record-compiler.mjs';

export const RCL_FUTURE_AKASHIC_VERSION = '0.58.0-alpha.1';
export const RCL_FUTURE_AKASHIC_SPEC_FORMAT = 'rcl.future-rcl-akashic-spec.v0.58';
export const RCL_FUTURE_AKASHIC_RESULT_FORMAT = 'rcl.future-rcl-akashic-result.v0.58';
export const RCL_FUTURE_AKASHIC_BUNDLE_FORMAT = 'rcl.future-rcl-akashic-bundle.v0.58';
export const RCL_FUTURE_AKASHIC_TECH_DOC_FORMAT = 'rcl.future-rcl-akashic-technical-document.v0.58';

function round(value, digits = 9) {
  const scale = 10 ** digits;
  return Math.round(Number(value) * scale) / scale;
}

function safeFileName(value) {
  return String(value ?? 'future-rcl-akashic')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || 'future-rcl-akashic';
}

function average(values) {
  const xs = values.map(Number).filter(Number.isFinite);
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

function extractMinor(version = '0.0.0') {
  const m = String(version).match(/^(\d+)\.(\d+)\.(\d+)/);
  return m ? Number(m[2]) : 0;
}

function boundedScore(value, target) {
  if (!target) return 0;
  return round(clamp(Number(value) / Number(target)));
}

function versionName(minor, title) {
  return `v0.${minor}.0-alpha.1 ${title}`;
}

export const DEFAULT_FUTURE_RCL_AKASHIC_SPEC = Object.freeze({
  format: RCL_FUTURE_AKASHIC_SPEC_FORMAT,
  id: 'rcl_future_rcl_akashic_default_v0',
  version: RCL_FUTURE_AKASHIC_VERSION,
  objective: 'Compile the future of RCL from its bounded self-Akashic record: current version ledger, module graph, CLI surface, tests, reports, and generated documents are projected into a future technical roadmap with gates and own future documents.',
  repositoryRoot: '.',
  selfRecord: {
    includeDirs: ['src', 'docs', 'tests', 'examples'],
    excludeDirs: ['node_modules', 'output', 'build', 'native', '.git'],
    maxFiles: 1100,
  },
  horizon: {
    releases: 8,
    startMinor: null,
    minFutureModules: 8,
    minFutureDocuments: 6,
  },
  thresholds: {
    minFutureClosureScore: 0.90,
    minRoadmapCoherenceScore: 0.90,
    minSelfContinuityScore: 0.90,
    minVerificationReadinessScore: 0.90,
    requireGeneratedFutureDocs: true,
    requireNoUnboundedOracle: true,
  },
  futureDirections: [
    'prediction_to_experiment_closure',
    'candidate_knowledge_to_lab_protocol',
    'world_model_to_execution_bridge',
    'human_capability_feedback',
    'civilization_technology_tree',
    'self_verifying_release_ledger',
    'multi_agent_reality_governance',
    'mobile_reality_product_entry',
  ],
  documentTargets: [
    'future-rcl-technical-record',
    'future-version-roadmap',
    'future-module-graph',
    'future-validation-gates',
    'future-risk-ledger',
    'future-product-trajectory',
  ],
});

export function normalizeFutureRclAkashicSpec(input = {}) {
  const base = JSON.parse(JSON.stringify(DEFAULT_FUTURE_RCL_AKASHIC_SPEC));
  return {
    ...base,
    ...input,
    selfRecord: { ...base.selfRecord, ...(input.selfRecord ?? {}) },
    horizon: { ...base.horizon, ...(input.horizon ?? {}) },
    thresholds: { ...base.thresholds, ...(input.thresholds ?? {}) },
    futureDirections: Array.isArray(input.futureDirections) ? input.futureDirections : base.futureDirections,
    documentTargets: Array.isArray(input.documentTargets) ? input.documentTargets : base.documentTargets,
  };
}

function buildFutureModules(minorStart) {
  const rows = [
    {
      minor: minorStart,
      id: 'experiment_design_synthesizer',
      name: 'Experiment Design Synthesizer',
      translation: '实验设计合成器',
      purpose: 'Turn candidate mechanisms into controlled experiments, instrumentation plans and failure conditions.',
      gates: ['control groups', 'measurable outputs', 'negative controls'],
    },
    {
      minor: minorStart + 1,
      id: 'mechanism_to_prototype_generator',
      name: 'Mechanism-to-Prototype Generator',
      translation: '机制到原型生成器',
      purpose: 'Transform promoted candidate knowledge into minimal material, software or cognitive prototypes.',
      gates: ['build plan', 'test plan', 'rollback plan'],
    },
    {
      minor: minorStart + 2,
      id: 'empirical_lab_notebook_runtime',
      name: 'Empirical Lab Notebook Runtime',
      translation: '实证实验日志运行时',
      purpose: 'Record experiments, evidence, sensor outputs, failures and reproducibility metadata.',
      gates: ['timestamped evidence', 'raw data attachment', 'replayable report'],
    },
    {
      minor: minorStart + 3,
      id: 'civilization_tech_tree_compiler',
      name: 'Civilization Technology Tree Compiler',
      translation: '文明技术树编译器',
      purpose: 'Compile validated mechanisms into staged civilization-scale technology trees.',
      gates: ['mechanism dependency graph', 'energy/material/social constraints', 'deployment tiers'],
    },
    {
      minor: minorStart + 4,
      id: 'rncs_execution_bridge_v2',
      name: 'RNCS Execution Bridge v2',
      translation: 'RNCS 执行桥 v2',
      purpose: 'Connect compiled goals to providers, permissions, WAL, crash replay and evidence writeback.',
      gates: ['provider contracts', 'authority checks', 'evidence writeback'],
    },
    {
      minor: minorStart + 5,
      id: 'human_capability_feedback_os',
      name: 'Human Capability Feedback OS',
      translation: '人类能力反馈操作系统',
      purpose: 'Compile actions and evidence into personal capability growth paths and product upgrades.',
      gates: ['capability graph', 'feedback loop', 'privacy boundary'],
    },
    {
      minor: minorStart + 6,
      id: 'reality_product_entry_runtime',
      name: 'Reality Product Entry Runtime',
      translation: '现实产品入口运行时',
      purpose: 'Wrap RCL/RNCS into ordinary user product loops: goal, plan, action, evidence, rollback and next loop.',
      gates: ['product loop UI', 'mobile entry', 'bounded authority'],
    },
    {
      minor: minorStart + 7,
      id: 'recursive_future_release_planner',
      name: 'Recursive Future Release Planner',
      translation: '递归未来版本规划器',
      purpose: 'Use future release evidence to update the future-Akashic roadmap without unbounded prophecy or self-confirming loops.',
      gates: ['future evidence replay', 'version horizon cap', 'self-correction rule'],
    },
  ];
  return rows.map(row => ({
    ...row,
    version: versionName(row.minor, row.name),
    status: 'future_candidate',
    source: 'derived_from_self_akashic_record',
    falsifiers: [
      `Cannot be implemented without breaking existing v0.${minorStart - 1} interfaces.`,
      `Fails to generate evidence, tests, CLI and technical documents.`,
      `Increases explanation freedom without increasing operational constraints.`,
    ],
  }));
}

function buildFutureRoadmap(scan, spec) {
  const currentMinor = extractMinor(scan.package.version);
  const startMinor = Number(spec.horizon.startMinor ?? currentMinor + 1);
  const modules = buildFutureModules(startMinor).slice(0, Number(spec.horizon.releases ?? 8));
  return modules.map((module, index) => ({
    order: index + 1,
    version: module.version,
    moduleId: module.id,
    moduleName: module.name,
    translation: module.translation,
    purpose: module.purpose,
    gates: module.gates,
    expectedOutputs: [
      `src/${module.id.replaceAll('_', '-')}.mjs`,
      `tests/${module.id.replaceAll('_', '-')}.test.mjs`,
      `docs/开发验收报告_${module.name.replaceAll(' ', '_')}_v0.${module.minor}.md`,
      `examples/${module.id.replaceAll('_', '-')}/default.json`,
      `output/v0.${module.minor}/${module.id.replaceAll('_', '-')}/technical-docs/`,
    ],
    falsifiers: module.falsifiers,
  }));
}

function evaluateFutureScores(scan, selfEvaluation, roadmap, spec) {
  const counts = scan.counts;
  const currentStrength = average([
    boundedScore(counts.moduleCount, 64),
    boundedScore(counts.commandCount, 110),
    boundedScore(counts.testCount, 42),
    boundedScore(counts.docCount, 100),
    boundedScore(counts.versionLedgerCount, 50),
  ]);
  const selfContinuityScore = round(average([
    selfEvaluation.scores?.selfClosureScore ?? 0,
    selfEvaluation.replayStable ? 1 : 0,
    currentStrength,
  ]));
  const roadmapCoherenceScore = round(average([
    boundedScore(roadmap.length, spec.horizon.minFutureModules),
    roadmap.every(r => r.gates.length >= 3) ? 1 : 0,
    roadmap.every(r => r.falsifiers.length >= 3) ? 1 : 0,
    roadmap.some(r => /experiment|prototype|lab/i.test(r.moduleId)) ? 1 : 0,
    roadmap.some(r => /rncs|execution|runtime/i.test(r.moduleId)) ? 1 : 0,
  ]));
  const verificationReadinessScore = round(average([
    roadmap.every(r => r.expectedOutputs.length >= 5) ? 1 : 0,
    roadmap.every(r => r.gates.length >= 3) ? 1 : 0,
    roadmap.every(r => r.falsifiers.length >= 3) ? 1 : 0,
    spec.thresholds.requireNoUnboundedOracle ? 1 : 0,
  ]));
  const futureDocumentReadinessScore = round(boundedScore(spec.documentTargets.length, spec.horizon.minFutureDocuments));
  const boundednessScore = round(average([
    spec.thresholds.requireNoUnboundedOracle ? 1 : 0,
    roadmap.every(r => r.falsifiers.length > 0) ? 1 : 0,
    roadmap.every(r => r.status !== 'truth_claim') ? 1 : 0,
  ]));
  const futureClosureScore = round(average([
    selfContinuityScore,
    roadmapCoherenceScore,
    verificationReadinessScore,
    futureDocumentReadinessScore,
    boundednessScore,
  ]));
  return {
    currentStrengthScore: round(currentStrength),
    selfContinuityScore,
    roadmapCoherenceScore,
    verificationReadinessScore,
    futureDocumentReadinessScore,
    boundednessScore,
    futureClosureScore,
  };
}

export function evaluateFutureRclAkashic(specInput = {}) {
  const spec = normalizeFutureRclAkashicSpec(specInput);
  const selfSpec = normalizeSelfAkashicRecordSpec({
    repositoryRoot: spec.repositoryRoot,
    scan: spec.selfRecord,
  });
  const scan = scanRclSelfAkashicRepository(selfSpec);
  const selfEvaluation = evaluateSelfAkashicRecord(selfSpec);
  const roadmap = buildFutureRoadmap(scan, spec);
  const scores = evaluateFutureScores(scan, selfEvaluation, roadmap, spec);
  const futureAkashicEstablished = scores.futureClosureScore >= spec.thresholds.minFutureClosureScore
    && scores.roadmapCoherenceScore >= spec.thresholds.minRoadmapCoherenceScore
    && scores.selfContinuityScore >= spec.thresholds.minSelfContinuityScore
    && scores.verificationReadinessScore >= spec.thresholds.minVerificationReadinessScore;
  return {
    spec,
    scan,
    selfEvaluation,
    roadmap,
    scores,
    futureAkashicEstablished,
    futureRclCompiled: futureAkashicEstablished,
    futureDocumentTargets: spec.documentTargets,
    root: sha256({ scanRoot: scan.scanRoot, roadmap, scores, futureAkashicEstablished }),
  };
}

export function renderFutureRclTechnicalDocument(kind = 'future-rcl-technical-record', evaluationInput = {}, specInput = {}) {
  const evaluation = evaluationInput.roadmap ? evaluationInput : evaluateFutureRclAkashic(specInput);
  const { scan, roadmap, scores, futureAkashicEstablished } = evaluation;
  const titleMap = {
    'future-rcl-technical-record': 'Future RCL Technical Record（未来 RCL 技术记录）',
    'future-version-roadmap': 'Future Version Roadmap（未来版本路线图）',
    'future-module-graph': 'Future Module Graph（未来模块图谱）',
    'future-validation-gates': 'Future Validation Gates（未来验收闸门）',
    'future-risk-ledger': 'Future Risk Ledger（未来风险账本）',
    'future-product-trajectory': 'Future Product Trajectory（未来产品轨迹）',
  };
  const title = titleMap[kind] ?? `Future RCL Document（未来 RCL 文档）: ${kind}`;
  const roadmapRows = roadmap.map(r => `| ${r.order} | ${r.version} | ${r.translation} | ${r.gates.join('; ')} |`).join('\n');
  const moduleRows = roadmap.map(r => `- **${r.moduleName}（${r.translation}）**: ${r.purpose}`).join('\n');
  const gateRows = roadmap.flatMap(r => r.gates.map(g => `- ${r.version}: ${g}`)).join('\n');
  const riskRows = roadmap.flatMap(r => r.falsifiers.map(f => `- ${r.version}: ${f}`)).join('\n');
  const bodyByKind = {
    'future-rcl-technical-record': [
      '## Summary（摘要）',
      `RCL Future-Akashic result: **${futureAkashicEstablished ? 'established（成立）' : 'not established（未成立）'}**.`,
      `Current base version（当前基线版本）: ${scan.package.version}.`,
      `Future closure score（未来闭合分）: ${scores.futureClosureScore}.`,
      '',
      '## Future Roadmap（未来路线）',
      '| # | Version（版本） | Translation（中文） | Gates（闸门） |',
      '|---:|---|---|---|',
      roadmapRows,
    ],
    'future-version-roadmap': [
      '## Future Version Roadmap（未来版本路线图）',
      roadmapRows,
    ],
    'future-module-graph': [
      '## Future Module Graph（未来模块图谱）',
      moduleRows,
    ],
    'future-validation-gates': [
      '## Future Validation Gates（未来验收闸门）',
      gateRows,
    ],
    'future-risk-ledger': [
      '## Future Risk Ledger（未来风险账本）',
      riskRows,
    ],
    'future-product-trajectory': [
      '## Future Product Trajectory（未来产品轨迹）',
      'RCL future trajectory（未来轨迹）: unknown knowledge → experiment design → prototype generation → empirical notebook → civilization technology tree → RNCS execution → human capability feedback → product entry runtime.',
      '',
      moduleRows,
    ],
  };
  const lines = bodyByKind[kind] ?? bodyByKind['future-rcl-technical-record'];
  const markdown = [
    `# ${title}`,
    '',
    `**Format（格式）**: ${RCL_FUTURE_AKASHIC_TECH_DOC_FORMAT}`,
    `**Source（来源）**: RCL self-Akashic record + bounded future projection（RCL 自阿卡西记录 + 有界未来投影）`,
    `**Established（成立）**: ${futureAkashicEstablished}`,
    `**Root（根哈希）**: ${sha256({ kind, scores, roadmap })}`,
    '',
    ...lines,
  ].join('\n');
  return { format: RCL_FUTURE_AKASHIC_TECH_DOC_FORMAT, id: kind, title, markdown, root: sha256(markdown) };
}

export function runFutureRclAkashicCompiler(input = {}) {
  const spec = normalizeFutureRclAkashicSpec(input);
  const evaluation = evaluateFutureRclAkashic(spec);
  const documents = spec.documentTargets.map(kind => renderFutureRclTechnicalDocument(kind, evaluation, spec));
  const result = {
    format: RCL_FUTURE_AKASHIC_RESULT_FORMAT,
    version: RCL_FUTURE_AKASHIC_VERSION,
    ok: evaluation.futureAkashicEstablished,
    futureAkashicEstablished: evaluation.futureAkashicEstablished,
    futureRclCompiled: evaluation.futureRclCompiled,
    generatedFutureTechnicalDocuments: documents.length >= spec.horizon.minFutureDocuments,
    baseVersion: evaluation.scan.package.version,
    counts: evaluation.scan.counts,
    scores: evaluation.scores,
    roadmapCount: evaluation.roadmap.length,
    roadmap: evaluation.roadmap,
    documentCount: documents.length,
    documentIds: documents.map(d => d.id),
    verdict: evaluation.futureAkashicEstablished
      ? '成立：RCL 能用自身有限阿卡西记录编译出有界未来版本路线、模块候选、验收闸门、风险账本和未来技术文档。'
      : '未成立：未来路线未能同时满足自连续、路线闭合、验收准备和文档生成。',
    root: null,
  };
  result.root = sha256({ spec, result: { ...result, root: undefined }, documents: documents.map(d => d.root) });
  return { spec, result, scan: evaluation.scan, roadmap: evaluation.roadmap, documents };
}

export function buildFutureRclAkashicSpec(input = {}) {
  const bundle = runFutureRclAkashicCompiler(input);
  return {
    ...bundle.spec,
    compilerPasses: [
      'self-Akashic repository scan',
      'future module candidate derivation',
      'future roadmap generation',
      'validation gate synthesis',
      'risk ledger synthesis',
      'future technical document generation',
    ],
    validation: {
      futureAkashicEstablished: bundle.result.futureAkashicEstablished,
      futureRclCompiled: bundle.result.futureRclCompiled,
      generatedFutureTechnicalDocuments: bundle.result.generatedFutureTechnicalDocuments,
      futureClosureScore: bundle.result.scores.futureClosureScore,
      root: bundle.result.root,
    },
  };
}

export function renderFutureRclAkashicRcl(input = {}) {
  const spec = buildFutureRclAkashicSpec(input);
  const v = spec.validation;
  return [
    'reality FutureRclAkashicCompiler {',
    `  version : Text = "${RCL_FUTURE_AKASHIC_VERSION}"`,
    `  format : Text = "${RCL_FUTURE_AKASHIC_SPEC_FORMAT}"`,
    '  input : Repository = "RCL Self-Akashic Record（RCL 自阿卡西记录）"',
    '  projection : List = [',
    '    "Future Version Roadmap（未来版本路线）",',
    '    "Future Module Graph（未来模块图谱）",',
    '    "Validation Gates（验收闸门）",',
    '    "Risk Ledger（风险账本）",',
    '    "Future Technical Documents（未来技术文档）"',
    '  ]',
    `  validation.established : Truth = ${v.futureAkashicEstablished ? 'true' : 'false'}`,
    `  validation.future_rcl_compiled : Truth = ${v.futureRclCompiled ? 'true' : 'false'}`,
    `  validation.generated_docs : Truth = ${v.generatedFutureTechnicalDocuments ? 'true' : 'false'}`,
    `  validation.future_closure_score : Number = ${v.futureClosureScore}`,
    `  root : Hash = "${v.root}"`,
    '}',
  ].join('\n');
}

export function runFutureRclAkashicDemo() {
  const bundle = runFutureRclAkashicCompiler();
  return {
    ok: bundle.result.ok,
    format: RCL_FUTURE_AKASHIC_BUNDLE_FORMAT,
    version: RCL_FUTURE_AKASHIC_VERSION,
    futureAkashicEstablished: bundle.result.futureAkashicEstablished,
    futureRclCompiled: bundle.result.futureRclCompiled,
    generatedFutureTechnicalDocuments: bundle.result.generatedFutureTechnicalDocuments,
    futureClosureScore: bundle.result.scores.futureClosureScore,
    baseVersion: bundle.result.baseVersion,
    roadmapCount: bundle.result.roadmapCount,
    nextRoadmapItems: bundle.result.roadmap.slice(0, 3).map(r => ({ version: r.version, moduleId: r.moduleId, translation: r.translation })),
    documentIds: bundle.result.documentIds,
    root: bundle.result.root,
  };
}

export function readFutureRclAkashicInput(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return raw.trim() ? JSON.parse(raw) : {};
}

export function writeFutureRclAkashicReports(outDir = 'output/v0.58/future-rcl-akashic', input = {}) {
  const bundle = runFutureRclAkashicCompiler(input);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'future-rcl-akashic-spec.json'), `${JSON.stringify(bundle.spec, null, 2)}\n`);
  fs.writeFileSync(path.join(outDir, 'future-rcl-akashic-result.json'), `${JSON.stringify(bundle.result, null, 2)}\n`);
  fs.writeFileSync(path.join(outDir, 'future-rcl-akashic-roadmap.json'), `${JSON.stringify(bundle.roadmap, null, 2)}\n`);
  fs.writeFileSync(path.join(outDir, 'future-rcl-akashic.rcl'), `${renderFutureRclAkashicRcl(bundle.spec)}\n`);
  const docsDir = path.join(outDir, 'technical-docs');
  fs.mkdirSync(docsDir, { recursive: true });
  for (const doc of bundle.documents) {
    fs.writeFileSync(path.join(docsDir, `${safeFileName(doc.id)}.md`), `${doc.markdown}\n`);
  }
  return {
    ok: true,
    format: RCL_FUTURE_AKASHIC_BUNDLE_FORMAT,
    version: RCL_FUTURE_AKASHIC_VERSION,
    outputDir: outDir,
    resultPath: path.join(outDir, 'future-rcl-akashic-result.json'),
    roadmapPath: path.join(outDir, 'future-rcl-akashic-roadmap.json'),
    docsDir,
    documentCount: bundle.documents.length,
    futureAkashicEstablished: bundle.result.futureAkashicEstablished,
    futureRclCompiled: bundle.result.futureRclCompiled,
    futureClosureScore: bundle.result.scores.futureClosureScore,
    root: bundle.result.root,
  };
}

export function futureRclAkashicCanonicalRoot(input = {}) {
  return runFutureRclAkashicCompiler(input).result.root;
}
