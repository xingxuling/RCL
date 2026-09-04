import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { compileRealityToBytecode } from './bytecode.mjs';
import { runNativeBytecode } from './native-vm.mjs';
import { canonicalJson, evidenceRoot } from './universal-program-stress.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const SELFHOST_TENSOR_PLAN_LIVENESS_PATH = path.join(ROOT, 'examples', 'native-ai', 'tensor-plan-liveness-genome.rcl');
export const SELFHOST_TENSOR_PLAN_LIVENESS_FORMAT = 'rcl.selfhost.tensor-plan-liveness.v0.1';
const GRAPH_MARKER = '  reckon graph() -> Sequence = default_graph()';

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
  const nodes = Array.isArray(input.nodes) ? input.nodes : [];
  const outputs = Array.isArray(input.outputs) ? input.outputs : [];
  return {
    nodes: nodes.map((node) => ({
      id: String(node?.id ?? ''),
      operation: String(node?.operation ?? ''),
      inputs: Array.isArray(node?.inputs) ? node.inputs.map((value) => String(value)) : [],
      bytes: Number.isFinite(Number(node?.bytes)) ? Number(node.bytes) : 0,
    })),
    outputs: outputs.map((value) => String(value)),
  };
}

function nodeExpression(node) {
  return `make_node(${textLiteral(node.id)}, ${textLiteral(node.operation)}, ${sequenceLiteral(node.inputs, textLiteral)}, ${node.bytes})`;
}

function readTemplate() {
  const template = fs.readFileSync(SELFHOST_TENSOR_PLAN_LIVENESS_PATH, 'utf8');
  if (!template.includes(GRAPH_MARKER)) throw new Error('RCL_SELFHOST_TENSOR_PLAN_GRAPH_MARKER_MISSING');
  return template;
}

export function renderSelfHostedTensorPlanLiveness(graphInput = {}) {
  const graph = normalizeGraph(graphInput);
  const graphExpression = sequenceLiteral(graph.nodes, nodeExpression);
  const outputExpression = sequenceLiteral(graph.outputs, textLiteral);
  return readTemplate()
    .replace(GRAPH_MARKER, `  reckon graph() -> Sequence = ${graphExpression}`)
    .replace('  reckon requested_outputs() -> Sequence = one_text("loss")', `  reckon requested_outputs() -> Sequence = ${outputExpression}`);
}

export function runSelfHostedTensorPlanLiveness(graphInput = {}, options = {}) {
  const graph = normalizeGraph(graphInput);
  const source = renderSelfHostedTensorPlanLiveness(graph);
  const bytecode = compileRealityToBytecode(source);
  const native = runNativeBytecode(Buffer.from(bytecode), {
    timeout: options.timeout ?? 120_000,
    maxBuffer: options.maxBuffer ?? 32 * 1024 * 1024,
    vmPath: options.vmPath,
    requireNativeStateRoot: options.requireNativeStateRoot,
  });
  const state = native.state;
  const report = {
    format: SELFHOST_TENSOR_PLAN_LIVENESS_FORMAT,
    graph,
    graphRoot: evidenceRoot(graph),
    sourceSha256: sha256(source),
    plan: {
      status: state['plan.status'],
      lastUse: state['plan.last_use'],
      assignments: state['plan.assignments'],
      active: state['plan.active'],
      free: state['plan.free'],
      slotCount: state['plan.slot_count'],
      allocatedBytes: state['plan.allocated_bytes'],
      livePeakBytes: state['plan.live_peak_bytes'],
      reusedCount: state['plan.reused_count'],
    },
    evaluation: {
      graphValid: state['graph.valid'] === true,
      compactReuse: state['evaluation.compact_reuse'] === true,
      positiveAllocation: state['evaluation.positive_allocation'] === true,
      outputRetained: state['evaluation.output_retained'] === true,
    },
    native: {
      sourceRoot: native.sourceRoot,
      semanticStateRoot: native.semanticStateRoot,
      stateRootVerified: native.stateRootVerified === true,
    },
    boundary: 'RCL_OWNS_ORDERED_GRAPH_VALIDATION_LAST_USE_AND_EXACT_SLOT_REUSE; EXECUTION_BACKEND_REMAINS_EXTERNAL',
  };
  report.reportRoot = evidenceRoot({ ...report, reportRoot: undefined });
  return Object.freeze(report);
}

export function tensorPlanLivenessCanonical(report) {
  if (!report || report.format !== SELFHOST_TENSOR_PLAN_LIVENESS_FORMAT) throw new Error('RCL_SELFHOST_TENSOR_PLAN_LIVENESS_REPORT_INVALID');
  return canonicalJson({
    graphRoot: report.graphRoot,
    plan: report.plan,
    evaluation: report.evaluation,
  });
}
