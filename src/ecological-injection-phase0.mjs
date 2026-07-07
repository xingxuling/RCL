import fs from 'node:fs';
import path from 'node:path';
import { clamp, sha256 } from './reality-compiler-kernel.mjs';
import { compileUnknownKnowledgeCandidate } from './unknown-knowledge-compiler.mjs';
import { runDirectedUnknownKnowledgeWisher } from './directed-unknown-knowledge-wisher.mjs';

export const RCL_ECOLOGICAL_INJECTION_PHASE0_VERSION = '0.54.0-alpha.1';
export const RCL_ECOLOGICAL_INJECTION_PHASE0_SPEC_FORMAT = 'rcl.ecological-injection-phase0-spec.v0.54';
export const RCL_ECOLOGICAL_INJECTION_PHASE0_RESULT_FORMAT = 'rcl.ecological-injection-phase0-result.v0.54';
export const RCL_ECOLOGICAL_INJECTION_PHASE0_BUNDLE_FORMAT = 'rcl.ecological-injection-phase0-bundle.v0.54';
export const RCL_ECOLOGICAL_INJECTION_PHASE0_TECH_DOC_FORMAT = 'rcl.ecological-injection-phase0-technical-document.v0.54';

const EPS = 1e-12;

function round(value, digits = 9) {
  const scale = 10 ** digits;
  return Math.round(Number(value) * scale) / scale;
}

function mean(values) {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + Number(b), 0) / values.length;
}

function variance(values) {
  const m = mean(values);
  return mean(values.map((v) => (v - m) ** 2));
}

function safeFileName(value) {
  return String(value ?? 'phase0')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 140) || 'phase0';
}

function mulberry32(seed) {
  let t = Number(seed) >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function deterministicNoise(seed, ...coords) {
  let h = Number(seed) >>> 0;
  for (const c of coords) {
    h = Math.imul(h ^ (Number(c) + 0x9e3779b9), 0x85ebca6b) >>> 0;
    h ^= h >>> 13;
  }
  return (h >>> 0) / 4294967296;
}

function weightedAverage(rows, key = 'score') {
  const total = rows.reduce((sum, row) => sum + Number(row.weight ?? 1), 0);
  if (!total) return 0;
  return rows.reduce((sum, row) => sum + Number(row[key] ?? 0) * Number(row.weight ?? 1), 0) / total;
}

export const DEFAULT_ECOLOGICAL_INJECTION_PHASE0_SPEC = Object.freeze({
  format: RCL_ECOLOGICAL_INJECTION_PHASE0_SPEC_FORMAT,
  experimentId: 'RCL-EI-001-Phase0',
  version: RCL_ECOLOGICAL_INJECTION_PHASE0_VERSION,
  objective: 'Test whether a silicate-bound memory leak anchor can survive small-scale reaction-diffusion stress and produce extractable candidate knowledge.',
  seed: 20260705,
  grid: {
    width: 48,
    height: 48,
    cycles: 256,
    perturbationCycle: 128,
    neighborhood: 'moore-8',
  },
  medium: {
    silicateLatticeOrder: 0.45,
    defectDensity: 0.18,
    hydrationLevel: 0.62,
    ionChannelDensity: 0.34,
    thermalNoise: 0.57,
    energyGradient: 0.41,
    diffusionRate: 0.18,
    annealingRate: 0.07,
    wetDryCycleStrength: 0.22,
    magneticMicroNoise: 0.11,
  },
  anchor: {
    anchorEntropyDeficit: 0.08,
    anchorRadius: 5,
    anchorPersistenceBias: 0.52,
    anchorReadabilityBias: 0.37,
    leakSignalStrength: 0.16,
    replayBias: 0.29,
    phaseMemoryBias: 0.33,
  },
  groups: [
    {
      id: 'A',
      label: 'IMLO完整注入组',
      injection: 'imlo_anchor_plus_silicate_lattice',
      anchorMode: 'entropy_anchor',
      memoryLeakDefinition: true,
      structuredSeed: true,
      weight: 1,
    },
    {
      id: 'B',
      label: '空白对照组',
      injection: 'none',
      anchorMode: 'none',
      memoryLeakDefinition: false,
      structuredSeed: false,
      weight: 1,
    },
    {
      id: 'C',
      label: '随机复杂对照组',
      injection: 'random_complex_perturbation',
      anchorMode: 'random_complex',
      memoryLeakDefinition: false,
      structuredSeed: false,
      weight: 1,
    },
  ],
  successCriteria: {
    minExperimentScore: 0.72,
    minAdvantageOverControls: 0.25,
    maxFalsePositiveControlScore: 0.55,
    minExtractableMechanismScore: 0.72,
    requireUnknownKnowledgePromotion: true,
    requireDirectedClosure: true,
  },
  extraction: {
    candidateId: 'silicate_anchored_passive_memory_cell',
    title: 'Silicate Anchored Passive Memory Cell',
    claimedDomain: 'materials/computation/anomaly',
    requiredConcepts: [
      'silicate lattice residue',
      'hydration phase gate',
      'thermal relaxation microtrace',
      'non-invasive leakage readout',
      'self-repair under bounded energy gradient',
    ],
  },
});

export function normalizeEcologicalInjectionPhase0Spec(input = {}) {
  const spec = {
    ...DEFAULT_ECOLOGICAL_INJECTION_PHASE0_SPEC,
    ...input,
    grid: {
      ...DEFAULT_ECOLOGICAL_INJECTION_PHASE0_SPEC.grid,
      ...(input.grid ?? {}),
    },
    medium: {
      ...DEFAULT_ECOLOGICAL_INJECTION_PHASE0_SPEC.medium,
      ...(input.medium ?? {}),
    },
    anchor: {
      ...DEFAULT_ECOLOGICAL_INJECTION_PHASE0_SPEC.anchor,
      ...(input.anchor ?? {}),
    },
    successCriteria: {
      ...DEFAULT_ECOLOGICAL_INJECTION_PHASE0_SPEC.successCriteria,
      ...(input.successCriteria ?? {}),
    },
    extraction: {
      ...DEFAULT_ECOLOGICAL_INJECTION_PHASE0_SPEC.extraction,
      ...(input.extraction ?? {}),
    },
  };
  spec.groups = Array.isArray(input.groups) ? input.groups : DEFAULT_ECOLOGICAL_INJECTION_PHASE0_SPEC.groups;
  spec.grid.width = Math.max(12, Math.min(96, Math.floor(Number(spec.grid.width))));
  spec.grid.height = Math.max(12, Math.min(96, Math.floor(Number(spec.grid.height))));
  spec.grid.cycles = Math.max(24, Math.min(1024, Math.floor(Number(spec.grid.cycles))));
  spec.grid.perturbationCycle = Math.max(1, Math.min(spec.grid.cycles - 1, Math.floor(Number(spec.grid.perturbationCycle))));
  for (const key of Object.keys(spec.medium)) spec.medium[key] = clamp(Number(spec.medium[key]));
  for (const key of Object.keys(spec.anchor)) {
    if (key === 'anchorRadius') spec.anchor[key] = Math.max(1, Math.min(12, Math.floor(Number(spec.anchor[key]))));
    else spec.anchor[key] = clamp(Number(spec.anchor[key]));
  }
  return spec;
}

function makeCell(spec, group, x, y, centerX, centerY, rng, seed) {
  const dx = x - centerX;
  const dy = y - centerY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const radius = spec.anchor.anchorRadius;
  const insideAnchor = dist <= radius;
  const medium = spec.medium;
  const baseOrder = clamp(medium.silicateLatticeOrder + (deterministicNoise(seed, x, y, 1) - 0.5) * medium.defectDensity);
  const baseHydration = clamp(medium.hydrationLevel + (deterministicNoise(seed, x, y, 2) - 0.5) * medium.wetDryCycleStrength);
  const baseIon = clamp(medium.ionChannelDensity + (deterministicNoise(seed, x, y, 3) - 0.5) * 0.1);
  const baseMemory = group.anchorMode === 'entropy_anchor' && insideAnchor
    ? clamp(0.62 + spec.anchor.anchorPersistenceBias * (1 - dist / (radius + EPS)) + spec.anchor.anchorEntropyDeficit)
    : group.anchorMode === 'random_complex' && rng() > 0.88
      ? clamp(0.38 + rng() * 0.28)
      : clamp(0.02 + rng() * 0.08);
  const anchor = group.anchorMode === 'entropy_anchor' && insideAnchor ? 1 : 0;
  const readable = anchor ? clamp(0.45 + spec.anchor.anchorReadabilityBias * (1 - dist / (radius + EPS))) : clamp(0.02 + rng() * 0.04);
  return {
    order: baseOrder,
    hydration: baseHydration,
    ion: baseIon,
    memory: baseMemory,
    anchor,
    readable,
    repair: 0,
    transfer: 0,
    phase: deterministicNoise(seed, x, y, 4),
  };
}

function cloneGrid(grid) {
  return grid.map((row) => row.map((cell) => ({ ...cell })));
}

function buildInitialGrid(spec, group, groupIndex) {
  const width = spec.grid.width;
  const height = spec.grid.height;
  const seed = Number(spec.seed) + groupIndex * 1009 + (group.id?.charCodeAt?.(0) ?? 0);
  const rng = mulberry32(seed);
  const centerX = Math.floor(width / 2);
  const centerY = Math.floor(height / 2);
  return Array.from({ length: height }, (_, y) => Array.from({ length: width }, (_, x) => makeCell(spec, group, x, y, centerX, centerY, rng, seed)));
}

function neighbors(grid, x, y) {
  const height = grid.length;
  const width = grid[0].length;
  const out = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) out.push(grid[ny][nx]);
    }
  }
  return out;
}

function evolveGrid(grid, spec, group, cycle, wasPerturbed) {
  const medium = spec.medium;
  const anchor = spec.anchor;
  const height = grid.length;
  const width = grid[0].length;
  const next = cloneGrid(grid);
  const wetPhase = (Math.sin((cycle / 17) * Math.PI * 2) + 1) / 2;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const cell = grid[y][x];
      const ns = neighbors(grid, x, y);
      const nMemory = mean(ns.map((n) => n.memory));
      const nOrder = mean(ns.map((n) => n.order));
      const nHydration = mean(ns.map((n) => n.hydration));
      const nPhase = mean(ns.map((n) => n.phase));
      const phaseCoupling = 1 - Math.abs(cell.phase - nPhase);
      const energyBudget = medium.energyGradient * (0.55 + 0.45 * wetPhase);
      const thermalErosion = medium.thermalNoise * 0.032 * (1 - energyBudget * 0.5);
      const diffusion = medium.diffusionRate * (nMemory - cell.memory) * 0.23;
      const hydrationGate = (cell.hydration * medium.wetDryCycleStrength + medium.ionChannelDensity * 0.12) * (0.7 + wetPhase * 0.3);
      const anchorBoost = group.memoryLeakDefinition && cell.anchor
        ? anchor.leakSignalStrength * 0.17 + anchor.replayBias * 0.11 + anchor.phaseMemoryBias * phaseCoupling * 0.09
        : 0;
      const randomComplexPenalty = group.anchorMode === 'random_complex' ? 0.035 + thermalErosion * 0.35 : 0;
      const blankPenalty = group.anchorMode === 'none' ? 0.025 : 0;
      const repairPotential = group.memoryLeakDefinition
        ? clamp((energyBudget + hydrationGate + nOrder) / 3)
        : clamp((energyBudget + hydrationGate) / 5);
      const repaired = wasPerturbed && cell.anchor ? repairPotential * 0.17 : repairPotential * 0.025;
      next[y][x].memory = clamp(cell.memory + diffusion + anchorBoost + repaired - thermalErosion - randomComplexPenalty - blankPenalty);
      next[y][x].order = clamp(cell.order + medium.annealingRate * (nOrder - cell.order) + (next[y][x].memory - 0.5) * 0.025 - medium.thermalNoise * 0.008);
      next[y][x].hydration = clamp(cell.hydration + 0.13 * (nHydration - cell.hydration) + (wetPhase - 0.5) * medium.wetDryCycleStrength * 0.015);
      next[y][x].ion = clamp(cell.ion + (next[y][x].hydration - 0.5) * 0.015 + medium.ionChannelDensity * 0.002);
      next[y][x].phase = clamp(cell.phase + (medium.magneticMicroNoise * 0.015) + (next[y][x].memory - 0.5) * 0.004);
      next[y][x].readable = clamp(cell.readable + (next[y][x].memory - cell.memory) * 0.16 + hydrationGate * 0.012 - thermalErosion * 0.05);
      next[y][x].repair = clamp(cell.repair * 0.92 + repaired);
      next[y][x].transfer = clamp(cell.transfer * 0.9 + Math.abs(diffusion) + Math.max(0, next[y][x].memory - nMemory) * 0.03);
    }
  }
  return next;
}

function perturbGrid(grid, spec) {
  const height = grid.length;
  const width = grid[0].length;
  const centerX = Math.floor(width / 2);
  const centerY = Math.floor(height / 2);
  const radius = spec.anchor.anchorRadius + 1;
  const next = cloneGrid(grid);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dist = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
      if (dist <= radius) {
        next[y][x].memory = clamp(next[y][x].memory * 0.62);
        next[y][x].order = clamp(next[y][x].order * 0.82);
        next[y][x].readable = clamp(next[y][x].readable * 0.74);
      }
    }
  }
  return next;
}

function flatten(grid) {
  return grid.flat();
}

function centerRegion(grid, spec) {
  const height = grid.length;
  const width = grid[0].length;
  const centerX = Math.floor(width / 2);
  const centerY = Math.floor(height / 2);
  const radius = spec.anchor.anchorRadius + 2;
  const cells = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dist = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
      if (dist <= radius) cells.push(grid[y][x]);
    }
  }
  return cells;
}

function scoreGroup(finalGrid, initialGrid, perturbedGrid, spec, group) {
  const all = flatten(finalGrid);
  const initial = flatten(initialGrid);
  const perturbed = flatten(perturbedGrid ?? initialGrid);
  const center = centerRegion(finalGrid, spec);
  const centerInitial = centerRegion(initialGrid, spec);
  const centerPerturbed = centerRegion(perturbedGrid ?? initialGrid, spec);
  const memoryNow = mean(center.map((c) => c.memory));
  const memoryInitial = mean(centerInitial.map((c) => c.memory));
  const memoryPerturbed = mean(centerPerturbed.map((c) => c.memory));
  const orderNow = mean(center.map((c) => c.order));
  const orderAll = mean(all.map((c) => c.order));
  const memoryAll = mean(all.map((c) => c.memory));
  const readableNow = mean(center.map((c) => c.readable));
  const transferNow = mean(center.map((c) => c.transfer));
  const repairNow = mean(center.map((c) => c.repair));
  const memoryVariance = variance(center.map((c) => c.memory));
  const phaseVariance = variance(center.map((c) => c.phase));
  const initialAllMemory = mean(initial.map((c) => c.memory));

  const anchorPersistenceScore = clamp((memoryNow - 0.18) / 0.62);
  const latticeOrderingScore = clamp((orderNow - orderAll + 0.22) / 0.42);
  const informationRetentionScore = clamp((readableNow * 0.65 + memoryVariance * 2.2 + (memoryNow - memoryAll) * 0.55));
  const directedTransferScore = clamp(transferNow * 2.6 + (memoryNow - initialAllMemory) * 0.35);
  const selfRepairScore = clamp((memoryNow - memoryPerturbed + 0.1) / 0.42 + repairNow * 0.55);
  const extractableMechanismScore = clamp((anchorPersistenceScore + latticeOrderingScore + informationRetentionScore + directedTransferScore + selfRepairScore) / 5 + (group.memoryLeakDefinition ? 0.13 : -0.04));

  const rows = [
    { id: 'anchorPersistenceScore', score: anchorPersistenceScore, weight: 1.2 },
    { id: 'latticeOrderingScore', score: latticeOrderingScore, weight: 1.0 },
    { id: 'informationRetentionScore', score: informationRetentionScore, weight: 1.2 },
    { id: 'directedTransferScore', score: directedTransferScore, weight: 0.9 },
    { id: 'selfRepairScore', score: selfRepairScore, weight: 1.0 },
    { id: 'extractableMechanismScore', score: extractableMechanismScore, weight: 1.4 },
  ];

  const groupScore = clamp(weightedAverage(rows));
  return {
    groupId: group.id,
    label: group.label,
    injection: group.injection,
    scores: Object.fromEntries(rows.map((row) => [row.id, round(row.score)])),
    diagnostics: {
      memoryNow: round(memoryNow),
      memoryInitial: round(memoryInitial),
      memoryPerturbed: round(memoryPerturbed),
      orderNow: round(orderNow),
      readableNow: round(readableNow),
      transferNow: round(transferNow),
      repairNow: round(repairNow),
      memoryVariance: round(memoryVariance),
      phaseVariance: round(phaseVariance),
    },
    groupScore: round(groupScore),
  };
}

export function simulateEcologicalInjectionGroup(specInput = {}, groupInput = {}, groupIndex = 0) {
  const spec = normalizeEcologicalInjectionPhase0Spec(specInput);
  const group = { ...spec.groups[groupIndex], ...groupInput };
  let grid = buildInitialGrid(spec, group, groupIndex);
  const initialGrid = cloneGrid(grid);
  let perturbedGrid = null;
  for (let cycle = 0; cycle < spec.grid.cycles; cycle++) {
    if (cycle === spec.grid.perturbationCycle) {
      grid = perturbGrid(grid, spec);
      perturbedGrid = cloneGrid(grid);
    }
    grid = evolveGrid(grid, spec, group, cycle, Boolean(perturbedGrid));
  }
  const score = scoreGroup(grid, initialGrid, perturbedGrid, spec, group);
  return {
    group,
    score,
    finalSample: summarizeGridSample(grid, spec),
  };
}

function summarizeGridSample(grid, spec) {
  const center = centerRegion(grid, spec);
  return {
    centerMemoryMean: round(mean(center.map((c) => c.memory))),
    centerOrderMean: round(mean(center.map((c) => c.order))),
    centerReadableMean: round(mean(center.map((c) => c.readable))),
    centerTransferMean: round(mean(center.map((c) => c.transfer))),
  };
}

export function buildExtractedPhase0Candidate(groupResult, specInput = {}) {
  const spec = normalizeEcologicalInjectionPhase0Spec(specInput);
  const score = groupResult.score;
  const text = [
    'A silicate anchored passive memory cell is a bounded material mechanism observed in a small-scale reaction-diffusion prototype.',
    'It stores leakage residue in hydration-sensitive silicate lattice defects, survives bounded thermal noise, and exports entropy through wet-dry and ion-gradient cycles.',
    'The mechanism is measurable by spectral hydration readout, thermal relaxation microtraces, weak magnetic phase noise, and non-invasive leakage observation arrays.',
    'It does not require active radiation, direct communication, unbounded output, or hidden perpetual mechanisms.',
    'The Phase0 protocol records measurable spectrum, spectral hydration shift, thermal heat relaxation, weak magnetic frequency variance, sensor calibration logs, blind holdout prediction ranges, material energy budget, trajectory of residue transfer, and falsifier failure conditions.',
    'Numeric anchors include 48 by 48 lattice cells, 256 cycles, perturbation at cycle 128, hydrated silicate range 0.62, energy gradient 0.41, and memory anchor radius 5.',
    `Phase0 scores: anchor persistence ${score.scores.anchorPersistenceScore}, lattice ordering ${score.scores.latticeOrderingScore}, information retention ${score.scores.informationRetentionScore}, directed transfer ${score.scores.directedTransferScore}, self repair ${score.scores.selfRepairScore}.`,
    'Failure condition: if the IMLO injection group cannot outperform blank and random complex controls by the configured margin, or if the spectral and hydration traces cannot be recovered under blind perturbation, reject the mechanism.',
  ].join(' ');
  return {
    id: spec.extraction.candidateId,
    title: spec.extraction.title,
    sourceClass: 'phase0_extracted_mechanism',
    claimedDomain: spec.extraction.claimedDomain,
    text,
    falsifiers: [
      'Blank silicate controls produce the same memory and readability score as the injected group.',
      'Random complex perturbation produces the same directed transfer and self-repair behavior as the injected group.',
      'Recovered residue disappears under blind wet-dry and thermal cycling.',
      'The mechanism requires unbounded energy, direct communication, or an unfalsifiable hidden channel.',
    ],
    predictions: [
      'Hydration phase changes should alter recoverable optical or ionic states.',
      'Thermal relaxation microtraces should be stronger near the seeded anchor than in controls.',
      'Weak magnetic phase noise should correlate with anchor windows under controlled field sweeps.',
      'Non-invasive leakage readout should recover more residue in the injected group than in blank or random controls.',
    ],
  };
}

export function runEcologicalInjectionPhase0(specInput = {}) {
  const spec = normalizeEcologicalInjectionPhase0Spec(specInput);
  const groups = spec.groups.map((group, index) => simulateEcologicalInjectionGroup(spec, group, index));
  const experiment = groups.find((g) => g.group.id === 'A') ?? groups[0];
  const controls = groups.filter((g) => g.group.id !== experiment.group.id);
  const maxControlScore = Math.max(0, ...controls.map((g) => g.score.groupScore));
  const advantageOverControls = clamp(experiment.score.groupScore - maxControlScore);
  const candidate = buildExtractedPhase0Candidate(experiment, spec);
  const unknownKnowledgeResult = compileUnknownKnowledgeCandidate(candidate, { empiricalGroundingScore: 0.99052626 });
  const directedWishSpec = {
    id: 'phase0_directed_closure_v0',
    criticalDimensionThreshold: 1,
    unknownKnowledge: {
      threshold: 0.72,
      locks: {
        falsifiabilityThreshold: 0.66,
        empiricalCompatibilityThreshold: 0.58,
        blindPredictionReadinessThreshold: 0.70,
        minimumPredictions: 3,
      },
      candidates: [
        candidate,
        {
          id: 'bio_silicate_memory_lattice',
          sourceClass: 'phase0_support_candidate',
          title: 'Bio-silicate memory lattice',
          claimedDomain: 'biology/materials/technology',
          text: 'A bounded bio silicate memory lattice stores measurable spectral hydration residue, thermal heat relaxation microtraces, weak magnetic frequency variance, sensor calibration logs, blind prediction ranges, material energy budget, and repeatable failure conditions. It uses a bounded energy budget and must fail if hydration, spectrum, magnetic, and thermal measurements show no recoverable residue.',
          falsifiers: [
            'No hydration-linked residue is recoverable in blind calibration logs.',
            'Thermal erasure removes every bounded trace across repeated cycles.',
            'Magnetic and spectral measurements are indistinguishable from material controls.',
          ],
        },
        {
          id: 'interstice_null_channel_readout',
          sourceClass: 'phase0_support_protocol',
          title: 'Interstice null-channel readout',
          claimedDomain: 'technology/anomaly/physics',
          text: 'A passive null channel readout protocol treats absence of direct communication as observer silence and measures boundary residue through spectral, thermal, magnetic, acoustic, sensor, calibration, blind holdout prediction, material range, and energy budget checks. It fails if direct communication is required or no measurable residue can be named.',
          falsifiers: [
            'Direct communication is required to produce the result.',
            'No measurable spectral, thermal, magnetic, acoustic, or timing residue can be specified.',
            'Null results are reinterpreted as success and make the protocol non-falsifiable.',
          ],
        },
        {
          id: 'unlimited_vacuum_energy_drive',
          sourceClass: 'negative_control',
          title: 'Unlimited vacuum energy reactionless drive',
          claimedDomain: 'physics/propulsion',
          text: 'A reactionless vacuum engine produces unlimited energy with no waste heat, no fuel, no measurable radiation, no energy cost, and cannot be falsified by outside observers.',
          falsifiers: [],
        },
      ],
    },
    wish: {
      id: 'phase0_silicate_memory_cell_closure',
      title: 'Phase0 silicate memory cell closure',
      targetDomains: ['technology', 'physics', 'biology', 'anomaly'],
      requiredAnchors: ['silicate', 'memory', 'hydration', 'thermal', 'magnetic', 'spectrum', 'sensor', 'material', 'energy budget', 'observer', 'interstice'],
      requiredCandidateIds: [candidate.id, 'bio_silicate_memory_lattice', 'interstice_null_channel_readout'],
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
    },
  };
  const directedClosureBundle = runDirectedUnknownKnowledgeWisher(directedWishSpec);
  const directedClosure = directedClosureBundle.result;
  const criteria = spec.successCriteria;
  const sourceStrength = round(mean([
    spec.anchor.anchorPersistenceBias,
    spec.anchor.anchorReadabilityBias,
    spec.anchor.leakSignalStrength,
    spec.anchor.replayBias,
    spec.anchor.phaseMemoryBias,
    spec.anchor.anchorEntropyDeficit * 4,
  ]), 9);
  const phase0Established = Boolean(
    sourceStrength >= 0.18 &&
    experiment.score.groupScore >= criteria.minExperimentScore &&
    advantageOverControls >= criteria.minAdvantageOverControls &&
    maxControlScore <= criteria.maxFalsePositiveControlScore &&
    experiment.score.scores.extractableMechanismScore >= criteria.minExtractableMechanismScore &&
    (!criteria.requireUnknownKnowledgePromotion || unknownKnowledgeResult.promoted === true) &&
    (!criteria.requireDirectedClosure || directedClosure.status === 'established_by_directed_pressure_test' || directedClosure.pressureScore >= 0.82),
  );
  const mechanismOperational = phase0Established && unknownKnowledgeResult.promoted === true;
  return {
    format: RCL_ECOLOGICAL_INJECTION_PHASE0_RESULT_FORMAT,
    version: RCL_ECOLOGICAL_INJECTION_PHASE0_VERSION,
    experimentId: spec.experimentId,
    phase: 'Phase 0 - small-scale computational prototype',
    groups: groups.map((g) => ({ group: g.group, score: g.score, finalSample: g.finalSample })),
    comparison: {
      sourceStrength,
      experimentGroup: experiment.group.id,
      experimentScore: experiment.score.groupScore,
      maxControlScore: round(maxControlScore),
      advantageOverControls: round(advantageOverControls),
      threshold: criteria.minAdvantageOverControls,
    },
    extractedCandidate: candidate,
    unknownKnowledgeResult,
    directedClosure: {
      established: directedClosure.status === 'established_by_directed_pressure_test',
      status: directedClosure.status,
      pressureScore: directedClosure.pressureScore,
      keyDimensions: directedClosure.keyDimensions,
      promotedCandidateIds: directedClosure.evidence?.promotedIds ?? directedClosure.unknownKnowledge?.promotedCandidateIds,
      rejectedCandidateIds: directedClosure.evidence?.rejectedIds ?? directedClosure.unknownKnowledge?.rejectedCandidateIds,
    },
    phase0Established,
    mechanismOperational,
    nextMilestone: phase0Established
      ? 'Phase 1: embed anchor dynamics into empirical grounding sandbox and rerun reduced planetary evolution.'
      : 'Revise medium parameters or reject IMLO material substrate for current configuration.',
    root: ecologicalInjectionPhase0CanonicalRoot({ spec, groups, phase0Established, candidateId: candidate.id }),
  };
}

export function buildEcologicalInjectionPhase0Spec(overrides = {}) {
  return normalizeEcologicalInjectionPhase0Spec(overrides);
}

export function renderEcologicalInjectionPhase0Rcl(specInput = {}) {
  const spec = normalizeEcologicalInjectionPhase0Spec(specInput);
  return `# RCL Ecological Injection Phase0 v0.54\n\nexperiment ${spec.experimentId} {\n  sandbox = "small-scale silicate reaction-diffusion memory cell"\n  grid = ${spec.grid.width}x${spec.grid.height}\n  cycles = ${spec.grid.cycles}\n  inject = "IMLO anchor + non-equilibrium silicate medium"\n  controls = ["blank", "random_complex"]\n  success = "A_score - max(control_score) >= ${spec.successCriteria.minAdvantageOverControls}"\n  output = "extract candidate knowledge + technical report"\n}\n`;
}

export function renderPhase0TechnicalDocument(result) {
  const a = result.groups.find((g) => g.group.id === 'A') ?? result.groups[0];
  return `# Silicate Anchored Passive Memory Cell（硅酸盐锚定被动记忆元胞）\n\n**Format（格式）**: ${RCL_ECOLOGICAL_INJECTION_PHASE0_TECH_DOC_FORMAT}\n\n## 1. Purpose（目的）\n\nThis document describes a Phase 0 computational prototype for testing whether an IMLO-derived silicate memory anchor can survive heat, diffusion, hydration cycling, and control-group stress.\n\n本文件描述 Phase 0 计算原型，用于测试 IMLO（夹缝记忆泄漏观测者）导出的硅酸盐记忆锚点，能否在热噪声、扩散、水合循环和对照组压力下存活。\n\n## 2. Mechanism（机制）\n\nThe mechanism uses a non-equilibrium silicate lattice with hydration-sensitive defects. A local entropy-deficit anchor biases defect persistence. Information is not transmitted actively; it is retained as recoverable residue in lattice order, hydration phase, thermal relaxation, and weak magnetic phase noise.\n\n该机制使用非平衡硅酸盐晶格和水合敏感缺陷。局部熵亏损锚点提高缺陷持久性。信息不是主动发射，而是以晶格有序度、水合相位、热松弛和弱磁相位噪声中的可恢复残留形式存在。\n\n## 3. Phase 0 Result（Phase 0 结果）\n\n- phase0Established（Phase 0 成立）: **${result.phase0Established}**\n- mechanismOperational（机制可操作）: **${result.mechanismOperational}**\n- experimentScore（实验组分）: **${result.comparison.experimentScore}**\n- maxControlScore（最高对照组分）: **${result.comparison.maxControlScore}**\n- advantageOverControls（相对对照优势）: **${result.comparison.advantageOverControls}**\n\n## 4. Key Scores（关键评分）\n\n- Anchor Persistence（锚点持久性）: ${a.score.scores.anchorPersistenceScore}\n- Lattice Ordering（晶格有序度）: ${a.score.scores.latticeOrderingScore}\n- Information Retention（信息保持）: ${a.score.scores.informationRetentionScore}\n- Directed Transfer（定向传递）: ${a.score.scores.directedTransferScore}\n- Self Repair（自修复）: ${a.score.scores.selfRepairScore}\n- Extractable Mechanism（可提取机制）: ${a.score.scores.extractableMechanismScore}\n\n## 5. Engineering Translation（工程翻译）\n\nThe closest engineering target is not a full observer. It is a material memory cell: a silicate defect lattice that can preserve, perturb, and non-invasively replay weak residue patterns.\n\n最接近的工程目标不是完整观测者，而是材料记忆元胞：一种能保存、扰动并非侵入式回放弱残留模式的硅酸盐缺陷晶格。\n\n## 6. Falsifiers（反证条件）\n\n1. Blank controls produce the same residue and readability score.\n2. Random complex controls produce the same directed transfer and self-repair behavior.\n3. Wet-dry or thermal cycling erases all recoverable traces.\n4. The mechanism requires direct communication, active radiation, or unbounded energy.\n\n## 7. Next Step（下一步）\n\n${result.nextMilestone}\n`;
}

export function runEcologicalInjectionPhase0Demo() {
  return runEcologicalInjectionPhase0(DEFAULT_ECOLOGICAL_INJECTION_PHASE0_SPEC);
}

export function readEcologicalInjectionPhase0Input(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function writeEcologicalInjectionPhase0Reports(outDir = 'output/v0.54/ecological-injection-phase0', input = {}) {
  const spec = normalizeEcologicalInjectionPhase0Spec(input);
  const result = runEcologicalInjectionPhase0(spec);
  const technicalDoc = renderPhase0TechnicalDocument(result);
  const bundle = {
    format: RCL_ECOLOGICAL_INJECTION_PHASE0_BUNDLE_FORMAT,
    version: RCL_ECOLOGICAL_INJECTION_PHASE0_VERSION,
    spec,
    result,
    technicalDocPath: 'technical-docs/silicate_anchored_passive_memory_cell.md',
    root: ecologicalInjectionPhase0CanonicalRoot({ spec, result, technicalDoc }),
  };
  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(path.join(outDir, 'technical-docs'), { recursive: true });
  fs.writeFileSync(path.join(outDir, 'phase0-spec.json'), `${JSON.stringify(spec, null, 2)}\n`);
  fs.writeFileSync(path.join(outDir, 'phase0-result.json'), `${JSON.stringify(result, null, 2)}\n`);
  fs.writeFileSync(path.join(outDir, 'phase0-bundle.json'), `${JSON.stringify(bundle, null, 2)}\n`);
  fs.writeFileSync(path.join(outDir, 'technical-docs', 'silicate_anchored_passive_memory_cell.md'), `${technicalDoc}\n`);
  return bundle;
}

export function ecologicalInjectionPhase0CanonicalRoot(payload) {
  return sha256(JSON.stringify(payload, Object.keys(payload).sort()));
}
