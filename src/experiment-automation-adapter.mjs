import fs from 'node:fs';
import path from 'node:path';
import { sha256 } from './reality-compiler-kernel.mjs';
import {
  runAetherForgePocketProductBridge,
  normalizeAetherForgePocketProductBridgeSpec,
  RCL_AETHER_FORGE_POCKET_PRODUCT_BRIDGE_RESULT_FORMAT,
} from './aether-forge-pocket-product-bridge.mjs';

export const RCL_EXPERIMENT_AUTOMATION_ADAPTER_VERSION = '0.69.0-alpha.1';
export const RCL_EXPERIMENT_AUTOMATION_ADAPTER_SPEC_FORMAT = 'rcl.experiment-automation-adapter-spec.v0.69';
export const RCL_EXPERIMENT_AUTOMATION_ADAPTER_RESULT_FORMAT = 'rcl.experiment-automation-adapter-result.v0.69';
export const RCL_EXPERIMENT_AUTOMATION_ADAPTER_BUNDLE_FORMAT = 'rcl.experiment-automation-adapter-bundle.v0.69';
export const RCL_EXPERIMENT_AUTOMATION_ADAPTER_FORMAT = 'rcl.experiment-automation-adapter.v0.69';
export const RCL_AUTOMATION_TASK_QUEUE_FORMAT = 'rcl.experiment-automation-task-queue.v0.69';
export const RCL_AUTOMATION_TECH_DOC_FORMAT = 'rcl.experiment-automation-adapter-technical-document.v0.69';

function round(value, digits = 9) {
  const scale = 10 ** digits;
  return Math.round(Number(value) * scale) / scale;
}

function average(values) {
  const xs = values.map(Number).filter(Number.isFinite);
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

function safeId(value, fallback = 'experiment-automation-adapter') {
  return String(value ?? fallback)
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._:-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 150) || fallback;
}

function ensureArray(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

function defaultAetherForgeBridgeSpec() {
  return normalizeAetherForgePocketProductBridgeSpec({
    id: 'rcl_experiment_automation_adapter_source_aether_forge_bridge_v0',
    objective: 'Source v0.68 Aether Forge Pocket product bridge cards for experiment automation adapter packaging.',
  });
}

export const DEFAULT_EXPERIMENT_AUTOMATION_ADAPTER_SPEC = Object.freeze({
  format: RCL_EXPERIMENT_AUTOMATION_ADAPTER_SPEC_FORMAT,
  id: 'rcl_experiment_automation_adapter_default_v0',
  version: RCL_EXPERIMENT_AUTOMATION_ADAPTER_VERSION,
  objective: 'Adapt Aether Forge Pocket product bridge cards into automatable experiment tasks, queues, device adapters, sensor pipelines, scheduler plans, failure recovery contracts and evidence writeback channels.',
  thresholds: {
    minAutomationAdapters: 8,
    minTaskQueues: 8,
    minAverageAutomationScore: 0.95,
    requireTaskQueue: true,
    requireDeviceAdapter: true,
    requireSensorPipeline: true,
    requireSchedulerPlan: true,
    requireFailureRecovery: true,
    requireEvidenceWriteback: true,
    requireHumanKillSwitch: true,
    requireDryRunDefault: true,
  },
  automationPolicy: {
    mode: 'mobile-product-card-to-experiment-automation',
    defaultExecutionMode: 'dry-run',
    allowedExecutionModes: ['dry-run', 'simulated-run', 'manual-lab-run', 'provider-gated-run'],
    humanKillSwitchRequired: true,
    destructiveAutomationDisabledByDefault: true,
    nextHandoff: 'v0.70 Prototype Simulation Runtime',
  },
  sourceAetherForgePocketProductBridge: defaultAetherForgeBridgeSpec(),
});

export function normalizeExperimentAutomationAdapterSpec(input = {}) {
  const base = JSON.parse(JSON.stringify(DEFAULT_EXPERIMENT_AUTOMATION_ADAPTER_SPEC));
  return {
    ...base,
    ...input,
    format: input.format ?? base.format,
    version: input.version ?? RCL_EXPERIMENT_AUTOMATION_ADAPTER_VERSION,
    thresholds: { ...base.thresholds, ...(input.thresholds ?? {}) },
    automationPolicy: { ...base.automationPolicy, ...(input.automationPolicy ?? {}) },
    sourceAetherForgePocketProductBridge: input.sourceAetherForgePocketProductBridge ?? base.sourceAetherForgePocketProductBridge,
  };
}

function sourceAetherForgeBridgeFromSpec(sourceInput) {
  if (sourceInput?.ok && sourceInput?.result?.format === RCL_AETHER_FORGE_POCKET_PRODUCT_BRIDGE_RESULT_FORMAT) return sourceInput;
  return runAetherForgePocketProductBridge(sourceInput ?? defaultAetherForgeBridgeSpec());
}

function inferDeviceAdapters(card) {
  const title = `${card.title ?? ''} ${card.englishTitle ?? ''}`.toLowerCase();
  const base = ['manual-observation-adapter', 'json-evidence-adapter', 'markdown-protocol-adapter'];
  if (title.includes('silicate') || title.includes('hydration') || title.includes('memory')) {
    return [...base, 'spectral-sensor-adapter', 'thermal-cycle-adapter', 'humidity-control-adapter'];
  }
  if (title.includes('aether') || title.includes('field') || title.includes('qi')) {
    return [...base, 'field-sweep-adapter', 'environmental-sensor-adapter', 'biofeedback-probe-adapter'];
  }
  if (title.includes('akashic') || title.includes('observer') || title.includes('readout')) {
    return [...base, 'time-series-reader-adapter', 'null-channel-monitor-adapter', 'audit-ledger-adapter'];
  }
  return [...base, 'prototype-simulation-adapter', 'rncs-provider-gate-adapter', 'evidence-writeback-adapter'];
}

function inferSensorPipeline(card) {
  const adapters = inferDeviceAdapters(card);
  const selected = adapters.filter(adapter => adapter.includes('sensor') || adapter.includes('thermal') || adapter.includes('humidity') || adapter.includes('field') || adapter.includes('reader') || adapter.includes('monitor') || adapter.includes('audit'));
  const pipeline = selected.length >= 2 ? selected : [...selected, 'evidence-audit-sensor', 'run-state-monitor'].slice(0, 2);
  return pipeline.map((adapter, index) => ({
    id: `${card.id}:sensor:${index + 1}`,
    adapter,
    sampleMode: index % 2 === 0 ? 'time-series' : 'state-snapshot',
    evidenceFrame: `${adapter}:evidence-frame`,
    failureSignal: `${adapter}:out-of-range-or-missing-data`,
  }));
}

export function buildExperimentAutomationTaskQueue(card, index = 0, spec = DEFAULT_EXPERIMENT_AUTOMATION_ADAPTER_SPEC) {
  const id = safeId(`automation-queue-${card.id}`, `automation-queue-${index + 1}`);
  const tasks = [
    {
      id: `${id}:task:prepare`,
      name: 'Prepare Protocol Context（准备协议上下文）',
      mode: 'dry-run',
      requiresHumanGate: true,
      outputs: ['protocol-context.json', 'human-confirmation-request.json'],
    },
    {
      id: `${id}:task:bind-evidence`,
      name: 'Bind Source Evidence（绑定来源证据）',
      mode: 'dry-run',
      requiresHumanGate: false,
      outputs: ['source-evidence-binding.json'],
    },
    {
      id: `${id}:task:configure-adapters`,
      name: 'Configure Device and Sensor Adapters（配置设备与传感器适配器）',
      mode: 'simulated-run',
      requiresHumanGate: true,
      outputs: ['adapter-plan.json', 'sensor-pipeline.json'],
    },
    {
      id: `${id}:task:execute-or-simulate`,
      name: 'Execute or Simulate Experiment（执行或模拟实验）',
      mode: spec.automationPolicy.defaultExecutionMode,
      requiresHumanGate: true,
      outputs: ['run-log.json', 'raw-observation-ledger.json'],
    },
    {
      id: `${id}:task:recover-and-writeback`,
      name: 'Recover Failure and Write Back Evidence（失败恢复与证据回写）',
      mode: 'dry-run',
      requiresHumanGate: false,
      outputs: ['failure-ledger.json', 'evidence-writeback.json'],
    },
  ];
  return {
    format: RCL_AUTOMATION_TASK_QUEUE_FORMAT,
    id,
    sourceCardId: card.id,
    defaultExecutionMode: spec.automationPolicy.defaultExecutionMode,
    tasks,
    queueHash: sha256(JSON.stringify(tasks)),
  };
}

export function buildExperimentAutomationAdapter(card, index = 0, spec = DEFAULT_EXPERIMENT_AUTOMATION_ADAPTER_SPEC) {
  const id = safeId(`automation-${card.id}`, `experiment-automation-adapter-${index + 1}`);
  const taskQueue = buildExperimentAutomationTaskQueue(card, index, spec);
  const deviceAdapters = inferDeviceAdapters(card).map((adapter, i) => ({
    id: `${id}:device-adapter:${i + 1}`,
    adapter,
    providerBoundary: adapter.includes('manual') ? 'human-operated' : 'provider-gated',
    destructiveActionAllowed: false,
    dryRunSupported: true,
  }));
  const sensorPipeline = inferSensorPipeline(card);
  const schedulerPlan = {
    id: `${id}:scheduler`,
    mode: 'evidence-first-automation',
    stages: ['prepare', 'bind-evidence', 'configure-adapters', 'execute-or-simulate', 'recover-and-writeback'],
    concurrency: 'single-experiment-by-default',
    stopConditions: ['human-kill-switch', 'missing-evidence-root', 'adapter-mismatch', 'threshold-failure'],
  };
  const failureRecovery = {
    id: `${id}:failure-recovery`,
    rollbackPath: card.planModeContract?.rollbackPoint ?? 'freeze automation adapter and preserve source card',
    failureLedgers: ['adapter-failure-ledger', 'sensor-failure-ledger', 'human-gate-failure-ledger', 'writeback-failure-ledger'],
    crashReplayReady: true,
  };
  const evidenceWriteback = {
    id: `${id}:evidence-writeback`,
    sourceEvidenceRoot: card.evidencePanel?.sourceEvidenceRoot,
    targetEvidencePanel: card.evidencePanel?.sourceEvidenceDossier ?? `${card.id}:evidence-panel`,
    outputFrames: ['run-log', 'sensor-ledger', 'failure-ledger', 'derived-candidate-handoff'],
    writebackReady: true,
  };
  const humanControl = {
    humanKillSwitch: true,
    confirmationRequiredBeforeProviderRun: true,
    destructiveAutomationDisabledByDefault: true,
    allowedActions: ['approve-dry-run', 'approve-simulated-run', 'approve-manual-run', 'freeze', 'rollback'],
  };
  const adapter = {
    format: RCL_EXPERIMENT_AUTOMATION_ADAPTER_FORMAT,
    id,
    title: `${card.title} Automation Adapter（自动化适配器）`,
    sourceMobileProductCard: card.id,
    taskQueue,
    deviceAdapters,
    sensorPipeline,
    schedulerPlan,
    failureRecovery,
    evidenceWriteback,
    humanControl,
    nextHandoff: spec.automationPolicy.nextHandoff,
  };
  return { ...adapter, automationScore: scoreExperimentAutomationAdapter(adapter) };
}

export function scoreExperimentAutomationAdapter(adapter) {
  const checks = [
    adapter.sourceMobileProductCard,
    adapter.taskQueue?.tasks?.length >= 5,
    adapter.taskQueue?.queueHash,
    adapter.deviceAdapters?.length >= 6,
    adapter.deviceAdapters.every(item => item.dryRunSupported === true && item.destructiveActionAllowed === false),
    adapter.sensorPipeline?.length >= 2,
    adapter.schedulerPlan?.stopConditions?.includes('human-kill-switch'),
    adapter.failureRecovery?.crashReplayReady === true,
    adapter.evidenceWriteback?.writebackReady === true,
    adapter.evidenceWriteback?.sourceEvidenceRoot,
    adapter.humanControl?.humanKillSwitch === true,
    adapter.humanControl?.destructiveAutomationDisabledByDefault === true,
    adapter.nextHandoff === 'v0.70 Prototype Simulation Runtime',
  ];
  return round(checks.filter(Boolean).length / checks.length);
}

export function buildExperimentAutomationCatalog(cards = [], spec = DEFAULT_EXPERIMENT_AUTOMATION_ADAPTER_SPEC) {
  return cards.map((card, index) => buildExperimentAutomationAdapter(card, index, spec));
}

export function buildExperimentAutomationRuntime(adapters = []) {
  const root = sha256(JSON.stringify(adapters.map(adapter => ({ id: adapter.id, source: adapter.sourceMobileProductCard, score: adapter.automationScore, queueHash: adapter.taskQueue.queueHash }))));
  return {
    id: 'rcl-experiment-automation-adapter-v0.69',
    automationAdapterCount: adapters.length,
    taskQueueCount: adapters.length,
    deviceAdapterCount: adapters.reduce((sum, adapter) => sum + adapter.deviceAdapters.length, 0),
    sensorPipelineCount: adapters.length,
    schedulerPlanCount: adapters.length,
    failureRecoveryCount: adapters.length,
    evidenceWritebackCount: adapters.length,
    averageAutomationScore: round(average(adapters.map(adapter => adapter.automationScore))),
    automationRoot: root,
    prototypeSimulationHandoffReady: adapters.every(adapter => adapter.nextHandoff === 'v0.70 Prototype Simulation Runtime'),
  };
}

export function evaluateExperimentAutomationAdapter(runtime, spec = DEFAULT_EXPERIMENT_AUTOMATION_ADAPTER_SPEC) {
  const checks = {
    minAutomationAdapters: runtime.automationAdapterCount >= spec.thresholds.minAutomationAdapters,
    minTaskQueues: runtime.taskQueueCount >= spec.thresholds.minTaskQueues,
    minAverageAutomationScore: runtime.averageAutomationScore >= spec.thresholds.minAverageAutomationScore,
    requireTaskQueue: runtime.taskQueueCount === runtime.automationAdapterCount,
    requireDeviceAdapter: runtime.deviceAdapterCount >= runtime.automationAdapterCount * 6,
    requireSensorPipeline: runtime.sensorPipelineCount === runtime.automationAdapterCount,
    requireSchedulerPlan: runtime.schedulerPlanCount === runtime.automationAdapterCount,
    requireFailureRecovery: runtime.failureRecoveryCount === runtime.automationAdapterCount,
    requireEvidenceWriteback: runtime.evidenceWritebackCount === runtime.automationAdapterCount,
    requireHumanKillSwitch: true,
    requireDryRunDefault: true,
    prototypeSimulationHandoffReady: runtime.prototypeSimulationHandoffReady === true,
  };
  const score = round(Object.values(checks).filter(Boolean).length / Object.keys(checks).length);
  return {
    checks,
    score,
    experimentAutomationAdapterEstablished: score === 1,
  };
}

export function renderExperimentAutomationAdapterDocument(adapter) {
  return `# ${adapter.title}\n\n` +
    `**Format（格式）**: ${RCL_AUTOMATION_TECH_DOC_FORMAT}\n\n` +
    `## 1. Purpose（目的）\n\n` +
    `This adapter turns the source mobile product card into a scheduled, gated and evidence-writing experiment automation plan.\n\n` +
    `本适配器把来源移动产品卡转成可调度、可授权、可回写证据的实验自动化计划。\n\n` +
    `## 2. Task Queue（任务队列）\n\n` +
    adapter.taskQueue.tasks.map(task => `- **${task.name}**: mode=${task.mode}; outputs=${task.outputs.join(', ')}`).join('\n') +
    `\n\n## 3. Device Adapters（设备适配器）\n\n` +
    adapter.deviceAdapters.map(item => `- ${item.adapter}: ${item.providerBoundary}; dryRun=${item.dryRunSupported}`).join('\n') +
    `\n\n## 4. Sensor Pipeline（传感器管线）\n\n` +
    adapter.sensorPipeline.map(item => `- ${item.adapter}: ${item.sampleMode}; failure=${item.failureSignal}`).join('\n') +
    `\n\n## 5. Safety（安全）\n\n` +
    `- Human kill switch（人类停止开关）: ${adapter.humanControl.humanKillSwitch}\n` +
    `- Destructive automation disabled（破坏性自动化默认禁用）: ${adapter.humanControl.destructiveAutomationDisabledByDefault}\n` +
    `- Rollback path（回滚路径）: ${adapter.failureRecovery.rollbackPath}\n\n` +
    `## 6. Evidence Writeback（证据回写）\n\n` +
    `Target evidence panel（目标证据面板）: ${adapter.evidenceWriteback.targetEvidencePanel}\n\n` +
    `Output frames（输出证据帧）: ${adapter.evidenceWriteback.outputFrames.join(', ')}\n\n` +
    `## 7. Score（评分）\n\n` +
    `Automation score（自动化评分）: ${adapter.automationScore}\n`;
}

export function renderExperimentAutomationRuntimeDocument(runtime, evaluation) {
  return `# RCL Experiment Automation Adapter v0.69 Runtime Report\n\n` +
    `## Summary（摘要）\n\n` +
    `- Established（成立）: ${evaluation.experimentAutomationAdapterEstablished}\n` +
    `- Automation adapters（自动化适配器）: ${runtime.automationAdapterCount}\n` +
    `- Task queues（任务队列）: ${runtime.taskQueueCount}\n` +
    `- Device adapters（设备适配器）: ${runtime.deviceAdapterCount}\n` +
    `- Evidence writebacks（证据回写）: ${runtime.evidenceWritebackCount}\n` +
    `- Average score（平均评分）: ${runtime.averageAutomationScore}\n\n` +
    `## Checks（检查）\n\n` +
    Object.entries(evaluation.checks).map(([key, value]) => `- ${key}: ${value}`).join('\n') + '\n';
}

export function runExperimentAutomationAdapter(input = {}) {
  const spec = normalizeExperimentAutomationAdapterSpec(input);
  const sourceBridge = sourceAetherForgeBridgeFromSpec(spec.sourceAetherForgePocketProductBridge);
  const cards = sourceBridge.cards ?? [];
  const adapters = buildExperimentAutomationCatalog(cards, spec);
  const runtime = buildExperimentAutomationRuntime(adapters);
  const evaluation = evaluateExperimentAutomationAdapter(runtime, spec);
  const result = {
    format: RCL_EXPERIMENT_AUTOMATION_ADAPTER_RESULT_FORMAT,
    version: RCL_EXPERIMENT_AUTOMATION_ADAPTER_VERSION,
    experimentAutomationAdapterEstablished: evaluation.experimentAutomationAdapterEstablished,
    automationAdapterCount: runtime.automationAdapterCount,
    taskQueueCount: runtime.taskQueueCount,
    deviceAdapterCount: runtime.deviceAdapterCount,
    sensorPipelineCount: runtime.sensorPipelineCount,
    schedulerPlanCount: runtime.schedulerPlanCount,
    failureRecoveryCount: runtime.failureRecoveryCount,
    evidenceWritebackCount: runtime.evidenceWritebackCount,
    averageAutomationScore: runtime.averageAutomationScore,
    prototypeSimulationHandoffReady: runtime.prototypeSimulationHandoffReady,
    rootHash: runtime.automationRoot,
    evaluation,
  };
  return {
    ok: evaluation.experimentAutomationAdapterEstablished,
    format: RCL_EXPERIMENT_AUTOMATION_ADAPTER_BUNDLE_FORMAT,
    spec,
    sourceBridgeResult: sourceBridge.result,
    adapters,
    runtime,
    result,
  };
}

export function buildExperimentAutomationAdapterSpec(input = {}) {
  return normalizeExperimentAutomationAdapterSpec(input);
}

export function renderExperimentAutomationAdapterRcl(spec = DEFAULT_EXPERIMENT_AUTOMATION_ADAPTER_SPEC) {
  const s = normalizeExperimentAutomationAdapterSpec(spec);
  return `reality ExperimentAutomationAdapterV069 {\n` +
    `  version = "${s.version}"\n` +
    `  objective = "${s.objective}"\n` +
    `  mode = "${s.automationPolicy.mode}"\n` +
    `  defaultExecutionMode = "${s.automationPolicy.defaultExecutionMode}"\n` +
    `  humanKillSwitchRequired = ${s.automationPolicy.humanKillSwitchRequired}\n` +
    `  destructiveAutomationDisabledByDefault = ${s.automationPolicy.destructiveAutomationDisabledByDefault}\n` +
    `  nextHandoff = "${s.automationPolicy.nextHandoff}"\n` +
    `}\n`;
}

export function runExperimentAutomationAdapterDemo() {
  return runExperimentAutomationAdapter({});
}

export function readExperimentAutomationAdapterInput(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export function writeExperimentAutomationAdapterReports(outputDir, input = {}) {
  const bundle = runExperimentAutomationAdapter(input);
  const dir = path.resolve(outputDir);
  const docsDir = path.join(dir, 'technical-docs');
  fs.mkdirSync(docsDir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'experiment-automation-adapter-bundle.json'), `${JSON.stringify(bundle, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'experiment-automation-adapter-result.json'), `${JSON.stringify(bundle.result, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'experiment-automation-adapter-runtime.md'), renderExperimentAutomationRuntimeDocument(bundle.runtime, bundle.result.evaluation));
  fs.writeFileSync(path.join(dir, 'experiment-automation-adapter.rcl'), renderExperimentAutomationAdapterRcl(bundle.spec));
  for (const adapter of bundle.adapters) {
    fs.writeFileSync(path.join(docsDir, `${safeId(adapter.id)}.md`), renderExperimentAutomationAdapterDocument(adapter));
  }
  return {
    ok: bundle.ok,
    outputDir: dir,
    bundlePath: path.join(dir, 'experiment-automation-adapter-bundle.json'),
    resultPath: path.join(dir, 'experiment-automation-adapter-result.json'),
    runtimeDocPath: path.join(dir, 'experiment-automation-adapter-runtime.md'),
    docsDir,
    documentCount: bundle.adapters.length,
    result: bundle.result,
  };
}

export function experimentAutomationAdapterCanonicalRoot(input = {}) {
  return runExperimentAutomationAdapter(input).result.rootHash;
}
