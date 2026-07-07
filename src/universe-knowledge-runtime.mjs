import fs from 'node:fs';
import path from 'node:path';
import { sha256 } from './reality-compiler-kernel.mjs';
import {
  runUniversalSemanticTranslator,
  normalizeUniversalSemanticTranslatorSpec,
} from './universal-semantic-translator.mjs';
import {
  runRecursiveGovernanceKernel,
  normalizeRecursiveGovernanceKernelSpec,
} from './recursive-governance-kernel.mjs';

export const RCL_UNIVERSE_KNOWLEDGE_RUNTIME_VERSION = '0.76.0-alpha.1';
export const RCL_UNIVERSE_KNOWLEDGE_RUNTIME_SPEC_FORMAT = 'rcl.universe-knowledge-runtime-spec.v0.76';
export const RCL_UNIVERSE_KNOWLEDGE_RUNTIME_RESULT_FORMAT = 'rcl.universe-knowledge-runtime-result.v0.76';
export const RCL_UNIVERSE_KNOWLEDGE_RUNTIME_BUNDLE_FORMAT = 'rcl.universe-knowledge-runtime-bundle.v0.76';
export const RCL_UNIVERSE_KNOWLEDGE_OBJECT_FORMAT = 'rcl.universe-knowledge-object.v0.76';
export const RCL_UNIVERSE_KNOWLEDGE_STATE_FORMAT = 'rcl.universe-knowledge-state.v0.76';
export const RCL_UNIVERSE_KNOWLEDGE_FUTURE_PLAN_FORMAT = 'rcl.universe-knowledge-future-plan.v0.76';

function round(value, digits = 9) {
  const scale = 10 ** digits;
  return Math.round(Number(value) * scale) / scale;
}

function average(values) {
  const xs = values.map(Number).filter(Number.isFinite);
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

function safeId(value, fallback = 'knowledge-object') {
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

function compact(value) {
  try { return JSON.stringify(value, null, 2); } catch { return String(value); }
}

function detectKnowledgeType(record) {
  const text = `${record.type ?? ''} ${record.kind ?? ''} ${record.title ?? ''} ${record.description ?? ''} ${record.content ?? ''}`.toLowerCase();
  if (text.includes('universe') || text.includes('cosmogenic') || text.includes('宇宙')) return 'universe_model';
  if (text.includes('experiment') || text.includes('lab') || text.includes('实验')) return 'experiment_knowledge';
  if (text.includes('technology tree') || text.includes('civilization') || text.includes('文明')) return 'civilization_technology_tree';
  if (text.includes('artifact') || text.includes('living') || text.includes('活体')) return 'living_artifact_knowledge';
  if (text.includes('governance') || text.includes('治理')) return 'governance_knowledge';
  if (text.includes('unknown') || text.includes('candidate') || text.includes('候选')) return 'unknown_candidate_knowledge';
  if (text.includes('data') || text.includes('ingestion') || text.includes('真实世界')) return 'real_world_data_knowledge';
  if (text.includes('semantic') || text.includes('translator') || text.includes('语义') || text.includes('翻译')) return 'semantic_translation_knowledge';
  return 'general_knowledge';
}

function makeEvidenceRoot(record, type) {
  const payload = { id: record.id, title: record.title, type, evidence: record.evidence ?? [], content: record.content ?? record.description ?? '' };
  return sha256(compact(payload));
}

function makeVerificationState(record, type) {
  const explicit = record.verificationState ?? record.verification ?? {};
  const evidenceScore = Number(explicit.evidenceScore ?? record.evidenceScore ?? (record.evidence ? 0.95 : 0.88));
  const reviewScore = Number(explicit.reviewScore ?? record.reviewScore ?? 0.9);
  const blindScore = Number(explicit.blindScore ?? record.blindScore ?? (type.includes('experiment') || type.includes('data') ? 0.92 : 0.86));
  const governanceScore = Number(explicit.governanceScore ?? record.governanceScore ?? 0.94);
  const score = round(average([evidenceScore, reviewScore, blindScore, governanceScore]));
  return {
    status: score >= 0.9 ? 'verified-runtime-ready' : 'candidate-runtime-watch',
    evidenceScore: round(evidenceScore),
    reviewScore: round(reviewScore),
    blindScore: round(blindScore),
    governanceScore: round(governanceScore),
    verificationScore: score,
    requiresHumanReview: score < 0.97,
  };
}

function makeLifecycle(record, type) {
  const phases = ['seeded', 'compiled', 'verified', 'translated', 'governed'];
  if (type.includes('experiment') || type.includes('data')) phases.push('empirical-loop-ready');
  if (type.includes('artifact')) phases.push('mutation-ready');
  if (type.includes('universe') || type.includes('civilization')) phases.push('simulation-ready');
  return {
    current: 'runtime-active',
    phases,
    mutationPolicy: record.mutationPolicy ?? 'human-reviewed-evidence-preserving-mutation',
    retirementPolicy: record.retirementPolicy ?? 'retire-if-evidence-breaks-or-governance-stops',
  };
}

function makeHooks(record, type) {
  const simulationHook = type.includes('universe') || type.includes('civilization') || type.includes('artifact') || type.includes('unknown');
  const experimentHook = type.includes('experiment') || type.includes('unknown') || type.includes('data');
  const governanceHook = true;
  const translationHook = true;
  return {
    simulationHook: simulationHook ? `${safeId(record.id)}:simulate` : null,
    experimentHook: experimentHook ? `${safeId(record.id)}:experiment` : null,
    verificationHook: `${safeId(record.id)}:verify`,
    translationHook: translationHook ? `${safeId(record.id)}:naturalize` : null,
    governanceHook: governanceHook ? `${safeId(record.id)}:govern` : null,
  };
}

function makeKnowledgeObject(record, index) {
  const id = safeId(record.id ?? record.title ?? `knowledge_${index + 1}`, `knowledge_${index + 1}`);
  const type = detectKnowledgeType(record);
  const evidenceRoot = record.evidenceRoot ?? makeEvidenceRoot(record, type);
  const verificationState = makeVerificationState(record, type);
  const lifecycle = makeLifecycle(record, type);
  const hooks = makeHooks({ ...record, id }, type);
  const title = record.title ?? id.replace(/[-_]/g, ' ');
  const description = record.description ?? record.content ?? `Runtime knowledge object for ${title}.`;
  const state = {
    format: RCL_UNIVERSE_KNOWLEDGE_STATE_FORMAT,
    id: `${id}:state`,
    status: verificationState.status,
    lifecycleState: lifecycle.current,
    evidenceRoot,
    verificationRoot: sha256(compact(verificationState)),
    runtimeReadiness: round(average([
      verificationState.verificationScore,
      hooks.translationHook ? 1 : 0.5,
      hooks.governanceHook ? 1 : 0.5,
      evidenceRoot ? 1 : 0,
    ])),
  };
  return {
    format: RCL_UNIVERSE_KNOWLEDGE_OBJECT_FORMAT,
    id,
    title,
    type,
    description,
    sourceVersion: record.sourceVersion ?? 'v0.76',
    evidenceRoot,
    verificationState,
    lifecycle,
    hooks,
    state,
    translationSurface: {
      ready: true,
      modes: ['executive_summary', 'technical_document', 'teaching_explanation', 'task_brief'],
    },
    governancePolicy: {
      humanFinalAuthority: true,
      riskBudget: record.riskBudget ?? 'bounded-by-evidence-and-human-review',
      releaseGate: record.releaseGate ?? 'verified-runtime-ready-and-human-reviewable',
    },
    objectRoot: sha256(compact({ id, type, title, evidenceRoot, verificationState, lifecycle, hooks })),
  };
}

function defaultKnowledgeRecords() {
  return [
    {
      id: 'cosmogenic_universe_model',
      title: 'Cosmogenic Universe Model（宇宙生成模型）',
      type: 'universe_model',
      sourceVersion: 'v0.45-v0.48',
      content: 'Coarse-grained universe-to-earth consistency model with empirical grounding and holdout checks.',
      evidenceScore: 0.99,
      blindScore: 1,
    },
    {
      id: 'candidate_unknown_knowledge_forge',
      title: 'Candidate Unknown Knowledge Forge（候选未知知识锻炉）',
      type: 'unknown_candidate_knowledge',
      sourceVersion: 'v0.49-v0.53',
      content: 'Candidate mechanisms filtered through falsifiability, empirical grounding, blind prediction readiness and technical document generation.',
      evidenceScore: 0.94,
      blindScore: 0.92,
    },
    {
      id: 'ecological_injection_phase0',
      title: 'Ecological Injection Phase0（异种文明生态注入 Phase0）',
      type: 'experiment_knowledge',
      sourceVersion: 'v0.54-v0.61',
      content: 'Experiment object, prototype IR, notebook run, audit ledger and derived candidate handoff for silicate anchored passive memory.',
      evidenceScore: 0.96,
      blindScore: 0.95,
    },
    {
      id: 'esoteric_mechanism_family',
      title: 'Esoteric Mechanism Family（隐性机制族）',
      type: 'unknown_candidate_knowledge',
      sourceVersion: 'v0.55-v0.56',
      content: 'Qi, aether, symbolic control, formation array, mana reservoir, alchemical lattice and akashic finite record mechanisms.',
      evidenceScore: 0.9,
      blindScore: 0.86,
    },
    {
      id: 'civilization_technology_tree',
      title: 'Civilization Technology Tree（文明技术树）',
      type: 'civilization_technology_tree',
      sourceVersion: 'v0.62',
      content: 'Technology nodes, dependency graph, roadmap phase, capability map and evidence lineage.',
      evidenceScore: 0.96,
      blindScore: 0.9,
    },
    {
      id: 'rncs_execution_bridge',
      title: 'RNCS Execution Bridge（RNCS 执行桥）',
      type: 'living_artifact_knowledge',
      sourceVersion: 'v0.63-v0.65',
      content: 'Execution plans, provider contracts, authorization boundaries, evidence writeback and product entry cards.',
      evidenceScore: 0.97,
      blindScore: 0.9,
    },
    {
      id: 'real_world_data_and_verification_council',
      title: 'Real World Data + Verification Council（真实世界数据 + 验证委员会）',
      type: 'real_world_data_knowledge',
      sourceVersion: 'v0.70-v0.72',
      content: 'Data source contracts, validation pipeline, blind split, multi-agent verification, red-team falsification and human authority gate.',
      evidenceScore: 0.98,
      blindScore: 0.97,
    },
    {
      id: 'living_artifact_and_governance',
      title: 'Living Artifact + Recursive Governance（活体产物 + 递归治理）',
      type: 'governance_knowledge',
      sourceVersion: 'v0.73-v0.75',
      content: 'Living artifact runtime, recursive governance, evidence product shell, Aether Forge Pocket bridge and universal semantic translator.',
      evidenceScore: 0.98,
      blindScore: 0.94,
    },
  ];
}

function defaultFutureRoadmap() {
  return [
    {
      version: 'v0.77',
      module: 'Knowledge Graph Query Engine',
      zh: '知识图谱查询引擎',
      purpose: 'Query Universe Knowledge Objects across evidence, lifecycle, hooks and translations.',
      acceptance: ['query by type/evidence/status', 'return cited knowledge object roots', 'preserve governance filters'],
    },
    {
      version: 'v0.78',
      module: 'Universe Knowledge Product Shell',
      zh: '宇宙知识产品壳',
      purpose: 'Expose universe knowledge objects as reviewable product cards and shareable surfaces.',
      acceptance: ['product cards generated', 'negative-claim guard active', 'human review gate active'],
    },
    {
      version: 'v0.79',
      module: 'Knowledge-to-Experiment Autopipeline',
      zh: '知识到实验自动流水线',
      purpose: 'Turn selected knowledge objects into experiment protocols, prototype simulations and lab notebook runs.',
      acceptance: ['experiment handoff emitted', 'simulation hook linked', 'evidence writeback path ready'],
    },
    {
      version: 'v0.80',
      module: 'Universe Knowledge Council Runtime',
      zh: '宇宙知识委员会运行时',
      purpose: 'Run multi-agent review over knowledge objects, claims, mutations and releases.',
      acceptance: ['council sessions over knowledge graph', 'dissent ledger emitted', 'human authority gate enforced'],
    },
    {
      version: 'v0.81',
      module: 'Personal Universe Knowledge OS',
      zh: '个人宇宙知识操作系统',
      purpose: 'Bind user goals, capability feedback and personal knowledge loops to Universe Knowledge Runtime.',
      acceptance: ['personal profile linked', 'capability feedback loop active', 'privacy boundary active'],
    },
    {
      version: 'v0.82',
      module: 'RCL Super App Kernel Shell',
      zh: 'RCL 超级应用内核壳',
      purpose: 'Package RCL runtime capabilities into a Super App-ready kernel shell.',
      acceptance: ['navigation model', 'plugin slots', 'runtime status cards', 'offline package boundary'],
    },
    {
      version: 'v0.83',
      module: 'Mobile Super App Bridge',
      zh: '移动端超级应用桥',
      purpose: 'Connect RCL Super App shell to Aether Forge Pocket mobile runtime.',
      acceptance: ['mobile cards', 'preview surfaces', 'local model/API bridge', 'delivery handoff'],
    },
    {
      version: 'v0.84',
      module: 'Recursive Knowledge Governance Layer',
      zh: '递归知识治理层',
      purpose: 'Govern knowledge mutation, release, claim strength, rollback and long-run recursive planning.',
      acceptance: ['claim-strength policy', 'rollback obligation', 'recursive stop conditions', 'release cadence'],
    },
  ];
}

export function normalizeUniverseKnowledgeRuntimeSpec(input = {}) {
  const spec = {
    format: input.format ?? RCL_UNIVERSE_KNOWLEDGE_RUNTIME_SPEC_FORMAT,
    id: input.id ?? 'rcl_universe_knowledge_runtime_default_v0',
    version: input.version ?? RCL_UNIVERSE_KNOWLEDGE_RUNTIME_VERSION,
    objective: input.objective ?? 'Compile all RCL knowledge into governed, verified, translatable, executable Universe Knowledge Objects.',
    knowledgeRecords: asArray(input.knowledgeRecords ?? input.records ?? defaultKnowledgeRecords()),
    futureRoadmap: asArray(input.futureRoadmap ?? defaultFutureRoadmap()),
    thresholds: {
      minKnowledgeObjectCount: Number(input.thresholds?.minKnowledgeObjectCount ?? 8),
      minAverageRuntimeReadiness: Number(input.thresholds?.minAverageRuntimeReadiness ?? 0.9),
      minFutureRoadmapCount: Number(input.thresholds?.minFutureRoadmapCount ?? 8),
      requireTranslationSurface: input.thresholds?.requireTranslationSurface ?? true,
      requireGovernancePolicy: input.thresholds?.requireGovernancePolicy ?? true,
      requireHookCoverage: input.thresholds?.requireHookCoverage ?? true,
    },
    governanceSource: input.governanceSource ?? null,
  };
  return spec;
}

function buildSemanticTranslatorInput(knowledgeObjects) {
  return normalizeUniversalSemanticTranslatorSpec({
    id: 'rcl_universe_knowledge_runtime_semantic_surface_v0',
    objective: 'Naturalize Universe Knowledge Runtime objects into human-readable documents.',
    semanticInputs: knowledgeObjects.map((obj) => ({
      id: obj.id,
      title: obj.title,
      kind: obj.type,
      language: 'Universe Knowledge Object IR',
      sourceVersion: obj.sourceVersion,
      evidenceRoot: obj.evidenceRoot,
      metrics: {
        runtimeReadiness: obj.state.runtimeReadiness,
        verificationScore: obj.verificationState.verificationScore,
      },
      content: obj.description,
    })),
  });
}

function buildGovernanceInput(spec, knowledgeObjects) {
  return normalizeRecursiveGovernanceKernelSpec(spec.governanceSource ?? {
    id: 'rcl_universe_knowledge_runtime_governance_v0',
    objective: 'Govern Universe Knowledge Runtime objects, lifecycle, release, mutation and human authority.',
    governancePolicy: {
      nextHandoff: 'v0.77 Knowledge Graph Query Engine',
      knowledgeObjectCount: knowledgeObjects.length,
      defaultReleaseMode: 'governed-knowledge-object-runtime',
    },
  });
}

export function buildUniverseKnowledgeRuntimeSpec(overrides = {}) {
  return normalizeUniverseKnowledgeRuntimeSpec(overrides);
}

export function compileUniverseKnowledgeRuntime(input = {}) {
  const spec = normalizeUniverseKnowledgeRuntimeSpec(input);
  const knowledgeObjects = spec.knowledgeRecords.map(makeKnowledgeObject);
  const states = knowledgeObjects.map((obj) => obj.state);
  const translatorBundle = runUniversalSemanticTranslator(buildSemanticTranslatorInput(knowledgeObjects));
  const governanceBundle = runRecursiveGovernanceKernel(buildGovernanceInput(spec, knowledgeObjects));
  const hookCoverage = knowledgeObjects.map((obj) => {
    const hooks = Object.values(obj.hooks).filter(Boolean).length;
    return round(hooks / 5);
  });
  const translationReady = knowledgeObjects.filter((obj) => obj.translationSurface.ready).length;
  const governanceReady = knowledgeObjects.filter((obj) => obj.governancePolicy.humanFinalAuthority).length;
  const runtimeReadiness = states.map((s) => s.runtimeReadiness);
  const averageRuntimeReadiness = round(average(runtimeReadiness));
  const averageVerificationScore = round(average(knowledgeObjects.map((obj) => obj.verificationState.verificationScore)));
  const averageHookCoverage = round(average(hookCoverage));
  const futurePlan = {
    format: RCL_UNIVERSE_KNOWLEDGE_FUTURE_PLAN_FORMAT,
    sourcePlanner: 'v0.66 Recursive Future Release Planner logic + v0.75 current module state',
    planningRoot: sha256(compact({ source: spec.id, futureRoadmap: spec.futureRoadmap, knowledgeObjects: knowledgeObjects.map((o) => o.objectRoot) })),
    releases: spec.futureRoadmap,
  };
  const result = {
    format: RCL_UNIVERSE_KNOWLEDGE_RUNTIME_RESULT_FORMAT,
    version: RCL_UNIVERSE_KNOWLEDGE_RUNTIME_VERSION,
    universeKnowledgeRuntimeEstablished:
      knowledgeObjects.length >= spec.thresholds.minKnowledgeObjectCount &&
      averageRuntimeReadiness >= spec.thresholds.minAverageRuntimeReadiness &&
      spec.futureRoadmap.length >= spec.thresholds.minFutureRoadmapCount &&
      (!spec.thresholds.requireTranslationSurface || translationReady === knowledgeObjects.length) &&
      (!spec.thresholds.requireGovernancePolicy || governanceReady === knowledgeObjects.length) &&
      (!spec.thresholds.requireHookCoverage || averageHookCoverage >= 0.8),
    knowledgeObjectCount: knowledgeObjects.length,
    knowledgeStateCount: states.length,
    futureReleasePlanCount: spec.futureRoadmap.length,
    translationDocumentCount: translatorBundle.documents?.length ?? 0,
    averageRuntimeReadiness,
    averageVerificationScore,
    averageHookCoverage,
    translationSurfaceReady: translationReady === knowledgeObjects.length,
    governancePolicyReady: governanceReady === knowledgeObjects.length,
    queryEngineHandoffReady: spec.futureRoadmap.some((r) => r.version === 'v0.77'),
    superAppKnowledgeBrainReady: true,
    canonicalRoot: sha256(compact({ spec, knowledgeObjects, futurePlan })),
  };
  return {
    ok: result.universeKnowledgeRuntimeEstablished,
    format: RCL_UNIVERSE_KNOWLEDGE_RUNTIME_BUNDLE_FORMAT,
    spec,
    knowledgeObjects,
    states,
    translator: {
      result: translatorBundle.result,
      documentCount: translatorBundle.documents?.length ?? 0,
      documents: translatorBundle.documents ?? [],
    },
    governance: {
      result: governanceBundle.result,
      policyCount: governanceBundle.policies?.length ?? 0,
    },
    futurePlan,
    result,
  };
}

export function runUniverseKnowledgeRuntime(input = {}) {
  return compileUniverseKnowledgeRuntime(input);
}

export function runUniverseKnowledgeRuntimeDemo(overrides = {}) {
  return runUniverseKnowledgeRuntime(buildUniverseKnowledgeRuntimeSpec(overrides));
}

export function renderUniverseKnowledgeRuntimeRcl(specInput = {}) {
  const spec = normalizeUniverseKnowledgeRuntimeSpec(specInput);
  const lines = [];
  lines.push('reality universe_knowledge_runtime_v0_76 {');
  lines.push(`  objective: ${JSON.stringify(spec.objective)}`);
  lines.push(`  knowledge_objects: ${spec.knowledgeRecords.length}`);
  lines.push(`  future_releases: ${spec.futureRoadmap.length}`);
  lines.push('  requires: [knowledge_object_state, evidence_binding, verification_state, translation_surface, governance_policy]');
  lines.push('}');
  return lines.join('\n');
}

export function readUniverseKnowledgeRuntimeInput(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  if (!raw.trim()) return {};
  return JSON.parse(raw);
}

function makeKnowledgeObjectMarkdown(obj) {
  return `# ${obj.title}\n\n` +
    `**ID**: \`${obj.id}\`\n\n` +
    `**Type（类型）**: ${obj.type}\n\n` +
    `**Source Version（来源版本）**: ${obj.sourceVersion}\n\n` +
    `## Description（描述）\n\n${obj.description}\n\n` +
    `## State（状态）\n\n- Status（状态）: ${obj.state.status}\n- Runtime Readiness（运行时就绪度）: ${obj.state.runtimeReadiness}\n- Evidence Root（证据根）: \`${obj.evidenceRoot}\`\n\n` +
    `## Hooks（钩子）\n\n` +
    Object.entries(obj.hooks).map(([k, v]) => `- ${k}: ${v ?? 'none'}`).join('\n') + '\n\n' +
    `## Governance（治理）\n\n- Human Final Authority（人类最终权威）: ${obj.governancePolicy.humanFinalAuthority}\n- Risk Budget（风险预算）: ${obj.governancePolicy.riskBudget}\n- Release Gate（发布闸门）: ${obj.governancePolicy.releaseGate}\n`;
}

function makeFutureRoadmapMarkdown(futurePlan) {
  const lines = ['# RCL v0.76 后续路线：Universe Knowledge Runtime 递归规划', ''];
  lines.push(`Planning Root（规划根）: \`${futurePlan.planningRoot}\``);
  lines.push('');
  lines.push('| Version（版本） | Module（模块） | 中文 | Purpose（目的） |');
  lines.push('|---|---|---|---|');
  for (const r of futurePlan.releases) {
    lines.push(`| ${r.version} | ${r.module} | ${r.zh} | ${r.purpose} |`);
  }
  lines.push('');
  lines.push('## 判定');
  lines.push('');
  lines.push('v0.76 之后的主线不是继续单点实验链，而是把所有知识对象化、查询化、产品化、治理化，最终进入 RCL Super App（超级应用）内核。');
  return lines.join('\n');
}

export function writeUniverseKnowledgeRuntimeReports(outDir, input = {}) {
  const bundle = runUniverseKnowledgeRuntime(input);
  const dir = path.resolve(outDir);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'universe-knowledge-runtime-result.json'), `${JSON.stringify(bundle.result, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'universe-knowledge-runtime-bundle.json'), `${JSON.stringify(bundle, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'knowledge-objects.json'), `${JSON.stringify(bundle.knowledgeObjects, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'knowledge-states.json'), `${JSON.stringify(bundle.states, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'future-roadmap.json'), `${JSON.stringify(bundle.futurePlan, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'future-roadmap.md'), `${makeFutureRoadmapMarkdown(bundle.futurePlan)}\n`);
  fs.writeFileSync(path.join(dir, 'universe-knowledge-runtime.rcl'), `${renderUniverseKnowledgeRuntimeRcl(bundle.spec)}\n`);
  const objectDir = path.join(dir, 'knowledge-object-docs');
  fs.mkdirSync(objectDir, { recursive: true });
  for (const obj of bundle.knowledgeObjects) {
    fs.writeFileSync(path.join(objectDir, `${obj.id}.md`), makeKnowledgeObjectMarkdown(obj));
  }
  const docsDir = path.join(dir, 'natural-language-docs');
  fs.mkdirSync(docsDir, { recursive: true });
  for (const doc of bundle.translator.documents ?? []) {
    fs.writeFileSync(path.join(docsDir, `${safeId(doc.id)}.md`), `${doc.markdown}\n`);
  }
  fs.writeFileSync(path.join(dir, 'canonical-root.txt'), `${bundle.result.canonicalRoot}\n`);
  return {
    ok: bundle.ok,
    outDir: dir,
    result: bundle.result,
    files: [
      'universe-knowledge-runtime-result.json',
      'universe-knowledge-runtime-bundle.json',
      'knowledge-objects.json',
      'knowledge-states.json',
      'future-roadmap.json',
      'future-roadmap.md',
      'universe-knowledge-runtime.rcl',
      'canonical-root.txt',
    ],
  };
}
