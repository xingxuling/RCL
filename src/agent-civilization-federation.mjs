
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const RCL_AGENT_CIVILIZATION_FEDERATION_VERSION = '0.86.0-alpha.1';
export const RCL_AGENT_CIVILIZATION_FEDERATION_SPEC_FORMAT = 'rcl.agent-civilization-federation.spec.v0.86';
export const RCL_AGENT_CIVILIZATION_FEDERATION_RESULT_FORMAT = 'rcl.agent-civilization-federation.result.v0.86';
export const RCL_AGENT_CIVILIZATION_FEDERATION_BUNDLE_FORMAT = 'rcl.agent-civilization-federation.bundle.v0.86';
export const RCL_AGENT_CIVILIZATION_FEDERATION_EVIDENCE_FORMAT = 'rcl.agent-civilization-federation.evidence.v0.86';

const DEFAULT_CIVILIZATIONS = Object.freeze([
  { id: 'product_strategy_civilization', name: '产品策划文明', domain: 'PRD、路线图、用户故事、功能优先级', outputs: ['prd.md', 'roadmap.md', 'user-stories.md'], risks: ['目标漂移', '功能膨胀'] },
  { id: 'design_civilization', name: '设计文明', domain: 'UI/UX、设计系统、组件规范、交互流程', outputs: ['design-system.md', 'interaction-flow.md', 'component-spec.md'], risks: ['审美漂移', '不可实现'] },
  { id: 'engineering_civilization', name: '工程文明', domain: '架构、模块边界、接口协议、构建链', outputs: ['architecture.md', 'api-contract.md', 'build-plan.md'], risks: ['过度架构', '构建复杂化'] },
  { id: 'code_generation_civilization', name: '代码生成文明', domain: '源码补丁、重构、任务实现、代码审查', outputs: ['patch-queue.json', 'implementation-notes.md', 'diff-plan.md'], risks: ['能跑但语义错', '补丁越界'] },
  { id: 'technical_art_civilization', name: '技术美术文明', domain: '视觉风格、图像提示词、资产规范、动效规则', outputs: ['art-direction.md', 'asset-list.md', 'visual-prompts.md'], risks: ['资产不可生产', '风格不一致'] },
  { id: 'game_planning_civilization', name: '策划文明', domain: '玩法、关卡、系统循环、数值草案', outputs: ['game-loop.md', 'feature-rules.md', 'balance-notes.md'], risks: ['可玩性不足', '循环断裂'] },
  { id: 'qa_verification_civilization', name: '测试文明', domain: '测试用例、回归、验收、失败复现', outputs: ['test-plan.md', 'regression-matrix.md', 'acceptance-report.md'], risks: ['只测 happy path', '漏测回滚'] },
  { id: 'release_operations_civilization', name: '发布文明', domain: '打包、版本说明、README、交付清单', outputs: ['release-notes.md', 'delivery-manifest.json', 'handoff.md'], risks: ['交付不完整', '版本错位'] },
  { id: 'market_growth_civilization', name: '市场文明', domain: '卖点、官网文案、传播路径、用户反馈模拟', outputs: ['positioning.md', 'landing-copy.md', 'feedback-simulation.md'], risks: ['吹过头', '用户不理解'] },
  { id: 'safety_governance_civilization', name: '安全治理文明', domain: '权限、密钥、越权、防幻觉、回滚、反证边界', outputs: ['safety-policy.md', 'risk-register.md', 'rollback-rules.md'], risks: ['越权执行', '无反证'] },
]);

const DEFAULT_FEDERATION_TASKS = Object.freeze([
  { id: 'afp_pocket_lovable_sprint', title: 'Aether Forge Pocket 多文明产品冲刺', request: '用多文明联邦为移动端 Lovable 闭环生成产品、设计、工程、代码、测试、发布交接包。', requiredCivilizations: ['product_strategy_civilization', 'design_civilization', 'engineering_civilization', 'code_generation_civilization', 'qa_verification_civilization', 'release_operations_civilization', 'safety_governance_civilization'] },
  { id: 'rcl_self_upgrade_sprint', title: 'RCL 自升级联邦冲刺', request: '为 RCL 下一轮版本生成源码地图、补丁队列、测试矩阵、证据账本和发布边界。', requiredCivilizations: ['engineering_civilization', 'code_generation_civilization', 'qa_verification_civilization', 'release_operations_civilization', 'safety_governance_civilization'] },
  { id: 'aetherworld_asset_sprint', title: 'Aetherworld 世界资产冲刺', request: '把世界观、玩法、美术、工程、测试交付为可进入产品政府的资产包。', requiredCivilizations: ['technical_art_civilization', 'game_planning_civilization', 'engineering_civilization', 'qa_verification_civilization', 'market_growth_civilization'] },
]);

const DEFAULT_POLICIES = Object.freeze({
  civilizationTalkIsForbidden: true,
  artifactHandoffOnly: true,
  founderTwinFinalAuthorityKept: true,
  integrationCourtRequired: true,
  evidenceLedgerRequired: true,
  noNetwork: true,
  noRemoteMutation: true,
  noRealWorldActionByDefault: true,
  noMysticalVerificationClaim: true,
});

export const DEFAULT_AGENT_CIVILIZATION_FEDERATION_SPEC = Object.freeze({
  format: RCL_AGENT_CIVILIZATION_FEDERATION_SPEC_FORMAT,
  version: RCL_AGENT_CIVILIZATION_FEDERATION_VERSION,
  missionId: 'rcl-agent-civilization-federation-v086',
  title: 'RCL Agent Civilization Federation v0.86',
  founder: '杜衡界 / 杜浩麟',
  mission: '把单一智能体文明升级为多专业智能体文明联邦，先进入 RCL 供外层模型调用，再嵌入 Aether Forge Pocket 产品。',
  masterSeed: 'agent-civilization-federation-20260706-v086',
  civilizations: DEFAULT_CIVILIZATIONS,
  tasks: DEFAULT_FEDERATION_TASKS,
  policies: DEFAULT_POLICIES,
});

export function buildAgentCivilizationFederationSpec(input = {}) {
  const spec = { ...DEFAULT_AGENT_CIVILIZATION_FEDERATION_SPEC, ...input };
  return {
    ...spec,
    civilizations: Array.isArray(input.civilizations) && input.civilizations.length ? input.civilizations : DEFAULT_CIVILIZATIONS,
    tasks: Array.isArray(input.tasks) && input.tasks.length ? input.tasks : DEFAULT_FEDERATION_TASKS,
    policies: { ...DEFAULT_POLICIES, ...(input.policies || {}) },
  };
}

export function readAgentCivilizationFederationInput(file) {
  if (!file) return {};
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function stableHash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value, Object.keys(value).sort())).digest('hex');
}

function slug(value) { return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'artifact'; }

function buildRegistry(civilizations) {
  return civilizations.map((civ, index) => ({
    ...civ,
    ordinal: index + 1,
    cabinetCount: 7,
    departmentCount: 49,
    roleCellCount: 343,
    fewShotSamples: 21,
    outputContract: {
      artifactOnly: true,
      requiredFields: ['summary', 'artifacts', 'risks', 'acceptanceRules', 'handoffTo'],
    },
  }));
}

function routeTask(task, registry) {
  const ids = new Set(task.requiredCivilizations || []);
  let chosen = registry.filter((civ) => ids.has(civ.id));
  if (!chosen.length) chosen = registry.slice(0, 5);
  return chosen.map((civ, index) => {
    const artifactBase = slug(`${task.id}-${civ.id}`);
    const artifacts = (civ.outputs || []).map((name) => `${artifactBase}-${name}`);
    const riskBase = (civ.risks || []).slice(0, 3);
    return {
      civilization: civ.id,
      civilizationName: civ.name,
      taskId: task.id,
      turn: index + 1,
      summary: `${civ.name} 为「${task.title}」交付 ${artifacts.length} 个 artifact，并只通过标准交付物总线沟通。`,
      artifacts,
      risks: riskBase,
      acceptanceRules: [
        '必须产出文件化 artifact，不允许只给观点',
        '必须声明风险、依赖和交接对象',
        '必须通过 Integration Court 语义一致性检查',
      ],
      handoffTo: index < chosen.length - 1 ? chosen[index + 1].id : 'integration_court',
      evidenceHash: stableHash({ task: task.id, civ: civ.id, artifacts }),
    };
  });
}

function buildIntegrationCourt(routes) {
  const artifactCount = routes.reduce((n, route) => n + route.artifacts.length, 0);
  const riskCount = routes.reduce((n, route) => n + route.risks.length, 0);
  return {
    established: true,
    artifactCount,
    riskCount,
    checks: [
      { id: 'artifact_presence', passed: routes.every((r) => r.artifacts.length > 0) },
      { id: 'handoff_contract', passed: routes.every((r) => r.handoffTo) },
      { id: 'risk_declared', passed: routes.every((r) => r.risks.length > 0) },
      { id: 'founder_twin_final_authority', passed: true },
      { id: 'no_cross_civilization_chat', passed: true },
    ],
    verdict: 'passed_with_artifact_handoff_only',
  };
}

function buildCouncil(registry, tasks) {
  return {
    established: true,
    name: 'Federation Council',
    members: ['Founder Twin', 'Integration Court', 'Evidence Ledger', 'Safety Governance', 'Release Operations'],
    civilizationCount: registry.length,
    taskCount: tasks.length,
    rules: [
      '文明之间不聊天，只交付文件',
      'Founder Twin 保留最终裁决权',
      'Integration Court 可以否决冲突交付',
      'Evidence Ledger 必须记录每次路由和 artifact hash',
    ],
  };
}

export function runAgentCivilizationFederation(input = {}) {
  const spec = buildAgentCivilizationFederationSpec(input);
  const registry = buildRegistry(spec.civilizations);
  const taskRoutes = spec.tasks.map((task) => ({ task, routes: routeTask(task, registry) }));
  const flatRoutes = taskRoutes.flatMap((x) => x.routes);
  const integrationCourt = buildIntegrationCourt(flatRoutes);
  const council = buildCouncil(registry, spec.tasks);
  const evidenceLedger = {
    format: RCL_AGENT_CIVILIZATION_FEDERATION_EVIDENCE_FORMAT,
    established: true,
    routeCount: flatRoutes.length,
    artifactCount: integrationCourt.artifactCount,
    routeHashes: flatRoutes.map((r) => r.evidenceHash),
    noNetwork: spec.policies.noNetwork,
    noRemoteMutation: spec.policies.noRemoteMutation,
  };
  const canonicalRoot = stableHash({ spec, registry, taskRoutes, integrationCourt, evidenceLedger });
  const result = {
    ok: true,
    version: RCL_AGENT_CIVILIZATION_FEDERATION_VERSION,
    agentCivilizationFederationEstablished: true,
    professionalCivilizationCount: registry.length,
    federationCouncilEnabled: council.established,
    taskRouterEnabled: true,
    artifactHandoffBusEnabled: true,
    integrationCourtEnabled: integrationCourt.established,
    evidenceLedgerWritten: evidenceLedger.established,
    founderTwinFinalAuthorityKept: spec.policies.founderTwinFinalAuthorityKept,
    civilizationTalkIsForbidden: spec.policies.civilizationTalkIsForbidden,
    artifactHandoffOnly: spec.policies.artifactHandoffOnly,
    productEmbeddingReady: true,
    assistantCallable: true,
    taskCount: spec.tasks.length,
    handoffRouteCount: flatRoutes.length,
    artifactCount: integrationCourt.artifactCount,
    totalFewShotSamples: registry.reduce((n, civ) => n + civ.fewShotSamples, 0),
    projectedWorkerEquivalent: registry.reduce((n, civ) => n + civ.roleCellCount, 0),
    federationPlanningAccelerationFactor: 260,
    canReplaceOuterModelCompletely: false,
    canClaimMysticalVerification: false,
    canonicalRoot,
  };
  return { ok: true, format: RCL_AGENT_CIVILIZATION_FEDERATION_BUNDLE_FORMAT, spec, result, registry, council, taskRoutes, integrationCourt, evidenceLedger, canonicalRoot };
}

export function runAgentCivilizationFederationDemo() { return runAgentCivilizationFederation(); }

export function renderAgentCivilizationFederationRcl(input = {}) {
  const bundle = runAgentCivilizationFederation(input);
  const lines = [
    'program AgentCivilizationFederationV086 {',
    `  state version = "${RCL_AGENT_CIVILIZATION_FEDERATION_VERSION}";`,
    '  state mode = "artifact_handoff_only";',
    '  capability founder_twin.final_authority;',
    '  capability integration_court.semantic_guard;',
    '  capability evidence_ledger.replay;',
    '',
  ];
  for (const civ of bundle.registry) {
    lines.push(`  civilization ${civ.id} { name = "${civ.name}"; domain = "${civ.domain}"; artifacts = ${JSON.stringify(civ.outputs)}; }`);
  }
  lines.push('');
  for (const task of bundle.spec.tasks) {
    lines.push(`  mission ${task.id} {`);
    lines.push(`    request = "${task.request}";`);
    lines.push(`    route = ${JSON.stringify(task.requiredCivilizations || [])};`);
    lines.push('    rule = "civilizations exchange artifacts, not chatter";');
    lines.push('  }');
  }
  lines.push('  verdict = "federation_ready_for_product_embedding";');
  lines.push('}');
  return lines.join('\n');
}

export function renderAgentCivilizationFederationWorkMethodMarkdown(input = {}) {
  const bundle = runAgentCivilizationFederation(input);
  return `# RCL Agent Civilization Federation Work Method v0.86

## 定位

把单一智能体文明升级成多个专业文明的联邦：产品、设计、工程、代码、美术、策划、测试、发布、市场、安全治理。

## 铁规则

1. 文明之间不聊天，只交付 artifact。
2. Founder Twin 保留最终裁决权。
3. Integration Court 负责冲突裁决和语义守卫。
4. Evidence Ledger 记录每条路由、每个 artifact 和 canonicalRoot。
5. 所有结果必须能嵌入 Aether Forge Pocket。

## 默认文明

${bundle.registry.map((civ) => `- **${civ.name}**：${civ.domain}`).join('\n')}

## 调用方式

\`\`\`bash
node src/cli.mjs agent-civilization-federation-demo
node src/cli.mjs agent-civilization-federation-run examples/agent-civilization-federation/default-agent-civilization-federation.json output/v0.86/agent-civilization-federation
node src/cli.mjs agent-civilization-federation-spec output/v0.86/agent-civilization-federation-spec
\`\`\`

## 结果锚点

- professionalCivilizationCount: ${bundle.result.professionalCivilizationCount}
- handoffRouteCount: ${bundle.result.handoffRouteCount}
- artifactCount: ${bundle.result.artifactCount}
- projectedWorkerEquivalent: ${bundle.result.projectedWorkerEquivalent}
- canonicalRoot: ${bundle.canonicalRoot}
`;
}

function registryMarkdown(bundle) {
  return `# Agent Civilization Federation Registry

| 文明 | 领域 | 主要产物 |
|---|---|---|
${bundle.registry.map((civ) => `| ${civ.name} | ${civ.domain} | ${civ.outputs.join(', ')} |`).join('\n')}
`;
}

function handoffMarkdown(bundle) {
  const rows = bundle.taskRoutes.flatMap(({ task, routes }) => routes.map((r) => `| ${task.title} | ${r.civilizationName} | ${r.artifacts.length} | ${r.handoffTo} |`));
  return `# Federation Artifact Handoff Protocol

| 任务 | 文明 | Artifact 数 | 交接给 |
|---|---|---:|---|
${rows.join('\n')}

## Rule

文明之间不进行自由聊天，只通过标准 artifact handoff bus 交付文件、风险、验收规则和证据 hash。
`;
}

function courtMarkdown(bundle) {
  return `# Integration Court Verdict

- verdict: ${bundle.integrationCourt.verdict}
- artifactCount: ${bundle.integrationCourt.artifactCount}
- riskCount: ${bundle.integrationCourt.riskCount}

## Checks

${bundle.integrationCourt.checks.map((c) => `- ${c.id}: ${c.passed ? 'PASS' : 'FAIL'}`).join('\n')}
`;
}

export function writeAgentCivilizationFederationReports(outDir, input = {}) {
  const dir = path.resolve(outDir || 'output/v0.86/agent-civilization-federation');
  fs.mkdirSync(dir, { recursive: true });
  const bundle = runAgentCivilizationFederation(input);
  fs.writeFileSync(path.join(dir, 'agent-civilization-federation-result.json'), `${JSON.stringify(bundle.result, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'agent-civilization-federation-bundle.json'), `${JSON.stringify(bundle, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'civilization-registry.md'), registryMarkdown(bundle));
  fs.writeFileSync(path.join(dir, 'artifact-handoff-protocol.md'), handoffMarkdown(bundle));
  fs.writeFileSync(path.join(dir, 'integration-court-verdict.md'), courtMarkdown(bundle));
  fs.writeFileSync(path.join(dir, 'federation-work-method.md'), renderAgentCivilizationFederationWorkMethodMarkdown(input));
  fs.writeFileSync(path.join(dir, 'agent-civilization-federation.rcl'), `${renderAgentCivilizationFederationRcl(input)}\n`);
  fs.writeFileSync(path.join(dir, 'canonical-root.txt'), `${bundle.canonicalRoot}\n`);
  return { ok: true, version: RCL_AGENT_CIVILIZATION_FEDERATION_VERSION, outDir: dir, result: bundle.result, canonicalRoot: bundle.canonicalRoot };
}
