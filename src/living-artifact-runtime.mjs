import fs from 'node:fs';
import path from 'node:path';
import { sha256 } from './reality-compiler-kernel.mjs';
import {
  runMultiAgentVerificationCouncil,
  normalizeMultiAgentVerificationCouncilSpec,
  RCL_MULTI_AGENT_VERIFICATION_COUNCIL_RESULT_FORMAT,
} from './multi-agent-verification-council.mjs';

export const RCL_LIVING_ARTIFACT_RUNTIME_VERSION = '0.73.0-alpha.1';
export const RCL_LIVING_ARTIFACT_RUNTIME_SPEC_FORMAT = 'rcl.living-artifact-runtime-spec.v0.73';
export const RCL_LIVING_ARTIFACT_RUNTIME_RESULT_FORMAT = 'rcl.living-artifact-runtime-result.v0.73';
export const RCL_LIVING_ARTIFACT_RUNTIME_BUNDLE_FORMAT = 'rcl.living-artifact-runtime-bundle.v0.73';
export const RCL_LIVING_ARTIFACT_FORMAT = 'rcl.living-artifact.v0.73';
export const RCL_LIVING_ARTIFACT_DOC_FORMAT = 'rcl.living-artifact-technical-document.v0.73';

function round(value, digits = 9) {
  const scale = 10 ** digits;
  return Math.round(Number(value) * scale) / scale;
}

function average(values) {
  const xs = values.map(Number).filter(Number.isFinite);
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

function safeId(value, fallback = 'living-artifact') {
  return String(value ?? fallback)
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._:-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 150) || fallback;
}

function defaultVerificationCouncilSpec() {
  return normalizeMultiAgentVerificationCouncilSpec({
    id: 'rcl_living_artifact_source_verification_council_v0',
    objective: 'Source v0.72 verification sessions for v0.73 living artifact runtime.',
    councilPolicy: {
      nextHandoff: 'v0.73 Living Artifact Runtime',
      defaultDecisionMode: 'fail-closed-weighted-consensus',
    },
  });
}

export const DEFAULT_LIVING_ARTIFACT_RUNTIME_SPEC = Object.freeze({
  format: RCL_LIVING_ARTIFACT_RUNTIME_SPEC_FORMAT,
  id: 'rcl_living_artifact_runtime_default_v0',
  version: RCL_LIVING_ARTIFACT_RUNTIME_VERSION,
  objective: 'Convert verified sessions into stateful living artifacts with versioned evidence, branch lifecycle, mutation policy and continuity ledgers.',
  thresholds: {
    minLivingArtifacts: 8,
    minAverageArtifactScore: 0.95,
    requireStateCapsule: true,
    requireVersionLedger: true,
    requireBranchRegistry: true,
    requireLifecyclePolicy: true,
    requireMutationContract: true,
    requireEvidenceContinuity: true,
    requireHumanReviewGate: true,
  },
  artifactPolicy: {
    mode: 'verification-session-to-living-artifact-runtime',
    lifecycleMode: 'stateful-versioned-evidence-bound-artifact',
    defaultState: 'active-living',
    branchMode: 'candidate-branch-with-replay-root',
    mutationMode: 'evidence-gated-human-authorized',
    nextHandoff: 'v0.74 Recursive Governance Kernel',
  },
  sourceMultiAgentVerificationCouncil: defaultVerificationCouncilSpec(),
});

export function normalizeLivingArtifactRuntimeSpec(input = {}) {
  const base = JSON.parse(JSON.stringify(DEFAULT_LIVING_ARTIFACT_RUNTIME_SPEC));
  return {
    ...base,
    ...input,
    format: input.format ?? base.format,
    version: input.version ?? RCL_LIVING_ARTIFACT_RUNTIME_VERSION,
    thresholds: { ...base.thresholds, ...(input.thresholds ?? {}) },
    artifactPolicy: { ...base.artifactPolicy, ...(input.artifactPolicy ?? {}) },
    sourceMultiAgentVerificationCouncil: input.sourceMultiAgentVerificationCouncil ?? base.sourceMultiAgentVerificationCouncil,
  };
}

function sourceCouncilFromSpec(sourceInput) {
  if (sourceInput?.ok && sourceInput?.result?.format === RCL_MULTI_AGENT_VERIFICATION_COUNCIL_RESULT_FORMAT) return sourceInput;
  return runMultiAgentVerificationCouncil(sourceInput ?? defaultVerificationCouncilSpec());
}

function buildStateCapsule(session) {
  const consensus = session.consensusDecision ?? {};
  const evidence = session.evidenceReview ?? {};
  const root = sha256(JSON.stringify({ sessionId: session.id, consensus, evidence }));
  return {
    id: `${session.id}:state-capsule`,
    state: consensus.outcome === 'approved-for-living-artifact-handoff' ? 'active-living' : 'quarantined',
    sourceSessionId: session.id,
    consensusOutcome: consensus.outcome,
    verificationScore: session.score ?? 0,
    evidenceRoot: evidence.evidenceRoot ?? sha256(session.id),
    capsuleRoot: root,
    continuityKey: sha256(`${session.id}:continuity:${root}`),
  };
}

function buildVersionLedger(session, capsule) {
  const sessionRoot = session.rootHash ?? sha256(JSON.stringify(session));
  return [
    {
      version: '0.73.0-artifact.0',
      event: 'artifact-born-from-verification-session',
      sourceSessionId: session.id,
      sessionRoot,
      evidenceRoot: capsule.evidenceRoot,
      capsuleRoot: capsule.capsuleRoot,
      createdBy: 'RCL Living Artifact Runtime v0.73',
    },
    {
      version: '0.73.0-artifact.1',
      event: 'initial-state-capsule-sealed',
      sourceSessionId: session.id,
      previousRoot: sessionRoot,
      capsuleRoot: capsule.capsuleRoot,
      replayRoot: sha256(`${sessionRoot}:sealed:${capsule.capsuleRoot}`),
      createdBy: 'state-capsule-sealer',
    },
  ];
}

function buildBranchRegistry(session, capsule) {
  const baseBranch = safeId(session.id, 'living-artifact');
  return [
    {
      id: `${baseBranch}:main`,
      type: 'mainline',
      state: capsule.state,
      evidenceRoot: capsule.evidenceRoot,
      replayRoot: sha256(`${session.id}:main:${capsule.capsuleRoot}`),
      mergePolicy: 'human-authorized-evidence-gated',
    },
    {
      id: `${baseBranch}:candidate-next`,
      type: 'candidate',
      state: 'waiting-for-mutation-proposal',
      evidenceRoot: capsule.evidenceRoot,
      replayRoot: sha256(`${session.id}:candidate:${capsule.capsuleRoot}`),
      mergePolicy: 'requires-consensus-delta-and-rollback-path',
    },
  ];
}

function buildLifecyclePolicy(session, spec) {
  return {
    id: `${session.id}:lifecycle-policy`,
    states: ['active-living', 'quarantined', 'paused', 'superseded', 'archived'],
    startState: 'active-living',
    allowedTransitions: [
      ['active-living', 'paused'],
      ['paused', 'active-living'],
      ['active-living', 'superseded'],
      ['superseded', 'archived'],
      ['active-living', 'quarantined'],
      ['quarantined', 'paused'],
    ],
    stopConditions: [
      'critical-human-authority-rejection',
      'evidence-root-mismatch',
      'unresolved-red-team-critical-dissent',
      'blind-audit-leakage-confirmed',
    ],
    nextHandoff: spec.artifactPolicy.nextHandoff,
  };
}

function buildMutationContract(session) {
  return {
    id: `${session.id}:mutation-contract`,
    mutationModes: ['append-evidence', 'branch-candidate', 'revise-plan-card', 'promote-to-product-shell', 'archive-dead-branch'],
    requiredGates: [
      'evidence-delta-present',
      'replay-hash-stable',
      'rollback-path-declared',
      'human-review-gate-pass',
      'negative-claim-guard-pass',
    ],
    forbiddenMutations: [
      'overwrite-evidence-root',
      'erase-dissent-ledger',
      'promote-unreviewed-claim',
      'merge-without-rollback-path',
    ],
    mutationRoot: sha256(`${session.id}:mutation-contract:v0.73`),
  };
}

function buildEvidenceContinuity(session, capsule, versionLedger, branchRegistry) {
  return {
    id: `${session.id}:evidence-continuity`,
    sourceEvidenceRoot: capsule.evidenceRoot,
    stateCapsuleRoot: capsule.capsuleRoot,
    versionLedgerRoot: sha256(JSON.stringify(versionLedger)),
    branchRegistryRoot: sha256(JSON.stringify(branchRegistry)),
    continuityRoot: sha256(JSON.stringify({ capsule, versionLedger, branchRegistry })),
    writebackTargets: ['living-artifact-ledger', 'future-governance-kernel', 'evidence-product-shell'],
  };
}

export function buildLivingArtifact(session, spec = DEFAULT_LIVING_ARTIFACT_RUNTIME_SPEC, index = 0) {
  const capsule = buildStateCapsule(session);
  const versionLedger = buildVersionLedger(session, capsule);
  const branchRegistry = buildBranchRegistry(session, capsule);
  const lifecyclePolicy = buildLifecyclePolicy(session, spec);
  const mutationContract = buildMutationContract(session);
  const evidenceContinuity = buildEvidenceContinuity(session, capsule, versionLedger, branchRegistry);
  const id = `${safeId(session.id, `living-artifact-${index}`)}:living-artifact`;
  const score = scoreLivingArtifact({ stateCapsule: capsule, versionLedger, branchRegistry, lifecyclePolicy, mutationContract, evidenceContinuity });
  const artifact = {
    format: RCL_LIVING_ARTIFACT_FORMAT,
    id,
    title: `${session.title ?? session.id} Living Artifact（活体产物）`,
    type: 'evidence-bound-stateful-living-artifact',
    sourceSessionId: session.id,
    stateCapsule: capsule,
    versionLedger,
    branchRegistry,
    lifecyclePolicy,
    mutationContract,
    evidenceContinuity,
    humanReviewGate: {
      id: `${session.id}:human-review-gate`,
      required: true,
      mode: 'human-authority-before-mutation-merge',
      rollbackRequired: true,
    },
    artifactScore: score,
  };
  artifact.rootHash = sha256(JSON.stringify(artifact));
  return artifact;
}

export function scoreLivingArtifact(artifact) {
  const checks = [
    !!artifact.stateCapsule?.capsuleRoot,
    Array.isArray(artifact.versionLedger) && artifact.versionLedger.length >= 2,
    Array.isArray(artifact.branchRegistry) && artifact.branchRegistry.length >= 2,
    Array.isArray(artifact.lifecyclePolicy?.allowedTransitions) && artifact.lifecyclePolicy.allowedTransitions.length >= 4,
    Array.isArray(artifact.mutationContract?.requiredGates) && artifact.mutationContract.requiredGates.includes('rollback-path-declared'),
    !!artifact.evidenceContinuity?.continuityRoot,
  ];
  return round(checks.filter(Boolean).length / checks.length);
}

export function buildLivingArtifactCatalog(councilBundle, spec = DEFAULT_LIVING_ARTIFACT_RUNTIME_SPEC) {
  const sessions = councilBundle.sessions ?? [];
  return sessions.map((session, index) => buildLivingArtifact(session, spec, index));
}

export function buildLivingArtifactRuntime(artifacts, spec = DEFAULT_LIVING_ARTIFACT_RUNTIME_SPEC) {
  const artifactGraph = {
    id: `${spec.id}:artifact-graph`,
    nodes: artifacts.map(a => ({ id: a.id, state: a.stateCapsule.state, score: a.artifactScore, sourceSessionId: a.sourceSessionId })),
    edges: artifacts.flatMap(a => a.branchRegistry.map(b => ({ from: a.id, to: b.id, type: 'contains-branch', replayRoot: b.replayRoot }))),
  };
  const lifecycleLedger = artifacts.map(a => ({ artifactId: a.id, state: a.stateCapsule.state, lifecyclePolicyId: a.lifecyclePolicy.id, stopConditionCount: a.lifecyclePolicy.stopConditions.length }));
  const mutationQueue = artifacts.map(a => ({ artifactId: a.id, status: 'waiting-for-human-authorized-mutation', requiredGates: a.mutationContract.requiredGates }));
  const evidenceContinuityLedger = artifacts.map(a => ({ artifactId: a.id, continuityRoot: a.evidenceContinuity.continuityRoot, writebackTargets: a.evidenceContinuity.writebackTargets }));
  const runtime = {
    id: `${spec.id}:runtime`,
    version: RCL_LIVING_ARTIFACT_RUNTIME_VERSION,
    artifactPolicy: spec.artifactPolicy,
    artifacts,
    artifactGraph,
    lifecycleLedger,
    mutationQueue,
    evidenceContinuityLedger,
    recursiveGovernanceHandoff: {
      ready: true,
      target: spec.artifactPolicy.nextHandoff,
      handoffRoot: sha256(JSON.stringify({ artifactGraph, lifecycleLedger, mutationQueue, evidenceContinuityLedger })),
    },
  };
  runtime.rootHash = sha256(JSON.stringify(runtime));
  return runtime;
}

export function evaluateLivingArtifactRuntime(runtime, spec = DEFAULT_LIVING_ARTIFACT_RUNTIME_SPEC) {
  const artifactScores = runtime.artifacts.map(a => a.artifactScore);
  const averageArtifactScore = round(average(artifactScores));
  const evaluation = {
    format: RCL_LIVING_ARTIFACT_RUNTIME_RESULT_FORMAT,
    version: RCL_LIVING_ARTIFACT_RUNTIME_VERSION,
    livingArtifactRuntimeEstablished: runtime.artifacts.length >= spec.thresholds.minLivingArtifacts && averageArtifactScore >= spec.thresholds.minAverageArtifactScore,
    artifactCount: runtime.artifacts.length,
    stateCapsuleCount: runtime.artifacts.filter(a => !!a.stateCapsule?.capsuleRoot).length,
    versionLedgerCount: runtime.artifacts.filter(a => Array.isArray(a.versionLedger) && a.versionLedger.length >= 2).length,
    branchRegistryCount: runtime.artifacts.filter(a => Array.isArray(a.branchRegistry) && a.branchRegistry.length >= 2).length,
    lifecyclePolicyCount: runtime.artifacts.filter(a => !!a.lifecyclePolicy?.id).length,
    mutationContractCount: runtime.artifacts.filter(a => !!a.mutationContract?.id).length,
    evidenceContinuityCount: runtime.artifacts.filter(a => !!a.evidenceContinuity?.continuityRoot).length,
    humanReviewGateCount: runtime.artifacts.filter(a => a.humanReviewGate?.required).length,
    averageArtifactScore,
    recursiveGovernanceHandoffReady: runtime.recursiveGovernanceHandoff.ready,
    rootHash: runtime.rootHash,
  };
  evaluation.ok = evaluation.livingArtifactRuntimeEstablished;
  return evaluation;
}

export function renderLivingArtifactDocument(artifact) {
  return `# ${artifact.title}\n\n` +
`**Format**: ${artifact.format}\n\n` +
`**State**: ${artifact.stateCapsule.state}\n\n` +
`**Score**: ${artifact.artifactScore}\n\n` +
`## State Capsule（状态胶囊）\n\n` +
`- Source Session（来源会话）: ${artifact.sourceSessionId}\n` +
`- Evidence Root（证据根）: \`${artifact.stateCapsule.evidenceRoot}\`\n` +
`- Capsule Root（胶囊根）: \`${artifact.stateCapsule.capsuleRoot}\`\n\n` +
`## Version Ledger（版本账本）\n\n` +
artifact.versionLedger.map(v => `- ${v.version}: ${v.event} / replay=${v.replayRoot ?? v.capsuleRoot}`).join('\n') +
`\n\n## Branch Registry（分支注册表）\n\n` +
artifact.branchRegistry.map(b => `- ${b.id}: ${b.type}, state=${b.state}, merge=${b.mergePolicy}`).join('\n') +
`\n\n## Lifecycle Policy（生命周期策略）\n\n` +
`Allowed transitions（允许转移）: ${artifact.lifecyclePolicy.allowedTransitions.map(t => t.join('→')).join(', ')}\n\n` +
`Stop conditions（停止条件）: ${artifact.lifecyclePolicy.stopConditions.join(', ')}\n\n` +
`## Mutation Contract（变异契约）\n\n` +
`Required gates（必需闸门）: ${artifact.mutationContract.requiredGates.join(', ')}\n\n` +
`Forbidden mutations（禁止变异）: ${artifact.mutationContract.forbiddenMutations.join(', ')}\n\n` +
`## Evidence Continuity（证据连续性）\n\n` +
`Continuity Root（连续性根）: \`${artifact.evidenceContinuity.continuityRoot}\`\n\n` +
`Writeback targets（回写目标）: ${artifact.evidenceContinuity.writebackTargets.join(', ')}\n`;
}

export function renderLivingArtifactRuntimeDocument(runtime, evaluation) {
  return `# RCL Living Artifact Runtime v0.73（RCL 活体产物运行时）\n\n` +
`## Summary（摘要）\n\n` +
`- Established（成立）: ${evaluation.livingArtifactRuntimeEstablished}\n` +
`- Artifact Count（活体产物数）: ${evaluation.artifactCount}\n` +
`- State Capsule Count（状态胶囊数）: ${evaluation.stateCapsuleCount}\n` +
`- Version Ledger Count（版本账本数）: ${evaluation.versionLedgerCount}\n` +
`- Branch Registry Count（分支注册数）: ${evaluation.branchRegistryCount}\n` +
`- Lifecycle Policy Count（生命周期策略数）: ${evaluation.lifecyclePolicyCount}\n` +
`- Mutation Contract Count（变异契约数）: ${evaluation.mutationContractCount}\n` +
`- Evidence Continuity Count（证据连续性数）: ${evaluation.evidenceContinuityCount}\n` +
`- Human Review Gate Count（人类审查闸门数）: ${evaluation.humanReviewGateCount}\n` +
`- Average Artifact Score（平均产物分）: ${evaluation.averageArtifactScore}\n` +
`- Recursive Governance Handoff Ready（递归治理交接就绪）: ${evaluation.recursiveGovernanceHandoffReady}\n\n` +
`## Artifact Graph（产物图）\n\n` +
`Nodes（节点）: ${runtime.artifactGraph.nodes.length}\n\n` +
`Edges（边）: ${runtime.artifactGraph.edges.length}\n\n` +
`## Root Hash（根哈希）\n\n\`${evaluation.rootHash}\`\n`;
}

export function runLivingArtifactRuntime(input = {}) {
  const spec = normalizeLivingArtifactRuntimeSpec(input);
  const councilBundle = sourceCouncilFromSpec(spec.sourceMultiAgentVerificationCouncil);
  const artifacts = buildLivingArtifactCatalog(councilBundle, spec);
  const runtime = buildLivingArtifactRuntime(artifacts, spec);
  const result = evaluateLivingArtifactRuntime(runtime, spec);
  const bundle = {
    format: RCL_LIVING_ARTIFACT_RUNTIME_BUNDLE_FORMAT,
    ok: result.ok,
    spec,
    sourceCouncilResult: councilBundle.result,
    artifacts,
    runtime,
    result,
    rootHash: result.rootHash,
  };
  return bundle;
}

export function buildLivingArtifactRuntimeSpec(input = {}) {
  return normalizeLivingArtifactRuntimeSpec(input);
}

export function renderLivingArtifactRuntimeRcl(spec = DEFAULT_LIVING_ARTIFACT_RUNTIME_SPEC) {
  const s = normalizeLivingArtifactRuntimeSpec(spec);
  return `living_artifact_runtime ${safeId(s.id)} {\n  version "${s.version}"\n  objective "${s.objective}"\n  source "multi_agent_verification_council"\n  artifact_policy "${s.artifactPolicy.lifecycleMode}"\n  mutation_mode "${s.artifactPolicy.mutationMode}"\n  next_handoff "${s.artifactPolicy.nextHandoff}"\n}\n`;
}

export function runLivingArtifactRuntimeDemo() {
  return runLivingArtifactRuntime(DEFAULT_LIVING_ARTIFACT_RUNTIME_SPEC);
}

export function readLivingArtifactRuntimeInput(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export function writeLivingArtifactRuntimeReports(outputDir, input = {}) {
  const bundle = runLivingArtifactRuntime(input);
  const dir = path.resolve(outputDir);
  const docsDir = path.join(dir, 'technical-docs');
  fs.mkdirSync(docsDir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'living-artifact-runtime-bundle.json'), `${JSON.stringify(bundle, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'living-artifact-runtime-result.json'), `${JSON.stringify(bundle.result, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'living-artifact-runtime.md'), renderLivingArtifactRuntimeDocument(bundle.runtime, bundle.result));
  fs.writeFileSync(path.join(dir, 'living-artifact-runtime.rcl'), renderLivingArtifactRuntimeRcl(bundle.spec));
  for (const artifact of bundle.artifacts) {
    fs.writeFileSync(path.join(docsDir, `${safeId(artifact.id)}.md`), renderLivingArtifactDocument(artifact));
  }
  return {
    ok: bundle.ok,
    outputDir: dir,
    bundlePath: path.join(dir, 'living-artifact-runtime-bundle.json'),
    resultPath: path.join(dir, 'living-artifact-runtime-result.json'),
    runtimeDocPath: path.join(dir, 'living-artifact-runtime.md'),
    docsDir,
    documentCount: bundle.artifacts.length,
    result: bundle.result,
  };
}

export function livingArtifactRuntimeCanonicalRoot(input = {}) {
  return runLivingArtifactRuntime(input).result.rootHash;
}
