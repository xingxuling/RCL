import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { compileSourceSelfHosted } from './selfhost-compiler.mjs';
import { runNativeBytecode } from './native-vm.mjs';
import { canonicalJson, evidenceRoot } from './universal-program-stress.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const SELFHOST_GENERAL_MLP_TENSOR_LOWERING_PATH = path.join(
  ROOT,
  'examples',
  'native-ai',
  'general-mlp-tensor-lowering-genome.rcl',
);
export const SELFHOST_GENERAL_MLP_TENSOR_LOWERING_FORMAT = 'rcl.selfhost.general-mlp-tensor-lowering.v0.1';

const OPERATION_MARKER = '  reckon operation_inventory() -> Sequence = default_inventory()';
const NODE_COUNT_MARKER = '  facet plan.node_count : Number = 0';
const INITIAL_TENSOR_COUNT_MARKER = '  facet plan.initial_tensor_count : Number = 0';
const OUTPUT_COUNT_MARKER = '  facet plan.output_count : Number = 0';
const MODEL_SOURCE_MARKER = '  facet binding.model_source_sha256 : Text = ""';
const CONTRACT_ROOT_MARKER = '  facet binding.contract_root : Text = ""';
const MANIFEST_MARKER = '  facet binding.manifest_canonical : Text = "{}"';
const MANIFEST_ROOT_MARKER = '  facet binding.manifest_root : Text = ""';

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function textLiteral(value) {
  return JSON.stringify(String(value));
}

function numberLiteral(value) {
  if (!Number.isInteger(value) || value < 0) throw new Error('RCL_AI009_NON_NEGATIVE_INTEGER_REQUIRED');
  return String(value);
}

function sequenceLiteral(values) {
  let expression = 'empty_sequence()';
  for (const value of values) {
    expression = `sequence_append(${expression}, make_operation(${textLiteral(value.name)}, ${numberLiteral(value.count)}))`;
  }
  return expression;
}

function readTemplate() {
  const source = fs.readFileSync(SELFHOST_GENERAL_MLP_TENSOR_LOWERING_PATH, 'utf8');
  for (const marker of [
    OPERATION_MARKER,
    NODE_COUNT_MARKER,
    INITIAL_TENSOR_COUNT_MARKER,
    OUTPUT_COUNT_MARKER,
    MODEL_SOURCE_MARKER,
    CONTRACT_ROOT_MARKER,
    MANIFEST_MARKER,
    MANIFEST_ROOT_MARKER,
  ]) {
    if (!source.includes(marker)) throw new Error(`RCL_AI009_TEMPLATE_MARKER_MISSING:${marker}`);
  }
  return source;
}

export function manifestFromTensorPlan(plan, bindings = {}) {
  const nodes = Array.isArray(plan?.nodes) ? plan.nodes : [];
  const counts = new Map();
  for (const node of nodes) {
    const operation = String(node?.operation ?? '');
    counts.set(operation, (counts.get(operation) ?? 0) + 1);
  }
  const manifest = {
    planFormat: String(plan?.format ?? ''),
    nodeCount: nodes.length,
    initialTensorCount: Array.isArray(plan?.tensors) ? plan.tensors.length : 0,
    outputCount: Array.isArray(plan?.outputs) ? plan.outputs.length : 0,
    operationInventory: [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((left, right) => left.name.localeCompare(right.name)),
    modelSourceSha256: String(bindings.modelSourceSha256 ?? ''),
    contractRoot: String(bindings.contractRoot ?? ''),
  };
  const manifestCanonical = canonicalJson(manifest);
  return Object.freeze({
    ...manifest,
    manifestCanonical,
    manifestRoot: sha256(manifestCanonical),
  });
}

export function renderSelfHostedGeneralMlpTensorLowering(manifest, options = {}) {
  if (!manifest || !Array.isArray(manifest.operationInventory)) throw new Error('RCL_AI009_MANIFEST_REQUIRED');
  const declaredManifestRoot = options.declaredManifestRoot ?? manifest.manifestRoot;
  return readTemplate()
    .replace(OPERATION_MARKER, `  reckon operation_inventory() -> Sequence = ${sequenceLiteral(manifest.operationInventory)}`)
    .replace(NODE_COUNT_MARKER, `  facet plan.node_count : Number = ${numberLiteral(manifest.nodeCount)}`)
    .replace(INITIAL_TENSOR_COUNT_MARKER, `  facet plan.initial_tensor_count : Number = ${numberLiteral(manifest.initialTensorCount)}`)
    .replace(OUTPUT_COUNT_MARKER, `  facet plan.output_count : Number = ${numberLiteral(manifest.outputCount)}`)
    .replace(MODEL_SOURCE_MARKER, `  facet binding.model_source_sha256 : Text = ${textLiteral(manifest.modelSourceSha256)}`)
    .replace(CONTRACT_ROOT_MARKER, `  facet binding.contract_root : Text = ${textLiteral(manifest.contractRoot)}`)
    .replace(MANIFEST_MARKER, `  facet binding.manifest_canonical : Text = ${textLiteral(manifest.manifestCanonical)}`)
    .replace(MANIFEST_ROOT_MARKER, `  facet binding.manifest_root : Text = ${textLiteral(declaredManifestRoot)}`);
}

export function runSelfHostedGeneralMlpTensorLowering(plan, bindings = {}, options = {}) {
  const manifest = manifestFromTensorPlan(plan, bindings);
  const source = renderSelfHostedGeneralMlpTensorLowering(manifest, options);
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
  const report = {
    format: SELFHOST_GENERAL_MLP_TENSOR_LOWERING_FORMAT,
    manifest,
    sourceSha256: sha256(source),
    lowering: {
      status: native.state['lowering.status'],
      accepted: native.state['evaluation.accepted'] === true,
      operationInventory: native.state['plan.operation_inventory'],
      operationTotal: native.state['plan.operation_total'],
      nodeCount: native.state['plan.node_count'],
    },
    evaluation: {
      manifestRootValid: native.state['evaluation.manifest_root_valid'] === true,
      genericOnly: native.state['evaluation.generic_only'] === true,
      planCardinalityValid: native.state['evaluation.plan_cardinality_valid'] === true,
    },
    native: {
      sourceRoot: native.sourceRoot,
      semanticStateRoot: native.semanticStateRoot,
      stateRootVerified: native.stateRootVerified === true,
    },
    boundary: 'RCL_OWNS_GENERIC_OPERATION_ADMISSION_PLAN_CARDINALITY_AND_MANIFEST_BINDING; AUXILIARY_EMITTER_AND_TENSOR_BACKEND_REMAIN_EXTERNAL',
  };
  report.reportRoot = evidenceRoot({ ...report, reportRoot: undefined });
  return Object.freeze(report);
}

export function generalMlpTensorLoweringCanonical(report) {
  if (!report || report.format !== SELFHOST_GENERAL_MLP_TENSOR_LOWERING_FORMAT) throw new Error('RCL_AI009_REPORT_INVALID');
  return canonicalJson({
    manifest: report.manifest,
    lowering: report.lowering,
    evaluation: report.evaluation,
  });
}
