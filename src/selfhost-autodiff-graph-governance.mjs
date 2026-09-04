import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { compileRealityToBytecode } from './bytecode.mjs';
import { runNativeBytecode } from './native-vm.mjs';
import { evidenceRoot } from './universal-program-stress.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const SELFHOST_AUTODIFF_GRAPH_GOVERNANCE_PATH = path.join(ROOT, 'examples', 'native-ai', 'autodiff-graph-governance-genome.rcl');
export const SELFHOST_AUTODIFF_GRAPH_GOVERNANCE_FORMAT = 'rcl.selfhost.autodiff-graph-governance.v0.1';
const PARAMETERS_MARKER = '  reckon parameters() -> Sequence = default_parameters()';
const OPERATIONS_MARKER = '  reckon operations() -> Sequence = default_operations()';
const STOPS_MARKER = '  reckon stop_gradients() -> Sequence = default_stop_gradients()';
const LOSS_MARKER = '  reckon loss() -> Text = default_loss()';

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function textLiteral(value) {
  return JSON.stringify(String(value));
}

function sequenceLiteral(values, render) {
  let expression = 'empty_sequence()';
  for (const value of values) expression = `sequence_append(${expression}, ${render(value)})`;
  return expression;
}

function normalizeGraph(input = {}) {
  const parameters = Array.isArray(input.parameters) ? input.parameters : [];
  const operations = Array.isArray(input.operations) ? input.operations : [];
  const stopGradients = Array.isArray(input.stopGradients) ? input.stopGradients : [];
  return {
    parameters: parameters.map((parameter) => ({
      id: String(parameter?.id ?? ''),
      gradientIdentity: String(parameter?.gradientIdentity ?? ''),
    })),
    operations: operations.map((operation) => ({
      id: String(operation?.id ?? ''),
      kind: String(operation?.kind ?? operation?.operation ?? ''),
      inputs: Array.isArray(operation?.inputs) ? operation.inputs.map((value) => String(value)) : [],
      output: String(operation?.output ?? ''),
    })),
    stopGradients: stopGradients.map((value) => String(value?.id ?? value)),
    loss: String(input.loss ?? ''),
  };
}

function parameterExpression(parameter) {
  return `make_parameter(${textLiteral(parameter.id)}, ${textLiteral(parameter.gradientIdentity)})`;
}

function operationExpression(operation) {
  return `make_operation(${textLiteral(operation.id)}, ${textLiteral(operation.kind)}, ${sequenceLiteral(operation.inputs, textLiteral)}, ${textLiteral(operation.output)})`;
}

function readTemplate() {
  const template = fs.readFileSync(SELFHOST_AUTODIFF_GRAPH_GOVERNANCE_PATH, 'utf8');
  for (const marker of [PARAMETERS_MARKER, OPERATIONS_MARKER, STOPS_MARKER, LOSS_MARKER]) {
    if (!template.includes(marker)) throw new Error(`RCL_SELFHOST_AUTODIFF_GRAPH_MARKER_MISSING:${marker}`);
  }
  return template;
}

export function renderSelfHostedAutodiffGraphGovernance(input = {}) {
  const graph = normalizeGraph(input);
  const parameters = sequenceLiteral(graph.parameters, parameterExpression);
  const operations = sequenceLiteral(graph.operations, operationExpression);
  const stops = sequenceLiteral(graph.stopGradients, (value) => `make_stop_gradient(${textLiteral(value)})`);
  return readTemplate()
    .replace(PARAMETERS_MARKER, `  reckon parameters() -> Sequence = ${parameters}`)
    .replace(OPERATIONS_MARKER, `  reckon operations() -> Sequence = ${operations}`)
    .replace(STOPS_MARKER, `  reckon stop_gradients() -> Sequence = ${stops}`)
    .replace(LOSS_MARKER, `  reckon loss() -> Text = ${textLiteral(graph.loss)}`);
}

export function runSelfHostedAutodiffGraphGovernance(input = {}, options = {}) {
  const graph = normalizeGraph(input);
  const source = renderSelfHostedAutodiffGraphGovernance(graph);
  const bytecode = compileRealityToBytecode(source);
  const native = runNativeBytecode(Buffer.from(bytecode), {
    timeout: options.timeout ?? 120_000,
    maxBuffer: options.maxBuffer ?? 32 * 1024 * 1024,
    vmPath: options.vmPath,
    requireNativeStateRoot: options.requireNativeStateRoot,
  });
  const state = native.state;
  const report = {
    format: SELFHOST_AUTODIFF_GRAPH_GOVERNANCE_FORMAT,
    graph,
    graphRoot: evidenceRoot(graph),
    sourceSha256: sha256(source),
    semantic: {
      valid: state['graph.valid'] === true,
      parameters: state['graph.parameters'],
      operations: state['graph.operations'],
      stopGradients: state['graph.stop_gradients'],
      loss: state['graph.loss'],
      backwardEdges: state['backward.edges'],
      edgeCount: state['backward.edge_count'],
      accumulators: state['gradient.accumulators'],
      accumulatorCount: state['gradient.accumulator_count'],
    },
    evaluation: {
      graphValid: state['evaluation.graph_valid'] === true,
      backwardEdgesExist: state['evaluation.backward_edges_exist'] === true,
      deterministicAccumulation: state['evaluation.deterministic_accumulation'] === true,
      stopGradientBlocks: state['evaluation.stop_gradient_blocks'] === true,
    },
    native: {
      sourceRoot: native.sourceRoot,
      semanticStateRoot: native.semanticStateRoot,
      stateRootVerified: native.stateRootVerified === true,
    },
    boundary: 'RCL_OWNS_GRAPH_IDENTITY_VALIDATION_REVERSE_EDGE_ORDER_AND_GRADIENT_CONTRIBUTION_GROUPING; NUMERIC_KERNEL_REMAINS_PROVIDER_OWNED',
  };
  report.reportRoot = evidenceRoot({ ...report, reportRoot: undefined });
  return Object.freeze(report);
}
