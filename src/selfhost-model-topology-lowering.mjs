import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { compileSourceSelfHosted } from './selfhost-compiler.mjs';
import { runNativeBytecode } from './native-vm.mjs';
import { canonicalJson, evidenceRoot } from './universal-program-stress.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const SELFHOST_MODEL_TOPOLOGY_LOWERING_PATH = path.join(
  ROOT,
  'examples',
  'native-ai',
  'model-topology-lowering-genome.rcl',
);
export const SELFHOST_MODEL_TOPOLOGY_LOWERING_FORMAT = 'rcl.selfhost.model-topology-lowering.v0.1';
export const MODEL_TOPOLOGY_FORMAT = 'rcl.model-topology.v0.1';

const BLOCKS_MARKER = '  reckon topology_blocks() -> Sequence = default_blocks()';
const PARAMETERS_MARKER = '  reckon topology_parameters() -> Sequence = default_parameters()';
const EMBEDDING_PARAMETERS_MARKER = '  reckon embedding_parameters() -> Sequence = default_embedding_parameters()';
const OUTPUT_PARAMETERS_MARKER = '  reckon output_parameters() -> Sequence = default_output_parameters()';
const GRAPH_PARAMETERS_MARKER = '  reckon graph_parameter_ids() -> Sequence = default_graph_parameter_ids()';
const STAGES_MARKER = '  reckon graph_stages() -> Sequence = default_stages()';
const OPERATIONS_MARKER = '  reckon graph_operations() -> Sequence = default_operations()';
const REQUIRED_OPERATIONS_MARKER = '  reckon required_operations() -> Sequence = default_required_operations()';

const DEFAULT_REQUIRED_OPERATIONS = [
  'add',
  'activation',
  'broadcast',
  'div',
  'log',
  'matmul',
  'mean',
  'mul',
  'reshape',
  'softmax',
  'sqrt',
  'sub',
  'sum',
  'transpose',
];

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function integer(value, fallback = 0) {
  const number = Number(value);
  return Number.isInteger(number) ? number : fallback;
}

function textLiteral(value) {
  return JSON.stringify(String(value));
}

function numberLiteral(value) {
  if (!Number.isInteger(value)) throw new Error('RCL_AI012_INTEGER_REQUIRED');
  return String(value);
}

function sequenceLiteral(values, render) {
  let expression = 'empty_sequence()';
  for (const value of values) expression = `sequence_append(${expression}, ${render(value)})`;
  return expression;
}

function compareName(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function normalizeIds(values) {
  return Array.isArray(values) ? values.map((value) => String(value)) : [];
}

export function normalizeModelTopology(input = {}) {
  const sourceBlocks = Array.isArray(input.blocks) ? input.blocks : [];
  const blocks = sourceBlocks.map((block, index) => ({
    index: integer(block?.index, index),
    stageName: String(block?.stageName ?? `block.${index}`),
    parameterIds: normalizeIds(block?.parameterIds),
  }));
  const embeddingParameterIds = normalizeIds(input.embeddingParameterIds);
  const outputParameterIds = normalizeIds(input.outputParameterIds);
  const parameterIds = Array.isArray(input.parameterIds)
    ? normalizeIds(input.parameterIds)
    : [
        ...embeddingParameterIds,
        ...blocks.flatMap((block) => block.parameterIds),
        ...outputParameterIds,
      ];
  const requiredOperations = Array.isArray(input.requiredOperations)
    ? normalizeIds(input.requiredOperations)
    : [...DEFAULT_REQUIRED_OPERATIONS];
  return Object.freeze({
    format: String(input.format ?? MODEL_TOPOLOGY_FORMAT),
    architecture: String(input.architecture ?? 'decoder-lm'),
    vocabularySize: integer(input.vocabularySize),
    contextLength: integer(input.contextLength),
    hiddenSize: integer(input.hiddenSize),
    feedForwardSize: integer(input.feedForwardSize),
    queryHeads: integer(input.queryHeads),
    kvHeads: integer(input.kvHeads),
    headDimension: integer(input.headDimension),
    blockCount: integer(input.blockCount, blocks.length),
    blocks,
    embeddingParameterIds,
    outputParameterIds,
    parameterIds,
    requiredOperations,
  });
}

function graphStageName(node) {
  const id = String(node?.id ?? '').replace(/^node:/, '');
  if (id === 'embedding' || id.startsWith('embedding.')) return 'embedding';
  const block = id.match(/^block\.(\d+)(?:\.|$)/);
  if (block) return `block.${block[1]}`;
  if (/^lm(?:\.|$)/.test(id)) return 'lm';
  if (/^loss(?:\.|$)/.test(id)) return 'loss';
  return 'unclassified';
}

function inventoryFromNodes(nodes, readName) {
  const counts = new Map();
  for (const node of nodes) {
    const name = String(readName(node));
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((left, right) => compareName(left.name, right.name));
}

function normalizeInventory(values) {
  const counts = new Map();
  for (const item of Array.isArray(values) ? values : []) {
    const name = String(item?.name ?? '');
    const count = integer(item?.count);
    counts.set(name, (counts.get(name) ?? 0) + count);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((left, right) => compareName(left.name, right.name));
}

export function modelTopologyGraphManifest(graph = {}) {
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const tensors = Array.isArray(graph.tensors) ? graph.tensors : [];
  const parameterIds = Array.isArray(graph.parameterIds)
    ? normalizeIds(graph.parameterIds)
    : tensors
        .filter((tensor) => String(tensor?.gradientIdentity ?? '').startsWith('parameter:'))
        .map((tensor) => String(tensor?.id ?? ''));
  const operationInventory = Array.isArray(graph.operationInventory)
    ? normalizeInventory(graph.operationInventory)
    : inventoryFromNodes(nodes, (node) => node?.operation ?? '');
  const stageInventory = Array.isArray(graph.stageInventory)
    ? normalizeInventory(graph.stageInventory)
    : inventoryFromNodes(nodes, graphStageName);
  return Object.freeze({
    format: String(graph.format ?? ''),
    nodeCount: integer(graph.nodeCount, nodes.length),
    initialTensorCount: integer(graph.initialTensorCount, tensors.length),
    outputCount: integer(graph.outputCount, Array.isArray(graph.outputs) ? graph.outputs.length : 0),
    parameterIds,
    stageInventory,
    operationInventory,
  });
}

export function buildModelTopologyLoweringManifest(topologyInput, graphInput, bindings = {}) {
  const topology = normalizeModelTopology(topologyInput);
  const graph = modelTopologyGraphManifest(graphInput);
  const topologyCanonical = canonicalJson(topology);
  const graphCanonical = canonicalJson(graph);
  return Object.freeze({
    format: SELFHOST_MODEL_TOPOLOGY_LOWERING_FORMAT,
    topology,
    graph,
    bindings: {
      topologySourceSha256: String(bindings.topologySourceSha256 ?? ''),
      topologyContractRoot: String(bindings.topologyContractRoot ?? ''),
      topologyCanonical,
      topologyRoot: sha256(topologyCanonical),
      graphCanonical,
      graphRoot: sha256(graphCanonical),
    },
  });
}

function blockLiteral(block) {
  return `make_block(${numberLiteral(block.index)}, ${textLiteral(block.stageName)}, ${sequenceLiteral(block.parameterIds, textLiteral)})`;
}

function stageLiteral(stage) {
  return `make_stage(${textLiteral(stage.name)}, ${numberLiteral(stage.count)})`;
}

function operationLiteral(operation) {
  return `make_operation(${textLiteral(operation.name)}, ${numberLiteral(operation.count)})`;
}

function readTemplate() {
  const source = fs.readFileSync(SELFHOST_MODEL_TOPOLOGY_LOWERING_PATH, 'utf8');
  for (const marker of [
    BLOCKS_MARKER,
    PARAMETERS_MARKER,
    EMBEDDING_PARAMETERS_MARKER,
    OUTPUT_PARAMETERS_MARKER,
    GRAPH_PARAMETERS_MARKER,
    STAGES_MARKER,
    OPERATIONS_MARKER,
    REQUIRED_OPERATIONS_MARKER,
  ]) {
    if (!source.includes(marker)) throw new Error(`RCL_AI012_TEMPLATE_MARKER_MISSING:${marker}`);
  }
  return source;
}

export function renderSelfHostedModelTopologyLowering(manifest, options = {}) {
  if (!manifest || manifest.format !== SELFHOST_MODEL_TOPOLOGY_LOWERING_FORMAT) throw new Error('RCL_AI012_MANIFEST_REQUIRED');
  const { topology, graph, bindings } = manifest;
  const declaredTopologyRoot = String(options.declaredTopologyRoot ?? bindings.topologyRoot);
  const declaredGraphRoot = String(options.declaredGraphRoot ?? bindings.graphRoot);
  return readTemplate()
    .replace(BLOCKS_MARKER, `  reckon topology_blocks() -> Sequence = ${sequenceLiteral(topology.blocks, blockLiteral)}`)
    .replace(PARAMETERS_MARKER, `  reckon topology_parameters() -> Sequence = ${sequenceLiteral(topology.parameterIds, textLiteral)}`)
    .replace(EMBEDDING_PARAMETERS_MARKER, `  reckon embedding_parameters() -> Sequence = ${sequenceLiteral(topology.embeddingParameterIds, textLiteral)}`)
    .replace(OUTPUT_PARAMETERS_MARKER, `  reckon output_parameters() -> Sequence = ${sequenceLiteral(topology.outputParameterIds, textLiteral)}`)
    .replace(GRAPH_PARAMETERS_MARKER, `  reckon graph_parameter_ids() -> Sequence = ${sequenceLiteral(graph.parameterIds, textLiteral)}`)
    .replace(STAGES_MARKER, `  reckon graph_stages() -> Sequence = ${sequenceLiteral(graph.stageInventory, stageLiteral)}`)
    .replace(OPERATIONS_MARKER, `  reckon graph_operations() -> Sequence = ${sequenceLiteral(graph.operationInventory, operationLiteral)}`)
    .replace(REQUIRED_OPERATIONS_MARKER, `  reckon required_operations() -> Sequence = ${sequenceLiteral(topology.requiredOperations, textLiteral)}`)
    .replace('  facet model.architecture : Text = ""', `  facet model.architecture : Text = ${textLiteral(topology.architecture)}`)
    .replace('  facet model.vocabulary_size : Number = 0', `  facet model.vocabulary_size : Number = ${numberLiteral(topology.vocabularySize)}`)
    .replace('  facet model.context_length : Number = 0', `  facet model.context_length : Number = ${numberLiteral(topology.contextLength)}`)
    .replace('  facet model.hidden_size : Number = 0', `  facet model.hidden_size : Number = ${numberLiteral(topology.hiddenSize)}`)
    .replace('  facet model.feed_forward_size : Number = 0', `  facet model.feed_forward_size : Number = ${numberLiteral(topology.feedForwardSize)}`)
    .replace('  facet model.query_heads : Number = 0', `  facet model.query_heads : Number = ${numberLiteral(topology.queryHeads)}`)
    .replace('  facet model.kv_heads : Number = 0', `  facet model.kv_heads : Number = ${numberLiteral(topology.kvHeads)}`)
    .replace('  facet model.head_dimension : Number = 0', `  facet model.head_dimension : Number = ${numberLiteral(topology.headDimension)}`)
    .replace('  facet model.block_count : Number = 0', `  facet model.block_count : Number = ${numberLiteral(topology.blockCount)}`)
    .replace('  facet binding.topology_source_sha256 : Text = ""', `  facet binding.topology_source_sha256 : Text = ${textLiteral(bindings.topologySourceSha256)}`)
    .replace('  facet binding.topology_contract_root : Text = ""', `  facet binding.topology_contract_root : Text = ${textLiteral(bindings.topologyContractRoot)}`)
    .replace('  facet binding.topology_canonical : Text = "{}"', `  facet binding.topology_canonical : Text = ${textLiteral(bindings.topologyCanonical)}`)
    .replace('  facet binding.topology_root : Text = ""', `  facet binding.topology_root : Text = ${textLiteral(declaredTopologyRoot)}`)
    .replace('  facet binding.graph_canonical : Text = "{}"', `  facet binding.graph_canonical : Text = ${textLiteral(bindings.graphCanonical)}`)
    .replace('  facet binding.graph_root : Text = ""', `  facet binding.graph_root : Text = ${textLiteral(declaredGraphRoot)}`)
    .replace('  facet graph.format : Text = ""', `  facet graph.format : Text = ${textLiteral(graph.format)}`)
    .replace('  facet graph.node_count : Number = 0', `  facet graph.node_count : Number = ${numberLiteral(graph.nodeCount)}`)
    .replace('  facet graph.initial_tensor_count : Number = 0', `  facet graph.initial_tensor_count : Number = ${numberLiteral(graph.initialTensorCount)}`)
    .replace('  facet graph.output_count : Number = 0', `  facet graph.output_count : Number = ${numberLiteral(graph.outputCount)}`);
}

export function runSelfHostedModelTopologyLowering(topologyInput, graphInput, bindings = {}, options = {}) {
  const manifest = buildModelTopologyLoweringManifest(topologyInput, graphInput, bindings);
  const source = renderSelfHostedModelTopologyLowering(manifest, options);
  const bytecode = compileSourceSelfHosted(source, {
    compilerArtifactPath: options.compilerArtifactPath,
    compilerPath: options.compilerPath,
    timeout: options.compileTimeout ?? 120_000,
    maxBuffer: options.maxBuffer ?? 64 * 1024 * 1024,
  });
  const native = runNativeBytecode(bytecode, {
    vmPath: options.vmPath,
    timeout: options.timeout ?? 120_000,
    maxBuffer: options.maxBuffer ?? 64 * 1024 * 1024,
    requireNativeStateRoot: options.requireNativeStateRoot ?? true,
  });
  const state = native.state;
  const report = {
    format: SELFHOST_MODEL_TOPOLOGY_LOWERING_FORMAT,
    manifest,
    sourceSha256: sha256(source),
    lowering: {
      status: state['lowering.status'],
      accepted: state['evaluation.accepted'] === true,
      blockCount: state['topology.block_count'],
      graphNodeCount: state['graph.node_count'],
      graphOperationTotal: state['graph.operation_total'],
    },
    evaluation: {
      topologyRootValid: state['evaluation.topology_root_valid'] === true,
      graphRootValid: state['evaluation.graph_root_valid'] === true,
      topologyValid: state['evaluation.topology_valid'] === true,
      parameterBindingValid: state['evaluation.parameter_binding_valid'] === true,
      stageCoverageValid: state['evaluation.stage_coverage_valid'] === true,
      genericOperationPolicy: state['evaluation.generic_operation_policy'] === true,
      graphCardinalityValid: state['evaluation.graph_cardinality_valid'] === true,
      parameterCountValid: state['evaluation.parameter_count_valid'] === true,
      graphParametersUnique: state['evaluation.graph_parameters_unique'] === true,
      topologyParametersInGraph: state['evaluation.topology_parameters_in_graph'] === true,
      graphParametersInTopology: state['evaluation.graph_parameters_in_topology'] === true,
      accepted: state['evaluation.accepted'] === true,
    },
    native: {
      sourceRoot: native.sourceRoot,
      semanticStateRoot: native.semanticStateRoot,
      stateRootVerified: native.stateRootVerified === true,
    },
    boundary: 'RCL_OWNS_MODEL_TOPOLOGY_PARAMETER_STAGE_AND_GENERIC_GRAPH_ADMISSION; AUXILIARY_GRAPH_BUILDER_AND_TENSOR_AUTODIFF_BACKEND_REMAIN_EXTERNAL',
  };
  report.reportRoot = evidenceRoot({ ...report, reportRoot: undefined });
  return Object.freeze(report);
}

export function modelTopologyLoweringCanonical(report) {
  if (!report || report.format !== SELFHOST_MODEL_TOPOLOGY_LOWERING_FORMAT) throw new Error('RCL_AI012_REPORT_INVALID');
  return canonicalJson({ manifest: report.manifest, lowering: report.lowering, evaluation: report.evaluation });
}
