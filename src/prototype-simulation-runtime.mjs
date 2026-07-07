import fs from 'node:fs';
import path from 'node:path';
import { sha256 } from './reality-compiler-kernel.mjs';
import {
  runExperimentAutomationAdapter,
  normalizeExperimentAutomationAdapterSpec,
  RCL_EXPERIMENT_AUTOMATION_ADAPTER_RESULT_FORMAT,
} from './experiment-automation-adapter.mjs';

export const RCL_PROTOTYPE_SIMULATION_RUNTIME_VERSION = '0.70.0-alpha.1';
export const RCL_PROTOTYPE_SIMULATION_RUNTIME_SPEC_FORMAT = 'rcl.prototype-simulation-runtime-spec.v0.70';
export const RCL_PROTOTYPE_SIMULATION_RUNTIME_RESULT_FORMAT = 'rcl.prototype-simulation-runtime-result.v0.70';
export const RCL_PROTOTYPE_SIMULATION_RUNTIME_BUNDLE_FORMAT = 'rcl.prototype-simulation-runtime-bundle.v0.70';
export const RCL_PROTOTYPE_SIMULATION_SCENARIO_FORMAT = 'rcl.prototype-simulation-scenario.v0.70';
export const RCL_PROTOTYPE_SIMULATION_TECH_DOC_FORMAT = 'rcl.prototype-simulation-runtime-technical-document.v0.70';

function round(value, digits = 9) {
  const scale = 10 ** digits;
  return Math.round(Number(value) * scale) / scale;
}

function average(values) {
  const xs = values.map(Number).filter(Number.isFinite);
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

function safeId(value, fallback = 'prototype-simulation-runtime') {
  return String(value ?? fallback)
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._:-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 150) || fallback;
}

function defaultExperimentAutomationSpec() {
  return normalizeExperimentAutomationAdapterSpec({
    id: 'rcl_prototype_simulation_source_experiment_automation_v0',
    objective: 'Source v0.69 experiment automation adapters for v0.70 prototype simulation runtime.',
    automationPolicy: { defaultExecutionMode: 'dry-run' },
  });
}

export const DEFAULT_PROTOTYPE_SIMULATION_RUNTIME_SPEC = Object.freeze({
  format: RCL_PROTOTYPE_SIMULATION_RUNTIME_SPEC_FORMAT,
  id: 'rcl_prototype_simulation_runtime_default_v0',
  version: RCL_PROTOTYPE_SIMULATION_RUNTIME_VERSION,
  objective: 'Simulate experiment automation adapters before execution; produce scenario models, perturbation plans, failure predictions, evidence forecasts, execution recommendations and real-world-data handoff contracts.',
  thresholds: {
    minSimulationScenarios: 8,
    minAverageSimulationScore: 0.95,
    requireScenarioModel: true,
    requirePerturbationModel: true,
    requireFailurePrediction: true,
    requireEvidenceForecast: true,
    requireExecutionRecommendation: true,
    requireHumanApprovalBeforeRealRun: true,
    requireRealWorldDataHandoff: true,
  },
  simulationPolicy: {
    mode: 'automation-adapter-to-prototype-simulation',
    simulationKinds: ['digital-twin', 'perturbation-sweep', 'failure-forecast', 'evidence-yield-estimate'],
    defaultSimulationMode: 'dry-simulation',
    destructiveRealRunDisabled: true,
    humanApprovalBeforeRealRun: true,
    nextHandoff: 'v0.71 Real World Data Ingestion Layer',
  },
  sourceExperimentAutomationAdapter: defaultExperimentAutomationSpec(),
});

export function normalizePrototypeSimulationRuntimeSpec(input = {}) {
  const base = JSON.parse(JSON.stringify(DEFAULT_PROTOTYPE_SIMULATION_RUNTIME_SPEC));
  return {
    ...base,
    ...input,
    format: input.format ?? base.format,
    version: input.version ?? RCL_PROTOTYPE_SIMULATION_RUNTIME_VERSION,
    thresholds: { ...base.thresholds, ...(input.thresholds ?? {}) },
    simulationPolicy: { ...base.simulationPolicy, ...(input.simulationPolicy ?? {}) },
    sourceExperimentAutomationAdapter: input.sourceExperimentAutomationAdapter ?? base.sourceExperimentAutomationAdapter,
  };
}

function sourceAutomationFromSpec(sourceInput) {
  if (sourceInput?.ok && sourceInput?.result?.format === RCL_EXPERIMENT_AUTOMATION_ADAPTER_RESULT_FORMAT) return sourceInput;
  return runExperimentAutomationAdapter(sourceInput ?? defaultExperimentAutomationSpec());
}

function inferDomain(adapter) {
  const text = `${adapter.title ?? ''} ${adapter.id ?? ''}`.toLowerCase();
  if (text.includes('silicate') || text.includes('hydration') || text.includes('memory')) return 'material-memory';
  if (text.includes('qi') || text.includes('aether') || text.includes('field')) return 'field-coupling';
  if (text.includes('akashic') || text.includes('observer') || text.includes('readout')) return 'observer-record';
  if (text.includes('formation') || text.includes('spatial')) return 'constraint-array';
  return 'general-prototype';
}

function buildStateVariables(domain) {
  const common = [
    { id: 'energy_budget', range: [0, 1], role: 'execution-bound' },
    { id: 'thermal_noise', range: [0, 1], role: 'disturbance' },
    { id: 'sensor_integrity', range: [0, 1], role: 'measurement-confidence' },
    { id: 'evidence_yield', range: [0, 1], role: 'evidence-output' },
  ];
  const byDomain = {
    'material-memory': [
      { id: 'lattice_order', range: [0, 1], role: 'memory-retention' },
      { id: 'hydration_phase', range: [0, 1], role: 'state-gate' },
      { id: 'defect_density', range: [0, 1], role: 'storage-medium' },
    ],
    'field-coupling': [
      { id: 'field_gradient', range: [0, 1], role: 'coupling-driver' },
      { id: 'biofeedback_alignment', range: [0, 1], role: 'receiver-fit' },
      { id: 'environmental_drift', range: [0, 1], role: 'background-noise' },
    ],
    'observer-record': [
      { id: 'null_channel_stability', range: [0, 1], role: 'silent-observation' },
      { id: 'temporal_trace_persistence', range: [0, 1], role: 'record-continuity' },
      { id: 'index_resonance', range: [0, 1], role: 'readout-addressing' },
    ],
    'constraint-array': [
      { id: 'spatial_constraint_closure', range: [0, 1], role: 'formation-integrity' },
      { id: 'node_phase_alignment', range: [0, 1], role: 'array-synchrony' },
      { id: 'boundary_leakage', range: [0, 1], role: 'failure-signal' },
    ],
    'general-prototype': [
      { id: 'mechanism_coherence', range: [0, 1], role: 'prototype-integrity' },
      { id: 'operator_variance', range: [0, 1], role: 'human-process-noise' },
      { id: 'provider_latency', range: [0, 1], role: 'execution-delay' },
    ],
  };
  return [...common, ...(byDomain[domain] ?? byDomain['general-prototype'])];
}

function buildPerturbationModel(domain, adapter) {
  const base = [
    { id: 'sensor_dropout', kind: 'measurement', severity: 0.25, expectedEffect: 'reduced evidence yield' },
    { id: 'thermal_drift', kind: 'environment', severity: 0.33, expectedEffect: 'noise amplification' },
    { id: 'human_gate_delay', kind: 'governance', severity: 0.2, expectedEffect: 'schedule slip' },
    { id: 'provider_unavailable', kind: 'provider', severity: 0.3, expectedEffect: 'fallback to dry simulation' },
  ];
  const domainSpecific = {
    'material-memory': [
      { id: 'hydration_cycle_jitter', kind: 'material', severity: 0.31, expectedEffect: 'phase-gate instability' },
      { id: 'lattice_defect_randomization', kind: 'material', severity: 0.28, expectedEffect: 'retention degradation' },
    ],
    'field-coupling': [
      { id: 'background_field_spike', kind: 'field', severity: 0.35, expectedEffect: 'false coupling event' },
      { id: 'biofeedback_desynchronization', kind: 'biological', severity: 0.27, expectedEffect: 'receiver mismatch' },
    ],
    'observer-record': [
      { id: 'null_channel_false_positive', kind: 'readout', severity: 0.29, expectedEffect: 'silent channel ambiguity' },
      { id: 'temporal_trace_aliasing', kind: 'time-series', severity: 0.34, expectedEffect: 'trace mis-indexing' },
    ],
    'constraint-array': [
      { id: 'spatial_node_misalignment', kind: 'geometry', severity: 0.32, expectedEffect: 'array closure loss' },
      { id: 'boundary_condition_swap', kind: 'constraint', severity: 0.3, expectedEffect: 'control group contamination' },
    ],
    'general-prototype': [
      { id: 'mechanism_parameter_drift', kind: 'model', severity: 0.28, expectedEffect: 'uncertain extrapolation' },
      { id: 'evidence_schema_mismatch', kind: 'data', severity: 0.25, expectedEffect: 'writeback rejection' },
    ],
  };
  const items = [...base, ...(domainSpecific[domain] ?? domainSpecific['general-prototype'])];
  return {
    id: `${adapter.id}:perturbation-model`,
    mode: 'bounded-perturbation-sweep',
    items,
    perturbationHash: sha256(JSON.stringify(items)),
  };
}

function buildFailurePrediction(adapter, domain, perturbationModel) {
  const criticalPerturbations = perturbationModel.items.filter(item => item.severity >= 0.3);
  const providerRisk = adapter.deviceAdapters?.some(item => item.providerBoundary === 'provider-gated') ? 0.18 : 0.08;
  const sensorRisk = (adapter.sensorPipeline?.length ?? 0) < 2 ? 0.35 : 0.12;
  const domainRisk = {
    'material-memory': 0.18,
    'field-coupling': 0.24,
    'observer-record': 0.22,
    'constraint-array': 0.2,
    'general-prototype': 0.17,
  }[domain] ?? 0.17;
  const compositeRisk = round(Math.min(1, average([providerRisk, sensorRisk, domainRisk, criticalPerturbations.length / 10])));
  return {
    id: `${adapter.id}:failure-prediction`,
    predictedFailureModes: [
      'sensor-evidence-insufficient',
      'perturbation-threshold-exceeded',
      'human-gate-not-approved',
      'provider-fallback-required',
    ],
    compositeRisk,
    riskClass: compositeRisk <= 0.25 ? 'low' : compositeRisk <= 0.45 ? 'medium' : 'high',
    recommendedMitigation: ['run dry simulation first', 'freeze destructive providers', 'capture baseline evidence', 'require human approval before real run'],
  };
}

function buildEvidenceForecast(adapter, domain, failurePrediction) {
  const expectedFrames = [
    'simulation-run-log',
    'perturbation-response-ledger',
    'predicted-failure-ledger',
    'evidence-yield-forecast',
    'execution-recommendation-card',
  ];
  const domainFrames = {
    'material-memory': ['lattice-order-forecast', 'hydration-phase-forecast'],
    'field-coupling': ['field-gradient-forecast', 'biofeedback-alignment-forecast'],
    'observer-record': ['null-channel-stability-forecast', 'temporal-trace-forecast'],
    'constraint-array': ['spatial-closure-forecast', 'node-phase-forecast'],
    'general-prototype': ['mechanism-coherence-forecast', 'provider-latency-forecast'],
  }[domain] ?? [];
  const confidence = round(1 - failurePrediction.compositeRisk * 0.5);
  return {
    id: `${adapter.id}:evidence-forecast`,
    expectedFrames: [...expectedFrames, ...domainFrames],
    expectedEvidenceYield: confidence,
    writebackTarget: adapter.evidenceWriteback?.targetEvidencePanel ?? `${adapter.id}:evidence-panel`,
    forecastHash: sha256(JSON.stringify([adapter.id, domain, expectedFrames, domainFrames, confidence])),
  };
}

function buildExecutionRecommendation(failurePrediction, evidenceForecast, spec) {
  let mode = 'ready-for-dry-simulation';
  if (failurePrediction.riskClass === 'medium') mode = 'dry-simulation-with-extra-controls';
  if (failurePrediction.riskClass === 'high') mode = 'freeze-real-run-and-expand-controls';
  return {
    id: `${evidenceForecast.id}:recommendation`,
    mode,
    realRunAllowed: false,
    realRunRequiresHumanApproval: spec.simulationPolicy.humanApprovalBeforeRealRun === true,
    nextStep: failurePrediction.riskClass === 'low' ? 'run simulated prototype and capture evidence forecast' : 'expand controls before provider-gated execution',
    nextHandoff: spec.simulationPolicy.nextHandoff,
  };
}

export function buildPrototypeSimulationScenario(adapter, index = 0, spec = DEFAULT_PROTOTYPE_SIMULATION_RUNTIME_SPEC) {
  const domain = inferDomain(adapter);
  const id = safeId(`prototype-simulation-${adapter.id}`, `prototype-simulation-${index + 1}`);
  const stateVariables = buildStateVariables(domain);
  const scenarioModel = {
    format: RCL_PROTOTYPE_SIMULATION_SCENARIO_FORMAT,
    id,
    sourceAutomationAdapter: adapter.id,
    domain,
    simulationMode: spec.simulationPolicy.defaultSimulationMode,
    stateVariables,
    timeline: ['initial-state', 'baseline-measurement', 'perturbation-sweep', 'failure-forecast', 'evidence-forecast', 'recommendation'],
    controls: ['blank-control', 'random-complexity-control', 'source-protocol-control'],
    scenarioHash: sha256(JSON.stringify([id, adapter.id, domain, stateVariables])),
  };
  const perturbationModel = buildPerturbationModel(domain, adapter);
  const failurePrediction = buildFailurePrediction(adapter, domain, perturbationModel);
  const evidenceForecast = buildEvidenceForecast(adapter, domain, failurePrediction);
  const executionRecommendation = buildExecutionRecommendation(failurePrediction, evidenceForecast, spec);
  const scenario = {
    ...scenarioModel,
    perturbationModel,
    failurePrediction,
    evidenceForecast,
    executionRecommendation,
    realWorldDataHandoff: {
      ready: executionRecommendation.nextHandoff === 'v0.71 Real World Data Ingestion Layer',
      requiredFrames: evidenceForecast.expectedFrames,
      schema: 'rcl.real-world-data-ingestion-frame.v0.71',
    },
  };
  return { ...scenario, simulationScore: scorePrototypeSimulationScenario(scenario, spec) };
}

export function scorePrototypeSimulationScenario(scenario, spec = DEFAULT_PROTOTYPE_SIMULATION_RUNTIME_SPEC) {
  const checks = [
    scenario.format === RCL_PROTOTYPE_SIMULATION_SCENARIO_FORMAT,
    scenario.stateVariables?.length >= 7,
    scenario.controls?.length >= 3,
    scenario.perturbationModel?.items?.length >= 6,
    scenario.perturbationModel?.perturbationHash,
    scenario.failurePrediction?.predictedFailureModes?.length >= 4,
    scenario.failurePrediction?.recommendedMitigation?.includes('require human approval before real run'),
    scenario.evidenceForecast?.expectedFrames?.length >= 7,
    scenario.evidenceForecast?.forecastHash,
    scenario.executionRecommendation?.realRunAllowed === false,
    scenario.executionRecommendation?.realRunRequiresHumanApproval === true,
    scenario.realWorldDataHandoff?.ready === true,
  ];
  return round(checks.filter(Boolean).length / checks.length);
}

export function buildPrototypeSimulationCatalog(adapters = [], spec = DEFAULT_PROTOTYPE_SIMULATION_RUNTIME_SPEC) {
  return adapters.map((adapter, index) => buildPrototypeSimulationScenario(adapter, index, spec));
}

export function buildPrototypeSimulationRuntime(scenarios = []) {
  const root = sha256(JSON.stringify(scenarios.map(s => ({ id: s.id, score: s.simulationScore, scenarioHash: s.scenarioHash, perturbationHash: s.perturbationModel.perturbationHash }))));
  return {
    id: 'rcl-prototype-simulation-runtime-v0.70',
    simulationScenarioCount: scenarios.length,
    perturbationModelCount: scenarios.length,
    failurePredictionCount: scenarios.length,
    evidenceForecastCount: scenarios.length,
    executionRecommendationCount: scenarios.length,
    realWorldDataHandoffCount: scenarios.filter(s => s.realWorldDataHandoff?.ready).length,
    averageSimulationScore: round(average(scenarios.map(s => s.simulationScore))),
    simulationRoot: root,
    realWorldDataIngestionHandoffReady: scenarios.every(s => s.realWorldDataHandoff?.ready),
  };
}

export function evaluatePrototypeSimulationRuntime(runtime, spec = DEFAULT_PROTOTYPE_SIMULATION_RUNTIME_SPEC) {
  const checks = {
    minSimulationScenarios: runtime.simulationScenarioCount >= spec.thresholds.minSimulationScenarios,
    minAverageSimulationScore: runtime.averageSimulationScore >= spec.thresholds.minAverageSimulationScore,
    requireScenarioModel: runtime.simulationScenarioCount > 0,
    requirePerturbationModel: runtime.perturbationModelCount === runtime.simulationScenarioCount,
    requireFailurePrediction: runtime.failurePredictionCount === runtime.simulationScenarioCount,
    requireEvidenceForecast: runtime.evidenceForecastCount === runtime.simulationScenarioCount,
    requireExecutionRecommendation: runtime.executionRecommendationCount === runtime.simulationScenarioCount,
    requireHumanApprovalBeforeRealRun: true,
    requireRealWorldDataHandoff: runtime.realWorldDataIngestionHandoffReady === true,
  };
  const score = round(Object.values(checks).filter(Boolean).length / Object.keys(checks).length);
  return { checks, score, prototypeSimulationRuntimeEstablished: score === 1 };
}

export function renderPrototypeSimulationScenarioDocument(scenario) {
  return `# ${scenario.id} Prototype Simulation Scenario（原型模拟场景）\n\n` +
    `**Format（格式）**: ${RCL_PROTOTYPE_SIMULATION_TECH_DOC_FORMAT}\n\n` +
    `## 1. Purpose（目的）\n\n` +
    `This scenario simulates an experiment automation adapter before any real-world provider run.\n\n` +
    `本场景在任何真实 Provider 执行前，先对实验自动化适配器进行原型模拟。\n\n` +
    `## 2. Domain（领域）\n\n${scenario.domain}\n\n` +
    `## 3. State Variables（状态变量）\n\n` +
    scenario.stateVariables.map(v => `- ${v.id}: ${v.role}; range=${v.range.join('..')}`).join('\n') +
    `\n\n## 4. Perturbation Model（扰动模型）\n\n` +
    scenario.perturbationModel.items.map(p => `- ${p.id}: kind=${p.kind}; severity=${p.severity}; effect=${p.expectedEffect}`).join('\n') +
    `\n\n## 5. Failure Prediction（失败预测）\n\n` +
    `Composite risk（综合风险）: ${scenario.failurePrediction.compositeRisk}\n\n` +
    `Risk class（风险等级）: ${scenario.failurePrediction.riskClass}\n\n` +
    scenario.failurePrediction.predictedFailureModes.map(m => `- ${m}`).join('\n') +
    `\n\n## 6. Evidence Forecast（证据预估）\n\n` +
    `Expected evidence yield（预期证据产出）: ${scenario.evidenceForecast.expectedEvidenceYield}\n\n` +
    scenario.evidenceForecast.expectedFrames.map(f => `- ${f}`).join('\n') +
    `\n\n## 7. Recommendation（执行建议）\n\n` +
    `Mode（模式）: ${scenario.executionRecommendation.mode}\n\n` +
    `Real run allowed（允许真实执行）: ${scenario.executionRecommendation.realRunAllowed}\n\n` +
    `Next step（下一步）: ${scenario.executionRecommendation.nextStep}\n\n` +
    `## 8. Score（评分）\n\nSimulation score（模拟评分）: ${scenario.simulationScore}\n`;
}

export function renderPrototypeSimulationRuntimeDocument(runtime, evaluation) {
  return `# RCL Prototype Simulation Runtime v0.70 Report\n\n` +
    `## Summary（摘要）\n\n` +
    `- Established（成立）: ${evaluation.prototypeSimulationRuntimeEstablished}\n` +
    `- Simulation scenarios（模拟场景）: ${runtime.simulationScenarioCount}\n` +
    `- Perturbation models（扰动模型）: ${runtime.perturbationModelCount}\n` +
    `- Failure predictions（失败预测）: ${runtime.failurePredictionCount}\n` +
    `- Evidence forecasts（证据预估）: ${runtime.evidenceForecastCount}\n` +
    `- Average score（平均评分）: ${runtime.averageSimulationScore}\n` +
    `- v0.71 handoff ready（v0.71 交接就绪）: ${runtime.realWorldDataIngestionHandoffReady}\n\n` +
    `## Checks（检查）\n\n` +
    Object.entries(evaluation.checks).map(([key, value]) => `- ${key}: ${value}`).join('\n') + '\n';
}

export function runPrototypeSimulationRuntime(input = {}) {
  const spec = normalizePrototypeSimulationRuntimeSpec(input);
  const sourceAutomation = sourceAutomationFromSpec(spec.sourceExperimentAutomationAdapter);
  const adapters = sourceAutomation.adapters ?? [];
  const scenarios = buildPrototypeSimulationCatalog(adapters, spec);
  const runtime = buildPrototypeSimulationRuntime(scenarios);
  const evaluation = evaluatePrototypeSimulationRuntime(runtime, spec);
  const result = {
    format: RCL_PROTOTYPE_SIMULATION_RUNTIME_RESULT_FORMAT,
    version: RCL_PROTOTYPE_SIMULATION_RUNTIME_VERSION,
    prototypeSimulationRuntimeEstablished: evaluation.prototypeSimulationRuntimeEstablished,
    simulationScenarioCount: runtime.simulationScenarioCount,
    perturbationModelCount: runtime.perturbationModelCount,
    failurePredictionCount: runtime.failurePredictionCount,
    evidenceForecastCount: runtime.evidenceForecastCount,
    executionRecommendationCount: runtime.executionRecommendationCount,
    realWorldDataHandoffCount: runtime.realWorldDataHandoffCount,
    averageSimulationScore: runtime.averageSimulationScore,
    realWorldDataIngestionHandoffReady: runtime.realWorldDataIngestionHandoffReady,
    rootHash: runtime.simulationRoot,
    evaluation,
  };
  return {
    ok: evaluation.prototypeSimulationRuntimeEstablished,
    format: RCL_PROTOTYPE_SIMULATION_RUNTIME_BUNDLE_FORMAT,
    spec,
    sourceAutomationResult: sourceAutomation.result,
    scenarios,
    runtime,
    result,
  };
}

export function buildPrototypeSimulationRuntimeSpec(input = {}) {
  return normalizePrototypeSimulationRuntimeSpec(input);
}

export function renderPrototypeSimulationRuntimeRcl(spec = DEFAULT_PROTOTYPE_SIMULATION_RUNTIME_SPEC) {
  const s = normalizePrototypeSimulationRuntimeSpec(spec);
  return `reality PrototypeSimulationRuntimeV070 {\n` +
    `  version = "${s.version}"\n` +
    `  objective = "${s.objective}"\n` +
    `  mode = "${s.simulationPolicy.mode}"\n` +
    `  defaultSimulationMode = "${s.simulationPolicy.defaultSimulationMode}"\n` +
    `  humanApprovalBeforeRealRun = ${s.simulationPolicy.humanApprovalBeforeRealRun}\n` +
    `  destructiveRealRunDisabled = ${s.simulationPolicy.destructiveRealRunDisabled}\n` +
    `  nextHandoff = "${s.simulationPolicy.nextHandoff}"\n` +
    `}\n`;
}

export function runPrototypeSimulationRuntimeDemo() {
  return runPrototypeSimulationRuntime({});
}

export function readPrototypeSimulationRuntimeInput(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export function writePrototypeSimulationRuntimeReports(outputDir, input = {}) {
  const bundle = runPrototypeSimulationRuntime(input);
  const dir = path.resolve(outputDir);
  const docsDir = path.join(dir, 'technical-docs');
  fs.mkdirSync(docsDir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'prototype-simulation-runtime-bundle.json'), `${JSON.stringify(bundle, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'prototype-simulation-runtime-result.json'), `${JSON.stringify(bundle.result, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'prototype-simulation-runtime.md'), renderPrototypeSimulationRuntimeDocument(bundle.runtime, bundle.result.evaluation));
  fs.writeFileSync(path.join(dir, 'prototype-simulation-runtime.rcl'), renderPrototypeSimulationRuntimeRcl(bundle.spec));
  for (const scenario of bundle.scenarios) {
    fs.writeFileSync(path.join(docsDir, `${safeId(scenario.id)}.md`), renderPrototypeSimulationScenarioDocument(scenario));
  }
  return {
    ok: bundle.ok,
    outputDir: dir,
    bundlePath: path.join(dir, 'prototype-simulation-runtime-bundle.json'),
    resultPath: path.join(dir, 'prototype-simulation-runtime-result.json'),
    runtimeDocPath: path.join(dir, 'prototype-simulation-runtime.md'),
    docsDir,
    documentCount: bundle.scenarios.length,
    result: bundle.result,
  };
}

export function prototypeSimulationRuntimeCanonicalRoot(input = {}) {
  return runPrototypeSimulationRuntime(input).result.rootHash;
}
