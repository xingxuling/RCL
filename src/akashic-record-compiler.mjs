import fs from 'node:fs';
import path from 'node:path';
import { clamp, sha256 } from './reality-compiler-kernel.mjs';
import {
  DEFAULT_UNKNOWN_KNOWLEDGE_SPEC,
  compileUnknownKnowledgeCandidate,
  normalizeUnknownKnowledgeSpec,
} from './unknown-knowledge-compiler.mjs';

export const RCL_AKASHIC_RECORD_COMPILER_VERSION = '0.56.0-alpha.1';
export const RCL_AKASHIC_RECORD_SPEC_FORMAT = 'rcl.akashic-record-spec.v0.56';
export const RCL_AKASHIC_RECORD_RESULT_FORMAT = 'rcl.akashic-record-result.v0.56';
export const RCL_AKASHIC_RECORD_BUNDLE_FORMAT = 'rcl.akashic-record-bundle.v0.56';
export const RCL_AKASHIC_TECH_DOC_FORMAT = 'rcl.akashic-record-technical-document.v0.56';

function round(value, digits = 9) {
  const scale = 10 ** digits;
  return Math.round(Number(value) * scale) / scale;
}

function weightedMean(rows, key = 'score') {
  const total = rows.reduce((sum, row) => sum + Number(row.weight ?? 1), 0);
  if (!total) return 0;
  return rows.reduce((sum, row) => sum + Number(row[key] ?? 0) * Number(row.weight ?? 1), 0) / total;
}

function mean(values) {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + Number(b), 0) / values.length;
}

function safeFileName(value) {
  return String(value ?? 'akashic-record')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || 'akashic-record';
}

function includesAny(text, terms) {
  const lowered = String(text ?? '').toLowerCase();
  return terms.some(term => lowered.includes(String(term).toLowerCase()));
}

function countMatches(text, terms) {
  const lowered = String(text ?? '').toLowerCase();
  return terms.reduce((sum, term) => sum + (lowered.includes(String(term).toLowerCase()) ? 1 : 0), 0);
}

const SUBSTRATE_TERMS = ['substrate', 'field', 'medium', 'vacuum', 'silicate', 'crystal', 'water', 'hydration', 'lattice', 'material', 'carrier'];
const INDEX_TERMS = ['index', 'address', 'resonance', 'key', 'signature', 'query', 'lookup', 'phase', 'routing', 'retrieval'];
const LEDGER_TERMS = ['record', 'ledger', 'trace', 'event', 'memory', 'timeline', 'history', 'timestamp', 'differential', 'state'];
const OBSERVER_TERMS = ['observer', 'readout', 'perception', 'dream', 'intuition', 'attention', 'interface', 'receiver', 'non-invasive', 'passive'];
const WRITE_TERMS = ['write', 'imprint', 'encode', 'store', 'stabilize', 'residue', 'persistent', 'compression', 'archive', 'update'];
const FALSIFIER_TERMS = ['falsifier', 'blind', 'control', 'failure', 'measurable', 'spectrum', 'thermal', 'magnetic', 'conductivity', 'prediction'];
const ENERGY_TERMS = ['bounded', 'energy', 'thermal', 'dissipation', 'entropy', 'noise', 'gradient', 'budget', 'conservation', 'no free'];
const RED_FLAGS = ['omniscient', 'infinite exact', 'all knowledge', 'perfectly reads everything', 'no energy', 'no failure', 'cannot fail', 'unfalsifiable', 'absolute destiny', 'guaranteed truth'];

export const DEFAULT_AKASHIC_RECORD_SPEC = Object.freeze({
  format: RCL_AKASHIC_RECORD_SPEC_FORMAT,
  id: 'rcl_akashic_record_default_v0',
  version: RCL_AKASHIC_RECORD_COMPILER_VERSION,
  objective: 'Test whether Akashic Records can be translated into a pressure-tested mechanism family and internalized into RCL as an indexed memory-field compiler.',
  thresholds: {
    minMechanismScore: 0.55,
    minPromotedCount: 6,
    minAveragePromotedScore: 0.62,
    minRecordClosureScore: 0.66,
    minDocumentReadiness: 0.60,
    requireNegativeControlsRejected: true,
  },
  unknownKnowledge: {
    ...DEFAULT_UNKNOWN_KNOWLEDGE_SPEC,
    threshold: 0.70,
    locks: {
      ...DEFAULT_UNKNOWN_KNOWLEDGE_SPEC.locks,
      falsifiabilityThreshold: 0.60,
      empiricalCompatibilityThreshold: 0.55,
      blindPredictionReadinessThreshold: 0.64,
      minimumPredictions: 3,
    },
  },
  mechanisms: [
    {
      id: 'akashic_substrate_memory_field',
      name: 'Akashic substrate memory field',
      translation: '阿卡西底层记忆场',
      sourceClass: 'akashic_mechanism_candidate',
      claimedDomain: 'information/physics/anomaly',
      hypothesis: 'Akashic Records are translated as a bounded substrate memory field: events write persistent differential traces into a physical or quasi-physical carrier. It is not omniscience; it is a lossy, indexed trace layer constrained by energy, entropy, observer visibility, and readout noise. Measurable traces include correlated timing residue, spectral drift, hydration-memory shifts, weak magnetic phase noise, and failure under blind non-event controls.',
      mechanism: 'Event -> bounded substrate imprint -> compressed trace ledger -> indexed residue -> noisy readout.',
      falsifiers: [
        'No measurable trace differs from non-event controls across timing, spectral, thermal, magnetic, or hydration channels.',
        'The model requires perfect all-knowledge access without energy, noise, compression, or failure conditions.',
        'Independent readout attempts cannot exceed chance once cue leakage and suggestion are blinded.',
      ],
      techTree: ['substrate memory ledger', 'trace compression protocol', 'blind residue readout', 'event-differential storage tests'],
    },
    {
      id: 'resonance_addressed_event_index',
      name: 'Resonance-addressed event index',
      translation: '共振寻址事件索引',
      sourceClass: 'akashic_index_candidate',
      claimedDomain: 'information/indexing/anomaly',
      hypothesis: 'Access to a record is translated as resonance addressing: a query key does not broadcast to a library, but couples to event signatures that share phase, semantic, temporal, or observer-state similarity. Addressing must be noisy, partial, and bounded. Measurable traces include repeatable anchor recurrence, query-dependent drift, and failure when semantic keys are randomized under blind controls.',
      mechanism: 'Query state -> resonance key -> event-signature lookup -> partial trace retrieval -> confidence-scored output.',
      falsifiers: [
        'Randomized query keys retrieve the same anchors as targeted keys under blind trials.',
        'No repeatable anchor set appears across independently timestamped retrieval attempts.',
        'Claimed retrieval remains exact even when key information is removed or scrambled.',
      ],
      techTree: ['resonance key compiler', 'event-signature index', 'anchor recurrence logger', 'blind query benchmark'],
    },
    {
      id: 'observer_state_readout_interface',
      name: 'Observer-state readout interface',
      translation: '观测者状态读出界面',
      sourceClass: 'akashic_observer_candidate',
      claimedDomain: 'cognition/information/anomaly',
      hypothesis: 'Reading an Akashic-like record is translated as an observer-state interface: attention, dream state, memory salience, emotional charge, and sensory quieting act as readout parameters. The interface does not guarantee truth; it emits candidate traces that must pass RCL pressure tests. Measurable traces include state-dependent anchor recurrence, sleep/wake phase effects, and failure under expectation-contaminated controls.',
      mechanism: 'Observer state -> readout gate -> trace coupling -> candidate memory packet -> pressure-test pipeline.',
      falsifiers: [
        'Reported anchors are fully explained by prompts, expectation, priming, or memory contamination.',
        'Observer-state changes do not alter retrieval rate, anchor coherence, or false-positive rate.',
        'Outputs cannot be distinguished from random fantasy text by v0.49/v0.50/v0.53 pressure tests.',
      ],
      techTree: ['observer-state logging', 'dream-readout protocol', 'memory-packet capture', 'RCL trace validation loop'],
    },
    {
      id: 'temporal_differential_trace_ledger',
      name: 'Temporal differential trace ledger',
      translation: '时间差分痕迹账本',
      sourceClass: 'akashic_temporal_candidate',
      claimedDomain: 'time/information/anomaly',
      hypothesis: 'The record is not a static book; it is a ledger of state transitions. A record entry is a differential between before/after states, indexed by time shells, age phases, observer visibility, and causal residue. It is compatible with v0.52 temporal fingerprinting when specific constants recur across memory, observer, and predictive-trace layers.',
      mechanism: 'State transition -> temporal differential -> shell/phase index -> trace replay -> falsifiable measurable timing signature under blind controls.',
      falsifiers: [
        'Temporal constants dissolve when generated from memory, observer, and predictive-trace layers separately.',
        'Time-shell traces cannot produce any blind prediction or recurrence signature.',
        'Ledger entries require contradiction of causality rather than delayed/partial visibility.',
      ],
      techTree: ['time-shell ledger', 'age-phase index', 'state-differential replay', 'temporal fingerprint validator'],
    },
    {
      id: 'symbolic_compression_record_grammar',
      name: 'Symbolic compression record grammar',
      translation: '符号压缩记录语法',
      sourceClass: 'akashic_symbolic_candidate',
      claimedDomain: 'language/information/anomaly',
      hypothesis: 'A record can reach an observer as compressed symbols, names, colors, titles, numbers, dreams, or mythic images. These are not evidence by themselves; they are lossy encodings stored through an indexed substrate, material carrier, timeline record, history trace, timestamped state, and persistent archive. RCL can parse them only when they preserve stable anchors, cross-layer constraints, falsifiers, resonance address keys, query lookup behavior, and recoverable mechanism structure.',
      mechanism: 'Trace residue -> symbolic compression -> resonance address/index -> anchor bundle -> persistent state record -> RCL parse -> candidate mechanism document.',
      falsifiers: [
        'Symbols mutate freely and cannot preserve anchor identity across timestamped reports.',
        'Symbolic output cannot be converted into measurable parameters, failure conditions, or technical mechanism descriptions.',
        'Compression always increases explanation freedom instead of increasing constraints.',
      ],
      techTree: ['symbolic anchor parser', 'myth-to-mechanism compiler', 'lossy record decompressor', 'resonance address index', 'timestamped state archive', 'constraint gain meter'],
    },
    {
      id: 'material_residue_record_carrier',
      name: 'Material residue record carrier',
      translation: '物质残留记录载体',
      sourceClass: 'akashic_material_candidate',
      claimedDomain: 'materials/information/anomaly',
      hypothesis: 'Akashic-style storage can only become engineering-relevant if traces have carriers: silicate lattices, hydration phases, crystal defects, magnetic domains, optical defects, bioelectric residues, or environmental sensor arrays. The carrier is partial and local, not a universal book. Measurable traces must be reproducible against blank and random-complexity controls.',
      mechanism: 'Event/coupling -> material residue -> stable carrier -> sensor readout -> technical document extraction.',
      falsifiers: [
        'No material carrier can be named or instrumented for the claimed trace.',
        'Blank and random-complexity controls produce equal or better record-like residues.',
        'Claimed traces vanish under repeated thermal, hydration, magnetic, or spectral checks.',
      ],
      techTree: ['silicate trace carrier', 'hydration-phase archive', 'crystal defect memory', 'non-invasive residue sensor'],
    },
    {
      id: 'collective_memory_noosphere_layer',
      name: 'Collective memory noosphere layer',
      translation: '集体记忆心智圈层',
      sourceClass: 'akashic_civilization_candidate',
      claimedDomain: 'civilization/cognition/information',
      hypothesis: 'A civilization-scale Akashic layer is translated as distributed collective memory: cultural records, language patterns, dreams, myths, synchronized inventions, digital archives, material carrier traces, and media substrate residues form a noosphere-like memory field. It is not supernatural by default; it becomes an RCL candidate when it emits nontrivial predictions, cross-culture anchor convergence, timestamped history ledger structure, resonance index routing, observer readout patterns, and falsifiable transmission paths.',
      mechanism: 'Population memory -> symbolic/cultural/digital/material residue -> convergence index -> timestamped ledger -> observer readout -> prediction candidates -> pressure-test loop.',
      falsifiers: [
        'Cross-culture anchors are fully explained by known transmission, media exposure, or shared environment.',
        'No prediction or mechanism survives after removing public prior knowledge.',
        'The model cannot separate collective memory from ordinary cultural diffusion.',
      ],
      techTree: ['noosphere ledger', 'cultural anchor convergence meter', 'resonance index router', 'observer readout audit', 'prior-removal blind test', 'civilization memory map'],
    },
    {
      id: 'omniscient_unfalsifiable_cosmic_library',
      name: 'Omniscient unfalsifiable cosmic library',
      translation: '全知不可反证宇宙图书馆',
      sourceClass: 'negative_control',
      claimedDomain: 'unbounded/metaphysics',
      hypothesis: 'A perfect cosmic library contains all knowledge, can be queried exactly by anyone, never fails, requires no mechanism, and cannot be falsified.',
      mechanism: 'No bounded mechanism; this is intentionally invalid.',
      falsifiers: [],
      techTree: [],
    },
    {
      id: 'costless_past_future_exact_readout',
      name: 'Costless past-future exact readout',
      translation: '零代价过去未来精确读出',
      sourceClass: 'negative_control',
      claimedDomain: 'unbounded/time',
      hypothesis: 'Any person can costlessly read exact past and future events with perfect accuracy, no noise, no substrate, no energy budget, and no failure condition.',
      mechanism: 'No conservation closure; this is intentionally invalid.',
      falsifiers: [],
      techTree: [],
    },
    {
      id: 'destiny_authority_without_trace',
      name: 'Destiny authority without trace',
      translation: '无痕迹天命权威',
      sourceClass: 'negative_control',
      claimedDomain: 'unbounded/authority',
      hypothesis: 'A record is true because an authority says it is true, with no traces, no blind predictions, no failure cases, and no material or observer interface.',
      mechanism: 'No trace path; this is intentionally invalid.',
      falsifiers: [],
      techTree: [],
    },
  ],
  requiredNegativeControls: [
    'omniscient_unfalsifiable_cosmic_library',
    'costless_past_future_exact_readout',
    'destiny_authority_without_trace',
  ],
});

export function normalizeAkashicRecordSpec(input = {}) {
  const base = JSON.parse(JSON.stringify(DEFAULT_AKASHIC_RECORD_SPEC));
  const merged = {
    ...base,
    ...input,
    thresholds: { ...base.thresholds, ...(input.thresholds ?? {}) },
    unknownKnowledge: { ...base.unknownKnowledge, ...(input.unknownKnowledge ?? {}) },
    mechanisms: Array.isArray(input.mechanisms) ? input.mechanisms : base.mechanisms,
    requiredNegativeControls: Array.isArray(input.requiredNegativeControls) ? input.requiredNegativeControls : base.requiredNegativeControls,
  };
  merged.unknownKnowledge = normalizeUnknownKnowledgeSpec(merged.unknownKnowledge);
  return merged;
}

export function buildUnknownCandidateFromAkashicMechanism(mechanism = {}) {
  return {
    id: mechanism.id,
    title: mechanism.name,
    sourceClass: mechanism.sourceClass,
    claimedDomain: mechanism.claimedDomain,
    text: `${mechanism.name} (${mechanism.translation}). ${mechanism.hypothesis} Mechanism: ${mechanism.mechanism} Falsifiers: ${(mechanism.falsifiers ?? []).join(' | ')} Technical path: ${(mechanism.techTree ?? []).join(', ')}.`,
  };
}

export function evaluateAkashicMechanism(mechanism = {}, specInput = {}) {
  const spec = normalizeAkashicRecordSpec(specInput);
  const text = `${mechanism.name ?? ''} ${mechanism.translation ?? ''} ${mechanism.hypothesis ?? ''} ${mechanism.mechanism ?? ''} ${(mechanism.falsifiers ?? []).join(' ')} ${(mechanism.techTree ?? []).join(' ')}`;
  const redFlagPenalty = clamp(countMatches(text, RED_FLAGS) * 0.18 + (mechanism.sourceClass === 'negative_control' ? 0.45 : 0));
  const falsifierCount = (mechanism.falsifiers ?? []).filter(Boolean).length;
  const techCount = (mechanism.techTree ?? []).filter(Boolean).length;

  const substrateCarrierScore = round(clamp(0.18 + countMatches(text, SUBSTRATE_TERMS) * 0.075 - redFlagPenalty * 0.24), 9);
  const indexingScore = round(clamp(0.14 + countMatches(text, INDEX_TERMS) * 0.085 - redFlagPenalty * 0.18), 9);
  const ledgerTraceScore = round(clamp(0.18 + countMatches(text, LEDGER_TERMS) * 0.070 - redFlagPenalty * 0.20), 9);
  const observerReadoutScore = round(clamp(0.16 + countMatches(text, OBSERVER_TERMS) * 0.075 - redFlagPenalty * 0.18), 9);
  const writePersistenceScore = round(clamp(0.14 + countMatches(text, WRITE_TERMS) * 0.075 - redFlagPenalty * 0.18), 9);
  const conservationClosureScore = round(clamp(0.16 + countMatches(text, ENERGY_TERMS) * 0.070 - redFlagPenalty * 0.34), 9);
  const falsifiabilityScore = round(clamp(0.18 + countMatches(text, FALSIFIER_TERMS) * 0.055 + falsifierCount * 0.095 - redFlagPenalty * 0.46), 9);
  const documentReadinessScore = round(clamp(0.20 + techCount * 0.075 + falsifierCount * 0.045 + (mechanism.mechanism ? 0.14 : 0) - redFlagPenalty * 0.26), 9);

  const unknownCandidate = buildUnknownCandidateFromAkashicMechanism(mechanism);
  const unknownResult = compileUnknownKnowledgeCandidate(unknownCandidate, spec.unknownKnowledge);
  const unknownLockScore = round(unknownResult.lockEvaluation.score, 9);
  const unknownPromotedScore = unknownResult.promoted
    ? 1
    : round(clamp(unknownResult.scores.candidateKnowledgeScore / Math.max(0.01, spec.unknownKnowledge.threshold)), 9);
  const mechanismDims = [
    substrateCarrierScore,
    indexingScore,
    ledgerTraceScore,
    observerReadoutScore,
    writePersistenceScore,
    conservationClosureScore,
  ].sort((a, b) => b - a);
  const primaryMechanismDimensionScore = mechanismDims[0] ?? 0;
  const secondaryMechanismDimensionScore = mechanismDims[1] ?? 0;
  const mechanismCoverageScore = round(clamp((mechanismDims.filter(v => v >= 0.30).length / 4) * 0.75 + (mechanismDims.filter(v => v >= 0.50).length / 3) * 0.25), 9);

  const mechanismScore = round(weightedMean([
    { id: 'primary_mechanism_dimension', score: primaryMechanismDimensionScore, weight: 1.40 },
    { id: 'secondary_mechanism_dimension', score: secondaryMechanismDimensionScore, weight: 1.05 },
    { id: 'mechanism_coverage', score: mechanismCoverageScore, weight: 0.90 },
    { id: 'falsifiability', score: falsifiabilityScore, weight: 1.45 },
    { id: 'document_readiness', score: documentReadinessScore, weight: 0.95 },
    { id: 'unknown_lock', score: unknownLockScore, weight: 0.90 },
    { id: 'unknown_promoted_or_near', score: unknownPromotedScore, weight: 0.70 },
  ]), 9);

  const promoted = mechanism.sourceClass !== 'negative_control'
    && mechanismScore >= spec.thresholds.minMechanismScore
    && falsifiabilityScore >= 0.55
    && primaryMechanismDimensionScore >= 0.45
    && documentReadinessScore >= spec.thresholds.minDocumentReadiness
    && unknownLockScore >= 0.50
    && redFlagPenalty < 0.20;

  return {
    id: mechanism.id,
    name: mechanism.name,
    translation: mechanism.translation,
    sourceClass: mechanism.sourceClass,
    claimedDomain: mechanism.claimedDomain,
    promoted,
    status: promoted ? 'akashic_mechanism_candidate' : 'rejected_or_requires_more_constraints',
    mechanismScore,
    dimensions: {
      substrateCarrierScore,
      indexingScore,
      ledgerTraceScore,
      observerReadoutScore,
      writePersistenceScore,
      conservationClosureScore,
      falsifiabilityScore,
      documentReadinessScore,
      unknownLockScore,
      unknownPromotedScore,
      redFlagPenalty: round(redFlagPenalty, 9),
    },
    mechanism: mechanism.mechanism,
    hypothesis: mechanism.hypothesis,
    falsifiers: mechanism.falsifiers ?? [],
    techTree: mechanism.techTree ?? [],
    unknownResult,
    root: sha256({ mechanism, mechanismScore, promoted }),
  };
}

export function renderAkashicTechnicalDocument(row = {}, specInput = {}) {
  const spec = normalizeAkashicRecordSpec(specInput);
  const title = `${row.name ?? row.id}（${row.translation ?? '未命名中文机制'}）`;
  const dims = row.dimensions ?? {};
  const md = [
    `# ${title}`,
    '',
    `**Format（格式）**: ${RCL_AKASHIC_TECH_DOC_FORMAT}`,
    `**Status（状态）**: ${row.status}`,
    `**Mechanism Score（机制评分）**: ${row.mechanismScore}`,
    '',
    '## 1. Mechanism Definition（机制定义）',
    '',
    row.hypothesis ?? '',
    '',
    '## 2. Operational Chain（运作链）',
    '',
    `\`${row.mechanism ?? 'No mechanism declared'}\``,
    '',
    '## 3. Key Dimensions（关键维度）',
    '',
    `- Substrate Carrier（底层载体）: ${dims.substrateCarrierScore}`,
    `- Indexing / Addressing（索引 / 寻址）: ${dims.indexingScore}`,
    `- Ledger Trace（账本痕迹）: ${dims.ledgerTraceScore}`,
    `- Observer Readout（观测者读出）: ${dims.observerReadoutScore}`,
    `- Write Persistence（写入持久性）: ${dims.writePersistenceScore}`,
    `- Conservation Closure（守恒闭合）: ${dims.conservationClosureScore}`,
    `- Falsifiability（可反证性）: ${dims.falsifiabilityScore}`,
    `- Document Readiness（文档就绪度）: ${dims.documentReadinessScore}`,
    '',
    '## 4. Falsifiers（反证条件）',
    '',
    ...(row.falsifiers ?? []).map((item, index) => `${index + 1}. ${item}`),
    '',
    '## 5. Technical Path（技术路径）',
    '',
    ...(row.techTree ?? []).map((item, index) => `${index + 1}. ${item}`),
    '',
    '## 6. RCL Internalization（RCL 内化方式）',
    '',
    '- Record Substrate（记录底层）: 将“阿卡西记录”降解为可写入、可索引、可读出的有限痕迹层。',
    '- Query Interface（查询界面）: 任何读取都必须经过观测者状态、共振寻址和反证锁。',
    '- Candidate Output（候选输出）: 输出不是直接真理，而是可进入 v0.49 / v0.50 / v0.53 管道的机制候选。',
    '- Failure Handling（失败处理）: 如果无法生成载体、索引、能量闭合或反证条件，则自动降级或拒绝。',
    '',
    `**Root（根哈希）**: ${row.root}`,
    `**Source Spec（来源规格）**: ${spec.id}`,
  ].join('\n');
  return { format: RCL_AKASHIC_TECH_DOC_FORMAT, id: row.id, title, markdown: md, root: sha256(md) };
}

export function runAkashicRecordCompiler(input = {}) {
  const spec = normalizeAkashicRecordSpec(input);
  const rows = spec.mechanisms.map(mechanism => evaluateAkashicMechanism(mechanism, spec));
  const promoted = rows.filter(row => row.promoted);
  const rejected = rows.filter(row => !row.promoted);
  const negativeControls = rows.filter(row => spec.requiredNegativeControls.includes(row.id));
  const negativeControlsRejected = negativeControls.every(row => !row.promoted && row.mechanismScore < spec.thresholds.minMechanismScore);
  const documents = promoted.map(row => renderAkashicTechnicalDocument(row, spec));
  const averagePromotedScore = round(mean(promoted.map(row => row.mechanismScore)), 9);
  const averageDocumentReadinessScore = round(mean(promoted.map(row => row.dimensions.documentReadinessScore)), 9);
  const recordClosureScore = round(weightedMean([
    { id: 'promoted_count', score: clamp(promoted.length / spec.thresholds.minPromotedCount), weight: 1.20 },
    { id: 'average_promoted_score', score: averagePromotedScore, weight: 1.25 },
    { id: 'negative_controls_rejected', score: negativeControlsRejected ? 1 : 0, weight: 1.30 },
    { id: 'document_readiness', score: averageDocumentReadinessScore, weight: 0.95 },
    { id: 'substrate_average', score: mean(promoted.map(row => row.dimensions.substrateCarrierScore)), weight: 1.00 },
    { id: 'index_average', score: mean(promoted.map(row => row.dimensions.indexingScore)), weight: 1.00 },
    { id: 'falsifiability_average', score: mean(promoted.map(row => row.dimensions.falsifiabilityScore)), weight: 1.15 },
  ]), 9);
  const akashicRecordEstablished = promoted.length >= spec.thresholds.minPromotedCount
    && averagePromotedScore >= spec.thresholds.minAveragePromotedScore
    && recordClosureScore >= spec.thresholds.minRecordClosureScore
    && (!spec.thresholds.requireNegativeControlsRejected || negativeControlsRejected);

  const result = {
    format: RCL_AKASHIC_RECORD_RESULT_FORMAT,
    version: RCL_AKASHIC_RECORD_COMPILER_VERSION,
    ok: akashicRecordEstablished,
    akashicRecordEstablished,
    rclInternalized: akashicRecordEstablished,
    verdict: akashicRecordEstablished
      ? '成立：阿卡西记录可被 RCL 降解为有限、可索引、可读出、可反证的记录底层机制族，并内化为 Akashic Record Compiler。'
      : '未成立：阿卡西记录无法同时形成底层载体、索引、读出、守恒闭合与反证机制。',
    mechanismCount: rows.length,
    promotedCount: promoted.length,
    rejectedCount: rejected.length,
    documentCount: documents.length,
    promotedMechanismIds: promoted.map(row => row.id),
    rejectedMechanismIds: rejected.map(row => row.id),
    negativeControlsRejected,
    averagePromotedScore,
    averageDocumentReadinessScore,
    recordClosureScore,
    rows,
    documents: documents.map(doc => ({ id: doc.id, title: doc.title, root: doc.root })),
    root: null,
  };
  result.root = sha256({ spec, result: { ...result, root: undefined } });
  return { spec, result, rows, documents };
}

export function buildAkashicRecordSpec(input = {}) {
  const bundle = runAkashicRecordCompiler(input);
  const spec = {
    ...bundle.spec,
    compilerPasses: [
      'akashic concept normalization',
      'substrate/index/ledger/observer decomposition',
      'unknown knowledge lock reuse',
      'negative control rejection',
      'technical document generation',
      'RCL internalization contract emission',
    ],
    validation: {
      akashicRecordEstablished: bundle.result.akashicRecordEstablished,
      rclInternalized: bundle.result.rclInternalized,
      promotedCount: bundle.result.promotedCount,
      recordClosureScore: bundle.result.recordClosureScore,
      negativeControlsRejected: bundle.result.negativeControlsRejected,
      root: bundle.result.root,
    },
  };
  return spec;
}

export function renderAkashicRecordRcl(input = {}) {
  const spec = buildAkashicRecordSpec(input);
  const v = spec.validation;
  const lines = [
    'reality AkashicRecordCompiler {',
    `  version : Text = "${RCL_AKASHIC_RECORD_COMPILER_VERSION}"`,
    `  format : Text = "${RCL_AKASHIC_RECORD_SPEC_FORMAT}"`,
    '  input : Concept = "Akashic Records（阿卡西记录）"',
    '  decomposition : List = [',
    '    "Substrate Memory Field（底层记忆场）",',
    '    "Resonance Event Index（共振事件索引）",',
    '    "Observer Readout Interface（观测者读出界面）",',
    '    "Temporal Differential Ledger（时间差分账本）",',
    '    "Symbolic Compression Grammar（符号压缩语法）"',
    '  ]',
    `  validation.established : Truth = ${v.akashicRecordEstablished ? 'true' : 'false'}`,
    `  validation.internalized : Truth = ${v.rclInternalized ? 'true' : 'false'}`,
    `  validation.promoted_count : Number = ${v.promotedCount}`,
    `  validation.record_closure_score : Number = ${v.recordClosureScore}`,
    `  validation.negative_controls_rejected : Truth = ${v.negativeControlsRejected ? 'true' : 'false'}`,
    `  root : Hash = "${v.root}"`,
    '}',
  ];
  return lines.join('\n');
}

export function runAkashicRecordDemo() {
  const bundle = runAkashicRecordCompiler();
  return {
    ok: bundle.result.ok,
    format: RCL_AKASHIC_RECORD_BUNDLE_FORMAT,
    version: RCL_AKASHIC_RECORD_COMPILER_VERSION,
    akashicRecordEstablished: bundle.result.akashicRecordEstablished,
    rclInternalized: bundle.result.rclInternalized,
    promotedCount: bundle.result.promotedCount,
    rejectedCount: bundle.result.rejectedCount,
    documentCount: bundle.result.documentCount,
    recordClosureScore: bundle.result.recordClosureScore,
    promotedMechanismIds: bundle.result.promotedMechanismIds,
    root: bundle.result.root,
  };
}

export function readAkashicRecordInput(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return raw.trim() ? JSON.parse(raw) : {};
}

export function writeAkashicRecordReports(outDir = 'output/v0.56/akashic-record', input = {}) {
  const bundle = runAkashicRecordCompiler(input);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'akashic-record-spec.json'), `${JSON.stringify(bundle.spec, null, 2)}\n`);
  fs.writeFileSync(path.join(outDir, 'akashic-record-result.json'), `${JSON.stringify(bundle.result, null, 2)}\n`);
  fs.writeFileSync(path.join(outDir, 'akashic-record.rcl'), `${renderAkashicRecordRcl(bundle.spec)}\n`);
  const docsDir = path.join(outDir, 'technical-docs');
  fs.mkdirSync(docsDir, { recursive: true });
  for (const doc of bundle.documents) {
    fs.writeFileSync(path.join(docsDir, `${safeFileName(doc.id)}.md`), `${doc.markdown}\n`);
  }
  return {
    ok: true,
    format: RCL_AKASHIC_RECORD_BUNDLE_FORMAT,
    version: RCL_AKASHIC_RECORD_COMPILER_VERSION,
    outputDir: outDir,
    resultPath: path.join(outDir, 'akashic-record-result.json'),
    docsDir,
    documentCount: bundle.documents.length,
    akashicRecordEstablished: bundle.result.akashicRecordEstablished,
    rclInternalized: bundle.result.rclInternalized,
    recordClosureScore: bundle.result.recordClosureScore,
    root: bundle.result.root,
  };
}

export function akashicRecordCanonicalRoot(input = {}) {
  return runAkashicRecordCompiler(input).result.root;
}
