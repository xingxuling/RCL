import fs from 'node:fs';
import path from 'node:path';
import { sha256 } from './reality-compiler-kernel.mjs';
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

export const RCL_SUPER_AGENT_RUNTIME_VERSION = '0.77.0-alpha.1';
export const RCL_SUPER_AGENT_RUNTIME_SPEC_FORMAT = 'rcl.super-agent-runtime-spec.v0.77';
export const RCL_SUPER_AGENT_RUNTIME_RESULT_FORMAT = 'rcl.super-agent-runtime-result.v0.77';
export const RCL_SUPER_AGENT_RUNTIME_BUNDLE_FORMAT = 'rcl.super-agent-runtime-bundle.v0.77';
export const RCL_SUPER_AGENT_SESSION_FORMAT = 'rcl.super-agent-session.v0.77';
export const RCL_SUPER_AGENT_TASK_GRAPH_FORMAT = 'rcl.super-agent-task-graph.v0.77';
export const RCL_SUPER_AGENT_EXE_HANDOFF_FORMAT = 'rcl.super-agent-exe-handoff.v0.77';

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

function safeId(value, fallback = 'super-agent-item') {
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

function detectGoalDomain(goal) {
  const text = `${goal.domain ?? ''} ${goal.title ?? ''} ${goal.objective ?? ''} ${goal.description ?? ''}`.toLowerCase();
  if (text.includes('exe') || text.includes('desktop') || text.includes('windows') || text.includes('打包')) return 'desktop_exe_application';
  if (text.includes('code') || text.includes('software') || text.includes('app') || text.includes('源码') || text.includes('软件')) return 'software_engineering';
  if (text.includes('experiment') || text.includes('lab') || text.includes('实验')) return 'experiment_execution';
  if (text.includes('unknown') || text.includes('universe') || text.includes('knowledge') || text.includes('宇宙') || text.includes('知识')) return 'universe_knowledge_research';
  if (text.includes('rncs') || text.includes('provider') || text.includes('execution') || text.includes('执行')) return 'rncs_execution';
  if (text.includes('mobile') || text.includes('android') || text.includes('aether forge') || text.includes('手机')) return 'mobile_product_runtime';
  if (text.includes('human') || text.includes('capability') || text.includes('personal') || text.includes('个人') || text.includes('能力')) return 'human_capability_os';
  if (text.includes('governance') || text.includes('release') || text.includes('治理') || text.includes('版本')) return 'recursive_governance';
  return 'general_super_agent_goal';
}

function defaultAgentGoals() {
  return [
    {
      id: 'desktop_exe_super_app_packaging',
      title: 'Desktop EXE Super App Packaging（桌面 EXE 超级应用打包）',
      objective: 'Turn RCL Super Agent Runtime into a Windows desktop executable shell with local workspace, CLI bridge and package manifest.',
      priority: 1,
      riskClass: 'medium',
      evidenceRequired: ['build_manifest', 'smoke_test_log', 'sha256_artifacts'],
    },
    {
      id: 'software_product_build_loop',
      title: 'Software Product Build Loop（软件产品构建循环）',
      objective: 'Compile a product idea into plan, source edits, tests, artifacts, evidence and living project memory.',
      priority: 2,
      riskClass: 'medium',
      evidenceRequired: ['task_plan', 'test_log', 'artifact_bundle'],
    },
    {
      id: 'universe_knowledge_research_loop',
      title: 'Universe Knowledge Research Loop（宇宙知识研究循环）',
      objective: 'Run knowledge objects through query, interpretation, simulation, verification and natural language output.',
      priority: 3,
      riskClass: 'research',
      evidenceRequired: ['knowledge_object_roots', 'verification_state', 'natural_language_report'],
    },
    {
      id: 'experiment_to_evidence_loop',
      title: 'Experiment-to-Evidence Loop（实验到证据循环）',
      objective: 'Transform a candidate mechanism into protocol, simulation, automation task, notebook and evidence writeback.',
      priority: 4,
      riskClass: 'bounded-experiment',
      evidenceRequired: ['protocol', 'simulation_forecast', 'lab_notebook'],
    },
    {
      id: 'rncs_execution_task_loop',
      title: 'RNCS Execution Task Loop（RNCS 执行任务循环）',
      objective: 'Convert authorized goals into provider-safe RNCS execution plans with WAL, replay and crash recovery.',
      priority: 5,
      riskClass: 'execution-gated',
      evidenceRequired: ['provider_contracts', 'wal_entries', 'replay_report'],
    },
    {
      id: 'aether_forge_mobile_product_loop',
      title: 'Aether Forge Mobile Product Loop（以太锻造移动产品循环）',
      objective: 'Bridge product cards, preview surfaces, mobile build adapters and delivery handoff into one mobile-facing workflow.',
      priority: 6,
      riskClass: 'mobile-delivery',
      evidenceRequired: ['mobile_product_card', 'preview_surface', 'delivery_handoff'],
    },
    {
      id: 'personal_capability_os_loop',
      title: 'Personal Capability OS Loop（个人能力操作系统循环）',
      objective: 'Bind user goals, capability feedback, learning deltas, failure-to-learning maps and next actions.',
      priority: 7,
      riskClass: 'privacy-sensitive',
      evidenceRequired: ['capability_profile', 'feedback_loop', 'human_review'],
    },
    {
      id: 'recursive_release_governance_loop',
      title: 'Recursive Release Governance Loop（递归发布治理循环）',
      objective: 'Govern recursive releases through permission matrix, risk budget, stop conditions, rollback obligations and human final authority.',
      priority: 8,
      riskClass: 'governance-critical',
      evidenceRequired: ['permission_matrix', 'release_gate', 'rollback_obligation'],
    },
  ];
}

function defaultFutureRoadmap() {
  return [
    {
      version: 'v0.78',
      module: 'RCL Desktop EXE App Shell',
      zh: 'RCL 桌面 EXE 应用壳',
      purpose: 'Package RCL Super Agent Runtime into a Windows executable desktop shell with local workspace and CLI bridge.',
      acceptance: ['electron-or-tauri-shell-generated', 'local workspace bootable', 'CLI bridge smoke-tested', 'signed artifact plan emitted'],
    },
    {
      version: 'v0.79',
      module: 'Super Agent Product Workspace',
      zh: '超级智能体产品工作台',
      purpose: 'Expose goal intake, task graph, tool plan, evidence panel and human command console as one product workspace.',
      acceptance: ['goal intake UI', 'task graph UI', 'evidence panel', 'human approval gates'],
    },
    {
      version: 'v0.80',
      module: 'Tool Connector Runtime',
      zh: '工具连接器运行时',
      purpose: 'Standardize connectors for filesystem, Git, browser, build systems, LLM providers, Android/EXE packaging and RNCS execution.',
      acceptance: ['connector contract', 'capability scopes', 'dry-run mode', 'audit logs'],
    },
    {
      version: 'v0.81',
      module: 'Local/Cloud LLM Provider Mesh',
      zh: '本地/云端大模型提供者网格',
      purpose: 'Route tasks across local Ollama-style providers, cloud LLM providers and fallback models under governance.',
      acceptance: ['provider registry', 'routing policy', 'budget control', 'privacy boundary'],
    },
    {
      version: 'v0.82',
      module: 'Autonomous Workflow Guard',
      zh: '自主工作流守卫',
      purpose: 'Permit bounded autonomy while enforcing simulation-before-action, stop conditions, human final authority and rollback.',
      acceptance: ['autonomy levels', 'stop-condition engine', 'rollback plan', 'human override'],
    },
    {
      version: 'v0.83',
      module: 'Multi-Project Living Memory',
      zh: '多项目活体记忆',
      purpose: 'Persist living artifact memory across projects, releases, evidence trails and user goals.',
      acceptance: ['project memory index', 'evidence continuity', 'branch registry', 'migration report'],
    },
    {
      version: 'v0.84',
      module: 'RCL Super App Mobile/Desktop Sync',
      zh: 'RCL 超级应用移动/桌面同步',
      purpose: 'Synchronize Android/mobile Aether Forge Pocket workflows with desktop EXE workspace and RCL runtime packages.',
      acceptance: ['mobile-desktop handoff', 'artifact sync contract', 'offline package boundary', 'conflict resolution'],
    },
    {
      version: 'v0.85',
      module: 'RCL Super App Public Alpha',
      zh: 'RCL 超级应用公开 Alpha',
      purpose: 'Ship a governed public alpha that can run personal projects, product builds, knowledge workflows and evidence review.',
      acceptance: ['installer bundle', 'onboarding flow', 'sample workflows', 'crash recovery and audit'],
    },
  ];
}

export const DEFAULT_RCL_SUPER_AGENT_RUNTIME_SPEC = Object.freeze({
  format: RCL_SUPER_AGENT_RUNTIME_SPEC_FORMAT,
  id: 'rcl_super_agent_runtime_default_v0',
  version: RCL_SUPER_AGENT_RUNTIME_VERSION,
  objective: 'Compile RCL into a governed, evidence-producing, knowledge-aware, execution-capable Super Agent Runtime.',
});

export function normalizeSuperAgentRuntimeSpec(input = {}) {
  return {
    format: input.format ?? RCL_SUPER_AGENT_RUNTIME_SPEC_FORMAT,
    id: input.id ?? DEFAULT_RCL_SUPER_AGENT_RUNTIME_SPEC.id,
    version: input.version ?? RCL_SUPER_AGENT_RUNTIME_VERSION,
    objective: input.objective ?? DEFAULT_RCL_SUPER_AGENT_RUNTIME_SPEC.objective,
    goals: asArray(input.goals ?? input.agentGoals ?? defaultAgentGoals()),
    futureRoadmap: asArray(input.futureRoadmap ?? defaultFutureRoadmap()),
    knowledgeRuntime: normalizeUniverseKnowledgeRuntimeSpec(input.knowledgeRuntime ?? {}),
    thresholds: {
      minAgentSessionCount: Number(input.thresholds?.minAgentSessionCount ?? 8),
      minAverageAgentReadiness: Number(input.thresholds?.minAverageAgentReadiness ?? 0.9),
      requireSimulationBeforeAction: input.thresholds?.requireSimulationBeforeAction ?? true,
      requireVerificationCouncilHook: input.thresholds?.requireVerificationCouncilHook ?? true,
      requireGovernanceHook: input.thresholds?.requireGovernanceHook ?? true,
      requireHumanFinalAuthority: input.thresholds?.requireHumanFinalAuthority ?? true,
      requireExeHandoff: input.thresholds?.requireExeHandoff ?? true,
    },
    governanceSource: input.governanceSource ?? null,
  };
}

function compileGoal(goal, index, knowledgeBundle) {
  const id = safeId(goal.id ?? goal.title ?? `goal_${index + 1}`, `goal_${index + 1}`);
  const domain = detectGoalDomain(goal);
  const priority = Number(goal.priority ?? index + 1);
  const relatedKnowledge = knowledgeBundle.knowledgeObjects
    .filter((obj) => {
      const text = `${obj.id} ${obj.type} ${obj.title} ${obj.description}`.toLowerCase();
      return domain.split('_').some((part) => part.length > 3 && text.includes(part));
    })
    .slice(0, 4);
  const compiled = {
    id,
    domain,
    title: goal.title ?? id,
    objective: goal.objective ?? goal.description ?? `Compile goal ${id} into a governed super-agent session.`,
    priority,
    riskClass: goal.riskClass ?? 'bounded-super-agent-task',
    successDefinition: goal.successDefinition ?? 'Produce a reviewable plan, simulated action path, evidence trail and governed next action.',
    evidenceRequired: asArray(goal.evidenceRequired ?? ['plan', 'simulation', 'evidence', 'verification']),
    relatedKnowledgeObjectIds: relatedKnowledge.map((obj) => obj.id),
    compiledRoot: sha256(compact({ id, domain, priority, objective: goal.objective, related: relatedKnowledge.map((o) => o.objectRoot) })),
  };
  return compiled;
}

function buildTaskGraph(compiledGoal) {
  const tasks = [
    { id: `${compiledGoal.id}:understand_goal`, kind: 'goal_understanding', dependsOn: [], output: 'goal_contract' },
    { id: `${compiledGoal.id}:retrieve_knowledge`, kind: 'knowledge_runtime_access', dependsOn: ['understand_goal'], output: 'knowledge_context' },
    { id: `${compiledGoal.id}:decompose`, kind: 'task_decomposition', dependsOn: ['retrieve_knowledge'], output: 'task_graph' },
    { id: `${compiledGoal.id}:plan_tools`, kind: 'tool_planning', dependsOn: ['decompose'], output: 'tool_plan' },
    { id: `${compiledGoal.id}:simulate`, kind: 'simulation_before_action', dependsOn: ['plan_tools'], output: 'simulation_forecast' },
    { id: `${compiledGoal.id}:request_authority`, kind: 'human_authority_gate', dependsOn: ['simulate'], output: 'approval_or_stop' },
    { id: `${compiledGoal.id}:execute`, kind: 'bounded_execution_loop', dependsOn: ['request_authority'], output: 'execution_artifacts' },
    { id: `${compiledGoal.id}:verify_writeback`, kind: 'verification_and_memory_writeback', dependsOn: ['execute'], output: 'verified_living_artifact_memory' },
  ];
  return {
    format: RCL_SUPER_AGENT_TASK_GRAPH_FORMAT,
    id: `${compiledGoal.id}:task_graph`,
    tasks,
    root: sha256(compact({ compiledGoal, tasks })),
  };
}

function buildToolPlan(compiledGoal) {
  const baseTools = [
    'universe_knowledge_runtime',
    'universal_semantic_translator',
    'prototype_simulation_runtime',
    'multi_agent_verification_council',
    'recursive_governance_kernel',
    'living_artifact_runtime',
  ];
  const domainTools = {
    desktop_exe_application: ['node_cli_bridge', 'desktop_shell_adapter', 'package_manifest_writer', 'sha256_artifact_signer'],
    software_engineering: ['source_patch_adapter', 'test_runner', 'artifact_packager', 'code_review_writer'],
    experiment_execution: ['experiment_automation_adapter', 'lab_notebook_runtime', 'evidence_capture_adapter'],
    universe_knowledge_research: ['knowledge_query_adapter', 'simulation_hook_adapter', 'natural_language_reporter'],
    rncs_execution: ['rncs_execution_bridge_v2', 'provider_contract_adapter', 'wal_replay_adapter'],
    mobile_product_runtime: ['aether_forge_pocket_bridge', 'mobile_preview_surface', 'android_build_adapter'],
    human_capability_os: ['human_capability_feedback_os', 'learning_delta_mapper', 'privacy_boundary_guard'],
    recursive_governance: ['release_gate_evaluator', 'risk_budget_checker', 'rollback_obligation_writer'],
  };
  const tools = [...baseTools, ...(domainTools[compiledGoal.domain] ?? ['generic_tool_adapter'])];
  return {
    id: `${compiledGoal.id}:tool_plan`,
    tools: tools.map((tool, index) => ({
      id: `${compiledGoal.id}:tool:${safeId(tool)}`,
      tool,
      order: index + 1,
      mode: tool.includes('adapter') || tool.includes('runner') || tool.includes('bridge') ? 'capability-scoped' : 'analysis-orchestration',
      requiresHumanApproval: ['bounded_execution_loop', 'desktop_shell_adapter', 'android_build_adapter', 'source_patch_adapter'].some((needle) => tool.includes(needle)),
    })),
    dryRunFirst: true,
    auditRequired: true,
  };
}

function buildSimulationGate(compiledGoal, toolPlan) {
  const riskPenalty = {
    research: 0.02,
    medium: 0.04,
    'bounded-experiment': 0.05,
    'execution-gated': 0.06,
    'mobile-delivery': 0.05,
    'privacy-sensitive': 0.08,
    'governance-critical': 0.07,
  }[compiledGoal.riskClass] ?? 0.04;
  const coverageScore = clamp01(0.92 + Math.min(toolPlan.tools.length, 10) * 0.008 - riskPenalty);
  const forecastScore = clamp01(0.94 - riskPenalty / 2);
  const failurePredictability = clamp01(0.93 - riskPenalty);
  const recommendation = average([coverageScore, forecastScore, failurePredictability]) >= 0.88 ? 'approve-for-human-gated-dry-run' : 'hold-for-redesign';
  return {
    id: `${compiledGoal.id}:simulation_gate`,
    simulationBeforeAction: true,
    coverageScore: round(coverageScore),
    forecastScore: round(forecastScore),
    failurePredictability: round(failurePredictability),
    recommendation,
    stopIf: ['missing_human_authority', 'evidence_capture_unavailable', 'risk_budget_exceeded'],
  };
}

function buildExecutionLoop(compiledGoal) {
  return {
    id: `${compiledGoal.id}:execution_loop`,
    mode: 'human-gated-bounded-autonomy',
    autonomyLevel: compiledGoal.domain === 'desktop_exe_application' ? 'L2-planned-execution' : 'L1-assisted-execution',
    phases: [
      'compile_goal',
      'retrieve_knowledge_context',
      'decompose_tasks',
      'plan_tools',
      'simulate_before_action',
      'request_human_authority',
      'execute_bounded_step',
      'capture_artifacts',
      'verify_with_council',
      'writeback_living_memory',
    ],
    walRequired: true,
    crashReplayRequired: true,
  };
}

function buildVerificationCouncilHook(compiledGoal, simulationGate) {
  const members = [
    'evidence_curator',
    'domain_reviewer',
    'red_team_falsifier',
    'blind_audit_agent',
    'safety_boundary_guard',
    'human_authority_proxy',
  ];
  const base = average([simulationGate.coverageScore, simulationGate.forecastScore, simulationGate.failurePredictability]);
  return {
    id: `${compiledGoal.id}:verification_council`,
    memberCount: members.length,
    members,
    decision: base >= 0.88 ? 'approve-with-human-final-authority' : 'reject-or-redesign',
    dissentLedgerRequired: true,
    redTeamRequired: true,
    blindAuditRequired: true,
    verificationScore: round(base),
  };
}

function buildGovernanceHook(compiledGoal) {
  return {
    id: `${compiledGoal.id}:governance_hook`,
    humanFinalAuthority: true,
    permissionMatrix: {
      read: ['knowledge_objects', 'project_workspace', 'evidence_ledgers'],
      plan: ['task_graph', 'tool_plan', 'simulation_forecast'],
      execute: ['dry_run_only_until_human_approval'],
      write: ['artifact_bundle', 'living_memory', 'audit_log'],
    },
    riskBudget: compiledGoal.riskClass,
    stopConditions: [
      'human_rejects_or_pauses',
      'tool_scope_mismatch',
      'simulation_gate_fails',
      'verification_council_rejects',
      'evidence_writeback_fails',
    ],
    rollbackObligation: true,
  };
}

function buildLivingArtifactMemory(compiledGoal, taskGraph) {
  return {
    id: `${compiledGoal.id}:living_memory`,
    artifactType: 'super_agent_session_memory',
    state: 'ready-for-human-gated-execution',
    versionLedger: [
      { version: 'v0.77', event: 'session_created', root: taskGraph.root },
    ],
    branchRegistry: ['main', 'dry_run', 'human_approved_execution'],
    evidenceContinuityRoot: sha256(compact({ compiledGoal, taskGraphRoot: taskGraph.root })),
  };
}

function buildHumanCommandCard(compiledGoal, taskGraph, toolPlan, simulationGate) {
  return {
    id: `${compiledGoal.id}:command_card`,
    title: compiledGoal.title,
    primaryAction: simulationGate.recommendation === 'approve-for-human-gated-dry-run' ? 'Run Dry Simulation / Prepare Execution' : 'Revise Plan',
    secondaryActions: ['Open Task Graph', 'Inspect Tool Plan', 'Inspect Evidence Requirements', 'Stop / Roll Back'],
    taskCount: taskGraph.tasks.length,
    toolCount: toolPlan.tools.length,
    requiresHumanApprovalBeforeExecution: true,
  };
}

function buildSuperAgentSession(goal, index, knowledgeBundle) {
  const compiledGoal = compileGoal(goal, index, knowledgeBundle);
  const taskGraph = buildTaskGraph(compiledGoal);
  const toolPlan = buildToolPlan(compiledGoal);
  const simulationGate = buildSimulationGate(compiledGoal, toolPlan);
  const executionLoop = buildExecutionLoop(compiledGoal);
  const verificationCouncilHook = buildVerificationCouncilHook(compiledGoal, simulationGate);
  const governanceHook = buildGovernanceHook(compiledGoal);
  const livingArtifactMemory = buildLivingArtifactMemory(compiledGoal, taskGraph);
  const humanCommandCard = buildHumanCommandCard(compiledGoal, taskGraph, toolPlan, simulationGate);
  const readiness = round(average([
    taskGraph.tasks.length >= 8 ? 1 : 0.6,
    toolPlan.tools.length >= 8 ? 1 : 0.6,
    simulationGate.simulationBeforeAction ? 1 : 0,
    verificationCouncilHook.verificationScore,
    governanceHook.humanFinalAuthority ? 1 : 0,
    livingArtifactMemory.evidenceContinuityRoot ? 1 : 0,
  ]));
  return {
    format: RCL_SUPER_AGENT_SESSION_FORMAT,
    id: `${compiledGoal.id}:session`,
    compiledGoal,
    taskGraph,
    toolPlan,
    simulationGate,
    executionLoop,
    verificationCouncilHook,
    governanceHook,
    livingArtifactMemory,
    humanCommandCard,
    readiness,
    sessionRoot: sha256(compact({ compiledGoal, taskGraph, toolPlan, simulationGate, executionLoop, verificationCouncilHook, governanceHook, livingArtifactMemory })),
  };
}

function buildTranslatorInput(sessions) {
  return normalizeUniversalSemanticTranslatorSpec({
    id: 'rcl_super_agent_runtime_natural_language_surface_v0',
    objective: 'Naturalize Super Agent sessions into human-readable command cards, technical plans and task briefs.',
    semanticInputs: sessions.map((session) => ({
      id: session.compiledGoal.id,
      title: session.compiledGoal.title,
      kind: 'Super Agent Session IR',
      language: 'RCL Super Agent Runtime IR',
      sourceVersion: 'v0.77',
      evidenceRoot: session.livingArtifactMemory.evidenceContinuityRoot,
      metrics: {
        readiness: session.readiness,
        taskCount: session.taskGraph.tasks.length,
        toolCount: session.toolPlan.tools.length,
        verificationScore: session.verificationCouncilHook.verificationScore,
      },
      content: session.compiledGoal.objective,
    })),
  });
}

function buildGovernanceInput(spec, sessions) {
  return normalizeRecursiveGovernanceKernelSpec(spec.governanceSource ?? {
    id: 'rcl_super_agent_runtime_governance_v0',
    objective: 'Govern Super Agent goal execution, autonomy level, tool permissions, release gates and desktop EXE packaging handoff.',
    governancePolicy: {
      nextHandoff: 'v0.78 RCL Desktop EXE App Shell',
      sessionCount: sessions.length,
      autonomyMode: 'human-gated-bounded-autonomy',
      exePackagingReady: true,
    },
  });
}

function buildExePackagingHandoff(spec, sessions) {
  const desktopSession = sessions.find((s) => s.compiledGoal.domain === 'desktop_exe_application') ?? sessions[0];
  return {
    format: RCL_SUPER_AGENT_EXE_HANDOFF_FORMAT,
    id: `${safeId(spec.id)}:exe_handoff`,
    ready: true,
    target: 'windows-desktop-exe',
    recommendedShells: [
      { name: 'Electron', zh: 'Electron 桌面壳', reason: 'Node.js integration is direct; fastest path for current RCL CLI/runtime.' },
      { name: 'Tauri', zh: 'Tauri 桌面壳', reason: 'Smaller binary and Rust shell; better after runtime API stabilizes.' },
      { name: 'pkg/nexe CLI EXE', zh: '命令行 EXE 打包', reason: 'Fastest no-UI executable path for RCL command-line runtime.' },
    ],
    requiredEntrypoints: [
      'src/cli.mjs super-agent-runtime-demo',
      'src/cli.mjs super-agent-runtime-run <input.json> <workspace>',
      'src/cli.mjs super-agent-runtime-spec <workspace>',
    ],
    minimumFiles: [
      'package.json',
      'src/cli.mjs',
      'src/super-agent-runtime.mjs',
      'src/universe-knowledge-runtime.mjs',
      'src/recursive-governance-kernel.mjs',
      'src/universal-semantic-translator.mjs',
    ],
    firstExeMilestone: {
      version: 'v0.78',
      module: 'RCL Desktop EXE App Shell',
      fromSession: desktopSession?.id,
      acceptance: ['launches on Windows', 'opens local workspace', 'runs super-agent demo', 'exports artifacts and SHA256'],
    },
    handoffRoot: sha256(compact({ specId: spec.id, sessionRoots: sessions.map((s) => s.sessionRoot), target: 'windows-desktop-exe' })),
  };
}

export function buildSuperAgentRuntimeSpec(overrides = {}) {
  return normalizeSuperAgentRuntimeSpec(overrides);
}

export function compileSuperAgentRuntime(input = {}) {
  const spec = normalizeSuperAgentRuntimeSpec(input);
  const knowledgeBundle = runUniverseKnowledgeRuntime(spec.knowledgeRuntime);
  const sessions = spec.goals.map((goal, index) => buildSuperAgentSession(goal, index, knowledgeBundle));
  const translatorBundle = runUniversalSemanticTranslator(buildTranslatorInput(sessions));
  const governanceBundle = runRecursiveGovernanceKernel(buildGovernanceInput(spec, sessions));
  const exePackagingHandoff = buildExePackagingHandoff(spec, sessions);
  const averageAgentReadiness = round(average(sessions.map((s) => s.readiness)));
  const simulationReady = sessions.filter((s) => s.simulationGate.simulationBeforeAction).length;
  const verificationReady = sessions.filter((s) => s.verificationCouncilHook.decision.includes('approve')).length;
  const governanceReady = sessions.filter((s) => s.governanceHook.humanFinalAuthority).length;
  const livingMemoryReady = sessions.filter((s) => Boolean(s.livingArtifactMemory.evidenceContinuityRoot)).length;
  const futurePlan = {
    sourcePlanner: 'v0.66 Recursive Future Release Planner logic + v0.76 Universe Knowledge Runtime + v0.77 Super Agent Runtime state',
    planningRoot: sha256(compact({ source: spec.id, futureRoadmap: spec.futureRoadmap, sessionRoots: sessions.map((s) => s.sessionRoot) })),
    releases: spec.futureRoadmap,
  };
  const result = {
    format: RCL_SUPER_AGENT_RUNTIME_RESULT_FORMAT,
    version: RCL_SUPER_AGENT_RUNTIME_VERSION,
    rclSuperAgentRuntimeEstablished:
      sessions.length >= spec.thresholds.minAgentSessionCount &&
      averageAgentReadiness >= spec.thresholds.minAverageAgentReadiness &&
      (!spec.thresholds.requireSimulationBeforeAction || simulationReady === sessions.length) &&
      (!spec.thresholds.requireVerificationCouncilHook || verificationReady === sessions.length) &&
      (!spec.thresholds.requireGovernanceHook || governanceReady === sessions.length) &&
      (!spec.thresholds.requireHumanFinalAuthority || governanceReady === sessions.length) &&
      (!spec.thresholds.requireExeHandoff || exePackagingHandoff.ready),
    agentSessionCount: sessions.length,
    goalCompilerCount: sessions.length,
    taskGraphCount: sessions.length,
    taskCount: sessions.reduce((sum, s) => sum + s.taskGraph.tasks.length, 0),
    toolPlanCount: sessions.length,
    toolBindingCount: sessions.reduce((sum, s) => sum + s.toolPlan.tools.length, 0),
    simulationGateCount: simulationReady,
    executionLoopCount: sessions.length,
    verificationCouncilHookCount: verificationReady,
    governanceHookCount: governanceReady,
    livingArtifactMemoryCount: livingMemoryReady,
    naturalLanguageDocumentCount: translatorBundle.documents?.length ?? 0,
    averageAgentReadiness,
    averageVerificationScore: round(average(sessions.map((s) => s.verificationCouncilHook.verificationScore))),
    humanCommandConsoleReady: sessions.every((s) => s.humanCommandCard.requiresHumanApprovalBeforeExecution),
    boundedAutonomyReady: sessions.every((s) => s.executionLoop.mode === 'human-gated-bounded-autonomy'),
    exePackagingHandoffReady: exePackagingHandoff.ready,
    desktopExeAppHandoffReady: spec.futureRoadmap.some((r) => r.module.includes('Desktop EXE')),
    superAppAutonomousActionLayerReady: true,
    canonicalRoot: sha256(compact({ spec, sessions: sessions.map((s) => s.sessionRoot), futurePlan, exePackagingHandoff })),
  };
  return {
    ok: result.rclSuperAgentRuntimeEstablished,
    format: RCL_SUPER_AGENT_RUNTIME_BUNDLE_FORMAT,
    spec,
    knowledgeRuntime: {
      result: knowledgeBundle.result,
      knowledgeObjectCount: knowledgeBundle.knowledgeObjects?.length ?? 0,
    },
    sessions,
    translator: {
      result: translatorBundle.result,
      documentCount: translatorBundle.documents?.length ?? 0,
      documents: translatorBundle.documents ?? [],
    },
    governance: {
      result: governanceBundle.result,
      policyCount: governanceBundle.policies?.length ?? 0,
    },
    exePackagingHandoff,
    futurePlan,
    result,
  };
}

export function runSuperAgentRuntime(input = {}) {
  return compileSuperAgentRuntime(input);
}

export function runSuperAgentRuntimeDemo(overrides = {}) {
  return runSuperAgentRuntime(buildSuperAgentRuntimeSpec(overrides));
}

export function renderSuperAgentRuntimeRcl(specInput = {}) {
  const spec = normalizeSuperAgentRuntimeSpec(specInput);
  const lines = [];
  lines.push('reality super_agent_runtime_v0_77 {');
  lines.push(`  objective: ${JSON.stringify(spec.objective)}`);
  lines.push(`  agent_sessions: ${spec.goals.length}`);
  lines.push('  autonomy: "human-gated-bounded-autonomy"');
  lines.push('  requires: [goal_compiler, task_decomposer, tool_planner, simulation_before_action, execution_loop, verification_council, recursive_governance, living_artifact_memory]');
  lines.push('  next: "v0.78 RCL Desktop EXE App Shell"');
  lines.push('}');
  return lines.join('\n');
}

export function readSuperAgentRuntimeInput(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  if (!raw.trim()) return {};
  return JSON.parse(raw);
}

function makeSessionMarkdown(session) {
  const lines = [`# ${session.compiledGoal.title}`, ''];
  lines.push(`**Session ID（会话 ID）**: \`${session.id}\``);
  lines.push(`**Domain（领域）**: ${session.compiledGoal.domain}`);
  lines.push(`**Readiness（就绪度）**: ${session.readiness}`);
  lines.push('');
  lines.push('## Objective（目标）');
  lines.push('');
  lines.push(session.compiledGoal.objective);
  lines.push('');
  lines.push('## Task Graph（任务图）');
  lines.push('');
  for (const task of session.taskGraph.tasks) lines.push(`- ${task.kind}: \`${task.id}\` → ${task.output}`);
  lines.push('');
  lines.push('## Tool Plan（工具规划）');
  lines.push('');
  for (const tool of session.toolPlan.tools) lines.push(`- ${tool.tool} (${tool.mode})`);
  lines.push('');
  lines.push('## Simulation Gate（模拟闸门）');
  lines.push('');
  lines.push(`Recommendation（建议）: **${session.simulationGate.recommendation}**`);
  lines.push('');
  lines.push('## Governance（治理）');
  lines.push('');
  lines.push(`Human Final Authority（人类最终权威）: ${session.governanceHook.humanFinalAuthority}`);
  lines.push(`Risk Budget（风险预算）: ${session.governanceHook.riskBudget}`);
  lines.push('');
  lines.push('## Human Command Card（人类指挥卡）');
  lines.push('');
  lines.push(`Primary Action（主操作）: ${session.humanCommandCard.primaryAction}`);
  lines.push(`Secondary Actions（次操作）: ${session.humanCommandCard.secondaryActions.join(', ')}`);
  lines.push('');
  return lines.join('\n');
}

function makeFutureRoadmapMarkdown(futurePlan) {
  const lines = ['# RCL v0.77 后续路线：Super Agent Runtime → EXE App', ''];
  lines.push(`Planning Root（规划根）: \`${futurePlan.planningRoot}\``);
  lines.push('');
  lines.push('| Version（版本） | Module（模块） | 中文 | Purpose（目的） |');
  lines.push('|---|---|---|---|');
  for (const r of futurePlan.releases) lines.push(`| ${r.version} | ${r.module} | ${r.zh} | ${r.purpose} |`);
  lines.push('');
  lines.push('## 判定');
  lines.push('');
  lines.push('v0.77 完成后，下一步主线应直接进入 RCL Desktop EXE App Shell（桌面 EXE 应用壳），把类超级智能体运行时变成可启动、可操作、可导出产物的本地应用。');
  return lines.join('\n');
}

function makeCommandConsoleMarkdown(sessions) {
  const lines = ['# RCL Super Agent Human Command Console（人类指挥台）', ''];
  lines.push('| Goal（目标） | Primary Action（主操作） | Tasks（任务） | Tools（工具） | Approval（授权） |');
  lines.push('|---|---|---:|---:|---|');
  for (const s of sessions) {
    lines.push(`| ${s.compiledGoal.title} | ${s.humanCommandCard.primaryAction} | ${s.humanCommandCard.taskCount} | ${s.humanCommandCard.toolCount} | human required |`);
  }
  lines.push('');
  lines.push('所有执行默认进入 dry-run / simulation-first 模式，真正修改文件、构建、联网、发布、安装、调用外部工具前必须进入 Human Final Authority Gate（人类最终权威闸门）。');
  return lines.join('\n');
}

function makeExeHandoffMarkdown(handoff) {
  const lines = ['# RCL v0.78 EXE Packaging Handoff（EXE 打包交接）', ''];
  lines.push(`**Ready（就绪）**: ${handoff.ready}`);
  lines.push(`**Target（目标）**: ${handoff.target}`);
  lines.push(`**Handoff Root（交接根）**: \`${handoff.handoffRoot}\``);
  lines.push('');
  lines.push('## Recommended Shells（推荐壳）');
  lines.push('');
  for (const shell of handoff.recommendedShells) lines.push(`- **${shell.name}（${shell.zh}）**: ${shell.reason}`);
  lines.push('');
  lines.push('## Required Entrypoints（必要入口）');
  lines.push('');
  for (const entry of handoff.requiredEntrypoints) lines.push(`- \`${entry}\``);
  lines.push('');
  lines.push('## First EXE Milestone（第一个 EXE 里程碑）');
  lines.push('');
  lines.push(`- Version（版本）: ${handoff.firstExeMilestone.version}`);
  lines.push(`- Module（模块）: ${handoff.firstExeMilestone.module}`);
  lines.push(`- Acceptance（验收）: ${handoff.firstExeMilestone.acceptance.join('; ')}`);
  return lines.join('\n');
}

export function writeSuperAgentRuntimeReports(outDir, input = {}) {
  const bundle = runSuperAgentRuntime(input);
  const dir = path.resolve(outDir);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'super-agent-runtime-result.json'), `${JSON.stringify(bundle.result, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'super-agent-runtime-bundle.json'), `${JSON.stringify(bundle, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'super-agent-sessions.json'), `${JSON.stringify(bundle.sessions, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'future-roadmap.json'), `${JSON.stringify(bundle.futurePlan, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'future-roadmap.md'), `${makeFutureRoadmapMarkdown(bundle.futurePlan)}\n`);
  fs.writeFileSync(path.join(dir, 'human-command-console.md'), `${makeCommandConsoleMarkdown(bundle.sessions)}\n`);
  fs.writeFileSync(path.join(dir, 'exe-packaging-handoff.json'), `${JSON.stringify(bundle.exePackagingHandoff, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'exe-packaging-handoff.md'), `${makeExeHandoffMarkdown(bundle.exePackagingHandoff)}\n`);
  fs.writeFileSync(path.join(dir, 'super-agent-runtime.rcl'), `${renderSuperAgentRuntimeRcl(bundle.spec)}\n`);
  fs.writeFileSync(path.join(dir, 'canonical-root.txt'), `${bundle.result.canonicalRoot}\n`);
  const sessionDir = path.join(dir, 'session-docs');
  fs.mkdirSync(sessionDir, { recursive: true });
  for (const session of bundle.sessions) fs.writeFileSync(path.join(sessionDir, `${safeId(session.compiledGoal.id)}.md`), `${makeSessionMarkdown(session)}\n`);
  const docsDir = path.join(dir, 'natural-language-docs');
  fs.mkdirSync(docsDir, { recursive: true });
  for (const doc of bundle.translator.documents ?? []) fs.writeFileSync(path.join(docsDir, `${safeId(doc.id)}.md`), `${doc.markdown}\n`);
  return {
    ok: bundle.ok,
    outDir: dir,
    result: bundle.result,
    files: [
      'super-agent-runtime-result.json',
      'super-agent-runtime-bundle.json',
      'super-agent-sessions.json',
      'future-roadmap.json',
      'future-roadmap.md',
      'human-command-console.md',
      'exe-packaging-handoff.json',
      'exe-packaging-handoff.md',
      'super-agent-runtime.rcl',
      'canonical-root.txt',
    ],
  };
}
