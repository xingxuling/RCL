import fs from 'node:fs';
import path from 'node:path';
import { sha256, clamp } from './reality-compiler-kernel.mjs';
import {
  runEmpiricalLabNotebookRuntime,
  normalizeEmpiricalLabNotebookSpec,
  RCL_LAB_NOTEBOOK_FORMAT,
  RCL_NOTEBOOK_RUN_FORMAT,
} from './empirical-lab-notebook-runtime.mjs';

export const RCL_CIVILIZATION_TECH_TREE_VERSION = '0.62.0-alpha.1';
export const RCL_CIVILIZATION_TECH_TREE_SPEC_FORMAT = 'rcl.civilization-technology-tree-compiler-spec.v0.62';
export const RCL_CIVILIZATION_TECH_TREE_RESULT_FORMAT = 'rcl.civilization-technology-tree-compiler-result.v0.62';
export const RCL_CIVILIZATION_TECH_TREE_BUNDLE_FORMAT = 'rcl.civilization-technology-tree-compiler-bundle.v0.62';
export const RCL_TECHNOLOGY_NODE_FORMAT = 'rcl.civilization-technology-node.v0.62';
export const RCL_TECHNOLOGY_TREE_FORMAT = 'rcl.civilization-technology-tree.v0.62';
export const RCL_CIVILIZATION_TECH_DOC_FORMAT = 'rcl.civilization-technology-tree-technical-document.v0.62';

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

function safeId(value, fallback = 'technology-node') {
  return String(value ?? fallback)
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 120) || fallback;
}

function titleCaseFromId(id) {
  return String(id)
    .replace(/[:._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, c => c.toUpperCase());
}

function defaultSourceNotebookSpec() {
  return normalizeEmpiricalLabNotebookSpec({
    id: 'rcl_civilization_technology_tree_source_notebooks_v0',
    objective: 'Source v0.61 replay-stable empirical lab notebook runs for civilization technology tree compilation.',
  });
}

export const DEFAULT_CIVILIZATION_TECH_TREE_SPEC = Object.freeze({
  format: RCL_CIVILIZATION_TECH_TREE_SPEC_FORMAT,
  id: 'rcl_civilization_technology_tree_default_v0',
  version: RCL_CIVILIZATION_TECH_TREE_VERSION,
  objective: 'Compile v0.61 empirical lab notebook runs into a civilization-scale technology tree with dependency graph, staged roadmap, evidence links and technical documents.',
  thresholds: {
    minTechnologyNodes: 8,
    minAverageNodeScore: 0.95,
    minDependencyGraphScore: 1,
    minRoadmapPhaseCount: 5,
    requireEvidenceLineage: true,
    requireNegativeControlTrace: true,
    requireCivilizationCapabilityMap: true,
    requireNaturalLanguageDocs: true,
  },
  treePolicy: {
    mode: 'experiment-to-civilization-technology-tree',
    dependencyPolicy: 'derive-from-substrate-readout-interface-field-record-and-runtime-stages',
    stagePolicy: 'substrate -> sensing -> interface -> field-control -> record-runtime -> civilization-scaling',
    evidencePolicy: 'every node must reference notebook id, run hash, audit ledger and failure ledger',
    handoffPolicy: 'established tree nodes may feed v0.63 RNCS Execution Bridge v2 and v0.64 Human Capability Feedback OS',
  },
  sourceEmpiricalLabNotebook: defaultSourceNotebookSpec(),
});

export function normalizeCivilizationTechTreeSpec(input = {}) {
  const base = JSON.parse(JSON.stringify(DEFAULT_CIVILIZATION_TECH_TREE_SPEC));
  return {
    ...base,
    ...input,
    thresholds: { ...base.thresholds, ...(input.thresholds ?? {}) },
    treePolicy: { ...base.treePolicy, ...(input.treePolicy ?? {}) },
    sourceEmpiricalLabNotebook: normalizeEmpiricalLabNotebookSpec(input.sourceEmpiricalLabNotebook ?? base.sourceEmpiricalLabNotebook),
  };
}

function assertNotebook(notebook) {
  if (!notebook || notebook.format !== RCL_LAB_NOTEBOOK_FORMAT) {
    throw new TypeError('buildTechnologyNode expects a v0.61 Lab Notebook');
  }
}

function assertNotebookRun(run) {
  if (!run || run.format !== RCL_NOTEBOOK_RUN_FORMAT) {
    throw new TypeError('buildTechnologyNode expects a v0.61 Notebook Run');
  }
}

function classifyDomain(name = '') {
  const n = String(name).toLowerCase();
  if (/(silicate|hydration|spectral|memory cell)/.test(n)) return 'substrate-material-memory';
  if (/(qi|aether|formation|field)/.test(n)) return 'field-coupling-control';
  if (/(akashic|observer|readout|interface)/.test(n)) return 'record-interface-readout';
  if (/(experiment|notebook|bridge|runtime)/.test(n)) return 'runtime-evidence-infrastructure';
  return 'civilization-support-mechanism';
}

function classifyStage(domain, index) {
  if (domain === 'substrate-material-memory') return index === 0 ? 'S1-substrate' : 'S2-sensing';
  if (domain === 'field-coupling-control') return 'S4-field-control';
  if (domain === 'record-interface-readout') return 'S5-record-interface';
  if (domain === 'runtime-evidence-infrastructure') return 'S6-civilization-runtime';
  return 'S3-interface';
}

function translationFor(name, domain) {
  const lower = String(name).toLowerCase();
  if (lower.includes('silicate anchored passive memory')) return '硅酸盐锚定被动记忆元胞';
  if (lower.includes('spectral hydration')) return '光谱水合读出协议';
  if (lower.includes('qi environmental')) return '灵气环境生命场耦合';
  if (lower.includes('aether substrate')) return '以太底层信息媒介';
  if (lower.includes('formation spatial')) return '阵法空间约束阵列';
  if (lower.includes('akashic substrate')) return '阿卡西底层记忆场';
  if (lower.includes('observer-state')) return '观测者状态读出界面';
  if (lower.includes('experiment-to-lab')) return '实验到实证日志桥';
  return `${titleCaseFromId(name)}（${domain}）`;
}

function dependencyFor(stage, existingNodes) {
  const ids = existingNodes.map(n => n.id);
  if (stage === 'S1-substrate') return [];
  if (stage === 'S2-sensing') return ids.filter(id => /silicate|memory|substrate/.test(id)).slice(0, 2);
  if (stage === 'S3-interface') return ids.filter(id => /readout|memory|sensing|silicate/.test(id)).slice(0, 3);
  if (stage === 'S4-field-control') return ids.filter(id => /memory|readout|substrate|sensing/.test(id)).slice(0, 3);
  if (stage === 'S5-record-interface') return ids.filter(id => /field|aether|qi|formation|readout|memory|observer/.test(id)).slice(0, 4);
  if (stage === 'S6-civilization-runtime') return ids.slice(Math.max(0, ids.length - 5));
  return ids.slice(0, 2);
}

function capabilityFor(domain) {
  const map = {
    'substrate-material-memory': ['long-lived material state', 'passive memory retention', 'environmental residue capture'],
    'field-coupling-control': ['field-like constraint modulation', 'symbolic-spatial control', 'bio-environmental coupling'],
    'record-interface-readout': ['event indexing', 'observer-mediated readout', 'record interface construction'],
    'runtime-evidence-infrastructure': ['experiment lifecycle memory', 'audit replay', 'candidate handoff'],
    'civilization-support-mechanism': ['technology-tree support', 'mechanism integration'],
  };
  return map[domain] ?? map['civilization-support-mechanism'];
}

export function buildTechnologyNode(notebook, run, score = {}, index = 0, existingNodes = []) {
  assertNotebook(notebook);
  assertNotebookRun(run);
  const baseName = notebook.name.replace(/ Lab Notebook$/i, '');
  const slug = safeId(baseName);
  const domain = classifyDomain(baseName);
  const stage = classifyStage(domain, index);
  const dependsOn = dependencyFor(stage, existingNodes);
  const evidenceLineage = {
    notebookId: notebook.id,
    runId: run.runId,
    replayHash: run.replayHash,
    resultHash: run.resultHash,
    auditLedgerHashes: ensureArray(run.auditTrail).map(row => row.hash).slice(0, 5),
    failureLedgerSize: ensureArray(run.failureLedger).length,
    metricSummary: run.metricSummary,
    derivedCandidatePackage: run.derivedCandidatePackage,
  };
  const nodeScore = round(average([
    score.notebookScore ?? 1,
    run.replayStable ? 1 : 0,
    run.metricSummary?.failed === 0 ? 1 : 0,
    ensureArray(run.auditTrail).length >= 5 ? 1 : 0,
    ensureArray(run.failureLedger).length >= 3 ? 1 : 0,
    run.derivedCandidatePackage?.enabled ? 1 : 0,
  ]));
  const id = `tech-node:${slug}`;
  return {
    format: RCL_TECHNOLOGY_NODE_FORMAT,
    id,
    version: RCL_CIVILIZATION_TECH_TREE_VERSION,
    name: baseName,
    translation: translationFor(baseName, domain),
    domain,
    stage,
    tier: stage.split('-')[0],
    dependsOn,
    capability: capabilityFor(domain),
    mechanismSummary: `${translationFor(baseName, domain)} 将实验日志中的可重放证据转译为文明技术树节点。`,
    experimentRefs: {
      notebookId: notebook.id,
      sourceExperimentObjectId: notebook.sourceExperimentObjectId,
      sourcePrototypeIrId: notebook.sourcePrototypeIrId,
    },
    evidenceLineage,
    maturity: nodeScore >= 0.95 ? 'established-experimental-node' : 'candidate-node',
    nodeScore,
    established: nodeScore >= 0.95,
    hashes: {
      evidenceRoot: sha256(JSON.stringify(evidenceLineage)),
      dependencyRoot: sha256(JSON.stringify({ id, dependsOn, stage, domain })),
      nodeRoot: sha256(JSON.stringify({ id, baseName, domain, stage, dependsOn, replayHash: run.replayHash })),
    },
  };
}

export function buildTechnologyDependencyGraph(nodes) {
  const nodeIds = nodes.map(n => n.id);
  const edges = [];
  for (const node of nodes) {
    for (const dep of ensureArray(node.dependsOn)) {
      if (nodeIds.includes(dep)) {
        edges.push({ from: dep, to: node.id, kind: 'enables', hash: sha256(`${dep}->${node.id}`) });
      }
    }
  }
  const roots = nodes.filter(n => ensureArray(n.dependsOn).length === 0).map(n => n.id);
  const leaves = nodes.filter(n => !edges.some(edge => edge.from === n.id)).map(n => n.id);
  return {
    format: 'rcl.civilization-technology-dependency-graph.v0.62',
    nodeCount: nodes.length,
    edgeCount: edges.length,
    roots,
    leaves,
    edges,
    acyclic: true,
    connectedEnough: edges.length >= Math.max(0, nodes.length - 2),
    graphRoot: sha256(JSON.stringify({ nodeIds, edges })),
  };
}

export function buildCivilizationRoadmap(nodes, graph) {
  const stageOrder = ['S1-substrate', 'S2-sensing', 'S3-interface', 'S4-field-control', 'S5-record-interface', 'S6-civilization-runtime'];
  const phases = stageOrder.map((stage, index) => {
    const stageNodes = nodes.filter(n => n.stage === stage);
    const capabilitySet = [...new Set(stageNodes.flatMap(n => ensureArray(n.capability)))];
    return {
      id: stage,
      seq: index + 1,
      title: {
        'S1-substrate': 'Substrate Formation（底层介质形成）',
        'S2-sensing': 'Readout & Sensing（读出与感测）',
        'S3-interface': 'Interface Construction（界面构造）',
        'S4-field-control': 'Field & Constraint Control（场与约束控制）',
        'S5-record-interface': 'Record Layer Integration（记录层整合）',
        'S6-civilization-runtime': 'Civilization Runtime（文明运行时）',
      }[stage],
      nodes: stageNodes.map(n => n.id),
      capabilitySet,
      entryCondition: index === 0 ? 'validated material-memory substrate' : `previous phase ${stageOrder[index - 1]} established`,
      exitCondition: stageNodes.length > 0 ? 'all phase nodes replay-stable and evidence-linked' : 'phase reserved for next generation nodes',
      evidenceGate: stageNodes.every(n => n.established),
    };
  });
  return {
    format: 'rcl.civilization-technology-roadmap.v0.62',
    phaseCount: phases.length,
    phases,
    graphRoot: graph.graphRoot,
    roadmapRoot: sha256(JSON.stringify(phases)),
  };
}

export function buildCivilizationCapabilityMap(nodes) {
  const domains = [...new Set(nodes.map(n => n.domain))];
  const rows = domains.map(domain => {
    const domainNodes = nodes.filter(n => n.domain === domain);
    return {
      domain,
      nodeCount: domainNodes.length,
      capabilities: [...new Set(domainNodes.flatMap(n => ensureArray(n.capability)))],
      established: domainNodes.every(n => n.established),
      evidenceRoots: domainNodes.map(n => n.hashes.evidenceRoot),
    };
  });
  return {
    format: 'rcl.civilization-capability-map.v0.62',
    domainCount: rows.length,
    rows,
    civilizationCapabilities: [...new Set(rows.flatMap(row => row.capabilities))],
    capabilityRoot: sha256(JSON.stringify(rows)),
  };
}

function scoreTechnologyTree(nodes, graph, roadmap, capabilityMap, thresholds) {
  const nodeScore = clamp(nodes.length / Number(thresholds.minTechnologyNodes ?? 8));
  const averageNodeScore = round(average(nodes.map(n => n.nodeScore)));
  const graphScore = graph.acyclic && graph.connectedEnough ? 1 : 0;
  const roadmapScore = clamp(roadmap.phaseCount / Number(thresholds.minRoadmapPhaseCount ?? 5));
  const evidenceScore = nodes.every(n => n.evidenceLineage?.replayHash && n.evidenceLineage?.auditLedgerHashes?.length >= 5) ? 1 : 0;
  const controlTraceScore = nodes.every(n => Number(n.evidenceLineage?.metricSummary?.failed ?? 1) === 0) ? 1 : 0;
  const capabilityScore = capabilityMap.domainCount >= 4 && capabilityMap.civilizationCapabilities.length >= 8 ? 1 : 0;
  const averageTreeScore = round(average([nodeScore, averageNodeScore, graphScore, roadmapScore, evidenceScore, controlTraceScore, capabilityScore]));
  return {
    nodeCountScore: round(nodeScore),
    averageNodeScore,
    dependencyGraphScore: round(graphScore),
    roadmapScore: round(roadmapScore),
    evidenceLineageScore: round(evidenceScore),
    negativeControlTraceScore: round(controlTraceScore),
    civilizationCapabilityScore: round(capabilityScore),
    averageTreeScore,
    established: averageTreeScore >= 0.95,
  };
}

export function evaluateCivilizationTechnologyTreeCompiler(input = {}) {
  const spec = normalizeCivilizationTechTreeSpec(input);
  const sourceBundle = runEmpiricalLabNotebookRuntime(spec.sourceEmpiricalLabNotebook);
  const notebooks = ensureArray(sourceBundle.notebooks);
  const runs = ensureArray(sourceBundle.runs);
  const notebookScores = ensureArray(sourceBundle.notebookScores);
  const nodes = [];
  for (let i = 0; i < notebooks.length; i += 1) {
    nodes.push(buildTechnologyNode(notebooks[i], runs[i], notebookScores[i], i, nodes));
  }
  const graph = buildTechnologyDependencyGraph(nodes);
  const roadmap = buildCivilizationRoadmap(nodes, graph);
  const capabilityMap = buildCivilizationCapabilityMap(nodes);
  const treeScores = scoreTechnologyTree(nodes, graph, roadmap, capabilityMap, spec.thresholds);
  const establishedNodeCount = nodes.filter(n => n.established).length;
  const technologyTree = {
    format: RCL_TECHNOLOGY_TREE_FORMAT,
    version: RCL_CIVILIZATION_TECH_TREE_VERSION,
    id: 'civilization-technology-tree:rcl-v0.62-default',
    objective: spec.objective,
    sourceBundleRoot: sourceBundle.canonicalRoot,
    nodes,
    dependencyGraph: graph,
    roadmap,
    capabilityMap,
    handoff: {
      nextVersions: ['v0.63 RNCS Execution Bridge v2', 'v0.64 Human Capability Feedback OS', 'v0.65 Reality Product Entry Runtime'],
      condition: 'only established technology nodes with replay-stable evidence may be converted into execution plans',
      packageFields: ['node_id', 'capability', 'dependencies', 'evidence_lineage', 'prototype_ir', 'lab_notebook_run'],
    },
    hashes: {
      treeRoot: sha256(JSON.stringify({ nodes: nodes.map(n => n.hashes.nodeRoot), graph: graph.graphRoot, roadmap: roadmap.roadmapRoot })),
      evidenceRoot: sha256(JSON.stringify(nodes.map(n => n.hashes.evidenceRoot))),
      capabilityRoot: capabilityMap.capabilityRoot,
    },
  };
  const result = {
    format: RCL_CIVILIZATION_TECH_TREE_RESULT_FORMAT,
    version: RCL_CIVILIZATION_TECH_TREE_VERSION,
    civilizationTechnologyTreeEstablished: treeScores.established
      && establishedNodeCount >= Number(spec.thresholds.minTechnologyNodes ?? 8)
      && treeScores.dependencyGraphScore >= Number(spec.thresholds.minDependencyGraphScore ?? 1),
    technologyTreeCompiled: true,
    nodeCount: nodes.length,
    establishedNodeCount,
    dependencyEdgeCount: graph.edgeCount,
    roadmapPhaseCount: roadmap.phaseCount,
    capabilityDomainCount: capabilityMap.domainCount,
    generatedTechnicalDocuments: true,
    evidenceLineageReady: treeScores.evidenceLineageScore === 1,
    derivedExecutionHandoffReady: true,
    scores: treeScores,
    thresholds: spec.thresholds,
    canonicalRoot: civilizationTechnologyTreeCanonicalRoot({ spec, treeRoot: technologyTree.hashes.treeRoot, scores: treeScores }),
  };
  return {
    ok: result.civilizationTechnologyTreeEstablished,
    spec,
    sourceBundle,
    nodes,
    graph,
    roadmap,
    capabilityMap,
    technologyTree,
    treeScores,
    result,
  };
}

export function renderTechnologyNodeDocument(node) {
  const lines = [];
  lines.push(`# ${node.name}（${node.translation}）`);
  lines.push('');
  lines.push(`**格式**：${RCL_CIVILIZATION_TECH_DOC_FORMAT}`);
  lines.push(`**Technology Node（技术节点）**：${node.id}`);
  lines.push(`**Domain（领域）**：${node.domain}`);
  lines.push(`**Stage（阶段）**：${node.stage}`);
  lines.push(`**Node Score（节点分数）**：${node.nodeScore}`);
  lines.push('');
  lines.push('## 1. Mechanism Role（机制角色）');
  lines.push(node.mechanismSummary);
  lines.push('');
  lines.push('## 2. Dependencies（依赖）');
  if (node.dependsOn.length === 0) lines.push('- Root node（根节点）：无需上游技术节点。');
  for (const dep of node.dependsOn) lines.push(`- ${dep}`);
  lines.push('');
  lines.push('## 3. Capabilities（能力）');
  for (const capability of node.capability) lines.push(`- ${capability}`);
  lines.push('');
  lines.push('## 4. Evidence Lineage（证据链）');
  lines.push(`- Notebook ID：${node.evidenceLineage.notebookId}`);
  lines.push(`- Run ID：${node.evidenceLineage.runId}`);
  lines.push(`- Replay Hash（重放哈希）：${node.evidenceLineage.replayHash}`);
  lines.push(`- Failed Metrics（失败指标）：${node.evidenceLineage.metricSummary.failed}`);
  lines.push('');
  lines.push('## 5. Civilization Use（文明用途）');
  lines.push('该节点可作为文明技术树中的一个可证据追溯技术单元，后续可被 v0.63 执行桥转译为真实执行计划。');
  lines.push('');
  return {
    format: RCL_CIVILIZATION_TECH_DOC_FORMAT,
    id: `${node.id}:technical-document`,
    title: `${node.name}（${node.translation}）`,
    markdown: lines.join('\n'),
  };
}

export function renderCivilizationTechnologyTreeDocument(technologyTree, result) {
  const lines = [];
  lines.push('# RCL Civilization Technology Tree（RCL 文明技术树）');
  lines.push('');
  lines.push(`**格式**：${RCL_CIVILIZATION_TECH_DOC_FORMAT}`);
  lines.push(`**Tree ID**：${technologyTree.id}`);
  lines.push(`**Established（成立）**：${result.civilizationTechnologyTreeEstablished}`);
  lines.push(`**Node Count（节点数）**：${result.nodeCount}`);
  lines.push(`**Dependency Edges（依赖边）**：${result.dependencyEdgeCount}`);
  lines.push('');
  lines.push('## 1. Roadmap（阶段路线）');
  for (const phase of technologyTree.roadmap.phases) {
    lines.push(`- **${phase.title}**：nodes=${phase.nodes.length}，evidenceGate=${phase.evidenceGate}`);
  }
  lines.push('');
  lines.push('## 2. Capability Domains（能力领域）');
  for (const row of technologyTree.capabilityMap.rows) {
    lines.push(`- **${row.domain}**：${row.capabilities.join(' / ')}`);
  }
  lines.push('');
  lines.push('## 3. Dependency Graph（依赖图）');
  for (const edge of technologyTree.dependencyGraph.edges) {
    lines.push(`- ${edge.from} → ${edge.to}`);
  }
  lines.push('');
  lines.push('## 4. Handoff（交接）');
  for (const next of technologyTree.handoff.nextVersions) lines.push(`- ${next}`);
  lines.push('');
  return {
    format: RCL_CIVILIZATION_TECH_DOC_FORMAT,
    id: `${technologyTree.id}:technical-document`,
    title: 'RCL Civilization Technology Tree（RCL 文明技术树）',
    markdown: lines.join('\n'),
  };
}

export function runCivilizationTechnologyTreeCompiler(input = {}) {
  const evaluation = evaluateCivilizationTechnologyTreeCompiler(input);
  const nodeDocuments = evaluation.nodes.map(renderTechnologyNodeDocument);
  const treeDocument = renderCivilizationTechnologyTreeDocument(evaluation.technologyTree, evaluation.result);
  return {
    format: RCL_CIVILIZATION_TECH_TREE_BUNDLE_FORMAT,
    version: RCL_CIVILIZATION_TECH_TREE_VERSION,
    ok: evaluation.ok,
    civilizationTechnologyTreeEstablished: evaluation.result.civilizationTechnologyTreeEstablished,
    result: evaluation.result,
    nodes: evaluation.nodes,
    dependencyGraph: evaluation.graph,
    roadmap: evaluation.roadmap,
    capabilityMap: evaluation.capabilityMap,
    technologyTree: evaluation.technologyTree,
    treeScores: evaluation.treeScores,
    documents: [treeDocument, ...nodeDocuments],
    canonicalRoot: civilizationTechnologyTreeCanonicalRoot({
      result: evaluation.result,
      treeRoot: evaluation.technologyTree.hashes.treeRoot,
      nodeRoots: evaluation.nodes.map(n => n.hashes.nodeRoot),
    }),
  };
}

export function buildCivilizationTechnologyTreeSpec(overrides = {}) {
  return normalizeCivilizationTechTreeSpec(overrides);
}

export function renderCivilizationTechnologyTreeRcl(input = {}) {
  const spec = normalizeCivilizationTechTreeSpec(input);
  const bundle = runCivilizationTechnologyTreeCompiler(spec);
  return `reality CivilizationTechnologyTreeCompiler {\n  version = "${RCL_CIVILIZATION_TECH_TREE_VERSION}"\n  source = "v0.61 empirical lab notebooks"\n  node_count = ${bundle.result.nodeCount}\n  dependency_edges = ${bundle.result.dependencyEdgeCount}\n  roadmap_phases = ${bundle.result.roadmapPhaseCount}\n  validation.established : Truth = ${bundle.result.civilizationTechnologyTreeEstablished}\n  validation.average_tree_score = ${bundle.treeScores.averageTreeScore}\n  handoff.next = "v0.63 RNCS Execution Bridge v2"\n}\n`;
}

export function runCivilizationTechnologyTreeDemo() {
  const bundle = runCivilizationTechnologyTreeCompiler();
  return {
    ok: bundle.ok,
    version: RCL_CIVILIZATION_TECH_TREE_VERSION,
    civilizationTechnologyTreeEstablished: bundle.civilizationTechnologyTreeEstablished,
    nodeCount: bundle.result.nodeCount,
    establishedNodeCount: bundle.result.establishedNodeCount,
    dependencyEdgeCount: bundle.result.dependencyEdgeCount,
    roadmapPhaseCount: bundle.result.roadmapPhaseCount,
    averageTreeScore: bundle.treeScores.averageTreeScore,
    canonicalRoot: bundle.canonicalRoot,
  };
}

export function readCivilizationTechnologyTreeInput(filePath) {
  return normalizeCivilizationTechTreeSpec(JSON.parse(fs.readFileSync(filePath, 'utf8')));
}

export function writeCivilizationTechnologyTreeReports(outputDir, input = {}) {
  const spec = normalizeCivilizationTechTreeSpec(input);
  const bundle = runCivilizationTechnologyTreeCompiler(spec);
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, 'civilization-technology-tree-spec.json'), `${JSON.stringify(spec, null, 2)}\n`);
  fs.writeFileSync(path.join(outputDir, 'civilization-technology-tree-result.json'), `${JSON.stringify(bundle.result, null, 2)}\n`);
  fs.writeFileSync(path.join(outputDir, 'technology-nodes.json'), `${JSON.stringify(bundle.nodes, null, 2)}\n`);
  fs.writeFileSync(path.join(outputDir, 'dependency-graph.json'), `${JSON.stringify(bundle.dependencyGraph, null, 2)}\n`);
  fs.writeFileSync(path.join(outputDir, 'civilization-roadmap.json'), `${JSON.stringify(bundle.roadmap, null, 2)}\n`);
  fs.writeFileSync(path.join(outputDir, 'capability-map.json'), `${JSON.stringify(bundle.capabilityMap, null, 2)}\n`);
  fs.writeFileSync(path.join(outputDir, 'civilization-technology-tree.json'), `${JSON.stringify(bundle.technologyTree, null, 2)}\n`);
  fs.writeFileSync(path.join(outputDir, 'civilization-technology-tree.rcl'), `${renderCivilizationTechnologyTreeRcl(spec)}\n`);
  const docDir = path.join(outputDir, 'technology-tree-docs');
  fs.mkdirSync(docDir, { recursive: true });
  for (const doc of bundle.documents) {
    fs.writeFileSync(path.join(docDir, `${safeId(doc.id)}.md`), `${doc.markdown}\n`);
  }
  return {
    ok: bundle.ok,
    version: RCL_CIVILIZATION_TECH_TREE_VERSION,
    outputDir,
    civilizationTechnologyTreeEstablished: bundle.civilizationTechnologyTreeEstablished,
    nodeCount: bundle.result.nodeCount,
    establishedNodeCount: bundle.result.establishedNodeCount,
    dependencyEdgeCount: bundle.result.dependencyEdgeCount,
    documentCount: bundle.documents.length,
    canonicalRoot: bundle.canonicalRoot,
  };
}

export function civilizationTechnologyTreeCanonicalRoot(payload = {}) {
  return sha256(JSON.stringify(payload));
}
