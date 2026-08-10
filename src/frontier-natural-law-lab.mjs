import fs from 'node:fs';
import path from 'node:path';
import { sha256, clamp, runRealityCompilerSandbox } from './reality-compiler-kernel.mjs';
import { runEsotericMechanismCompiler } from './esoteric-mechanism-compiler.mjs';
import {
  DEFAULT_EXPERIMENT_DESIGN_SPEC,
  runExperimentDesignSynthesizer,
  renderExperimentTechnicalDocument,
} from './experiment-design-synthesizer.mjs';
import { runMechanismToPrototypeGenerator } from './mechanism-to-prototype-generator.mjs';
import { runFrontierNaturalLawCalibrationBenchmark } from './frontier-natural-law-calibration-benchmark.mjs';

export const RCL_FRONTIER_NATURAL_LAW_LAB_VERSION = '0.1.0-alpha.1';
export const RCL_FRONTIER_NATURAL_LAW_LAB_SPEC_FORMAT = 'rcl.frontier-natural-law-lab-spec.v0.1';
export const RCL_FRONTIER_NATURAL_LAW_LAB_RESULT_FORMAT = 'rcl.frontier-natural-law-lab-result.v0.1';
export const RCL_FRONTIER_NATURAL_LAW_LAB_BUNDLE_FORMAT = 'rcl.frontier-natural-law-lab-bundle.v0.1';
export const RCL_FRONTIER_RESEARCH_LANE_FORMAT = 'rcl.frontier-natural-law-research-lane.v0.1';

function round(value, digits = 9) {
  const scale = 10 ** digits;
  return Math.round(Number(value) * scale) / scale;
}

function average(values) {
  const xs = values.map(Number).filter(Number.isFinite);
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

function ensureArray(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

function uniq(values) {
  return [...new Set(values.filter(Boolean).map(v => String(v)))];
}

export const FRONTIER_ADDITIONAL_EXPERIMENT_MECHANISMS = Object.freeze([
  {
    id: 'spell_symbolic_control_protocol',
    name: 'Spell Symbolic Control Protocol',
    translation: '法术符号控制协议',
    family: 'symbolic_control',
    mechanism: 'Symbols, gestures, geometry and intent are treated as typed control inputs that must compile into bounded state transitions through an explicit substrate or actuator.',
    sourceVersions: ['v0.55', 'frontier-natural-law-lab-v0.1'],
    requiredControls: ['random_symbol_control', 'syntax_equivalent_null_control', 'operator_blinding_control'],
    observables: ['compiler_semantic_fidelity', 'symbol_specific_response_delta', 'blind_classification_accuracy', 'channel_residue'],
    instrumentation: ['time_series_blind_holdout_splitter', 'null_channel_baseline_monitor', 'observer_bias_audit_log'],
    blindHoldouts: ['hidden_symbol_class', 'delayed_actuator_or_residue_label'],
    falsifiers: [
      'Randomized or semantically null symbols perform the same as the active symbolic program under blind evaluation.',
      'Observed effects are fully explained by an ordinary explicit software or operator channel that was not declared in the hypothesis.',
      'No bounded substrate, actuator, energy route or measurable residue can be specified.',
    ],
    riskClass: 'computational_first_symbolic_protocol',
  },
  {
    id: 'mana_crystal_reservoir',
    name: 'Mana Crystal Reservoir',
    translation: '魔力晶体储备器',
    family: 'bounded_energy_information_reservoir',
    mechanism: 'A candidate reservoir must store and release bounded energy or information-like state with measurable charge, retention, loss and discharge signatures.',
    sourceVersions: ['v0.55', 'frontier-natural-law-lab-v0.1'],
    requiredControls: ['inert_material_control', 'matched_thermal_mass_control', 'blind_charge_state_control'],
    observables: ['retention_curve', 'bounded_discharge_response', 'thermal_loss_signature', 'cycle_efficiency'],
    instrumentation: ['thermal_relaxation_logger', 'impedance_and_ion_conductivity_meter', 'spectral_reflectance_and_hydration_scan'],
    blindHoldouts: ['withheld_charge_state', 'withheld_discharge_window'],
    falsifiers: [
      'Apparent output exceeds declared input without a measurable compensating source or accounting path.',
      'Retention is indistinguishable from matched thermal, electrochemical or structural controls.',
      'The reservoir state cannot be reproduced or read under blinded conditions.',
    ],
    riskClass: 'simulation_then_low_energy_material_benchtop',
  },
  {
    id: 'alchemical_transmutation_lattice',
    name: 'Alchemical Transmutation Lattice',
    translation: '炼金术受约束物质转化晶格',
    family: 'material_state_transformation',
    mechanism: 'Alchemy is reduced to explicitly bounded material-state transformations with declared inputs, catalysts, energy budgets, products, residues and failure conditions.',
    sourceVersions: ['v0.55', 'frontier-natural-law-lab-v0.1'],
    requiredControls: ['no_catalyst_control', 'matched_energy_control', 'blind_material_identity_control'],
    observables: ['product_state_delta', 'mass_balance_residual', 'energy_balance_residual', 'repeatability'],
    instrumentation: ['spectral_reflectance_and_hydration_scan', 'thermal_relaxation_logger', 'microstructure_entropy_analyzer'],
    blindHoldouts: ['withheld_material_identity', 'withheld_catalyst_condition'],
    falsifiers: [
      'No product-state difference survives matched-energy and no-catalyst controls.',
      'Mass or energy accounting requires an undeclared source, sink or post-hoc correction.',
      'Claimed transformation cannot be reproduced under blinded material labels.',
    ],
    riskClass: 'computational_and_nonhazardous_material_model_only',
  },
]);

const MATHEMATICAL_TARGETS = Object.freeze({
  spell_symbolic_control_protocol: {
    object: 'typed bounded transition system',
    state: 'x_t = (substrate_state, actuator_state, observer_state, energy_budget)',
    input: 'u_t = typed_symbolic_program',
    candidateLaw: 'x_(t+1) = F_theta(x_t, u_t, c_t) with explicit channel and budget constraints',
    nullModel: 'response(active_symbol) = response(random_or_semantic_null_symbol)',
    decisiveResidual: 'blind, repeatable response difference that survives declared ordinary-channel controls',
  },
  aether_substrate_information_medium: {
    object: 'bounded latent-channel model',
    state: 'x_t = (source_state, receiver_state, distance, clock_phase, environment)',
    input: 'u_t = bounded perturbation or encoded source condition',
    candidateLaw: 'correlation/phase residue follows a preregistered bounded transfer kernel K_theta',
    nullModel: 'all residuals explained by clock drift, leakage, shared environment or ordinary channels',
    decisiveResidual: 'holdout correlation structure exceeding null-channel and clock-drift controls',
  },
  formation_spatial_constraint_array: {
    object: 'boundary-condition graph / spatial operator',
    state: 'x_t = field_or_flow_state over a declared geometry',
    input: 'u = layout graph, orientation and boundary labels',
    candidateLaw: 'observable y = G_theta(x, boundary(layout))',
    nullModel: 'active, randomized, rotated and masked layouts are equivalent after ordinary geometry controls',
    decisiveResidual: 'layout-specific effect surviving blinding and matched geometric controls',
  },
  qi_environmental_biofield_coupling: {
    object: 'coupled stochastic dynamical system',
    state: 'x_t = (environment, physiology_proxy, operator_state, session_condition)',
    input: 'u_t = preregistered practice or environmental condition',
    candidateLaw: 'cross-coupled residual remains after sham, baseline and observer controls',
    nullModel: 'sensor changes are fully explained by ordinary physiology, environment, expectation or drift',
    decisiveResidual: 'cross-session blinded sensor effect with matched sham and environmental baselines',
  },
  mana_crystal_reservoir: {
    object: 'bounded storage-and-release state machine',
    state: 'x_t = (stored_state, temperature, material_state, cycle_count)',
    input: 'u_t = declared charge/discharge perturbation',
    candidateLaw: 'stored state obeys bounded retention and discharge equations with explicit losses',
    nullModel: 'ordinary thermal/electrochemical/structural storage explains all observations',
    decisiveResidual: 'reproducible excess explanatory residual after matched storage controls without violating accounting',
  },
  alchemical_transmutation_lattice: {
    object: 'constrained material transition network',
    state: 'x_t = material composition/state vector',
    input: 'u_t = declared catalyst, energy and process condition',
    candidateLaw: 'x_(t+1) = T_theta(x_t, u_t) subject to mass/energy and product-state constraints',
    nullModel: 'ordinary chemistry/phase change plus measurement error explains all products',
    decisiveResidual: 'repeatable product-state residual after matched controls and full accounting',
  },
});

const EXTERNAL_DEPENDENCY = Object.freeze({
  spell_symbolic_control_protocol: 0.20,
  formation_spatial_constraint_array: 0.30,
  aether_substrate_information_medium: 0.55,
  mana_crystal_reservoir: 0.62,
  alchemical_transmutation_lattice: 0.65,
  qi_environmental_biofield_coupling: 0.72,
});

export const DEFAULT_FRONTIER_NATURAL_LAW_LAB_SPEC = Object.freeze({
  format: RCL_FRONTIER_NATURAL_LAW_LAB_SPEC_FORMAT,
  id: 'rcl_frontier_natural_law_lab_default_v0_1',
  version: RCL_FRONTIER_NATURAL_LAW_LAB_VERSION,
  objective: 'Use existing RCL compilers and sandboxes to turn esoteric or frontier-natural-law concepts into mathematical candidate models, controlled experiment protocols, computational prototypes, sandbox evidence and explicit external-data gaps.',
  boundary: 'candidate_research_stack_not_external_natural_law_or_magic_proof',
  focusMechanismIds: [
    'spell_symbolic_control_protocol',
    'aether_substrate_information_medium',
    'formation_spatial_constraint_array',
    'qi_environmental_biofield_coupling',
    'mana_crystal_reservoir',
    'alchemical_transmutation_lattice',
  ],
  phase0Policy: {
    mathematicalFirst: true,
    computationalFirst: true,
    externalRealityClaimDisabled: true,
    destructivePhysicalExperimentDisabled: true,
    humanReviewBeforePhysicalExperiment: true,
    negativeResultsAreValid: true,
  },
  sandbox: {
    seed: 20260705,
    trials: 4,
    steps: 80,
  },
  thresholds: {
    minPromotedFocusMechanisms: 5,
    minProtocolCoverage: 0.95,
    minPrototypeCoverage: 0.95,
    minAveragePhase0PriorityScore: 0.55,
  },
});

export function normalizeFrontierNaturalLawLabSpec(input = {}) {
  const base = JSON.parse(JSON.stringify(DEFAULT_FRONTIER_NATURAL_LAW_LAB_SPEC));
  return {
    ...base,
    ...input,
    phase0Policy: { ...base.phase0Policy, ...(input.phase0Policy ?? {}) },
    sandbox: { ...base.sandbox, ...(input.sandbox ?? {}) },
    thresholds: { ...base.thresholds, ...(input.thresholds ?? {}) },
    focusMechanismIds: uniq(input.focusMechanismIds ?? base.focusMechanismIds),
  };
}

function combinedExperimentMechanisms() {
  const existing = ensureArray(DEFAULT_EXPERIMENT_DESIGN_SPEC.candidateMechanisms);
  const byId = new Map(existing.map(row => [row.id, row]));
  for (const row of FRONTIER_ADDITIONAL_EXPERIMENT_MECHANISMS) byId.set(row.id, row);
  return [...byId.values()];
}

function mathReadiness(row) {
  const d = row.dimensions ?? {};
  return round(clamp(0.35 * Number(d.mechanismTranslatabilityScore ?? 0)
    + 0.25 * Number(d.falsifiabilityTraceScore ?? 0)
    + 0.20 * Number(d.symbolicControlScore ?? d.informationChannelScore ?? 0)
    + 0.20 * Number(d.civilizationTechTreeScore ?? 0)));
}

function buildResearchLane(row, protocol, prototype, prototypeScore) {
  const id = row.id;
  const dependency = Number(EXTERNAL_DEPENDENCY[id] ?? 0.6);
  const math = mathReadiness(row);
  const protocolReady = protocol?.scores?.promoted === true ? 1 : 0;
  const prototypeReady = prototypeScore?.established === true ? 1 : 0;
  const empiricalReadiness = round(clamp(Number(row.dimensions?.falsifiabilityTraceScore ?? 0) * (1 - dependency * 0.35)));
  const priority = round(clamp(
    0.25 * Number(row.mechanismScore ?? 0)
    + 0.25 * math
    + 0.20 * protocolReady
    + 0.15 * prototypeReady
    + 0.15 * empiricalReadiness
  ));
  const target = MATHEMATICAL_TARGETS[id] ?? {
    object: 'bounded state-transition model',
    state: 'x_t = declared measurable state vector',
    input: 'u_t = declared intervention',
    candidateLaw: 'x_(t+1) = F_theta(x_t, u_t) under explicit constraints',
    nullModel: 'ordinary baseline model explains all observations',
    decisiveResidual: 'repeatable holdout residual beyond declared controls',
  };
  const nextAction = dependency <= 0.3
    ? 'formalize_and_run_computational_blind_benchmark'
    : dependency <= 0.6
      ? 'formalize_then_build_schema_only_external_data_contract'
      : 'formalize_and_preregister_before_any_physical_or_human_data_collection';
  return {
    format: RCL_FRONTIER_RESEARCH_LANE_FORMAT,
    id,
    name: row.name,
    translation: row.translation,
    sourceStatus: row.status,
    boundary: row.unknown?.boundary ?? 'candidate_knowledge_not_truth_claim',
    mathematicalTarget: target,
    experimentProtocolId: protocol?.id ?? null,
    prototypeId: prototype?.id ?? null,
    scores: {
      mechanismScore: round(row.mechanismScore ?? 0),
      mathReadinessScore: math,
      protocolReadinessScore: protocolReady,
      prototypeReadinessScore: prototypeReady,
      empiricalReadinessScore: empiricalReadiness,
      externalDependencyScore: round(dependency),
      phase0PriorityScore: priority,
    },
    falsifiers: ensureArray(row.unknown?.structure?.explicitFalsifiers, ensureArray(protocol?.failureConditions)),
    phase0NextAction: nextAction,
    externalRealityVerified: false,
    root: sha256({ id, target, protocol: protocol?.rootHash ?? null, prototype: prototype?.hashes?.prototypeRoot ?? null, priority }),
  };
}

export function runFrontierNaturalLawLab(input = {}) {
  const spec = normalizeFrontierNaturalLawLabSpec(input);
  const esoteric = runEsotericMechanismCompiler(input.esotericMechanism ?? {});
  const focusRows = esoteric.rows.filter(row => spec.focusMechanismIds.includes(row.id));
  const promotedFocusRows = focusRows.filter(row => row.promoted);

  const experimentDesignSpec = {
    ...DEFAULT_EXPERIMENT_DESIGN_SPEC,
    id: 'rcl_frontier_natural_law_experiment_design_v0_1',
    objective: 'Generate controlled Phase0 protocols for promoted frontier-natural-law mechanisms without converting candidate mechanisms into external truth claims.',
    candidateMechanisms: combinedExperimentMechanisms(),
    thresholds: {
      ...DEFAULT_EXPERIMENT_DESIGN_SPEC.thresholds,
      minPromotedProtocols: 9,
    },
  };
  const experimentDesign = runExperimentDesignSynthesizer(experimentDesignSpec);
  const prototypeBundle = runMechanismToPrototypeGenerator({
    id: 'rcl_frontier_natural_law_mechanism_to_prototype_v0_1',
    objective: 'Internalize frontier-natural-law Phase0 experiment protocols into replayable computational-first prototypes.',
    thresholds: {
      minPrototypeCount: 9,
      minAveragePrototypeScore: 0.92,
    },
    sourceExperimentDesign: experimentDesignSpec,
  });
  const sandbox = runRealityCompilerSandbox(spec.sandbox);
  const calibration = runFrontierNaturalLawCalibrationBenchmark(promotedFocusRows.map(row => row.id), { seed: 20260811 });

  const protocolById = new Map(experimentDesign.protocols.map(protocol => [protocol.id, protocol]));
  const prototypeByProtocol = new Map(prototypeBundle.prototypes.map((proto, index) => [prototypeBundle.experimentObjects[index]?.protocolId, proto]));
  const prototypeScoreByProtocol = new Map(prototypeBundle.prototypeScores.map((score, index) => [prototypeBundle.experimentObjects[index]?.protocolId, score]));
  const lanes = promotedFocusRows.map(row => buildResearchLane(
    row,
    protocolById.get(row.id),
    prototypeByProtocol.get(row.id),
    prototypeScoreByProtocol.get(row.id),
  )).sort((a, b) => b.scores.phase0PriorityScore - a.scores.phase0PriorityScore || a.id.localeCompare(b.id));

  const protocolCoverage = promotedFocusRows.length
    ? promotedFocusRows.filter(row => protocolById.get(row.id)?.scores?.promoted).length / promotedFocusRows.length
    : 0;
  const prototypeCoverage = promotedFocusRows.length
    ? promotedFocusRows.filter(row => prototypeScoreByProtocol.get(row.id)?.established).length / promotedFocusRows.length
    : 0;
  const averagePhase0PriorityScore = round(average(lanes.map(lane => lane.scores.phase0PriorityScore)));
  const topThree = lanes.slice(0, 3).map(lane => lane.id);
  const established = promotedFocusRows.length >= Number(spec.thresholds.minPromotedFocusMechanisms ?? 5)
    && protocolCoverage >= Number(spec.thresholds.minProtocolCoverage ?? 0.95)
    && prototypeCoverage >= Number(spec.thresholds.minPrototypeCoverage ?? 0.95)
    && averagePhase0PriorityScore >= Number(spec.thresholds.minAveragePhase0PriorityScore ?? 0.55)
    && calibration.calibrationPassed === true
    && spec.phase0Policy.externalRealityClaimDisabled === true;

  const result = {
    format: RCL_FRONTIER_NATURAL_LAW_LAB_RESULT_FORMAT,
    version: RCL_FRONTIER_NATURAL_LAW_LAB_VERSION,
    id: spec.id,
    established,
    verdict: established
      ? 'CANDIDATE / Phase0 computational research stack established; no external natural-law or magic claim is verified.'
      : 'BLOCKED / Phase0 research stack has incomplete candidate, protocol, prototype or evidence-boundary coverage.',
    boundary: spec.boundary,
    focusMechanismCount: focusRows.length,
    promotedFocusMechanismCount: promotedFocusRows.length,
    protocolCoverage: round(protocolCoverage),
    prototypeCoverage: round(prototypeCoverage),
    averagePhase0PriorityScore,
    topThreeResearchLanes: topThree,
    sandboxRoot: sandbox.root,
    sandboxTopModel: sandbox.ranking?.[0]?.model ?? null,
    experimentProtocolCount: experimentDesign.result.protocolCount,
    establishedPrototypeCount: prototypeBundle.result.establishedPrototypeCount,
    syntheticCalibrationPassed: calibration.calibrationPassed,
    externalRealityVerified: false,
    nextGate: 'Phase1 requires preregistered mathematical models plus real external observations or instrument/provider data; simulation success alone cannot promote a natural-law claim.',
    root: null,
  };
  result.root = sha256({ spec, result: { ...result, root: undefined }, lanes: lanes.map(l => l.root), sandbox: sandbox.root, experiments: experimentDesign.rootHash, prototypes: prototypeBundle.canonicalRoot });

  return {
    format: RCL_FRONTIER_NATURAL_LAW_LAB_BUNDLE_FORMAT,
    version: RCL_FRONTIER_NATURAL_LAW_LAB_VERSION,
    spec,
    result,
    lanes,
    esoteric,
    experimentDesign,
    prototypeBundle,
    calibration,
    sandboxSummary: {
      format: sandbox.format,
      version: sandbox.version,
      seed: sandbox.seed,
      trials: sandbox.trials,
      steps: sandbox.steps,
      topThreeModels: ensureArray(sandbox.ranking).slice(0, 3),
      irreducibility: sandbox.irreducibility,
      root: sandbox.root,
    },
    root: result.root,
  };
}

export function buildFrontierNaturalLawLabSummary(bundle = runFrontierNaturalLawLab()) {
  const lines = [
    '# RCL Frontier Natural Law Lab v0.1',
    '',
    `**状态**：${bundle.result.verdict}`,
    `**证据边界**：${bundle.result.boundary}`,
    `**External reality verified**：${bundle.result.externalRealityVerified}`,
    '',
    '## Phase0 优先研究通道',
    '',
    ...bundle.lanes.map((lane, index) => `${index + 1}. **${lane.translation} / ${lane.id}** — priority=${lane.scores.phase0PriorityScore}, math=${lane.scores.mathReadinessScore}, empirical=${lane.scores.empiricalReadinessScore}, externalDependency=${lane.scores.externalDependencyScore}`),
    '',
    '## 研究链',
    '',
    '```text',
    '候选概念 / 异常',
    '→ Esoteric Mechanism Compiler / Unknown Knowledge boundary',
    '→ 数学对象与零假设',
    '→ Experiment Design Synthesizer',
    '→ Mechanism-to-Prototype',
    '→ Reality Compiler Sandbox',
    '→ 外部数据契约 / 真实仪器或 Provider',
    '→ 盲测 / 反证 / Evidence Ledger',
    '```',
    '',
    '## 下一门',
    '',
    bundle.result.nextGate,
    '',
    '## 边界',
    '',
    '- 本栈把“魔法/以太/阵法”等词当作候选机制标签，不把它们当作已证实自然现象。',
    '- Phase0 的通过只证明数学/计算/实验设计闭环可运行。',
    '- 真实自然规律必须由独立外部观测、盲测、对照和复现实验决定。',
  ];
  return lines.join('\n');
}

export function renderFrontierNaturalLawLabRcl(input = {}) {
  const bundle = runFrontierNaturalLawLab(input);
  return [
    'reality FrontierNaturalLawLab {',
    `  version : Text = "${RCL_FRONTIER_NATURAL_LAW_LAB_VERSION}"`,
    `  boundary : Text = "${bundle.result.boundary}"`,
    `  mechanism.promoted : Number = ${bundle.result.promotedFocusMechanismCount}`,
    `  protocol.coverage : Number = ${bundle.result.protocolCoverage}`,
    `  prototype.coverage : Number = ${bundle.result.prototypeCoverage}`,
    `  phase0.priority.average : Number = ${bundle.result.averagePhase0PriorityScore}`,
    `  validation.external_reality_verified : Truth = false`,
    `  validation.established : Truth = ${bundle.result.established}`,
    `  root.hash : Text = "${bundle.root}"`,
    '}',
  ].join('\n');
}

export function writeFrontierNaturalLawLabReports(outputDir = 'output/frontier-natural-law-lab-v0.1', input = {}) {
  const dir = path.resolve(outputDir);
  fs.mkdirSync(dir, { recursive: true });
  const bundle = runFrontierNaturalLawLab(input);
  fs.writeFileSync(path.join(dir, 'frontier-natural-law-lab-spec.json'), `${JSON.stringify(bundle.spec, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'frontier-natural-law-lab-result.json'), `${JSON.stringify(bundle.result, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'frontier-natural-law-research-lanes.json'), `${JSON.stringify(bundle.lanes, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'frontier-natural-law-lab.rcl'), `${renderFrontierNaturalLawLabRcl(input)}\n`);
  fs.writeFileSync(path.join(dir, 'README.md'), `${buildFrontierNaturalLawLabSummary(bundle)}\n`);
  fs.writeFileSync(path.join(dir, 'sandbox-summary.json'), `${JSON.stringify(bundle.sandboxSummary, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'synthetic-calibration.json'), `${JSON.stringify(bundle.calibration, null, 2)}\n`);
  const protocolDir = path.join(dir, 'protocols');
  fs.mkdirSync(protocolDir, { recursive: true });
  for (const lane of bundle.lanes) {
    const protocol = bundle.experimentDesign.protocols.find(row => row.id === lane.id);
    if (!protocol) continue;
    const doc = renderExperimentTechnicalDocument(protocol);
    fs.writeFileSync(path.join(protocolDir, doc.fileName), `${doc.markdown}\n`);
  }
  const bundlePath = path.join(dir, 'frontier-natural-law-lab-bundle.json');
  fs.writeFileSync(bundlePath, `${JSON.stringify(bundle, null, 2)}\n`);
  return {
    ok: bundle.result.established,
    version: RCL_FRONTIER_NATURAL_LAW_LAB_VERSION,
    outputDir: dir,
    resultFile: path.join(dir, 'frontier-natural-law-lab-result.json'),
    lanesFile: path.join(dir, 'frontier-natural-law-research-lanes.json'),
    protocolDir,
    topThreeResearchLanes: bundle.result.topThreeResearchLanes,
    root: bundle.root,
  };
}

export function runFrontierNaturalLawLabDemo(input = {}) {
  const bundle = runFrontierNaturalLawLab(input);
  return {
    ok: bundle.result.established,
    version: RCL_FRONTIER_NATURAL_LAW_LAB_VERSION,
    verdict: bundle.result.verdict,
    promotedFocusMechanismCount: bundle.result.promotedFocusMechanismCount,
    protocolCoverage: bundle.result.protocolCoverage,
    prototypeCoverage: bundle.result.prototypeCoverage,
    averagePhase0PriorityScore: bundle.result.averagePhase0PriorityScore,
    topThreeResearchLanes: bundle.result.topThreeResearchLanes,
    externalRealityVerified: false,
    root: bundle.root,
  };
}

export function frontierNaturalLawLabCanonicalRoot(input = {}) {
  return runFrontierNaturalLawLab(input).root;
}
