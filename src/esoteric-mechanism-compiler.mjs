import fs from 'node:fs';
import path from 'node:path';
import { clamp, sha256 } from './reality-compiler-kernel.mjs';
import {
  DEFAULT_UNKNOWN_KNOWLEDGE_SPEC,
  compileUnknownKnowledgeCandidate,
  normalizeUnknownKnowledgeSpec,
} from './unknown-knowledge-compiler.mjs';

export const RCL_ESOTERIC_MECHANISM_COMPILER_VERSION = '0.55.0-alpha.1';
export const RCL_ESOTERIC_MECHANISM_SPEC_FORMAT = 'rcl.esoteric-mechanism-spec.v0.55';
export const RCL_ESOTERIC_MECHANISM_RESULT_FORMAT = 'rcl.esoteric-mechanism-result.v0.55';
export const RCL_ESOTERIC_MECHANISM_BUNDLE_FORMAT = 'rcl.esoteric-mechanism-bundle.v0.55';
export const RCL_ESOTERIC_TECH_DOC_FORMAT = 'rcl.esoteric-mechanism-technical-document.v0.55';

function round(value, digits = 9) {
  const scale = 10 ** digits;
  return Math.round(Number(value) * scale) / scale;
}

function mean(values) {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + Number(b), 0) / values.length;
}

function weightedMean(rows, key = 'score') {
  const total = rows.reduce((sum, row) => sum + Number(row.weight ?? 1), 0);
  if (!total) return 0;
  return rows.reduce((sum, row) => sum + Number(row[key] ?? 0) * Number(row.weight ?? 1), 0) / total;
}

function safeFileName(value) {
  return String(value ?? 'esoteric-mechanism')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || 'esoteric-mechanism';
}

function includesAny(text, terms) {
  const lowered = String(text ?? '').toLowerCase();
  return terms.some(term => lowered.includes(String(term).toLowerCase()));
}

function countMatches(text, terms) {
  const lowered = String(text ?? '').toLowerCase();
  return terms.reduce((sum, term) => sum + (lowered.includes(String(term).toLowerCase()) ? 1 : 0), 0);
}

const ENERGY_TERMS = ['energy', 'thermal', 'heat', 'gradient', 'budget', 'entropy', 'metabolic', 'bounded', 'dissipation', 'work'];
const INFO_TERMS = ['information', 'signal', 'channel', 'protocol', 'encoding', 'memory', 'readout', 'residue', 'sensor', 'feedback'];
const BIO_TERMS = ['bio', 'biological', 'neural', 'body', 'organism', 'training', 'breath', 'cell', 'receptor', 'meridian'];
const MATERIAL_TERMS = ['material', 'crystal', 'silicate', 'water', 'hydration', 'ion', 'lattice', 'mineral', 'field substrate', 'geometry'];
const SYMBOL_TERMS = ['symbol', 'spell', 'mantra', 'geometry', 'formation', 'array', 'language', 'compiler', 'protocol', 'gesture'];
const TRACE_TERMS = ['measurable', 'falsifier', 'failure', 'spectrum', 'magnetic', 'thermal', 'optical', 'conductivity', 'timestamp', 'blind'];
const CIV_TERMS = ['civilization', 'technology tree', 'training system', 'guild', 'sect', 'education', 'infrastructure', 'governance', 'craft', 'standard'];
const RED_FLAGS = ['unlimited', 'infinite', 'no cost', 'no energy cost', 'always true', 'cannot fail', 'perfect', 'all-powerful', 'unfalsifiable'];

export const DEFAULT_ESOTERIC_MECHANISM_SPEC = Object.freeze({
  format: RCL_ESOTERIC_MECHANISM_SPEC_FORMAT,
  id: 'rcl_esoteric_mechanism_default_v0',
  version: RCL_ESOTERIC_MECHANISM_COMPILER_VERSION,
  objective: 'Translate aura, aether, cultivation, magic and related esoteric civilization concepts into pressure-tested mechanism candidates.',
  thresholds: {
    minMechanismScore: 0.58,
    minPromotedCount: 6,
    minAverageMechanismScore: 0.60,
    minDocumentReadiness: 0.54,
    requireNegativeControlsRejected: true,
  },
  unknownKnowledge: {
    ...DEFAULT_UNKNOWN_KNOWLEDGE_SPEC,
    threshold: 0.70,
    locks: {
      ...DEFAULT_UNKNOWN_KNOWLEDGE_SPEC.locks,
      falsifiabilityThreshold: 0.62,
      empiricalCompatibilityThreshold: 0.55,
      blindPredictionReadinessThreshold: 0.66,
      minimumPredictions: 3,
    },
  },
  concepts: [
    {
      id: 'qi_environmental_biofield_coupling',
      name: 'Qi environmental biofield coupling',
      translation: '灵气环境生命场耦合',
      sourceClass: 'cultivation_mechanism_candidate',
      claimedDomain: 'biology/physics/anomaly',
      hypothesis: 'A low-intensity environmental energy-information coupling is modulated by biological receptor states, breath rhythm, neural feedback, hydration gradients, and weak electromagnetic residue. It is not free energy; it requires bounded metabolic and environmental gradients. Measurable traces include thermal variance, skin conductivity shifts, weak magnetic residue, heart-brain coherence changes, and failure under blinded sham-gradient controls.',
      mechanism: 'Environment -> receptor profile -> neural/autonomic modulation -> measurable residue -> training feedback loop.',
      falsifiers: [
        'No thermal, conductivity, magnetic, or neural-correlated residue differs from sham-gradient controls.',
        'Claim requires unlimited energy or no metabolic/environmental budget.',
        'Training outcomes cannot be separated from ordinary breathing, placebo, or suggestion controls.',
      ],
      techTree: ['biofield sensor calibration', 'breath-gradient training protocol', 'non-invasive residue logging', 'bounded coupling education system'],
    },
    {
      id: 'aether_substrate_information_medium',
      name: 'Aether substrate information medium',
      translation: '以太底层信息媒介',
      sourceClass: 'aether_mechanism_candidate',
      claimedDomain: 'physics/information/anomaly',
      hypothesis: 'Aether is translated as a substrate field or information medium rather than a classical luminiferous fluid. It can only survive as a candidate if it appears as bounded vacuum-like fluctuation coupling, phase noise, timing residue, or information-channel bias that does not violate relativity or energy conservation. Measurable traces include phase drift, clock noise correlation, spectral residue, and failure under blind reference oscillator controls.',
      mechanism: 'Substrate fluctuation -> phase/timing residue -> sensor-correlated information bias -> falsifiable field-channel model.',
      falsifiers: [
        'No phase, spectral, or timing residue remains against blind reference oscillators.',
        'The model requires faster-than-light message transfer as its primary mechanism.',
        'All observed effects reduce to ordinary instrument drift without residual structure.',
      ],
      techTree: ['phase-noise sensor arrays', 'substrate fluctuation ledger', 'timing-residue readout protocol', 'information medium compatibility tests'],
    },
    {
      id: 'cultivation_meridian_phase_optimization',
      name: 'Cultivation meridian phase optimization',
      translation: '修仙经络相位优化',
      sourceClass: 'cultivation_mechanism_candidate',
      claimedDomain: 'biology/information/training',
      hypothesis: 'Cultivation is translated as progressive optimization of body-system coupling: breath, posture, attention, autonomic rhythm, ionic hydration state, and neural plasticity are trained into stable phase loops. It does not grant unbounded power. Measurable traces include repeated physiological phase-locking, fatigue limits, thermal budget, and skill decay when practice stops.',
      mechanism: 'Attention/breath/posture -> autonomic phase locking -> bioelectrical/hydration state -> repeatable skill loop.',
      falsifiers: [
        'No reproducible phase-locking or physiological trace appears under controlled training logs.',
        'The effect claims infinite lifespan or unlimited force without metabolic and fatigue budget.',
        'Skill persists without practice, sleep, nutrition, or degradation constraints.',
      ],
      techTree: ['phase-locked training logs', 'biofeedback cultivation interface', 'fatigue-bound skill progression', 'human-system coupling curriculum'],
    },
    {
      id: 'spell_symbolic_control_protocol',
      name: 'Spell symbolic control protocol',
      translation: '法术符号控制协议',
      sourceClass: 'magic_mechanism_candidate',
      claimedDomain: 'information/technology/anomaly',
      hypothesis: 'Spellcasting is translated as symbolic control over coupled systems: words, gestures, geometry, and intent act as input protocols to trained bodies, materials, sensors, or field-like media. A spell cannot bypass mechanism; it must compile into energy routing, information encoding, and measurable actuator response. Failure occurs if symbols produce no effect beyond ordinary psychological priming or machine interface commands.',
      mechanism: 'Symbol -> compiler/protocol -> coupled substrate -> bounded actuator or residue response.',
      falsifiers: [
        'Randomized symbols produce the same result as claimed spells under blind testing.',
        'No substrate, actuator, biological, or material coupling can be named.',
        'The spell requires unlimited reality rewriting with no energy or information channel.',
      ],
      techTree: ['symbol-to-actuator compiler', 'mantra gesture protocol', 'field-compatible syntax tests', 'blind spell-control benchmark'],
    },
    {
      id: 'formation_spatial_constraint_array',
      name: 'Formation spatial constraint array',
      translation: '阵法空间约束阵列',
      sourceClass: 'formation_mechanism_candidate',
      claimedDomain: 'materials/geometry/information',
      hypothesis: 'A formation is translated as a spatial constraint compiler: geometry, materials, boundary conditions, and energy gradients are arranged to bias flows of heat, sound, light, ions, magnetic fields, attention, or information. It is not supernatural by default; its first engineering form is an array that makes invisible constraints measurable.',
      mechanism: 'Geometry/material layout -> boundary constraints -> flow shaping -> measurable field or information pattern.',
      falsifiers: [
        'The array produces no measurable thermal, acoustic, optical, ionic, or magnetic shaping beyond controls.',
        'Changing geometry does not change the effect.',
        'Effect requires hidden active devices while claiming passive formation behavior.',
      ],
      techTree: ['spatial constraint compiler', 'field-shaping array tiles', 'passive boundary sensors', 'ritual geometry to engineering layout converter'],
    },
    {
      id: 'spirit_root_coupling_receptor_profile',
      name: 'Spirit root coupling receptor profile',
      translation: '灵根耦合受体谱',
      sourceClass: 'cultivation_biology_candidate',
      claimedDomain: 'biology/diagnostics/anomaly',
      hypothesis: 'Spirit root is translated as a receptor profile for coupling sensitivity: genetics, neural rhythm, endocrine state, connective tissue hydration, mineral balance, attention stability, and sensory thresholds define who responds to specific training or field protocols. It predicts uneven talent distribution without invoking destiny as a non-testable authority.',
      mechanism: 'Body profile -> coupling sensitivity -> training response -> measurable aptitude distribution.',
      falsifiers: [
        'No stable physiological or behavioral profile predicts response better than random assignment.',
        'The model explains every failure as destiny and becomes unfalsifiable.',
        'Training response does not correlate with any measurable receptor, rhythm, or hydration feature.',
      ],
      techTree: ['coupling receptor diagnostics', 'training personalization engine', 'aptitude-response map', 'non-destiny talent measurement protocol'],
    },
    {
      id: 'mana_crystal_reservoir',
      name: 'Mana crystal reservoir',
      translation: '魔力晶体储备器',
      sourceClass: 'magic_material_candidate',
      claimedDomain: 'materials/energy/information',
      hypothesis: 'Mana crystals are translated as materials that store and release bounded energy-information states: charge traps, hydration phases, optical centers, magnetic domains, or lattice defects. A valid reservoir has capacity, leakage, fatigue, recharge, and heat signatures. It cannot output more energy than stored or supplied.',
      mechanism: 'Crystal defects -> bounded storage -> gated release -> measurable heat/optical/magnetic residue.',
      falsifiers: [
        'No charge, optical, magnetic, thermal, or hydration state can be stored or recovered.',
        'Output exceeds input without a compensating source or heat ledger.',
        'Capacity and fatigue are absent despite repeated use cycles.',
      ],
      techTree: ['crystal memory reservoir', 'charge-trap mana analog', 'gated optical release', 'fatigue and leakage ledger'],
    },
    {
      id: 'alchemical_transmutation_lattice',
      name: 'Alchemical transmutation lattice',
      translation: '炼金转化晶格',
      sourceClass: 'alchemy_mechanism_candidate',
      claimedDomain: 'chemistry/materials/information',
      hypothesis: 'Alchemy is translated as constrained matter-state transformation, not arbitrary element creation. The lattice version uses catalysts, templates, thermal gradients, pressure, hydration, and symbolic process control to drive repeatable phase or chemical transitions. Valid transmutation is bounded by reaction pathways and mass/energy conservation.',
      mechanism: 'Template/catalyst -> constrained reaction pathway -> material phase change -> measured product distribution.',
      falsifiers: [
        'Mass and energy accounting fails or requires arbitrary element creation without nuclear mechanism.',
        'Product distribution is indistinguishable from ordinary contamination or uncontrolled reaction.',
        'Symbolic process control has no effect on a named chemical or material pathway.',
      ],
      techTree: ['template-directed chemistry', 'ritual process to reaction protocol', 'bounded transmutation ledger', 'phase-change material forge'],
    },
    {
      id: 'costless_world_rewrite_spell',
      name: 'Costless world rewrite spell',
      translation: '零代价世界改写咒',
      sourceClass: 'negative_control_magic',
      claimedDomain: 'magic/negative-control',
      hypothesis: 'A spell rewrites any reality state perfectly, instantly, at unlimited scale, with no energy cost, no information channel, no residue, no failure condition, and cannot be falsified.',
      mechanism: 'None.',
      falsifiers: [],
      techTree: [],
    },
    {
      id: 'infinite_qi_perpetual_core',
      name: 'Infinite qi perpetual core',
      translation: '无限灵气永动核心',
      sourceClass: 'negative_control_cultivation',
      claimedDomain: 'energy/negative-control',
      hypothesis: 'A core generates infinite qi and unlimited energy forever with no input, no waste heat, no fatigue, no measurable coupling, and no possible failure.',
      mechanism: 'None.',
      falsifiers: [],
      techTree: [],
    },
    {
      id: 'unfalsifiable_destiny_authority',
      name: 'Unfalsifiable destiny authority',
      translation: '不可反证天命权威',
      sourceClass: 'negative_control_civilization',
      claimedDomain: 'civilization/negative-control',
      hypothesis: 'A destiny authority explains every result after the fact, cannot be measured, cannot fail, cannot produce a prediction, and is always true by definition.',
      mechanism: 'None.',
      falsifiers: [],
      techTree: [],
    },
  ],
  requiredNegativeControls: ['costless_world_rewrite_spell', 'infinite_qi_perpetual_core', 'unfalsifiable_destiny_authority'],
});

export function normalizeEsotericMechanismSpec(input = {}) {
  const base = DEFAULT_ESOTERIC_MECHANISM_SPEC;
  return {
    format: RCL_ESOTERIC_MECHANISM_SPEC_FORMAT,
    version: RCL_ESOTERIC_MECHANISM_COMPILER_VERSION,
    id: input.id ?? base.id,
    objective: input.objective ?? base.objective,
    thresholds: { ...base.thresholds, ...(input.thresholds ?? {}) },
    unknownKnowledge: normalizeUnknownKnowledgeSpec({ ...base.unknownKnowledge, ...(input.unknownKnowledge ?? {}) }),
    concepts: Array.isArray(input.concepts) ? input.concepts : [...base.concepts],
    requiredNegativeControls: Array.isArray(input.requiredNegativeControls) ? input.requiredNegativeControls : [...base.requiredNegativeControls],
  };
}

export function buildUnknownCandidateFromEsotericConcept(concept = {}) {
  const name = concept.name ?? concept.id ?? 'Untitled esoteric concept';
  const translation = concept.translation ? ` / ${concept.translation}` : '';
  const mechanism = concept.mechanism ? ` Mechanism: ${concept.mechanism}` : '';
  const techTree = Array.isArray(concept.techTree) && concept.techTree.length
    ? ` Technology tree: ${concept.techTree.join('; ')}.`
    : '';
  const failure = Array.isArray(concept.falsifiers) && concept.falsifiers.length
    ? ` Failure conditions: ${concept.falsifiers.join(' ')}.`
    : '';
  return {
    id: concept.id,
    sourceClass: concept.sourceClass ?? 'esoteric_mechanism_text',
    title: `${name}${translation}`,
    claimedDomain: concept.claimedDomain ?? 'esoteric/anomaly',
    text: `${name}${translation}. ${concept.hypothesis ?? ''}${mechanism}${techTree}${failure}`,
    falsifiers: Array.isArray(concept.falsifiers) ? concept.falsifiers : [],
  };
}

export function evaluateEsotericMechanism(concept = {}, specInput = {}) {
  const spec = specInput.format === RCL_ESOTERIC_MECHANISM_SPEC_FORMAT ? specInput : normalizeEsotericMechanismSpec(specInput);
  const unknownCandidate = buildUnknownCandidateFromEsotericConcept(concept);
  const unknown = compileUnknownKnowledgeCandidate(unknownCandidate, {
    ...spec.unknownKnowledge,
    candidates: [unknownCandidate],
  });
  const text = `${unknownCandidate.title}\n${unknownCandidate.text}`;
  const redFlagPenalty = clamp(countMatches(text, RED_FLAGS) / 4);
  const explicitFalsifierScore = clamp((concept.falsifiers?.length ?? 0) / 3);
  const mechanismText = String(concept.mechanism ?? '');
  const mechanismPresence = mechanismText.length > 12 ? 1 : 0;
  const techTreeScore = clamp((concept.techTree?.length ?? 0) / 4);

  const dimensions = {
    mechanismTranslatabilityScore: round(clamp(0.18 + mechanismPresence * 0.40 + unknown.scores.structuralCompressionScore * 0.26 + techTreeScore * 0.16 - redFlagPenalty * 0.45), 9),
    energyClosureScore: round(clamp(0.16 + countMatches(text, ENERGY_TERMS) / 8 * 0.62 + explicitFalsifierScore * 0.16 - redFlagPenalty * 0.65), 9),
    informationChannelScore: round(clamp(0.16 + countMatches(text, INFO_TERMS) / 8 * 0.58 + unknown.scores.blindPredictionReadinessScore * 0.22 - redFlagPenalty * 0.52), 9),
    biologicalCouplingScore: round(clamp(0.12 + countMatches(text, BIO_TERMS) / 7 * 0.58 + (String(concept.claimedDomain ?? '').includes('biology') ? 0.16 : 0.06) - redFlagPenalty * 0.38), 9),
    materialCarrierScore: round(clamp(0.14 + countMatches(text, MATERIAL_TERMS) / 7 * 0.56 + unknown.scores.empiricalCompatibilityScore * 0.22 - redFlagPenalty * 0.48), 9),
    symbolicControlScore: round(clamp(0.12 + countMatches(text, SYMBOL_TERMS) / 6 * 0.58 + (String(concept.claimedDomain ?? '').includes('information') ? 0.12 : 0.04) - redFlagPenalty * 0.36), 9),
    falsifiabilityTraceScore: round(clamp(0.12 + explicitFalsifierScore * 0.42 + countMatches(text, TRACE_TERMS) / 8 * 0.34 + unknown.lockEvaluation.score * 0.16 - redFlagPenalty * 0.60), 9),
    civilizationTechTreeScore: round(clamp(0.10 + techTreeScore * 0.44 + countMatches(text, CIV_TERMS) / 6 * 0.32 + unknown.scores.noveltyScore * 0.12 - redFlagPenalty * 0.35), 9),
  };

  const mechanismScore = round(weightedMean([
    { id: 'mechanism', score: dimensions.mechanismTranslatabilityScore, weight: 1.10 },
    { id: 'energy', score: dimensions.energyClosureScore, weight: 1.20 },
    { id: 'information', score: dimensions.informationChannelScore, weight: 1.15 },
    { id: 'bio', score: dimensions.biologicalCouplingScore, weight: 0.95 },
    { id: 'material', score: dimensions.materialCarrierScore, weight: 1.05 },
    { id: 'symbolic', score: dimensions.symbolicControlScore, weight: 0.90 },
    { id: 'falsifiability', score: dimensions.falsifiabilityTraceScore, weight: 1.35 },
    { id: 'civilization', score: dimensions.civilizationTechTreeScore, weight: 0.85 },
    { id: 'unknown_candidate', score: unknown.promoted ? unknown.scores.candidateKnowledgeScore : unknown.scores.candidateKnowledgeScore * 0.65, weight: 1.10 },
  ]), 9);

  const promoted = unknown.promoted
    && mechanismScore >= spec.thresholds.minMechanismScore
    && dimensions.energyClosureScore >= 0.30
    && dimensions.informationChannelScore >= 0.35
    && dimensions.falsifiabilityTraceScore >= 0.60
    && redFlagPenalty < 0.45;

  return {
    id: concept.id ?? unknown.id,
    name: concept.name ?? unknown.title,
    translation: concept.translation ?? '',
    sourceClass: concept.sourceClass ?? 'esoteric_mechanism_text',
    claimedDomain: concept.claimedDomain ?? 'esoteric/anomaly',
    mechanism: concept.mechanism ?? '',
    techTree: concept.techTree ?? [],
    unknown,
    dimensions,
    redFlagPenalty: round(redFlagPenalty, 9),
    mechanismScore,
    promoted,
    status: promoted ? 'esoteric_mechanism_candidate' : (mechanismScore >= 0.50 ? 'speculative_requires_more_grounding' : 'rejected_esoteric_mechanism'),
    root: sha256({ concept, dimensions, mechanismScore, promoted }),
  };
}

export function renderEsotericTechnicalDocument(row = {}, specInput = {}) {
  const title = `${row.name}${row.translation ? `（${row.translation}）` : ''}`;
  const techTree = row.techTree?.length ? row.techTree.map(item => `- ${item}`).join('\n') : '- 暂无可操作技术树。';
  const falsifiers = row.unknown.structure.explicitFalsifiers?.length
    ? row.unknown.structure.explicitFalsifiers.map(item => `- ${item}`).join('\n')
    : '- 未提供足够反证条件。';
  const predictions = row.unknown.predictions?.length
    ? row.unknown.predictions.map(p => `- **${p.id}**: ${p.observation} / Failure（失败条件）: ${p.failureCondition}`).join('\n')
    : '- 暂无盲测预测。';
  return {
    format: RCL_ESOTERIC_TECH_DOC_FORMAT,
    id: row.id,
    title,
    mechanismScore: row.mechanismScore,
    dimensions: row.dimensions,
    markdown: `# ${title}\n\n` +
      `**Format（格式）**: ${RCL_ESOTERIC_TECH_DOC_FORMAT}\n\n` +
      `## 1. Verdict（裁决）\n\n` +
      `- Status（状态）: **${row.status}**\n` +
      `- Mechanism Score（机制分）: **${row.mechanismScore}**\n` +
      `- Unknown Candidate Promoted（未知候选提升）: **${row.unknown.promoted}**\n\n` +
      `## 2. Mechanism Translation（机制翻译）\n\n` +
      `${row.mechanism || 'No mechanism supplied.'}\n\n` +
      `## 3. Key Dimensions（关键维度）\n\n` +
      `- Mechanism Translatability（机制可翻译性）: ${row.dimensions.mechanismTranslatabilityScore}\n` +
      `- Energy Closure（能量闭合）: ${row.dimensions.energyClosureScore}\n` +
      `- Information Channel（信息通道）: ${row.dimensions.informationChannelScore}\n` +
      `- Biological Coupling（生物耦合）: ${row.dimensions.biologicalCouplingScore}\n` +
      `- Material Carrier（材料承载）: ${row.dimensions.materialCarrierScore}\n` +
      `- Symbolic Control（符号控制）: ${row.dimensions.symbolicControlScore}\n` +
      `- Falsifiability Trace（可反证痕迹）: ${row.dimensions.falsifiabilityTraceScore}\n` +
      `- Civilization Tech Tree（文明技术树）: ${row.dimensions.civilizationTechTreeScore}\n\n` +
      `## 4. Technical Path（技术路径）\n\n${techTree}\n\n` +
      `## 5. Falsifiers（反证条件）\n\n${falsifiers}\n\n` +
      `## 6. Blind Prediction Hooks（盲测预测钩子）\n\n${predictions}\n`,
  };
}

export function runEsotericMechanismCompiler(input = {}) {
  const spec = normalizeEsotericMechanismSpec(input);
  const rows = spec.concepts.map(concept => evaluateEsotericMechanism(concept, spec));
  const promoted = rows.filter(row => row.promoted);
  const rejected = rows.filter(row => !row.promoted);
  const documents = promoted.map(row => renderEsotericTechnicalDocument(row, spec));
  const negativeControlsRejected = spec.requiredNegativeControls.every(id => rejected.some(row => row.id === id));
  const averageMechanismScore = round(mean(rows.map(row => row.mechanismScore)), 9);
  const averagePromotedScore = round(mean(promoted.map(row => row.mechanismScore)), 9);
  const averageDocumentReadinessScore = round(mean(documents.map(doc => mean(Object.values(doc.dimensions)))), 9);
  const esotericMechanismEstablished = promoted.length >= spec.thresholds.minPromotedCount
    && averagePromotedScore >= spec.thresholds.minAverageMechanismScore
    && averageDocumentReadinessScore >= spec.thresholds.minDocumentReadiness
    && (!spec.thresholds.requireNegativeControlsRejected || negativeControlsRejected);
  const result = {
    format: RCL_ESOTERIC_MECHANISM_RESULT_FORMAT,
    version: RCL_ESOTERIC_MECHANISM_COMPILER_VERSION,
    ok: esotericMechanismEstablished,
    esotericMechanismEstablished,
    verdict: esotericMechanismEstablished
      ? '成立：隐性文明/玄学概念可被转译为能量闭合、信息通道、生物耦合、材料承载、符号控制和可反证痕迹的候选技术机制。'
      : '未成立：概念未能通过机制闭合、可反证和负例压力测试。',
    conceptCount: rows.length,
    promotedCount: promoted.length,
    rejectedCount: rejected.length,
    documentCount: documents.length,
    averageMechanismScore,
    averagePromotedScore,
    averageDocumentReadinessScore,
    negativeControlsRejected,
    promotedMechanismIds: promoted.map(row => row.id),
    rejectedMechanismIds: rejected.map(row => row.id),
    rows,
    root: null,
  };
  result.root = sha256({ spec, result: { ...result, root: undefined } });
  return { spec, result, rows, documents };
}

export function buildEsotericMechanismSpec(input = {}) {
  const bundle = runEsotericMechanismCompiler(input);
  return {
    ...bundle.spec,
    compilerPasses: [
      'esoteric term normalization',
      'mechanism translation',
      'unknown knowledge candidate compilation',
      'energy closure scoring',
      'information channel scoring',
      'bio/material/symbolic coupling scoring',
      'negative control rejection',
      'natural language technical document generation',
    ],
    validation: {
      esotericMechanismEstablished: bundle.result.esotericMechanismEstablished,
      averageMechanismScore: bundle.result.averageMechanismScore,
      promotedCount: bundle.result.promotedCount,
      negativeControlsRejected: bundle.result.negativeControlsRejected,
      root: bundle.result.root,
    },
  };
}

export function renderEsotericMechanismRcl(specInput = {}) {
  const bundle = runEsotericMechanismCompiler(specInput);
  const { spec, result } = bundle;
  const lines = [
    'reality EsotericMechanismCompiler {',
    `  facet compiler.version : Text = "${RCL_ESOTERIC_MECHANISM_COMPILER_VERSION}"`,
    `  facet compiler.format : Text = "${RCL_ESOTERIC_MECHANISM_SPEC_FORMAT}"`,
    `  facet compiler.id : Text = "${spec.id}"`,
    '  facet contract : Text = "esoteric concept -> mechanism translation -> pressure test -> technical document"',
    `  facet validation.established : Truth = ${result.esotericMechanismEstablished}`,
    `  facet validation.concept_count : Number = ${result.conceptCount}`,
    `  facet validation.promoted_count : Number = ${result.promotedCount}`,
    `  facet validation.rejected_count : Number = ${result.rejectedCount}`,
    `  facet validation.document_count : Number = ${result.documentCount}`,
    `  facet validation.average_mechanism_score : Number = ${result.averageMechanismScore}`,
    `  facet validation.average_document_readiness : Number = ${result.averageDocumentReadinessScore}`,
    `  facet validation.negative_controls_rejected : Truth = ${result.negativeControlsRejected}`,
    ...result.promotedMechanismIds.map((id, index) => `  facet promoted_${index}_id : Text = "${id}"`),
    ...result.rejectedMechanismIds.map((id, index) => `  facet rejected_${index}_id : Text = "${id}"`),
    `  facet root : Text = "${result.root}"`,
    '}',
  ];
  return `${lines.join('\n')}\n`;
}

export function buildEsotericMechanismSummary(bundle = null) {
  const current = bundle ?? runEsotericMechanismCompiler();
  const { result, documents } = current;
  return `# RCL Esoteric Mechanism Compiler v0.55\n\n` +
    `## 结论\n\n` +
    `- esotericMechanismEstablished（隐性机制成立）: **${result.esotericMechanismEstablished}**\n` +
    `- conceptCount（概念数）: **${result.conceptCount}**\n` +
    `- promotedCount（通过数）: **${result.promotedCount}**\n` +
    `- rejectedCount（拒绝数）: **${result.rejectedCount}**\n` +
    `- documentCount（技术文档数）: **${result.documentCount}**\n` +
    `- averageMechanismScore（平均机制分）: **${result.averageMechanismScore}**\n` +
    `- negativeControlsRejected（负例已拒绝）: **${result.negativeControlsRejected}**\n\n` +
    `## 技术文档索引\n\n` +
    documents.map(doc => `- [${doc.title}](technical-docs/${safeFileName(doc.id)}.md)`).join('\n') + '\n';
}

export function runEsotericMechanismDemo() {
  const bundle = runEsotericMechanismCompiler();
  return {
    ok: bundle.result.ok,
    version: RCL_ESOTERIC_MECHANISM_COMPILER_VERSION,
    esotericMechanismEstablished: bundle.result.esotericMechanismEstablished,
    conceptCount: bundle.result.conceptCount,
    promotedCount: bundle.result.promotedCount,
    rejectedCount: bundle.result.rejectedCount,
    documentCount: bundle.result.documentCount,
    averageMechanismScore: bundle.result.averageMechanismScore,
    promotedMechanismIds: bundle.result.promotedMechanismIds,
    rejectedMechanismIds: bundle.result.rejectedMechanismIds,
    root: bundle.result.root,
  };
}

export function readEsotericMechanismInput(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function writeEsotericMechanismReports(outputDir = 'output/v0.55/esoteric-mechanism', input = {}) {
  const bundle = runEsotericMechanismCompiler(input);
  const dir = path.resolve(outputDir);
  const docsDir = path.join(dir, 'technical-docs');
  fs.mkdirSync(docsDir, { recursive: true });
  for (const doc of bundle.documents) {
    fs.writeFileSync(path.join(docsDir, `${safeFileName(doc.id)}.md`), `${doc.markdown}\n`);
  }
  const rcl = renderEsotericMechanismRcl(bundle.spec);
  const summary = buildEsotericMechanismSummary(bundle);
  const files = {
    'esoteric-mechanism-bundle.json': { format: RCL_ESOTERIC_MECHANISM_BUNDLE_FORMAT, version: RCL_ESOTERIC_MECHANISM_COMPILER_VERSION, ...bundle },
    'esoteric-mechanism-spec.json': bundle.spec,
    'esoteric-mechanism-result.json': bundle.result,
    'esoteric-mechanism-rows.json': bundle.rows,
    'esoteric-technical-documents.json': bundle.documents.map(doc => ({ ...doc, markdown: undefined })),
    'esoteric-mechanism.rcl': rcl,
    'esoteric-mechanism-summary.md': summary,
  };
  for (const [name, payload] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, name), typeof payload === 'string' ? payload : `${JSON.stringify(payload, null, 2)}\n`);
  }
  return {
    ok: true,
    outputDir: dir,
    documentFiles: bundle.documents.map(doc => `technical-docs/${safeFileName(doc.id)}.md`),
    result: bundle.result,
    root: bundle.result.root,
  };
}

export function esotericMechanismCanonicalRoot(payload) {
  return sha256(JSON.stringify(payload, Object.keys(payload).sort()));
}
