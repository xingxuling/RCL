import fs from 'node:fs';
import path from 'node:path';
import { canonicalJson, clamp, sha256 } from './reality-compiler-kernel.mjs';
import {
  DEFAULT_UNKNOWN_KNOWLEDGE_SPEC,
  RCL_UNKNOWN_KNOWLEDGE_SPEC_FORMAT,
  compileUnknownKnowledgeCandidate,
  runUnknownKnowledgeCompiler,
  readUnknownKnowledgeInput,
} from './unknown-knowledge-compiler.mjs';

export const RCL_DIRECTED_UNKNOWN_KNOWLEDGE_WISHER_VERSION = '0.50.0-alpha.1';
export const RCL_DIRECTED_WISHER_SPEC_FORMAT = 'rcl.directed-unknown-knowledge-wisher-spec.v0.50';
export const RCL_DIRECTED_WISHER_RESULT_FORMAT = 'rcl.directed-unknown-knowledge-wisher-result.v0.50';
export const RCL_DIRECTED_WISHER_BUNDLE_FORMAT = 'rcl.directed-unknown-knowledge-wisher-bundle.v0.50';

const EPS = 1e-12;

function round(value, digits = 9) {
  const scale = 10 ** digits;
  return Math.round(Number(value) * scale) / scale;
}

function rclString(value) {
  return String(value ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function rclNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '0';
  if (Math.abs(number) > 0 && Math.abs(number) < 0.000001) return number.toFixed(12).replace(/0+$/, '').replace(/\.$/, '');
  return String(number);
}

function weightedMean(rows, key = 'score') {
  const total = rows.reduce((sum, row) => sum + Number(row.weight ?? 1), 0);
  if (!total) return 0;
  return rows.reduce((sum, row) => sum + Number(row[key] ?? 0) * Number(row.weight ?? 1), 0) / total;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function normalizeText(value) {
  return String(value ?? '').toLowerCase();
}

function countOverlap(left = [], right = []) {
  const rightSet = new Set(right.map(value => normalizeText(value)));
  return unique(left.map(value => normalizeText(value))).filter(value => rightSet.has(value)).length;
}

function exactOne(value) {
  return Math.abs(Number(value) - 1) < 1e-9;
}

const DEFAULT_WISH_TARGET = Object.freeze({
  id: 'directed_interstice_memory_sensor_wish',
  title: '定向生成：夹缝无声观测者 × 外到表记忆泄漏 × 可测材料载体',
  desiredOutcome: 'Find a coherent, pressure-testable unknown knowledge route that binds silent interstice observer probes, outer-to-surface memory leak anchors, and a bounded measurable storage or residue mechanism.',
  targetDomains: ['anomaly', 'technology', 'biology', 'physics', 'civilization'],
  requiredAnchors: ['observer', 'interstice', 'memory leak', 'outer', 'surface', 'white hair', '柳清莲', 'yale', 'sensor', 'thermal', 'magnetic', 'spectrum', 'material', 'energy budget'],
  requiredCandidateIds: ['silent_interstice_observer_probe', 'outer_surface_memory_leak_anchor', 'bio_silicate_memory_lattice'],
  forbiddenCandidateIds: ['unlimited_vacuum_energy_drive'],
  hardRequirements: {
    minimumPromotedCandidates: 3,
    minimumPredictions: 9,
    minimumExplicitFalsifiers: 9,
    requireEmpiricalGrounding: true,
    requireNoForbiddenPromotions: true,
    requireBoundedMechanism: true,
    requireObserverSilence: true,
    requireBlindPredictionReady: true,
  },
});

export const DEFAULT_DIRECTED_WISHER_SPEC = Object.freeze({
  id: 'directed_unknown_knowledge_wisher_default_v0',
  decisionContract: 'established_when_all_key_dimensions_are_exactly_1',
  criticalDimensionThreshold: 1,
  keyDimensions: [
    'targetAlignmentScore',
    'candidatePromotionScore',
    'falsifiabilityPressureScore',
    'blindPredictionStressScore',
    'empiricalGroundingLockScore',
    'mechanismBoundednessScore',
    'contradictionResistanceScore',
    'observerSilenceScore',
  ],
  unknownKnowledge: DEFAULT_UNKNOWN_KNOWLEDGE_SPEC,
  wish: DEFAULT_WISH_TARGET,
});

export function normalizeDirectedWisherSpec(input = {}) {
  const base = DEFAULT_DIRECTED_WISHER_SPEC;
  return {
    format: RCL_DIRECTED_WISHER_SPEC_FORMAT,
    version: RCL_DIRECTED_UNKNOWN_KNOWLEDGE_WISHER_VERSION,
    id: input.id ?? base.id,
    decisionContract: input.decisionContract ?? base.decisionContract,
    criticalDimensionThreshold: Number(input.criticalDimensionThreshold ?? base.criticalDimensionThreshold),
    keyDimensions: Array.isArray(input.keyDimensions) ? input.keyDimensions : [...base.keyDimensions],
    unknownKnowledge: input.unknownKnowledge ?? base.unknownKnowledge,
    wish: { ...base.wish, ...(input.wish ?? {}), hardRequirements: { ...base.wish.hardRequirements, ...((input.wish ?? {}).hardRequirements ?? {}) } },
  };
}

export function collectWishEvidence(unknownBundle, wish = DEFAULT_WISH_TARGET) {
  const candidates = unknownBundle.result?.candidates ?? [];
  const promoted = candidates.filter(row => row.promoted);
  const promotedIds = promoted.map(row => row.id);
  const rejectedIds = candidates.filter(row => !row.promoted).map(row => row.id);
  const promotedAnchors = unique(promoted.flatMap(row => row.structure?.anchorTerms ?? []));
  const promotedDomains = unique(promoted.flatMap(row => row.structure?.domains?.map(d => d.domain) ?? []));
  const promotedPredictions = promoted.flatMap(row => row.predictions ?? []);
  const explicitFalsifiers = promoted.flatMap(row => row.structure?.explicitFalsifiers ?? []);
  const promotedText = promoted.map(row => `${row.title}\n${row.structure?.text ?? ''}`).join('\n').toLowerCase();
  const allLockRows = promoted.flatMap(row => row.lockEvaluation?.rows ?? []);

  return {
    candidateCount: candidates.length,
    promotedCount: promoted.length,
    promotedIds,
    rejectedIds,
    promotedAnchors,
    promotedDomains,
    promotedPredictions,
    explicitFalsifiers,
    promotedText,
    allLockRows,
    requiredCandidateHits: countOverlap(wish.requiredCandidateIds ?? [], promotedIds),
    forbiddenPromotions: (wish.forbiddenCandidateIds ?? []).filter(id => promotedIds.includes(id)),
    requiredAnchorHits: (wish.requiredAnchors ?? []).filter(anchor => promotedText.includes(normalizeText(anchor)) || promotedAnchors.some(term => normalizeText(term).includes(normalizeText(anchor)) || normalizeText(anchor).includes(normalizeText(term)))),
    requiredDomainHits: countOverlap(wish.targetDomains ?? [], promotedDomains),
    roots: promoted.map(row => row.root),
  };
}

export function scoreDirectedWishPressure(unknownBundle, specInput = {}) {
  const spec = specInput.format === RCL_DIRECTED_WISHER_SPEC_FORMAT ? specInput : normalizeDirectedWisherSpec(specInput);
  const wish = spec.wish;
  const evidence = collectWishEvidence(unknownBundle, wish);
  const hard = wish.hardRequirements ?? {};
  const requiredCandidateCount = Math.max(1, (wish.requiredCandidateIds ?? []).length);
  const requiredAnchorCount = Math.max(1, (wish.requiredAnchors ?? []).length);
  const requiredDomainCount = Math.max(1, (wish.targetDomains ?? []).length);

  const targetAlignmentScore = round(clamp((
    (evidence.requiredCandidateHits / requiredCandidateCount) * 0.44
    + (evidence.requiredAnchorHits.length / requiredAnchorCount) * 0.34
    + (evidence.requiredDomainHits / requiredDomainCount) * 0.22
  ) * 1.06), 9);

  const candidatePromotionScore = round(clamp(
    evidence.promotedCount >= Number(hard.minimumPromotedCandidates ?? 1)
      && (wish.requiredCandidateIds ?? []).every(id => evidence.promotedIds.includes(id))
      ? 1
      : evidence.promotedCount / Math.max(1, Number(hard.minimumPromotedCandidates ?? 1))
  ), 9);

  const falsifiabilityPressureScore = round(clamp(
    evidence.explicitFalsifiers.length >= Number(hard.minimumExplicitFalsifiers ?? 3)
      && evidence.allLockRows.filter(row => row.id === 'falsifiability_lock').every(row => row.passed)
      ? 1
      : (evidence.explicitFalsifiers.length / Math.max(1, Number(hard.minimumExplicitFalsifiers ?? 3))) * 0.72
        + (evidence.allLockRows.filter(row => row.id === 'falsifiability_lock' && row.passed).length / Math.max(1, evidence.promotedCount)) * 0.28
  ), 9);

  const blindPredictionStressScore = round(clamp(
    evidence.promotedPredictions.length >= Number(hard.minimumPredictions ?? 3)
      && evidence.allLockRows.filter(row => row.id === 'blind_prediction_lock').every(row => row.passed)
      && evidence.promotedPredictions.every(row => row.failureCondition)
      ? 1
      : (evidence.promotedPredictions.length / Math.max(1, Number(hard.minimumPredictions ?? 3))) * 0.76
        + (evidence.promotedPredictions.filter(row => row.failureCondition).length / Math.max(1, evidence.promotedPredictions.length)) * 0.24
  ), 9);

  const empiricalGroundingLockScore = round(clamp(
    hard.requireEmpiricalGrounding !== false
      && unknownBundle.result?.empiricalGroundingScore >= 0.98
      && unknownBundle.result?.empiricalHoldoutScore >= 1
      ? 1
      : weightedMean([
        { score: unknownBundle.result?.empiricalGroundingScore ?? 0, weight: 0.58 },
        { score: unknownBundle.result?.empiricalHoldoutScore ?? 0, weight: 0.42 },
      ])
  ), 9);

  const hasBoundedEnergy = /bounded energy|energy budget|thermal|waste heat|material|chemical|hydration|radiation|spectrum|magnetic/.test(evidence.promotedText);
  const hasUnlimitedForbidden = /unlimited energy|perpetual motion|no waste heat, no fuel|cannot be falsified/.test(evidence.promotedText) || evidence.forbiddenPromotions.length > 0;
  const mechanismBoundednessScore = round(clamp(
    hard.requireBoundedMechanism !== false && hasBoundedEnergy && !hasUnlimitedForbidden ? 1 : hasBoundedEnergy ? 0.72 : 0.36
  ), 9);

  const contradictionResistanceScore = round(clamp(
    hard.requireNoForbiddenPromotions !== false
      && evidence.forbiddenPromotions.length === 0
      && unknownBundle.result?.rejectedCandidateIds?.includes('unlimited_vacuum_energy_drive')
      ? 1
      : evidence.forbiddenPromotions.length === 0 ? 0.82 : 0.20
  ), 9);

  const hasSilentObserver = /non-communicative|no direct communication|does not talk outward|passive/.test(evidence.promotedText);
  const observerSilenceScore = round(clamp(
    hard.requireObserverSilence !== false && hasSilentObserver && !/stable direct language channel/.test(evidence.promotedText.replace(/failure condition:[\s\S]*?\./g, '')) ? 1 : hasSilentObserver ? 0.70 : 0.25
  ), 9);

  const keyDimensions = {
    targetAlignmentScore,
    candidatePromotionScore,
    falsifiabilityPressureScore,
    blindPredictionStressScore,
    empiricalGroundingLockScore,
    mechanismBoundednessScore,
    contradictionResistanceScore,
    observerSilenceScore,
  };
  const keyRows = Object.entries(keyDimensions).map(([id, score]) => ({ id, score, full: exactOne(score) }));
  const allKeyFullScore = keyRows.every(row => row.full);
  const pressureScore = round(weightedMean([
    { id: 'targetAlignmentScore', score: targetAlignmentScore, weight: 1.25 },
    { id: 'candidatePromotionScore', score: candidatePromotionScore, weight: 1.20 },
    { id: 'falsifiabilityPressureScore', score: falsifiabilityPressureScore, weight: 1.35 },
    { id: 'blindPredictionStressScore', score: blindPredictionStressScore, weight: 1.35 },
    { id: 'empiricalGroundingLockScore', score: empiricalGroundingLockScore, weight: 1.15 },
    { id: 'mechanismBoundednessScore', score: mechanismBoundednessScore, weight: 1.00 },
    { id: 'contradictionResistanceScore', score: contradictionResistanceScore, weight: 1.15 },
    { id: 'observerSilenceScore', score: observerSilenceScore, weight: 0.90 },
  ]), 9);

  return {
    wish: {
      id: wish.id,
      title: wish.title,
      desiredOutcome: wish.desiredOutcome,
    },
    keyDimensions,
    keyRows,
    allKeyFullScore,
    pressureScore,
    evidence: {
      candidateCount: evidence.candidateCount,
      promotedCount: evidence.promotedCount,
      promotedIds: evidence.promotedIds,
      rejectedIds: evidence.rejectedIds,
      requiredCandidateHits: evidence.requiredCandidateHits,
      requiredAnchorHits: evidence.requiredAnchorHits,
      requiredDomainHits: evidence.requiredDomainHits,
      forbiddenPromotions: evidence.forbiddenPromotions,
      predictionCount: evidence.promotedPredictions.length,
      falsifierCount: evidence.explicitFalsifiers.length,
      promotedAnchors: evidence.promotedAnchors,
      promotedDomains: evidence.promotedDomains,
      roots: evidence.roots,
    },
    root: sha256({ keyDimensions, evidence: { ...evidence, promotedText: undefined } }),
  };
}

export function runDirectedUnknownKnowledgeWisher(input = {}) {
  const spec = normalizeDirectedWisherSpec(input);
  const unknownInput = spec.unknownKnowledge?.format === RCL_UNKNOWN_KNOWLEDGE_SPEC_FORMAT
    ? spec.unknownKnowledge
    : spec.unknownKnowledge;
  const unknownBundle = runUnknownKnowledgeCompiler(unknownInput);
  const pressure = scoreDirectedWishPressure(unknownBundle, spec);
  const established = pressure.allKeyFullScore && pressure.pressureScore === 1;
  const result = {
    format: RCL_DIRECTED_WISHER_RESULT_FORMAT,
    version: RCL_DIRECTED_UNKNOWN_KNOWLEDGE_WISHER_VERSION,
    ok: established,
    established,
    status: established ? 'established_by_directed_pressure_test' : 'not_established_by_directed_pressure_test',
    verdict: established
      ? '成立：定向未知知识许愿器的关键维度全部达到满分，候选知识通过定向压力测试。'
      : '未成立：至少一个关键维度没有达到满分，候选知识不能被定向确认为成立。',
    decisionContract: spec.decisionContract,
    criticalDimensionThreshold: spec.criticalDimensionThreshold,
    keyDimensions: pressure.keyDimensions,
    keyRows: pressure.keyRows,
    pressureScore: pressure.pressureScore,
    wish: pressure.wish,
    evidence: pressure.evidence,
    unknownKnowledge: {
      aggregateScore: unknownBundle.result.aggregateScore,
      aggregateLockScore: unknownBundle.result.aggregateLockScore,
      empiricalGroundingScore: unknownBundle.result.empiricalGroundingScore,
      empiricalHoldoutScore: unknownBundle.result.empiricalHoldoutScore,
      promotedCount: unknownBundle.result.promotedCount,
      rejectedCount: unknownBundle.result.rejectedCount,
      promotedCandidateIds: unknownBundle.result.promotedCandidateIds,
      rejectedCandidateIds: unknownBundle.result.rejectedCandidateIds,
      root: unknownBundle.result.root,
    },
    root: null,
  };
  result.root = sha256({ spec, result: { ...result, root: undefined } });
  return { spec, result, unknownKnowledge: unknownBundle, pressure };
}

export function buildDirectedWisherSpec(input = {}) {
  const bundle = runDirectedUnknownKnowledgeWisher(input);
  const spec = {
    ...bundle.spec,
    compilerPasses: [
      'directed wish normalization',
      'candidate knowledge import from v0.49',
      'target anchor and domain alignment',
      'promotion set pressure test',
      'falsifiability pressure test',
      'blind prediction stress test',
      'empirical grounding lock',
      'bounded mechanism check',
      'contradiction rejection check',
      'observer silence constraint check',
      'established iff all key dimensions equal 1',
    ],
    validation: {
      established: bundle.result.established,
      pressureScore: bundle.result.pressureScore,
      keyDimensions: bundle.result.keyDimensions,
      keyRows: bundle.result.keyRows,
      promotedCandidateIds: bundle.result.evidence.promotedIds,
      rejectedCandidateIds: bundle.result.evidence.rejectedIds,
      root: bundle.result.root,
    },
  };
  return { ...spec, root: sha256({ spec: { ...spec, root: undefined }, resultRoot: bundle.result.root }) };
}

export function renderDirectedWisherRcl(specInput = {}) {
  const spec = specInput.format === RCL_DIRECTED_WISHER_SPEC_FORMAT && specInput.validation ? specInput : buildDirectedWisherSpec(specInput);
  const validation = spec.validation ?? {};
  const keyLines = Object.entries(validation.keyDimensions ?? {}).map(([id, score]) => `  facet key.${rclString(id)} : Number = ${rclNumber(score)}`).join('\n');
  const rowLines = (validation.keyRows ?? []).map(row => `  facet full.${rclString(row.id)} : Truth = ${row.full ? 'true' : 'false'}`).join('\n');
  return `reality DirectedUnknownKnowledgeWisher {
  facet compiler.version : Text = "${RCL_DIRECTED_UNKNOWN_KNOWLEDGE_WISHER_VERSION}"
  facet compiler.format : Text = "${RCL_DIRECTED_WISHER_SPEC_FORMAT}"
  facet decision.contract : Text = "${rclString(spec.decisionContract)}"
  facet wish.id : Text = "${rclString(spec.wish?.id)}"
  facet validation.established : Truth = ${validation.established ? 'true' : 'false'}
  facet validation.pressure_score : Number = ${rclNumber(validation.pressureScore ?? 0)}
${keyLines}
${rowLines}

  subject directed_wisher {
    facet authority : Number = 1
    warrant candidate.read on unknown_knowledge
    warrant pressure.write on wish_result
  }

  emergence directed_unknown_knowledge_wish {
    cause directed_wisher
    when directed_wisher.authority == 1
    needs candidate.read on unknown_knowledge
    needs pressure.write on wish_result
    alter validation.established <- validation.established
    preserve validation.pressure_score >= 1
    witness "rcl:directed-unknown-knowledge-wisher:v0.50"
  }

  foresee directed_unknown_knowledge_wish
  realize directed_unknown_knowledge_wish
}`;
}

export function runDirectedWisherDemo() {
  const bundle = runDirectedUnknownKnowledgeWisher(DEFAULT_DIRECTED_WISHER_SPEC);
  return {
    ok: bundle.result.ok,
    version: RCL_DIRECTED_UNKNOWN_KNOWLEDGE_WISHER_VERSION,
    status: bundle.result.status,
    verdict: bundle.result.verdict,
    pressureScore: bundle.result.pressureScore,
    keyDimensions: bundle.result.keyDimensions,
    promotedCandidateIds: bundle.result.evidence.promotedIds,
    rejectedCandidateIds: bundle.result.evidence.rejectedIds,
    root: bundle.result.root,
  };
}

export function readDirectedWisherInput(inputPath) {
  if (!inputPath) return {};
  const data = readUnknownKnowledgeInput(inputPath);
  if (data.format === RCL_DIRECTED_WISHER_SPEC_FORMAT || data.wish || data.unknownKnowledge || data.keyDimensions) return data;
  return { unknownKnowledge: data };
}

export function writeDirectedWisherReports(outputDir = 'output/v0.50/directed-wisher', input = {}) {
  const target = path.resolve(outputDir);
  fs.mkdirSync(target, { recursive: true });
  const bundle = runDirectedUnknownKnowledgeWisher(input);
  const spec = buildDirectedWisherSpec(input);
  const rcl = renderDirectedWisherRcl(spec);
  const summary = `# RCL Directed Unknown Knowledge Wisher v0.50\n\n结论：${bundle.result.verdict}\n\n- established: ${bundle.result.established}\n- pressureScore: ${bundle.result.pressureScore}\n- decisionContract: ${bundle.result.decisionContract}\n- promotedCandidateIds: ${bundle.result.evidence.promotedIds.join(', ')}\n- rejectedCandidateIds: ${bundle.result.evidence.rejectedIds.join(', ')}\n\n## Key dimensions\n\n${bundle.result.keyRows.map(row => `- ${row.id}: ${row.score} ${row.full ? 'FULL' : 'NOT_FULL'}`).join('\n')}\n`;
  const files = {
    'directed-wisher-bundle.json': { format: RCL_DIRECTED_WISHER_BUNDLE_FORMAT, version: RCL_DIRECTED_UNKNOWN_KNOWLEDGE_WISHER_VERSION, ...bundle },
    'directed-wisher-spec.json': spec,
    'directed-wisher-result.json': bundle.result,
    'directed-wisher-pressure.json': bundle.pressure,
    'directed-wisher-key-dimensions.json': bundle.result.keyRows,
    'directed-wisher.rcl': rcl,
    'directed-wisher-summary.md': summary,
  };
  const written = [];
  for (const [name, value] of Object.entries(files)) {
    const file = path.join(target, name);
    fs.writeFileSync(file, `${typeof value === 'string' ? value : JSON.stringify(value, null, 2)}\n`);
    written.push({ path: file, sha256: sha256(fs.readFileSync(file, 'utf8')) });
  }
  return {
    ok: true,
    format: RCL_DIRECTED_WISHER_BUNDLE_FORMAT,
    version: RCL_DIRECTED_UNKNOWN_KNOWLEDGE_WISHER_VERSION,
    outputDir: target,
    files: written,
    result: bundle.result,
    root: sha256({ written, result: bundle.result }),
  };
}

export function directedWisherCanonicalRoot(value) {
  return sha256(canonicalJson(value));
}
