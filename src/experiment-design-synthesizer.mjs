import fs from 'node:fs';
import path from 'node:path';
import { sha256, clamp } from './reality-compiler-kernel.mjs';

export const RCL_EXPERIMENT_DESIGN_VERSION = '0.59.0-alpha.1';
export const RCL_EXPERIMENT_DESIGN_SPEC_FORMAT = 'rcl.experiment-design-synthesizer-spec.v0.59';
export const RCL_EXPERIMENT_DESIGN_RESULT_FORMAT = 'rcl.experiment-design-synthesizer-result.v0.59';
export const RCL_EXPERIMENT_DESIGN_BUNDLE_FORMAT = 'rcl.experiment-design-synthesizer-bundle.v0.59';
export const RCL_EXPERIMENT_PROTOCOL_FORMAT = 'rcl.experiment-protocol.v0.59';
export const RCL_EXPERIMENT_TECH_DOC_FORMAT = 'rcl.experiment-design-technical-document.v0.59';

function round(value, digits = 9) {
  const scale = 10 ** digits;
  return Math.round(Number(value) * scale) / scale;
}

function average(values) {
  const xs = values.map(Number).filter(Number.isFinite);
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

function safeId(value, fallback = 'experiment') {
  return String(value ?? fallback)
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 120) || fallback;
}

function ensureArray(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

function uniq(values) {
  return [...new Set(values.filter(Boolean).map(v => String(v)))];
}

export const DEFAULT_EXPERIMENT_DESIGN_SPEC = Object.freeze({
  format: RCL_EXPERIMENT_DESIGN_SPEC_FORMAT,
  id: 'rcl_experiment_design_synthesizer_default_v0',
  version: RCL_EXPERIMENT_DESIGN_VERSION,
  objective: 'Compile promoted RCL mechanisms into controlled experiment protocols with hypotheses, variables, controls, instrumentation, blind holdouts, failure conditions, evidence outputs and technical documents.',
  thresholds: {
    minDesignScore: 0.86,
    minAverageDesignScore: 0.88,
    minPromotedProtocols: 6,
    requireNegativeControlsRejected: true,
    requireBlindHoldouts: true,
    requireNaturalLanguageDocs: true,
  },
  instrumentationLibrary: [
    'spectral_reflectance_and_hydration_scan',
    'thermal_relaxation_logger',
    'weak_magnetic_phase_noise_probe',
    'impedance_and_ion_conductivity_meter',
    'microstructure_entropy_analyzer',
    'time_series_blind_holdout_splitter',
    'null_channel_baseline_monitor',
    'observer_bias_audit_log',
  ],
  candidateMechanisms: [
    {
      id: 'silicate_anchored_passive_memory_cell',
      name: 'Silicate Anchored Passive Memory Cell',
      translation: '硅酸盐锚定被动记忆元胞',
      family: 'material_memory',
      mechanism: 'Non-equilibrium silicate medium stores persistent information-like residues through hydration state, lattice defects and thermal relaxation.',
      sourceVersions: ['v0.54'],
      requiredControls: ['no_anchor_control', 'random_complexity_control', 'thermal_erasure_control'],
      observables: ['anchor_persistence', 'lattice_ordering', 'information_retention', 'self_repair'],
      instrumentation: ['spectral_reflectance_and_hydration_scan', 'thermal_relaxation_logger', 'microstructure_entropy_analyzer'],
      blindHoldouts: ['post_perturbation_recovery_window', 'unlabeled_anchor_vs_random_sample'],
      falsifiers: ['Anchor signature fails to exceed random complexity control.', 'Structure disappears below thermal erasure threshold.', 'Readout cannot be reproduced across seeded trials.'],
      riskClass: 'low_computational_or_material_benchtop',
    },
    {
      id: 'spectral_hydration_readout_protocol',
      name: 'Spectral Hydration Readout Protocol',
      translation: '光谱水合读出协议',
      family: 'readout_protocol',
      mechanism: 'Hydration phase, reflectance drift and ion state are used as non-invasive readout channels for candidate silicate memory residues.',
      sourceVersions: ['v0.53'],
      requiredControls: ['dry_cycle_control', 'hydration_cycle_control', 'blinded_sample_labels'],
      observables: ['hydration_shift', 'spectral_delta', 'readout_repeatability', 'false_positive_rate'],
      instrumentation: ['spectral_reflectance_and_hydration_scan', 'impedance_and_ion_conductivity_meter', 'time_series_blind_holdout_splitter'],
      blindHoldouts: ['hidden_sample_identity', 'withheld_hydration_phase'],
      falsifiers: ['Spectral drift is indistinguishable from baseline hydration noise.', 'Readout disappears under label blinding.', 'False-positive rate exceeds allowed threshold.'],
      riskClass: 'low_measurement_protocol',
    },
    {
      id: 'qi_environmental_biofield_coupling',
      name: 'Qi Environmental Biofield Coupling',
      translation: '灵气环境生命场耦合',
      family: 'biofield_coupling',
      mechanism: 'Low-intensity environment-body coupling is modeled as measurable modulation of autonomic, thermal, electromagnetic and hydration-linked signals under constrained practice states.',
      sourceVersions: ['v0.55'],
      requiredControls: ['sham_practice_control', 'resting_baseline_control', 'observer_blinding_control'],
      observables: ['heart_rate_variability_delta', 'skin_temperature_gradient', 'weak_field_noise_shift', 'subjective_report_blinded_mismatch'],
      instrumentation: ['thermal_relaxation_logger', 'weak_magnetic_phase_noise_probe', 'observer_bias_audit_log'],
      blindHoldouts: ['hidden_session_condition', 'delayed_label_reveal'],
      falsifiers: ['Effects vanish under blinded sham comparison.', 'Only subjective report changes without sensor support.', 'Effect cannot survive session randomization.'],
      riskClass: 'nonmedical_observational',
    },
    {
      id: 'aether_substrate_information_medium',
      name: 'Aether Substrate Information Medium',
      translation: '以太底层信息媒介',
      family: 'information_medium',
      mechanism: 'A bounded substrate-field hypothesis is reduced to measurable correlations, phase residues and transfer constraints rather than unbounded faster-than-light claims.',
      sourceVersions: ['v0.55'],
      requiredControls: ['null_channel_control', 'distance_scramble_control', 'clock_drift_control'],
      observables: ['phase_residue', 'correlation_decay', 'null_channel_leakage', 'clock_aligned_noise_difference'],
      instrumentation: ['null_channel_baseline_monitor', 'weak_magnetic_phase_noise_probe', 'time_series_blind_holdout_splitter'],
      blindHoldouts: ['withheld_distance_condition', 'withheld_clock_phase'],
      falsifiers: ['No bounded channel residue exceeds clock drift.', 'Correlation survives only when labels are visible.', 'Claim requires unbounded information transfer.'],
      riskClass: 'computational_and_signal_analysis',
    },
    {
      id: 'formation_spatial_constraint_array',
      name: 'Formation Spatial Constraint Array',
      translation: '阵法空间约束阵列',
      family: 'spatial_constraint',
      mechanism: 'Symbolic-spatial layouts are compiled into measurable boundary conditions that shape flow, attention, field gradients or sensor readouts.',
      sourceVersions: ['v0.55'],
      requiredControls: ['random_layout_control', 'rotated_layout_control', 'masked_symbol_control'],
      observables: ['field_gradient_shift', 'attention_path_bias', 'flow_boundary_difference', 'layout_specific_residual'],
      instrumentation: ['microstructure_entropy_analyzer', 'weak_magnetic_phase_noise_probe', 'observer_bias_audit_log'],
      blindHoldouts: ['withheld_layout_class', 'masked_symbol_identity'],
      falsifiers: ['Randomized layouts produce equal or stronger effects.', 'Layout effect vanishes when evaluator is blinded.', 'No measurable boundary condition is altered.'],
      riskClass: 'low_environmental_layout',
    },
    {
      id: 'akashic_substrate_memory_field',
      name: 'Akashic Substrate Memory Field',
      translation: '阿卡西底层记忆场',
      family: 'record_substrate',
      mechanism: 'A finite, non-omniscient record substrate is modeled through material residue, temporal differential ledger and observer-state readout constraints.',
      sourceVersions: ['v0.56'],
      requiredControls: ['no_record_control', 'false_memory_prompt_control', 'material_residue_control'],
      observables: ['record_recall_specificity', 'temporal_trace_consistency', 'material_residue_alignment', 'readout_cost_signature'],
      instrumentation: ['observer_bias_audit_log', 'time_series_blind_holdout_splitter', 'null_channel_baseline_monitor'],
      blindHoldouts: ['withheld_event_detail', 'withheld_temporal_marker'],
      falsifiers: ['Readout becomes omniscient and unfalsifiable.', 'Specificity collapses under false-memory prompts.', 'No residue or temporal ledger can be reconstructed.'],
      riskClass: 'cognitive_record_protocol',
    },
    {
      id: 'observer_state_readout_interface',
      name: 'Observer-state Readout Interface',
      translation: '观测者状态读出界面',
      family: 'observer_readout',
      mechanism: 'Observer state is treated as an instrument that must be calibrated, blinded, logged and separated from post-hoc explanation freedom.',
      sourceVersions: ['v0.56'],
      requiredControls: ['observer_baseline_control', 'blind_prompt_control', 'cross_observer_null_control'],
      observables: ['state_dependent_accuracy', 'prompt_blind_stability', 'observer_drift', 'cross_observer_convergence'],
      instrumentation: ['observer_bias_audit_log', 'time_series_blind_holdout_splitter', 'null_channel_baseline_monitor'],
      blindHoldouts: ['hidden_target_set', 'delayed_feedback_labels'],
      falsifiers: ['Accuracy follows feedback leakage.', 'Observer drift explains all effects.', 'Cross-observer null control matches the active condition.'],
      riskClass: 'cognitive_protocol',
    },
    {
      id: 'experiment_to_lab_notebook_bridge',
      name: 'Experiment-to-Lab Notebook Bridge',
      translation: '实验到实证日志桥',
      family: 'evidence_runtime',
      mechanism: 'Every synthesized protocol emits a replayable lab notebook contract: raw data, transformations, hashes, failure conditions and reproduction checklist.',
      sourceVersions: ['v0.58', 'v0.59'],
      requiredControls: ['hash_integrity_control', 'missing_data_control', 'replay_determinism_control'],
      observables: ['notebook_completeness', 'hash_replay_integrity', 'failure_condition_traceability', 'reproduction_readiness'],
      instrumentation: ['time_series_blind_holdout_splitter', 'observer_bias_audit_log'],
      blindHoldouts: ['withheld_transformation_step', 'withheld_run_seed'],
      falsifiers: ['Evidence cannot be replayed from logs.', 'Failure conditions are absent or mutable after the run.', 'Notebook output lacks raw-to-result trace.'],
      riskClass: 'software_evidence_protocol',
    },
  ],
  negativeControls: [
    {
      id: 'unbounded_truth_oracle_experiment',
      name: 'Unbounded Truth Oracle Experiment',
      translation: '无限真理神谕实验',
      mechanism: 'Claims exact access to all reality without variables, controls, sensors, false conditions or cost.',
      requiredControls: [],
      observables: [],
      instrumentation: [],
      blindHoldouts: [],
      falsifiers: [],
      riskClass: 'invalid_unbounded',
    },
  ],
});

export function normalizeExperimentDesignSpec(input = {}) {
  const base = JSON.parse(JSON.stringify(DEFAULT_EXPERIMENT_DESIGN_SPEC));
  return {
    ...base,
    ...input,
    thresholds: { ...base.thresholds, ...(input.thresholds ?? {}) },
    instrumentationLibrary: ensureArray(input.instrumentationLibrary, base.instrumentationLibrary),
    candidateMechanisms: ensureArray(input.candidateMechanisms, base.candidateMechanisms),
    negativeControls: ensureArray(input.negativeControls, base.negativeControls),
  };
}

function scoreMechanism(candidate, spec, isNegative = false) {
  const controls = ensureArray(candidate.requiredControls);
  const observables = ensureArray(candidate.observables);
  const instrumentation = ensureArray(candidate.instrumentation);
  const holdouts = ensureArray(candidate.blindHoldouts);
  const falsifiers = ensureArray(candidate.falsifiers);
  const instrumentSet = new Set(spec.instrumentationLibrary);
  const libraryMatch = instrumentation.length ? instrumentation.filter(i => instrumentSet.has(i)).length / instrumentation.length : 0;
  const controlsScore = clamp(controls.length / 3);
  const measurabilityScore = clamp(observables.length / 4);
  const instrumentationScore = clamp((instrumentation.length / 3) * (0.5 + 0.5 * libraryMatch));
  const falsifiabilityScore = clamp(falsifiers.length / 3);
  const blindHoldoutScore = clamp(holdouts.length / 2);
  const boundednessScore = candidate.riskClass && !String(candidate.riskClass).includes('invalid') ? 1 : 0;
  const evidenceOutputScore = clamp((controls.length + observables.length + instrumentation.length + falsifiers.length + holdouts.length) / 15);
  const designScore = round(average([
    controlsScore,
    measurabilityScore,
    instrumentationScore,
    falsifiabilityScore,
    blindHoldoutScore,
    boundednessScore,
    evidenceOutputScore,
  ]));
  const promoted = !isNegative && designScore >= Number(spec.thresholds.minDesignScore ?? 0.86);
  return {
    controlsScore: round(controlsScore),
    measurabilityScore: round(measurabilityScore),
    instrumentationScore: round(instrumentationScore),
    falsifiabilityScore: round(falsifiabilityScore),
    blindHoldoutScore: round(blindHoldoutScore),
    boundednessScore: round(boundednessScore),
    evidenceOutputScore: round(evidenceOutputScore),
    designScore,
    promoted,
    rejected: isNegative ? designScore < Number(spec.thresholds.minDesignScore ?? 0.86) : !promoted,
  };
}

export function synthesizeExperimentProtocol(candidate, spec, options = {}) {
  const isNegative = options.negativeControl === true;
  const scores = scoreMechanism(candidate, spec, isNegative);
  const id = safeId(candidate.id ?? candidate.name, 'experiment');
  const title = `${candidate.name} Experiment Protocol`;
  const hypothesis = `If ${candidate.translation ?? candidate.name} is an operational mechanism, then ${candidate.mechanism} should produce measurable outputs that exceed matched controls and survive blind holdout checks.`;
  const variables = {
    independent: uniq(['mechanism_present_or_absent', ...ensureArray(candidate.requiredControls).map(c => `${c}_condition`)]),
    dependent: uniq(ensureArray(candidate.observables)),
    controlled: uniq(['temperature_window', 'time_window', 'operator_blinding', 'sample_label_randomization', 'sensor_calibration']),
  };
  const protocol = {
    format: RCL_EXPERIMENT_PROTOCOL_FORMAT,
    id,
    title,
    translation: `${candidate.translation ?? candidate.name} 实验协议`,
    sourceMechanism: {
      id,
      name: candidate.name,
      translation: candidate.translation ?? candidate.name,
      family: candidate.family ?? 'unknown',
      sourceVersions: ensureArray(candidate.sourceVersions),
      mechanism: candidate.mechanism,
    },
    hypothesis,
    variables,
    controlGroups: uniq(['active_mechanism_group', ...ensureArray(candidate.requiredControls)]),
    instrumentationPlan: ensureArray(candidate.instrumentation).map(name => ({
      instrument: name,
      translation: instrumentTranslation(name),
      purpose: instrumentPurpose(name),
    })),
    procedure: [
      'Register protocol, random seed, operator, instrument calibration and failure conditions before data collection.',
      'Prepare active mechanism group and all matched controls with blinded sample or session labels.',
      'Collect baseline readouts before any mechanism-specific perturbation or practice phase.',
      'Apply the bounded perturbation, practice state, material condition or spatial layout defined by the mechanism.',
      'Collect time-series outputs using every listed instrument and preserve raw records.',
      'Reveal blind holdouts only after the analysis script emits its locked result hash.',
      'Compare active group against maximum control score and report both positive and negative findings.',
    ],
    blindHoldouts: ensureArray(candidate.blindHoldouts),
    successCriteria: [
      'Active group exceeds the strongest matched control by a pre-registered margin.',
      'At least one dependent metric survives the blind holdout split.',
      'The mechanism-specific explanation does not require unbounded energy, unbounded information or post-hoc authority.',
      'Raw data, transformed data, report and hash ledger are sufficient for replay.',
    ],
    failureConditions: ensureArray(candidate.falsifiers),
    evidenceOutputs: [
      `${id}-raw-timeseries.jsonl`,
      `${id}-analysis-report.json`,
      `${id}-blind-holdout-report.json`,
      `${id}-failure-ledger.md`,
      `${id}-technical-document.md`,
    ],
    scores,
    status: scores.promoted ? 'experiment_protocol_promoted' : 'experiment_protocol_rejected',
  };
  protocol.rootHash = sha256(JSON.stringify({ id: protocol.id, scores: protocol.scores, variables: protocol.variables, controls: protocol.controlGroups }));
  return protocol;
}

function instrumentTranslation(name) {
  const map = {
    spectral_reflectance_and_hydration_scan: '光谱反射与水合扫描',
    thermal_relaxation_logger: '热松弛记录器',
    weak_magnetic_phase_noise_probe: '弱磁相位噪声探针',
    impedance_and_ion_conductivity_meter: '阻抗与离子导电仪',
    microstructure_entropy_analyzer: '微结构熵分析器',
    time_series_blind_holdout_splitter: '时间序列盲测切分器',
    null_channel_baseline_monitor: '空通道基线监测器',
    observer_bias_audit_log: '观测者偏差审计日志',
  };
  return map[name] ?? name;
}

function instrumentPurpose(name) {
  const map = {
    spectral_reflectance_and_hydration_scan: 'Detect hydration-linked optical residue and surface state drift.',
    thermal_relaxation_logger: 'Track heat dissipation, relaxation curves and persistence after perturbation.',
    weak_magnetic_phase_noise_probe: 'Measure weak magnetic or phase-noise differences under blinded conditions.',
    impedance_and_ion_conductivity_meter: 'Capture ion mobility, hydration state and material conductivity changes.',
    microstructure_entropy_analyzer: 'Estimate local order, non-random patterns and structure entropy changes.',
    time_series_blind_holdout_splitter: 'Preserve unseen validation windows for blind prediction checks.',
    null_channel_baseline_monitor: 'Confirm that no direct communication channel or leakage shortcut is present.',
    observer_bias_audit_log: 'Record operator state, prompt condition and potential interpretive bias.',
  };
  return map[name] ?? 'Measure mechanism-specific observable under bounded protocol.';
}

export function evaluateExperimentDesignSynthesizer(specInput = {}) {
  const spec = normalizeExperimentDesignSpec(specInput);
  const protocols = spec.candidateMechanisms.map(c => synthesizeExperimentProtocol(c, spec));
  const negativeProtocols = spec.negativeControls.map(c => synthesizeExperimentProtocol(c, spec, { negativeControl: true }));
  const promotedProtocols = protocols.filter(p => p.scores.promoted);
  const rejectedProtocols = [...protocols.filter(p => !p.scores.promoted), ...negativeProtocols.filter(p => p.scores.rejected)];
  const negativeControlsRejected = negativeProtocols.every(p => p.scores.rejected);
  const averageDesignScore = round(average(promotedProtocols.map(p => p.scores.designScore)));
  const averageAllScore = round(average(protocols.map(p => p.scores.designScore)));
  const blindHoldoutCoverageScore = round(average(protocols.map(p => p.scores.blindHoldoutScore)));
  const instrumentationCoverageScore = round(average(protocols.map(p => p.scores.instrumentationScore)));
  const falsifiabilityCoverageScore = round(average(protocols.map(p => p.scores.falsifiabilityScore)));
  const naturalLanguageDocumentReadinessScore = promotedProtocols.length ? 1 : 0;
  const established =
    promotedProtocols.length >= Number(spec.thresholds.minPromotedProtocols ?? 6) &&
    averageDesignScore >= Number(spec.thresholds.minAverageDesignScore ?? 0.88) &&
    (!spec.thresholds.requireNegativeControlsRejected || negativeControlsRejected) &&
    (!spec.thresholds.requireBlindHoldouts || blindHoldoutCoverageScore >= 0.95) &&
    (!spec.thresholds.requireNaturalLanguageDocs || naturalLanguageDocumentReadinessScore === 1);
  const result = {
    format: RCL_EXPERIMENT_DESIGN_RESULT_FORMAT,
    version: RCL_EXPERIMENT_DESIGN_VERSION,
    id: spec.id,
    objective: spec.objective,
    experimentDesignSynthesizerEstablished: established,
    generatedExperimentProtocols: true,
    generatedNaturalLanguageTechnicalDocuments: established,
    protocolCount: protocols.length,
    promotedProtocolCount: promotedProtocols.length,
    rejectedProtocolCount: rejectedProtocols.length,
    negativeControlCount: negativeProtocols.length,
    negativeControlsRejected,
    scores: {
      averageDesignScore,
      averageAllScore,
      blindHoldoutCoverageScore,
      instrumentationCoverageScore,
      falsifiabilityCoverageScore,
      naturalLanguageDocumentReadinessScore,
    },
    promotedProtocols: promotedProtocols.map(protocolSummary),
    rejectedProtocols: rejectedProtocols.map(protocolSummary),
    rootHash: sha256(JSON.stringify({ spec, promoted: promotedProtocols.map(p => p.rootHash), negative: negativeProtocols.map(p => p.rootHash) })),
  };
  return { spec, result, protocols, promotedProtocols, rejectedProtocols, negativeProtocols };
}

function protocolSummary(p) {
  return {
    id: p.id,
    title: p.title,
    translation: p.translation,
    sourceMechanism: p.sourceMechanism.translation,
    status: p.status,
    designScore: p.scores.designScore,
    controlGroups: p.controlGroups,
    blindHoldouts: p.blindHoldouts,
    rootHash: p.rootHash,
  };
}

export function renderExperimentTechnicalDocument(protocol) {
  const rows = [
    `# ${protocol.title}`,
    '',
    `**中文名**：${protocol.translation}`,
    `**格式**：${RCL_EXPERIMENT_TECH_DOC_FORMAT}`,
    `**机制来源**：${protocol.sourceMechanism.name}（${protocol.sourceMechanism.translation}）`,
    `**状态**：${protocol.status}`,
    `**设计分**：${protocol.scores.designScore}`,
    '',
    '## 1. 实验假设',
    '',
    protocol.hypothesis,
    '',
    '## 2. 变量设计',
    '',
    `- 自变量：${protocol.variables.independent.join('；')}`,
    `- 因变量：${protocol.variables.dependent.join('；')}`,
    `- 控制变量：${protocol.variables.controlled.join('；')}`,
    '',
    '## 3. 对照组',
    '',
    ...protocol.controlGroups.map(item => `- ${item}`),
    '',
    '## 4. 仪器与检测',
    '',
    ...protocol.instrumentationPlan.map(i => `- **${i.instrument}（${i.translation}）**：${i.purpose}`),
    '',
    '## 5. 执行步骤',
    '',
    ...protocol.procedure.map((step, index) => `${index + 1}. ${step}`),
    '',
    '## 6. 盲测项',
    '',
    ...protocol.blindHoldouts.map(item => `- ${item}`),
    '',
    '## 7. 成功标准',
    '',
    ...protocol.successCriteria.map(item => `- ${item}`),
    '',
    '## 8. 失败条件',
    '',
    ...protocol.failureConditions.map(item => `- ${item}`),
    '',
    '## 9. 输出证据',
    '',
    ...protocol.evidenceOutputs.map(item => `- ${item}`),
    '',
    '## 10. Root Hash',
    '',
    `\`${protocol.rootHash}\``,
    '',
  ];
  return {
    format: RCL_EXPERIMENT_TECH_DOC_FORMAT,
    id: `${protocol.id}-technical-document`,
    fileName: `${protocol.id}.md`,
    markdown: rows.join('\n'),
  };
}

export function runExperimentDesignSynthesizer(specInput = {}) {
  const evaluation = evaluateExperimentDesignSynthesizer(specInput);
  const documents = evaluation.promotedProtocols.map(renderExperimentTechnicalDocument);
  return {
    format: RCL_EXPERIMENT_DESIGN_BUNDLE_FORMAT,
    version: RCL_EXPERIMENT_DESIGN_VERSION,
    spec: evaluation.spec,
    result: evaluation.result,
    protocols: evaluation.protocols,
    documents,
    rootHash: sha256(JSON.stringify({ result: evaluation.result.rootHash, docs: documents.map(d => sha256(d.markdown)) })),
  };
}

export function buildExperimentDesignSpec(input = {}) {
  return normalizeExperimentDesignSpec(input);
}

export function renderExperimentDesignRcl(specInput = {}) {
  const spec = normalizeExperimentDesignSpec(specInput);
  const result = evaluateExperimentDesignSynthesizer(spec).result;
  return [
    'reality ExperimentDesignSynthesizer {',
    `  version : Text = "${RCL_EXPERIMENT_DESIGN_VERSION}"`,
    `  objective : Text = "${spec.objective.replaceAll('"', '\\"')}"`,
    `  protocol.count : Number = ${result.protocolCount}`,
    `  protocol.promoted : Number = ${result.promotedProtocolCount}`,
    `  validation.established : Truth = ${result.experimentDesignSynthesizerEstablished}`,
    `  validation.averageDesignScore : Number = ${result.scores.averageDesignScore}`,
    `  validation.negativeControlsRejected : Truth = ${result.negativeControlsRejected}`,
    `  root.hash : Text = "${result.rootHash}"`,
    '}',
  ].join('\n');
}

export function runExperimentDesignDemo(input = {}) {
  const bundle = runExperimentDesignSynthesizer(input);
  return {
    ok: true,
    version: RCL_EXPERIMENT_DESIGN_VERSION,
    experimentDesignSynthesizerEstablished: bundle.result.experimentDesignSynthesizerEstablished,
    protocolCount: bundle.result.protocolCount,
    promotedProtocolCount: bundle.result.promotedProtocolCount,
    averageDesignScore: bundle.result.scores.averageDesignScore,
    negativeControlsRejected: bundle.result.negativeControlsRejected,
    documentCount: bundle.documents.length,
    rootHash: bundle.rootHash,
  };
}

export function readExperimentDesignInput(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export function writeExperimentDesignReports(outDir, specInput = {}) {
  const dir = path.resolve(outDir);
  fs.mkdirSync(dir, { recursive: true });
  const bundle = runExperimentDesignSynthesizer(specInput);
  fs.writeFileSync(path.join(dir, 'experiment-design-spec.json'), `${JSON.stringify(bundle.spec, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'experiment-design-result.json'), `${JSON.stringify(bundle.result, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'experiment-protocols.json'), `${JSON.stringify(bundle.protocols, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'experiment-design.rcl'), `${renderExperimentDesignRcl(bundle.spec)}\n`);
  const docDir = path.join(dir, 'technical-docs');
  fs.mkdirSync(docDir, { recursive: true });
  for (const doc of bundle.documents) {
    fs.writeFileSync(path.join(docDir, doc.fileName), doc.markdown);
  }
  const bundlePath = path.join(dir, 'experiment-design-bundle.json');
  fs.writeFileSync(bundlePath, `${JSON.stringify(bundle, null, 2)}\n`);
  return {
    ok: true,
    format: RCL_EXPERIMENT_DESIGN_BUNDLE_FORMAT,
    version: RCL_EXPERIMENT_DESIGN_VERSION,
    outputDir: dir,
    resultFile: path.join(dir, 'experiment-design-result.json'),
    protocolFile: path.join(dir, 'experiment-protocols.json'),
    technicalDocsDir: docDir,
    documentCount: bundle.documents.length,
    experimentDesignSynthesizerEstablished: bundle.result.experimentDesignSynthesizerEstablished,
    promotedProtocolCount: bundle.result.promotedProtocolCount,
    averageDesignScore: bundle.result.scores.averageDesignScore,
    rootHash: bundle.rootHash,
  };
}

export function experimentDesignCanonicalRoot(input = {}) {
  return runExperimentDesignSynthesizer(input).rootHash;
}
