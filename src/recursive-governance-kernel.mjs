import fs from 'node:fs';
import path from 'node:path';
import { sha256 } from './reality-compiler-kernel.mjs';
import {
  runLivingArtifactRuntime,
  normalizeLivingArtifactRuntimeSpec,
  RCL_LIVING_ARTIFACT_RUNTIME_RESULT_FORMAT,
} from './living-artifact-runtime.mjs';

export const RCL_RECURSIVE_GOVERNANCE_KERNEL_VERSION = '0.74.0-alpha.1';
export const RCL_RECURSIVE_GOVERNANCE_KERNEL_SPEC_FORMAT = 'rcl.recursive-governance-kernel-spec.v0.74';
export const RCL_RECURSIVE_GOVERNANCE_KERNEL_RESULT_FORMAT = 'rcl.recursive-governance-kernel-result.v0.74';
export const RCL_RECURSIVE_GOVERNANCE_KERNEL_BUNDLE_FORMAT = 'rcl.recursive-governance-kernel-bundle.v0.74';
export const RCL_RECURSIVE_GOVERNANCE_POLICY_FORMAT = 'rcl.recursive-governance-policy.v0.74';
export const RCL_RECURSIVE_GOVERNANCE_DOC_FORMAT = 'rcl.recursive-governance-technical-document.v0.74';

function round(value, digits = 9) {
  const scale = 10 ** digits;
  return Math.round(Number(value) * scale) / scale;
}

function average(values) {
  const xs = values.map(Number).filter(Number.isFinite);
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

function safeId(value, fallback = 'recursive-governance') {
  return String(value ?? fallback)
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._:-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 150) || fallback;
}

function defaultLivingArtifactRuntimeSpec() {
  return normalizeLivingArtifactRuntimeSpec({
    id: 'rcl_recursive_governance_source_living_artifacts_v0',
    objective: 'Source v0.73 living artifacts for v0.74 recursive governance kernel.',
    artifactPolicy: {
      nextHandoff: 'v0.74 Recursive Governance Kernel',
      mutationMode: 'evidence-gated-human-authorized',
    },
  });
}

export const DEFAULT_RECURSIVE_GOVERNANCE_KERNEL_SPEC = Object.freeze({
  format: RCL_RECURSIVE_GOVERNANCE_KERNEL_SPEC_FORMAT,
  id: 'rcl_recursive_governance_kernel_default_v0',
  version: RCL_RECURSIVE_GOVERNANCE_KERNEL_VERSION,
  objective: 'Govern living artifacts with recursive permissions, risk budgets, stop conditions, release gates, audit cadence, rollback obligations and human final authority.',
  thresholds: {
    minGovernancePolicies: 8,
    minAverageGovernanceScore: 0.95,
    requireAuthorityPolicy: true,
    requireRiskBudget: true,
    requireStopConditions: true,
    requirePermissionMatrix: true,
    requireAuditCadence: true,
    requireReleaseGate: true,
    requireRollbackObligation: true,
    requireHumanFinalAuthority: true,
  },
  governancePolicy: {
    mode: 'recursive-governance-for-living-artifacts',
    recursionDepthLimit: 3,
    defaultReleaseMode: 'fail-closed-human-authorized-release',
    defaultAuditCadence: 'every-release-and-every-recursive-branch',
    defaultRiskPosture: 'conservative-until-evidence-replay-stable',
    nextHandoff: 'RCL Super App Packaging Candidate',
  },
  sourceLivingArtifactRuntime: defaultLivingArtifactRuntimeSpec(),
});

export function normalizeRecursiveGovernanceKernelSpec(input = {}) {
  const base = JSON.parse(JSON.stringify(DEFAULT_RECURSIVE_GOVERNANCE_KERNEL_SPEC));
  return {
    ...base,
    ...input,
    format: input.format ?? base.format,
    version: input.version ?? RCL_RECURSIVE_GOVERNANCE_KERNEL_VERSION,
    thresholds: { ...base.thresholds, ...(input.thresholds ?? {}) },
    governancePolicy: { ...base.governancePolicy, ...(input.governancePolicy ?? {}) },
    sourceLivingArtifactRuntime: input.sourceLivingArtifactRuntime ?? base.sourceLivingArtifactRuntime,
  };
}

function sourceRuntimeFromSpec(sourceInput) {
  if (sourceInput?.ok && sourceInput?.result?.format === RCL_LIVING_ARTIFACT_RUNTIME_RESULT_FORMAT) return sourceInput;
  return runLivingArtifactRuntime(sourceInput ?? defaultLivingArtifactRuntimeSpec());
}

function buildAuthorityPolicy(artifact, spec) {
  return {
    id: `${artifact.id}:authority-policy`,
    humanFinalAuthority: true,
    allowedAuthorities: ['human-founder', 'human-review-board', 'delegated-safety-operator'],
    modelAuthorities: ['advisory-only', 'no-autonomous-real-world-release'],
    requiredApprovals: ['human-final-approval', 'evidence-root-match', 'rollback-path-present'],
    releaseMode: spec.governancePolicy.defaultReleaseMode,
    authorityRoot: sha256(`${artifact.id}:authority:${spec.version}`),
  };
}

function buildRiskBudget(artifact, spec) {
  return {
    id: `${artifact.id}:risk-budget`,
    posture: spec.governancePolicy.defaultRiskPosture,
    maxRecursiveDepth: spec.governancePolicy.recursionDepthLimit,
    maxUnreviewedMutationBranches: 0,
    maxOpenCandidateBranches: 2,
    realWorldActionDefault: 'disabled-until-human-authorized',
    budgetCategories: [
      { name: 'evidence-risk', limit: 'no-missing-evidence-root' },
      { name: 'execution-risk', limit: 'no-provider-action-without-authorization' },
      { name: 'claim-risk', limit: 'no-strong-claim-without-review-card' },
      { name: 'recursion-risk', limit: `depth<=${spec.governancePolicy.recursionDepthLimit}` },
    ],
    riskRoot: sha256(`${artifact.id}:risk-budget:${spec.governancePolicy.recursionDepthLimit}`),
  };
}

function buildStopConditions(artifact) {
  const inherited = artifact.lifecyclePolicy?.stopConditions ?? [];
  const governance = [
    'recursive-depth-exceeded',
    'authority-policy-rejected',
    'risk-budget-exceeded',
    'audit-root-mismatch',
    'evidence-continuity-broken',
    'rollback-path-missing',
    'negative-claim-guard-failed',
    'human-kill-switch-triggered',
  ];
  const unique = [...new Set([...inherited, ...governance])];
  return {
    id: `${artifact.id}:stop-conditions`,
    inheritedStopConditions: inherited,
    governanceStopConditions: governance,
    stopConditions: unique,
    defaultAction: 'pause-artifact-and-open-human-review',
    stopRoot: sha256(JSON.stringify(unique)),
  };
}

function buildPermissionMatrix(artifact) {
  const actions = [
    ['append-evidence', 'allowed-with-evidence-root'],
    ['branch-candidate', 'allowed-with-human-review'],
    ['revise-plan-card', 'allowed-with-diff-and-rollback'],
    ['promote-to-product-shell', 'requires-council-plus-human-final-authority'],
    ['invoke-provider', 'disabled-until-rncs-authorization'],
    ['erase-dissent-ledger', 'forbidden'],
    ['overwrite-evidence-root', 'forbidden'],
    ['merge-without-rollback-path', 'forbidden'],
  ];
  return {
    id: `${artifact.id}:permission-matrix`,
    actions: actions.map(([action, policy]) => ({ action, policy })),
    forbiddenActions: actions.filter(([, policy]) => policy === 'forbidden').map(([action]) => action),
    permissionRoot: sha256(JSON.stringify({ artifactId: artifact.id, actions })),
  };
}

function buildAuditCadence(artifact, spec) {
  return {
    id: `${artifact.id}:audit-cadence`,
    cadence: spec.governancePolicy.defaultAuditCadence,
    checkpoints: [
      'before-mutation',
      'after-mutation',
      'before-release',
      'after-release',
      'before-recursive-planning',
      'after-evidence-writeback',
    ],
    auditLedgerTargets: ['version-ledger', 'branch-registry', 'evidence-continuity-ledger', 'governance-ledger'],
    auditRoot: sha256(`${artifact.id}:audit:${spec.governancePolicy.defaultAuditCadence}`),
  };
}

function buildReleaseGate(artifact) {
  return {
    id: `${artifact.id}:release-gate`,
    gateMode: 'fail-closed',
    requiredInputs: [
      'state-capsule-root',
      'version-ledger-root',
      'branch-registry-root',
      'evidence-continuity-root',
      'authority-root',
      'risk-root',
      'audit-root',
      'rollback-root',
    ],
    outputModes: ['demo-only', 'review-card', 'product-shell', 'rncs-execution-handoff'],
    blockedOutputs: ['unreviewed-real-world-action', 'strong-public-claim-without-dossier'],
    releaseRoot: sha256(`${artifact.id}:release-gate:v0.74`),
  };
}

function buildRollbackObligation(artifact) {
  return {
    id: `${artifact.id}:rollback-obligation`,
    rollbackRequired: true,
    rollbackTargets: artifact.branchRegistry?.map(b => b.id) ?? [],
    rollbackEvidence: ['previous-state-capsule', 'previous-version-ledger-root', 'previous-branch-registry-root'],
    rollbackRoot: sha256(`${artifact.id}:rollback:${artifact.evidenceContinuity?.continuityRoot}`),
  };
}

export function scoreGovernancePolicy(policy) {
  const checks = [
    policy.authorityPolicy?.humanFinalAuthority === true,
    policy.riskBudget?.maxRecursiveDepth >= 1,
    Array.isArray(policy.stopConditions?.stopConditions) && policy.stopConditions.stopConditions.includes('human-kill-switch-triggered'),
    Array.isArray(policy.permissionMatrix?.actions) && policy.permissionMatrix.forbiddenActions.includes('overwrite-evidence-root'),
    Array.isArray(policy.auditCadence?.checkpoints) && policy.auditCadence.checkpoints.includes('before-release'),
    Array.isArray(policy.releaseGate?.requiredInputs) && policy.releaseGate.requiredInputs.includes('rollback-root'),
    policy.rollbackObligation?.rollbackRequired === true,
    policy.humanFinalAuthorityGate?.required === true,
  ];
  return round(checks.filter(Boolean).length / checks.length);
}

export function buildRecursiveGovernancePolicy(artifact, spec = DEFAULT_RECURSIVE_GOVERNANCE_KERNEL_SPEC, index = 0) {
  const authorityPolicy = buildAuthorityPolicy(artifact, spec);
  const riskBudget = buildRiskBudget(artifact, spec);
  const stopConditions = buildStopConditions(artifact);
  const permissionMatrix = buildPermissionMatrix(artifact);
  const auditCadence = buildAuditCadence(artifact, spec);
  const releaseGate = buildReleaseGate(artifact);
  const rollbackObligation = buildRollbackObligation(artifact);
  const humanFinalAuthorityGate = {
    id: `${artifact.id}:human-final-authority-gate`,
    required: true,
    mode: 'human-final-authority-before-release-or-real-world-action',
    canPause: true,
    canReject: true,
    canRequestEvidence: true,
  };
  const policy = {
    format: RCL_RECURSIVE_GOVERNANCE_POLICY_FORMAT,
    id: `${safeId(artifact.id, `artifact-${index}`)}:recursive-governance-policy`,
    artifactId: artifact.id,
    artifactState: artifact.stateCapsule?.state,
    authorityPolicy,
    riskBudget,
    stopConditions,
    permissionMatrix,
    auditCadence,
    releaseGate,
    rollbackObligation,
    humanFinalAuthorityGate,
    recursiveGovernanceState: 'governed-living-artifact',
  };
  policy.governanceScore = scoreGovernancePolicy(policy);
  policy.rootHash = sha256(JSON.stringify(policy));
  return policy;
}

export function buildRecursiveGovernanceKernel(artifacts, spec = DEFAULT_RECURSIVE_GOVERNANCE_KERNEL_SPEC) {
  const policies = artifacts.map((artifact, index) => buildRecursiveGovernancePolicy(artifact, spec, index));
  const governanceGraph = {
    id: `${spec.id}:governance-graph`,
    nodes: policies.map(p => ({ id: p.id, artifactId: p.artifactId, score: p.governanceScore })),
    edges: policies.flatMap(p => [
      { from: p.id, to: p.authorityPolicy.id, type: 'requires-authority' },
      { from: p.id, to: p.riskBudget.id, type: 'bounded-by-risk-budget' },
      { from: p.id, to: p.releaseGate.id, type: 'blocked-by-release-gate' },
      { from: p.id, to: p.rollbackObligation.id, type: 'requires-rollback' },
    ]),
  };
  const governanceLedger = policies.map(p => ({
    policyId: p.id,
    artifactId: p.artifactId,
    governanceScore: p.governanceScore,
    authorityRoot: p.authorityPolicy.authorityRoot,
    riskRoot: p.riskBudget.riskRoot,
    releaseRoot: p.releaseGate.releaseRoot,
    rollbackRoot: p.rollbackObligation.rollbackRoot,
  }));
  const superAppPackagingHandoff = {
    ready: policies.every(p => p.governanceScore === 1),
    target: spec.governancePolicy.nextHandoff,
    requiredSurfaces: ['mobile-app-shell', 'web-console', 'desktop-cli', 'evidence-product-shell', 'living-artifact-dashboard'],
    governanceRoot: sha256(JSON.stringify({ governanceGraph, governanceLedger })),
  };
  const kernel = {
    id: `${spec.id}:kernel`,
    version: RCL_RECURSIVE_GOVERNANCE_KERNEL_VERSION,
    governancePolicy: spec.governancePolicy,
    policies,
    governanceGraph,
    governanceLedger,
    superAppPackagingHandoff,
  };
  kernel.rootHash = sha256(JSON.stringify(kernel));
  return kernel;
}

export function evaluateRecursiveGovernanceKernel(kernel, spec = DEFAULT_RECURSIVE_GOVERNANCE_KERNEL_SPEC) {
  const policyScores = kernel.policies.map(p => p.governanceScore);
  const averageGovernanceScore = round(average(policyScores));
  const result = {
    format: RCL_RECURSIVE_GOVERNANCE_KERNEL_RESULT_FORMAT,
    version: RCL_RECURSIVE_GOVERNANCE_KERNEL_VERSION,
    recursiveGovernanceKernelEstablished: kernel.policies.length >= spec.thresholds.minGovernancePolicies && averageGovernanceScore >= spec.thresholds.minAverageGovernanceScore,
    governancePolicyCount: kernel.policies.length,
    authorityPolicyCount: kernel.policies.filter(p => p.authorityPolicy?.humanFinalAuthority).length,
    riskBudgetCount: kernel.policies.filter(p => p.riskBudget?.riskRoot).length,
    stopConditionSetCount: kernel.policies.filter(p => p.stopConditions?.stopRoot).length,
    permissionMatrixCount: kernel.policies.filter(p => p.permissionMatrix?.permissionRoot).length,
    auditCadenceCount: kernel.policies.filter(p => p.auditCadence?.auditRoot).length,
    releaseGateCount: kernel.policies.filter(p => p.releaseGate?.releaseRoot).length,
    rollbackObligationCount: kernel.policies.filter(p => p.rollbackObligation?.rollbackRequired).length,
    humanFinalAuthorityGateCount: kernel.policies.filter(p => p.humanFinalAuthorityGate?.required).length,
    averageGovernanceScore,
    superAppPackagingHandoffReady: kernel.superAppPackagingHandoff.ready,
    rootHash: kernel.rootHash,
  };
  result.ok = result.recursiveGovernanceKernelEstablished;
  return result;
}

export function renderGovernancePolicyDocument(policy) {
  return `# ${policy.artifactId} Governance Policy（治理策略）\n\n` +
`**Format**: ${policy.format}\n\n` +
`**Score（分数）**: ${policy.governanceScore}\n\n` +
`## Authority Policy（权威策略）\n\n` +
`- Human Final Authority（人类最终权威）: ${policy.authorityPolicy.humanFinalAuthority}\n` +
`- Model Authorities（模型权限）: ${policy.authorityPolicy.modelAuthorities.join(', ')}\n` +
`- Required Approvals（必需批准）: ${policy.authorityPolicy.requiredApprovals.join(', ')}\n\n` +
`## Risk Budget（风险预算）\n\n` +
`- Posture（姿态）: ${policy.riskBudget.posture}\n` +
`- Max Recursive Depth（最大递归深度）: ${policy.riskBudget.maxRecursiveDepth}\n` +
`- Real World Action Default（真实世界动作默认值）: ${policy.riskBudget.realWorldActionDefault}\n\n` +
`## Stop Conditions（停止条件）\n\n` +
policy.stopConditions.stopConditions.map(s => `- ${s}`).join('\n') +
`\n\n## Permission Matrix（权限矩阵）\n\n` +
policy.permissionMatrix.actions.map(a => `- ${a.action}: ${a.policy}`).join('\n') +
`\n\n## Audit Cadence（审计节奏）\n\n` +
policy.auditCadence.checkpoints.map(c => `- ${c}`).join('\n') +
`\n\n## Release Gate（发布闸门）\n\n` +
`Gate Mode（闸门模式）: ${policy.releaseGate.gateMode}\n\n` +
`Blocked Outputs（阻断输出）: ${policy.releaseGate.blockedOutputs.join(', ')}\n\n` +
`## Rollback Obligation（回滚义务）\n\n` +
`Rollback Required（需要回滚）: ${policy.rollbackObligation.rollbackRequired}\n\n` +
`## Root Hash（根哈希）\n\n\`${policy.rootHash}\`\n`;
}

export function renderRecursiveGovernanceKernelDocument(kernel, result) {
  return `# RCL Recursive Governance Kernel v0.74（RCL 递归治理内核）\n\n` +
`## Summary（摘要）\n\n` +
`- Established（成立）: ${result.recursiveGovernanceKernelEstablished}\n` +
`- Governance Policy Count（治理策略数）: ${result.governancePolicyCount}\n` +
`- Authority Policy Count（权威策略数）: ${result.authorityPolicyCount}\n` +
`- Risk Budget Count（风险预算数）: ${result.riskBudgetCount}\n` +
`- Stop Condition Set Count（停止条件集数）: ${result.stopConditionSetCount}\n` +
`- Permission Matrix Count（权限矩阵数）: ${result.permissionMatrixCount}\n` +
`- Audit Cadence Count（审计节奏数）: ${result.auditCadenceCount}\n` +
`- Release Gate Count（发布闸门数）: ${result.releaseGateCount}\n` +
`- Rollback Obligation Count（回滚义务数）: ${result.rollbackObligationCount}\n` +
`- Human Final Authority Gate Count（人类最终权威闸门数）: ${result.humanFinalAuthorityGateCount}\n` +
`- Average Governance Score（平均治理分）: ${result.averageGovernanceScore}\n` +
`- Super App Packaging Handoff Ready（超级应用打包交接就绪）: ${result.superAppPackagingHandoffReady}\n\n` +
`## Governance Graph（治理图）\n\n` +
`Nodes（节点）: ${kernel.governanceGraph.nodes.length}\n\n` +
`Edges（边）: ${kernel.governanceGraph.edges.length}\n\n` +
`## Required Super App Surfaces（超级应用所需界面）\n\n` +
(kernel.superAppPackagingHandoff.requiredSurfaces.map(s => `- ${s}`).join('\n')) +
`\n\n## Root Hash（根哈希）\n\n\`${result.rootHash}\`\n`;
}

export function runRecursiveGovernanceKernel(input = {}) {
  const spec = normalizeRecursiveGovernanceKernelSpec(input);
  const livingBundle = sourceRuntimeFromSpec(spec.sourceLivingArtifactRuntime);
  const artifacts = livingBundle.artifacts ?? livingBundle.runtime?.artifacts ?? [];
  const kernel = buildRecursiveGovernanceKernel(artifacts, spec);
  const result = evaluateRecursiveGovernanceKernel(kernel, spec);
  const bundle = {
    format: RCL_RECURSIVE_GOVERNANCE_KERNEL_BUNDLE_FORMAT,
    ok: result.ok,
    spec,
    sourceLivingArtifactResult: livingBundle.result,
    policies: kernel.policies,
    kernel,
    result,
    rootHash: result.rootHash,
  };
  return bundle;
}

export function buildRecursiveGovernanceKernelSpec(input = {}) {
  return normalizeRecursiveGovernanceKernelSpec(input);
}

export function renderRecursiveGovernanceKernelRcl(spec = DEFAULT_RECURSIVE_GOVERNANCE_KERNEL_SPEC) {
  const s = normalizeRecursiveGovernanceKernelSpec(spec);
  return `recursive_governance_kernel ${safeId(s.id)} {\n  version "${s.version}"\n  objective "${s.objective}"\n  source "living_artifact_runtime"\n  recursion_depth_limit ${s.governancePolicy.recursionDepthLimit}\n  release_mode "${s.governancePolicy.defaultReleaseMode}"\n  audit_cadence "${s.governancePolicy.defaultAuditCadence}"\n  next_handoff "${s.governancePolicy.nextHandoff}"\n}\n`;
}

export function runRecursiveGovernanceKernelDemo() {
  return runRecursiveGovernanceKernel(DEFAULT_RECURSIVE_GOVERNANCE_KERNEL_SPEC);
}

export function readRecursiveGovernanceKernelInput(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export function writeRecursiveGovernanceKernelReports(outputDir, input = {}) {
  const bundle = runRecursiveGovernanceKernel(input);
  const dir = path.resolve(outputDir);
  const docsDir = path.join(dir, 'technical-docs');
  fs.mkdirSync(docsDir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'recursive-governance-kernel-bundle.json'), `${JSON.stringify(bundle, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'recursive-governance-kernel-result.json'), `${JSON.stringify(bundle.result, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'recursive-governance-kernel.md'), renderRecursiveGovernanceKernelDocument(bundle.kernel, bundle.result));
  fs.writeFileSync(path.join(dir, 'recursive-governance-kernel.rcl'), renderRecursiveGovernanceKernelRcl(bundle.spec));
  for (const policy of bundle.policies) {
    fs.writeFileSync(path.join(docsDir, `${safeId(policy.id)}.md`), renderGovernancePolicyDocument(policy));
  }
  return {
    ok: bundle.ok,
    outputDir: dir,
    bundlePath: path.join(dir, 'recursive-governance-kernel-bundle.json'),
    resultPath: path.join(dir, 'recursive-governance-kernel-result.json'),
    kernelDocPath: path.join(dir, 'recursive-governance-kernel.md'),
    docsDir,
    documentCount: bundle.policies.length,
    result: bundle.result,
  };
}

export function recursiveGovernanceKernelCanonicalRoot(input = {}) {
  return runRecursiveGovernanceKernel(input).result.rootHash;
}
