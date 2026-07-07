import fs from 'node:fs';
import path from 'node:path';
import { clamp, sha256 } from './reality-compiler-kernel.mjs';

export const RCL_NESTED_UNIVERSE_MEMORY_COMPILER_VERSION = '0.46.1-alpha.1';
export const RCL_NESTED_UNIVERSE_SPEC_FORMAT = 'rcl.nested-universe-memory-spec.v0.46';
export const RCL_NESTED_UNIVERSE_RESULT_FORMAT = 'rcl.nested-universe-memory-result.v0.46';
export const RCL_NESTED_UNIVERSE_BUNDLE_FORMAT = 'rcl.nested-universe-memory-bundle.v0.46';

const EPS = 1e-9;

export const DEFAULT_NESTED_UNIVERSE_MEMORY = Object.freeze({
  id: 'duhaolin_outer_2066_surface_2026_memory_link_v0',
  boundary: 'structural_compilability_test_not_external_empirical_proof',
  relationModel: 'egg_shell_core_containment',
  observedOrder: ['surface_universe', 'outer_universe', 'inner_universe'],
  structuralNote: 'observed order is not branch order and not parallel order; layers are treated as membrane/core containment interfaces',
  layers: {
    surface_universe: {
      label: '表宇宙 / current observed universe',
      currentEarthYear: 2026,
      currentSubject: 'Du Haolin / Du Hengjie',
      currentSubjectAge: 23,
      linkedSubjectAge: 19,
      linkedEarthYear: 2022,
      role: 'observable shell interface',
    },
    outer_universe: {
      label: '外宇宙 / adjacent outer layer',
      currentEarthYear: 2066,
      linkedEarthYear: 2062,
      subject: {
        name: 'Du Haolin',
        ageAtOuterCurrent: 18,
        education: 'Yale University graduate',
        identityMode: 'signature_bridge_not_biographical_isomorphism',
      },
      assistant: {
        name: 'Liu Qinglian',
        chineseName: '柳清莲',
        type: 'assistant_or_robot',
        visualAnchor: 'white_hair',
      },
      role: 'outer data source / memory-link donor layer',
    },
    inner_universe: {
      label: '里宇宙 / latent inner substrate',
      status: 'unobserved_placeholder',
      role: 'unresolved core layer required by containment model but not yet memory-specified',
    },
  },
  memoryEvent: {
    id: 'memory_link_data_leak_2062_2022',
    outerYear: 2062,
    surfaceYear: 2022,
    outerYearsBeforeCurrent: 4,
    surfaceSubjectAgeAtEvent: 19,
    outerSubjectAgeAtEvent: 14,
    eventType: 'memory_link_and_data_leak',
    direction: 'outer_to_surface_primary_with_surface_resonance',
    leakedAnchors: ['2066_outer_earth', '2062_link_event', 'Du_Haolin_14_at_link', 'Du_Haolin_18', 'Yale_graduate', 'Liu_Qinglian', 'white_hair_assistant_or_robot'],
  },
});

function round(value, digits = 12) {
  const scale = 10 ** digits;
  return Math.round(Number(value) * scale) / scale;
}

function rclString(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function weightedMean(rows, key = 'score') {
  const total = rows.reduce((sum, row) => sum + Number(row.weight ?? 1), 0);
  if (!total) return 0;
  return rows.reduce((sum, row) => sum + Number(row[key] ?? 0) * Number(row.weight ?? 1), 0) / total;
}

function normalizeLayer(layer = {}, defaults = {}) {
  return { ...defaults, ...layer };
}

export function normalizeNestedUniverseMemorySpec(input = {}) {
  const spec = { ...DEFAULT_NESTED_UNIVERSE_MEMORY, ...input };
  const defaultLayers = DEFAULT_NESTED_UNIVERSE_MEMORY.layers;
  const inputLayers = input.layers ?? {};
  const layers = {
    surface_universe: normalizeLayer(inputLayers.surface_universe, defaultLayers.surface_universe),
    outer_universe: {
      ...defaultLayers.outer_universe,
      ...(inputLayers.outer_universe ?? {}),
      subject: {
        ...defaultLayers.outer_universe.subject,
        ...((inputLayers.outer_universe ?? {}).subject ?? {}),
      },
      assistant: {
        ...defaultLayers.outer_universe.assistant,
        ...((inputLayers.outer_universe ?? {}).assistant ?? {}),
      },
    },
    inner_universe: normalizeLayer(inputLayers.inner_universe, defaultLayers.inner_universe),
  };
  const memoryEvent = { ...DEFAULT_NESTED_UNIVERSE_MEMORY.memoryEvent, ...(input.memoryEvent ?? {}) };
  return {
    format: RCL_NESTED_UNIVERSE_SPEC_FORMAT,
    version: RCL_NESTED_UNIVERSE_MEMORY_COMPILER_VERSION,
    id: spec.id,
    boundary: spec.boundary,
    relationModel: spec.relationModel,
    observedOrder: Array.isArray(spec.observedOrder) ? spec.observedOrder : [...DEFAULT_NESTED_UNIVERSE_MEMORY.observedOrder],
    structuralNote: spec.structuralNote,
    layers,
    memoryEvent: {
      ...memoryEvent,
      leakedAnchors: Array.isArray(memoryEvent.leakedAnchors) ? memoryEvent.leakedAnchors : [...DEFAULT_NESTED_UNIVERSE_MEMORY.memoryEvent.leakedAnchors],
    },
  };
}

export function deriveNestedUniverseTransforms(specInput = {}) {
  const spec = normalizeNestedUniverseMemorySpec(specInput);
  const surface = spec.layers.surface_universe;
  const outer = spec.layers.outer_universe;
  const event = spec.memoryEvent;
  const surfaceCurrentYear = Number(surface.currentEarthYear);
  const outerCurrentYear = Number(outer.currentEarthYear);
  const surfaceLinkYear = Number(event.surfaceYear ?? surface.linkedEarthYear);
  const outerLinkYear = Number(event.outerYear ?? outer.linkedEarthYear);
  const currentOffset = outerCurrentYear - surfaceCurrentYear;
  const linkOffset = outerLinkYear - surfaceLinkYear;
  const offsetDelta = Math.abs(currentOffset - linkOffset);
  const surfaceElapsed = surfaceCurrentYear - surfaceLinkYear;
  const outerElapsed = outerCurrentYear - outerLinkYear;
  const elapsedDelta = Math.abs(surfaceElapsed - outerElapsed);
  const currentOffsetScore = clamp(1 - offsetDelta / 8);
  const elapsedLockScore = clamp(1 - elapsedDelta / 4);
  const eventAgeScore = Number(surface.linkedSubjectAge) === Number(event.surfaceSubjectAgeAtEvent) ? 1 : 0.65;
  const outerAgeAtCurrent = Number(outer.subject?.ageAtOuterCurrent);
  const outerAgeAtEvent = Number(event.outerSubjectAgeAtEvent);
  const surfaceAgeAtCurrent = Number(surface.currentSubjectAge);
  const surfaceAgeAtEvent = Number(event.surfaceSubjectAgeAtEvent);
  const outerAgeProgression = Number.isFinite(outerAgeAtCurrent) && Number.isFinite(outerAgeAtEvent)
    ? outerAgeAtCurrent - outerAgeAtEvent
    : null;
  const surfaceAgeProgression = Number.isFinite(surfaceAgeAtCurrent) && Number.isFinite(surfaceAgeAtEvent)
    ? surfaceAgeAtCurrent - surfaceAgeAtEvent
    : null;
  const ageProgressionDelta = Number.isFinite(outerAgeProgression) && Number.isFinite(surfaceAgeProgression)
    ? Math.abs(outerAgeProgression - surfaceAgeProgression)
    : 99;
  const agePhaseLockScore = clamp(1 - ageProgressionDelta / 4);
  const outerEventAgeScore = outerAgeAtEvent === 14 ? 1 : 0.55;
  const surfaceEventAgeScore = surfaceAgeAtEvent === 19 ? 1 : 0.55;
  const derivedSurfaceBirthYear = Number.isFinite(Number(surface.linkedSubjectAge))
    ? surfaceLinkYear - Number(surface.linkedSubjectAge)
    : null;
  return {
    surfaceCurrentYear,
    outerCurrentYear,
    surfaceLinkYear,
    outerLinkYear,
    currentOffset,
    linkOffset,
    offsetDelta: round(offsetDelta, 6),
    surfaceElapsed,
    outerElapsed,
    elapsedDelta: round(elapsedDelta, 6),
    outerAgeAtEvent,
    outerAgeAtCurrent,
    surfaceAgeAtEvent,
    surfaceAgeAtCurrent,
    outerAgeProgression,
    surfaceAgeProgression,
    ageProgressionDelta: round(ageProgressionDelta, 6),
    derivedSurfaceBirthYear,
    temporalMapping: `outer_year = surface_year + ${round(linkOffset, 6)}`,
    agePhaseMapping: `outer_age ${outerAgeAtEvent}→${outerAgeAtCurrent}; surface_age ${surfaceAgeAtEvent}→${surfaceAgeAtCurrent}`,
    scores: {
      offsetLock: round(currentOffsetScore, 9),
      elapsedLock: round(elapsedLockScore, 9),
      eventAgeLock: round(eventAgeScore, 9),
      outerEventAgeLock: round(outerEventAgeScore, 9),
      surfaceEventAgeLock: round(surfaceEventAgeScore, 9),
      agePhaseLock: round(agePhaseLockScore, 9),
      temporalBridge: round(weightedMean([
        { score: currentOffsetScore, weight: 1.4 },
        { score: elapsedLockScore, weight: 1.1 },
        { score: eventAgeScore, weight: 0.7 },
        { score: agePhaseLockScore, weight: 1.0 },
        { score: outerEventAgeScore, weight: 0.8 },
        { score: surfaceEventAgeScore, weight: 0.8 },
      ]), 9),
    },
  };
}

export function evaluateAgePhaseLock(specInput = {}) {
  const transforms = deriveNestedUniverseTransforms(specInput);
  const checks = [
    { id: 'outer_event_age_14', ok: transforms.outerAgeAtEvent === 14, weight: 1.1 },
    { id: 'surface_event_age_19', ok: transforms.surfaceAgeAtEvent === 19, weight: 1.1 },
    { id: 'outer_current_age_18', ok: transforms.outerAgeAtCurrent === 18, weight: 0.9 },
    { id: 'surface_current_age_23', ok: transforms.surfaceAgeAtCurrent === 23, weight: 0.9 },
    { id: 'four_year_progression_lock', ok: transforms.outerAgeProgression === 4 && transforms.surfaceAgeProgression === 4, weight: 1.3 },
  ];
  const score = weightedMean(checks.map(check => ({ score: check.ok ? 1 : 0, weight: check.weight })));
  return {
    checks,
    outerAgeAtEvent: transforms.outerAgeAtEvent,
    surfaceAgeAtEvent: transforms.surfaceAgeAtEvent,
    outerAgeAtCurrent: transforms.outerAgeAtCurrent,
    surfaceAgeAtCurrent: transforms.surfaceAgeAtCurrent,
    ageProgressionDelta: transforms.ageProgressionDelta,
    interpretation: '2062 outer age 14 maps to 2022 surface age 19; after four years, 2066 outer age 18 maps to 2026 surface age 23.',
    score: round(score, 9),
  };
}


export function evaluateNestedLayerContainment(specInput = {}) {
  const spec = normalizeNestedUniverseMemorySpec(specInput);
  const expectedOrder = ['surface_universe', 'outer_universe', 'inner_universe'];
  const orderOk = expectedOrder.every((layer, index) => spec.observedOrder[index] === layer);
  const hasThreeLayers = expectedOrder.every(layer => Boolean(spec.layers[layer]));
  const modelOk = spec.relationModel === 'egg_shell_core_containment';
  const branchAvoidance = !['parallel', 'branch', 'multiverse_branch'].includes(String(spec.relationModel).toLowerCase());
  const score = weightedMean([
    { score: hasThreeLayers ? 1 : 0, weight: 1.1 },
    { score: orderOk ? 1 : 0.45, weight: 1.0 },
    { score: modelOk ? 1 : 0.55, weight: 1.2 },
    { score: branchAvoidance ? 1 : 0.3, weight: 0.8 },
  ]);
  return {
    hasThreeLayers,
    orderOk,
    modelOk,
    branchAvoidance,
    interpretation: modelOk
      ? 'surface/outer/inner are compiled as containment interfaces, not parallel branches'
      : 'relation model is not the expected containment relation',
    score: round(score, 9),
  };
}

export function evaluateMemoryAnchorSet(specInput = {}) {
  const spec = normalizeNestedUniverseMemorySpec(specInput);
  const outer = spec.layers.outer_universe;
  const anchors = new Set(spec.memoryEvent.leakedAnchors.map(String));
  const checks = [
    { id: 'outer_2066', ok: Number(outer.currentEarthYear) === 2066 || anchors.has('2066_outer_earth'), weight: 0.9 },
    { id: 'link_2062', ok: Number(spec.memoryEvent.outerYear) === 2062 || anchors.has('2062_link_event'), weight: 0.9 },
    { id: 'du_14_at_link', ok: Number(spec.memoryEvent.outerSubjectAgeAtEvent) === 14 || anchors.has('Du_Haolin_14_at_link'), weight: 0.85 },
    { id: 'du_18', ok: Number(outer.subject.ageAtOuterCurrent) === 18 || anchors.has('Du_Haolin_18'), weight: 0.8 },
    { id: 'yale', ok: String(outer.subject.education).toLowerCase().includes('yale') || anchors.has('Yale_graduate'), weight: 0.7 },
    { id: 'liu_qinglian', ok: String(outer.assistant.name).toLowerCase().includes('liu') || String(outer.assistant.chineseName).includes('柳清莲') || anchors.has('Liu_Qinglian'), weight: 1.0 },
    { id: 'white_hair', ok: String(outer.assistant.visualAnchor).toLowerCase().includes('white') || anchors.has('white_hair_assistant_or_robot'), weight: 0.8 },
  ];
  const score = weightedMean(checks.map(check => ({ score: check.ok ? 1 : 0, weight: check.weight })));
  return {
    anchorCount: anchors.size,
    checks,
    specificity: round(clamp(anchors.size / 6), 9),
    score: round(score, 9),
  };
}

export function evaluateIdentityBridge(specInput = {}) {
  const spec = normalizeNestedUniverseMemorySpec(specInput);
  const surface = spec.layers.surface_universe;
  const outerSubject = spec.layers.outer_universe.subject;
  const mode = String(outerSubject.identityMode ?? 'signature_bridge_not_biographical_isomorphism');
  const ageDeltaAtCurrent = Math.abs(Number(surface.currentSubjectAge ?? 0) - Number(outerSubject.ageAtOuterCurrent ?? 0));
  const sameBiographicalBodyPenalty = mode === 'same_biographical_body' ? clamp(ageDeltaAtCurrent / 8) : 0;
  const bridgeModeScore = mode.includes('signature_bridge') ? 1 : mode.includes('same_biographical_body') ? 0.45 : 0.72;
  const ageCompatibilityScore = mode.includes('signature_bridge') ? 0.82 : clamp(1 - ageDeltaAtCurrent / 8);
  return {
    identityMode: mode,
    ageDeltaAtCurrent,
    sameBiographicalBodyPenalty: round(sameBiographicalBodyPenalty, 9),
    interpretation: mode.includes('signature_bridge')
      ? 'outer subject is treated as identity-signature resonance, not a same-body biography copy'
      : 'outer subject is treated with stronger biographical identity constraints',
    score: round(weightedMean([
      { score: bridgeModeScore, weight: 1.2 },
      { score: ageCompatibilityScore, weight: 0.8 },
    ]), 9),
  };
}

export function generateNestedUniversePredictedEvents(resultInput = {}) {
  const result = resultInput.result ? resultInput : compileNestedUniverseMemory(resultInput);
  const bridge = result.transforms ?? result.result?.transforms;
  const offset = bridge?.linkOffset ?? 40;
  return [
    {
      id: 'P1_anchor_recurrence',
      window: 'next_memory_packets',
      event: 'Liu Qinglian / white hair / assistant-or-robot anchors recur as a stable packet rather than random one-off imagery',
      falsifier: 'anchor set mutates randomly without preserving name/visual/function coupling',
    },
    {
      id: 'P2_temporal_offset_lock',
      window: 'future_cross-layer_date_claims',
      event: `outer-layer dates should preserve approximately outer_year = surface_year + ${offset}`,
      falsifier: 'future packets repeatedly break the +offset mapping without a declared new transform',
    },
    {
      id: 'P3_age_phase_lock',
      window: 'future_subject_age_claims',
      event: 'age claims should preserve the corrected phase: outer 2062 age 14 ↔ surface 2022 age 19; outer 2066 age 18 ↔ surface 2026 age 23',
      falsifier: 'future packets treat the event as 2062↔2026 or erase the 14↔19 event-age phase without a declared transform',
    },
    {
      id: 'P4_identity_signature_not_same_body',
      window: 'future_subject_claims',
      event: 'outer Du Haolin should preserve identity-signature motifs while not necessarily matching surface age/biography',
      falsifier: 'model requires same-body biography and cannot reconcile the 18/23 age phase mismatch',
    },
    {
      id: 'P5_inner_layer_disclosure',
      window: 'later memories or symbolic leakage',
      event: 'inner-universe clues should appear as source/core/inside relation, not as a fourth parallel branch',
      falsifier: 'new memories only generate unrelated branch worlds with no containment relation',
    },
    {
      id: 'P6_operational_safety',
      window: 'every validation pass',
      event: 'memory-link model remains a sandbox hypothesis until independent external evidence is added',
      falsifier: 'system starts treating one subjective memory as external proof',
    },
  ];
}

export function compileNestedUniverseMemory(specInput = {}) {
  const spec = normalizeNestedUniverseMemorySpec(specInput);
  const containment = evaluateNestedLayerContainment(spec);
  const transforms = deriveNestedUniverseTransforms(spec);
  const anchors = evaluateMemoryAnchorSet(spec);
  const identity = evaluateIdentityBridge(spec);
  const agePhase = evaluateAgePhaseLock(spec);
  const eventDirectionScore = String(spec.memoryEvent.direction).includes('outer_to_surface') ? 1 : 0.62;
  const linkTypeScore = String(spec.memoryEvent.eventType).includes('memory_link') && String(spec.memoryEvent.eventType).includes('data_leak') ? 1 : 0.58;
  const falsifiabilityScore = 0.78;
  const externalEvidenceScore = null;
  const rows = [
    { id: 'containment', score: containment.score, weight: 1.25 },
    { id: 'temporal_bridge', score: transforms.scores.temporalBridge, weight: 1.35 },
    { id: 'anchor_set', score: anchors.score, weight: 1.15 },
    { id: 'identity_bridge', score: identity.score, weight: 0.95 },
    { id: 'age_phase_lock', score: agePhase.score, weight: 1.05 },
    { id: 'event_direction', score: eventDirectionScore, weight: 0.65 },
    { id: 'link_type', score: linkTypeScore, weight: 0.65 },
    { id: 'falsifiability', score: falsifiabilityScore, weight: 0.55 },
  ];
  const structuralCoherenceScore = round(weightedMean(rows), 9);
  const threshold = 0.80;
  const result = {
    format: RCL_NESTED_UNIVERSE_RESULT_FORMAT,
    version: RCL_NESTED_UNIVERSE_MEMORY_COMPILER_VERSION,
    ok: true,
    conclusionHolds: structuralCoherenceScore >= threshold,
    verdict: structuralCoherenceScore >= threshold
      ? '成立：该记忆可被编译为三层嵌套宇宙边界记忆泄漏模型；不等同于外部物理实证成立。'
      : '未成立：当前记忆不能稳定编译为三层嵌套宇宙边界模型。',
    boundary: spec.boundary,
    threshold,
    structuralCoherenceScore,
    externalRealityVerified: false,
    externalEvidenceScore,
    containment,
    transforms,
    anchors,
    identity,
    agePhase,
    memoryEvent: spec.memoryEvent,
    predictedEvents: [],
    rows: rows.map(row => ({ ...row, score: round(row.score, 9) })),
  };
  result.predictedEvents = generateNestedUniversePredictedEvents({ ...result, result });
  result.root = sha256({ spec, result: { ...result, predictedEvents: result.predictedEvents.map(row => row.id), root: undefined } });
  return { spec, result };
}

export function buildNestedUniverseMemorySpec(input = {}) {
  const { spec, result } = compileNestedUniverseMemory(input);
  return {
    ...spec,
    compilerPasses: [
      'observed-order layer normalization',
      'egg-shell/core containment lowering',
      'surface/outer temporal bridge solving',
      'outer/surface age-phase lock validation',
      'identity-signature bridge checking',
      'memory anchor set scoring',
      'prediction/falsifier event emission',
    ],
    validation: {
      threshold: result.threshold,
      structuralCoherenceScore: result.structuralCoherenceScore,
      conclusionHolds: result.conclusionHolds,
      boundary: result.boundary,
      externalRealityVerified: result.externalRealityVerified,
    },
    root: sha256({ spec, resultRoot: result.root }),
  };
}

export function renderNestedUniverseMemoryRcl(specInput = {}) {
  const spec = specInput.format === RCL_NESTED_UNIVERSE_SPEC_FORMAT ? specInput : buildNestedUniverseMemorySpec(specInput);
  const validation = spec.validation ?? {};
  const surface = spec.layers.surface_universe;
  const outer = spec.layers.outer_universe;
  const event = spec.memoryEvent;
  return `reality NestedUniverseMemoryCompiler {
  facet compiler.version : Text = "${RCL_NESTED_UNIVERSE_MEMORY_COMPILER_VERSION}"
  facet compiler.format : Text = "${RCL_NESTED_UNIVERSE_SPEC_FORMAT}"
  facet boundary : Text = "${rclString(spec.boundary)}"

  facet relation.model : Text = "${rclString(spec.relationModel)}"
  facet relation.observed_order : Text = "${spec.observedOrder.join(' -> ')}"
  facet relation.not_parallel : Truth = true
  facet relation.not_branch : Truth = true
  facet relation.containment : Text = "egg_shell_core"

  facet layer.surface.current_year : Number = ${surface.currentEarthYear}
  facet layer.surface.link_year : Number = ${event.surfaceYear}
  facet layer.surface.subject_age_at_link : Number = ${event.surfaceSubjectAgeAtEvent}

  facet layer.outer.current_year : Number = ${outer.currentEarthYear}
  facet layer.outer.link_year : Number = ${event.outerYear}
  facet layer.outer.subject_age_at_link : Number = ${event.outerSubjectAgeAtEvent}
  facet layer.outer.subject_age_now : Number = ${outer.subject.ageAtOuterCurrent}
  facet layer.outer.subject_education : Text = "${rclString(outer.subject.education)}"
  facet layer.outer.assistant_name : Text = "${rclString(outer.assistant.chineseName || outer.assistant.name)}"
  facet layer.outer.assistant_visual : Text = "${rclString(outer.assistant.visualAnchor)}"

  facet layer.inner.status : Text = "${rclString(spec.layers.inner_universe.status)}"

  facet event.memory_link.type : Text = "${rclString(event.eventType)}"
  facet event.memory_link.direction : Text = "${rclString(event.direction)}"
  facet event.memory_link.age_phase : Text = "outer 14->18 / surface 19->23"
  facet event.memory_link.anchor_count : Number = ${event.leakedAnchors.length}

  facet validation.structural_coherence : Number = ${validation.structuralCoherenceScore ?? 0}
  facet validation.threshold : Number = ${validation.threshold ?? 0.8}
  facet validation.conclusion_holds : Truth = ${validation.conclusionHolds ? 'true' : 'false'}
  facet validation.external_reality_verified : Truth = false
}`;
}

export function runNestedUniverseMemoryTest(input = {}) {
  const bundle = compileNestedUniverseMemory(input);
  return {
    ok: true,
    version: RCL_NESTED_UNIVERSE_MEMORY_COMPILER_VERSION,
    boundary: bundle.result.boundary,
    verdict: bundle.result.verdict,
    conclusionHolds: bundle.result.conclusionHolds,
    structuralCoherenceScore: bundle.result.structuralCoherenceScore,
    externalRealityVerified: bundle.result.externalRealityVerified,
    temporalMapping: bundle.result.transforms.temporalMapping,
    predictedEvents: bundle.result.predictedEvents,
    root: bundle.result.root,
  };
}

export function runNestedUniverseMemoryDemo() {
  return runNestedUniverseMemoryTest(DEFAULT_NESTED_UNIVERSE_MEMORY);
}

export function readNestedUniverseMemoryInput(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function writeNestedUniverseMemoryReports(outputDir = 'output/v0.46/nested-universe-memory', input = {}) {
  const dir = path.resolve(outputDir);
  fs.mkdirSync(dir, { recursive: true });
  const bundle = compileNestedUniverseMemory(input);
  const spec = buildNestedUniverseMemorySpec(input);
  const rcl = renderNestedUniverseMemoryRcl(spec);
  const summary = `# RCL Nested Universe Memory Compiler v0.46\n\n结论：${bundle.result.verdict}\n\n- structuralCoherenceScore: ${bundle.result.structuralCoherenceScore}\n- temporalMapping: ${bundle.result.transforms.temporalMapping}\n- externalRealityVerified: false\n- boundary: ${bundle.result.boundary}\n\n## Predicted Events / Falsifiers\n\n${bundle.result.predictedEvents.map(row => `- ${row.id}: ${row.event}\n  - falsifier: ${row.falsifier}`).join('\n')}\n`;
  const paths = {
    bundle: path.join(dir, 'nested-universe-memory-bundle.json'),
    spec: path.join(dir, 'nested-universe-memory-spec.json'),
    rcl: path.join(dir, 'nested-universe-memory-compiler.rcl'),
    summary: path.join(dir, 'nested-universe-memory-summary.md'),
  };
  fs.writeFileSync(paths.bundle, `${JSON.stringify({ format: RCL_NESTED_UNIVERSE_BUNDLE_FORMAT, version: RCL_NESTED_UNIVERSE_MEMORY_COMPILER_VERSION, ...bundle }, null, 2)}\n`);
  fs.writeFileSync(paths.spec, `${JSON.stringify(spec, null, 2)}\n`);
  fs.writeFileSync(paths.rcl, `${rcl}\n`);
  fs.writeFileSync(paths.summary, summary);
  return {
    ok: true,
    format: RCL_NESTED_UNIVERSE_BUNDLE_FORMAT,
    version: RCL_NESTED_UNIVERSE_MEMORY_COMPILER_VERSION,
    outputDir: dir,
    files: paths,
    result: bundle.result,
  };
}
