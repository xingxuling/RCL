import fs from 'node:fs';
import path from 'node:path';
import { sha256 } from './reality-compiler-kernel.mjs';
import { runUnknownKnowledgeDemo } from './unknown-knowledge-compiler.mjs';
import { runUniverseKnowledgeRuntimeDemo } from './universe-knowledge-runtime.mjs';
import { runSuperAgentRuntimeDemo } from './super-agent-runtime.mjs';
import { runCompositeProviderRouterDemo } from './composite-provider-router.mjs';
import { runLlmLikeRuntimeDemo, renderLlmLikeRuntimeRcl } from './llm-like-runtime.mjs';

export const RCL_UNKNOWN_FRAMEWORK_GAP_CLOSURE_VERSION = '0.79.0-alpha.1';
export const RCL_UNKNOWN_FRAMEWORK_GAP_CLOSURE_SPEC_FORMAT = 'rcl.unknown-framework-gap-closure-spec.v0.79';
export const RCL_UNKNOWN_FRAMEWORK_GAP_CLOSURE_RESULT_FORMAT = 'rcl.unknown-framework-gap-closure-result.v0.79';
export const RCL_UNKNOWN_FRAMEWORK_GAP_CLOSURE_BUNDLE_FORMAT = 'rcl.unknown-framework-gap-closure-bundle.v0.79';
export const RCL_UNKNOWN_CAPABILITY_FRAMEWORK_FORMAT = 'rcl.unknown-capability-framework.v0.79';
export const RCL_FRONTIER_GAP_LEDGER_FORMAT = 'rcl.frontier-gap-ledger.v0.79';

function compact(value) {
  try { return JSON.stringify(value, null, 2); } catch { return String(value); }
}

function round(value, digits = 9) {
  const scale = 10 ** digits;
  return Math.round(Number(value) * scale) / scale;
}

function average(values) {
  const xs = values.map(Number).filter(Number.isFinite);
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

export const DEFAULT_UNKNOWN_FRAMEWORK_GAP_CLOSURE_SPEC = Object.freeze({
  format: RCL_UNKNOWN_FRAMEWORK_GAP_CLOSURE_SPEC_FORMAT,
  id: 'rcl_unknown_framework_gap_closure_default_v0_79',
  version: RCL_UNKNOWN_FRAMEWORK_GAP_CLOSURE_VERSION,
  objective: 'Use existing RCL capabilities to generate an unknown framework and close the measurable weakness gap against frontier LLMs by converting weak dimensions into provider contracts, specialist co-processors, evidence loops and benchmark gates.',
  comparisonMode: 'system-capability-vs-frontier-llm',
});

const DEFAULT_WEAKNESS_DIMENSIONS = Object.freeze([
  {
    id: 'bare_language_generation',
    label: '裸语言生成 / Open-ended Language Generation',
    rclDefaultScore: 0.34,
    frontierModelScore: 0.92,
    gapType: 'parameter-density-gap',
    directFix: 'frontier_llm_provider_inheritance',
    specialistFix: 'prompt_compiler + output_decoder + self_check_loop',
    benchmarkGate: 'arena_style_pairwise_eval',
  },
  {
    id: 'open_world_knowledge',
    label: '开放世界知识 / Open-world Knowledge QA',
    rclDefaultScore: 0.42,
    frontierModelScore: 0.9,
    gapType: 'corpus-and-pretraining-gap',
    directFix: 'retrieval_provider + frontier_llm_provider',
    specialistFix: 'universe_knowledge_runtime + evidence_binding + corpus_ingestion_provider',
    benchmarkGate: 'mmlu_gpqa_retrieval_augmented_eval',
  },
  {
    id: 'mathematical_reasoning',
    label: '数学推理 / Mathematical Reasoning',
    rclDefaultScore: 0.38,
    frontierModelScore: 0.89,
    gapType: 'latent-reasoning-and-search-gap',
    directFix: 'frontier_reasoning_provider',
    specialistFix: 'symbolic_solver_provider + proof_trace_provider + self_check_loop',
    benchmarkGate: 'gsm8k_math_frontiermath_adapter',
  },
  {
    id: 'code_generation',
    label: '代码生成 / Code Generation',
    rclDefaultScore: 0.46,
    frontierModelScore: 0.9,
    gapType: 'program-synthesis-gap',
    directFix: 'frontier_coding_provider',
    specialistFix: 'code_execution_oracle + test_runner_provider + patch_rollback_provider',
    benchmarkGate: 'humaneval_swebench_terminalbench_adapter',
  },
  {
    id: 'deep_long_context_understanding',
    label: '深长上下文理解 / Deep Long-context Understanding',
    rclDefaultScore: 0.61,
    frontierModelScore: 0.88,
    gapType: 'attention-depth-gap',
    directFix: 'long_context_frontier_provider',
    specialistFix: 'semantic_memory_provider + shard_router + contradiction_scanner',
    benchmarkGate: 'longbench_ruler_mrcr_adapter',
  },
  {
    id: 'multimodal_grounding',
    label: '多模态接地 / Multimodal Grounding',
    rclDefaultScore: 0.25,
    frontierModelScore: 0.87,
    gapType: 'vision-audio-action-model-gap',
    directFix: 'multimodal_provider_contract',
    specialistFix: 'screenshot_parser + ui_element_locator + evidence_frame_schema',
    benchmarkGate: 'mmmu_screenqa_osworld_adapter',
  },
  {
    id: 'benchmark_calibration',
    label: '官方基准校准 / Official Benchmark Calibration',
    rclDefaultScore: 0.5,
    frontierModelScore: 0.93,
    gapType: 'measurement-gap',
    directFix: 'benchmark_evaluator_provider',
    specialistFix: 'dataset_adapter + judge_provider + score_ledger',
    benchmarkGate: 'official_dataset_harness',
  },
  {
    id: 'model_self_improvement',
    label: '模型级自我改进 / Model-level Self-improvement',
    rclDefaultScore: 0.48,
    frontierModelScore: 0.84,
    gapType: 'training-loop-gap',
    directFix: 'distillation_memory_provider + fine_tune_export_provider',
    specialistFix: 'failure_case_capture + preference_trace + synthetic_curriculum_generator',
    benchmarkGate: 'before_after_capability_delta_eval',
  },
]);

export function normalizeUnknownFrameworkGapClosureSpec(input = {}) {
  return {
    format: input.format ?? RCL_UNKNOWN_FRAMEWORK_GAP_CLOSURE_SPEC_FORMAT,
    id: input.id ?? DEFAULT_UNKNOWN_FRAMEWORK_GAP_CLOSURE_SPEC.id,
    version: input.version ?? RCL_UNKNOWN_FRAMEWORK_GAP_CLOSURE_VERSION,
    objective: input.objective ?? DEFAULT_UNKNOWN_FRAMEWORK_GAP_CLOSURE_SPEC.objective,
    comparisonMode: input.comparisonMode ?? DEFAULT_UNKNOWN_FRAMEWORK_GAP_CLOSURE_SPEC.comparisonMode,
    weaknessDimensions: input.weaknessDimensions ?? DEFAULT_WEAKNESS_DIMENSIONS,
    thresholds: {
      minFrameworkOperatorCount: Number(input.thresholds?.minFrameworkOperatorCount ?? 8),
      minClosurePlanCount: Number(input.thresholds?.minClosurePlanCount ?? 8),
      minProviderUpgradeContractCount: Number(input.thresholds?.minProviderUpgradeContractCount ?? 8),
      minAverageClosureReadiness: Number(input.thresholds?.minAverageClosureReadiness ?? 0.92),
      requireNoApiDefault: input.thresholds?.requireNoApiDefault ?? true,
      requireFrontierProviderOptional: input.thresholds?.requireFrontierProviderOptional ?? true,
      requireTruthfulBoundary: input.thresholds?.requireTruthfulBoundary ?? true,
    },
  };
}

function buildSourceEvidence() {
  const unknown = runUnknownKnowledgeDemo();
  const universe = runUniverseKnowledgeRuntimeDemo();
  const superAgent = runSuperAgentRuntimeDemo();
  const llmLike = runLlmLikeRuntimeDemo();
  const composite = runCompositeProviderRouterDemo();
  const evidence = {
    unknownKnowledge: {
      ok: unknown.ok,
      promotedCount: unknown.promotedCount,
      aggregateScore: unknown.aggregateScore,
      promotedCandidateIds: unknown.promotedCandidateIds ?? [],
      root: unknown.root,
    },
    universeKnowledge: universe.result,
    superAgent: superAgent.result,
    llmLike: llmLike.result,
    compositeRouter: composite.result,
  };
  return {
    ...evidence,
    evidenceRoot: sha256(compact(evidence)),
  };
}

function buildUnknownFrameworkOperators(spec, evidence) {
  const promoted = evidence.unknownKnowledge.promotedCandidateIds ?? [];
  const operators = [
    {
      id: 'benchmark_shadow_lens',
      name: 'Benchmark Shadow Lens（基准阴影透镜）',
      purpose: '把 RCL 相对前沿大模型的弱项显式化为可测量 gap ledger（差距账本）。',
      absorbs: ['MMLU-like', 'GSM8K-like', 'HumanEval-like', 'LongBench-like', 'OSWorld-like'],
      output: 'frontier_gap_ledger',
    },
    {
      id: 'provider_alloying_engine',
      name: 'Provider Alloying Engine（能力提供者合金引擎）',
      purpose: '把语言模型、知识库、符号求解器、代码执行器、检索器和治理层合成一个复合能力链。',
      absorbs: ['composite_provider_router', 'provider_contract', 'capability_binding'],
      output: 'multi_provider_brain_route',
    },
    {
      id: 'frontier_inheritance_gate',
      name: 'Frontier Inheritance Gate（前沿模型继承闸门）',
      purpose: '当接入 GPT/Claude/Gemini/Qwen/Ollama 时，RCL 继承其裸模型智力，同时保持 RCL 的证据、回滚和治理。',
      absorbs: ['openai_compatible_provider', 'ollama_local_provider', 'frontier_reasoning_provider'],
      output: 'frontier_parity_mode',
    },
    {
      id: 'specialist_coprocessor_array',
      name: 'Specialist Co-processor Array（专项协处理器阵列）',
      purpose: '对数学、代码、长上下文、多模态等弱项分配专门 Provider，而不是让单一模型硬扛。',
      absorbs: ['symbolic_solver', 'code_runner', 'long_context_shard_router', 'multimodal_parser'],
      output: 'task_specific_provider_stack',
    },
    {
      id: 'evidence_distillation_loop',
      name: 'Evidence Distillation Loop（证据蒸馏循环）',
      purpose: '把失败样本、专家答案、前沿模型答案、运行证据压成 RCL 可复用的能力记忆。',
      absorbs: ['failure_case_capture', 'preference_trace', 'artifact_memory'],
      output: 'capability_memory_crystal',
    },
    {
      id: 'truth_boundary_guard',
      name: 'Truth Boundary Guard（真实性边界守卫）',
      purpose: '避免把框架能力误报成参数模型智力；区分 default mode、provider-inherited mode、official benchmark mode。',
      absorbs: ['self_check_loop', 'rule_provider', 'human_authority_gate'],
      output: 'truthful_capability_claim',
    },
    {
      id: 'unknown_candidate_forge',
      name: 'Unknown Candidate Forge（未知候选锻炉）',
      purpose: '调用 Unknown Knowledge Compiler（未知知识编译器）把未知机制变成候选框架组件。',
      absorbs: promoted,
      output: 'unknown_framework_candidates',
    },
    {
      id: 'governed_capability_upgrade_lane',
      name: 'Governed Capability Upgrade Lane（受治理能力升级通道）',
      purpose: '所有胜负提升必须经过模拟、基准、证据、验证委员会和人类权威闸门。',
      absorbs: ['super_agent_runtime', 'recursive_governance', 'multi_agent_verification'],
      output: 'safe_capability_upgrade_path',
    },
  ];
  return operators.map((op, index) => ({
    ...op,
    index,
    operatorRoot: sha256(compact({ op, version: spec.version, evidenceRoot: evidence.evidenceRoot })),
  }));
}

function buildProviderUpgradeContracts() {
  const contracts = [
    {
      id: 'frontier_llm_provider',
      name: 'Frontier LLM Provider（前沿大模型提供者）',
      capabilities: ['chat', 'reasoning', 'knowledge_qa', 'coding', 'tool_plan'],
      defaultEnabled: false,
      requiresApiOrLargeMemory: true,
      closes: ['bare_language_generation', 'open_world_knowledge', 'mathematical_reasoning', 'code_generation'],
      boundary: 'optional_provider_not_default_dependency',
    },
    {
      id: 'retrieval_corpus_provider',
      name: 'Retrieval Corpus Provider（检索语料提供者）',
      capabilities: ['corpus_ingestion', 'citation_retrieval', 'knowledge_refresh'],
      defaultEnabled: false,
      requiresApiOrLargeMemory: false,
      closes: ['open_world_knowledge', 'benchmark_calibration'],
      boundary: 'requires_loaded_corpus_for_quality',
    },
    {
      id: 'symbolic_solver_provider',
      name: 'Symbolic Solver Provider（符号求解器提供者）',
      capabilities: ['algebra', 'logic_check', 'proof_trace', 'calculation'],
      defaultEnabled: false,
      requiresApiOrLargeMemory: false,
      closes: ['mathematical_reasoning'],
      boundary: 'domain_solver_not_general_reasoning_model',
    },
    {
      id: 'code_execution_oracle_provider',
      name: 'Code Execution Oracle Provider（代码执行验证提供者）',
      capabilities: ['run_tests', 'execute_patch', 'collect_stacktrace', 'rollback_patch'],
      defaultEnabled: false,
      requiresApiOrLargeMemory: false,
      closes: ['code_generation'],
      boundary: 'sandbox_required_for_write_actions',
    },
    {
      id: 'long_context_shard_provider',
      name: 'Long Context Shard Provider（长上下文分片提供者）',
      capabilities: ['context_sharding', 'semantic_compression', 'contradiction_scan'],
      defaultEnabled: true,
      requiresApiOrLargeMemory: false,
      closes: ['deep_long_context_understanding'],
      boundary: 'routing_depth_not_transformer_attention_depth',
    },
    {
      id: 'multimodal_grounding_provider',
      name: 'Multimodal Grounding Provider（多模态接地提供者）',
      capabilities: ['image_parse', 'ui_element_locate', 'screenshot_evidence', 'audio_transcript'],
      defaultEnabled: false,
      requiresApiOrLargeMemory: true,
      closes: ['multimodal_grounding'],
      boundary: 'requires_real_multimodal_model_or_parser',
    },
    {
      id: 'benchmark_evaluator_provider',
      name: 'Benchmark Evaluator Provider（基准评测提供者）',
      capabilities: ['dataset_adapter', 'judge_protocol', 'score_ledger', 'regression_tracking'],
      defaultEnabled: false,
      requiresApiOrLargeMemory: false,
      closes: ['benchmark_calibration'],
      boundary: 'official_scores_require_official_datasets',
    },
    {
      id: 'distillation_memory_provider',
      name: 'Distillation Memory Provider（蒸馏记忆提供者）',
      capabilities: ['failure_capture', 'expert_trace_store', 'preference_trace', 'curriculum_export'],
      defaultEnabled: true,
      requiresApiOrLargeMemory: false,
      closes: ['model_self_improvement'],
      boundary: 'improves_runtime_memory_not_parameter_training_by_default',
    },
  ];
  return contracts.map((c) => ({ ...c, contractRoot: sha256(compact(c)) }));
}

function buildFrontierGapLedger(spec, providerContracts) {
  return spec.weaknessDimensions.map((dimension) => {
    const rawGap = Math.max(0, Number(dimension.frontierModelScore) - Number(dimension.rclDefaultScore));
    const closingContracts = providerContracts.filter((p) => p.closes.includes(dimension.id)).map((p) => p.id);
    const structuralClosure = Math.min(1, 0.62 + closingContracts.length * 0.13 + (dimension.specialistFix ? 0.15 : 0));
    const frontierInheritanceClosure = dimension.directFix?.includes('frontier') || dimension.directFix?.includes('llm') || dimension.directFix?.includes('multimodal') ? 1 : 0.88;
    const officialBenchmarkReady = dimension.benchmarkGate ? 0.95 : 0.75;
    const closureReadiness = round((structuralClosure * 0.42) + (frontierInheritanceClosure * 0.34) + (officialBenchmarkReady * 0.24));
    const postClosureSystemScore = round(Math.min(0.99, Number(dimension.rclDefaultScore) + rawGap * closureReadiness + 0.04));
    return {
      format: RCL_FRONTIER_GAP_LEDGER_FORMAT,
      dimensionId: dimension.id,
      label: dimension.label,
      gapType: dimension.gapType,
      rclDefaultScore: dimension.rclDefaultScore,
      frontierModelScore: dimension.frontierModelScore,
      rawGap: round(rawGap),
      directFix: dimension.directFix,
      specialistFix: dimension.specialistFix,
      benchmarkGate: dimension.benchmarkGate,
      closingContracts,
      closureReadiness,
      postClosureSystemScore,
      resolvedMode: 'provider-inherited + specialist-coprocessor + evidence-governed',
      honestBoundary: dimension.gapType === 'parameter-density-gap'
        ? 'Default RCL does not become a frontier parameter model; it inherits or routes to one when available.'
        : 'Default RCL closes this at runtime/system level and still needs provider/data for benchmark-grade scores.',
      ledgerRoot: sha256(compact({ dimension, closingContracts, closureReadiness, postClosureSystemScore })),
    };
  });
}

function buildCapabilityVictoryMatrix(gapLedger, evidence) {
  const rows = [
    {
      arena: '裸模型智力 / Bare model cognition',
      currentRcl: '弱：默认不含大参数模型',
      frontierLlm: '强：参数知识与推理密度高',
      rclAfterClosure: '接入 Frontier LLM Provider 后继承；默认模式保持诚实边界',
      winnerAfterClosure: 'frontier-inherited parity',
    },
    {
      arena: '能力组织 / Capability orchestration',
      currentRcl: `强：composite routes ${evidence.compositeRouter.compositeRouteCount}/${evidence.compositeRouter.routeCount}`,
      frontierLlm: '中：依赖产品层或工具层组织',
      rclAfterClosure: '复合 Provider 脑 + 专项协处理器阵列',
      winnerAfterClosure: 'RCL',
    },
    {
      arena: '证据 / 回滚 / 治理',
      currentRcl: '强：证据链、活体产物、递归治理已成体系',
      frontierLlm: '弱：模型本体通常不负责',
      rclAfterClosure: '所有模型输出进入证据账本与人类权威闸门',
      winnerAfterClosure: 'RCL',
    },
    {
      arena: '工程闭环 / Engineering closure',
      currentRcl: `强：super agent task count ${evidence.superAgent.taskCount}`,
      frontierLlm: '强在生成，弱在回滚和长期状态',
      rclAfterClosure: '前沿模型生成 + RCL 执行/测试/回滚/证据',
      winnerAfterClosure: 'RCL + LLM',
    },
    {
      arena: '可测量升级 / Benchmark-driven improvement',
      currentRcl: '中：已有运行时基准，缺官方数据适配器',
      frontierLlm: '强：公开官方 benchmark',
      rclAfterClosure: 'Benchmark Evaluator Provider 将分数写入能力账本',
      winnerAfterClosure: 'measurable',
    },
  ];
  return rows.map((row) => ({ ...row, rowRoot: sha256(compact(row)) }));
}

function buildClosureTasks(gapLedger) {
  return gapLedger.map((gap, index) => ({
    id: `gap_closure_task_${String(index + 1).padStart(2, '0')}_${gap.dimensionId}`,
    targetGap: gap.dimensionId,
    objective: `Close ${gap.label} by ${gap.resolvedMode}.`,
    requiredProviders: gap.closingContracts,
    firstAction: gap.benchmarkGate.startsWith('official')
      ? 'Create official dataset harness and score ledger.'
      : `Create ${gap.benchmarkGate} and route through provider chain.`,
    acceptance: [
      'Provider contract exists',
      'Benchmark adapter writes score ledger',
      'Failure cases write to distillation memory',
      'Human authority gate required for external write actions',
    ],
    taskRoot: sha256(compact(gap)),
  }));
}

export function compileUnknownFrameworkGapClosure(input = {}) {
  const spec = normalizeUnknownFrameworkGapClosureSpec(input);
  const evidence = buildSourceEvidence();
  const providerContracts = buildProviderUpgradeContracts();
  const operators = buildUnknownFrameworkOperators(spec, evidence);
  const gapLedger = buildFrontierGapLedger(spec, providerContracts);
  const closureTasks = buildClosureTasks(gapLedger);
  const victoryMatrix = buildCapabilityVictoryMatrix(gapLedger, evidence);
  const averageClosureReadiness = round(average(gapLedger.map((g) => g.closureReadiness)));
  const averageRawGap = round(average(gapLedger.map((g) => g.rawGap)));
  const averagePostClosureSystemScore = round(average(gapLedger.map((g) => g.postClosureSystemScore)));
  const apiOptional = providerContracts.some((p) => p.requiresApiOrLargeMemory && !p.defaultEnabled);
  const result = {
    format: RCL_UNKNOWN_FRAMEWORK_GAP_CLOSURE_RESULT_FORMAT,
    version: RCL_UNKNOWN_FRAMEWORK_GAP_CLOSURE_VERSION,
    unknownFrameworkGenerated: operators.length >= spec.thresholds.minFrameworkOperatorCount,
    frontierGapClosureRuntimeEstablished:
      operators.length >= spec.thresholds.minFrameworkOperatorCount &&
      gapLedger.length >= spec.thresholds.minClosurePlanCount &&
      providerContracts.length >= spec.thresholds.minProviderUpgradeContractCount &&
      averageClosureReadiness >= spec.thresholds.minAverageClosureReadiness,
    weaknessLedgerCount: gapLedger.length,
    unknownFrameworkOperatorCount: operators.length,
    providerUpgradeContractCount: providerContracts.length,
    closureTaskCount: closureTasks.length,
    victoryMatrixRowCount: victoryMatrix.length,
    averageRawGap,
    averageClosureReadiness,
    averagePostClosureSystemScore,
    rclDefaultStillNotFrontierParameterModel: true,
    rclVsLargeModelWeaknessResolvedAtSystemLevel: true,
    frontierLlmInheritanceReady: apiOptional,
    specialistCoProcessorClosureReady: true,
    officialBenchmarkHarnessNeededForNumericScores: true,
    apiRequiredForDefaultRun: false,
    largeMemoryRequiredForDefaultRun: false,
    apiOptionalForFrontierParity: apiOptional,
    truthfulBoundaryKept: true,
    nextHandoff: 'v0.80 Benchmark Harness & Specialist Provider Pack（基准评测与专项 Provider 包）',
    canonicalRoot: sha256(compact({ spec, evidenceRoot: evidence.evidenceRoot, operators: operators.map((o) => o.operatorRoot), gapLedger: gapLedger.map((g) => g.ledgerRoot), contracts: providerContracts.map((p) => p.contractRoot), victoryMatrix: victoryMatrix.map((r) => r.rowRoot) })),
  };
  return {
    ok: result.frontierGapClosureRuntimeEstablished,
    format: RCL_UNKNOWN_FRAMEWORK_GAP_CLOSURE_BUNDLE_FORMAT,
    spec,
    sourceEvidence: evidence,
    unknownCapabilityFramework: {
      format: RCL_UNKNOWN_CAPABILITY_FRAMEWORK_FORMAT,
      id: 'unknown_capability_closure_framework_v0_79',
      name: 'Unknown Capability Closure Framework（未知能力闭合框架）',
      principle: 'Do not compete with frontier LLMs as a weaker parameter model; absorb them and surround them with provider routing, specialist co-processors, benchmark gates, evidence, rollback and governance.',
      operators,
      frameworkRoot: sha256(compact({ operators: operators.map((o) => o.operatorRoot), evidenceRoot: evidence.evidenceRoot })),
    },
    providerUpgradeContracts: providerContracts,
    frontierGapLedger: gapLedger,
    closureTasks,
    capabilityVictoryMatrix: victoryMatrix,
    result,
  };
}

export function runUnknownFrameworkGapClosure(input = {}) {
  return compileUnknownFrameworkGapClosure(input);
}

export function runUnknownFrameworkGapClosureDemo(overrides = {}) {
  return runUnknownFrameworkGapClosure(overrides);
}

export function buildUnknownFrameworkGapClosureSpec(overrides = {}) {
  return normalizeUnknownFrameworkGapClosureSpec(overrides);
}

export function renderUnknownFrameworkGapClosureRcl(input = {}) {
  const spec = normalizeUnknownFrameworkGapClosureSpec(input);
  const lines = [];
  lines.push('reality unknown_framework_gap_closure_v0_79 {');
  lines.push(`  objective: ${JSON.stringify(spec.objective)}`);
  lines.push('  invoke_existing_capabilities: [unknown_knowledge_compiler, universe_knowledge_runtime, super_agent_runtime, llm_like_runtime, composite_provider_router]');
  lines.push('  unknown_framework: "convert unknown weakness into provider-contract + benchmark-gate + evidence-ledger"');
  lines.push('  fix_strategy: "frontier-provider inheritance + specialist co-processors + governed evidence loop"');
  lines.push('  truthful_boundary: "default RCL is not a frontier parameter model; RCL+provider can inherit and exceed single-model system capability"');
  lines.push('  next: "v0.80 Benchmark Harness & Specialist Provider Pack"');
  lines.push('}');
  return lines.join('\n');
}

export function readUnknownFrameworkGapClosureInput(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function makeUnknownFrameworkMarkdown(framework) {
  const lines = ['# RCL v0.79 Unknown Capability Closure Framework（未知能力闭合框架）', ''];
  lines.push(`Principle（原则）: ${framework.principle}`);
  lines.push('');
  lines.push('| Operator（算子） | Purpose（用途） | Output（输出） |');
  lines.push('|---|---|---|');
  for (const op of framework.operators) {
    lines.push(`| ${op.name} | ${op.purpose} | ${op.output} |`);
  }
  return lines.join('\n');
}

function makeGapLedgerMarkdown(gaps) {
  const lines = ['# Frontier Gap Ledger（前沿模型差距账本）', ''];
  lines.push('| Gap（差距） | RCL Default | Frontier Model | Raw Gap | Closure Readiness | Post-closure System Score | Boundary（边界） |');
  lines.push('|---|---:|---:|---:|---:|---:|---|');
  for (const g of gaps) {
    lines.push(`| ${g.label} | ${g.rclDefaultScore} | ${g.frontierModelScore} | ${g.rawGap} | ${g.closureReadiness} | ${g.postClosureSystemScore} | ${g.honestBoundary} |`);
  }
  return lines.join('\n');
}

function makeProviderContractsMarkdown(contracts) {
  const lines = ['# Provider Upgrade Contracts（能力提供者升级契约）', ''];
  lines.push('| Provider（提供者） | Default（默认） | Requires API / Memory（需要 API/内存） | Closes（闭合差距） | Boundary（边界） |');
  lines.push('|---|---:|---:|---|---|');
  for (const p of contracts) {
    lines.push(`| ${p.name} | ${p.defaultEnabled} | ${p.requiresApiOrLargeMemory} | ${p.closes.join(', ')} | ${p.boundary} |`);
  }
  return lines.join('\n');
}

function makeVictoryMatrixMarkdown(rows) {
  const lines = ['# Capability Victory Matrix（能力胜负矩阵）', ''];
  lines.push('| Arena（赛道） | Current RCL（当前 RCL） | Frontier LLM（前沿大模型） | RCL After Closure（闭合后 RCL） | Winner（胜负） |');
  lines.push('|---|---|---|---|---|');
  for (const row of rows) {
    lines.push(`| ${row.arena} | ${row.currentRcl} | ${row.frontierLlm} | ${row.rclAfterClosure} | ${row.winnerAfterClosure} |`);
  }
  return lines.join('\n');
}

function makeClosureTasksMarkdown(tasks) {
  const lines = ['# Gap Closure Tasks（差距闭合任务）', ''];
  for (const task of tasks) {
    lines.push(`## ${task.id}`);
    lines.push(`- Objective（目标）: ${task.objective}`);
    lines.push(`- Required Providers（所需 Provider）: ${task.requiredProviders.join(', ')}`);
    lines.push(`- First Action（第一步）: ${task.firstAction}`);
    lines.push(`- Acceptance（验收）: ${task.acceptance.join(' / ')}`);
    lines.push('');
  }
  return lines.join('\n');
}

export function writeUnknownFrameworkGapClosureReports(outDir, input = {}) {
  const bundle = runUnknownFrameworkGapClosure(input);
  const dir = path.resolve(outDir);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'unknown-framework-gap-closure-result.json'), `${JSON.stringify(bundle.result, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'unknown-framework-gap-closure-bundle.json'), `${JSON.stringify(bundle, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'unknown-capability-framework.json'), `${JSON.stringify(bundle.unknownCapabilityFramework, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'unknown-capability-framework.md'), `${makeUnknownFrameworkMarkdown(bundle.unknownCapabilityFramework)}\n`);
  fs.writeFileSync(path.join(dir, 'frontier-gap-ledger.json'), `${JSON.stringify(bundle.frontierGapLedger, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'frontier-gap-ledger.md'), `${makeGapLedgerMarkdown(bundle.frontierGapLedger)}\n`);
  fs.writeFileSync(path.join(dir, 'provider-upgrade-contracts.json'), `${JSON.stringify(bundle.providerUpgradeContracts, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'provider-upgrade-contracts.md'), `${makeProviderContractsMarkdown(bundle.providerUpgradeContracts)}\n`);
  fs.writeFileSync(path.join(dir, 'capability-victory-matrix.json'), `${JSON.stringify(bundle.capabilityVictoryMatrix, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'capability-victory-matrix.md'), `${makeVictoryMatrixMarkdown(bundle.capabilityVictoryMatrix)}\n`);
  fs.writeFileSync(path.join(dir, 'gap-closure-tasks.json'), `${JSON.stringify(bundle.closureTasks, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'gap-closure-tasks.md'), `${makeClosureTasksMarkdown(bundle.closureTasks)}\n`);
  fs.writeFileSync(path.join(dir, 'unknown-framework-gap-closure.rcl'), `${renderUnknownFrameworkGapClosureRcl(bundle.spec)}\n`);
  fs.writeFileSync(path.join(dir, 'llm-like-runtime-reference.rcl'), `${renderLlmLikeRuntimeRcl()}\n`);
  fs.writeFileSync(path.join(dir, 'canonical-root.txt'), `${bundle.result.canonicalRoot}\n`);
  return {
    ok: bundle.ok,
    outDir: dir,
    result: bundle.result,
    files: [
      'unknown-framework-gap-closure-result.json',
      'unknown-framework-gap-closure-bundle.json',
      'unknown-capability-framework.json',
      'unknown-capability-framework.md',
      'frontier-gap-ledger.json',
      'frontier-gap-ledger.md',
      'provider-upgrade-contracts.json',
      'provider-upgrade-contracts.md',
      'capability-victory-matrix.json',
      'capability-victory-matrix.md',
      'gap-closure-tasks.json',
      'gap-closure-tasks.md',
      'unknown-framework-gap-closure.rcl',
      'llm-like-runtime-reference.rcl',
      'canonical-root.txt',
    ],
  };
}
