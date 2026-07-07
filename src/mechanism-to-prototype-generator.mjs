import fs from 'node:fs';
import path from 'node:path';
import { sha256, clamp } from './reality-compiler-kernel.mjs';
import {
  runExperimentDesignSynthesizer,
  normalizeExperimentDesignSpec,
  RCL_EXPERIMENT_PROTOCOL_FORMAT,
} from './experiment-design-synthesizer.mjs';

export const RCL_MECHANISM_TO_PROTOTYPE_VERSION = '0.60.0-alpha.1';
export const RCL_MECHANISM_TO_PROTOTYPE_SPEC_FORMAT = 'rcl.mechanism-to-prototype-generator-spec.v0.60';
export const RCL_MECHANISM_TO_PROTOTYPE_RESULT_FORMAT = 'rcl.mechanism-to-prototype-generator-result.v0.60';
export const RCL_MECHANISM_TO_PROTOTYPE_BUNDLE_FORMAT = 'rcl.mechanism-to-prototype-generator-bundle.v0.60';
export const RCL_EXPERIMENT_OBJECT_FORMAT = 'rcl.experiment-object.v0.60';
export const RCL_PROTOTYPE_IR_FORMAT = 'rcl.prototype-ir.v0.60';
export const RCL_PROTOTYPE_TECH_DOC_FORMAT = 'rcl.prototype-technical-document.v0.60';

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

function safeId(value, fallback = 'prototype') {
  return String(value ?? fallback)
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 120) || fallback;
}

function uniq(values) {
  return [...new Set(values.filter(Boolean).map(v => String(v)))];
}

function protocolName(protocol) {
  return protocol.name || protocol.sourceMechanism?.name || protocol.title || protocol.id;
}

function protocolFamily(protocol) {
  return protocol.family || protocol.sourceMechanism?.family || 'prototype';
}

function protocolSensors(protocol) {
  const plan = ensureArray(protocol.instrumentationPlan);
  if (plan.length) return plan.map(item => item.instrument || item.name || item);
  return ensureArray(protocol.instrumentation);
}

function protocolObservables(protocol) {
  const dependent = ensureArray(protocol.variables?.dependent);
  if (dependent.length) return dependent;
  return ensureArray(protocol.observables);
}

function protocolPassConditions(protocol) {
  return ensureArray(protocol.passConditions, ensureArray(protocol.successCriteria));
}

function truthyCount(values) {
  return values.filter(Boolean).length;
}

function defaultExperimentDesignInput() {
  return normalizeExperimentDesignSpec({
    id: 'rcl_mechanism_to_prototype_source_experiments_v0',
    objective: 'Source v0.59 experiment protocols for v0.60 mechanism-to-prototype generation.',
  });
}

export const DEFAULT_MECHANISM_TO_PROTOTYPE_SPEC = Object.freeze({
  format: RCL_MECHANISM_TO_PROTOTYPE_SPEC_FORMAT,
  id: 'rcl_mechanism_to_prototype_generator_default_v0',
  version: RCL_MECHANISM_TO_PROTOTYPE_VERSION,
  objective: 'Internalize v0.59 experiment protocols into callable Experiment Objects, Prototype IR, Control Graphs, Metric Contracts, Failure Conditions, Evidence Schemas and Replay Notebooks.',
  thresholds: {
    minPrototypeScore: 0.9,
    minAveragePrototypeScore: 0.92,
    minPrototypeCount: 8,
    requireExperimentObjects: true,
    requirePrototypeIr: true,
    requireControlGraphs: true,
    requireMetricContracts: true,
    requireReplayNotebooks: true,
    requireNaturalLanguageDocs: true,
  },
  prototypeRuntime: {
    runtimeKind: 'computational-first-prototype',
    physicalLabMode: 'deferred-until-evidence-contract-ready',
    evidenceMode: 'hashable-replay-notebook',
    nextCompilerHooks: ['v0.49 unknown knowledge compiler', 'v0.50 directed wisher', 'v0.51 predictive trace derivation', 'v0.56 akashic record compiler', 'v0.59 experiment design synthesizer'],
  },
  sourceExperimentDesign: defaultExperimentDesignInput(),
});

export function normalizeMechanismToPrototypeSpec(input = {}) {
  const base = JSON.parse(JSON.stringify(DEFAULT_MECHANISM_TO_PROTOTYPE_SPEC));
  return {
    ...base,
    ...input,
    thresholds: { ...base.thresholds, ...(input.thresholds ?? {}) },
    prototypeRuntime: { ...base.prototypeRuntime, ...(input.prototypeRuntime ?? {}) },
    sourceExperimentDesign: normalizeExperimentDesignSpec(input.sourceExperimentDesign ?? base.sourceExperimentDesign),
  };
}

function buildControlGraph(protocol) {
  const controls = ensureArray(protocol.controlGroups);
  const activeNode = {
    id: `${protocol.id}:active`,
    kind: 'active-condition',
    label: protocolName(protocol),
    role: 'tests the promoted mechanism under bounded observables',
  };
  const controlNodes = controls.map((control, index) => ({
    id: `${protocol.id}:control:${index + 1}`,
    kind: 'control-condition',
    label: String(control),
    role: 'blocks false positive routes from ordinary complexity, observer bias or baseline noise',
  }));
  const edges = controlNodes.map(node => ({
    from: activeNode.id,
    to: node.id,
    relation: 'must-outperform-or-diverge-from',
  }));
  return {
    nodes: [activeNode, ...controlNodes],
    edges,
    invariants: [
      'active condition cannot be judged without control comparison',
      'control labels must remain blind until evidence capture ends',
      'negative or null results are valid evidence states',
    ],
  };
}

function buildMetricContracts(protocol) {
  const observables = protocolObservables(protocol);
  const evidence = ensureArray(protocol.evidenceOutputs);
  const sensors = protocolSensors(protocol);
  return observables.map((observable, index) => ({
    id: `${protocol.id}:metric:${safeId(observable, `m${index + 1}`)}`,
    observable: String(observable),
    measurement: sensors[index % Math.max(1, sensors.length)] ?? 'manual_replay_log',
    successCondition: `observable ${observable} must be measured before label reveal and compared against matched controls`,
    failureCondition: `observable ${observable} does not exceed control or cannot be reproduced`,
    evidenceOutput: evidence[index % Math.max(1, evidence.length)] ?? 'metric_trace_json',
  }));
}

function buildFailureContracts(protocol) {
  return ensureArray(protocol.failureConditions).map((failure, index) => ({
    id: `${protocol.id}:failure:${index + 1}`,
    condition: String(failure),
    severity: index === 0 ? 'critical' : 'blocking',
    action: 'mark prototype as not-established for this run and preserve failure ledger',
  }));
}

function buildEvidenceSchema(protocol) {
  const rawOutputs = ensureArray(protocol.evidenceOutputs);
  return {
    schemaId: `${protocol.id}:evidence-schema`,
    requiredFields: uniq([
      'run_id',
      'protocol_id',
      'seed',
      'timestamp',
      'operator_or_runtime',
      'blind_label_state',
      'control_graph_hash',
      'metric_contract_hash',
      'raw_observations',
      'transformation_steps',
      'failure_ledger',
      'result_hash',
      ...rawOutputs.map(output => `output:${safeId(output)}`),
    ]),
    hashPolicy: 'sha256 over canonical JSON with raw observations and failure ledger included',
    replayRequirement: 'a later run must reconstruct result_hash from the evidence schema without mutable hidden state',
  };
}

function buildReplayNotebook(protocol, evidenceSchema) {
  return {
    notebookId: `${protocol.id}:replay-notebook`,
    phases: [
      { id: 'prepare', action: 'freeze hypothesis, variables, controls and blind holdouts' },
      { id: 'run', action: 'capture active and control observations without label reveal' },
      { id: 'measure', action: 'apply metric contracts to raw observations' },
      { id: 'evaluate', action: 'apply pass and failure conditions' },
      { id: 'replay', action: 'recompute hashes and compare result stability' },
      { id: 'handoff', action: 'emit candidate output to next compiler hooks when established' },
    ],
    evidenceSchemaId: evidenceSchema.schemaId,
    immutableArtifacts: ['source_protocol.json', 'experiment_object.json', 'prototype_ir.json', 'evidence_schema.json', 'failure_ledger.json'],
    replayCommandTemplate: `rcl mechanism-prototype-run <spec.json> output/v0.60/${protocol.id}`,
  };
}

export function buildExperimentObject(protocol, runtime = DEFAULT_MECHANISM_TO_PROTOTYPE_SPEC.prototypeRuntime) {
  if (!protocol || protocol.format !== RCL_EXPERIMENT_PROTOCOL_FORMAT) {
    throw new TypeError('buildExperimentObject expects a v0.59 experiment protocol');
  }
  const controlGraph = buildControlGraph(protocol);
  const metricContracts = buildMetricContracts(protocol);
  const failureContracts = buildFailureContracts(protocol);
  const evidenceSchema = buildEvidenceSchema(protocol);
  const replayNotebook = buildReplayNotebook(protocol, evidenceSchema);
  return {
    format: RCL_EXPERIMENT_OBJECT_FORMAT,
    id: `experiment-object:${protocol.id}`,
    version: RCL_MECHANISM_TO_PROTOTYPE_VERSION,
    protocolId: protocol.id,
    name: protocolName(protocol),
    translation: protocol.translation,
    family: protocolFamily(protocol),
    hypothesis: protocol.hypothesis,
    variables: protocol.variables,
    controls: protocol.controlGroups,
    sensors: protocolSensors(protocol),
    metricContracts,
    passConditions: protocolPassConditions(protocol),
    failureContracts,
    evidenceSchema,
    replayNotebook,
    nextCompilerHooks: ensureArray(runtime.nextCompilerHooks),
    callable: true,
    replayable: true,
    falsifiable: failureContracts.length > 0,
  };
}

export function buildPrototypeIr(experimentObject, runtime = DEFAULT_MECHANISM_TO_PROTOTYPE_SPEC.prototypeRuntime) {
  const controlGraphHash = sha256(JSON.stringify(experimentObject.controls));
  const metricHash = sha256(JSON.stringify(experimentObject.metricContracts));
  const evidenceHash = sha256(JSON.stringify(experimentObject.evidenceSchema));
  return {
    format: RCL_PROTOTYPE_IR_FORMAT,
    id: `prototype-ir:${experimentObject.protocolId}`,
    version: RCL_MECHANISM_TO_PROTOTYPE_VERSION,
    sourceExperimentObjectId: experimentObject.id,
    name: `${experimentObject.name} Prototype`,
    translation: `${experimentObject.translation}原型`,
    runtimeKind: runtime.runtimeKind,
    physicalLabMode: runtime.physicalLabMode,
    prototypeComponents: [
      { id: 'experiment-object', role: 'stores hypothesis, variables and controls as callable state' },
      { id: 'control-graph', role: 'keeps active condition and controls structurally bound' },
      { id: 'metric-contracts', role: 'turns observables into measurable success/failure contracts' },
      { id: 'evidence-schema', role: 'forces raw-to-result traceability' },
      { id: 'replay-notebook', role: 'makes runs repeatable, comparable and auditable' },
    ],
    executionPlan: [
      'instantiate experiment object',
      'materialize control graph',
      'freeze metric and failure contracts',
      'run or simulate active and control conditions',
      'write evidence schema and replay notebook',
      'evaluate prototype score and hand off if established',
    ],
    integrationHooks: experimentObject.nextCompilerHooks,
    hashes: {
      controlGraphHash,
      metricContractHash: metricHash,
      evidenceSchemaHash: evidenceHash,
      prototypeRoot: sha256(JSON.stringify({ controlGraphHash, metricHash, evidenceHash, id: experimentObject.id })),
    },
  };
}

function scorePrototype(experimentObject, prototypeIr) {
  const objectCompletenessScore = clamp(truthyCount([
    experimentObject.hypothesis,
    experimentObject.variables && Object.keys(experimentObject.variables).length,
    ensureArray(experimentObject.controls).length,
    ensureArray(experimentObject.sensors).length,
    ensureArray(experimentObject.metricContracts).length,
    ensureArray(experimentObject.failureContracts).length,
    experimentObject.evidenceSchema?.requiredFields?.length,
    experimentObject.replayNotebook?.phases?.length,
  ]) / 8);
  const protocolBindingScore = experimentObject.protocolId && prototypeIr.sourceExperimentObjectId === experimentObject.id ? 1 : 0;
  const controlGraphScore = clamp(ensureArray(experimentObject.controls).length / 3);
  const metricContractScore = clamp(ensureArray(experimentObject.metricContracts).length / 4);
  const failureContractScore = clamp(ensureArray(experimentObject.failureContracts).length / 3);
  const evidenceSchemaScore = clamp(ensureArray(experimentObject.evidenceSchema?.requiredFields).length / 10);
  const replayNotebookScore = clamp(ensureArray(experimentObject.replayNotebook?.phases).length / 5);
  const hookScore = clamp(ensureArray(experimentObject.nextCompilerHooks).length / 4);
  const prototypeScore = round(average([
    objectCompletenessScore,
    protocolBindingScore,
    controlGraphScore,
    metricContractScore,
    failureContractScore,
    evidenceSchemaScore,
    replayNotebookScore,
    hookScore,
  ]));
  return {
    objectCompletenessScore: round(objectCompletenessScore),
    protocolBindingScore: round(protocolBindingScore),
    controlGraphScore: round(controlGraphScore),
    metricContractScore: round(metricContractScore),
    failureContractScore: round(failureContractScore),
    evidenceSchemaScore: round(evidenceSchemaScore),
    replayNotebookScore: round(replayNotebookScore),
    hookScore: round(hookScore),
    prototypeScore,
    established: prototypeScore >= 0.9,
  };
}

export function evaluateMechanismToPrototypeGenerator(input = {}) {
  const spec = normalizeMechanismToPrototypeSpec(input);
  const sourceBundle = runExperimentDesignSynthesizer(spec.sourceExperimentDesign);
  const protocols = ensureArray(sourceBundle.promotedProtocols, sourceBundle.protocols ?? []);
  const experimentObjects = protocols.map(protocol => buildExperimentObject(protocol, spec.prototypeRuntime));
  const prototypes = experimentObjects.map(object => buildPrototypeIr(object, spec.prototypeRuntime));
  const prototypeScores = experimentObjects.map((object, index) => scorePrototype(object, prototypes[index]));
  const establishedPrototypes = prototypes.filter((_, index) => prototypeScores[index].established);
  const averagePrototypeScore = round(average(prototypeScores.map(score => score.prototypeScore)));
  const result = {
    format: RCL_MECHANISM_TO_PROTOTYPE_RESULT_FORMAT,
    version: RCL_MECHANISM_TO_PROTOTYPE_VERSION,
    mechanismToPrototypeEstablished: establishedPrototypes.length >= Number(spec.thresholds.minPrototypeCount ?? 8)
      && averagePrototypeScore >= Number(spec.thresholds.minAveragePrototypeScore ?? 0.92),
    experimentObjectsInternalized: experimentObjects.length === protocols.length && experimentObjects.every(o => o.callable && o.replayable),
    prototypeIrGenerated: prototypes.length === protocols.length && prototypes.every(p => p.format === RCL_PROTOTYPE_IR_FORMAT),
    controlGraphsBound: experimentObjects.every(o => ensureArray(o.controls).length >= 3),
    metricContractsBound: experimentObjects.every(o => ensureArray(o.metricContracts).length >= 4),
    failureContractsBound: experimentObjects.every(o => ensureArray(o.failureContracts).length >= 3),
    evidenceSchemasGenerated: experimentObjects.every(o => ensureArray(o.evidenceSchema?.requiredFields).length >= 10),
    replayNotebooksGenerated: experimentObjects.every(o => ensureArray(o.replayNotebook?.phases).length >= 5),
    prototypeCount: prototypes.length,
    establishedPrototypeCount: establishedPrototypes.length,
    sourceProtocolCount: protocols.length,
    scores: {
      averagePrototypeScore,
      minPrototypeScore: round(Math.min(...prototypeScores.map(score => score.prototypeScore))),
      maxPrototypeScore: round(Math.max(...prototypeScores.map(score => score.prototypeScore))),
    },
    thresholds: spec.thresholds,
    canonicalRoot: mechanismToPrototypeCanonicalRoot({ spec, resultSeed: { protocols: protocols.length, averagePrototypeScore } }),
  };
  return {
    ok: result.mechanismToPrototypeEstablished,
    spec,
    sourceBundle,
    protocols,
    experimentObjects,
    prototypes,
    prototypeScores,
    result,
  };
}

export function renderPrototypeTechnicalDocument(experimentObject, prototypeIr, score) {
  const lines = [];
  lines.push(`# ${prototypeIr.name}（${prototypeIr.translation}）`);
  lines.push('');
  lines.push(`**格式**：${RCL_PROTOTYPE_TECH_DOC_FORMAT}`);
  lines.push(`**来源实验对象**：${experimentObject.id}`);
  lines.push(`**原型分数**：${score?.prototypeScore ?? 'N/A'}`);
  lines.push(`**成立状态**：${score?.established ? 'established（成立）' : 'not-established（未成立）'}`);
  lines.push('');
  lines.push('## 1. 原型目标');
  lines.push(experimentObject.hypothesis || '未定义');
  lines.push('');
  lines.push('## 2. Experiment Object（实验对象）');
  lines.push(`- 变量：${ensureArray(experimentObject.variables).join('；')}`);
  lines.push(`- 对照组：${ensureArray(experimentObject.controls).join('；')}`);
  lines.push(`- 传感器/观测：${ensureArray(experimentObject.sensors).join('；')}`);
  lines.push('');
  lines.push('## 3. Metric Contract（指标契约）');
  for (const metric of ensureArray(experimentObject.metricContracts)) {
    lines.push(`- **${metric.observable}**：${metric.successCondition}`);
  }
  lines.push('');
  lines.push('## 4. Failure Conditions（失败条件）');
  for (const failure of ensureArray(experimentObject.failureContracts)) {
    lines.push(`- ${failure.condition}`);
  }
  lines.push('');
  lines.push('## 5. Evidence Schema（证据结构）');
  lines.push(`- Schema ID：${experimentObject.evidenceSchema.schemaId}`);
  lines.push(`- 哈希策略：${experimentObject.evidenceSchema.hashPolicy}`);
  lines.push(`- 必填字段数量：${experimentObject.evidenceSchema.requiredFields.length}`);
  lines.push('');
  lines.push('## 6. Replay Notebook（可重放实验日志）');
  for (const phase of ensureArray(experimentObject.replayNotebook.phases)) {
    lines.push(`- ${phase.id}：${phase.action}`);
  }
  lines.push('');
  lines.push('## 7. Prototype IR（原型中间表示）');
  lines.push(`- Runtime：${prototypeIr.runtimeKind}`);
  lines.push(`- Physical Lab Mode：${prototypeIr.physicalLabMode}`);
  lines.push(`- Prototype Root：${prototypeIr.hashes.prototypeRoot}`);
  lines.push('');
  lines.push('## 8. 下一步编译器钩子');
  for (const hook of ensureArray(prototypeIr.integrationHooks)) {
    lines.push(`- ${hook}`);
  }
  lines.push('');
  return {
    format: RCL_PROTOTYPE_TECH_DOC_FORMAT,
    id: `${prototypeIr.id}:technical-document`,
    title: `${prototypeIr.name}（${prototypeIr.translation}）`,
    markdown: lines.join('\n'),
  };
}

export function runMechanismToPrototypeGenerator(input = {}) {
  const evaluation = evaluateMechanismToPrototypeGenerator(input);
  const documents = evaluation.experimentObjects.map((object, index) => renderPrototypeTechnicalDocument(object, evaluation.prototypes[index], evaluation.prototypeScores[index]));
  return {
    format: RCL_MECHANISM_TO_PROTOTYPE_BUNDLE_FORMAT,
    version: RCL_MECHANISM_TO_PROTOTYPE_VERSION,
    ok: evaluation.ok,
    mechanismToPrototypeEstablished: evaluation.result.mechanismToPrototypeEstablished,
    result: evaluation.result,
    experimentObjects: evaluation.experimentObjects,
    prototypes: evaluation.prototypes,
    prototypeScores: evaluation.prototypeScores,
    documents,
    canonicalRoot: mechanismToPrototypeCanonicalRoot({
      result: evaluation.result,
      experimentObjectIds: evaluation.experimentObjects.map(o => o.id),
      prototypeRoots: evaluation.prototypes.map(p => p.hashes.prototypeRoot),
    }),
  };
}

export function buildMechanismToPrototypeSpec(overrides = {}) {
  return normalizeMechanismToPrototypeSpec(overrides);
}

export function renderMechanismToPrototypeRcl(input = {}) {
  const spec = normalizeMechanismToPrototypeSpec(input);
  const bundle = runMechanismToPrototypeGenerator(spec);
  return `reality MechanismToPrototypeGenerator {\n  version: "${RCL_MECHANISM_TO_PROTOTYPE_VERSION}"\n  format: "${RCL_MECHANISM_TO_PROTOTYPE_SPEC_FORMAT}"\n  objective: "${spec.objective}"\n  source.protocol_count : Int = ${bundle.result.sourceProtocolCount}\n  prototype.count : Int = ${bundle.result.prototypeCount}\n  prototype.established_count : Int = ${bundle.result.establishedPrototypeCount}\n  prototype.average_score : Float = ${bundle.result.scores.averagePrototypeScore}\n  validation.experiment_objects_internalized : Truth = ${bundle.result.experimentObjectsInternalized}\n  validation.prototype_ir_generated : Truth = ${bundle.result.prototypeIrGenerated}\n  validation.replay_notebooks_generated : Truth = ${bundle.result.replayNotebooksGenerated}\n  validation.established : Truth = ${bundle.result.mechanismToPrototypeEstablished}\n  root: "${bundle.canonicalRoot}"\n}`;
}

export function runMechanismToPrototypeDemo() {
  const bundle = runMechanismToPrototypeGenerator();
  return {
    ok: bundle.ok,
    mechanismToPrototypeEstablished: bundle.mechanismToPrototypeEstablished,
    prototypeCount: bundle.result.prototypeCount,
    establishedPrototypeCount: bundle.result.establishedPrototypeCount,
    averagePrototypeScore: bundle.result.scores.averagePrototypeScore,
    generatedDocuments: bundle.documents.length,
    canonicalRoot: bundle.canonicalRoot,
  };
}

export function readMechanismToPrototypeInput(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

export function writeMechanismToPrototypeReports(outDir, input = {}) {
  const dir = path.resolve(outDir);
  fs.mkdirSync(dir, { recursive: true });
  const bundle = runMechanismToPrototypeGenerator(input);
  fs.writeFileSync(path.join(dir, 'mechanism-to-prototype-result.json'), `${JSON.stringify(bundle.result, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'experiment-objects.json'), `${JSON.stringify(bundle.experimentObjects, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'prototype-ir.json'), `${JSON.stringify(bundle.prototypes, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'prototype-scores.json'), `${JSON.stringify(bundle.prototypeScores, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'mechanism-to-prototype.rcl'), `${renderMechanismToPrototypeRcl(input)}\n`);
  const docsDir = path.join(dir, 'prototype-docs');
  fs.mkdirSync(docsDir, { recursive: true });
  for (const doc of bundle.documents) {
    const name = `${safeId(doc.title, 'prototype-document')}.md`;
    fs.writeFileSync(path.join(docsDir, name), `${doc.markdown}\n`);
  }
  return {
    ok: bundle.ok,
    mechanismToPrototypeEstablished: bundle.mechanismToPrototypeEstablished,
    outDir: dir,
    prototypeCount: bundle.result.prototypeCount,
    establishedPrototypeCount: bundle.result.establishedPrototypeCount,
    documentCount: bundle.documents.length,
    canonicalRoot: bundle.canonicalRoot,
  };
}

export function mechanismToPrototypeCanonicalRoot(payload) {
  return sha256(JSON.stringify(payload));
}
