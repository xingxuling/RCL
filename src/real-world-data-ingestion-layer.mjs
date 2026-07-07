import fs from 'node:fs';
import path from 'node:path';
import { sha256 } from './reality-compiler-kernel.mjs';
import {
  runPrototypeSimulationRuntime,
  normalizePrototypeSimulationRuntimeSpec,
  RCL_PROTOTYPE_SIMULATION_RUNTIME_RESULT_FORMAT,
} from './prototype-simulation-runtime.mjs';

export const RCL_REAL_WORLD_DATA_INGESTION_LAYER_VERSION = '0.71.0-alpha.1';
export const RCL_REAL_WORLD_DATA_INGESTION_LAYER_SPEC_FORMAT = 'rcl.real-world-data-ingestion-layer-spec.v0.71';
export const RCL_REAL_WORLD_DATA_INGESTION_LAYER_RESULT_FORMAT = 'rcl.real-world-data-ingestion-layer-result.v0.71';
export const RCL_REAL_WORLD_DATA_INGESTION_LAYER_BUNDLE_FORMAT = 'rcl.real-world-data-ingestion-layer-bundle.v0.71';
export const RCL_REAL_WORLD_DATA_CONTRACT_FORMAT = 'rcl.real-world-data-source-contract.v0.71';
export const RCL_REAL_WORLD_DATA_INGESTION_DOC_FORMAT = 'rcl.real-world-data-ingestion-technical-document.v0.71';

function round(value, digits = 9) {
  const scale = 10 ** digits;
  return Math.round(Number(value) * scale) / scale;
}

function average(values) {
  const xs = values.map(Number).filter(Number.isFinite);
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

function safeId(value, fallback = 'real-world-data-ingestion-layer') {
  return String(value ?? fallback)
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._:-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 150) || fallback;
}

function defaultPrototypeSimulationSpec() {
  return normalizePrototypeSimulationRuntimeSpec({
    id: 'rcl_real_world_data_ingestion_source_prototype_simulation_v0',
    objective: 'Source v0.70 prototype simulation runtime scenarios for v0.71 real-world data ingestion layer.',
    simulationPolicy: { defaultSimulationMode: 'dry-simulation' },
  });
}

export const DEFAULT_REAL_WORLD_DATA_INGESTION_LAYER_SPEC = Object.freeze({
  format: RCL_REAL_WORLD_DATA_INGESTION_LAYER_SPEC_FORMAT,
  id: 'rcl_real_world_data_ingestion_layer_default_v0',
  version: RCL_REAL_WORLD_DATA_INGESTION_LAYER_VERSION,
  objective: 'Convert prototype simulation forecasts into real-world data source contracts, validation pipelines, cleaning plans, blind-test splits, evidence bindings and writeback routes.',
  thresholds: {
    minIngestionChannels: 8,
    minAverageIngestionScore: 0.95,
    requireDataSourceContract: true,
    requireValidationRules: true,
    requireCleaningPipeline: true,
    requireBlindSplit: true,
    requireEvidenceBinding: true,
    requireWritebackRoute: true,
    requireHumanConsentGate: true,
  },
  ingestionPolicy: {
    mode: 'prototype-simulation-to-real-world-data-ingestion',
    defaultIngestionMode: 'schema-only-dry-ingestion',
    destructiveAcquisitionDisabled: true,
    piiCollectionDisabledByDefault: true,
    humanConsentRequired: true,
    blindHoldoutRatio: 0.25,
    nextHandoff: 'v0.72 Multi-Agent Verification Council',
  },
  sourcePrototypeSimulationRuntime: defaultPrototypeSimulationSpec(),
});

export function normalizeRealWorldDataIngestionLayerSpec(input = {}) {
  const base = JSON.parse(JSON.stringify(DEFAULT_REAL_WORLD_DATA_INGESTION_LAYER_SPEC));
  return {
    ...base,
    ...input,
    format: input.format ?? base.format,
    version: input.version ?? RCL_REAL_WORLD_DATA_INGESTION_LAYER_VERSION,
    thresholds: { ...base.thresholds, ...(input.thresholds ?? {}) },
    ingestionPolicy: { ...base.ingestionPolicy, ...(input.ingestionPolicy ?? {}) },
    sourcePrototypeSimulationRuntime: input.sourcePrototypeSimulationRuntime ?? base.sourcePrototypeSimulationRuntime,
  };
}

function sourcePrototypeFromSpec(sourceInput) {
  if (sourceInput?.ok && sourceInput?.result?.format === RCL_PROTOTYPE_SIMULATION_RUNTIME_RESULT_FORMAT) return sourceInput;
  return runPrototypeSimulationRuntime(sourceInput ?? defaultPrototypeSimulationSpec());
}

function inferDomain(scenario) {
  return scenario.domain ?? 'general-prototype';
}

function buildSourceTypes(domain) {
  const common = [
    { id: 'manual_observation_log', type: 'operator-log', required: true },
    { id: 'environment_baseline', type: 'baseline-measurement', required: true },
    { id: 'instrument_timestamp', type: 'time-series-clock', required: true },
  ];
  const byDomain = {
    'material-memory': [
      { id: 'spectral_hydration_series', type: 'spectral-time-series', required: true },
      { id: 'thermal_relaxation_curve', type: 'thermal-time-series', required: true },
      { id: 'lattice_image_snapshot', type: 'microscopy-or-simulation-frame', required: false },
    ],
    'field-coupling': [
      { id: 'field_gradient_series', type: 'field-sensor-series', required: true },
      { id: 'biofeedback_trace', type: 'biofeedback-time-series', required: false },
      { id: 'environmental_drift_series', type: 'background-noise-series', required: true },
    ],
    'observer-record': [
      { id: 'null_channel_readout', type: 'absence-signal-series', required: true },
      { id: 'temporal_trace_index', type: 'temporal-index-series', required: true },
      { id: 'resonance_address_log', type: 'symbolic-index-log', required: false },
    ],
    'constraint-array': [
      { id: 'spatial_node_coordinates', type: 'geometry-table', required: true },
      { id: 'node_phase_series', type: 'phase-time-series', required: true },
      { id: 'boundary_leakage_trace', type: 'boundary-condition-series', required: true },
    ],
    'general-prototype': [
      { id: 'mechanism_state_vector', type: 'state-vector-series', required: true },
      { id: 'provider_latency_log', type: 'execution-log', required: false },
      { id: 'evidence_frame_capture', type: 'evidence-frame', required: true },
    ],
  };
  return [...common, ...(byDomain[domain] ?? byDomain['general-prototype'])];
}

function buildValidationRules(sourceTypes, scenario) {
  return [
    { id: 'schema_present', rule: 'all-required-source-types-present', severity: 'critical' },
    { id: 'time_monotonicity', rule: 'timestamps-must-be-monotonic-or-explicitly-segmented', severity: 'critical' },
    { id: 'unit_declaration', rule: 'numeric-series-must-declare-unit-and-range', severity: 'major' },
    { id: 'baseline_binding', rule: 'each-run-must-bind-to-baseline-frame', severity: 'major' },
    { id: 'control_group_binding', rule: 'experimental-data-must-have-control-or-null-comparator', severity: 'major' },
    { id: 'simulation_forecast_link', rule: `data-must-link-to-simulation-scenario:${scenario.id}`, severity: 'major' },
    ...sourceTypes.filter(s => s.required).map(s => ({ id: `required:${s.id}`, rule: `${s.id}-must-exist`, severity: 'critical' })),
  ];
}

function buildCleaningPipeline(domain) {
  const common = [
    { id: 'normalize_units', action: 'convert-to-declared-canonical-units', reversible: true },
    { id: 'deduplicate_frames', action: 'remove-byte-identical-duplicate-frames', reversible: true },
    { id: 'mark_missing_values', action: 'mark-missing-values-with-explicit-null-flags', reversible: true },
    { id: 'preserve_raw_snapshot', action: 'never-overwrite-raw-ingestion-file', reversible: true },
  ];
  const byDomain = {
    'material-memory': [
      { id: 'smooth_sensor_jitter', action: 'bounded-median-filter-for-thermal-and-spectral-series', reversible: true },
      { id: 'retain_phase_edges', action: 'preserve-hydration-phase-transition-boundaries', reversible: true },
    ],
    'field-coupling': [
      { id: 'subtract_background_drift', action: 'subtract-control-environment-drift', reversible: true },
      { id: 'flag_biofeedback_artifacts', action: 'flag-motion-and-operator-artifacts', reversible: true },
    ],
    'observer-record': [
      { id: 'preserve_null_events', action: 'do-not-collapse-absence-events-into-missing-data', reversible: true },
      { id: 'index_temporal_aliases', action: 'mark-possible-temporal-aliasing-windows', reversible: true },
    ],
    'constraint-array': [
      { id: 'coordinate_frame_normalization', action: 'normalize-spatial-reference-frame', reversible: true },
      { id: 'phase_unwrap', action: 'unwrap-node-phase-series-with-boundary-marks', reversible: true },
    ],
    'general-prototype': [
      { id: 'state_vector_alignment', action: 'align-state-vector-series-to-run-clock', reversible: true },
      { id: 'provider_log_redaction', action: 'redact-secrets-while-preserving-timing-metadata', reversible: true },
    ],
  };
  return [...common, ...(byDomain[domain] ?? byDomain['general-prototype'])];
}

function buildBlindSplitPolicy(spec, scenario) {
  const ratio = Math.min(0.5, Math.max(0.1, Number(spec.ingestionPolicy.blindHoldoutRatio ?? 0.25)));
  const seed = sha256(`${scenario.id}:blind-split:${ratio}`).slice(0, 16);
  return {
    id: `${scenario.id}:blind-split`,
    strategy: 'deterministic-hash-holdout',
    holdoutRatio: ratio,
    seed,
    trainingPartition: round(1 - ratio),
    blindPartition: round(ratio),
    leakageGuard: 'blind-partition-hidden-from-candidate-scoring-until-evaluation',
  };
}

function buildEvidenceBinding(scenario, domain, blindSplitPolicy) {
  const expected = scenario.evidenceForecast?.expectedFrames ?? [];
  const bindingFrames = [
    'raw-data-hash',
    'schema-validation-report',
    'cleaning-ledger',
    'blind-split-ledger',
    'control-comparison-ledger',
    'evidence-writeback-frame',
    ...expected,
  ];
  return {
    id: `${scenario.id}:evidence-binding`,
    targetEvidencePanel: scenario.evidenceForecast?.writebackTarget ?? `${scenario.id}:evidence-panel`,
    domain,
    bindingFrames: [...new Set(bindingFrames)],
    blindSplitId: blindSplitPolicy.id,
    evidenceRoot: sha256(JSON.stringify([scenario.id, domain, blindSplitPolicy.seed, bindingFrames])),
  };
}

export function buildRealWorldDataIngestionChannel(scenario, spec = DEFAULT_REAL_WORLD_DATA_INGESTION_LAYER_SPEC) {
  const domain = inferDomain(scenario);
  const sourceTypes = buildSourceTypes(domain);
  const validationRules = buildValidationRules(sourceTypes, scenario);
  const cleaningPipeline = buildCleaningPipeline(domain);
  const blindSplitPolicy = buildBlindSplitPolicy(spec, scenario);
  const evidenceBinding = buildEvidenceBinding(scenario, domain, blindSplitPolicy);
  const writebackRoute = {
    id: `${scenario.id}:writeback-route`,
    target: evidenceBinding.targetEvidencePanel,
    routeType: 'evidence-panel-and-lab-notebook-writeback',
    requiresHumanConsent: spec.ingestionPolicy.humanConsentRequired === true,
    destructiveAcquisitionDisabled: spec.ingestionPolicy.destructiveAcquisitionDisabled === true,
  };
  const dataSourceContract = {
    format: RCL_REAL_WORLD_DATA_CONTRACT_FORMAT,
    id: `${scenario.id}:data-source-contract`,
    scenarioId: scenario.id,
    domain,
    ingestionMode: spec.ingestionPolicy.defaultIngestionMode,
    sourceTypes,
    validationRules,
    humanConsentRequired: spec.ingestionPolicy.humanConsentRequired === true,
    piiCollectionDisabledByDefault: spec.ingestionPolicy.piiCollectionDisabledByDefault === true,
    rawDataPreservationRequired: true,
    contractHash: sha256(JSON.stringify([scenario.id, domain, sourceTypes, validationRules])),
  };
  const ingestionScore = scoreRealWorldDataIngestionChannel({ dataSourceContract, validationRules, cleaningPipeline, blindSplitPolicy, evidenceBinding, writebackRoute }, spec);
  return {
    id: `${scenario.id}:real-world-data-ingestion-channel`,
    title: `${scenario.title ?? scenario.id} Real World Data Ingestion Channel`,
    domain,
    sourceScenarioId: scenario.id,
    dataSourceContract,
    validationRules,
    cleaningPipeline,
    blindSplitPolicy,
    evidenceBinding,
    writebackRoute,
    ingestionScore,
    nextHandoff: spec.ingestionPolicy.nextHandoff,
  };
}

export function scoreRealWorldDataIngestionChannel(channel, spec = DEFAULT_REAL_WORLD_DATA_INGESTION_LAYER_SPEC) {
  const checks = [
    !!channel.dataSourceContract,
    (channel.validationRules?.length ?? 0) >= 6,
    (channel.cleaningPipeline?.length ?? 0) >= 5,
    !!channel.blindSplitPolicy && Number(channel.blindSplitPolicy.holdoutRatio) > 0,
    !!channel.evidenceBinding && (channel.evidenceBinding.bindingFrames?.length ?? 0) >= 6,
    !!channel.writebackRoute && channel.writebackRoute.requiresHumanConsent === true,
    spec.ingestionPolicy.destructiveAcquisitionDisabled === true,
    spec.ingestionPolicy.piiCollectionDisabledByDefault === true,
  ];
  return round(checks.filter(Boolean).length / checks.length);
}

export function buildRealWorldDataIngestionCatalog(scenarios = [], spec = DEFAULT_REAL_WORLD_DATA_INGESTION_LAYER_SPEC) {
  return scenarios.map(scenario => buildRealWorldDataIngestionChannel(scenario, spec));
}

export function buildRealWorldDataIngestionLayerRuntime(channels = []) {
  const runtime = {
    format: 'rcl.real-world-data-ingestion-layer-runtime.v0.71',
    version: RCL_REAL_WORLD_DATA_INGESTION_LAYER_VERSION,
    ingestionChannelCount: channels.length,
    dataSourceContractCount: channels.filter(c => c.dataSourceContract).length,
    validationPipelineCount: channels.filter(c => c.validationRules?.length).length,
    cleaningPipelineCount: channels.filter(c => c.cleaningPipeline?.length).length,
    blindSplitCount: channels.filter(c => c.blindSplitPolicy).length,
    evidenceBindingCount: channels.filter(c => c.evidenceBinding).length,
    writebackRouteCount: channels.filter(c => c.writebackRoute).length,
    humanConsentGateCount: channels.filter(c => c.writebackRoute?.requiresHumanConsent).length,
    averageIngestionScore: round(average(channels.map(c => c.ingestionScore))),
    multiAgentVerificationHandoffReady: channels.length > 0 && channels.every(c => c.nextHandoff?.includes('v0.72')),
    ingestionRoot: sha256(JSON.stringify(channels)),
  };
  return runtime;
}

export function evaluateRealWorldDataIngestionLayer(runtime, spec = DEFAULT_REAL_WORLD_DATA_INGESTION_LAYER_SPEC) {
  const checks = {
    minIngestionChannels: runtime.ingestionChannelCount >= spec.thresholds.minIngestionChannels,
    minAverageIngestionScore: runtime.averageIngestionScore >= spec.thresholds.minAverageIngestionScore,
    requireDataSourceContract: !spec.thresholds.requireDataSourceContract || runtime.dataSourceContractCount === runtime.ingestionChannelCount,
    requireValidationRules: !spec.thresholds.requireValidationRules || runtime.validationPipelineCount === runtime.ingestionChannelCount,
    requireCleaningPipeline: !spec.thresholds.requireCleaningPipeline || runtime.cleaningPipelineCount === runtime.ingestionChannelCount,
    requireBlindSplit: !spec.thresholds.requireBlindSplit || runtime.blindSplitCount === runtime.ingestionChannelCount,
    requireEvidenceBinding: !spec.thresholds.requireEvidenceBinding || runtime.evidenceBindingCount === runtime.ingestionChannelCount,
    requireWritebackRoute: !spec.thresholds.requireWritebackRoute || runtime.writebackRouteCount === runtime.ingestionChannelCount,
    requireHumanConsentGate: !spec.thresholds.requireHumanConsentGate || runtime.humanConsentGateCount === runtime.ingestionChannelCount,
    multiAgentVerificationHandoffReady: runtime.multiAgentVerificationHandoffReady === true,
  };
  return {
    realWorldDataIngestionLayerEstablished: Object.values(checks).every(Boolean),
    checks,
  };
}

export function renderRealWorldDataIngestionChannelDocument(channel) {
  return `# ${channel.title}\n\n` +
    `Format（格式）: ${RCL_REAL_WORLD_DATA_INGESTION_DOC_FORMAT}\n\n` +
    `## 1. Purpose（目的）\n\n` +
    `Bind a prototype simulation scenario to real-world data contracts, validation, cleaning, blind holdouts and evidence writeback.\n\n` +
    `将原型模拟场景绑定到真实世界数据契约、校验、清洗、盲测留出和证据回写。\n\n` +
    `## 2. Domain（领域）\n\n${channel.domain}\n\n` +
    `## 3. Data Source Contract（数据源契约）\n\n` +
    channel.dataSourceContract.sourceTypes.map(s => `- ${s.id}: type=${s.type}; required=${s.required}`).join('\n') +
    `\n\n## 4. Validation Rules（校验规则）\n\n` +
    channel.validationRules.map(r => `- ${r.id}: ${r.rule}; severity=${r.severity}`).join('\n') +
    `\n\n## 5. Cleaning Pipeline（清洗管线）\n\n` +
    channel.cleaningPipeline.map(p => `- ${p.id}: ${p.action}; reversible=${p.reversible}`).join('\n') +
    `\n\n## 6. Blind Split（盲测分流）\n\n` +
    `Holdout ratio（留出比例）: ${channel.blindSplitPolicy.holdoutRatio}\n\n` +
    `Leakage guard（泄漏守卫）: ${channel.blindSplitPolicy.leakageGuard}\n\n` +
    `## 7. Evidence Binding（证据绑定）\n\n` +
    channel.evidenceBinding.bindingFrames.map(f => `- ${f}`).join('\n') +
    `\n\n## 8. Writeback（回写）\n\n` +
    `Target（目标）: ${channel.writebackRoute.target}\n\n` +
    `Human consent required（需要人类同意）: ${channel.writebackRoute.requiresHumanConsent}\n\n` +
    `## 9. Score（评分）\n\nIngestion score（接入评分）: ${channel.ingestionScore}\n`;
}

export function renderRealWorldDataIngestionLayerDocument(runtime, evaluation) {
  return `# RCL Real World Data Ingestion Layer v0.71 Report\n\n` +
    `## Summary（摘要）\n\n` +
    `- Established（成立）: ${evaluation.realWorldDataIngestionLayerEstablished}\n` +
    `- Ingestion channels（数据接入通道）: ${runtime.ingestionChannelCount}\n` +
    `- Data source contracts（数据源契约）: ${runtime.dataSourceContractCount}\n` +
    `- Validation pipelines（校验管线）: ${runtime.validationPipelineCount}\n` +
    `- Cleaning pipelines（清洗管线）: ${runtime.cleaningPipelineCount}\n` +
    `- Blind splits（盲测分流）: ${runtime.blindSplitCount}\n` +
    `- Evidence bindings（证据绑定）: ${runtime.evidenceBindingCount}\n` +
    `- Average score（平均评分）: ${runtime.averageIngestionScore}\n` +
    `- v0.72 handoff ready（v0.72 交接就绪）: ${runtime.multiAgentVerificationHandoffReady}\n\n` +
    `## Checks（检查）\n\n` +
    Object.entries(evaluation.checks).map(([key, value]) => `- ${key}: ${value}`).join('\n') + '\n';
}

export function runRealWorldDataIngestionLayer(input = {}) {
  const spec = normalizeRealWorldDataIngestionLayerSpec(input);
  const sourcePrototype = sourcePrototypeFromSpec(spec.sourcePrototypeSimulationRuntime);
  const scenarios = sourcePrototype.scenarios ?? [];
  const channels = buildRealWorldDataIngestionCatalog(scenarios, spec);
  const runtime = buildRealWorldDataIngestionLayerRuntime(channels);
  const evaluation = evaluateRealWorldDataIngestionLayer(runtime, spec);
  const result = {
    format: RCL_REAL_WORLD_DATA_INGESTION_LAYER_RESULT_FORMAT,
    version: RCL_REAL_WORLD_DATA_INGESTION_LAYER_VERSION,
    realWorldDataIngestionLayerEstablished: evaluation.realWorldDataIngestionLayerEstablished,
    ingestionChannelCount: runtime.ingestionChannelCount,
    dataSourceContractCount: runtime.dataSourceContractCount,
    validationPipelineCount: runtime.validationPipelineCount,
    cleaningPipelineCount: runtime.cleaningPipelineCount,
    blindSplitCount: runtime.blindSplitCount,
    evidenceBindingCount: runtime.evidenceBindingCount,
    writebackRouteCount: runtime.writebackRouteCount,
    humanConsentGateCount: runtime.humanConsentGateCount,
    averageIngestionScore: runtime.averageIngestionScore,
    multiAgentVerificationHandoffReady: runtime.multiAgentVerificationHandoffReady,
    rootHash: runtime.ingestionRoot,
    evaluation,
  };
  return {
    ok: evaluation.realWorldDataIngestionLayerEstablished,
    format: RCL_REAL_WORLD_DATA_INGESTION_LAYER_BUNDLE_FORMAT,
    spec,
    sourcePrototypeResult: sourcePrototype.result,
    channels,
    runtime,
    result,
  };
}

export function buildRealWorldDataIngestionLayerSpec(input = {}) {
  return normalizeRealWorldDataIngestionLayerSpec(input);
}

export function renderRealWorldDataIngestionLayerRcl(spec = DEFAULT_REAL_WORLD_DATA_INGESTION_LAYER_SPEC) {
  const s = normalizeRealWorldDataIngestionLayerSpec(spec);
  return `reality RealWorldDataIngestionLayerV071 {\n` +
    `  version = "${s.version}"\n` +
    `  objective = "${s.objective}"\n` +
    `  mode = "${s.ingestionPolicy.mode}"\n` +
    `  defaultIngestionMode = "${s.ingestionPolicy.defaultIngestionMode}"\n` +
    `  destructiveAcquisitionDisabled = ${s.ingestionPolicy.destructiveAcquisitionDisabled}\n` +
    `  humanConsentRequired = ${s.ingestionPolicy.humanConsentRequired}\n` +
    `  blindHoldoutRatio = ${s.ingestionPolicy.blindHoldoutRatio}\n` +
    `  nextHandoff = "${s.ingestionPolicy.nextHandoff}"\n` +
    `}\n`;
}

export function runRealWorldDataIngestionLayerDemo() {
  return runRealWorldDataIngestionLayer({});
}

export function readRealWorldDataIngestionLayerInput(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export function writeRealWorldDataIngestionLayerReports(outputDir, input = {}) {
  const bundle = runRealWorldDataIngestionLayer(input);
  const dir = path.resolve(outputDir);
  const docsDir = path.join(dir, 'technical-docs');
  fs.mkdirSync(docsDir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'real-world-data-ingestion-layer-bundle.json'), `${JSON.stringify(bundle, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'real-world-data-ingestion-layer-result.json'), `${JSON.stringify(bundle.result, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'real-world-data-ingestion-layer.md'), renderRealWorldDataIngestionLayerDocument(bundle.runtime, bundle.result.evaluation));
  fs.writeFileSync(path.join(dir, 'real-world-data-ingestion-layer.rcl'), renderRealWorldDataIngestionLayerRcl(bundle.spec));
  for (const channel of bundle.channels) {
    fs.writeFileSync(path.join(docsDir, `${safeId(channel.id)}.md`), renderRealWorldDataIngestionChannelDocument(channel));
  }
  return {
    ok: bundle.ok,
    outputDir: dir,
    bundlePath: path.join(dir, 'real-world-data-ingestion-layer-bundle.json'),
    resultPath: path.join(dir, 'real-world-data-ingestion-layer-result.json'),
    runtimeDocPath: path.join(dir, 'real-world-data-ingestion-layer.md'),
    docsDir,
    documentCount: bundle.channels.length,
    result: bundle.result,
  };
}

export function realWorldDataIngestionLayerCanonicalRoot(input = {}) {
  return runRealWorldDataIngestionLayer(input).result.rootHash;
}
