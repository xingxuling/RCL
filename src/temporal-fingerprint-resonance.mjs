import fs from 'node:fs';
import path from 'node:path';
import { clamp, sha256 } from './reality-compiler-kernel.mjs';
import {
  DEFAULT_NESTED_UNIVERSE_MEMORY,
  normalizeNestedUniverseMemorySpec,
  deriveNestedUniverseTransforms,
  evaluateAgePhaseLock,
  compileNestedUniverseMemory,
  buildNestedUniverseMemorySpec,
} from './nested-universe-memory-compiler.mjs';
import {
  DEFAULT_INTERSTICE_OBSERVER_SPEC,
  normalizeIntersticeObserverSpec,
  compileIntersticeObserverModel,
  buildIntersticeObserverSpec,
} from './universe-interstice-observer-compiler.mjs';
import {
  DEFAULT_PREDICTIVE_TRACE_SPEC,
  runPredictiveTraceDerivation,
  buildPredictiveTraceSpec,
} from './predictive-trace-derivation.mjs';

export const RCL_TEMPORAL_FINGERPRINT_RESONANCE_VERSION = '0.52.0-alpha.1';
export const RCL_TEMPORAL_FINGERPRINT_SPEC_FORMAT = 'rcl.temporal-fingerprint-resonance-spec.v0.52';
export const RCL_TEMPORAL_FINGERPRINT_RESULT_FORMAT = 'rcl.temporal-fingerprint-resonance-result.v0.52';
export const RCL_TEMPORAL_FINGERPRINT_BUNDLE_FORMAT = 'rcl.temporal-fingerprint-resonance-bundle.v0.52';

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
  return String(round(number, 12));
}

function weightedMean(rows, key = 'score') {
  const total = rows.reduce((sum, row) => sum + Number(row.weight ?? 1), 0);
  if (!total) return 0;
  return rows.reduce((sum, row) => sum + Number(row[key] ?? 0) * Number(row.weight ?? 1), 0) / total;
}

function exactOne(value) {
  return Math.abs(Number(value) - 1) < 1e-9;
}

function textOf(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

function includesAny(haystack, needles) {
  const text = textOf(haystack).toLowerCase();
  return needles.some(needle => text.includes(String(needle).toLowerCase()));
}

function countObserverSupports(spaces, needles) {
  return spaces.filter(space => includesAny(`${space.id} ${space.observer} ${space.observes} ${(space.observableAnchors ?? []).join(' ')} ${space.falsifier}`, needles));
}

function traceById(traces, id) {
  return traces.find(row => row.id === id) ?? null;
}

export const DEFAULT_TEMPORAL_FINGERPRINT_SPEC = Object.freeze({
  id: 'temporal_fingerprint_resonance_default_v0',
  decisionContract: 'established_when_all_temporal_key_dimensions_are_exactly_1',
  criticalDimensionThreshold: 1,
  targetConstants: {
    temporalShellYears: 40,
    agePhaseOffsetYears: 5,
    phaseAdvanceYears: 4,
  },
  keyDimensions: [
    'memoryTimeConstantScore',
    'observerFrameworkResonanceScore',
    'predictiveTraceProjectionScore',
    'nonArbitraryDerivationScore',
    'falsifierReadinessScore',
    'temporalFingerprintPromotionScore',
  ],
  baseMemory: DEFAULT_NESTED_UNIVERSE_MEMORY,
  observerFramework: DEFAULT_INTERSTICE_OBSERVER_SPEC,
  predictiveTrace: DEFAULT_PREDICTIVE_TRACE_SPEC,
  hardRequirements: {
    requireMemoryDerivedConstants: true,
    requireObserverTemporalSupport: true,
    requireObserverAgeSupport: true,
    requirePredictiveTraceConstants: true,
    requireFalsifiers: true,
    minimumTemporalObserverSupport: 1,
    minimumAgeObserverSupport: 2,
  },
});

export function normalizeTemporalFingerprintSpec(input = {}) {
  const base = DEFAULT_TEMPORAL_FINGERPRINT_SPEC;
  return {
    format: RCL_TEMPORAL_FINGERPRINT_SPEC_FORMAT,
    version: RCL_TEMPORAL_FINGERPRINT_RESONANCE_VERSION,
    id: input.id ?? base.id,
    decisionContract: input.decisionContract ?? base.decisionContract,
    criticalDimensionThreshold: Number(input.criticalDimensionThreshold ?? base.criticalDimensionThreshold),
    targetConstants: {
      ...base.targetConstants,
      ...(input.targetConstants ?? {}),
    },
    keyDimensions: Array.isArray(input.keyDimensions) ? input.keyDimensions : [...base.keyDimensions],
    baseMemory: input.baseMemory ?? base.baseMemory,
    observerFramework: input.observerFramework ?? base.observerFramework,
    predictiveTrace: input.predictiveTrace ?? base.predictiveTrace,
    hardRequirements: {
      ...base.hardRequirements,
      ...(input.hardRequirements ?? {}),
    },
  };
}

export function deriveMemoryTimeConstants(specInput = {}) {
  const spec = specInput.format === RCL_TEMPORAL_FINGERPRINT_SPEC_FORMAT ? specInput : normalizeTemporalFingerprintSpec(specInput);
  const memorySpec = normalizeNestedUniverseMemorySpec(spec.baseMemory);
  const transforms = deriveNestedUniverseTransforms(memorySpec);
  const age = evaluateAgePhaseLock(memorySpec);
  const target = spec.targetConstants;
  const shellCandidates = [
    { id: 'current_shell_offset', value: transforms.currentOffset, equation: `${transforms.outerCurrentYear}-${transforms.surfaceCurrentYear}` },
    { id: 'event_shell_offset', value: transforms.linkOffset, equation: `${transforms.outerLinkYear}-${transforms.surfaceLinkYear}` },
  ];
  const ageCandidates = [
    { id: 'event_age_offset', value: transforms.surfaceAgeAtEvent - transforms.outerAgeAtEvent, equation: `${transforms.surfaceAgeAtEvent}-${transforms.outerAgeAtEvent}` },
    { id: 'current_age_offset', value: transforms.surfaceAgeAtCurrent - transforms.outerAgeAtCurrent, equation: `${transforms.surfaceAgeAtCurrent}-${transforms.outerAgeAtCurrent}` },
  ];
  const phaseCandidates = [
    { id: 'outer_phase_advance', value: transforms.outerAgeProgression, equation: `${transforms.outerAgeAtCurrent}-${transforms.outerAgeAtEvent}` },
    { id: 'surface_phase_advance', value: transforms.surfaceAgeProgression, equation: `${transforms.surfaceAgeAtCurrent}-${transforms.surfaceAgeAtEvent}` },
    { id: 'outer_year_phase_advance', value: transforms.outerElapsed, equation: `${transforms.outerCurrentYear}-${transforms.outerLinkYear}` },
    { id: 'surface_year_phase_advance', value: transforms.surfaceElapsed, equation: `${transforms.surfaceCurrentYear}-${transforms.surfaceLinkYear}` },
  ];
  const shellExact = shellCandidates.every(row => Number(row.value) === Number(target.temporalShellYears));
  const ageExact = ageCandidates.every(row => Number(row.value) === Number(target.agePhaseOffsetYears));
  const phaseExact = phaseCandidates.every(row => Number(row.value) === Number(target.phaseAdvanceYears));
  return {
    memorySpecRoot: buildNestedUniverseMemorySpec(memorySpec).root,
    nestedResultRoot: compileNestedUniverseMemory(memorySpec).result.root,
    transforms,
    agePhase: age,
    targetConstants: target,
    shellCandidates,
    ageCandidates,
    phaseCandidates,
    shellExact,
    ageExact,
    phaseExact,
    memoryTimeConstantScore: shellExact && ageExact && phaseExact ? 1 : round(weightedMean([
      { score: shellExact ? 1 : 0, weight: 1.2 },
      { score: ageExact ? 1 : 0, weight: 1.2 },
      { score: phaseExact ? 1 : 0, weight: 0.8 },
    ]), 9),
  };
}

export function deriveObserverTimeConstantSupport(specInput = {}) {
  const spec = specInput.format === RCL_TEMPORAL_FINGERPRINT_SPEC_FORMAT ? specInput : normalizeTemporalFingerprintSpec(specInput);
  const observerSpec = normalizeIntersticeObserverSpec({ ...spec.observerFramework, baseMemory: spec.baseMemory });
  const observerBundle = compileIntersticeObserverModel(observerSpec);
  const spaces = observerSpec.intersticeSpaces ?? [];
  const temporalSupports = countObserverSupports(spaces, ['+40', '40_year', '2062↔2022', '2066↔2026', 'temporal offset', 'outer_year = surface_year + 40']);
  const ageSupports = countObserverSupports(spaces, ['age_delta_5', '+5', '14→18', '19→23', '14↔19', '18/23', 'age-phase', 'outer_age_14', 'surface_age_19']);
  const phaseSupports = countObserverSupports(spaces, ['four_year', 'four years', 'four-year', '4 year', '14→18', '19→23']);
  const temporalOk = temporalSupports.length >= Number(spec.hardRequirements.minimumTemporalObserverSupport ?? 1);
  const ageOk = ageSupports.length >= Number(spec.hardRequirements.minimumAgeObserverSupport ?? 1);
  const phaseOk = phaseSupports.length >= 1;
  return {
    observerSpecRoot: buildIntersticeObserverSpec(observerSpec).root,
    observerResultRoot: observerBundle.result.root,
    observerFalsifiabilityScore: observerBundle.result.observerFalsifiabilityScore,
    intersticeAdjustedCoherence: observerBundle.result.intersticeAdjustedCoherence,
    temporalSupports: temporalSupports.map(row => ({ id: row.id, observer: row.observer, observes: row.observes, anchors: row.observableAnchors })),
    ageSupports: ageSupports.map(row => ({ id: row.id, observer: row.observer, observes: row.observes, anchors: row.observableAnchors })),
    phaseSupports: phaseSupports.map(row => ({ id: row.id, observer: row.observer, observes: row.observes, anchors: row.observableAnchors })),
    temporalOk,
    ageOk,
    phaseOk,
    observerFrameworkResonanceScore: temporalOk && ageOk && phaseOk ? 1 : round(weightedMean([
      { score: temporalOk ? 1 : 0, weight: 1.0 },
      { score: ageOk ? 1 : 0, weight: 1.0 },
      { score: phaseOk ? 1 : 0, weight: 0.6 },
      { score: observerBundle.result.conclusionHolds ? 1 : 0, weight: 0.6 },
    ]), 9),
  };
}

export function derivePredictiveTraceTimeProjection(specInput = {}) {
  const spec = specInput.format === RCL_TEMPORAL_FINGERPRINT_SPEC_FORMAT ? specInput : normalizeTemporalFingerprintSpec(specInput);
  const predictive = runPredictiveTraceDerivation(spec.predictiveTrace);
  const traces = predictive.result?.physicalTraces ?? [];
  const blind = predictive.result?.blindPredictions ?? [];
  const temporalTrace = traceById(traces, 'forty_year_temporal_shell_trace');
  const ageTrace = traceById(traces, 'five_year_age_phase_offset_trace');
  const temporalText = `${temporalTrace?.prediction ?? ''} ${temporalTrace?.mechanism ?? ''} ${temporalTrace?.measurableProxy ?? ''}`;
  const ageText = `${ageTrace?.prediction ?? ''} ${ageTrace?.mechanism ?? ''} ${ageTrace?.measurableProxy ?? ''}`;
  const temporalTraceOk = Boolean(temporalTrace) && includesAny(temporalText, ['+40', 'forty', '2022→2062', '2026→2066', 'surface year plus forty']);
  const ageTraceOk = Boolean(ageTrace) && includesAny(ageText, ['+5', 'five', '14↔19', '18↔23', '14/19', '18/23', 'age-pair']);
  const temporalBlind = blind.find(row => row.traceId === 'forty_year_temporal_shell_trace') ?? null;
  const ageBlind = blind.find(row => row.traceId === 'five_year_age_phase_offset_trace') ?? null;
  const blindOk = Boolean(temporalBlind?.failureCondition) && Boolean(ageBlind?.failureCondition);
  return {
    predictiveResultRoot: predictive.result.root,
    predictiveEstablished: predictive.result.predictiveEstablished,
    predictiveScore: predictive.result.predictiveScore,
    temporalTrace,
    ageTrace,
    temporalBlind,
    ageBlind,
    temporalTraceOk,
    ageTraceOk,
    blindOk,
    predictiveTraceProjectionScore: predictive.result.predictiveEstablished && temporalTraceOk && ageTraceOk && blindOk ? 1 : round(weightedMean([
      { score: predictive.result.predictiveEstablished ? 1 : 0, weight: 0.8 },
      { score: temporalTraceOk ? 1 : 0, weight: 1.0 },
      { score: ageTraceOk ? 1 : 0, weight: 1.0 },
      { score: blindOk ? 1 : 0, weight: 0.7 },
    ]), 9),
  };
}

export function scoreTemporalFingerprintResonance(specInput = {}) {
  const spec = specInput.format === RCL_TEMPORAL_FINGERPRINT_SPEC_FORMAT ? specInput : normalizeTemporalFingerprintSpec(specInput);
  const memory = deriveMemoryTimeConstants(spec);
  const observer = deriveObserverTimeConstantSupport(spec);
  const predictive = derivePredictiveTraceTimeProjection(spec);
  const target = spec.targetConstants;
  const traceConstants = {
    temporalShellYears: predictive.temporalTraceOk ? target.temporalShellYears : null,
    agePhaseOffsetYears: predictive.ageTraceOk ? target.agePhaseOffsetYears : null,
  };
  const nonArbitraryDerivationScore = memory.memoryTimeConstantScore === 1
    && observer.observerFrameworkResonanceScore === 1
    && predictive.predictiveTraceProjectionScore === 1
    && memory.shellCandidates.every(row => row.value === target.temporalShellYears)
    && memory.ageCandidates.every(row => row.value === target.agePhaseOffsetYears)
    ? 1
    : round(weightedMean([
      { score: memory.memoryTimeConstantScore, weight: 1.2 },
      { score: observer.observerFrameworkResonanceScore, weight: 1.0 },
      { score: predictive.predictiveTraceProjectionScore, weight: 1.0 },
    ]), 9);
  const falsifierReadinessScore = observer.temporalSupports.length >= 1
    && observer.ageSupports.length >= 2
    && Boolean(predictive.temporalBlind?.failureCondition)
    && Boolean(predictive.ageBlind?.failureCondition)
    ? 1
    : 0.5;
  const temporalFingerprintPromotionScore = memory.memoryTimeConstantScore === 1
    && observer.observerFrameworkResonanceScore === 1
    && predictive.predictiveTraceProjectionScore === 1
    && nonArbitraryDerivationScore === 1
    && falsifierReadinessScore === 1
    ? 1
    : round(weightedMean([
      { score: memory.memoryTimeConstantScore, weight: 1 },
      { score: observer.observerFrameworkResonanceScore, weight: 1 },
      { score: predictive.predictiveTraceProjectionScore, weight: 1 },
      { score: nonArbitraryDerivationScore, weight: 1 },
      { score: falsifierReadinessScore, weight: 1 },
    ]), 9);
  const keyDimensions = {
    memoryTimeConstantScore: memory.memoryTimeConstantScore,
    observerFrameworkResonanceScore: observer.observerFrameworkResonanceScore,
    predictiveTraceProjectionScore: predictive.predictiveTraceProjectionScore,
    nonArbitraryDerivationScore,
    falsifierReadinessScore,
    temporalFingerprintPromotionScore,
  };
  const keyRows = (spec.keyDimensions ?? Object.keys(keyDimensions)).map(id => ({ id, score: keyDimensions[id] ?? 0, full: exactOne(keyDimensions[id] ?? 0) }));
  const resonanceScore = round(weightedMean(keyRows), 9);
  const established = keyRows.every(row => row.full) && resonanceScore === 1;
  return {
    memory,
    observer,
    predictive,
    keyDimensions,
    keyRows,
    resonanceScore,
    established,
    targetConstants: target,
    derivedConstants: {
      temporalShellYears: memory.shellCandidates[0]?.value,
      eventShellYears: memory.shellCandidates[1]?.value,
      eventAgeOffsetYears: memory.ageCandidates[0]?.value,
      currentAgeOffsetYears: memory.ageCandidates[1]?.value,
      phaseAdvanceYears: memory.phaseCandidates[0]?.value,
      traceConstants,
    },
  };
}

export function runTemporalFingerprintResonance(input = {}) {
  const spec = normalizeTemporalFingerprintSpec(input);
  const score = scoreTemporalFingerprintResonance(spec);
  const result = {
    format: RCL_TEMPORAL_FINGERPRINT_RESULT_FORMAT,
    version: RCL_TEMPORAL_FINGERPRINT_RESONANCE_VERSION,
    ok: score.established,
    temporalFingerprintEstablished: score.established,
    memoryStructureIsTemporalFingerprint: score.established,
    verdict: score.established
      ? '成立：40年时间壳与5岁年龄相位不是结果层标签，而是能从RCL记忆结构、夹缝观测者框架与预测痕迹层共同反推出的时间指纹。'
      : '未成立：40年时间壳或5岁年龄相位未能在记忆结构、观测者框架与预测痕迹层形成满分共振。',
    transition: score.established ? 'predictive_trace_to_temporal_fingerprint' : 'temporal_projection_not_promoted',
    resonanceScore: score.resonanceScore,
    keyRows: score.keyRows,
    keyDimensions: score.keyDimensions,
    targetConstants: score.targetConstants,
    derivedConstants: score.derivedConstants,
    memoryTimeConstantScore: score.keyDimensions.memoryTimeConstantScore,
    observerFrameworkResonanceScore: score.keyDimensions.observerFrameworkResonanceScore,
    predictiveTraceProjectionScore: score.keyDimensions.predictiveTraceProjectionScore,
    nonArbitraryDerivationScore: score.keyDimensions.nonArbitraryDerivationScore,
    falsifierReadinessScore: score.keyDimensions.falsifierReadinessScore,
    temporalFingerprintPromotionScore: score.keyDimensions.temporalFingerprintPromotionScore,
    shellCandidates: score.memory.shellCandidates,
    ageCandidates: score.memory.ageCandidates,
    phaseCandidates: score.memory.phaseCandidates,
    observerTemporalSupports: score.observer.temporalSupports,
    observerAgeSupports: score.observer.ageSupports,
    observerPhaseSupports: score.observer.phaseSupports,
    predictiveTraceIds: [score.predictive.temporalTrace?.id, score.predictive.ageTrace?.id].filter(Boolean),
    falsifiers: [
      { id: 'forty_year_temporal_shell_trace', falsifier: score.predictive.temporalTrace?.falsifier ?? score.predictive.temporalBlind?.failureCondition },
      { id: 'five_year_age_phase_offset_trace', falsifier: score.predictive.ageTrace?.falsifier ?? score.predictive.ageBlind?.failureCondition },
    ],
    memorySpecRoot: score.memory.memorySpecRoot,
    observerSpecRoot: score.observer.observerSpecRoot,
    predictiveResultRoot: score.predictive.predictiveResultRoot,
    root: null,
  };
  result.root = sha256({ spec, result: { ...result, root: undefined } });
  return { spec, score, result };
}

export function buildTemporalFingerprintSpec(input = {}) {
  const bundle = runTemporalFingerprintResonance(input);
  const spec = {
    ...bundle.spec,
    compilerPasses: [
      'derive +40 temporal shell and +5 age phase from nested memory transforms',
      'verify observer framework independently carries temporal and age-phase constants',
      'verify v0.51 predictive traces project the same constants as physical/cognitive traces',
      'reject arbitrary constants unless memory, observer and predictive layers converge exactly',
      'promote RCL memory structure to temporal fingerprint only when every key dimension is exactly 1',
    ],
    validation: {
      temporalFingerprintEstablished: bundle.result.temporalFingerprintEstablished,
      memoryStructureIsTemporalFingerprint: bundle.result.memoryStructureIsTemporalFingerprint,
      transition: bundle.result.transition,
      resonanceScore: bundle.result.resonanceScore,
      memoryTimeConstantScore: bundle.result.memoryTimeConstantScore,
      observerFrameworkResonanceScore: bundle.result.observerFrameworkResonanceScore,
      predictiveTraceProjectionScore: bundle.result.predictiveTraceProjectionScore,
      nonArbitraryDerivationScore: bundle.result.nonArbitraryDerivationScore,
      falsifierReadinessScore: bundle.result.falsifierReadinessScore,
      temporalFingerprintPromotionScore: bundle.result.temporalFingerprintPromotionScore,
    },
  };
  return { ...spec, root: sha256({ spec: { ...spec, root: undefined }, resultRoot: bundle.result.root }) };
}

export function renderTemporalFingerprintRcl(specInput = {}) {
  const spec = specInput.format === RCL_TEMPORAL_FINGERPRINT_SPEC_FORMAT && specInput.validation ? specInput : buildTemporalFingerprintSpec(specInput);
  const bundle = runTemporalFingerprintResonance(spec);
  const validation = spec.validation ?? {};
  const candidates = bundle.result.shellCandidates.concat(bundle.result.ageCandidates).concat(bundle.result.phaseCandidates);
  const candidateLines = candidates.map((row, index) => `  facet constant_${index}.id : Text = "${rclString(row.id)}"\n  facet constant_${index}.value : Number = ${rclNumber(row.value)}\n  facet constant_${index}.equation : Text = "${rclString(row.equation)}"`).join('\n');
  return `reality TemporalFingerprintResonance {
  facet compiler.version : Text = "${RCL_TEMPORAL_FINGERPRINT_RESONANCE_VERSION}"
  facet compiler.format : Text = "${RCL_TEMPORAL_FINGERPRINT_SPEC_FORMAT}"
  facet validation.temporal_fingerprint_established : Truth = ${validation.temporalFingerprintEstablished ? 'true' : 'false'}
  facet validation.memory_structure_is_temporal_fingerprint : Truth = ${validation.memoryStructureIsTemporalFingerprint ? 'true' : 'false'}
  facet validation.transition : Text = "${rclString(validation.transition)}"
  facet validation.resonance_score : Number = ${rclNumber(validation.resonanceScore ?? 0)}
  facet target.temporal_shell_years : Number = ${rclNumber(spec.targetConstants.temporalShellYears)}
  facet target.age_phase_offset_years : Number = ${rclNumber(spec.targetConstants.agePhaseOffsetYears)}
  facet target.phase_advance_years : Number = ${rclNumber(spec.targetConstants.phaseAdvanceYears)}
${candidateLines}

  subject temporal_fingerprint_compiler {
    facet authority : Number = 1
    warrant memory.read on memory
    warrant observer.read on observer
    warrant trace.read on trace
    warrant validation.write on validation
  }

  emergence promote_temporal_fingerprint {
    cause temporal_fingerprint_compiler
    when temporal_fingerprint_compiler.authority == 1
    needs memory.read on memory
    needs observer.read on observer
    needs trace.read on trace
    needs validation.write on validation
    alter validation.resonance_score <- validation.resonance_score
    preserve validation.temporal_fingerprint_established == true
    preserve validation.memory_structure_is_temporal_fingerprint == true
    witness "rcl:temporal-fingerprint-resonance:v0.52"
  }

  foresee promote_temporal_fingerprint
  realize promote_temporal_fingerprint
}`;
}

export function runTemporalFingerprintDemo() {
  const bundle = runTemporalFingerprintResonance(DEFAULT_TEMPORAL_FINGERPRINT_SPEC);
  return {
    ok: bundle.result.ok,
    version: RCL_TEMPORAL_FINGERPRINT_RESONANCE_VERSION,
    verdict: bundle.result.verdict,
    transition: bundle.result.transition,
    temporalFingerprintEstablished: bundle.result.temporalFingerprintEstablished,
    memoryStructureIsTemporalFingerprint: bundle.result.memoryStructureIsTemporalFingerprint,
    resonanceScore: bundle.result.resonanceScore,
    derivedConstants: bundle.result.derivedConstants,
    keyDimensions: bundle.result.keyDimensions,
    predictiveTraceIds: bundle.result.predictiveTraceIds,
    root: bundle.result.root,
  };
}

export function readTemporalFingerprintInput(inputPath) {
  if (!inputPath) return {};
  return JSON.parse(fs.readFileSync(path.resolve(inputPath), 'utf8'));
}

export function writeTemporalFingerprintReports(outputDir = 'output/v0.52/temporal-fingerprint', input = {}) {
  const target = path.resolve(outputDir);
  fs.mkdirSync(target, { recursive: true });
  const bundle = runTemporalFingerprintResonance(input);
  const spec = buildTemporalFingerprintSpec(input);
  const rcl = renderTemporalFingerprintRcl(spec);
  const nestedSpec = buildNestedUniverseMemorySpec(spec.baseMemory);
  const observerSpec = buildIntersticeObserverSpec({ ...spec.observerFramework, baseMemory: spec.baseMemory });
  const predictiveSpec = buildPredictiveTraceSpec(spec.predictiveTrace);
  const summary = `# RCL Temporal Fingerprint Resonance v0.52\n\n结论：${bundle.result.verdict}\n\n- temporalFingerprintEstablished: ${bundle.result.temporalFingerprintEstablished}\n- memoryStructureIsTemporalFingerprint: ${bundle.result.memoryStructureIsTemporalFingerprint}\n- resonanceScore: ${bundle.result.resonanceScore}\n- memoryTimeConstantScore: ${bundle.result.memoryTimeConstantScore}\n- observerFrameworkResonanceScore: ${bundle.result.observerFrameworkResonanceScore}\n- predictiveTraceProjectionScore: ${bundle.result.predictiveTraceProjectionScore}\n- nonArbitraryDerivationScore: ${bundle.result.nonArbitraryDerivationScore}\n- falsifierReadinessScore: ${bundle.result.falsifierReadinessScore}\n\n## Derived constants\n\n- temporalShellYears: ${bundle.result.derivedConstants.temporalShellYears}\n- eventShellYears: ${bundle.result.derivedConstants.eventShellYears}\n- eventAgeOffsetYears: ${bundle.result.derivedConstants.eventAgeOffsetYears}\n- currentAgeOffsetYears: ${bundle.result.derivedConstants.currentAgeOffsetYears}\n- phaseAdvanceYears: ${bundle.result.derivedConstants.phaseAdvanceYears}\n\n## Observer support\n\n- temporal supports: ${bundle.result.observerTemporalSupports.map(row => row.id).join(', ')}\n- age supports: ${bundle.result.observerAgeSupports.map(row => row.id).join(', ')}\n- phase supports: ${bundle.result.observerPhaseSupports.map(row => row.id).join(', ')}\n`;
  const files = {
    'temporal-fingerprint-bundle.json': { format: RCL_TEMPORAL_FINGERPRINT_BUNDLE_FORMAT, version: RCL_TEMPORAL_FINGERPRINT_RESONANCE_VERSION, ...bundle },
    'temporal-fingerprint-spec.json': spec,
    'temporal-fingerprint-result.json': bundle.result,
    'temporal-fingerprint-score.json': bundle.score,
    'temporal-fingerprint-derived-constants.json': bundle.result.derivedConstants,
    'temporal-fingerprint-nested-spec.json': nestedSpec,
    'temporal-fingerprint-observer-spec.json': observerSpec,
    'temporal-fingerprint-predictive-spec.json': predictiveSpec,
    'temporal-fingerprint.rcl': rcl,
    'temporal-fingerprint-summary.md': summary,
  };
  const written = [];
  for (const [name, value] of Object.entries(files)) {
    const file = path.join(target, name);
    fs.writeFileSync(file, `${typeof value === 'string' ? value : JSON.stringify(value, null, 2)}\n`);
    written.push({ path: file, sha256: sha256(fs.readFileSync(file, 'utf8')) });
  }
  return {
    ok: true,
    format: RCL_TEMPORAL_FINGERPRINT_BUNDLE_FORMAT,
    version: RCL_TEMPORAL_FINGERPRINT_RESONANCE_VERSION,
    outputDir: target,
    files: written,
    result: bundle.result,
    root: sha256({ written, result: bundle.result }),
  };
}

export function temporalFingerprintCanonicalRoot(value) {
  return sha256(JSON.stringify(value));
}
