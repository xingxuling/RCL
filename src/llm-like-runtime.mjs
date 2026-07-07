import fs from 'node:fs';
import path from 'node:path';
import { sha256 } from './reality-compiler-kernel.mjs';
import {
  runSuperAgentRuntime,
  normalizeSuperAgentRuntimeSpec,
} from './super-agent-runtime.mjs';
import {
  runUniverseKnowledgeRuntime,
  normalizeUniverseKnowledgeRuntimeSpec,
} from './universe-knowledge-runtime.mjs';
import {
  runUniversalSemanticTranslator,
  normalizeUniversalSemanticTranslatorSpec,
} from './universal-semantic-translator.mjs';
import {
  runRecursiveGovernanceKernel,
  normalizeRecursiveGovernanceKernelSpec,
} from './recursive-governance-kernel.mjs';

export const RCL_LLM_LIKE_RUNTIME_VERSION = '0.78.1-alpha.1';
export const RCL_LLM_LIKE_RUNTIME_SPEC_FORMAT = 'rcl.llm-like-runtime-spec.v0.78.1';
export const RCL_LLM_LIKE_RUNTIME_RESULT_FORMAT = 'rcl.llm-like-runtime-result.v0.78.1';
export const RCL_LLM_LIKE_RUNTIME_BUNDLE_FORMAT = 'rcl.llm-like-runtime-bundle.v0.78.1';
export const RCL_LLM_PROVIDER_CONTRACT_FORMAT = 'rcl.llm-provider-contract.v0.78';
export const RCL_LLM_RUNTIME_SESSION_FORMAT = 'rcl.llm-runtime-session.v0.78';
export const RCL_LLM_PROVIDER_ROUTER_FORMAT = 'rcl.llm-provider-router.v0.78.1';
export const RCL_COMPOSITE_PROVIDER_ROUTER_FORMAT = 'rcl.composite-provider-router.v0.78.1';
export const RCL_LLM_DESKTOP_HANDOFF_FORMAT = 'rcl.llm-desktop-exe-handoff.v0.78';

function round(value, digits = 9) {
  const scale = 10 ** digits;
  return Math.round(Number(value) * scale) / scale;
}

function average(values) {
  const xs = values.map(Number).filter(Number.isFinite);
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null) return [];
  return [value];
}

function compact(value) {
  try { return JSON.stringify(value, null, 2); } catch { return String(value); }
}

function safeId(value, fallback = 'llm-like-item') {
  return String(value ?? fallback)
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._:-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 150) || fallback;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value)));
}

export function defaultLlmProviderContracts() {
  return [
    {
      id: 'mock_llm_provider',
      name: 'Mock LLM Provider（模拟大模型提供者）',
      kind: 'mock_llm',
      capabilities: ['chat', 'reasoning_stub', 'summarize', 'tool_plan_stub'],
      requiresApiKey: false,
      requiresNetwork: false,
      requiresLargeMemory: false,
      contextTokens: 8192,
      costClass: 'free-local',
      defaultEnabled: true,
      purpose: 'API-less deterministic development and regression testing provider.',
    },
    {
      id: 'rule_provider',
      name: 'Rule Provider（规则提供者）',
      kind: 'rule_engine',
      capabilities: ['classification', 'routing', 'schema_validation', 'guardrail_decision'],
      requiresApiKey: false,
      requiresNetwork: false,
      requiresLargeMemory: false,
      contextTokens: 16384,
      costClass: 'free-local',
      defaultEnabled: true,
      purpose: 'Deterministic router, validator and fallback policy engine.',
    },
    {
      id: 'rcl_knowledge_provider',
      name: 'RCL Knowledge Provider（RCL 知识提供者）',
      kind: 'rcl_knowledge_runtime',
      capabilities: ['knowledge_object_lookup', 'evidence_binding', 'translation_surface', 'knowledge_state_read'],
      requiresApiKey: false,
      requiresNetwork: false,
      requiresLargeMemory: false,
      contextTokens: 32768,
      costClass: 'local-runtime',
      defaultEnabled: true,
      purpose: 'Use v0.76 Universe Knowledge Runtime as non-LLM knowledge substrate.',
    },
    {
      id: 'super_agent_provider',
      name: 'Super Agent Provider（类超级智能体提供者）',
      kind: 'rcl_super_agent_runtime',
      capabilities: ['goal_compile', 'task_decompose', 'tool_plan', 'simulation_gate', 'governance_hook'],
      requiresApiKey: false,
      requiresNetwork: false,
      requiresLargeMemory: false,
      contextTokens: 32768,
      costClass: 'local-runtime',
      defaultEnabled: true,
      purpose: 'Expose v0.77 Super Agent Runtime through a language-model-like contract.',
    },
    {
      id: 'openai_compatible_provider',
      name: 'OpenAI Compatible Provider（OpenAI 兼容提供者）',
      kind: 'cloud_llm_api',
      capabilities: ['chat', 'reasoning', 'tool_call', 'summarize', 'structured_output'],
      requiresApiKey: true,
      requiresNetwork: true,
      requiresLargeMemory: false,
      contextTokens: 128000,
      costClass: 'paid-cloud',
      defaultEnabled: false,
      purpose: 'Optional cloud model slot; not required for default runtime tests.',
    },
    {
      id: 'ollama_local_provider',
      name: 'Ollama Local Provider（Ollama 本地模型提供者）',
      kind: 'local_llm_server',
      capabilities: ['chat', 'summarize', 'local_private_reasoning', 'embedding_optional'],
      requiresApiKey: false,
      requiresNetwork: false,
      requiresLargeMemory: true,
      contextTokens: 32768,
      costClass: 'local-compute',
      defaultEnabled: false,
      purpose: 'Optional local model slot; memory use belongs to the model provider, not to RCL runtime shell.',
    },
    {
      id: 'tool_call_provider',
      name: 'Tool Call Provider（工具调用提供者）',
      kind: 'tool_format_runtime',
      capabilities: ['tool_schema_emit', 'tool_call_parse', 'dry_run_plan', 'write_action_gate'],
      requiresApiKey: false,
      requiresNetwork: false,
      requiresLargeMemory: false,
      contextTokens: 8192,
      costClass: 'free-local',
      defaultEnabled: true,
      purpose: 'Format and validate tool calls without executing unsafe writes by default.',
    },
    {
      id: 'semantic_memory_provider',
      name: 'Semantic Memory Provider（语义记忆提供者）',
      kind: 'semantic_memory_runtime',
      capabilities: ['context_compression', 'memory_summary', 'retrieval_hint', 'session_continuity'],
      requiresApiKey: false,
      requiresNetwork: false,
      requiresLargeMemory: false,
      contextTokens: 65536,
      costClass: 'local-runtime',
      defaultEnabled: true,
      purpose: 'Keep short-term and long-term context in a provider-neutral form.',
    },
  ];
}

function defaultRuntimeUseCases() {
  return [
    {
      id: 'chat_reasoning_shell',
      title: 'Chat Reasoning Shell（聊天推理壳）',
      intent: 'Understand user input, compile prompt frames, route to no-API providers by default and generate reviewable natural language output.',
      mode: 'chat',
      requiredCapabilities: ['chat', 'summarize', 'schema_validation'],
      privacyClass: 'local-first',
    },
    {
      id: 'rcl_explanation_shell',
      title: 'RCL Explanation Shell（RCL 解释壳）',
      intent: 'Explain RCL source, modules, runtime objects and evidence reports through Universal Semantic Translator.',
      mode: 'explain_rcl',
      requiredCapabilities: ['translation_surface', 'knowledge_object_lookup', 'summarize'],
      privacyClass: 'local-first',
    },
    {
      id: 'tool_planning_shell',
      title: 'Tool Planning Shell（工具规划壳）',
      intent: 'Convert model output into safe tool-call plans and dry-run execution proposals.',
      mode: 'tool_plan',
      requiredCapabilities: ['tool_schema_emit', 'tool_call_parse', 'dry_run_plan'],
      privacyClass: 'write-gated',
    },
    {
      id: 'code_assistant_shell',
      title: 'Code Assistant Shell（代码助手壳）',
      intent: 'Compile software requests into code review, patch plans, test plans and artifact output through provider contracts.',
      mode: 'code_assist',
      requiredCapabilities: ['chat', 'reasoning_stub', 'tool_plan_stub'],
      privacyClass: 'workspace-scoped',
    },
    {
      id: 'knowledge_query_shell',
      title: 'Knowledge Query Shell（知识查询壳）',
      intent: 'Query Universe Knowledge Runtime and render knowledge state into natural language answers.',
      mode: 'knowledge_query',
      requiredCapabilities: ['knowledge_object_lookup', 'evidence_binding', 'knowledge_state_read'],
      privacyClass: 'local-first',
    },
    {
      id: 'super_agent_command_shell',
      title: 'Super Agent Command Shell（超级智能体指挥壳）',
      intent: 'Turn a user command into goal compilation, task graph, simulation gate and human-gated execution loop.',
      mode: 'super_agent_command',
      requiredCapabilities: ['goal_compile', 'task_decompose', 'tool_plan', 'simulation_gate'],
      privacyClass: 'human-authority-required',
    },
    {
      id: 'context_compression_shell',
      title: 'Context Compression Shell（上下文压缩壳）',
      intent: 'Compress long conversations, evidence ledgers, source trees and project histories into portable semantic memory.',
      mode: 'context_compress',
      requiredCapabilities: ['context_compression', 'memory_summary', 'retrieval_hint'],
      privacyClass: 'local-first',
    },
    {
      id: 'desktop_exe_copilot_shell',
      title: 'Desktop EXE Copilot Shell（桌面 EXE 副驾驶壳）',
      intent: 'Serve as the language-model-like brain surface for the next RCL Desktop EXE application shell.',
      mode: 'desktop_exe_copilot',
      requiredCapabilities: ['chat', 'tool_schema_emit', 'goal_compile', 'session_continuity'],
      privacyClass: 'local-first-write-gated',
    },
  ];
}

function defaultPromptPolicies() {
  return {
    systemFrame: 'RCL LLM-like Runtime: provider-neutral, local-first, evidence-producing, human-gated for write actions.',
    developerFrame: 'Compile input into intent, context, tool plan, output schema, self-check and governed handoff.',
    outputContract: {
      text: 'string',
      toolCalls: 'array',
      confidence: 'number',
      evidenceRefs: 'array',
      selfCheck: 'object',
    },
    forbiddenDefaultBehaviors: [
      'execute_write_action_without_human_authority',
      'leak_api_key_or_provider_secret',
      'pretend_external_api_was_called_when_it_was_not',
      'treat_mock_provider_output_as_external_truth',
    ],
  };
}

export const DEFAULT_RCL_LLM_LIKE_RUNTIME_SPEC = Object.freeze({
  format: RCL_LLM_LIKE_RUNTIME_SPEC_FORMAT,
  id: 'rcl_llm_like_runtime_default_v0',
  version: RCL_LLM_LIKE_RUNTIME_VERSION,
  objective: 'Build a provider-neutral LLM-like runtime shell for RCL: prompt compilation, context management, provider contracts, semantic memory, tool-call formatting and self-check loops.',
});

export function normalizeLlmLikeRuntimeSpec(input = {}) {
  return {
    format: input.format ?? RCL_LLM_LIKE_RUNTIME_SPEC_FORMAT,
    id: input.id ?? DEFAULT_RCL_LLM_LIKE_RUNTIME_SPEC.id,
    version: input.version ?? RCL_LLM_LIKE_RUNTIME_VERSION,
    objective: input.objective ?? DEFAULT_RCL_LLM_LIKE_RUNTIME_SPEC.objective,
    providers: asArray(input.providers ?? input.providerContracts ?? defaultLlmProviderContracts()),
    useCases: asArray(input.useCases ?? input.sessions ?? defaultRuntimeUseCases()),
    promptPolicies: input.promptPolicies ?? defaultPromptPolicies(),
    thresholds: {
      minProviderContractCount: Number(input.thresholds?.minProviderContractCount ?? 8),
      minRuntimeSessionCount: Number(input.thresholds?.minRuntimeSessionCount ?? 8),
      minAverageRuntimeReadiness: Number(input.thresholds?.minAverageRuntimeReadiness ?? 0.9),
      requireNoApiDefault: input.thresholds?.requireNoApiDefault ?? true,
      requireNoLargeMemoryDefault: input.thresholds?.requireNoLargeMemoryDefault ?? true,
      requireSuperAgentAdapter: input.thresholds?.requireSuperAgentAdapter ?? true,
      requireDesktopExeHandoff: input.thresholds?.requireDesktopExeHandoff ?? true,
    },
    knowledgeRuntime: normalizeUniverseKnowledgeRuntimeSpec(input.knowledgeRuntime ?? {}),
    translator: normalizeUniversalSemanticTranslatorSpec(input.translator ?? {}),
    superAgentRuntime: normalizeSuperAgentRuntimeSpec(input.superAgentRuntime ?? {}),
    governance: normalizeRecursiveGovernanceKernelSpec(input.governance ?? {}),
  };
}

function compileProviderContract(provider, index) {
  const id = safeId(provider.id ?? provider.name ?? `provider_${index + 1}`, `provider_${index + 1}`);
  const contract = {
    format: RCL_LLM_PROVIDER_CONTRACT_FORMAT,
    id,
    name: provider.name ?? id,
    kind: provider.kind ?? 'generic_provider',
    capabilities: asArray(provider.capabilities),
    input: {
      messages: 'array<role, content>',
      context: 'object',
      tools: 'array<tool_schema>',
      runtimePolicy: 'object',
    },
    output: {
      text: 'string',
      toolCalls: 'array<tool_call>',
      confidence: 'number',
      evidenceRefs: 'array<evidence_ref>',
      diagnostics: 'object',
    },
    limits: {
      contextTokens: Number(provider.contextTokens ?? 8192),
      requiresApiKey: Boolean(provider.requiresApiKey),
      requiresNetwork: Boolean(provider.requiresNetwork),
      requiresLargeMemory: Boolean(provider.requiresLargeMemory),
      costClass: provider.costClass ?? 'unspecified',
    },
    governance: {
      defaultEnabled: Boolean(provider.defaultEnabled),
      humanApprovalRequiredForWriteActions: true,
      canModifyFilesByDefault: false,
      canExecuteShellByDefault: false,
      canUseNetworkByDefault: Boolean(provider.requiresNetwork && provider.defaultEnabled),
      secretPolicy: provider.requiresApiKey ? 'external_secret_required_never_embed' : 'no_secret_required',
    },
    purpose: provider.purpose ?? 'Generic RCL provider contract.',
  };
  const friction = (contract.limits.requiresApiKey ? 0.06 : 0) + (contract.limits.requiresNetwork ? 0.05 : 0) + (contract.limits.requiresLargeMemory ? 0.05 : 0);
  const scopeBonus = Math.min(contract.capabilities.length, 6) * 0.01;
  return {
    ...contract,
    readiness: round(clamp01(0.93 + scopeBonus - friction)),
    contractRoot: sha256(compact(contract)),
  };
}

function providerSupports(provider, capabilities) {
  return capabilities.every((cap) => provider.capabilities.includes(cap));
}

function chooseProviderForUseCase(useCase, providerContracts) {
  const required = asArray(useCase.requiredCapabilities);
  const enabled = providerContracts.filter((p) => p.governance.defaultEnabled && !p.limits.requiresApiKey && !p.limits.requiresNetwork && !p.limits.requiresLargeMemory);
  const exact = enabled.find((p) => providerSupports(p, required));
  if (exact) return exact;
  const ranked = enabled
    .map((p) => ({ p, score: required.filter((cap) => p.capabilities.includes(cap)).length + p.readiness }))
    .sort((a, b) => b.score - a.score);
  return ranked[0]?.p ?? providerContracts[0];
}

function buildPromptFrame(useCase, spec) {
  const id = `${safeId(useCase.id)}:prompt_frame`;
  return {
    id,
    systemFrame: spec.promptPolicies.systemFrame,
    developerFrame: spec.promptPolicies.developerFrame,
    intentFrame: useCase.intent,
    outputContract: spec.promptPolicies.outputContract,
    forbiddenDefaultBehaviors: spec.promptPolicies.forbiddenDefaultBehaviors,
    frameRoot: sha256(compact({ id, useCase, policies: spec.promptPolicies })),
  };
}

function buildContextWindow(useCase, provider) {
  const reservedForTools = Math.min(4096, Math.floor(provider.limits.contextTokens * 0.15));
  const reservedForMemory = Math.min(8192, Math.floor(provider.limits.contextTokens * 0.25));
  const reservedForUser = Math.max(1024, provider.limits.contextTokens - reservedForTools - reservedForMemory - 1024);
  return {
    id: `${safeId(useCase.id)}:context_window`,
    providerId: provider.id,
    maxTokens: provider.limits.contextTokens,
    layout: {
      system: 1024,
      userAndConversation: reservedForUser,
      semanticMemory: reservedForMemory,
      toolSchemas: reservedForTools,
    },
    compressionPolicy: 'semantic-summary-first-then-evidence-root',
    overflowPolicy: 'summarize-and-bind-evidence-root',
    contextRoot: sha256(compact({ useCase: useCase.id, provider: provider.id, reservedForTools, reservedForMemory, reservedForUser })),
  };
}

function buildSemanticMemoryBinding(useCase) {
  return {
    id: `${safeId(useCase.id)}:semantic_memory`,
    layers: [
      'short_term_message_summary',
      'project_context_capsule',
      'knowledge_object_references',
      'living_artifact_memory',
      'governance_state_snapshot',
    ],
    writePolicy: 'append-summary-and-root-not-raw-secret',
    retrievalPolicy: 'intent-keyed-local-first',
    memoryRoot: sha256(compact({ useCase: useCase.id, layers: useCase.requiredCapabilities })),
  };
}

function buildToolCallFormatter(useCase) {
  const writeSensitive = String(useCase.privacyClass ?? '').includes('write') || String(useCase.privacyClass ?? '').includes('authority');
  return {
    id: `${safeId(useCase.id)}:tool_formatter`,
    schemaMode: 'json-tool-call-envelope',
    dryRunDefault: true,
    writeActionRequiresHumanAuthority: true,
    shellExecutionAllowedByDefault: false,
    fileWriteAllowedByDefault: false,
    networkAllowedByDefault: false,
    extraGates: writeSensitive ? ['human_final_authority', 'simulation_before_action', 'rollback_plan'] : ['audit_log'],
    formatterRoot: sha256(compact({ useCase: useCase.id, writeSensitive })),
  };
}

function buildOutputDecoder(useCase) {
  return {
    id: `${safeId(useCase.id)}:output_decoder`,
    decoders: [
      'natural_language_answer',
      'structured_json_result',
      'tool_call_plan',
      'evidence_reference_list',
      'self_check_diagnostics',
    ],
    defaultOutput: useCase.mode === 'tool_plan' ? 'tool_call_plan' : 'natural_language_answer',
    hallucinationGuard: 'require_evidence_refs_or_mark_as_inference',
    decoderRoot: sha256(compact({ useCase: useCase.id, mode: useCase.mode })),
  };
}

function buildSelfCheckLoop(useCase, provider) {
  const base = provider.readiness;
  const privacyPenalty = String(useCase.privacyClass ?? '').includes('authority') ? 0.03 : 0.01;
  const selfCheckScore = round(clamp01(base - privacyPenalty + 0.03));
  return {
    id: `${safeId(useCase.id)}:self_check`,
    checks: [
      'provider_contract_satisfied',
      'context_window_within_limit',
      'tool_calls_are_dry_run_by_default',
      'write_actions_are_human_gated',
      'output_matches_contract',
      'uncertainty_and_inference_labeled',
    ],
    selfCheckScore,
    repairPolicy: 'retry-with-smaller-context-or-rule-provider-fallback',
    selfCheckRoot: sha256(compact({ useCase: useCase.id, provider: provider.id, selfCheckScore })),
  };
}

function buildRuntimeSession(useCase, index, spec, providerContracts) {
  const id = safeId(useCase.id ?? `runtime_session_${index + 1}`, `runtime_session_${index + 1}`);
  const provider = chooseProviderForUseCase(useCase, providerContracts);
  const promptFrame = buildPromptFrame(useCase, spec);
  const contextWindow = buildContextWindow(useCase, provider);
  const semanticMemory = buildSemanticMemoryBinding(useCase);
  const toolFormatter = buildToolCallFormatter(useCase);
  const outputDecoder = buildOutputDecoder(useCase);
  const selfCheck = buildSelfCheckLoop(useCase, provider);
  const readiness = round(average([
    provider.readiness,
    selfCheck.selfCheckScore,
    contextWindow.maxTokens >= 8192 ? 0.96 : 0.88,
    toolFormatter.writeActionRequiresHumanAuthority ? 1 : 0.8,
    outputDecoder.hallucinationGuard ? 0.98 : 0.85,
  ]));
  const session = {
    format: RCL_LLM_RUNTIME_SESSION_FORMAT,
    id,
    title: useCase.title ?? id,
    mode: useCase.mode ?? 'generic_llm_like_session',
    intent: useCase.intent ?? 'Run one RCL LLM-like runtime session.',
    privacyClass: useCase.privacyClass ?? 'local-first',
    requiredCapabilities: asArray(useCase.requiredCapabilities),
    selectedProviderId: provider.id,
    selectedProviderKind: provider.kind,
    promptFrame,
    contextWindow,
    semanticMemory,
    toolFormatter,
    outputDecoder,
    selfCheck,
    superAgentAdapter: {
      enabled: ['super_agent_command', 'desktop_exe_copilot', 'tool_plan', 'code_assist'].includes(useCase.mode),
      handoffMode: 'goal-or-tool-plan-envelope',
      humanFinalAuthority: true,
    },
    readiness,
  };
  return {
    ...session,
    sessionRoot: sha256(compact(session)),
  };
}

function buildProviderRouter(providerContracts, sessions) {
  const defaultProviders = providerContracts.filter((p) => p.governance.defaultEnabled);
  const defaultNeedsApi = defaultProviders.some((p) => p.limits.requiresApiKey || p.limits.requiresNetwork);
  const defaultNeedsLargeMemory = defaultProviders.some((p) => p.limits.requiresLargeMemory);
  const routes = sessions.map((s) => ({
    sessionId: s.id,
    mode: s.mode,
    selectedProviderId: s.selectedProviderId,
    fallbackProviderIds: providerContracts
      .filter((p) => p.governance.defaultEnabled && p.id !== s.selectedProviderId)
      .slice(0, 3)
      .map((p) => p.id),
  }));
  const router = {
    format: RCL_LLM_PROVIDER_ROUTER_FORMAT,
    id: 'rcl_llm_like_provider_router_v0_78_1',
    defaultRoutingPolicy: 'local-first-no-api-no-large-memory',
    defaultNeedsApi,
    defaultNeedsLargeMemory,
    routes,
    cloudProviderSlots: providerContracts.filter((p) => p.limits.requiresApiKey || p.limits.requiresNetwork).map((p) => p.id),
    localModelSlots: providerContracts.filter((p) => p.kind === 'local_llm_server').map((p) => p.id),
  };
  return {
    ...router,
    routerRoot: sha256(compact(router)),
  };
}

function findDefaultCapableProviders(capability, providerContracts) {
  return providerContracts
    .filter((p) => p.governance.defaultEnabled && !p.limits.requiresApiKey && !p.limits.requiresNetwork && !p.limits.requiresLargeMemory && p.capabilities.includes(capability))
    .sort((a, b) => b.readiness - a.readiness);
}

export function buildCompositeProviderRouter(providerContracts, sessions) {
  const defaultProviders = providerContracts.filter((p) => p.governance.defaultEnabled);
  const defaultNeedsApi = defaultProviders.some((p) => p.limits.requiresApiKey || p.limits.requiresNetwork);
  const defaultNeedsLargeMemory = defaultProviders.some((p) => p.limits.requiresLargeMemory);
  const routes = sessions.map((session) => {
    const capabilities = asArray(session.requiredCapabilities);
    const capabilityBindings = capabilities.map((capability) => {
      const candidates = findDefaultCapableProviders(capability, providerContracts);
      const selected = candidates[0] ?? providerContracts.find((p) => p.id === session.selectedProviderId) ?? providerContracts[0];
      return {
        capability,
        selectedProviderId: selected?.id ?? null,
        selectedProviderKind: selected?.kind ?? null,
        fallbackProviderIds: candidates.slice(1, 4).map((p) => p.id),
        covered: Boolean(selected?.capabilities?.includes(capability)),
      };
    });
    const augmentationProviderIds = [
      'semantic_memory_provider',
      'rule_provider',
      ...(String(session.privacyClass ?? '').includes('write') || ['tool_plan', 'desktop_exe_copilot', 'super_agent_command'].includes(session.mode) ? ['tool_call_provider'] : []),
    ].filter((id) => providerContracts.some((p) => p.id === id && p.governance.defaultEnabled && !p.limits.requiresApiKey && !p.limits.requiresNetwork && !p.limits.requiresLargeMemory));
    const selectedProviderIds = [...new Set([...capabilityBindings.map((b) => b.selectedProviderId).filter(Boolean), ...augmentationProviderIds])];
    const coveredCapabilities = capabilityBindings.filter((b) => b.covered).length;
    const coverage = capabilities.length ? round(coveredCapabilities / capabilities.length) : 1;
    const route = {
      sessionId: session.id,
      mode: session.mode,
      privacyClass: session.privacyClass,
      routeKind: selectedProviderIds.length > 1 ? 'composite' : 'single-provider-compatible',
      selectedProviderIds,
      capabilityBindings,
      mergePolicy: selectedProviderIds.length > 1
        ? 'capability-sharded-merge-with-rule-provider-self-check'
        : 'single-provider-fast-path-with-composite-compatible-envelope',
      executionOrder: [
        'prompt_compile',
        'semantic_memory_prefetch',
        'capability_sharded_provider_calls',
        'tool_call_dry_run_merge',
        'rule_provider_self_check',
        'output_decode',
        'evidence_and_diagnostics_attach',
      ],
      defaultNeedsApi: selectedProviderIds.some((id) => providerContracts.find((p) => p.id === id)?.limits.requiresApiKey),
      defaultNeedsLargeMemory: selectedProviderIds.some((id) => providerContracts.find((p) => p.id === id)?.limits.requiresLargeMemory),
      coverage,
    };
    return {
      ...route,
      routeRoot: sha256(compact(route)),
    };
  });
  const coverageScores = routes.map((r) => r.coverage);
  const multiProviderSessionCount = routes.filter((r) => r.selectedProviderIds.length > 1).length;
  const router = {
    format: RCL_COMPOSITE_PROVIDER_ROUTER_FORMAT,
    id: 'rcl_composite_provider_router_v0_78_1',
    defaultRoutingPolicy: 'local-first-composite-provider-routing-no-api-no-large-memory',
    defaultNeedsApi,
    defaultNeedsLargeMemory,
    routes,
    routeCount: routes.length,
    multiProviderSessionCount,
    averageCapabilityCoverage: round(average(coverageScores)),
    compositeRoutingEstablished: routes.length > 0 && average(coverageScores) >= 0.95 && multiProviderSessionCount > 0 && !defaultNeedsApi && !defaultNeedsLargeMemory,
    desktopExeBrainRoutingReady: routes.some((r) => r.mode === 'desktop_exe_copilot' && r.selectedProviderIds.length >= 3 && r.coverage === 1),
    routerRoot: sha256(compact({ routes: routes.map((r) => r.routeRoot), defaultNeedsApi, defaultNeedsLargeMemory })),
  };
  return router;
}

function buildDesktopExeHandoff(spec, sessions, providerRouter) {
  const handoff = {
    format: RCL_LLM_DESKTOP_HANDOFF_FORMAT,
    id: 'rcl_llm_like_runtime_to_desktop_exe_handoff_v0_78_1',
    ready: true,
    target: 'v0.79 RCL Desktop EXE App Shell（RCL 桌面 EXE 应用壳）',
    requiredSurfaces: [
      'Provider Registry（能力提供者注册表）',
      'Prompt Workspace（提示词工作区）',
      'Context Window Inspector（上下文窗口检查器）',
      'Semantic Memory Panel（语义记忆面板）',
      'Tool Call Preview（工具调用预览）',
      'Self-check Diagnostics（自检诊断）',
      'Super Agent Command Console（超级智能体指挥台）',
    ],
    defaultRuntimeNeedsApi: providerRouter.defaultNeedsApi,
    defaultRuntimeNeedsLargeMemory: providerRouter.defaultNeedsLargeMemory,
    recommendedPackaging: [
      { name: 'Electron', reason: 'Fastest path for Node.js runtime, file workspace, CLI bridge and Windows EXE packaging.' },
      { name: 'Tauri', reason: 'Smaller shell later if Rust bridge and WebView packaging are preferred.' },
      { name: 'pkg/nexe CLI EXE', reason: 'Minimal command-line EXE fallback without full desktop UI.' },
    ],
    firstMilestone: {
      version: 'v0.79',
      module: 'RCL Desktop EXE App Shell',
      acceptance: ['provider-registry-view', 'chat-command-panel', 'tool-call-preview', 'local-workspace-open', 'portable-exe-packaging-plan'],
    },
  };
  return {
    ...handoff,
    handoffRoot: sha256(compact({ specId: spec.id, sessionRoots: sessions.map((s) => s.sessionRoot), providerRouter })),
  };
}

export function buildLlmLikeRuntimeSpec(overrides = {}) {
  return normalizeLlmLikeRuntimeSpec(overrides);
}

export function compileLlmLikeRuntime(input = {}) {
  const spec = normalizeLlmLikeRuntimeSpec(input);
  const providerContracts = spec.providers.map((p, index) => compileProviderContract(p, index));
  const knowledgeBundle = runUniverseKnowledgeRuntime(spec.knowledgeRuntime);
  const superAgentBundle = runSuperAgentRuntime(spec.superAgentRuntime);
  const translatorBundle = runUniversalSemanticTranslator(spec.translator);
  const governanceBundle = runRecursiveGovernanceKernel(spec.governance);
  const sessions = spec.useCases.map((useCase, index) => buildRuntimeSession(useCase, index, spec, providerContracts));
  const providerRouter = buildProviderRouter(providerContracts, sessions);
  const compositeProviderRouter = buildCompositeProviderRouter(providerContracts, sessions);
  const desktopExeHandoff = buildDesktopExeHandoff(spec, sessions, providerRouter);
  const defaultEnabled = providerContracts.filter((p) => p.governance.defaultEnabled);
  const apiRequiredForDefaultRun = providerRouter.defaultNeedsApi;
  const largeMemoryRequiredForDefaultRun = providerRouter.defaultNeedsLargeMemory;
  const averageRuntimeReadiness = round(average(sessions.map((s) => s.readiness)));
  const averageProviderReadiness = round(average(providerContracts.map((p) => p.readiness)));
  const result = {
    format: RCL_LLM_LIKE_RUNTIME_RESULT_FORMAT,
    version: RCL_LLM_LIKE_RUNTIME_VERSION,
    llmLikeRuntimeEstablished:
      providerContracts.length >= spec.thresholds.minProviderContractCount &&
      sessions.length >= spec.thresholds.minRuntimeSessionCount &&
      averageRuntimeReadiness >= spec.thresholds.minAverageRuntimeReadiness &&
      (!spec.thresholds.requireNoApiDefault || !apiRequiredForDefaultRun) &&
      (!spec.thresholds.requireNoLargeMemoryDefault || !largeMemoryRequiredForDefaultRun) &&
      (!spec.thresholds.requireSuperAgentAdapter || sessions.some((s) => s.superAgentAdapter.enabled)) &&
      (!spec.thresholds.requireDesktopExeHandoff || desktopExeHandoff.ready),
    providerContractCount: providerContracts.length,
    defaultProviderCount: defaultEnabled.length,
    runtimeSessionCount: sessions.length,
    promptCompilerCount: sessions.length,
    contextWindowManagerCount: sessions.length,
    semanticMemoryLayerCount: sessions.length,
    toolCallFormatterCount: sessions.length,
    outputDecoderCount: sessions.length,
    selfCheckLoopCount: sessions.length,
    providerRouterCount: 1,
    compositeProviderRouterCount: 1,
    compositeRouteCount: compositeProviderRouter.routeCount,
    multiProviderSessionCount: compositeProviderRouter.multiProviderSessionCount,
    averageCompositeCapabilityCoverage: compositeProviderRouter.averageCapabilityCoverage,
    apiRequiredForDefaultRun,
    largeMemoryRequiredForDefaultRun,
    mockProviderReady: providerContracts.some((p) => p.id === 'mock_llm_provider' && p.governance.defaultEnabled),
    ruleProviderReady: providerContracts.some((p) => p.id === 'rule_provider' && p.governance.defaultEnabled),
    rclKnowledgeProviderReady: providerContracts.some((p) => p.id === 'rcl_knowledge_provider' && p.governance.defaultEnabled),
    compositeProviderRoutingReady: compositeProviderRouter.compositeRoutingEstablished,
    desktopExeBrainRoutingReady: compositeProviderRouter.desktopExeBrainRoutingReady,
    cloudProviderContractReady: providerContracts.some((p) => p.kind === 'cloud_llm_api' && p.limits.requiresApiKey),
    ollamaProviderContractReady: providerContracts.some((p) => p.kind === 'local_llm_server' && p.limits.requiresLargeMemory),
    superAgentAdapterReady: sessions.some((s) => s.superAgentAdapter.enabled),
    governanceReady: governanceBundle.result?.recursiveGovernanceKernelEstablished ?? false,
    knowledgeRuntimeAdapterReady: knowledgeBundle.result?.universeKnowledgeRuntimeEstablished ?? false,
    translatorAdapterReady: translatorBundle.result?.universalSemanticTranslatorEstablished ?? false,
    desktopExeHandoffReady: desktopExeHandoff.ready,
    averageRuntimeReadiness,
    averageProviderReadiness,
    canonicalRoot: sha256(compact({ spec, providerContracts, sessions: sessions.map((s) => s.sessionRoot), providerRouter, compositeProviderRouter, desktopExeHandoff })),
  };
  return {
    ok: result.llmLikeRuntimeEstablished,
    format: RCL_LLM_LIKE_RUNTIME_BUNDLE_FORMAT,
    spec,
    providerContracts,
    sessions,
    providerRouter,
    compositeProviderRouter,
    desktopExeHandoff,
    upstream: {
      knowledgeRuntime: {
        ok: knowledgeBundle.ok,
        result: knowledgeBundle.result,
      },
      superAgentRuntime: {
        ok: superAgentBundle.ok,
        result: superAgentBundle.result,
      },
      translator: {
        ok: translatorBundle.ok,
        result: translatorBundle.result,
      },
      governance: {
        ok: governanceBundle.ok,
        result: governanceBundle.result,
      },
    },
    result,
  };
}

export function runLlmLikeRuntime(input = {}) {
  return compileLlmLikeRuntime(input);
}

export function runLlmLikeRuntimeDemo(overrides = {}) {
  return runLlmLikeRuntime(buildLlmLikeRuntimeSpec(overrides));
}

export function renderLlmLikeRuntimeRcl(specInput = {}) {
  const spec = normalizeLlmLikeRuntimeSpec(specInput);
  const lines = [];
  lines.push('reality llm_like_runtime_v0_78_1 {');
  lines.push(`  objective: ${JSON.stringify(spec.objective)}`);
  lines.push(`  provider_contracts: ${spec.providers.length}`);
  lines.push(`  runtime_sessions: ${spec.useCases.length}`);
  lines.push('  default_runtime: "no-api / no-large-memory / local-first"');
  lines.push('  requires: [provider_contract, composite_provider_router, prompt_compiler, context_window_manager, semantic_memory, tool_call_formatter, output_decoder, self_check_loop, super_agent_adapter]');
  lines.push('  next: "v0.79 RCL Desktop EXE App Shell"');
  lines.push('}');
  return lines.join('\n');
}

export function readLlmLikeRuntimeInput(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  if (!raw.trim()) return {};
  return JSON.parse(raw);
}

function makeProviderContractsMarkdown(contracts) {
  const lines = ['# RCL v0.78 Provider Contracts（能力提供者契约）', ''];
  lines.push('| Provider（提供者） | Kind（类型） | API? | Network? | Large Memory? | Default? | Capabilities（能力） |');
  lines.push('|---|---|---:|---:|---:|---:|---|');
  for (const p of contracts) {
    lines.push(`| ${p.name} | ${p.kind} | ${p.limits.requiresApiKey} | ${p.limits.requiresNetwork} | ${p.limits.requiresLargeMemory} | ${p.governance.defaultEnabled} | ${p.capabilities.join(', ')} |`);
  }
  lines.push('');
  lines.push('默认运行只启用 no-API / no-network / no-large-memory 的 Provider；OpenAI compatible 与 Ollama 只是预留契约槽，不参与默认测试。');
  return lines.join('\n');
}

function makeRuntimeSessionsMarkdown(sessions) {
  const lines = ['# RCL v0.78 Runtime Sessions（运行时会话）', ''];
  lines.push('| Session（会话） | Mode（模式） | Provider（提供者） | Readiness（就绪） | Human Gate（人类闸门） |');
  lines.push('|---|---|---|---:|---|');
  for (const s of sessions) {
    lines.push(`| ${s.title} | ${s.mode} | ${s.selectedProviderId} | ${s.readiness} | ${s.toolFormatter.writeActionRequiresHumanAuthority} |`);
  }
  lines.push('');
  lines.push('每个会话都包含 Prompt Frame（提示词帧）、Context Window（上下文窗口）、Semantic Memory（语义记忆）、Tool Formatter（工具格式化）、Output Decoder（输出解码）和 Self-check Loop（自检循环）。');
  return lines.join('\n');
}

function makeProviderRouterMarkdown(router) {
  const lines = ['# RCL v0.78 Provider Router（能力提供者路由器）', ''];
  lines.push(`Default Policy（默认策略）: **${router.defaultRoutingPolicy}**`);
  lines.push(`Default Needs API（默认需要 API）: **${router.defaultNeedsApi}**`);
  lines.push(`Default Needs Large Memory（默认需要大量内存）: **${router.defaultNeedsLargeMemory}**`);
  lines.push('');
  lines.push('| Session（会话） | Mode（模式） | Selected Provider（选中提供者） | Fallbacks（后备） |');
  lines.push('|---|---|---|---|');
  for (const route of router.routes) {
    lines.push(`| ${route.sessionId} | ${route.mode} | ${route.selectedProviderId} | ${route.fallbackProviderIds.join(', ')} |`);
  }
  return lines.join('\n');
}

function makeCompositeProviderRouterMarkdown(router) {
  const lines = ['# RCL v0.78.1 Composite Provider Router（复合能力提供者路由器）', ''];
  lines.push(`Composite Routing Established（复合路由成立）: **${router.compositeRoutingEstablished}**`);
  lines.push(`Default Needs API（默认需要 API）: **${router.defaultNeedsApi}**`);
  lines.push(`Default Needs Large Memory（默认需要大量内存）: **${router.defaultNeedsLargeMemory}**`);
  lines.push(`Average Capability Coverage（平均能力覆盖）: **${router.averageCapabilityCoverage}**`);
  lines.push(`Multi-provider Sessions（多 Provider 会话）: **${router.multiProviderSessionCount}**`);
  lines.push('');
  lines.push('| Session（会话） | Mode（模式） | Route（路由） | Providers（提供者） | Coverage（覆盖率） |');
  lines.push('|---|---|---|---|---:|');
  for (const route of router.routes) {
    lines.push(`| ${route.sessionId} | ${route.mode} | ${route.routeKind} | ${route.selectedProviderIds.join(', ')} | ${route.coverage} |`);
  }
  return lines.join('\n');
}

function makeDesktopHandoffMarkdown(handoff) {
  const lines = ['# RCL v0.79 Desktop EXE Handoff（桌面 EXE 交接）', ''];
  lines.push(`Ready（就绪）: **${handoff.ready}**`);
  lines.push(`Target（目标）: ${handoff.target}`);
  lines.push(`Default Runtime Needs API（默认运行需要 API）: **${handoff.defaultRuntimeNeedsApi}**`);
  lines.push(`Default Runtime Needs Large Memory（默认运行需要大量内存）: **${handoff.defaultRuntimeNeedsLargeMemory}**`);
  lines.push('');
  lines.push('## Required Surfaces（必要界面）');
  lines.push('');
  for (const s of handoff.requiredSurfaces) lines.push(`- ${s}`);
  lines.push('');
  lines.push('## Recommended Packaging（推荐打包）');
  lines.push('');
  for (const p of handoff.recommendedPackaging) lines.push(`- **${p.name}**: ${p.reason}`);
  lines.push('');
  lines.push(`Handoff Root（交接根）: \`${handoff.handoffRoot}\``);
  return lines.join('\n');
}

export function writeLlmLikeRuntimeReports(outDir, input = {}) {
  const bundle = runLlmLikeRuntime(input);
  const dir = path.resolve(outDir);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'llm-like-runtime-result.json'), `${JSON.stringify(bundle.result, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'llm-like-runtime-bundle.json'), `${JSON.stringify(bundle, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'provider-contracts.json'), `${JSON.stringify(bundle.providerContracts, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'provider-contracts.md'), `${makeProviderContractsMarkdown(bundle.providerContracts)}\n`);
  fs.writeFileSync(path.join(dir, 'runtime-sessions.json'), `${JSON.stringify(bundle.sessions, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'runtime-sessions.md'), `${makeRuntimeSessionsMarkdown(bundle.sessions)}\n`);
  fs.writeFileSync(path.join(dir, 'provider-router.json'), `${JSON.stringify(bundle.providerRouter, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'provider-router.md'), `${makeProviderRouterMarkdown(bundle.providerRouter)}\n`);
  fs.writeFileSync(path.join(dir, 'composite-provider-router.json'), `${JSON.stringify(bundle.compositeProviderRouter, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'composite-provider-router.md'), `${makeCompositeProviderRouterMarkdown(bundle.compositeProviderRouter)}\n`);
  fs.writeFileSync(path.join(dir, 'desktop-exe-handoff.json'), `${JSON.stringify(bundle.desktopExeHandoff, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'desktop-exe-handoff.md'), `${makeDesktopHandoffMarkdown(bundle.desktopExeHandoff)}\n`);
  fs.writeFileSync(path.join(dir, 'llm-like-runtime.rcl'), `${renderLlmLikeRuntimeRcl(bundle.spec)}\n`);
  fs.writeFileSync(path.join(dir, 'canonical-root.txt'), `${bundle.result.canonicalRoot}\n`);
  return {
    ok: bundle.ok,
    outDir: dir,
    result: bundle.result,
    files: [
      'llm-like-runtime-result.json',
      'llm-like-runtime-bundle.json',
      'provider-contracts.json',
      'provider-contracts.md',
      'runtime-sessions.json',
      'runtime-sessions.md',
      'provider-router.json',
      'provider-router.md',
      'composite-provider-router.json',
      'composite-provider-router.md',
      'desktop-exe-handoff.json',
      'desktop-exe-handoff.md',
      'llm-like-runtime.rcl',
      'canonical-root.txt',
    ],
  };
}
