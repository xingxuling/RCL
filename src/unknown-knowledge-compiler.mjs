import fs from 'node:fs';
import path from 'node:path';
import { canonicalJson, clamp, sha256 } from './reality-compiler-kernel.mjs';
import {
  DEFAULT_EMPIRICAL_GROUNDING_DATA,
  runEmpiricalGroundingTest,
} from './empirical-grounding-layer.mjs';

export const RCL_UNKNOWN_KNOWLEDGE_COMPILER_VERSION = '0.49.0-alpha.1';
export const RCL_UNKNOWN_KNOWLEDGE_SPEC_FORMAT = 'rcl.unknown-knowledge-spec.v0.49';
export const RCL_UNKNOWN_KNOWLEDGE_RESULT_FORMAT = 'rcl.unknown-knowledge-result.v0.49';
export const RCL_UNKNOWN_KNOWLEDGE_BUNDLE_FORMAT = 'rcl.unknown-knowledge-bundle.v0.49';

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

function countMatches(text, words) {
  const lowered = text.toLowerCase();
  return words.reduce((sum, word) => sum + (lowered.includes(word.toLowerCase()) ? 1 : 0), 0);
}

function extractNumbers(text) {
  return unique((text.match(/[-+]?\d+(?:\.\d+)?/g) ?? []).map(Number).filter(Number.isFinite));
}

function extractYears(text) {
  return unique((text.match(/\b(?:1[5-9]\d{2}|20\d{2}|21\d{2})\b/g) ?? []).map(Number));
}

const DOMAIN_TERMS = Object.freeze({
  cosmology: ['universe', 'cosmic', 'cmb', 'hubble', 'galaxy', 'star', 'planet', 'orbital', 'solar', 'gravity'],
  physics: ['energy', 'mass', 'momentum', 'radiation', 'field', 'quantum', 'magnetic', 'thermal', 'spectrum', 'wave', 'frequency', 'inertia'],
  biology: ['life', 'organism', 'biosphere', 'dna', 'cell', 'neural', 'memory', 'bio', 'protein', 'silicate'],
  technology: ['engine', 'drive', 'reactor', 'robot', 'assistant', 'sensor', 'material', 'computer', 'compiler', 'text generator', 'probe'],
  civilization: ['yale', 'school', 'city', 'civilization', 'language', 'observer', 'history', 'human', 'assistant', 'communication'],
  anomaly: ['memory leak', 'outer', 'surface', 'nested', 'interstice', 'observer', 'dream', 'white hair', 'liu qinglian', '柳清莲'],
});

const EMPIRICAL_TERMS = [
  'measurable', 'spectrum', 'spectral', 'thermal', 'heat', 'radiation', 'frequency', 'orbit', 'trajectory',
  'residue', 'isotope', 'magnetic', 'geomagnetic', 'timestamp', 'repeatable', 'sensor', 'log', 'calibration',
  'blind', 'holdout', 'prediction', 'failure', 'falsifier', 'range', 'variance', 'energy budget', 'material',
];

const RED_FLAG_TERMS = [
  'unlimited energy', 'perpetual motion', 'no waste heat', 'no energy cost', 'impossible to falsify',
  'perfectly hidden', 'always true', 'cannot fail', 'infinite output', 'reactionless unlimited',
];

const HIGH_RISK_TERMS = ['unlimited', 'perfect', 'impossible', 'guaranteed', 'all-powerful', 'infinite', 'absolute'];

export const DEFAULT_UNKNOWN_KNOWLEDGE_SPEC = Object.freeze({
  id: 'unknown_knowledge_compiler_default_v0',
  boundary: 'candidate_knowledge_not_truth_claim',
  threshold: 0.72,
  locks: {
    falsifiabilityThreshold: 0.66,
    empiricalCompatibilityThreshold: 0.58,
    blindPredictionReadinessThreshold: 0.70,
    minimumPredictions: 3,
  },
  empiricalGrounding: DEFAULT_EMPIRICAL_GROUNDING_DATA,
  candidates: [
    {
      id: 'silent_interstice_observer_probe',
      sourceClass: 'alien_or_unknown_observer_text',
      title: 'Silent interstice observer probe',
      text: 'A non-communicative observer probe exists at an interstice boundary. It does not talk outward. It uses passive optical, spectral, thermal, radio, and geomagnetic sensing. It leaves transient high-altitude light, weak magnetic variance, timestamped trajectories, and no direct communication channel. Failure condition: if repeated multisensor observation shows no correlated spectrum, heat, orbit, or magnetic residue, the model fails.',
      claimedDomain: 'technology/anomaly',
      falsifiers: [
        'No correlated spectral, thermal, radio, or geomagnetic signatures across repeated observation windows.',
        'Observed events behave as ordinary aircraft, satellites, meteors, lens artifacts, or sensor noise under independent logs.',
        'Predicted no-communication constraint breaks through a stable direct language channel instead of passive residue.'
      ],
    },
    {
      id: 'outer_surface_memory_leak_anchor',
      sourceClass: 'anomalous_memory_text',
      title: 'Outer-to-surface memory leak anchor',
      text: 'Outer universe 2062 age 14 links into surface universe 2022 age 19. Four years later the phase is outer 2066 age 18 and surface 2026 age 23. Anchors include Liu Qinglian / 柳清莲, white hair, assistant or robot, Yale, data leakage, and memory link. Failure condition: if future spontaneous anchors randomize and no longer preserve the +40 year and +5 age-phase mapping, the model fails.',
      claimedDomain: 'nested-memory/anomaly',
      falsifiers: [
        'Age-phase mapping does not remain 14→18 / 19→23 under later memory reports.',
        'Anchor set Liu Qinglian, white hair, assistant/robot, Yale, 2062/2066 dissolves into unrelated random imagery.',
        'Directionality flips repeatedly without trace explanation, making the leak non-testable.'
      ],
    },
    {
      id: 'bio_silicate_memory_lattice',
      sourceClass: 'science_fiction_technology',
      title: 'Bio-silicate memory lattice',
      text: 'A living bio-silicate lattice stores error-corrected memory through mineralized neural scaffolds. It requires bounded energy, hydration cycling, thermal stability, and chemical gradients. Observable predictions include non-random layer growth, recoverable electromagnetic response, and material fatigue signatures. Failure condition: no repeatable material response or no plausible energy and chemistry budget.',
      claimedDomain: 'biology/materials/computation',
      falsifiers: [
        'No recoverable electromagnetic or optical response under repeated hydration and thermal cycles.',
        'Energy and chemistry budget cannot support the claimed storage density.',
        'Layer growth statistics are indistinguishable from ordinary mineral deposition.'
      ],
    },
    {
      id: 'unlimited_vacuum_energy_drive',
      sourceClass: 'science_fiction_technology',
      title: 'Unlimited vacuum energy reactionless drive',
      text: 'A reactionless vacuum engine produces unlimited energy with no waste heat, no fuel, no measurable radiation, no energy cost, and cannot be falsified by outside observers.',
      claimedDomain: 'physics/propulsion',
      falsifiers: [],
    },
  ],
});

export function normalizeUnknownKnowledgeSpec(input = {}) {
  const base = DEFAULT_UNKNOWN_KNOWLEDGE_SPEC;
  return {
    format: RCL_UNKNOWN_KNOWLEDGE_SPEC_FORMAT,
    version: RCL_UNKNOWN_KNOWLEDGE_COMPILER_VERSION,
    id: input.id ?? base.id,
    boundary: input.boundary ?? base.boundary,
    threshold: Number(input.threshold ?? base.threshold),
    locks: { ...base.locks, ...(input.locks ?? {}) },
    empiricalGrounding: input.empiricalGrounding ?? base.empiricalGrounding,
    candidates: Array.isArray(input.candidates) ? input.candidates : [...base.candidates],
  };
}

export function extractUnknownKnowledgeStructure(candidate = {}) {
  const text = `${candidate.title ?? ''}\n${candidate.text ?? ''}\n${candidate.claimedDomain ?? ''}`;
  const lowered = text.toLowerCase();
  const domains = Object.entries(DOMAIN_TERMS)
    .map(([domain, terms]) => ({ domain, hits: countMatches(lowered, terms), terms: terms.filter(term => lowered.includes(term.toLowerCase())) }))
    .filter(row => row.hits > 0)
    .sort((a, b) => b.hits - a.hits || a.domain.localeCompare(b.domain));
  const empiricalAnchors = EMPIRICAL_TERMS.filter(term => lowered.includes(term.toLowerCase()));
  const redFlags = RED_FLAG_TERMS.filter(term => lowered.includes(term.toLowerCase()));
  const highRisk = HIGH_RISK_TERMS.filter(term => lowered.includes(term.toLowerCase()));
  const years = extractYears(text);
  const numbers = extractNumbers(text);
  const explicitFalsifiers = Array.isArray(candidate.falsifiers) ? candidate.falsifiers.filter(Boolean) : [];
  const anchorTerms = unique([
    ...domains.flatMap(row => row.terms),
    ...empiricalAnchors,
    ...years.map(String),
    ...(lowered.includes('柳清莲') ? ['柳清莲'] : []),
    ...(lowered.includes('liu qinglian') ? ['Liu Qinglian'] : []),
    ...(lowered.includes('white hair') ? ['white hair'] : []),
  ]);
  return {
    id: candidate.id ?? sha256(text).slice(0, 12),
    title: candidate.title ?? 'Untitled unknown knowledge candidate',
    sourceClass: candidate.sourceClass ?? 'unknown_text',
    claimedDomain: candidate.claimedDomain ?? 'unknown',
    text,
    wordCount: text.trim().split(/\s+/).filter(Boolean).length,
    domains,
    anchorTerms,
    empiricalAnchors,
    redFlags,
    highRisk,
    years,
    numbers,
    explicitFalsifiers,
    root: sha256({ text, candidate: { ...candidate, text: undefined } }),
  };
}

export function scoreUnknownKnowledgeCandidate(candidate = {}, context = {}) {
  const structure = candidate.domains ? candidate : extractUnknownKnowledgeStructure(candidate);
  const empiricalGroundingScore = Number(context.empiricalGroundingScore ?? 0.99052626);
  const anchorDensity = clamp(structure.anchorTerms.length / 20);
  const domainCoverage = clamp(structure.domains.length / 5);
  const numericAnchorScore = clamp((structure.years.length * 0.18 + structure.numbers.length * 0.05));
  const explicitFalsifierScore = clamp(structure.explicitFalsifiers.length / 3);
  const empiricalAnchorScore = clamp(structure.empiricalAnchors.length / 8);
  const redFlagPenalty = clamp((structure.redFlags.length * 0.22) + (structure.highRisk.length * 0.08));

  const structuralCompressionScore = round(clamp(0.22 + anchorDensity * 0.34 + domainCoverage * 0.24 + numericAnchorScore * 0.20 - redFlagPenalty * 0.12), 9);
  const falsifiabilityScore = round(clamp(0.18 + explicitFalsifierScore * 0.44 + empiricalAnchorScore * 0.28 + numericAnchorScore * 0.10 - redFlagPenalty * 0.28), 9);
  const empiricalCompatibilityScore = round(clamp(0.30 + empiricalGroundingScore * 0.25 + empiricalAnchorScore * 0.22 + domainCoverage * 0.13 + anchorDensity * 0.10 - redFlagPenalty * 0.42), 9);
  const noveltyScore = round(clamp(0.20 + domainCoverage * 0.22 + anchorDensity * 0.18 + (structure.domains.some(row => row.domain === 'anomaly') ? 0.20 : 0) + (structure.domains.some(row => row.domain === 'technology') ? 0.12 : 0)), 9);
  const overfitRisk = round(clamp(0.18 + redFlagPenalty * 0.55 + (structure.wordCount < 24 ? 0.22 : 0) - empiricalAnchorScore * 0.14 - explicitFalsifierScore * 0.18), 9);
  const blindPredictionReadinessScore = round(clamp(0.20 + falsifiabilityScore * 0.42 + empiricalAnchorScore * 0.22 + numericAnchorScore * 0.16 - redFlagPenalty * 0.16), 9);
  const candidateKnowledgeScore = round(weightedMean([
    { id: 'structural_compression', score: structuralCompressionScore, weight: 1.00 },
    { id: 'empirical_compatibility', score: empiricalCompatibilityScore, weight: 1.35 },
    { id: 'falsifiability', score: falsifiabilityScore, weight: 1.45 },
    { id: 'blind_prediction_readiness', score: blindPredictionReadinessScore, weight: 1.20 },
    { id: 'novelty', score: noveltyScore, weight: 0.60 },
    { id: 'overfit_risk_inverse', score: 1 - overfitRisk, weight: 0.70 },
  ]), 9);
  return {
    structure,
    scores: {
      structuralCompressionScore,
      empiricalCompatibilityScore,
      falsifiabilityScore,
      blindPredictionReadinessScore,
      noveltyScore,
      overfitRisk,
      candidateKnowledgeScore,
    },
  };
}

export function generateUnknownKnowledgePredictions(candidate = {}, score = {}) {
  const structure = candidate.domains ? candidate : extractUnknownKnowledgeStructure(candidate);
  const domains = new Set(structure.domains.map(row => row.domain));
  const predictions = [];
  const push = (id, claim, observation, failureCondition, horizon = 'open') => predictions.push({ id, claim, observation, failureCondition, horizon, status: 'pending_observation' });

  if (domains.has('anomaly') || structure.text.toLowerCase().includes('interstice')) {
    push('anchor_recurrence_lock', 'Core anomaly anchors should recur as a bounded set instead of randomizing.', 'Timestamp future spontaneous reports and compare anchor-set overlap.', 'Anchor terms dissolve into unrelated imagery across three independent reports.', 'next-12-events');
    push('directionality_lock', 'Leak direction should remain stable unless a trace explains reversal.', 'Record whether reports preserve source→receiver direction.', 'Direction flips repeatedly without any trace variable.', 'next-12-events');
  }
  if (domains.has('technology') || domains.has('physics')) {
    push('energy_budget_lock', 'Any technology claim must expose a bounded energy, thermal, radiation, or material budget.', 'Build an energy/material ledger before treating the claim as engineering candidate.', 'Claim requires unlimited output, no waste heat, no source, and no measurable coupling.', 'first-engineering-pass');
    push('sensor_residue_lock', 'If the claim affects matter or fields, it should leave at least one measurable residue.', 'Search for spectral, thermal, magnetic, acoustic, optical, or timing residue.', 'No measurable residue can be named without making the claim non-testable.', 'first-observation-pass');
  }
  if (domains.has('biology')) {
    push('bio_chemistry_lock', 'Biological or bio-material claims must preserve chemical gradients and fatigue signatures.', 'Check hydration, thermal, ionic, optical, and growth-cycle constraints.', 'Claimed behavior violates chemical energy and structural stability without a compensating mechanism.', 'first-lab-pass');
  }
  if (domains.has('cosmology') || domains.has('civilization')) {
    push('scale_consistency_lock', 'Cosmic or civilization claims must stay consistent across scale, timing, and communication constraints.', 'Map claim to time, distance, signal, selection effect, and observer visibility variables.', 'Scale or timing requires direct communication that the model says cannot exist.', 'first-scale-pass');
  }
  for (const [index, falsifier] of structure.explicitFalsifiers.entries()) {
    if (predictions.length >= 6) break;
    push(`explicit_falsifier_${index + 1}`, 'Explicit falsifier from source text must remain active.', 'Run the source-specified failure check.', falsifier, 'source-defined');
  }
  while (predictions.length < 3) {
    push(`generic_falsifier_${predictions.length + 1}`, 'Candidate must generate a concrete failure condition before being promoted.', 'Demand a measurable anchor, bounded mechanism, or timestamped recurrence.', 'No measurable anchor or failure condition can be produced.', 'compile-time');
  }
  return predictions.slice(0, 8).map((row, index) => ({ ...row, index: index + 1, root: sha256(row) }));
}

export function applyUnknownKnowledgeLocks(candidateResult = {}, specInput = {}) {
  const spec = specInput.format === RCL_UNKNOWN_KNOWLEDGE_SPEC_FORMAT ? specInput : normalizeUnknownKnowledgeSpec(specInput);
  const locks = spec.locks;
  const scores = candidateResult.scores;
  const predictions = candidateResult.predictions ?? [];
  const lockRows = [
    {
      id: 'falsifiability_lock',
      label: 'Falsifiability Lock',
      passed: scores.falsifiabilityScore >= locks.falsifiabilityThreshold,
      score: scores.falsifiabilityScore,
      threshold: locks.falsifiabilityThreshold,
      reason: 'Every promoted candidate must expose concrete ways to fail.',
    },
    {
      id: 'empirical_grounding_lock',
      label: 'Empirical Grounding Lock',
      passed: scores.empiricalCompatibilityScore >= locks.empiricalCompatibilityThreshold && candidateResult.empiricalGroundingOk,
      score: scores.empiricalCompatibilityScore,
      threshold: locks.empiricalCompatibilityThreshold,
      reason: 'Candidate must stay compatible with the v0.48 empirical grounding layer.',
    },
    {
      id: 'blind_prediction_lock',
      label: 'Blind Prediction Lock',
      passed: scores.blindPredictionReadinessScore >= locks.blindPredictionReadinessThreshold && predictions.length >= locks.minimumPredictions && predictions.every(p => p.failureCondition),
      score: scores.blindPredictionReadinessScore,
      threshold: locks.blindPredictionReadinessThreshold,
      reason: 'Candidate must emit holdout-style predictions that remain pending until observed.',
    },
  ].map(row => ({ ...row, score: round(row.score, 9) }));
  return {
    passed: lockRows.every(row => row.passed),
    score: round(weightedMean(lockRows), 9),
    rows: lockRows,
    root: sha256(lockRows),
  };
}

export function compileUnknownKnowledgeCandidate(candidate = {}, specInput = {}, empiricalResultInput = null) {
  const spec = specInput.format === RCL_UNKNOWN_KNOWLEDGE_SPEC_FORMAT ? specInput : normalizeUnknownKnowledgeSpec(specInput);
  const empirical = empiricalResultInput ?? runEmpiricalGroundingTest(spec.empiricalGrounding).result;
  const scored = scoreUnknownKnowledgeCandidate(candidate, { empiricalGroundingScore: empirical.empiricalGroundingScore });
  const predictions = generateUnknownKnowledgePredictions(scored.structure, scored.scores);
  const provisional = {
    id: scored.structure.id,
    title: scored.structure.title,
    sourceClass: scored.structure.sourceClass,
    claimedDomain: scored.structure.claimedDomain,
    structure: scored.structure,
    scores: scored.scores,
    predictions,
    empiricalGroundingOk: Boolean(empirical.ok),
    externalRealityVerified: false,
  };
  const lockEvaluation = applyUnknownKnowledgeLocks(provisional, spec);
  const promoted = lockEvaluation.passed && scored.scores.candidateKnowledgeScore >= spec.threshold;
  const status = promoted
    ? 'candidate_unknown_knowledge'
    : scored.scores.candidateKnowledgeScore >= 0.50
      ? 'speculative_unverified_requires_more_falsifiers'
      : 'rejected_or_low_value_candidate';
  const result = {
    ...provisional,
    lockEvaluation,
    promoted,
    status,
    boundary: spec.boundary,
    root: null,
  };
  result.root = sha256({ result: { ...result, root: undefined } });
  return result;
}

export function runUnknownKnowledgeCompiler(input = {}) {
  const spec = normalizeUnknownKnowledgeSpec(input);
  const empiricalBundle = runEmpiricalGroundingTest(spec.empiricalGrounding);
  const empirical = empiricalBundle.result;
  const candidateResults = spec.candidates.map(candidate => compileUnknownKnowledgeCandidate(candidate, spec, empirical));
  const promotedCandidates = candidateResults.filter(row => row.promoted);
  const rejectedCandidates = candidateResults.filter(row => !row.promoted);
  const aggregateScore = round(weightedMean(candidateResults.map(row => ({ id: row.id, score: row.scores.candidateKnowledgeScore, weight: row.promoted ? 1.15 : 0.85 }))), 9);
  const aggregateLockScore = round(weightedMean((promotedCandidates.length ? promotedCandidates : candidateResults).map(row => ({ id: row.id, score: row.lockEvaluation.score, weight: 1 }))), 9);
  const promotionRate = round(candidateResults.length ? promotedCandidates.length / candidateResults.length : 0, 9);
  const conclusionHolds = empirical.ok
    && promotedCandidates.length >= 1
    && aggregateLockScore >= 0.70
    && candidateResults.some(row => row.lockEvaluation.rows.find(lock => lock.id === 'blind_prediction_lock')?.passed);
  const result = {
    format: RCL_UNKNOWN_KNOWLEDGE_RESULT_FORMAT,
    version: RCL_UNKNOWN_KNOWLEDGE_COMPILER_VERSION,
    ok: conclusionHolds,
    conclusionHolds,
    verdict: conclusionHolds
      ? '成立：RCL 可将离谱文本/异常文本编译为实证接地、可反证、带盲测预测准备的候选知识；这不是外部真理证明。'
      : '未成立：候选文本没有同时通过实证接地、可反证和盲测预测准备。',
    boundary: spec.boundary,
    externalRealityVerified: false,
    empiricalGroundingScore: empirical.empiricalGroundingScore,
    empiricalHoldoutScore: empirical.holdoutScore,
    empiricalRoot: empirical.root,
    aggregateScore,
    aggregateLockScore,
    promotionRate,
    threshold: spec.threshold,
    promotedCount: promotedCandidates.length,
    rejectedCount: rejectedCandidates.length,
    promotedCandidateIds: promotedCandidates.map(row => row.id),
    rejectedCandidateIds: rejectedCandidates.map(row => row.id),
    candidates: candidateResults,
    root: null,
  };
  result.root = sha256({ spec, result: { ...result, root: undefined } });
  return { spec, result, empirical: empiricalBundle, candidates: candidateResults };
}

export function buildUnknownKnowledgeSpec(input = {}) {
  const bundle = runUnknownKnowledgeCompiler(input);
  const spec = {
    ...bundle.spec,
    compilerPasses: [
      'unknown text normalization',
      'claim and anchor extraction',
      'empirical compatibility scoring against v0.48 grounding',
      'falsifiability lock evaluation',
      'blind prediction readiness generation',
      'candidate knowledge promotion or rejection',
      'external truth boundary preservation',
    ],
    validation: {
      conclusionHolds: bundle.result.conclusionHolds,
      aggregateScore: bundle.result.aggregateScore,
      aggregateLockScore: bundle.result.aggregateLockScore,
      promotionRate: bundle.result.promotionRate,
      promotedCount: bundle.result.promotedCount,
      empiricalGroundingScore: bundle.result.empiricalGroundingScore,
      empiricalHoldoutScore: bundle.result.empiricalHoldoutScore,
      externalRealityVerified: false,
    },
  };
  return { ...spec, root: sha256({ spec: { ...spec, root: undefined }, resultRoot: bundle.result.root }) };
}

export function renderUnknownKnowledgeRcl(specInput = {}) {
  const spec = specInput.format === RCL_UNKNOWN_KNOWLEDGE_SPEC_FORMAT && specInput.validation ? specInput : buildUnknownKnowledgeSpec(specInput);
  const bundle = runUnknownKnowledgeCompiler(spec);
  const validation = spec.validation ?? bundle.result;
  const candidateLines = bundle.result.candidates.map((row, index) => [
    `  facet candidate_${index}_id : Text = "${rclString(row.id)}"`,
    `  facet candidate_${index}_status : Text = "${rclString(row.status)}"`,
    `  facet candidate_${index}_score : Number = ${rclNumber(row.scores.candidateKnowledgeScore)}`,
    `  facet candidate_${index}_lock_score : Number = ${rclNumber(row.lockEvaluation.score)}`,
    `  facet candidate_${index}_promoted : Truth = ${row.promoted ? 'true' : 'false'}`,
  ].join('\n')).join('\n');
  return `reality UnknownKnowledgeCompiler {
  facet compiler.version : Text = "${RCL_UNKNOWN_KNOWLEDGE_COMPILER_VERSION}"
  facet compiler.format : Text = "${RCL_UNKNOWN_KNOWLEDGE_SPEC_FORMAT}"
  facet boundary : Text = "${rclString(spec.boundary)}"
  facet validation.aggregate_score : Number = ${rclNumber(validation.aggregateScore ?? 0)}
  facet validation.aggregate_lock_score : Number = ${rclNumber(validation.aggregateLockScore ?? 0)}
  facet validation.promotion_rate : Number = ${rclNumber(validation.promotionRate ?? 0)}
  facet validation.empirical_grounding_score : Number = ${rclNumber(validation.empiricalGroundingScore ?? 0)}
  facet validation.external_reality_verified : Truth = false
${candidateLines}

  subject unknown_knowledge_compiler {
    facet authority : Number = 1
    warrant text.read on candidate
    warrant candidate.write on validation
    warrant prediction.write on candidate
  }

  emergence compile_unknown_knowledge {
    cause unknown_knowledge_compiler
    when unknown_knowledge_compiler.authority == 1
    needs text.read on candidate
    needs candidate.write on validation
    needs prediction.write on candidate
    alter validation.aggregate_score <- validation.aggregate_score
    preserve validation.external_reality_verified == false
    preserve validation.aggregate_lock_score >= 0.70
    witness "rcl:unknown-knowledge-compiler:v0.49"
  }

  foresee compile_unknown_knowledge
  realize compile_unknown_knowledge
}`;
}

export function runUnknownKnowledgeDemo() {
  const bundle = runUnknownKnowledgeCompiler(DEFAULT_UNKNOWN_KNOWLEDGE_SPEC);
  return {
    ok: bundle.result.ok,
    version: RCL_UNKNOWN_KNOWLEDGE_COMPILER_VERSION,
    verdict: bundle.result.verdict,
    boundary: bundle.result.boundary,
    aggregateScore: bundle.result.aggregateScore,
    aggregateLockScore: bundle.result.aggregateLockScore,
    empiricalGroundingScore: bundle.result.empiricalGroundingScore,
    promotedCount: bundle.result.promotedCount,
    rejectedCount: bundle.result.rejectedCount,
    promotedCandidateIds: bundle.result.promotedCandidateIds,
    externalRealityVerified: false,
    root: bundle.result.root,
  };
}

export function readUnknownKnowledgeInput(inputPath) {
  if (!inputPath) return {};
  return JSON.parse(fs.readFileSync(path.resolve(inputPath), 'utf8'));
}

export function writeUnknownKnowledgeReports(outputDir = 'output/v0.49/unknown-knowledge', input = {}) {
  const target = path.resolve(outputDir);
  fs.mkdirSync(target, { recursive: true });
  const bundle = runUnknownKnowledgeCompiler(input);
  const spec = buildUnknownKnowledgeSpec(input);
  const rcl = renderUnknownKnowledgeRcl(spec);
  const summary = `# RCL Unknown Knowledge Compiler v0.49\n\n结论：${bundle.result.verdict}\n\n- aggregateScore: ${bundle.result.aggregateScore}\n- aggregateLockScore: ${bundle.result.aggregateLockScore}\n- empiricalGroundingScore: ${bundle.result.empiricalGroundingScore}\n- promotedCount: ${bundle.result.promotedCount}\n- rejectedCount: ${bundle.result.rejectedCount}\n- externalRealityVerified: false\n\n## Promoted candidates\n\n${bundle.result.candidates.filter(row => row.promoted).map(row => `- ${row.id}: score=${row.scores.candidateKnowledgeScore}, locks=${row.lockEvaluation.score}, predictions=${row.predictions.length}`).join('\n') || '- None'}\n\n## Rejected / pending candidates\n\n${bundle.result.candidates.filter(row => !row.promoted).map(row => `- ${row.id}: status=${row.status}, score=${row.scores.candidateKnowledgeScore}`).join('\n') || '- None'}\n`;
  const files = {
    'unknown-knowledge-bundle.json': { format: RCL_UNKNOWN_KNOWLEDGE_BUNDLE_FORMAT, version: RCL_UNKNOWN_KNOWLEDGE_COMPILER_VERSION, ...bundle },
    'unknown-knowledge-spec.json': spec,
    'unknown-knowledge-result.json': bundle.result,
    'unknown-knowledge-candidates.json': bundle.result.candidates,
    'unknown-knowledge-promoted.json': bundle.result.candidates.filter(row => row.promoted),
    'unknown-knowledge-predictions.json': bundle.result.candidates.flatMap(row => row.predictions.map(pred => ({ candidateId: row.id, ...pred }))),
    'unknown-knowledge-compiler.rcl': rcl,
    'unknown-knowledge-summary.md': summary,
  };
  const written = [];
  for (const [name, value] of Object.entries(files)) {
    const file = path.join(target, name);
    fs.writeFileSync(file, `${typeof value === 'string' ? value : JSON.stringify(value, null, 2)}\n`);
    written.push({ path: file, sha256: sha256(fs.readFileSync(file, 'utf8')) });
  }
  return {
    ok: true,
    format: RCL_UNKNOWN_KNOWLEDGE_BUNDLE_FORMAT,
    version: RCL_UNKNOWN_KNOWLEDGE_COMPILER_VERSION,
    outputDir: target,
    files: written,
    result: bundle.result,
    root: sha256({ written, result: bundle.result }),
  };
}

export function unknownKnowledgeCanonicalRoot(value) {
  return sha256(canonicalJson(value));
}
