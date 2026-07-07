import fs from 'node:fs';
import path from 'node:path';
import { sha256, clamp } from './reality-compiler-kernel.mjs';
import {
  runCivilizationTechnologyTreeCompiler,
  normalizeCivilizationTechTreeSpec,
  RCL_TECHNOLOGY_NODE_FORMAT,
} from './civilization-technology-tree-compiler.mjs';

export const RCL_RNCS_EXECUTION_BRIDGE_V2_VERSION = '0.63.0-alpha.1';
export const RCL_RNCS_EXECUTION_BRIDGE_V2_SPEC_FORMAT = 'rcl.rncs-execution-bridge-v2-spec.v0.63';
export const RCL_RNCS_EXECUTION_BRIDGE_V2_RESULT_FORMAT = 'rcl.rncs-execution-bridge-v2-result.v0.63';
export const RCL_RNCS_EXECUTION_BRIDGE_V2_BUNDLE_FORMAT = 'rcl.rncs-execution-bridge-v2-bundle.v0.63';
export const RCL_RNCS_EXECUTION_PLAN_FORMAT = 'rcl.rncs-execution-plan.v0.63';
export const RCL_RNCS_PROVIDER_CONTRACT_FORMAT = 'rcl.rncs-provider-contract.v0.63';
export const RCL_RNCS_EXECUTION_DOC_FORMAT = 'rcl.rncs-execution-bridge-v2-technical-document.v0.63';

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

function safeId(value, fallback = 'rncs-execution') {
  return String(value ?? fallback)
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 120) || fallback;
}

function defaultSourceTreeSpec() {
  return normalizeCivilizationTechTreeSpec({
    id: 'rcl_rncs_execution_bridge_v2_source_tree_v0',
    objective: 'Source v0.62 civilization technology tree for RNCS execution bridge conversion.',
  });
}

export const DEFAULT_RNCS_EXECUTION_BRIDGE_V2_SPEC = Object.freeze({
  format: RCL_RNCS_EXECUTION_BRIDGE_V2_SPEC_FORMAT,
  id: 'rcl_rncs_execution_bridge_v2_default_v0',
  version: RCL_RNCS_EXECUTION_BRIDGE_V2_VERSION,
  objective: 'Convert v0.62 civilization technology tree nodes into executable RNCS plans with Provider contracts, authorization boundaries, WAL, crash recovery and evidence writeback.',
  thresholds: {
    minExecutionPlans: 8,
    minAverageExecutionReadinessScore: 0.95,
    minProviderContractsPerPlan: 4,
    requireAuthorizationBoundaries: true,
    requireWalReplay: true,
    requireCrashRecovery: true,
    requireEvidenceWriteback: true,
    requireHumanAuthorityGate: true,
  },
  bridgePolicy: {
    mode: 'technology-tree-to-rncs-execution-plan',
    providerPolicy: 'every established technology node receives simulation, measurement, documentation and authority providers',
    authorizationPolicy: 'no irreversible physical-world action is executable without explicit human_authority approval',
    walPolicy: 'every plan step has deterministic prewrite, replay and rollback metadata',
    crashRecoveryPolicy: 'every plan has idempotent retry and safe-stop recovery state',
    evidencePolicy: 'every provider action writes evidence back to RCL evidence lineage and RNCS event log',
    nextHandoff: 'v0.64 Human Capability Feedback OS and v0.65 Reality Product Entry Runtime',
  },
  sourceCivilizationTechnologyTree: defaultSourceTreeSpec(),
});

export function normalizeRncsExecutionBridgeV2Spec(input = {}) {
  const base = JSON.parse(JSON.stringify(DEFAULT_RNCS_EXECUTION_BRIDGE_V2_SPEC));
  return {
    ...base,
    ...input,
    thresholds: { ...base.thresholds, ...(input.thresholds ?? {}) },
    bridgePolicy: { ...base.bridgePolicy, ...(input.bridgePolicy ?? {}) },
    sourceCivilizationTechnologyTree: normalizeCivilizationTechTreeSpec(input.sourceCivilizationTechnologyTree ?? base.sourceCivilizationTechnologyTree),
  };
}

function assertTechnologyNode(node) {
  if (!node || node.format !== RCL_TECHNOLOGY_NODE_FORMAT) {
    throw new TypeError('buildRncsExecutionPlan expects a v0.62 technology node');
  }
}

function providerKindsFor(node) {
  const domain = String(node.domain ?? 'unknown');
  const common = ['simulation_provider', 'evidence_store_provider', 'human_authority_provider', 'documentation_provider'];
  if (domain === 'substrate-material-memory') return ['material_lab_provider', 'spectral_sensor_provider', ...common];
  if (domain === 'field-coupling-control') return ['field_simulation_provider', 'constraint_array_provider', ...common];
  if (domain === 'record-interface-readout') return ['record_index_provider', 'observer_readout_provider', ...common];
  if (domain === 'runtime-evidence-infrastructure') return ['notebook_runtime_provider', 'audit_ledger_provider', ...common];
  return ['prototype_runtime_provider', 'measurement_provider', ...common];
}

function capabilityActionsFor(node) {
  const caps = ensureArray(node.capability);
  const base = [
    'resolve technology-node evidence lineage',
    'instantiate isolated RNCS execution candidate',
    'bind providers under explicit authorization',
    'prewrite WAL before each state transition',
    'run reversible dry-run simulation',
    'collect evidence frame and write back lineage',
  ];
  const capActions = caps.slice(0, 3).map(cap => `validate capability: ${cap}`);
  return [...base.slice(0, 2), ...capActions, ...base.slice(2)];
}

export function buildProviderContract(node, kind, index = 0) {
  assertTechnologyNode(node);
  const contractId = `provider-contract:${safeId(node.id)}:${safeId(kind)}`;
  const risk = kind.includes('authority') ? 'human-gated' : kind.includes('lab') || kind.includes('sensor') ? 'measurement-bounded' : 'sandbox-bounded';
  const permissions = kind.includes('human_authority')
    ? ['approve', 'reject', 'pause', 'rollback']
    : kind.includes('evidence') || kind.includes('ledger')
      ? ['append-only-write', 'read-lineage', 'hash-verify']
      : ['dry-run', 'measure', 'report'];
  const contract = {
    format: RCL_RNCS_PROVIDER_CONTRACT_FORMAT,
    version: RCL_RNCS_EXECUTION_BRIDGE_V2_VERSION,
    id: contractId,
    technologyNodeId: node.id,
    providerKind: kind,
    displayName: `${kind} for ${node.translation}`,
    permissions,
    denialPolicy: 'default-deny unless granted by execution plan authorization boundary',
    sideEffectClass: kind.includes('human_authority') || kind.includes('evidence') ? 'administrative-evidence' : 'reversible-sandbox-or-measurement',
    riskClass: risk,
    inputContract: ['technology_node', 'evidence_lineage', 'execution_step', 'authorization_token'],
    outputContract: ['provider_event', 'evidence_frame', 'status', 'hash'],
    failureModes: ['provider_unavailable', 'authorization_denied', 'measurement_inconclusive', 'evidence_write_failed'],
    recoveryMode: 'idempotent retry; otherwise safe-stop and replay from previous WAL checkpoint',
    order: index,
    contractRoot: sha256(JSON.stringify({ contractId, node: node.hashes?.nodeRoot, kind, permissions, risk })),
  };
  return contract;
}

export function buildAuthorizationBoundary(node, providerContracts = []) {
  assertTechnologyNode(node);
  const boundary = {
    id: `auth-boundary:${safeId(node.id)}`,
    technologyNodeId: node.id,
    humanAuthorityRequired: true,
    reversibleOnlyByDefault: true,
    allowedProviderKinds: providerContracts.map(p => p.providerKind),
    forbiddenActions: [
      'unapproved irreversible physical-world action',
      'secret exfiltration',
      'unsafe biological manipulation',
      'unbounded energy release',
      'unlogged provider mutation',
    ],
    approvalStates: ['draft', 'dry_run_approved', 'execution_approved', 'paused', 'rolled_back'],
    escalationPolicy: 'pause on uncertainty; request human review; never self-approve irreversible action',
  };
  return { ...boundary, boundaryRoot: sha256(JSON.stringify(boundary)) };
}

function buildWalEntries(node, actions = []) {
  return actions.map((action, index) => {
    const entry = {
      seq: index + 1,
      action,
      preStateHash: sha256(`${node.id}:pre:${index}:${action}`),
      intendedStateHash: sha256(`${node.id}:post:${index}:${action}`),
      rollbackPointer: index === 0 ? 'initial-state' : `wal:${index}`,
      replaySafe: true,
      evidenceRequired: true,
    };
    return { ...entry, walHash: sha256(JSON.stringify(entry)) };
  });
}

function buildCrashRecoveryPlan(node, walEntries = []) {
  const plan = {
    id: `recovery:${safeId(node.id)}`,
    technologyNodeId: node.id,
    checkpointCount: walEntries.length,
    safeStopState: 'paused-awaiting-human-authority',
    replayStrategy: 'replay deterministic WAL entries until last verified evidence frame; skip unverified side effects',
    rollbackStrategy: 'rollback to previous checkpoint, preserve evidence ledger, mark failed action as candidate-failed',
    crashClasses: ['process_crash', 'provider_timeout', 'partial_evidence_write', 'authorization_revoked'],
  };
  return { ...plan, recoveryRoot: sha256(JSON.stringify(plan)) };
}

function buildEvidenceWriteback(node, providerContracts = [], walEntries = []) {
  const writeback = {
    id: `evidence-writeback:${safeId(node.id)}`,
    technologyNodeId: node.id,
    targetLedgers: ['rcl.evidence-lineage', 'rncs.event-log', 'rncs.provider-audit-log', 'rncs.failure-ledger'],
    sourceEvidenceRoot: node.hashes?.evidenceRoot,
    providerContractRoots: providerContracts.map(p => p.contractRoot),
    walRoots: walEntries.map(w => w.walHash),
    writePolicy: 'append-only; content-addressed; replay-verifiable',
  };
  return { ...writeback, writebackRoot: sha256(JSON.stringify(writeback)) };
}

export function buildRncsExecutionPlan(node, index = 0) {
  assertTechnologyNode(node);
  const providerContracts = providerKindsFor(node).map((kind, i) => buildProviderContract(node, kind, i));
  const authorizationBoundary = buildAuthorizationBoundary(node, providerContracts);
  const actions = capabilityActionsFor(node);
  const walEntries = buildWalEntries(node, actions);
  const crashRecoveryPlan = buildCrashRecoveryPlan(node, walEntries);
  const evidenceWriteback = buildEvidenceWriteback(node, providerContracts, walEntries);
  const readinessScore = round(average([
    node.established ? 1 : 0,
    node.evidenceLineage?.replayHash ? 1 : 0,
    providerContracts.length >= 4 ? 1 : 0,
    authorizationBoundary.humanAuthorityRequired ? 1 : 0,
    walEntries.every(e => e.replaySafe && e.evidenceRequired) ? 1 : 0,
    crashRecoveryPlan.checkpointCount === walEntries.length ? 1 : 0,
    evidenceWriteback.targetLedgers.length >= 4 ? 1 : 0,
  ]));
  const plan = {
    format: RCL_RNCS_EXECUTION_PLAN_FORMAT,
    version: RCL_RNCS_EXECUTION_BRIDGE_V2_VERSION,
    id: `rncs-plan:${safeId(node.id)}`,
    order: index,
    technologyNodeId: node.id,
    technologyNodeName: node.name,
    translation: node.translation,
    domain: node.domain,
    stage: node.stage,
    objective: `Convert ${node.translation} from civilization technology node into an RNCS executable, reversible and evidence-backed plan.`,
    actions,
    providerContracts,
    authorizationBoundary,
    walEntries,
    crashRecoveryPlan,
    evidenceWriteback,
    executionMode: 'dry-run-first; human-authorized execution only',
    status: readinessScore >= 0.95 ? 'execution-ready-candidate' : 'execution-draft',
    readinessScore,
    established: readinessScore >= 0.95,
    hashes: {
      planRoot: sha256(JSON.stringify({ node: node.hashes?.nodeRoot, actions, providers: providerContracts.map(p => p.contractRoot), wal: walEntries.map(w => w.walHash) })),
      authorizationRoot: authorizationBoundary.boundaryRoot,
      recoveryRoot: crashRecoveryPlan.recoveryRoot,
      evidenceWritebackRoot: evidenceWriteback.writebackRoot,
    },
  };
  return plan;
}

export function buildRncsExecutionBridgeGraph(plans = []) {
  const edges = [];
  for (const plan of plans) {
    for (const provider of plan.providerContracts) edges.push({ from: plan.id, to: provider.id, kind: 'binds-provider', hash: sha256(`${plan.id}->${provider.id}`) });
    edges.push({ from: plan.authorizationBoundary.id, to: plan.id, kind: 'authorizes', hash: sha256(`${plan.authorizationBoundary.id}->${plan.id}`) });
    edges.push({ from: plan.id, to: plan.evidenceWriteback.id, kind: 'writes-evidence', hash: sha256(`${plan.id}->${plan.evidenceWriteback.id}`) });
  }
  return {
    format: 'rcl.rncs-execution-bridge-graph.v0.63',
    planCount: plans.length,
    providerContractCount: plans.reduce((sum, p) => sum + p.providerContracts.length, 0),
    edgeCount: edges.length,
    edges,
    graphRoot: sha256(JSON.stringify(edges)),
  };
}

function scoreRncsExecutionBridge(plans, bridgeGraph, thresholds) {
  const planCountScore = clamp(plans.length / Number(thresholds.minExecutionPlans ?? 8));
  const averageExecutionReadinessScore = round(average(plans.map(p => p.readinessScore)));
  const providerContractScore = plans.every(p => p.providerContracts.length >= Number(thresholds.minProviderContractsPerPlan ?? 4)) ? 1 : 0;
  const authorizationScore = plans.every(p => p.authorizationBoundary?.humanAuthorityRequired && p.authorizationBoundary?.reversibleOnlyByDefault) ? 1 : 0;
  const walReplayScore = plans.every(p => p.walEntries.length >= p.actions.length && p.walEntries.every(e => e.replaySafe)) ? 1 : 0;
  const crashRecoveryScore = plans.every(p => p.crashRecoveryPlan?.checkpointCount === p.walEntries.length) ? 1 : 0;
  const evidenceWritebackScore = plans.every(p => p.evidenceWriteback?.targetLedgers?.length >= 4) ? 1 : 0;
  const bridgeGraphScore = bridgeGraph.edgeCount >= plans.length * 6 ? 1 : 0;
  const averageBridgeScore = round(average([planCountScore, averageExecutionReadinessScore, providerContractScore, authorizationScore, walReplayScore, crashRecoveryScore, evidenceWritebackScore, bridgeGraphScore]));
  return {
    planCountScore: round(planCountScore),
    averageExecutionReadinessScore,
    providerContractScore,
    authorizationBoundaryScore: authorizationScore,
    walReplayScore,
    crashRecoveryScore,
    evidenceWritebackScore,
    bridgeGraphScore,
    averageBridgeScore,
    established: averageBridgeScore >= 0.95,
  };
}

export function evaluateRncsExecutionBridgeV2(input = {}) {
  const spec = normalizeRncsExecutionBridgeV2Spec(input);
  const sourceBundle = runCivilizationTechnologyTreeCompiler(spec.sourceCivilizationTechnologyTree);
  const nodes = ensureArray(sourceBundle.nodes).filter(node => node.established);
  const plans = nodes.map((node, i) => buildRncsExecutionPlan(node, i));
  const bridgeGraph = buildRncsExecutionBridgeGraph(plans);
  const bridgeScores = scoreRncsExecutionBridge(plans, bridgeGraph, spec.thresholds);
  const providerContracts = plans.flatMap(p => p.providerContracts);
  const result = {
    format: RCL_RNCS_EXECUTION_BRIDGE_V2_RESULT_FORMAT,
    version: RCL_RNCS_EXECUTION_BRIDGE_V2_VERSION,
    rncsExecutionBridgeV2Established: bridgeScores.established
      && plans.length >= Number(spec.thresholds.minExecutionPlans ?? 8)
      && plans.every(p => p.established),
    sourceTechnologyTreeEstablished: sourceBundle.civilizationTechnologyTreeEstablished,
    executionPlanCount: plans.length,
    establishedExecutionPlanCount: plans.filter(p => p.established).length,
    providerContractCount: providerContracts.length,
    authorizationBoundaryCount: plans.filter(p => p.authorizationBoundary).length,
    walEntryCount: plans.reduce((sum, p) => sum + p.walEntries.length, 0),
    crashRecoveryPlanCount: plans.filter(p => p.crashRecoveryPlan).length,
    evidenceWritebackCount: plans.filter(p => p.evidenceWriteback).length,
    derivedExecutionHandoffReady: true,
    rncsProviderContractsReady: bridgeScores.providerContractScore === 1,
    walReplayReady: bridgeScores.walReplayScore === 1,
    crashRecoveryReady: bridgeScores.crashRecoveryScore === 1,
    evidenceWritebackReady: bridgeScores.evidenceWritebackScore === 1,
    scores: bridgeScores,
    thresholds: spec.thresholds,
    canonicalRoot: rncsExecutionBridgeV2CanonicalRoot({ spec, scores: bridgeScores, planRoots: plans.map(p => p.hashes.planRoot), graphRoot: bridgeGraph.graphRoot }),
  };
  return {
    ok: result.rncsExecutionBridgeV2Established,
    spec,
    sourceBundle,
    plans,
    providerContracts,
    bridgeGraph,
    bridgeScores,
    result,
  };
}

export function renderRncsExecutionPlanDocument(plan) {
  const lines = [];
  lines.push(`# ${plan.technologyNodeName}（${plan.translation}）RNCS 执行计划`);
  lines.push('');
  lines.push(`**格式**：${RCL_RNCS_EXECUTION_DOC_FORMAT}`);
  lines.push(`**Execution Plan（执行计划）**：${plan.id}`);
  lines.push(`**Readiness Score（执行就绪分）**：${plan.readinessScore}`);
  lines.push(`**Execution Mode（执行模式）**：${plan.executionMode}`);
  lines.push('');
  lines.push('## 1. Objective（目标）');
  lines.push(plan.objective);
  lines.push('');
  lines.push('## 2. Provider Contracts（能力提供者契约）');
  for (const provider of plan.providerContracts) {
    lines.push(`- **${provider.providerKind}**：permissions=${provider.permissions.join(', ')}；risk=${provider.riskClass}`);
  }
  lines.push('');
  lines.push('## 3. Authorization Boundary（授权边界）');
  lines.push(`- humanAuthorityRequired：${plan.authorizationBoundary.humanAuthorityRequired}`);
  lines.push(`- reversibleOnlyByDefault：${plan.authorizationBoundary.reversibleOnlyByDefault}`);
  lines.push(`- forbiddenActions：${plan.authorizationBoundary.forbiddenActions.join(' / ')}`);
  lines.push('');
  lines.push('## 4. WAL / Replay（预写日志 / 重放）');
  lines.push(`- WAL entries：${plan.walEntries.length}`);
  lines.push(`- Replay strategy：${plan.crashRecoveryPlan.replayStrategy}`);
  lines.push(`- Rollback strategy：${plan.crashRecoveryPlan.rollbackStrategy}`);
  lines.push('');
  lines.push('## 5. Evidence Writeback（证据回写）');
  lines.push(`- targetLedgers：${plan.evidenceWriteback.targetLedgers.join(' / ')}`);
  lines.push(`- writePolicy：${plan.evidenceWriteback.writePolicy}`);
  lines.push('');
  return {
    format: RCL_RNCS_EXECUTION_DOC_FORMAT,
    id: `${plan.id}:technical-document`,
    title: `${plan.technologyNodeName}（${plan.translation}）RNCS 执行计划`,
    markdown: lines.join('\n'),
  };
}

export function renderRncsExecutionBridgeV2Document(bundle) {
  const lines = [];
  lines.push('# RCL RNCS Execution Bridge v2（RCL RNCS 执行桥 v2）');
  lines.push('');
  lines.push(`**格式**：${RCL_RNCS_EXECUTION_DOC_FORMAT}`);
  lines.push(`**Established（成立）**：${bundle.result.rncsExecutionBridgeV2Established}`);
  lines.push(`**Execution Plans（执行计划数）**：${bundle.result.executionPlanCount}`);
  lines.push(`**Provider Contracts（能力提供者契约数）**：${bundle.result.providerContractCount}`);
  lines.push(`**WAL Entries（预写日志条目数）**：${bundle.result.walEntryCount}`);
  lines.push('');
  lines.push('## 1. Bridge Role（桥接角色）');
  lines.push('v0.63 将 v0.62 文明技术树节点转译为 RNCS 可执行计划，使候选文明技术不再停留在图谱层，而具备 Provider 契约、授权边界、WAL、恢复路径与证据回写。');
  lines.push('');
  lines.push('## 2. Execution Plans（执行计划）');
  for (const plan of bundle.plans) {
    lines.push(`- ${plan.id}：${plan.translation}；score=${plan.readinessScore}`);
  }
  lines.push('');
  lines.push('## 3. Safety Contract（安全契约）');
  lines.push('- 所有计划默认 dry-run-first（先干跑）。');
  lines.push('- 所有不可逆现实动作都要求 human_authority_provider（人类权威提供者）明确授权。');
  lines.push('- 所有状态变化都必须先写 WAL（预写日志）并可重放。');
  lines.push('- 所有结果都写回 RCL evidence lineage（证据链）与 RNCS event log（事件日志）。');
  lines.push('');
  lines.push('## 4. Next Handoff（下一步交接）');
  lines.push('- v0.64 Human Capability Feedback OS（人类能力反馈操作系统）');
  lines.push('- v0.65 Reality Product Entry Runtime（现实产品入口运行时）');
  lines.push('');
  return {
    format: RCL_RNCS_EXECUTION_DOC_FORMAT,
    id: 'rncs-execution-bridge-v2:technical-document',
    title: 'RCL RNCS Execution Bridge v2（RCL RNCS 执行桥 v2）',
    markdown: lines.join('\n'),
  };
}

export function runRncsExecutionBridgeV2(input = {}) {
  const evaluation = evaluateRncsExecutionBridgeV2(input);
  const tempBundle = {
    result: evaluation.result,
    plans: evaluation.plans,
  };
  const bridgeDocument = renderRncsExecutionBridgeV2Document(tempBundle);
  const planDocuments = evaluation.plans.map(renderRncsExecutionPlanDocument);
  return {
    format: RCL_RNCS_EXECUTION_BRIDGE_V2_BUNDLE_FORMAT,
    version: RCL_RNCS_EXECUTION_BRIDGE_V2_VERSION,
    ok: evaluation.ok,
    rncsExecutionBridgeV2Established: evaluation.result.rncsExecutionBridgeV2Established,
    result: evaluation.result,
    plans: evaluation.plans,
    providerContracts: evaluation.providerContracts,
    bridgeGraph: evaluation.bridgeGraph,
    bridgeScores: evaluation.bridgeScores,
    documents: [bridgeDocument, ...planDocuments],
    canonicalRoot: rncsExecutionBridgeV2CanonicalRoot({ result: evaluation.result, planRoots: evaluation.plans.map(p => p.hashes.planRoot), graphRoot: evaluation.bridgeGraph.graphRoot }),
  };
}

export function buildRncsExecutionBridgeV2Spec(overrides = {}) {
  return normalizeRncsExecutionBridgeV2Spec(overrides);
}

export function renderRncsExecutionBridgeV2Rcl(input = {}) {
  const spec = normalizeRncsExecutionBridgeV2Spec(input);
  const bundle = runRncsExecutionBridgeV2(spec);
  return `reality RncsExecutionBridgeV2 {\n  version = "${RCL_RNCS_EXECUTION_BRIDGE_V2_VERSION}"\n  source = "v0.62 civilization technology tree"\n  execution_plans = ${bundle.result.executionPlanCount}\n  provider_contracts = ${bundle.result.providerContractCount}\n  wal_entries = ${bundle.result.walEntryCount}\n  validation.established : Truth = ${bundle.result.rncsExecutionBridgeV2Established}\n  validation.average_bridge_score = ${bundle.bridgeScores.averageBridgeScore}\n  handoff.next = "v0.64 Human Capability Feedback OS"\n}\n`;
}

export function runRncsExecutionBridgeV2Demo() {
  const bundle = runRncsExecutionBridgeV2();
  return {
    ok: bundle.ok,
    version: RCL_RNCS_EXECUTION_BRIDGE_V2_VERSION,
    rncsExecutionBridgeV2Established: bundle.rncsExecutionBridgeV2Established,
    executionPlanCount: bundle.result.executionPlanCount,
    providerContractCount: bundle.result.providerContractCount,
    authorizationBoundaryCount: bundle.result.authorizationBoundaryCount,
    walEntryCount: bundle.result.walEntryCount,
    evidenceWritebackReady: bundle.result.evidenceWritebackReady,
    averageBridgeScore: bundle.bridgeScores.averageBridgeScore,
    canonicalRoot: bundle.canonicalRoot,
  };
}

export function readRncsExecutionBridgeV2Input(filePath) {
  return normalizeRncsExecutionBridgeV2Spec(JSON.parse(fs.readFileSync(filePath, 'utf8')));
}

export function writeRncsExecutionBridgeV2Reports(outputDir, input = {}) {
  const spec = normalizeRncsExecutionBridgeV2Spec(input);
  const bundle = runRncsExecutionBridgeV2(spec);
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, 'rncs-execution-bridge-v2-spec.json'), `${JSON.stringify(spec, null, 2)}\n`);
  fs.writeFileSync(path.join(outputDir, 'rncs-execution-bridge-v2-result.json'), `${JSON.stringify(bundle.result, null, 2)}\n`);
  fs.writeFileSync(path.join(outputDir, 'rncs-execution-plans.json'), `${JSON.stringify(bundle.plans, null, 2)}\n`);
  fs.writeFileSync(path.join(outputDir, 'provider-contracts.json'), `${JSON.stringify(bundle.providerContracts, null, 2)}\n`);
  fs.writeFileSync(path.join(outputDir, 'bridge-graph.json'), `${JSON.stringify(bundle.bridgeGraph, null, 2)}\n`);
  fs.writeFileSync(path.join(outputDir, 'rncs-execution-bridge-v2.rcl'), `${renderRncsExecutionBridgeV2Rcl(spec)}\n`);
  const docDir = path.join(outputDir, 'rncs-execution-docs');
  fs.mkdirSync(docDir, { recursive: true });
  for (const doc of bundle.documents) {
    fs.writeFileSync(path.join(docDir, `${safeId(doc.id)}.md`), `${doc.markdown}\n`);
  }
  return {
    ok: bundle.ok,
    version: RCL_RNCS_EXECUTION_BRIDGE_V2_VERSION,
    outputDir,
    rncsExecutionBridgeV2Established: bundle.rncsExecutionBridgeV2Established,
    executionPlanCount: bundle.result.executionPlanCount,
    providerContractCount: bundle.result.providerContractCount,
    walEntryCount: bundle.result.walEntryCount,
    documentCount: bundle.documents.length,
    canonicalRoot: bundle.canonicalRoot,
  };
}

export function rncsExecutionBridgeV2CanonicalRoot(payload = {}) {
  return sha256(JSON.stringify(payload));
}
