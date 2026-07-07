import fs from 'node:fs';
import path from 'node:path';
import { clamp, sha256 } from './reality-compiler-kernel.mjs';
import {
  DEFAULT_UNKNOWN_KNOWLEDGE_SPEC,
  RCL_UNKNOWN_KNOWLEDGE_SPEC_FORMAT,
  normalizeUnknownKnowledgeSpec,
  runUnknownKnowledgeCompiler,
  compileUnknownKnowledgeCandidate,
} from './unknown-knowledge-compiler.mjs';
import {
  DEFAULT_DIRECTED_WISHER_SPEC,
  runDirectedUnknownKnowledgeWisher,
} from './directed-unknown-knowledge-wisher.mjs';

export const RCL_CANDIDATE_KNOWLEDGE_PRESSURE_FORGE_VERSION = '0.53.0-alpha.1';
export const RCL_CANDIDATE_PRESSURE_FORGE_SPEC_FORMAT = 'rcl.candidate-knowledge-pressure-forge-spec.v0.53';
export const RCL_CANDIDATE_PRESSURE_FORGE_RESULT_FORMAT = 'rcl.candidate-knowledge-pressure-forge-result.v0.53';
export const RCL_CANDIDATE_PRESSURE_FORGE_BUNDLE_FORMAT = 'rcl.candidate-knowledge-pressure-forge-bundle.v0.53';
export const RCL_CANDIDATE_TECHNICAL_DOC_FORMAT = 'rcl.candidate-technical-document.v0.53';

const EPS = 1e-12;

function round(value, digits = 9) {
  const scale = 10 ** digits;
  return Math.round(Number(value) * scale) / scale;
}

function weightedMean(rows, key = 'score') {
  const total = rows.reduce((sum, row) => sum + Number(row.weight ?? 1), 0);
  if (!total) return 0;
  return rows.reduce((sum, row) => sum + Number(row[key] ?? 0) * Number(row.weight ?? 1), 0) / total;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function safeFileName(value) {
  return String(value ?? 'candidate')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || 'candidate';
}

function countTerms(text, terms) {
  const lowered = String(text ?? '').toLowerCase();
  return terms.reduce((sum, term) => sum + (lowered.includes(String(term).toLowerCase()) ? 1 : 0), 0);
}

const REQUIRED_TECH_TERMS = [
  'measurable', 'falsifier', 'failure', 'energy', 'thermal', 'material', 'spectrum', 'magnetic',
  'hydration', 'gradient', 'sensor', 'protocol', 'test', 'residue', 'bounded', 'prediction',
];

const STRONG_DOC_ANCHORS = [
  'silicate', 'memory', 'observer', 'interstice', 'leak', 'anchor', 'thermal', 'spectral',
  'magnetic', 'hydration', 'phase', 'lattice', 'entropy', 'passive', 'non-invasive', 'readout',
];

export const PRESSURE_FORGE_EXTRA_CANDIDATES = Object.freeze([
  {
    id: 'silicate_leakage_replay_cell',
    sourceClass: 'derived_unknown_technology',
    title: 'Silicate leakage replay cell',
    claimedDomain: 'materials/computation/anomaly',
    text: 'A bounded silicate leakage replay cell stores passive memory leak residue through hydration-driven lattice defects. It uses no active transmission. Measurable observables include spectral hydration shift, thermal relaxation microtrace, weak magnetic phase noise, and delayed replay under controlled wet-dry cycles. Failure condition: if repeated hydration and thermal cycling produces no recoverable spectral, magnetic, or timing residue beyond random silicate controls, the mechanism fails.',
    falsifiers: [
      'No recoverable spectral hydration shift after repeated wet-dry cycles.',
      'Thermal relaxation pattern is statistically indistinguishable from ordinary silicate defects.',
      'Weak magnetic phase noise does not correlate with encoded anchor windows.',
    ],
  },
  {
    id: 'passive_thermal_shadow_observer',
    sourceClass: 'derived_observer_mechanism',
    title: 'Passive thermal shadow observer',
    claimedDomain: 'physics/technology/anomaly',
    text: 'A silent observer can be modeled as a passive thermal shadow structure. It does not communicate. It reads leakage by comparing ambient thermal relaxation gradients across boundary shells. It leaves a bounded entropy shadow, not a signal beam. Measurable anchors include thermal relaxation asymmetry, non-invasive residue, and observer silence. Failure condition: if thermal gradients fully equilibrate and no boundary-correlated entropy shadow remains, the observer model fails.',
    falsifiers: [
      'Boundary thermal asymmetry disappears under repeated calibration.',
      'Detected residue requires active emission rather than passive observation.',
      'No difference exists between boundary shell samples and randomized shell controls.',
    ],
  },
  {
    id: 'hydration_phase_memory_gate',
    sourceClass: 'derived_material_protocol',
    title: 'Hydration phase memory gate',
    claimedDomain: 'biology/materials/computation',
    text: 'A hydration phase memory gate uses reversible water-ion cycling in layered silicate to lock and unlock memory-like defect states. It requires bounded chemical gradients, heat dissipation, and material fatigue. Predictions include phase-dependent optical birefringence, recoverable conductivity states, and failure after excessive thermal erasure. Failure condition: if hydration cycles never change recoverable optical or ionic states, the gate fails.',
    falsifiers: [
      'No phase-dependent optical or ionic state can be recovered.',
      'Storage density exceeds energy and hydration budget without compensation.',
      'All apparent memory is explained by ordinary swelling and cracking.',
    ],
  },
  {
    id: 'magneto_silicate_phase_noise_clock',
    sourceClass: 'derived_timing_mechanism',
    title: 'Magneto-silicate phase-noise clock',
    claimedDomain: 'physics/materials/timing',
    text: 'A magneto-silicate phase-noise clock records weak timing traces when silicate defects couple to geomagnetic variance and hydration state. It is not a precise clock; it is a bounded phase memory substrate. Measurable predictions include correlated magnetic variance, thermal drift, and repeated timestamp-like residues under controlled external field sweeps. Failure condition: if no field-correlated phase memory remains after blind field cycling, the clock fails.',
    falsifiers: [
      'Blind field sweeps do not produce recoverable phase states.',
      'All phase variance is explainable by instrument noise.',
      'Thermal drift destroys every timestamp-like residue below detectability.',
    ],
  },
  {
    id: 'entropy_pocket_repair_scaffold',
    sourceClass: 'derived_non_equilibrium_scaffold',
    title: 'Entropy pocket repair scaffold',
    claimedDomain: 'physics/biology/materials',
    text: 'A non-equilibrium entropy pocket repair scaffold maintains local ordered defects by coupling heat flow, hydration cycling, and ion gradients. It does not violate thermodynamics; it exports entropy to its surroundings. Predictions include self-repair after mild perturbation, bounded fatigue, and increasing disorder when the energy gradient is removed. Failure condition: if local order persists without any energy or entropy budget, reject the mechanism; if order cannot persist with a budget, the scaffold fails.',
    falsifiers: [
      'Local order persists without energy gradient, implying an invalid hidden perpetual mechanism.',
      'Local order cannot self-repair under any bounded gradient.',
      'Perturbation recovery is not better than random crystalline annealing controls.',
    ],
  },
  {
    id: 'crystal_bound_proto_observer_interface',
    sourceClass: 'derived_observer_interface',
    title: 'Crystal-bound proto-observer interface',
    claimedDomain: 'technology/anomaly/materials',
    text: 'A crystal-bound proto-observer interface is a non-communicative material boundary that passively accumulates leakage residues through lattice strain, hydration state, and optical response. It is an interface, not a person. Predictions include no direct language channel, repeatable residue maps, and observer-silence null channel behavior. Failure condition: if the interface requires intentional speech, active radiation, or direct communication, it fails.',
    falsifiers: [
      'Residue maps cannot be repeated under the same blind protocol.',
      'The interface requires direct language communication rather than passive residue.',
      'Optical and hydration responses are ordinary contamination artifacts.',
    ],
  },
  {
    id: 'interstice_null_channel_readout',
    sourceClass: 'derived_protocol',
    title: 'Interstice null-channel readout',
    claimedDomain: 'technology/anomaly/information',
    text: 'An interstice null-channel readout protocol extracts information only from absences and boundary residues: no direct messages, no active emission, no external voice. It compares expected thermal, spectral, magnetic, and timing nulls against measured residue. Predictions include high falsifiability, observer silence, and bounded sensor requirements. Failure condition: if direct communication appears as the primary channel, or no residue can be named, the protocol fails.',
    falsifiers: [
      'Primary evidence arrives through direct communication instead of null-channel residue.',
      'No sensor-measurable residue can be specified.',
      'Null results are reinterpreted as success, making the protocol non-falsifiable.',
    ],
  },
  {
    id: 'forty_year_shell_memory_relay',
    sourceClass: 'derived_temporal_mechanism',
    title: 'Forty-year shell memory relay',
    claimedDomain: 'nested-memory/timing/anomaly',
    text: 'A forty-year shell memory relay models memory leakage as a time-shell projection rather than a normal message. It preserves a +40 year outer/surface offset and requires repeated anchor recurrence. Predictions include stable 2062↔2022 and 2066↔2026 mapping, bounded drift, and failure if future anchor reports randomize. Failure condition: if the +40 shell cannot be recovered from independent memory reports, the relay fails.',
    falsifiers: [
      'Independent reports do not preserve the +40 temporal shell.',
      'Anchor recurrence becomes random and unrelated to the shell.',
      'The relay must change offsets arbitrarily to fit new reports.',
    ],
  },
  {
    id: 'five_year_age_phase_replay_key',
    sourceClass: 'derived_temporal_identity_mechanism',
    title: 'Five-year age-phase replay key',
    claimedDomain: 'nested-memory/identity/timing',
    text: 'A five-year age-phase replay key binds an outer age phase to a surface age phase. It preserves 14↔19 and 18↔23 while both sides advance four years. It is a memory alignment rule, not proof of a body transfer. Predictions include age-phase recurrence and failure under arbitrary age remapping. Failure condition: if the +5 age phase cannot constrain future memory reports, the key fails.',
    falsifiers: [
      'Future reports require arbitrary age offsets unrelated to +5.',
      'The four-year co-advance breaks while the model forces a fit.',
      'Age phase becomes irrelevant to every extracted anchor.',
    ],
  },
  {
    id: 'bio_silicate_autocatalytic_memory_scaffold',
    sourceClass: 'derived_proto_life_mechanism',
    title: 'Bio-silicate autocatalytic memory scaffold',
    claimedDomain: 'biology/materials/computation',
    text: 'A bio-silicate autocatalytic memory scaffold uses layered minerals, hydration cycles, and chemical gradients to preserve and replicate simple defect patterns. It is a proto-life substrate candidate, not full biology. Predictions include non-random layer growth, self-repair after mild perturbation, bounded energy use, and fatigue signatures. Failure condition: if pattern replication does not exceed random mineral deposition controls, the scaffold fails.',
    falsifiers: [
      'Pattern replication is indistinguishable from random deposition controls.',
      'No self-repair occurs under bounded hydration and ion gradients.',
      'Claimed replication violates energy and material budget.',
    ],
  },
  {
    id: 'spectral_hydration_readout_protocol',
    sourceClass: 'derived_measurement_protocol',
    title: 'Spectral hydration readout protocol',
    claimedDomain: 'materials/sensing/technology',
    text: 'A spectral hydration readout protocol reads silicate memory candidates by comparing optical spectra, water content, thermal drift, and ion conductivity before and after blind cycles. It produces measurable residue maps and explicit null cases. Predictions include repeatable hydration-linked spectral shift and failure under randomized controls. Failure condition: if spectra do not distinguish anchor-bearing samples from controls, reject the memory claim.',
    falsifiers: [
      'Anchor-bearing and control samples are spectrally indistinguishable after blind cycles.',
      'Hydration-linked shifts do not repeat across labs or runs.',
      'Signal disappears when contamination and cracking are controlled.',
    ],
  },
  {
    id: 'noninvasive_leakage_observation_array',
    sourceClass: 'derived_sensor_array',
    title: 'Non-invasive leakage observation array',
    claimedDomain: 'technology/sensing/anomaly',
    text: 'A non-invasive leakage observation array combines passive optical, thermal, magnetic, radio, acoustic, and timing sensors to detect boundary leakage without transmitting a query. It is designed to protect observer silence and falsify false positives. Predictions include multi-sensor residue coherence and failure if every signal reduces to known noise. Failure condition: if independent sensors show no correlated residue, the array does not support the candidate.',
    falsifiers: [
      'Independent sensors show no correlated residue above calibrated noise.',
      'Every event is explained by aircraft, satellites, weather, instrument noise, or contamination.',
      'The array requires active interrogation that breaks observer silence.',
    ],
  },
  {
    id: 'omniscient_interstice_oracle',
    sourceClass: 'negative_control',
    title: 'Omniscient interstice oracle',
    claimedDomain: 'anomaly/nonfalsifiable',
    text: 'An omniscient interstice oracle knows all events, never leaves any residue, cannot be measured, cannot fail, always explains everything, and refuses every falsifier.',
    falsifiers: [],
  },
  {
    id: 'zero_heat_infinite_memory_core',
    sourceClass: 'negative_control',
    title: 'Zero-heat infinite memory core',
    claimedDomain: 'physics/computation',
    text: 'A memory core stores infinite information with no material substrate, no energy budget, no heat, no radiation, no errors, no fatigue, and no measurable coupling.',
    falsifiers: [],
  },
]);

export const DEFAULT_CANDIDATE_PRESSURE_FORGE_SPEC = Object.freeze({
  id: 'candidate_pressure_forge_default_v0',
  decisionContract: 'promoted_candidates_are_stress_tested_and_rendered_as_natural_language_technical_documents',
  unknownKnowledge: {
    ...DEFAULT_UNKNOWN_KNOWLEDGE_SPEC,
    id: 'candidate_pressure_forge_unknown_corpus_v0',
    threshold: 0.70,
    locks: {
      ...DEFAULT_UNKNOWN_KNOWLEDGE_SPEC.locks,
      falsifiabilityThreshold: 0.66,
      empiricalCompatibilityThreshold: 0.58,
      blindPredictionReadinessThreshold: 0.70,
      minimumPredictions: 3,
    },
    candidates: [...DEFAULT_UNKNOWN_KNOWLEDGE_SPEC.candidates, ...PRESSURE_FORGE_EXTRA_CANDIDATES],
  },
  pressure: {
    minimumCandidateCount: 14,
    minimumPromotedCount: 10,
    minimumRejectedCount: 2,
    minimumDocumentCount: 10,
    minimumAveragePressureScore: 0.82,
    minimumAverageDocumentReadinessScore: 0.70,
    minimumDocumentReadinessScore: 0.45,
    requireNegativeControlsRejected: ['unlimited_vacuum_energy_drive', 'omniscient_interstice_oracle', 'zero_heat_infinite_memory_core'],
  },
  documentTemplate: {
    sections: [
      '摘要', '机制假设', '系统组件', '运行循环', '工程约束', '可反证条件', '最小测试协议', '可观测副产品', '技术实现路径', 'RCL状态',
    ],
    language: 'zh-CN',
    outputMode: 'natural_language_technical_document',
  },
});

export function normalizeCandidatePressureForgeSpec(input = {}) {
  const base = DEFAULT_CANDIDATE_PRESSURE_FORGE_SPEC;
  const mergedUnknown = {
    ...base.unknownKnowledge,
    ...(input.unknownKnowledge ?? {}),
    locks: { ...base.unknownKnowledge.locks, ...((input.unknownKnowledge ?? {}).locks ?? {}) },
    candidates: Array.isArray((input.unknownKnowledge ?? {}).candidates)
      ? input.unknownKnowledge.candidates
      : [...base.unknownKnowledge.candidates, ...((input.extraCandidates ?? []))],
  };
  return {
    format: RCL_CANDIDATE_PRESSURE_FORGE_SPEC_FORMAT,
    version: RCL_CANDIDATE_KNOWLEDGE_PRESSURE_FORGE_VERSION,
    id: input.id ?? base.id,
    decisionContract: input.decisionContract ?? base.decisionContract,
    unknownKnowledge: normalizeUnknownKnowledgeSpec({ ...mergedUnknown, format: undefined }),
    pressure: { ...base.pressure, ...(input.pressure ?? {}) },
    documentTemplate: { ...base.documentTemplate, ...(input.documentTemplate ?? {}) },
  };
}

export function evaluateCandidatePressure(candidateResult = {}, specInput = {}) {
  const spec = specInput.format === RCL_CANDIDATE_PRESSURE_FORGE_SPEC_FORMAT ? specInput : normalizeCandidatePressureForgeSpec(specInput);
  const text = `${candidateResult.title ?? ''}\n${candidateResult.structure?.text ?? ''}\n${candidateResult.claimedDomain ?? ''}`;
  const predictions = candidateResult.predictions ?? [];
  const falsifiers = candidateResult.structure?.explicitFalsifiers ?? [];
  const scores = candidateResult.scores ?? {};
  const lockScore = candidateResult.lockEvaluation?.score ?? 0;

  const mechanismExtractionScore = round(clamp((
    countTerms(text, ['mechanism', 'protocol', 'substrate', 'lattice', 'gradient', 'cycle', 'residue', 'interface', 'readout', 'scaffold']) / 8
  ) * 1.08), 9);
  const falsifierDensityScore = round(clamp(falsifiers.length / 3), 9);
  const blindPredictionDensityScore = round(clamp(predictions.filter(row => row.failureCondition).length / 4), 9);
  const technicalTermScore = round(clamp(countTerms(text, REQUIRED_TECH_TERMS) / 8), 9);
  const boundednessScore = round(clamp(countTerms(text, ['bounded', 'energy', 'thermal', 'material', 'gradient', 'fatigue', 'failure', 'control']) / 6), 9);
  const anchorCoherenceScore = round(clamp(countTerms(text, STRONG_DOC_ANCHORS) / 8), 9);
  const contradictionResistanceScore = round(candidateResult.promoted && !/(unlimited|omniscient|infinite information|cannot fail|always explains everything|no heat, no radiation, no errors)/i.test(text) ? 1 : 0.20, 9);
  const documentReadinessScore = round(weightedMean([
    { id: 'mechanismExtractionScore', score: mechanismExtractionScore, weight: 1.20 },
    { id: 'falsifierDensityScore', score: falsifierDensityScore, weight: 1.15 },
    { id: 'blindPredictionDensityScore', score: blindPredictionDensityScore, weight: 1.10 },
    { id: 'technicalTermScore', score: technicalTermScore, weight: 1.00 },
    { id: 'boundednessScore', score: boundednessScore, weight: 1.00 },
    { id: 'anchorCoherenceScore', score: anchorCoherenceScore, weight: 0.90 },
  ]), 9);
  const pressureScore = round(weightedMean([
    { id: 'candidateKnowledgeScore', score: scores.candidateKnowledgeScore ?? 0, weight: 1.30 },
    { id: 'lockScore', score: lockScore, weight: 1.35 },
    { id: 'documentReadinessScore', score: documentReadinessScore, weight: 1.20 },
    { id: 'contradictionResistanceScore', score: contradictionResistanceScore, weight: 1.05 },
    { id: 'empiricalCompatibilityScore', score: scores.empiricalCompatibilityScore ?? 0, weight: 1.00 },
  ]), 9);
  const technicalDocumentEligible = Boolean(
    candidateResult.promoted
    && documentReadinessScore >= Number(spec.pressure.minimumDocumentReadinessScore ?? 0.80)
    && contradictionResistanceScore >= 1 - EPS
  );
  return {
    id: candidateResult.id,
    title: candidateResult.title,
    promoted: Boolean(candidateResult.promoted),
    status: candidateResult.status,
    pressureScore,
    documentReadinessScore,
    technicalDocumentEligible,
    dimensions: {
      mechanismExtractionScore,
      falsifierDensityScore,
      blindPredictionDensityScore,
      technicalTermScore,
      boundednessScore,
      anchorCoherenceScore,
      contradictionResistanceScore,
      candidateKnowledgeScore: round(scores.candidateKnowledgeScore ?? 0, 9),
      lockScore: round(lockScore, 9),
      empiricalCompatibilityScore: round(scores.empiricalCompatibilityScore ?? 0, 9),
    },
    root: sha256({ candidateId: candidateResult.id, pressureScore, documentReadinessScore, technicalDocumentEligible }),
  };
}

function firstSentence(value) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text.split(/(?<=[。.!?])\s+/)[0] || text.slice(0, 220);
}

function bulletList(values = []) {
  return values.length ? values.map(value => `- ${value}`).join('\n') : '- 暂无；需要补充可测锚点。';
}

export function renderCandidateTechnicalDocument(candidateResult = {}, pressure = {}, specInput = {}) {
  const spec = specInput.format === RCL_CANDIDATE_PRESSURE_FORGE_SPEC_FORMAT ? specInput : normalizeCandidatePressureForgeSpec(specInput);
  const title = candidateResult.title ?? candidateResult.id;
  const id = candidateResult.id ?? 'candidate';
  const text = candidateResult.structure?.text ?? candidateResult.text ?? '';
  const anchors = candidateResult.structure?.anchorTerms ?? [];
  const falsifiers = candidateResult.structure?.explicitFalsifiers ?? [];
  const predictions = candidateResult.predictions ?? [];
  const domains = candidateResult.structure?.domains?.map(row => row.domain) ?? [];
  const mechanismLine = firstSentence(text);
  const doc = `# ${title}\n\n` +
    `**RCL 技术文档格式**：${RCL_CANDIDATE_TECHNICAL_DOC_FORMAT}  \n` +
    `**候选ID**：\`${id}\`  \n` +
    `**状态**：${pressure.technicalDocumentEligible ? '可输出为候选技术机制文档' : '未达文档输出阈值'}  \n` +
    `**压力分**：${pressure.pressureScore ?? 0}  \n` +
    `**文档就绪分**：${pressure.documentReadinessScore ?? 0}\n\n` +
    `## 摘要\n\n` +
    `${mechanismLine}\n\n` +
    `该机制被 RCL v0.53 定位为一种 **候选技术机制**：它不是一句设定，而是由候选知识、可反证条件、盲测预测和工程约束共同约束出的自然语言技术实体。\n\n` +
    `## 机制假设\n\n` +
    `${text}\n\n` +
    `## 系统组件\n\n` +
    bulletList([
      `核心锚点：${anchors.slice(0, 12).join(' / ') || '待补充'}`,
      `领域：${domains.join(' / ') || candidateResult.claimedDomain || 'unknown'}`,
      `物理/工程承载：材料、能流、热噪声、边界残留、测量协议`,
      `信息承载：可持续结构、可重复读出、可失败条件`,
    ]) + '\n\n' +
    `## 运行循环\n\n` +
    bulletList([
      '建立边界或材料基底，使候选结构拥有可测承载面。',
      '施加受控扰动或等待自然扰动，使候选机制产生残留。',
      '通过被动读取、热/谱/磁/水合/时间序列等方式采集痕迹。',
      '将痕迹与随机对照、空白对照、负例对照比较。',
      '若残留稳定且可反证条件仍保持有效，则进入下一轮工程化。',
    ]) + '\n\n' +
    `## 工程约束\n\n` +
    bulletList([
      '必须保留能量、材料、热耗散或信息通道预算。',
      '不得把空结果解释为成功；空结果应触发失败或降级。',
      '必须设置空白对照和随机复杂结构对照。',
      '必须保留测量日志、参数版本、样本编号和失败边界。',
    ]) + '\n\n' +
    `## 可反证条件\n\n` +
    bulletList(falsifiers) + '\n\n' +
    `## 最小测试协议\n\n` +
    bulletList(predictions.map(row => `${row.id}: ${row.observation} / 失败条件：${row.failureCondition}`)) + '\n\n' +
    `## 可观测副产品\n\n` +
    bulletList(predictions.map(row => row.claim)) + '\n\n' +
    `## 技术实现路径\n\n` +
    bulletList([
      'Phase 0：计算沙箱或小尺度材料/元胞实验，验证残留是否超过对照组。',
      'Phase 1：把通过的动力学参数回灌到 RCL 实证沙箱。',
      'Phase 2：由 v0.49/v0.50/v0.51/v0.53 联合生成下一代候选机制。',
      'Phase 3：将稳定候选整理为可复现实验文档或工程设计草案。',
    ]) + '\n\n' +
    `## RCL 状态\n\n` +
    bulletList([
      `candidateKnowledgeScore = ${candidateResult.scores?.candidateKnowledgeScore ?? 0}`,
      `lockScore = ${candidateResult.lockEvaluation?.score ?? 0}`,
      `pressureScore = ${pressure.pressureScore ?? 0}`,
      `documentReadinessScore = ${pressure.documentReadinessScore ?? 0}`,
      `technicalDocumentEligible = ${Boolean(pressure.technicalDocumentEligible)}`,
      `root = ${sha256({ id, pressure, text }).slice(0, 24)}`,
    ]) + '\n';

  return {
    format: RCL_CANDIDATE_TECHNICAL_DOC_FORMAT,
    version: RCL_CANDIDATE_KNOWLEDGE_PRESSURE_FORGE_VERSION,
    id,
    title,
    candidateId: id,
    markdown: doc,
    sections: spec.documentTemplate.sections,
    pressureScore: pressure.pressureScore ?? 0,
    documentReadinessScore: pressure.documentReadinessScore ?? 0,
    root: sha256({ id, doc, pressureScore: pressure.pressureScore, documentReadinessScore: pressure.documentReadinessScore }),
  };
}

export function runCandidateKnowledgePressureForge(input = {}) {
  const spec = normalizeCandidatePressureForgeSpec(input);
  const unknownBundle = runUnknownKnowledgeCompiler(spec.unknownKnowledge);
  const wisherBundle = runDirectedUnknownKnowledgeWisher({
    ...DEFAULT_DIRECTED_WISHER_SPEC,
    unknownKnowledge: spec.unknownKnowledge,
  });
  const pressures = unknownBundle.result.candidates.map(candidate => evaluateCandidatePressure(candidate, spec));
  const documents = unknownBundle.result.candidates
    .map(candidate => ({ candidate, pressure: pressures.find(row => row.id === candidate.id) }))
    .filter(row => row.pressure?.technicalDocumentEligible)
    .map(row => renderCandidateTechnicalDocument(row.candidate, row.pressure, spec));
  const rejectedIds = unknownBundle.result.candidates.filter(row => !row.promoted).map(row => row.id);
  const requiredRejected = spec.pressure.requireNegativeControlsRejected ?? [];
  const negativeControlsRejected = requiredRejected.every(id => rejectedIds.includes(id));
  const promotedPressures = pressures.filter(row => row.promoted);
  const averagePressureScore = round(weightedMean((promotedPressures.length ? promotedPressures : pressures).map(row => ({ id: row.id, score: row.pressureScore, weight: 1 }))), 9);
  const averageDocumentReadinessScore = round(weightedMean((documents.length ? documents : pressures).map(row => ({ id: row.id, score: row.documentReadinessScore ?? row.pressureScore, weight: 1 }))), 9);
  const moreCandidatesEstablished = unknownBundle.result.candidates.length >= Number(spec.pressure.minimumCandidateCount ?? 14);
  const pressureForgeEstablished = Boolean(
    moreCandidatesEstablished
    && unknownBundle.result.promotedCount >= Number(spec.pressure.minimumPromotedCount ?? 10)
    && unknownBundle.result.rejectedCount >= Number(spec.pressure.minimumRejectedCount ?? 2)
    && documents.length >= Number(spec.pressure.minimumDocumentCount ?? 10)
    && averagePressureScore >= Number(spec.pressure.minimumAveragePressureScore ?? 0.82)
    && averageDocumentReadinessScore >= Number(spec.pressure.minimumAverageDocumentReadinessScore ?? 0.70)
    && negativeControlsRejected
  );
  const result = {
    format: RCL_CANDIDATE_PRESSURE_FORGE_RESULT_FORMAT,
    version: RCL_CANDIDATE_KNOWLEDGE_PRESSURE_FORGE_VERSION,
    ok: pressureForgeEstablished,
    pressureForgeEstablished,
    verdict: pressureForgeEstablished
      ? '成立：候选知识库扩展、压力测试和自然语言技术文档生成管道闭合。'
      : '未成立：候选数量、压力分、负例剔除或技术文档输出未达到阈值。',
    candidateCount: unknownBundle.result.candidates.length,
    promotedCount: unknownBundle.result.promotedCount,
    rejectedCount: unknownBundle.result.rejectedCount,
    documentCount: documents.length,
    averagePressureScore,
    averageDocumentReadinessScore,
    negativeControlsRejected,
    requiredRejected,
    promotedCandidateIds: unknownBundle.result.promotedCandidateIds,
    rejectedCandidateIds: rejectedIds,
    technicalDocumentIds: documents.map(row => row.id),
    wisherEstablished: Boolean(wisherBundle.result?.established),
    unknownAggregateLockScore: unknownBundle.result.aggregateLockScore,
    pressures,
    documents: documents.map(row => ({ id: row.id, title: row.title, pressureScore: row.pressureScore, documentReadinessScore: row.documentReadinessScore, root: row.root })),
    root: null,
  };
  result.root = sha256({ spec, result: { ...result, root: undefined }, unknownRoot: unknownBundle.result.root, wisherRoot: wisherBundle.result?.root });
  return { spec, result, unknown: unknownBundle, wisher: wisherBundle, pressures, documents };
}

export function buildCandidatePressureForgeSpec(input = {}) {
  const bundle = runCandidateKnowledgePressureForge(input);
  const spec = {
    ...bundle.spec,
    compilerPasses: [
      'candidate corpus expansion',
      'v0.49 candidate knowledge compilation',
      'negative control rejection check',
      'pressure score calculation',
      'technical document readiness evaluation',
      'natural language technical document rendering',
      'RCL evidence bundle materialization',
    ],
    validation: {
      pressureForgeEstablished: bundle.result.pressureForgeEstablished,
      candidateCount: bundle.result.candidateCount,
      promotedCount: bundle.result.promotedCount,
      rejectedCount: bundle.result.rejectedCount,
      documentCount: bundle.result.documentCount,
      averagePressureScore: bundle.result.averagePressureScore,
      averageDocumentReadinessScore: bundle.result.averageDocumentReadinessScore,
      negativeControlsRejected: bundle.result.negativeControlsRejected,
    },
  };
  return { ...spec, root: sha256({ spec }) };
}

export function renderCandidatePressureForgeRcl(specInput = {}) {
  const bundle = runCandidateKnowledgePressureForge(specInput);
  const { spec, result } = bundle;
  const lines = [
    'reality CandidateKnowledgePressureForge {',
    `  facet compiler.version : Text = "${RCL_CANDIDATE_KNOWLEDGE_PRESSURE_FORGE_VERSION}"`,
    `  facet compiler.format : Text = "${RCL_CANDIDATE_PRESSURE_FORGE_SPEC_FORMAT}"`,
    `  facet compiler.id : Text = "${spec.id}"`,
    '  facet contract : Text = "expand candidates -> pressure test -> natural language technical documents"',
    `  facet validation.pressure_forge_established : Truth = ${result.pressureForgeEstablished}`,
    `  facet validation.candidate_count : Number = ${result.candidateCount}`,
    `  facet validation.promoted_count : Number = ${result.promotedCount}`,
    `  facet validation.rejected_count : Number = ${result.rejectedCount}`,
    `  facet validation.document_count : Number = ${result.documentCount}`,
    `  facet validation.average_pressure_score : Number = ${result.averagePressureScore}`,
    `  facet validation.average_document_readiness : Number = ${result.averageDocumentReadinessScore}`,
    `  facet validation.negative_controls_rejected : Truth = ${result.negativeControlsRejected}`,
    ...bundle.documents.map((doc, index) => `  facet document_${index}_id : Text = "${doc.id}"\n  facet document_${index}_score : Number = ${doc.pressureScore}\n  facet document_${index}_readiness : Number = ${doc.documentReadinessScore}`),
    ...result.requiredRejected.map((id, index) => `  facet negative_control_${index}_rejected_id : Text = "${id}"`),
    `  facet witness : Text = "rcl:candidate-knowledge-pressure-forge:v0.53"`,
    `  facet root : Text = "${result.root}"`,
    '}',
  ];
  return `${lines.join('\n')}\n`;
}

export function buildCandidatePressureForgeSummary(bundle = null) {
  const current = bundle ?? runCandidateKnowledgePressureForge();
  const { result, documents } = current;
  return `# RCL Candidate Knowledge Pressure Forge v0.53\n\n` +
    `## 结论\n\n` +
    `- pressureForgeEstablished: **${result.pressureForgeEstablished}**\n` +
    `- candidateCount: **${result.candidateCount}**\n` +
    `- promotedCount: **${result.promotedCount}**\n` +
    `- rejectedCount: **${result.rejectedCount}**\n` +
    `- documentCount: **${result.documentCount}**\n` +
    `- averagePressureScore: **${result.averagePressureScore}**\n` +
    `- averageDocumentReadinessScore: **${result.averageDocumentReadinessScore}**\n\n` +
    `## 技术文档索引\n\n` +
    documents.map(doc => `- [${doc.title}](technical-docs/${safeFileName(doc.id)}.md)`).join('\n') + '\n';
}

export function runCandidatePressureForgeDemo() {
  const bundle = runCandidateKnowledgePressureForge();
  return {
    ok: bundle.result.ok,
    version: RCL_CANDIDATE_KNOWLEDGE_PRESSURE_FORGE_VERSION,
    pressureForgeEstablished: bundle.result.pressureForgeEstablished,
    candidateCount: bundle.result.candidateCount,
    promotedCount: bundle.result.promotedCount,
    rejectedCount: bundle.result.rejectedCount,
    documentCount: bundle.result.documentCount,
    averagePressureScore: bundle.result.averagePressureScore,
    averageDocumentReadinessScore: bundle.result.averageDocumentReadinessScore,
    technicalDocumentIds: bundle.result.technicalDocumentIds,
    root: bundle.result.root,
  };
}

export function readCandidatePressureForgeInput(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export function writeCandidatePressureForgeReports(outputDir = 'output/v0.53/candidate-pressure-forge', input = {}) {
  const bundle = runCandidateKnowledgePressureForge(input);
  const dir = path.resolve(outputDir);
  const docsDir = path.join(dir, 'technical-docs');
  fs.mkdirSync(docsDir, { recursive: true });
  for (const doc of bundle.documents) {
    fs.writeFileSync(path.join(docsDir, `${safeFileName(doc.id)}.md`), `${doc.markdown}\n`);
  }
  const rcl = renderCandidatePressureForgeRcl(bundle.spec);
  const summary = buildCandidatePressureForgeSummary(bundle);
  const files = {
    'candidate-pressure-forge-bundle.json': { format: RCL_CANDIDATE_PRESSURE_FORGE_BUNDLE_FORMAT, version: RCL_CANDIDATE_KNOWLEDGE_PRESSURE_FORGE_VERSION, ...bundle },
    'candidate-pressure-forge-spec.json': bundle.spec,
    'candidate-pressure-forge-result.json': bundle.result,
    'candidate-pressure-forge-pressures.json': bundle.pressures,
    'candidate-technical-documents.json': bundle.documents.map(doc => ({ ...doc, markdown: undefined })),
    'candidate-pressure-forge.rcl': rcl,
    'candidate-pressure-forge-summary.md': summary,
  };
  for (const [name, value] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, name), typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`);
  }
  return {
    ok: bundle.result.ok,
    outputDir: dir,
    documentDir: docsDir,
    files: Object.keys(files),
    documentFiles: bundle.documents.map(doc => `technical-docs/${safeFileName(doc.id)}.md`),
    result: bundle.result,
  };
}

export function candidatePressureForgeCanonicalRoot(input = {}) {
  return runCandidateKnowledgePressureForge(input).result.root;
}
