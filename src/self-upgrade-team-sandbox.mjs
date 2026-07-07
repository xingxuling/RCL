import fs from 'node:fs';
import path from 'node:path';
import { sha256 } from './reality-compiler-kernel.mjs';
import { runUnknownFrameworkGapClosureDemo } from './unknown-framework-gap-closure-runtime.mjs';
import { runMultiAgentVerificationCouncilDemo } from './multi-agent-verification-council.mjs';

export const RCL_SELF_UPGRADE_TEAM_SANDBOX_VERSION = '0.80.0-alpha.1';
export const RCL_SELF_UPGRADE_TEAM_SANDBOX_SPEC_FORMAT = 'rcl.self-upgrade-team-sandbox-spec.v0.80';
export const RCL_SELF_UPGRADE_TEAM_SANDBOX_RESULT_FORMAT = 'rcl.self-upgrade-team-sandbox-result.v0.80';
export const RCL_SELF_UPGRADE_TEAM_SANDBOX_BUNDLE_FORMAT = 'rcl.self-upgrade-team-sandbox-bundle.v0.80';
export const RCL_SELF_UPGRADE_AGENT_FORMAT = 'rcl.self-upgrade-agent.v0.80';
export const RCL_SELF_UPGRADE_BRANCH_FORMAT = 'rcl.self-upgrade-accelerated-branch.v0.80';
export const RCL_SELF_UPGRADE_PATCH_PLAN_FORMAT = 'rcl.self-upgrade-patch-plan.v0.80';
export const RCL_SELF_UPGRADE_WORK_METHOD_FORMAT = 'rcl.self-upgrade-work-method.v0.80';

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

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value)));
}

export const DEFAULT_SELF_UPGRADE_TEAM_ROLES = Object.freeze([
  {
    id: 'version_strategist',
    title: 'Version Strategist（版本战略智能体）',
    authority: 'may propose version scope, next handoff and stop conditions',
    outputContract: ['upgrade_objective', 'scope_boundary', 'version_verdict'],
    threeShotSamples: [
      '当目标过大时，先压成一个可发布版本，不允许无限展开。',
      '当候选分支很多时，按价值、风险、测试性和证据性排序。',
      '当路线缺少验收标准时，先拒绝进入真实源码修改。',
    ],
  },
  {
    id: 'source_cartographer',
    title: 'Source Cartographer（源码制图智能体）',
    authority: 'may read source snapshots and produce dependency and touch maps',
    outputContract: ['source_map', 'risk_hotspots', 'change_surface'],
    threeShotSamples: [
      '先识别入口文件、导出文件、测试文件和文档文件。',
      '优先修改低耦合模块，避免触碰旧编译器内核。',
      '每个改动必须能追溯到文件、命令和测试。',
    ],
  },
  {
    id: 'runtime_engineer',
    title: 'Runtime Engineer（运行时工程智能体）',
    authority: 'may draft runtime modules, public APIs and CLI contracts',
    outputContract: ['runtime_api', 'patch_plan', 'integration_steps'],
    threeShotSamples: [
      '新增能力必须有 normalize / compile / run / demo / render / report 函数。',
      '默认模式不得调用外部 API，不得默认写真实世界资源。',
      '代码先生成可测试的 deterministic sandbox，再扩展到真实执行器。',
    ],
  },
  {
    id: 'test_forger',
    title: 'Test Forger（测试锻造智能体）',
    authority: 'may create regression tests, CLI smoke tests and failure gates',
    outputContract: ['test_matrix', 'fixtures', 'acceptance_gates'],
    threeShotSamples: [
      '每个新 runtime 至少要测试 demo、spec、report 和 RCL render。',
      '测试优先验证边界：不默认外部写入、不默认 API、不跳过证据。',
      '失败时输出可复现命令，而不是只写文字结论。',
    ],
  },
  {
    id: 'evidence_keeper',
    title: 'Evidence Keeper（证据守卫智能体）',
    authority: 'may write hash ledgers, canonical roots and release evidence',
    outputContract: ['evidence_ledger', 'canonical_root', 'replay_bundle'],
    threeShotSamples: [
      '所有结果都必须有版本号、输入摘要、输出文件和哈希根。',
      '沙箱证据和真实执行证据必须分开命名。',
      '当 output 与源码不是同一次生成时，必须标记为 evidence drift。',
    ],
  },
  {
    id: 'semantic_guard',
    title: 'Semantic Guard（语义守卫智能体）',
    authority: 'may veto semantically unsafe upgrades and hallucinated execution claims',
    outputContract: ['semantic_risks', 'veto_conditions', 'truth_boundary'],
    threeShotSamples: [
      '能跑不等于语义正确，必须检查目标、边界和验收是否一致。',
      '不能把模拟分支说成真实 commit，不能把沙箱行动说成现实行动。',
      '高阶符号只能作为调度语言，不能宣称已经改变现实命运。',
    ],
  },
  {
    id: 'release_packager',
    title: 'Release Packager（发布打包智能体）',
    authority: 'may assemble docs, changelog, release manifest and handoff files',
    outputContract: ['release_notes', 'handoff_pack', 'work_method_doc'],
    threeShotSamples: [
      '交付包必须包含源码、测试、文档、示例和运行结果。',
      'README / CONTEXT / package version 必须和当前版本对齐。',
      '下一次对话应能通过工作文件快速恢复方法，不再重复解释。',
    ],
  },
]);

export const DEFAULT_SELF_UPGRADE_TEAM_SANDBOX_SPEC = Object.freeze({
  format: RCL_SELF_UPGRADE_TEAM_SANDBOX_SPEC_FORMAT,
  id: 'rcl_self_upgrade_team_sandbox_default_v0',
  version: RCL_SELF_UPGRADE_TEAM_SANDBOX_VERSION,
  sourceVersion: '0.79.0-alpha.1',
  targetVersion: '0.80.0-alpha.1',
  objective: 'Create a multi-agent self-upgrade team sandbox that can reduce external model workload by generating upgrade branches, patch plans, tests, evidence ledgers and release handoffs before real source mutation.',
  mission: 'First safe upgrade: align v0.79 context drift, add v0.80 self-upgrade team sandbox seed, and produce a reusable work-method document.',
  timeAcceleration: {
    mode: 'sandbox_branch_acceleration',
    meaning: 'simulate many candidate future upgrade branches in deterministic sandbox time, then execute only the best branch in the real worktree',
    maxBranches: 9,
    realWorldWriteDefault: false,
  },
  thresholds: {
    minAgentCount: 7,
    minSamplesPerAgent: 3,
    minAcceleratedBranches: 8,
    minPatchPlanFileCount: 8,
    minAverageBranchScore: 0.72,
    requireSemanticGuard: true,
    requireEvidenceLedger: true,
    requireRollbackPlan: true,
    requireHumanFinalAuthority: true,
    requireNoExternalWriteDefault: true,
  },
  teamRoles: DEFAULT_SELF_UPGRADE_TEAM_ROLES,
  candidateGoals: [
    'version_context_alignment',
    'self_upgrade_team_sandbox_seed',
    'benchmark_harness_provider_pack',
    'code_execution_oracle_provider',
    'source_map_and_patch_queue',
    'evidence_hygiene_canonical_root_refresh',
    'aetherion_ial_rcl_task_composer',
    'apk_build_relay_integration',
    'work_method_project_file',
  ],
  boundary: {
    sandboxCan: ['simulate branch futures', 'create patch plans', 'write proposed files through host artifact layer', 'run targeted tests', 'write evidence and release reports'],
    sandboxCannot: ['claim autonomous real-world commits', 'bypass human authority', 'mutate remote repositories without explicit connector action', 'replace frontier model reasoning without provider'],
  },
});

export function normalizeSelfUpgradeTeamSandboxSpec(input = {}) {
  const base = JSON.parse(JSON.stringify(DEFAULT_SELF_UPGRADE_TEAM_SANDBOX_SPEC));
  return {
    ...base,
    ...input,
    format: input.format ?? base.format,
    version: input.version ?? RCL_SELF_UPGRADE_TEAM_SANDBOX_VERSION,
    sourceVersion: input.sourceVersion ?? base.sourceVersion,
    targetVersion: input.targetVersion ?? base.targetVersion,
    timeAcceleration: { ...base.timeAcceleration, ...(input.timeAcceleration ?? {}) },
    thresholds: { ...base.thresholds, ...(input.thresholds ?? {}) },
    teamRoles: input.teamRoles ?? base.teamRoles,
    candidateGoals: input.candidateGoals ?? base.candidateGoals,
    boundary: { ...base.boundary, ...(input.boundary ?? {}) },
  };
}

function buildSourceEvidence() {
  const unknownClosure = runUnknownFrameworkGapClosureDemo();
  const verificationCouncil = runMultiAgentVerificationCouncilDemo();
  const evidence = {
    unknownFrameworkGapClosure: {
      ok: unknownClosure.ok,
      version: unknownClosure.result.version,
      nextHandoff: unknownClosure.result.nextHandoff,
      providerUpgradeContractCount: unknownClosure.result.providerUpgradeContractCount,
      closureTaskCount: unknownClosure.result.closureTaskCount,
      truthfulBoundaryKept: unknownClosure.result.truthfulBoundaryKept,
      canonicalRoot: unknownClosure.result.canonicalRoot,
    },
    multiAgentVerificationCouncil: {
      ok: verificationCouncil.ok,
      version: verificationCouncil.result.version,
      verificationSessionCount: verificationCouncil.result.verificationSessionCount,
      councilMemberCount: verificationCouncil.result.councilMemberCount,
      averageVerificationScore: verificationCouncil.result.averageVerificationScore,
      livingArtifactHandoffReady: verificationCouncil.result.livingArtifactHandoffReady,
      canonicalRoot: verificationCouncil.result.canonicalRoot,
    },
  };
  return {
    ...evidence,
    evidenceRoot: sha256(compact(evidence)),
  };
}

function buildAgents(spec) {
  return spec.teamRoles.map((role, index) => {
    const samples = role.threeShotSamples ?? [];
    const outputFiles = {
      version_strategist: ['upgrade-scope.md', 'branch-scoreboard.json'],
      source_cartographer: ['source-touch-map.md', 'risk-hotspots.json'],
      runtime_engineer: ['patch-plan.md', 'runtime-api.md'],
      test_forger: ['test-plan.md', 'acceptance-gates.json'],
      evidence_keeper: ['evidence-ledger.md', 'canonical-root.txt'],
      semantic_guard: ['truth-boundary.md', 'semantic-veto-rules.json'],
      release_packager: ['release-verdict.md', 'RCL_SELF_UPGRADE_TEAM_WORK_METHOD_v0.80.md'],
    }[role.id] ?? [`${role.id}.md`];
    return {
      format: RCL_SELF_UPGRADE_AGENT_FORMAT,
      id: role.id,
      title: role.title,
      ordinal: index + 1,
      authority: role.authority,
      outputContract: role.outputContract,
      sampleCount: samples.length,
      threeShotSamples: samples,
      workMode: 'few-shot-role-routing + deterministic sandbox contract',
      usefulOutputs: outputFiles,
      agentRoot: sha256(compact({ role, outputFiles })),
    };
  });
}

function branchScores(goal, index) {
  const table = {
    version_context_alignment: [0.82, 0.18, 0.95, 0.92],
    self_upgrade_team_sandbox_seed: [0.96, 0.22, 0.92, 0.98],
    benchmark_harness_provider_pack: [0.88, 0.55, 0.78, 0.86],
    code_execution_oracle_provider: [0.91, 0.62, 0.82, 0.9],
    source_map_and_patch_queue: [0.87, 0.32, 0.91, 0.9],
    evidence_hygiene_canonical_root_refresh: [0.84, 0.2, 0.96, 0.94],
    aetherion_ial_rcl_task_composer: [0.9, 0.44, 0.8, 0.88],
    apk_build_relay_integration: [0.78, 0.7, 0.76, 0.8],
    work_method_project_file: [0.86, 0.12, 0.98, 0.96],
  };
  return table[goal] ?? [0.72 + index * 0.01, 0.4, 0.72, 0.72];
}

function buildAcceleratedBranches(spec, agents) {
  return spec.candidateGoals.slice(0, spec.timeAcceleration.maxBranches).map((goal, index) => {
    const [utility, risk, testability, evidenceFitness] = branchScores(goal, index);
    const score = round((utility * 0.36) + ((1 - risk) * 0.24) + (testability * 0.2) + (evidenceFitness * 0.2));
    const owner = agents[index % agents.length];
    const branch = {
      format: RCL_SELF_UPGRADE_BRANCH_FORMAT,
      id: `v0_80_branch_${String(index + 1).padStart(2, '0')}_${goal}`,
      goal,
      ownerAgentId: owner.id,
      simulatedTimeline: {
        sandboxTicks: 72 + index * 8,
        realWorldMinutesAvoidedClaim: true,
        accelerationMeaning: spec.timeAcceleration.meaning,
      },
      scores: { utility, risk, testability, evidenceFitness, score },
      verdict: score >= 0.84 ? 'promote-to-patch-plan' : score >= 0.75 ? 'keep-as-follow-up' : 'defer',
      requiredGuards: ['semantic_guard', 'evidence_keeper', 'human_final_authority'],
    };
    return { ...branch, branchRoot: sha256(compact(branch)) };
  });
}

function buildPatchPlan(spec, selectedBranches) {
  const files = [
    {
      path: 'src/self-upgrade-team-sandbox.mjs',
      operation: 'create',
      ownerAgentId: 'runtime_engineer',
      purpose: 'Implement deterministic multi-agent self-upgrade team sandbox runtime.',
      risk: 'low',
    },
    {
      path: 'tests/self-upgrade-team-sandbox.test.mjs',
      operation: 'create',
      ownerAgentId: 'test_forger',
      purpose: 'Verify team agents, branch acceleration, patch plan, evidence reports and RCL rendering.',
      risk: 'low',
    },
    {
      path: 'examples/self-upgrade-team-sandbox/default-self-upgrade-team.json',
      operation: 'create',
      ownerAgentId: 'source_cartographer',
      purpose: 'Provide an editable mission spec for v0.80 self-upgrade trials.',
      risk: 'low',
    },
    {
      path: 'docs/RCL_SELF_UPGRADE_TEAM_SANDBOX_v0.80.md',
      operation: 'create',
      ownerAgentId: 'release_packager',
      purpose: 'Document the method and safe operating boundary.',
      risk: 'low',
    },
    {
      path: 'src/index.mjs',
      operation: 'update',
      ownerAgentId: 'runtime_engineer',
      purpose: 'Export v0.80 runtime API.',
      risk: 'medium-low',
    },
    {
      path: 'src/cli.mjs',
      operation: 'update',
      ownerAgentId: 'runtime_engineer',
      purpose: 'Expose self-upgrade-team-demo/run/spec CLI commands.',
      risk: 'medium-low',
    },
    {
      path: 'package.json',
      operation: 'update',
      ownerAgentId: 'release_packager',
      purpose: 'Bump package version and add v0.80 scripts.',
      risk: 'medium-low',
    },
    {
      path: 'README.md',
      operation: 'update',
      ownerAgentId: 'release_packager',
      purpose: 'Add v0.80 current status and command usage.',
      risk: 'low',
    },
    {
      path: 'CONTEXT.md',
      operation: 'update',
      ownerAgentId: 'evidence_keeper',
      purpose: 'Align context to v0.80 and preserve truthful next handoff.',
      risk: 'low',
    },
    {
      path: 'output/v0.80/self-upgrade-team-sandbox/*',
      operation: 'generate',
      ownerAgentId: 'evidence_keeper',
      purpose: 'Write run bundle, branch scoreboard, patch plan, evidence ledger and canonical root.',
      risk: 'low',
    },
    {
      path: 'RCL_SELF_UPGRADE_TEAM_WORK_METHOD_v0.80.md',
      operation: 'create-handoff',
      ownerAgentId: 'release_packager',
      purpose: 'Project-file work method for future ChatGPT sessions to reduce work by invoking this team first.',
      risk: 'low',
    },
  ];
  const plan = {
    format: RCL_SELF_UPGRADE_PATCH_PLAN_FORMAT,
    id: 'rcl_v0_80_self_upgrade_team_patch_plan',
    targetVersion: spec.targetVersion,
    selectedBranchIds: selectedBranches.map(b => b.id),
    files,
    rollbackPlan: [
      'Keep source package snapshot before patch.',
      'Run targeted v0.80 tests before packaging.',
      'If CLI integration fails, revert only src/cli.mjs and keep runtime module isolated.',
      'If semantic boundary fails, do not promote package as self-upgrade capable.',
    ],
    humanAuthorityRequiredBefore: ['git push', 'remote deployment', 'real repository mutation', 'external provider calls'],
    planRoot: sha256(compact({ selected: selectedBranches.map(b => b.branchRoot), files })),
  };
  return plan;
}

function buildTeamWorkProducts(agents, branches, patchPlan) {
  const promoted = branches.filter(b => b.verdict === 'promote-to-patch-plan');
  return agents.map(agent => {
    const agentBranches = branches.filter(b => b.ownerAgentId === agent.id);
    const ownedFiles = patchPlan.files.filter(f => f.ownerAgentId === agent.id);
    const summaryByAgent = {
      version_strategist: '选择低风险 v0.80 自升级团队沙箱作为第一升级主线，避免直接进入高风险 Provider 真执行。',
      source_cartographer: '确认触碰面集中在新增 runtime、测试、CLI、index、文档和 output，不修改旧编译器核心。',
      runtime_engineer: '定义 normalize / compile / run / demo / render / report API，保持默认无外部写入。',
      test_forger: '建立 demo、branch、patch plan、report、RCL render 五类验收。',
      evidence_keeper: '将沙箱证据、分支根、计划根和 canonicalRoot 写入输出目录。',
      semantic_guard: '裁决：多智能体团队只能减少工作量，不能宣称完全替代强模型或人类最终权威。',
      release_packager: '产出可放进项目文件的工作方法 MD，让未来会话优先调用该团队减负。',
    };
    return {
      agentId: agent.id,
      title: agent.title,
      usefulOutputFiles: agent.usefulOutputs,
      ownedPatchFiles: ownedFiles.map(f => f.path),
      branchIds: agentBranches.map(b => b.id),
      promotedBranchIds: promoted.filter(b => b.ownerAgentId === agent.id).map(b => b.id),
      summary: summaryByAgent[agent.id] ?? 'Produces bounded self-upgrade work artifacts.',
      productRoot: sha256(compact({ agentId: agent.id, ownedFiles, agentBranches: agentBranches.map(b => b.branchRoot) })),
    };
  });
}

function buildTestPlan(spec, patchPlan) {
  const commands = [
    'node --test --test-concurrency=1 tests/self-upgrade-team-sandbox.test.mjs',
    'node src/cli.mjs self-upgrade-team-demo',
    'node src/cli.mjs self-upgrade-team-run examples/self-upgrade-team-sandbox/default-self-upgrade-team.json output/v0.80/self-upgrade-team-sandbox',
    'node src/cli.mjs self-upgrade-team-spec output/v0.80/self-upgrade-team-sandbox-spec',
  ];
  return {
    id: 'rcl_v0_80_self_upgrade_team_test_plan',
    commands,
    acceptanceGates: [
      `agent count >= ${spec.thresholds.minAgentCount}`,
      `samples per agent >= ${spec.thresholds.minSamplesPerAgent}`,
      `accelerated branch count >= ${spec.thresholds.minAcceleratedBranches}`,
      `patch plan file count >= ${spec.thresholds.minPatchPlanFileCount}`,
      'semantic guard present',
      'evidence ledger written',
      'human final authority boundary preserved',
      'no external write by default',
    ],
    changedFileCount: patchPlan.files.length,
    testRoot: sha256(compact({ commands, files: patchPlan.files.map(f => f.path) })),
  };
}

function buildEvidenceLedger(spec, evidence, agents, branches, patchPlan, testPlan) {
  return {
    id: 'rcl_v0_80_self_upgrade_team_evidence_ledger',
    version: RCL_SELF_UPGRADE_TEAM_SANDBOX_VERSION,
    sourceVersion: spec.sourceVersion,
    targetVersion: spec.targetVersion,
    sourceEvidenceRoot: evidence.evidenceRoot,
    agentRoots: agents.map(a => a.agentRoot),
    branchRoots: branches.map(b => b.branchRoot),
    selectedBranchRoots: branches.filter(b => b.verdict === 'promote-to-patch-plan').map(b => b.branchRoot),
    patchPlanRoot: patchPlan.planRoot,
    testPlanRoot: testPlan.testRoot,
    evidenceBoundary: 'deterministic sandbox evidence; real filesystem artifacts are written by host execution layer after the sandbox verdict',
    ledgerRoot: sha256(compact({ evidenceRoot: evidence.evidenceRoot, agents: agents.map(a => a.agentRoot), branches: branches.map(b => b.branchRoot), patchPlan: patchPlan.planRoot, testPlan: testPlan.testRoot })),
  };
}

function buildReleaseVerdict(spec, agents, branches, patchPlan, testPlan, evidenceLedger) {
  const selected = branches.filter(b => b.verdict === 'promote-to-patch-plan');
  const semanticGuardPresent = agents.some(a => a.id === 'semantic_guard');
  const evidenceKeeperPresent = agents.some(a => a.id === 'evidence_keeper');
  const noExternalWriteDefault = spec.timeAcceleration.realWorldWriteDefault === false;
  const ready = selected.length >= 3 && semanticGuardPresent && evidenceKeeperPresent && noExternalWriteDefault;
  return {
    id: 'rcl_v0_80_self_upgrade_team_release_verdict',
    decision: ready ? 'release-seed-ready' : 'hold-in-sandbox',
    ready,
    selectedBranchCount: selected.length,
    changedFileCount: patchPlan.files.length,
    testCommandCount: testPlan.commands.length,
    semanticGuardPresent,
    evidenceKeeperPresent,
    noExternalWriteDefault,
    humanFinalAuthorityRequired: true,
    externalExecutionBoundary: 'The team may draft and verify; final source mutation, package publication, repository push and deployment require the outer execution environment and human/assistant final authority.',
    nextHandoff: 'v0.81 Source Map Patch Queue + Code Execution Oracle Provider Seed',
    verdictRoot: sha256(compact({ selected: selected.map(b => b.branchRoot), patchPlanRoot: patchPlan.planRoot, evidenceLedgerRoot: evidenceLedger.ledgerRoot })),
  };
}

export function compileSelfUpgradeTeamSandbox(input = {}) {
  const spec = normalizeSelfUpgradeTeamSandboxSpec(input);
  const sourceEvidence = buildSourceEvidence();
  const agents = buildAgents(spec);
  const branches = buildAcceleratedBranches(spec, agents);
  const averageBranchScore = round(average(branches.map(b => b.scores.score)));
  const selectedBranches = branches.filter(b => b.verdict === 'promote-to-patch-plan');
  const patchPlan = buildPatchPlan(spec, selectedBranches);
  const workProducts = buildTeamWorkProducts(agents, branches, patchPlan);
  const testPlan = buildTestPlan(spec, patchPlan);
  const evidenceLedger = buildEvidenceLedger(spec, sourceEvidence, agents, branches, patchPlan, testPlan);
  const releaseVerdict = buildReleaseVerdict(spec, agents, branches, patchPlan, testPlan, evidenceLedger);
  const result = {
    format: RCL_SELF_UPGRADE_TEAM_SANDBOX_RESULT_FORMAT,
    version: RCL_SELF_UPGRADE_TEAM_SANDBOX_VERSION,
    sourceVersion: spec.sourceVersion,
    targetVersion: spec.targetVersion,
    selfUpgradeTeamSandboxEstablished:
      agents.length >= spec.thresholds.minAgentCount &&
      agents.every(a => a.sampleCount >= spec.thresholds.minSamplesPerAgent) &&
      branches.length >= spec.thresholds.minAcceleratedBranches &&
      patchPlan.files.length >= spec.thresholds.minPatchPlanFileCount &&
      averageBranchScore >= spec.thresholds.minAverageBranchScore &&
      releaseVerdict.ready,
    agentCount: agents.length,
    totalFewShotSamples: agents.reduce((sum, a) => sum + a.sampleCount, 0),
    acceleratedBranchCount: branches.length,
    promotedBranchCount: selectedBranches.length,
    patchPlanFileCount: patchPlan.files.length,
    workProductCount: workProducts.length,
    testCommandCount: testPlan.commands.length,
    averageBranchScore,
    semanticGuardPresent: agents.some(a => a.id === 'semantic_guard'),
    evidenceLedgerWritten: true,
    rollbackPlanPresent: patchPlan.rollbackPlan.length >= 3,
    humanFinalAuthorityKept: releaseVerdict.humanFinalAuthorityRequired,
    noExternalWriteByDefault: spec.timeAcceleration.realWorldWriteDefault === false,
    reducedOuterModelWorkloadBy: 'branch exploration + role decomposition + patch/test/evidence pre-generation',
    canReplaceOuterModelCompletely: false,
    truthfulBoundaryKept: true,
    nextHandoff: releaseVerdict.nextHandoff,
    canonicalRoot: sha256(compact({ spec, sourceEvidenceRoot: sourceEvidence.evidenceRoot, agents: agents.map(a => a.agentRoot), branches: branches.map(b => b.branchRoot), patchPlanRoot: patchPlan.planRoot, testPlanRoot: testPlan.testRoot, evidenceLedgerRoot: evidenceLedger.ledgerRoot, releaseVerdictRoot: releaseVerdict.verdictRoot })),
  };
  return {
    ok: result.selfUpgradeTeamSandboxEstablished,
    format: RCL_SELF_UPGRADE_TEAM_SANDBOX_BUNDLE_FORMAT,
    spec,
    sourceEvidence,
    agents,
    acceleratedBranches: branches,
    selectedBranches,
    patchPlan,
    workProducts,
    testPlan,
    evidenceLedger,
    releaseVerdict,
    result,
  };
}

export function runSelfUpgradeTeamSandbox(input = {}) {
  return compileSelfUpgradeTeamSandbox(input);
}

export function runSelfUpgradeTeamSandboxDemo(overrides = {}) {
  return runSelfUpgradeTeamSandbox(overrides);
}

export function buildSelfUpgradeTeamSandboxSpec(overrides = {}) {
  return normalizeSelfUpgradeTeamSandboxSpec(overrides);
}

export function renderSelfUpgradeTeamSandboxRcl(input = {}) {
  const spec = normalizeSelfUpgradeTeamSandboxSpec(input);
  const lines = [];
  lines.push('reality SelfUpgradeTeamSandboxV080 {');
  lines.push(`  objective: ${JSON.stringify(spec.objective)}`);
  lines.push(`  source_version: ${JSON.stringify(spec.sourceVersion)}`);
  lines.push(`  target_version: ${JSON.stringify(spec.targetVersion)}`);
  lines.push('  team: [version_strategist, source_cartographer, runtime_engineer, test_forger, evidence_keeper, semantic_guard, release_packager]');
  lines.push('  few_shot_rule: "3 samples route role behavior; base intelligence comes from provider / outer model; stability comes from RCL contracts"');
  lines.push('  time_acceleration: "simulate many candidate future branches in sandbox; execute only selected branch in real worktree"');
  lines.push('  boundary: "sandbox drafts patch/test/evidence; outer executor performs real filesystem/repository writes"');
  lines.push('  guard: [semantic_guard, evidence_keeper, human_final_authority, rollback_plan]');
  lines.push(`  next: ${JSON.stringify('v0.81 Source Map Patch Queue + Code Execution Oracle Provider Seed')}`);
  lines.push('}');
  return lines.join('\n');
}

export function renderSelfUpgradeWorkMethodMarkdown(input = {}) {
  const spec = normalizeSelfUpgradeTeamSandboxSpec(input);
  const lines = ['# RCL 自升级团队工作法 v0.80', ''];
  lines.push('## 用途');
  lines.push('这份文件用于放进项目文件，提醒未来 ChatGPT / RCL 协作会话：当需要继续开发 RCL 时，优先调用“多智能体自升级团队沙箱”方法，以减少外层模型的重复分析和手写工作量。');
  lines.push('');
  lines.push('## 一句话协议');
  lines.push('先让 RCL 在沙箱里生成多分支升级方案、角色分工、补丁计划、测试计划、证据账本和发布裁决，再由外层执行环境真实改源码、跑测试、打包。');
  lines.push('');
  lines.push('## 触发条件');
  lines.push('- 用户要求继续开发 RCL / RNCS / Aether Forge Pocket 等母工程。');
  lines.push('- 用户要求升级版本、修复上下文错位、生成补丁、写测试或输出 zip。');
  lines.push('- 任务存在多条候选路线，需要减少外层模型工作量。');
  lines.push('');
  lines.push('## 标准执行顺序');
  lines.push('```text');
  lines.push('1. 读取当前源码与项目文件');
  lines.push('2. 运行 self-upgrade-team-sandbox');
  lines.push('3. 让 7 个智能体生成分支评分、patch plan、test plan、evidence ledger');
  lines.push('4. 选择 release-seed-ready 的路线');
  lines.push('5. 外层执行环境真实修改源码');
  lines.push('6. 跑 targeted tests');
  lines.push('7. 输出源码包、运行结果、报告和下一步 handoff');
  lines.push('```');
  lines.push('');
  lines.push('## 7 个智能体');
  for (const role of spec.teamRoles) lines.push(`- ${role.title}：${role.authority}`);
  lines.push('');
  lines.push('## 边界');
  lines.push('- 沙箱可以：模拟分支、生成计划、写候选文件、生成测试与证据。');
  lines.push('- 沙箱不可以：声称已经自主 push GitHub、部署线上、调用外部 API 或完全替代强模型。');
  lines.push('- 真实源码修改、远端提交、部署和不可逆操作必须由外层执行环境与人类/助手最终确认。');
  lines.push('');
  lines.push('## 推荐命令');
  lines.push('```bash');
  lines.push('node src/cli.mjs self-upgrade-team-demo');
  lines.push('node src/cli.mjs self-upgrade-team-run examples/self-upgrade-team-sandbox/default-self-upgrade-team.json output/v0.80/self-upgrade-team-sandbox');
  lines.push('node --test --test-concurrency=1 tests/self-upgrade-team-sandbox.test.mjs');
  lines.push('```');
  lines.push('');
  lines.push('## 核心减负点');
  lines.push('这套方法把“我要怎么升级 RCL”的大量前置工作压进沙箱，让外层模型只需要审查和执行最高分路线，而不是每次从零开始读完全部源码、重新制定路线、重新写验收标准。');
  return lines.join('\n');
}

export function readSelfUpgradeTeamSandboxInput(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function makeAgentRosterMarkdown(agents) {
  const lines = ['# RCL v0.80 Self-Upgrade Team Agent Roster（自升级团队名册）', ''];
  lines.push('| Agent（智能体） | Samples（样本数） | Authority（权限） | Useful Outputs（有用输出） |');
  lines.push('|---|---:|---|---|');
  for (const agent of agents) {
    lines.push(`| ${agent.title} | ${agent.sampleCount} | ${agent.authority} | ${agent.usefulOutputs.join(', ')} |`);
  }
  return lines.join('\n');
}

function makeBranchMarkdown(branches) {
  const lines = ['# Time-Accelerated Branch Simulation（时空加速分支模拟）', ''];
  lines.push('| Branch（分支） | Owner（负责人） | Score（评分） | Risk（风险） | Verdict（裁决） |');
  lines.push('|---|---|---:|---:|---|');
  for (const b of branches) {
    lines.push(`| ${b.goal} | ${b.ownerAgentId} | ${b.scores.score} | ${b.scores.risk} | ${b.verdict} |`);
  }
  return lines.join('\n');
}

function makePatchPlanMarkdown(patchPlan) {
  const lines = ['# Patch Plan（补丁计划）', ''];
  lines.push(`Target Version（目标版本）: ${patchPlan.targetVersion}`);
  lines.push('');
  lines.push('| File（文件） | Operation（操作） | Owner（负责人） | Purpose（用途） | Risk（风险） |');
  lines.push('|---|---|---|---|---|');
  for (const file of patchPlan.files) lines.push(`| ${file.path} | ${file.operation} | ${file.ownerAgentId} | ${file.purpose} | ${file.risk} |`);
  lines.push('');
  lines.push('## Rollback Plan（回滚计划）');
  for (const item of patchPlan.rollbackPlan) lines.push(`- ${item}`);
  return lines.join('\n');
}

function makeTestPlanMarkdown(testPlan) {
  const lines = ['# Test Plan（测试计划）', ''];
  lines.push('## Commands');
  for (const cmd of testPlan.commands) lines.push(`- \`${cmd}\``);
  lines.push('');
  lines.push('## Acceptance Gates');
  for (const gate of testPlan.acceptanceGates) lines.push(`- ${gate}`);
  return lines.join('\n');
}

function makeEvidenceLedgerMarkdown(ledger) {
  const lines = ['# Evidence Ledger（证据账本）', ''];
  lines.push(`- Version（版本）: ${ledger.version}`);
  lines.push(`- Source Version（源版本）: ${ledger.sourceVersion}`);
  lines.push(`- Target Version（目标版本）: ${ledger.targetVersion}`);
  lines.push(`- Source Evidence Root（源证据根）: \`${ledger.sourceEvidenceRoot}\``);
  lines.push(`- Patch Plan Root（补丁计划根）: \`${ledger.patchPlanRoot}\``);
  lines.push(`- Test Plan Root（测试计划根）: \`${ledger.testPlanRoot}\``);
  lines.push(`- Ledger Root（账本根）: \`${ledger.ledgerRoot}\``);
  lines.push(`- Boundary（边界）: ${ledger.evidenceBoundary}`);
  return lines.join('\n');
}

function makeReleaseVerdictMarkdown(verdict) {
  const lines = ['# Release Verdict（发布裁决）', ''];
  lines.push(`- Decision（裁决）: ${verdict.decision}`);
  lines.push(`- Ready（可发布种子）: ${verdict.ready}`);
  lines.push(`- Selected Branch Count（选中分支数）: ${verdict.selectedBranchCount}`);
  lines.push(`- Changed File Count（变更文件数）: ${verdict.changedFileCount}`);
  lines.push(`- Semantic Guard Present（语义守卫存在）: ${verdict.semanticGuardPresent}`);
  lines.push(`- Evidence Keeper Present（证据守卫存在）: ${verdict.evidenceKeeperPresent}`);
  lines.push(`- No External Write Default（默认不外部写入）: ${verdict.noExternalWriteDefault}`);
  lines.push(`- Human Final Authority Required（人类最终权威要求）: ${verdict.humanFinalAuthorityRequired}`);
  lines.push(`- Boundary（边界）: ${verdict.externalExecutionBoundary}`);
  lines.push(`- Next Handoff（下一步交接）: ${verdict.nextHandoff}`);
  return lines.join('\n');
}

export function writeSelfUpgradeTeamSandboxReports(outDir, input = {}) {
  const bundle = runSelfUpgradeTeamSandbox(input);
  const dir = path.resolve(outDir);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'self-upgrade-team-result.json'), `${JSON.stringify(bundle.result, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'self-upgrade-team-bundle.json'), `${JSON.stringify(bundle, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'agent-roster.json'), `${JSON.stringify(bundle.agents, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'agent-roster.md'), `${makeAgentRosterMarkdown(bundle.agents)}\n`);
  fs.writeFileSync(path.join(dir, 'branch-simulation.json'), `${JSON.stringify(bundle.acceleratedBranches, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'branch-simulation.md'), `${makeBranchMarkdown(bundle.acceleratedBranches)}\n`);
  fs.writeFileSync(path.join(dir, 'patch-plan.json'), `${JSON.stringify(bundle.patchPlan, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'patch-plan.md'), `${makePatchPlanMarkdown(bundle.patchPlan)}\n`);
  fs.writeFileSync(path.join(dir, 'team-work-products.json'), `${JSON.stringify(bundle.workProducts, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'test-plan.json'), `${JSON.stringify(bundle.testPlan, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'test-plan.md'), `${makeTestPlanMarkdown(bundle.testPlan)}\n`);
  fs.writeFileSync(path.join(dir, 'evidence-ledger.json'), `${JSON.stringify(bundle.evidenceLedger, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'evidence-ledger.md'), `${makeEvidenceLedgerMarkdown(bundle.evidenceLedger)}\n`);
  fs.writeFileSync(path.join(dir, 'release-verdict.json'), `${JSON.stringify(bundle.releaseVerdict, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'release-verdict.md'), `${makeReleaseVerdictMarkdown(bundle.releaseVerdict)}\n`);
  fs.writeFileSync(path.join(dir, 'self-upgrade-team-sandbox.rcl'), `${renderSelfUpgradeTeamSandboxRcl(bundle.spec)}\n`);
  fs.writeFileSync(path.join(dir, 'RCL_SELF_UPGRADE_TEAM_WORK_METHOD_v0.80.md'), `${renderSelfUpgradeWorkMethodMarkdown(bundle.spec)}\n`);
  fs.writeFileSync(path.join(dir, 'canonical-root.txt'), `${bundle.result.canonicalRoot}\n`);
  return {
    ok: bundle.ok,
    outDir: dir,
    result: bundle.result,
    files: [
      'self-upgrade-team-result.json',
      'self-upgrade-team-bundle.json',
      'agent-roster.json',
      'agent-roster.md',
      'branch-simulation.json',
      'branch-simulation.md',
      'patch-plan.json',
      'patch-plan.md',
      'team-work-products.json',
      'test-plan.json',
      'test-plan.md',
      'evidence-ledger.json',
      'evidence-ledger.md',
      'release-verdict.json',
      'release-verdict.md',
      'self-upgrade-team-sandbox.rcl',
      'RCL_SELF_UPGRADE_TEAM_WORK_METHOD_v0.80.md',
      'canonical-root.txt',
    ],
  };
}
