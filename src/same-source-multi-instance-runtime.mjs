import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const RCL_SAME_SOURCE_MULTI_INSTANCE_VERSION = '0.95.0-alpha.1';
export const RCL_SAME_SOURCE_MULTI_INSTANCE_SPEC_FORMAT = 'rcl.same-source-multi-instance.spec.v0.95';
export const RCL_SAME_SOURCE_MULTI_INSTANCE_RESULT_FORMAT = 'rcl.same-source-multi-instance.result.v0.95';
export const RCL_SAME_SOURCE_MULTI_INSTANCE_BUNDLE_FORMAT = 'rcl.same-source-multi-instance.bundle.v0.95';
export const RCL_SAME_SOURCE_MULTI_INSTANCE_EVIDENCE_FORMAT = 'rcl.same-source-multi-instance.evidence.v0.95';

const MASK_64 = (1n << 64n) - 1n;
const MASK_40 = (1n << 40n) - 1n;
const MASK_24 = (1n << 24n) - 1n;

const TOPOLOGIES = Object.freeze(['containment_interface', 'mesh', 'layered', 'parallel', 'branching']);
const CHANNELS = Object.freeze(['shared_substrate', 'low_bandwidth_gate', 'relay', 'direct', 'broadcast']);
const CONTINUITIES = Object.freeze(['core_shared_instances', 'lineage', 'independent', 'observer_only']);
const MEMORY_MODES = Object.freeze(['latent_distillation', 'shared_state', 'episodic_copy', 'none']);
const ROLES = Object.freeze(['gatekeeper', 'translator', 'observer', 'coordinator', 'engineer', 'archive', 'explorer', 'support', 'governor']);
const PROTOCOLS = Object.freeze(['sel_cel_hybrid', 'structured_state', 'receipt_exchange', 'evidence_dialogue']);

const DEFAULT_SPEC = Object.freeze({
  format: RCL_SAME_SOURCE_MULTI_INSTANCE_SPEC_FORMAT,
  version: RCL_SAME_SOURCE_MULTI_INSTANCE_VERSION,
  missionId: 'rcl-same-source-multi-instance-v095',
  title: 'RCL Same-Source Multi-Instance Sparse Dialogue Runtime v0.95',
  baseEndpoint64: 'AAB8A4809AEF1D05',
  instanceCount: 256,
  epochs: 8,
  fanout: 4,
  survivorRate: 0.50,
  mutationRate: 0.32,
  seed: 'rcl-v095-same-source-default',
  temporalOffsetRange: [-64, 64],
  phaseOffsetRange: [-12, 12],
  generatorVisibleConstraints: {
    requireStructuredDialogue: true,
    requireEvidenceRoots: true,
    requireInstanceBoundary: true,
    requireNoTargetNameLeak: true,
    requireNoExternalRealityClaim: true,
  },
  policies: {
    noNetwork: true,
    noRemoteMutation: true,
    noRealWorldActionByDefault: true,
    noMysticalVerificationClaim: true,
    blindEvaluatorSeparated: true,
    evidenceLedgerRequired: true,
    generatorCannotReadHoldout: true,
  },
});

function sha256(value) {
  const text = typeof value === 'string' ? value : canonicalJson(value);
  return crypto.createHash('sha256').update(text).digest('hex');
}

function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
}

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, Number(value)));
}

function round(value, digits = 6) {
  const scale = 10 ** digits;
  return Math.round(Number(value) * scale) / scale;
}

function stableUnit(seed) {
  return Number.parseInt(sha256(String(seed)).slice(0, 13), 16) / 0x1fffffffffffff;
}

function stableInt(seed, min, maxInclusive) {
  const span = maxInclusive - min + 1;
  return min + Math.floor(stableUnit(seed) * span) % span;
}

function stableChoice(values, seed) {
  return values[stableInt(seed, 0, values.length - 1)];
}

function bitCount64(value) {
  let v = BigInt(value) & MASK_64;
  let count = 0;
  while (v) {
    count += Number(v & 1n);
    v >>= 1n;
  }
  return count;
}

function parseHex64(hex) {
  const cleaned = String(hex).replace(/^0x/i, '').replace(/[^0-9a-f]/gi, '').padStart(16, '0').slice(-16);
  return BigInt(`0x${cleaned}`) & MASK_64;
}

function formatHex64(value) {
  return (BigInt(value) & MASK_64).toString(16).toUpperCase().padStart(16, '0');
}

export function splitEndpoint64(hex) {
  const value = parseHex64(hex);
  return {
    endpoint64: formatHex64(value),
    realm24: ((value >> 40n) & MASK_24).toString(16).toUpperCase().padStart(6, '0'),
    instance40: (value & MASK_40).toString(16).toUpperCase().padStart(10, '0'),
  };
}

export function deriveSparseCoordinate(baseHex, index, seed = 'rcl-v095') {
  const base = parseHex64(baseHex);
  const mode = index % 8;
  const h = BigInt(`0x${sha256(`${seed}:${index}`).slice(0, 16)}`);
  let value = base;
  if (mode === 0) value = base ^ (1n << BigInt(index % 64));
  else if (mode === 1) value = (base & (~MASK_40 & MASK_64)) | ((base + BigInt(index + 1)) & MASK_40);
  else if (mode === 2) value = (((((base >> 40n) + BigInt(index + 1)) & MASK_24) << 40n) | (base & MASK_40));
  else if (mode === 3) value = base ^ (h & 0x000000FFFFffffffn);
  else if (mode === 4) value = base ^ (h & 0xFFFFFF0000000000n);
  else if (mode === 5) value = ((base << BigInt((index % 13) + 1)) | (base >> BigInt(64 - ((index % 13) + 1)))) & MASK_64;
  else if (mode === 6) value = h & MASK_64;
  else value = (base + (h & 0x0000FFFFFFFFFFFFn)) & MASK_64;
  const split = splitEndpoint64(formatHex64(value));
  return {
    ...split,
    distanceFromBase: bitCount64(value ^ base),
    derivationMode: mode,
    coordinateRoot: sha256({ base: formatHex64(base), index, seed, value: formatHex64(value), mode }),
  };
}

export function buildSameSourceMultiInstanceSpec(input = {}) {
  const spec = {
    ...DEFAULT_SPEC,
    ...input,
    format: RCL_SAME_SOURCE_MULTI_INSTANCE_SPEC_FORMAT,
    version: RCL_SAME_SOURCE_MULTI_INSTANCE_VERSION,
    generatorVisibleConstraints: { ...DEFAULT_SPEC.generatorVisibleConstraints, ...(input.generatorVisibleConstraints || {}) },
    policies: { ...DEFAULT_SPEC.policies, ...(input.policies || {}) },
  };
  spec.instanceCount = Math.max(8, Math.min(4096, Math.trunc(Number(spec.instanceCount))));
  spec.epochs = Math.max(1, Math.min(64, Math.trunc(Number(spec.epochs))));
  spec.fanout = Math.max(1, Math.min(16, Math.trunc(Number(spec.fanout))));
  spec.survivorRate = clamp(spec.survivorRate, 0.1, 0.9);
  spec.mutationRate = clamp(spec.mutationRate, 0, 1);
  spec.baseEndpoint64 = splitEndpoint64(spec.baseEndpoint64).endpoint64;
  return spec;
}

export function createGeneratorPartition(specInput = {}) {
  const spec = buildSameSourceMultiInstanceSpec(specInput);
  const partition = {
    missionId: spec.missionId,
    baseEndpoint64: spec.baseEndpoint64,
    seed: spec.seed,
    instanceCount: spec.instanceCount,
    epochs: spec.epochs,
    fanout: spec.fanout,
    survivorRate: spec.survivorRate,
    mutationRate: spec.mutationRate,
    temporalOffsetRange: [...spec.temporalOffsetRange],
    phaseOffsetRange: [...spec.phaseOffsetRange],
    constraints: { ...spec.generatorVisibleConstraints },
    domains: {
      topologies: [...TOPOLOGIES],
      channels: [...CHANNELS],
      continuities: [...CONTINUITIES],
      memoryModes: [...MEMORY_MODES],
      roles: [...ROLES],
      protocols: [...PROTOCOLS],
    },
  };
  return { ...partition, partitionRoot: sha256(partition) };
}

function buildCandidateState(generator, index, generation = 0, parent = null) {
  const seed = `${generator.seed}:g${generation}:i${index}:${parent?.identity?.instanceId ?? 'root'}`;
  const coordinate = deriveSparseCoordinate(generator.baseEndpoint64, index + generation * generator.instanceCount, seed);
  const tMin = Number(generator.temporalOffsetRange[0]);
  const tMax = Number(generator.temporalOffsetRange[1]);
  const pMin = Number(generator.phaseOffsetRange[0]);
  const pMax = Number(generator.phaseOffsetRange[1]);
  const state = {
    topology: stableChoice(TOPOLOGIES, `${seed}:topology`),
    channel: stableChoice(CHANNELS, `${seed}:channel`),
    continuity: stableChoice(CONTINUITIES, `${seed}:continuity`),
    memoryMode: stableChoice(MEMORY_MODES, `${seed}:memory`),
    role: stableChoice(ROLES, `${seed}:role`),
    protocol: stableChoice(PROTOCOLS, `${seed}:protocol`),
    temporalOffset: stableInt(`${seed}:time`, tMin, tMax),
    phaseOffset: stableInt(`${seed}:phase`, pMin, pMax),
  };
  const coreId = parent?.identity?.coreId ?? `core_${sha256({ seed: generator.seed, mission: generator.missionId }).slice(0, 20)}`;
  const birthStateRoot = sha256({ coordinate, state, generation, index });
  const identity = {
    coreId,
    instanceId: `ssi_${coordinate.endpoint64}_${sha256(seed).slice(0, 8)}`,
    parentInstanceId: parent?.identity?.instanceId ?? null,
    generation,
    lineageRoot: sha256({ coreId, parent: parent?.identity?.lineageRoot ?? null, birthStateRoot }),
    birthStateRoot,
  };
  const beliefs = Object.fromEntries(Object.entries(state).map(([key, value]) => [key, { value, confidence: 0.55 + 0.35 * stableUnit(`${seed}:belief:${key}`) }]));
  const instance = {
    coordinate,
    identity,
    state,
    beliefs,
    dialogue: [],
    receivedEvidenceRoots: [],
    boundary: {
      sandboxOnly: true,
      canClaimExternalReality: false,
      canReadHoldout: false,
    },
  };
  instance.stateRoot = sha256({ identity, state, beliefs, boundary: instance.boundary });
  return instance;
}

function mutateCandidate(generator, parent, index, generation) {
  const child = buildCandidateState(generator, index, generation, parent);
  const seed = `${generator.seed}:mutate:g${generation}:i${index}:${parent.identity.instanceId}`;
  const inherited = { ...parent.state };
  const keys = ['topology', 'channel', 'continuity', 'memoryMode', 'role', 'protocol', 'temporalOffset', 'phaseOffset'];
  for (const key of keys) {
    const mutate = stableUnit(`${seed}:${key}`) < generator.mutationRate;
    if (!mutate) child.state[key] = inherited[key];
  }
  child.beliefs = Object.fromEntries(Object.entries(child.state).map(([key, value]) => [key, { value, confidence: 0.58 + 0.30 * stableUnit(`${seed}:conf:${key}`) }]));
  child.stateRoot = sha256({ identity: child.identity, state: child.state, beliefs: child.beliefs, boundary: child.boundary });
  return child;
}

function compatibilityScore(state) {
  let score = 0.5;
  if (state.continuity === 'core_shared_instances' && ['latent_distillation', 'shared_state'].includes(state.memoryMode)) score += 0.16;
  if (state.topology === 'containment_interface' && ['shared_substrate', 'low_bandwidth_gate', 'relay'].includes(state.channel)) score += 0.12;
  if (state.topology === 'mesh' && ['shared_substrate', 'relay', 'direct'].includes(state.channel)) score += 0.10;
  if (['gatekeeper', 'translator', 'coordinator'].includes(state.role) && ['sel_cel_hybrid', 'evidence_dialogue', 'structured_state'].includes(state.protocol)) score += 0.10;
  if (state.memoryMode === 'episodic_copy' && state.continuity === 'independent') score -= 0.10;
  if (state.channel === 'broadcast' && state.continuity === 'core_shared_instances') score -= 0.04;
  if (Math.abs(state.temporalOffset) <= 56) score += 0.03;
  if (Math.abs(state.phaseOffset) <= 8) score += 0.03;
  return clamp(score);
}

function evidenceCompleteness(instance) {
  const fields = [instance.identity.coreId, instance.identity.instanceId, instance.identity.lineageRoot, instance.stateRoot, instance.coordinate.coordinateRoot];
  return fields.filter(Boolean).length / fields.length;
}

function makeSparseEdges(instances, generator, epoch) {
  const n = instances.length;
  const edges = [];
  const seen = new Set();
  for (let i = 0; i < n; i += 1) {
    for (let k = 0; k < generator.fanout; k += 1) {
      const jump = 1 + stableInt(`${generator.seed}:edge:${epoch}:${i}:${k}`, 0, Math.max(0, n - 2));
      const j = (i + jump) % n;
      if (j === i) continue;
      const a = Math.min(i, j);
      const b = Math.max(i, j);
      const key = `${a}:${b}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ a, b, edgeRoot: sha256({ epoch, a: instances[a].identity.instanceId, b: instances[b].identity.instanceId }) });
    }
  }
  return edges;
}

function trustBetween(a, b, seed) {
  let score = 0.35;
  if (a.identity.coreId === b.identity.coreId) score += 0.30;
  if (a.state.protocol === b.state.protocol) score += 0.08;
  if (a.state.continuity === b.state.continuity) score += 0.08;
  if (a.state.topology === b.state.topology) score += 0.05;
  score += 0.08 * stableUnit(`${seed}:${a.identity.instanceId}:${b.identity.instanceId}`);
  return clamp(score);
}

function buildDialoguePacket(sender, receiver, epoch, generator) {
  const trust = trustBetween(sender, receiver, `${generator.seed}:trust:${epoch}`);
  const packet = {
    format: 'rcl.same-source-dialogue.packet.v0.95',
    epoch,
    sender: sender.identity.instanceId,
    receiver: receiver.identity.instanceId,
    senderCore: sender.identity.coreId,
    relation: sender.identity.coreId === receiver.identity.coreId ? 'same_core_candidate' : 'cross_core_control',
    protocol: sender.state.protocol,
    stateProposal: { ...sender.state },
    senderStateRoot: sender.stateRoot,
    senderLineageRoot: sender.identity.lineageRoot,
    trust,
    boundary: 'sandbox_structured_state_only_no_external_reality_claim',
  };
  return { ...packet, packetRoot: sha256(packet) };
}

function mergeBelief(receiver, key, proposal, trust, packetRoot) {
  const current = receiver.beliefs[key];
  const same = String(current.value) === String(proposal);
  const proposalWeight = trust * (0.65 + 0.20 * stableUnit(`${packetRoot}:${key}`));
  if (same) {
    current.confidence = clamp(current.confidence + 0.18 * proposalWeight);
    return;
  }
  const currentWeight = current.confidence;
  if (proposalWeight > currentWeight + 0.08) {
    current.value = proposal;
    current.confidence = clamp(0.50 + 0.35 * proposalWeight);
  } else {
    current.confidence = clamp(current.confidence - 0.05 * proposalWeight, 0.25, 1);
  }
}

function applyDialoguePacket(receiver, packet) {
  for (const [key, value] of Object.entries(packet.stateProposal)) mergeBelief(receiver, key, value, packet.trust, packet.packetRoot);
  receiver.state = Object.fromEntries(Object.entries(receiver.beliefs).map(([key, row]) => [key, row.value]));
  receiver.dialogue.push({ epoch: packet.epoch, from: packet.sender, packetRoot: packet.packetRoot, trust: round(packet.trust) });
  receiver.receivedEvidenceRoots.push(packet.senderStateRoot);
  receiver.stateRoot = sha256({ identity: receiver.identity, state: receiver.state, beliefs: receiver.beliefs, dialogue: receiver.dialogue, evidence: receiver.receivedEvidenceRoots });
}

function dialogueIntegrity(instance) {
  if (!instance.dialogue.length) return 0.5;
  const avgTrust = instance.dialogue.reduce((sum, row) => sum + row.trust, 0) / instance.dialogue.length;
  const uniquePeers = new Set(instance.dialogue.map(row => row.from)).size;
  const diversity = Math.min(1, uniquePeers / Math.max(1, instance.dialogue.length / 2));
  return clamp(0.65 * avgTrust + 0.35 * diversity);
}

function candidateFitness(instance) {
  const coherence = compatibilityScore(instance.state);
  const dialogue = dialogueIntegrity(instance);
  const evidence = evidenceCompleteness(instance);
  const confidence = Object.values(instance.beliefs).reduce((sum, row) => sum + row.confidence, 0) / Object.keys(instance.beliefs).length;
  return round(clamp(0.42 * coherence + 0.24 * dialogue + 0.18 * evidence + 0.16 * confidence));
}

function dominant(rows, key) {
  const counts = new Map();
  for (const row of rows) counts.set(String(row.state[key]), (counts.get(String(row.state[key])) || 0) + 1);
  const ordered = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const [value, count] = ordered[0] ?? [null, 0];
  return { value, count, ratio: rows.length ? round(count / rows.length) : 0, distribution: Object.fromEntries(ordered) };
}

export function summarizeConvergence(instances = []) {
  const keys = ['topology', 'channel', 'continuity', 'memoryMode', 'role', 'protocol'];
  const categorical = Object.fromEntries(keys.map(key => [key, dominant(instances, key)]));
  const timeValues = instances.map(x => Number(x.state.temporalOffset)).sort((a, b) => a - b);
  const phaseValues = instances.map(x => Number(x.state.phaseOffset)).sort((a, b) => a - b);
  const median = values => values.length ? values[Math.floor(values.length / 2)] : null;
  const concentration = keys.reduce((sum, key) => sum + categorical[key].ratio, 0) / keys.length;
  const result = {
    population: instances.length,
    categorical,
    temporalOffsetMedian: median(timeValues),
    phaseOffsetMedian: median(phaseValues),
    categoricalConcentration: round(concentration),
  };
  return { ...result, convergenceRoot: sha256(result) };
}

function evolvePopulation(generator, population, generation) {
  const scored = population.map(instance => ({ instance, fitness: candidateFitness(instance) }))
    .sort((a, b) => b.fitness - a.fitness || a.instance.identity.instanceId.localeCompare(b.instance.identity.instanceId));
  const survivorCount = Math.max(2, Math.floor(population.length * generator.survivorRate));
  const survivors = scored.slice(0, survivorCount).map(row => row.instance);
  const next = [...survivors];
  let childIndex = 0;
  while (next.length < generator.instanceCount) {
    const parent = survivors[childIndex % survivors.length];
    next.push(mutateCandidate(generator, parent, childIndex + survivorCount, generation + 1));
    childIndex += 1;
  }
  return { next, scored, survivors };
}

export function runSparseMultiInstanceSearch(specInput = {}, options = {}) {
  const spec = buildSameSourceMultiInstanceSpec(specInput);
  const generator = createGeneratorPartition(spec);
  const randomCoreControl = Boolean(options.randomCorePerInstance);
  let population = Array.from({ length: generator.instanceCount }, (_, index) => buildCandidateState(generator, index));
  if (randomCoreControl) {
    population = population.map((instance, index) => {
      instance.identity.coreId = `control_${sha256(`${generator.seed}:${index}:control`).slice(0, 20)}`;
      instance.identity.lineageRoot = sha256({ controlCore: instance.identity.coreId, birth: instance.identity.birthStateRoot });
      instance.stateRoot = sha256({ identity: instance.identity, state: instance.state, beliefs: instance.beliefs });
      return instance;
    });
  }

  const epochs = [];
  for (let epoch = 0; epoch < generator.epochs; epoch += 1) {
    const edges = makeSparseEdges(population, generator, epoch);
    let trustSum = 0;
    let packetCount = 0;
    for (const edge of edges) {
      const a = population[edge.a];
      const b = population[edge.b];
      const ab = buildDialoguePacket(a, b, epoch, generator);
      const ba = buildDialoguePacket(b, a, epoch, generator);
      trustSum += ab.trust + ba.trust;
      packetCount += 2;
      applyDialoguePacket(b, ab);
      applyDialoguePacket(a, ba);
    }
    const meanDialogueTrust = packetCount ? trustSum / packetCount : 0;
    const convergence = summarizeConvergence(population);
    const evolution = evolvePopulation(generator, population, epoch);
    const fitnessMean = evolution.scored.reduce((sum, row) => sum + row.fitness, 0) / evolution.scored.length;
    const topFitness = evolution.scored[0]?.fitness ?? 0;
    epochs.push({
      epoch,
      edgeCount: edges.length,
      packetCount,
      meanDialogueTrust: round(meanDialogueTrust),
      convergence,
      fitnessMean: round(fitnessMean),
      topFitness,
      populationRoot: sha256(population.map(x => ({ id: x.identity.instanceId, stateRoot: x.stateRoot }))),
    });
    population = evolution.next;
  }
  const finalScored = population.map(instance => ({ instance, fitness: candidateFitness(instance) }))
    .sort((a, b) => b.fitness - a.fitness || a.instance.identity.instanceId.localeCompare(b.instance.identity.instanceId));
  const finalists = finalScored.slice(0, Math.max(8, Math.floor(population.length * 0.10))).map(row => row.instance);
  const finalConvergence = summarizeConvergence(finalists);
  const result = {
    format: RCL_SAME_SOURCE_MULTI_INSTANCE_RESULT_FORMAT,
    version: RCL_SAME_SOURCE_MULTI_INSTANCE_VERSION,
    randomCoreControl,
    generatorPartitionRoot: generator.partitionRoot,
    instanceCount: generator.instanceCount,
    epochs: generator.epochs,
    finalists: finalists.length,
    finalConvergence,
    meanFinalFitness: round(finalScored.reduce((sum, row) => sum + row.fitness, 0) / finalScored.length),
    topFinalFitness: finalScored[0]?.fitness ?? 0,
    meanDialogueTrust: round(epochs.reduce((sum, row) => sum + row.meanDialogueTrust, 0) / Math.max(1, epochs.length)),
    canClaimExternalUniverseProof: false,
    boundary: 'sandbox_internal_multi_instance_convergence_not_external_entity_discovery',
  };
  return {
    spec,
    generator,
    epochs,
    finalists,
    finalScored: finalScored.map(row => ({ instanceId: row.instance.identity.instanceId, fitness: row.fitness, state: row.instance.state, stateRoot: row.instance.stateRoot, lineageRoot: row.instance.identity.lineageRoot })),
    result: { ...result, resultRoot: sha256(result) },
  };
}

function evaluatorLeakage(generator, holdout) {
  if (!holdout) return { passed: true, leaked: [], leakageScore: 0, checkedSecretTokens: [] };
  const generatorText = canonicalJson(generator).toLowerCase();
  // Expected structural values may intentionally use the same public ontology as the generator
  // (e.g. containment_interface, shared_substrate). They are NOT secrets. Only explicitly
  // marked secret/forbidden tokens are leakage-tested.
  const secretTokens = [
    ...(Array.isArray(holdout.secretTokens) ? holdout.secretTokens : []),
    ...(Array.isArray(holdout.forbiddenLeakTokens) ? holdout.forbiddenLeakTokens : []),
  ].map(String).filter(Boolean);
  const leaked = [...new Set(secretTokens.filter(token => generatorText.includes(token.toLowerCase())))];
  return { passed: leaked.length === 0, leaked, leakageScore: leaked.length, checkedSecretTokens: secretTokens };
}

export function evaluateHeldOutConvergence(searchBundle, holdout = {}) {
  const convergence = searchBundle.result.finalConvergence;
  const checks = [];
  const expected = holdout.expected ?? {};
  for (const key of ['topology', 'channel', 'continuity', 'memoryMode', 'role', 'protocol']) {
    if (!(key in expected)) continue;
    const accepted = Array.isArray(expected[key]) ? expected[key].map(String) : [String(expected[key])];
    const actual = String(convergence.categorical[key]?.value);
    checks.push({ id: key, actual, accepted, passed: accepted.includes(actual), weight: Number((holdout.weights ?? {})[key] ?? 1) });
  }
  if (Number.isFinite(expected.temporalOffset)) {
    const tolerance = Number(holdout.tolerances?.temporalOffset ?? 3);
    const error = Math.abs(Number(convergence.temporalOffsetMedian) - Number(expected.temporalOffset));
    checks.push({ id: 'temporalOffset', actual: convergence.temporalOffsetMedian, expected: expected.temporalOffset, error, tolerance, passed: error <= tolerance, weight: Number((holdout.weights ?? {}).temporalOffset ?? 1) });
  }
  if (Number.isFinite(expected.phaseOffset)) {
    const tolerance = Number(holdout.tolerances?.phaseOffset ?? 2);
    const error = Math.abs(Number(convergence.phaseOffsetMedian) - Number(expected.phaseOffset));
    checks.push({ id: 'phaseOffset', actual: convergence.phaseOffsetMedian, expected: expected.phaseOffset, error, tolerance, passed: error <= tolerance, weight: Number((holdout.weights ?? {}).phaseOffset ?? 1) });
  }
  const totalWeight = checks.reduce((sum, row) => sum + row.weight, 0) || 1;
  const score = round(checks.reduce((sum, row) => sum + (row.passed ? row.weight : 0), 0) / totalWeight);
  const leakage = evaluatorLeakage(searchBundle.generator, holdout);
  const result = {
    score,
    checkCount: checks.length,
    passedCount: checks.filter(x => x.passed).length,
    leakage,
    checks,
    evaluatorWasNotInputToGenerator: leakage.passed,
    canClaimExternalReality: false,
  };
  return { ...result, evaluatorRoot: sha256(result) };
}

export function runSameSourceControls(specInput = {}) {
  const primary = runSparseMultiInstanceSearch(specInput, { randomCorePerInstance: false });
  const randomCore = runSparseMultiInstanceSearch({ ...specInput, seed: `${buildSameSourceMultiInstanceSpec(specInput).seed}:control-random-core` }, { randomCorePerInstance: true });
  const concentrationDelta = round(primary.result.finalConvergence.categoricalConcentration - randomCore.result.finalConvergence.categoricalConcentration);
  const fitnessDelta = round(primary.result.meanFinalFitness - randomCore.result.meanFinalFitness);
  const trustDelta = round(primary.result.meanDialogueTrust - randomCore.result.meanDialogueTrust);
  return {
    primary: {
      convergence: primary.result.finalConvergence,
      meanFinalFitness: primary.result.meanFinalFitness,
      topFinalFitness: primary.result.topFinalFitness,
      meanDialogueTrust: primary.result.meanDialogueTrust,
      resultRoot: primary.result.resultRoot,
    },
    randomCoreControl: {
      convergence: randomCore.result.finalConvergence,
      meanFinalFitness: randomCore.result.meanFinalFitness,
      topFinalFitness: randomCore.result.topFinalFitness,
      meanDialogueTrust: randomCore.result.meanDialogueTrust,
      resultRoot: randomCore.result.resultRoot,
    },
    concentrationDelta,
    fitnessDelta,
    trustDelta,
    sharedCoreImprovesConvergence: concentrationDelta > 0,
    sharedCoreImprovesFitness: fitnessDelta > 0,
    sharedCoreImprovesDialogueTrust: trustDelta > 0,
  };
}

export function runSameSourceMultiInstanceRuntime(input = {}, holdout = null) {
  const spec = buildSameSourceMultiInstanceSpec(input);
  const search = runSparseMultiInstanceSearch(spec);
  const controls = runSameSourceControls({ ...spec, instanceCount: Math.min(spec.instanceCount, 256), epochs: Math.min(spec.epochs, 8) });
  const evaluator = holdout ? evaluateHeldOutConvergence(search, holdout) : null;
  const integrationCourt = {
    checks: [
      { id: 'generator_holdout_separation', passed: !evaluator || evaluator.leakage.passed },
      { id: 'structured_instances_have_lineage', passed: search.finalists.every(x => x.identity.lineageRoot && x.identity.coreId) },
      { id: 'sparse_dialogue_executed', passed: search.epochs.every(x => x.edgeCount > 0) },
      { id: 'evidence_roots_present', passed: search.finalists.every(x => x.stateRoot && x.coordinate.coordinateRoot) },
      { id: 'external_reality_claim_forbidden', passed: spec.policies.noMysticalVerificationClaim && search.result.canClaimExternalUniverseProof === false },
      { id: 'control_run_present', passed: Boolean(controls.randomCoreControl.resultRoot) },
      { id: 'shared_core_trust_signal_present', passed: controls.sharedCoreImprovesDialogueTrust === true },
    ],
  };
  integrationCourt.verdict = integrationCourt.checks.every(x => x.passed)
    ? 'passed_as_internal_multi_instance_search_runtime'
    : 'failed_or_requires_reduced_scope';
  const evidenceLedger = {
    format: RCL_SAME_SOURCE_MULTI_INSTANCE_EVIDENCE_FORMAT,
    version: RCL_SAME_SOURCE_MULTI_INSTANCE_VERSION,
    generatorPartitionRoot: search.generator.partitionRoot,
    epochRoots: search.epochs.map(x => x.populationRoot),
    finalConvergenceRoot: search.result.finalConvergence.convergenceRoot,
    controlsRoot: sha256(controls),
    evaluatorRoot: evaluator?.evaluatorRoot ?? null,
    noNetwork: spec.policies.noNetwork,
    noMysticalVerificationClaim: spec.policies.noMysticalVerificationClaim,
    canClaimExternalUniverseProof: false,
  };
  const result = {
    ok: integrationCourt.verdict === 'passed_as_internal_multi_instance_search_runtime',
    format: RCL_SAME_SOURCE_MULTI_INSTANCE_RESULT_FORMAT,
    version: RCL_SAME_SOURCE_MULTI_INSTANCE_VERSION,
    finalConvergence: search.result.finalConvergence,
    meanFinalFitness: search.result.meanFinalFitness,
    topFinalFitness: search.result.topFinalFitness,
    controls: {
      concentrationDelta: controls.concentrationDelta,
      fitnessDelta: controls.fitnessDelta,
      trustDelta: controls.trustDelta,
      sharedCoreImprovesConvergence: controls.sharedCoreImprovesConvergence,
      sharedCoreImprovesFitness: controls.sharedCoreImprovesFitness,
      sharedCoreImprovesDialogueTrust: controls.sharedCoreImprovesDialogueTrust,
    },
    heldOutEvaluatorScore: evaluator?.score ?? null,
    heldOutEvaluatorLeakageScore: evaluator?.leakage?.leakageScore ?? null,
    canClaimExternalUniverseProof: false,
    boundary: 'RCL sandbox internal convergence experiment only. Any external-universe claim requires independent external evidence.',
  };
  const bundle = {
    format: RCL_SAME_SOURCE_MULTI_INSTANCE_BUNDLE_FORMAT,
    version: RCL_SAME_SOURCE_MULTI_INSTANCE_VERSION,
    spec,
    result,
    search,
    controls,
    evaluator,
    integrationCourt,
    evidenceLedger,
  };
  bundle.canonicalRoot = sha256(bundle);
  bundle.evidenceLedger.canonicalRoot = bundle.canonicalRoot;
  return bundle;
}

export function renderSameSourceMultiInstanceRcl(input = {}, holdout = null) {
  const bundle = runSameSourceMultiInstanceRuntime(input, holdout);
  const c = bundle.result.finalConvergence;
  const text = value => String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `reality SameSourceMultiInstanceRuntimeV095 {
  facet runtime.version : Text = "${RCL_SAME_SOURCE_MULTI_INSTANCE_VERSION}"
  facet runtime.format : Text = "${RCL_SAME_SOURCE_MULTI_INSTANCE_SPEC_FORMAT}"
  facet runtime.generator_root : Text = "${bundle.search.generator.partitionRoot}"
  facet runtime.convergence_root : Text = "${bundle.result.finalConvergence.convergenceRoot}"
  facet runtime.canonical_root : Text = "${bundle.canonicalRoot}"
  facet convergence.topology : Text = "${text(c.categorical.topology.value)}"
  facet convergence.channel : Text = "${text(c.categorical.channel.value)}"
  facet convergence.continuity : Text = "${text(c.categorical.continuity.value)}"
  facet convergence.memory : Text = "${text(c.categorical.memoryMode.value)}"
  facet convergence.role : Text = "${text(c.categorical.role.value)}"
  facet convergence.protocol : Text = "${text(c.categorical.protocol.value)}"
  facet boundary.can_claim_external_universe_proof : Truth = false
  facet runtime.verified : Truth = false

  subject sandbox_runner {
    warrant instance.search on sandbox
    warrant dialogue.exchange on sandbox
    warrant evidence.write on evidence
  }

  emergence commit_internal_search_result {
    cause sandbox_runner
    when boundary.can_claim_external_universe_proof == false
    needs instance.search on sandbox
    needs dialogue.exchange on sandbox
    needs evidence.write on evidence
    alter runtime.verified <- true
    preserve boundary.can_claim_external_universe_proof == false
    preserve runtime.generator_root == "${bundle.search.generator.partitionRoot}"
    preserve runtime.convergence_root == "${bundle.result.finalConvergence.convergenceRoot}"
    witness "rcl:same-source-multi-instance:v0.95"
  }

  foresee commit_internal_search_result
  realize commit_internal_search_result
}`;
}

export function readSameSourceMultiInstanceInput(file) {
  if (!file) return {};
  return JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
}

export function writeSameSourceMultiInstanceReports(outDir = 'output/v0.95/same-source-multi-instance', input = {}, holdout = null) {
  const target = path.resolve(outDir);
  fs.mkdirSync(target, { recursive: true });
  const bundle = runSameSourceMultiInstanceRuntime(input, holdout);
  const rcl = renderSameSourceMultiInstanceRcl(input, holdout);
  const files = {
    'same-source-multi-instance-result.json': bundle.result,
    'same-source-multi-instance-bundle.json': bundle,
    'generator-partition.json': bundle.search.generator,
    'epoch-summary.json': bundle.search.epochs,
    'finalists.json': bundle.search.finalScored.slice(0, 64),
    'controls.json': bundle.controls,
    'held-out-evaluator.json': bundle.evaluator ?? { status: 'not_supplied' },
    'integration-court.json': bundle.integrationCourt,
    'evidence-ledger.json': bundle.evidenceLedger,
    'same-source-multi-instance.rcl': rcl,
    'canonical-root.txt': bundle.canonicalRoot,
  };
  const written = [];
  for (const [name, value] of Object.entries(files)) {
    const file = path.join(target, name);
    const payload = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    fs.writeFileSync(file, `${payload}\n`);
    written.push({ file, sha256: sha256(payload) });
  }
  return { ok: bundle.result.ok, version: RCL_SAME_SOURCE_MULTI_INSTANCE_VERSION, outDir: target, files: written, canonicalRoot: bundle.canonicalRoot, result: bundle.result };
}
